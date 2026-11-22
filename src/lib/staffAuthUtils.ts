import { StaffRole, StaffScreen } from '../types/menu';
import { screenToStationId, stationIdToScreen, StationMeta } from './stationUtils';

export const STAFF_ROLE_META: Record<
  StaffRole,
  {
    labelAr: string;
    labelEn: string;
    badgeClass: string;
    defaultTitleAr: string;
  }
> = {
  manager: {
    labelAr: 'مدير المطعم',
    labelEn: 'Restaurant Manager',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    defaultTitleAr: 'مدير تشغيل المطعم',
  },
  cashier: {
    labelAr: 'كاشير',
    labelEn: 'Cashier',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    defaultTitleAr: 'كاشير الصالة والطلبات',
  },
  kitchen: {
    labelAr: 'شيف المطبخ',
    labelEn: 'Kitchen Chef',
    badgeClass: 'bg-red-50 text-red-800 border-red-200',
    defaultTitleAr: 'مسؤول شاشة المطبخ (KDS)',
  },
  bar: {
    labelAr: 'باريستا / بار',
    labelEn: 'Bar / Barista',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    defaultTitleAr: 'مسؤول البار والمشروبات',
  },
  pastry: {
    labelAr: 'باستري / حلويات',
    labelEn: 'Pastry',
    badgeClass: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200',
    defaultTitleAr: 'مسؤول الحلويات والباستري',
  },
  captain: {
    labelAr: 'كابتن صالة / ويتر',
    labelEn: 'Captain / Waiter',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    defaultTitleAr: 'كابتن خدمة الصالة',
  },
  station_staff: {
    labelAr: 'موظف محطة تحضير',
    labelEn: 'Station Staff',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    defaultTitleAr: 'مسؤول محطة تحضير (KDS)',
  },
  custom: {
    labelAr: 'مسمى وظيفي مخصص',
    labelEn: 'Custom Role',
    badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-300',
    defaultTitleAr: 'كادر تشغيل مخصص',
  },
};

export interface StaffScreenMeta {
  labelAr: string;
  labelEn: string;
  shortAr: string;
  color?: string;
  managerOnly?: boolean;
  stationId?: string;
}

export const STAFF_SCREEN_META: Record<string, StaffScreenMeta> = {
  staff_management: {
    labelAr: 'إدارة الكادر والصلاحيات',
    labelEn: 'Staff & Permissions',
    shortAr: 'الكادر',
    managerOnly: true,
  },
  cashier: {
    labelAr: 'شاشة الكاشير والطلبات الحية',
    labelEn: 'Cashier & Live Orders',
    shortAr: 'الكاشير',
  },
  kitchen: {
    labelAr: 'شاشة المطبخ (KDS)',
    labelEn: 'Kitchen KDS',
    shortAr: 'المطبخ',
    color: '#EA580C',
    stationId: 'kitchen',
  },
  bar: {
    labelAr: 'شاشة البار والمشروبات (KDS)',
    labelEn: 'Bar KDS',
    shortAr: 'البار',
    color: '#0284C7',
    stationId: 'bar',
  },
  pastry: {
    labelAr: 'شاشة الباستري والحلويات (KDS)',
    labelEn: 'Pastry KDS',
    shortAr: 'الباستري',
    color: '#DB2777',
    stationId: 'pastry',
  },
  captain: {
    labelAr: 'شاشة الكابتن والويتر',
    labelEn: 'Captain & Waiter',
    shortAr: 'الكابتن',
  },
  halls: {
    labelAr: 'إدارة الصالات وباركود الطاولات',
    labelEn: 'Halls & Table QR',
    shortAr: 'الصالات',
    managerOnly: true,
  },
};

export function getScreenMetaDynamic(
  screen: string,
  dynamicStations?: StationMeta[]
): StaffScreenMeta {
  const stationId = screenToStationId(screen);
  if (stationId) {
    const matched = dynamicStations?.find((s) => s.stationId === stationId);
    if (matched) {
      return {
        labelAr: `شاشة ${matched.shortLabel} (KDS)`,
        labelEn: `${matched.shortLabel_en} KDS`,
        shortAr: matched.shortLabel,
        color: matched.color,
        stationId: matched.stationId,
      };
    }
    if (STAFF_SCREEN_META[stationId]) {
      return STAFF_SCREEN_META[stationId];
    }
    return {
      labelAr: `شاشة ${stationId} (KDS)`,
      labelEn: `${stationId} KDS`,
      shortAr: stationId,
      color: '#EA580C',
      stationId,
    };
  }
  return (
    STAFF_SCREEN_META[screen] || {
      labelAr: screen,
      labelEn: screen,
      shortAr: screen,
    }
  );
}

