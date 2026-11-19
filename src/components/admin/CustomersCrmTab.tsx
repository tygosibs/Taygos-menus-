import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Cake,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Gift,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Save,
  Search,
  Settings2,
  ShoppingBag,
  Sparkles,
  Users,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  buildBirthdayWhatsappUrl,
  buildMarketingWhatsappUrl,
  DEFAULT_LOYALTY_CONFIG,
  exportCustomersCsv,
  formatLastVisitDate,
  getDaysSinceLastVisit,
  getDaysUntilUpcomingBirthday,
  getResolvedLoyaltyConfig,
  getTopFavoriteItem,
} from '../../lib/customerLoyaltyUtils';
import {
  subscribeRestaurantCustomers,
  updateRestaurantLoyaltyConfig,
} from '../../lib/firestoreService';
import { CustomerProfile, LoyaltyConfig, OrderType, Restaurant } from '../../types/menu';

interface CustomersCrmTabProps {
  restaurant: Restaurant;
  onRestaurantUpdated: (updated: Restaurant) => void;
}

type CrmFilter =
  | 'all'
  | 'upcoming_birthdays'
  | 'dine_in'
  | 'delivery'
  | 'pickup'
  | 'inactive_15d';

const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const MONTHS_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatBirthMonthDay(day: number, month: number, lang: 'ar' | 'en'): string {
  const mIdx = Math.max(0, Math.min(11, (Number(month) || 1) - 1));
  const safeDay = Math.max(1, Math.min(31, Number(day) || 1));
  return lang === 'en' ? `${MONTHS_EN[mIdx]} ${safeDay}` : `${safeDay} ${MONTHS_AR[mIdx]}`;
}

function getBirthdayCountdownLabel(
  name: string,
  daysUntil: number,
  lang: 'ar' | 'en'
): string {
  if (lang === 'en') {
    if (daysUntil === 0) return `Today is ${name}'s birthday! 🎉`;
    if (daysUntil === 1) return `1 day until ${name}'s birthday 🎈`;
    return `${daysUntil} days until ${name}'s birthday 🎈`;
  }
  if (daysUntil === 0) return `اليوم عيد ميلاد أستاذ ${name}! 🎉`;
  if (daysUntil === 1) return `باقي يوم واحد على عيد ميلاد أستاذ ${name} 🎈`;
  if (daysUntil === 2) return `باقي يومين على عيد ميلاد أستاذ ${name} 🎈`;
  return `باقي ${daysUntil} أيام على عيد ميلاد أستاذ ${name} 🎈`;
}

function getOrderTypeLabel(orderType: OrderType, lang: 'ar' | 'en'): string {
  if (orderType === 'delivery') return lang === 'en' ? 'Delivery' : 'دليفري';
  if (orderType === 'pickup') return lang === 'en' ? 'Takeaway' : 'تيك أواي';
  return lang === 'en' ? 'Dine-In' : 'صالة';
}

