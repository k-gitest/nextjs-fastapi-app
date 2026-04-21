"use client";

import { useEffect } from "react";
import { logErrorToSentry } from "@/errors/sentry-logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // サーバーエラーなどをここから送信
    logErrorToSentry(error, 'page');
  }, [error]);

  return (
    <div>
      <h2>エラーが発生しました</h2>
      <button onClick={() => reset()}>再試行する</button>
    </div>
  );
}