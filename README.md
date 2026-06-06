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
│   │   │   │   └── useApiMutation.ts
│   │   │   ├── errors/
│   │   │   │   ├── api-error.ts
│   │   │   │   ├── error-boundary.tsx
│   │   │   │   ├── error-handler.ts
│   │   │   │   ├── network-error.ts
│   │   │   │   ├── sentry-logger.ts
│   │   │   │   └── validation-error.ts
│   │   │   ├── lib/
│   │   │   │   ├── auth0.ts
│   │   │   │   ├── constants.ts
│   │   │   │   ├── prisma.ts
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
│   │   │   └── todo_webhook_service.py
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
│       ├── scripts/
│       │   ├── requeueFailedEvent.ts  # 運用時に手動実行する管理スクリプト
│       │   └── check-outbox.ts
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

### クライアント共通化と DB 接続情報は別レイヤー

**重要**: `@repo/db` はPrismaクライアントと型の生成を一元管理するが、**DB 接続情報（`DATABASE_URL`）は各アプリの env から個別に読み込む。**

「クライアントを共通化すれば接続情報も共有される」は誤り。PrismaClient はインスタンス生成時に実行環境の `DATABASE_URL` を読みに行く設計のため、各アプリに `DATABASE_URL` の設定が必要。

| アプリ | 必要な env ファイル |
|---|---|
| `apps/web` | `.env.local` に `DATABASE_URL` |
| `apps/worker` | `.env` に `DATABASE_URL` |

**テスト実行時も同様。** Codespaces のターミナルで直接 `npm run test` を実行する場合、Docker の environment は効かないため `dotenv-cli` で明示的に読み込む必要がある。

```json
// apps/worker/package.json
"test": "dotenv -e .env vitest run",
"test:watch": "dotenv -e .env vitest"
```

Docker 経由（`docker compose exec worker npm run test`）で実行する場合は `docker-compose.yml` の `environment` から自動で読み込まれるため不要。

---

## Outbox パターン

### なぜ after()/runAfterResponse() を使わないのか
 
Next.js の `after()` は **background job queue ではなく**、レスポンス返却後に処理を試みるための API。
durable execution（実行保証）は持たず、process crash・deploy切り替え・runtime shutdown で処理が消える可能性がある。
 
**判断基準はホスティングサービスではなく処理の性質。**
 
| 処理の性質 | 採用する仕組み |
|---|---|
| 冪等性・整合性・信頼性が必要 | Outbox + Worker + QStash |
| 消えても影響ない処理（best effort logs・metrics） | `after()` |
 
このプロジェクトでは、vector同期・FastAPI連携・analyticsを**分析基盤の正確性に関わる重要イベント**として扱うため、`after()` ではなく Outbox パターンを採用している。
 
---

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
pending → processing → sent
         ↓
       retrying → processing → sent
         ↓（MAX_RETRIES超過 or PermanentError）
       failed
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

## トランザクション設計と並行性制御

### Ownership Check（所有権確認）

Route Handler では認証済みユーザーのIDをサービス層に渡し、操作対象リソースの所有権をDBレベルで確認する。
これにより他ユーザーのリソースへの不正な更新・削除を防ぐ。

```typescript
// apps/web/src/features/todos/services/todoService.ts

updateTodo: async (data: UpdateTodoInput, userId: string) => {
  // FOR UPDATEによるrow lockで厳密なTOCTOU対策も可能だが、
  // PrismaではFOR UPDATEに$queryRawが必要となり型安全性が失われるため採用しない。
  // ownership checkの競合頻度が低く、トランザクション内の整合性で十分と判断。
  return await prisma.$transaction(async (tx) => {
    // updateManyで1クエリ化も可能だが、更新後のレコードが返らず
    // Outboxイベントのpayload構築に必要な中身が取れないため別クエリにする
    const existing = await tx.todo.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundError("Todo not found or unauthorized");
    }

    const todo = await tx.todo.update({ where: { id }, data: body });
    // ... outbox_events.create
  });
},
```

所有権確認に失敗した場合は `NotFoundError`（`errors/not-found-error.ts`）を throw し、Route Handler 側で 404 レスポンスを返す。
存在有無を秘匿することでセキュリティ上の情報漏洩を防ぐ。

### TOCTOU（Time Of Check To Time Of Use）について

`findFirst`（check）と `update`/`delete`（use）の間に別トランザクションが割り込む理論上の race condition。

**Outboxパターンとの関係**

Outboxパターンを使っている時点で、トランザクション内に必ず複数クエリが存在する。

```
findFirst（ownership check）
↓
update / delete
↓
outbox_events.create
```

これは構造上 TOCTOU を内包しており、`updateMany` で1クエリ化しても Outbox の `create` がある以上、完全には回避できない。

**FOR UPDATE を採用しない理由**

PostgreSQL の `SELECT ... FOR UPDATE` で row lock を取れば TOCTOU をほぼ防げるが、Prisma では `FOR UPDATE` に `$queryRaw` が必要になり型安全性が失われる。このプロジェクトは `any` 型禁止・TypeScript 型を最大限活用する方針のため採用しない。

**実務上の判断**

PostgreSQL のデフォルト分離レベル（`READ COMMITTED`）のトランザクション内では整合性は十分に保たれる。ownership check の競合頻度も低いため、現状の `findFirst → update/delete` で実務上十分と判断している。

### Worker の並行性制御との違い

Worker は複数インスタンスが同じ outbox レコードを二重処理する危険があるため、`FOR UPDATE SKIP LOCKED` による row lock が必要。

