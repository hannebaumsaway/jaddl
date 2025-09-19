"use client"

import { Activity } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"

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

interface WeeklyPerformanceAreaChartProps {
  data: Array<{
    week: number;
    opponent: string;
    teamScore: number;
    oppScore: number;
    result: string;
    pointDiff: number;
    isPlayoff: boolean;
  }>;
}

const chartConfig = {
  teamScore: {
    label: "Points Scored",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function WeeklyPerformanceAreaChart({ data }: WeeklyPerformanceAreaChartProps) {
  const [isMounted, setIsMounted] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate trend
  const firstScore = data[0]?.teamScore || 0;
  const lastScore = data[data.length - 1]?.teamScore || 0;
  const trend = lastScore - firstScore;
  const trendText = trend > 0 ? `up by ${trend.toFixed(1)} points` : trend < 0 ? `down by ${Math.abs(trend).toFixed(1)} points` : 'unchanged';
  const trendIcon = trend > 0 ? <Activity className="h-4 w-4" /> : null;

  if (!isMounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Weekly Performance
          </CardTitle>
          <CardDescription>
            Points scored by week this season
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
                Scoring trending {trendText} {trendIcon}
              </div>
              <div className="text-muted-foreground flex items-center gap-2 leading-none">
                Week {data[0]?.week} - Week {data[data.length - 1]?.week}
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
        <CardTitle className="flex items-center">
          <Activity className="h-5 w-5 mr-2" />
          Weekly Performance
        </CardTitle>
        <CardDescription>
          Points scored by week this season
        </CardDescription>
      </CardHeader>
      <CardContent>
            <ChartContainer config={chartConfig} key={theme}>
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
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `W${value}`}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              domain={[60, 230]}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <defs>
              <linearGradient id="fillTeamScore" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-teamScore)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-teamScore)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <Area
              dataKey="teamScore"
              type="natural"
              fill="url(#fillTeamScore)"
              fillOpacity={0.4}
              stroke="var(--color-teamScore)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 leading-none font-medium">
              Scoring trending {trendText} {trendIcon}
            </div>
            <div className="text-muted-foreground flex items-center gap-2 leading-none">
              Week {data[0]?.week} - Week {data[data.length - 1]?.week}
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}
