import { Timestamp } from 'firebase/firestore';
import {
  CustomerFavoriteItem,
  CustomerLastOrderItem,
  CustomerProfile,
  LoyaltyConfig,
  MenuItem,
  OrderItemPayload,
  Restaurant,
} from '../types/menu';

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export const DEFAULT_LOYALTY_CONFIG: Required<LoyaltyConfig> = {
  enabled: true,
  firstOrderEnabled: true,
  promoBannerText:
    '🎁 سجّل بياناتك الآن واحصل على خصم 5% على أول طلب + هدية خاصة في عيد ميلادك!',
  promoBannerText_en:
    '🎁 Register now for 5% off your first order + a special birthday gift!',
  firstOrderDiscountPercent: 5,
  punchCardEnabled: true,
  punchCardTarget: 5,
  punchCardDiscountPercent: 20,
  punchCardRewardText: 'خصم 20% على طلبك القادم بعد إكمال البطاقة',
  punchCardRewardText_en: '20% off your next order after completing the card',
  birthdayOfferText:
    '🎂 كل سنة وأنت طيب! استمتع بخصم 15% + هدية خاصة في عيد ميلادك من المطعم',
  birthdayOfferText_en:
    '🎂 Happy Birthday! Enjoy 15% off + a special birthday treat from us',
  birthdayDiscountPercent: 15,
  birthdayWhatsappMessage:
    'كل سنة وأنت طيب يا {name}! 🎂🎉 بمناسبة عيد ميلادك، مطعم {restaurant} بيدعوك للاحتفال معانا وبنقدملك {offer} 🎁 اطلب من المنيو: {url}',
};

export function normalizeCustomerPhone(raw: string): string {
  if (!raw) return '';
  let normalized = '';
  for (const ch of raw.trim()) {
    const arIdx = ARABIC_DIGITS.indexOf(ch);
    if (arIdx !== -1) {
      normalized += String(arIdx);
      continue;
    }
    const faIdx = PERSIAN_DIGITS.indexOf(ch);
    if (faIdx !== -1) {
      normalized += String(faIdx);
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      normalized += ch;
    }
  }
  return normalized.slice(0, 24);
}

export function getResolvedLoyaltyConfig(restaurant?: Restaurant | null): Required<LoyaltyConfig> {
  const cfg = restaurant?.loyaltyConfig;
  const clampPct = (val: unknown, fallback: number) => {
    const num = Number(val);
    if (Number.isNaN(num)) return fallback;
    return Math.max(0, Math.min(50, Math.round(num)));
  };
  const clampTarget = (val: unknown, fallback: number) => {
    const num = Number(val);
    if (Number.isNaN(num) || num <= 0) return fallback;
    return Math.max(2, Math.min(20, Math.round(num)));
  };

  return {
    enabled: cfg?.enabled ?? DEFAULT_LOYALTY_CONFIG.enabled,
    firstOrderEnabled: cfg?.firstOrderEnabled ?? DEFAULT_LOYALTY_CONFIG.firstOrderEnabled,
    promoBannerText: cfg?.promoBannerText?.trim() || DEFAULT_LOYALTY_CONFIG.promoBannerText,
    promoBannerText_en:
      cfg?.promoBannerText_en?.trim() || DEFAULT_LOYALTY_CONFIG.promoBannerText_en,
    firstOrderDiscountPercent: clampPct(
      cfg?.firstOrderDiscountPercent,
      DEFAULT_LOYALTY_CONFIG.firstOrderDiscountPercent
    ),
    punchCardEnabled: cfg?.punchCardEnabled ?? DEFAULT_LOYALTY_CONFIG.punchCardEnabled,
    punchCardTarget: clampTarget(cfg?.punchCardTarget, DEFAULT_LOYALTY_CONFIG.punchCardTarget),
    punchCardDiscountPercent: clampPct(
      cfg?.punchCardDiscountPercent,
      DEFAULT_LOYALTY_CONFIG.punchCardDiscountPercent
    ),
    punchCardRewardText:
      cfg?.punchCardRewardText?.trim() || DEFAULT_LOYALTY_CONFIG.punchCardRewardText,
    punchCardRewardText_en:
      cfg?.punchCardRewardText_en?.trim() || DEFAULT_LOYALTY_CONFIG.punchCardRewardText_en,
    birthdayOfferText:
      cfg?.birthdayOfferText?.trim() || DEFAULT_LOYALTY_CONFIG.birthdayOfferText,
    birthdayOfferText_en:
      cfg?.birthdayOfferText_en?.trim() || DEFAULT_LOYALTY_CONFIG.birthdayOfferText_en,
    birthdayDiscountPercent: clampPct(
      cfg?.birthdayDiscountPercent,
      DEFAULT_LOYALTY_CONFIG.birthdayDiscountPercent
    ),
    birthdayWhatsappMessage:
      cfg?.birthdayWhatsappMessage?.trim() || DEFAULT_LOYALTY_CONFIG.birthdayWhatsappMessage,
  };
}