| 対象 | 手法 | 理由 |
|---|---|---|
| Todo service | `findFirst` + transaction | 人間操作・低競合・型安全性優先 |
| Outbox Worker | `FOR UPDATE SKIP LOCKED` | 複数 consumer・高頻度・queue semantics |

### idempotency_key の設計

Outbox イベントの `idempotency_key` は deterministic な値を使用する。

```typescript
// 良い例（deterministic）
idempotency_key: `todo.created:${todo.id}`
idempotency_key: `todo.updated:${todo.id}:${todo.updatedAt.getTime()}`
idempotency_key: `todo.deleted:${todo.id}`
idempotency_key: `user.registered:${user.id}`

// 避けるべき例
idempotency_key: crypto.randomUUID()  // 再送・replay時に別イベント扱いになる
```

**deterministic key の用途**

| 用途 | 値 |
|---|---|
| 重複排除（idempotency） | `todo.created:${todo.id}` など deterministic |
| Worker の QStash enqueue 重複防止 | 同上（`Upstash-Idempotency-Key` ヘッダーに使用） |
| FastAPI の二重処理防止 | `processed_events` テーブルとの照合 |
| CI smoke test の識別 | `payload.todo_title` の prefix（idempotency_key とは別責務） |

`randomUUID()` は correlation_id や trace_id には適しているが、「同じ処理か」を判定する idempotency_key には不適切。

### User 登録の初回判定（syncUser）

Auth0 ログイン時のユーザー同期では `upsert` ではなく `create → P2002 catch` パターンを採用する。

```typescript
// apps/web/src/features/auth/services/userService.ts

return await prisma.$transaction(async (tx) => {
  let isNewUser = false;
  let user;

  try {
    user = await tx.user.create({ data: { auth0Id: sub, email, name } });
    isNewUser = true;  // create 成功時のみ true
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      user = await tx.user.update({ where: { auth0Id: sub }, data: { email, name } });
      // isNewUser は false のまま
    } else {
      throw error;
    }
  }

  if (isNewUser) {
    await tx.outbox_events.create({ /* user.registered イベント */ });
  }

  return user;
});
```

**upsert を使わない理由**

`upsert` の結果だけでは「create されたか update されたか」が判定できない。welcome メールのような「初回登録時のみ発火」が必要な Outbox イベントには `create → catch` パターンの方が race condition に強く、意図が明確。

同時アクセス時の race condition 例：

```
Request A → create 成功 → isNewUser = true → outbox 発行
Request B → P2002 → update のみ → outbox 発行しない
```

`upsert` + 事前チェックだと両方が outbox を発行する可能性がある。

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

### Prisma Studio の起動

Prisma Studio でテーブルを確認する場合は以下を使う。
`packages/db/.env` に `DATABASE_URL` を置くと Worker と競合するため、
Worker の `.env` を明示的に渡して起動する。

```bash
# ルートから実行
dotenv -e apps/worker/.env -- npx prisma studio --schema=packages/db/schema.prisma
```

### packages/db/.env の注意点

`packages/db/.env` に `DATABASE_URL` を定義すると
`apps/worker/.env` と競合してWorkerが起動できなくなる。
```text
Error: There is a conflict between env var in .env and ../../packages/db/.env
```
`DATABASE_URL` は `apps/worker/.env` のみで管理し、
`packages/db/.env` には定義しないこと。

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
graphql-yoga をサーバーとして使用した
REST / GraphQL ハイブリッド構成を実装した。

Django + React SPA 時代は、
GraphQL が frontend/backend 間の正式な API 境界として機能しており、

- 型統一
- schema-driven development
- Relay / codegen
- frontend/backend 分離

の恩恵が大きかった。

しかし Next.js App Router では frontend 内に backend が存在するため、
GraphQL が architectural boundary として機能しにくい。

結果として、service 単位での REST / GraphQL 切り替えは
SPA 時代より恩恵が小さいことが分かった。

現在の構成では：

- schema 手書き
- resolver 手書き
- codegen なし
- サーバー内 HTTP 再入（REST → GraphQL → resolver）

など、GraphQL 維持コストの方が目立ちやすい。

一方で layered architecture（UI → hook → service → Prisma）の効果は大きく、
transport layer を service 層へ閉じ込めたことで、
低コストで REST / GraphQL の比較検証が可能だった。

また `features/*/services/index.ts` のスイッチング層に
GraphQL を閉じ込めたことで、撤退可能性も高く保てている。

将来的に GraphQL-only 構成へ移行する場合は、
hook から `/api/graphql` を直接利用する構成にし、
REST Route Handler を経由しない形へ簡略化できる。

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

### GraphQL 単独移行時の対応事項

現在の構成は REST Route Handler を維持した hybrid 構成であり、
GraphQL は内部 transport layer として利用している。

将来的に GraphQL 単独構成へ移行する場合、以下の変更が必要になる。

#### アーキテクチャ変更

- hook から `/api/graphql` に直接接続する形にする
- REST Route Handler (`/api/todos`) を経由しない構成に変更する
- `features/todos/services/index.ts` の REST / GraphQL スイッチング層は不要になる

#### Semantic Search resolver の変更

現在 `searchTodos` resolver は REST endpoint (`/api/todos/search`) を内部 fetch している。
これは hybrid 構成との整合性を優先した実装である。

GraphQL 単独化後は REST endpoint を介さず、
`BACKEND_API_URL` を用いて FastAPI を直接呼び出す構成へ変更する。

