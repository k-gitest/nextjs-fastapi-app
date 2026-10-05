import { test as base, expect } from "@playwright/test";

/**
 * Album系E2Eのテストデータcleanupを担うfixture。
 *
 * テスト本体の`finally`ではなくfixtureのteardownで実行することで、
 * - 本体が失敗・timeoutした後もcleanupが実行される
 * - 削除確認ダイアログ等のUI操作に依存しない（API経由で削除する）
 * - cleanup失敗をレポートに残せる（annotation）
 * ようにする。
 *
 * fixtureには個別のtimeoutを設定している。cleanupの上限を、テストのtimeout設定
 * から切り離すためである。
 * teardownがこの上限を超えると、cleanup失敗ではなくテスト失敗になる。
 *
 * 使い方:
 * - Albumは「作成する前に」`trackAlbum(name)`で名前を登録する。teardownで
 *   `GET /api/albums`から名前でIDを解決して削除するため、作成直後にテストが
 *   落ちた場合も取りこぼさない。名前が変わるテスト（rename）は両方の名前を登録する。
 * - Album配下のImageはAlbum削除と同時に削除されるため、登録不要。
 *   未所属のまま残りうるImageだけ`trackImage(id)`で登録する。
 *   Albumへ移動できたImageは`untrackImage(id)`で外してよい。
 *
 * cleanupが失敗してもテスト本体の結果は変えない（例外は投げない）。
 * 失敗は`testInfo.annotations`と`console.warn`に記録する。
 */
export type CleanupRegistry = {
  trackAlbum: (name: string) => void;
  trackImage: (id: string) => void;
  untrackImage: (id: string) => void;
};

// cleanup全体（GET + 複数DELETE）に割り当てるfixtureのtimeout。
const CLEANUP_FIXTURE_TIMEOUT_MS = 30_000;
// 最悪の合計がfixtureのtimeoutを超えないようにする
const CLEANUP_REQUEST_TIMEOUT_MS = 5_000;

export const test = base.extend<{ cleanup: CleanupRegistry }>({
  cleanup: [
    async ({ page }, use, testInfo) => {
      const albumNames = new Set<string>();
      const imageIds = new Set<string>();

      await use({
        trackAlbum: (name) => {
          albumNames.add(name);
        },
        trackImage: (id) => {
          imageIds.add(id);
        },
        untrackImage: (id) => {
          imageIds.delete(id);
        },
      });

      const failures: string[] = [];

      // 204（削除成功）と404（既に存在しない）は成功扱い。
      // それ以外のstatus（429等）は、再試行せず記録のみ行う。
      const deleteResource = async (path: string, label: string) => {
        try {
          const res = await page.request.delete(path, {
            timeout: CLEANUP_REQUEST_TIMEOUT_MS,
          });
          if (res.status() === 204 || res.status() === 404) return;
          const retryAfter = res.headers()["retry-after"];
          failures.push(
            `${label}: DELETE ${path} -> ${res.status()}` +
              (retryAfter ? ` (Retry-After: ${retryAfter})` : ""),
          );
        } catch (error) {
          failures.push(`${label}: DELETE ${path} -> ${String(error)}`);
        }
      };

      if (albumNames.size > 0) {
        const albumIds = new Set<string>();
        try {
          const res = await page.request.get("/api/albums", {
            timeout: CLEANUP_REQUEST_TIMEOUT_MS,
          });
          if (res.ok()) {
            const albums: Array<{ id: string; name: string }> = await res.json();
            for (const album of albums) {
              if (albumNames.has(album.name)) albumIds.add(album.id);
            }
          } else {
            failures.push(
              `Album一覧の取得に失敗したためAlbumを削除できません: GET /api/albums -> ${res.status()}`,
            );
          }
        } catch (error) {
          failures.push(
            `Album一覧の取得に失敗したためAlbumを削除できません: ${String(error)}`,
          );
        }

        // 名前が複数登録されていても、同一Albumへのリクエストは1回にまとめる。
        for (const id of albumIds) {
          await deleteResource(`/api/albums/${id}`, "Album");
        }
      }

      // Album削除で既に消えているImageは404になるが、成功扱いで問題ない。
      for (const id of imageIds) {
        await deleteResource(`/api/images/${id}`, "Image");
      }

      for (const description of failures) {
        console.warn(`[e2e-cleanup] ${description}`);
        testInfo.annotations.push({ type: "cleanup-failed", description });
      }
    },
    { timeout: CLEANUP_FIXTURE_TIMEOUT_MS },
  ],
});

export { expect };