export function isInBirthdayWindow(
  birthDay?: number,
  birthMonth?: number,
  now: Date = new Date()
): { active: boolean; isExactToday: boolean } {
  const day = Number(birthDay);
  const month = Number(birthMonth);
  if (!day || !month || month < 1 || month > 12 || day < 1 || day > 31) {
    return { active: false, isExactToday: false };
  }

  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const isExactToday = now.getMonth() + 1 === month && now.getDate() === day;
  if (isExactToday) {
    return { active: true, isExactToday: true };
  }

  const candidateYears = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  for (const yr of candidateYears) {
    const isLeap = (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0;
    const safeDay = month === 2 && day === 29 && !isLeap ? 28 : day;
    const bdayUtc = Date.UTC(yr, month - 1, safeDay);
    const diffDays = Math.abs(todayUtc - bdayUtc) / 86400000;
    if (diffDays <= 3) {
      return { active: true, isExactToday: false };
    }
  }

  return { active: false, isExactToday: false };
}

/**
 * Returns 0..3 when a customer's upcoming birthday is today (0) or within the next 1..3 days.
 * Returns null otherwise. Handles Dec -> Jan year transitions & Feb 29 leap years.
 */
export function getDaysUntilUpcomingBirthday(
  birthDay?: number,
  birthMonth?: number,
  now: Date = new Date()
): number | null {
  const day = Number(birthDay);
  const month = Number(birthMonth);
  if (!day || !month || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  for (const yr of [now.getFullYear(), now.getFullYear() + 1]) {
    const isLeap = (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0;
    const safeDay = month === 2 && day === 29 && !isLeap ? 28 : day;
    const bdayUtc = Date.UTC(yr, month - 1, safeDay);
    const diffDays = Math.round((bdayUtc - todayUtc) / 86400000);
    if (diffDays >= 0 && diffDays <= 3) {
      return diffDays;
    }
  }
  return null;
}

export function parseIsoBirthday(
  isoDate?: string
): { day: number; month: number; year: number } | null {
  const clean = (isoDate || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1920 || year > 2025 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { day, month, year };
}

export function getDaysUntilIsoBirthday(
  isoDate?: string,
  now: Date = new Date()
): number | null {
  const parsed = parseIsoBirthday(isoDate);
  if (!parsed) return null;
  return getDaysUntilUpcomingBirthday(parsed.day, parsed.month, now);
}

export function buildOwnerGiftWhatsappUrl(params: {
  rawPhone: string;
  ownerName: string;
  restaurantName: string;
  daysUntil?: number | null;
  promoCode?: string;
  promoSummary?: string;
  lang: 'ar' | 'en';
}): string {
  const waPhone = formatWhatsappInternationalPhone(params.rawPhone);
  const { ownerName, restaurantName, daysUntil, promoCode, promoSummary, lang } = params;
  const hasPromo = Boolean(promoCode && promoCode.trim());
  const cleanCode = (promoCode || '').trim().toUpperCase();
  const cleanSummary = (promoSummary || '').trim();

  if (lang === 'en') {
    const greeting =
      daysUntil === 0
        ? `Happy Birthday, ${ownerName}! 🎂🎉 Wishing you and "${restaurantName}" endless success.`
        : daysUntil !== null && daysUntil !== undefined && daysUntil <= 3
          ? `Happy early Birthday (${daysUntil} day${daysUntil === 1 ? '' : 's'} away!), ${ownerName}! 🎂🎉 We celebrate "${restaurantName}" with you.`
          : `Hello ${ownerName} 👋 Greetings from the Sufra QR team! Thank you for trusting us with "${restaurantName}".`;
    const giftPart = hasPromo
      ? ` As a special gift from Sufra QR, enjoy code *${cleanCode}*${cleanSummary ? ` (${cleanSummary})` : ''} — activate it right inside your restaurant dashboard!`
      : ` Check your Sufra QR dashboard for our latest platform offers and updates.`;
    return `https://wa.me/${waPhone}?text=${encodeURIComponent(greeting + giftPart)}`;
  }

  const greeting =
    daysUntil === 0
      ? `كل سنة وحضرتك طيب وبألف خير يا أستاذ ${ownerName}! 🎂🎉 أسرة منصة سُفرة QR بتتمنالك ولمطعم "${restaurantName}" مزيد من النجاح والتألق.`
      : daysUntil !== null && daysUntil !== undefined && daysUntil <= 3
        ? `كل سنة وحضرتك طيب مقدماً يا أستاذ ${ownerName}! 🎂🎈 فاضل ${daysUntil === 1 ? 'يوم واحد' : daysUntil === 2 ? 'يومين' : `${daysUntil} أيام`} على عيد ميلادك، وحبّينا نحتفل معاك كشريك نجاح في مطعم "${restaurantName}".`
        : `أهلاً بحضرتك يا أستاذ ${ownerName} 👋 فريق منصة سُفرة QR بيتمنالك دوام التوفيق في إدارة مطعم "${restaurantName}".`;
  const giftPart = hasPromo
    ? ` وبنقدملك كهدية خاصة كود الخصم الحصري: *${cleanCode}*${cleanSummary ? ` (${cleanSummary})` : ''} — تقدر تفعّله مباشرة من لوحة تحكم مطعمك!`
    : ` يسعدنا دايماً متابعة نجاح مطعمك وتقديم كل جديد لرفع مبيعاتك.`;

  return `https://wa.me/${waPhone}?text=${encodeURIComponent(greeting + giftPart)}`;
}

export function getLoyaltyTimestampMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts instanceof Timestamp) return ts.toMillis();
  if (
    typeof ts === 'object' &&
    'seconds' in ts &&
    typeof (ts as { seconds: number }).seconds === 'number'
  ) {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return 0;
}

export function getDaysSinceLastVisit(
  customer: Pick<CustomerProfile, 'lastVisitAt' | 'updatedAt' | 'createdAt'>,
  now: Date = new Date()
): number | null {
  const ms =
    getLoyaltyTimestampMillis(customer.lastVisitAt) ||
    getLoyaltyTimestampMillis(customer.updatedAt) ||
    getLoyaltyTimestampMillis(customer.createdAt);
  if (!ms) return null;
  const diff = Math.floor((now.getTime() - ms) / 86400000);
  return Math.max(0, diff);
}

export function formatLastVisitDate(ts: unknown, lang: 'ar' | 'en'): string {
  const ms = getLoyaltyTimestampMillis(ts);
  if (!ms) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleDateString();
  }
}

export function getCustomerLoyaltyDiscount(
  customer: CustomerProfile | null | undefined,
  config: Required<LoyaltyConfig>
): { percent: number; reason: 'first_order' | 'birthday' | 'punch_card' | null } {
  if (!config.enabled || !customer) {
    return { percent: 0, reason: null };
  }
  const firstPct =
    config.firstOrderEnabled && !customer.firstOrderDiscountUsed
      ? config.firstOrderDiscountPercent
      : 0;
  const bdayWin = isInBirthdayWindow(customer.birthDay, customer.birthMonth);
  const bdayPct = bdayWin.active ? config.birthdayDiscountPercent : 0;
  const punchPct =
    config.punchCardEnabled && (customer.loyaltyCycleOrders || 0) >= config.punchCardTarget
      ? config.punchCardDiscountPercent
      : 0;

  const best = Math.max(firstPct, bdayPct, punchPct);
  if (best <= 0) {
    return { percent: 0, reason: null };
  }
  if (bdayPct === best && bdayPct > 0) {
    return { percent: bdayPct, reason: 'birthday' };
  }
  if (punchPct === best && punchPct > 0) {
    return { percent: punchPct, reason: 'punch_card' };
  }
  return { percent: firstPct, reason: 'first_order' };
}

export function mergeFavoriteItems(
  existing: CustomerFavoriteItem[],
  orderedItems: OrderItemPayload[]
): CustomerFavoriteItem[] {
  const now = Date.now();
  const byId = new Map<string, CustomerFavoriteItem>();

  (existing || []).forEach((fav) => {
    if (fav && fav.menuItemId) {
      byId.set(fav.menuItemId, {
        menuItemId: String(fav.menuItemId).slice(0, 128),
        name: String(fav.name || '').slice(0, 120),
        ...(fav.name_en ? { name_en: String(fav.name_en).slice(0, 120) } : {}),
        count: Math.max(1, Math.round(Number(fav.count) || 1)),
        lastOrderedAt: fav.lastOrderedAt || now,
      });
    }
  });

  (orderedItems || []).forEach((it) => {
    if (!it.menuItemId) return;
    const prev = byId.get(it.menuItemId);
    const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
    if (prev) {
      byId.set(it.menuItemId, {
        ...prev,
        name: it.name ? it.name.slice(0, 120) : prev.name,
        count: prev.count + qty,
        lastOrderedAt: now,
      });
    } else {
      byId.set(it.menuItemId, {
        menuItemId: it.menuItemId.slice(0, 128),
        name: (it.name || '').slice(0, 120),
        count: qty,
        lastOrderedAt: now,
      });
    }
  });

  return Array.from(byId.values())
    .sort((a, b) => b.count - a.count || (b.lastOrderedAt || 0) - (a.lastOrderedAt || 0))
    .slice(0, 20);
}

export function buildLastOrderSnapshot(
  orderedItems: OrderItemPayload[],
  itemMap?: Map<string, MenuItem>
): CustomerLastOrderItem[] {
  return (orderedItems || []).slice(0, 30).map((it) => {
    const live = itemMap?.get(it.menuItemId);
    return {
      menuItemId: it.menuItemId.slice(0, 128),
      name: (live?.name || it.name || '').slice(0, 120),
      ...(live?.name_en ? { name_en: live.name_en.slice(0, 120) } : {}),
      ...(it.sizeName ? { sizeName: it.sizeName.slice(0, 40) } : {}),
      ...(Array.isArray(it.addonNames) && it.addonNames.length > 0
        ? { addonNames: it.addonNames.slice(0, 20).map((a) => String(a).slice(0, 60)) }
        : {}),
      quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
      unitPrice: Number((Number(it.unitPrice) || 0).toFixed(2)),
    };
  });
}

export function formatWhatsappInternationalPhone(rawPhone: string): string {
  let digits = normalizeCustomerPhone(rawPhone);
  if (!digits) return '';
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('01')) {
    return `2${digits}`;
  }
  if (digits.length === 10 && digits.startsWith('05')) {
    return `966${digits.slice(1)}`;
  }
  return digits;
}

export function getTopFavoriteItem(
  customer: Pick<CustomerProfile, 'favoriteItems'>
): CustomerFavoriteItem | null {
  if (!Array.isArray(customer.favoriteItems) || customer.favoriteItems.length === 0) {
    return null;
  }
  return [...customer.favoriteItems].sort(
    (a, b) => b.count - a.count || (b.lastOrderedAt || 0) - (a.lastOrderedAt || 0)
  )[0];
}

export function buildBirthdayWhatsappUrl(
  customer: CustomerProfile,
  restaurantName: string,
  config: Required<LoyaltyConfig>,
  publicMenuUrl: string,
  lang: 'ar' | 'en'
): string {
  const waPhone = formatWhatsappInternationalPhone(customer.phone);
  const offerText =
    lang === 'en'
      ? config.birthdayOfferText_en || `${config.birthdayDiscountPercent}% Birthday Discount`
      : config.birthdayOfferText || `خصم ${config.birthdayDiscountPercent}% بمناسبة عيد الميلاد`;
  const template =
    lang === 'en'
      ? `Happy Birthday {name}! 🎂🎉 Celebrate with us at {restaurant} and enjoy {offer} 🎁 Browse our menu: {url}`
      : config.birthdayWhatsappMessage || DEFAULT_LOYALTY_CONFIG.birthdayWhatsappMessage;

  const text = template
    .replace(/\{name\}/g, customer.fullName)
    .replace(/\{restaurant\}/g, restaurantName)
    .replace(/\{offer\}/g, offerText)
    .replace(/\{url\}/g, publicMenuUrl);

  return `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
}

export function buildMarketingWhatsappUrl(
  customer: CustomerProfile,
  restaurantName: string,
  publicMenuUrl: string,
  lang: 'ar' | 'en'
): string {
  const waPhone = formatWhatsappInternationalPhone(customer.phone);
  const topFav = getTopFavoriteItem(customer);
  const favName = topFav ? (lang === 'en' ? topFav.name_en || topFav.name : topFav.name) : '';

  const text =
    lang === 'en'
      ? favName
        ? `Hello ${customer.fullName} 👋 We miss you at ${restaurantName}! Ready for your favorite ${favName}? Order in 1 tap here: ${publicMenuUrl}`
        : `Hello ${customer.fullName} 👋 We'd love to serve you again at ${restaurantName}! Check out today's specials & rewards: ${publicMenuUrl}`
      : favName
        ? `أهلاً أستاذ ${customer.fullName} 👋 وحشتنا زيارتك في ${restaurantName}! عارفين إنك بتحب (${favName}) جداً 😋 مستعدين لطلبك الجديد النهاردة بخصم ومكافآت الولاء — اطلب بضغطة من هنا: ${publicMenuUrl}`
        : `أهلاً أستاذ ${customer.fullName} 👋 يسعدنا دايماً استقبالك في ${restaurantName}! عروضنا ومكافآت الولاء بانتظارك اليوم — تصفح المنيو: ${publicMenuUrl}`;

  return `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
}

function escapeCsvCell(raw: unknown): string {
  let str = String(raw ?? '').replace(/\r?\n/g, ' ').trim();
  if (/^[=+\-@\t]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCustomersCsv(
  customers: CustomerProfile[],
  restaurantSlug: string,
  punchCardTarget: number,
  lang: 'ar' | 'en'
): void {
  if (typeof window === 'undefined' || customers.length === 0) return;

  const headers =
    lang === 'en'
      ? [
          'Full Name',
          'Phone',
          'Birth Date',
          'Preferred Order Type',
          'Address',
          'Total Orders',
          'Punch Card Progress',
          'Last Visit Date',
          'Top Favorite Dish',
        ]
      : [
          'الاسم الكامل',
          'رقم الهاتف',
          'تاريخ الميلاد',
          'التصنيف المفضل',
          'العنوان',
          'عدد الطلبات',
          'بطاقة الأختام',
          'تاريخ آخر زيارة',
          'أكثر صنف مفضل',
        ];

  const rows = customers.map((c) => {
    const orderTypeLabel =
      c.preferredOrderType === 'delivery'
        ? lang === 'en'
          ? 'Delivery'
          : 'دليفري'
        : c.preferredOrderType === 'pickup'
          ? lang === 'en'
            ? 'Takeaway'
            : 'تيك أواي'
          : lang === 'en'
            ? 'Dine-In'
            : 'صالة';
    const topFav = getTopFavoriteItem(c);
    const favLabel = topFav
      ? `${lang === 'en' ? topFav.name_en || topFav.name : topFav.name} (${topFav.count})`
      : '';
    const lastVisit = formatLastVisitDate(c.lastVisitAt || c.updatedAt || c.createdAt, lang);
    const birthDateStr = `${c.birthDay}/${c.birthMonth}/${c.birthYear}`;

    return [
      escapeCsvCell(c.fullName),
      escapeCsvCell(c.phone),
      escapeCsvCell(birthDateStr),
      escapeCsvCell(orderTypeLabel),
      escapeCsvCell(c.address || ''),
      escapeCsvCell(c.totalOrders || 0),
      escapeCsvCell(`${c.loyaltyCycleOrders || 0}/${punchCardTarget}`),
      escapeCsvCell(lastVisit || ''),
      escapeCsvCell(favLabel),
    ].join(',');
  });

  const csvContent = `\uFEFF${headers.map(escapeCsvCell).join(',')}\n${rows.join('\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `customers-${restaurantSlug || 'crm'}-${dateStamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// LocalStorage session persistence helpers (per restaurant slug)
const PHONE_STORAGE_PREFIX = 'sufra_customer_phone_v1_';
const DEMO_PROFILE_PREFIX = 'sufra_demo_customer_v1_';

export function getSavedCustomerPhone(slug: string): string {
  if (typeof window === 'undefined' || !slug) return '';
  try {
    return normalizeCustomerPhone(window.localStorage.getItem(`${PHONE_STORAGE_PREFIX}${slug}`) || '');
  } catch {
    return '';
  }
}

export function saveCustomerPhone(slug: string, phone: string): void {
  if (typeof window === 'undefined' || !slug) return;
  const clean = normalizeCustomerPhone(phone);
  try {
    if (clean) {
      window.localStorage.setItem(`${PHONE_STORAGE_PREFIX}${slug}`, clean);
    } else {
      window.localStorage.removeItem(`${PHONE_STORAGE_PREFIX}${slug}`);
    }
  } catch {
    // Ignore storage errors
  }
}

export function clearCustomerPhone(slug: string): void {
  saveCustomerPhone(slug, '');
}

export function getDemoCustomerProfile(slug: string, phone: string): CustomerProfile | null {
  if (typeof window === 'undefined' || !slug || !phone) return null;
  try {
    const raw = window.localStorage.getItem(`${DEMO_PROFILE_PREFIX}${slug}_${phone}`);
    if (!raw) return null;
    return JSON.parse(raw) as CustomerProfile;
  } catch {
    return null;
  }
}

export function saveDemoCustomerProfile(slug: string, profile: CustomerProfile): void {
  if (typeof window === 'undefined' || !slug || !profile.phone) return;
  try {
    window.localStorage.setItem(
      `${DEMO_PROFILE_PREFIX}${slug}_${profile.phone}`,
      JSON.stringify(profile)
    );
  } catch {
    // Ignore storage quota errors
  }
}
