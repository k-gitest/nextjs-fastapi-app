/**
 * API通信エラーを表すカスタムエラークラス
 * HTTPステータスコードとレスポンスボディを保持
 */
export class ApiError extends Error {
  public override readonly name = 'ApiError'; // overrideを追加するとより安全

  // プロパティを明示的に宣言
  public readonly status: number;
  public readonly data?: unknown;
  public readonly originalError?: unknown;

  /**
   * dataプロパティの中から 'field' を安全に取得する
   */
  public get field(): string | undefined {
    if (this.data && typeof this.data === 'object' && 'field' in this.data) {
      return (this.data as { field: string }).field;
    }
    return undefined;
  }

  /**
   * dataプロパティの中から 'fields' を安全に取得する
   */
  public get fields(): Record<string, unknown> | undefined {
    if (this.data && typeof this.data === 'object' && 'fields' in this.data) {
      return (this.data as { fields: Record<string, unknown> }).fields;
    }
    return undefined;
  }

  constructor(
    status: number,
    message?: string,
    data?: unknown,
    originalError?: unknown,
  ) {
    super(message || `API Error: ${status}`);

    // 手動で値を代入
    this.status = status;
    this.data = data;
    this.originalError = originalError;

    // TypeScriptのビルトインErrorとの互換性を保つ
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /**
   * サーバーから返されたエラーメッセージを取得
   */
  get serverMessage(): string | null {
    return this.message || null;
  }

  /**
   * バリデーションエラーの場合、フィールド別エラーを取得
   */
  get fieldErrors(): Record<string, string[]> | null {
    // 400と409以外は、フォームに紐付けないので null で即復帰
    if (this.status !== 400 && this.status !== 409) return null;

    // 1. 明示的なフィールド指定がある場合 (GraphQLや特定の単一エラー用)
    // サービス層で field 引数が指定された場合、最優先でそのフィールドのエラーとして扱う
    if (this.field) {
      return {
        [this.field]: [this.message],
      };
    }
    // サービス層で明示的にエラーオブジェクト（fields）が作られた場合
    // GraphQLサービスなどで、パース済みの { fieldName: ["message"] } を渡すケース
    if (this.fields && typeof this.fields === 'object') {
      const normalized: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(this.fields)) {
        // string | string[] どちらが来ても string[] に正規化して RHF が読みやすくする
        normalized[key] = Array.isArray(value) ? value.map(String) : [String(value)];
      }
      return Object.keys(normalized).length > 0 ? normalized : null;
    }
    // 2. レスポンスデータから一括抽出する場合 (主にREST/DRF用)
    // dataオブジェクト(キー:メッセージの配列)をループして、全フィールドのエラーを解析する
    if (this.data && typeof this.data === 'object') {
      const errors: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(this.data)) {
        if (Array.isArray(value)) {
          errors[key] = value.map(String);
        } else if (typeof value === 'string') {
          errors[key] = [value];
        }
      }
      return Object.keys(errors).length > 0 ? errors : null;
    }
    return null;
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }

  get isForbiddenError(): boolean {
    return this.status === 403;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }

  get isValidationError(): boolean {
    return this.status === 400;
  }

  get isNotFoundError(): boolean {
    return this.status === 404;
  }

  get isConflictError(): boolean {
    return this.status === 409;
  }

  get isRateLimitError(): boolean {
    return this.status === 429;
  }
}