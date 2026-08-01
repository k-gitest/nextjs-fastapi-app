# Runbook — 運用手順書

このドキュメントはローカル開発・ステージング環境での障害演習・運用手順をまとめたものです。
設計思想・検証済み事項は `README.md` の `Reliability / Operational Resilience` セクションを参照してください。

---

## 目次

1. [Prisma Studio の起動](#1-prisma-studio-の起動)
2. [Worker 停止演習](#2-worker-停止演習)
3. [duplicate webhook テスト（冪等性確認）](#3-duplicate-webhook-テスト冪等性確認)
4. [failed イベントの手動 requeue](#4-failed-イベントの手動-requeue)
5. [Vector インデックス全件再構築](#5-vector-インデックス全件再構築)
6. [障害調査フロー（correlation_id を使った追跡）](#6-障害調査フローcorrelation_id-を使った追跡)
7. [DLTロックが残った場合の解除](#7-DLTロックが残った場合の解除)
8. [Outbox滞留調査](#8-Outbox滞留調査)
9. [MotherDuck接続障害時の対処](#9-MotherDuck接続障害時の対処)
10. [processed_eventsクリーンアップ失敗時の対処](#10-processed_eventsクリーンアップ失敗時の対処)
11. [CI失敗時の調査フロー](#11-CI失敗時の調査フロー)
12. [Neon PITR復旧演習（実施記録）](#12-Neon PITR復旧演習実施記録)
13. [monitor④ stale retrying 演習](#13-monitor-stale-retrying-演習)
14. [Phase3 DR演習（QStash DLQ込みの完全復旧）](#14-phase3-dr演習qstash-dlq込みの完全復旧)
15. [B2（Backblaze）運用ノウハウ](#15-B2（Backblaze）運用ノウハウ)
16. [B2削除失敗時の確認](#16-B2削除失敗時の確認)
17. [StorageCleanupTask 手動運用](#17-StorageCleanupTask-手動運用)

---

## 1. Prisma Studio の起動

`packages/db/.env` に `DATABASE_URL` を定義すると Worker と競合するため、
Worker の `.env` を明示的に渡して起動する。

```bash
# ルートから実行
dotenv -e apps/worker/.env -- npx prisma studio --schema=packages/db/schema.prisma
```

ブラウザでポート 5555 が自動で開く（Codespaces では自動転送される）。

**よく確認するテーブル**

| テーブル | 用途 |
|---|---|
| `outbox_events` | イベントの status / retry_count / last_error 確認 |
| `processed_events` | FastAPI 側の処理済み記録確認 |
| `Todo` | メインデータの確認 |

---

## 2. Worker 停止演習

**目的**: Worker 停止中の outbox 蓄積と、再起動後の replay を確認する。

**合格条件**

- Worker 停止中: outbox_events が `pending` のまま蓄積される
- 再起動後: 全件 `sent` になる
- FastAPI: `202 Accepted` が返る
- `processed_events` に重複がない

**手順**

```bash
# Step 1: Worker 停止
docker compose stop worker

# Step 2: UIから Todo を 3〜5件作成

# Step 3: Prisma Studio で確認
dotenv -e apps/worker/.env -- npx prisma studio --schema=packages/db/schema.prisma
# outbox_events テーブルで status が pending になっているか確認

# Step 4: Worker 再起動
docker compose start worker

# Step 5: Worker ログ確認（リアルタイム）
docker compose logs worker -f

# Step 6: Prisma Studio で再確認
# status が sent に変わっているか確認
# processed_events に重複がないか確認
```

**期待されるログ**

```json
{"level":"info","msg":"Starting outbox worker..."}
{"level":"info","msg":"Recovered 0 stale events."}
{"level":"info","msg":"Processing event started","eventId":"...","type":"todo.created"}
{"level":"info","msg":"Event enqueued to QStash","eventId":"..."}
{"level":"info","msg":"Outbox event sent successfully","eventId":"...","eventType":"todo.created"}
```

**FastAPI ログ**

```
INFO: POST /webhooks/vector-indexing HTTP/1.1" 202 Accepted
```

---

## 3. duplicate webhook テスト（冪等性確認）

**目的**: 同一 `idempotency_key` で2回 Webhook を送信した場合に、
`processed_events` が1件のみであることを確認する。

**合格条件**

- 1回目: `202 Accepted` → `processed_events` に1件 INSERT
- 2回目: `202 Accepted` → スキップ（`processed_events` は1件のまま）

**手順**

```bash
# Step 1: UIから Todo を1件作成

# Step 2: Prisma Studio で outbox_events の idempotency_key と payload を確認
# 例: todo.created:cmpxxx...
# payload: {"todo_id":"...","user_id":"...","priority":"MEDIUM","progress":0,"operation":"upsert","todo_title":"..."}
```

Upstash ダッシュボード → QStash → Request Builder から以下を**全く同じ内容で2回**送信する。

**URL**
```
https://<CODESPACES_URL>-8000.app.github.dev/webhooks/vector-indexing
```

**Body（1回目・2回目とも同一）**
```json
{
  "id": "dummy-test-id",
  "type": "todo.created",
  "version": 1,
  "idempotency_key": "todo.created:<todo_id>",
  "aggregate_id": "todo:<todo_id>",
  "data": {
    "todo_id": "<todo_id>",
    "user_id": "<user_id>",
    "priority": "MEDIUM",
    "progress": 0,
    "operation": "upsert",
    "todo_title": "<todo_title>"
  }
}
```

```bash
# Step 3: APIログ確認
docker compose logs api --tail=10

# Step 4: Prisma Studio で processed_events を確認
# idempotency_key が 1件だけであることを確認
```

**注意**: curlで直接叩くと QStash 署名検証で `401 Missing QStash signature` が返る。
必ず Upstash ダッシュボードの Request Builder を使うこと。

---

## 4. failed イベントの手動 requeue

**目的**: `failed` になったイベントを `pending` に戻し、Worker に再処理させる。

### 全件 requeue

```bash
docker compose exec worker npx tsx scripts/requeueFailedEvent.ts --all
```

### 特定イベントの requeue

```bash
docker compose exec worker npx tsx scripts/requeueFailedEvent.ts <event_id>
```

**event_id の確認方法**

Prisma Studio → `outbox_events` テーブル → `status = failed` のレコードの `id` をコピー。

**requeue 後の確認**

```bash
# Worker ログでリアルタイム確認
docker compose logs worker -f
```

`sent` になれば成功。再度 `failed` になる場合は `last_error` を確認する。

```bash
# Prisma Studio で last_error 確認
dotenv -e apps/worker/.env -- npx prisma studio --schema=packages/db/schema.prisma
# outbox_events → 該当レコードの last_error フィールドを確認
```

**よくある失敗原因**

| エラー | 原因 | 対処 |
|---|---|---|
| `QStash permanent error 404` | QStash リージョン不一致 | `QSTASH_URL` を確認 |
| `invalid destination url: loopback` | `FASTAPI_PUBLIC_URL` が localhost | Codespaces の公開 URL に変更 |
| `422 Unprocessable Entity` | payload のフィールド不足 | `operation` フィールドの有無を確認 |
| `401 Invalid QStash signature` | リージョン or トークン不一致 | Upstash ダッシュボードで確認 |

---

## 5. Vector インデックス全件再構築

**目的**: Upstash Vector のデータが壊れた・ズレた場合に PostgreSQL から全件再構築する。

**前提条件**

`apps/worker/.env` に以下が設定されていること。

```bash
FASTAPI_PUBLIC_URL=https://<CODESPACES_URL>-8000.app.github.dev
INTERNAL_API_SECRET=<Next.js と同じ値>
```

### 全ユーザー再構築

```bash
docker compose exec worker npx tsx scripts/rebuildVectorIndex.ts
```

### 特定ユーザーのみ再構築

```bash
docker compose exec worker npx tsx scripts/rebuildVectorIndex.ts <userId>
```

**期待される出力**

```
[INFO] 全ユーザーのTodoを再構築します
[INFO] 対象Todo: XX 件
[INFO] userId=xxx の XX 件を送信中...
[OK]  userId=xxx 送信成功
[INFO] 完了: 成功=1 失敗=0
```

**再構築後の確認**

セマンティック検索でTodoが正しく返ってくるかUIから確認する。

---

## 6. 障害調査フロー（correlation_id を使った追跡）

「Todo が検索に反映されない」などの障害発生時の調査手順。

**Step 1: Sentry で correlation_id を確認**

Sentry → Issues → 該当エラー → Tags → `correlation_id` の値をコピー。

**Step 2: outbox_events を確認**

Prisma Studio → `outbox_events` → payload の `correlation_id` で該当レコードを特定。

```
status が sent → Worker → QStash 送信は成功
status が failed → last_error を確認
status が pending/retrying → Worker が処理中または詰まっている
```

**Step 3: processed_events を確認**

`outbox_events` の `idempotency_key` が `processed_events` に存在するか確認。

```
存在する → FastAPI まで到達・処理済み → Vector 書き込みの問題
存在しない → FastAPI に到達していない → QStash / FastAPI の問題
```

**Step 4: FastAPI ログを確認**

```bash
docker compose logs api --tail=50 | grep <correlation_id>
```

**Step 5: Vector 再構築（最終手段）**

原因が特定できない場合は Vector 全件再構築で復旧する。

```bash
docker compose exec worker npx tsx scripts/rebuildVectorIndex.ts <userId>
```

---

## 環境変数チェックリスト

障害演習前に以下を確認する。

```bash
# Worker の環境変数確認
docker compose exec worker env | grep -E "FASTAPI|INTERNAL|QSTASH"
```

| 変数名 | 期待値 |
|---|---|
| `FASTAPI_PUBLIC_URL` | `https://<CODESPACES_URL>-8000.app.github.dev` |
| `INTERNAL_API_SECRET` | Next.js・FastAPI と同じ値 |
| `QSTASH_TOKEN` | USリージョンのトークン |
| `QSTASH_URL` | `https://qstash.us1.upstash.io/v2/publish` |

**Codespaces を再起動した場合**

Codespaces の URL が変わるため `FASTAPI_PUBLIC_URL` を更新して再起動する。

```bash
# apps/worker/.env の FASTAPI_PUBLIC_URL を更新後
docker compose down
docker compose up -d
```

---

## CI/CD ワークフロー命名規則

### Required Checks との関係

`github_branch_protection` の `contexts` は GitHub PR画面に表示される
check名と完全一致する必要がある。

ワークフロー名を変更すると Required Checks が壊れるため、
以下の命名は変更しないこと。

| ワークフローファイル | job名 |
|---|---|
| `reusable-web-test.yml` | `Next.js Test (${{ inputs.environment }})` |
| `reusable-api-test.yml` | `FastAPI Test (${{ inputs.environment }})` |
| `reusable-worker-test.yml` | `Worker Test (${{ inputs.environment }})` |

### apply前確認手順

1. developブランチへのPRを一度作成する
2. GitHub PR画面でcheck名を確認する
3. `terraform/modules/github/main.tf` の `contexts` を実際のcheck名に修正する
4. `terraform plan` → `terraform apply`

### `github_branch_protection` から `github_repository_ruleset` への移行

将来的にGitHub providerが `github_repository_ruleset` へ移行する可能性がある。
現時点では `github_branch_protection` で十分。

---

## 7. DLTロックが残った場合の解除

**症状**: DLTパイプラインを実行しても `Pipeline already running` エラーが返り続ける。

**原因**: 前回のDLTパイプライン実行がクラッシュしてRedisのロックが残存している。

**Step 1: パイプラインが本当に停止しているか確認**

```bash
docker compose logs api --tail=20 | grep "dlt"
```

`dlt_pipeline_started` は出ているが `dlt_pipeline_completed` や `dlt_pipeline_failed` が出ていない場合はゾンビロックの可能性が高い。

**Step 2: Redisのロックキーを確認**

```bash
docker compose exec api uv run python -c "
from api.infrastructure.redis_client import RedisClient
r = RedisClient()
print(r.get('dlt_pipeline:lock'))
"
```

`None` が返れば問題なし。値が返ればロックが残存している。

**Step 3: ゾンビロックと判断した場合のみ削除**

```bash
docker compose exec api uv run python -c "
from api.infrastructure.redis_client import RedisClient
r = RedisClient()
r.delete('dlt_pipeline:lock')
print('Lock released')
"
```

**注意**: 削除後は必ずAPIログで再実行が正常に動くことを確認する。

```bash
docker compose logs api --tail=20
```

---

## 8. Outbox滞留調査

**症状**: `pending` イベントが増え続ける、または検索結果にTodoが反映されない。

**Step 1: check-outbox.tsで全体確認**

```bash
docker compose exec worker npx tsx scripts/check-outbox.ts
```

**Step 2: Workerログで状態確認**

```bash
docker compose logs worker --tail=50
```

**ステータスごとの対処**

| ステータス | 意味 | 対処 |
|---|---|---|
| `pending` が増え続ける | Workerが処理していない | Workerを再起動 |
| `retrying` が多い | QStash送信が失敗中 | `last_error` を確認 → セクション4参照 |
| `failed` がある | MaxRetry超過 | セクション4の手動requeueを実行 |
| `processing` のまま | Workerクラッシュによるstale lock | Workerを再起動して起動時スイープを実行 |

**Step 3: Workerを再起動して起動時スイープを実行**

```bash
docker compose restart worker
docker compose logs worker -f
```

`Recovered N stale events.` が出れば正常にスイープされている。

---

## 9. MotherDuck接続障害時の対処

### Analytics Failure Policy

**実行環境**

`analytics-event` は FastAPI `BackgroundTask` 内で実行する。

**障害時の挙動**

- `analytics-event` の BackgroundTask 内では例外を外部へ送出しない
- 発生した例外はタスク内部で捕捉する
- 構造化ログ（stacktrace含む）を出力する
- `ErrorMonitor` を通じて Sentry へ通知する
- 例外はHTTPレスポンス層まで伝播させない
- QStash のリトライは利用しない

**設計思想**

- analytics データはベストエフォート収集とする
- MotherDuck障害は業務データ処理に影響を与えない
- Todo作成・更新・削除などのコア処理は常に優先される
- analytics 障害時の検知はログおよびSentryによって行う

**背景**

FastAPI の `BackgroundTask` は HTTP レスポンス送信後に実行される。
タスク内例外をレスポンス層まで伝播すると以下のエラーが発生するため、
analytics-event ではタスク内で例外処理を完結させる。

```
RuntimeError: Caught handled exception, but response already started.
```

---

**症状**: 以下のイベントがSentryやログに連続して出る。

- `motherduck_insert_failed`
- `analytics_webhook_failed`
- `dlt_pipeline_failed`

**影響範囲**: 分析DB（MotherDuck）のみ。メインDB（Neon）・Vector・QStashには影響なし。TodoのCRUDや検索は正常に動作する。

**Step 1: APIログで直近のエラーを確認**

```bash
docker compose logs api --tail=50 | grep -E "motherduck|analytics|dlt_pipeline"
```

**Step 2: MOTHERDUCK_TOKENが設定されているか確認**

```bash
docker compose exec api env | grep MOTHERDUCK
```

**よくある原因と対処**

| 原因 | 確認方法 | 対処 |
|---|---|---|
| トークン期限切れ | MotherDuckダッシュボードで確認 | トークン再発行・env更新後に再起動 |
| MotherDuck側障害 | MotherDuckステータスページで確認 | 復旧待ち |
| シングルトン接続の異常 | ログの `connection` エラー | コンテナ再起動でリセット |

```bash
docker compose restart api
```

**欠損データの復元可否**

| データ種別 | 復元可否 | 理由 |
|---|---|---|
| リアルタイム分析イベント（auth_events・todo_events） | **復元不可** | Webhook経由の書き込みのため |
| dlt同期データ（User・Todo） | **次回同期で復元可能** | PostgreSQLから全件再同期されるため |

障害期間をメモしておき、復旧後にdlt pipelineを手動実行して同期データを最新化すること。

---

## 10. processed_eventsクリーンアップ失敗時の対処

**症状**: QStash Cronのクリーンアップが失敗し続け `processed_events` テーブルが肥大化する。

**影響範囲**: クリーンアップ失敗だけでは冪等性チェックは正常動作する。ただしテーブル肥大化が続くとDB性能に影響する。

**Step 1: QStash Schedule設定を確認**

Upstashダッシュボード → QStash → Schedules で以下を確認する。

| 項目 | 期待値 |
|---|---|
| URL | `https://<FASTAPI_PUBLIC_URL>/internal/cleanup/processed-events` |
| Cron | `0 18 * * *`（JST 03:00） |

**Step 2: APIログでエラー内容を確認**

```bash
docker compose logs api --tail=50 | grep "cleanup"
```

**Step 3: internal endpointを手動実行**

Upstashダッシュボード → QStash → Request Builder から以下を送信する。
POST https://<FASTAPI_PUBLIC_URL>/internal/cleanup/processed-events

**Step 4: それでも解決しない場合の直接削除（最終手段）**

- **開発環境**: Prisma Studioで対象レコードを確認・削除する。

```bash
dotenv -e apps/worker/.env -- npx prisma studio --schema=packages/db/schema.prisma
# processed_events テーブルで processed_at が古いレコードを確認・削除
```

- **本番環境**: 件数が多い場合はPrisma Studioは非現実的。Step 3のinternal endpointを優先し、直接削除は十分注意した上で実施すること。

---

## 11. CI失敗時の調査フロー

新規Workflow追加・既存Workflow変更後に失敗した場合は以下の順で確認する。

### 11-1. 権限エラー

**症状**: `Resource not accessible by integration` / PRコメント作成失敗 / Repository access denied

**確認**:
- Repository Settings → Actions → General → Workflow permissions
- workflow yaml の `permissions` ブロック（`pull-requests: write` / `contents: read` 等）

### 11-2. Environment変数未取得

**症状**: 認証エラー / API Token未設定 / Terraform認証失敗

**確認**:
- ログで該当変数が `***`（secrets）か空文字か確認する。空文字の場合は参照方法の取り違え、
  またはEnvironment未登録の可能性がある
- Terraform で `github_actions_environment_secret` 登録 → ワークフロー側は `secrets.XXX`
- Terraform で `github_actions_environment_variable` 登録 → ワークフロー側は `vars.XXX`
- リソース種別と参照方法が一致しているか確認する

### 11-3. アプリ起動失敗（wait-on / health check timeout）

**症状**: E2E開始前に失敗 / wait-on timeout

**確認**:
- タイムアウトログだけで判断せず、`server.log` を必ず確認する
- ビルドログ・起動コマンドも併せて確認する

---

### 参考: 過去に発生した特殊事例

**lockファイル不一致による npm ci 失敗**（vitest/coverage・pytest-cov 未導入、かつ
ローカルで `npm install` / `uv run add` が実行できない制約環境で発生）

このプロジェクトでは今後発生させない方針だが、同様の制約環境に再度遭遇した場合の
参考として記録する。

1. CI側で一時的に `npm ci` ではなく `npm install` に変更してパイプラインを通す
2. 実行可能な別環境でインストール → lockファイル生成
3. 生成したlockファイルをコミットするPRを別途作成し、CIを `npm ci` に戻す

応急処置であり、lockファイル更新までは依存バージョンの不確実性が残る点に注意。

## Render Auto Deploy 設定について

staging / production は `auto_deploy_trigger = "checksPass"` を使用している。

**注意**:
- CI（GitHub Actions）がすべてパスした場合のみ Render がデプロイを実行する
- 対象ブランチに有効なCIワークフローが存在しない場合、デプロイは永久に保留状態になる
- schema変更などAPI⇄Worker⇄Webの互換性に関わる場合は、checksPassによる
  自動デプロイの順序保証がないため `terraform-apply.yml` の sequential deploy を使う
  （詳細は README.md「デプロイ運用方針」参照）

---

## Terraform適用確認

terraform plan

結果

No changes. Your infrastructure matches the configuration.

を確認すること。

## 初回デプロイ時の注意

Webデプロイ完了前にWorkerが起動するため
outbox_eventsテーブルが存在せずエラーになる場合がある。

Webデプロイ完了後にWorkerを手動再起動することで解消する。

## 12. Neon PITR復旧演習（実施記録）

### 実施日
2026-06-25

### 環境
- Neon Free Plan（PITR: 6時間、分単位精度）
- Worker: index.ts（staging/production共通エントリーポイント）
- NODE_ENV: restore-test（Sentry environment分離）

#### Worker起動時のポート競合

Next.js開発サーバーが3000番を使用している場合、
index.ts のダミーHTTPサーバーが起動できず
以下のエラーが発生する。

```text
listen EADDRINUSE: address already in use :::3000
```

演習用envで別ポートを指定する。

```env
PORT=3001
```

本番Render環境では各Serviceが独立しているため発生しない。
ローカルでWebとWorkerを同時起動した場合のみ注意する。

---

### 事前確認：処理時間の実測値

通常のTodo作成から完全処理までの所要時間。

| タイムスタンプ | イベント | 所要時間 |
|---|---|---|
| 11:14:08 UTC | Todo作成（createdAt） | 0秒 |
| 11:14:10 UTC | outbox_events sent（updatedAt） | 約2秒 |
| 11:14:12 UTC | processed_events作成（createdAt） | 約4秒 |

**結論**: 通常系は4秒以内で完全処理される。PITRブランチ作成時は前後1?2分の余裕を取れば十分。

---

### Phase1: PITR基本動作確認

#### ブランチ作成

| ブランチ名 | 作成方法 | 指定時刻（JST） | 用途 |
|---|---|---|---|
| restore-test-before | Branch data and schema from a past point in time | 20:13 | Todo作成前の状態 |
| restore-test-after | Branch data and schema | （現時点） | 完全処理後の状態 |

**注意**: NeonダッシュボードのUI入力はJST。DBタイムスタンプはUTCのため、+9時間の変換が必要。

#### 確認コマンド

```bash
# restore-test-before の確認
dotenv -e apps/worker/.env.restore-before \
  -- npx prisma studio --schema=packages/db/schema.prisma

# restore-test-after の確認
dotenv -e apps/worker/.env.restore-after \
  -- npx prisma studio --schema=packages/db/schema.prisma
```

#### 確認結果

| テーブル | restore-test-before | restore-test-after |
|---|---|---|
| todo | ? 対象レコードなし | ? 対象レコードあり |
| outbox_events | ? 対象レコードなし | ? status=sent |
| processed_events | ? 対象レコードなし | ? 対応idempotency_key存在 |

**結論**: PITRが正常に機能し、本番mainに触れずに過去時点のデータを復元できることを確認。

---

### Phase2: Worker接続・monitor動作確認

#### Worker起動

```bash
cd apps/worker
dotenv -e .env.restore-before -- npx tsx src/index.ts
```

#### 起動時確認結果

- ? `Recovered 0 stale events.`（restore-test-beforeには対象レコードなし）
- ? `startOutboxMonitoring started.`（monitor正常起動）
- ? ダミーHTTPサーバー起動（Render Web Service構成と同一）

#### testMonitorRetrying.ts の実行

```bash
dotenv -e .env.restore-before \
  -- npx tsx scripts/testMonitorRetrying.ts
```

- status=failed のレコードを10件作成
- monitor の①（failed閾値超過）の検知対象
- Workerはfailedを再取得しないため、5分後のmonitorポーリングで検知される

#### testMonitorStaleRetrying.ts の実行と重要な発見

```bash
dotenv -e .env.restore-before \
  -- npx tsx scripts/testMonitorStaleRetrying.ts
```

**発生した事象**:
status=retrying / updated_at=20分前 / next_retry_at=16分前

↓

Workerの1秒ポーリングが即座に取得（status IN ('pending','retrying') に一致）

↓

processEvent() → event_type='monitor.test' → Unknown event type

↓

status=failed へ遷移

↓

monitorが見る前にレコードが消費される

**設計上の理由**: Workerのポーリング間隔は1秒、monitorの実行間隔は5分（300秒）。retryingレコードはWorkerの再試行対象のため、monitor検知より先にWorkerが処理する。

**結論**: monitor の④（stale retrying検知）は、Workerが正常動作している状況では発火しにくい。これは設計通りであり、以下のような「Workerが正常に動いていない状況」を検知するための最後の保険として機能する。

- Worker停止中
- DB障害によりステータス更新ができない状態
- next_retry_at が異常値になっている状態

---

### 演習から得られた知見

#### 1. PITRの運用ルール

- 本番mainは直接Restoreしない。必ず「Branch data and schema from a past point in time」で新規ブランチを作成する
- NeonダッシュボードのUI入力はJST、DBタイムスタンプはUTCのため変換を忘れない
- Auto-delete: After 1 dayを設定し、演習終了後に手動削除も行う（二重保険）
- Neon Free PlanのPITRは分単位精度。前後1?2分の余裕を取ること

#### 2. Worker接続時の注意

- WorkerのみをbranchのDATABASE_URLに向ける場合、QSTASH_TOKENを無効化しないと実際のQStash publishが成功し本番FastAPIへ到達する
- 演習は必ずindex.ts（本番と同一エントリーポイント）で実施する
- NODE_ENV=restore-testを設定するとSentryのenvironmentで本番と分離できる

#### 3. testMonitorStaleRetrying 実行時の注意

Worker稼働中にtestMonitorStaleRetryingを実行すると、retryingレコードがWorkerに即座に取得されmonitorが検知できない。stale retrying検知の検証を行う場合は以下のいずれかを選択する。

```bash
# 方法①: Worker停止後に実行
# （Ctrl+CでWorkerを停止してから実行）
dotenv -e .env.restore-before \
  -- npx tsx scripts/testMonitorStaleRetrying.ts

# 方法②: testMonitorStaleRetrying.ts内でnext_retry_atを未来時刻に設定
# next_retry_at: new Date(Date.now() + 60 * 60 * 1000)  // 1時間後
# これによりWorkerは取得しないがmonitorは検知できる
```

#### 4. Unknown event typeの挙動確認

monitor.testイベントはprocessor.tsで未サポートとして扱われfailedに遷移する。これは意図通りの安全な失敗であり、未知のイベントが無限リトライされないことを確認済み。

---

### 演習結果サマリー

| 項目 | 結果 |
|---|---|
| PITRブランチ作成 | ? 確認済み |
| before（過去時点）の再現 | ? 確認済み |
| after（現時点）の再現 | ? 確認済み |
| 本番mainへの影響なし | ? 確認済み |
| Worker起動（branch DB接続） | ? 確認済み |
| recoverStaleEvents（起動時スイープ） | ? 確認済み（0件正常） |
| monitor起動・ポーリング | ? 確認済み |
| failed監視（①） | ? 動作確認済み |
| stale retrying監視（④） | ? Worker停止が必要（上記注意参照/別演習へ） |
| Unknown event typeの安全な失敗 | ? 確認済み |

---

### 将来課題（Phase3）

FastAPIも同じbranchのDATABASE_URLに向け、ローカルFastAPIを起動してFASTAPI_PUBLIC_URLをそちらに向けることで、完全に閉じた世界でのDR演習が可能になる。Worker・FastAPI・QStashの実通信を含む本格的な検証で、構成変更の手間とリスクが大きいため別途スケジュールする。

### テストデータのクリーンアップ

```bash
# testMonitorイベントの削除（branch削除でも消えるが明示的に実行する場合）
dotenv -e apps/worker/.env.restore-before \
  -- npx tsx scripts/cleanupMonitorTestEvents.ts
```

演習用ブランチはAuto-delete（1日後）に加え、演習終了後に手動削除する。
削除対象:

restore-test-before
restore-test-after

---

## 13. monitor④ stale retrying 演習

### 概要

`runOutboxMonitor()` の④（stale retrying検知）が正しくアラートを上げることを確認する演習。
PITR演習セクションの「別演習へ」として積み残されていた項目。

**前提として確認済みの事項**
- `recoverStaleEvents` は `status = 'processing'` のみ対象。テストデータ（`status = 'retrying'`）には触れない
- monitor④の判定条件: `status = 'retrying' AND updated_at < NOW() - 15分`
- Worker起動時に `startOutboxMonitoring` が先に呼ばれるが、内部の `void run()` は非同期のためWorkerループと競合する。実測でWorkerが先にレコードを取得することを確認済み（`outbox_monitor_healthy` が出力されるが検知できていない）
- そのため `runMonitorOnce.ts` を使いWorker停止状態で単独実行する手順を採用する

### 演習手順

**Step 1: Worker停止**

```bash
docker compose stop worker
```

**Step 2: テストデータ作成**

```bash
docker compose run --rm worker npx tsx scripts/testMonitorStaleRetrying.ts
```

`updated_at` が20分前、`next_retry_at` が16分前の `retrying` レコードが1件作成される。

**Step 3: monitorを単独実行**

```bash
docker compose run --rm worker npx tsx scripts/runMonitorOnce.ts
```

Worker停止状態でmonitorのみを走らせる。

**Step 4: ログ確認**

以下のログが出力されることを確認する。

```json
{"level":"info","event":"run_monitor_once_started",...}
{"level":"warn","event":"outbox_stale_retrying_detected","count":1,"stale_minutes":15,...}
{"level":"info","event":"run_monitor_once_completed",...}
```

**Step 5: Sentry確認**

Sentry → Issues で `outbox_stale_retrying_detected` のイベントが届いていることを確認する。
Tags: `component=outbox-monitor`、`monitor_type=stale_retrying`

**Step 6: クリーンアップ**

```bash
docker compose run --rm worker npx tsx scripts/cleanupMonitorTestEvents.ts
```

**Step 7: Worker通常起動**

```bash
docker compose start worker
```

### Worker停止状態でテストデータを作成する理由

`docker compose exec` はコンテナが起動中でないと使えないため、Worker停止中は `docker compose run --rm` を使う。

### runMonitorOnce.ts に Sentry.init() が必要な理由

`runMonitorOnce.ts` は `index.ts` を経由せず直接実行するため、
`Sentry.init()` が呼ばれない。環境変数 `SENTRY_DSN` が設定されていても
初期化なしでは `captureMessage` は送信されない。
また短命コンテナのためプロセス終了前に `Sentry.flush(2000)` が必要。

```typescript
// runMonitorOnce.ts の先頭に必須
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  initialScope: {
    tags: { component: "outbox-monitor", service: "worker" },
  },
});
```

### 演習結果記録欄

| 項目 | 結果 |
|---|---|
| テストデータ作成 | ✅ 確認済み（2026-06-29） |
| `outbox_stale_retrying_detected` ログ確認 | ✅ 確認済み |
| Sentryイベント確認 | ✅ 確認済み（Warning、monitor_type=stale_retrying） |
| クリーンアップ完了 | ✅ 確認済み（2026-06-29） |
---

## 14. Phase3 DR演習（QStash DLQ込みの完全復旧）

### 概要

FastAPI停止→Outbox滞留→QStash DLQ入り→手動復旧までの一気通貫演習。
「壊れても戻せる」を証明する最終DR演習。

### QStashリトライ仕様（Freeプラン・実測値）

| リトライ回数 | 待機時間 | 備考 |
|---|---|---|
| 1回目 | 約12秒後 | |
| 2回目 | 約2分28秒後 | |
| 3回目 | 実測では約25〜36分後 | バックオフにより幅あり |
| 上限超過 | DLQ入り | 手動リトライが必要 |

**FastAPIを止めてよい安全な時間の目安**

| 目標 | 停止時間 |
|---|---|
| 3回目リトライで自動回復 | 3回目リトライが実行される前に復旧（実測では約25〜36分程度） |
| DLQ入りを確認してから手動回復 | 3回目リトライ失敗後（実測では約25〜36分程度） |

### シナリオA：自動回復確認

**目的**: QStashリトライによる自動回復と冪等性の確認

```
FastAPI停止
↓
UIからTodoを複数作成
↓
Worker→QStash送信成功（outbox=sent）
↓
QStashがFastAPIへ配信失敗→リトライ開始
↓
3回目リトライ実行前（約25〜36分以内）にFastAPI復旧
↓
QStash 3回目リトライでFastAPIが受信
↓
processed_eventsに記録（冪等性：複数リトライでも1件のみ）
```

**手順**

```bash
# Step 1: FastAPI停止
docker compose stop api

# Step 2: UIからTodoを2〜3件作成
# outbox_eventsがsentになることを確認

# Step 3: QStashダッシュボードでリトライ状況を監視

# Step 4: 3回目リトライ実行前（実測では約25〜36分程度）にFastAPI復旧
docker compose start api

# Step 5: FastAPIログで受信確認
docker compose logs api --tail=20

# Step 6: processed_eventsを確認（冪等性）
dotenv -e apps/worker/.env -- npx prisma studio --schema=packages/db/schema.prisma
```

**合格条件**

- `processed_events` に対応する `idempotency_key` が1件のみ存在する
- FastAPIログに `202 Accepted`
- 同一キーで複数リトライが来ても重複しない

### シナリオB：DLQ入り→手動回復確認

**目的**: DLQ入り後の手動復旧手順の確認

```
FastAPI停止（3回目リトライ失敗後まで待機）
↓
QStash 3回リトライ失敗→DLQ入り
↓
FastAPI復旧
↓
QStashダッシュボードからDLQを手動リトライ
↓
FastAPIが受信→processed_eventsに記録
```

**手順**

```bash
# Step 1: FastAPI停止
docker compose stop api

# Step 2: UIからTodoを作成
# Step 3: 3回目リトライ失敗まで待機（実測では約25〜36分程度）

# Step 4: QStashダッシュボードで確認
# Messages → DLQ に該当メッセージが入っていることを確認

# Step 5: FastAPI復旧
docker compose start api

# Step 6: QStashダッシュボード → DLQ → 該当メッセージ → Retry
# 手動リトライで即座に処理される

# Step 7: FastAPIログで受信確認
docker compose logs api --tail=20

# Step 8: processed_eventsを確認
dotenv -e apps/worker/.env -- npx prisma studio --schema=packages/db/schema.prisma
```

**重要**: DLQ入りはQStashからの通知がない。`monitor-qstash-job` により5分ごとに自動検知され、Sentryへエラーイベントが送信される（Issue/AlertはSentry設定に従う）。

### DLQ入り後の運用フロー

```
Sentry Issue（またはAlert設定済みの場合は通知）でDLQ検知
↓
ログの oldest_url と oldest_message_age_minutes で影響範囲を確認
↓
FastAPIの状態確認（docker compose logs api）
↓
原因解消（FastAPI復旧 / エンドポイント修正）
↓
QStashダッシュボード → DLQ → Retry
↓
FastAPIログで受信確認（202 Accepted）
↓
processed_eventsで受信確認
↓
必要に応じてcheck-outbox.tsでOutbox整合性確認
（outbox_eventsはsentのままのため、check-outbox.tsではDLQ復旧の確認はできない）
```

**requeueスクリプトはDLQに効かない**

`requeueFailedEvent.ts` は `outbox_events.status = failed` を対象にする。
QStash DLQ入りの場合、`outbox_events` は `sent` のままのため、このスクリプトでは回復できない。
回復はQStashダッシュボードからの手動リトライのみ。

### 演習結果記録欄

| 項目 | 結果 |
|---|---|
| シナリオA：自動回復 | ✅ 確認済み（2026-06-29） |
| シナリオB：DLQ入り確認 | ✅ 確認済み（2026-06-29） |
| DLQ手動リトライ→processed_events記録 | ✅ 確認済み（2026-06-29） |
| requeueスクリプトはDLQに効かないことを確認 | ✅ 確認済み（2026-06-29） |

---

### QStash DLQ監視（monitor-qstash-job）

DR演習で「DLQ入りは誰も気づかない」ことが判明したため、`monitorQstashDlqService.ts` を実装して自動検知できるようにした。

#### 概要

| 項目 | 内容 |
|---|---|
| 監視対象 | QStash DLQ（外部SaaS）|
| 実装 | `monitorQstashDlqService.ts`（監視ロジック）+ `monitorQstashDlq.ts`（起動関数） |
| 起動 | `index.ts` 内で `startQstashDlqMonitoring()` として起動 |
| 実行間隔 | 5分（`QSTASH_DLQ_MONITOR_INTERVAL_MINUTES` で上書き可能） |
| Sentry Cron Monitor | `monitor-qstash-job` |

`monitor-outbox-job`（DBを監視）とは責務が異なるため完全に独立したサービスとして実装している。

#### 検知条件

- DLQ件数 > 0 → `qstash_dlq_detected`（Warning ログ + Sentry Error）
- QStash API呼び出し失敗 → `qstash_dlq_check_failed`（Sentry Error）

ログには以下の情報が含まれる。

```json
{
  "sample_count": 7,
  "fetch_limit": 100,
  "possibly_truncated": false,
  "oldest_message_age_minutes": 3711,
  "oldest_url": "https://.../webhooks/analytics-event",
  "sample": [...]
}
```

`sample_count` は取得した件数であり、DLQ全体の総件数ではない。`possibly_truncated: true` の場合、実際のDLQ件数が100件を超えている可能性がある。その場合はQStashダッシュボードで全件確認すること。

#### DLQ発生時の運用フロー

```
Sentry Issue（またはAlert設定済みの場合は通知）でDLQ検知
↓
ログの oldest_url と oldest_message_age_minutes で影響範囲を確認
↓
FastAPI の状態確認
  docker compose logs api --tail=20
↓
原因解消（FastAPI復旧 / エンドポイント修正 / 設定確認）
↓
QStashダッシュボード → Messages → DLQ → 該当メッセージを Retry
↓
FastAPIログで受信確認（202 Accepted）
↓
processed_events に記録されたことを確認
  dotenv -e apps/worker/.env -- npx prisma studio --schema=packages/db/schema.prisma
↓
必要に応じてcheck-outbox.tsでOutbox整合性確認
（outbox_eventsはsentのままのため、check-outbox.tsではDLQ復旧の確認はできない）
```

#### 注意事項

- `requeueFailedEvent.ts` はDLQに効かない（`outbox_events` は `sent` のため）
- DLQからの手動リトライは即座に処理される（バックオフなし）
- QStash Freeプランの場合、DLQ取得上限は `count=100`。`possibly_truncated: true` の場合はダッシュボードで全件確認すること

#### 動作確認済み（2026-07-01）

```json
{"level":"warn","msg":"qstash_dlq_detected","sample_count":7,"oldest_message_age_minutes":3711,...}
```

Sentry: `[Critical] QStash DLQ: 7 message(s) stuck, oldest 3711min`
Tags: `component=qstash-dlq-monitor`、`monitor_type=qstash_dlq`、`level=error`

## 15. B2（Backblaze）運用ノウハウ

画像添付機能（Backblaze B2）に関する構築・運用時のハマりどころをまとめる。
設計思想（DBが正・Hidden→Lifecycleの概念など）は README.md の「画像添付」セクションを参照。

### バケット作成時の注意点（まとめ）

- Terraform Provider の認証には **Application Key** が必要（下記参照）
- Region は `us-west-004` で固定
- CORS の `allowedOrigins` に使う Render のデプロイURL（web/api/worker）は
  Terraform の `locals` へ先に定義しておく必要がある
- GitHub Secrets は手動登録が必要（下記「GitHub Repository Secrets」参照）

### 命名規則
{project}-{component}-{environment}

例: `next-fast-assets-dev`、`next-fast-db-staging` など。半年後にTerraformを
書くときに毎回同じ判断をしなくて済むよう、ここに明記しておく。

### Terraform Provider の認証（Application Key）

Backblaze Provider は **Application Key** で認証する。AWSの Access Key /
Secret Key のような発想とは異なり、UI から Application Key を発行して
Terraform Cloud の Workspace Variables に登録する必要がある。初見だとかなり詰まるポイント。

1. Backblaze ダッシュボード → App Keys → 新規作成
2. `applicationKeyId` と `applicationKey` を取得
3. Terraform Cloud の Workspace Variables に登録

これを見落とすと Provider に認証情報を弾かれ、`terraform plan` の時点でエラーになる。

### CORS 設定が反映されない問題

Web UIの簡易設定だけではS3 Presigned PUTに必要なルールを十分に設定できない場合があるため、b2 bucket update --cors-rulesでJSONを適用し、b2 bucket getで反映内容を確認する。

検証時点では開発用に作成したバケットに対し b2 UI側からCORS ルールを設定しても実際には反映されず、
アプリUIからのアップロード時に `400` / `404` エラーが返ることがあった。
検証時点では b2 UI側の設定では反映されなかった
↓
CLIで update-bucket した

対処として Backblaze CLI から直接更新する。

```bash
# CLIインストール（uvの場合）
uv tool install b2

# 認証（applicationKeyId / applicationKey を入力）
b2 authorize-account

# バケット確認
b2 bucket get next-fast-assets-dev

# CORSルール更新
b2 update-bucket --cors-rules "$(cat cors.json)" next-fast-assets-dev
```

**注記**: これは検証時点（2026年前半）でのの制約であり、恒久的な仕様とは限らない。
将来改善されてb2 UIでの CORS 反映が正常に動くようになった場合は、
この回避策は不要になる可能性がある。動作確認してから本セクションの要否を見直すこと。

### Hidden File の確認方法

`DeleteObjectCommand` が成功しても、B2 上ではファイルは Hidden になるだけで、
即座には物理削除されない。
DeleteObjectが成功しても
Hiddenになるのが正常である。
削除APIの戻り値だけでは
物理削除されたとは判断できない。

B2 のダッシュボードで「削除したはずのファイルが残っている」ように見えても、
これは削除失敗ではなく **仕様どおりの正常動作**。

**確認方法**: B2 ダッシュボード → 対象バケット → ファイル一覧で
「Hide」フラグが付いたファイルとして表示される（通常表示では見えない場合は
「Show Hidden Files」等のオプションを有効にする）。

VersionId を取得して完全削除する実装は不要かつ非推奨（Lifecycle Rule に
責務を委譲する設計のため）。

### Lifecycle Rule の確認方法

物理削除は Lifecycle Rule（`days_from_hiding_to_deleting`）の設定日数が
経過した後、B2 のバックグラウンド処理で行われる。即時削除ではない。

確認は Backblaze ダッシュボード → 対象バケット → Lifecycle Settings から行う。

### GitHub リポジトリ移行時の Repository Secrets

GitHub アカウント・リポジトリを移行した場合、**Repository Secrets は自動移行されない**。
Actions が動かない場合はまずここを疑う。

**移行後チェックリスト**

- [ ] GitHub Secrets（Repository Secrets）にTF_API_TOKENを再登録
- [ ] Terraform Cloud Variables を再確認
- [ ] Render Environment Variables を再確認
- [ ] Backblaze Application Key
- [ ] Auth0 関連
- [ ] Resend API Key
- [ ] Sentry DSN

（Render 側の GitHub 連携そのものの移行手順は README.md「GitHubリポジトリ移行手順」を参照）

## 16. B2削除失敗時の確認

Image削除・Album削除・Todo削除に伴うB2オブジェクト削除（`cleanupDeletedStorageKeys()`）が
失敗した場合の調査手順。設計思想（Transaction + External I/O Pattern）は README.md の
「Transaction + External I/O Pattern」セクションを参照。

**症状**

- Todo削除・Image削除・Album削除自体は成功している（DB上は削除済み、204が返る）
- B2ダッシュボード上にファイル（storageKey）だけ残っている

**影響範囲**: DBの整合性には影響しない。DB側は既にCommit済みで正しい状態。B2上に
孤立オブジェクトが残るのみ。

**Step 1: Sentryで確認**

Sentry → Issues で以下のタグ・contextを検索する。

component=image-cleanup

または、障害調査フロー（セクション6）と同様に `correlation_id` で該当リクエストを特定する。

**Step 2: ログで原因を確認**

`cleanupDeletedStorageKeys()` 内部の `deleteB2Object()` が失敗した際のエラー内容を
Sentryのcontext（`b2_object_path` / `todo_id` / `album_id` のいずれか）から確認する。

**注意**: 以前は `storage_key` というキー名だったが、Sentryのデータスクラビングが
`key` を含む文字列に反応してマスキング（`[Filtered]`表示）してしまうことが判明したため、
`b2_object_path` に変更した（2026-07-30 検証時に発見）。

**よくある原因**

| 原因 | 確認方法 |
|---|---|
| B2側の一時的な障害 | Backblazeステータスページで確認 |
| Application Keyの期限切れ・権限不足 | Backblazeダッシュボード → App Keys |
| storageKeyの不整合（既に削除済み等） | B2ダッシュボードで該当キーを直接確認 |

**Step 3: 対応**

- **DBは修正しない**（DB側は既に正しい状態のため触らない）
- B2ダッシュボードで該当ファイルの残存を確認する
- 必要であれば手動でB2から削除する（`b2 delete-file-version` 等）
- 恒久対応が不要であれば、将来導入予定のGC、または運用手順に従って回収する

**注意**

DeleteObjectが成功していてもB2上ではHidden状態になるだけで即時の物理削除ではない
（詳細はセクション15「Hidden File の確認方法」参照）。今回の障害はDeleteObject
自体が失敗するケースを指しており、Hidden状態との混同に注意すること。

## 17. StorageCleanupTask 手動運用

**目的**: `StorageCleanupTask`（Type A/Type B孤立B2オブジェクトのGC対象）の確認・手動回収手順。設計思想は README.md の「GC（孤立B2オブジェクトの検知・回収）」セクションを参照。

**通常運用**: Worker（`apps/worker`）が`STORAGE_CLEANUP_INTERVAL_MINUTES`（デフォルト5分）間隔で自動回収する。手動スクリプトの出番は基本的にない。

### Dry Run（確認のみ・Worker稼働中でも実行可）

```bash
npx tsx apps/web/scripts/storageCleanup.ts --dry-run
```

pendingタスクの一覧（storageKey・reason・retryCount・lastError等）を表示するのみ。B2への操作は行わない。

### 緊急時の手動回収（要Worker停止）

**注意**: `--run`は原子的claim（`FOR UPDATE SKIP LOCKED`）を使用しない単純な`findMany`+`update`実装のため、Worker稼働中に実行すると同一タスクの二重処理が発生しうる。

**手順**

```bash
# Step 1: Workerを停止
docker compose stop worker
# または Renderダッシュボードから該当Workerサービスを一時停止

# Step 2: Dry Runで対象確認
npx tsx apps/web/scripts/storageCleanup.ts --dry-run

# Step 3: 手動回収実行
npx tsx apps/web/scripts/storageCleanup.ts --run

# Step 4: 結果確認（resolved件数・failed件数をコンソール出力で確認）

# Step 5: Workerを再開
docker compose start worker
```

### `failed`状態のタスクへの対応

`retryCount`が`STORAGE_CLEANUP_MAX_RETRIES`（デフォルト8）に達すると`status=failed`となり、Sentryへ通知される（`component=storage-cleanup-worker`）。

**調査**

Sentry → Issues で`storage_cleanup_reason`タグ・`storage_cleanup_task`のcontext（`b2_object_path`・`retry_count`）を確認する。

**再試行させる場合**

Prisma Studioで該当`StorageCleanupTask`の`status`を`pending`に戻し、`retryCount`を必要に応じてリセットする。次回のWorkerポーリング（または手動`--run`）で再試行される。

```bash
dotenv -e apps/worker/.env -- npx prisma studio --schema=packages/db/schema.prisma
```