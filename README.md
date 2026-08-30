# Next.js-FastAPI-APP

Next.js/FastAPI モノレポベースのWebアプリケーション

## 概要

拡張性と保守性を重視したフルスタックWebアプリケーションです。TypeScriptを採用し、レイヤードアーキテクチャによる明確な責務分離を実現しています。

このプロジェクトはdjango-react-appをベースにして開発されています。基本構造などはそちらをご覧下さい。

## Issue / PR / Commit管理

新機能・拡張および既存の残課題の対応は、GitHub Issueをベースに進める。

Issueの完了記録は `doc/issue-summary.md` を参照。
Issue・PR・Commitの役割分担およびSquash mergeの運用は
`doc/development-workflow.md` を参照。

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
│   │   │   │   │   ├── albums/
│   │   │   │   │   ├── images/
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
│   │   │   │   ├── images/                         # 複雑なドメインの構成例
│   │   │   │   │   ├── components/
│   │   │   │   │   ├── hooks/
│   │   │   │   │   ├── lib/
│   │   │   │   │   ├── schemas/
│   │   │   │   │   ├── services/
│   │   │   │   │   │   ├── imageService.ts         # REST実装
│   │   │   │   │   │   ├── imageServiceGraphQL.ts  # GraphQL実装
│   │   │   │   │   │   ├── imageUploadService.ts   # Presigned URL/B2 upload
│   │   │   │   │   │   ├── internal/               # 外部公開しない内部処理
│   │   │   │   │   │   │   ├── createImage.ts
│   │   │   │   │   │   │   ├── deleteImage.ts
│   │   │   │   │   │   │   ├── storageCleanup.ts
│   │   │   │   │   │   │   └── storageCleanupTask.ts
│   │   │   │   │   │   └── index.ts                # REST/GraphQL switch layer
│   │   │   │   │   └── types/
│   │   │   │   ├── todos/                          # 同じfeature構成
│   │   │   │   │   ├── components/
│   │   │   │   │   ├── hooks/
│   │   │   │   │   ├── lib/
│   │   │   │   │   │   ├── queryKeys.ts
│   │   │   │   │   │   └── todoImageMapper.ts      # 公開DTO変換（storageKey等を除外）
│   │   │   │   │   ├── services/
│   │   │   │   │   │   ├── todoService.ts          # REST実装
│   │   │   │   │   │   ├── todoServiceGraphQL.ts   # GraphQL実装
│   │   │   │   │   │   └── index.ts                # switch layer
│   │   │   │   │   ├── schemas/
│   │   │   │   │   └── types/
│   │   │   │   ├── albums/                         # 同じfeature構成
│   │   │   │
│   │   │   ├── graphql/
│   │   │   │   ├── schema.ts       # スキーマ統合
│   │   │   │   ├── context.ts      # Auth0 + Prisma
│   │   │   │   └── modules/
│   │   │   │       ├── albums/       # todos同一パターン
│   │   │   │       ├── images/       # todos同一パターン
│   │   │   │       └── todos/
│   │   │   │            ├── fragments.ts
│   │   │   │            ├── mutations.ts
│   │   │   │            ├── queries.ts
│   │   │   │            ├── schema.graphql # SDL定義
│   │   │   │            └── resolvers.ts
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
│   │   │   │   ├── validation-error.ts
│   │   │   │   └── ...
│   │   │   ├── lib/
│   │   │   │   ├── auth0.ts
│   │   │   │   ├── constants.ts
│   │   │   │   ├── prisma.ts
│   │   │   │   ├── ratelimit.ts
│   │   │   │   ├── queryClient.tsx
│   │   │   │   ├── graphql-client.tsx
│   │   │   │   ├── utils.ts
│   │   │   │   └── ...
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
│   └── worker/               # Node.js Worker
│       ├── src/
│       │   ├── index.ts      # 起動時スイープ
│       │   ├── worker.ts     # ポーリングロジック
│       │   ├── processor.ts  # QStash/FastAPIへの送信
│       │   ├── recovery.ts   # stale event recovery
│       │   ├── db.ts         # Prisma初期化
│       │   ├── monitor*.ts        # Outbox / QStash monitoring
│       │   ├── storageCleanup*.ts # Storage cleanup
│       │   ├── utils/logger.ts
│       │   └── ...
│       ├── scripts/                   # 運用・復旧・検証用スクリプト
│       │   ├── requeueFailedEvent.ts  # 運用時に手動実行する管理スクリプト
│       │   ├── check-outbox.ts
│       │   └── ...
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
│   │   ├── auth0/
│   │   └── ...
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
cd worker
npx prisma migrate dev --name <migration_name>
# composeから作成
npx dotenv -e apps/worker/.env -- npx prisma migrate dev --name add_image --schema=../../packages/db/schema.prisma

# 本番環境への適用
npx prisma migrate deploy

# 型の再生成（スキーマ変更後に各アプリで実行）
npx prisma generate
# composeから生成
npx dotenv -e apps/worker/.env -- npx prisma generate --schema=../../packages/db/schema.prisma
# compose webから生成する場合
docker compose exec web npm run generate --workspace=@repo/db
```

### クライアント共通化と DB 接続情報は別レイヤー

**重要**: `@repo/db` はPrismaクライアントと型の生成を一元管理するが、**DB 接続情報（`DATABASE_URL`）は各アプリの env から個別に読み込む。**

「クライアントを共通化すれば接続情報も共有される」は誤り。PrismaClient はインスタンス生成時に実行環境の `DATABASE_URL` を読みに行く設計のため、各アプリに `DATABASE_URL` の設定が必要。

| アプリ        | 必要な env ファイル            |
| ------------- | ------------------------------ |
| `apps/web`    | `.env.local` に `DATABASE_URL` |
| `apps/worker` | `.env` に `DATABASE_URL`       |

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

| 処理の性質                                        | 採用する仕組み           |
| ------------------------------------------------- | ------------------------ |
| 冪等性・整合性・信頼性が必要                      | Outbox + Worker + QStash |
| 消えても影響ない処理（best effort logs・metrics） | `after()`                |

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

## Transaction + External I/O Pattern（設計原則）

DB Transactionと外部I/O（B2・QStash等）を組み合わせる処理は、以下の順序を必ず守る。

1. DB Transaction開始
2. Transaction内でドメインロジックを実行
3. Commit
4. Commit後に外部I/O（B2削除等）を実行
5. 外部I/Oが失敗してもDBはロールバックしない
6. 失敗はlogger.error + Sentryで記録するのみ
7. 補償・GCは別途スケジュールされた仕組みに委譲する

**理由**

外部I/O（特にネットワーク越しの操作）はDB Transaction内に含めない。Transaction内で
外部I/Oを呼ぶと、外部サービスの遅延・障害がDBのロック保持時間に直結し、Transaction
全体の信頼性を外部サービスの可用性に引きずられる形にしてしまう。

そのため「DBの整合性を確定させてから、外部I/Oを試みる」という順序を固定する。
外部I/Oの失敗はDBの整合性とは切り離して扱い、ロールバックの対象にしない
（ロールバックすると、既にCommit済みの状態と矛盾する）。

**適用例**

| 処理                          | Transaction内                                                              | Commit後                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Outboxパターン（QStash配送）  | メインデータ + outbox_events書き込み                                       | Worker がQStash送信                                                                         |
| Outboxパターン（Storage削除） | Image削除 + outbox_events書き込み（image.storage_delete_requested）        | Worker がB2 DeleteObjectを直接実行（QStash非経由）                                          |
| Todo画像更新 | syncTodoImages（TodoImageの同期のみ） | cleanupDeletedStorageKeys()を実行（現在のsyncTodoImages()は削除対象storageKeyを生成しないため、呼び出し自体は残るが現状no-op） |
| Image単体削除                 | deleteImageInTransaction（所有権検証 + Image削除 + outbox_events書き込み） | Worker が非同期にB2 DeleteObjectを実行（Outbox化。詳細は「Image削除フローのOutbox化」参照） |
| Album削除                     | Album配下Image全件をdeleteImageInTransaction + Album削除                   | 同上（Image単位でOutboxイベントが積まれる）                                                 |
| Todo削除                      | todoService.deleteTodo（Todo削除、TodoImageはCascade）                     | cleanupDeletedStorageKeys()を実行（Outbox化の対象外。既知の設計課題があり別Issueで対応）    |

**Todo画像更新とAlbum操作の責務分離**

以前はTodo保存時に、添付する全ImageへAlbumを一括適用する処理を`syncTodoImages`
（旧`applyImageChange`）が兼ねていた。現在はこの責務を分離し、以下のように整理している。

```
Todo保存（syncTodoImages）
  └─ TodoImageの同期（追加・削除・並び替え）のみ
Album操作（albumService）
  └─ Image.albumIdの変更
```

Todo保存はTodoとImageの利用関係（TodoImage）のみを扱い、Imageの分類（Album所属）には
関与しない。Album所属を変更したい場合はAlbum画面から明示的に行う。これによりTodo保存と
Album操作が互いに独立し、Todo保存トランザクションの責務が単純化される。

**外部I/O失敗時に補償・GCを別責務にする理由**

Commit後の外部I/O失敗（例: B2の`DeleteObject`失敗）は、DB上は既に削除済みという
正の状態が確定している。ここでDB側を巻き戻すと「DBには存在しないがB2には残っている」
状態と「DBには存在するがB2からは消えている」状態のどちらつかずの不整合を新たに
作り出しかねない。そのため、外部I/O失敗は記録のみに留め、実体の掃除（孤立オブジェクトの
回収）はGC等の別プロセスに委譲する（B2のLifecycle Ruleに委譲する設計とも一致する。
「画像添付」セクション参照）。

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

| 対象          | 手法                      | 理由                                   |
| ------------- | ------------------------- | -------------------------------------- |
| Todo service  | `findFirst` + transaction | 人間操作・低競合・型安全性優先         |
| Outbox Worker | `FOR UPDATE SKIP LOCKED`  | 複数 consumer・高頻度・queue semantics |

### idempotency_key の設計

Outbox イベントの `idempotency_key` は deterministic な値を使用する。

```typescript
// 良い例（deterministic）
idempotency_key: `todo.created:${todo.id}`;
idempotency_key: `todo.updated:${todo.id}:${todo.updatedAt.getTime()}`;
idempotency_key: `todo.deleted:${todo.id}`;
idempotency_key: `user.registered:${user.id}`;