export const MANAGER_ALLOWED_SCREENS: StaffScreen[] = [
  'staff_management',
  'cashier',
  'kitchen',
  'bar',
  'pastry',
  'captain',
  'halls',
];

export const EMPLOYEE_ASSIGNABLE_SCREENS: StaffScreen[] = [
  'cashier',
  'kitchen',
  'bar',
  'pastry',
  'captain',
];

export function getManagerScreensForStations(
  dynamicStations?: StationMeta[],
  includeHalls = true
): StaffScreen[] {
  const stationScreens = (dynamicStations || []).map((st) => stationIdToScreen(st.stationId));
  return Array.from(
    new Set<StaffScreen>([
      'staff_management',
      'cashier',
      ...stationScreens,
      'captain',
      ...(includeHalls ? (['halls'] as StaffScreen[]) : []),
    ])
  );
}

export function getDefaultScreensForRole(
  role: StaffRole,
  dynamicStations?: StationMeta[]
): {
  allowedScreens: StaffScreen[];
  allowedStations: string[];
  defaultScreen: StaffScreen;
} {
  if (role === 'manager') {
    const allowedScreens =
      dynamicStations && dynamicStations.length > 0
        ? getManagerScreensForStations(dynamicStations)
        : [...MANAGER_ALLOWED_SCREENS];
    const allowedStations =
      dynamicStations && dynamicStations.length > 0
        ? dynamicStations.map((s) => s.stationId)
        : ['kitchen', 'bar', 'pastry'];
    return {
      allowedScreens,
      allowedStations,
      defaultScreen: 'staff_management',
    };
  }
  if (role === 'station_staff' || role === 'custom') {
    const firstSt = dynamicStations?.[0]?.stationId || 'kitchen';
    const screen = stationIdToScreen(firstSt);
    return {
      allowedScreens: [screen],
      allowedStations: [firstSt],
      defaultScreen: screen,
    };
  }
  if (role === 'kitchen' || role === 'bar' || role === 'pastry') {
    return {
      allowedScreens: [role],
      allowedStations: [role],
      defaultScreen: role,
    };
  }
  const screen: StaffScreen = role;
  return {
    allowedScreens: [screen],
    allowedStations: [],
    defaultScreen: screen,
  };
}

export function normalizeArabicDigits(raw: string): string {
  const arabicNums = '٠١٢٣٤٥٦٧٨٩';
  const easternNums = '۰۱۲۳۴۵۶۷۸۹';
  return (raw || '')
    .split('')
    .map((ch) => {
      const i1 = arabicNums.indexOf(ch);
      if (i1 !== -1) return String(i1);
      const i2 = easternNums.indexOf(ch);
      if (i2 !== -1) return String(i2);
      return ch;
    })
    .join('');
}

export function sanitizeStaffUsername(raw: string): string {
  return normalizeArabicDigits(raw)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 40);
}

export function normalizeStaffPhone(raw: string): string {
  return normalizeArabicDigits(raw)
    .replace(/[^0-9]/g, '')
    .slice(0, 20);
}

export type LoginIdentifierType = 'email' | 'phone' | 'username';

export function classifyLoginIdentifier(raw: string): {
  type: LoginIdentifierType;
  normalized: string;
} {
  const trimmed = normalizeArabicDigits(raw).trim();
  if (trimmed.includes('@')) {
    return { type: 'email', normalized: trimmed.toLowerCase() };
  }
  const strippedPhone = trimmed.replace(/[\s+()-]/g, '');
  if (/^[0-9]{6,20}$/.test(strippedPhone)) {
    return { type: 'phone', normalized: strippedPhone };
  }
  return {
    type: 'username',
    normalized: sanitizeStaffUsername(trimmed),
  };
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic FNV/Murmur mix only if subtle crypto is absent in test env
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < bytes.length; i += 1) {
    h1 ^= bytes[i];
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= bytes[i] + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function generateSecureInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function deriveInviteBootstrapPassword(
  rawToken: string,
  restaurantId: string
): Promise<string> {
  const digest = await sha256Hex(`sufra-invite-bootstrap::${restaurantId}::${rawToken}`);
  return `Sf#${digest.slice(0, 26)}9!`;
}

export function validateStaffPassword(
  password: string,
  confirmPassword?: string
): { valid: boolean; error?: string } {
  const pw = password || '';
  if (pw.length < 8) {
    return { valid: false, error: 'كلمة المرور يجب أن لا تقل عن 8 أحرف أو أرقام' };
  }
  if (pw.length > 72) {
    return { valid: false, error: 'كلمة المرور طويلة جداً (الحد الأقصى 72 حرفاً)' };
  }

  const lower = pw.toLowerCase();
  const weakList = new Set([
    '12345678',
    '123456789',
    '1234567890',
    '87654321',
    'password',
    'password1',
    'password123',
    'qwertyui',
    'qwerty123',
    'admin123',
    'staff123',
    '11111111',
    '00000000',
  ]);
  if (weakList.has(lower)) {
    return { valid: false, error: 'كلمة المرور ضعيفة وشائعة جداً. اختر كلمة مرور أقوى.' };
  }

  if (/^(.)\1+$/.test(pw)) {
    return { valid: false, error: 'لا يمكن استخدام حرف أو رقم واحد مكرر ككلمة مرور.' };
  }

  const hasLetter = /[a-zA-Z\u0600-\u06FF]/.test(pw);
  const hasDigitOrSymbol = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw);
  if (!hasLetter || !hasDigitOrSymbol) {
    return {
      valid: false,
      error: 'يجب أن تحتوي كلمة المرور على حروف مع أرقام أو رموز لزيادة الأمان.',
    };
  }

  if (confirmPassword !== undefined && pw !== confirmPassword) {
    return { valid: false, error: 'كلمتا المرور غير متطابقتين. تأكد من كتابتهما بنفس الشكل.' };
  }

  return { valid: true };
}

