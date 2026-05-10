# Next.js-FastAPI-APP

Next.js/FastAPI モノレポベースのWebアプリケーション

## 概要

拡張性と保守性を重視したフルスタックWebアプリケーションです。TypeScriptを採用し、レイヤードアーキテクチャによる明確な責務分離を実現しています。

このプロジェクトはdjango-react-appをベースにして開発されています。基本構造などはそちらをご覧下さい。

## 技術スタック

### バックエンド

- **フレームワーク**: fastapi 0.115.0
- **データベース**: PostgreSQL 17 (psycopg2-binary 2.9.9)
- **データウェアハウス**: MotherDuck (DuckDB), dlt 1.20.0
- **キャッシュ/セッション**: Redis (Upstash)
- **メール送信**: Resend 0.8.0
- **非同期処理**: QStash (Upstash)
- **レートリミット**: Upstash Ratelimit (Redis)
- **ベクトル検索**: Google Gemini API (gemini-embedding-001, 1536次元), Upstash Vector
- **サーバー**: gunicorn 21.2.0

### フロントエンド

- **フレームワーク**: Next 16.2.1, React 19.2.4, TypeScript 5.9.3
- **API(graphql)**: graphql-yoga 5.21.0
- **ORM**: prisma 6.19.0
- **認証 (オプション)**: @auth0/nextjs-auth0 4.16.0
- **状態管理**: Zustand 5.0.9, TanStack Query 5.90.12,
- **フォーム**: React Hook Form 7.68.0, Zod 4.1.13
- **UI**: Tailwind CSS 4.1.17, shadcn/ui
- **HTTPクライアント**: openapi-fetch 0.15.0, graphql-request 7.4.0
- **型定義・パース**: Zod 4.1.13, graphql 16.10.0
- **テスト**: Playwright 1.57.0, Vitest 4.0.15, MSW 2.12.4
- **Linter**: ESLint 9.39.1

### インフラ（Terraform管理）

- **Neon**: PostgreSQLデータベース
- **Backblaze B2**: オブジェクトストレージ（S3互換）
- **Render**: フロントエンド・バックエンド・ワーカーホスティング
- **Terraform Cloud**: インフラ状態管理

## プロジェクト構成

```text
/
├── apps/                   # Next.js
│   ├── web/
│   │   ├── public
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── api/
│   │   │   │   │   ├── todos/
│   │   │   │   │   │   ├── route.ts
│   │   │   │   │   │   ├── [id]/route.ts
│   │   │   │   │   │   ├── stats/route.ts
│   │   │   │   │   │   └── progress-stats/route.ts
│   │   │   │   │   └── graphql/
│   │   │   │   │       └── route.ts    # Yoga サーバー
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── todo/
│   │   │   │   │   │   ├── error.tsx
│   │   │   │   │   │   ├── layout.tsx
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── (guest)/
│   │   │   │   │   ├── login/
│   │   │   │   │   └── register/
│   │   │   │   │
│   │   │   │   ├── global-error.tsx
│   │   │   │   ├── globals.css
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── services/
│   │   │   │   │   └── types/
│   │   │   │   ├── analytics/
│   │   │   │   │   └── services/
│   │   │   │   └── todos/
│   │   │   │       ├── components/
│   │   │   │       ├── hooks/
│   │   │   │       ├── services/
│   │   │   │       ├── schemas/
│   │   │   │       └── types/
│   │   │   │
│   │   │   ├── graphql/
│   │   │   │   ├── schema.ts       # スキーマ統合
│   │   │   │   ├── context.ts      # Auth0 + Prisma
│   │   │   │   └── modules/todos/
│   │   │   │       ├── schema.graphql # SDL定義
│   │   │   │       └── resolvers.ts
│   │   │   ├── components/
│   │   │   │   ├── form/
│   │   │   │   ├── ui/
│   │   │   │   ├── async-boundary.tsx
│   │   │   │   └── navBar.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── use-session-store.ts
│   │   │   │   ├── useExclusiveModal.tsx
│   │   │   │   ├── useSuspenseQuery.ts
│   │   │   │   └── useTanstackQuery.ts
│   │   │   ├── errors/
│   │   │   │   ├── api-error.ts
│   │   │   │   ├── error-boundary.tsx
│   │   │   │   ├── error-handler.ts
│   │   │   │   ├── network-error.ts
│   │   │   │   ├── sentry-logger.ts
│   │   │   │   └── validation-error.ts
│   │   │   ├── lib/
│   │   │   │   ├── auth0.ts
│   │   │   │   ├── background-task.ts
│   │   │   │   ├── constants.tsx
│   │   │   │   ├── prisma.ts
│   │   │   │   ├── qstash.ts
│   │   │   │   ├── ratelimit.ts
│   │   │   │   ├── queryClient.tsx
│   │   │   │   ├── graphql-client.tsx
│   │   │   │   └── utils.ts
│   │   │   ├── instrumentation-client.ts
│   │   │   ├── instrumentation.ts
│   │   │   └── proxy.ts    # middleware
│   │   │
│   │   ├── tests/                 # テスト構成
│   │   │   ├── e2e/               # E2Eテスト（Playwright専用）
│   │   │   ├── unit/              # ユニットテスト（Vitest）
│   │   │   ├── integration/       # 統合テスト（Vitest）
│   │   │   ├── setup/             # セットアップファイル
│   │   │   ├── mocks/             # MSW設定
│   │   │   └── test-utils/        # テストユーティリティ
│   │   │
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   ├── eslint.config.json
│   │   ├── vitest.config.json
│   │   └── playwright.config.json
│   │
│   ├── api/                       # FastAPI
│   │   ├── infrastructure/
│   │   │   ├── db.py
│   │   │   ├── idempotency.py
│   │   │   ├── internal_auth.py
│   │   │   ├── mail_client.py     # メールクライアント設定
│   │   │   ├── vector_client.py   # ベクタークライアント設定
│   │   │   ├── motherduck_client.py
│   │   │   ├── ratelimit.py
│   │   │   ├── redis_client.py
│   │   │   └── security.py        # トークン検証
│   │   ├── routers/
│   │   │   ├── internal.py
│   │   │   ├── search.py
│   │   │   └── webhooks.py        # ルーティング設定
│   │   ├── schemas/
│   │   │   ├── search.py
│   │   │   └── webhook.py
│   │   ├── services/
│   │   │   ├── analytics_webhook_service.py
│   │   │   ├── base_analytics_service.py
│   │   │   ├── base_embedding_service.py
│   │   │   ├── base_vector_service.py
│   │   │   ├── dlt_pipline_service.py
│   │   │   ├── mail_service.py         
│   │   │   ├── maintenance_service.py     
│   │   │   ├── todo_embedding_service.py
│   │   │   ├── todo_vector_service.py
│   │   │   ├── todo_webhook_service.py
│   │   │   └── qstash_service.py
│   │   ├── tests/
│   │   │   ├── integration/
│   │   │   ├── unit/
│   │   │   └── conftest.py
│   │   │
│   │   ├── error_decorators.py
│   │   ├── error_handlers.py
│   │   ├── error_reporting.py
│   │   ├── exceptions.py
│   │   ├── config.py
│   │   ├── Dokerfile
│   │   ├── main.py
│   │   ├── pyproject.toml
│   │   └── uv.lock
│   │
│   └── worker/               # Node.js Worker (Relay)
│       ├── src/
│       │   ├── index.ts      # 起動時スイープ
│       │   ├── worker.ts     # ポーリングロジック
│       │   ├── processor.ts  # QStash/FastAPIへの送信
│       │   ├── db.ts         # Prisma初期化
│       │   └── utils/logger.ts
│       ├── scripts/requeueFailedEvent.ts  # 運用時に手動実行する管理スクリプト
│       ├── config.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── Dockerfile
│
├── packages/               # パッケージ共通
│   └── db/
│       ├── schema.prisma
│       └── migrations/
│
├── .devcontainer/             # Dev Container設定
│   ├── devcontainer.json      # Codespaces/ローカル手動起動型
│   └── devcontainer-compose.json  # ローカルCompose統合型（自動起動）
│
├── terraform/                 # terraform設定
│   ├── modules/               # 共通モジュール（部品）
│   │   ├── neon/
│   │   │   ├── main.tf        # リソース
│   │   │   ├── outputs.tf
│   │   │   └── variables.tf
│   │   ├── render/
│   │   ├── backblaze/
│   │   ├── github/
│   │   ├── upstash/
│   │   └── auth0/
│   └── envs/                  # 環境ごとの定義
│       ├── production/        # 本番環境
│       │   ├── main.tf        # 各moduleを呼び出し、本番用変数を渡す
│       │   ├── outputs.tf
│       │   ├── variables.tf
│       │   ├── locals.tf
│       │   └── provider.tf
│       └── staging/           # ステージング環境
│
├── cicd/
│   ├── actions/               # 再利用可能なカスタムアクション
│   │   ├── setup-node/
│   │   │   └── actions.yml
│   │   └── setup-python/
│   └── workflows/             # CI/CDワークフロー
│
├── docker-compose.yml         # Docker構成
├── .gitignore
├── package.json               # ルートパッケージ設定
└── README.md
```