#### resolver の thin 化

現在は hybrid 構成のため、

- resolver が union error object を return
- graphql-client が `isErrorResult()` で ApiError に変換

という二重構成になっている。

GraphQL 単独構成へ移行する場合は、

- resolver では `throw GraphQLError`
- client 側で GraphQL error を統一処理

という構成へ寄せる。

### 現在の hybrid 構成における注意点

現在の hybrid 構成では、

```text
hook
 ↓
REST Route Handler
 ↓
todoServiceGraphQL
 ↓
/api/graphql
```

という二重 hop 構成になっている。

そのため `todoServiceGraphQL` が throw した `ApiError` は、
REST Route Handler 側で catch しない限り Next.js により
500 Internal Server Error として処理される。

現状 UI 側では `ApiError` を直接ハンドリングしているため
実害は小さいが、HTTP status semantic（401, 404, 409 等）は失われる点に注意。

必要に応じて、REST Route Handler 側で以下のような
catch と Response 変換を追加することで status を維持できる。

```ts
} catch (error) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { message: error.message },
      { status: error.status }
    );
  }

  throw error;
}
```

#### GraphQLError extensions の注意

`throw GraphQLError()` を使用する場合は、
`extensions.__typename` を必ず設定する。

`graphql-client.ts` の `convertToApiError()` は
`extensions.__typename` を元に HTTP status を決定しているため、
未設定の場合は 500 扱いになる。（Next.js の Route Handler レイヤでは 500 response になる）

```ts
throw new GraphQLError("認証が必要です", {
  extensions: {
    __typename: "AuthenticationError",
    code: "authentication_error",
    category: "AUTHENTICATION",
  },
});
```

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

### QStash Endpoint Timeout

`/webhooks/dlt-pipeline` は dlt による同期処理（数分かかる可能性あり）を
同期実行するため、Upstash QStash ダッシュボード側で
endpoint timeout を 5〜10 分に設定すること。

デフォルト（30秒）のままだと、
QStash が timeout と判断して retry を繰り返し、
pipeline が重複実行される可能性がある。

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

### CI / CD 責務分離（push = CI、Terraform Apply = CD）

django-react では push 時に自動デプロイする構成だったが、nextjs-fastapi-app では CI と CD を明確に分離している。

| トリガー | 役割 | 対象ワークフロー |
|---|---|---|
| push / pull_request | テスト・カバレッジ・E2E のみ | api/web/worker CI |
| terraform apply（手動） | インフラ適用 + デプロイオーケストレーション | terraform-apply.yml |

**push 時に deploy を行わない理由**

push deploy と Terraform Apply deploy の二重経路が存在すると以下の問題が発生する。

- deploy race condition（同一サービスへの二重発火）
- production sequential deploy の順序崩れ
- Terraform 未適用状態での deploy
- Prisma schema mismatch リスク

そのため push は test のみ、deploy は terraform apply からの `repository_dispatch` に一本化している。

**deploy フロー**

```
Terraform Apply（手動実行）
  ↓ インフラ適用
  ↓ repository_dispatch
API CI workflow（deploy-from-terraform job）
  ↓ Render deploy
  ↓ /health/ready チェック
Worker CI workflow（deploy-from-terraform job）
  ↓ Render deploy
  ↓ 60秒 stabilization wait
Web CI workflow（deploy-from-terraform job）
  ↓ Render deploy
```

各 workflow の `deploy-from-terraform` job は以下の3重 guard で不正起動を防いでいる。

```yaml
if: |
  github.event_name == 'repository_dispatch' &&
  github.event.action == 'deploy-api' &&          # event type guard
  github.event.client_payload.environment == 'staging'  # environment guard
```

---

### sequential deploy 順序（API → Worker → Web）

django-react の Terraform Apply では Backend → Frontend の2サービス並列だったが、nextjs-fastapi-app では Outbox パターンを考慮した順序制御を導入している。

**順序**

```
API deploy
  ↓ /health/ready チェック（最大5分）
Worker deploy
  ↓ 60秒 stabilization wait
Web deploy
```

**理由**

このプロジェクトは Outbox パターンにより `Web → API → Outbox → Worker` の依存関係がある。deploy 順序を誤ると以下が発生しうる。

- 新 Web + 旧 Worker → 新 payload format を旧 Worker が deserialize できずに失敗
- 新 Worker + 旧 API → schema mismatch によるイベント処理エラー

API → Worker → Web の順序で deploy することで schema compatibility を保証する。

**production での timeout 挙動**

| 環境 | API health check timeout 時の挙動 |
|---|---|
| staging | `exit 0`（続行を許容） |
| production | `exit 1`（schema compatibility 保証のため中断） |

**Worker の readiness について**

Worker は HTTP サーバーを持たないポーリングプロセスのため、health endpoint による readiness 確認ができない。現状は固定 wait（60秒）で代替しているが、将来的に Worker へ `/health/worker` エンドポイントを実装した場合は readiness check に置き換えることを推奨する。

---

### terraform-plan.yml の追加変更点

django-react からの移行差分に加え、以下の変更を行っている。

**追加修正**

| 変更箇所 | 内容 |
|---|---|
| `worker-config` フィルター追加 | `apps/worker/**` の変更を config-only change として検知 |
| `continue-on-error: true` 削除 | plan 失敗を明示的に CI 失敗として扱う（失敗を見逃さない） |
| `terraform fmt` step 削除 | `terraform-fmt.yml` に責務を集約（plan workflow では validate/plan のみ） |
| sticky PR comment 化 | push・force push・retry でコメントが増殖しないよう既存コメントを上書き更新 |
| `plan.txt` existence check 追加 | plan 失敗時に comment step が壊れないよう existence check を実装 |

