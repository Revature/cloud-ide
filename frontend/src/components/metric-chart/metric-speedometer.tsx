'use client';

import React from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { useRunnerMetrics } from '@/hooks/useRunnerMetrics';

type DataEntry = {
  name: string;
  value: number;
  color: string;
};

interface MetricSpeedometerProps {
  jobId: string; // runner.url
  step?: number;
  type?: 'cpu' | 'memory'; // which metric to show
}

// Helper to get color based on percent
function getUsageColor(percent: number): string {
  if (percent < 50) return '#22c55e'; // green-500
  if (percent < 80) return '#f59e42'; // orange-400
  return '#ef4444'; // red-500
}

// Pie data: only one segment for used, rest is background
const getPieData = (percent: number, bgColor: string): DataEntry[] => [
  { name: 'Used', value: percent, color: getUsageColor(percent) },
  { name: 'Free', value: 100 - percent, color: bgColor },
];

const MetricSpeedometer: React.FC<MetricSpeedometerProps> = ({
  jobId,
  step = 30,
  type = 'cpu',
}) => {
  const { cpuPercent, memoryPercent, loading, error } = useRunnerMetrics({ jobId, step });

  const percent = type === 'memory' ? memoryPercent ?? 0 : cpuPercent ?? 0;
  // Use AppHeader background color for unused segment
  // AppHeader uses: dark:bg-gray-900 bg-white
  const headerBg = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
    ? '#111827' // Tailwind gray-900
    : '#fff';   // Tailwind white
  const pieData = getPieData(percent, headerBg);

  return (
    <div className="flex flex-col items-center w-[210px] mx-4">
      <PieChart width={210} height={130}>
        <Pie
          dataKey="value"
          startAngle={180}
          endAngle={0}
          data={pieData}
          cx={105}
          cy={120}
          innerRadius={50}
          outerRadius={95}
          fill="#8884d8"
          stroke="none"
        >
          {pieData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
      </PieChart>
      <div className="-mt-7 text-xl font-semibold text-gray-700 dark:text-gray-200">
        {loading
          ? 'Loading...'
          : error
          ? 'Error'
          : `${Math.round(percent)}%`}
      </div>
      <div className="text-sm text-gray-500 mt-0">
        {type === 'memory' ? 'Memory Usage' : 'CPU Usage'}
      </div>
    </div>
  );
};

export default MetricSpeedometer;