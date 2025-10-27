import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  FilePlus,
  Trash2,
  FileUp,
  Languages,
  Info,
  Map as MapIcon,
  LineChart,
  Database,
  FileText,
  Compass,
  BarChartBig,
  UploadCloud,
  Users,
  Activity,
  Timer,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

import { THEMES, DEFAULT_THEME } from './constants';
import { VibrationAnalysisResult, SummaryData, VibrationRecord, AppFile, SpsPoint } from './types';
import { parseAndAnalyzeVibrationData, generateSummary, generateExportText, parseSpsData } from './services/analyzer';

import WelcomeScreen from './components/WelcomeScreen';
import AnalysisTabs from './components/AnalysisTabs';
import AboutModal from './components/AboutModal';
import SummaryModal from './components/SummaryModal';
import MapModal from './components/MapModal';
import { useI18n } from './hooks/useI18n';
import ThemeSwitcher from './components/ThemeSwitcher';

type AppMode = 'welcome' | 'vaps_analysis';
type NoticeTone = 'success' | 'info' | 'warning' | 'error';

interface NoticeEntry {
  id: string;
  type: NoticeTone;
  title: string;
  description?: string;
}

const NOTICE_ICONS: Record<NoticeTone, React.ElementType> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
};

const noticeAccent = (tone: NoticeTone) => {
  switch (tone) {
    case 'success':
      return 'var(--color-success)';
    case 'warning':
      return 'var(--color-warning)';
    case 'error':
      return 'var(--color-overload)';
    case 'info':
    default:
      return 'var(--color-info)';
  }
};

const createNoticeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `notice-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export default function App() {
  const [themeName, setThemeName] = useState(DEFAULT_THEME);
  const theme = THEMES[themeName as keyof typeof THEMES] || THEMES[DEFAULT_THEME];

  const [files, setFiles] = useState<AppFile[]>([]);
  const [selectedVapsFile, setSelectedVapsFile] = useState<AppFile | null>(null);
  const [selectedSpsFile, setSelectedSpsFile] = useState<AppFile | null>(null);

  const [mode, setMode] = useState<AppMode>('welcome');

  const [analysisResult, setAnalysisResult] = useState<VibrationAnalysisResult | null>(null);
  const [rawRecords, setRawRecords] = useState<VibrationRecord[]>([]);
  const [spsPoints, setSpsPoints] = useState<SpsPoint[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);

  const [isAboutModalOpen, setAboutModalOpen] = useState(false);
  const [isSummaryModalOpen, setSummaryModalOpen] = useState(false);
  const [isMapModalOpen, setMapModalOpen] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notices, setNotices] = useState<NoticeEntry[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language, setLanguage, t } = useI18n();

  const removeNotice = useCallback((id: string) => {
    setNotices(current => current.filter(n => n.id !== id));
  }, []);

  const pushNotice = useCallback((entry: Omit<NoticeEntry, 'id'>, duration = 6000) => {
    const id = createNoticeId();
    setNotices(current => [...current, { ...entry, id }]);
    if (duration > 0) {
      window.setTimeout(() => {
        setNotices(current => current.filter(n => n.id !== id));
      }, duration);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(theme).forEach(([key, value]) => {
      const cssVar = `--color-${key.replace(/_/g, '-')}`;
      root.style.setProperty(cssVar, value);
    });
  }, [theme]);

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-US'),
    [language]
  );

  const resetState = useCallback(() => {
    setAnalysisResult(null);
    setRawRecords([]);
    setSpsPoints([]);
    setSummaryData(null);
    setSelectedVapsFile(null);
    setSelectedSpsFile(null);
    setMode('welcome');
  }, []);

  const analyzeVapsFile = useCallback(
    (file: AppFile) => {
      setIsProcessing(true);
      setAnalysisResult(null);
      setRawRecords([]);
      setSummaryData(null);
      try {
        const {
          result,
          rawRecords: parsedRecords,
          totalLines,
          conflictedShotDetails,
        } = parseAndAnalyzeVibrationData(file.content);
        if (!result) {
          throw new Error(t('emptyDataBody'));
        }
        setAnalysisResult(result);
        setRawRecords(parsedRecords);
        const newSummary = generateSummary(result, file.name, totalLines, conflictedShotDetails);
        setSummaryData(newSummary);
        setMode('vaps_analysis');
        setSelectedVapsFile(file);
        pushNotice({
          type: 'success',
          title: t('analysisReport'),
          description: file.name,
        });

        const existingSps = files.find(f => f.type === 'sps');
        if (existingSps) {
          setSelectedSpsFile(existingSps);
          setSpsPoints(parseSpsData(existingSps.content));
        }
      } catch (error) {
        console.error('Failed to parse VAPS file:', error);
        pushNotice({
          type: 'error',
          title: t('analysis'),
          description: t('analysisErrorBody', { error: String(error) }),
        });
        setSelectedVapsFile(null);
      } finally {
        setIsProcessing(false);
      }
    },
    [files, pushNotice, t]
  );

  const processSpsFile = useCallback(
    (file: AppFile) => {
      try {
        const points = parseSpsData(file.content);
        setSpsPoints(points);
        setSelectedSpsFile(file);
        pushNotice({
          type: 'success',
          title: t('spsFile'),
          description: file.name,
        });
      } catch (error) {
        console.error('Failed to parse SPS file:', error);
        pushNotice({
          type: 'error',
          title: t('planner'),
          description: error instanceof Error ? error.message : String(error),
        });
        setSelectedSpsFile(null);
      }
    },
    [pushNotice, t]
  );

  const handleFileSelect = useCallback(
    (fileName: string) => {
      const file = files.find(f => f.name === fileName);
      if (!file) return;

      if ((file.type === 'vaps' || file.type === 'aps') && selectedVapsFile?.name !== file.name) {
        analyzeVapsFile(file);
      } else if (file.type === 'sps' && selectedSpsFile?.name !== file.name) {
        processSpsFile(file);
      }
    },
    [analyzeVapsFile, files, processSpsFile, selectedSpsFile, selectedVapsFile]
  );

  const classifyFile = (file: File): AppFile['type'] => {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.sps')) return 'sps';
    if (lowerName.endsWith('.aps')) return 'aps';
    if (lowerName.includes('sps')) return 'sps';
    if (lowerName.endsWith('.txt') || !lowerName.includes('.')) {
      return 'vaps';
    }
    return 'unknown';
  };

  const handleFileUpload = useCallback(
    (uploadedFiles: FileList) => {
      setIsProcessing(true);
      const filePromises = Array.from(uploadedFiles).map(
        (file: File) =>
          new Promise<AppFile>((resolve, reject) => {
            const type = classifyFile(file);
            if (type === 'unknown') {
              resolve({ name: file.name, content: '', type });
              return;
            }
            const reader = new FileReader();
            reader.onload = e => resolve({ name: file.name, content: e.target?.result as string, type });
            reader.onerror = e => reject(e);
            reader.readAsText(file);
          })
      );

      Promise.all(filePromises)
        .then(newFiles => {
          setFiles(currentFiles => {
            const uniqueNewFiles = newFiles.filter(nf => !currentFiles.some(f => f.name === nf.name));
            const updatedFiles = [...currentFiles, ...uniqueNewFiles];

            if (uniqueNewFiles.length > 0) {
              const key = uniqueNewFiles.length === 1 ? 'filesSelected_one' : 'filesSelected_other';
              pushNotice({
                type: 'info',
                title: t('loadedFiles'),
                description: t(key, { count: uniqueNewFiles.length }),
              });
            }

            const firstNewVaps = uniqueNewFiles.find(f => f.type === 'vaps' || f.type === 'aps');
            const firstNewSps = uniqueNewFiles.find(f => f.type === 'sps');

            if (firstNewVaps && (!selectedVapsFile || firstNewVaps.name !== selectedVapsFile.name)) {
              analyzeVapsFile(firstNewVaps);
            }
            if (firstNewSps && (!selectedSpsFile || firstNewSps.name !== selectedSpsFile.name)) {
              processSpsFile(firstNewSps);
            }

            return updatedFiles;
          });
        })
        .catch(error => {
          console.error('Failed to load files:', error);
          pushNotice({
            type: 'error',
            title: t('addFiles'),
            description: error instanceof Error ? error.message : String(error),
          });
        })
        .finally(() => setIsProcessing(false));
    },
    [analyzeVapsFile, processSpsFile, pushNotice, selectedSpsFile, selectedVapsFile, t]
  );

  const clearFileList = useCallback(() => {
    setFiles([]);
    resetState();
    pushNotice({
      type: 'info',
      title: t('loadedFiles'),
      description: t('clearList'),
    });
  }, [pushNotice, resetState, t]);

  const exportVapsTxt = useCallback(() => {
    if (!summaryData) return;
    const textContent = generateExportText(summaryData);
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Summary_${summaryData.source_file}`;
    link.click();
    URL.revokeObjectURL(url);
    pushNotice({
      type: 'success',
      title: t('exportTxt'),
      description: summaryData.source_file,
    });
  }, [summaryData, t, pushNotice]);

  const handleOpenMap = useCallback(() => {
    if (rawRecords.length > 0 || spsPoints.length > 0) {
      setMapModalOpen(true);
    } else {
      pushNotice({
        type: 'warning',
        title: t('geoPlanner'),
        description: t('noGpsData'),
      });
    }
  }, [pushNotice, rawRecords, spsPoints, t]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files) {
        handleFileUpload(e.dataTransfer.files);
      }
    },
    [handleFileUpload]
  );

  const toggleLanguage = useCallback(() => setLanguage(language === 'en' ? 'fr' : 'en'), [language, setLanguage]);

  const selectedFileNames = useMemo(
    () => [selectedVapsFile?.name, selectedSpsFile?.name].filter(Boolean) as string[],
    [selectedSpsFile, selectedVapsFile]
  );

  const summaryGeneral = summaryData?.general_summary;

  const quickMetrics = useMemo(() => {
    if (!summaryGeneral) return [];
    return [
      {
        key: 'total_vibros',
        label: t('totalVibrators'),
        value: numberFormatter.format(summaryGeneral.total_vibros),
        icon: Users,
        tone: 'accent',
      },
      {
        key: 'net_operations',
        label: t('netOperations'),
        value: numberFormatter.format(summaryGeneral.net_operations),
        icon: Activity,
        tone: 'info',
      },
      {
        key: 'total_duplicates',
        label: t('totalDuplicates'),
        value: numberFormatter.format(summaryGeneral.total_duplicates),
        icon: AlertTriangle,
        tone: 'warning',
      },
      {
        key: 'total_duration',
        label: t('totalDuration'),
        value: summaryGeneral.total_operation_duration_str,
        icon: Timer,
        tone: 'success',
      },
    ] as Array<{
      key: string;
      label: string;
      value: string;
      icon: React.ElementType;
      tone: 'accent' | 'info' | 'warning' | 'success';
    }>;
  }, [numberFormatter, summaryGeneral, t]);

  const getFileIcon = (type: AppFile['type']) => {
    switch (type) {
      case 'vaps':
        return FileText;
      case 'sps':
        return Compass;
      case 'aps':
        return BarChartBig;
      default:
        return FileText;
    }
  };

  const renderFileBadge = (file: AppFile | null, translationKey: string) => {
    if (!file) return null;
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-tertiary/80 px-3 py-1 text-xs font-semibold text-text-secondary shadow-sm">
        <span className="uppercase tracking-[0.14em] text-text-tertiary">{t(translationKey)}</span>
        <span className="rounded-full bg-bg-quaternary px-2 py-0.5 text-text-primary">{file.name}</span>
      </div>
    );
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-bg-primary text-text-primary"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        type="file"
        multiple
        accept=".txt,.sps,.aps"
        ref={fileInputRef}
        onChange={e => e.target.files && handleFileUpload(e.target.files)}
        className="hidden"
      />

      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,11,24,0.75)] backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-accent-primary/80 bg-bg-primary/95 px-16 py-14 text-center shadow-[0_40px_120px_-50px_rgba(37,99,235,0.7)]">
            <FileUp size={48} className="text-accent-primary" />
            <p className="text-xl font-semibold">{t('dropFilesHint')}</p>
          </div>
        </div>
      )}

      <header className="relative z-30 border-b border-border-color bg-gradient-to-r from-bg-secondary/80 via-bg-primary/80 to-bg-secondary/80 backdrop-blur supports-[backdrop-filter]:bg-bg-primary/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              className="hidden h-12 w-12 items-center justify-center rounded-2xl border border-border-color bg-bg-tertiary text-text-secondary transition hover:text-accent-primary lg:flex"
              title={isSidebarCollapsed ? t('pinPanel') : t('unpinPanel')}
            >
              {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-border-color bg-bg-tertiary shadow-[0_25px_45px_-25px_rgba(15,23,42,0.6)]">
                <img src="/assets/3d.png" alt="Logo" className="h-10 w-10 object-contain" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-text-tertiary">
                  {t('intelligentMonitoring')}
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                  {t('vibrationAnalyzer')}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-border-color bg-bg-tertiary/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary sm:flex">
              {t('loadedFiles')}
              <span className="rounded-full bg-bg-quaternary px-2 py-0.5 text-text-primary">
                {numberFormatter.format(files.length)}
              </span>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_45px_-20px_rgba(37,99,235,0.6)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary"
            >
              <FilePlus size={18} />
              <span>{t('addFiles')}</span>
            </button>
            <button
              onClick={clearFileList}
              disabled={files.length === 0}
              className="flex items-center gap-2 rounded-full border border-border-color px-4 py-2 text-sm font-semibold text-text-secondary transition hover:border-accent-primary hover:text-accent-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={16} />
              <span>{t('clearList')}</span>
            </button>
            <div className="flex items-center gap-2 rounded-full border border-border-color bg-bg-tertiary/80 px-2 py-1">
              <ThemeSwitcher currentThemeName={themeName} setThemeName={setThemeName} />
              <button
                onClick={toggleLanguage}
                className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition hover:text-accent-primary"
                title="Change Language"
              >
                <Languages size={18} />
              </button>
              <button
                onClick={() => setAboutModalOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition hover:text-accent-primary"
                title={t('about')}
              >
                <Info size={18} />
              </button>
            </div>
          </div>
        </div>
        {isProcessing && (
          <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden">
            <div className="h-full w-full origin-left bg-gradient-to-r from-accent-secondary via-accent-primary to-accent-secondary animate-[progressSlide_1.4s_ease-in-out_infinite]" />
          </div>
        )}
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        <aside
          className={`hidden h-full border-r border-border-color bg-bg-primary/70 backdrop-blur transition-all duration-300 lg:flex ${
            isSidebarCollapsed ? 'w-[110px]' : 'w-[320px]'
          }`}
        >
          <div className="flex h-full w-full flex-col gap-5 overflow-hidden px-4 py-6">
            <section
              className={`rounded-3xl border border-border-color bg-bg-secondary/80 p-4 text-sm shadow-[0_25px_60px_-35px_rgba(15,23,42,0.6)] transition-all ${
                isSidebarCollapsed ? 'items-center justify-center' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-border-light bg-bg-tertiary/70 px-4 py-4 text-sm font-semibold text-text-secondary transition hover:border-accent-primary hover:text-accent-primary ${
                  isSidebarCollapsed ? 'flex-col text-center' : ''
                }`}
              >
                <UploadCloud size={24} className="text-accent-primary" />
                {!isSidebarCollapsed && <span>{t('dropFilesHint')}</span>}
              </button>
              {!isSidebarCollapsed && (
                <div className="mt-4 grid gap-2 text-xs text-text-secondary">
                  <div className="flex items-center justify-between">
                    <span>{t('vibrationPoints')}</span>
                    <span className="font-semibold text-text-primary">
                      {numberFormatter.format(rawRecords.length)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t('planningPoints')}</span>
                    <span className="font-semibold text-text-primary">
                      {numberFormatter.format(spsPoints.length)}
                    </span>
                  </div>
                </div>
              )}
            </section>

            <section className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-border-color bg-bg-secondary/70 shadow-[0_25px_60px_-35px_rgba(15,23,42,0.55)]">
              <div
                className={`flex items-center justify-between border-b border-border-color px-4 py-3 text-xs uppercase tracking-[0.18em] text-text-tertiary ${
                  isSidebarCollapsed ? 'flex-col gap-2 text-center' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-accent-primary" />
                  {!isSidebarCollapsed && <span>{t('loadedFiles')}</span>}
                </div>
                <span className="rounded-full bg-bg-quaternary px-2 py-0.5 text-text-primary">
                  {numberFormatter.format(files.length)}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-4">
                {files.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-light bg-bg-tertiary/50 p-6 text-center text-text-tertiary">
                    <FilePlus size={24} />
                    <p className="text-xs font-semibold uppercase tracking-[0.3em]">{t('readyToAnalyze')}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {files.map(file => {
                      const isSelected = selectedFileNames.includes(file.name);
                      const Icon = getFileIcon(file.type);
                      return (
                        <button
                          key={file.name}
                          onClick={() => handleFileSelect(file.name)}
                          className={`group relative flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition-all ${
                            isSelected
                              ? 'border-accent-primary bg-accent-primary/15 text-accent-primary shadow-[0_20px_40px_-25px_rgba(37,99,235,0.65)]'
                              : 'bg-bg-tertiary/70 text-text-primary hover:border-border-color hover:bg-bg-tertiary/90'
                          }`}
                          title={file.name}
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-light bg-bg-secondary">
                            <Icon size={18} className={isSelected ? 'text-accent-primary' : 'text-text-secondary'} />
                          </span>
                          {!isSidebarCollapsed && (
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className="truncate text-sm font-semibold">{file.name}</span>
                              <span className="text-xs uppercase tracking-[0.2em] text-text-tertiary">
                                {t(`${file.type}File`)}
                              </span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div
                className={`border-t border-border-color px-4 py-4 ${
                  isSidebarCollapsed ? 'flex flex-col items-center gap-3' : 'space-y-3'
                }`}
              >
                {mode === 'vaps_analysis' && (
                  <>
                    <ActionButton
                      icon={LineChart}
                      text={t('showSummary')}
                      variant="primary"
                      onClick={() => setSummaryModalOpen(true)}
                      disabled={!summaryData}
                      compact={isSidebarCollapsed}
                    />
                    <ActionButton
                      icon={FileUp}
                      text={t('exportTxt')}
                      onClick={exportVapsTxt}
                      disabled={!summaryData}
                      compact={isSidebarCollapsed}
                    />
                  </>
                )}
                <ActionButton
                  icon={MapIcon}
                  text={t('geoPlanner')}
                  variant="ghost"
                  onClick={handleOpenMap}
                  disabled={rawRecords.length === 0 && spsPoints.length === 0}
                  compact={isSidebarCollapsed}
                />
              </div>
            </section>
          </div>
        </aside>
        <main className="relative flex-1 overflow-hidden bg-bg-secondary">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.15),transparent_60%)]" />
          <div className="relative z-10 h-full overflow-y-auto">
            <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-8 px-6 py-8">
              <div className="flex flex-wrap items-center gap-3">
                {renderFileBadge(selectedVapsFile, 'vapsFile')}
                {renderFileBadge(selectedSpsFile, 'spsFile')}
              </div>

              {quickMetrics.length > 0 && (
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {quickMetrics.map(metric => {
                    const Icon = metric.icon;
                    const toneColor =
                      metric.tone === 'success'
                        ? 'var(--color-success)'
                        : metric.tone === 'warning'
                        ? 'var(--color-warning)'
                        : metric.tone === 'info'
                        ? 'var(--color-info)'
                        : 'var(--color-accent-primary)';
                    return (
                      <div
                        key={metric.key}
                        className="group relative overflow-hidden rounded-3xl border border-border-color bg-bg-primary/90 p-6 shadow-[0_30px_70px_-45px_rgba(15,23,42,0.7)] transition-all hover:-translate-y-1 hover:border-accent-primary/60"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-tertiary">
                              {metric.label}
                            </p>
                            <p className="mt-4 text-2xl font-bold text-text-primary">{metric.value}</p>
                          </div>
                          <span
                            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border-light bg-bg-secondary"
                            style={{ color: toneColor, borderColor: toneColor }}
                          >
                            <Icon size={20} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}

              <section className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-border-color bg-bg-primary/90 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.65)]">
                <div className="relative flex-1 overflow-hidden">
                  {mode === 'welcome' && <WelcomeScreen theme={theme} />}
                  {mode === 'vaps_analysis' && analysisResult && (
                    <div className="flex h-full flex-col">
                      <AnalysisTabs analysisData={analysisResult} theme={theme} />
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>

      <NoticeCenter notices={notices} onDismiss={removeNotice} />

      <AboutModal isOpen={isAboutModalOpen} onClose={() => setAboutModalOpen(false)} theme={theme} />
      {mode === 'vaps_analysis' && (
        <SummaryModal
          isOpen={isSummaryModalOpen}
          onClose={() => setSummaryModalOpen(false)}
          summary={summaryData}
          rawRecords={rawRecords}
          theme={theme}
        />
      )}
      <MapModal
        isOpen={isMapModalOpen}
        onClose={() => setMapModalOpen(false)}
        rawRecords={rawRecords}
        spsPoints={spsPoints}
        theme={theme}
        summaryData={summaryData}
      />
    </div>
  );
}
interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ElementType;
  text: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  compact?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon: Icon, text, variant = 'secondary', compact = false, ...buttonProps }) => {
  const { className: providedClassName, ...restProps } = buttonProps;
  const mergedProps: React.ButtonHTMLAttributes<HTMLButtonElement> = {
    ...restProps,
    title: restProps.title ?? text,
  };

  if (compact && !mergedProps['aria-label']) {
    mergedProps['aria-label'] = text;
  }

  let baseClasses =
    'group relative flex items-center gap-3 rounded-2xl border border-border-color px-4 py-3 text-sm font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary disabled:pointer-events-none disabled:opacity-40';

  let iconClass = 'text-accent-primary transition';
  let textClass = 'truncate text-sm font-semibold';

  if (compact) {
    baseClasses =
      'flex h-12 w-12 items-center justify-center rounded-full border border-border-color bg-bg-tertiary/80 text-text-primary transition hover:border-accent-primary hover:text-accent-primary disabled:opacity-40';
    iconClass = 'text-accent-primary';
  } else if (variant === 'primary') {
    baseClasses +=
      ' border-transparent bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary text-white shadow-[0_18px_48px_-24px_rgba(37,99,235,0.7)] hover:shadow-[0_28px_65px_-30px_rgba(37,99,235,0.8)]';
    iconClass = 'text-white drop-shadow-sm';
    textClass = 'truncate text-sm font-semibold text-white';
  } else if (variant === 'ghost') {
    baseClasses += ' bg-transparent text-text-secondary hover:border-accent-primary hover:text-accent-primary';
  } else {
    baseClasses +=
      ' bg-bg-tertiary/80 text-text-primary hover:border-accent-primary hover:text-accent-primary shadow-[0_15px_35px_-30px_rgba(15,23,42,0.6)]';
  }

  mergedProps.className = [baseClasses, providedClassName].filter(Boolean).join(' ');

  return (
    <button {...mergedProps}>
      <Icon size={18} className={iconClass} />
      {!compact && <span className={textClass}>{text}</span>}
    </button>
  );
};

interface NoticeCenterProps {
  notices: NoticeEntry[];
  onDismiss: (id: string) => void;
}

const NoticeCenter: React.FC<NoticeCenterProps> = ({ notices, onDismiss }) => {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-3 px-4 sm:right-6 sm:left-auto sm:w-96 sm:items-stretch">
      {notices.map(notice => {
        const Icon = NOTICE_ICONS[notice.type];
        const accent = noticeAccent(notice.type);
        return (
          <div
            key={notice.id}
            className="pointer-events-auto relative overflow-hidden rounded-3xl border border-border-light bg-bg-primary/95 px-4 py-4 text-sm shadow-[0_30px_70px_-45px_rgba(15,23,42,0.75)] backdrop-blur animate-[toastSlideIn_0.45s_cubic-bezier(.22,.68,0,1.12)_forwards]"
            style={{ borderColor: accent }}
          >
            <div className="flex items-start gap-3">
              <div
                className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border bg-bg-secondary"
                style={{ borderColor: accent, color: accent }}
              >
                <Icon size={18} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-text-primary">{notice.title}</p>
                {notice.description && (
                  <p className="mt-1 text-xs leading-relaxed text-text-secondary">{notice.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(notice.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-text-secondary transition hover:text-text-primary"
                style={{ color: accent }}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
            <div
              className="absolute inset-x-0 bottom-0 h-1"
              style={{ background: accent, opacity: 0.3 }}
            />
          </div>
        );
      })}
    </div>
  );
};
