// インスタンスは生成しない。型とクラスのみ再エクスポート。
// Runtime APIは明示的に再exportし、Prisma生成型は型のみ再exportする。
// 新しいモデル型の追加ではこのファイルの更新は不要だが、
// runtimeで利用する新しいenum等は明示的に追加する。
export {
  PrismaClient,
  Prisma,
  Priority,
  StorageCleanupReason,
} from "@prisma/client";

export type * from "@prisma/client";