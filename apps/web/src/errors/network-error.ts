/**
 * ネットワーク通信エラーを表すカスタムエラークラス
 * タイムアウト、DNS解決失敗、接続失敗などが該当
 */
export class NetworkError extends Error {
  public override readonly name = 'NetworkError';
  
  // プロパティを明示的に宣言
  public readonly originalError?: unknown;

  constructor(
    message: string = 'ネットワークエラーが発生しました',
    originalError?: unknown,
  ) {
    super(message);
    
    // 手動で値を代入
    this.originalError = originalError;
    
    // TypeScriptのビルトインErrorとの互換性を保つ
    Object.setPrototypeOf(this, NetworkError.prototype);
  }

  /**
   * タイムアウトエラーかどうか
   */
  get isTimeout(): boolean {
    if (this.originalError instanceof Error) {
      // Kyやブラウザの標準的なタイムアウトメッセージを判定
      const msg = this.originalError.message.toLowerCase();
      return msg.includes('timeout') || msg.includes('aborted');
    }
    return false;
  }
}