export function CustomersCrmTab({ restaurant, onRestaurantUpdated }: CustomersCrmTabProps) {
  const { lang, dir, loc } = useLanguage();
  const isEn = lang === 'en';

  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<CrmFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const [loyaltyConfig, setLoyaltyConfig] = useState<Required<LoyaltyConfig>>(() =>
    getResolvedLoyaltyConfig(restaurant)
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    setLoyaltyConfig(getResolvedLoyaltyConfig(restaurant));
  }, [restaurant]);

  useEffect(() => {
    if (!restaurant.id || !restaurant.ownerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const unsub = subscribeRestaurantCustomers(
      restaurant.id,
      restaurant.ownerId,
      (list) => {
        setCustomers(list);
        setLoading(false);
      },
      (err) => {
        setLoadError(
          err?.message ||
            (isEn ? 'Could not load customers database.' : 'تعذر تحميل قاعدة بيانات العملاء.')
        );
        setLoading(false);
      }
    );
    return () => unsub();
  }, [restaurant.id, restaurant.ownerId, isEn]);

  const restaurantDisplayName = loc(restaurant.name, restaurant.name_en);
  const publicMenuUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/menu/${restaurant.slug}`
      : `/menu/${restaurant.slug}`;

  const upcomingBirthdayCustomers = useMemo(() => {
    return customers
      .map((customer) => ({
        customer,
        daysUntil: getDaysUntilUpcomingBirthday(customer.birthDay, customer.birthMonth),
      }))
      .filter(
        (entry): entry is { customer: CustomerProfile; daysUntil: number } =>
          entry.daysUntil !== null
      )
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [customers]);

  const counts = useMemo(() => {
    let dineIn = 0;
    let delivery = 0;
    let pickup = 0;
    let inactive15d = 0;
    for (const c of customers) {
      if (c.preferredOrderType === 'delivery') delivery += 1;
      else if (c.preferredOrderType === 'pickup') pickup += 1;
      else dineIn += 1;

      const since = getDaysSinceLastVisit(c);
      if (since !== null && since >= 15) {
        inactive15d += 1;
      }
    }
    return {
      all: customers.length,
      upcomingBirthdays: upcomingBirthdayCustomers.length,
      dineIn,
      delivery,
      pickup,
      inactive15d,
    };
  }, [customers, upcomingBirthdayCustomers.length]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      if (activeFilter === 'upcoming_birthdays') {
        if (getDaysUntilUpcomingBirthday(c.birthDay, c.birthMonth) === null) return false;
      } else if (activeFilter === 'dine_in') {
        if (c.preferredOrderType !== 'dine_in') return false;
      } else if (activeFilter === 'delivery') {
        if (c.preferredOrderType !== 'delivery') return false;
      } else if (activeFilter === 'pickup') {
        if (c.preferredOrderType !== 'pickup') return false;
      } else if (activeFilter === 'inactive_15d') {
        const since = getDaysSinceLastVisit(c);
        if (since === null || since < 15) return false;
      }

      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q)
      );
    });
  }, [customers, activeFilter, searchQuery]);

  const handleSaveLoyaltySettings = async () => {
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSavedToast(false);
    try {
      const saved = await updateRestaurantLoyaltyConfig(restaurant.id, loyaltyConfig);
      const resolvedNext: Required<LoyaltyConfig> = {
        ...loyaltyConfig,
        ...saved,
      };
      setLoyaltyConfig(resolvedNext);
      onRestaurantUpdated({
        ...restaurant,
        loyaltyConfig: resolvedNext,
      });
      setSettingsSavedToast(true);
      setTimeout(() => setSettingsSavedToast(false), 3000);
    } catch (err) {
      setSettingsError(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Failed to save loyalty settings.'
            : 'تعذر حفظ إعدادات الولاء، حاول مرة أخرى.'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExportCsv = () => {
    const targetList = filteredCustomers.length > 0 ? filteredCustomers : customers;
    if (targetList.length === 0) return;
    exportCustomersCsv(
      targetList,
      restaurant.slug,
      loyaltyConfig.punchCardTarget,
      lang
    );
  };

  const filterTabs: { id: CrmFilter; label: string; count: number }[] = [
    { id: 'all', label: isEn ? 'All' : 'الكل', count: counts.all },
    {
      id: 'upcoming_birthdays',
      label: isEn ? 'Upcoming Birthdays 🎂' : 'أعياد ميلاد قريبة 🎂',
      count: counts.upcomingBirthdays,
    },
    { id: 'dine_in', label: isEn ? 'Dine-In' : 'صالة', count: counts.dineIn },
    { id: 'delivery', label: isEn ? 'Delivery' : 'دليفري', count: counts.delivery },
    { id: 'pickup', label: isEn ? 'Takeaway' : 'تيك أواي', count: counts.pickup },
    {
      id: 'inactive_15d',
      label: isEn ? 'Inactive 15+ Days' : 'عملاء لم يزورونا منذ 15 يوماً',
      count: counts.inactive15d,
    },
  ];

  return (
    <div dir={dir} className="space-y-5 overflow-x-clip max-w-full">
      {/* Page Header */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-extrabold text-zinc-950 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#A61C1C] shrink-0" />
            <span className="truncate">
              {isEn ? 'My Customers (CRM & Smart Marketing)' : 'عملائي (CRM والتسويق الذكي)'}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
            {isEn
              ? 'Proactive birthday radar, loyalty offer controls, smart customer segments, 1-click WhatsApp retargeting, and Excel export.'
              : 'رادار أعياد الميلاد القريبة، التحكم في خصومات الولاء، تصنيف العملاء وتنشيط المبيعات عبر واتساب، وتصدير الإكسل.'}
          </p>
        </div>

        <button
          type="button"
          disabled={customers.length === 0}
          onClick={handleExportCsv}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-extrabold hover:bg-zinc-800 flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>
            {isEn ? 'Export Customers (Excel / CSV)' : 'تصدير قاعدة العملاء (Excel / CSV)'}
          </span>
        </button>
      </div>

      {/* 1. Proactive Birthday Reminders Radar */}
      <section className="bg-white border border-amber-300 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Cake className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-zinc-950">
                {isEn
                  ? '🎂 Customer Birthdays in the Next 3 Days'
                  : '🎂 أعياد ميلاد عملائك خلال الـ 3 أيام القادمة'}
              </h3>
              <p className="text-[11px] text-zinc-500">
                {isEn
                  ? 'Automatic daily comparison against registered birth dates so you can send a timely VIP birthday invite.'
                  : 'مقارنة تلقائية يومية مع تواريخ ميلاد عملائك المسجلين لإرسال دعوة وهدية عيد الميلاد في الوقت المناسب.'}
              </p>
            </div>
          </div>
          <span className="text-xs font-mono-num font-extrabold text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg shrink-0">
            {upcomingBirthdayCustomers.length}{' '}
            {isEn ? 'Upcoming' : upcomingBirthdayCustomers.length === 1 ? 'عميل' : 'عملاء'}
          </span>
        </div>

        {loading ? (
          <div className="py-4 flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{isEn ? 'Checking birthdays...' : 'جاري فحص أعياد الميلاد...'}</span>
          </div>
        ) : upcomingBirthdayCustomers.length === 0 ? (
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {isEn
                ? 'No registered customer birthdays in the next 3 days. Radar monitors new sign-ups automatically.'
                : 'لا توجد أعياد ميلاد لعملاء مسجلين خلال الـ 3 أيام القادمة — الرادار يراقب تلقائياً كل عميل جديد يومياً.'}
            </span>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-xl bg-zinc-50/40">
            {upcomingBirthdayCustomers.map(({ customer, daysUntil }) => {
              const waUrl = buildBirthdayWhatsappUrl(
                customer,
                restaurantDisplayName,
                loyaltyConfig,
                publicMenuUrl,
                lang
              );
              const birthText = formatBirthMonthDay(
                customer.birthDay,
                customer.birthMonth,
                lang
              );
              const topFav = getTopFavoriteItem(customer);
              return (
                <div
                  key={`bday_${customer.id}`}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs sm:text-sm font-extrabold text-zinc-950">
                      {getBirthdayCountdownLabel(customer.fullName, daysUntil, lang)}
                    </p>
                    <p className="text-[11px] text-zinc-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-mono-num font-semibold text-zinc-800">
                        {birthText} ({customer.birthDay}/{customer.birthMonth})
                      </span>
                      <span>·</span>
                      <span className="font-mono-num" dir="ltr">
                        {customer.phone}
                      </span>
                      {topFav && (
                        <>
                          <span>·</span>
                          <span>
                            {isEn ? 'Favorite:' : 'يفضّل:'}{' '}
                            <strong className="text-zinc-900">
                              {loc(topFav.name, topFav.name_en)}
                            </strong>
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 shrink-0 transition-colors"
                  >
                    <Gift className="w-4 h-4 shrink-0" />
                    <span>
                      {isEn
                        ? 'Send Birthday Offer via WhatsApp 🎁'
                        : 'أرسل عرض عيد الميلاد عبر واتساب 🎁'}
                    </span>
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: isEn ? 'Registered Customers' : 'إجمالي العملاء المسجلين',
            value: counts.all,
            icon: Users,
            accent: 'text-zinc-950',
          },
          {
            label: isEn ? 'Dine-In Guests' : 'عملاء الصالة',
            value: counts.dineIn,
            icon: MapPin,
            accent: 'text-amber-700',
          },
          {
            label: isEn ? 'Delivery Guests' : 'عملاء الدليفري',
            value: counts.delivery,
            icon: ShoppingBag,
            accent: 'text-emerald-700',
          },
          {
            label: isEn ? 'Takeaway Guests' : 'عملاء التيك أواي',
            value: counts.pickup,
            icon: Heart,
            accent: 'text-[#A61C1C]',
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white border border-zinc-200 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-zinc-500 truncate">{kpi.label}</p>
                <p className={`text-xl sm:text-2xl font-extrabold font-mono-num mt-0.5 ${kpi.accent}`}>
                  {kpi.value}
                </p>
              </div>
              <Icon className="w-5 h-5 text-zinc-300 shrink-0" />
            </div>
          );
        })}
      </div>

      {/* 2. Loyalty & Offers Settings Panel */}
      <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSettingsExpanded((prev) => !prev)}
            className="flex items-center gap-2.5 text-start cursor-pointer min-w-0 flex-1"
          >
            <span className="w-9 h-9 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center shrink-0">
              <Settings2 className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-zinc-950 flex items-center gap-2">
                <span className="truncate">
                  {isEn
                    ? 'Loyalty, Punch Card & Birthday Settings'
                    : 'لوحة إعدادات العروض والولاء وأعياد الميلاد'}
                </span>
                {settingsExpanded ? (
                  <ChevronUp className="w-4 h-4 text-zinc-500 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
                )}
              </h3>
              <p className="text-[11px] text-zinc-500 truncate">
                {isEn
                  ? 'Control first-order welcome discount, repeat-visit punch reward, and customizable WhatsApp birthday message.'
                  : 'تفعيل أو إيقاف خصم أول طلب ومكافأة الزيارات المتكررة وتخصيص رسالة عيد الميلاد على واتساب.'}
              </p>
            </div>
          </button>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="flex items-center gap-2 text-xs font-extrabold cursor-pointer px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 min-h-[40px]">
              <input
                type="checkbox"
                checked={loyaltyConfig.enabled}
                onChange={(e) =>
                  setLoyaltyConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="w-4 h-4 accent-emerald-600"
              />
              <span>{isEn ? 'Loyalty Active' : 'تفعيل المنظومة'}</span>
            </label>

            {settingsSavedToast && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>{isEn ? 'Saved!' : 'تم الحفظ'}</span>
              </span>
            )}

            <button
              type="button"
              disabled={savingSettings}
              onClick={handleSaveLoyaltySettings}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-extrabold hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {savingSettings ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isEn ? 'Save Settings' : 'حفظ الإعدادات'}</span>
            </button>
          </div>
        </div>

        {settingsError && (
          <div className="mx-4 sm:mx-5 mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
            {settingsError}
          </div>
        )}

        {settingsExpanded && (
          <div className="px-4 sm:px-5 pb-5 pt-3 border-t border-zinc-200 space-y-5">
            {/* First-Order Welcome Discount */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs sm:text-sm font-extrabold text-zinc-900 flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-[#A61C1C]" />
                  <span>
                    {isEn ? 'First-Order Registration Discount' : 'خصم أول طلب عند التسجيل'}
                  </span>
                </h4>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loyaltyConfig.firstOrderEnabled}
                    onChange={(e) =>
                      setLoyaltyConfig((prev) => ({
                        ...prev,
                        firstOrderEnabled: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <span>{isEn ? 'Enabled' : 'مُفعّل'}</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                    {isEn ? 'Discount Percentage (%)' : 'نسبة الخصم (%)'}
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
                        firstOrderDiscountPercent: Math.max(
                          0,
                          Math.min(50, Number(e.target.value) || 0)
                        ),
                      }))
                    }
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-mono-num disabled:opacity-45"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                    {isEn ? 'Top Promo Strip (Arabic)' : 'نص شريط التحفيز العلوي (عربي)'}
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={loyaltyConfig.promoBannerText}
                    onChange={(e) =>
                      setLoyaltyConfig((prev) => ({ ...prev, promoBannerText: e.target.value }))
                    }
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                    {isEn ? 'Top Promo Strip (English)' : 'نص شريط التحفيز العلوي (إنجليزي)'}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={loyaltyConfig.promoBannerText_en}
                    onChange={(e) =>
                      setLoyaltyConfig((prev) => ({
                        ...prev,
                        promoBannerText_en: e.target.value,
                      }))
                    }
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs text-left"
                  />
                </div>
              </div>
            </div>

            {/* Punch Card Repeat-Visit Reward */}
            <div className="pt-4 border-t border-zinc-100 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs sm:text-sm font-extrabold text-zinc-900 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-600" />
                  <span>
                    {isEn ? 'Repeat-Visit Punch Card Reward' : 'مكافأة الزيارات المتكررة (بطاقة الأختام)'}
                  </span>
                </h4>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loyaltyConfig.punchCardEnabled}
                    onChange={(e) =>
                      setLoyaltyConfig((prev) => ({
                        ...prev,
                        punchCardEnabled: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <span>{isEn ? 'Enabled' : 'مُفعّل'}</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                    {isEn ? 'Required Orders Count' : 'عدد الطلبات المطلوبة'}
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
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-mono-num disabled:opacity-45"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                    {isEn ? 'Auto Cart Reward (%)' : 'نسبة الخصم عند الإكمال (%)'}
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
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-mono-num disabled:opacity-45"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                    {isEn ? 'Reward Label (Arabic)' : 'وصف المكافأة (عربي)'}
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    disabled={!loyaltyConfig.punchCardEnabled}
                    value={loyaltyConfig.punchCardRewardText}
                    onChange={(e) =>
                      setLoyaltyConfig((prev) => ({
                        ...prev,
                        punchCardRewardText: e.target.value,
                      }))
                    }
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs disabled:opacity-45"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                    {isEn ? 'Reward Label (English)' : 'وصف المكافأة (إنجليزي)'}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    disabled={!loyaltyConfig.punchCardEnabled}
                    value={loyaltyConfig.punchCardRewardText_en}
                    onChange={(e) =>
                      setLoyaltyConfig((prev) => ({
                        ...prev,
                        punchCardRewardText_en: e.target.value,
                      }))
                    }
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs text-left disabled:opacity-45"
                  />
                </div>
              </div>
            </div>

            {/* Birthday Offer & Custom WhatsApp Message */}
            <div className="pt-4 border-t border-zinc-100 space-y-3">
              <h4 className="text-xs sm:text-sm font-extrabold text-zinc-900 flex items-center gap-1.5">
                <Cake className="w-4 h-4 text-emerald-700" />
                <span>
                  {isEn
                    ? 'Birthday Offer & WhatsApp Gift Message'
                    : 'تخصيص عرض عيد الميلاد ورسالة الواتساب'}
                </span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                    {isEn ? 'Birthday Discount (%)' : 'نسبة خصم عيد الميلاد (%)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={loyaltyConfig.birthdayDiscountPercent}
                    onChange={(e) =>
                      setLoyaltyConfig((prev) => ({
                        ...prev,
                        birthdayDiscountPercent: Math.max(
                          0,
                          Math.min(50, Number(e.target.value) || 0)
                        ),
                      }))
                    }
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                    {isEn ? 'Birthday Banner Offer (Arabic)' : 'رسالة عرض عيد الميلاد (عربي)'}
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={loyaltyConfig.birthdayOfferText}
                    onChange={(e) =>
                      setLoyaltyConfig((prev) => ({
                        ...prev,
                        birthdayOfferText: e.target.value,
                      }))
                    }
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                    {isEn ? 'Birthday Banner Offer (English)' : 'رسالة عرض عيد الميلاد (إنجليزي)'}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={loyaltyConfig.birthdayOfferText_en}
                    onChange={(e) =>
                      setLoyaltyConfig((prev) => ({
                        ...prev,
                        birthdayOfferText_en: e.target.value,
                      }))
                    }
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs text-left"
                  />
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <label className="text-[11px] font-bold text-zinc-700">
                    {isEn
                      ? 'WhatsApp Birthday Invitation Template'
                      : 'قالب رسالة تهنئة عيد الميلاد عبر واتساب'}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setLoyaltyConfig((prev) => ({
                        ...prev,
                        birthdayWhatsappMessage: DEFAULT_LOYALTY_CONFIG.birthdayWhatsappMessage,
                      }))
                    }
                    className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900 underline cursor-pointer"
                  >
                    {isEn ? 'Reset default' : 'استعادة القالب الافتراضي'}
                  </button>
                </div>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={loyaltyConfig.birthdayWhatsappMessage}
                  onChange={(e) =>
                    setLoyaltyConfig((prev) => ({
                      ...prev,
                      birthdayWhatsappMessage: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs leading-relaxed"
                />
                <p className="text-[11px] text-zinc-500 mt-1" dir="ltr">
                  Placeholders: <code className="font-mono-num">{'{name}'}</code>,{' '}
                  <code className="font-mono-num">{'{restaurant}'}</code>,{' '}
                  <code className="font-mono-num">{'{offer}'}</code>,{' '}
                  <code className="font-mono-num">{'{url}'}</code>
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. Smart Filter Bar, Search & Customers Database */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-zinc-950">
              {isEn ? 'Customers Database & Retargeting' : 'قاعدة بيانات العملاء وإعادة الاستهداف'}
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {isEn
                ? 'Segment guests by preference, birthdays, or inactivity and message them directly on WhatsApp.'
                : 'فلتر عملاءك حسب نوع الطلب أو أعياد الميلاد أو فترة الغياب وأرسل لهم رسالة مخصصة بضغطة زر.'}
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-zinc-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isEn ? 'Search name, phone, address...' : 'بحث بالاسم، الهاتف، أو العنوان...'
              }
              className="w-full min-h-[42px] ps-9 pe-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white text-xs focus:outline-none focus:border-zinc-400"
            />
          </div>
        </div>

        {/* Interactive Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {filterTabs.map((tab) => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  active
                    ? 'bg-zinc-950 text-white border-zinc-950'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono-num text-[11px] px-1.5 py-0.5 rounded-md ${
                    active ? 'bg-white/20 text-white' : 'bg-zinc-200/80 text-zinc-800'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {loadError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{isEn ? 'Loading customers...' : 'جاري تحميل قائمة العملاء...'}</span>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-10 px-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 text-center space-y-2">
            <Users className="w-7 h-7 text-zinc-300 mx-auto" />
            <p className="text-xs font-bold text-zinc-700">
              {customers.length === 0
                ? isEn
                  ? 'No registered customers yet.'
                  : 'لا يوجد عملاء مسجلين بعد.'
                : isEn
                  ? 'No customers match the current filter or search.'
                  : 'لا يوجد عملاء مطابقون لهذا الفلتر أو البحث حالياً.'}
            </p>
            <p className="text-[11px] text-zinc-500">
              {customers.length === 0
                ? isEn
                  ? 'When guests sign up from the top loyalty bar in your menu, their profiles appear here immediately.'
                  : 'بمجرد تسجيل أي عميل برقم هاتفه من الشريط العلوي للمنيو سيظهر ملفه الكامل هنا فوراً.'
                : isEn
                  ? 'Try switching back to "All" to see every customer.'
                  : 'جرّب اختيار تبويب "الكل" أو مسح كلمة البحث.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto border border-zinc-200 rounded-xl">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 text-start">
                    <th className="py-3 px-3 font-extrabold text-start">
                      {isEn ? 'Customer' : 'الاسم'}
                    </th>
                    <th className="py-3 px-3 font-extrabold text-start">
                      {isEn ? 'Phone' : 'الهاتف'}
                    </th>
                    <th className="py-3 px-3 font-extrabold text-start">
                      {isEn ? 'Birth Date' : 'تاريخ الميلاد'}
                    </th>
                    <th className="py-3 px-3 font-extrabold text-start">
                      {isEn ? 'Segment & Address' : 'التصنيف والعنوان'}
                    </th>
                    <th className="py-3 px-3 font-extrabold text-start">
                      {isEn ? 'Orders' : 'الطلبات'}
                    </th>
                    <th className="py-3 px-3 font-extrabold text-start">
                      {isEn ? 'Last Visit' : 'آخر زيارة'}
                    </th>
                    <th className="py-3 px-3 font-extrabold text-start">
                      {isEn ? 'Top Favorite' : 'أكثر صنف مفضل'}
                    </th>
                    <th className="py-3 px-3 font-extrabold text-end">
                      {isEn ? 'Action' : 'إجراء'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredCustomers.map((c) => {
                    const topFav = getTopFavoriteItem(c);
                    const lastVisit = formatLastVisitDate(
                      c.lastVisitAt || c.updatedAt || c.createdAt,
                      lang
                    );
                    const daysSince = getDaysSinceLastVisit(c);
                    const daysUntilBday = getDaysUntilUpcomingBirthday(c.birthDay, c.birthMonth);
                    const marketingUrl = buildMarketingWhatsappUrl(
                      c,
                      restaurantDisplayName,
                      publicMenuUrl,
                      lang
                    );

                    return (
                      <tr key={c.id} className="hover:bg-zinc-50/70 align-middle">
                        <td className="py-3 px-3 font-bold text-zinc-950">
                          <div className="flex items-center gap-1.5">
                            <span>{c.fullName}</span>
                            {daysUntilBday !== null && (
                              <span
                                title={getBirthdayCountdownLabel(c.fullName, daysUntilBday, lang)}
                                className="inline-flex shrink-0"
                              >
                                <Cake className="w-3.5 h-3.5 text-amber-600" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono-num text-zinc-700" dir="ltr">
                          {c.phone}
                        </td>
                        <td className="py-3 px-3 font-mono-num text-zinc-600 whitespace-nowrap">
                          {c.birthDay}/{c.birthMonth}/{c.birthYear}
                        </td>
                        <td className="py-3 px-3 text-zinc-700 max-w-[210px]">
                          <p className="font-bold text-zinc-900">
                            {getOrderTypeLabel(c.preferredOrderType, lang)}
                          </p>
                          {c.address && (
                            <p className="text-[11px] text-zinc-500 truncate" title={c.address}>
                              {c.address}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono-num whitespace-nowrap">
                          <span className="font-extrabold text-zinc-950">{c.totalOrders}</span>
                          {loyaltyConfig.punchCardEnabled && (
                            <span className="text-[11px] text-zinc-500">
                              {' '}
                              · {c.loyaltyCycleOrders}/{loyaltyConfig.punchCardTarget}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-zinc-600 whitespace-nowrap">
                          <p>{lastVisit || '—'}</p>
                          {daysSince !== null && daysSince >= 15 && (
                            <p className="text-[10px] font-bold text-amber-700 font-mono-num">
                              {isEn ? `${daysSince}d ago` : `منذ ${daysSince} يوم`}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-zinc-700 max-w-[170px]">
                          {topFav ? (
                            <span className="block truncate font-semibold text-zinc-900">
                              {loc(topFav.name, topFav.name_en)}{' '}
                              <span className="font-mono-num text-[11px] text-zinc-500">
                                ({topFav.count}×)
                              </span>
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-end">
                          <a
                            href={marketingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-bold text-[11px] whitespace-nowrap transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{isEn ? 'WhatsApp Marketing 💬' : 'واتساب تسويقي 💬'}</span>
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="md:hidden divide-y divide-zinc-200 border border-zinc-200 rounded-xl overflow-hidden">
              {filteredCustomers.map((c) => {
                const topFav = getTopFavoriteItem(c);
                const lastVisit = formatLastVisitDate(
                  c.lastVisitAt || c.updatedAt || c.createdAt,
                  lang
                );
                const daysSince = getDaysSinceLastVisit(c);
                const daysUntilBday = getDaysUntilUpcomingBirthday(c.birthDay, c.birthMonth);
                const marketingUrl = buildMarketingWhatsappUrl(
                  c,
                  restaurantDisplayName,
                  publicMenuUrl,
                  lang
                );

                return (
                  <div key={`mob_${c.id}`} className="p-3.5 space-y-2.5 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-zinc-950 flex items-center gap-1.5 truncate">
                          <span className="truncate">{c.fullName}</span>
                          {daysUntilBday !== null && (
                            <Cake className="w-4 h-4 text-amber-600 shrink-0" />
                          )}
                        </p>
                        <p className="text-xs font-mono-num text-zinc-600 flex items-center gap-1.5 mt-0.5">
                          <Phone className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span dir="ltr">{c.phone}</span>
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-zinc-800 bg-zinc-100 px-2.5 py-1 rounded-lg shrink-0">
                        {getOrderTypeLabel(c.preferredOrderType, lang)}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-600 space-y-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>
                          {isEn ? 'Birth:' : 'الميلاد:'}{' '}
                          <strong className="font-mono-num text-zinc-900">
                            {c.birthDay}/{c.birthMonth}/{c.birthYear}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          {isEn ? 'Orders:' : 'الطلبات:'}{' '}
                          <strong className="font-mono-num text-zinc-900">{c.totalOrders}</strong>
                        </span>
                        {loyaltyConfig.punchCardEnabled && (
                          <>
                            <span>·</span>
                            <span className="font-mono-num">
                              {c.loyaltyCycleOrders}/{loyaltyConfig.punchCardTarget}
                            </span>
                          </>
                        )}
                      </p>

                      {c.address && (
                        <p className="text-[11px] text-zinc-500">
                          {isEn ? 'Address:' : 'العنوان:'} {c.address}
                        </p>
                      )}

                      <p className="text-[11px] text-zinc-500 flex flex-wrap items-center gap-x-2">
                        <span>
                          {isEn ? 'Last visit:' : 'آخر زيارة:'} {lastVisit || '—'}
                        </span>
                        {daysSince !== null && daysSince >= 15 && (
                          <span className="font-bold text-amber-700 font-mono-num">
                            ({isEn ? `${daysSince}d ago` : `منذ ${daysSince} يوم`})
                          </span>
                        )}
                      </p>

                      {topFav && (
                        <p className="text-[11px] text-zinc-700">
                          {isEn ? 'Favorite dish:' : 'الصنف المفضل:'}{' '}
                          <strong className="text-zinc-950">
                            {loc(topFav.name, topFav.name_en)}
                          </strong>{' '}
                          <span className="font-mono-num text-zinc-500">({topFav.count}×)</span>
                        </p>
                      )}
                    </div>

                    <a
                      href={marketingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-extrabold text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" />
                      <span>{isEn ? 'WhatsApp Marketing 💬' : 'واتساب تسويقي 💬'}</span>
                    </a>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