## バックエンド処理の振り分け

基本的にnext.jsとfastapiは通信はせずqstashを通じてデータ送信を行う

### fastapi

fastapiでは重い処理を担当、基本的にDBはもたない、分析DBを担当する

### next.js

CRUDなど一般的な処理を担当、メインのDBを担当する

### qstash

非同期保存の送受信を担当する

## packages/db による スキーマ・クライアントの共通化

`packages/db` はモノレポ全体で共有するデータベース層のパッケージです。
Prismaスキーマの単一管理と、各アプリへのクライアント共有を担います。

### 構成

```text
packages/db/
├── schema.prisma       # 唯一の真実（Single Source of Truth）
└── migrations/         # マイグレーション履歴
```

### 役割

- **スキーマの一元管理**: `apps/web`・`apps/worker` が同一の `schema.prisma` を参照するため、スキーマの二重管理が発生しない
- **型の共有**: `prisma generate` によって生成された型定義（`@prisma/client`）をモノレポ内の全アプリが参照する
- **マイグレーション管理**: `packages/db/migrations/` でマイグレーションを一元管理し、各アプリが個別に持つ必要がない

### 各アプリからの参照

`apps/web` と `apps/worker` の `package.json` でワークスペース参照を設定します。

```json
{
  "dependencies": {
    "@repo/db": "workspace:*"
  }
}
```

Prismaクライアントの初期化は各アプリ内の `lib/prisma.ts` で行い、接続プーリング設定をアプリごとに調整できます。

```typescript
// apps/web/src/lib/prisma.ts
import { PrismaClient } from "@repo/db";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### マイグレーション運用

```bash
# スキーマ変更後のマイグレーション作成
cd packages/db
npx prisma migrate dev --name <migration_name>

# 本番環境への適用
npx prisma migrate deploy

# 型の再生成（スキーマ変更後に各アプリで実行）
npx prisma generate
```

---

## Outbox パターン

### 概要と目的

Next.js（メインDB）と FastAPI（分析DB）が別々のデータストアを持つ分散システムにおいて、**メインDBへの書き込みと FastAPI への通知を必ずセットで成功させる**ためのパターンです。

2フェーズコミットを使わずにデータ整合性を担保します。

```
[Client]
    │
    ▼
[Next.js Route Handler]
    │
    ├─① Prismaトランザクション（原子的に両方を書く）
    │     ├─ メインテーブル（todos 等）への書き込み
    │     └─ outbox_events テーブルへの書き込み
    │
    └─② トランザクション完了後、Worker が非同期に処理