// 避けるべき例
idempotency_key: crypto.randomUUID(); // 再送・replay時に別イベント扱いになる
```

**deterministic key の用途**

| 用途                              | 値                                                           |
| --------------------------------- | ------------------------------------------------------------ |
| 重複排除（idempotency）           | `todo.created:${todo.id}` など deterministic                 |
| Worker の QStash enqueue 重複防止 | 同上（`Upstash-Idempotency-Key` ヘッダーに使用）             |
| FastAPI の二重処理防止            | `processed_events` テーブルとの照合                          |
| CI smoke test の識別              | `payload.todo_title` の prefix（idempotency_key とは別責務） |

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
    isNewUser = true; // create 成功時のみ true
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      user = await tx.user.update({
        where: { auth0Id: sub },
        data: { email, name },
      });
      // isNewUser は false のまま
    } else {
      throw error;
    }
  }

  if (isNewUser) {
    await tx.outbox_events.create({
      /* user.registered イベント */
    });
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
const POLL_INTERVAL_MS = 5_000;

async function pollOnce() {
  // ロック期限切れ or 未ロックのイベントを 1 件取得してロック
  const event = await prisma.$transaction(async (tx) => {
    const target = await tx.outbox_events.findFirst({
      where: {
        status: "pending",
        next_retry_at: { lte: new Date() },
        OR: [
          { locked_at: null },
          {
            locked_at: {
              lt: new Date(Date.now() - LOCK_TIMEOUT_MINUTES * 60_000),
            },
          },
        ],
      },
      orderBy: { created_at: "asc" },
    });
    if (!target) return null;

    return tx.outbox_events.update({
      where: { id: target.id },
      data: { status: "processing", locked_at: new Date() },
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
      url: `${process.env.FASTAPI_PUBLIC_URL}/webhooks/${event.event_type}`,
      body: event.payload,
      headers: { "x-idempotency-key": event.idempotency_key },
    });

    await prisma.outbox_events.update({
      where: { id: event.id },
      data: { status: "done", processed_at: new Date(), locked_at: null },
    });
  } catch (err) {
    const nextRetry = calcBackoff(event.retry_count); // 指数バックオフ
    await prisma.outbox_events.update({
      where: { id: event.id },
      data: {
        status: event.retry_count >= MAX_RETRIES ? "failed" : "pending",
        retry_count: { increment: 1 },
        last_error: String(err),
        locked_at: null,
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
    status: "processing",
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
    │     ├─ outbox_events（todo.created 等）  → Vector用
    │     └─ outbox_events（analytics.todo_event） → Analytics用
    │         ※ 同一トランザクション内で2件書く。fan-outは使わない
    │
    ▼
[Worker] ポーリング（5秒ごと）
    │  EVENT_MAPで1イベント→1エンドポイントに送信
    │
    ├─ todo.created / updated / deleted
    │     ▼
    │  [QStash] → /webhooks/vector-indexing
    │     ▼
    │  [FastAPI] → Upstash Vector（埋め込み生成）
    │
    └─ analytics.todo_event
          ▼
       [QStash] → /webhooks/analytics-event
          ▼
       [FastAPI] → MotherDuck（直接INSERT）
                   ※ dltは使わない（dltはUser/Todoテーブルのみ同期）

[Worker]
    └─ 完了確認 → status: sent
```

### MotherDuckへの書き込み経路

MotherDuckへのデータ書き込みは**2つの経路**がある。混同しないこと。

| 経路                              | 対象データ                | 方式                               |
| --------------------------------- | ------------------------- | ---------------------------------- |
| analyticsイベント（リアルタイム） | auth_events / todo_events | FastAPIがWebhook受信後に直接INSERT |
| dlt同期（バッチ）                 | User / Todo テーブル      | PostgreSQL → dlt → MotherDuck      |

analyticsイベントはdltの同期対象ではない。`SYNC_TABLES = ["User", "Todo"]` のみ。

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
composeなどコンテナからは開けないのでローカルで開く。

```bash
cd apps/worker
npx dotenv -e apps/worker/.env -- npx prisma studio --schema=../../packages/db/schema.prisma
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

#### pyarrowのバージョン固定について

pyarrow 19以降はCodespacesの一部CPU環境でSIGBUSが発生するため
pyproject.tomlでバージョンを固定しています。

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

### ⚠️ Monorepo + Docker の注意点

本プロジェクトは npm workspaces を使用しているため、
依存関係は以下の2種類の形で存在する：

- hoisted dependencies: /node_modules
- workspace dependencies: /packages/\* → symlink経由

Docker build において builder の node_modules をそのまま runner にコピーすると、
workspace symlink が壊れ、以下のエラーが発生する：

- Cannot find module '@repo/\*'
- Cannot find module '@sentry/node'

#### 原因

npm workspace の依存は以下のように構築される：

node_modules/@repo/db -> ../../packages/db

しかし runner に packages/db をコピーしないと symlink が壊れる

#### 対策

以下の2つを必ず満たすこと：

1. runner に workspace パッケージ本体をコピーする
   - COPY --from=builder /app/packages/db ./packages/db
   - COPY --from=builder /app/apps/worker/node_modules ./apps/worker/node_modules

2. node_modules のコピーは「完全な再現ではない」と理解する
   → workspace構造は node_modules だけでは再現できない

### .graphqlファイルのコピー

Next.jsビルド成果物（.next）には静的ファイル（.graphqlなど）が含まれない。
readFileSync で実行時に読み込むファイルはfinalステージに明示的にコピーする必要がある。

COPY --from=builder /app/apps/web/src/graphql ./apps/web/src/graphql

これがないと以下のエラーが発生する：
ENOENT: no such file or directory, open '/app/apps/web/src/graphql/modules/todos/schema.graphql'

---

## 環境変数の使い分け

`BACKEND_API_URL`と`FASTAPI_PUBLIC_URL`は役割が異なる。

| 変数名               | 値の例                            | 用途                                               |
| -------------------- | --------------------------------- | -------------------------------------------------- |
| `BACKEND_API_URL`    | `http://api:8000`                 | Next.js Route Handler → FastAPI（Docker 内部通信） |
| `FASTAPI_PUBLIC_URL` | `https://xxx-8000.app.github.dev` | QStash → FastAPI（外部からの Webhook 配信）        |

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

## 画像添付（Image Attachment）

### 概要

Todo に画像を1枚添付できる機能。オブジェクトストレージ（Backblaze B2）と
メインDB（Prisma / PostgreSQL）の整合性をどう担保するかが設計の核心。

Imageテーブルは永続URLを保持しない。

保持するのは storageKey のみであり、
取得時にPresigned URLを生成する。

### データフロー

**Image作成フロー（アップロード時・独立トランザクション）**

クライアント（Presigned URL取得）
↓
B2へ直接PUT
↓
POST /api/images（Prismaトランザクション）
↓
Imageテーブルへ書き込み・imageId返却

**Todo保存フロー（別トランザクション）**

Todo保存
↓
syncTodoImages
↓
TodoImageの同期のみ

Image作成はTodo保存より前に完了する独立したトランザクションであり、
Todo保存では新規Imageの作成・削除は行わず、TodoImageの関連同期のみを行う。

**DBが唯一の正（source of truth）。B2はストレージでしかない。**

Image作成は `POST /api/images`（B2 PUT → Image作成）でTodo保存より前に完了する。
そのため、Todo保存トランザクションが失敗してもImageは単に未所属のまま残るだけであり、
Todo保存の成否とImage作成は互いに補償し合う関係にない。残存する孤立Imageの回収は
将来のGC（ガベージコレクション）機構が担う設計とする。

Todo保存トランザクション内では `syncTodoImages()` がTodoImageの同期（追加・削除・並び替え）のみを行い、
削除されたTodoImageに対応するImage本体・B2オブジェクトの削除は行わない
（Todoからdetachしても画像自体は未所属として残る設計）。

Todo保存・Image単体削除いずれも「DB Transaction → Commit → 外部I/O（B2）」という
Transaction + External I/O Patternに従う。外部I/O失敗はDBのロールバック対象にせず、
記録のみに留め、残存する孤立オブジェクトの回収は将来のGC（ガベージコレクション）機構、
または運用対応に委ねる。

### Presigned Upload の特性（孤立オブジェクトについて）

Presigned URL 方式では「B2へのアップロード」と「Todo保存」が別トランザクションになる。

そのため、以下のようなケースでは B2 側にのみファイルが残る「孤立オブジェクト」が発生しうる。

- アップロード後、保存前にブラウザを閉じる
- 保存前にユーザーがキャンセルする
- 通信切断・タイムアウト

この経路で発生する孤立オブジェクトは、B2 PUT成功後にImage DB作成が失敗するケース
（Type A）と同じ性質の問題であり、`StorageCleanupTask`によるGCの対象となる
（詳細は「ADR: storageKey命名規則の変更とGC基盤の導入」「GC（孤立B2
オブジェクトの検知・回収）」セクション参照）。

ただし、Presigned Upload起因の孤立（ブラウザを閉じる・キャンセル・通信切断）は、
アプリケーションが検知できるタイミングを持たない（POST /api/imagesへのリクエスト
自体が発生しないため）。そのため`registerStorageCleanupTask()`は呼ばれず、
`StorageCleanupTask`テーブルには記録されない。この種の孤立は、GCの正規経路
（StorageCleanupTask起点）ではなく、B2側のLifecycle Ruleによる期限切れ削除、
または運用上の手動確認に委ねる（B2全件走査は「B2全件走査を採用しない理由」の
判断と同様、採用しない）。

### useImageUpload の責務

- アップロード済みメタデータ（`storageKey` 等）のみを呼び出し元へ返す。Image作成（`POST /api/images`）自体は
  呼び出し元（`LibraryImageUploader`）の責務とし、フック自体は行わない
- Todo 固有の知識を持たない（Album 等でも再利用可能な汎用フックとして実装）
- 状態管理は `useImageUpload` フックに内包し、親はそれを意識しない

`ImageGallery` / `useImageList` を利用するTodo側の複数画像添付フローでは、
`imageUploadService` がアップロードからImage作成までを担当する。
詳細な責務分担と重複に関する設計上の判断は `imageUploadService.ts` のNOTEを参照。

### ImageListInput の設計

Todo保存API（`createTodo` / `updateTodo`）が受け取る`ImageListInput`
（`features/images/schemas`）は「保存後の最終状態」をそのまま表すスナップショット型である。

| 値                        | 意味                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `undefined`               | 画像に関する変更なし（更新時のみ意味を持つ。作成時は常に配列を渡す想定）                                                             |
| `imageId[]`（空配列含む） | 保存後の最終状態そのもの。配列に含まれない既存Imageの関連は解除される（Image本体・B2は削除されない）。空配列は全関連の解除を意味する |

配列内の各idの所有権はクライアントの申告を信用せず、サーバー側（`syncTodoImages`）で
`Image.userId`を直接検証する。

### B2（Backblaze）の削除仕様

B2 では `DeleteObject` は論理削除（Hidden）であり、物理削除は Lifecycle Rule へ委譲する。
DeleteObject
↓
Hidden
↓
Lifecycle Rule
↓
Physical Delete

即時に物理削除されない設計であることを前提にコードを書くこと（詳細な確認手順は runbook を参照）。

### Image削除フローのOutbox化（image.storage_delete_requested）

Image単体削除（`imageService.deleteImage`）およびAlbum削除経由のImage削除
（`albumService.deleteAlbum`）は、B2 DeleteObjectの実行主体をRoute Handlerの
同期処理からWorkerの非同期処理へ移管している。

Image DB削除
↓ 同一トランザクション
outbox_events書き込み（image.storage_delete_requested）
↓ Commit
Worker がポーリングで取得
↓
B2 DeleteObjectを直接実行（QStash / FastAPIは経由しない）


**イベント設計**

| 項目 | 値 |
|---|---|
| event_type | `image.storage_delete_requested` |
| aggregate_id | `imageId` |
| idempotency_key | `image.storage_delete_requested:${imageId}` |
| payload | `{ storage_key, correlation_id }` |

`operation` / `todo_title`（FastAPIのVectorIndexingPayload向けの必須フィールド、
「Outbox payloadの必須フィールド」参照）は、本イベントがFastAPIへ配送されない
ため含めない。

**Worker側の実行経路**

`processEvent()`はevent_typeで分岐し、QStash配送対象のイベント（`processQStashEvent`）
と、Storage系イベント（`processStorageDeleteEvent`）を完全に分離して処理する。
`worker.ts`（ポーリング・ロック・retry/backoff/failed遷移）と
`monitorOutboxService.ts`（stale監視等）はevent_typeに依存しない汎用実装のため、
このイベント追加にあたって変更していない。B2削除の失敗は既存Outbox基盤の
retry/backoff/failed（DLQ）にそのまま乗る。

**B2 DeleteObjectの冪等性（実測確認済み）**

Backblaze B2のS3互換APIでは、存在しないKeyへのDeleteObjectも例外を投げず
成功（204）することを実機確認済み。そのため404相当を明示的に「成功扱い」へ
正規化するコードは持たない。

**StorageCleanupTask（Type B）との関係**

本対応により、`imageService.deleteImage` / `albumService.deleteAlbum`からの
`cleanupDeletedStorageKeys()`呼び出しは廃止し、B2削除失敗時の
`registerStorageCleanupTask()`（Type B, `b2_delete_failed`）登録も
この経路では発生しなくなった。Outbox化された削除の失敗はOutbox自身の
retry/failedとして扱い、StorageCleanupTaskへは二重登録しない。
StorageCleanupTaskは「Outbox経路から漏れた孤立オブジェクトの回収」という
独立した責務のレーンとして引き続き存在する（詳細は「GC（孤立B2オブジェクトの
検知・回収）」参照）。

