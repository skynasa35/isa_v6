
import React, { useState } from 'react';
import { BarChart3, ListChecks } from 'lucide-react';
import { VibrationAnalysisResult, ThemeColors } from '../types';
import StatisticsChart from './StatisticsChart';
import ChronologyChart from './ChronologyChart';
import { useI18n } from '../hooks/useI18n';

interface AnalysisTabsProps {
  analysisData: VibrationAnalysisResult;
  theme: ThemeColors;
}

type Tab = 'stats' | 'chrono';

const AnalysisTabs: React.FC<AnalysisTabsProps> = ({ analysisData, theme }) => {
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const { t } = useI18n();

  const getTabClass = (tabName: Tab) => {
    const baseClasses =
      'relative flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary';
    if (activeTab === tabName) {
      return `${baseClasses} bg-accent-primary/15 text-accent-primary shadow-[0_12px_30px_-18px_rgba(37,99,235,0.45)]`;
    }
    return `${baseClasses} text-text-secondary hover:bg-bg-tertiary/70 hover:text-text-primary`;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border-light/70 bg-bg-primary/70 px-6 py-4 backdrop-blur-sm">
        <button
          className={getTabClass('stats')}
          onClick={() => setActiveTab('stats')}
          aria-pressed={activeTab === 'stats'}
        >
          <BarChart3 size={16} />
          {t('statistics')}
        </button>
        <button
          className={getTabClass('chrono')}
          onClick={() => setActiveTab('chrono')}
          aria-pressed={activeTab === 'chrono'}
        >
          <ListChecks size={16} />
          {t('chronology')}
        </button>
      </div>
      <div className="flex-1 overflow-hidden bg-bg-secondary/40">
        {activeTab === 'stats' && <StatisticsChart analysisData={analysisData} theme={theme} />}
        {activeTab === 'chrono' && <ChronologyChart analysisData={analysisData} theme={theme} />}
      </div>
    </div>
  );
};

export default AnalysisTabs;