**ワークフロー責務の分離**

| ワークフロー | 責務 |
|---|---|
| `terraform-fmt.yml` | フォーマットチェックのみ |
| `terraform-plan.yml` | validate + plan + PR コメント |
| `terraform-apply.yml` | apply + deploy オーケストレーション |

---

### Web E2E の設計変更

**artifact 廃止**

当初 `reusable-web-test.yml` 内でビルドして artifact を upload し、E2E job でダウンロードする設計だったが、GitHub Actions の reusable workflow 間では artifact が共有されないため E2E job 内で直接 `npm run build` を実行する構成に変更した。

```
変更前: reusable-web-test（build + upload） → e2e（download + start）
変更後: reusable-web-test（test のみ）      → e2e（build + start + playwright）
```

これにより `reusable-web-test.yml` の責務が test + coverage のみに絞られ、E2E は独立した責務として完結している。

**E2E の安定化**

| 変更 | 内容 |
|---|---|
| `nohup` 化 | `npm run start &` → `nohup env NODE_ENV=production npm run start > server.log 2>&1 &`（ゾンビプロセス防止・NODE_ENV 明示） |
| `wait-on` 強化 | HTTP ready のみ → tcp:3000 + http://localhost:3000 の2段階チェック（race condition 防止） |
| server log 出力 | failure 時に `cat server.log` を実行して CI デバッグを容易にする |
| deploy timeout | `deploy-from-terraform` job に `timeout-minutes: 5` を設定（Render API hang 対策） |

---

## Outbox チェーン統合 Smoke テスト

### 概要

このプロジェクトの中核は Outbox パターンによる非同期 event-driven アーキテクチャである。
そのため、UI の動作確認だけでは「分散チェーン全体が正しく機能しているか」を保証できない。

```
UI操作（Playwright）
  ↓
Next.js Route Handler → outbox_events 書き込み
  ↓
Worker ポーリング → QStash 送信（status: sent）
  ↓
FastAPI Webhook → BackgroundTasks 処理 → processed_events 書き込み
```

Smoke テストはこのチェーン全体の最終整合性を staging/production 環境で確認する。

### テストの構成

| ファイル | 役割 |
|---|---|
| `apps/web/tests/e2e/todo.auth.spec.ts` | Playwright による UI 操作（`@smoke` タグ付き） |
| `apps/worker/scripts/check-outbox.ts` | Outbox チェーンの整合性確認スクリプト |
| `cicd/workflows/e2e-smoke-test-staging.yml` | staging smoke ワークフロー |
| `cicd/workflows/e2e-smoke-test-production.yml` | production smoke ワークフロー（6時間ごと監視） |

### 実行の流れ

```
① Playwright で @smoke テストを実行（Todo の create / update / delete）
  ↓
② check-outbox.ts が Neon DB に直接接続して以下を確認:
  - outbox_events が全て sent になっているか
  - processed_events に対応するレコードが存在するか（FastAPI 到達確認）
```

Playwright と check-outbox.ts は同一の `SMOKE_PREFIX`（`smoke-<run_id>-`）を共有する。
これにより「今回の smoke test が生成したイベントのみ」を確認対象にできる。

### SMOKE_PREFIX による isolation

`SMOKE_PREFIX` は `smoke-${github.run_id}-` 形式で、ワークフロー実行単位で生成される。

- Playwright 側：Todo タイトルをこの prefix で始める（例: `smoke-123456-test-todo-1748000000000`）
- check-outbox.ts 側：`payload.todo_title` が prefix で始まるイベントのみを対象にする

これにより他ユーザーの操作・cron・前回実行の残骸・並行実行との衝突を防ぐ。

### check-outbox.ts の確認内容

**① outbox_events チェック（即 fail）**

直近 5 分以内に作成された `todo.*` イベントのうち、以下が存在すれば即 fail:

- `failed` が残っている（QStash 送信が MaxRetry を超えた）
- `pending` が残っている（Worker がまだ取得していない）
- `retrying` が残っている（リトライ中）
- `processing` かつ `locked_at = null`（Worker クラッシュによる整合性異常）
- `processing` かつ `locked_at` が閾値以上経過（Worker hang / deadlock）

**② processed_events polling チェック**

`sent` になった `outbox_events` の `idempotency_key` が `processed_events` に存在するかを polling で確認する。
FastAPI は `BackgroundTasks` で非同期処理するため即時確認では flaky になる。
polling 間隔 5 秒・最大 60 秒（staging）/ 90 秒（production）待機する。

### todoService.ts の delete payload 設計

`todo.deleted` イベントの payload には `todo_title` を含める。

```typescript
payload: {
  todo_id: todo.id,
  todo_title: todo.todo_title, // 削除後はDBから参照不可のためpayloadに含める
  user_id: userId,
}
```

削除後は DB からレコードが参照できないため、event payload に情報を積んでおくのが
event-driven 設計の原則である。これにより audit log・DLQ 調査・observability が向上する。
また `check-outbox.ts` の `payload.todo_title` フィルターが create / update / delete
全イベントに対して統一して機能する。

### 環境変数

