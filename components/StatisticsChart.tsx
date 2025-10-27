

import React, { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList } from 'recharts';
import { VibrationAnalysisResult, ThemeColors, VibrationDataPoint } from '../types';
import { getNumericId, formatDurationForStatsLabel, formatDurationForTooltip } from '../services/analyzer';
import { useI18n } from '../hooks/useI18n';

interface StatisticsChartProps {
  analysisData: VibrationAnalysisResult;
  theme: ThemeColors;
}

const StatisticsChart: React.FC<StatisticsChartProps> = ({ analysisData, theme }) => {
  const { t } = useI18n();

  const chartData = useMemo(() => {
    return Object.entries(analysisData)
      .sort((a, b) => getNumericId(a[0]) - getNumericId(b[0]))
      .map(([vibroId, data]: [string, VibrationDataPoint]) => ({
        name: vibroId,
        totalVibrations: data.count,
        totalDuration: Math.round(data.duration_seconds_total),
      }));
  }, [analysisData]);

  return (
    <div className="w-full h-full p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 20, right: 40, left: 30, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.border} strokeOpacity={0.5} />
          <XAxis 
            dataKey="name" 
            tick={{ fill: theme.text_secondary, fontSize: 12 }} 
            angle={-45} 
            textAnchor="end"
            height={60}
            interval={0}
            axisLine={{ stroke: theme.border }}
            tickLine={{ stroke: theme.border }}
          />
          <YAxis 
            yAxisId="left" 
            orientation="left" 
            stroke={theme.accent_secondary} 
            tick={{ fill: theme.text_secondary, fontSize: 12 }}
            axisLine={{ stroke: theme.border }}
            tickLine={{ stroke: theme.border }}
            label={{ value: t('totalVibrationYLabel'), angle: -90, position: 'insideLeft', fill: theme.text_secondary, dx: -20, fontSize: 14 }}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            stroke={theme.accent_primary}
            tick={{ fill: theme.text_secondary, fontSize: 12 }}
            axisLine={{ stroke: theme.border }}
            tickLine={{ stroke: theme.border }}
            label={{ value: t('totalDurationYLabel'), angle: -90, position: 'insideRight', fill: theme.text_secondary, dx: 30, fontSize: 14 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: theme.bg_primary,
              borderColor: theme.border,
              color: theme.text_primary,
              borderRadius: '0.5rem',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
            }}
            labelStyle={{ color: theme.text_primary, fontWeight: 'bold' }}
            cursor={{ fill: theme.accent_primary, fillOpacity: 0.1 }}
            formatter={(value: number, name: string) => {
              if (name === t('totalDurationLegend')) {
                return [formatDurationForTooltip(value), name];
              }
              return [value, name];
            }}
          />
          <Legend wrapperStyle={{ color: theme.text_primary, paddingTop: '30px' }} />
          <Bar yAxisId="left" dataKey="totalVibrations" name={t('totalVibrationsLegend')} fill={theme.accent_secondary} barSize={30}>
            <LabelList dataKey="totalVibrations" position="top" fill={theme.text_primary} fontSize={10} />
          </Bar>
          <Bar yAxisId="right" dataKey="totalDuration" name={t('totalDurationLegend')} fill={theme.accent_primary} barSize={30}>
             <LabelList dataKey="totalDuration" position="top" fill={theme.text_primary} fontSize={10} formatter={(value: number) => formatDurationForStatsLabel(value)} />
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatisticsChart;