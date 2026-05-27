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