| 変数名 | 説明 | デフォルト |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL 接続文字列 | — |
| `SMOKE_PREFIX` | smoke テスト識別 prefix | `smoke-` |
| `CHECK_WINDOW_MINUTES` | 確認対象の時間幅（分） | `5` |
| `POLLING_INTERVAL_MS` | polling 間隔（ms） | `5000` |
| `POLLING_TIMEOUT_MS` | polling タイムアウト（ms） | `60000`（staging）/ `90000`（production） |
| `STALE_PROCESSING_MS` | processing を異常とみなす経過時間（ms） | `60000`（staging）/ `120000`（production） |

### ローカルで手動実行する場合

```bash
# apps/worker ディレクトリから実行
cd apps/worker
DATABASE_URL=<your-neon-url> npx tsx scripts/check-outbox.ts
```

staging/production の Neon DB に接続するため、事前に Playwright で Todo を作成してから実行すること。
イベントが 0 件の場合は fail になる（smoke テストが実行されていないと判断するため）。

### 注意事項

- `check-outbox.ts` は `payload.todo_title` で絞り込むため、`todoService.ts` の
  create / update / delete 全イベントの payload に `todo_title` が含まれている必要がある
- `SMOKE_PREFIX` は Playwright（`todo.auth.spec.ts`）と check-outbox.ts の両方に同じ値を渡すこと
- production smoke は 6 時間ごとの schedule 実行のため、`concurrency: cancel-in-progress: false` で
  進行中の監視を途中キャンセルしない設定にしている

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

---

## Reliability / Operational Resilience（信頼性・障害耐性）

このプロジェクトは Outbox + Worker + QStash + FastAPI による分散アーキテクチャを採用している。
「設計が正しい」だけでなく「壊れても戻せる」ことを重視し、以下の信頼性戦略を実装・検証済みである。

### 設計方針

| 関心事 | 対策 |
|---|---|
| メッセージ消失 | Outbox パターン（DB commit と同一トランザクション） |
| 二重処理 | idempotency_key + processed_events による冪等性保証 |
| 障害追跡 | correlation_id による分散トレース |
| Worker 停止 | 起動時スイープ + 指数バックオフリトライ |
| Vector 破損 | 全件再構築スクリプト |
| 手動回復 | failed イベントの requeue スクリプト |

### 検証済み事項

以下は実際に障害を発生させて動作を確認済み。

**Worker停止 → 再起動後のreplay**
Worker停止中に蓄積されたoutbox_eventsが、再起動後に全件正常処理されることを確認。

**duplicate webhook の冪等性**
同一 `idempotency_key` で2回Webhookを送信した場合、`processed_events` への記録が1件のみであることを確認。

**failedイベントの手動requeue**
`requeueFailedEvent.ts` により failed → pending に戻し、正常処理されることを確認。

**Upstash Vector 全件再構築**
`rebuildVectorIndex.ts` により PostgreSQL から全件再構築できることを確認。

### 運用スクリプト

```bash
# failed イベントを全件 requeue
docker compose exec worker npx tsx scripts/requeueFailedEvent.ts --all

# 特定イベントを requeue
docker compose exec worker npx tsx scripts/requeueFailedEvent.ts <event_id>

# Vector インデックス全件再構築（全ユーザー）
docker compose exec worker npx tsx scripts/rebuildVectorIndex.ts

# Vector インデックス再構築（特定ユーザー）
docker compose exec worker npx tsx scripts/rebuildVectorIndex.ts <userId>
```

詳細な演習手順は `docs/runbook.md` を参照。
- [docs/runbook.md](docs/runbook.md)

### correlation_id による分散トレース

Outbox payload に `correlation_id` を含め、Worker・FastAPI・Sentry に伝播させることで
非同期境界を跨いだ障害追跡を可能にしている。

```
Route Handler（correlation_id発行）
↓ outbox payload に保存
Worker（Sentryタグに追加）
↓ QStash経由
FastAPI（Sentryタグに追加）
↓
Sentry で correlation_id 検索 → 全チェーンを追跡可能
```

## Structured Logging（structlog）

### 設計方針

FastAPI側のログはstructlogで構造化する。Workerはlogger.tsでJSON形式に統一済み。

| サービス | ログ実装 | フォーマット |
|---|---|---|
| FastAPI | structlog | JSON（本番）/ Console（開発） |
| Worker | logger.ts | JSON（常時） |
| Web | Sentry中心 | Sentry経由 |

### ログの基本形

```json
{
  "level": "info",
  "event": "webhook_started",
  "service": "api",
  "component": "todo-webhook",
  "correlation_id": "...",
  "timestamp": "2026-01-01T00:00:00Z"
}
```

### イベント名の命名規則

固定のsnake_caseイベント名 + fieldsの形式を使う。f文字列でメッセージを作らない。

```python
# 良い例
logger.info("webhook_started", webhook="todo.created", client_host="...")
logger.error("webhook_failed", webhook="todo.created")

# 悪い例（f文字列）
logger.info(f"Webhook START: {webhook_name}")
```

### correlation_idの伝播

middlewareでリクエストごとにbindし、BackgroundTask内では再bindする。

```python
# middleware（自動）
bind_contextvars(service="api", correlation_id=correlation_id, ...)

# BackgroundTask内（手動再bind）
bind_contextvars(correlation_id=correlation_id, component="todo-webhook")
```

### Phase管理

| Phase | 内容 | 状態 |
|---|---|---|
| Phase 1 | middleware・decorator・handler・reporting のstructlog化 | 完了 |
| Phase 2 | service層・infrastructure層のstructlog化 | 完了 |
| Phase 3 | uvicorn access log JSON化 | 未着手 |

