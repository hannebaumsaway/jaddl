'use client';

import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg font-mono">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm text-gray-600 dark:text-gray-300">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Line Chart Component
export function LineChartComponent({ data, xKey, yKey, color = '#525252' }: {
  data: any[];
  xKey: string;
  yKey: string;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 2, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
        <XAxis 
          dataKey={xKey} 
          stroke="#6B7280"
          fontSize={11}
          fontFamily="'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"
          tickLine={false}
          axisLine={false}
          angle={-45}
          textAnchor="end"
          height={40}
        />
        <YAxis 
          stroke="#6B7280"
          fontSize={11}
          fontFamily="'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line 
          type="monotone" 
          dataKey={yKey} 
          stroke={color} 
          strokeWidth={2}
          dot={{ fill: color, strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Area Chart Component
export function AreaChartComponent({ data, xKey, yKey, color = '#525252' }: {
  data: any[];
  xKey: string;
  yKey: string;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 2, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
        <XAxis 
          dataKey={xKey} 
          stroke="#6B7280"
          fontSize={11}
          fontFamily="'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"
          tickLine={false}
          axisLine={false}
          angle={-45}
          textAnchor="end"
          height={40}
        />
        <YAxis 
          stroke="#6B7280"
          fontSize={11}
          fontFamily="'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area 
          type="monotone" 
          dataKey={yKey} 
          stroke={color} 
          fill={color}
          fillOpacity={0.1}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Bar Chart Component
export function BarChartComponent({ data, xKey, yKey, color = '#525252' }: {
  data: any[];
  xKey: string;
  yKey: string;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 2, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
        <XAxis 
          dataKey={xKey} 
          stroke="#6B7280"
          fontSize={11}
          fontFamily="'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"
          tickLine={false}
          axisLine={false}
          angle={-45}
          textAnchor="end"
          height={40}
        />
        <YAxis 
          stroke="#6B7280"
          fontSize={11}
          fontFamily="'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Stacked Bar Chart Component for Head-to-Head Records
export function StackedBarChartComponent({ 
  data, 
  xKey, 
  yKeys, 
  colors = ['#525252', '#d4d4d4'], // neutral-600, neutral-300
  yAxisDomain = [0, 30]
}: {
  data: any[];
  xKey: string;
  yKeys: string[];
  colors?: string[];
  yAxisDomain?: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 2, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
        <XAxis 
          dataKey={xKey} 
          stroke="#6B7280"
          fontSize={11}
          fontFamily="'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"
          tickLine={false}
          axisLine={false}
          angle={-45}
          textAnchor="end"
          height={40}
        />
        <YAxis 
          stroke="#6B7280"
          fontSize={12}
          fontFamily="'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"
          tickLine={false}
          axisLine={false}
          domain={yAxisDomain}
        />
        <Tooltip 
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg font-mono">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{`vs ${label}`}</p>
                  {payload.map((entry: any, index: number) => {
                    const name = entry.name === 'wins' ? 'Wins' : 'Losses';
                    return (
                      <p key={index} className="text-sm text-gray-600 dark:text-gray-300">
                        {entry.value} {name}
                      </p>
                    );
                  })}
                </div>
              );
            }
            return null;
          }}
        />
        {yKeys.map((key, index) => {
          const isFirstItem = index === 0;
          const isLastItem = index === yKeys.length - 1;
          
          return (
            <Bar 
              key={key}
              dataKey={key} 
              fill={colors[index % colors.length]} 
              stackId="stack"
              shape={(props: any) => {
                const { payload, fill, x, y, width, height } = props;
                
                // Check if this is the only bar with data for this opponent
                const hasWins = payload.wins > 0;
                const hasLosses = payload.losses > 0;
                const isOnlyWins = hasWins && !hasLosses;
                const isOnlyLosses = hasLosses && !hasWins;
                
                if (isOnlyWins || isOnlyLosses) {
                  // Single bar - round all corners
                  return (
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={fill}
                      rx={4}
                      ry={4}
                    />
                  );
                } else if (key === 'wins') {
                  // Bottom bar in stack (wins) - round bottom corners only
                  // Create a path for custom corner rounding
                  const path = `M ${x} ${y}
                                L ${x + width} ${y}
                                L ${x + width} ${y + height - 4}
                                Q ${x + width} ${y + height} ${x + width - 4} ${y + height}
                                L ${x + 4} ${y + height}
                                Q ${x} ${y + height} ${x} ${y + height - 4}
                                Z`;
                  return <path d={path} fill={fill} />;
                } else if (key === 'losses') {
                  // Top bar in stack (losses) - round top corners only
                  const path = `M ${x} ${y + height - 4}
                                L ${x} ${y + 4}
                                Q ${x} ${y} ${x + 4} ${y}
                                L ${x + width - 4} ${y}
                                Q ${x + width} ${y} ${x + width} ${y + 4}
                                L ${x + width} ${y + height}
                                L ${x} ${y + height}
                                Z`;
                  return <path d={path} fill={fill} />;
                } else {
                  // Middle bars (if any) - no rounded corners
                  return (
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={fill}
                    />
                  );
                }
              }}
            />
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Pie Chart Component
export function PieChartComponent({ data, dataKey, nameKey, colors = ['#525252', '#737373', '#a3a3a3', '#d4d4d4', '#e5e5e5'] }: {
  data: any[];
  dataKey: string;
  nameKey: string;
  colors?: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey={dataKey}
          nameKey={nameKey}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}