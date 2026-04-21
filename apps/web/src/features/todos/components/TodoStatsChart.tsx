"use client";

import { Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface TodoStatsChartViewProps {
  data: {
    priority: string;
    count: number;
    fill?: string | null;
  }[];
}

/*
const chartConfig = {
  count: { label: "タスク数" },
  high: { label: "優先度: 高", color: "hsl(var(--color-destructive))" },
  medium: { label: "優先度: 中", color: "hsl(var(--primary))" },
  low: { label: "優先度: 低", color: "hsl(var(--muted))" },
} satisfies ChartConfig;
*/

const chartConfig = {
  count: { label: "タスク数" },
  HIGH: { label: "優先度: 高", color: "var(--destructive)" },
  MEDIUM: { label: "優先度: 中", color: "var(--primary)" },
  LOW: { label: "優先度: 低", color: "var(--muted)" },
} satisfies ChartConfig;

export const TodoStatsChart = ({ data }: TodoStatsChartViewProps) => {
  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>優先度別タスク分布</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="priority"
              innerRadius={60}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
