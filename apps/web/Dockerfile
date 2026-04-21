# --- 1. ビルドステージ ---
FROM node:22-slim AS builder
RUN apt-get update -y && apt-get install -y openssl libssl-dev
WORKDIR /workspace/apps/web

# Turboを利用する場合、ルートのpackage.jsonも必要になるため、
# 開発時は compose の volume で解決し、Dockerfile内では最小限をコピー
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm install

COPY . .

# --- 2. 最終ステージ (実行環境) ---
FROM node:22-slim AS final
WORKDIR /workspace/apps/web

COPY --from=builder /workspace/apps/web /workspace/apps/web

ENV NODE_ENV=production
EXPOSE 3000

# Next.js 実行
CMD ["npm", "run", "start"]