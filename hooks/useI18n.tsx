
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  ReactNode,
  useMemo
} from 'react';

type Language = 'en' | 'fr';
type Translations = Record<string, string>;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: { [key: string]: string | number }) => string;
}

export const I18nContext = createContext<I18nContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'app_language';

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [translations, setTranslations] = useState<Record<Language, Translations> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setLanguage = (lang: Language) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    setLanguageState(lang);
  };

  useEffect(() => {
    const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
    if (savedLang === 'en' || savedLang === 'fr') {
      setLanguageState(savedLang);
    }

    const fetchTranslations = async () => {
      try {
        const [enResponse, frResponse] = await Promise.all([
          fetch('/locales/en.json'),
          fetch('/locales/fr.json')
        ]);

        if (!enResponse.ok || !frResponse.ok) {
          throw new Error(`Failed to load translation files. Status: ${enResponse.status}, ${frResponse.status}`);
        }

        const enData = await enResponse.json();
        const frData = await frResponse.json();

        setTranslations({ en: enData, fr: frData });
      } catch (err) {
        console.error("Error loading translations:", err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTranslations();
  }, []);

  const t = useCallback((key: string, params?: { [key: string]: string | number }) => {
    if (!translations) return key;
    let translation = translations[language][key] || translations.en[key] || key;

    if (params) {
      Object.keys(params).forEach(pKey => {
        const regex = new RegExp(`\\{${pKey}\\}`, 'g');
        translation = translation.replace(regex, String(params[pKey]));
      });
    }
    return translation;
  }, [language, translations]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#233140',
        color: '#ecf0f1',
        fontFamily: 'sans-serif',
        fontSize: '1.5rem'
      }}>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        padding: '2rem',
        backgroundColor: '#2b0000',
        color: '#ffc0cb',
        fontFamily: 'monospace',
        fontSize: '1rem',
        whiteSpace: 'pre-wrap'
      }}>
        Fatal Error: Could not load language files. Please check the console and ensure 'locales/en.json' and 'locales/fr.json' are accessible.
        <br /><br />
        Details: {error}
      </div>
    );
  }

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
