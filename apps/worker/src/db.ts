import { PrismaClient } from '@repo/db';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});