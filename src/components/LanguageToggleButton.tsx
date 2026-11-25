import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface LanguageToggleButtonProps {
  variant?: 'light' | 'dark' | 'glass';
  compact?: boolean;
  className?: string;
}

export const LanguageToggleButton: React.FC<LanguageToggleButtonProps> = ({
  variant = 'light',
  compact = false,
  className = '',
}) => {
  const { lang, setLang } = useLanguage();
  const nextLang = lang === 'ar' ? 'en' : 'ar';

  const buttonThemeClass =
    variant === 'dark'
      ? 'bg-white/15 hover:bg-white/25 border-white/25 text-white'
      : variant === 'glass'
        ? 'bg-black/55 hover:bg-black/70 backdrop-blur-md border-white/25 text-white'
        : 'bg-white hover:bg-zinc-50 border-zinc-300 text-slate-900 shadow-xs';

  return (
    <button
      type="button"
      dir="ltr"
      onClick={() => setLang(nextLang)}
      aria-label={lang === 'ar' ? 'Switch language to English' : 'التبديل إلى اللغة العربية'}
      title={lang === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border font-extrabold whitespace-nowrap shrink-0 select-none transition-colors cursor-pointer ${
        compact
          ? 'min-h-[44px] sm:min-h-[38px] min-w-[44px] px-2.5 sm:px-3 py-1.5 text-xs'
          : 'min-h-[44px] sm:min-h-[40px] min-w-[44px] px-3 py-2 text-xs'
      } ${buttonThemeClass} ${className}`}
    >
      <Globe className="w-3.5 h-3.5 shrink-0" />
      <span>{nextLang.toUpperCase()}</span>
    </button>
  );
};
