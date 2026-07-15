/**
 * リソースの一意制約違反・状態競合を表す汎用エラークラス
 * Album名の重複（P2002）、Restrict制約によるFK違反（P2003）等を
 * サービス層でここに変換する。
 *
 * Album専用にせず汎用クラスとする。メッセージのみで用途を表現し、
 * 今後のリソース（タグ・カテゴリ等）でも再利用できるようにする。
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