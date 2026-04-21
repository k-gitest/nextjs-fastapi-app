/**
 * クライアント側のバリデーションエラーを表すクラス
 * Zodなどのスキーマバリデーションで使用
 */
export class ValidationError extends Error {
  public override readonly name = 'ValidationError';
  
  // プロパティを明示的に宣言
  public readonly fields?: Record<string, string[]>;

  constructor(
    message: string = '入力内容に誤りがあります',
    fields?: Record<string, string[]>,
  ) {
    super(message);
    
    // 手動で値を代入
    this.fields = fields;
    
    // TypeScriptのビルトインErrorとの互換性を保つ
    Object.setPrototypeOf(this, ValidationError.prototype);
  }

  /**
   * 特定フィールドのエラーメッセージを取得
   */
  getFieldErrors(fieldName: string): string[] | null {
    return this.fields?.[fieldName] || null;
  }

  /**
   * 全てのエラーメッセージをフラットな配列で取得
   */
  get allMessages(): string[] {
    if (!this.fields) return [this.message];
    
    return Object.values(this.fields).flat();
  }
}