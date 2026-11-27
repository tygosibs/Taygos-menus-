export type BusinessActivityType =
  | 'restaurant'
  | 'restaurant_cafe'
  | 'cafe'
  | 'hotel'
  | 'lounge'
  | 'bakery'
  | 'tourist_facility';

export type FacilityPrefix = 'RE' | 'RC' | 'CA' | 'HO' | 'LO' | 'BK' | 'TF';

export interface FacilityActivityMeta {
  type: BusinessActivityType;
  prefix: FacilityPrefix;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

export const FACILITY_ACTIVITY_OPTIONS: FacilityActivityMeta[] = [
  {
    type: 'restaurant',
    prefix: 'RE',
    labelAr: 'مطعم',
    labelEn: 'Restaurant',
    descriptionAr: 'مطاعم الوجبات السريعة، المأكولات، والمطابخ المتخصصة',
    descriptionEn: 'Full-service dining, fast-casual, and specialty kitchens',
  },
  {
    type: 'restaurant_cafe',
    prefix: 'RC',
    labelAr: 'مطعم وكافيه',
    labelEn: 'Restaurant & Cafe',
    descriptionAr: 'منشأة تجمع بين المطبخ الكامل وقسم المشروبات والقهوة',
    descriptionEn: 'Hybrid dining restaurant and coffee bar venue',
  },
  {
    type: 'cafe',
    prefix: 'CA',
    labelAr: 'كافيه',
    labelEn: 'Cafe & Coffee Shop',
    descriptionAr: 'كافيهات القهوة المختصة والمشروبات والحلوى الخفيفة',
    descriptionEn: 'Specialty coffee shops, tea houses, and beverage bars',
  },
  {
    type: 'hotel',
    prefix: 'HO',
    labelAr: 'فندق / منتجع',
    labelEn: 'Hotel / Resort',
    descriptionAr: 'خدمة الغرف ومطاعم الفنادق والمنتجعات السياحية',
    descriptionEn: 'Hotel room service, resorts, and hospitality dining',
  },
  {
    type: 'lounge',
    prefix: 'LO',
    labelAr: 'لاونج',
    labelEn: 'Lounge',
    descriptionAr: 'لاونجات الجلسات والضيافة المسائية والمشروبات',
    descriptionEn: 'Evening lounges, terrace hospitality, and VIP seating',
  },
  {
    type: 'bakery',
    prefix: 'BK',
    labelAr: 'مخبز / حلواني',
    labelEn: 'Bakery & Patisserie',
    descriptionAr: 'المخابز والحلويات الشرقية والغربية والباستري',
    descriptionEn: 'Artisan bakeries, patisseries, and dessert boutiques',
  },
  {
    type: 'tourist_facility',
    prefix: 'TF',
    labelAr: 'منشأة سياحية',
    labelEn: 'Tourist Facility',
    descriptionAr: 'المجمعات الترفيهية، النوادي، والمرافق السياحية',
    descriptionEn: 'Resorts, clubs, food courts, and tourist complexes',
  },
];

const PREFIX_MAP = new Map<FacilityPrefix, FacilityActivityMeta>(
  FACILITY_ACTIVITY_OPTIONS.map((item) => [item.prefix, item])
);

const TYPE_MAP = new Map<BusinessActivityType, FacilityActivityMeta>(
  FACILITY_ACTIVITY_OPTIONS.map((item) => [item.type, item])
);

export const VALID_FACILITY_PREFIXES: FacilityPrefix[] = ['RE', 'RC', 'CA', 'HO', 'LO', 'BK', 'TF'];

export function isValidFacilityPrefix(val?: string | null): val is FacilityPrefix {
  if (!val) return false;
  return VALID_FACILITY_PREFIXES.includes(val.trim().toUpperCase() as FacilityPrefix);
}

export function normalizeFacilityPrefix(
  val?: string | null,
  fallbackType: BusinessActivityType = 'restaurant'
): FacilityPrefix {
  const upper = (val || '').trim().toUpperCase();
  if (isValidFacilityPrefix(upper)) {
    return upper;
  }
  return TYPE_MAP.get(fallbackType)?.prefix || 'RE';
}

export function getFacilityActivityMeta(
  typeOrPrefix?: string | null
): FacilityActivityMeta {
  const clean = (typeOrPrefix || '').trim();
  if (clean) {
    const byType = TYPE_MAP.get(clean.toLowerCase() as BusinessActivityType);
    if (byType) return byType;
    const byPrefix = PREFIX_MAP.get(clean.toUpperCase() as FacilityPrefix);
    if (byPrefix) return byPrefix;
  }
  return FACILITY_ACTIVITY_OPTIONS[0];
}

export function normalizeArabicNumberChars(raw: string): string {
  const ar = '٠١٢٣٤٥٦٧٨٩';
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  return (raw || '')
    .split('')
    .map((ch) => {
      const i1 = ar.indexOf(ch);
      if (i1 !== -1) return String(i1);
      const i2 = fa.indexOf(ch);
      if (i2 !== -1) return String(i2);
      return ch;
    })
    .join('');
}

export function normalizeFacilitySerial(raw?: string | null): string {
  return normalizeArabicNumberChars(raw || '')
    .replace(/[^0-9]/g, '')
    .slice(0, 8);
}

export function formatFacilityCode(prefix: string, serial: string): string {
  const cleanPrefix = normalizeFacilityPrefix(prefix);
  const cleanSerial = normalizeFacilitySerial(serial);
  if (cleanSerial.length < 4) return '';
  return `${cleanPrefix}-${cleanSerial}`;
}

export function parseFacilityCode(raw?: string | null): {
  prefix?: FacilityPrefix;
  serial: string;
  code: string;
} {
  const clean = normalizeArabicNumberChars(raw || '').trim().toUpperCase();
  const match = clean.match(/^(RE|RC|CA|HO|LO|BK|TF)[-\s]?([0-9]{4,8})$/);
  if (match) {
    const prefix = match[1] as FacilityPrefix;
    const serial = match[2];
    return { prefix, serial, code: `${prefix}-${serial}` };
  }
  const justDigits = normalizeFacilitySerial(clean);
  return { serial: justDigits, code: '' };
}
