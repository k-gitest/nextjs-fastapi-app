import { PrismaClient } from '@repo/db';

const prisma = new PrismaClient();
const id = process.argv[2];

if (!id) {
  console.error('Usage: tsx scripts/requeueFailedEvent.ts <event_id>');
  process.exit(1);
}

const result = await prisma.outbox_events.updateMany({
  where: { id, status: 'failed' },
  data: {
    status: 'pending',
    retry_count: 0,
    locked_at: null,
    next_retry_at: null,
  },
});

if (result.count === 0) {
  console.error(`Event ${id} not found or not in failed status`);
  process.exit(1);
}

console.log(`Event ${id} requeued successfully`);
await prisma.$disconnect();