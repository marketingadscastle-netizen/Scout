import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { FrameDiff } from '../types';

interface AnalysisChartProps {
  data: FrameDiff[];
  threshold: number;
}

const AnalysisChart: React.FC<AnalysisChartProps> = ({ data, threshold }) => {
  if (data.length === 0) return null;

  return (
    <div className="w-full h-48 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Scene Detection Confidence (Frame Difference)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorDiff" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={(val) => `${val.toFixed(0)}s`} 
            fontSize={12} 
            stroke="#94a3b8"
            minTickGap={30}
          />
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip 
            labelFormatter={(val) => `Time: ${Number(val).toFixed(2)}s`}
            formatter={(val: number) => [val.toFixed(2), "Difference Score"]}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Area 
            type="monotone" 
            dataKey="diffScore" 
            stroke="#3b82f6" 
            fillOpacity={1} 
            fill="url(#colorDiff)" 
            animationDuration={500}
          />
          {/* Threshold Line */}
          <line x1="0" y1={20} x2="100%" y2={20} stroke="red" strokeDasharray="3 3" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AnalysisChart;