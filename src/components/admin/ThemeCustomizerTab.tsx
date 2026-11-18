import { FormEvent, useEffect, useState } from 'react';
import { Check, Code2, ExternalLink, Loader2, Save, Sparkles, Upload } from 'lucide-react';
import { COLOR_PRESETS, MENU_THEMES } from '../../data/themes';
import {
  fetchActiveCustomThemes,
  isSlugAvailable,
  sanitizeSlug,
  updateRestaurantActiveTheme,
  updateRestaurantSettings,
  updateRestaurantThemeAndTaxes,
} from '../../lib/firestoreService';
import { CURATED_FOOD_IMAGES, uploadRestaurantAsset } from '../../lib/imageUtils';
import { ActiveTheme, CustomTheme, Restaurant } from '../../types/menu';
import { SafeImage } from '../SafeImage';

interface ThemeCustomizerTabProps {
  restaurant: Restaurant;
  onRestaurantUpdated: (updated: Restaurant) => void;
  onOpenPublicMenu: (path: string) => void;
}

function ThemeMiniPreview({
  themeId,
  bgPreview,
  cardPreview,
  accent,
}: {
  themeId: ActiveTheme;
  bgPreview: string;
  cardPreview: string;
  accent: string;
}) {
  if (themeId === 'theme-1') {
    return (
      <div
        style={{ backgroundColor: bgPreview }}
        className="h-24 rounded-xl p-2.5 flex items-center justify-center gap-1.5 overflow-hidden relative border border-black/15"
      >
        <div
          style={{ backgroundColor: cardPreview }}
          className="w-1/2 h-full rounded-r-md p-1.5 shadow-md flex flex-col justify-between"
        >
          <div className="w-6 h-6 rounded-full mx-auto shadow" style={{ backgroundColor: accent }} />
          <div className="space-y-1">
            <div className="h-1.5 w-3/4 mx-auto rounded bg-stone-800/30" />
            <div className="h-1.5 w-1/2 mx-auto rounded bg-stone-800/20" />
          </div>
        </div>
        <div
          style={{ backgroundColor: cardPreview }}
          className="w-1/2 h-full rounded-l-md p-1.5 shadow-md flex flex-col justify-between opacity-95"
        >
          <div className="h-1.5 w-2/3 rounded bg-stone-800/30" />
          <div className="grid grid-cols-2 gap-1">
            <div className="h-6 rounded bg-stone-800/15" />
            <div className="h-6 rounded bg-stone-800/15" />
          </div>
        </div>
      </div>
    );
  }

  if (themeId === 'theme-2') {
    return (
      <div className="h-24 rounded-xl bg-stone-50 overflow-hidden relative border border-black/10 flex flex-col justify-between">
        <div
          style={{
            backgroundColor: accent,
            borderBottomLeftRadius: '50% 18px',
            borderBottomRightRadius: '50% 18px',
          }}
          className="h-11 w-full flex items-end justify-center pb-1 gap-2"
        >
          <span className="w-3 h-3 rounded-full bg-white/60" />
          <span className="w-4 h-4 rounded-full bg-white border border-black/10" />
          <span className="w-3 h-3 rounded-full bg-white/60" />
        </div>
        <div className="pb-2 flex flex-col items-center gap-1">
          <div className="w-7 h-7 rounded-full bg-stone-300 border-2 border-white shadow -mt-4" />
          <div className="h-1.5 w-12 rounded bg-stone-300" />
        </div>
      </div>
    );
  }

  if (themeId === 'theme-3') {
    return (
      <div
        style={{ backgroundColor: bgPreview }}
        className="h-24 rounded-xl p-2 flex flex-col justify-between border border-black/10 relative"
      >
        <div className="grid grid-cols-2 gap-1.5">
          <div className="h-11 rounded-lg bg-white p-1.5 flex flex-col justify-between">
            <div className="h-4 rounded bg-stone-200" />
            <div className="h-2 w-full rounded bg-zinc-900" />
          </div>
          <div className="h-11 rounded-lg bg-white p-1.5 flex flex-col justify-between">
            <div className="h-4 rounded bg-stone-200" />
            <div className="h-2 w-full rounded bg-zinc-900" />
          </div>
        </div>
        <div className="h-5 w-4/5 mx-auto rounded-full bg-[#111111] flex items-center justify-around px-2">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          <span className="w-1.5 h-1.5 rounded-full bg-white/50" />
          <span className="w-1.5 h-1.5 rounded-full bg-white/50" />
        </div>
      </div>
    );
  }

  if (themeId === 'theme-6') {
    return (
      <div
        style={{ backgroundColor: bgPreview }}
        className="h-24 rounded-xl p-2.5 flex items-end justify-between border border-black/15 relative overflow-hidden"
      >
        <div className="space-y-1 w-2/3">
          <div className="h-2 w-3/4 rounded bg-white/80" />
          <div className="h-1.5 w-1/2 rounded bg-white/40" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="w-4 h-4 rounded-full bg-white/20" />
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: accent }} />
        </div>
      </div>
    );
  }

  if (themeId === 'theme-8') {
    return (
      <div
        style={{ backgroundColor: bgPreview }}
        className="h-24 rounded-xl p-2 grid grid-cols-3 gap-1.5 border border-black/10"
      >
        <div className="col-span-2 rounded-lg bg-white p-1.5 flex flex-col justify-between border border-slate-200">
          <span className="h-1.5 w-8 rounded" style={{ backgroundColor: accent }} />
          <div className="h-6 rounded bg-slate-100" />
        </div>
        <div className="col-span-1 flex flex-col gap-1.5">
          <div className="flex-1 rounded-lg bg-white border border-slate-200" />
          <div className="flex-1 rounded-lg bg-white border border-slate-200" />
        </div>
      </div>
    );
  }

  if (themeId === 'theme-9') {
    return (
      <div
        style={{ backgroundColor: bgPreview }}
        className="h-24 rounded-xl p-2 flex flex-col justify-between border border-black/10"
      >
        <div className="flex gap-1">
          <span className="h-3 w-8 rounded" style={{ backgroundColor: accent }} />
          <span className="h-3 w-8 rounded bg-slate-200" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="h-8 rounded bg-slate-100 flex items-center justify-between px-1.5">
            <span className="h-2 w-6 rounded bg-slate-300" />
            <span className="w-3.5 h-3.5 rounded text-[8px] text-white flex items-center justify-center" style={{ backgroundColor: accent }}>
              +
            </span>
          </div>
          <div className="h-8 rounded bg-slate-100 flex items-center justify-between px-1.5">
            <span className="h-2 w-6 rounded bg-slate-300" />
            <span className="w-3.5 h-3.5 rounded text-[8px] text-white flex items-center justify-center" style={{ backgroundColor: accent }}>
              +
            </span>
          </div>
        </div>
        <div className="h-3.5 rounded" style={{ backgroundColor: accent }} />
      </div>
    );
  }

  return (
    <div
      style={{ backgroundColor: bgPreview }}
      className="h-24 rounded-xl p-2.5 flex flex-col justify-between border border-black/15"
    >
      <div className="flex items-center justify-between">
        <span className="h-2 w-12 rounded" style={{ backgroundColor: accent }} />
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div style={{ backgroundColor: cardPreview }} className="h-9 rounded-lg border border-white/10" />
        <div style={{ backgroundColor: cardPreview }} className="h-9 rounded-lg border border-white/10" />
      </div>
    </div>
  );
}