```

トランザクション内で outbox レコードを同時に書くため、**メインデータが保存されれば通知も必ず残る**という保証が得られます。

### outbox_events スキーマ

```prisma
model outbox_events {
  id              String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  aggregate_id    String       @db.VarChar(128)   // 対象リソースのID（例: todo.id）
  event_type      String       @db.VarChar(64)    // イベント種別（例: "todo.created"）
  event_version   Int          @default(1)         // スキーマバージョン管理用
  payload         Json                             // FastAPI に渡すデータ本体
  status          OutboxStatus @default(pending)   // pending / processing / done / failed
  retry_count     Int          @default(0)
  last_error      String?      @db.Text
  idempotency_key String       @unique             // 重複処理防止キー

  locked_at       DateTime?    @db.Timestamptz    // Worker がロック中の時刻
  next_retry_at   DateTime     @default(now()) @db.Timestamptz
  created_at      DateTime     @default(now()) @db.Timestamptz
  processed_at    DateTime?    @db.Timestamptz

  @@index([status, locked_at, next_retry_at, created_at])
}
```

**ステータス遷移**

```
pending → processing → done
                    ↘ failed（retry_count 上限超過時）
```

### processed_events スキーマ（冪等性チェック用）

```prisma
model processed_events {
  id              Int      @id @default(autoincrement())
  handler_name    String                              // 処理ハンドラの識別子
  idempotency_key String                              // outbox_events と同一キー
  processed_at    DateTime @default(now()) @db.Timestamptz

  @@unique([handler_name, idempotency_key])
  @@index([processed_at])
}
```

FastAPI 側で処理完了時にこのテーブルへレコードを INSERT します。
`@@unique([handler_name, idempotency_key])` の一意制約により、同一イベントの二重処理が防止されます。

### Next.js 側の書き込み例

```typescript
// apps/web/src/features/todos/services/todoService.ts

await prisma.$transaction(async (tx) => {
  // ① メインデータの書き込み
  const todo = await tx.todos.create({ data: { ... } });

  // ② outbox への書き込み（同一トランザクション内）
  await tx.outbox_events.create({
    data: {
      aggregate_id:    todo.id,
      event_type:      "todo.created",
      payload:         { id: todo.id, title: todo.title, userId: todo.userId },
      idempotency_key: `todo.created:${todo.id}`,
    },
  });

  return todo;
});
```

---

## Worker による Outbox 監視

### 役割

`apps/worker` は Node.js プロセスとして常駐し、outbox テーブルをポーリングして未処理イベントを QStash 経由で FastAPI に送信します。

```
[Worker]
    │
    ├─ポーリング: outbox_events（status=pending かつ next_retry_at<=now）
    │
    ├─ロック取得: locked_at を更新し、他 Worker との競合を防ぐ
    │
    ├─QStash へ publish（FastAPI の Webhook エンドポイント宛て）
    │
    └─ステータス更新: done / failed / retry_count++
```

### Worker の構成

```text
apps/worker/
├── src/
│   ├── index.ts       # 起動時スイープ（未処理イベントの一括回収）
│   ├── worker.ts      # ポーリングループ
│   ├── processor.ts   # QStash / FastAPI への送信ロジック
│   ├── db.ts          # Prisma 初期化
│   └── utils/
│       └── logger.ts
├── scripts/
│   └── requeueFailedEvent.ts  # 手動リキュー用管理スクリプト
└── config.ts
```

### ポーリングとロック（worker.ts）

複数 Worker インスタンスが同じレコードを二重処理しないよう、**SELECT → UPDATE でロックを取得**してから処理します。

```typescript
// apps/worker/src/worker.ts（概略）

const LOCK_TIMEOUT_MINUTES = 5;
const POLL_INTERVAL_MS     = 5_000;

async function pollOnce() {
  // ロック期限切れ or 未ロックのイベントを 1 件取得してロック
  const event = await prisma.$transaction(async (tx) => {
    const target = await tx.outbox_events.findFirst({
      where: {
        status: "pending",
        next_retry_at: { lte: new Date() },
        OR: [
          { locked_at: null },
          { locked_at: { lt: new Date(Date.now() - LOCK_TIMEOUT_MINUTES * 60_000) } },
        ],
      },
      orderBy: { created_at: "asc" },
    });
    if (!target) return null;

    return tx.outbox_events.update({
      where: { id: target.id },
      data:  { status: "processing", locked_at: new Date() },
    });
  });

  if (!event) return;
  await processEvent(event);
}

setInterval(pollOnce, POLL_INTERVAL_MS);
```

### QStash への送信（processor.ts）

```typescript
// apps/worker/src/processor.ts（概略）

import { Client } from "@upstash/qstash";

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

export async function processEvent(event: OutboxEvent) {
  try {
    await qstash.publishJSON({
      url:  `${process.env.FASTAPI_PUBLIC_URL}/webhooks/${event.event_type}`,
      body: event.payload,
      headers: { "x-idempotency-key": event.idempotency_key },
    });

    await prisma.outbox_events.update({
      where: { id: event.id },
      data:  { status: "done", processed_at: new Date(), locked_at: null },
    });
  } catch (err) {
    const nextRetry = calcBackoff(event.retry_count);  // 指数バックオフ
    await prisma.outbox_events.update({
      where: { id: event.id },
      data:  {
        status:        event.retry_count >= MAX_RETRIES ? "failed" : "pending",
        retry_count:   { increment: 1 },
        last_error:    String(err),
        locked_at:     null,
        next_retry_at: nextRetry,
      },
    });
  }
}
```

### 起動時スイープ（index.ts）

Worker 再起動時に、前回クラッシュで `processing` のまま残ったレコードを `pending` に戻します。

```typescript
// apps/worker/src/index.ts

