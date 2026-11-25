import { ArrowLeft, ArrowRight, BookOpen, Home, LucideIcon } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getContrastRatio, getReadableTextOnBg } from '../lib/platformUiDefaults';
import { ScreenThemeTokens } from '../types/uiStudio';

export interface UserGuideEntry {
  id: string;
  icon: LucideIcon;
  titleAr: string;
  titleEn: string;
  pathAr: string;
  pathEn: string;
  stepsAr: string;
  stepsEn: string;
  onGo: () => void;
  goLabelAr?: string;
  goLabelEn?: string;
}

interface UserGuidePageProps {
  roleTitleAr: string;
  roleTitleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  theme: ScreenThemeTokens;
  radiusClasses: { card: string; button: string; pill: string };
  entries: UserGuideEntry[];
  onBackHome: () => void;
  backHomeLabelAr?: string;
  backHomeLabelEn?: string;
}

export function UserGuidePage({
  roleTitleAr,
  roleTitleEn,
  subtitleAr,
  subtitleEn,
  theme,
  radiusClasses,
  entries,
  onBackHome,
  backHomeLabelAr,
  backHomeLabelEn,
}: UserGuidePageProps) {
  const { lang, isRtl } = useLanguage();
  const isEn = lang === 'en';
  const GoArrow = isRtl ? ArrowLeft : ArrowRight;

  // Ensure icon tint inside light surface cards has >= 4.5:1 contrast against surfaceSubtleBg
  const iconTintColor =
    getContrastRatio(theme.accentHex, theme.surfaceSubtleBg) >= 4.5
      ? theme.accentHex
      : getReadableTextOnBg(theme.surfaceSubtleBg, '#0E1B3D', '#FFFFFF');

  const btnBgColor = theme.accentHex;
  const btnTextColor =
    getContrastRatio(btnBgColor, theme.accentTextHex) >= 4.5
      ? theme.accentTextHex
      : getReadableTextOnBg(btnBgColor, '#0E1B3D', '#FFFFFF');

  return (
    <div className="space-y-4">
      {/* Full-Page Header Card */}
      <div
        className={`border p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${radiusClasses.card}`}
        style={{
          backgroundColor: theme.surfaceBg,
          borderColor: theme.surfaceBorder,
          boxShadow: theme.cardShadow,
        }}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-11 h-11 border flex items-center justify-center shrink-0 ${radiusClasses.button}`}
            style={{
              backgroundColor: theme.surfaceSubtleBg,
              borderColor: theme.surfaceBorder,
              color: iconTintColor,
            }}
          >
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="text-base sm:text-xl font-extrabold leading-snug"
                style={{ color: theme.surfaceText }}
              >
                {isEn ? 'User Guide' : 'دليل الاستخدام'}
              </h1>
              <span
                className={`px-2.5 py-0.5 border text-xs font-extrabold ${radiusClasses.pill}`}
                style={{
                  backgroundColor: theme.surfaceSubtleBg,
                  borderColor: theme.surfaceBorder,
                  color: theme.surfaceText,
                }}
              >
                {isEn ? roleTitleEn : roleTitleAr}
              </span>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: theme.mutedText }}>
              {isEn ? subtitleEn : subtitleAr}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackHome}
          className={`min-h-[44px] px-4 py-2.5 border text-xs sm:text-[13px] font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer shrink-0 ${radiusClasses.button}`}
          style={{
            backgroundColor: theme.surfaceSubtleBg,
            borderColor: theme.surfaceBorder,
            color: theme.surfaceText,
          }}
        >
          <Home className="w-4 h-4 shrink-0" />
          <span className="whitespace-normal break-words">
            {isEn ? backHomeLabelEn || 'Back to Workspace' : backHomeLabelAr || 'العودة للرئيسية'}
          </span>
        </button>
      </div>

      {/* Quick Tip Strip */}
      <div
        className={`border px-4 py-3 text-xs sm:text-[13px] font-semibold leading-relaxed ${radiusClasses.card}`}
        style={{
          backgroundColor: theme.surfaceSubtleBg,
          borderColor: theme.surfaceBorder,
          color: theme.surfaceText,
        }}
      >
        {isEn
          ? 'Each line below shows a feature available to your account, how to reach it from your menu, and a direct button to open it immediately.'
          : 'كل سطر أدناه يوضح ميزة متاحة لدورك الحالي، ومسار الوصول إليها من قائمتك، مع زر مباشر ينقلك إلى الصفحة فوراً.'}
      </div>

      {/* Feature Rows List */}
      <div
        className={`border divide-y overflow-hidden ${radiusClasses.card}`}
        style={{
          backgroundColor: theme.surfaceBg,
          borderColor: theme.surfaceBorder,
          boxShadow: theme.cardShadow,
        }}
      >
        {entries.length === 0 ? (
          <div className="p-6 text-center text-xs sm:text-sm" style={{ color: theme.mutedText }}>
            {isEn
              ? 'No active screens are currently assigned to this account.'
              : 'لا توجد شاشات مفعّلة لهذا الحساب حالياً.'}
          </div>
        ) : (
          entries.map((entry, idx) => {
            const Icon = entry.icon;
            return (
              <div
                key={entry.id}
                className="p-4 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{ borderColor: theme.surfaceBorder }}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`w-10 h-10 border flex items-center justify-center shrink-0 mt-0.5 ${radiusClasses.button}`}
                    style={{
                      backgroundColor: theme.surfaceSubtleBg,
                      borderColor: theme.surfaceBorder,
                      color: iconTintColor,
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="font-mono-num text-[11px] font-extrabold px-2 py-0.5 rounded-md border shrink-0"
                        style={{
                          backgroundColor: theme.surfaceSubtleBg,
                          borderColor: theme.surfaceBorder,
                          color: theme.mutedText,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <h2
                        className="text-sm sm:text-[15px] font-extrabold leading-snug whitespace-normal break-words"
                        style={{ color: theme.surfaceText }}
                      >
                        {isEn ? entry.titleEn : entry.titleAr}
                      </h2>
                    </div>
                    <p
                      className="text-xs font-bold leading-relaxed whitespace-normal break-words"
                      style={{ color: iconTintColor }}
                    >
                      {isEn ? entry.pathEn : entry.pathAr}
                    </p>
                    <p
                      className="text-xs sm:text-[13px] leading-relaxed whitespace-normal break-words"
                      style={{ color: theme.mutedText }}
                    >
                      {isEn ? entry.stepsEn : entry.stepsAr}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={entry.onGo}
                  className={`min-h-[44px] px-4 py-2.5 text-xs sm:text-[13px] font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${radiusClasses.button}`}
                  style={{
                    backgroundColor: btnBgColor,
                    color: btnTextColor,
                  }}
                >
                  <span className="whitespace-normal break-words">
                    {isEn ? entry.goLabelEn || 'Go to page' : entry.goLabelAr || 'اذهب إليها'}
                  </span>
                  <GoArrow className="w-4 h-4 shrink-0" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
