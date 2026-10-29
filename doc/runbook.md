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
12. [Neon PITR復旧演習（実施記録）](#12-Neon_PITR復旧演習実施記録)
13. [monitor④ stale retrying 演習](#13-monitor-stale-retrying-演習)
14. [QStash DLQ込みの完全復旧演習](#14-qstash-dlq込みの完全復旧演習)
15. [B2（Backblaze）運用ノウハウ](#15-B2（Backblaze）運用ノウハウ)
16. [B2削除失敗時の確認](#16-B2削除失敗時の確認)
17. [StorageCleanupTask 手動運用](#17-StorageCleanupTask-手動運用)
18. [Image ドメイン開発環境リセット（resetImageDomain.ts）](#18-image-ドメイン開発環境リセットresetimagedomaints)
19. [Neon Providerバージョン不一致によるterraform plan失敗](#19-neon-providerバージョン不一致によるterraform-plan失敗)
20. [Playwright UIの起動とポート競合時の対処](#20-playwright-uiの起動とポート競合時の対処)
21. [E2E失敗時の切り分け手順（環境起因の不安定への対処）](#21-e2e失敗時の切り分け手順環境起因の不安定への対処)
22. [リリース手順（GitHub Release）](#22-リリース手順github-release)
23. [外部Actionの更新手順（Node.js移行対応）](#23-外部actionの更新手順nodejs移行対応)
24. [GitHubリポジトリ移行後のTerraform apply失敗（Environment 404 / 変数409）](#24-githubリポジトリ移行後のterraform-apply失敗environment-404--変数409)
25. [Terraformのplan / apply（手動運用）](#25-terraform-の-plan--apply手動運用)
26. [緊急時のdestroy手順（Terraform）](#26-緊急時の-destroy-手順Terraform)
27. [E2Eの実行方針とアーティファクト・テスト専用アカウントの運用](#27-E2Eの実行方針とアーティファクト・テスト専用アカウントの運用)

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

| テーブル           | 用途                                              |
| ------------------ | ------------------------------------------------- |
| `outbox_events`    | イベントの status / retry_count / last_error 確認 |
| `processed_events` | FastAPI 側の処理済み記録確認                      |
| `Todo`             | メインデータの確認                                |

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

| エラー                              | 原因                              | 対処                               |
| ----------------------------------- | --------------------------------- | ---------------------------------- |
| `QStash permanent error 404`        | QStash リージョン不一致           | `QSTASH_URL` を確認                |
| `invalid destination url: loopback` | `FASTAPI_PUBLIC_URL` が localhost | Codespaces の公開 URL に変更       |
| `422 Unprocessable Entity`          | payload のフィールド不足          | `operation` フィールドの有無を確認 |
| `401 Invalid QStash signature`      | リージョン or トークン不一致      | Upstash ダッシュボードで確認       |

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

Sentry → Issues → 該当エラー → Context → `correlation` セクションの `correlation_id` の値をコピー。
（Sentryの検索・フィルタ機能では、今回の実機検証時点で `correlation_id` を確実に横断検索
できなかったため、該当するSentry Issueを個別に開いてContextを確認し、値をコピーして
以降のStepでDB・ログ側の追跡に使う）

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

**注意（Image削除Outboxイベントの場合）**

`event_type = image.storage_delete_requested`の場合、本イベントはQStash/FastAPIを
経由せずWorker内で完結するため、Step 3（processed_events確認）・Step 4
（FastAPIログ確認）・Step 5（Vector再構築）は対象外。詳細は
「16-1. Image削除Outboxイベントの調査」を参照。

---

## 環境変数チェックリスト

障害演習前に以下を確認する。

```bash
# Worker の環境変数確認
docker compose exec worker env | grep -E "FASTAPI|INTERNAL|QSTASH"
```

| 変数名                | 期待値                                         |
| --------------------- | ---------------------------------------------- |
| `FASTAPI_PUBLIC_URL`  | `https://<CODESPACES_URL>-8000.app.github.dev` |
| `INTERNAL_API_SECRET` | Next.js・FastAPI と同じ値                      |
| `QSTASH_TOKEN`        | USリージョンのトークン                         |
| `QSTASH_URL`          | `https://qstash.us1.upstash.io/v2/publish`     |

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

| ワークフローファイル       | job名                                      |
| -------------------------- | ------------------------------------------ |
| `reusable-web-test.yml`    | `Next.js Test (${{ inputs.environment }})` |
| `reusable-api-test.yml`    | `FastAPI Test (${{ inputs.environment }})` |
| `reusable-worker-test.yml` | `Worker Test (${{ inputs.environment }})`  |

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

| ステータス             | 意味                             | 対処                                                                                   |
| ---------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| `pending` が増え続ける | Workerが処理していない           | Worker のログ（起動・停止）と Events で稼働状態を確認する（「Render Auto Deploy 設定について」の「Worker の確認」参照） |
| `retrying` が多い      | QStash送信が失敗中               | `last_error` を確認 → セクション4参照                                                  |
| `failed` がある        | MaxRetry超過                     | セクション4の手動requeueを実行                                                         |
| `processing` のまま    | 取得済みで未処理、または処理が止まった | `locked_at` を確認する。2 分以上前なら、次の Worker の起動時に回収される。再起動による回収は、二重処理のリスクを含めて未検証のため、staging / production の通常手順としては確定しない |

**Step 3: `processing` のイベントの状況を確認する**

```bash
# Prisma Studio で outbox_events を開き、status = processing の locked_at を確認する
dotenv -e apps/worker/.env -- npx prisma studio --schema=packages/db/schema.prisma
```

Worker のログで、`Starting outbox worker...` / `Recovered N stale events.` / `Shutting down worker...` の時刻と、`locked_at` を突き合わせる。

ローカル開発環境（docker compose）では、次の前提を確認したうえで、再起動して起動時の回収を実行できる。staging / production では、この手順は確定していない。

- 接続先の DB が、ローカル開発環境の DB であること（`apps/worker/.env` の `DATABASE_URL` を確認する）
- 他に動いている Worker がないこと
- 回収の対象にしたいイベントの `status` が `processing` で、`locked_at` が 2 分より前であること（Prisma Studio で確認する）

```bash
docker compose restart worker
docker compose logs worker -f
```

`Recovered N stale events.` の N が回収された件数である。0 は、その時点で回収対象がなかったことを示すだけで、回収の動作を確認したことにはならない。回収の動作を確認する場合は、上の条件を満たすイベントを用意したうえで、N が 1 以上になること、イベントが `pending` / `retrying` に戻ったことを確認する。

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

| 原因                   | 確認方法                         | 対処                              |
| ---------------------- | -------------------------------- | --------------------------------- |
| トークン期限切れ       | MotherDuckダッシュボードで確認   | トークン再発行・env更新後に再起動 |
| MotherDuck側障害       | MotherDuckステータスページで確認 | 復旧待ち                          |
| シングルトン接続の異常 | ログの `connection` エラー       | コンテナ再起動でリセット          |

```bash
docker compose restart api
```

**欠損データの復元可否**

| データ種別                                           | 復元可否               | 理由                               |
| ---------------------------------------------------- | ---------------------- | ---------------------------------- |
| リアルタイム分析イベント（auth_events・todo_events） | **復元不可**           | Webhook経由の書き込みのため        |
| dlt同期データ（User・Todo）                          | **次回同期で復元可能** | PostgreSQLから全件再同期されるため |

障害期間をメモしておき、復旧後にdlt pipelineを手動実行して同期データを最新化すること。

---

## 10. processed_eventsクリーンアップ失敗時の対処

**症状**: QStash Cronのクリーンアップが失敗し続け `processed_events` テーブルが肥大化する。

**影響範囲**: クリーンアップ失敗だけでは冪等性チェックは正常動作する。ただしテーブル肥大化が続くとDB性能に影響する。

**Step 1: QStash Schedule設定を確認**

Upstashダッシュボード → QStash → Schedules で以下を確認する。

| 項目 | 期待値                                                           |
| ---- | ---------------------------------------------------------------- |
| URL  | `https://<FASTAPI_PUBLIC_URL>/internal/cleanup/processed-events` |
| Cron | `0 18 * * *`（JST 03:00）                                        |

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

### 11-3. アプリ起動失敗（webServer 起動 timeout）

**症状**: E2E開始前に失敗 / webServer の起動 timeout

**確認**:

- タイムアウトログだけで判断せず、Playwright のログ（`webServer` の標準エラー出力を含む）を確認する。失敗した実行では、artifact の `playwright-report` / `test-results` も確認する
- CI の `webServer` は、ビルド済みの成果物を `npm run start` で起動する。起動に失敗する場合は、直前の `Build Next.js` ステップの成否を確認する（ビルドが失敗していると、起動できない）
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
Web / API / Worker のデプロイは、この自動デプロイが正式な経路である（GitHub Actions からデプロイは起動しない）。

**注意**:

- CI（GitHub Actions）がすべてパスした場合のみ Render がデプロイを実行する
- 対象ブランチに有効なCIワークフローが存在しない場合、デプロイは永久に保留状態になる
- `build_filter` に一致する変更があったサービスのみデプロイされる（web: `apps/web/**` と `packages/**`、api: `apps/api/**`、worker: `apps/worker/**` と `packages/**`）
- web / api / worker のデプロイ順序と完了時刻は保証されない。互換性は、変更の分け方で担保する（下記「互換性に関わる変更（expand / contract）」）
- 方針の詳細は README.md「デプロイ運用方針」を参照

### 通常のデプロイの確認

1. 対象ブランチへの push 後、GitHub Actions の CI がすべて成功していることを確認する
2. Render の各サービスの Events で、「New commit via Auto-Deploy」が開始され、最新コミットで live になったことを確認する
3. `build_filter` の対象外のサービスは、デプロイされない。デプロイされないことは異常ではない
4. `/health/ready` は、DB への接続と `processed_events` へのクエリの可否のみを確認する。新旧どちらの版が応答しているかは区別できないため、デプロイ完了の判定には使わない

### 互換性に関わる変更（expand / contract）

**スキーマ変更（`packages/db/schema.prisma`）**

1. Expand のみのリリースか確認する。後方互換な追加（列・テーブルの追加、NULL 許容、デフォルト値あり）だけを入れる
2. 破壊的な変更（列・テーブルの削除、型の変更、NOT NULL の追加、名称変更）は、Expand と、それを使う新版アプリが本番に反映された後の、別リリースで行う（Contract）
3. 1 つのリリースに、Expand と、旧版を壊す Contract を同居させない
4. Web のデプロイで migration が成功したことを確認する（下記「migration の失敗時の確認」）

**新しい `event_type` の追加（outbox payload の構造変更を含む）**

1. 1 つ目のリリース: Worker に、新しい `event_type` の処理を追加する。送信側（API / Web）は変更しない
2. Render で、Worker が最新コミットで live になったことを確認する
3. 2 つ目のリリース: 送信側（API / Web）が、新しい `event_type` を出すように変更する
4. 旧 Worker が新しい `event_type` を受け取ると、未知の `event_type` として永続エラー（`PermanentError`）になり、即座に `failed` になる。手動の再投入（`requeueFailedEvent.ts`）が必要になる。1 つ目と 2 つ目を同じリリースに入れない理由は、これである
5. outbox payload の構造変更も同様に、受け側（Worker）が新旧両方の構造を処理できるリリースを、先に出す

### migration の失敗時の確認

migration は、Web の起動時に実行される（`npm run db:migrate:deploy`）。API と Worker は migration を実行しない。

1. Render の Web サービスで、該当デプロイの状態（Events）とログを確認する。`prisma migrate deploy` のエラーが出ていないか見る
2. 失敗したデプロイは live にならず、旧版が動き続ける想定である。ただし、実際の失敗時の挙動は、本プロジェクトでは未確認
3. Prisma は、失敗した migration を記録し、以降の `migrate deploy` を止める場合がある（エラー P3009）。この場合は、DB の状態を確認したうえで、`prisma migrate resolve` で扱いを決める。実行前に、Prisma の公式手順を確認する
4. 原因を直した修正を、通常どおり push して、再デプロイする

### Worker の確認

- Worker が起動に失敗した場合（`main()` の失敗）は、Render の Worker サービスのログで `Worker failed to start` を探す。DB に接続できない、スキーマ（`outbox_events` など）が未整備、が主な原因である
- Worker が終了した場合は、このログの有無だけで判断しない。Render の Events の `Instance Failed` も確認する。`main()` を経由しない終了では、このログは出ないため、出ていないことは、異常終了がなかった根拠にならない
- Outbox イベントの処理で一時的なエラーが起きた場合は、イベントの処理を最大 8 回、指数バックオフで再試行し、超えると `failed` になる。これは、Worker プロセスの再起動とは別のものである
- `failed` のイベントは、自動では再投入されない。`requeueFailedEvent.ts` で手動で再投入する

**Worker のログ（起動・停止の記録）**

| ログ | 意味 |
| ---- | ---- |
| `Starting outbox worker...` | 起動した |
| `Recovered N stale events.` | 起動時の回収。N は回収したイベント数（0 は、その時点で回収対象がなかったことを示す） |
| `Shutting down worker...` | SIGTERM / SIGINT を受けた（デプロイ、手動の再起動、スピンダウンで同じログになる） |
| `Worker failed to start` | `main()` が失敗した（原因は問わない）。Worker のすべての異常終了で出るわけではない。Events に `Instance Failed` が記録される場合がある |

Render には、スピンアップ・スピンダウンを直接示す記録はない。`Shutting down worker...` は、デプロイ、手動の再起動、スピンダウンのどれでも出るため、ログだけでは原因を区別できない。Render の Events のデプロイ記録と突き合わせて判断する。

**確認状況**（根拠が異なる）

| 項目 | 状態 | 根拠 |
| ---- | ---- | ---- |
| 異常終了（`exit(1)`）後の再起動 | Render が、同じインスタンスで自動再起動した。Events に `Instance failed`、続いて `Service recovered` | staging で観測（2026-10-25、2 回） |
| 再起動の間隔 | 終了ログから次の起動ログまで、約 8 秒と約 24 秒（起動時間を含む）。規則・回数の上限は未確認 | 同上（2 回のみ） |
| スピンダウン（Free） | 起動（デプロイまたはリクエスト）の約 15 分後に、`Shutting down worker...` で正常終了した。外部リクエストがなければ再開せず、`GET /` で新しいインスタンスが起動した。Render の仕様（15 分間リクエストがないとスピンダウン）と矛盾しない | staging で観測。スピンダウンによるものとは推定（Render に記録がない） |
| 停止中のイベント | DB に残り、再開後に処理される | README「検証済み事項」（ローカルで確認） |
| production の挙動 | 試験していない | 未確認 |
| 回収の条件 | `processing` かつ `locked_at` が 2 分より前。`locked_at` が NULL は対象外 | コードで確認済み |
| 稼働中のポーリング | `processing` を再取得しない | コードで確認済み |
| SIGTERM 時の取得済みイベント | `processing` のまま残る | コードで確認済み。実機では未検証 |
| 実機での回収 | 未確認（観測した起動ログは `Recovered 0 stale events.` で、回収対象がなかった） | 未確認 |
| 二重処理 | 処理中・claim 済み未処理のイベントが回収されるケース。副作用の防止は、イベント種別ごとの冪等性の確認が必要で、保証は確定していない | コードからの推論。実機では未検証 |

詳細は README.md「デプロイ運用方針」の「Worker の回復挙動（確認状況）」を参照。

プロセスの再起動と、処理中イベントの回収は同じではない。前者は staging で観測したが、後者は未確認のため、「再起動すれば処理中のイベントも回収される」ものとして扱わない。

**`processing` のまま残ったイベント**

- Worker のヘルスチェック（`GET /`）は、常に 200 を返す。ポーリングが止まっても（ハング）、Render は再起動しない。ログの `Detected stale locked events` と、監視の通知で検知する
- `processing` のまま残ったイベントは、稼働中のポーリングでは自動回収されない。起動時の `recoverStaleEvents()` が回収するが、`locked_at` が 2 分以上前でも、旧インスタンスが処理を継続している可能性がある。再起動による回収手順は、二重処理のリスクを含めて未検証のため、通常の障害対応手順としては確定しない

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

| タイムスタンプ | イベント                          | 所要時間 |
| -------------- | --------------------------------- | -------- |
| 11:14:08 UTC   | Todo作成（createdAt）             | 0秒      |
| 11:14:10 UTC   | outbox_events sent（updatedAt）   | 約2秒    |
| 11:14:12 UTC   | processed_events作成（createdAt） | 約4秒    |

**結論**: 通常系は4秒以内で完全処理される。PITRブランチ作成時は前後1?2分の余裕を取れば十分。

---

### Step1: PITR基本動作確認

#### ブランチ作成

| ブランチ名          | 作成方法                                         | 指定時刻（JST） | 用途             |
| ------------------- | ------------------------------------------------ | --------------- | ---------------- |
| restore-test-before | Branch data and schema from a past point in time | 20:13           | Todo作成前の状態 |
| restore-test-after  | Branch data and schema                           | （現時点）      | 完全処理後の状態 |

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

| テーブル         | restore-test-before | restore-test-after        |
| ---------------- | ------------------- | ------------------------- |
| todo             | ? 対象レコードなし  | ? 対象レコードあり        |
| outbox_events    | ? 対象レコードなし  | ? status=sent             |
| processed_events | ? 対象レコードなし  | ? 対応idempotency_key存在 |

**結論**: PITRが正常に機能し、本番mainに触れずに過去時点のデータを復元できることを確認。

---

### Step2: Worker接続・monitor動作確認

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

| 項目                                 | 結果                                        |
| ------------------------------------ | ------------------------------------------- |
| PITRブランチ作成                     | ? 確認済み                                  |
| before（過去時点）の再現             | ? 確認済み                                  |
| after（現時点）の再現                | ? 確認済み                                  |
| 本番mainへの影響なし                 | ? 確認済み                                  |
| Worker起動（branch DB接続）          | ? 確認済み                                  |
| recoverStaleEvents（起動時スイープ） | ? 確認済み（0件正常）                       |
| monitor起動・ポーリング              | ? 確認済み                                  |
| failed監視（①）                      | ? 動作確認済み                              |
| stale retrying監視（④）              | ? Worker停止が必要（上記注意参照/別演習へ） |
| Unknown event typeの安全な失敗       | ? 確認済み                                  |

---

### 将来課題（未実施）

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

| 項目                                      | 結果                                                |
| ----------------------------------------- | --------------------------------------------------- |
| テストデータ作成                          | ✅ 確認済み（2026-06-29）                           |
| `outbox_stale_retrying_detected` ログ確認 | ✅ 確認済み                                         |
| Sentryイベント確認                        | ✅ 確認済み（Warning、monitor_type=stale_retrying） |
| クリーンアップ完了                        | ✅ 確認済み（2026-06-29）                           |

---

## 14. QStash DLQ込みの完全復旧演習

### 概要

FastAPI停止→Outbox滞留→QStash DLQ入り→手動復旧までの一気通貫演習。
「壊れても戻せる」を証明する最終DR演習。

### QStashリトライ仕様（Freeプラン・実測値）

| リトライ回数 | 待機時間             | 備考                   |
| ------------ | -------------------- | ---------------------- |
| 1回目        | 約12秒後             |                        |
| 2回目        | 約2分28秒後          |                        |
| 3回目        | 実測では約25〜36分後 | バックオフにより幅あり |
| 上限超過     | DLQ入り              | 手動リトライが必要     |

**FastAPIを止めてよい安全な時間の目安**

| 目標                          | 停止時間                                                    |
| ----------------------------- | ----------------------------------------------------------- |
| 3回目リトライで自動回復       | 3回目リトライが実行される前に復旧（実測では約25〜36分程度） |
| DLQ入りを確認してから手動回復 | 3回目リトライ失敗後（実測では約25〜36分程度）               |

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

| 項目                                       | 結果                      |
| ------------------------------------------ | ------------------------- |
| シナリオA：自動回復                        | ✅ 確認済み（2026-06-29） |
| シナリオB：DLQ入り確認                     | ✅ 確認済み（2026-06-29） |
| DLQ手動リトライ→processed_events記録       | ✅ 確認済み（2026-06-29） |
| requeueスクリプトはDLQに効かないことを確認 | ✅ 確認済み（2026-06-29） |

---

### QStash DLQ監視（monitor-qstash-job）

DR演習で「DLQ入りは誰も気づかない」ことが判明したため、`monitorQstashDlqService.ts` を実装して自動検知できるようにした。

#### 概要

| 項目                | 内容                                                                            |
| ------------------- | ------------------------------------------------------------------------------- |
| 監視対象            | QStash DLQ（外部SaaS）                                                          |
| 実装                | `monitorQstashDlqService.ts`（監視ロジック）+ `monitorQstashDlq.ts`（起動関数） |
| 起動                | `index.ts` 内で `startQstashDlqMonitoring()` として起動                         |
| 実行間隔            | 5分（`QSTASH_DLQ_MONITOR_INTERVAL_MINUTES` で上書き可能）                       |
| Sentry Cron Monitor | `monitor-qstash-job`                                                            |

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

Todo削除・Todo画像更新に伴うB2オブジェクト削除（`cleanupDeletedStorageKeys()`）が
失敗した場合の調査手順。設計思想（Transaction + External I/O Pattern）は README.md の
「Transaction + External I/O Pattern」セクションを参照。

**注意（2026年8月時点）**: Image単体削除・Album削除経由のB2削除は
Outbox化（`image.storage_delete_requested`）されたため、本セクションの対象外に
なった。それらの削除失敗調査は次項「16-1. Image削除Outboxイベントの調査」を参照。

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

**関連**: これとは別に、storageKeyの**値そのもの**にAuth0 subが含まれていたことによる
マスキング問題も過去に発生している（フィールド名ではなく値の中身が原因）。こちらは
storageKey命名規則自体の変更で対応済み。詳細はREADME.md「ADR: storageKey命名規則の変更と
GC基盤の導入」を参照。

**よくある原因**

| 原因                                 | 確認方法                             |
| ------------------------------------ | ------------------------------------ |
| B2側の一時的な障害                   | Backblazeステータスページで確認      |
| Application Keyの期限切れ・権限不足  | Backblazeダッシュボード → App Keys   |
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

## 16-1. Image削除Outboxイベント（image.storage_delete_requested）の調査

Image単体削除・Album削除経由のB2削除失敗は、通常のOutboxイベントと同じ
`outbox_events`のretrying/failedとして現れる。基本的な調査手順は
「4. failedイベントの手動requeue」「8. Outbox滞留調査」「6. 障害調査フロー」と
共通だが、`event_type = 'image.storage_delete_requested'`で絞り込む点が異なる。

**症状**

- `outbox_events`に`event_type = 'image.storage_delete_requested'`かつ
  `status = 'failed'`または`status = 'retrying'`のレコードが残っている
- B2ダッシュボード上に、削除されたはずのImageのstorageKeyが残存している

**Step 1: Prisma Studioでevent_typeを絞り込んで確認**

```bash
dotenv -e apps/worker/.env -- npx prisma studio --schema=packages/db/schema.prisma
# outbox_events テーブルで event_type = image.storage_delete_requested を確認
# payload.storage_key / payload.correlation_id を確認
```

**Step 2: status別の対処**

| ステータス | 対処                                              |
| ---------- | ------------------------------------------------- |
| `retrying` | 「8. Outbox滞留調査」の手順で`last_error`を確認   |
| `failed`   | 「4. failedイベントの手動requeue」の手順でrequeue |

**Step 3: correlation_idでの追跡**

`payload.correlation_id`を確認し、Workerログおよび既存の`correlation_id`追跡手順
（「6. 障害調査フロー」参照）に沿って調査する。本イベントはQStash/FastAPIを
経由しないため、`processed_events`の確認（同フローのStep 3相当）は不要
（Workerがトランザクションを完了した時点で処理が完結するため）。

**注意**: `processStorageDeleteEvent()`が失敗時にSentry Contexts（`correlation`）へ
`correlation_id`を設定しているかは、Worker共通のエラーハンドリング（`worker.ts`の
DLQ遷移時のSentry送信処理）の実装次第であり、本Issueのコード追加分だけでは
確定していない。実際にSentry Issue上で`correlation_id`が追えるかは、運用開始後に
実機で確認すること。

**B2 DeleteObjectの冪等性について**

存在しないKeyへの削除も成功として扱われる（実機確認済み、
`apps/worker/scripts/verifyB2DeleteIdempotency.ts`で検証。検証用スクリプトは
確認後に削除済み）。そのため`failed`の原因は基本的に認証エラー・設定不備
（Permanent）またはB2側の一時障害・ネットワーク断（Transient）のいずれかで
あり、「オブジェクトが既に存在しない」ことが原因になることはない。

## 17. StorageCleanupTask 手動運用

**目的**: `StorageCleanupTask`（B2 PUT成功後にImage DB作成が失敗し孤立した
B2オブジェクト（`image_create_failed`）のGC対象）の確認・手動回収手順。設計思想は
README.md の「GC（孤立B2オブジェクトの検知・回収）」セクションを参照。

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

## 18. Image ドメイン開発環境リセット（resetImageDomain.ts）

**目的**: dev/staging限定で、Image・TodoImage全件とB2 `uploads/`配下を一括リセットする
（storageKey命名規則の移行など、破壊的変更の前後で使用）。設計背景はREADME.md
「ADR: storageKey命名規則の変更とGC基盤の導入」を参照。

**⚠️ 破壊的操作の注意**: Image全件削除を伴う。**本番環境では絶対に使用しない**。
スクリプト内で`--env=dev|staging`を必須化し、`B2_BUCKET`名との完全一致を検証する
ガードを設けているが、実行前に必ず接続先環境（`DATABASE_URL`・`B2_BUCKET`）を
目視確認すること。

### 実行方法

```bash
# dev環境
npx tsx apps/web/scripts/resetImageDomain.ts --env=dev

# staging環境（env-fileを明示する場合）
npx tsx apps/web/scripts/resetImageDomain.ts --env=staging --env-file=apps/web/.env.staging.local
```

### 実行内容

- Image・TodoImageテーブルの全件削除
- B2 `uploads/`配下のオブジェクトをHidden化（物理削除は行わない。B2のLifecycle Ruleへ委譲する設計は
  「B2（Backblaze）運用ノウハウ」セクションの「Hidden File の確認方法」と同じ）

### 実行後の確認

```bash
dotenv -e apps/worker/.env -- npx prisma studio --schema=packages/db/schema.prisma
# Image・TodoImageテーブルが空になっていることを確認
```

B2ダッシュボードで対象オブジェクトがHiddenフラグ付きで表示されることを確認する
（「Hidden File の確認方法」セクション参照）。

**注意**: 安全装置・実装詳細の全容はスクリプト本体（`apps/web/scripts/resetImageDomain.ts`）の
コメントを一次情報とすること。このrunbookは運用手順の要約であり、ガード条件の完全な
一覧ではない。

## 19. Neon Providerバージョン不一致によるterraform plan失敗

> **現在の状態**: Neon Providerは v0.18系（`~> 0.18.0`）へ更新済みで、`default_endpoint_settings` は `primary_compute` に置き換え済み。以下は、リポジトリ移行時にlockファイルが引き継がれず発生した事例の記録であり、Provider選択の再現性を保つ根拠として残している。

### 症状

リポジトリ移行後、`terraform init` は成功するが `terraform plan` で以下のエラーが発生する。

```text
Error: Unsupported block type
on ../../modules/neon/main.tf line 20, in resource "neon_project" "main":
  default_endpoint_settings {
Blocks of type "default_endpoint_settings" are not expected here.
```

### 原因

旧環境では `.terraform.lock.hcl` に Neon Provider v0.15.0 が記録されていた。

リポジトリ移行時、`.terraform.lock.hcl` は `.gitignore` 対象だったため新しいリポジトリへ移行されなかった。その後、新しい環境で `terraform init` を実行したことで、旧環境で使用していたProviderのバージョン固定が引き継がれず、現在のProvider schemaと既存のTerraform設定の不一致が発生した。

Neon Provider v0.15.0では `neon_project` に `default_endpoint_settings` ブロックが存在する一方、v0.18.0ではこのブロックが存在せず、既存の `modules/neon/main.tf` と互換性がないことを確認した。

### 対処

発生当時は、staging / production のNeon Providerを一時的にv0.15.0系（`~> 0.15.0`）へ戻して対応した。その後、v0.18系のschemaに合わせて `terraform/modules/neon` を更新し、現在は `~> 0.18.0` を使用している。

同種の不一致が起きた場合の確認手順は以下。

1. `terraform/envs/*/.terraform.lock.hcl` がGit管理され、リポジトリに存在することを確認する。
2. `terraform init` を実行し、lockファイルが記録しているバージョンが選択されることを確認する。
3. `terraform plan` で既存設定が正常に解釈されることを確認する。

`terraform init` を実行してv0.15.0を選択し、`terraform plan` で既存設定が正常に解釈されることを確認する。

### 恒久対応

`.terraform.lock.hcl` はGit管理対象とする。

Terraformのroot moduleである以下の環境ごとのlock fileを管理する。

* `terraform/envs/staging/.terraform.lock.hcl`
* `terraform/envs/production/.terraform.lock.hcl`

これにより、リポジトリ移行や新規環境で `terraform init` を実行した際にも、Git管理されたlock fileによってProviderの選択状態を再現できるようにする。

なお、Terraform module（`terraform/modules/*`）についてはlock fileを管理対象としない。

---

## 20. Playwright UIの起動とポート競合時の対処

### 通常の起動

Docker Composeの `web` コンテナは、E2E用に `9323` ポートを公開している。
通常はコンテナ内でPlaywright UIを起動する。

```bash
docker compose exec web npm run e2e:ui
```

Codespacesでは、転送された `9323` ポートへ接続してPlaywright UIを使用する。

### `9323` が使用中の場合

以下のエラーが出る場合がある。

```text
Error: listen EADDRINUSE: address already in use 0.0.0.0:9323
```

これは `9323` を別のプロセスが既に使用しているために発生する。
Docker Compose環境では、`web` コンテナのPlaywright UIが起動中の場合などに発生する。

この場合は、`web` コンテナを使わず、Codespacesのターミナル（コンテナ外）で
別ポートを指定して起動する。

```bash
cd apps/web
npm run e2e:ui -- --ui-port 9324
```

起動後、Codespaces / VS Codeから `9324` ポートへ接続する。

**前提・注意**

- `e2e:ui` は `apps/web/` の `package.json` にのみ登録されている。ルートでは実行できない
- Webサーバーは Playwright 側が起動するため、別途アプリを起動する必要はない
- E2E では実行方法（Compose経由 / コンテナ外）に関わらず、`apps/web/.env` の
  `APP_BASE_URL` は `http://localhost:3000` とする。Codespacesの転送URLを
  指定すると、ポートではなくアプリへのアクセスが拒否される

### `9323` をCompose経由で使いたい場合

使用状況を確認する。

```bash
lsof -i :9323
```

保持しているのが `docker-proxy`（Composeのポートマッピング）の場合は、
プロセスを直接 `kill` しない。必要に応じてCompose側で `web` コンテナの
Playwright UIを終了する、または `web` コンテナを停止・再起動して解放する。

---

## 21. E2E失敗時の切り分け手順（環境起因の不安定への対処）

### 概要

ローカル（Codespaces）のE2Eが、コード・UIの変更なしに不安定になることがある。
失敗が1件だけの場合、アプリ側の不具合と環境起因を取り違えやすいため、
コードを調べる前に以下の手順で切り分ける。

ここに示す兆候は原因を断定する基準ではなく、調査の順序を決めるための目安である。
CIでPassしていることを、コード側が正常であるかの基準の一つとして扱う。

### 切り分け手順

**Step 1: 同じテストをCLIで繰り返す**

UIモードの失敗は、そのまま調査対象にせず、まずCLIで再現するかを確認する。
`apps/web` で実行する（実行方法は「20. Playwright UIの起動とポート競合時の対処」参照）。

```bash
cd apps/web
npx playwright test <テスト名の一部> --repeat-each=5
```

再発の有無を見たいだけなら、このとおり `--repeat-each` で十分。
「失敗したらもう一度」を試したい場合は、一時的に `--retries=1` をCLIで付ける。
`playwright.config.mts` の `retries` はローカルで0のままとし、変更しない
（偶発的な失敗が自動的に隠れるため）。

**Step 2: 他のテストにも波及しているか確認する**

軽いテスト（例: `home.spec.ts`、ダッシュボード表示）も落ちる場合、
テスト対象と無関係な失敗が広がっている。この場合はコード側の調査より先に、
環境の状態を確認する。

**Step 3: 環境の状態を確認する**

```bash
free -h
df -h /workspaces
uptime
ps aux --sort=-%mem | head -8   # 残ったchromium / nodeプロセスがないか
```

Codespaces再作成直後は、依存関係の導入や初回コンパイルなどの環境初期化が完了していることを確認してから再実行する。

**Step 4: 失敗の種類を見る**

| 失敗の種類 | 調査の方向 |
| ---------- | ---------- |
| `Expected: X / Received: Y` のように値が食い違う | コード・UIを調べる価値がある |
| `Page crashed` / `Target closed` | 環境（メモリ・共有メモリ・ブラウザ）を先に疑う |
| timeoutのみで、snapshotの画面は正常に見える | 環境・DB・開発サーバーの状態を先に疑う |

ただし、同じ失敗が毎回再現しても環境要因（DBの遅延・開発サーバーの状態等）は
ありうる。1回の再現だけで、コード側の問題と断定しない。

**Step 5: 環境をリセットして再実行する**

開発サーバー（`next dev`）の再起動、ブラウザ・Nodeプロセスの残骸の終了、
ウィンドウのリロードを行い、再実行する。
CIとの比較が必要な場合は、`npm run build && npm run start` の本番ビルドに対して
実行し、`next dev` の影響を切り離す。

**Step 6: テストデータの残存を確認する**

過去の失敗でcleanupが完了していない場合、テストが作成したデータが残っていることが
ある。画面表示やテスト結果にデータ残存が影響している可能性がある場合は確認する。

Album系specのcleanupは、`cleanup` fixture（`tests/test-utils/e2e-cleanup.ts`）が
テスト終了後にAPI経由で行う。cleanupが失敗してもテストは失敗にならないため、
データを調べる前に、失敗の記録を確認する。

- ターミナル: `[e2e-cleanup]` で始まる行（`list` / `dot` のどちらでも出る）。
  例: `npx playwright test <テスト名> 2>&1 | grep e2e-cleanup`
- HTMLレポート: 該当テストのAnnotationsに、失敗の内容が出る
  （例: `Album: DELETE /api/albums/<id> -> 429 (Retry-After: …)`）
- UIモード: ConsoleとAnnotations

記録があれば、statusから原因を絞る（目安: 429は `todoRatelimit`（30回/分）への
到達、401は認証状態（storageState）の問題）。記録がないのに残存がある場合は、
cleanupの対象外のデータか、fixtureへの登録漏れを疑う。

削除する場合は、対象テストが作成したデータであることを確認してから行う。
`e2e-` プレフィックスだけを根拠に一括削除しない。

テストが `Fixture "cleanup" timeout of 30000ms exceeded during teardown` で失敗した場合は、
cleanupのリクエストが滞っている。開発サーバー・DBの状態を確認する（Step 3）。

### afterEachの「dialogが残っている」について

Album系specの`afterEach`は、`dialog` / `alertdialog` が残っていないことを検証している。
テストデータのcleanupは`cleanup` fixtureがAPI経由で行い、削除ダイアログを操作しない。
このため、cleanupが原因でダイアログが残ることはない。

`afterEach`が失敗した場合は、次の順に確認する。

1. 本体のアサーションが失敗していないか。本体の失敗で、ダイアログが開いたまま
   残ることがある。この場合のダイアログは、本体の失敗の結果であり、原因とは限らない。
   本体の失敗を先に確認する。
2. `album.auth.spec.ts`の「アルバムの削除フロー」の場合は、UI削除そのものが原因の
   可能性がある。このテストだけは、UIで削除操作を行う。

### 観測事例（2026-10）

コード・設定の変更なしに、ローカルのE2Eが一時的に不安定になった事例。原因は未特定。

| 項目 | 内容 |
| ---- | ---- |
| UIモード | Albumの並び替え、未所属画像のドロップ、ダッシュボード表示など複数のテストが失敗。`Page crashed`、30秒timeout、`afterEach`のdialog残りが発生 |
| CLI | 同時期に似たエラーが時々出たが、UIモードのような全失敗にはならず、Passする方が多かった |
| 復旧 | 設定を元に戻してCodespacesを再作成した。直後も不安定だったが、時間経過とウィンドウのリロード後に解消した |
| 復旧後 | CLIの`--repeat-each=10`が全てPass。UIモードも約5回Pass |
| CI | 同種の失敗は発生していない |

この事例について、現時点で言えるのは次の点のみである。

- Album DnDの実装がflakyだったことを示す材料はない
- 特定の設定が原因または対策だったとは言えない（設定変更なしで解消した）
- 「UIモード固有」とも断定できない（不安定期間のCLIでも類似のエラーがあった）
- 根本原因は特定できていない

再発した場合は、同じタイミングでCLIでも1本実行し、`free -h`の結果とあわせて記録する。
UIモードとCLIの比較、環境の状態の確認が揃えば、切り分けが進めやすくなる。

### 運用方針

- UIモードは、失敗の調査用として使う。通常の確認はCLIで行う
- UIモードで1件だけ失敗した場合も、Step 1（CLIで再現するか）を先に確認する
- 原因を特定できないまま、cleanup・Playwright設定・devcontainer設定を変更しない
- ローカル E2E は、実装中の動作確認と失敗時の原因調査に使用する。CI E2E は、staging・production の web workflow で認証つきテストとゲスト向けテストを実行し、回帰を検出するために使用する。
- CI でのみ発生する失敗は、CI の実行結果とアーティファクトを確認して調査する。アーティファクトの保存方針や、調査時に trace を一時的に有効化する手順は「27. E2E の実行方針とアーティファクト・テスト専用アカウントの運用」を参照する。

## 22. リリース手順（GitHub Release）

productionへの変更反映後にGitHub Releaseを作成する場合の手順。

### main（production）PRの準備

`staging → main` のPRを作成する。

リリース対象の変更内容を確定した上で、`doc/development-workflow.md` の「バージョン番号」に従って `vX.Y.Z` を決定する。

- PRタイトルは `release: vX.Y.Z` とする
- stagingに含まれる変更内容をPR本文に整理する
- 変更が多い場合は、stagingのコミット履歴をもとに変更内容を整理した草案を作成して利用してよい
- CIが成功していることを確認する

`feature/* → staging` はSquash merge、`staging → main` はMerge commitを使用する。

### 1. main（production）PRのマージを確認

以下を確認する。

- CIが成功している
- PRが `main` へマージ済みである
- mainのコミット履歴にstaging側で統合された変更履歴が保持されていることを確認する。

### 2. production deploymentの完了を確認

productionへのマージ後、実際のproduction deploymentが完了していることを確認する。

Renderでproductionの以下のサービスが最新コミットに反映されていることを確認する。

- API
- Worker
- Web

GitHub Actionsの成功（CI）は、deployment完了を意味しない。Renderの自動デプロイはCI成功後に開始されるため、実際のサービス反映状態をRender側（Events）で確認する。`build_filter` の対象外のサービスは、デプロイされない。

production の `Terraform Plan (Manual)` を実行し（「Use workflow from」は `main`）、`Has changes` が `false`（`No changes`）であることを確認してから、GitHub Releaseを作成する

### 3. 互換性に関わる変更の確認

以下の変更を含むリリースでは、互換性の原則（expand / contract、`event_type` の2リリース）に従って、変更が分けられていることを確認する。

- `packages/db/schema.prisma` の変更
- outbox payloadの構造変更
- 新しいwebhookイベントタイプの追加

web / api / worker のデプロイ順序は保証されない。手順は「Render Auto Deploy 設定について」の「互換性に関わる変更（expand / contract）」を参照。

Renderで、変更のあったサービスがすべて最新コミットで live になっていることを確認してから、GitHub Releaseを作成する。

### 4. GitHub Releaseを作成

GitHubのRelease画面から新しいReleaseを作成する。

設定:

- Tag: `vX.Y.Z`
- Target: Target: ブランチ `main`（作成後に、Releaseが指すコミットが `release: vX.Y.Z` のマージコミットであることを確認する
- Release notes: `Generate release notes` を必要に応じて利用する

ここで使用する `vX.Y.Z` は、mainへのリリースPRを準備する段階で決定済みのバージョン番号を使用する。GitHub Release作成時に新たにバージョン番号を決定するものではない。

`Generate release notes` の生成結果を確認する。

過去のRelease / Tagが存在しない、または生成結果が今回の変更内容を十分に表していない場合は、mainへのマージ前に作成したPR本文などをもとにRelease notesを手動で整理する。

Release branchは作成しない。

各manifest（package.json / pyproject.toml）の version は、現時点ではアプリ側から参照しておらず、本手順の対象に含めていない。

### 5. リリース後

GitHub Releaseの作成後、必要に応じてproductionの状態を確認する。

定期的なproduction smoke testは継続的な本番監視を目的とするものであり、GitHub Release作成後にその実行完了を待つことをリリース手順の必須条件とはしない。

---

## 23. 外部Actionの更新手順（Node.js移行対応）

GitHub Actions のランタイム（Node.js）更新などで、`uses:` で参照している外部Actionをまとめて更新するときの手順。ここには再利用できる手順だけを書く。

### 23.1 棚卸し

1. `.github/workflows/*.yml` と `.github/actions/*/action.yml`（Composite）の `uses:` をすべて洗い出す。Composite の中にある `uses:` も対象。

```bash
grep -rnE '^\s*-?\s*uses:' .github/workflows .github/actions
```

2. 更新する Action の公式ドキュメントや変更履歴を確認し、今回使用している入力パラメータや機能に影響する変更がないか調べる。Action ごとに、現在のタグの `action.yml` で `runs.using` を確認する（`node20` / `node24` など）。

```bash
# 例: actions/checkout v4
curl -fsSL https://raw.githubusercontent.com/actions/checkout/v4/action.yml \
  | grep -E '^[[:space:]]*(runs:|using:)'
```

3. `runs.using` が `node20` など、移行対象のNode.jsランタイムを指定しているJavaScript Actionを更新対象にする。`docker` 型や `composite` 型のAction自体は、`runs.using` によるNode.jsランタイム移行の対象外。ただし、Composite Action内で参照している各Actionは、個別に確認する。

### 23.2 更新先バージョンの選び方

- **最新メジャーではなく、対象ランタイム（Node 24 など）に対応した最小のメジャーを選ぶ。** 最新メジャーまで上げると、ランタイムと無関係な破壊的変更が混ざる。
- 自分のリポジトリで使っている入力・機能に影響する変更だけを、リリースノートで確認する。
- 自己ホストランナーを使う場合のみ、Action が要求するランナーの最小バージョンを確認する。`ubuntu-latest` などの GitHub ホストランナーでは不要。
- Node のバージョン指定（`node-version`）や権限の最小化・SHA固定は、別Issueとして切り分ける。

### 23.3 PRの分け方

CIだけで検証できるものと、手動実行・スケジュール・`repository_dispatch` でしか動かないものを分ける。

| PR | 対象 | 検証 |
|----|------|------|
| 1本目 | CIで動くワークフロー（PRチェック、テスト、fmt/plan など）と共通Composite | PRのCIと、マージ後のCI |
| 2本目 | 手動・スケジュール・dispatch でしか動かないもの（apply / smoke test など） | `workflow_dispatch` による手動実行 |

注意:

- 共通Composite（`.github/actions/*`）を1本目で変えると、2本目のワークフローにも影響する。2本目の検証時にその点も確認する。
- 2本目のブランチは、1本目マージ後の最新 `staging` から作り直す。1本目のコミットが混ざらないようにする。

### 23.4 検証時の落とし穴

| 項目 | 内容 |
|------|------|
| `pull_request.paths` | `.github/**` が含まれないと、ワークフロー変更だけのPRでは web / api / worker のCIが動かない。動いたかどうかは Checks で確認する |
| `e2e` ジョブ | `pull_request` でのみ動く。`apps/web` を触るPRでないと検証できない |
| plan ジョブ | `terraform/**` の変更がないと `detect-changes` のみ動き、plan ジョブ自体はスキップされる。plan 内の Action は検証されない |
| `workflow_dispatch` | 実行にはデフォルトブランチ上にファイルが必要。ブランチ上の変更を試すときは「Use workflow from」でそのブランチを選ぶ |
| `repository_dispatch` / `schedule` | repository_dispatch / schedule の受け側・定期実行ともデフォルトブランチのファイルが使われる。対象ブランチの変更が実行に反映されるかは、Workflow のトリガー仕様を確認する。 |
| `terraform-apply` | plan と apply は別の workflow（`terraform-plan-manual.yml` → `terraform-apply.yml`）。apply は plan の GitHub Actions run ID を入力に取り、確認済みの plan を適用する。plan・apply を同じブランチ・コミットで実行しないと失敗する。詳細は「25. Terraform の plan / apply（手動運用）」 |
| 本番系 | production の apply / smoke test / deploy は、`staging → main` のリリース後でないと確認できない。未検証として記録して残す |

### 23.5 確認

1. 検証で実行したワークフローの Run を開き、Annotations に `Node.js 20 actions are deprecated` が出ていないことを確認する。
2. 実行できなかったワークフローと理由を、未検証として一覧化など残しておく。
3. 既存の失敗（今回の更新と無関係なもの）は、Action更新のPRに混ぜず、別Issueとして起票する。

### 23.6 差分の作り方

行数が多いので、手作業ではなくスクリプトで `uses:` の行だけを置換する。

- 置換は `uses: <owner>/<repo>@<旧タグ>` の行に限定する。
- ファイルの改行コード（CRLF）に依存しないよう、`sed` などで行末に触れずに置換する。Python で書き換える場合は `open(..., newline='')` を使う。そうしないと CRLF→LF 変換で全行が差分になる。
- 実行後、`git diff --stat` と下記で、変更が `uses:` 行だけであることを確認する。

```bash
git diff | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE 'uses:'
# 何も出力されなければOK
```

- 置換件数が、更新対象として特定した uses: の件数と、実際に置換した件数が一致するか確認する

### 23.7 ランナー（`runs-on`）の更新

`runs-on` は `ubuntu-26.04` で固定している（`ubuntu-latest` は使わない）。GitHub が `ubuntu-latest` の移行を告知したとき、または新しいUbuntuが提供されたときは、次の手順で更新する。

1. `grep -rn 'runs-on:' .github/workflows` で、`runs-on` を洗い出す。
2. 新しいバージョンに一括で切り替え、staging で全 workflow を実行する。警告やエラーが出ていないか、各ジョブのログを確認する。
3. 壊れたジョブだけを1つ前のバージョンに固定し、理由をコメントに残す。
4. production 系は staging の結果で代替し、リリース後に production の `Terraform Plan (Manual)` と smoke test で確認する（「23.4 検証時の落とし穴」の「本番系」と同じ扱い）。

## 24. GitHubリポジトリ移行後のTerraform apply失敗（Environment 404 / 変数409）

### 概要

GitHubリポジトリ移行後、staging環境のTerraform適用時にGitHub Environmentの作成で404が発生し、その後の適用では既存のEnvironment変数の作成時に409が発生した

`terraform plan` は成功していたが、`terraform apply` で失敗した。最終的にTerraform StateとGitHub側の既存リソースを照合し、Environment変数をimportすることで解消した。

### 発生した症状

#### 1. GitHub Environment作成時の404

`terraform apply` で以下のエラーが発生した。

```text
Error: PUT https://api.github.com/repos/xxx/nextjs-fastapi-app/environments/staging: 404 Not Found
```

対象リソース：

```text
module.github_secrets.github_repository_environment.main
```

当時、リポジトリの所有者変更に合わせて `github_repo_url` は更新済みだったが、エラーのリクエスト先は旧所有者になっていた。

`terraform plan` は成功しており、Environmentの作成時に `apply` が失敗した。

#### 2. Environment変数作成時の409

GitHub Token更新後の適用では、Environment変数の作成時に以下のエラーが発生した。

```text
409 Already exists - Variable already exists
```

対象リソース：

- `module.github_secrets.github_actions_environment_variable.api_url`
- `module.github_secrets.github_actions_environment_variable.web_url`

GitHub側には `API_URL` と `WEB_URL` が既に存在していた一方、Terraform Stateには対応する2つのリソースが登録されていなかった。

### 原因の整理

#### 404について

GitHub Token更新後にEnvironment作成の404から先へ進んだため、Tokenの認証・権限が関係していた可能性がある。

ただし、`github_repo_url` 更新済みの状態で、実際のリクエスト先が旧所有者を指していた理由は特定できていない。Token更新が404の解消原因だったと断定せず、Provider設定、Terraform Cloudの変数、モジュールへの入力値、当時の実行経路なども調査対象とする。

#### 409について

Terraform StateとGitHub側の実リソースに不一致があったことを確認した。

GitHub側に既存変数が存在する一方、Terraform Stateに対応するリソースがなかったため、Terraformが新規作成を試みて409になった。

### 対応手順と結果

1. stagingのTerraform Stateを確認し、Environmentリソースは登録済みだが、`API_URL` と `WEB_URL` の変数リソースは未登録であることを確認した。
2. stagingのルートモジュールに一時的なimportブロックを追加した。

   ```hcl
   import {
     to = module.github_secrets.github_actions_environment_variable.api_url
     id = "nextjs-fastapi-app:staging:API_URL"
   }

   import {
     to = module.github_secrets.github_actions_environment_variable.web_url
     id = "nextjs-fastapi-app:staging:WEB_URL"
   }
   ```

3. `terraform plan` で2つの変数がimport対象となり、追加・変更・削除が発生しないことを確認した。
4. `terraform apply` を実行し、2つの変数をimportした。
5. importブロックを削除し、再度 `terraform plan` を実行した。

結果：

- staging：import成功。importブロック削除後の `plan` は `No changes`。
- production：`plan` と `apply` が成功。追加のimportは不要だった。

### 今後の調査・運用上の注意

GitHubリポジトリ移行後にTerraform適用が失敗した場合は、以下を確認する。

1. `terraform plan` の成功だけで、GitHub APIへの書き込み権限や `apply` の成功を判断しない。
2. エラーログに記録されたAPIリクエスト先の所有者・リポジトリ名を確認し、移行後の設定と一致しているかを調べる。
3. GitHub Providerの設定、Terraform Cloudのworkspace変数、ルートモジュールから各モジュールへの入力値を確認する。
4. GitHub Tokenの権限・参照先も確認する。ただし、複数の設定を同時に変更した場合は、成功したという結果だけで特定の変更を原因と断定しない。
5. `409 Already exists` が発生した場合は、GitHub側の既存リソースとTerraform Stateを照合する。既存リソースを管理対象に取り込む必要がある場合は、正確なTerraformアドレスとimport IDを確認してからimportする。
6. import後は一時的なimportブロックを削除し、再度 `terraform plan` を実行して `No changes` になることを確認する。

**注意**：今回の404の根本原因は確定していない。Token更新とリクエスト先の不一致は別々の観点として扱い、同様の症状が再発した場合は実行ログと当時の設定を突き合わせて調査する。

## 25. Terraform の plan / apply（手動運用）

plan と apply は別々の workflow で実行する。plan の内容を確認してから、確認した plan だけを適用するための運用である。

| workflow | 役割 |
| -------- | ---- |
| `Terraform Plan (Manual)`（`terraform-plan-manual.yml`） | plan を作成し、成果物を保存する |
| `Terraform Apply`（`terraform-apply.yml`） | 保存した plan を適用し、必要ならデプロイを起動する |

PR 用の `terraform-plan.yml` は、これとは別で、変更しない。

### 25.1 用語（2 種類の run ID がある）

| 名称 | 内容 |
| ---- | ---- |
| GitHub Actions の run ID | `Terraform Plan (Manual)` の実行 ID。apply の入力 `plan-workflow-run-id` に指定する |
| HCP Terraform の run ID | `tfplan` が参照する HCP 側の run。成果物の `metadata.json` に記録される |

apply に指定するのは、GitHub Actions の run ID である。

### 25.2 手順

1. `Terraform Plan (Manual)` を、対象の環境で実行する（apply するブランチを「Use workflow from」で選ぶ）。
2. Summary で、変更内容、`Has changes`、コミット、**GitHub Actions run ID** を確認する。
3. 内容に問題がなければ、`Terraform Apply` を **同じブランチ・同じコミット**で実行する。入力は次のとおり。
   - `environment`: plan と同じ環境
   - `plan-workflow-run-id`: 手順 2 で確認した run ID
4. apply の Summary で、plan の run ID・HCP run ID・コミットが、plan 時のものと一致していることを確認する。

`Terraform Apply` は、アプリケーション（Web / API / Worker）をデプロイしない。アプリケーションのデプロイは、Render の自動デプロイで行う。

### 25.3 apply が失敗する条件

**workflow の事前検証で止まる（`terraform apply` の前）**

- 指定した run が `terraform-plan-manual.yml` のものでない、または成功していない
- 指定した run の成果物が存在しない（期限切れ、または環境の取り違え）
- plan と apply のコミットが違う
- plan と apply の環境が違う
- `plan-workflow-run-id` が、成果物に記録された値と一致しない
- `tfplan` の HCP run ID が、記録された値と一致しない
- HCP の run が、対象環境のワークスペースのものでない

これらの照合は、plan の取り違えや内部の不整合を検出するためのものであり、改ざんの防止ではない。

**Terraform が apply 時に検出する**

- state が plan 後に変わった、HCP 側で plan が破棄されたなど、plan が無効になった場合

この場合は `terraform apply` が失敗する。事前検証では判定しない。

### 25.4 変更なしの場合

`Has changes` が `false` の plan では、`terraform apply` は省略される。アプリケーションのデプロイは、変更の有無にかかわらず、この workflow では起動しない。

### 25.5 成果物の期限切れ

成果物の保持期間は 3 日である。期限が切れた場合は、`Terraform Plan (Manual)` を再実行し、新しい run ID で apply する。これは、HCP Terraform 側の plan の有効期間とは別である。

### 25.6 terraform apply が失敗した場合

次の順で確認する。

1. apply のログで、失敗の原因を確認する
2. state の変更や plan の破棄など、plan が無効になったことが原因なら、`Terraform Plan (Manual)` を再実行し、新しい run ID で apply する
3. それ以外（権限、プロバイダの障害など）は、原因を解消してから、再 plan の要否を判断する

すべての失敗が再 plan を必要とするわけではない。

### 25.7 workflow を変更するときの注意

- **`setup-terraform` は `terraform_wrapper: false` にする**（`terraform-plan-manual.yml`）。wrapper が有効なときは、変更ありの plan でも `Has changes` が `false` になった。無効化後は、変更あり・なしの両方で正しく判定された。wrapper が原因である機序は未検証で、確認できているのは無効化後の挙動のみ。
- **Terraform output は、state に存在するものだけを参照する**。存在しない output を `|| echo ''` や `2>/dev/null` で握りつぶすと、値が空のまま進み、CI のログに原因が出ない。使わない output を読む step は置かない。
- **変更後は、変更なしの plan → apply だけでなく、変更ありの plan → apply も確認する**。staging の使い捨てブランチで、リソースの追加と削除（revert）の両方を通す。

## 26. 緊急時の destroy 手順（Terraform）

GitHub Actions に destroy 用の workflow はない（廃止した）。緊急時にリソースを破棄する場合は、次のどちらかで行う。

| 方法 | 内容 | 使いどころ |
| ---- | ---- | ---------- |
| A. HCP Terraform の画面（推奨） | Queue destroy plan で plan を作成し、画面で内容を確認してから適用する | 通常はこちら |
| B. ローカル | `terraform destroy`（plan が表示され、確認の入力後に適用される） | HCP の画面が使えない場合 |

### 26.1 破棄前の確認

- 対象のワークスペース（`nextjs-fastapi-staging` / `nextjs-fastapi-production`）を、画面または実行ディレクトリで確認する
- Neon のデータと Backblaze B2 のオブジェクトは、破棄すると失われ、復元できない場合がある。必要なデータは先に退避し、復元できることを確認してから破棄する
- Plan に表示される破棄対象のリソースとその数が、想定と一致していることを確認する

### 26.2 方法 A: HCP Terraform の画面

1. 対象のワークスペースを開き、Settings → Destruction and deletion を開く
2. `Allow destroy plans` が有効であること、Auto-apply がオフであることを確認する（`Allow destroy plans` が無効だと、destroy plan は適用できない）
3. `Queue destroy plan` を実行する。ボタンを押して`delete`入力。
4. 生成された plan で、対象のワークスペースと、破棄されるリソースを確認する
5. 破棄が必要であることを確認した場合に限り、画面の確認の操作（`Confirm & Apply`）で適用する。適用しない場合は、`Discard Run` で実行を破棄する（破棄するまでワークスペースはロックされ、他の run は待たされる）

### 26.3 方法 B: ローカル

```bash
cd terraform/envs/<staging|production>
terraform destroy
```

- 破棄されるリソースの plan が表示される。内容を確認し、問題がなければ `yes` を入力して適用する。中止する場合は `yes` 以外を入力する
- HCP Terraform にログイン済みであること（production の apply をローカルで行う場合と同じ）
- `Allow destroy plans` が無効な場合は、方法 A と同様に、適用できない

### 26.4 破棄後

- 再作成は、「25. Terraform の plan / apply（手動運用）」の手順に従う
- Neon のデータと B2 のオブジェクトは、再作成しても元に戻らない（新しい空のリソースになる）

### 26.5 事前の確認（演習）

staging で、方法 A の plan の生成までを確認できる。`Queue destroy plan` で plan を作成し、内容を確認したら、確認の操作はせず `Discard Run` で終了する。実リソースの破棄は行われない。

### 26.6 注意

`Force delete`（Delete workspace）は、HCP Terraform のワークスペース自体を削除する操作で、管理対象リソースの破棄ではない。リソースの破棄の代わりにはならない。

## 27. E2E の実行方針とアーティファクト・テスト専用アカウントの運用

### 27.1 ローカル E2E と CI E2E の役割

- **ローカル E2E**: 実装中の動作確認や、失敗時の原因調査に使用する。Playwright UI などを利用して操作の流れを確認し、CI に送る前に問題を切り分ける。
- **CI E2E**: staging・production の web workflow で、認証つきテスト（`auth_chromium`）とゲスト向けテスト（`guest_chromium`）を実行し、変更による回帰を検出する。失敗時はアップロードされたアーティファクトを使って原因を調査する。

CI は継続的な回帰検出、ローカルは実装時の確認・詳細な調査を主な役割とする。CI でのみ発生する失敗を調査する場合は、アーティファクトに含まれる情報を確認し、必要に応じて trace を一時的に有効化する。

### 27.2 アーティファクトの保存方針

E2E のアーティファクトには、失敗原因の調査に必要な情報が含まれる一方、認証情報やユーザー情報が含まれる可能性がある。必要な診断情報を残しながら、保存する情報を制限する。

| 対象 | 保存・実行方針 |
|---|---|
| HTML レポート | ログイン用の `setup` は通常の E2E テストと分けて `--reporter=list` で実行し、setup のログイン操作を HTML レポートに含めない。通常の E2E テストの HTML レポートは保存する。 |
| trace | 通常は `trace: 'off'` とする。Cookie やレスポンス本文などが記録されるリスクがあるため。 |
| スクリーンショット | `only-on-failure` とし、テスト失敗時のみ保存する。 |
| `test-results/` | 失敗時の診断情報などを保存する。ただし、setup 用のテスト結果ディレクトリは artifact のアップロード対象から除外する。 |
| 認証状態 | `.auth/user.json` はアップロード対象に含めない。 |
| パスワード | setup のログイン操作を通常の HTML レポートから分離し、パスワードを出力する `console.log` は置かない。パスワードが HTML レポート・`test-results/` に含まれないことを確認済み。 |

アーティファクトのアップロード対象は、Playwright の設定および各 workflow で指定した範囲に従う。現在の構成では、成功時の `.last-run.json` はアーティファクトに含まれない。

アーティファクトへのアップロード前に、ID・パスワードなどをスクリプトで置換・マスキングする方式も検討したが、GitHub Actions の実行時間、置換失敗時のエラー処理、シェルやスクリプトの管理・保守コストを考慮し、今回は実装しない。代わりに、setup の分離、パスワードのログ出力削除、trace の通常無効化、アーティファクトの保持期間制限など、採用済みの対策によって露出リスクを抑える。

ただし、通常の認証つきテストの失敗時には、`error-context.md` に出力される失敗対象の DOM ツリー構造などに、テスト専用アカウントのメールアドレスが含まれる場合がある。マスキング処理を実装しないため、ID がアーティファクトに含まれないことを保証するものではない。

CI の原因不明の失敗を調査するために trace が必要な場合は、調査対象のプロジェクトだけで一時的に有効化する。`setup` では有効化しない。調査後は設定を戻し、アップロード済みの該当アーティファクトも削除する。

production の artifact 保持期間は staging と揃えて 7 日とする。

### 27.3 テスト専用アカウントの ID を許容する理由

通常の認証つきテストの失敗時には、アーティファクトにテスト専用アカウントのメールアドレスが含まれる場合がある。このリスクを認識したうえで、チーム内のみがアクセスできる private リポジトリでの運用を前提に、E2E 専用の一般アカウントの ID（メールアドレス）は許容する。一方、パスワードはアーティファクトに出力しない方針とする。

staging と production は同じ Auth0 テナント・同じテストユーザーを使用するため、認証情報が漏えいした場合は production へのログインにも影響する。このため、漏えいが疑われる場合は、アカウントと認証情報を保護し、利用状況を確認する。

### 27.4 認証情報の漏えいが疑われる場合

1. **アカウントを保護し、調査に必要な情報を保全する**: 漏えいが疑われる場合は、まず不正利用を防ぐための措置を取り、Auth0 のログなど調査に必要な情報を確認・保全する。アカウントのブロックは、アカウントを残したまま利用を停止し、関連するログを確認しながら調査を続けたい場合に選択する。アカウントの削除・再作成は、既存アカウントを継続利用せず、新しい E2E 専用アカウントへ切り替える場合に選択する。どちらを選ぶ場合も、認証情報の変更・更新と、不正利用の有無の確認を行う。
2. **アーティファクトを削除する**: GitHub Actions の該当 run を削除し、該当アーティファクトが削除されたことを確認する。リポジトリ外に共有・保存されたものがあれば、そちらも削除する。
3. **不正利用を確認する**: Auth0 のログで見覚えのないログインを確認する。テストアカウントの Todo、Album、B2 の画像などに不正な作成・変更・削除がないかを調査し、必要に応じて復旧する。
4. **認証情報を更新する**: 新規作成または変更した認証情報を、HCP Terraform の該当 sensitive 変数、staging・production の GitHub Secrets、各メンバーのローカル `.env` に反映する。Terraform 経由で Secrets を反映する運用を基本とする。緊急時に GitHub Secrets を先に手動更新した場合は、HCP Terraform の変数も同じ値に更新し、次回の Apply で古い値に戻らないようにする。
5. **動作を確認する**: CI と Smoke Test で、新しい認証情報によるログインおよび基本動作を確認する。
6. **対応を記録する**: 実施日、対応の契機、実施者、確認結果を記録する。

Auth0 のログ保持期間は利用中のプランなどによって異なるため、必要な際に確認する。

### 27.5 定期的な認証情報の変更

E2E 専用アカウントの認証情報は、定期的に見直す。特に、チームメンバーの離脱やチーム編成の変更など、アカウントの利用者・アクセス範囲を見直すタイミングで、認証情報の更新を検討する。