await prisma.outbox_events.updateMany({
  where: {
    status:    "processing",
    locked_at: { lt: new Date(Date.now() - LOCK_TIMEOUT_MINUTES * 60_000) },
  },
  data: { status: "pending", locked_at: null },
});
```

### 手動リキュー（運用スクリプト）

`failed` になったイベントを個別または一括で再キューに戻す管理スクリプトです。

```bash
# 特定イベントを再キュー
npx tsx scripts/requeueFailedEvent.ts --id <event_id>

# 全 failed イベントを再キュー
npx tsx scripts/requeueFailedEvent.ts --all
```

### FastAPI 側の冪等性チェック

QStash から Webhook を受け取った FastAPI は `processed_events` を参照し、処理済みであれば 200 を返してスキップします。

```python
# apps/api/infrastructure/idempotency.py（概略）

async def check_and_mark(handler_name: str, idempotency_key: str, db: AsyncSession) -> bool:
    """
    未処理なら processed_events に INSERT して True を返す。
    処理済みなら False を返す（冪等スキップ）。
    """
    try:
        db.add(ProcessedEvent(
            handler_name    = handler_name,
            idempotency_key = idempotency_key,
        ))
        await db.commit()
        return True
    except IntegrityError:
        await db.rollback()
        return False  # @@unique 制約違反 → 処理済み
```

```python
# apps/api/routers/webhooks.py（概略）

@router.post("/webhooks/todo.created")
async def handle_todo_created(payload: TodoCreatedPayload, request: Request, db: AsyncSession = Depends(get_db)):
    idempotency_key = request.headers.get("x-idempotency-key")

    if not await check_and_mark("todo_created_handler", idempotency_key, db):
        return {"status": "skipped"}  # 冪等スキップ

    await todo_embedding_service.embed(payload, db)
    return {"status": "ok"}
```

---

## データフロー全体図

```
[Client]
    │  CRUD操作
    ▼
[Next.js Route Handler]
    │
    ├─ Prisma トランザクション
    │     ├─ todos テーブル書き込み
    │     └─ outbox_events テーブル書き込み（status: pending）
    │
    ▼
[Worker] ポーリング（5秒ごと）
    │  ロック取得 → status: processing
    │
    ▼
[QStash] メッセージキュー
    │  Webhook 配信（リトライ付き）
    │
    ▼
[FastAPI]
    │  冪等性チェック（processed_events）
    │
    ├─ 処理済み → スキップ（200）
    └─ 未処理   → 埋め込み生成 / 分析DB保存 → processed_events に記録

[Worker]
    └─ 完了確認 → status: done
```

## ローカル開発環境のセットアップ

### Docker 環境のセットアップ
 
### 初回起動
 
```bash
docker compose up -d
docker compose exec web npx prisma generate
docker compose exec web npx prisma db push
```

### Prisma のバイナリターゲット設定
 
Docker 環境では `schema.prisma` に `binaryTargets` の追加が必要。
Codespaces（debian-openssl-3.0.x）でビルドしたクライアントが Docker コンテナ内（debian-openssl-1.1.x）で動かないため、両方を指定する。
 
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-1.1.x", "debian-openssl-3.0.x"]
}
```
 
変更後はコンテナ内で再生成が必要。
 
```bash
docker compose exec web npx prisma generate
```

### Codespacesでの注意事項

- FastAPIへのQStash Webhook用に `FASTAPI_PUBLIC_URL` にCodespacesの公開URLを設定する
- 新しいCodespaceを作成した場合はURLが変わるため `.env.local` の更新が必要
- E2EテストはCodespacesドメインではなく `localhost` を使用すること
  \```
  APP_BASE_URL=http://localhost:3000
  DOMAIN_URL=http://localhost:3000
  \```

### Pythonパスの設定
 
FastAPIは `PYTHONPATH=/workspace/apps` を設定し `api.main:app` として起動する。
`uvicorn main:app` では相対インポートが解決できないため注意。
 
```yaml
# docker-compose.yml
services:
  api:
    working_dir: /workspace/apps/api
    environment:
      - PYTHONPATH=/workspace/apps
    command: >
      sh -c "uv run uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir /workspace/apps/api"
```
 
`Dockerfile` の CMD も合わせる。
 
```dockerfile
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 環境変数の使い分け
 
`BACKEND_API_URL`と`FASTAPI_PUBLIC_URL`は役割が異なる。
 
| 変数名 | 値の例 | 用途 |
|---|---|---|
| `BACKEND_API_URL` | `http://api:8000` | Next.js Route Handler → FastAPI（Docker 内部通信） |
| `FASTAPI_PUBLIC_URL` | `https://xxx-8000.app.github.dev` | QStash → FastAPI（外部からの Webhook 配信） |
 
Next.jsのサーバーサイドからFastAPIを直接呼ぶ場合（セマンティック検索等）は `BACKEND_API_URL` を使う。
QStashはUpstashの外部サーバーから配信するためDocker内部アドレスには到達できず、`FASTAPI_PUBLIC_URL` が必要。
 
---

## Next.js API Routeのデータフロー

### 読み取り（GET）

Server Component (page.tsx)
→ prefetchQuery → todoService → Prisma → DB ※サーバー側でprefetch
→ HydrationBoundary でクライアントに渡す
→ Client Component → useTodo フック（キャッシュから即座に表示）

### 書き込み（POST / PATCH / DELETE）

Client Component
→ useTodo フック（楽観的更新）
→ fetch("/api/todos")
→ Route Handler（認証チェック・userIdの解決）
→ todoService（PrismaでDB操作）
→ invalidateQueries でサーバーと同期

### 認証の流れ

すべてのRoute Handlerで:
auth0.getSession() → getUserBySub() → Prisma User.id → todoService に渡す

### 統計・進捗統計

Client Component → useTodoStats / useProgressStats フック
→ fetch("/api/todos/stats") / fetch("/api/todos/progress-stats")
→ Route Handler → todoService → Prisma → DB

## auth0の認証後リダイレクト設定

auth0でログインした後のリダイレクト設定は初期値としては/のルートになっている。
指定したページへのリダイレクトを設定するには幾つかの方法があります。
優先順位に並べると、

