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

  const wrapperClass =
    variant === 'dark'
      ? 'bg-white/10 border-white/15 text-white'
      : variant === 'glass'
      ? 'bg-black/35 backdrop-blur-md border-white/20 text-white'
      : 'bg-zinc-100 border-zinc-200 text-zinc-800';

  const activeBtnClass =
    variant === 'dark' || variant === 'glass'
      ? 'bg-white text-zinc-900 shadow-sm'
      : 'bg-white text-zinc-900 shadow-sm border border-zinc-200/80';

  const inactiveBtnClass =
    variant === 'dark' || variant === 'glass'
      ? 'text-white/75 hover:text-white'
      : 'text-zinc-500 hover:text-zinc-900';

  return (
    <div
      dir="ltr"
      role="group"
      aria-label="Language Switcher"
      className={`inline-flex items-center gap-0.5 rounded-lg border p-0.5 select-none ${wrapperClass} ${className}`}
    >
      {!compact && <Globe className="w-3.5 h-3.5 mx-1.5 opacity-70 shrink-0" />}
      <button
        type="button"
        onClick={() => setLang('ar')}
        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
          lang === 'ar' ? activeBtnClass : inactiveBtnClass
        }`}
      >
        AR
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
          lang === 'en' ? activeBtnClass : inactiveBtnClass
        }`}
      >
        EN
      </button>
    </div>
  );
};