**対象外（Todo削除・Todo画像更新）**

`todoService.deleteTodo`・`todoService.updateTodo`は本対応の対象外であり、
引き続き既存の`cleanupDeletedStorageKeys()`（同期的なB2削除、失敗時はType B
登録）を使用する。特に`deleteTodo`は、Todo削除時にImage本体を削除せず
B2オブジェクトのみを削除するという、現在の設計原則
（「Todoから画像を解除してもImageは削除されず、未所属またはAlbum所属のまま
残る」）と整合しない既知の課題があり、別Issueで扱う。

### エラーロギングの責務分離

Client Error
↓
errors/sentry-logger.ts
Server Error（Service / Route Handler）
↓
lib/server-logger.ts
Worker
↓
monitor.ts（Sentry連携込み）

クライアント・サーバー・Workerで実行コンテキストが異なるため、Sentry送信経路も分離している。
新規コードでは、どのレイヤーで発生したエラーかに応じてロガーを使い分けること。

### Imageドメイン設計

ImageはTodoにもAlbumにも従属しない独立したドメインであり、所有権は
Image.userId が直接持つ。

User
└── Image（所有権: Image.userId）
├── albumId（分類。NULL許容 = 未所属）
└── TodoImage（利用関係）
└── Todo

- Imageはユーザーの資産（ファイル実体・所有権）を管理する
- 所有権は Image.userId が単独で持つ。Album や Todo を経由した所有権判定は行わない
- Albumは画像を分類・整理するためのグルーピングであり、所有権は持たない
- albumId は nullable。未所属（albumId = null）は正常な状態であり、
  「まだ分類していない画像」を表す
- TodoはImageを所有せず、TodoImageを介して利用するだけ
- Todo固有の属性（表示順・Alt Text・Description等）はTodoImageが保持する
- Todoから画像を解除してもImageは削除されず、未所属またはAlbum所属のまま残る
- Albumを移動しても所有者（userId）は変わらない（`UPDATE Image SET albumId = ?` のみで完結する）

#### Image Ownership Principle（設計原則）

> Image はユーザーの資産であり、所有権は `Image.userId` が持つ。
> Album は画像を分類・整理するためのグルーピングであり、所有権は持たない。
> Todo は TodoImage を介して Image を利用するだけであり、Image を所有しない。

この原則により、以下が Image.userId のみで判定可能になる。

| 用途                         | クエリ                                                   |
| ---------------------------- | -------------------------------------------------------- |
| ライブラリ一覧（全画像）     | `WHERE userId = :currentUser`                            |
| 未所属一覧                   | `WHERE userId = :currentUser AND albumId IS NULL`        |
| 所有権チェック（削除・更新） | `Image.userId == currentUser`（Album・Todoを経由しない） |

**旧設計との違い**

以前は「Image ownership flows exclusively through `Album → userId`」（Album経由での所有権判定、Todoへのフォールバックなし）としていたが、
Album必須という前提が「未所属画像」というドメイン上自然な状態を表現できなかったため、
Image.userId を直接の所有権源泉とする設計に変更した（詳細は下記ADR参照）。

#### ADR: Image所有権モデルの変更

**背景**: 旧設計では Album が Image の所有権を保持し、`Image.albumId → Album.userId` を辿って所有権チェックを行っていた。この設計は「Imageは必ずAlbumに属する」ことを前提としていた。

**問題**: Todo添付時の画像アップロードを「Album未所属（albumId = null）」で開始できるようにする要件が生まれたが、Album経由の所有権チェックでは未所属画像の所有者を判定できなかった。

**決定**: `Image.userId` を追加し、所有権判定の唯一の情報源とする。Album は分類（グルーピング）のみの責務に限定し、`albumId` は nullable とする。

**代替案として検討したが不採用**: `UserImage` 中間テーブル（多対多の共有を見据えた設計）。現時点では「一画像＝一所有者」の要件しかなく、中間テーブルは複雑さのみが増えるため不採用。共有機能（他ユーザーへの画像共有・チームAlbum等）の要件が出た時点で再検討する。

**影響**: `deleteImageInTransaction` 等の所有権チェックロジックは Album を経由せず `Image.userId` を直接参照する形に変更する。移行はマイグレーションで `Image.userId` を追加し、既存データは `Image.albumId → Album.userId` からBackfillする。

#### ADR: storageKey命名規則の変更とGC基盤の導入

**背景**: 旧storageKeyは`uploads/YYYY/MM/DD/{Auth0 sub}/{uuid}.ext`という形式で、Auth0の`sub`をB2オブジェクトキーに含めていた。この設計は、Type A（B2 PUT成功後のImage作成失敗）を調査する際、SentryのデータスクラビングによりstorageKeyが`[Filtered]`としてマスキングされ、障害調査ができないという問題を引き起こした。

**問題**: 調査の結果、storageKeyの日付ディレクトリ・Auth0 sub部分をパースして利用しているコードはアプリケーション内に一切存在しないことが判明した。Image所有権は`Image.userId`のみを情報源とする設計（Image Ownership Principleのadrを参照）が既に確立していたため、storageKey自体に所有権情報を持たせる必要性がそもそもなかった。

**関連**: これとは別に、Sentryの`safe_context`キー名に`storage_key`という**フィールド名**を
使っていたことでも同様のマスキング（`[Filtered]`）が発生している（`key`を含む文字列への
データスクラビング反応）。こちらはキー名を`b2_object_path`に変更して対応済み。詳細は
runbook.md「16. B2削除失敗時の確認」を参照。

また、Presigned Upload方式・Transaction + External I/O Patternという現在の設計上、以下2種類の孤立B2オブジェクトが発生しうることが分かっていたが、従来はSentryへのログ記録のみで、回収は「Sentryを見た人間がB2ダッシュボードから手動確認・削除する」という運用に依存していた。

| 種別   | 発生条件                                                                                  |
| ------ | ----------------------------------------------------------------------------------------- |
| Type A | B2 PUT成功後、Image DB作成が失敗し、B2にオブジェクトが存在するがDBにImageが存在しない     |
| Type B | Image DELETE成功後、B2 DeleteObjectが失敗し、DBには存在しないがB2にオブジェクトが残存する |

**決定**:

1. storageKeyを`uploads/{uuid}.{extension}`という、所有権・分類情報を一切含まないopaqueな識別子に変更した。日付ディレクトリも、GC設計でB2側のprefix走査を使わない方針としたため廃止した。
2. Type A/Bを検知・記録・回収する共通基盤として`StorageCleanupTask`テーブルを新設した。`reason`で発生原因（`image_create_failed`/`b2_delete_failed`）のみを区別し、回収ロジックは共通化した。
3. 回収はWorker（`apps/worker`）による定期ポーリングを正規経路とし、既存Outbox Worker（`outbox_events`）と同じ`FOR UPDATE SKIP LOCKED`による原子的claimパターンを採用した。ただしリトライ方針はOutboxより簡略化し、PermanentError/TransientErrorの区分やDLQ相当の仕組みは導入していない。

**代替案として検討したが不採用**:

- **B2側の`ListObjects`による全件走査とImage全件の突合** — B2オブジェクト数の増加に伴うコスト・複雑性の観点から不採用。storageKeyに日付ディレクトリを持たせてprefix走査を効率化する設計も、この不採用判断と合わせて見送った。
- **StorageCleanupの検知・回収をOutbox（`outbox_events`）に統合する設計** — Outboxは「これから実行すべき業務イベントの確実な配送」を担う仕組みであり、StorageCleanupは「既にCommit済みの状態に対する事後の外部I/O補償」であるため、責務が異なると判断した。
- **B2アクセス層の共通パッケージ化（`packages/storage`等）** — `apps/worker/src/lib/b2.ts`は`apps/web/src/lib/b2.ts`とは別に、削除専用の最小実装として新設し、重複を許容した。Image Storage Lifecycle全体（PUT/DELETEの実行主体）をWorkerへ移管する設計変更が別途必要になった際に、その中で改めて共通化を判断する（Future Work参照）。

**影響**: `apps/web/src/lib/b2.ts`の`buildStorageKey()`のシグネチャ変更（`userId`引数の削除）、Type A/B双方の検知箇所（`POST /api/images`・`cleanupDeletedStorageKeys()`）への`registerStorageCleanupTask()`呼び出し追加、Worker側への`StorageCleanupTask`回収ロジック（`storageCleanupWorkerService.ts`）の新設。

移行のため、dev/staging環境のImage DB・B2 `uploads/`配下を一括リセットした（`resetImageDomain.ts`）。旧フォーマットのオブジェクトはHidden化のみ行い、物理削除はB2 Lifecycle Ruleに委譲した。手順の詳細はrunbook.mdを参照。

#### Why

この構造により

- 画像の再利用
- Album管理
- 将来的なNote/Profileなどへの共有
- GraphQLの統一
- GCの責務分離

を実現する。

### storageKey命名規則

Image作成時に発行するB2オブジェクトキーの命名規則は、GC設計に合わせて再設計した。

**旧フォーマット**

uploads/YYYY/MM/DD/{Auth0 sub}/{uuid}.ext

**新フォーマット**

uploads/{uuid}.{extension}

storageKeyから所有者情報・日付階層を除去し、opaqueな識別子に変更した。Image所有権は`Image.userId`のみが情報源であり（Image Ownership Principle参照）、storageKey自体に所有権情報を持たせる設計上の必然性がなかったこと、またAuth0 subがstorageKeyに含まれることでSentryのデータスクラビングによりB2オブジェクトパスが追跡できなくなっていたことが理由（詳細はADR参照）。

`buildStorageKey()`（`apps/web/src/lib/b2.ts`）の1箇所のみが生成箇所であり、storageKeyを解釈・パースする既存コードが存在しなかったため、影響範囲を生成ロジックの変更のみに限定できた。

### storageKey検証（API境界）

`POST /api/images` は `storageKey` をクライアントからの入力として受け取るため、
`createImageInputSchema` で `buildStorageKey()` が生成する形式
（`uploads/{uuid}.{jpg|png|gif|webp}`）への一致を`.regex()`で強制している。これにより、
クライアントが任意のB2オブジェクトキーを指定してImageとして登録する経路をAPI境界で塞ぐ。

さらに、`storageKey`の拡張子と`mimeType`の整合性を`.refine()`で検証している
（`MIME_TYPE_TO_EXTENSION`による1:1対応表）。`originalFileName`は表示用
メタデータであり、この整合性検証の対象には含めない。

検証は上記の形式・整合性チェックまでであり、以下は引き続き対象外（意図的なスコープ限定）:

- B2上のオブジェクト実在確認

これらは所有権判定（`Image.userId`）やGC（`StorageCleanupTask`）など他の仕組みで
別途担保される領域であり、この検証の責務ではない。
B2実在確認は同期外部I/Oを伴うため、別Issueとして扱う。

なお、DB上の`storageKey`重複については、`Image.storageKey`に一意制約を追加し、
違反時（Prismaの一意制約違反エラー）はConflictErrorへ変換して409を返すようにした。
この際、既存の正常なImageが参照しているstorageKeyである可能性があるため、
B2オブジェクト孤立のGC登録（`registerStorageCleanupTask`）は行わない
（GC対象はあくまで「Imageが存在しないstorageKey」であるため）。

### REST /api/todos のImage情報公開範囲（修正記録）

GraphQL移行作業時に、`GET /api/todos`が`TodoWithImages`（Prisma Imageモデル
全フィールド、storageKey込み）をそのままJSONレスポンスに含めていたことが判明した。
GraphQL側は`TodoImageType`として最初から安全な部分集合（id/originalFileName/mimeType/
fileSize/order）のみを公開する設計になっていたが、REST側は未対応のまま残っていた。