1. <a href="/auth/login?returnTo=/dashboard">ログイン</a>のようにクエリパラメータで指定
2. Auth0ClientでsignInReturnToPath: '/dashboard'として初期値を設定
3. onCallbackでcontext.returnToを取得し分岐する

このようになっており、リンクごとにリダイレクト先を変えたい場合はクエリパラメータ、一括指定はsignInReturnToPathという使い分けが好ましい。

このプロジェクトでは `signInReturnToPath` でデフォルトを `/dashboard` に設定している。
ナビゲーションバーのログインリンクに `returnTo` を付けていない場合は常に `/dashboard` へ遷移し、
リンクごとに飛び先を変えたい場合は `?returnTo=/todo` のようにクエリパラメータで上書きできる。
 
---

## auth0のcallbackをe2eのcodespacesで受ける場合

auth0で認証しcallbackをe2eなどをcodespaces上で受け取る場合、githubログイン画面やpublic設定にしていると承認画面になる。
その場合、codespacesの転送アドレスではなくlocalhostにしてauth0のcallback許可もlocalhostに向けると警告・エラーはでなくなる。

---

## e2eテストでのnextのハイドレーション

クライアントコンポーネントの置き方によってはハイドレーションに時間がかかり、表示はされているものの見つからないエラーが多発する。
部分的なクライアントコンポーネントに分離し、適切にサスペンスをすることである程度は防げる

---

## nextjsでのテスト構成

以前のdjango-reactプロジェクトなどはフロントエンドとバックエンドが明確に分かれていたが、nextjsは両方を兼ねているのでmswのようなハンドラーは基本的にそこまで必要性はない。開発用にDBを用意してそれを使用する。

E2E テストで行わないこと：新規登録・アカウント削除。Auth0 のレート制限リスクと管理コストのため、固定のテストアカウントでログイン状態のみを作り出してCRUDをテストする。

django-reactではplaywright-mswを使用していたが、今回はテスト用にローカルもしくはneon/supabaseなどのDBでテストを行っている。

---

## next.jsのキャッシュとtanstackのキャッシュの二重管理

next15以降はnextのサーバー側でデータのキャッシュが行われる。tanstack queryなどキャッシュ機能をもったライブラリを使用すると二重管理となってしまう。この場合、楽観的更新などをtanstackで行ってもnextのキャッシュによって直ぐに戻ってしまったり挙動がおかしくなる。
その場合、route handlerでcookies()やforce-dynamicを使用する事でnextは動的データと認識しキャッシュすることはなくなる。
next.configのstaleTimes dynamic:0なども同様の効果となります。

Route Handler に `export const dynamic = "force-dynamic"` を宣言することでキャッシュを明示的に無効化できる。
`auth0.getSession()` が内部で `cookies()` を呼ぶため暗黙的にも無効化されるが、意図を明示するために宣言することを推奨する。
 
同様にserver actionsも楽観的更新が複雑化することと、フック・サービス層を分離している設計において有効性が殆どない為に使用していません。

---

## エラー構造

基本的にdjango-reactで設計したエラー構造を流用できる

### next.js route handlerでのエラー

- throw すると500になる
- error boundaryはServer ComponentやClient Componentのエラーを拾うものでRoute Handlerには効かない
- Route Handlerは必ず自分でレスポンスを返す責任がある

### sentry実装

バックエンドではdjangoと同様にerror_reportingで一元管理できる。

### next16でのsentry実装

spaとは異なりSSRではフロントエンド側とバックエンド側に設置する必要がある。
error-boundaryをクライアントコンポーネントとしてsentry側に送信することになる。
error.tsを作成している場合はasyncBoundaryコンポーネントと競合しないように注意する

バックエンド側ではsentry-loggerを作成し、ログ送信したい部分に設置する。

フロントエンドでの初期化はinstrumentation-clientで行う

### loadingとsuspence

error-boundaryとsuspenceを統合した共通フックuseSuspenseQueryを使用するため基本的にloading.tsは使用しない

---

## セマンティック検索
 
### 概要
 
ユーザーのクエリをベクトル化し、Upstash Vector で類似 Todo を検索する機能。
検索フォームに 2 文字以上入力すると 300ms の debounce を経てリアルタイムでリストが切り替わる。
 
### データフロー
 
```
ブラウザ（TodoSearchForm・300ms debounce）
  ↓ Zustand（useTodoSearchState）で searchQuery を共有
TodoList がsearchQuery を検知してレンダリングを切り替え
  ↓ useTodoSearch（TanStack Query）
Next.js /api/todos/search（Route Handler）
  ↓ 直接 FastAPI を呼ぶ（QStash 不使用・同期処理）
FastAPI /search/similar-todos
  ↓ Gemini API（クエリをベクトル化）
  ↓ Upstash Vector（類似ベクトル検索）
  ↓ 結果を返す
TodoList が検索結果を類似度スコア順で表示
```
 
QStash を使わない理由は、検索は即座に結果が必要な同期処理であるため。
 
### UI の動作
 
`TodoList` が `searchQuery` の長さで通常モードと検索モードを切り替える。検索モードでは通常の Todo リストの代わりに検索結果を表示し、各アイテムに類似度スコア（% Match）を表示する。検索結果は編集・削除などの操作を無効にし、表示専用となる。
 
`TodoItemContainer` は通常の `Todo`（DB由来）と `SimilarTodoItem`（検索結果）の両方を受け取れるよう型ガードで吸収している。
 
### 内部 API の認証
 
FastAPI の検索エンドポイントは共有シークレット（`X-Internal-Token` ヘッダー）で保護する。
Next.js と FastAPI の両方の `.env` に同じ値を設定する。
 
```bash
# openssl rand -hex 32 で生成
INTERNAL_API_SECRET=xxxxxxxxxxxxxxxx
```
 
QStash 経由の Webhook エンドポイントには QStash 署名検証を使用し、このトークンは使用しない。
 
