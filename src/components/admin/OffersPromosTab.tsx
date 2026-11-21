import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Award,
  Cake,
  Check,
  Copy,
  Gift,
  GripVertical,
  Loader2,
  Percent,
  Plus,
  Save,
  Sparkles,
  Tag,
  Trash2,
  Users,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getContrastOnAccent, isValidHexColor } from '../../lib/contrastUtils';
import {
  formatLastVisitDate,
  getResolvedLoyaltyConfig,
  isInBirthdayWindow,
} from '../../lib/customerLoyaltyUtils';
import {
  subscribeRestaurantCustomers,
  updateRestaurantOffersAndPromos,
} from '../../lib/firestoreService';
import {
  CustomerProfile,
  LoyaltyConfig,
  MenuOffer,
  OfferAnimation,
  OfferPlacement,
  PromoCode,
  PromoType,
  Restaurant,
} from '../../types/menu';

interface OffersPromosTabProps {
  restaurant: Restaurant;
  onRestaurantUpdated: (updated: Restaurant) => void;
  onOpenCustomersTab?: () => void;
}

function makeLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function OffersPromosTab({
  restaurant,
  onRestaurantUpdated,
  onOpenCustomersTab,
}: OffersPromosTabProps) {
  const { lang, dir, t, loc, formatCurrency } = useLanguage();
  const isEn = lang === 'en';
  const currencyLabel = formatCurrency(restaurant.currency);

  const [offers, setOffers] = useState<MenuOffer[]>(restaurant.offers || []);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(restaurant.promoCodes || []);
  const [loyaltyConfig, setLoyaltyConfig] = useState<Required<LoyaltyConfig>>(() =>
    getResolvedLoyaltyConfig(restaurant)
  );
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [draggingOfferId, setDraggingOfferId] = useState<string | null>(null);
  const offersRef = useRef<MenuOffer[]>(offers);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setOffers(restaurant.offers || []);
    setPromoCodes(restaurant.promoCodes || []);
    setLoyaltyConfig(getResolvedLoyaltyConfig(restaurant));
  }, [restaurant]);

  useEffect(() => {
    if (!restaurant.id || !restaurant.ownerId) return;
    setCustomersLoading(true);
    const unsub = subscribeRestaurantCustomers(
      restaurant.id,
      restaurant.ownerId,
      (list) => {
        setCustomers(list);
        setCustomersLoading(false);
      },
      () => {
        setCustomersLoading(false);
      }
    );
    return () => unsub();
  }, [restaurant.id, restaurant.ownerId]);

  useEffect(() => {
    offersRef.current = offers;
  }, [offers]);

  useEffect(() => {
    return () => dragCleanupRef.current?.();
  }, []);

  const placementOptions: { id: OfferPlacement; label: string }[] = useMemo(
    () => [
      { id: 'top', label: isEn ? 'Top of Menu' : 'أعلى المنيو مباشرة' },
      { id: 'above_grid', label: isEn ? 'Above Dish Grid' : 'فوق شبكة الأطباق' },
      { id: 'below_grid', label: isEn ? 'Below Dish Grid' : 'أسفل شبكة الأطباق' },
      { id: 'floating', label: isEn ? 'Floating Corner Card' : 'بطاقة عائمة بالزاوية' },
    ],
    [isEn]
  );

  const animationOptions: { id: OfferAnimation; label: string }[] = useMemo(
    () => [
      { id: 'static', label: isEn ? 'Static Clean' : 'ثابت أنيق' },
      { id: 'marquee', label: isEn ? 'Gentle Glide' : 'انزلاق لطيف' },
      { id: 'orbit', label: isEn ? 'Floating Pulse' : 'نبض عائم' },
      { id: 'bounce', label: isEn ? 'Soft Bounce' : 'ارتداد ناعم' },
      { id: 'fade', label: isEn ? 'Breathing Glow' : 'توهج هادئ' },
    ],
    [isEn]
  );

  const promoTypeOptions: { id: PromoType; label: string }[] = useMemo(
    () => [
      { id: 'percent', label: t.admin.offers.typePercent },
      { id: 'fixed', label: t.admin.offers.typeFixed },
      { id: 'free_delivery', label: t.admin.offers.typeFreeDelivery },
      { id: 'waive_service', label: t.admin.offers.typeWaiveService },
    ],
    [t.admin.offers]
  );

  const handleAddOffer = () => {
    const next: MenuOffer = {
      id: makeLocalId('offer'),
      title: isEn ? 'Special Today Offer' : 'عرض خاص اليوم: 1+1 مجاناً',
      title_en: 'Today Special: Buy 1 Get 1 Free',
      subtitle: isEn ? 'Tap the promo code to apply at checkout' : 'اطلب الآن واستفد من العرض قبل انتهاء اليوم',
      subtitle_en: 'Order now and claim the deal at checkout',
      badgeText: '1+1 مجاناً',
      badgeText_en: '1+1 FREE',
      isBogo: true,
      promoCode: promoCodes.find((p) => p.isActive)?.code || '',
      placement: 'above_grid',
      animation: 'fade',
      bgColor: restaurant.primaryColor || '#A61C1C',
      textColor: getContrastOnAccent(restaurant.primaryColor || '#A61C1C'),
      isActive: true,
      sortOrder: offers.length + 1,
    };
    setOffers((prev) => [...prev, next]);
  };

  const handleUpdateOffer = (id: string, patch: Partial<MenuOffer>) => {
    setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const handleDeleteOffer = (id: string) => {
    setOffers((prev) => prev.filter((o) => o.id !== id).map((o, idx) => ({ ...o, sortOrder: idx + 1 })));
  };

  const moveOffer = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= offers.length) return;
    const next = [...offers];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    setOffers(next.map((o, i) => ({ ...o, sortOrder: i + 1 })));
  };

  const startOfferDrag = (e: ReactPointerEvent<HTMLButtonElement>, offerId: string) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    dragCleanupRef.current?.();

    const scrollParent = (e.currentTarget as HTMLElement).closest('.overflow-y-auto') as HTMLElement | null;
    setDraggingOfferId(offerId);

    const scrollIfNearEdge = (clientY: number) => {
      if (scrollParent) {
        const rect = scrollParent.getBoundingClientRect();
        if (clientY < rect.top + 64) scrollParent.scrollTop -= 14;
        else if (clientY > rect.bottom - 64) scrollParent.scrollTop += 14;
      } else {
        if (clientY < 72) window.scrollBy({ top: -14, behavior: 'auto' });
        else if (clientY > window.innerHeight - 72) window.scrollBy({ top: 14, behavior: 'auto' });
      }
    };

    const handlePointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      scrollIfNearEdge(ev.clientY);
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const card = el?.closest('[data-offer-card-id]') as HTMLElement | null;
      const targetId = card?.getAttribute('data-offer-card-id');
      if (!targetId || targetId === offerId) return;

      const list = [...offersRef.current];
      const fromIdx = list.findIndex((o) => o.id === offerId);
      const toIdx = list.findIndex((o) => o.id === targetId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      const normalized = list.map((o, i) => ({ ...o, sortOrder: i + 1 }));
      offersRef.current = normalized;
      setOffers(normalized);
    };

    const finishDrag = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
      dragCleanupRef.current = null;
      setDraggingOfferId(null);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  };

  const handleAddPromo = () => {
    const suffix = Math.floor(10 + Math.random() * 89);
    const next: PromoCode = {
      id: makeLocalId('promo'),
      code: `SAVE${suffix}`,
      type: 'percent',
      value: 15,
      minOrder: 0,
      description: 'خصم خاص 15% على الطلب',
      description_en: '15% off your order',
      isActive: true,
    };
    setPromoCodes((prev) => [...prev, next]);
  };

  const handleUpdatePromo = (id: string, patch: Partial<PromoCode>) => {
    setPromoCodes((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const handleDeletePromo = (id: string) => {
    setPromoCodes((prev) => prev.filter((p) => p.id !== id));
  };

  const handleCopyCode = async (code: string) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const formatSaveError = (err: unknown): string => {
    if (!(err instanceof Error)) {
      return t.auth.errGeneric;
    }
    const raw = err.message || '';
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed?.error) {
        const lower = parsed.error.toLowerCase();
        if (lower.includes('permission') || lower.includes('insufficient')) {
          return isEn
            ? 'Save rejected by Firestore permissions or App Check. Ensure firestore.rules are deployed and App Check / domain settings are valid for this domain.'
            : 'تم رفض الحفظ بسبب صلاحيات Firestore أو التحقق الأمني (App Check). تأكد من نشر قواعد الأمان (firestore.rules) وإعدادات App Check لهذا النطاق.';
        }
        return parsed.error;
      }
    } catch {
      // plain error message
    }
    if (raw.includes('permission-denied') || raw.includes('Missing or insufficient permissions')) {
      return isEn
        ? 'Save rejected by Firestore permissions or App Check. Ensure firestore.rules are deployed and App Check / domain settings are valid for this domain.'
        : 'تم رفض الحفظ بسبب صلاحيات Firestore أو التحقق الأمني (App Check). تأكد من نشر قواعد الأمان (firestore.rules) وإعدادات App Check لهذا النطاق.';
    }
    return raw || t.auth.errGeneric;
  };

  const handleSaveAll = async () => {
    setError(null);
    setSavedToast(false);

    const seenCodes = new Set<string>();
    for (const p of promoCodes) {
      const cleanCode = (p.code || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '')
        .slice(0, 24);
      if (cleanCode.length < 2) {
        setError(
          isEn
            ? 'Each promo code must contain at least 2 letters or numbers before saving.'
            : 'يجب أن يحتوي كل كود خصم على حرفين أو رقمين على الأقل قبل الحفظ.'
        );
        return;
      }
      if (seenCodes.has(cleanCode)) {
        setError(
          isEn
            ? `Duplicate promo code "${cleanCode}". Please use unique promo codes.`
            : `يوجد تكرار في كود الخصم "${cleanCode}". يرجى استخدام أكواد مختلفة.`
        );
        return;
      }
      seenCodes.add(cleanCode);
    }

    setSaving(true);
    try {
      const saved = await updateRestaurantOffersAndPromos(
        restaurant.id,
        offers,
        promoCodes,
        loyaltyConfig
      );
      setOffers(saved.offers);
      setPromoCodes(saved.promoCodes);
      if (saved.loyaltyConfig) {
        setLoyaltyConfig({
          ...loyaltyConfig,
          ...saved.loyaltyConfig,
        });
      }
      onRestaurantUpdated({
        ...restaurant,
        offers: saved.offers,
        promoCodes: saved.promoCodes,
        loyaltyConfig: saved.loyaltyConfig ?? loyaltyConfig,
      });
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3000);
    } catch (err) {
      console.error('Offers/Promos save failed:', err);
      setError(formatSaveError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir={dir} className="space-y-6">
      {/* Header & Save Bar */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-extrabold text-zinc-950">{t.admin.offers.title}</h2>
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{t.admin.offers.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {savedToast && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>{t.admin.offers.savedToast}</span>
            </span>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveAll}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? t.admin.themes.savingBtn : t.admin.offers.saveOffersBtn}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
          {error}
        </div>
      )}

      {/* Section 1: Promotional Banners & BOGO 1+1 */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-zinc-950 flex items-center gap-2">
              <Gift className="w-4 h-4 text-[#A61C1C]" />
              <span>{t.admin.offers.bannersHeading}</span>
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {isEn
                ? 'Drag via grip handle or use arrows to reorder banners. Works across all themes.'
                : 'اسحب البانر من المقبض لإعادة ترتيبه أو غيّر مكانه وحركته ليظهر في جميع الثيمات.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddOffer}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#A61C1C] text-white text-xs font-bold hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.admin.offers.addBannerBtn}</span>
          </button>
        </div>

        {offers.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 text-center space-y-2">
            <Sparkles className="w-7 h-7 text-zinc-300 mx-auto" />
            <p className="text-xs font-semibold text-zinc-500">
              {isEn
                ? 'No promotional banners yet. Add your first 1+1 Free deal or coupon announcement!'
                : 'لا توجد بانرات عروض بعد. أضف أول عرض 1+1 مجاناً أو إعلان كوبون ليظهر للعملاء!'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {offers.map((offer, idx) => {
              const previewBg = isValidHexColor(offer.bgColor)
                ? offer.bgColor!
                : restaurant.primaryColor || '#A61C1C';
              const previewFg = isValidHexColor(offer.textColor)
                ? offer.textColor!
                : getContrastOnAccent(previewBg);
              const isDragging = draggingOfferId === offer.id;

              return (
                <article
                  key={offer.id}
                  data-offer-card-id={offer.id}
                  className={`rounded-2xl border p-4 space-y-4 transition-all ${
                    isDragging
                      ? 'border-zinc-950 ring-2 ring-zinc-950 bg-amber-50/30 shadow-lg'
                      : offer.isActive
                        ? 'border-zinc-200 bg-zinc-50/40'
                        : 'border-zinc-200 bg-zinc-100/60 opacity-75'
                  }`}
                >
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-200/80">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onPointerDown={(e) => startOfferDrag(e, offer.id)}
                        aria-label={isEn ? 'Drag banner' : 'اسحب لتحريك العرض'}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/60 cursor-grab active:cursor-grabbing touch-none select-none"
                      >
                        <GripVertical className="w-4 h-4" />
                      </button>
                      <span className="font-mono-num text-xs font-extrabold text-zinc-900">
                        #{idx + 1}
                      </span>
                      <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer ms-2">
                        <input
                          type="checkbox"
                          checked={offer.isActive}
                          onChange={(e) => handleUpdateOffer(offer.id, { isActive: e.target.checked })}
                          className="w-4 h-4 accent-emerald-600"
                        />
                        <span>{isEn ? 'Active' : 'مُفعّل'}</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveOffer(idx, -1)}
                        aria-label="Move Up"
                        className="p-2 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === offers.length - 1}
                        onClick={() => moveOffer(idx, 1)}
                        aria-label="Move Down"
                        className="p-2 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteOffer(offer.id)}
                        aria-label="Delete Offer"
                        className="p-2 rounded-lg border border-zinc-200 bg-white text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Live Mini Strip Preview */}
                  <div
                    style={{ backgroundColor: previewBg, color: previewFg }}
                    className="rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 overflow-hidden"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Gift className="w-4 h-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {(loc(offer.badgeText, offer.badgeText_en) || offer.isBogo) && (
                            <span className="px-2 py-0.5 rounded bg-black/20 text-[10px] font-extrabold shrink-0">
                              {loc(offer.badgeText, offer.badgeText_en) ||
                                (isEn ? '1+1 FREE' : '1+1 مجاناً')}
                            </span>
                          )}
                          <p className="text-xs font-extrabold truncate">
                            {loc(offer.title, offer.title_en) || (isEn ? 'Offer Title' : 'عنوان العرض')}
                          </p>
                        </div>
                        {loc(offer.subtitle, offer.subtitle_en) && (
                          <p className="text-[11px] opacity-90 truncate">
                            {loc(offer.subtitle, offer.subtitle_en)}
                          </p>
                        )}
                      </div>
                    </div>
                    {offer.promoCode && (
                      <span className="px-2.5 py-1 rounded-lg bg-black/20 font-mono-num text-[11px] font-extrabold shrink-0">
                        {offer.promoCode}
                      </span>
                    )}
                  </div>

                  {/* Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        {t.admin.offers.bannerTitleAr}
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        value={offer.title}
                        onChange={(e) => handleUpdateOffer(offer.id, { title: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        {t.admin.offers.bannerTitleEn}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={offer.title_en || ''}
                        onChange={(e) => handleUpdateOffer(offer.id, { title_en: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs text-left"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        {t.admin.offers.bannerSubAr}
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        value={offer.subtitle || ''}
                        onChange={(e) => handleUpdateOffer(offer.id, { subtitle: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        {t.admin.offers.bannerSubEn}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={offer.subtitle_en || ''}
                        onChange={(e) => handleUpdateOffer(offer.id, { subtitle_en: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs text-left"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        {t.admin.offers.badgeAr}
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        value={offer.badgeText || ''}
                        onChange={(e) => handleUpdateOffer(offer.id, { badgeText: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        {t.admin.offers.badgeEn}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={offer.badgeText_en || ''}
                        onChange={(e) => handleUpdateOffer(offer.id, { badgeText_en: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs text-left"
                      />
                    </div>
                  </div>

                  {/* Placement, Animation, Colors, Promo Link & BOGO */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        {t.admin.offers.placementLabel}
                      </label>
                      <select
                        value={offer.placement}
                        onChange={(e) =>
                          handleUpdateOffer(offer.id, {
                            placement: e.target.value as OfferPlacement,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-semibold"
                      >
                        {placementOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        {t.admin.offers.animationLabel}
                      </label>
                      <select
                        value={offer.animation}
                        onChange={(e) =>
                          handleUpdateOffer(offer.id, {
                            animation: e.target.value as OfferAnimation,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-semibold"
                      >
                        {animationOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        {t.admin.offers.promoLinkLabel}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        list={`promos_list_${offer.id}`}
                        value={offer.promoCode || ''}
                        onChange={(e) =>
                          handleUpdateOffer(offer.id, {
                            promoCode: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="e.g. SAVE15"
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-mono-num uppercase text-left"
                      />
                      <datalist id={`promos_list_${offer.id}`}>
                        {promoCodes.map((p) => (
                          <option key={p.id} value={p.code} />
                        ))}
                      </datalist>
                    </div>

                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold mb-1">
                          {t.admin.offers.bgColorLabel}
                        </label>
                        <input
                          type="color"
                          value={previewBg}
                          onChange={(e) => {
                            const bg = e.target.value;
                            handleUpdateOffer(offer.id, {
                              bgColor: bg,
                              textColor: getContrastOnAccent(bg),
                            });
                          }}
                          className="w-full h-9 rounded-lg border border-zinc-200 cursor-pointer bg-white"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold mb-1">
                          {t.admin.offers.textColorLabel}
                        </label>
                        <input
                          type="color"
                          value={previewFg}
                          onChange={(e) => handleUpdateOffer(offer.id, { textColor: e.target.value })}
                          className="w-full h-9 rounded-lg border border-zinc-200 cursor-pointer bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(offer.isBogo)}
                        onChange={(e) => handleUpdateOffer(offer.id, { isBogo: e.target.checked })}
                        className="w-4 h-4 accent-amber-600"
                      />
                      <span>{t.admin.offers.bogoToggle}</span>
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: Promo Codes Engine */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-zinc-950 flex items-center gap-2">
              <Percent className="w-4 h-4 text-emerald-700" />
              <span>{t.admin.offers.promosHeading}</span>
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {isEn
                ? 'Customers enter these codes in Cart Drawer to get percentage/fixed discounts, free delivery, or service fee waiver.'
                : 'يدخل العميل هذه الأكواد داخل السلة للحصول على خصم نسبة/مبلغ ثابت أو توصيل مجاني أو إعفاء من رسوم الخدمة.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddPromo}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-900 bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.admin.offers.addPromoBtn}</span>
          </button>
        </div>

        {promoCodes.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 text-center space-y-2">
            <Tag className="w-7 h-7 text-zinc-300 mx-auto" />
            <p className="text-xs font-semibold text-zinc-500">
              {isEn ? 'No promo codes yet.' : 'لا توجد أكواد خصم بعد.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {promoCodes.map((promo) => (
              <div
                key={promo.id}
                className={`rounded-2xl border p-4 space-y-3 ${
                  promo.isActive ? 'border-zinc-200 bg-zinc-50/50' : 'border-zinc-200 bg-zinc-100/70 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-zinc-950 text-white font-mono-num text-xs font-extrabold">
                      {promo.code || 'CODE'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(promo.code)}
                      className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:text-zinc-950 cursor-pointer"
                      aria-label="Copy code"
                    >
                      {copiedCode === promo.code ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer ms-1">
                      <input
                        type="checkbox"
                        checked={promo.isActive}
                        onChange={(e) => handleUpdatePromo(promo.id, { isActive: e.target.checked })}
                        className="w-4 h-4 accent-emerald-600"
                      />
                      <span>{isEn ? 'Active' : 'فعال'}</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeletePromo(promo.id)}
                    aria-label="Delete Promo"
                    className="p-2 rounded-lg border border-zinc-200 bg-white text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      {t.admin.offers.codeLabel}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      maxLength={24}
                      value={promo.code}
                      onChange={(e) =>
                        handleUpdatePromo(promo.id, {
                          code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-mono-num uppercase text-left"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[11px] font-bold mb-1">
                      {t.admin.offers.promoTypeLabel}
                    </label>
                    <select
                      value={promo.type}
                      onChange={(e) =>
                        handleUpdatePromo(promo.id, { type: e.target.value as PromoType })
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-semibold"
                    >
                      {promoTypeOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      {t.admin.offers.promoValueLabel}{' '}
                      {promo.type === 'percent'
                        ? '(%)'
                        : promo.type === 'fixed'
                          ? `(${currencyLabel})`
                          : ''}
                    </label>
                    <input
                      type="number"
                      min={0}
                      disabled={promo.type === 'free_delivery' || promo.type === 'waive_service'}
                      value={promo.value}
                      onChange={(e) => handleUpdatePromo(promo.id, { value: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-mono-num disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      {t.admin.offers.minOrderLabel} ({currencyLabel})
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={promo.minOrder || 0}
                      onChange={(e) =>
                        handleUpdatePromo(promo.id, { minOrder: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-mono-num"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Smart Customer Loyalty, Birthdays & Punch Card */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-zinc-950 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#A61C1C]" />
              <span>
                {isEn
                  ? 'Smart Customer Loyalty & Birthdays'
                  : 'منظومة ولاء العملاء وأعياد الميلاد الذكية'}
              </span>
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
              {isEn
                ? '1-tap phone registration, automatic first-order discount, birthday offers, punch card stamps & smart favorites reorder.'
                : 'تسجيل سريع برقم الهاتف، خصم أول طلب تلقائي، عروض أعياد الميلاد، بطاقة أختام الطلبات، وترشيح الأصناف المفضلة.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenCustomersTab && (
              <button
                type="button"
                onClick={onOpenCustomersTab}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{isEn ? 'Open Customers CRM' : 'فتح صفحة عملائي CRM'}</span>
              </button>
            )}
            <label className="flex items-center gap-2 text-xs font-extrabold cursor-pointer px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50">
              <input
                type="checkbox"
                checked={loyaltyConfig.enabled}
                onChange={(e) =>
                  setLoyaltyConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="w-4 h-4 accent-emerald-600"
              />
              <span>{isEn ? 'Enable Loyalty Engine' : 'تفعيل نظام الولاء'}</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-[11px] font-bold mb-1">
              {isEn ? 'Guest Promo Strip Text (Arabic)' : 'نص شريط التحفيز العلوي (عربي)'}
            </label>
            <input
              type="text"
              dir="rtl"
              maxLength={200}
              value={loyaltyConfig.promoBannerText}
              onChange={(e) =>
                setLoyaltyConfig((prev) => ({ ...prev, promoBannerText: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1">
              {isEn ? 'Guest Promo Strip Text (English)' : 'نص شريط التحفيز العلوي (إنجليزي)'}
            </label>
            <input
              type="text"
              dir="ltr"
              maxLength={200}
              value={loyaltyConfig.promoBannerText_en}
              onChange={(e) =>
                setLoyaltyConfig((prev) => ({ ...prev, promoBannerText_en: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs text-left"
            />
          </div>

          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center justify-between gap-2 text-xs font-bold cursor-pointer px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50">
              <span>{isEn ? 'Enable 1st-Order Discount' : 'تفعيل خصم أول طلب عند التسجيل'}</span>
              <input
                type="checkbox"
                checked={loyaltyConfig.firstOrderEnabled}
                onChange={(e) =>
                  setLoyaltyConfig((prev) => ({ ...prev, firstOrderEnabled: e.target.checked }))
                }
                className="w-4 h-4 accent-emerald-600"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs font-bold cursor-pointer px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50">
              <span>{isEn ? 'Enable Punch Card Reward' : 'تفعيل مكافأة الزيارات المتكررة'}</span>
              <input
                type="checkbox"
                checked={loyaltyConfig.punchCardEnabled}
                onChange={(e) =>
                  setLoyaltyConfig((prev) => ({ ...prev, punchCardEnabled: e.target.checked }))
                }
                className="w-4 h-4 accent-emerald-600"
              />
            </label>
          </div>

          <div>
            <label className="block text-[11px] font-bold mb-1">
              {isEn ? '1st-Order Welcome Discount (%)' : 'نسبة خصم أول طلب عند التسجيل (%)'}
            </label>
            <input
              type="number"
              min={0}
              max={50}
              disabled={!loyaltyConfig.firstOrderEnabled}
              value={loyaltyConfig.firstOrderDiscountPercent}
              onChange={(e) =>
                setLoyaltyConfig((prev) => ({
                  ...prev,
                  firstOrderDiscountPercent: Math.max(0, Math.min(50, Number(e.target.value) || 0)),
                }))
              }
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-mono-num disabled:opacity-40"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold mb-1">
                {isEn ? 'Punch Target (Orders)' : 'عدد الطلبات المستهدف'}
              </label>
              <input
                type="number"
                min={2}
                max={20}
                disabled={!loyaltyConfig.punchCardEnabled}
                value={loyaltyConfig.punchCardTarget}
                onChange={(e) =>
                  setLoyaltyConfig((prev) => ({
                    ...prev,
                    punchCardTarget: Math.max(2, Math.min(20, Number(e.target.value) || 5)),
                  }))
                }
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-mono-num disabled:opacity-40"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1">
                {isEn ? 'Punch Discount (%)' : 'خصم البطاقة (%)'}
              </label>
              <input
                type="number"
                min={0}
                max={50}
                disabled={!loyaltyConfig.punchCardEnabled}
                value={loyaltyConfig.punchCardDiscountPercent}
                onChange={(e) =>
                  setLoyaltyConfig((prev) => ({
                    ...prev,
                    punchCardDiscountPercent: Math.max(
                      0,
                      Math.min(50, Number(e.target.value) || 0)
                    ),
                  }))
                }
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-mono-num disabled:opacity-40"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold mb-1">
              {isEn ? 'Punch Card Reward Label (Arabic)' : 'وصف مكافأة إكمال البطاقة (عربي)'}
            </label>
            <input
              type="text"
              dir="rtl"
              maxLength={140}
              value={loyaltyConfig.punchCardRewardText}
              onChange={(e) =>
                setLoyaltyConfig((prev) => ({ ...prev, punchCardRewardText: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold mb-1">
              {isEn ? 'Punch Card Reward Label (English)' : 'وصف مكافأة إكمال البطاقة (إنجليزي)'}
            </label>
            <input
              type="text"
              dir="ltr"
              maxLength={140}
              value={loyaltyConfig.punchCardRewardText_en}
              onChange={(e) =>
                setLoyaltyConfig((prev) => ({ ...prev, punchCardRewardText_en: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs text-left"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold mb-1">
              {isEn ? 'Birthday Discount (%)' : 'نسبة خصم أعياد الميلاد (%)'}
            </label>
            <input
              type="number"
              min={0}
              max={50}
              value={loyaltyConfig.birthdayDiscountPercent}
              onChange={(e) =>
                setLoyaltyConfig((prev) => ({
                  ...prev,
                  birthdayDiscountPercent: Math.max(0, Math.min(50, Number(e.target.value) || 0)),
                }))
              }
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-mono-num"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold mb-1">
              {isEn ? 'Birthday Banner Offer (Arabic)' : 'رسالة وعرض عيد الميلاد (عربي)'}
            </label>
            <input
              type="text"
              dir="rtl"
              maxLength={220}
              value={loyaltyConfig.birthdayOfferText}
              onChange={(e) =>
                setLoyaltyConfig((prev) => ({ ...prev, birthdayOfferText: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold mb-1">
              {isEn ? 'Birthday Banner Offer (English)' : 'رسالة وعرض عيد الميلاد (إنجليزي)'}
            </label>
            <input
              type="text"
              dir="ltr"
              maxLength={220}
              value={loyaltyConfig.birthdayOfferText_en}
              onChange={(e) =>
                setLoyaltyConfig((prev) => ({ ...prev, birthdayOfferText_en: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs text-left"
            />
          </div>
        </div>
      </section>

      {/* Section 4: Registered Loyalty Members Preview -> Link to Full CRM */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-zinc-950 flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-700" />
              <span>
                {isEn
                  ? `Registered Loyalty Members (${customers.length})`
                  : `سجل عملاء برنامج الولاء (${customers.length})`}
              </span>
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {isEn
                ? 'Quick preview — open "Customers & Smart CRM" tab for Birthday Radar, Smart Filters, WhatsApp Retargeting & CSV Export.'
                : 'معاينة سريعة — انتقل لتبويب "عملائي (CRM والتسويق الذكي)" لرادار أعياد الميلاد، الفلاتر، واتساب التسويقي، وتصدير الإكسل.'}
            </p>
          </div>
          {onOpenCustomersTab && (
            <button
              type="button"
              onClick={onOpenCustomersTab}
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-bold text-zinc-900 cursor-pointer"
            >
              {isEn ? 'Open Full CRM →' : 'إدارة العملاء والتسويق ←'}
            </button>
          )}
        </div>

        {customersLoading ? (
          <div className="p-6 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{isEn ? 'Loading loyalty members...' : 'جاري تحميل قائمة العملاء...'}</span>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 text-center space-y-1.5">
            <Users className="w-6 h-6 text-zinc-300 mx-auto" />
            <p className="text-xs font-semibold text-zinc-500">
              {isEn
                ? 'No registered loyalty customers yet. Visitors can sign up in 1 tap at the top of your menu.'
                : 'لا يوجد عملاء مسجلين بعد. بمجرد تسجيل العميل برقم هاتفه في المنيو سيظهر هنا فوراً.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 text-start">
                  <th className="py-2 px-2 font-bold text-start">{isEn ? 'Name' : 'العميل'}</th>
                  <th className="py-2 px-2 font-bold text-start">{isEn ? 'Phone' : 'الهاتف'}</th>
                  <th className="py-2 px-2 font-bold text-start">{isEn ? 'Preference' : 'التفضيل'}</th>
                  <th className="py-2 px-2 font-bold text-start">{isEn ? 'Orders' : 'الطلبات'}</th>
                  <th className="py-2 px-2 font-bold text-start">{isEn ? 'Punch Card' : 'الأختام'}</th>
                  <th className="py-2 px-2 font-bold text-start">{isEn ? 'Birthday' : 'الميلاد'}</th>
                  <th className="py-2 px-2 font-bold text-start">{isEn ? 'Last Visit' : 'آخر زيارة'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {customers.slice(0, 50).map((cust) => {
                  const bday = isInBirthdayWindow(cust.birthDay, cust.birthMonth);
                  const lastVisit = formatLastVisitDate(cust.lastVisitAt, lang);
                  const prefLabel =
                    cust.preferredOrderType === 'delivery'
                      ? isEn
                        ? 'Delivery'
                        : 'دليفري'
                      : cust.preferredOrderType === 'pickup'
                        ? isEn
                          ? 'Takeaway'
                          : 'تيك أواي'
                        : isEn
                          ? 'Dine-In'
                          : 'صالة';
                  return (
                    <tr key={cust.id} className="hover:bg-zinc-50/70">
                      <td className="py-2.5 px-2 font-bold text-zinc-900">
                        <div className="flex items-center gap-1.5">
                          <span>{cust.fullName}</span>
                          {bday.active && (
                            <span
                              title={isEn ? 'Birthday Window Active' : 'فترة عيد الميلاد مفعلة'}
                              className="inline-flex items-center gap-0.5 text-amber-700 font-extrabold"
                            >
                              <Cake className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-mono-num text-zinc-700" dir="ltr">
                        {cust.phone}
                      </td>
                      <td className="py-2.5 px-2 text-zinc-600">{prefLabel}</td>
                      <td className="py-2.5 px-2 font-mono-num font-bold text-zinc-900">
                        {cust.totalOrders}
                      </td>
                      <td className="py-2.5 px-2 font-mono-num text-zinc-700">
                        {cust.loyaltyCycleOrders}/{loyaltyConfig.punchCardTarget}
                      </td>
                      <td className="py-2.5 px-2 font-mono-num text-zinc-600">
                        {cust.birthDay}/{cust.birthMonth}
                      </td>
                      <td className="py-2.5 px-2 text-zinc-500">{lastVisit || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
