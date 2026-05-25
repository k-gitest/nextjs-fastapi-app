import { PrismaClient } from "@repo/db";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--all")) {
    // 全failedイベントをrequeue
    const result = await prisma.outbox_events.updateMany({
      where: { status: "failed" },
      data: {
        status: "pending" as const,
        retry_count: 0,
        locked_at: null as null,
        next_retry_at: new Date(),
      },
    });

    if (result.count === 0) {
      console.error("No failed events found");
      process.exit(1);
    }

    console.log(`${result.count} events requeued successfully`);
    return;
  }

  const id = args[0];

  if (!id) {
    console.error(
      "Usage: tsx scripts/requeueFailedEvent.ts <event_id>\n" +
        "       tsx scripts/requeueFailedEvent.ts --all",
    );
    process.exit(1);
  }

  // 特定イベントをrequeue
  const result = await prisma.outbox_events.updateMany({
    where: { id, status: "failed" },
    data: {
      status: "pending" as const,
      retry_count: 0,
      locked_at: null as null,
      next_retry_at: new Date(),
    },
  });

  if (result.count === 0) {
    console.error(`Event ${id} not found or not in failed status`);
    process.exit(1);
  }

  console.log(`Event ${id} requeued successfully`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