---

## djangoと異なるポイント

バリデーションはスキーマで行う
urlsではなくroutersを作成しルーティングを行っている
構成にもよるが今回はビュー層はなくしサービス層のみ実装している
構成にもよるが今回はCRUDなどDBはnextで行うため、redisはdlt_pipelineとratelimitで使用している

---

## next16のキャッシュ機能

next.jsには15からキャッシュ機能がありますが、今プロジェクトではtanstack Queryを使用しておりキャッシュもそちらで管理している。二重管理となるのでnext側のキャッシュはforce-dynamicやno-storeとして無効にしている。

同様にserver actionsも楽観的更新が複雑化することと、フック・サービス層を分離している設計において有効性が殆どない為にしようしていません。

---

## openapiの使用について

djangoでdjango-spectacularによる型生成は、今プロジェクトにおけるnext.jsとfastapiの役割分担から考えて必要なく、prismaから型生成を行っている。fastapi自体は自動でswagger生成などの機能が便利では有りますが今回のようなメインDB管理をnext側にある場合は使用しない。

---

## graphqlのハイブリッド構成
djangoで行っていたrest/graphqlのハイブリッド構成は、next側に処理が移ったことも有りgraphql-yogaをサーバーとして使用している。api handlerから、graphql-requestクライアントを通じてgraphql用サービスからDBに接続している。スイッチングするための設計であり、この場合はrest/graphqlのどちらかにした方が効率は良い。graphqlのみにするのであればエンドポイントはapi/graphqlのみで済みます。

### 切り替えスイッチ
 
`features/todos/services/index.ts` にあるフラグで、メソッドごとに REST と GraphQL を切り替え可能。フック層・コンポーネント層はどちらの通信方式を使っているかを意識しない。
 
### データフロー（GraphQL 経路の二度手間）
 
REST 経路と GraphQL 経路では Next.js 内部の通信ホップ数が異なる。
 
```
【REST 経路】
Client Component
  → useTodo（フック）
  → services/index.ts（useGraphQL: false）
  → todoService（Prisma 直接）
  → DB
 
【GraphQL 経路】（二度手間）
Client Component
  → useTodo（フック）
  → services/index.ts（useGraphQL: true）
  → todoServiceGraphQL
  → fetch("/api/todos")  ← ① Next.js の REST Route Handler を経由
  → graphql-request（Cookie 付きヘッダーを付与）
  → POST /api/graphql    ← ② さらに Yoga エンドポイントに内部 HTTP
  → Resolver → Prisma
  → DB
```
 
スイッチングのための設計であり、GraphQL のみに移行した場合は REST Route Handler を経由せず
`/api/graphql` エンドポイントに直接接続する形にするとシンプルになる。
 
### サーバーサイドでのCookie伝播
 
graphql-request はサーバーサイドで実行される際、自動的に Cookie を引き継がない。
`next/headers` から Cookie を取得して明示的にヘッダーに付与する必要がある。
 
---

## QStash署名検証（FastAPI）

Codespacesやリバースプロキシ環境では `request.url` が
`localhost` になるため署名検証が失敗する。
`x-forwarded-host` と `x-forwarded-proto` ヘッダーから
正しいURLを構築して検証すること。

```python
forwarded_proto = request.headers.get("x-forwarded-proto", "https")
forwarded_host = request.headers.get("x-forwarded-host", request.headers.get("host"))
path = request.url.path
actual_url = f"{forwarded_proto}://{forwarded_host}{path}"
 
receiver.verify(
    signature=signature,
    body=decoded_body,
    url=actual_url,
)
```

TS用のコード・ドキュメントでは `isValid` による分岐が書かれているが、Pythonの`receiver.verify()`は成功時に`None`を返し、失敗時に例外を投げる。戻り値のboolチェックをすると常に`False`扱いになるので混同しないこと。

---

## MotherDuckスキーマ設計の注意点

PrismaのIDはcuid（文字列）のため、MotherDuckテーブルの
`user_id` と `todo_id` カラムは `INTEGER` ではなく `VARCHAR` で定義すること。
`INTEGER` にするとDuckDBの型変換エラーが発生する。

---

## Upstash Vectorの設定

無料プランの上限は1536次元。
`gemini-embedding-001` はデフォルト3072次元のため
`output_dimensionality=1536` を明示的に指定すること。

なお`text-embedding-004`は廃止済み。使用しないこと。

---

## ratelimitの設定

バックエンドでレート制限を設定しサーバー負荷を軽減しています。
セマンティック検索に関してはnext router handler側とfastapi側の両方で行っています。

### Next.js 側
 
`@upstash/ratelimit` の sliding window アルゴリズムをユーザー ID 単位で適用している。
用途ごとに limiter を分けて `lib/ratelimit.ts` で管理する。
 
| limiter | 制限 | 対象エンドポイント |
|---|---|---|
| `todoRatelimit` | 30 回 / 分 | Todo CRUD（POST・PATCH・DELETE） |
| `searchRatelimit` | 10 回 / 分 | `/api/todos/search`（Gemini API 呼び出しコスト考慮） |
 
Route Handler では `requireAuth()` の直後に `checkRateLimit()` ヘルパーを呼び出す。
制限超過時は 429 を返し、`X-RateLimit-Limit` / `X-RateLimit-Remaining` / `Retry-After` ヘッダーも付与する。
 
```typescript
const { user, response } = await requireAuth();
if (!user) return response;
 
const rateLimitResponse = await checkRateLimit(todoRatelimit, user.id);
if (rateLimitResponse) return rateLimitResponse;
```
 
### FastAPI 側
 
