
import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList } from 'recharts';
import { VibrationAnalysisResult, ThemeColors, VibrationDataPoint } from '../types';
import { getNumericId } from '../services/analyzer';
import { useI18n } from '../hooks/useI18n';

interface ChronologyChartProps {
  analysisData: VibrationAnalysisResult;
  theme: ThemeColors;
}

const CustomBarLabel = (props: any) => {
    const { x, y, width, height, value, locale } = props;
    if (width < 80) return null; 
    const [start, end] = value;
    const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    const startTime = new Date(start).toLocaleTimeString(locale, timeOptions);
    const endTime = new Date(end).toLocaleTimeString(locale, timeOptions);

    return (
        <g>
            <text x={x + width / 2} y={y + height / 2} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight="bold">
                {`${startTime} - ${endTime}`}
            </text>
        </g>
    );
};


const ChronologyChart: React.FC<ChronologyChartProps> = ({ analysisData, theme }) => {
  const { t, language } = useI18n();

  const chartData = useMemo(() => {
    return Object.entries(analysisData)
      .sort((a, b) => getNumericId(a[0]) - getNumericId(b[0]))
      .map(([vibroId, data]: [string, VibrationDataPoint]) => {
        if (!data.first_time_total || !data.last_time_total) return null;
        
        const startTime = data.first_time_total.getTime();
        const endTime = data.last_time_total.getTime();

        return {
          name: vibroId,
          range: [startTime, endTime]
        };
      }).filter((item): item is { name: string; range: [number, number] } => item !== null);
  }, [analysisData]);

  if (chartData.length === 0) {
    return (
        <div className="flex items-center justify-center h-full text-text-secondary">
            {t('noChronoData')}
        </div>
    );
  }

  const domain = [
      Math.min(...chartData.map(d => d.range[0])),
      Math.max(...chartData.map(d => d.range[1]))
  ];
  
  const locale = language === 'fr' ? 'fr-FR' : 'en-GB';
  const formatTime = (time: number) => new Date(time).toLocaleTimeString(locale, {hour: '2-digit', minute: '2-digit'});

  return (
    <div className="w-full h-full p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={theme.border} strokeOpacity={0.5} />
          <XAxis 
            type="number" 
            domain={domain}
            scale="time"
            tickFormatter={formatTime}
            tick={{ fill: theme.text_secondary, fontSize: 12 }} 
            axisLine={{ stroke: theme.border }}
            tickLine={{ stroke: theme.border }}
          />
          <YAxis 
            type="category" 
            dataKey="name" 
            width={100}
            tick={{ fill: theme.text_secondary, fontSize: 12 }}
            axisLine={{ stroke: theme.border }}
            tickLine={{ stroke: theme.border }}
            interval={0}
          />
          <Tooltip
            labelStyle={{ color: theme.accent_primary, fontWeight: 'bold' }}
            contentStyle={{ backgroundColor: theme.bg_primary, borderColor: theme.border, color: theme.text_primary, borderRadius: '0.5rem' }}
            formatter={(value: any) => {
                const [start, end] = value;
                return `${formatTime(start)} - ${formatTime(end)}`;
            }}
             cursor={{ fill: theme.accent_primary, fillOpacity: 0.1 }}
          />
          <Legend wrapperStyle={{ color: theme.text_primary, paddingTop: '15px' }} />
          <Bar dataKey="range" name={t('operationalRangeLegend')} fill={theme.accent_primary} barSize={25}>
            <LabelList dataKey="range" content={<CustomBarLabel locale={locale} />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ChronologyChart;