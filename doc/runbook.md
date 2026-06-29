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
- Worker: index.staging.ts（staging/production共通エントリーポイント）
- NODE_ENV: restore-test（Sentry environment分離）

#### Worker起動時のポート競合

Next.js開発サーバーが3000番を使用している場合、
index.staging.ts のダミーHTTPサーバーが起動できず
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
dotenv -e .env.restore-before -- npx tsx src/index.staging.ts
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
- 演習は必ずindex.staging.ts（本番と同一エントリーポイント）で実施する
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

`runMonitorOnce.ts` は `index.staging.ts` を経由せず直接実行するため、
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
| クリーンアップ完了 | ✅ 確認済み |