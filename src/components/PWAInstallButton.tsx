import { useState } from 'react';
import { Check, Copy, Download, MoreVertical, Share, Smartphone, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'hero' | 'compact' | 'menu';
  appTitle?: string;
  accentColor?: string;
  className?: string;
}

export function PWAInstallButton({
  variant = 'hero',
  appTitle,
  accentColor,
  className = '',
}: PWAInstallButtonProps) {
  const { lang, dir } = useLanguage();
  const isEn = lang === 'en';
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isInstalled) {
    return null;
  }

  const label = isEn ? 'Install App on Phone' : 'تثبيت التطبيق على الهاتف';
  const targetName = appTitle?.trim() || (isEn ? 'Sufra QR' : 'سُفرة QR');

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) {
        setGuideOpen(true);
      }
      return;
    }
    setGuideOpen(true);
  };

  const handleCopyCurrentUrl = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard restriction
    }
  };

  const buttonClasses =
    variant === 'menu'
      ? `min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer whitespace-nowrap ${className}`
      : variant === 'compact'
        ? `min-h-[36px] px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${className}`
        : `min-h-[46px] px-4 py-3 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer whitespace-nowrap ${className}`;

  const inlineStyle =
    variant === 'menu' && accentColor
      ? { backgroundColor: accentColor, color: '#FFFFFF' }
      : variant === 'menu'
        ? { backgroundColor: '#0F172A', color: '#FFFFFF' }
        : undefined;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        style={inlineStyle}
        className={buttonClasses}
      >
        <Smartphone className="w-4 h-4 shrink-0" />
        <span>{label}</span>
      </button>

      {guideOpen && (
        <div
          dir={dir}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setGuideOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white text-zinc-900 rounded-t-3xl sm:rounded-2xl border border-zinc-200 shadow-2xl p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-zinc-950">{label}</h3>
                  <p className="text-xs text-zinc-500">
                    {isEn
                      ? `Add "${targetName}" directly to your phone's home screen`
                      : `أضف "${targetName}" كأيقونة تطبيق على شاشة هاتفك`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                aria-label={isEn ? 'Close' : 'إغلاق'}
                className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-4 space-y-3 text-xs text-zinc-700 leading-relaxed">
                <p className="font-extrabold text-zinc-950">
                  {isEn ? 'Steps on iPhone / iPad (Safari):' : 'الخطوات على هواتف آيفون (Safari):'}
                </p>
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-zinc-950 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    {isEn ? 'Tap the Share button' : 'اضغط على زر المشاركة'}
                    <Share className="w-4 h-4 text-blue-600 inline" />
                    {isEn ? 'at the bottom of Safari.' : 'في أسفل متصفح Safari.'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-zinc-950 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </span>
                  <span>
                    {isEn
                      ? 'Scroll down and tap "Add to Home Screen".'
                      : 'مرّر للأسفل واختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-4 space-y-3 text-xs text-zinc-700 leading-relaxed">
                <p className="font-extrabold text-zinc-950">
                  {isEn
                    ? 'Quick Install on Android / Chrome:'
                    : 'التثبيت السريع على أندرويد / متصفح Chrome:'}
                </p>
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-zinc-950 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    {isEn ? 'Open browser menu' : 'اضغط على قائمة المتصفح'}
                    <MoreVertical className="w-4 h-4 text-zinc-800 inline" />
                    {isEn ? 'in the top corner.' : 'أعلى الشاشة.'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-zinc-950 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </span>
                  <span>
                    {isEn
                      ? 'Tap "Install app" or "Add to Home screen".'
                      : 'اختر "تثبيت التطبيق" أو "الإضافة إلى الشاشة الرئيسية" وستظهر الأيقونة فوراً.'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyCurrentUrl}
                className="flex-1 min-h-[42px] px-4 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>
                  {copied
                    ? isEn
                      ? 'Link Copied'
                      : 'تم نسخ الرابط'
                    : isEn
                      ? 'Copy Direct Link'
                      : 'نسخ الرابط المباشر'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 cursor-pointer"
              >
                {isEn ? 'Got it' : 'تم'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
