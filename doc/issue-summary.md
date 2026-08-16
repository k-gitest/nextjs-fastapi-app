## ISSUEサマリー表

| # | タイトル | 分類 | 優先度感 |
|---|---|---|---|
| 1 | アップロード中削除時の通信打ち切り未対応 | tech-debt | 低（実害なし） |
| 2 | LibraryImageUploaderの設計比較コメント陳腐化 | maintenance | 低（可読性のみ） |
| 3 | Album内画像の並び替え(DnD)未実装 | enhancement | 中（機能未実装） |
| 4 | Sentry correlation_id の tags/context 統一 | observability | 中（設計原則との不一致） |
| 5 | B2クライアント環境変数読み込みの見直し | tech-debt | 低（回避策あり） |
| 6 | Image Storage Lifecycle全体のWorker移管 | architecture | 大規模（アーキテクチャ変更） |
| 7 | B2アクセス層の共通化 | architecture | #6依存 |
| 8 | storageKey検証強化 | security | 中（セキュリティ関連） |
| 9 | StorageCleanupTask運用改善 | maintenance | 低〜中（運用成熟後） |
| 10 | StorageCleanup/Outbox共通基盤化の再評価 | design | 低（設計記録） |
| 11 | storageCleanup.ts将来廃止判断 | maintenance | 低（運用成熟後） |
| 12 | Album/ImageドメインのAnalyticsイベント対応要否を再評価 | design | 低（設計記録） |
| 13 | shadcn/uiフォームのARIAラベル付け不備 | tech-debt | 中（範囲精査が先） |
| 14 | 画像アップロードinputがshadcn/ui Inputを未使用 | tech-debt | 低（機械的修正で完了見込み） |