全コードで`structlog.get_logger(__name__)`を使用する。`logging.getLogger`は新規コードに使用しない。

---

## エラー設計（BaseAppError 4層管理）

### 情報の4層

| フィールド | 用途 | 送信先 |
|---|---|---|
| `message` | ユーザー向けメッセージ | フロントエンド表示 |
| `data` | 修正可能な開発ヒント | フロントエンド表示 |
| `safe_context` | Sentry送信可能な内部情報 | Sentryのみ |
| `internal_info` | 完全内部情報 | ローカルログのみ |

### safe_contextの使い方

```python
raise ExternalServiceError(
    service_name="resend",
    internal_details="...",
    safe_context={"provider": "resend", "status_code": 429},
)
```

**`safe_context`に含めてはいけないもの**: APIトークン・SQLクエリ・JWT・メールアドレス・リクエストボディ

### ログレベルの分類

```python
# 4xx → warning、5xx → error
log_method = logger.error if exc.status_code >= 500 else logger.warning
```

---

## observability設計

### Sentryタグの統一

| タグ | 値の例 | 用途 |
|---|---|---|
| `service` | `api` / `worker` / `web` | サービス識別 |
| component | TodoWebhookService / VectorSearchService / webhook / outbox-worker | コンポーネント識別 |
| `correlation_id` | UUID | 分散トレース（contextに入れる） |
| `event_type` | `todo.created` | Workerのイベント種別 |

**注意**: `correlation_id`はSentryのtagsではなくcontextに入れる。UUIDはcardinalityが高くtagsに不向き。

### correlation_idによる横断追跡
Next.js（correlation_id発行）
↓ outbox payloadに保存
Worker（Sentryタグに追加・ログにbind）
↓ QStash経由
FastAPI middleware（ヘッダーから取得・contextvarsにbind）
↓
全サービスのログをcorrelation_idで横断検索可能

### ログに含めてはいけないもの

- `str(request.url)` → `request.scope.get("path")` を使う
- `internal_info` の生値 → Sentryにも送らない。`has_internal_info: bool` のみ
- APIトークン・JWT・パスワード・メールアドレス・リクエストボディ
- embedding対象テキスト・検索クエリ（PII混入率が高い）→ `text_length=len(text)` のみ記録

### メールアドレスの折衷案（障害調査と個人情報保護のバランス）
email_domain=email.split("@")[-1]  # ドメインのみ記録（個人を特定しない）

### API Sentryタグの自動付与

`ErrorMonitor.log_error()` は `service=api` を自動付与する（`setdefault` による）。
呼び出し側は `component` のみ設定すればよい。

- `service_error_handler` 経由: `component=クラス名`（例: `TodoWebhookService`）
- `log_webhook_call` 経由: `component=webhook`

## 監視ポリシー（Monitoring Policy）

### 監視の分類

このプロジェクトの監視は3つに分離して管理する。

| 分類 | 対象 | 手段 |
|---|---|---|
| Sentry監視 | structlogイベント（アプリ層） | Sentry Alert Rule |
| DB監視 | outbox_eventsステータス | monitor-outbox.ts（定期実行） |
| Smoke Test | チェーン全体の疎通確認 | check-outbox.ts（CI/CD） |

### Sentry Alert Rule

| Severity | イベント名 | 条件 |
|---|---|---|
| Warning | `embedding_failed` | 5件以上 / 5分 |
| Warning | `vector_upsert_failed` | 5件以上 / 5分 |
| Warning | `motherduck_insert_failed` | 5件以上 / 5分 |
| Warning | `dlt_pipeline_failed` | 連続2回失敗 |
| Warning | `unsupported_event_type`  | 1件以上     | Sentry Alert |

通知先：Slack（staging: `#dev-alerts` / production: `#prod-alerts`）

### DB監視（Outbox）

| Severity | 対象 | 条件 | 実装 |
|---|---|---|---|
| Critical | `outbox_events.status = failed` | 5件以上 / 5分 | monitor-outbox.ts |
| Warning | processing滞留 | `status=processing` かつ60秒超が5件以上 | monitor-outbox.ts |
| Warning | retrying増加 | `status=retrying` が10件以上 | monitor-outbox.ts |
| Warning | retrying滞留 | 同一イベントが15分以上 `status=retrying` 継続 | monitor-outbox.ts |

監視スクリプト（未実装・今後追加予定）：

```bash
# Workerプロセス内で5分ごとに定期実行
# Sentry Cron Monitorで監視ジョブ自体の死活を二重監視
npx tsx scripts/monitor-outbox.ts
```

### Smoke Test（check-outbox.ts）

CI/CDパイプラインのsmoke test専用。全ユーザーイベントではなく
`SMOKE_PREFIX`で識別されたテスト用イベントのみを確認対象とする。
運用監視とは責務が異なるため混在させない。

### staging / production の差分

| 項目 | staging | production |
|---|---|---|
| Warning閾値 | 10分で10件 | 5分で5件 |
| Critical閾値 | 10分で5件 | 5分で5件 |
| 通知先 | `#dev-alerts` | `#prod-alerts` |

### 運用スクリプト

