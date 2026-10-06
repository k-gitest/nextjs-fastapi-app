# 開発ワークフロー — Issue / PR / Commit運用

このドキュメントは、GitHub Issue・PR・コミットメッセージの
役割分担と、Issue完了からSquash mergeまでの運用を定める。

Issue Close時の完了記録フォーマットは
`doc/issue-summary.md` を参照する。

---

## 各媒体の役割

| 媒体 | 役割 | 内容 |
|---|---|---|
| GitHub Issue | 作業・完了記録の本体 | 調査方法・判明したこと・対応した内容・検証結果・残課題（`doc/issue-summary.md`のテンプレートに従う） |
| PR | レビュー・統合の記録 | 対応するGitHub Issue番号を記載する。本文はIssue完了記録をベースとしたレビュー用の記録とする |
| Squash commit | Git履歴 | 変更内容とその理由を簡潔に要約する。Issue番号の記載は任意 |
| コードコメント | 現在の実装理解 | 現在も有効な設計理由・制約のみ（CLAUDE.md「コードコメント・ドキュメント参照方針」参照。Issue/PR番号には依存しない） |
| README / ADR | 恒久的設計判断 | プロジェクトとして残す設計判断 |

## 運用フロー

Issue作成 → 実装中は自由にコミット → PR作成（Issue番号を記載し、5項目フォーマットで記録） → レビュー・CI → Squash merge → Issue Close

## Issue番号の記載形式

PR・コミットメッセージでは、GitHubの自動リンク・自動クローズ等の管理機能に
依存する記法（`#1234` / `GH-1234` / `Fixes:` / `Closes:` 等）を使用しない。

代わりに `issue: 1234` の形式（小文字固定・コロン区切り）で記載する。これにより
`git log --grep="issue: "` で機械的に検索できる。括弧では囲まない（メタデータ行
として独立させるため）。

- PR：本文に `issue: 1234` を記載する（必須）
- Squash commit：本文末尾に `issue: 1234` を記載する（任意）

```text
fix(images): アップロード中削除時の通信を中断

アップロード中に削除された画像についても通信処理が継続し、
孤立したImageレコードが作成される問題を修正。

issue: 1234
```

## Squash mergeの原則

GitHubのSquash merge機能が自動生成するコミット本文（PR本文やコミット履歴の箇条書き）を
そのまま採用しない。マージ時に上記の形式へ整えること。PRに書いた「調査方法」
「検証結果」の詳細はSquash commitには含めない（詳細はIssue・PR側に残るため）。

### 含めないもの

- 調査方法
- 詳細な検証結果
- スクリーンショットやログ
- PRレビューでの議論
- Issue完了記録の詳細な経緯

### AIへの依頼時

Issue完了記録をSquash commit用に変換する場合、完了記録をそのまま縮めるのではなく、
本ドキュメントのフォーマットに沿って「変更内容」「変更理由・対応内容」のみを
抽出して再構成する。依頼文の例：

```text
doc/development-workflow.md のSquash commitフォーマットに従って、
この完了記録からSquash commit用のコミットメッセージを作成してください。
```

## コミットメッセージの原則

コミットメッセージへのIssue番号の記載は任意とする。記載する場合もGitHubのリンクや
自動追跡を前提とせず、補助的な情報として扱う。コミット本文単体で「何を・なぜ
変更したか」が理解できることを優先する。

この方針はCLAUDE.md「コードコメントの履歴依存参照を避ける」とは別軸である。
コードコメントは現在のコードと共に読まれる恒久的な情報のため参照を避けるが、
コミットメッセージ・PRは過去の変更履歴・作業記録であり、Issue番号の記載自体は
許容する（コミットでは必須化しない）。

## Release

### リリース方式

リリースは `production` への変更反映後に、GitHub Release を手動で作成する。

release branch は使用しない。

現在の開発フローでは、`production` へのマージ後に別途RC検証やhotfixを行う運用を採用していないため、release branchを維持する必要性がない。リリース対象は `production` にマージされたコミットそのものとする。

### リリースの流れ

基本的な流れは以下のとおり。

```text
feature
  ↓
staging
  ↓
production PR
  ↓
CI成功
  ↓
productionへmerge
  ↓
production deployment完了確認
  ↓
GitHub Release作成
```

GitHub Releaseは、production deploymentの完了を確認した後に作成する。

GitHub Actionsの成功だけではproduction deploymentの完了を意味しない。特に `terraform-apply.yml` のproduction deployでは、Renderへのデプロイ要求送信と実際のサービス反映完了を区別する必要がある。

### バージョン番号

バージョン番号は Semantic Versioning（SemVer）に従い、`MAJOR.MINOR.PATCH` 形式で管理する。

例:
1.0.0 → 1.0.1  バグ修正
1.0.1 → 1.0.2  軽微なUI改善
1.0.2 → 1.1.0  新機能追加
1.1.0 → 2.0.0  互換性を壊す変更

#### MAJOR

後方互換性を壊す変更。
互換性を壊す変更とは、既存のユーザー操作・既存データ、またはWeb / API / Worker間の既存契約を維持できなくなる変更を指す。
基本的には、MINORおよびPATCHによるリリースが中心となる。

#### MINOR

後方互換性を維持した機能追加・機能拡張。

例:

- 新機能の追加
- 既存機能への互換性を維持した機能拡張
- 新しいAPIやオプションの追加

#### PATCH

後方互換性を維持した修正・改善。

例:

- バグ修正
- 内部実装の改善
- 小規模なUI改善
- リファクタリングや保守上の変更

### 複数種類の変更を含む場合

1つのリリースに複数種類の変更が含まれる場合は、最も影響の大きい変更に合わせてバージョンを決定する。

```text
MAJOR > MINOR > PATCH
```

例えば、新機能追加とバグ修正を同じリリースに含める場合はMINORとする。

### DBスキーマ変更の扱い

DBスキーマ変更であることだけを理由にMAJORまたはMINORへ分類することはしない。

バージョンは、スキーマ変更そのものではなく、その変更によって既存の利用者・サービス・データとの互換性が壊れるかどうかを基準に判断する。

また、スキーマ変更やその他の互換性に関わる変更を含む場合は、通常のchecksPassによる自動デプロイではなく、`terraform-apply.yml` のsequential deploy（API → Worker → Web）を使用する既存のデプロイ運用方針に従う。

### GitHub Release

production deployment完了後、GitHub Releaseを手動で作成する。

作成時の基本設定:

- Tag: `vX.Y.Z`
- Target: main（production）へのマージコミット
- Release notes: GitHubの `Generate release notes` を使用する

GitHub Releaseの具体的な操作手順は `doc/runbook.md` を参照する。

### 自動Releaseについて

現時点ではGitHub Releaseの自動作成は行わない。

CI成功はproduction deployment完了を保証せず、またスキーマ・互換性に関わる変更ではAPI → Worker → Webの順序を保証するsequential deployが必要となるため、現時点ではproduction deployment完了後に人手でReleaseを作成する。

production deploymentの完了を自動的に検証できる仕組みが整った場合は、自動Releaseへの移行を改めて検討する。