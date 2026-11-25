import React, { useState } from 'react';
import { CheckCircle2, Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../contexts/LanguageContext';

interface PWAInstallButtonProps {
  variant?: 'primary' | 'outline' | 'compact' | 'hero' | 'menu';
  className?: string;
  appTitle?: string;
  accentColor?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'outline',
  className = '',
  appTitle,
  accentColor,
}) => {
  const { lang, dir } = useLanguage();
  const isEn = lang === 'en';
  const { isInstalled, isIOS, hasNativePrompt, promptInstall } = usePWAInstall();
  const [showInstructions, setShowInstructions] = useState(false);

  if (isInstalled) {
    if (variant === 'compact' || variant === 'menu') return null;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold whitespace-nowrap shrink-0 ${className}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        {isEn ? 'App installed on this device' : 'التطبيق مثبّت على هذا الجهاز'}
      </span>
    );
  }

  const handleClick = async () => {
    const result = await promptInstall();
    if (result === 'ios' || result === 'unavailable') {
      setShowInstructions(true);
    }
  };

  const baseStyles =
    variant === 'primary'
      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-bold'
      : variant === 'hero'
        ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm min-h-[44px] px-4 py-3.5 rounded-xl text-sm font-bold'
        : variant === 'menu'
          ? 'text-white shadow-sm min-h-[44px] sm:min-h-[38px] px-3 py-2 rounded-xl text-xs font-bold'
          : variant === 'compact'
            ? 'bg-slate-900 hover:bg-slate-800 text-white min-h-[44px] sm:min-h-[38px] px-3 py-2 rounded-xl text-xs font-bold'
            : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs';

  const inlineAccent =
    variant === 'menu'
      ? { backgroundColor: accentColor || '#0f172a' }
      : undefined;

  const displayTitle = isEn
    ? appTitle
      ? `Install ${appTitle} App`
      : 'Install Sufra QR App'
    : appTitle
      ? `تثبيت ${appTitle} كتطبيق`
      : 'تثبيت سُفرة QR كتطبيق';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        style={inlineAccent}
        className={`inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${baseStyles} ${className}`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>
          {variant === 'compact'
            ? isEn
              ? 'Install'
              : 'تثبيت'
            : isEn
              ? 'Install App'
              : 'تثبيت التطبيق على هذا الجهاز'}
        </span>
      </button>

      {showInstructions && (
        <div
          className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowInstructions(false)}
          dir={dir}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">{displayTitle}</h3>
                  <p className="text-xs text-slate-500">
                    {isEn ? 'For instant access from your Home Screen' : 'للوصول السريع من الشاشة الرئيسية'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={isEn ? 'Close' : 'إغلاق'}
                onClick={() => setShowInstructions(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-2.5 text-sm text-slate-700 bg-slate-50 rounded-xl p-3.5 border border-slate-200">
                <p className="font-bold text-slate-900">
                  {isEn ? 'On iPhone / iPad (Safari):' : 'على هواتف آيفون وآيباد (سفاري):'}
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-xs leading-relaxed">
                  {isEn ? (
                    <>
                      <li>
                        Tap the Share icon <Share className="inline w-3.5 h-3.5 text-sky-600 mx-0.5" /> in the Safari toolbar.
                      </li>
                      <li>Select <strong>Add to Home Screen</strong>.</li>
                      <li>Tap <strong>Add</strong> to place the app on your device.</li>
                    </>
                  ) : (
                    <>
                      <li>
                        اضغط على أيقونة المشاركة <Share className="inline w-3.5 h-3.5 text-sky-600 mx-0.5" /> في شريط المتصفح.
                      </li>
                      <li>اختر <strong>إضافة إلى الشاشة الرئيسية</strong>.</li>
                      <li>اضغط <strong>إضافة</strong> ليظهر التطبيق على الجهاز.</li>
                    </>
                  )}
                </ol>
              </div>
            ) : (
              <div className="space-y-2.5 text-sm text-slate-700 bg-slate-50 rounded-xl p-3.5 border border-slate-200">
                <p className="font-bold text-slate-900">
                  {isEn
                    ? hasNativePrompt
                      ? 'Install the app from the browser menu:'
                      : 'Install steps in Chrome / Edge:'
                    : hasNativePrompt
                      ? 'يمكنك تثبيت التطبيق من قائمة المتصفح:'
                      : 'خطوات التثبيت عبر المتصفح:'}
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-xs leading-relaxed">
                  {isEn ? (
                    <>
                      <li>Open the browser menu (⋮) in the top corner.</li>
                      <li>Choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</li>
                      <li>Confirm to launch the workspace in full-screen app mode.</li>
                    </>
                  ) : (
                    <>
                      <li>افتح قائمة المتصفح (⋮) في الزاوية العلوية.</li>
                      <li>اختر <strong>تثبيت التطبيق</strong> أو <strong>إضافة للشاشة الرئيسية</strong>.</li>
                      <li>أكّد التثبيت لفتح الشاشة بملء الشاشة دائماً.</li>
                    </>
                  )}
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowInstructions(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold cursor-pointer"
            >
              {isEn ? 'Got It' : 'فهمت'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