```bash
# failed イベントを全件 requeue
docker compose exec worker npx tsx scripts/requeueFailedEvent.ts --all

# 特定イベントを requeue
docker compose exec worker npx tsx scripts/requeueFailedEvent.ts <event_id>

# Vector インデックス全件再構築（全ユーザー）
docker compose exec worker npx tsx scripts/rebuildVectorIndex.ts

# Vector インデックス再構築（特定ユーザー）
docker compose exec worker npx tsx scripts/rebuildVectorIndex.ts <userId>

# monitor-outbox 異常系テスト（開発環境のみ）
docker compose exec worker npx tsx scripts/testMonitorFailed.ts
docker compose exec worker npx tsx scripts/testMonitorRetrying.ts
docker compose exec worker npx tsx scripts/testMonitorStaleRetrying.ts

# テストデータ削除
docker compose exec worker npx tsx scripts/cleanupMonitorTestEvents.ts
```

### Sentry Cron Monitor

monitor-outbox-job は Worker 起動時に自動作成される。
Sentry ダッシュボード → Crons で確認可能。

| 項目 | 値 |
|---|---|
| Monitor slug | `monitor-outbox-job` |
| Schedule | Every 5 minutes |
| Check-in margin | 2 minutes |
| Max runtime | 2 minutes |

Workerコンテナが停止すると Check-in が途絶え Slack通知が飛ぶ（二重監視）。

### monitor-outbox テスト時の注意

- `testMonitor*.ts` は開発環境専用
- `event_type = "monitor.test"` のテストレコードを作成する
- テスト後は必ず `cleanupMonitorTestEvents.ts` を実行すること
- `testMonitorStaleRetrying.ts` は `updated_at` を過去時刻でINSERTして stale retrying を再現する

## ⚠️ Sentry Alert Rule 管理方針（設計判断 / ADR）

本プロジェクトでは、Sentry の Project・DSN・Team などの「インフラ基盤」のみを Terraform でコード管理し、Issue Alert や Slack 通知ルールなどの「アラート運用設定」は **Sentry UI（管理画面）で直接管理する方針**を採用しています。

### 1. 責任の切り分け（Terraform vs UI）

| 管理レイヤー | 管理対象リソース | 変更頻度と性質 |
| :--- | :--- | :--- |
| **Terraform 管理** | ・Sentry Organization<br>・Sentry Team<br>・Sentry Project<br>・Sentry DSN (`sentry_key`) の環境変数連携 | **極めて低い**<br>認証や疎通の土台であり、Infrastructure as Code (IaC) の恩恵が大きいもの。 |
| **Sentry UI 管理** | ・Issue Alert (アラートルール)<br>・Slack 通知設定<br>・Alert Threshold (検知閾値)<br>・Alert Routing / Frequency | **中〜高**<br>システムのノイズ量や運用ポリシーに応じて、現場で柔軟に微調整すべきもの。 |

---

### 2. この方針を採用した理由（Architecture Decision）

#### ① Provider の過渡期による保守コストの回避
現在、`terraform-provider-sentry` において、従来の `sentry_issue_alert` リソースが **Deprecated（非推奨）** となり、その後継となる `sentry_alert` リソースが **Beta（ベータ版）** という、大規模なアーキテクチャの移行過渡期にあります。
現段階でアラートルールを無理に Terraform 管理に組み込むと、Provider 更新時の仕様変更に振り回され、不要なリファクタリングや CI/CD の停止リスクが生じます。現在のルール規模であれば、UI で管理する方が圧倒的に安全で保守コストが低くなります。

#### ② 運用調整の柔軟性確保
アラートの閾値や通知先チャンネルは、実際のシステム運用開始後に頻繁なチューニング（オオカミ少年化の防止など）が発生します。これらを設定変更するたびに、インフラコードの修正・Pull Request・レビュー・`terraform apply` を経由させるのは運用の硬直化を招きます。Sentry UI から即座に変更できる方が運用効率が高くなります。

#### ③ アラートは「運用ポリシー」であり「インフラ」ではない
Sentry の「プロジェクトが存在すること」はインフラ（土台）ですが、「どのエラーを、どの頻度で、誰に通知するか」はアプリケーションの運用ポリシー（設定）です。これらを明確に分離することで、インフラコードの肥大化と汚染を防ぎます。
また、現在のアラートルール数（数個規模）では、Terraform管理による恩恵よりも運用コストの方が大きい。

---

### 3. Sentry UI での設定手順（概要）

各プロジェクトの **Alerts** > `Create Alert` > `Issue Alert` から手動で設定を行います。

- **フィルター（Filter）条件の指定**:
  アプリケーション（structlog）側から出力されるカスタムタグ `event_type` を利用して条件を指定します。
  * 設定例： `The issue's tags.event_type equals [対象のイベント名]`
- **アクション（Action）および環境ごとの差分（閾値・通知先チャンネル）**:
  検知対象となる具体的なイベント名、環境（staging / production）ごとの具体的な閾値、および通知先 Slack チャンネル等の詳細な運用マッピングについては、**後述の「監視ポリシー」セクションを参照してください。**（運用の変更時はそちらのみを更新してください）

---

### 4. 将来の見直し条件

本管理方針は、以下の条件が満たされた段階で **Terraform 管理への移行を再検討** します。
1. `terraform-provider-sentry` の新しいアラート系リソース（`sentry_alert` 等）が正式リリース（GA）され、スキーマ仕様が完全に安定したとき。
2. アプリケーションの成長に伴い、管理すべきアラートルールが大幅に増加し、UI 管理による保守が限界を迎えたとき。

---

### 環境変数の一覧と依存リソース

各アプリケーション配下にある `.env.example` を参考に、実際の `.env` ファイルを作成してください。
※重要: `packages/db/.env` は定義しないでください（apps/worker の設定と競合するため）。