`features/todos/lib/todoImageMapper.ts`の`toTodoWithImageSummaries()`でRoute Handler
側の出力時に絞り込む形で修正した。Service層（`todoService.getTodos`）自体は内部DTO
（`TodoWithImages`）を返したまま変更していない。

`PATCH /api/todos/[id]`・`POST /api/todos`のレスポンスは元々`images`フィールド自体を
含まない`Todo`型のため対象外。

**設計原則（公開DTOの設計原則）**

この教訓を踏まえ、PrismaモデルをそのままGraphQL/RESTの公開型として使わない方針とした。
`Image & { order: number }`のような、モデル全体をspreadで拡張する型は、UIが実際に
必要とするフィールドより広くなりがちで、`storageKey`等の非公開フィールドが意図せず
レスポンスに含まれる原因になる。公開DTOはUI/API契約が実際に必要とするフィールドのみで
構成し、Prismaモデルのフィールドが増えても公開DTOには自動反映されない設計とする。
公開範囲の拡大は都度明示的な型定義の変更を要求することで、漏洩を「気づかないまま
起きる」ことを防ぐ。

### Album/Todoにおける公開DTOの適用

Prismaモデルをそのまま公開型として使わないという方針は、当初Imageドメインの
storageKey漏洩を教訓に確立されたが、Album・Todoにはそのような具体的な非公開
フィールドが存在しなかったため、この方針が及んでいなかった。

調査の結果、`features/albums/types`の`Album`がPrisma生成型の単純再export、
`features/todos/types`の`Todo`がPrisma生成型の単純aliasであり、対応する
Route HandlerがPrismaの生の結果をそのままレスポンスとして返していたことが
判明した（`GET /api/albums`・`POST /api/albums`・`PATCH /api/albums/[id]`・
`POST /api/todos`・`PATCH /api/todos/[id]`）。これによりuserId・displayOrder・
createdAt・updatedAtが実際にクライアントへ送信されていた。

**是正した境界**
Prisma
↓
Service（内部型のまま。GraphQL Resolverはここを直接利用、変更なし）
↓
REST Route Handlerでのみ明示的mapperを適用
↓
公開DTO（Album / Todo）

Service層はGraphQL Resolverから直接呼ばれる構造（本README「GraphQL ハイブリッド
構成」参照）のため、Service層の戻り値自体を公開DTOへ狭めると、GraphQL側の実装・
schemaまで巻き込んでしまう。そのため、公開境界の是正はREST Route Handler境界
（mapper）に限定し、Service層は引き続きPrisma内部型（`PrismaAlbum`・`PrismaTodo`）
を返す。

**命名方針**

Prisma生成型とfeature側の公開型で名前が衝突し意味が曖昧になる場合のみ、
Prisma側を別名にする（`Album as PrismaAlbum`・`Todo as PrismaTodo`）。
「Prisma型だから機械的に別名にする」という一律のルールは採用しない
（衝突しない場合は既存の公開型名をそのまま維持する）。

**除外したフィールドと理由**

| 型 | 除外フィールド | 理由 |
|---|---|---|
| Album | userId, displayOrder, createdAt, updatedAt | UIのどのコンポーネントも参照していない。所有権確認はService層の責務 |
| Todo | userId, createdAt | 同上。一覧のソートはサーバー側orderByで完結している |

将来的にこれらのフィールドが必要になった場合（例: Album並び替えUI導入時の
displayOrder）は、都度公開DTOの型定義を明示的に変更すること。「将来使うかも
しれないから残す」という判断はしない。

**GraphQL側は対象外**

GraphQL SDL（`schema.graphql`）・Resolver（`resolvers.ts`）・GraphQL Service層
（`*ServiceGraphQL.ts`）は、依然としてuserId・displayOrder等をレスポンスに
含めている。RESTと同じ公開範囲整理をGraphQL側にも適用するかどうかは、既存の
GraphQLクライアントへの破壊的変更になりうるため、別途設計検討が必要な事項として
切り分けている。

REST側是正に伴い、GraphQL Service層（`albumServiceGraphQL.ts`・
`todoServiceGraphQL.ts`）およびResolver内の型参照はPrisma内部型
（`PrismaAlbum`・`PrismaTodo`・`AlbumDetailInternal`）に置き換えたが、
これは型名の整合のみでありGraphQLの動作・レスポンス内容に変更はない。

**TodoImageDtoの整理**

Todo側では、画像1件分の内部データ型`TodoImageDto`も同様にPrisma `Image`型
への依存を解消した。旧実装は`TodoImageDto = Image & { order: number }`という
Prisma型ベースの合成型であり、`todoService.getTodos`が`{ ...ti.image, order }`
という形でPrismaの`image`オブジェクトを丸ごとスプレッドしていた。

是正後は`TodoImageDto`を`{ id, originalFileName, mimeType, fileSize, order }`
という明示的interfaceとし、`todoService.getTodos`もこの5フィールドを明示列挙
してマッピングする形に変更した。これにより、REST公開DTOとGraphQL両方が要求する
フィールドが既に絞り込み済みとなり、旧TodoImageSummary（REST/GraphQL向けの
追加の軽量型）は同一形状の重複型となったため廃止した。

---

### GC（孤立B2オブジェクトの検知・回収）

`apps/worker`が`StorageCleanupTask`を定期的にポーリングし、B2オブジェクトの削除を再試行する。既存のOutbox Worker（`outbox_events`）と同じ`FOR UPDATE SKIP LOCKED`による原子的claimパターンを踏襲し、複数Workerインスタンス間の二重処理を防ぐ。

StorageCleanupTask (status=pending, nextRetryAt<=now)
↓ claim（$queryRawによるUPDATE ... FOR UPDATE SKIP LOCKED）
status=processing
↓
B2 DeleteObject再試行
├─ 成功 → status=resolved
└─ 失敗
├─ retryCount < MAX → status=pending, nextRetryAt更新（指数バックオフ）
└─ retryCount >= MAX → status=failed + Sentry通知

リトライ方針はOutboxより簡略化している。B2 DeleteObjectは単純な外部I/Oであり、PermanentError/TransientErrorの区分やDLQ相当の仕組みは導入していない。`STORAGE_CLEANUP_MAX_RETRIES`（デフォルト8）に達した`StorageCleanupTask`は`failed`となり、Sentryで通知した上で手動調査・手動再実行の対象とする。実行間隔は`STORAGE_CLEANUP_INTERVAL_MINUTES`（デフォルト5分）。

**Taskの発生源**

`StorageCleanupTask`は以下2つの経路から登録される。B2上のstorageKeyが孤立している可能性があるという共通の状態を表すため、単一テーブルに集約している。

| reason                          | 発生条件                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `image_create_failed`（Type A） | B2 PUT成功後、Image DB作成（`POST /api/images`）が失敗し、B2オブジェクトが孤立 |
| `b2_delete_failed`（Type B）    | Image DELETE成功後、B2 DeleteObjectが失敗し、オブジェクトが残存                |

**注記（2026年8月時点）**: Image単体削除・Album削除経由のB2削除は
「Image削除フローのOutbox化」により、Outbox自身のretry/failedとして
処理されるようになったため、この経路での`b2_delete_failed`（Type B）登録は
発生しなくなった。現在Type Bが発生するのは、`todoService`
（Todo削除・Todo画像更新）経由で`cleanupDeletedStorageKeys()`が失敗した
場合のみである。

どちらも`registerStorageCleanupTask()`を通じて同じテーブルへUPSERTされる。回収アクション自体は`reason`を問わず共通（「Imageが存在しないstorageKeyをB2から削除する」処理）。

**Type Aの対象外となるケース（storageKey重複エラー）**: `POST /api/images`のImage DB作成失敗のうち、
storageKeyの一意制約違反（既存の自分または他人のstorageKeyを申告したケース）は、Type Aには含めない。
このケースはB2オブジェクトが孤立しているのではなく、そのstorageKeyに対応するImageが既にDBに存在する
（＝「Imageが存在しないstorageKey」というType Aの前提を満たさない）ため、GC登録は行わずConflictError
（409）としてクライアントへ返す。詳細はstorageKey検証（API境界）セクションを参照。

**主なフィールド**（`packages/db/schema.prisma`が正）

`StorageCleanupTask`: `storageKey`, `reason`, `status`（pending/processing/resolved/failed）, `retryCount`, `nextRetryAt`, `lockedAt`, `lastError`, `resolvedAt`

**Sentryとの役割分担**

Sentryは監視・調査用途に限定し、GCの一次データソースとしては使わない。GCの回収処理は`StorageCleanupTask`テーブルのみを参照する。

**B2全件走査を採用しない理由**

`ListObjects`によるB2全件 ⇔ Image全件の突合は、オブジェクト数増加に伴うコスト・複雑性の観点から不採用とした。storageKeyの日付ディレクトリを廃止したのも、この方針と整合する。

**手動運用スクリプト**

Worker統合前の暫定運用として、`apps/web/scripts/storageCleanup.ts`（`--dry-run` / `--run`）を用意している。Worker稼働後、`--run`は緊急時専用（Worker停止が前提）。詳細な運用手順はrunbook.md「StorageCleanupTask 手動運用」を参照。

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

`features/todos/services/index.ts` にあるフラグで、メソッドごとに REST と GraphQL を切り替え可能。フック層・コンポーネント層はどちらの通信方式を使っているかを意識しない。`services/index.ts` はサーバー側（REST Route Handler の内部）で参照される切り替え層であり、Hook から直接importして呼ぶものではない。

### Query設計方針：関連データは親から辿る

新しいドメインをGraphQL化する際、「一覧を返すQueryをドメインごとに機械的に作る」のではなく、
RESTの実際のエンドポイント構成に合わせて設計する。

例（Images移行時の判断）：REST側に「全Image一覧」というエンドポイントは存在せず、
以下の構成になっていた。

- Album所属画像 → `albumService.getAlbumDetail()` の一部
- Album未所属画像 → `GET /api/images/unassigned`
- Todo画像 → Todo取得APIに含まれる

この場合、GraphQL側も`images`という独立Queryを新設せず、`Album.images` / `Todo.images`
（親から辿る）+ `unassignedImages`（未所属専用）という、RESTの責務分担をそのまま踏襲する
設計にした。

これはGraphQLらしい設計（`album(id) { images { ... } }`のように関連を親から辿る）とも
一致し、「GraphQLはRESTが既に決定した型をそのまま転写する薄いtransport層である」という
方針とも整合する。RESTに存在しない機能をGraphQL化のタイミングで新設しない。

### データフロー（GraphQL 経路の二度手間）

REST 経路と GraphQL 経路では Next.js 内部の通信ホップ数が異なる。
Hook は常に REST API（`/api/todos`）を叩くだけであり、REST/GraphQL の切り替えは
Route Handler 内部（`services/index.ts`）で行われる。

【REST 経路】
Client Component
→ useTodo（フック）
→ todoApi.ts（fetch関数。/api/todos を叩くだけ）
→ REST Route Handler
→ services/index.ts（useGraphQL: false）
→ todoService（Prisma 直接）
→ DB

【GraphQL 経路】（二度手間）
Client Component
→ useTodo（フック）
→ todoApi.ts（fetch関数。/api/todos を叩くだけ。REST経路と共通、Hook側の変更はない）
→ REST Route Handler
→ services/index.ts（useGraphQL: true）
→ todoServiceGraphQL（サーバー内部から /api/graphql へHTTP）
→ graphql-request（Cookie 付きヘッダーを付与） ← ① 内部 Yoga エンドポイントへの追加ホップ
→ POST /api/graphql
→ Resolver → todoService（Prisma 直接。REST経路と同一のService関数を再利用）
→ DB

「二度手間」とは、REST Route Handler からさらに内部で `/api/graphql` へ HTTP リクエストする
追加ホップを指す。Hook 側の通信回数・経路（`/api/todos` のみ）は REST/GraphQL いずれの場合も変わらない。

スイッチングのための設計であり、GraphQL のみに移行した場合は REST Route Handler を経由せず
`/api/graphql` エンドポイントに直接接続する形にするとシンプルになる。

