import { useMemo, useState } from 'react';
import {
  Award,
  Cake,
  Check,
  Clock,
  Gift,
  Heart,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getContrastOnAccent } from '../../lib/contrastUtils';
import { formatLastVisitDate, isInBirthdayWindow } from '../../lib/customerLoyaltyUtils';
import {
  CustomerLastOrderItem,
  CustomerProfile,
  CustomerVisitRecord,
  LoyaltyConfig,
  MenuItem,
  Restaurant,
} from '../../types/menu';
import { SafeImage } from '../SafeImage';

interface LoyaltyBarProps {
  restaurant: Restaurant;
  items: MenuItem[];
  customer: CustomerProfile | null;
  visits?: CustomerVisitRecord[];
  loyaltyConfig: Required<LoyaltyConfig>;
  isDarkSurface: boolean;
  onOpenRegisterModal: () => void;
  onQuickAddItem: (item: MenuItem) => void;
  onReorderLastOrder: (items: CustomerLastOrderItem[]) => void;
}

export function LoyaltyBar({
  restaurant,
  items,
  customer,
  visits = [],
  loyaltyConfig,
  isDarkSurface,
  onOpenRegisterModal,
  onQuickAddItem,
  onReorderLastOrder,
}: LoyaltyBarProps) {
  const { lang, dir, loc, formatCurrency } = useLanguage();
  const isEn = lang === 'en';
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [reorderedToast, setReorderedToast] = useState(false);

  const availableItemMap = useMemo(() => {
    const map = new Map<string, MenuItem>();
    items.forEach((it) => {
      if (it.isAvailable) {
        map.set(it.id, it);
      }
    });
    return map;
  }, [items]);

  const topFavorites = useMemo(() => {
    if (!customer || !Array.isArray(customer.favoriteItems)) return [];
    return [...customer.favoriteItems]
      .sort((a, b) => b.count - a.count || (b.lastOrderedAt || 0) - (a.lastOrderedAt || 0))
      .map((fav) => {
        const live = availableItemMap.get(fav.menuItemId);
        return live ? { fav, item: live } : null;
      })
      .filter((x): x is { fav: CustomerProfile['favoriteItems'][number]; item: MenuItem } =>
        Boolean(x)
      )
      .slice(0, 3);
  }, [customer, availableItemMap]);

  const reorderableLastItems = useMemo(() => {
    if (!customer || !Array.isArray(customer.lastOrderItems)) return [];
    return customer.lastOrderItems.filter((li) => availableItemMap.has(li.menuItemId));
  }, [customer, availableItemMap]);

  if (!loyaltyConfig.enabled) return null;

  const accent = restaurant.primaryColor || '#A61C1C';
  const accentText = getContrastOnAccent(accent);
  const currencyLabel = formatCurrency(restaurant.currency);
  const formatPrice = (val: number) => `${val.toFixed(2).replace(/\.00$/, '')} ${currencyLabel}`;

  // 1. Guest Promotional Top Strip
  if (!customer) {
    if (bannerDismissed) {
      return (
        <div
          dir={dir}
          className={`px-3 sm:px-5 py-1.5 border-b flex items-center justify-end ${
            isDarkSurface
              ? 'bg-zinc-950/90 border-zinc-800 text-zinc-400'
              : 'bg-stone-50 border-stone-200 text-stone-600'
          }`}
        >
          <button
            type="button"
            onClick={onOpenRegisterModal}
            className="text-[11px] font-bold flex items-center gap-1.5 hover:underline cursor-pointer"
          >
            <Gift className="w-3.5 h-3.5" style={{ color: isDarkSurface ? '#fbbf24' : accent }} />
            <span>
              {loyaltyConfig.firstOrderEnabled && loyaltyConfig.firstOrderDiscountPercent > 0
                ? isEn
                  ? `Sign up for ${loyaltyConfig.firstOrderDiscountPercent}% off first order`
                  : `سجّل الآن للحصول على خصم ${loyaltyConfig.firstOrderDiscountPercent}%`
                : isEn
                  ? 'Join Rewards & Birthday Treats'
                  : 'سجّل لمتابعة مكافآتك وهدايا عيد ميلادك'}
            </span>
          </button>
        </div>
      );
    }

    return (
      <div
        dir={dir}
        style={{ backgroundColor: accent, color: accentText }}
        className="px-3 sm:px-5 py-2.5 border-b border-black/10"
      >
        <div className="max-w-6xl mx-auto flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="w-8 h-8 rounded-lg bg-black/15 flex items-center justify-center shrink-0">
              <Gift className="w-4 h-4" />
            </span>
            <p className="text-xs sm:text-sm font-bold leading-snug">
              {loc(loyaltyConfig.promoBannerText, loyaltyConfig.promoBannerText_en)}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenRegisterModal}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white text-zinc-950 text-xs font-extrabold hover:bg-stone-100 transition-colors cursor-pointer shadow-xs"
            >
              {isEn ? 'Register Now' : 'سجّل الآن'}
            </button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label={isEn ? 'Dismiss offer' : 'إخفاء الشريط'}
              className="w-9 h-9 rounded-lg bg-black/15 hover:bg-black/25 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Registered Member Experience
  const birthdayStatus = isInBirthdayWindow(customer.birthDay, customer.birthMonth);
  const lastVisitLabel = formatLastVisitDate(customer.lastVisitAt, lang);
  const punchTarget = Math.max(2, loyaltyConfig.punchCardTarget || 5);
  const completedInCycle = Math.max(0, Math.min(punchTarget, customer.loyaltyCycleOrders || 0));
  const rewardReached = completedInCycle >= punchTarget;
  const rewardText = loc(loyaltyConfig.punchCardRewardText, loyaltyConfig.punchCardRewardText_en);

  const surfaceShell = isDarkSurface
    ? 'bg-zinc-950 border-zinc-800 text-zinc-100'
    : 'bg-stone-50/90 border-stone-200 text-stone-900';

  const cardSurface = isDarkSurface
    ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
    : 'bg-white border-stone-200 text-stone-900';

  const mutedText = isDarkSurface ? 'text-zinc-400' : 'text-stone-500';

  return (
    <section
      dir={dir}
      aria-label={isEn ? 'Customer Loyalty Summary' : 'برنامج الولاء والمكافآت'}
      className={`border-b px-3 sm:px-5 py-3 ${surfaceShell}`}
    >
      <div className="max-w-6xl mx-auto space-y-3">
        {/* Birthday Banner (active within +-3 days of birthDay/birthMonth) */}
        {birthdayStatus.active && (
          <div
            style={{ backgroundColor: accent, color: accentText }}
            className="rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm"
          >
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-black/15 flex items-center justify-center shrink-0">
                <Cake className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-extrabold">
                  {birthdayStatus.isExactToday
                    ? isEn
                      ? `Happy Birthday, ${customer.fullName}!`
                      : `عيد ميلاد سعيد يا ${customer.fullName}!`
                    : isEn
                      ? `Birthday Week Treat for ${customer.fullName}!`
                      : `احتفال عيد ميلاد سعيد يا ${customer.fullName}!`}
                </p>
                <p className="text-[11px] sm:text-xs opacity-95 leading-relaxed mt-0.5">
                  {loc(loyaltyConfig.birthdayOfferText, loyaltyConfig.birthdayOfferText_en)}
                </p>
              </div>
            </div>

            {loyaltyConfig.birthdayDiscountPercent > 0 && (
              <span className="text-[11px] font-extrabold bg-black/20 px-3 py-1.5 rounded-xl shrink-0 self-start sm:self-center">
                {isEn
                  ? `${loyaltyConfig.birthdayDiscountPercent}% Auto-Applied in Cart`
                  : `خصم ${loyaltyConfig.birthdayDiscountPercent}% مفعّل بالسلة تلقائياً`}
              </span>
            )}
          </div>
        )}

        {/* Welcome + Digital Punch Card */}
        <div className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 ${cardSurface}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              {customer.avatarUrl ? (
                <img
                  src={customer.avatarUrl}
                  alt={customer.fullName}
                  className="w-11 h-11 rounded-2xl object-cover shrink-0 border border-black/10"
                />
              ) : (
                <span
                  style={{ backgroundColor: accent, color: accentText }}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-sm shrink-0"
                >
                  {(customer.fullName || 'G').trim().slice(0, 2)}
                </span>
              )}
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-extrabold truncate">
                  {isEn ? `Welcome back, ${customer.fullName}` : `أهلاً بيك يا ${customer.fullName}`}
                </p>
                <p className={`text-xs leading-relaxed ${mutedText}`}>
                  {lastVisitLabel ? (
                    isEn ? (
                      `Your last visit was on ${lastVisitLabel}`
                    ) : (
                      `آخر زيارة ليك كانت يوم ${lastVisitLabel}`
                    )
                  ) : !customer.firstOrderDiscountUsed &&
                    loyaltyConfig.firstOrderEnabled &&
                    loyaltyConfig.firstOrderDiscountPercent > 0 ? (
                    <span
                      className="font-bold inline-flex items-center gap-1"
                      style={{ color: isDarkSurface ? '#fbbf24' : accent }}
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      {isEn
                        ? `Your ${loyaltyConfig.firstOrderDiscountPercent}% welcome discount applies automatically on your first order.`
                        : `خصم ${loyaltyConfig.firstOrderDiscountPercent}% على أول طلب سيتطبق تلقائياً في السلة!`}
                    </span>
                  ) : isEn ? (
                    'Order now to enjoy personalized member rewards.'
                  ) : (
                    'اطلب الآن للاستمتاع بمكافآت وعروض أعضائنا.'
                  )}
                </p>
                {visits.length > 0 && (
                  <p className={`text-[11px] font-bold flex items-center gap-1.5 pt-0.5 ${mutedText}`}>
                    <Clock className="w-3 h-3 shrink-0" />
                    <span className="font-mono-num">
                      {isEn ? `${visits.length} recorded visits` : `${visits.length} زيارة مسجلة`}
                      {visits[0]?.durationMinutes && visits[0].durationMinutes > 0
                        ? ` · ${visits[0].durationMinutes} ${isEn ? 'min' : 'دقيقة'}`
                        : visits[0]?.status === 'active'
                          ? ` · ${isEn ? 'Active visit' : 'زيارة نشطة الآن'}`
                          : ''}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenRegisterModal}
              className={`min-h-[36px] px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shrink-0 ${
                isDarkSurface
                  ? 'border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-800'
                  : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{isEn ? 'My Info' : 'بياناتي'}</span>
            </button>
          </div>

          {/* Punch Card Progress */}
          {loyaltyConfig.punchCardEnabled && (
            <div
              className={`pt-2.5 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                isDarkSurface ? 'border-zinc-800' : 'border-stone-100'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Award
                  className="w-4 h-4 shrink-0"
                  style={{ color: isDarkSurface ? '#fbbf24' : accent }}
                />
                <p className="text-xs font-bold leading-snug">
                  {rewardReached
                    ? isEn
                      ? `Completed ${punchTarget} of ${punchTarget} orders — Reward ready: ${rewardText}`
                      : `أكملت ${punchTarget} من ${punchTarget} طلبات — مكافأتك جاهزة: ${rewardText}`
                    : isEn
                      ? `Completed ${completedInCycle} of ${punchTarget} orders toward: ${rewardText}`
                      : `أكملت ${completedInCycle} من ${punchTarget} طلبات للحصول على مكافأتك القادمة (${rewardText})`}
                </p>
              </div>

              <div
                className="flex items-center gap-1.5 flex-wrap shrink-0"
                aria-label={`${completedInCycle}/${punchTarget}`}
              >
                {Array.from({ length: Math.min(punchTarget, 10) }, (_, idx) => {
                  const filled = idx < completedInCycle;
                  return (
                    <span
                      key={idx}
                      style={
                        filled
                          ? { backgroundColor: accent, color: accentText, borderColor: accent }
                          : undefined
                      }
                      className={`w-6 h-6 rounded-lg border text-[10px] font-mono-num font-extrabold flex items-center justify-center transition-colors ${
                        filled
                          ? ''
                          : isDarkSurface
                            ? 'border-zinc-700 bg-zinc-950 text-zinc-500'
                            : 'border-stone-200 bg-stone-50 text-stone-400'
                      }`}
                    >
                      {filled ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </span>
                  );
                })}
                {punchTarget > 10 && (
                  <span className={`text-[11px] font-mono-num font-bold ${mutedText}`}>
                    {completedInCycle}/{punchTarget}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Favorites & Quick Reorder Section */}
        {(topFavorites.length > 0 || reorderableLastItems.length > 0) && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Heart
                  className="w-4 h-4 shrink-0"
                  style={{ color: isDarkSurface ? '#fb7185' : '#e11d48' }}
                />
                <h3 className="text-xs sm:text-sm font-extrabold">
                  {isEn ? 'Your Top Favorites (1-Tap Add)' : 'مختاراتك المفضلة (اطلبها بضغطة)'}
                </h3>
              </div>

              {reorderableLastItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onReorderLastOrder(reorderableLastItems);
                    setReorderedToast(true);
                    setTimeout(() => setReorderedToast(false), 1800);
                  }}
                  style={{ backgroundColor: accent, color: accentText }}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 hover:opacity-90 cursor-pointer shrink-0 shadow-xs"
                >
                  {reorderedToast ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {reorderedToast
                      ? isEn
                        ? 'Added Last Order!'
                        : 'تمت إضافة آخر طلب للسلة!'
                      : isEn
                        ? 'Reorder Last Order'
                        : 'إعادة طلب آخر أوردر'}
                  </span>
                </button>
              )}
            </div>

            {topFavorites.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {topFavorites.map(({ fav, item }) => {
                  const dishName = loc(item.name, item.name_en);
                  const displayPrice =
                    item.sizes && item.sizes.length > 0 ? item.sizes[0].price : item.basePrice;
                  const added = justAddedId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-2.5 flex items-center gap-2.5 ${cardSurface}`}
                    >
                      <SafeImage
                        src={item.imageUrl}
                        alt={dishName}
                        className="w-12 h-12 rounded-lg object-cover shrink-0 border border-black/10"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-extrabold truncate">{dishName}</p>
                        <p className={`text-[11px] truncate ${mutedText}`}>
                          <span className="font-mono-num font-bold">
                            {formatPrice(displayPrice)}
                          </span>
                          {' · '}
                          <span>
                            {isEn ? `Ordered ${fav.count}×` : `طلبتها ${fav.count} مرات`}
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onQuickAddItem(item);
                          setJustAddedId(item.id);
                          setTimeout(
                            () => setJustAddedId((prev) => (prev === item.id ? null : prev)),
                            1200
                          );
                        }}
                        style={!added ? { backgroundColor: accent, color: accentText } : undefined}
                        aria-label={isEn ? `Quick add ${dishName}` : `إضافة سريعة ${dishName}`}
                        className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1 shrink-0 cursor-pointer transition-colors ${
                          added ? 'bg-emerald-600 text-white' : 'hover:opacity-90'
                        }`}
                      >
                        {added ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Quick Add' : 'إضافة سريعة'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