セマンティック検索エンドポイント（`/search/similar-todos`）に対して同様のレート制限を設けている。
`infrastructure/ratelimit.py` で `search_ratelimit` を定義し、ルーター内の `check_ratelimit()` で呼び出す。
制限超過時は 429 と `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `Retry-After` ヘッダーを返す。
 
Next.js 側でも同じユーザー ID に対してレート制限をかけているが、FastAPI 側でも二重防衛として適用している。
Next.js 側と同一の Upstash Redis インスタンスを共有するためカウンターが統一される。
 
---

## インフラ構成（Terraform）
基本的な構成はdjango-reactから流用できるが、プロジェクト名やアプリ側の修正・変更点を反映させる

### Terraform構成（django-reactからの変更点）

#### モジュール構成

| module | 対応 | 内容 |
|---|---|---|
| `neon` | 流用・改名 | DBそのまま |
| `backblaze` | 流用・改名 | ストレージそのまま |
| `render` | 改修 | web(Next.js) + api(FastAPI) + worker(Background Worker) の3サービス |
| `upstash` | 流用・改名 | Redis/Vector/QStashそのまま。vector次元数を768→1536に修正（無料枠上限・gemini-embedding-001対応） |
| `github` | 改修 | 変数の追加・削除 |
| `auth0` | 新規 | アプリ作成・コールバックURL設定 |
| `cloudflare` | 削除 | Renderに統一（将来的にOpenNext + Cloudflare Workersへの移行を検討） |

### ディレクトリ構造
```text

terraform/
├── modules/
│   ├── neon/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── backblaze/    # 同様
│   ├── render/       # 同様
│   ├── upstash/      # 同様
│   ├── github/       # 同様
│   └── auth0/        # 新規
└── envs/
    ├── staging/
    │   ├── main.tf       # terraform backend + module呼び出し + random_password
    │   ├── providers.tf  # provider設定
    │   ├── locals.tf
    │   ├── variables.tf
    │   └── outputs.tf
    └── production/       # 同様
