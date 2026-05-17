import { useApiSuspenseQuery } from "@/hooks/useSuspenseQuery";
import { TodoStatsResponse } from "../services/todoService";
import { getBaseUrl } from "@/lib/constants";

export const useTodoStats = () => {
  return useApiSuspenseQuery<TodoStatsResponse>({
    queryKey: ["todos", "stats"],
    queryFn: async () => {
      if (typeof window === "undefined") {
        return []; // または初期値の構造 { total: 0, ... }
      }
      const res = await fetch(`${getBaseUrl()}/api/todos/stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return await res.json();
    },
  });
};
