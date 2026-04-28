# --- 1. ビルドステージ ---
FROM node:22-slim AS builder
RUN apt-get update -y && apt-get install -y openssl libssl-dev
WORKDIR /app

# Turboを利用する場合、ルートのpackage.jsonも必要になるため、
# 開発時は compose の volume で解決し、Dockerfile内では最小限をコピー
COPY apps/web/package.json apps/web/package-lock.json* ./
# モノレポルートからコンテキストを取り込む
COPY package.json package-lock.json ./
COPY packages/db/package.json ./packages/db/
COPY apps/web/package.json ./apps/web/

RUN npm ci

COPY packages/db ./packages/db
COPY apps/web ./apps/web

# Prismaクライアント生成（packages/dbのスキーマを参照）
RUN npm run db:generate

WORKDIR /app/apps/web
RUN npm run build

# --- 2. 最終ステージ (実行環境) ---
FROM node:22-slim AS final
RUN apt-get update -y && apt-get install -y openssl libssl-dev
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

ENV NODE_ENV=production
EXPOSE 3000

# Next.js 実行
CMD ["npm", "start", "--prefix", "apps/web"]