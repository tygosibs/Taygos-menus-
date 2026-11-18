import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AppLang,
  formatCurrency as formatCurrencyHelper,
  loc as locHelper,
  TRANSLATIONS,
  TranslationStrings,
} from '../data/translations';

const STORAGE_KEY = 'sufra_lang';

interface LanguageContextValue {
  lang: AppLang;
  dir: 'rtl' | 'ltr';
  isRtl: boolean;
  setLang: (lang: AppLang) => void;
  toggleLang: () => void;
  t: TranslationStrings;
  loc: (ar?: string | null, en?: string | null) => string;
  formatCurrency: (currency?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLang(): AppLang {
  if (typeof window === 'undefined') return 'ar';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') return saved;
  } catch {
    // ignore storage errors
  }
  return 'ar';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<AppLang>(getInitialLang);

  const dir: 'rtl' | 'ltr' = lang === 'ar' ? 'rtl' : 'ltr';
  const isRtl = lang === 'ar';

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        // ignore storage errors
      }
    }
  }, [lang, dir]);

  const setLang = useCallback((next: AppLang) => {
    setLangState(next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'ar' ? 'en' : 'ar'));
  }, []);

  const loc = useCallback(
    (ar?: string | null, en?: string | null) => locHelper(ar, en, lang),
    [lang]
  );

  const formatCurrency = useCallback(
    (currency?: string) => formatCurrencyHelper(currency, lang),
    [lang]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      dir,
      isRtl,
      setLang,
      toggleLang,
      t: TRANSLATIONS[lang],
      loc,
      formatCurrency,
    }),
    [lang, dir, isRtl, setLang, toggleLang, loc, formatCurrency]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
