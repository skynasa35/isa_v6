import p5 from 'p5';

declare global {
    interface Window {
        p5: typeof p5,
        L: any;
    }
}

export interface ThemeColors {
  bg_primary: string;
  bg_secondary: string;
  bg_tertiary: string;
  bg_quaternary: string;
  text_primary: string;
  text_secondary: string;
  text_tertiary: string;
  accent_primary: string;
  accent_secondary: string;
  accent_tertiary: string;
  border: string;
  border_light: string;
  warning: string;
  overload: string;
  success: string;
  info: string;
}

export interface Themes {
  [key: string]: ThemeColors;
}

export type VibrationPointStatus = 'ok' | 'overload' | 'warning';

export interface VibrationRecord {
  id: string;
  lineNumber: number;
  recordIdentification: string | null;
  lineName: string | null;
  pointNumber: string | null;
  pointIndex: number | null;
  fleetNumber: string | null;
  vibratorNumber: number | null;
  vibratorDriveLevel: number | null;
  averagePhase: number | null;
  peakPhase: number | null;
  averageDistortion: number | null;
  peakDistortion: number | null;
  averageForce: number | null;
  peakForce: number | null;
  averageGroundStiffness: number | null;
  averageGroundViscosity: number | null;
  vibPositionEasting: number | null;
  vibPositionNorthing: number | null;
  vibPositionElevation: number | null;
  shotNb: number | null;
  acquisitionNb: number | null;
  twoDigitsFleetNumber: number | null;
  vibStatusCode: number | null;
  mass1Warning: string | null;
  mass2Warning: string | null;
  mass3Warning: string | null;
  plate1Warning: string | null;
  plate2Warning: string | null;
  plate3Warning: string | null;
  plate4Warning: string | null;
  plate5Warning: string | null;
  plate6Warning: string | null;
  forceOverload: string | null;
  pressureOverload: string | null;
  massOverload: string | null;
  valveOverload: string | null;
  excitationOverload: string | null;
  stackingFold: number | null;
  computationDomain: string | null;
  ve432Version: string | null;
  dayOfYear: number | null;
  timeHhmmss: string | null;
  hdop: number | null;
  tbDate: string | null;
  gpgga: string | null;

  // Added by analyzer logic
  vibratorId: string | null;
  hasGpsData: boolean;
  hasOverload: boolean;
  hasWarning: boolean;
  status: VibrationPointStatus;
  slope?: number;
  aspect?: number;
  duplicateVibrators?: string[];
}


export interface VibrationPointDetail {
  id: string; // Unique ID for each point
  vibroId: string;
  time: Date;
  location: { lat: number; lon: number, elevation: number };
  status: VibrationPointStatus;
  line: string;
  point: string;
  shotNb: string;
  avgForce: string;
  avgPhase: string;
  avgDist: string;
  slope?: number;
  aspect?: number;
  duplicateVibrators?: string[];
}

export interface SpsPoint {
  id: string;
  station: number;
  line: number;
  x: number;
  y: number;
  z: number;
  difficulty: number; // 0-1 scale
  assignedVibrator?: string;
}

export interface VibrationDataPoint {
  count: number;
  net_count: number;
  times: Date[];
  first_time_net: Date | null;
  last_time_net: Date | null;
  first_time_total: Date | null;
  last_time_total: Date | null;
  duplicates: number;
  duration_seconds_net: number;
  duration_seconds_total: number;
  multi_vib_shots: number;
}

export interface VibrationAnalysisResult {
  [vibroId: string]: VibrationDataPoint;
}

export interface SummaryGeneral {
  total_vibros: number;
  total_operations: number;
  total_duplicates: number;
  net_operations: number;
  duplicate_percentage: number;
  total_operation_duration_str: string;
  conflicted_shot_details: { shotNb: number; vibrators: string[] }[];
}

export interface SummaryIndividual {
  vibro_id: string;
  count: number;
  net_count: number;
  duplicates: number;
  dup_perc: number;
  first_time: string;
  last_time: string;
  duration_total: string;
  multi_vib_shots: number;
  efficiencyScore: number;
}

export interface SummaryData {
  timestamp: string;
  source_file: string;
  general_summary: SummaryGeneral;
  individual_performance: SummaryIndividual[];
}

export interface AppFile {
  name: string;
  content: string;
  type: 'vaps' | 'sps' | 'aps' | 'unknown';
}
