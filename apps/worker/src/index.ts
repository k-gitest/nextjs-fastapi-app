import { PrismaClient } from '@prisma/client';
import { startWorkerLoop } from './worker';
import { logger } from './utils/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting outbox worker...');

  // 1. 起動時スイープ：2分以上ロックされたままのゾンビイベントをリセット
  // retry_count > 0 なら 'retrying' に、それ以外は 'pending' に戻す
  const recovered = await prisma.$executeRaw`
    UPDATE outbox_events 
    SET locked_at = NULL, 
        status = CASE 
                   WHEN retry_count > 0 THEN 'retrying'::"OutboxStatus" 
                   ELSE 'pending'::"OutboxStatus" 
                 END
    WHERE status = 'processing' 
      AND locked_at < NOW() - INTERVAL '2 minutes'
  `;
  logger.info(`Recovered ${recovered} stale events.`);

  // 2. メインループ開始
  await startWorkerLoop(prisma);
}

main().catch(e => {
  logger.error('Worker failed to start', { error: e.message });
  process.exit(1);
});