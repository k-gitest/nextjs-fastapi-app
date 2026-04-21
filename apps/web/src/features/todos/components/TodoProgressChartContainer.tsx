"use client";

import { useProgressStats } from "../hooks/useProgressStats";
import { TodoProgressChart } from "./TodoProgressChart";

export const TodoProgressChartContainer = () => {
  const { data } = useProgressStats();

  return <TodoProgressChart data={data ?? []} />;
};
