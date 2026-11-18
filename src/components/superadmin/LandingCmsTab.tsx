import { FormEvent, useEffect, useState } from 'react';
import { Check, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { DEFAULT_PLATFORM_LANDING } from '../../data/defaultLandingSettings';
import {
  fetchPlatformLandingSettings,
  savePlatformLandingSettings,
} from '../../lib/firestoreService';
import { PlatformLandingSettings } from '../../types/menu';

export function LandingCmsTab() {
  const [form, setForm] = useState<PlatformLandingSettings>(DEFAULT_PLATFORM_LANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        if (active) setError(err instanceof Error ? err.message : 'تعذر تحميل إعدادات صفحة الهبوط');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
      setError(err instanceof Error ? err.message : 'تعذر حفظ تعديلات صفحة الهبوط');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setForm(DEFAULT_PLATFORM_LANDING);
    setSavedNotice(false);
  };

  if (loading) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center space-y-2">
        <Loader2 className="w-7 h-7 animate-spin text-zinc-700 mx-auto" />
        <p className="text-xs font-semibold text-zinc-500">جاري تحميل محتوى صفحة الهبوط...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-zinc-950">التحكم في محتوى صفحة الهبوط</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            تعديل نصوص الهيرو والمميزات وباقات الأسعار ورقم الدعم في الصفحة الرئيسية مباشرة عبر Firestore
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الافتراضي</span>
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
              {saving ? 'جاري النشر...' : savedNotice ? 'تم الحفظ والنشر' : 'حفظ ونشر التعديلات'}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
          {error}
        </div>
      )}

      {/* Hero Section & Support Settings */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-zinc-950 border-b border-zinc-100 pb-3">
          القسم الترحيبي (Hero) وبيانات التواصل
        </h3>

        <div>
          <label className="block text-xs font-bold text-zinc-800 mb-1.5">
            العنوان الرئيسي (Hero Title)
          </label>
          <input
            type="text"
            required
            maxLength={200}
            value={form.heroTitle}
            onChange={(e) => setForm((p) => ({ ...p, heroTitle: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-800 mb-1.5">
            النص التوضيحي (Hero Subtitle)
          </label>
          <textarea
            rows={3}
            required
            maxLength={600}
            value={form.heroSubtitle}
            onChange={(e) => setForm((p) => ({ ...p, heroSubtitle: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              نص زر الدعوة الرئيسي (CTA)
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={form.ctaButtonText}
              onChange={(e) => setForm((p) => ({ ...p, ctaButtonText: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              رقم واتساب الدعم والمبيعات
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
              نص التذييل (Footer Text)
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={form.footerText}
              onChange={(e) => setForm((p) => ({ ...p, footerText: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Features List Builder */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-950">
              مميزات المنصة ({form.features.length})
            </h3>
            <p className="text-[11px] text-zinc-500">تظهر في بطاقات النظام الإداري بالصفحة الرئيسية</p>
          </div>
          <button
            type="button"
            disabled={form.features.length >= 12}
            onClick={() =>
              setForm((p) => ({
                ...p,
                features: [...p.features, { title: '', description: '' }],
              }))
            }
            className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-800 hover:bg-zinc-50 flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة ميزة</span>
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
                  ميزة #{idx + 1}
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
              <input
                type="text"
                required
                placeholder="عنوان الميزة"
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
              <textarea
                rows={2}
                placeholder="وصف مختصر للميزة"
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
            </div>
          ))}
        </div>
      </div>

      {/* Pricing Plans Builder */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-950">
              باقات الأسعار والاشتراكات ({form.pricingPlans.length})
            </h3>
            <p className="text-[11px] text-zinc-500">
              تعديل الباقات والأسعار والمزايا المعروضة في صفحة الهبوط
            </p>
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
                    price: '499',
                    period: 'ج.م / شهرياً',
                    description: '',
                    features: ['منيو QR متكامل'],
                    highlighted: false,
                  },
                ],
              }))
            }
            className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-800 hover:bg-zinc-50 flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة باقة</span>
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
                  <span>باقة مميزة (الأكثر طلباً)</span>
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

              <input
                type="text"
                required
                placeholder="اسم الباقة"
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

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="السعر"
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
                  placeholder="المدة / العملة"
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
              </div>

              <input
                type="text"
                placeholder="وصف الباقة"
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

              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                  مزايا الباقة (كل ميزة في سطر)
                </label>
                <textarea
                  rows={4}
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
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}
