import { http, HttpResponse } from "msw";

/**
 * GET /api/albums のデフォルトハンドラー。
 *
 * TodoCreateForm/TodoEditModal 内の AlbumSelector が useAlbums() を呼ぶため、
 * Todo関連のコンポーネントテスト全般でこのエンドポイントへのリクエストが発生する。
 * Album機能自体を検証しないテストでは空配列で即座に解決させ、
 * Suspenseが止まったままになる・MSWの未処理リクエストエラーになることを防ぐ。
 *
 * Album一覧の中身を検証したいテストでは、個別に
 * server.use(http.get("\*\/api/albums", () => HttpResponse.json([...]))) で上書きする。
 */
export const albumHandlers = [
  http.get("*/api/albums", () => HttpResponse.json([])),
];