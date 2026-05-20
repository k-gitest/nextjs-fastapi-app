/**
 * リソースが見つからない、または操作権限がない場合のエラークラス
 * サービス層でownership checkが失敗した場合に使用する
 *
 * Route Handler側で catch して 404 レスポンスを返す
 */
export class NotFoundError extends Error {
  public override readonly name = "NotFoundError";

  constructor(message = "Resource not found") {
    super(message);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}