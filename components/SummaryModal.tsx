import React, { useState } from 'react';
import { X, Sparkles, BrainCircuit, Loader2, Users, CheckCircle, CopyX, Timer, AlertTriangle } from 'lucide-react';
import { SummaryData, ThemeColors, VibrationRecord } from '../types';
import { useI18n } from '../hooks/useI18n';
import { generateNarrativeSummary } from '../services/geminiService';
import AIInsightModal from './AIInsightModal';

// New Conflicted Shots Modal Component
interface ConflictedShotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  details: { shotNb: number; vibrators: string[] }[];
  theme: ThemeColors;
}

const ConflictedShotsModal: React.FC<ConflictedShotsModalProps> = ({ isOpen, onClose, details }) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[60] p-4 transition-opacity">
      <div
        className="bg-bg-tertiary/80 backdrop-blur-md text-text-primary rounded-lg shadow-2xl w-full max-w-2xl border border-border-color flex flex-col transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale"
        style={{ height: 'auto', maxHeight: '70vh' }}
      >
        <div className="flex justify-between items-center p-4 border-b border-border-color">
          <h2 className="text-xl font-bold text-warning flex items-center gap-2">
            <AlertTriangle size={22} />
            {t('conflictedShotsDetailTitle')}
          </h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-accent-primary">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex-grow overflow-y-auto">
          <div className="overflow-auto rounded-lg border border-border-color bg-bg-primary max-h-[calc(70vh-150px)]">
            <table className="w-full border-collapse min-w-[400px] text-sm text-left text-text-primary">
              <thead className="sticky top-0 bg-bg-tertiary shadow-sm">
                <tr>
                  <th className="p-3 font-semibold text-text-primary/80 uppercase tracking-wider border-b-2 border-border-color">{t('shotNumber')}</th>
                  <th className="p-3 font-semibold text-text-primary/80 uppercase tracking-wider border-b-2 border-border-color">{t('vibratorsInvolved')}</th>
                </tr>
              </thead>
              <tbody>
                {details.map(detail => (
                  <tr key={detail.shotNb} className="hover:bg-bg-tertiary/50 transition-colors">
                    <td className="p-2 font-mono">{detail.shotNb}</td>
                    <td className="p-2 font-semibold">{detail.vibrators.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex-shrink-0 p-4 border-t border-border-color flex justify-end bg-bg-primary rounded-b-lg">
          <button
            onClick={onClose}
            className="bg-accent-primary text-white font-bold py-2 px-8 rounded-md hover:opacity-90 transition-opacity"
          >
            {t('close')}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fade-in-scale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-scale {
          animation: fade-in-scale 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};


interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: SummaryData | null;
  rawRecords: VibrationRecord[];
  theme: ThemeColors;
}

const SummaryModal: React.FC<SummaryModalProps> = ({ isOpen, onClose, summary, rawRecords, theme }) => {
  const { t, language } = useI18n();
  
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);

  const [isInsightModalOpen, setInsightModalOpen] = useState(false);
  const [selectedVibratorId, setSelectedVibratorId] = useState<string | null>(null);
  const [recordsForInsight, setRecordsForInsight] = useState<VibrationRecord[]>([]);

  const [isConflictModalOpen, setConflictModalOpen] = useState(false);

  if (!isOpen || !summary) return null;
  
  const handleGenerateNarrative = async () => {
      if (!summary) return;
      setIsGeneratingNarrative(true);
      setAiNarrative(null);
      try {
        const narrative = await generateNarrativeSummary(summary, language);
        setAiNarrative(narrative);
      } catch (error) {
        console.error(error);
        alert(error instanceof Error ? error.message : t('aiApiError'));
      } finally {
        setIsGeneratingNarrative(false);
      }
  };

  const handleDiagnoseClick = (vibroId: string) => {
    const records = rawRecords.filter(r => r.vibratorId === vibroId);
    setSelectedVibratorId(vibroId);
    setRecordsForInsight(records);
    setInsightModalOpen(true);
  };
  
  const general = summary.general_summary;
  const hasConflicts = general.conflicted_shot_details.length > 0;

  const cards = [
    { label: t('totalVibrators'), value: general.total_vibros, icon: Users },
    { label: t('netOperations'), value: general.net_operations, icon: CheckCircle },
    { label: t('totalDuplicates'), value: general.total_duplicates, icon: CopyX },
    { label: t('conflictedShots'), value: general.conflicted_shot_details.length, icon: AlertTriangle },
    { label: t('totalDuration'), value: general.total_operation_duration_str, icon: Timer },
  ];
  
  const getDupPercColor = (perc: number) => {
      if (perc > 10) return 'text-overload font-bold';
      if (perc > 5) return 'text-warning';
      return 'text-text-primary';
  };
  
  const tableHeaders = ['vibroId', 'totalOps', 'netOps', 'duplicates', 'conflictedOps', 'firstOp', 'lastOp', 'totalDuration', 'actions'];

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4 transition-opacity">
      <div 
        className="bg-bg-tertiary/80 backdrop-blur-md text-text-primary rounded-lg shadow-2xl w-full max-w-7xl border border-border-color flex flex-col transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale"
        style={{ height: 'auto', maxHeight: '90vh' }}
        >
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border-color flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-accent-primary">{t('analysisReport')}</h1>
            <p className="text-sm italic text-text-secondary">{t('sourceFile')}: {summary.source_file} | {t('generated')}: {summary.timestamp}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-bg-primary transition-colors"><X size={24} /></button>
        </div>

        <div className="p-6 flex-grow overflow-y-auto bg-bg-secondary/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
            {cards.map(card => {
              const isConflictCard = card.label === t('conflictedShots');
              const isClickable = isConflictCard && hasConflicts;
              return (
                <div 
                  key={card.label} 
                  className={`bg-bg-primary p-4 rounded-lg border border-border-color shadow-md flex items-center gap-4 ${isClickable ? 'cursor-pointer hover:bg-bg-tertiary transition-colors' : ''}`}
                  onClick={isClickable ? () => setConflictModalOpen(true) : undefined}
                >
                  <div className="bg-bg-tertiary p-3 rounded-full">
                      <card.icon size={24} className={isConflictCard ? 'text-warning' : 'text-accent-primary'} />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary mb-1">{card.label}</p>
                    <p className="text-2xl font-bold text-text-primary">{card.value}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bg-bg-primary p-4 rounded-lg border border-border-color">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-accent-secondary">
                <Sparkles size={18}/>
                {t('aiReport')}
              </h3>
               <button
                onClick={handleGenerateNarrative}
                disabled={isGeneratingNarrative}
                className="bg-accent-secondary text-white font-bold py-2 px-4 rounded-md hover:opacity-90 transition-all flex items-center gap-2 disabled:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingNarrative ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                <span>{isGeneratingNarrative ? t('generating') : t('generateAiReport')}</span>
              </button>
            </div>
             {(isGeneratingNarrative || aiNarrative) && (
              <div className="p-4 bg-bg-secondary rounded-md border border-border-color">
                {isGeneratingNarrative && <p className="text-text-secondary italic">{t('generating')}...</p>}
                {aiNarrative && <p className="text-text-primary whitespace-pre-wrap font-sans leading-relaxed">{aiNarrative}</p>}
              </div>
            )}
          </div>
          
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-3 text-accent-primary">{t('individualPerformance')}</h2>
            <div className="overflow-auto rounded-lg border border-border-color bg-bg-primary max-h-[40vh]">
              <table className="w-full border-collapse min-w-[900px] text-sm text-left text-text-primary">
                  <thead className="sticky top-0 bg-bg-tertiary shadow-sm">
                      <tr>
                          {tableHeaders.map(key => (
                            <th key={key} className="p-3 font-semibold text-text-primary/80 uppercase tracking-wider border-b-2 border-border-color">
                                {t(key)}
                            </th>
                          ))}
                      </tr>
                  </thead>
                  <tbody>
                      {summary.individual_performance.map((perf, index) => (
                          <tr key={perf.vibro_id} className={`${index % 2 === 0 ? 'bg-transparent' : 'bg-bg-secondary/30'} hover:bg-bg-tertiary/50 transition-colors`}>
                              <td className="p-3 font-semibold text-accent-secondary">{perf.vibro_id}</td>
                              <td className="p-3">{perf.count}</td>
                              <td className="p-3">{perf.net_count}</td>
                              <td className={`p-3 ${getDupPercColor(perf.dup_perc)}`}>{perf.duplicates} ({perf.dup_perc.toFixed(1)}%)</td>
                              <td className={`p-3 ${perf.multi_vib_shots > 0 ? 'text-warning font-semibold' : ''}`}>{perf.multi_vib_shots}</td>
                              <td className="p-3 font-mono">{perf.first_time}</td>
                              <td className="p-3 font-mono">{perf.last_time}</td>
                              <td className="p-3">{perf.duration_total}</td>
                              <td className="p-3 text-center">
                                  <button 
                                      onClick={() => handleDiagnoseClick(perf.vibro_id)}
                                      title={t('diagnoseIssues')}
                                      className="p-2 rounded-full text-accent-secondary hover:bg-accent-secondary/10 transition-colors"
                                  >
                                      <BrainCircuit size={18} />
                                  </button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <div className="flex-shrink-0 p-4 border-t border-border-color flex justify-center bg-bg-primary rounded-b-lg">
             <button
              onClick={onClose}
              className="bg-accent-primary text-white font-bold py-2 px-8 rounded-md hover:opacity-90 transition-opacity"
            >
              {t('close')}
            </button>
        </div>
      </div>
      <style>{`
        @keyframes fade-in-scale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in-scale { animation: fade-in-scale 0.3s ease-out forwards; }
      `}</style>
    </div>
    
    <ConflictedShotsModal
        isOpen={isConflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        details={summary.general_summary.conflicted_shot_details}
        theme={theme}
    />

    {selectedVibratorId && (
        <AIInsightModal 
            isOpen={isInsightModalOpen}
            onClose={() => setInsightModalOpen(false)}
            theme={theme}
            vibratorId={selectedVibratorId}
            records={recordsForInsight}
        />
    )}
    </>
  );
};

export default SummaryModal;