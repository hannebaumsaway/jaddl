"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

interface HeadToHeadBarChartProps {
  data: Array<{
    opponent: string;
    opponentId: number;
    wins: number;
    losses: number;
    total: number;
  }>;
  currentTeamId: number;
  onBarClick?: (opponentName: string, opponentId: number) => void;
}

const chartConfig = {
  wins: {
    label: "Wins",
    color: "var(--chart-1)",
  },
  losses: {
    label: "Losses", 
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function HeadToHeadBarChart({ data, currentTeamId, onBarClick }: HeadToHeadBarChartProps) {
  const [isMounted, setIsMounted] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Head to Head Records</CardTitle>
          <CardDescription>
            All-time record against each opponent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex aspect-video items-center justify-center">
            <div className="text-muted-foreground">Loading chart...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Head to Head Records</CardTitle>
        <CardDescription>
          All-time record against each opponent
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} key={theme} className="h-[390px] w-full">
          <BarChart
            accessibilityLayer
            data={data}
            margin={{
              left: 8,
              right: 8,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="opponent"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={2}
              domain={[0, 30]}
              tick={{ fontSize: 10 }}
              width={20}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar
              dataKey="wins"
              stackId="a"
              fill="var(--color-wins)"
              radius={[0, 0, 0, 0]}
              onClick={(data) => onBarClick?.(data.opponent, data.opponentId)}
              style={{ cursor: onBarClick ? 'pointer' : 'default' }}
            />
            <Bar
              dataKey="losses"
              stackId="a"
              fill="var(--color-losses)"
              radius={[4, 4, 0, 0]}
              onClick={(data) => onBarClick?.(data.opponent, data.opponentId)}
              style={{ cursor: onBarClick ? 'pointer' : 'default' }}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