### サーバーサイドでのCookie伝播

graphql-request はサーバーサイドで実行される際、自動的に Cookie を引き継がない。
`next/headers` から Cookie を取得して明示的にヘッダーに付与する必要がある。

throw new GraphQLError("認証が必要です", {
extensions: {
\_\_typename: "AuthenticationError",
code: "authentication_error",
category: "AUTHENTICATION",
},
});

### GraphQL移行時に発見した設計漏れ（2026年8月・Todo/Album）

Todo・AlbumをGraphQL化する過程で、Service層がRoute HandlerのValidationError catchを
前提にしていながら、実際には一度もValidationErrorを投げていないことが判明した
（Route Handler側のコードは「Serviceが投げる想定」で書かれていたが、Service側の実装が
未完成だった）。

GraphQL Resolverは元々Route Handlerのバリデーションを経由しないため、この漏れがGraphQL
経路で顕在化した。原因はGraphQL実装そのものではなく、Service層がバリデーションの
最終防衛線になっていなかったという既存設計の不備であり、Todo・Album両方のService層に
遡って修正した。

この経験から、新しいドメインをGraphQL化する際は、着手前にService層が対応するドメイン
例外（NotFoundError / ConflictError / ValidationError）を実際に投げているか一次ソースで
確認することを標準の事前チェック項目とする。

**注意**: 以下は将来GraphQL単独構成へ移行する場合の変更点であり、現在の
設計ではない。現在は「GraphQLはUI/Hookから選択する通信方式ではなく、
Route Handler内部（`services/index.ts`）で選択されるDBアクセス経路の
一つである」という原則が適用されている。

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
todoApi.ts（fetch関数）
 ↓
REST Route Handler
 ↓
services/index.ts（useGraphQL: true）
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

### Service契約とTransport変換

`services/index.ts`が切り替えるREST版・GraphQL版のServiceは、同一のTypeScript
戻り値契約（型・構造）を維持する。GraphQL固有のレスポンス形式（例:
`ProgressStatsType`のような個別フィールド構造）への変換は、`*ServiceGraphQL.ts`
内部で既存Serviceの戻り値契約に合わせて行う。

例（progressStats）：

GraphQL Schema: { range020, range2140, ... }（個別フィールド）
↓ todoServiceGraphQL内で変換
Service契約: Array<{ range: string; count: number }>（todoServiceと同一）

Service実装ごとに同名メソッドの戻り値型を変えない。変えると`services/index.ts`の
switch時に型が合わなくなる、またはUI側の呼び出しコードをtransportごとに
書き分ける必要が生じる。

### GraphQL移行状況

| Domain       | GraphQL | REST | 備考                                                         |
| ------------ | ------- | ---- | ------------------------------------------------------------ |
| Todo         | ✅      | ✅   | Query / Mutation 全操作                                      |
| Album        | ✅      | ✅   | Query / Mutation 全操作                                      |
| Image        | 一部    | ✅   | `unassignedImages` / `deleteImage` / `updateImageAlbum` のみ |
| Image Upload | ❌      | ✅   | Presigned URL方式を維持（インフラ層のためGraphQL対象外）     |
| Image View   | ❌      | ✅   | `/api/images/[id]/view`                                      |

「GraphQL移行完了」は「REST APIの廃止」を意味しない。Presigned URL・
Image作成・view系はREST専用のまま維持する設計判断（Images GraphQL移行の
スコープ確認時に確定）。

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

| limiter           | 制限       | 対象エンドポイント                                   |
| ----------------- | ---------- | ---------------------------------------------------- |
| `todoRatelimit`   | 30 回 / 分 | Todo CRUD（POST・PATCH・DELETE）                     |
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

| module       | 対応       | 内容                                                                                              |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------- |
| `neon`       | 流用・改名 | DBそのまま                                                                                        |
| `backblaze`  | 流用・改名 | ストレージそのまま                                                                                |
| `render`     | 改修       | web(Next.js) + api(FastAPI) + worker(Background Worker) の3サービス                               |
| `upstash`    | 流用・改名 | Redis/Vector/QStashそのまま。vector次元数を768→1536に修正（無料枠上限・gemini-embedding-001対応） |
| `github`     | 改修       | 変数の追加・削除                                                                                  |
| `auth0`      | 新規       | アプリ作成・コールバックURL設定                                                                   |
| `cloudflare` | 削除       | Renderに統一（将来的にOpenNext + Cloudflare Workersへの移行を検討）                               |

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

| 項目              | django-react                                            | nextjs-fastapi-app                                       |
| ----------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| `render_app_name` | {project}-backend-{env}                                 | {project}-{env}（-web/-api/-workerをサフィックスで管理） |
| `削除`            | cloudflare_pages_name / debug_mode / storage_public_url | —                                                        |

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

### Neon Provider注意事項

#### Branch

Neon Project作成時に main branch は自動生成される。

Terraformで別途作成しない。

#### Endpoint

Neon Project作成時に read_write endpoint は自動生成される。

Terraformで追加作成すると以下エラーになる。

ENDPOINTS_LIMIT_EXCEEDED
read_write endpoint already exists

### Render Provider既知不具合

render provider は build_filter.ignored_paths で
state不整合を起こす場合がある。

エラー例

Provider produced inconsistent result after apply

対策

ignored_paths = []

を設定しない。

#### Free Planサービスの更新制限

Free Planのサービスに対してterraform applyで更新をかけると
以下のエラーが発生する。

maintenance mode can only be configured for non-free tier services

Renderのfree tierではin-placeのupdate操作自体がProviderに
サポートされていないため。

対策
環境変数や設定変更を反映する場合は -replace で強制再作成する。

