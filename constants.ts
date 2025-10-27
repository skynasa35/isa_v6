import { Themes, ThemeColors } from './types';

export const AURORA_THEME: ThemeColors = {
    bg_primary: '#080B18',
    bg_secondary: '#0F1327',
    bg_tertiary: '#161B33',
    bg_quaternary: '#1E2545',
    text_primary: '#F8FAFC',
    text_secondary: '#C7CCE7',
    text_tertiary: '#8B92BD',
    accent_primary: '#60A5FA',
    accent_secondary: '#A855F7',
    accent_tertiary: '#34D399',
    border: '#1F2642',
    border_light: '#2A3254',
    warning: '#FACC15',
    overload: '#F87171',
    success: '#34D399',
    info: '#38BDF8'
};

export const LUMEN_THEME: ThemeColors = {
    bg_primary: '#F5F7FB',
    bg_secondary: '#FFFFFF',
    bg_tertiary: '#EEF1F8',
    bg_quaternary: '#E1E6F2',
    text_primary: '#0F172A',
    text_secondary: '#475569',
    text_tertiary: '#64748B',
    accent_primary: '#2563EB',
    accent_secondary: '#F97316',
    accent_tertiary: '#0EA5E9',
    border: '#CBD5E1',
    border_light: '#E2E8F0',
    warning: '#F97316',
    overload: '#DC2626',
    success: '#16A34A',
    info: '#2563EB'
};

export const EQUINOX_THEME: ThemeColors = {
    bg_primary: '#101318',
    bg_secondary: '#171B23',
    bg_tertiary: '#1E242E',
    bg_quaternary: '#262E3B',
    text_primary: '#F5F9FF',
    text_secondary: '#BBC3D6',
    text_tertiary: '#8D96AA',
    accent_primary: '#3B82F6',
    accent_secondary: '#F59E0B',
    accent_tertiary: '#38BDF8',
    border: '#2C3645',
    border_light: '#3A4558',
    warning: '#F59E0B',
    overload: '#FB7185',
    success: '#22C55E',
    info: '#38BDF8'
};

export const THEMES: Themes = {
    Aurora: AURORA_THEME,
    Lumen: LUMEN_THEME,
    Equinox: EQUINOX_THEME,
};

export const DEFAULT_THEME = 'Lumen';
