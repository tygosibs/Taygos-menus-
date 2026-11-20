import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Image as ImageIcon,
  LayoutList,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { DEFAULT_PLATFORM_LANDING } from '../../data/defaultLandingSettings';
import {
  fetchPlatformLandingSettings,
  normalizeLandingSections,
  savePlatformLandingSettings,
} from '../../lib/firestoreService';
import { uploadRestaurantAsset } from '../../lib/imageUtils';
import {
  resolvePlatformShareDescription,
  resolvePlatformShareTitle,
} from '../../lib/seoHead';
import { LandingSectionId, PlatformLandingSettings } from '../../types/menu';
import { SafeImage } from '../SafeImage';
import { SharePreviewCard } from '../SharePreviewCard';

const SECTION_LABELS: Record<LandingSectionId, { ar: string; en: string }> = {
  hero: { ar: 'الهيرو الترحيبي (أعلى الصفحة)', en: 'Hero Showcase Banner' },
  themes: { ar: 'معرض الـ 11 ثيماً التفاعلية', en: '11 Interactive Themes Showcase' },
  features: { ar: 'المميزات الأساسية للمنصة', en: 'Core Platform Features' },
  operations: { ar: 'تشغيل الصالة، الصالات، الكابتن و KDS', en: 'Floor Operations, Separate Check & KDS' },
  loyalty: { ar: 'منظومة ولاء العملاء ورادار أعياد الميلاد', en: 'Smart Loyalty & Birthday Radar' },
  pricing: { ar: 'باقات الاشتراك والأسعار', en: 'Subscription Pricing Plans' },
  tygos_promo: { ar: 'مسار الترقية لمنظومة تايجوس (Tygos Cloud ERP)', en: 'Tygos Cloud ERP Upgrade Section' },
};

