## ISSUEサマリー表

| # | タイトル | 優先度感 |
|---|---|---|
| 1 | アップロード中削除時の通信打ち切り未対応 | 低（実害なし） |
| 2 | LibraryImageUploaderの設計比較コメント陳腐化 | 低（可読性のみ） |
| 3 | Album内画像の並び替え(DnD)未実装 | 中（機能未実装） |
| 4 | Sentry correlation_id の tags/context 統一 | 中（設計原則との不一致） |
| 5 | B2クライアント環境変数読み込みの見直し | 低（回避策あり） |
| 6 | Image Storage Lifecycle全体のWorker移管 | 大規模（アーキテクチャ変更） |
| 7 | B2アクセス層の共通化 | #6依存 |
| 8 | storageKey検証強化 | 中（セキュリティ関連） |
| 9 | StorageCleanupTask運用改善 | 低〜中（運用成熟後） |
| 10 | StorageCleanup/Outbox共通基盤化の再評価 | 低（設計記録） |
| 11 | storageCleanup.ts将来廃止判断 | 低（運用成熟後） |