import { http, HttpResponse } from "msw";

/**
 * GET /api/images/unassigned のデフォルトハンドラー。
 *
 * useUnassignedImages() を実際にMSW経由でレンダリングするintegrationテスト
 * （LibraryImagePicker等）で、未所属タブがSuspenseで止まったままにならないための
 * デフォルト応答。albums.handlers.tsのalbumHandlersと同一パターン。
 *
 * 未所属画像一覧の中身を検証したいテストでは、個別に
 * server.use(http.get("*​/api/images/unassigned", () => HttpResponse.json([...])))
 * で上書きする。
 */
export const imageHandlers = [
  http.get("*/api/images/unassigned", () => HttpResponse.json([])),
];