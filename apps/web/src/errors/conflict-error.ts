/**
 * リソースの一意制約違反・状態競合を表す汎用エラークラス
 * Album名の重複（P2002）、Restrict制約によるFK違反（P2003）等を
 * サービス層でここに変換する。
 *
 * Album専用にせず、メッセージのみで用途を表現する汎用クラスとして設計している。
 *
 * Route Handler側で catch して 409 レスポンスを返す
 */
export class ConflictError extends Error {
  public override readonly name = "ConflictError";

  constructor(message = "Resource already exists") {
    super(message);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}