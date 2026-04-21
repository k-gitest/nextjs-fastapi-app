//import { useApiQuery } from "@/hooks/use-tanstack-query";
import { useApiSuspenseQuery } from "@/hooks/useSuspenseQuery";
import { TodoStatsResponse } from "../services/todoService";
import { getBaseUrl } from "@/lib/constants";

/*
type TodoStatsData = {
  priority: string;
  count: number;
  fill: string;
}[];
*/

//type StatsRes = Awaited<ReturnType<typeof todoService.getTodoStats>>;

/*
export const useTodoStats = () => {
  return useApiQuery<TodoStatsData>({
    queryKey: ['todos', 'stats'],
    queryFn: async () => {
      const response = await todoService.getTodoStats();
      return response.map(item => ({
        priority: item.priority,
        count: item.count,
        fill: `var(--color-${item.priority.toLowerCase()})`
      }));
    }
  });
};
*/

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
      /*
      return data.map((item: { priority: string; count: number }) => ({
        priority: item.priority ?? "UNKNOWN",
        count: item.count ?? 0,
        fill: `var(--color-${(item.priority ?? "unknown").toLowerCase()})`,
      }));
      */
    },
  });
};
