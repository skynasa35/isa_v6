
import React, { useState, useEffect } from 'react';
import { X, BrainCircuit, Loader2 } from 'lucide-react';
import { ThemeColors, VibrationRecord } from '../types';
import { useI18n } from '../hooks/useI18n';
import { diagnoseVibratorIssues } from '../services/geminiService';

interface AIInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeColors;
  vibratorId: string;
  records: VibrationRecord[];
}

const AIInsightModal: React.FC<AIInsightModalProps> = ({ isOpen, onClose, theme, vibratorId, records }) => {
  const { t, language } = useI18n();
  const [isLoading, setIsLoading] = useState(true);
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && vibratorId && records.length > 0) {
      const fetchInsight = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const result = await diagnoseVibratorIssues(records, vibratorId, language);
          if (result === "") {
             setInsight(t('noIssuesDetected'));
          } else {
             setInsight(result);
          }
        } catch (err) {
          console.error(err);
          setError(err instanceof Error ? err.message : t('aiApiError'));
        } finally {
          setIsLoading(false);
        }
      };
      fetchInsight();
    }
  }, [isOpen, vibratorId, records, t, language]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[60] p-4 transition-opacity duration-300">
      <div 
        className="bg-bg-secondary/90 backdrop-blur-md text-text-primary rounded-lg shadow-2xl w-full max-w-lg border border-border-color flex flex-col transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale"
      >
        <div className="flex justify-between items-center p-4 border-b border-border-color">
          <h2 className="text-xl font-bold text-accent-secondary flex items-center gap-2">
            <BrainCircuit size={22} />
            {`${t('aiDiagnosisTitle')} - ${vibratorId}`}
          </h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-accent-primary">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex-grow overflow-y-auto min-h-[150px] bg-bg-primary/50">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-text-secondary">
              <Loader2 size={32} className="animate-spin mb-4" />
              <p>{t('fetchingDiagnosis')}</p>
            </div>
          )}
          {error && (
            <div className="text-center text-red-400">
              <p>{error}</p>
            </div>
          )}
          {!isLoading && insight && (
            <div className="whitespace-pre-wrap font-sans leading-relaxed text-text-primary">
              {insight.split('\n').map((line, index) => {
                const isTitle = line.startsWith('Potential Problem:') || line.startsWith('Recommendation:') || line.startsWith('Problème potentiel:') || line.startsWith('Recommandation:');
                return (
                  <p key={index} className={isTitle ? 'font-bold mt-2 text-accent-primary' : ''}>
                    {line}
                  </p>
                )
              })}
            </div>
          )}
        </div>
        
        <div className="flex-shrink-0 p-4 border-t border-border-color flex justify-end bg-bg-secondary rounded-b-lg">
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

export default AIInsightModal;
