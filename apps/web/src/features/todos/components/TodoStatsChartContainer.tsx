"use client";

import { useMemo } from "react";
import { useTodoStats } from "../hooks/useTodoStats";
import { TodoStatsChart } from "./TodoStatsChart";

export const TodoStatsChartContainer = () => {
  const { data } = useTodoStats();
  const chartData = useMemo(
    () =>
      data?.map((item) => ({
        priority: item.priority,
        count: item.count,
        fill: `var(--color-${item.priority})`,
      })),
    [data],
  );
  return <TodoStatsChart data={chartData ?? []} />;
};