\```bash
terraform apply -replace="module.render.render_web_service.api"
terraform apply -replace="module.render.render_web_service.web"
terraform apply -replace="module.render.render_web_service.worker"
\```

通常のterraform applyではNo changesと表示されても
Render側に反映されていない場合があるため、
設定変更時は必ず -replace を使うこと。

### Render start_command とDockerfile CMDの優先順位

Render では start_command を設定すると Dockerfile の CMD が完全に上書きされる。

そのため：

- Dockerfile CMD は無視される
- Terraform / Render の設定が最優先になる

結果として：

- CMDで動くと思った処理が動かない
- 予期しない start sequence になる

migrate は以下で実行する：

- ビルド時 ❌（NG：DB接続不可の可能性）
- Docker CMD or start_command ⭕
- CI/CD or deploy step ⭕

推奨：
Docker runtime 起動時に実行する

---

## CI/CD 変更点まとめ

### プロジェクト構成の変更

| 項目           | django-react                                  | nextjs-fastapi-app      |
| -------------- | --------------------------------------------- | ----------------------- |
| サービス数     | 2（Backend / Frontend）                       | 3（Web / API / Worker） |
| デプロイ先     | Backend → Render、Frontend → Cloudflare Pages | すべて Render 統一      |
| フロントエンド | Vite/React SPA                                | Next.js                 |
| バックエンド   | Django                                        | FastAPI                 |

### ワークフロー一覧

| ファイル                     | 対応     | 変更内容                                              |
| ---------------------------- | -------- | ----------------------------------------------------- |
| `web-staging.yml`            | 新規     | frontend-staging.yml を Next.js / Render 向けに再設計 |
| `web-production.yml`         | 新規     | 同上（production）                                    |
| `api-staging.yml`            | 新規     | backend-staging.yml を FastAPI / Render 向けに再設計  |
| `api-production.yml`         | 新規     | 同上（production）                                    |
| `worker-staging.yml`         | 新規     | Worker サービス用（django-react に相当なし）          |
| `worker-production.yml`      | 新規     | 同上（production）                                    |
| `reusable-web-test.yml`      | 新規     | Next.js テスト用 reusable ワークフロー                |
| `reusable-api-test.yml`      | 新規     | FastAPI pytest 用 reusable ワークフロー               |
| `reusable-worker-test.yml`   | 新規     | Worker Vitest 用 reusable ワークフロー                |
| `pr-quality-check.yml`       | ほぼ流用 | .venv 除外パスのみ修正                                |
| `terraform-fmt.yml`          | 完全流用 | 変更なし                                              |
| `terraform-plan.yml`         | 一部修正 | paths・フィルター・ワークスペース名を修正             |
| `terraform-apply.yml`        | 一部修正 | サービス名・URL変数・sequential jobs を修正           |
| `smoke-tests-staging.yml`    | 一部修正 | パス・URL変数・ヘルスチェックURLを修正                |
| `smoke-tests-production.yml` | 一部修正 | 同上                                                  |

### 各ワークフローの主な変更点

#### アプリ系（web / api / worker）

**パストリガー**

- backend/** → apps/api/**
- frontend/** → apps/web/**
- packages/db/\*\* 追加（web・worker の両ワークフローをトリガー、Prismaスキーマ変更の影響範囲に合わせるため）
- apps/api/\*\* は FastAPI が Prisma を使わないためトリガーから除外

**テスト方針**

- MSW を使用しない（Next.js はフロントとバックを兼ねるため不要）
- E2E はローカル DB で実行、APP_BASE_URL=http://localhost:3000 固定
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

- paths トリガーに packages/db/\*\* を追加
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

| 変数名                     | django-react | nextjs-fastapi | 種別    |
| -------------------------- | ------------ | -------------- | ------- |
| `VITE_BASE_API_URL`        | ✅ 使用      | ❌ 削除        | vars    |
| `FRONTEND_URL`             | ✅ 使用      | ❌ 削除        | vars    |
| `FASTAPI_PUBLIC_URL`       | ❌ なし      | ✅ 追加        | vars    |
| `WEB_URL`                  | ❌ なし      | ✅ 追加        | vars    |
| `RENDER_WEB_SERVICE_ID`    | ❌ なし      | ✅ 追加        | vars    |
| `RENDER_API_SERVICE_ID`    | ❌ なし      | ✅ 追加        | vars    |
| `RENDER_WORKER_SERVICE_ID` | ❌ なし      | ✅ 追加        | vars    |
| `RENDER_API_KEY`           | ❌ なし      | ✅ 追加        | secrets |
| `AUTH0_SECRET`他 Auth0 系  | ❌ なし      | ✅ 追加        | secrets |
| `INTERNAL_API_SECRET`      | ❌ なし      | ✅ 追加        | secrets |
| `CLOUDFLARE_API_TOKEN`     | ✅ 使用      | ❌ 削除        | secrets |
| `CLOUDFLARE_ACCOUNT_ID`    | ✅ 使用      | ❌ 削除        | vars    |

---

### CI / CD 責務分離（push = CI、Terraform Apply = CD）

django-react では push 時に自動デプロイする構成だったが、nextjs-fastapi-app では CI と CD を明確に分離している。

| トリガー                | 役割                                        | 対象ワークフロー    |
| ----------------------- | ------------------------------------------- | ------------------- |
| push / pull_request     | テスト・カバレッジ・E2E のみ                | api/web/worker CI   |
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

| 環境       | API health check timeout 時の挙動               |
| ---------- | ----------------------------------------------- |
| staging    | `exit 0`（続行を許容）                          |
| production | `exit 1`（schema compatibility 保証のため中断） |

**Worker の readiness について**

Worker は HTTP サーバーを持たないポーリングプロセスのため、health endpoint による readiness 確認ができない。現状は固定 wait（60秒）で代替しているが、将来的に Worker へ `/health/worker` エンドポイントを実装した場合は readiness check に置き換えることを推奨する。

---

### terraform-plan.yml の追加変更点

django-react からの移行差分に加え、以下の変更を行っている。

**追加修正**

| 変更箇所                        | 内容                                                                       |
| ------------------------------- | -------------------------------------------------------------------------- |
| `worker-config` フィルター追加  | `apps/worker/**` の変更を config-only change として検知                    |
| `continue-on-error: true` 削除  | plan 失敗を明示的に CI 失敗として扱う（失敗を見逃さない）                  |
| `terraform fmt` step 削除       | `terraform-fmt.yml` に責務を集約（plan workflow では validate/plan のみ）  |
| sticky PR comment 化            | push・force push・retry でコメントが増殖しないよう既存コメントを上書き更新 |
| `plan.txt` existence check 追加 | plan 失敗時に comment step が壊れないよう existence check を実装           |

**ワークフロー責務の分離**

| ワークフロー          | 責務                                |
| --------------------- | ----------------------------------- |
| `terraform-fmt.yml`   | フォーマットチェックのみ            |
| `terraform-plan.yml`  | validate + plan + PR コメント       |
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

| 変更            | 内容                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `nohup` 化      | `npm run start &` → `nohup env NODE_ENV=production npm run start > server.log 2>&1 &`（ゾンビプロセス防止・NODE_ENV 明示） |
| `wait-on` 強化  | HTTP ready のみ → tcp:3000 + http://localhost:3000 の2段階チェック（race condition 防止）                                  |
| server log 出力 | failure 時に `cat server.log` を実行して CI デバッグを容易にする                                                           |
| deploy timeout  | `deploy-from-terraform` job に `timeout-minutes: 5` を設定（Render API hang 対策）                                         |

## デプロイ運用方針

### 通常のコード変更

Render の `auto_deploy_trigger = "checksPass"` により、GitHub Actions の CI が
すべてパスした場合のみ自動デプロイされる。

### スキーマ変更・互換性に関わる変更時

以下に該当する変更を含む場合、checksPass による自動デプロイには
API ⇄ Worker ⇄ Web 間の順序保証がないため、`terraform-apply.yml` の
sequential deploy（API → Worker → Web）を手動実行すること。

- `packages/db/schema.prisma` の変更
- outbox payload の構造変更
- 新しい webhook イベントタイプの追加

### E2E（Playwright）の実行方針

Playwright E2E は pull_request 時のみ実行する。

理由:

- PR段階で品質保証を行うため
- 本番環境は定期 smoke test により継続監視するため
- CI時間短縮のため

## GitHubリポジトリ移行手順

GitHubアカウントまたはリポジトリを移行した場合の手順。

### 症状

- `terraform apply` で `repository not found` エラー
- Render UIに新リポジトリが表示されない
- GitHub側にはRender Appがインストール済みにもかかわらず選択できない

### 原因

Renderの Deployment Credential が旧GitHubアカウントに紐づいたままのため、
新リポジトリにアクセスできない。

### 手順

1. 新リポジトリを作成し、コードをpush
2. GitHub Fine-grained tokenを新リポジトリ用に発行し、以下のパーミッションを設定

   | パーミッション                                                                             | アクセス     |
   | :----------------------------------------------------------------------------------------- | :----------- |
   | code, metadata                                                                             | Read         |
   | actions, actions variables, administration, code quality, environments, secrets, workflows | Read & Write |

3. Terraform変数を更新（`repo_url`・`github_token`等）
4. Renderダッシュボード → Account Settings → GitHub → 旧Credentialを **Disconnect**
5. 新GitHubアカウントで再連携
6. `terraform apply`

### 注意

Disconnectしても既存サービスは即停止しない。
ただしGit連携・Auto Deploy・Previewが一時的に無効になる。
Terraform管理下であれば `terraform apply` で再デプロイ可能。

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

| ファイル                                       | 役割                                           |
| ---------------------------------------------- | ---------------------------------------------- |
| `apps/web/tests/e2e/todo.auth.spec.ts`         | Playwright による UI 操作（`@smoke` タグ付き） |
| `apps/worker/scripts/check-outbox.ts`          | Outbox チェーンの整合性確認スクリプト          |
| `cicd/workflows/e2e-smoke-test-staging.yml`    | staging smoke ワークフロー                     |
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

| 変数名                 | 説明                                    | デフォルト                                 |
| ---------------------- | --------------------------------------- | ------------------------------------------ |
| `DATABASE_URL`         | Neon PostgreSQL 接続文字列              | —                                          |
| `SMOKE_PREFIX`         | smoke テスト識別 prefix                 | `smoke-`                                   |
| `CHECK_WINDOW_MINUTES` | 確認対象の時間幅（分）                  | `5`                                        |
| `POLLING_INTERVAL_MS`  | polling 間隔（ms）                      | `5000`                                     |
| `POLLING_TIMEOUT_MS`   | polling タイムアウト（ms）              | `60000`（staging）/ `90000`（production）  |
| `STALE_PROCESSING_MS`  | processing を異常とみなす経過時間（ms） | `60000`（staging）/ `120000`（production） |

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

## TanStack Query Query Key の配置ルール

### 背景

TanStack Query の Query Key は、Client Component / Hook だけで使用するとは限らない。

Next.js App Router では、Server Component で `prefetchQuery` を実行し、`dehydrate()` した状態を `HydrationBoundary` で Client Component に渡す構成を使用する場合がある。

このとき、Query Key を `"use client"` が付いた Hook モジュールから export し、Server Component がその値を import すると、Server 側で Query Key が期待する配列ではなく `Function` として解決される問題が発生した。

#### 発生した問題

例えば、以下のように Query Key を `"use client"` モジュール内に定義していた。

```typescript
// ❌ useAlbums.ts
"use client";

export const ALBUM_QUERY_KEY = ["albums"] as const;
```

Server Component からこの値を import して `prefetchQuery` に渡すと、実行時には次のようになった。

```text
ALBUM_QUERY_KEY: [Function (anonymous)]
ALBUM_QUERY_KEY_TYPE: "function"
ALBUM_QUERY_KEY_IS_ARRAY: false
```

その結果、TanStack Query で以下の警告が発生した。

```text
As of v4, queryKey needs to be an Array.
```

さらに QueryCache では、

```text
queryKey: [Function (anonymous)]
queryHash: undefined
```

となり、`dehydrate()` / `HydrationBoundary` を利用した SSR → Client Hydration のキャッシュが正しく構築されなかった。

この問題は、`ALBUM_QUERY_KEY` と `UNASSIGNED_IMAGES_QUERY_KEY` の両方で発生した。

一方、Server Component で Query Key を直接配列として指定すると問題は発生せず、警告も `queryHash: undefined` も消えた。

### 解決策

Query Key は `"use client"` の Hook モジュールから分離し、各 Feature の `lib/queryKeys.ts` に配置する。

```text
features/
├── albums/
│   ├── hooks/
│   │   └── useAlbums.ts
│   └── lib/
│       └── queryKeys.ts
│
├── images/
│   ├── hooks/
│   │   └── useUnassignedImages.ts
│   └── lib/
│       └── queryKeys.ts
│
└── todos/
    ├── hooks/
    │   └── useTodo.ts
    └── lib/
        └── queryKeys.ts
```

Query Key の定義は `lib/queryKeys.ts` に置く。

```typescript
// features/albums/lib/queryKeys.ts
export const ALBUM_QUERY_KEY = ["albums"] as const;
```

```typescript
// features/images/lib/queryKeys.ts
export const UNASSIGNED_IMAGES_QUERY_KEY = ["images", "unassigned"] as const;
```

```typescript
// features/todos/lib/queryKeys.ts
export const TODO_QUERY_KEY = ["todos"] as const;
```

Hook 側では `lib/queryKeys.ts` から import する。

```typescript
// features/albums/hooks/useAlbums.ts
"use client";

import { ALBUM_QUERY_KEY } from "../lib/queryKeys";
```

Server Component 側でも、同じ `lib/queryKeys.ts` から直接 import する。

```typescript
// app/(auth)/albums/page.tsx
import { ALBUM_QUERY_KEY } from "@/features/albums/lib/queryKeys";
import { UNASSIGNED_IMAGES_QUERY_KEY } from "@/features/images/lib/queryKeys";
```

これにより、Query Key の共有経路は以下となる。

```text
features/*/lib/queryKeys.ts
        │
        ├── Client Hook
        │
        └── Server Component
