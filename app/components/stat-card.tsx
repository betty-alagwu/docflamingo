'use client';

import ReactECharts from 'echarts-for-react';

import { getChartOption } from '../utils/chart-config';

interface StatCardProps {
  title: string;
  total: number;
  data: number[];
  dateRange: string;
  color: string;
  className?: string;
}

export function StatCard({ title, total, data, dateRange, color, className = '' }: StatCardProps) {
  return (
    <div className={`bg-neutral-800 border border-neutral-700 rounded-lg p-6 ${className}`}>
      <h3 className="text-white text-lg font-semibold mb-4">{title}</h3>
      <div className="mb-4">
        <span className="text-neutral-400 text-sm">Total: </span>
        <span className="text-white text-2xl font-bold">{total}</span>
      </div>
      <div className="h-32">
        <ReactECharts
          option={getChartOption(data, color)}
          notMerge={true}
          lazyUpdate={true}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
      </div>
      <div className="text-center text-neutral-400 text-xs mt-2">{dateRange}</div>
    </div>
  );
}
