"use client"

import { TrendingUp } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useEffect, useState } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

interface PerformanceAreaChartProps {
  data: Array<{
    year: string;
    wins: number;
    losses: number;
    winPercentage: number;
    pointsFor: number;
    pointsAgainst: number;
    pointDiff: number;
  }>;
}

const chartConfig = {
  winPercentage: {
    label: "Win %",
    color: "hsl(var(--chart-1))",
  },
  pointsFor: {
    label: "Points For",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function PerformanceAreaChart({ data }: PerformanceAreaChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate trend
  const firstWinPercentage = data[0]?.winPercentage || 0;
  const lastWinPercentage = data[data.length - 1]?.winPercentage || 0;
  const trend = lastWinPercentage - firstWinPercentage;
  const trendText = trend > 0 ? `up by ${(trend * 100).toFixed(1)}%` : trend < 0 ? `down by ${(Math.abs(trend) * 100).toFixed(1)}%` : 'unchanged';
  const trendIcon = trend > 0 ? <TrendingUp className="h-4 w-4" /> : null;

  if (!isMounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Over Time</CardTitle>
          <CardDescription>
            Win percentage and points scored by season
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex aspect-video items-center justify-center">
            <div className="text-muted-foreground">Loading chart...</div>
          </div>
        </CardContent>
        <CardFooter>
          <div className="flex w-full items-start gap-2 text-sm">
            <div className="grid gap-2">
              <div className="flex items-center gap-2 leading-none font-medium">
                Win percentage trending {trendText} {trendIcon}
              </div>
              <div className="text-muted-foreground flex items-center gap-2 leading-none">
                {data[0]?.year} - {data[data.length - 1]?.year}
              </div>
            </div>
          </div>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Over Time</CardTitle>
        <CardDescription>
          Win percentage and points scored by season
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              yAxisId="left"
              orientation="left"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              domain={[0, 1]}
              tickFormatter={(value) => value.toFixed(3)}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              domain={['dataMin', 'dataMax']}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <defs>
              <linearGradient id="fillWinPercentage" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-winPercentage)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-winPercentage)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillPointsFor" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-pointsFor)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-pointsFor)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <Area
              yAxisId="left"
              dataKey="winPercentage"
              type="natural"
              fill="url(#fillWinPercentage)"
              fillOpacity={0.4}
              stroke="var(--color-winPercentage)"
            />
            <Area
              yAxisId="right"
              dataKey="pointsFor"
              type="natural"
              fill="url(#fillPointsFor)"
              fillOpacity={0.4}
              stroke="var(--color-pointsFor)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 leading-none font-medium">
              Win percentage trending {trendText} {trendIcon}
            </div>
            <div className="text-muted-foreground flex items-center gap-2 leading-none">
              {data[0]?.year} - {data[data.length - 1]?.year}
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}