interface LoginLockoutRecord {
  failures: number;
  lockedUntil: number;
}

export function getLoginLockoutState(slug: string, identifierKey: string): {
  isLocked: boolean;
  remainingSeconds: number;
  failures: number;
} {
  if (typeof window === 'undefined') {
    return { isLocked: false, remainingSeconds: 0, failures: 0 };
  }
  try {
    const raw = window.localStorage.getItem(`sufra_staff_lock_${slug}_${identifierKey}`);
    if (!raw) return { isLocked: false, remainingSeconds: 0, failures: 0 };
    const parsed = JSON.parse(raw) as LoginLockoutRecord;
    const now = Date.now();
    if (parsed.lockedUntil && parsed.lockedUntil > now) {
      return {
        isLocked: true,
        remainingSeconds: Math.ceil((parsed.lockedUntil - now) / 1000),
        failures: parsed.failures || 0,
      };
    }
    return { isLocked: false, remainingSeconds: 0, failures: parsed.failures || 0 };
  } catch {
    return { isLocked: false, remainingSeconds: 0, failures: 0 };
  }
}

export function recordLoginFailure(slug: string, identifierKey: string): {
  isLocked: boolean;
  remainingSeconds: number;
  failures: number;
} {
  if (typeof window === 'undefined') {
    return { isLocked: false, remainingSeconds: 0, failures: 1 };
  }
  try {
    const key = `sufra_staff_lock_${slug}_${identifierKey}`;
    const raw = window.localStorage.getItem(key);
    const prev = raw ? (JSON.parse(raw) as LoginLockoutRecord) : { failures: 0, lockedUntil: 0 };
    const nextFailures = (prev.failures || 0) + 1;
    let lockSeconds = 0;
    if (nextFailures >= 5) {
      const extraSteps = nextFailures - 5;
      lockSeconds = Math.min(300, 30 * Math.pow(2, extraSteps));
    }
    const lockedUntil = lockSeconds > 0 ? Date.now() + lockSeconds * 1000 : 0;
    window.localStorage.setItem(
      key,
      JSON.stringify({ failures: nextFailures, lockedUntil })
    );
    return {
      isLocked: lockSeconds > 0,
      remainingSeconds: lockSeconds,
      failures: nextFailures,
    };
  } catch {
    return { isLocked: false, remainingSeconds: 0, failures: 1 };
  }
}

export function resetLoginFailures(slug: string, identifierKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`sufra_staff_lock_${slug}_${identifierKey}`);
  } catch {
    // ignore storage errors
  }
}

export function getSavedStaffScreen(
  restaurantId: string,
  uid: string,
  allowedScreens: StaffScreen[],
  defaultScreen: StaffScreen
): StaffScreen {
  const fallback = allowedScreens.includes(defaultScreen)
    ? defaultScreen
    : allowedScreens[0] || 'cashier';
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = window.localStorage.getItem(`sufra_staff_screen_${restaurantId}_${uid}`) as StaffScreen | null;
    if (saved && allowedScreens.includes(saved)) {
      return saved;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function saveStaffScreen(restaurantId: string, uid: string, screen: StaffScreen): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`sufra_staff_screen_${restaurantId}_${uid}`, screen);
  } catch {
    // ignore storage errors
  }
}