export function ThemeCustomizerTab({
  restaurant,
  onRestaurantUpdated,
  onOpenPublicMenu,
}: ThemeCustomizerTabProps) {
  const [activeTheme, setActiveTheme] = useState<ActiveTheme>(restaurant.activeTheme);
  const [primaryColor, setPrimaryColor] = useState(restaurant.primaryColor);
  const [taxRate, setTaxRate] = useState(restaurant.taxRate);
  const [serviceCharge, setServiceCharge] = useState(restaurant.serviceCharge);
  const [switchingThemeId, setSwitchingThemeId] = useState<ActiveTheme | null>(null);
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeSavedMsg, setThemeSavedMsg] = useState<string | null>(null);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);

  useEffect(() => {
    fetchActiveCustomThemes().then(setCustomThemes);
  }, []);

  // Store settings
  const [name, setName] = useState(restaurant.name);
  const [slug, setSlug] = useState(restaurant.slug);
  const [tagline, setTagline] = useState(restaurant.tagline || '');
  const [whatsappNumber, setWhatsappNumber] = useState(restaurant.whatsappNumber);
  const [currency, setCurrency] = useState(restaurant.currency);
  const [logoUrl, setLogoUrl] = useState(restaurant.logoUrl || '');
  const [isOpen, setIsOpen] = useState(restaurant.isOpen);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const handleSelectThemeImmediate = async (nextTheme: ActiveTheme) => {
    setActiveTheme(nextTheme);
    setSwitchingThemeId(nextTheme);
    setThemeSavedMsg(null);
    try {
      await updateRestaurantActiveTheme(restaurant.id, nextTheme);
      onRestaurantUpdated({
        ...restaurant,
        activeTheme: nextTheme,
      });
      const label =
        MENU_THEMES.find((t) => t.id === nextTheme)?.name ||
        customThemes.find((t) => t.id === nextTheme)?.name ||
        nextTheme;
      setThemeSavedMsg(`تم تفعيل ثيم "${label}" فوراً في المنيو العام.`);
      setTimeout(() => setThemeSavedMsg(null), 3500);
    } finally {
      setSwitchingThemeId(null);
    }
  };

  const handleSaveThemeAndColor = async (e: FormEvent) => {
    e.preventDefault();
    setSavingTheme(true);
    setThemeSavedMsg(null);
    try {
      await updateRestaurantThemeAndTaxes(restaurant.id, {
        activeTheme,
        primaryColor,
        taxRate,
        serviceCharge,
      });
      onRestaurantUpdated({
        ...restaurant,
        activeTheme,
        primaryColor,
        taxRate,
        serviceCharge,
      });
      setThemeSavedMsg('تم حفظ اللون الأساسي والثيم ونسب الضريبة بنجاح.');
      setTimeout(() => setThemeSavedMsg(null), 3500);
    } finally {
      setSavingTheme(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const url = await uploadRestaurantAsset(file, restaurant.ownerId, 'logo');
      setLogoUrl(url);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    setSettingsMsg(null);

    const cleanSlug = sanitizeSlug(slug);
    if (cleanSlug.length < 2) {
      setSettingsError('يرجى إدخال رابط مميز صالح بالإنجليزية.');
      return;
    }
    if (cleanSlug !== restaurant.slug) {
      const avail = await isSlugAvailable(cleanSlug, restaurant.id);
      if (!avail) {
        setSettingsError('هذا الرابط محجوز لمطعم آخر، اختر اسماً مختلفاً.');
        return;
      }
    }

    setSavingSettings(true);
    try {
      const updated = await updateRestaurantSettings(restaurant, {
        name,
        slug: cleanSlug,
        tagline,
        whatsappNumber,
        logoUrl,
        currency,
        isOpen,
        taxRate,
        serviceCharge,
        primaryColor,
      });
      onRestaurantUpdated(updated);
      setSlug(updated.slug);
      setSettingsMsg('تم تحديث إعدادات المطعم بنجاح.');
      setTimeout(() => setSettingsMsg(null), 3500);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'تعذر حفظ الإعدادات');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-zinc-950">مظهر المنيو (9 ثيمات تريند)</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            اضغط على أي ثيم لتفعيله فوراً في المنيو العام، وخصّص اللون الأساسي وإعدادات المطعم
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenPublicMenu(`/menu/${restaurant.slug}?preview=1`)}
          className="px-4 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <ExternalLink className="w-4 h-4" />
          <span>معاينة المنيو العام</span>
        </button>
      </div>

      {/* 9 Trending Themes Visual Cards */}
      <form
        onSubmit={handleSaveThemeAndColor}
        className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-950">
              1. اختر مظهر المنيو (تحديث فوري في قاعدة البيانات)
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              يدعم محرك العرض 9 تصاميم احترافية بما فيها كتاب المنيو ثلاثي الأبعاد ومنيو الريلز
            </p>
          </div>
          {themeSavedMsg && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
              {themeSavedMsg}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MENU_THEMES.map((t) => {
            const active = activeTheme === t.id;
            const isUpdating = switchingThemeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectThemeImmediate(t.id)}
                className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  active
                    ? 'border-zinc-950 ring-2 ring-zinc-950 bg-zinc-50/70'
                    : 'border-zinc-200 bg-white hover:border-zinc-400'
                }`}
              >
                <div className="space-y-3 w-full">
                  <ThemeMiniPreview
                    themeId={t.id}
                    bgPreview={t.bgPreview}
                    cardPreview={t.cardPreview}
                    accent={active ? primaryColor : t.recommendedColor}
                  />

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-500 font-mono-num flex items-center gap-1.5">
                        <span>{String(t.number).padStart(2, '0')}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{t.englishName}</span>
                      </p>
                      <h4 className="text-sm font-extrabold text-zinc-950 mt-0.5 flex items-center gap-1.5">
                        <span>{t.name}</span>
                        {t.isFlagship && <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                      </h4>
                    </div>
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                        active
                          ? 'bg-zinc-950 border-zinc-950 text-white'
                          : 'border-zinc-300 text-transparent'
                      }`}
                    >
                      {isUpdating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-500 leading-relaxed">{t.description}</p>
                </div>

                <div className="pt-2 border-t border-zinc-100 w-full flex items-center justify-between text-[11px] font-bold">
                  <span className={active ? 'text-emerald-700' : 'text-zinc-500'}>
                    {active ? 'مفعّل حالياً' : 'اضغط للتفعيل الفوري'}
                  </span>
                  <span className="font-mono-num text-zinc-400">{t.id}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom Injected Themes from Super Admin */}
        {customThemes.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-zinc-100">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-extrabold text-zinc-950">
                ثيمات إضافية مخصصة ({customThemes.length})
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {customThemes.map((ct) => {
                const customId = ct.id as ActiveTheme;
                const active = activeTheme === customId;
                const isUpdating = switchingThemeId === customId;
                return (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => handleSelectThemeImmediate(customId)}
                    className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      active
                        ? 'border-zinc-950 ring-2 ring-zinc-950 bg-zinc-50/70'
                        : 'border-zinc-200 bg-white hover:border-zinc-400'
                    }`}
                  >
                    <div className="space-y-3 w-full">
                      <div className="h-24 rounded-xl overflow-hidden bg-zinc-900 border border-black/10 relative">
                        <SafeImage
                          src={ct.previewImage}
                          alt={ct.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] text-amber-700 font-bold">ثيم مخصص</p>
                          <h4 className="text-sm font-extrabold text-zinc-950 mt-0.5 truncate">
                            {ct.name}
                          </h4>
                        </div>
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                            active
                              ? 'bg-zinc-950 border-zinc-950 text-white'
                              : 'border-zinc-300 text-transparent'
                          }`}
                        >
                          {isUpdating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </span>
                      </div>

                      {ct.description && (
                        <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                          {ct.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-zinc-100 w-full flex items-center justify-between text-[11px] font-bold">
                      <span className={active ? 'text-emerald-700' : 'text-zinc-500'}>
                        {active ? 'مفعّل حالياً' : 'اضغط للتفعيل الفوري'}
                      </span>
                      <span className="font-mono-num text-zinc-400 truncate max-w-[110px]" dir="ltr">
                        {ct.id}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-3 pt-4 border-t border-zinc-100">
          <label className="block text-xs font-bold text-zinc-800">
            اللون الأساسي لهوية المطعم
          </label>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setPrimaryColor(c.hex)}
                  title={c.name}
                  style={{ backgroundColor: c.hex }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border-2 ${
                    primaryColor.toLowerCase() === c.hex.toLowerCase()
                      ? 'border-zinc-950 scale-110'
                      : 'border-white shadow-sm'
                  }`}
                >
                  {primaryColor.toLowerCase() === c.hex.toLowerCase() && (
                    <Check className="w-4 h-4 text-white" />
                  )}
                </button>
              ))}
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200 text-xs cursor-pointer">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-5 h-5 border-0 bg-transparent cursor-pointer"
                />
                <span className="font-mono-num font-semibold">{primaryColor}</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingTheme}
              className="px-6 py-2.5 rounded-xl bg-zinc-950 text-white text-sm font-bold hover:bg-zinc-800 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{savingTheme ? 'جاري الحفظ...' : 'حفظ اللون والضرائب'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Store Settings Form */}
      <form
        onSubmit={handleSaveSettings}
        className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-5"
      >
        <h3 className="text-sm font-extrabold text-zinc-950">2. إعدادات المطعم والضرائب وحالة العمل</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1">اسم المطعم *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">الرابط المميز (Slug) *</label>
            <div className="flex items-center rounded-xl border border-zinc-200 overflow-hidden">
              <input
                type="text"
                dir="ltr"
                required
                value={slug}
                onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
                className="flex-1 px-3.5 py-2.5 text-sm font-mono-num focus:outline-none"
              />
              <span className="px-3 py-2.5 bg-zinc-50 text-zinc-500 text-xs font-mono-num border-r border-zinc-200">
                /menu/
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1">الشعار النصي / الوصف (Tagline)</label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1">رقم واتساب الطلبات *</label>
            <input
              type="tel"
              dir="ltr"
              required
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num"
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">العملة</label>
            <input
              type="text"
              required
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">نسبة الضريبة (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num"
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">رسوم الخدمة (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={serviceCharge}
              onChange={(e) => setServiceCharge(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <SafeImage
            src={logoUrl}
            alt={name}
            className="w-14 h-14 rounded-xl object-cover border border-zinc-200"
          />
          <label className="px-3.5 py-2 rounded-xl border border-zinc-300 text-xs font-bold cursor-pointer hover:bg-zinc-50 flex items-center gap-1.5">
            {uploadingLogo ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>تغيير الشعار</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleLogoUpload(f);
              }}
            />
          </label>
          <div className="flex items-center gap-1.5">
            {CURATED_FOOD_IMAGES.slice(0, 4).map((img) => (
              <button
                key={img.url}
                type="button"
                onClick={() => setLogoUrl(img.url)}
                className={`w-9 h-9 rounded-lg overflow-hidden border-2 cursor-pointer ${
                  logoUrl === img.url ? 'border-zinc-950' : 'border-transparent opacity-70'
                }`}
              >
                <SafeImage src={img.url} alt={img.label} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-100">
          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={isOpen}
              onChange={(e) => setIsOpen(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
            <span>المطعم مفتوح ويستقبل الطلبات حالياً</span>
          </label>

          <button
            type="submit"
            disabled={savingSettings}
            className="px-6 py-2.5 rounded-xl bg-zinc-950 text-white text-sm font-bold hover:bg-zinc-800 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingSettings ? 'جاري الحفظ...' : 'حفظ إعدادات المطعم'}</span>
          </button>
        </div>

        {settingsMsg && <p className="text-xs font-bold text-emerald-700">{settingsMsg}</p>}
        {settingsError && <p className="text-xs font-bold text-red-600">{settingsError}</p>}
      </form>
    </div>
  );
}