```

`lib/queryKeys.ts` は `"use client"` を持たない純粋な共有モジュールとし、Server / Client 境界を跨いで安全に Query Key を共有できるようにする。

### 運用ルール

- Query Key は `features/<domain>/lib/queryKeys.ts` に定義する。
- `"use client"` の Hook モジュールに Query Key を定義しない。
- Server Component から `"use client"` モジュールの Query Key を import しない。
- Client Hook、Mutation Hook、Server Component のすべてで同一の `lib/queryKeys.ts` を参照する。
- `prefetchQuery` と Client 側の `useQuery` / `useSuspenseQuery` では、同一の Query Key を使用する。
- Query Key を変更する場合は、`prefetchQuery`、Hook、`invalidateQueries`、`getQueryData`、`setQueryData` など、同一キャッシュを参照するすべての箇所を確認する。

### 検証

今回の修正後、以下をすべて確認済み。

- `type-check` — OK
- `Vitest` — OK
- Docker Compose 開発環境での UI 確認 — OK
- Server 側 `prefetchQuery` の Query Key が配列として解決されることを確認
- TanStack Query の `queryKey needs to be an Array` 警告が発生しないことを確認
- QueryCache の `queryHash` が正常に生成されることを確認
- `dehydrate()` / `HydrationBoundary` による SSR → Client Hydration が正常に動作することを確認

### 重要な教訓

Next.js App Router で Server Component と Client Component の間で TanStack Query のキャッシュを共有する場合、Query Key は Client Hook の実装詳細ではなく、Server / Client の双方から参照される共有契約として扱う。

そのため、Query Key は `"use client"` モジュールから分離し、Feature 単位の `lib/queryKeys.ts` に配置する。

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

| 関心事         | 対策                                                |
| -------------- | --------------------------------------------------- |
| メッセージ消失 | Outbox パターン（DB commit と同一トランザクション） |
| 二重処理       | idempotency_key + processed_events による冪等性保証 |
| 障害追跡       | correlation_id による分散トレース                   |
| Worker 停止    | 起動時スイープ + 指数バックオフリトライ             |
| Vector 破損    | 全件再構築スクリプト                                |
| 手動回復       | failed イベントの requeue スクリプト                |

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

### Outbox Monitor

`apps/worker/src/monitor.ts` と `monitorOutboxService.ts` で実装。
Worker起動時に `startOutboxMonitoring()` が呼ばれ、5分ごとに監視を実行する。

監視項目:

- failed閾値
- stale processing
- retrying増加
- stale retrying

Sentry Cron Monitor（`monitor-outbox-job`）によって監視ジョブ自体も監視する。

`testMonitor*.ts` によりローカル環境で動作検証済み。
Sentry Issue生成・Alert Rule経由のメール通知到達まで確認済み（本番Cron Monitor通知は実環境で実証済み）。

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

詳細な演習手順は `doc/runbook.md` を参照。

- [doc/runbook.md](doc/runbook.md)

### correlation_id による分散トレース

Outbox payload に `correlation_id` を含め、Worker・FastAPI・Sentry に伝播させることで
非同期境界を跨いだ障害追跡を可能にしている。

```
Route Handler（correlation_id発行）
↓ outbox payload に保存
Worker（Sentry Contextsに追加）
↓ QStash経由
FastAPI（Sentry Contextsに追加）
↓
DB（outbox_events）・ログ（structlog / logger.ts）で correlation_id 検索 → 全チェーンを追跡可能
（Sentry Contextsは個々のIssue確認用として扱う。今回の実機検証ではSentry上での
横断検索は確認できなかった）
```

## Structured Logging（structlog）

### 設計方針

FastAPI側のログはstructlogで構造化する。Workerはlogger.tsでJSON形式に統一済み。

| サービス | ログ実装   | フォーマット                  |
| -------- | ---------- | ----------------------------- |
| FastAPI  | structlog  | JSON（本番）/ Console（開発） |
| Worker   | logger.ts  | JSON（常時）                  |
| Web      | Sentry中心 | Sentry経由                    |

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

### structlog化の状況

middleware・decorator・handler・reporting層、service層・infrastructure層、
uvicorn access logのJSON化まで、全コードのstructlog化が完了している。

全コードで`structlog.get_logger(__name__)`を使用する。`logging.getLogger`は新規コードに使用しない。

---

## エラー設計（BaseAppError 4層管理）

### 情報の4層

| フィールド      | 用途                     | 送信先             |
| --------------- | ------------------------ | ------------------ |
| `message`       | ユーザー向けメッセージ   | フロントエンド表示 |
| `data`          | 修正可能な開発ヒント     | フロントエンド表示 |
| `safe_context`  | Sentry送信可能な内部情報 | Sentryのみ         |
| `internal_info` | 完全内部情報             | ローカルログのみ   |

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

## フロントエンドの例外処理アーキテクチャ

UXを変更せず、内部の責務整理のみを目的とする。

### 責務分担

| コンポーネント                        | 責務                                                                                          | やらないこと                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `AsyncBoundary`                       | Suspense fallback と ErrorBoundary の橋渡し                                                   | ログ送信・UIのフォールバック実装そのもの               |
| `ErrorBoundary`（error-boundary.tsx） | render中例外の捕捉・フォールバックUI表示・`errorHandler`呼び出し・`sentry-logger`への送信委譲 | Sentry送信の実装自体（`sentry-logger.ts`が実装を持つ） |
| `sentry-logger.ts`                    | Reactツリー内例外のSentry送信（componentStack前提）                                           | サーバーサイドの例外送信（`server-logger.ts`が担当）   |
| `server-logger.ts`                    | Route Handler / Service層 / GraphQL resolver の例外のSentry送信                               | UI表示・トースト表示                                   |
| `error-handler.ts`                    | Error型の判別とトースト表示                                                                   | ログ送信（Sentry送信は行わない）                       |

### ログ送信経路

Client Render Error
│
▼
ErrorBoundary
│
▼
sentry-logger.ts
────────────────────────
Server Error
（Route Handler / Service / GraphQL Resolver）
│
▼
server-logger.ts

### エラーの流れ（全体）

Server側
Route Handler / Service / Resolver
│
▼
server-logger.ts（logServiceError）
│
▼
throw / return error object
──────────────────────────────
Client側
TanStack Query（useApiSuspenseQuery / useApiMutation）
│
├─ Suspense例外 → AsyncBoundary → ErrorBoundary
│ │
│ ├─ sentry-logger.ts（componentStack付きSentry送信）
│ └─ error-handler.ts（トースト表示）
│
└─ mutation例外 → error-handler.ts（トースト表示のみ、Sentry送信なし）

### 注意事項

- 本セクションの整理ではトースト表示の挙動を変更していない。ErrorBoundaryがrender中例外でトーストも出す設計は意図的な既存仕様として維持する。
- mutationのonErrorをカスタムで渡す場合、呼び出し側で独自にtoastを出すと`errorHandler`のtoastと二重表示になる。カスタムonErrorはUI更新用途に留め、通知はerrorHandlerに任せること。
- pageName/componentNameはSentryのextraとして送られるが、tagには含めない（pageName/componentNameは値の種類が多くcardinalityが高いため）。correlation_idはtagsではなくSentry Contextsの`correlation`（`{ correlation_id }`）に格納する統一方針であり（「Sentryタグ・Contextsの統一」参照）、tags / context（extra）/ Contextsは別々のSentry機能である点に注意すること。
- FastAPI呼び出し（`todos/search`等）で相手が4xxを返した場合はログ不要（業務上想定される応答）。5xxのみ`logServiceError`で記録する。ログレベル（warning/error等の使い分け）自体の設計は今回の整理の対象外とし、別Issueで検討する。
- `imageUploadService.ts`はクライアント側実装のため`server-logger.ts`の対象外。`errorHandler`によるトースト表示で完結する。
- `todoServiceGraphQL.ts`のthrow ApiErrorがREST Route Handler側でcatchされず500になる既知の課題は、GraphQL単独移行時の対応事項として別途扱う（本整理では対応しない）。

---

## observability設計

### Sentryタグ・Contextsの統一

| 種類     | 項目          | 値の例                                                             | 用途                                                     |
| -------- | ------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| Tag      | `service`     | `api` / `worker` / `web`                                           | サービス識別                                             |
| Tag      | `component`   | TodoWebhookService / VectorSearchService / webhook / outbox-worker | コンポーネント識別                                       |
| Tag      | `event_type`  | `todo.created`                                                     | Workerのイベント種別                                     |
| Contexts | `correlation` | `{ correlation_id: UUID }`                                         | Sentry Issue個別調査用（横断検索には非対応。下記注参照） |

**注意**: `correlation_id`はUUIDのためcardinalityが高く、tagsには入れない。API・Worker・Webの
いずれも Sentry Contexts の `correlation`（`{ correlation_id }`）に格納する（tags・
context（extra）とは別のSentry機能）。Sentry Contextsの`correlation_id`は個々のIssue確認用
として扱う。今回の実機検証では、Contextの項目を指定した検索・フィルタおよび複数サービスを
跨いだ横断検索は確認できなかったため、横断追跡はDB・ログ側の検索を基本とする。

### correlation_idによる横断追跡

Next.js（correlation_id発行）
↓ outbox payloadに保存
Worker（Sentry Contextsに追加・ログにbind）
↓ QStash経由
FastAPI middleware（ヘッダーから取得・contextvarsにbind）
↓
全サービスのログ（structlog / logger.ts）をcorrelation_idで横断検索可能。
Sentry Contextsのcorrelation_idは個々のIssue確認用として扱う。今回の実機検証では
Sentry上でのcorrelation_id横断検索は確認できなかった（詳細は「Sentryタグ・Contextsの統一」参照）。

### ログに含めてはいけないもの

- `str(request.url)` → `request.scope.get("path")` を使う
- `internal_info` の生値 → Sentryにも送らない。`has_internal_info: bool` のみ
- APIトークン・JWT・パスワード・メールアドレス・リクエストボディ
- embedding対象テキスト・検索クエリ（PII混入率が高い）→ `text_length=len(text)` のみ記録

### メールアドレスの折衷案（障害調査と個人情報保護のバランス）

email_domain=email.split("@")[-1] # ドメインのみ記録（個人を特定しない）

### API Sentryタグの自動付与

`ErrorMonitor.log_error()` は `service=api` を自動付与する（`setdefault` による）。
呼び出し側は `component` のみ設定すればよい。

- `service_error_handler` 経由: `component=クラス名`（例: `TodoWebhookService`）
- `log_webhook_call` 経由: `component=webhook`

## 監視ポリシー（Monitoring Policy）

### 監視の分類

このプロジェクトの監視は3つに分離して管理する。

| 分類       | 対象                          | 手段                          |
| ---------- | ----------------------------- | ----------------------------- |
| Sentry監視 | structlogイベント（アプリ層） | Sentry Alert Rule             |
| DB監視     | outbox_eventsステータス       | monitor-outbox.ts（定期実行） |
| Smoke Test | チェーン全体の疎通確認        | check-outbox.ts（CI/CD）      |

### Sentry Alert Rule

| Severity | イベント名                 | 条件          |
| -------- | -------------------------- | ------------- | ------------ |
| Warning  | `embedding_failed`         | 5件以上 / 5分 |
| Warning  | `vector_upsert_failed`     | 5件以上 / 5分 |
| Warning  | `motherduck_insert_failed` | 5件以上 / 5分 |
| Warning  | `dlt_pipeline_failed`      | 連続2回失敗   |

通知先：Slack（staging: `#dev-alerts` / production: `#prod-alerts`）

`unsupported_event_type`はAnalyticsEventTypeによる入力制約によりサービス層では発生しないため、監視対象外とした。

### DB監視（Outbox）

| Severity | 対象                            | 条件                                          | 実装              |
| -------- | ------------------------------- | --------------------------------------------- | ----------------- |
| Critical | `outbox_events.status = failed` | 5件以上 / 5分                                 | monitor-outbox.ts |
| Warning  | processing滞留                  | `status=processing` かつ60秒超が5件以上       | monitor-outbox.ts |
| Warning  | retrying増加                    | `status=retrying` が10件以上                  | monitor-outbox.ts |
| Warning  | retrying滞留                    | 同一イベントが15分以上 `status=retrying` 継続 | monitor-outbox.ts |

監視スクリプト：

- `apps/worker/src/monitor.ts` / `monitorOutboxService.ts` で実装。
- Worker起動時に `startOutboxMonitoring()` が呼ばれ、5分間隔でポーリング監視する。
- Sentry Cron Monitor（`monitor-outbox-job`）でこの監視ジョブ自体の死活も二重監視している。
- ローカル環境での動作確認は `testMonitorFailed.ts` 等のテストスクリプトで実施済み

### Smoke Test（check-outbox.ts）

CI/CDパイプラインのsmoke test専用。全ユーザーイベントではなく
`SMOKE_PREFIX`で識別されたテスト用イベントのみを確認対象とする。
運用監視とは責務が異なるため混在させない。

### staging / production の差分

| 項目         | staging       | production     |
| ------------ | ------------- | -------------- |
| Warning閾値  | 10分で10件    | 5分で5件       |
| Critical閾値 | 10分で5件     | 5分で5件       |
| 通知先       | `#dev-alerts` | `#prod-alerts` |

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

| 項目            | 値                   |
| --------------- | -------------------- |
| Monitor slug    | `monitor-outbox-job` |
| Schedule        | Every 5 minutes      |
| Check-in margin | 2 minutes            |
| Max runtime     | 2 minutes            |

Workerコンテナが停止すると Check-in が途絶え Slack通知が飛ぶ（二重監視）。

### monitor-outbox テスト時の注意

- `testMonitor*.ts` は開発環境専用
- `event_type = "monitor.test"` のテストレコードを作成する
- テスト後は必ず `cleanupMonitorTestEvents.ts` を実行すること
- `testMonitorStaleRetrying.ts` は `updated_at` を過去時刻でINSERTして stale retrying を再現する

---

## ⚠️ 外部SaaSのTerraform管理方針（設計判断 / ADR）

このプロジェクトでは、一部の外部SaaSサービスを**意図的にTerraform管理から外し、UI管理（Workspace Variables経由のパススルー）**を採用しています。

### 対象サービスと理由

| サービス   | Terraform管理 | 理由                                                                                                                                |
| :--------- | :------------ | :---------------------------------------------------------------------------------------------------------------------------------- |
| **Auth0**  | ❌ UI管理     | Providerの認証自体がManagement API（手動作成済みアプリ）に依存。`client_secret`のstate保存はセキュリティリスク                      |
| **Sentry** | ❌ UI管理     | alert系リソースが過渡期（Deprecated/Beta）。Personal Token必須で組織管理に不向き。詳細は「Sentry Alert Rule管理方針」セクション参照 |
| **QStash** | ❌ UI管理     | アカウント単位のリソースでプロジェクト単位での作成が不要。signing keyはProviderから取得不可                                         |

### 共通パターン

これら3サービスに共通する問題は、Terraform Providerが存在していても**サービス全体のライフサイクル管理をTerraformへ集約できない**点である。

- Provider認証自体が手動作成済みリソースに依存
- 初期セットアップがUI依存
- 運用上重要な設定の多くがUI依存
- Terraformで管理できる範囲が限定的

結果として、Provider維持コスト（state管理・認証情報管理・Provider追従）に対して得られるメリットが小さいため、本プロジェクトではUI管理を採用する。

なお、`var.auth0_domain` や `var.sentry_dsn_*` 等の変数が存在するのは、これらの値をTerraform CloudのWorkspace Variables経由でRenderやGitHubへパススルーするためであり、対応するProviderリソースが存在しないのは上記の理由による意図的な設計である。

### Workspace Variablesに手動登録が必要な変数

