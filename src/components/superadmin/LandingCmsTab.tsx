import { FormEvent, useEffect, useState } from 'react';
import { Check, Image as ImageIcon, Loader2, Plus, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { DEFAULT_PLATFORM_LANDING } from '../../data/defaultLandingSettings';
import {
  fetchPlatformLandingSettings,
  savePlatformLandingSettings,
} from '../../lib/firestoreService';
import { uploadRestaurantAsset } from '../../lib/imageUtils';
import {
  resolvePlatformShareDescription,
  resolvePlatformShareTitle,
} from '../../lib/seoHead';
import { PlatformLandingSettings } from '../../types/menu';
import { SafeImage } from '../SafeImage';
import { SharePreviewCard } from '../SharePreviewCard';

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

      {/* Hero Section & Support Settings (Dual AR / EN) */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-zinc-950 border-b border-zinc-100 pb-3">
          {isEn
            ? 'Hero & Global Settings (AR / EN)'
            : 'إعدادات الهيرو والمنصة (عربي / إنجليزي)'}
        </h3>

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
          title={resolvePlatformShareTitle(form, lang)}
          description={resolvePlatformShareDescription(form, lang)}
          imageUrl={form.platformLogoUrl || DEFAULT_PLATFORM_LANDING.platformLogoUrl}
          shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/` : '/'}
          isEn={isEn}
        />
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
                  { title: '', title_en: '', description: '', description_en: '' },
                ],
              }))
            }
            className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-800 hover:bg-zinc-50 flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.superAdmin.cms.addFeatureBtn}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {form.features.map((feat, idx) => (
            <div
              key={`feat_${idx}`}
              className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-zinc-500 font-mono-num">
                  #{idx + 1}
                </span>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {form.pricingPlans.map((plan, idx) => (
            <div
              key={plan.id || `plan_${idx}`}
              className={`p-4 rounded-2xl border space-y-3 ${
                plan.highlighted
                  ? 'border-zinc-950 bg-zinc-50'
                  : 'border-zinc-200 bg-white'
              }`}
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
    </form>
  );
}
