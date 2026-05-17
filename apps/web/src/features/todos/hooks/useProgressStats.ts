import { useApiSuspenseQuery } from "@/hooks/useSuspenseQuery";
import { ProgressStatsResponse } from "../services/todoService";
import { getBaseUrl } from "@/lib/constants";

export const useProgressStats = () => {
  return useApiSuspenseQuery<ProgressStatsResponse>({
    queryKey: ["todos", "progress-stats"],
    queryFn: async () => {
      if (typeof window === "undefined") {
        return []; // または初期値の構造 { total: 0, ... }
      }
      const res = await fetch(`${getBaseUrl()}/api/todos/progress-stats`);
      if (!res.ok) throw new Error("Failed to fetch progress stats");
      return res.json();
    },
  });
};