#### 1. apps/api (FastAPI)
主に分析DB（MotherDuck）、ベクトル検索（Upstash Vector / Gemini）、QStash 署名検証、および外部連携に使用します。

| 変数名 | 必須/任意 | 用途・依存サービス | 備考 / 設定値の例 |
| :--- | :--- | :--- | :--- |
| `SECRET_KEY` | 必須 | FastAPI 内部セキュリティ用 | 任意のランダム文字列 |
| `DATABASE_URL` | 必須 | メインDB (Neon/PostgreSQL) 接続用 | 読み取り・冪等性チェック等で使用 |
| `PIPELINE_DATABASE_URL` | 必須 | dlt パイプライン用 DB 接続文字列 | 通常は `DATABASE_URL` と同一 |
| `QSTASH_URL` / `TOKEN` | 必須 | 非同期処理 (Upstash QStash) | Webhook 配信元検証用 |
| `QSTASH_CURRENT_SIGNING_KEY` / `NEXT_SIGNING_KEY` | 必須 | QStash 署名検証用キー | 受信した Webhook の正当性検証に必須 |
| `UPSTASH_VECTOR_REST_URL` / `TOKEN` | 必須 | セマンティック検索 (Upstash Vector) | ベクトルインデックスの操作用 |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | 必須 | レートリミット / dlt ロック用 (Upstash Redis) | 分散ロック・Ratelimit で使用 |
| `GEMINI_API_KEY` | 必須 | 埋め込み生成 (Google Gemini API) | `gemini-embedding-001` で使用 |
| `RESEND_API_KEY` | 必須 | メール送信 (Resend) | ユーザー登録時等の通知用 |
| `MOTHERDUCK_TOKEN` | 必須 | 分析データウェアハウス (MotherDuck) | DuckDB への接続認証 |
| `DLT_DATASET_NAME` / `DLT_PIPELINE_NAME` | 必須 | dlt パイプライン設定 | 同期データの格納先・識別用 |
| `DLT_LOCK_KEY` / `DLT_LOCK_TIMEOUT` | 任意 | dlt 実行時の並行性制御ロック | デフォルト値は `.env.example` 参照 |
| `INTERNAL_API_SECRET` | 必須 | Next.js からの同期通信認証トークン | `openssl rand -hex 32` で生成（apps/web と一致させる） |
| `SENTRY_DSN` | 任意 | エラー監視 (Sentry) | ローカル開発時は空でも可 |

#### 2. apps/web (Next.js)
主にユーザー認証（Auth0）、Prisma経由のアプリケーションAPI、レートリミット、およびフロントエンドのエラー監視に使用します。

| 変数名 | 必須/任意 | 用途・依存サービス | 備考 / 設定値の例 |
| :--- | :--- | :--- | :--- |
| `APP_BASE_URL` | 必須 | Web アプリケーションのベース URL | ローカル開発およびPlaywright E2Eでは`http://localhost:3000` を使用する。 |
| `BACKEND_API_URL` | 必須 | Docker 内部の FastAPI への通信用 | ローカル: `http://api:8000` |
| `AUTH0_DOMAIN` / `CLIENT_ID` / `CLIENT_SECRET` | 必須 | ユーザー認証 (@auth0/nextjs-auth0) | Auth0 ダッシュボードから取得 |
| `AUTH0_ISSUER_BASE_URL` / `AUTH0_SECRET` | 必須 | Auth0 セッション暗号化など | `AUTH0_SECRET` は `openssl rand -hex 32` |
| `AUTH0_COOKIE_SAME_SITE` / `SECURE` | 必須 | クッキーのセキュリティ設定 | ローカル: `lax` / `false` |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | 必須 | レートリミット (Upstash Ratelimit) | Route Handler での制限用 |
| `INTERNAL_API_SECRET` | 必須 | 内部API認証用共有シークレット | `openssl rand -hex 32` で生成（apps/api と一致させる） |
| `E2E_TEST_EMAIL` / `PASSWORD` | 任意 | Playwright E2E テスト用固定アカウント | Auth0 レート制限回避のため必須 |
| `SENTRY_DSN` / `ORG` / `PROJECT` | 任意 | フロント/バックエンドのエラー監視 | ローカル開発時は空でも可 |

#### 3. apps/worker (Node.js Worker)
Outbox テーブルを監視し、QStash 経由で FastAPI にイベントを中継します。

| 変数名 | 必須/任意 | 用途・依存サービス | 備考 / 設定値の例 |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | 必須 | メインDB (Neon/PostgreSQL) 接続用 | Prisma クライアントが使用（※必須） |
| `FASTAPI_PUBLIC_URL` | 必須 | QStash から FastAPI へ送信する際のURL | Codespaces時は転送URL、`APP_BASE_URL` には使用しない。本番はパブリックURL、ローカルのlocalhostは使用不可 |
| `QSTASH_URL` / `TOKEN` | 必須 | 非同期メッセージング (Upstash QStash) | Worker からのイベント Enqueue 用 |
| `SENTRY_DSN` | 任意 | Worker のエラー監視 (Sentry) | ローカル開発時は空でも可 |

### Environment Variable Source of Truth

| 環境 | 値の供給元 |
|--------|-----------|
| Local | .env |
| Docker Compose | .env |
| GitHub Actions | GitHub Secrets / Variables |
| Render | Terraform が注入 |

### Local Development

開発時は Docker Compose を使用する。

APP_BASE_URL=http://localhost:3000

を使用する。

Codespaces の転送 URL は
FASTAPI_PUBLIC_URL 用であり、
APP_BASE_URL には使用しない。