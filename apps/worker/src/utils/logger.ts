type LogMeta = Record<string, unknown>;

const BASE_FIELDS = {
  service: "worker",
  component: "outbox-worker",
} as const;

export const logger = {
  info: (msg: string, meta?: LogMeta) =>
    console.log(JSON.stringify({ level: "info", msg, ...BASE_FIELDS, ...meta })),
  warn: (msg: string, meta?: LogMeta) =>
    console.warn(JSON.stringify({ level: "warn", msg, ...BASE_FIELDS, ...meta })),
  error: (msg: string, meta?: LogMeta) =>
    console.error(JSON.stringify({ level: "error", msg, ...BASE_FIELDS, ...meta })),
};