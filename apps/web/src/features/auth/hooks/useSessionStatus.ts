"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSessionStatus } from "./sessionStatusApi";
import { SESSION_STATUS_QUERY_KEY } from "../lib/queryKeys";

const WARNING_THRESHOLD_SECONDS = 30 * 60;
const POLL_INTERVAL_MS = 5 * 60 * 1000;
const TICK_INTERVAL_MS = 60 * 1000;

export function useSessionExpirationWarning() {
  const { data } = useQuery({
    queryKey: SESSION_STATUS_QUERY_KEY,
    queryFn: fetchSessionStatus,
    refetchInterval: (query) => (query.state.data === null ? false : POLL_INTERVAL_MS),
    refetchOnWindowFocus: false,
  });

  // "現在時刻"はpropsやstateから導出できない外部の値のため、
  // レンダー本体では読まず、Effect経由でstateとして購読する
  // （Date.now()をレンダー中に直接呼ぶとimpureになるため）。
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick(); // マウント時点の値を即時反映
    const id = setInterval(tick, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const isNearExpiry =
    data?.status === "ok" && now !== null
      ? (() => {
          const remainingSeconds = data.expiresAt - Math.floor(now / 1000);
          return remainingSeconds > 0 && remainingSeconds <= WARNING_THRESHOLD_SECONDS;
        })()
      : false;

  return { isNearExpiry };
}