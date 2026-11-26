import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Home, LucideIcon, Search, Sparkles, X } from 'lucide-react';
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
  keywordsAr?: string;
  keywordsEn?: string;
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
  const [searchQuery, setSearchQuery] = useState('');

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

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    if (!normalizedQuery) return entries;
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    return entries.filter((entry) => {
      const haystack = [
        entry.titleAr,
        entry.titleEn,
        entry.pathAr,
        entry.pathEn,
        entry.stepsAr,
        entry.stepsEn,
        entry.keywordsAr || '',
        entry.keywordsEn || '',
      ]
        .join(' ')
        .toLowerCase();
      return tokens.every((tok) => haystack.includes(tok));
    });
  }, [entries, normalizedQuery]);

  // Quick interactive topic chips derived strictly from this user's actual entries
  const quickChips = useMemo(() => {
    return entries.slice(0, 6).map((e) => ({
      id: e.id,
      label: isEn ? e.titleEn.split('—')[0].trim() : e.titleAr.split('—')[0].trim(),
    }));
  }, [entries, isEn]);

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
                {isEn ? 'Smart User Guide' : 'دليل الاستخدام الذكي'}
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

      {/* Interactive Keyword Search & Quick Filter Bar */}
      <div
        className={`border p-4 space-y-3 ${radiusClasses.card}`}
        style={{
          backgroundColor: theme.surfaceBg,
          borderColor: theme.surfaceBorder,
          boxShadow: theme.cardShadow,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search
              className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                isRtl ? 'right-3.5' : 'left-3.5'
              }`}
              style={{ color: theme.mutedText }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isEn
                  ? 'Search by keyword (e.g. Cashier, Check, Discount, Tables, QR, Shift)...'
                  : 'ابحث بكلمة مفتاحية (مثلاً: كاشير، فاتورة، خصم، طاولات، QR، وردية)...'
              }
              aria-label={isEn ? 'Search user guide' : 'ابحث في دليل الاستخدام'}
              className={`w-full min-h-[44px] border text-xs sm:text-sm font-semibold focus:outline-none ${
                isRtl ? 'pr-10 pl-10' : 'pl-10 pr-10'
              } ${radiusClasses.button}`}
              style={{
                backgroundColor: theme.surfaceSubtleBg,
                borderColor: theme.surfaceBorder,
                color: theme.surfaceText,
              }}
            />
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={isEn ? 'Clear search' : 'مسح البحث'}
                className={`absolute top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer ${
                  isRtl ? 'left-1.5' : 'right-1.5'
                }`}
                style={{ color: theme.mutedText }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div
            className={`min-h-[44px] px-3.5 py-2 border text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shrink-0 ${radiusClasses.button}`}
            style={{
              backgroundColor: theme.surfaceSubtleBg,
              borderColor: theme.surfaceBorder,
              color: theme.surfaceText,
            }}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: iconTintColor }} />
            <span className="font-mono-num">
              {filteredEntries.length} / {entries.length}
            </span>
            <span>{isEn ? 'features' : 'ميزة'}</span>
          </div>
        </div>

        {quickChips.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold me-1" style={{ color: theme.mutedText }}>
              {isEn ? 'Quick jump:' : 'بحث سريع:'}
            </span>
            {quickChips.map((chip) => {
              const active = searchQuery.trim().toLowerCase() === chip.label.toLowerCase();
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setSearchQuery(active ? '' : chip.label)}
                  className={`min-h-[36px] px-3 py-1.5 border text-xs font-bold cursor-pointer transition-colors ${radiusClasses.pill}`}
                  style={
                    active
                      ? {
                          backgroundColor: btnBgColor,
                          borderColor: btnBgColor,
                          color: btnTextColor,
                        }
                      : {
                          backgroundColor: theme.surfaceSubtleBg,
                          borderColor: theme.surfaceBorder,
                          color: theme.surfaceText,
                        }
                  }
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        )}
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
        {filteredEntries.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-xs sm:text-sm font-semibold" style={{ color: theme.mutedText }}>
              {entries.length === 0
                ? isEn
                  ? 'No active screens are currently assigned to this account.'
                  : 'لا توجد شاشات مفعّلة لهذا الحساب حالياً.'
                : isEn
                  ? `No guide entries matched "${searchQuery}". Try another keyword.`
                  : `لم يتم العثور على ميزة مطابقة لـ «${searchQuery}». جرّب كلمة أخرى.`}
            </p>
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={`min-h-[44px] px-4 py-2 text-xs font-extrabold cursor-pointer ${radiusClasses.button}`}
                style={{ backgroundColor: btnBgColor, color: btnTextColor }}
              >
                {isEn ? 'Show all features' : 'عرض كل الميزات'}
              </button>
            )}
          </div>
        ) : (
          filteredEntries.map((entry, idx) => {
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
                    {isEn ? entry.goLabelEn || 'Click to open' : entry.goLabelAr || 'اضغط هنا للانتقال'}
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
