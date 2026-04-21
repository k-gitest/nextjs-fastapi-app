import { Client } from "@upstash/qstash";
import { QSTASH_TOKEN } from "./constants";

export const qstashClient = new Client({
  token: QSTASH_TOKEN!,
});