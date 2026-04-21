//import { useApiQuery } from "@/hooks/use-tanstack-query";
//import { todoService } from "../services/todoService";
import { useApiSuspenseQuery } from "@/hooks/useSuspenseQuery";
import { ProgressStatsResponse } from "../services/todoService";
import { getBaseUrl } from "@/lib/constants";

/*
type ProgressStatsData = {
  range: string;
  count: number;
}[];
*/

/*
export const useProgressStats = () => {
  return useApiQuery<ProgressStatsData>({
    queryKey: ['todos', 'progress-stats'],
    queryFn: async () => {
      const res = await todoService.getProgressStats();
      return [
        { range: "0-20%", count: res.range_0_20 },
        { range: "21-40%", count: res.range_21_40 },
        { range: "41-60%", count: res.range_41_60 },
        { range: "61-80%", count: res.range_61_80 },
        { range: "81-100%", count: res.range_81_100 },
      ];
    }
  });
};
*/

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