| 変数名                       | サービス | 取得元                                                                   |
| :--------------------------- | :------- | :----------------------------------------------------------------------- |
| `auth0_domain`               | Auth0    | ダッシュボード → Settings → General → Domain                             |
| `auth0_client_id`            | Auth0    | ダッシュボード → Applications → 該当アプリ → Client ID                   |
| `auth0_client_secret`        | Auth0    | ダッシュボード → Applications → 該当アプリ → Client Secret               |
| `qstash_token`               | QStash   | Upstashダッシュボード → QStash → Settings → `QSTASH_TOKEN`               |
| `qstash_current_signing_key` | QStash   | Upstashダッシュボード → QStash → Settings → `QSTASH_CURRENT_SIGNING_KEY` |
| `qstash_next_signing_key`    | QStash   | Upstashダッシュボード → QStash → Settings → `QSTASH_NEXT_SIGNING_KEY`    |
| `sentry_dsn_web`             | Sentry   | ダッシュボード → webプロジェクト → Settings → Client Keys                |
| `sentry_dsn_api`             | Sentry   | ダッシュボード → apiプロジェクト → Settings → Client Keys                |
| `sentry_dsn_worker`          | Sentry   | ダッシュボード → workerプロジェクト → Settings → Client Keys             |

## Upstash環境分離方針

### 構成

staging・production それぞれ別のUpstashアカウントを使用し、
Redis・Vector Index を環境ごとに作成する。

### 理由

- Upstash Free Plan は Redis / Vector ともに作成数制限がある
- terraform_remote_state による state 共有は環境間依存が発生する
- 手動で URL / Token をコピーする運用は Terraform 管理外となる
- staging / production を完全に独立させた方が障害影響範囲を限定できる
- 将来的に有料プランへ移行しても Terraform 構成を変更する必要がない

### Neon と Upstash の分離方針の違い

Neon は同一アカウント内で Project 単位に環境分離できるため、
staging / production を別 Project として管理する。

Upstash Free Plan はリソース数制限があるため、
環境ごとに別アカウントを使用して分離する。

### 採用しなかった案

- terraform_remote_state による staging → production 共有
- Redis / Vector の環境共用
- URL / Token の手動コピー運用

いずれも環境間依存または Terraform 管理外の設定が増えるため採用しない。

---

## terraform apply後の手動作業

`terraform apply`完了後、以下の作業が別途必要です。

### Auth0（ダッシュボードで確認）

以下の設定になっていることを確認する。

| 設定項目              | 期待値                                                    |
| :-------------------- | :-------------------------------------------------------- |
| Allowed Callback URLs | `https://<app_name>-<env>-web.onrender.com/auth/callback` |
| Allowed Logout URLs   | `https://<app_name>-<env>-web.onrender.com`               |
| Allowed Web Origins   | `https://<app_name>-<env>-web.onrender.com`               |

### QStash（Upstashダッシュボードで設定）

**processed_eventsクリーンアップのSchedule**

| 項目 | 値                                                               |
| :--- | :--------------------------------------------------------------- |
| URL  | `https://<FASTAPI_PUBLIC_URL>/internal/cleanup/processed-events` |
| Cron | `0 18 * * *`（JST 03:00）                                        |

**dlt-pipeline エンドポイントのタイムアウト設定**

`/webhooks/dlt-pipeline` は同期処理のため、Upstashダッシュボードでendpoint timeoutを5〜10分に設定すること。デフォルト（30秒）のままだとQStashがタイムアウトと判断してretryを繰り返し、パイプラインが重複実行される。

### Sentry（UIでAlert Rule設定）

詳細は「Sentry Alert Rule管理方針」セクションを参照。

### Prismaマイグレーション（初回デプロイ時）

```bash
npx prisma migrate deploy
```

---

## Render Worker運用方針

### 本来構成

- Web Service
- API Service
- Background Worker

### staging

Render Free Planでは
Background Workerが利用できない。

そのため Worker を
Web Service としてデプロイする。

### 理由

本プロジェクトの目的は
ユーザー運用ではなく
アーキテクチャ検証である。

Worker停止時も
OutboxイベントはDBへ保存されるため
データ損失は発生しない。

Worker復帰時に
recoverStaleEvents() により回収される。

### Workerエントリーポイント

エントリーポイントは `index.ts` に一本化されている。
現在は Render Web Service としてデプロイしているため、Worker本体に加えてヘルスチェック用のダミーHTTPサーバーを起動している。Background Workerへ移行した場合はHTTPサーバー部分は不要となる。

---

## ⚠️ Sentry Alert Rule 管理方針（設計判断 / ADR）

本プロジェクトでは、Sentry の Project・DSN・Team などの「インフラ基盤」のみを Terraform でコード管理し、Issue Alert や Slack 通知ルールなどの「アラート運用設定」は **Sentry UI（管理画面）で直接管理する方針**を採用しています。

### 1. 責任の切り分け（Terraform vs UI）

| 管理レイヤー       | 管理対象リソース                                                                                                  | 変更頻度と性質                                                                              |
| :----------------- | :---------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| **Terraform 管理** | ・Sentry Organization<br>・Sentry Team<br>・Sentry Project<br>・Sentry DSN (`sentry_key`) の環境変数連携          | **極めて低い**<br>認証や疎通の土台であり、Infrastructure as Code (IaC) の恩恵が大きいもの。 |
| **Sentry UI 管理** | ・Issue Alert (アラートルール)<br>・Slack 通知設定<br>・Alert Threshold (検知閾値)<br>・Alert Routing / Frequency | **中〜高**<br>システムのノイズ量や運用ポリシーに応じて、現場で柔軟に微調整すべきもの。      |

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
  - 設定例： `The issue's tags.event_type equals [対象のイベント名]`
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

| 変数名                                            | 必須/任意 | 用途・依存サービス                            | 備考 / 設定値の例                                      |
| :------------------------------------------------ | :-------- | :-------------------------------------------- | :----------------------------------------------------- |
| `SECRET_KEY`                                      | 必須      | FastAPI 内部セキュリティ用                    | 任意のランダム文字列                                   |
| `DATABASE_URL`                                    | 必須      | メインDB (Neon/PostgreSQL) 接続用             | 読み取り・冪等性チェック等で使用                       |
| `PIPELINE_DATABASE_URL`                           | 必須      | dlt パイプライン用 DB 接続文字列              | 通常は `DATABASE_URL` と同一                           |
| `QSTASH_URL` / `TOKEN`                            | 必須      | 非同期処理 (Upstash QStash)                   | Webhook 配信元検証用                                   |
| `QSTASH_CURRENT_SIGNING_KEY` / `NEXT_SIGNING_KEY` | 必須      | QStash 署名検証用キー                         | 受信した Webhook の正当性検証に必須                    |
| `UPSTASH_VECTOR_REST_URL` / `TOKEN`               | 必須      | セマンティック検索 (Upstash Vector)           | ベクトルインデックスの操作用                           |
| `UPSTASH_REDIS_REST_URL` / `TOKEN`                | 必須      | レートリミット / dlt ロック用 (Upstash Redis) | 分散ロック・Ratelimit で使用                           |
| `GEMINI_API_KEY`                                  | 必須      | 埋め込み生成 (Google Gemini API)              | `gemini-embedding-001` で使用                          |
| `RESEND_API_KEY`                                  | 必須      | メール送信 (Resend)                           | ユーザー登録時等の通知用                               |
| `MOTHERDUCK_TOKEN`                                | 必須      | 分析データウェアハウス (MotherDuck)           | DuckDB への接続認証                                    |
| `DLT_DATASET_NAME` / `DLT_PIPELINE_NAME`          | 必須      | dlt パイプライン設定                          | 同期データの格納先・識別用                             |
| `DLT_LOCK_KEY` / `DLT_LOCK_TIMEOUT`               | 任意      | dlt 実行時の並行性制御ロック                  | デフォルト値は `.env.example` 参照                     |
| `INTERNAL_API_SECRET`                             | 必須      | Next.js からの同期通信認証トークン            | `openssl rand -hex 32` で生成（apps/web と一致させる） |
| `SENTRY_DSN`                                      | 任意      | エラー監視 (Sentry)                           | ローカル開発時は空でも可                               |

#### 2. apps/web (Next.js)

主にユーザー認証（Auth0）、Prisma経由のアプリケーションAPI、レートリミット、およびフロントエンドのエラー監視に使用します。

| 変数名                                                                         | 必須/任意 | 用途・依存サービス                    | 備考 / 設定値の例                                                        |
| :----------------------------------------------------------------------------- | :-------- | :------------------------------------ | :----------------------------------------------------------------------- |
| `APP_BASE_URL`                                                                 | 必須      | Web アプリケーションのベース URL      | ローカル開発およびPlaywright E2Eでは`http://localhost:3000` を使用する。 |
| `BACKEND_API_URL`                                                              | 必須      | Docker 内部の FastAPI への通信用      | ローカル: `http://api:8000`                                              |
| `AUTH0_DOMAIN` / `CLIENT_ID` / `CLIENT_SECRET`                                 | 必須      | ユーザー認証 (@auth0/nextjs-auth0)    | Auth0 ダッシュボードから取得                                             |
| `AUTH0_ISSUER_BASE_URL` / `AUTH0_SECRET`                                       | 必須      | Auth0 セッション暗号化など            | `AUTH0_SECRET` は `openssl rand -hex 32`                                 |
| `AUTH0_COOKIE_SAME_SITE` / `SECURE`                                            | 任意      | クッキーのセキュリティ設定            | ローカル: `lax` / `false`、https環境であるならデフォルでOK               |
| `UPSTASH_REDIS_REST_URL` / `TOKEN`                                             | 必須      | レートリミット (Upstash Ratelimit)    | Route Handler での制限用                                                 |
| `INTERNAL_API_SECRET`                                                          | 必須      | 内部API認証用共有シークレット         | `openssl rand -hex 32` で生成（apps/api と一致させる）                   |
| `E2E_TEST_EMAIL` / `PASSWORD`                                                  | 任意      | Playwright E2E テスト用固定アカウント | Auth0 レート制限回避のため必須                                           |
| `SENTRY_DSN` / `ORG` / `PROJECT`                                               | 任意      | フロント/バックエンドのエラー監視     | ローカル開発時は空でも可                                                 |
| `B2_ENDPOINT` / `B2_REGION` / `B2_KEY_ID` / `B2_APPLICATION_KEY` / `B2_BUCKET` | 必須      | リージョン・バケット名は任意値        |

#### 3. apps/worker (Node.js Worker)

Outbox テーブルを監視し、QStash 経由で FastAPI にイベントを中継します。

| 変数名                 | 必須/任意 | 用途・依存サービス                    | 備考 / 設定値の例                                                                                        |
| :--------------------- | :-------- | :------------------------------------ | :------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | 必須      | メインDB (Neon/PostgreSQL) 接続用     | Prisma クライアントが使用（※必須）                                                                       |
| `FASTAPI_PUBLIC_URL`   | 必須      | QStash から FastAPI へ送信する際のURL | Codespaces時は転送URL、`APP_BASE_URL` には使用しない。本番はパブリックURL、ローカルのlocalhostは使用不可 |
| `QSTASH_URL` / `TOKEN` | 必須      | 非同期メッセージング (Upstash QStash) | Worker からのイベント Enqueue 用                                                                         |
| `SENTRY_DSN`           | 任意      | Worker のエラー監視 (Sentry)          | ローカル開発時は空でも可                                                                                 |
| `INTERNAL_API_SECRET`  | 必須      | 内部API認証用共有シークレット         | Worker からのrebuildVectorIndex用                                                                        |

### Environment Variable Source of Truth

| 環境           | 値の供給元                 |
| -------------- | -------------------------- |
| Local          | .env                       |
| Docker Compose | .env                       |
| GitHub Actions | GitHub Secrets / Variables |
| Render         | Terraform が注入           |

### Local Development

開発時は Docker Compose を使用する。

APP_BASE_URL=http://localhost:3000

を使用する。

Codespaces の転送 URL は
FASTAPI_PUBLIC_URL 用であり、
APP_BASE_URL には使用しない。

## 見出し階層の設計原則（h1/h2/h3）

ページの最上位見出しはh1とし、ページ内の主要セクションはh2、その配下のサブセクションはh3とする。
ページ構成上不要な階層は無理に追加せず、見出しレベルを飛ばさない（例: h1の次にh3を置かない）。