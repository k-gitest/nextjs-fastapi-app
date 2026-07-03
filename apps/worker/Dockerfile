FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/db/package.json ./packages/db/
COPY apps/worker/package.json ./apps/worker/

RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules

COPY package.json ./

COPY packages/db ./packages/db
COPY apps/worker ./apps/worker

RUN npm run db:generate

WORKDIR /app/apps/worker
RUN npm run build

FROM base AS runner
WORKDIR /app

# 1. ルートの node_modules と、apps/worker の両方を正しい配置でコピーする
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker/node_modules ./apps/worker/node_modules

# 2. 成果物(dist)を、ビルド前と同じ元の場所に配置する
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist

# 3. Prismaなどの共通パッケージ情報が必要な場合はそれも正しい位置へ
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json

# 4. 実行時の作業ディレクトリ（WORKDIR）を「apps/worker」に変更する ★超重要
WORKDIR /app/apps/worker

# 5. 起動コマンドを apps/worker 起点にする
CMD ["node", "dist/src/index.js"]