export function LandingCmsTab() {
  const { lang, t } = useLanguage();
  const isEn = lang === 'en';
  const [form, setForm] = useState<PlatformLandingSettings>(DEFAULT_PLATFORM_LANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPlatformLandingSettings()
      .then((data) => {
        if (active) setForm(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : t.auth.errGeneric);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t.auth.errGeneric]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedNotice(false);
    try {
      await savePlatformLandingSettings(form);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.errGeneric);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setForm(DEFAULT_PLATFORM_LANDING);
    setSavedNotice(false);
  };

  const handlePlatformLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    setError(null);
    try {
      const url = await uploadRestaurantAsset(file, 'platform', 'platform');
      setForm((p) => ({ ...p, platformLogoUrl: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.errGeneric);
    } finally {
      setUploadingLogo(false);
    }
  };

  const orderedSections = normalizeLandingSections(form.sections);

  const moveSection = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= orderedSections.length) return;
    const next = [...orderedSections];
    const [removed] = next.splice(index, 1);
    next.splice(target, 0, removed);
    setForm((p) => ({ ...p, sections: next }));
  };

  const toggleSectionVisibility = (id: LandingSectionId) => {
    const next = orderedSections.map((s) =>
      s.id === id ? { ...s, isVisible: !s.isVisible } : s
    );
    setForm((p) => ({ ...p, sections: next }));
  };

  if (loading) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center space-y-2">
        <Loader2 className="w-7 h-7 animate-spin text-zinc-700 mx-auto" />
        <p className="text-xs font-semibold text-zinc-500">{t.admin.loadingWorkspace}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-zinc-950">{t.superAdmin.cms.title}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{t.superAdmin.cms.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isEn ? 'Reset' : 'إعادة ضبط'}</span>
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : savedNotice ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>
              {saving
                ? t.superAdmin.cms.savingBtn
                : savedNotice
                  ? t.superAdmin.cms.savedToast
                  : t.superAdmin.cms.saveBtn}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
          {error}
        </div>
      )}

      {/* Section Ordering & Visibility Controller */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <div className="border-b border-zinc-100 pb-3">
          <h3 className="text-sm font-extrabold text-zinc-950 flex items-center gap-2">
            <LayoutList className="w-4 h-4 text-amber-600" />
            <span>
              {isEn
                ? '1. Landing Page Sections Order & Visibility'
                : '١. ترتيب وإظهار / إخفاء أقسام صفحة الهبوط'}
            </span>
          </h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {isEn
              ? 'Reorder sections up/down or toggle visibility of any section on the public home page.'
              : 'تحكم الكامل في ترتيب ظهور كل قسم في الصفحة الرئيسية أو إخفائه مؤقتاً بضغطة زر.'}
          </p>
        </div>

        <div className="space-y-2">
          {orderedSections.map((sec, idx) => {
            const label = SECTION_LABELS[sec.id];
            return (
              <div
                key={sec.id}
                className={`px-3.5 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 transition-colors ${
                  sec.isVisible
                    ? 'bg-zinc-50/70 border-zinc-200'
                    : 'bg-zinc-100/70 border-zinc-200 opacity-65'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-zinc-950 text-white font-mono-num text-[11px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-extrabold text-zinc-900 truncate">
                    {isEn ? label.en : label.ar}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveSection(idx, -1)}
                    aria-label="Move up"
                    className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-35 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === orderedSections.length - 1}
                    onClick={() => moveSection(idx, 1)}
                    aria-label="Move down"
                    className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-35 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSectionVisibility(sec.id)}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                      sec.isVisible
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    {sec.isVisible ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Visible' : 'ظاهر'}</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Hidden' : 'مخفي'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hero Section & Support Settings (Dual AR / EN) */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-zinc-950 border-b border-zinc-100 pb-3">
          {isEn
            ? '2. Hero & Global Settings (AR / EN)'
            : '٢. إعدادات الهيرو والمنصة (عربي / إنجليزي)'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {isEn ? 'Top Tagline Badge (Arabic)' : 'شريط التميز العلوي (عربي)'}
            </label>
            <input
              type="text"
              dir="rtl"
              maxLength={120}
              value={form.heroBadge || ''}
              onChange={(e) => setForm((p) => ({ ...p, heroBadge: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {isEn ? 'Top Tagline Badge (English)' : 'شريط التميز العلوي (إنجليزي)'}
            </label>
            <input
              type="text"
              dir="ltr"
              maxLength={120}
              value={form.heroBadge_en || ''}
              onChange={(e) => setForm((p) => ({ ...p, heroBadge_en: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {t.superAdmin.cms.heroTitleAr}
            </label>
            <input
              type="text"
              dir="rtl"
              required
              maxLength={200}
              value={form.heroTitle}
              onChange={(e) => setForm((p) => ({ ...p, heroTitle: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {t.superAdmin.cms.heroTitleEn}
            </label>
            <input
              type="text"
              dir="ltr"
              maxLength={200}
              value={form.heroTitle_en || ''}
              onChange={(e) => setForm((p) => ({ ...p, heroTitle_en: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {t.superAdmin.cms.heroSubtitleAr}
            </label>
            <textarea
              rows={3}
              dir="rtl"
              required
              maxLength={600}
              value={form.heroSubtitle}
              onChange={(e) => setForm((p) => ({ ...p, heroSubtitle: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {t.superAdmin.cms.heroSubtitleEn}
            </label>
            <textarea
              rows={3}
              dir="ltr"
              maxLength={600}
              value={form.heroSubtitle_en || ''}
              onChange={(e) => setForm((p) => ({ ...p, heroSubtitle_en: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {t.superAdmin.cms.ctaAr}
            </label>
            <input
              type="text"
              dir="rtl"
              required
              maxLength={80}
              value={form.ctaButtonText}
              onChange={(e) => setForm((p) => ({ ...p, ctaButtonText: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {t.superAdmin.cms.ctaEn}
            </label>
            <input
              type="text"
              dir="ltr"
              maxLength={80}
              value={form.ctaButtonText_en || ''}
              onChange={(e) => setForm((p) => ({ ...p, ctaButtonText_en: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {isEn ? 'Secondary Demo Button (AR)' : 'زر المعاينة الثاني (عربي)'}
            </label>
            <input
              type="text"
              dir="rtl"
              maxLength={80}
              value={form.heroSecondaryBtnText || ''}
              onChange={(e) => setForm((p) => ({ ...p, heroSecondaryBtnText: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {isEn ? 'Secondary Demo Button (EN)' : 'زر المعاينة الثاني (إنجليزي)'}
            </label>
            <input
              type="text"
              dir="ltr"
              maxLength={80}
              value={form.heroSecondaryBtnText_en || ''}
              onChange={(e) =>
                setForm((p) => ({ ...p, heroSecondaryBtnText_en: e.target.value }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {t.superAdmin.cms.whatsappLabel}
            </label>
            <input
              type="text"
              maxLength={32}
              dir="ltr"
              value={form.supportWhatsapp}
              onChange={(e) => setForm((p) => ({ ...p, supportWhatsapp: e.target.value }))}
              placeholder="201000000000"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {t.superAdmin.cms.footerAr}
            </label>
            <input
              type="text"
              dir="rtl"
              required
              maxLength={200}
              value={form.footerText}
              onChange={(e) => setForm((p) => ({ ...p, footerText: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {t.superAdmin.cms.footerEn}
            </label>
            <input
              type="text"
              dir="ltr"
              maxLength={200}
              value={form.footerText_en || ''}
              onChange={(e) => setForm((p) => ({ ...p, footerText_en: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Platform Brand Logo & Root WhatsApp/Social Share Card */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-950 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-amber-600" />
              <span>
                {isEn
                  ? 'Platform Logo & Root Link Share Card (WhatsApp / Social)'
                  : 'لوجو المنصة وبطاقة مشاركة الرابط الرئيسي (واتساب والسوشيال)'}
              </span>
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {isEn
                ? 'Shown automatically whenever the main platform URL (/) is shared on WhatsApp or social apps.'
                : 'تظهر هذه الصورة وهذا الترحيب تلقائياً عند إرسال الرابط الرئيسي للمنصة لأي عميل.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <SafeImage
            src={form.platformLogoUrl || DEFAULT_PLATFORM_LANDING.platformLogoUrl}
            alt="Sufra QR Platform Logo"
            className="w-16 h-16 rounded-2xl object-cover border border-zinc-200 shadow-xs"
          />
          <label className="px-4 py-2.5 rounded-xl border border-zinc-300 text-xs font-bold cursor-pointer hover:bg-zinc-50 flex items-center gap-2">
            {uploadingLogo ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>{isEn ? 'Upload Platform Logo' : 'رفع لوجو المنصة'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePlatformLogoUpload(f);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              setForm((p) => ({
                ...p,
                platformLogoUrl: DEFAULT_PLATFORM_LANDING.platformLogoUrl,
              }))
            }
            className="px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
          >
            {isEn ? 'Restore Default Emblem' : 'استعادة شعار سُفرة الافتراضي'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {isEn ? 'Root Share Title (Arabic)' : 'عنوان مشاركة رابط المنصة (عربي)'}
            </label>
            <input
              type="text"
              dir="rtl"
              maxLength={140}
              value={form.shareTitle || ''}
              onChange={(e) => setForm((p) => ({ ...p, shareTitle: e.target.value }))}
              placeholder={DEFAULT_PLATFORM_LANDING.shareTitle}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {isEn ? 'Root Share Title (English)' : 'عنوان مشاركة رابط المنصة (إنجليزي)'}
            </label>
            <input
              type="text"
              dir="ltr"
              maxLength={140}
              value={form.shareTitle_en || ''}
              onChange={(e) => setForm((p) => ({ ...p, shareTitle_en: e.target.value }))}
              placeholder={DEFAULT_PLATFORM_LANDING.shareTitle_en}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {isEn ? 'Root Share 2-Line Description (Arabic)' : 'وصف المشاركة أسفل العنوان (عربي)'}
            </label>
            <textarea
              rows={2}
              dir="rtl"
              maxLength={300}
              value={form.shareDescription || ''}
              onChange={(e) => setForm((p) => ({ ...p, shareDescription: e.target.value }))}
              placeholder={DEFAULT_PLATFORM_LANDING.shareDescription}
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {isEn ? 'Root Share 2-Line Description (English)' : 'وصف المشاركة أسفل العنوان (إنجليزي)'}
            </label>
            <textarea
              rows={2}
              dir="ltr"
              maxLength={300}
              value={form.shareDescription_en || ''}
              onChange={(e) => setForm((p) => ({ ...p, shareDescription_en: e.target.value }))}
              placeholder={DEFAULT_PLATFORM_LANDING.shareDescription_en}
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
        </div>

        <SharePreviewCard
          mode="platform"
          title={resolvePlatformShareTitle(form, lang)}
          description={resolvePlatformShareDescription(form, lang)}
          imageUrl={form.platformLogoUrl || DEFAULT_PLATFORM_LANDING.platformLogoUrl}
          shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/` : '/'}
          isEn={isEn}
        />
      </div>

      {/* Themes Section Headings (Dual AR / EN) */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-zinc-950 border-b border-zinc-100 pb-3">
          {isEn ? '3. Themes Section Copy (AR / EN)' : '٣. نصوص قسم الـ 11 ثيماً التفاعلية (AR / EN)'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {isEn ? 'Themes Heading (Arabic)' : 'عنوان قسم الثيمات (عربي)'}
            </label>
            <input
              type="text"
              dir="rtl"
              maxLength={160}
              value={form.themesTitle || ''}
              onChange={(e) => setForm((p) => ({ ...p, themesTitle: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {isEn ? 'Themes Heading (English)' : 'عنوان قسم الثيمات (إنجليزي)'}
            </label>
            <input
              type="text"
              dir="ltr"
              maxLength={160}
              value={form.themesTitle_en || ''}
              onChange={(e) => setForm((p) => ({ ...p, themesTitle_en: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {isEn ? 'Themes Subtitle (Arabic)' : 'وصف قسم الثيمات (عربي)'}
            </label>
            <textarea
              rows={2}
              dir="rtl"
              maxLength={400}
              value={form.themesSubtitle || ''}
              onChange={(e) => setForm((p) => ({ ...p, themesSubtitle: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              {isEn ? 'Themes Subtitle (English)' : 'وصف قسم الثيمات (إنجليزي)'}
            </label>
            <textarea
              rows={2}
              dir="ltr"
              maxLength={400}
              value={form.themesSubtitle_en || ''}
              onChange={(e) => setForm((p) => ({ ...p, themesSubtitle_en: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Features List Builder (Dual AR / EN) */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-950">
              {t.superAdmin.cms.featuresHeading} ({form.features.length})
            </h3>
          </div>
          <button
            type="button"
            disabled={form.features.length >= 12}
            onClick={() =>
              setForm((p) => ({
                ...p,
                features: [
                  ...p.features,
                  { title: '', title_en: '', description: '', description_en: '', isVisible: true },
                ],
              }))
            }
            className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-800 hover:bg-zinc-50 flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.superAdmin.cms.addFeatureBtn}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
          <input
            type="text"
            dir="rtl"
            maxLength={160}
            placeholder={isEn ? 'Features Section Title (AR)' : 'عنوان قسم المميزات (عربي)'}
            value={form.featuresTitle || ''}
            onChange={(e) => setForm((p) => ({ ...p, featuresTitle: e.target.value }))}
            className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-xs font-bold"
          />
          <input
            type="text"
            dir="ltr"
            maxLength={160}
            placeholder={isEn ? 'Features Section Title (EN)' : 'عنوان قسم المميزات (إنجليزي)'}
            value={form.featuresTitle_en || ''}
            onChange={(e) => setForm((p) => ({ ...p, featuresTitle_en: e.target.value }))}
            className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-xs font-bold"
          />
          <input
            type="text"
            dir="rtl"
            maxLength={400}
            placeholder={isEn ? 'Features Section Subtitle (AR)' : 'وصف قسم المميزات (عربي)'}
            value={form.featuresSubtitle || ''}
            onChange={(e) => setForm((p) => ({ ...p, featuresSubtitle: e.target.value }))}
            className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-xs"
          />
          <input
            type="text"
            dir="ltr"
            maxLength={400}
            placeholder={isEn ? 'Features Section Subtitle (EN)' : 'وصف قسم المميزات (إنجليزي)'}
            value={form.featuresSubtitle_en || ''}
            onChange={(e) => setForm((p) => ({ ...p, featuresSubtitle_en: e.target.value }))}
            className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-xs"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {form.features.map((feat, idx) => (
            <div
              key={`feat_${idx}`}
              className={`p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-2.5 ${
                feat.isVisible === false ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-zinc-500 font-mono-num">
                  #{idx + 1}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        features: p.features.map((f, i) =>
                          i === idx ? { ...f, isVisible: f.isVisible === false } : f
                        ),
                      }))
                    }
                    className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                      feat.isVisible !== false
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-zinc-300 bg-white text-zinc-600'
                    }`}
                  >
                    {feat.isVisible !== false ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{feat.isVisible !== false ? (isEn ? 'Shown' : 'ظاهر') : isEn ? 'Hidden' : 'مخفي'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        features: p.features.filter((_, i) => i !== idx),
                      }))
                    }
                    className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  dir="rtl"
                  required
                  placeholder={t.superAdmin.cms.featureTitleAr}
                  value={feat.title}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      features: p.features.map((f, i) =>
                        i === idx ? { ...f, title: e.target.value } : f
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs font-bold"
                />
                <input
                  type="text"
                  dir="ltr"
                  placeholder={t.superAdmin.cms.featureTitleEn}
                  value={feat.title_en || ''}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      features: p.features.map((f, i) =>
                        i === idx ? { ...f, title_en: e.target.value } : f
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <textarea
                  rows={2}
                  dir="rtl"
                  placeholder={t.superAdmin.cms.featureDescAr}
                  value={feat.description}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      features: p.features.map((f, i) =>
                        i === idx ? { ...f, description: e.target.value } : f
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs"
                />
                <textarea
                  rows={2}
                  dir="ltr"
                  placeholder={t.superAdmin.cms.featureDescEn}
                  value={feat.description_en || ''}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      features: p.features.map((f, i) =>
                        i === idx ? { ...f, description_en: e.target.value } : f
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floor Operations, KDS & Captain Showcase Editor */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-zinc-950 border-b border-zinc-100 pb-3">
          {isEn
            ? 'Operations, Group Tables & KDS Section (AR / EN)'
            : 'قسم إدارة الصالات والترابيزات وشاشات KDS والكابتن (AR / EN)'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            dir="rtl"
            maxLength={120}
            placeholder={isEn ? 'Badge (AR)' : 'الوسم العلوي (عربي)'}
            value={form.operationsBadge || ''}
            onChange={(e) => setForm((p) => ({ ...p, operationsBadge: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold"
          />
          <input
            type="text"
            dir="ltr"
            maxLength={120}
            placeholder={isEn ? 'Badge (EN)' : 'الوسم العلوي (إنجليزي)'}
            value={form.operationsBadge_en || ''}
            onChange={(e) => setForm((p) => ({ ...p, operationsBadge_en: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold"
          />
          <input
            type="text"
            dir="rtl"
            maxLength={200}
            placeholder={isEn ? 'Operations Title (AR)' : 'عنوان قسم التشغيل (عربي)'}
            value={form.operationsTitle || ''}
            onChange={(e) => setForm((p) => ({ ...p, operationsTitle: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold"
          />
          <input
            type="text"
            dir="ltr"
            maxLength={200}
            placeholder={isEn ? 'Operations Title (EN)' : 'عنوان قسم التشغيل (إنجليزي)'}
            value={form.operationsTitle_en || ''}
            onChange={(e) => setForm((p) => ({ ...p, operationsTitle_en: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold"
          />
          <textarea
            rows={2}
            dir="rtl"
            maxLength={500}
            placeholder={isEn ? 'Operations Subtitle (AR)' : 'وصف قسم التشغيل (عربي)'}
            value={form.operationsSubtitle || ''}
            onChange={(e) => setForm((p) => ({ ...p, operationsSubtitle: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs"
          />
          <textarea
            rows={2}
            dir="ltr"
            maxLength={500}
            placeholder={isEn ? 'Operations Subtitle (EN)' : 'وصف قسم التشغيل (إنجليزي)'}
            value={form.operationsSubtitle_en || ''}
            onChange={(e) => setForm((p) => ({ ...p, operationsSubtitle_en: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs"
          />
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 mb-1">
              {isEn ? 'Key Points (Arabic — 1 per line)' : 'نقاط التشغيل (عربي — نقطة في كل سطر)'}
            </label>
            <textarea
              rows={4}
              dir="rtl"
              value={(form.operationsBullets || []).join('\n')}
              onChange={(e) =>
                setForm((p) => ({ ...p, operationsBullets: e.target.value.split('\n') }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs leading-relaxed"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 mb-1">
              {isEn ? 'Key Points (English — 1 per line)' : 'نقاط التشغيل (إنجليزي — نقطة في كل سطر)'}
            </label>
            <textarea
              rows={4}
              dir="ltr"
              value={(form.operationsBullets_en || []).join('\n')}
              onChange={(e) =>
                setForm((p) => ({ ...p, operationsBullets_en: e.target.value.split('\n') }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* Loyalty & 3-Day Birthday Radar Showcase Editor */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-zinc-950 border-b border-zinc-100 pb-3">
          {isEn
            ? 'Smart Customer Loyalty & Birthday Radar Section (AR / EN)'
            : 'قسم منظومة ولاء العملاء ورادار أعياد الميلاد (AR / EN)'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            dir="rtl"
            maxLength={120}
            placeholder={isEn ? 'Badge (AR)' : 'الوسم العلوي (عربي)'}
            value={form.loyaltyBadge || ''}
            onChange={(e) => setForm((p) => ({ ...p, loyaltyBadge: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold"
          />
          <input
            type="text"
            dir="ltr"
            maxLength={120}
            placeholder={isEn ? 'Badge (EN)' : 'الوسم العلوي (إنجليزي)'}
            value={form.loyaltyBadge_en || ''}
            onChange={(e) => setForm((p) => ({ ...p, loyaltyBadge_en: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold"
          />
          <input
            type="text"
            dir="rtl"
            maxLength={200}
            placeholder={isEn ? 'Loyalty Title (AR)' : 'عنوان قسم الولاء (عربي)'}
            value={form.loyaltyTitle || ''}
            onChange={(e) => setForm((p) => ({ ...p, loyaltyTitle: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold"
          />
          <input
            type="text"
            dir="ltr"
            maxLength={200}
            placeholder={isEn ? 'Loyalty Title (EN)' : 'عنوان قسم الولاء (إنجليزي)'}
            value={form.loyaltyTitle_en || ''}
            onChange={(e) => setForm((p) => ({ ...p, loyaltyTitle_en: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold"
          />
          <textarea
            rows={2}
            dir="rtl"
            maxLength={500}
            placeholder={isEn ? 'Loyalty Subtitle (AR)' : 'وصف قسم الولاء (عربي)'}
            value={form.loyaltySubtitle || ''}
            onChange={(e) => setForm((p) => ({ ...p, loyaltySubtitle: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs"
          />
          <textarea
            rows={2}
            dir="ltr"
            maxLength={500}
            placeholder={isEn ? 'Loyalty Subtitle (EN)' : 'وصف قسم الولاء (إنجليزي)'}
            value={form.loyaltySubtitle_en || ''}
            onChange={(e) => setForm((p) => ({ ...p, loyaltySubtitle_en: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs"
          />
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 mb-1">
              {isEn ? 'Loyalty Bullets (Arabic — 1 per line)' : 'نقاط الولاء والـ CRM (عربي — نقطة في كل سطر)'}
            </label>
            <textarea
              rows={4}
              dir="rtl"
              value={(form.loyaltyBullets || []).join('\n')}
              onChange={(e) =>
                setForm((p) => ({ ...p, loyaltyBullets: e.target.value.split('\n') }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs leading-relaxed"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 mb-1">
              {isEn ? 'Loyalty Bullets (English — 1 per line)' : 'نقاط الولاء والـ CRM (إنجليزي — نقطة في كل سطر)'}
            </label>
            <textarea
              rows={4}
              dir="ltr"
              value={(form.loyaltyBullets_en || []).join('\n')}
              onChange={(e) =>
                setForm((p) => ({ ...p, loyaltyBullets_en: e.target.value.split('\n') }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* Pricing Plans Builder (Dual AR / EN) */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-950">
              {t.superAdmin.cms.plansHeading} ({form.pricingPlans.length})
            </h3>
          </div>
          <button
            type="button"
            disabled={form.pricingPlans.length >= 6}
            onClick={() =>
              setForm((p) => ({
                ...p,
                pricingPlans: [
                  ...p.pricingPlans,
                  {
                    id: `plan_${Date.now()}`,
                    name: 'باقة جديدة',
                    name_en: 'New Plan',
                    price: '499',
                    period: 'ج.م / شهرياً',
                    period_en: 'EGP / month',
                    description: '',
                    description_en: '',
                    features: ['منيو QR متكامل'],
                    features_en: ['Complete QR Menu'],
                    highlighted: false,
                    isVisible: true,
                  },
                ],
              }))
            }
            className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-800 hover:bg-zinc-50 flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-2">
          <input
            type="text"
            dir="rtl"
            maxLength={160}
            placeholder={isEn ? 'Pricing Heading (AR)' : 'عنوان قسم الأسعار (عربي)'}
            value={form.pricingTitle || ''}
            onChange={(e) => setForm((p) => ({ ...p, pricingTitle: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold"
          />
          <input
            type="text"
            dir="ltr"
            maxLength={160}
            placeholder={isEn ? 'Pricing Heading (EN)' : 'عنوان قسم الأسعار (إنجليزي)'}
            value={form.pricingTitle_en || ''}
            onChange={(e) => setForm((p) => ({ ...p, pricingTitle_en: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold"
          />
          <input
            type="text"
            dir="rtl"
            maxLength={80}
            placeholder={isEn ? 'Plan Button Label (AR)' : 'نص زر الباقة (عربي)'}
            value={form.pricingCtaText || ''}
            onChange={(e) => setForm((p) => ({ ...p, pricingCtaText: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold"
          />
          <input
            type="text"
            dir="rtl"
            maxLength={400}
            placeholder={isEn ? 'Pricing Subtitle (AR)' : 'وصف قسم الأسعار (عربي)'}
            value={form.pricingSubtitle || ''}
            onChange={(e) => setForm((p) => ({ ...p, pricingSubtitle: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs"
          />
          <input
            type="text"
            dir="ltr"
            maxLength={400}
            placeholder={isEn ? 'Pricing Subtitle (EN)' : 'وصف قسم الأسعار (إنجليزي)'}
            value={form.pricingSubtitle_en || ''}
            onChange={(e) => setForm((p) => ({ ...p, pricingSubtitle_en: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs"
          />
          <input
            type="text"
            dir="ltr"
            maxLength={80}
            placeholder={isEn ? 'Plan Button Label (EN)' : 'نص زر الباقة (إنجليزي)'}
            value={form.pricingCtaText_en || ''}
            onChange={(e) => setForm((p) => ({ ...p, pricingCtaText_en: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {form.pricingPlans.map((plan, idx) => (
            <div
              key={plan.id || `plan_${idx}`}
              className={`p-4 rounded-2xl border space-y-3 ${
                plan.highlighted
                  ? 'border-zinc-950 bg-zinc-50'
                  : 'border-zinc-200 bg-white'
              } ${plan.isVisible === false ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plan.highlighted}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        pricingPlans: p.pricingPlans.map((pl, i) =>
                          i === idx ? { ...pl, highlighted: e.target.checked } : pl
                        ),
                      }))
                    }
                    className="w-4 h-4 accent-zinc-950"
                  />
                  <span>{t.superAdmin.cms.planHighlighted}</span>
                </label>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        pricingPlans: p.pricingPlans.map((pl, i) =>
                          i === idx ? { ...pl, isVisible: pl.isVisible === false } : pl
                        ),
                      }))
                    }
                    className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                      plan.isVisible !== false
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-zinc-300 bg-white text-zinc-600'
                    }`}
                  >
                    {plan.isVisible !== false ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{plan.isVisible !== false ? (isEn ? 'Shown' : 'ظاهر') : isEn ? 'Hidden' : 'مخفي'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        pricingPlans: p.pricingPlans.filter((_, i) => i !== idx),
                      }))
                    }
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  dir="rtl"
                  required
                  placeholder={t.superAdmin.cms.planNameAr}
                  value={plan.name}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      pricingPlans: p.pricingPlans.map((pl, i) =>
                        i === idx ? { ...pl, name: e.target.value } : pl
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs font-bold"
                />
                <input
                  type="text"
                  dir="ltr"
                  placeholder={t.superAdmin.cms.planNameEn}
                  value={plan.name_en || ''}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      pricingPlans: p.pricingPlans.map((pl, i) =>
                        i === idx ? { ...pl, name_en: e.target.value } : pl
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  dir="ltr"
                  placeholder={t.superAdmin.cms.planPrice}
                  value={plan.price}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      pricingPlans: p.pricingPlans.map((pl, i) =>
                        i === idx ? { ...pl, price: e.target.value } : pl
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs font-mono-num font-bold"
                />
                <input
                  type="text"
                  dir="rtl"
                  placeholder={t.superAdmin.cms.planPeriodAr}
                  value={plan.period}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      pricingPlans: p.pricingPlans.map((pl, i) =>
                        i === idx ? { ...pl, period: e.target.value } : pl
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs"
                />
                <input
                  type="text"
                  dir="ltr"
                  placeholder={t.superAdmin.cms.planPeriodEn}
                  value={plan.period_en || ''}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      pricingPlans: p.pricingPlans.map((pl, i) =>
                        i === idx ? { ...pl, period_en: e.target.value } : pl
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  dir="rtl"
                  placeholder={t.superAdmin.cms.planDescAr}
                  value={plan.description}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      pricingPlans: p.pricingPlans.map((pl, i) =>
                        i === idx ? { ...pl, description: e.target.value } : pl
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs"
                />
                <input
                  type="text"
                  dir="ltr"
                  placeholder={t.superAdmin.cms.planDescEn}
                  value={plan.description_en || ''}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      pricingPlans: p.pricingPlans.map((pl, i) =>
                        i === idx ? { ...pl, description_en: e.target.value } : pl
                      ),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                    {t.superAdmin.cms.planFeaturesAr}
                  </label>
                  <textarea
                    rows={4}
                    dir="rtl"
                    value={plan.features.join('\n')}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        pricingPlans: p.pricingPlans.map((pl, i) =>
                          i === idx
                            ? { ...pl, features: e.target.value.split('\n') }
                            : pl
                        ),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs leading-relaxed"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                    {t.superAdmin.cms.planFeaturesEn}
                  </label>
                  <textarea
                    rows={4}
                    dir="ltr"
                    value={(plan.features_en || []).join('\n')}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        pricingPlans: p.pricingPlans.map((pl, i) =>
                          i === idx
                            ? { ...pl, features_en: e.target.value.split('\n') }
                            : pl
                        ),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs leading-relaxed"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tygos Cloud ERP Promo Section Editor */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-zinc-950 border-b border-zinc-100 pb-3">
          {isEn
            ? 'Tygos Cloud ERP Upgrade Section (AR / EN)'
            : 'قسم الترقية لمنظومة تايجوس Tygos Cloud ERP (AR / EN)'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            dir="rtl"
            maxLength={120}
            placeholder={isEn ? 'Tygos Badge (AR)' : 'الوسم (عربي)'}
            value={form.tygosBadge || ''}
            onChange={(e) => setForm((p) => ({ ...p, tygosBadge: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold"
          />
          <input
            type="text"
            dir="ltr"
            maxLength={120}
            placeholder={isEn ? 'Tygos Badge (EN)' : 'الوسم (إنجليزي)'}
            value={form.tygosBadge_en || ''}
            onChange={(e) => setForm((p) => ({ ...p, tygosBadge_en: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold"
          />
          <input
            type="text"
            dir="rtl"
            maxLength={200}
            placeholder={isEn ? 'Tygos Heading (AR)' : 'عنوان قسم تايجوس (عربي)'}
            value={form.tygosTitle || ''}
            onChange={(e) => setForm((p) => ({ ...p, tygosTitle: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold"
          />
          <input
            type="text"
            dir="ltr"
            maxLength={200}
            placeholder={isEn ? 'Tygos Heading (EN)' : 'عنوان قسم تايجوس (إنجليزي)'}
            value={form.tygosTitle_en || ''}
            onChange={(e) => setForm((p) => ({ ...p, tygosTitle_en: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold"
          />
          <textarea
            rows={2}
            dir="rtl"
            maxLength={500}
            placeholder={isEn ? 'Tygos Description (AR)' : 'وصف قسم تايجوس (عربي)'}
            value={form.tygosSubtitle || ''}
            onChange={(e) => setForm((p) => ({ ...p, tygosSubtitle: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs"
          />
          <textarea
            rows={2}
            dir="ltr"
            maxLength={500}
            placeholder={isEn ? 'Tygos Description (EN)' : 'وصف قسم تايجوس (إنجليزي)'}
            value={form.tygosSubtitle_en || ''}
            onChange={(e) => setForm((p) => ({ ...p, tygosSubtitle_en: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs"
          />
          <input
            type="text"
            dir="rtl"
            maxLength={80}
            placeholder={isEn ? 'Tygos CTA Button (AR)' : 'نص زر تايجوس (عربي)'}
            value={form.tygosCtaText || ''}
            onChange={(e) => setForm((p) => ({ ...p, tygosCtaText: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold"
          />
          <input
            type="text"
            dir="ltr"
            maxLength={80}
            placeholder={isEn ? 'Tygos CTA Button (EN)' : 'نص زر تايجوس (إنجليزي)'}
            value={form.tygosCtaText_en || ''}
            onChange={(e) => setForm((p) => ({ ...p, tygosCtaText_en: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold"
          />
        </div>
      </div>
    </form>
  );
}
