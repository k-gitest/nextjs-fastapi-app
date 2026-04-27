FROM node:20-slim

WORKDIR /app

# Prismaがglibcを必要とするため
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

CMD ["node", "dist/index.js"]