```

### django-reactからの変数変更
**削除**
- SECRET_KEY（Django用）
- DEBUG（Django用）
- VITE_STORAGE_URL / VITE_BASE_API_URL（Vite/React用）
- cloudflare_account_id

**追加**
- DATABASE_URL（Prisma用、sslmode=require付き）
- AUTH0_SECRET / AUTH0_ISSUER_BASE_URL / AUTH0_CLIENT_ID / AUTH0_CLIENT_SECRET
- INTERNAL_API_SECRET（Next.js ↔ FastAPI セマンティック検索用）
- QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY（FastAPI webhook署名検証用）
- MOTHERDUCK_TOKEN（MotherDuck / DuckDB用）

### locals.tf の変更点

| 項目 | django-react | nextjs-fastapi-app |
|---|---|---|
| `render_app_name` | {project}-backend-{env} | {project}-{env}（-web/-api/-workerをサフィックスで管理） |
| `削除` | cloudflare_pages_name / debug_mode / storage_public_url | — |

### Render 3サービス構成
```text
{project}-{env}-web      # Next.js (Web Service)
{project}-{env}-api      # FastAPI (Web Service)
{project}-{env}-worker   # Node.js Worker (Background Worker)
```

#### apply前の注意事項
**QStash signing keyについて**
qstash_current_signing_key / qstash_next_signing_key はUpstashプロバイダーのschemaによっては取得できない場合がある。その場合はTerraform Cloud Variablesに手動設定する。

**Auth0プロバイダーの認証**
通常のAuth0アプリのClient ID/Secretとは別に、Management API用のクレデンシャルが必要。Terraform Cloud VariablesにEnv Varとして設定する。
```text
AUTH0_DOMAIN        = your-tenant.auth0.com
AUTH0_CLIENT_ID     = (Management API application の Client ID)
AUTH0_CLIENT_SECRET = (Management API application の Client Secret)
```

**storage_public_urlについて**
django-reactではVITE_STORAGE_URLとしてReactフロントに渡していたが、Next.jsではサーバーサイドでファイルアクセスを行うため削除。クライアントコンポーネントからBackblaze URLを直接参照する設計が生じた場合は再追加する。

---

## CI/CD 変更点まとめ

### プロジェクト構成の変更

| 項目 | django-react | nextjs-fastapi-app |
|---|---|---|
| サービス数 | 2（Backend / Frontend） | 3（Web / API / Worker） |
| デプロイ先 | Backend → Render、Frontend → Cloudflare Pages | すべて Render 統一 |
| フロントエンド | Vite/React SPA | Next.js |
| バックエンド | Django | FastAPI |

### ワークフロー一覧

| ファイル | 対応 | 変更内容 |
|---|---|---|
| `web-staging.yml` | 新規 | frontend-staging.yml を Next.js / Render 向けに再設計 |
| `web-production.yml` | 新規 | 同上（production） |
| `api-staging.yml` | 新規 | backend-staging.yml を FastAPI / Render 向けに再設計 |
| `api-production.yml` | 新規 | 同上（production） |
| `worker-staging.yml` | 新規 | Worker サービス用（django-react に相当なし） |
| `worker-production.yml` | 新規 | 同上（production） |
| `reusable-web-test.yml` | 新規 | Next.js テスト用 reusable ワークフロー |
| `reusable-api-test.yml` | 新規 | FastAPI pytest 用 reusable ワークフロー |
| `reusable-worker-test.yml` | 新規 | Worker Vitest 用 reusable ワークフロー |
| `pr-quality-check.yml` | ほぼ流用 | .venv 除外パスのみ修正 |
| `terraform-fmt.yml` | 完全流用 | 変更なし |
| `terraform-plan.yml` | 一部修正 | paths・フィルター・ワークスペース名を修正 |
| `terraform-apply.yml` | 一部修正 | サービス名・URL変数・sequential jobs を修正 |
| `smoke-tests-staging.yml` | 一部修正 | パス・URL変数・ヘルスチェックURLを修正 |
| `smoke-tests-production.yml` | 一部修正 | 同上 |

### 各ワークフローの主な変更点
#### アプリ系（web / api / worker）
**パストリガー**
- backend/** → apps/api/**
- frontend/** → apps/web/**
- packages/db/** 追加（web・worker の両ワークフローをトリガー、Prismaスキーマ変更の影響範囲に合わせるため）
- apps/api/** は FastAPI が Prisma を使わないためトリガーから除外

**テスト方針**
- MSW を使用しない（Next.js はフロントとバックを兼ねるため不要）
- E2E はローカル DB で実行、APP_BASE_URL=http://localhost:3000 固定（CLAUDE.md 準拠）
- 新規登録・アカウント削除は E2E に含めない（Auth0 レート制限リスク回避）
- Worker はテストスイート 1 ファイルのみのため reusable 内で完結

**デプロイ**
- Cloudflare wrangler-action を削除
- Render Deploy Hook（POST /v1/services/:id/deploys）に統一
- 必要な GitHub Variables：RENDER_WEB_SERVICE_ID / RENDER_API_SERVICE_ID / RENDER_WORKER_SERVICE_ID

**カバレッジ閾値**
- staging：60%（strict-mode: false、警告のみ）
- production：80%（strict-mode: true、未達成で CI 失敗）

**FastAPI 固有**
- PYTHONPATH=${{ github.workspace }}/apps を設定（api.main:app の相対インポート解決）
- uv sync --frozen で依存関係インストール

**terraform-plan.yml**
- paths トリガーに packages/db/** を追加
- backend-config フィルターの監視対象を変更
  - requirements.txt → pyproject.toml
  - apps/api/config/settings.py → apps/api/config.py
- PRコメント内のファイル名表記を更新
- ワークスペース名を django-react-staging/production → nextjs-fastapi-staging/production に変更

**terraform-apply.yml**
- environment.url のプロジェクト名をプレースホルダーに変更（Terraform Cloud 組織名に合わせて要修正）
- env_urls の変数名を変更
  - VITE_BASE_API_URL → FASTAPI_PUBLIC_URL
  - FRONTEND_URL → WEB_URL
- parallel matrix を 2 サービス → 3 サービス（Web / API / Worker）に拡張
- sequential jobs を再設計
  - trigger-backend-sequential → trigger-api-sequential
  - trigger-frontend-sequential → trigger-web-sequential
  - trigger-worker-sequential を新規追加（API ヘルスチェック後に Web と Worker を並列起動）
- ヘルスチェックURL を /api/health → /health に変更（FastAPI 慣例）

**smoke-tests-staging/production.yml**
- working-directory を frontend → apps/web に変更
- URL 変数を変更
  - FRONTEND_URL → WEB_URL
  - VITE_BASE_API_URL → FASTAPI_PUBLIC_URL
- ヘルスチェックURL を /api/v1/health/ → /health に変更
- Summary・コメント内のラベルを Frontend / Backend → Web / API に変更

### 環境変数・シークレット対応表

| 変数名 | django-react | nextjs-fastapi | 種別 |
|---|---|---|---|
| `VITE_BASE_API_URL` | ✅ 使用 | ❌ 削除 | vars |
| `FRONTEND_URL` | ✅ 使用 | ❌ 削除 | vars |
| `FASTAPI_PUBLIC_URL` | ❌ なし | ✅ 追加 | vars |
| `WEB_URL` | ❌ なし | ✅ 追加 | vars |
| `RENDER_WEB_SERVICE_ID` | ❌ なし | ✅ 追加 | vars |
| `RENDER_API_SERVICE_ID` | ❌ なし | ✅ 追加 | vars |
| `RENDER_WORKER_SERVICE_ID` | ❌ なし | ✅ 追加 | vars |
| `RENDER_API_KEY` | ❌ なし | ✅ 追加 | secrets |
| `AUTH0_SECRET`他 Auth0 系 | ❌ なし | ✅ 追加 | secrets |
| `INTERNAL_API_SECRET` | ❌ なし | ✅ 追加 | secrets |
| `CLOUDFLARE_API_TOKEN` | ✅ 使用 | ❌ 削除 | secrets |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ 使用 | ❌ 削除 | vars |

---

## 遭遇したAuth0とNext.js 15/16によるバグ

### Rolling Session Race Condition（Issue #2335）

**該当バージョン**: `@auth0/nextjs-auth0` v4.9.0〜v4.16.0（2025年10月時点で未修正）

#### 現象

ログアウトボタンを押してもセッションが残り、リロードするとログイン状態に戻る。
ブラウザのCookieを確認すると `__session` が消えたり復活したりする不安定な挙動。

#### 原因

`auth0.middleware()` を全リクエストに適用している場合、ログアウト処理中に
静的ファイル（フォント・画像等）のリクエストがまだ飛んでいると race condition が発生する。

1. ログアウトボタンを押す
2. `/auth/logout` が `__session` Cookieを削除する
3. **しかし `_next/static` 等のリクエストがまだ in-flight の状態**
4. そのレスポンスで `auth0.middleware()` がセッションを**再生成**してしまう
5. 結果として `__session` Cookieが復活しログイン状態に戻る

#### 誤った対処（効果なし）

- `SameSite` / `Secure` Cookie属性の変更
- `.next` キャッシュの削除
- `Auth0Provider` / `UserProvider` の追加・削除
- `next.config.ts` のキャッシュ設定変更
- SDKのバージョンアップ

#### 解決策（Workaround）

`proxy.ts`（middleware）で `auth0.middleware()` の適用を `/auth/*` パスのみに限定する。

```ts
// proxy.ts
import { auth0 } from "./lib/auth0";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // auth0.middleware() は /auth/* のみに限定する
  // 全リクエストに適用するとログアウト時にrace conditionが発生する
  if (pathname.startsWith("/auth/")) {
    return await auth0.middleware(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
```

#### トレードオフ

Rolling Session（操作のたびにセッションを自動延長する機能）が無効になる。
セッションの有効期限はAuth0ダッシュボードの設定値に固定される。

#### 参考

- [Rolling session race condition #2335](https://github.com/auth0/nextjs-auth0/issues/2335)
