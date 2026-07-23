import { http, HttpResponse } from "msw";

/**
 * GET /api/albums のデフォルトハンドラー。
 *
 * Album機能（AlbumPanel・AlbumSelector等、Todoフローからは撤去済み）のテストで
 * useAlbums() が呼ばれた際、Suspenseが止まったままになる・MSWの未処理リクエスト
 * エラーになることを防ぐためのデフォルト応答。
 * Album機能自体を検証しないテストでは空配列で即座に解決させる。
 *
 * Album一覧の中身を検証したいテストでは、個別に
 * server.use(http.get("\*\/api/albums", () => HttpResponse.json([...]))) で上書きする。
 */
export const albumHandlers = [
  http.get("*/api/albums", () => HttpResponse.json([])),
];