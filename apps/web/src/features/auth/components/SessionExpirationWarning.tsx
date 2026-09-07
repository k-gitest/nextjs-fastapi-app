"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSessionExpirationWarning } from "../hooks/useSessionStatus";

export function SessionExpirationWarning() {
  const { isNearExpiry } = useSessionExpirationWarning();

  if (!isNearExpiry) return null;

  return (
    <Alert className="rounded-none border-x-0 border-t-0 bg-amber-50 text-amber-900 [&_svg]:text-amber-900">
      <AlertDescription>
        セッションの有効期限が近づいています。作業中の内容を保存し、再ログインしてください。
      </AlertDescription>
    </Alert>
  );
}