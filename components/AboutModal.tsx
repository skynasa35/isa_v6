import React from 'react';
import { X, Info, Mail, Phone, Code } from 'lucide-react';
import { ThemeColors } from '../types';
import { useI18n } from '../hooks/useI18n';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeColors;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose, theme }) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4 transition-opacity duration-300">
      <div 
        className="bg-bg-tertiary/80 backdrop-blur-md text-text-primary rounded-lg shadow-2xl w-full max-w-4xl border border-border-color flex flex-col transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale"
        style={{ height: 'auto', maxHeight: '90vh' }}
      >
        <div className="flex justify-between items-center p-4 border-b border-border-color flex-shrink-0">
          <h2 className="text-xl font-bold text-accent-primary flex items-center gap-2">
            <Info size={22} />
            {t('aboutTitle')}
          </h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-accent-primary">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex-grow overflow-y-auto">
          <div className="mb-8 p-4 bg-bg-primary rounded-lg border border-border-color">
            <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap">
              <span className="bg-bg-secondary text-text-secondary font-mono text-sm px-3 py-1 rounded">{t('ddsi')}</span>
              <span className="text-text-secondary font-bold text-lg">›</span>
              <span className="bg-bg-secondary text-text-secondary font-mono text-sm px-3 py-1 rounded">{t('helpdesk')}</span>
              <span className="text-text-secondary font-bold text-lg">›</span>
              <span className="bg-accent-primary/20 text-accent-primary font-mono text-sm px-3 py-1 rounded-md shadow-sm">LEMMOUCHI</span>
            </div>
            <div className="mt-4 border-t border-border-color pt-4 flex flex-col md:flex-row items-center justify-center gap-x-6 gap-y-2 text-text-secondary font-mono text-sm">
                <a href="mailto:a-lemmouchi@enageo.com" className="flex items-center gap-2 hover:text-accent-primary transition-colors">
                    <Mail size={14} />
                    <span>a-lemmouchi@enageo.com</span>
                </a>
                <div className="flex items-center gap-2">
                    <Phone size={14} />
                    <span>0561 65 03 36 / Ext. 2225</span>
                </div>
            </div>
          </div>

          <div className="bg-bg-secondary p-6 rounded-md border border-border-color font-sans">
             <div className="space-y-4 text-text-primary text-base leading-relaxed">
              <p>{t('about_p1')}</p>
              <p>{t('about_p2')}</p>
              <p>{t('about_p3')}</p>
              <p>{t('about_p4')}</p>
            </div>
          </div>

        </div>
        
        <div className="flex-shrink-0 p-4 border-t border-border-color flex justify-between items-center bg-bg-primary rounded-b-lg">
             <div className="text-xs text-text-secondary italic flex items-center gap-2">
                <Code size={14}/>
                <span>{t('version')}</span>
             </div>
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

export default AboutModal;