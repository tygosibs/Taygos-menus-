import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  Gift,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  deletePlatformPromoCode,
  fetchPlatformPromoCodes,
  formatPlatformPromoSummary,
  sanitizePlatformPromoCode,
  savePlatformPromoCode,
  togglePlatformPromoCodeStatus,
} from '../../lib/firestoreService';
import { PlatformPromoCode, PlatformPromoDiscountType } from '../../types/menu';

export function PlatformPromosTab() {
  const { lang, dir, loc } = useLanguage();
  const isEn = lang === 'en';

  const [promos, setPromos] = useState<PlatformPromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<PlatformPromoDiscountType>('percent');
  const [discountValue, setDiscountValue] = useState<number>(50);
  const [description, setDescription] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [isActive, setIsActive] = useState(true);

  const loadPromos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPlatformPromoCodes();
      setPromos(list);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Failed to load platform promo codes'
            : 'تعذر تحميل أكواد المنصة'
      );
    } finally {
      setLoading(false);
    }
  }, [isEn]);

  useEffect(() => {
    loadPromos();
  }, [loadPromos]);

  const resetForm = () => {
    setEditingCode(null);
    setCode('');
    setDiscountType('percent');
    setDiscountValue(50);
    setDescription('');
    setDescriptionEn('');
    setIsActive(true);
  };

  const applyPreset = (preset: {
    code: string;
    discountType: PlatformPromoDiscountType;
    discountValue: number;
    description: string;
    description_en: string;
  }) => {
    setEditingCode(null);
    setCode(preset.code);
    setDiscountType(preset.discountType);
    setDiscountValue(preset.discountValue);
    setDescription(preset.description);
    setDescriptionEn(preset.description_en);
    setIsActive(true);
    setError(null);
    setSuccessMsg(null);
  };

  const handleEdit = (promo: PlatformPromoCode) => {
    setEditingCode(promo.code);
    setCode(promo.code);
    setDiscountType(promo.discountType);
    setDiscountValue(promo.discountValue);
    setDescription(promo.description || '');
    setDescriptionEn(promo.description_en || '');
    setIsActive(promo.isActive);
    setError(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSaving(true);
    try {
      const saved = await savePlatformPromoCode({
        isEditing: Boolean(editingCode),
        code: editingCode || code,
        discountType,
        discountValue,
        description,
        description_en: descriptionEn,
        isActive,
      });
      setPromos((prev) => {
        const exists = prev.some((p) => p.id === saved.id);
        return exists
          ? prev.map((p) => (p.id === saved.id ? saved : p))
          : [saved, ...prev];
      });
      setSuccessMsg(
        isEn
          ? `Platform promo code ${saved.code} saved successfully.`
          : `تم حفظ كود المنصة (${saved.code}) بنجاح وهو متاح الآن لأصحاب المطاعم.`
      );
      resetForm();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Failed to save promo code'
            : 'تعذر حفظ كود الخصم'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (promo: PlatformPromoCode) => {
    setBusyId(promo.id);
    setError(null);
    try {
      await togglePlatformPromoCodeStatus(promo.id, !promo.isActive);
      setPromos((prev) =>
        prev.map((p) => (p.id === promo.id ? { ...p, isActive: !promo.isActive } : p))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle status');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (promo: PlatformPromoCode) => {
    setBusyId(promo.id);
    setError(null);
    try {
      await deletePlatformPromoCode(promo.id);
      setPromos((prev) => prev.filter((p) => p.id !== promo.id));
      if (editingCode === promo.code) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete code');
    } finally {
      setBusyId(null);
    }
  };

  const handleCopy = async (promoCode: string) => {
    try {
      await navigator.clipboard.writeText(promoCode);
      setCopiedId(promoCode);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard unsupported
    }
  };

  return (
    <div dir={dir} className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-zinc-950">
              {isEn
                ? 'Platform SaaS Promo Codes & Owner Gifts'
                : 'إدارة أكواد الخصم والهدايا لأصحاب المطاعم (SaaS Promos)'}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isEn
                ? 'Create subscription promo codes to share with restaurant owners on birthdays or special campaigns.'
                : 'أنشئ أكواد خصم أو شهور مجانية يفعّلها أصحاب المطاعم من لوحة تحكمهم وأرسلها لهم مباشرة في أعياد ميلادهم.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadPromos}
          disabled={loading}
          className="px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{isEn ? 'Refresh' : 'تحديث'}</span>
        </button>
      </div>

      {/* Create / Edit Promo Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3.5">
          <h3 className="text-sm font-extrabold text-zinc-950 flex items-center gap-2">
            {editingCode ? <Edit3 className="w-4 h-4 text-amber-600" /> : <Plus className="w-4 h-4 text-amber-600" />}
            <span>
              {editingCode
                ? isEn
                  ? `Editing Code: ${editingCode}`
                  : `تعديل كود: ${editingCode}`
                : isEn
                  ? 'Create New Platform Promo Code'
                  : 'إضافة كود خصم أو هدية جديد للمنصة'}
            </span>
          </h3>

          {!editingCode && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  applyPreset({
                    code: 'BDAY50',
                    discountType: 'percent',
                    discountValue: 50,
                    description: 'خصم 50% هدية عيد ميلاد صاحب المطعم 🎂',
                    description_en: '50% Birthday Gift Discount on Sufra Subscription 🎂',
                  })
                }
                className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-extrabold hover:bg-amber-100 flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>{isEn ? 'Preset: BDAY50 (50%)' : 'قالب سريع: BDAY50 (خصم 50% عيد ميلاد)'}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPreset({
                    code: 'FREEMONTH',
                    discountType: 'free_month',
                    discountValue: 1,
                    description: 'شهر اشتراك مجاني هدية من منصة سُفرة 🎁',
                    description_en: '1 Free Subscription Month Gift from Sufra 🎁',
                  })
                }
                className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-extrabold hover:bg-emerald-100 flex items-center gap-1.5 cursor-pointer"
              >
                <Gift className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isEn ? 'Preset: FREEMONTH' : 'قالب سريع: FREEMONTH (شهر مجاني)'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5">
              {isEn ? 'Promo Code *' : 'كود الخصم (حروف وأرقام إنجليزية) *'}
            </label>
            <input
              type="text"
              dir="ltr"
              required
              disabled={Boolean(editingCode)}
              maxLength={32}
              value={code}
              onChange={(e) => setCode(sanitizePlatformPromoCode(e.target.value))}
              placeholder="BDAY50"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num font-bold uppercase disabled:bg-zinc-100 focus:outline-none focus:border-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5">
              {isEn ? 'Reward Type' : 'نوع الخصم / الهدية'}
            </label>
            <select
              value={discountType}
              onChange={(e) => {
                const nextType = e.target.value as PlatformPromoDiscountType;
                setDiscountType(nextType);
                if (nextType === 'free_month' && discountValue > 24) {
                  setDiscountValue(1);
                } else if (nextType === 'percent' && discountValue > 100) {
                  setDiscountValue(50);
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white focus:outline-none focus:border-zinc-900"
            >
              <option value="percent">{isEn ? 'Percentage Discount (%)' : 'نسبة مئوية (%)'}</option>
              <option value="fixed">{isEn ? 'Fixed Amount (EGP)' : 'مبلغ ثابت (ج.م)'}</option>
              <option value="free_month">{isEn ? 'Free Subscription Months' : 'شهور اشتراك مجانية'}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5">
              {discountType === 'percent'
                ? isEn
                  ? 'Discount % (1 - 100)'
                  : 'نسبة الخصم %'
                : discountType === 'fixed'
                  ? isEn
                    ? 'Amount (EGP)'
                    : 'قيمة الخصم (ج.م)'
                  : isEn
                    ? 'Number of Free Months'
                    : 'عدد الشهور المجانية'}
            </label>
            <input
              type="number"
              min={discountType === 'free_month' ? 1 : 0}
              max={discountType === 'percent' ? 100 : discountType === 'free_month' ? 24 : 100000}
              required
              value={discountValue}
              onChange={(e) => setDiscountValue(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num font-bold focus:outline-none focus:border-zinc-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5">
              {isEn ? 'Description (Arabic)' : 'وصف الهدية / العرض (عربي)'}
            </label>
            <input
              type="text"
              dir="rtl"
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: خصم 50% هدية عيد ميلادك على باقة الاشتراك"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5">
              {isEn ? 'Description (English)' : 'وصف الهدية / العرض (إنجليزي)'}
            </label>
            <input
              type="text"
              dir="ltr"
              maxLength={200}
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
              placeholder="e.g. 50% Birthday Gift Discount on Subscription"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm text-left focus:outline-none focus:border-zinc-900"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-xl">
            {error}
          </p>
        )}
        {successMsg && (
          <p className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
            {successMsg}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100">
          <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
            <span>{isEn ? 'Active & ready to redeem' : 'الكود مُفعّل ومتاح للاستخدام'}</span>
          </label>

          <div className="flex items-center gap-2">
            {editingCode && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                {isEn ? 'Cancel Edit' : 'إلغاء التعديل'}
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>
                {editingCode
                  ? isEn
                    ? 'Save Changes'
                    : 'حفظ التعديلات'
                  : isEn
                    ? 'Create Promo Code'
                    : 'حفظ وإنشاء الكود'}
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* Promos List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-zinc-950">
            {isEn ? `All Platform Promo Codes (${promos.length})` : `أكواد الخصم المسجلة (${promos.length})`}
          </h3>
        </div>

        {loading ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-500">{isEn ? 'Loading codes...' : 'جاري تحميل الأكواد...'}</p>
          </div>
        ) : promos.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center space-y-2">
            <Tag className="w-8 h-8 text-zinc-300 mx-auto" />
            <p className="text-sm font-bold text-zinc-800">
              {isEn ? 'No platform promo codes yet' : 'لم تقم بإضافة أي أكواد خصم للمنصة بعد'}
            </p>
            <p className="text-xs text-zinc-500">
              {isEn
                ? 'Use the BDAY50 preset above to create your first birthday gift code in 1 click.'
                : 'اضغط على القالب السريع BDAY50 بالأعلى لإنشاء أول كود هدية عيد ميلاد بضغطة واحدة.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promos.map((promo) => {
              const { summary, summary_en } = formatPlatformPromoSummary(promo);
              const isBusy = busyId === promo.id;
              return (
                <article
                  key={promo.id}
                  className={`bg-white border rounded-2xl p-5 flex flex-col justify-between gap-4 ${
                    promo.isActive ? 'border-zinc-200' : 'border-zinc-200 opacity-75 bg-zinc-50/70'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="px-3 py-1 rounded-xl bg-zinc-950 text-amber-400 font-mono-num text-sm font-extrabold tracking-wider"
                          dir="ltr"
                        >
                          {promo.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(promo.code)}
                          className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                          title={isEn ? 'Copy code' : 'نسخ الكود'}
                        >
                          {copiedId === promo.code ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                          promo.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                        }`}
                      >
                        {promo.isActive
                          ? isEn
                            ? 'Active'
                            : 'نشط'
                          : isEn
                            ? 'Paused'
                            : 'متوقف'}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-zinc-800 leading-relaxed">
                      {loc(summary, summary_en)}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(promo)}
                        className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Edit' : 'تعديل'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggle(promo)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                          promo.isActive
                            ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        }`}
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : promo.isActive ? (
                          <PauseCircle className="w-3.5 h-3.5" />
                        ) : (
                          <PlayCircle className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {promo.isActive
                            ? isEn
                              ? 'Pause'
                              : 'إيقاف'
                            : isEn
                              ? 'Activate'
                              : 'تفعيل'}
                        </span>
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDelete(promo)}
                      aria-label={isEn ? 'Delete code' : 'حذف الكود'}
                      className="p-2 rounded-xl border border-zinc-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
