import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import {
  B2_ENDPOINT,
  B2_REGION,
  B2_BUCKET,
  B2_KEY_ID,
  B2_APPLICATION_KEY,
} from "../config";

/**
 * Worker専用の最小B2クライアント。
 *
 * apps/web/src/lib/b2.tsとの重複を許容している。Workerには
 * StorageCleanupTaskのB2削除リトライに必要な最小限の機能のみを持たせており、
 * B2アクセス層全体をモノレポ共通パッケージ化する設計にはしていない
 * （packages/storageのような共通化は、Image Lifecycle全体をWorker管理へ
 * 再設計する場合に改めて判断する）。
 *
 * PUT・署名URL発行はWeb側の責務のままであり、Workerには持たせない。
 * ここではStorageCleanupTaskの回収に必要なDeleteObjectのみを実装する。
 */
const b2Client = new S3Client({
  endpoint: B2_ENDPOINT,
  region: B2_REGION,
  credentials: {
    accessKeyId: B2_KEY_ID,
    secretAccessKey: B2_APPLICATION_KEY,
  },
  forcePathStyle: true,
});

export const deleteB2Object = async (storageKey: string): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: B2_BUCKET,
    Key: storageKey,
  });

  await b2Client.send(command);
};