import {
  EffectiveStaffPermissions,
  HallManagerPermissions,
  JobTitle,
  ManagerPermissions,
  StaffAccess,
  StaffMember,
  StaffPermissionKey,
  StaffRole,
  StaffScreen,
} from '../types/menu';
import { getActiveLang } from '../data/translations';
import { screenToStationId, stationIdToScreen, StationMeta } from './stationUtils';

export const DEFAULT_HALL_MANAGER_PERMISSIONS: HallManagerPermissions = {
  canManageHalls: true,
  canManageHallAssignments: true,
  canMonitorFloorAndCalls: true,
  canAddEditTableOrders: true,
  canApplyInstantDiscount: false,
  canCancelOrders: false,
  canSettleChecks: false,
  showPrices: true,
};

export function getResolvedHallManagerPermissions(
  perms?: Partial<HallManagerPermissions> | null
): HallManagerPermissions {
  if (!perms) return { ...DEFAULT_HALL_MANAGER_PERMISSIONS };
  return {
    canManageHalls: perms.canManageHalls ?? DEFAULT_HALL_MANAGER_PERMISSIONS.canManageHalls,
    canManageHallAssignments:
      perms.canManageHallAssignments ?? DEFAULT_HALL_MANAGER_PERMISSIONS.canManageHallAssignments,
    canMonitorFloorAndCalls:
      perms.canMonitorFloorAndCalls ?? DEFAULT_HALL_MANAGER_PERMISSIONS.canMonitorFloorAndCalls,
    canAddEditTableOrders:
      perms.canAddEditTableOrders ?? DEFAULT_HALL_MANAGER_PERMISSIONS.canAddEditTableOrders,
    canApplyInstantDiscount:
      perms.canApplyInstantDiscount ?? DEFAULT_HALL_MANAGER_PERMISSIONS.canApplyInstantDiscount,
    canCancelOrders: perms.canCancelOrders ?? DEFAULT_HALL_MANAGER_PERMISSIONS.canCancelOrders,
    canSettleChecks: perms.canSettleChecks ?? DEFAULT_HALL_MANAGER_PERMISSIONS.canSettleChecks,
    showPrices: perms.showPrices ?? DEFAULT_HALL_MANAGER_PERMISSIONS.showPrices,
  };
}

export const STAFF_ROLE_META: Record<
  StaffRole,
  {
    labelAr: string;
    labelEn: string;
    badgeClass: string;
    defaultTitleAr: string;
    defaultTitleEn: string;
  }
> = {
  manager: {
    labelAr: 'مدير المطعم',
    labelEn: 'Restaurant Manager',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    defaultTitleAr: 'مدير تشغيل المطعم',
    defaultTitleEn: 'Restaurant Operations Manager',
  },
  hall_manager: {
    labelAr: 'مدير الصالات',
    labelEn: 'Hall Manager',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
    defaultTitleAr: 'مدير الصالات وتوزيع الكباتن',
    defaultTitleEn: 'Dining Hall & Captain Manager',
  },
  cashier: {
    labelAr: 'كاشير',
    labelEn: 'Cashier',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    defaultTitleAr: 'كاشير الصالة والطلبات',
    defaultTitleEn: 'Floor & Orders Cashier',
  },
  kitchen: {
    labelAr: 'شيف المطبخ',
    labelEn: 'Kitchen Chef',
    badgeClass: 'bg-red-50 text-red-800 border-red-200',
    defaultTitleAr: 'مسؤول شاشة المطبخ',
    defaultTitleEn: 'Kitchen KDS Operator',
  },
  bar: {
    labelAr: 'باريستا / بار',
    labelEn: 'Bar / Barista',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    defaultTitleAr: 'مسؤول البار والمشروبات',
    defaultTitleEn: 'Bar & Beverages Operator',
  },
  pastry: {
    labelAr: 'باستري / حلويات',
    labelEn: 'Pastry',
    badgeClass: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200',
    defaultTitleAr: 'مسؤول الحلويات والباستري',
    defaultTitleEn: 'Pastry & Desserts Operator',
  },
  captain: {
    labelAr: 'كابتن صالة',
    labelEn: 'Captain',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    defaultTitleAr: 'كابتن خدمة الصالة',
    defaultTitleEn: 'Floor Service Captain',
  },
  station_staff: {
    labelAr: 'موظف محطة تحضير',
    labelEn: 'Station Staff',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    defaultTitleAr: 'مسؤول محطة تحضير',
    defaultTitleEn: 'Prep Station Operator (KDS)',
  },
  custom: {
    labelAr: 'مسمى وظيفي مخصص',
    labelEn: 'Custom Role',
    badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-300',
    defaultTitleAr: 'كادر تشغيل مخصص',
    defaultTitleEn: 'Custom Operations Role',
  },
};

export interface StaffScreenMeta {
  labelAr: string;
  labelEn: string;
  shortAr: string;
  shortEn: string;
  color?: string;
  managerOnly?: boolean;
  stationId?: string;
}

export const STAFF_SCREEN_META: Record<string, StaffScreenMeta> = {
  staff_management: {
    labelAr: 'إدارة الكادر والصلاحيات',
    labelEn: 'Staff & Permissions',
    shortAr: 'الكادر',
    shortEn: 'Staff',
    managerOnly: true,
  },
  job_titles: {
    labelAr: 'المسميات الوظيفية',
    labelEn: 'Job Titles',
    shortAr: 'المسميات',
    shortEn: 'Job Titles',
    managerOnly: true,
  },
  cashier: {
    labelAr: 'شاشة الكاشير والطلبات الحية',
    labelEn: 'Cashier / POS & Live Orders',
    shortAr: 'الكاشير',
    shortEn: 'Cashier',
  },
  kitchen: {
    labelAr: 'شاشة المطبخ',
    labelEn: 'Kitchen KDS',
    shortAr: 'المطبخ',
    shortEn: 'Kitchen',
    color: '#EA580C',
    stationId: 'kitchen',
  },
  bar: {
    labelAr: 'شاشة البار والمشروبات',
    labelEn: 'Bar KDS',
    shortAr: 'البار',
    shortEn: 'Bar',
    color: '#0284C7',
    stationId: 'bar',
  },
  pastry: {
    labelAr: 'شاشة الباستري والحلويات',
    labelEn: 'Pastry KDS',
    shortAr: 'الباستري',
    shortEn: 'Pastry',
    color: '#DB2777',
    stationId: 'pastry',
  },
  captain: {
    labelAr: 'شاشة الكابتن',
    labelEn: 'Captain',
    shortAr: 'الكابتن',
    shortEn: 'Captain',
  },
  hall_manager: {
    labelAr: 'لوحة مدير الصالات الحية',
    labelEn: 'Hall Manager Floor Console',
    shortAr: 'مدير الصالات',
    shortEn: 'Hall Manager',
  },
  hall_assignments: {
    labelAr: 'توزيع الكباتن على الصالات والطاولات',
    labelEn: 'Captain Assignments',
    shortAr: 'توزيع الكباتن',
    shortEn: 'Captain Assignments',
  },
  halls: {
    labelAr: 'إدارة الصالات وأكواد الطاولات',
    labelEn: 'Halls & Table QR Codes',
    shortAr: 'الصالات',
    shortEn: 'Halls',
    managerOnly: true,
  },
  stations: {
    labelAr: 'الشاشات والمحطات',
    labelEn: 'Screens & Stations',
    shortAr: 'المحطات',
    shortEn: 'Stations',
    managerOnly: true,
  },
  menu_editor: {
    labelAr: 'إدارة المنيو والأصناف',
    labelEn: 'Menu & Items Editor',
    shortAr: 'المنيو',
    shortEn: 'Menu',
    managerOnly: true,
  },
  shift_reports: {
    labelAr: 'تقارير الورديات والخزنة',
    labelEn: 'Shift & Treasury Reports',
    shortAr: 'التقارير',
    shortEn: 'Reports',
    managerOnly: true,
  },
  customers: {
    labelAr: 'عملاء الولاء',
    labelEn: 'Loyalty Customers',
    shortAr: 'العملاء',
    shortEn: 'Customers',
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
        labelAr: `شاشة ${matched.shortLabel}`,
        labelEn: `${matched.shortLabel_en} KDS`,
        shortAr: matched.shortLabel,
        shortEn: matched.shortLabel_en,
        color: matched.color,
        stationId: matched.stationId,
      };
    }
    if (STAFF_SCREEN_META[stationId]) {
      return STAFF_SCREEN_META[stationId];
    }
    return {
      labelAr: `شاشة ${stationId}`,
      labelEn: `${stationId} KDS`,
      shortAr: stationId,
      shortEn: stationId,
      color: '#EA580C',
      stationId,
    };
  }
  return (
    STAFF_SCREEN_META[screen] || {
      labelAr: screen,
      labelEn: screen,
      shortAr: screen,
      shortEn: screen,
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
  'hall_assignments',
  'halls',
];

export const EMPLOYEE_ASSIGNABLE_SCREENS: StaffScreen[] = [
  'cashier',
  'kitchen',
  'bar',
  'pastry',
  'captain',
];

export function getHallManagerScreens(
  perms?: Partial<HallManagerPermissions> | null
): StaffScreen[] {
  const resolved = getResolvedHallManagerPermissions(perms);
  const screens: StaffScreen[] = ['hall_manager'];
  if (resolved.canManageHallAssignments) {
    screens.push('hall_assignments');
  }
  if (resolved.canManageHalls) {
    screens.push('halls');
  }
  // Note: 'captain' in allowedScreens gives active read access to dine-in orders, table_sessions, & service_calls
  if (resolved.canMonitorFloorAndCalls || resolved.canAddEditTableOrders) {
    screens.push('captain');
  }
  return Array.from(new Set(screens));
}

export function getManagerScreensForStations(
  dynamicStations?: StationMeta[],
  includeHalls = true,
  includeHallAssignments = true
): StaffScreen[] {
  const stationScreens = (dynamicStations || []).map((st) => stationIdToScreen(st.stationId));
  return Array.from(
    new Set<StaffScreen>([
      'staff_management',
      'cashier',
      ...stationScreens,
      'captain',
      ...(includeHallAssignments ? (['hall_assignments'] as StaffScreen[]) : []),
      ...(includeHalls ? (['halls'] as StaffScreen[]) : []),
    ])
  );
}

export function getDefaultScreensForRole(
  role: StaffRole,
  dynamicStations?: StationMeta[],
  hallManagerPerms?: Partial<HallManagerPermissions> | null
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
  if (role === 'hall_manager') {
    const allowedScreens = getHallManagerScreens(hallManagerPerms);
    return {
      allowedScreens,
      allowedStations: [],
      defaultScreen: 'hall_manager',
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
  const isEn = getActiveLang() === 'en';
  const pw = password || '';
  if (pw.length < 8) {
    return {
      valid: false,
      error: isEn
        ? 'Password must be at least 8 characters long'
        : 'كلمة المرور يجب أن لا تقل عن 8 أحرف أو أرقام',
    };
  }
  if (pw.length > 72) {
    return {
      valid: false,
      error: isEn
        ? 'Password is too long (maximum 72 characters)'
        : 'كلمة المرور طويلة جداً (الحد الأقصى 72 حرفاً)',
    };
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
    return {
      valid: false,
      error: isEn
        ? 'This password is too weak or common. Please choose a stronger password.'
        : 'كلمة المرور ضعيفة وشائعة جداً. اختر كلمة مرور أقوى.',
    };
  }

  if (/^(.)\1+$/.test(pw)) {
    return {
      valid: false,
      error: isEn
        ? 'Cannot use a single repeated character or digit as a password.'
        : 'لا يمكن استخدام حرف أو رقم واحد مكرر ككلمة مرور.',
    };
  }

  const hasLetter = /[a-zA-Z\u0600-\u06FF]/.test(pw);
  const hasDigitOrSymbol = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw);
  if (!hasLetter || !hasDigitOrSymbol) {
    return {
      valid: false,
      error: isEn
        ? 'Password must include letters combined with numbers or symbols for security.'
        : 'يجب أن تحتوي كلمة المرور على حروف مع أرقام أو رموز لزيادة الأمان.',
    };
  }

  if (confirmPassword !== undefined && pw !== confirmPassword) {
    return {
      valid: false,
      error: isEn
        ? 'Passwords do not match. Please confirm they are identical.'
        : 'كلمتا المرور غير متطابقتين. تأكد من كتابتهما بنفس الشكل.',
    };
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

export const ALL_STAFF_PERMISSION_KEYS: StaffPermissionKey[] = [
  'canViewOrders',
  'canAddEditTableOrders',
  'canEditOpenOrders',
  'canApplyInstantDiscount',
  'canCancelOpenOrders',
  'canSettleChecks',
  'canEditClosedChecks',
  'canUpdatePrepProgress',
  'canManageServiceCalls',
  'canPauseItems',
  'canEditMenu',
  'canManageShifts',
  'canAddDrawerExpenses',
  'canEditDrawerFloat',
  'canViewShiftReports',
  'canManageHalls',
  'canManageHallAssignments',
  'canManageStations',
  'canManageCustomers',
  'canManageStaff',
  'canConfigureOperations',
];

export const EMPTY_STAFF_PERMISSIONS: EffectiveStaffPermissions = {
  canViewOrders: false,
  canAddEditTableOrders: false,
  canEditOpenOrders: false,
  canApplyInstantDiscount: false,
  canCancelOpenOrders: false,
  canSettleChecks: false,
  canEditClosedChecks: false,
  canUpdatePrepProgress: false,
  canManageServiceCalls: false,
  canPauseItems: false,
  canEditMenu: false,
  canManageShifts: false,
  canAddDrawerExpenses: false,
  canEditDrawerFloat: false,
  canViewShiftReports: false,
  canManageHalls: false,
  canManageHallAssignments: false,
  canManageStations: false,
  canManageCustomers: false,
  canManageStaff: false,
  canConfigureOperations: false,
};

export const OWNER_FULL_PERMISSIONS: EffectiveStaffPermissions = {
  canViewOrders: true,
  canAddEditTableOrders: true,
  canEditOpenOrders: true,
  canApplyInstantDiscount: true,
  canCancelOpenOrders: true,
  canSettleChecks: true,
  canEditClosedChecks: true,
  canUpdatePrepProgress: true,
  canManageServiceCalls: true,
  canPauseItems: true,
  canEditMenu: true,
  canManageShifts: true,
  canAddDrawerExpenses: true,
  canEditDrawerFloat: true,
  canViewShiftReports: true,
  canManageHalls: true,
  canManageHallAssignments: true,
  canManageStations: true,
  canManageCustomers: true,
  canManageStaff: true,
  canConfigureOperations: true,
};

export type PermissionGroupId =
  | 'orders'
  | 'floor'
  | 'stations_menu'
  | 'cash_shifts'
  | 'reports_crm'
  | 'admin';

export interface PermissionCatalogItem {
  key: StaffPermissionKey;
  group: PermissionGroupId;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

export const PERMISSION_GROUPS: Array<{
  id: PermissionGroupId;
  titleAr: string;
  titleEn: string;
}> = [
  { id: 'orders', titleAr: 'الطلبات والشيكات', titleEn: 'Orders & Checks' },
  { id: 'floor', titleAr: 'الصالات والنداءات', titleEn: 'Floor, Halls & Calls' },
  { id: 'stations_menu', titleAr: 'محطات التحضير والمنيو', titleEn: 'Prep Stations & Menu' },
  { id: 'cash_shifts', titleAr: 'الورديات والدرج والخزنة', titleEn: 'Shifts, Drawer & Treasury' },
  { id: 'reports_crm', titleAr: 'التقارير والعملاء', titleEn: 'Reports & Customers' },
  { id: 'admin', titleAr: 'الإدارة والكادر والإعدادات', titleEn: 'Staff, Roles & Operations' },
];

export const PERMISSION_CATALOG: PermissionCatalogItem[] = [
  {
    key: 'canViewOrders',
    group: 'orders',
    labelAr: 'عرض الطلبات الحية والأرشيف',
    labelEn: 'View Live & Historical Orders',
    descriptionAr: 'قراءة الطلبات في شاشات التشغيل والتقارير (مطلوب لأي شاشة تتعامل مع الطلبات).',
    descriptionEn: 'Read order records in POS, KDS, Captain, and Reports.',
  },
  {
    key: 'canAddEditTableOrders',
    group: 'orders',
    labelAr: 'إنشاء وتنزيل طلبات جديدة',
    labelEn: 'Create New Orders & Table Tickets',
    descriptionAr: 'فتح طلب جديد للطاولات أو التيك أواي والدليفري من نقطة البيع أو الكابتن.',
    descriptionEn: 'Create dine-in, pickup, or delivery orders from POS or Captain.',
  },
  {
    key: 'canEditOpenOrders',
    group: 'orders',
    labelAr: 'تعديل الطلبات المفتوحة',
    labelEn: 'Edit Open Orders',
    descriptionAr: 'إضافة/حذف أصناف أو تعديل ملاحظات الطلب قبل إقفال الشيك (مع ذكر السبب).',
    descriptionEn: 'Modify items or notes on open orders before settlement (requires reason).',
  },
  {
    key: 'canApplyInstantDiscount',
    group: 'orders',
    labelAr: 'منح خصم فوري',
    labelEn: 'Apply Instant Discount',
    descriptionAr: 'تطبيق خصم فوري بمبلغ أو نسبة على الطلب مع إلزامية كتابة سبب الخصم.',
    descriptionEn: 'Apply manual percentage or fixed discounts (mandatory reason enforced).',
  },
  {
    key: 'canCancelOpenOrders',
    group: 'orders',
    labelAr: 'إلغاء الطلبات المفتوحة',
    labelEn: 'Cancel Open Orders',
    descriptionAr: 'إلغاء طلب مفتوح مع إلزامية توثيق سبب الإلغاء في السجل.',
    descriptionEn: 'Cancel active open orders with mandatory cancellation reason.',
  },
  {
    key: 'canSettleChecks',
    group: 'orders',
    labelAr: 'تقفيل وتحصيل الشيكات',
    labelEn: 'Settle & Close Checks',
    descriptionAr: 'تحصيل المدفوعات كاش/فيزا وإقفال جلسة الطاولة والشيك المفتوح.',
    descriptionEn: 'Collect payment (cash/card/split) and close open table checks.',
  },
  {
    key: 'canEditClosedChecks',
    group: 'orders',
    labelAr: 'تعديل الشيكات المغلقة (ضمن الوردية النشطة)',
    labelEn: 'Edit Closed Checks (Active Shift)',
    descriptionAr: 'مراجعة أو تعديل شيك مغلق طالما ورديته ما زالت نشطة (يُقفل نهائياً بعد غلق الوردية).',
    descriptionEn: 'Modify closed checks while their linked shift remains active.',
  },
  {
    key: 'canManageServiceCalls',
    group: 'floor',
    labelAr: 'استلام وإنهاء نداءات الطاولات',
    labelEn: 'Handle Table Service Calls',
    descriptionAr: 'عرض نداءات الكابتن وطلب الفاتورة وتغيير حالتها إلى تم التعامل.',
    descriptionEn: 'Read, acknowledge, and resolve guest service & check calls.',
  },
  {
    key: 'canManageHalls',
    group: 'floor',
    labelAr: 'إدارة الصالات والطاولات',
    labelEn: 'Manage Dining Halls & Tables',
    descriptionAr: 'إضافة وتعديل وحذف الصالات وترقيم الطاولات وأكواد QR.',
    descriptionEn: 'Create, update, and remove dining halls and table definitions.',
  },
  {
    key: 'canManageHallAssignments',
    group: 'floor',
    labelAr: 'توزيع الكباتن على الطاولات',
    labelEn: 'Assign Captains to Tables',
    descriptionAr: 'تخصيص الصالات والطاولات لكل كابتن في كل فترة وردية.',
    descriptionEn: 'Assign dining halls and tables to Captains per shift slot.',
  },
  {
    key: 'canUpdatePrepProgress',
    group: 'stations_menu',
    labelAr: 'تحديث حالة التحضير (KDS / التقديم)',
    labelEn: 'Update Prep & Serve Status',
    descriptionAr: 'تحديث حالة أصناف المحطة (قيد التحضير / جاهز / تم التقديم).',
    descriptionEn: 'Advance item prep states (preparing / ready / served).',
  },
  {
    key: 'canPauseItems',
    group: 'stations_menu',
    labelAr: 'إيقاف/تفعيل الأصناف مؤقتاً',
    labelEn: 'Pause / Resume Menu Items',
    descriptionAr: 'إيقاف صنف نفد من المطبخ أو إعادة تفعيله فقط دون تعديل الأسعار أو المنيو.',
    descriptionEn: 'Toggle item availability (out-of-stock pause) without editing menu prices.',
  },
  {
    key: 'canEditMenu',
    group: 'stations_menu',
    labelAr: 'تعديل المنيو والأقسام والأسعار',
    labelEn: 'Full Menu & Categories Editor',
    descriptionAr: 'إضافة وتعديل وحذف الأقسام والأصناف والأسعار والإضافات.',
    descriptionEn: 'Create, edit, and delete menu categories, items, sizes, and prices.',
  },
  {
    key: 'canManageStations',
    group: 'stations_menu',
    labelAr: 'إدارة الشاشات ومحطات التحضير',
    labelEn: 'Manage Prep Stations & Captain Screens',
    descriptionAr: 'إنشاء وتعديل وأرشفة محطات التحضير وشاشات الكابتن المخصصة.',
    descriptionEn: 'Create, configure, and archive kitchen prep stations and captain screens.',
  },
  {
    key: 'canManageShifts',
    group: 'cash_shifts',
    labelAr: 'بدء وإنهاء الورديات وتسليم الدرج',
    labelEn: 'Start / Close Shifts & Handover',
    descriptionAr: 'فتح وردية عمل شخصية وتمديدها وإغلاقها وتسليم عهدة نهاية الوردية.',
    descriptionEn: 'Open, extend, close personal shifts, and submit cash handover.',
  },
  {
    key: 'canAddDrawerExpenses',
    group: 'cash_shifts',
    labelAr: 'تسجيل مصروفات الدرج',
    labelEn: 'Record Drawer Expenses',
    descriptionAr: 'صرف وتسجيل مصروفات نقدية من درج الكاشير أثناء الوردية النشطة.',
    descriptionEn: 'Record cash payouts/expenses from the active cashier drawer.',
  },
  {
    key: 'canEditDrawerFloat',
    group: 'cash_shifts',
    labelAr: 'تعديل عهدة الدرج والتحويل للخزنة',
    labelEn: 'Edit Drawer Float & Treasury Transfers',
    descriptionAr: 'تعديل الرصيد الافتتاحي للدرج وتحويل العهدة إلى الخزنة الرئيسية.',
    descriptionEn: 'Adjust shift opening float and transfer custody funds to Owner Safe.',
  },
  {
    key: 'canViewShiftReports',
    group: 'reports_crm',
    labelAr: 'الاطلاع على التقارير وسجل الرقابة',
    labelEn: 'View Shift Reports & Audit Logs',
    descriptionAr: 'عرض تقارير الورديات، مصروفات الدرج، تحويلات الخزنة، وسجل التدقيق.',
    descriptionEn: 'View shift financial reports, expenses, treasury history, and audit trails.',
  },
  {
    key: 'canManageCustomers',
    group: 'reports_crm',
    labelAr: 'إدارة قاعدة عملاء الولاء',
    labelEn: 'Manage Loyalty Customers CRM',
    descriptionAr: 'الاطلاع على بيانات عملاء الولاء وتعديلها أو حذفها.',
    descriptionEn: 'List, update, and manage loyalty customer profiles.',
  },
  {
    key: 'canManageStaff',
    group: 'admin',
    labelAr: 'إدارة الكادر والمسميات الوظيفية',
    labelEn: 'Manage Staff & Job Titles',
    descriptionAr: 'إنشاء/تعديل الموظفين والمسميات الوظيفية (مقيد بسقف صلاحياتك فقط).',
    descriptionEn: 'Create/manage staff and Job Titles (strictly bounded by your own ceiling).',
  },
  {
    key: 'canConfigureOperations',
    group: 'admin',
    labelAr: 'إعدادات التشغيل والورديات والأسعار',
    labelEn: 'Configure Operations Settings',
    descriptionAr: 'تعديل فترات الورديات، ألوان الطاولات، وإظهار الأسعار للشاشات.',
    descriptionEn: 'Configure shift slots, table colors, default float, and display price settings.',
  },
];

export interface JobTitleTemplate {
  id: string;
  baseRoleHint: StaffRole;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  color: string;
  allowedScreens: StaffScreen[];
  allowedStations: string[];
  allowedCaptainScreens: string[];
  defaultScreen: StaffScreen;
  defaultStationId?: string;
  permissions: EffectiveStaffPermissions;
  sortOrder: number;
}

export const DEFAULT_JOB_TITLE_TEMPLATES: JobTitleTemplate[] = [
  {
    id: 'tpl_manager',
    baseRoleHint: 'manager',
    nameAr: 'مدير عام',
    nameEn: 'General Manager',
    descriptionAr: 'إشراف تشغيلي كامل على الطلبات والكادر والمنيو والتقارير.',
    descriptionEn: 'Full operational oversight across orders, staff, menu, and reports.',
    color: '#4F46E5',
    allowedScreens: [
      'staff_management',
      'job_titles',
      'cashier',
      'kitchen',
      'bar',
      'pastry',
      'captain',
      'hall_manager',
      'hall_assignments',
      'halls',
      'stations',
      'menu_editor',
      'shift_reports',
      'customers',
    ],
    allowedStations: ['kitchen', 'bar', 'pastry'],
    allowedCaptainScreens: [],
    defaultScreen: 'staff_management',
    defaultStationId: 'kitchen',
    permissions: {
      ...OWNER_FULL_PERMISSIONS,
      canEditClosedChecks: false,
    },
    sortOrder: 1,
  },
  {
    id: 'tpl_hall_manager',
    baseRoleHint: 'hall_manager',
    nameAr: 'مدير صالات',
    nameEn: 'Hall Manager',
    descriptionAr: 'متابعة خريطة الصالات، توزيع الكباتن، والرد على نداءات الطاولات.',
    descriptionEn: 'Supervise floor map, Captain assignments, and guest service calls.',
    color: '#0D9488',
    allowedScreens: ['hall_manager', 'hall_assignments', 'halls', 'captain'],
    allowedStations: [],
    allowedCaptainScreens: [],
    defaultScreen: 'hall_manager',
    permissions: {
      ...EMPTY_STAFF_PERMISSIONS,
      canViewOrders: true,
      canAddEditTableOrders: true,
      canManageServiceCalls: true,
      canManageShifts: true,
      canManageHalls: true,
      canManageHallAssignments: true,
    },
    sortOrder: 2,
  },
  {
    id: 'tpl_cashier',
    baseRoleHint: 'cashier',
    nameAr: 'كاشير',
    nameEn: 'Cashier',
    descriptionAr: 'نقطة البيع، إنشاء الطلبات، تحصيل الشيكات، ومصروفات الدرج.',
    descriptionEn: 'POS counter, order creation, check settlement, and drawer expenses.',
    color: '#D97706',
    allowedScreens: ['cashier'],
    allowedStations: [],
    allowedCaptainScreens: [],
    defaultScreen: 'cashier',
    permissions: {
      ...EMPTY_STAFF_PERMISSIONS,
      canViewOrders: true,
      canAddEditTableOrders: true,
      canSettleChecks: true,
      canManageServiceCalls: true,
      canManageShifts: true,
      canAddDrawerExpenses: true,
    },
    sortOrder: 3,
  },
  {
    id: 'tpl_captain',
    baseRoleHint: 'captain',
    nameAr: 'كابتن',
    nameEn: 'Captain',
    descriptionAr: 'خدمة الصالة، تنزيل طلبات الطاولات، واستلام نداءات الضيوف.',
    descriptionEn: 'Floor service, table order entry, and handling guest calls.',
    color: '#059669',
    allowedScreens: ['captain'],
    allowedStations: [],
    allowedCaptainScreens: [],
    defaultScreen: 'captain',
    permissions: {
      ...EMPTY_STAFF_PERMISSIONS,
      canViewOrders: true,
      canAddEditTableOrders: true,
      canUpdatePrepProgress: true,
      canManageServiceCalls: true,
      canManageShifts: true,
    },
    sortOrder: 4,
  },
  {
    id: 'tpl_kitchen',
    baseRoleHint: 'kitchen',
    nameAr: 'شيف المطبخ',
    nameEn: 'Kitchen Chef',
    descriptionAr: 'شاشة تحضير المطبخ وتحديث جاهزية الأصناف.',
    descriptionEn: 'Kitchen KDS preparation and item readiness updates.',
    color: '#EA580C',
    allowedScreens: ['kitchen'],
    allowedStations: ['kitchen'],
    allowedCaptainScreens: [],
    defaultScreen: 'kitchen',
    defaultStationId: 'kitchen',
    permissions: {
      ...EMPTY_STAFF_PERMISSIONS,
      canViewOrders: true,
      canUpdatePrepProgress: true,
      canManageShifts: true,
    },
    sortOrder: 5,
  },
  {
    id: 'tpl_bar',
    baseRoleHint: 'bar',
    nameAr: 'باريستا / بار',
    nameEn: 'Bar / Barista',
    descriptionAr: 'شاشة تحضير البار والمشروبات.',
    descriptionEn: 'Bar KDS beverages and drinks preparation.',
    color: '#0284C7',
    allowedScreens: ['bar'],
    allowedStations: ['bar'],
    allowedCaptainScreens: [],
    defaultScreen: 'bar',
    defaultStationId: 'bar',
    permissions: {
      ...EMPTY_STAFF_PERMISSIONS,
      canViewOrders: true,
      canUpdatePrepProgress: true,
      canManageShifts: true,
    },
    sortOrder: 6,
  },
  {
    id: 'tpl_pastry',
    baseRoleHint: 'pastry',
    nameAr: 'باستري / حلويات',
    nameEn: 'Pastry',
    descriptionAr: 'شاشة تحضير الحلويات والمخبوزات.',
    descriptionEn: 'Pastry KDS desserts and bakery preparation.',
    color: '#DB2777',
    allowedScreens: ['pastry'],
    allowedStations: ['pastry'],
    allowedCaptainScreens: [],
    defaultScreen: 'pastry',
    defaultStationId: 'pastry',
    permissions: {
      ...EMPTY_STAFF_PERMISSIONS,
      canViewOrders: true,
      canUpdatePrepProgress: true,
      canManageShifts: true,
    },
    sortOrder: 7,
  },
];

export function sanitizeEffectivePermissions(
  raw?: Partial<EffectiveStaffPermissions> | null
): EffectiveStaffPermissions {
  const out = { ...EMPTY_STAFF_PERMISSIONS };
  if (!raw || typeof raw !== 'object') return out;
  for (const key of ALL_STAFF_PERMISSION_KEYS) {
    out[key] = raw[key] === true;
  }
  return out;
}

export function resolveLegacyPermissions(params: {
  role: StaffRole;
  allowedScreens?: StaffScreen[];
  allowedStations?: string[];
  managerPermissions?: Partial<ManagerPermissions> | null;
  hallManagerPermissions?: Partial<HallManagerPermissions> | null;
}): EffectiveStaffPermissions {
  const { role, allowedScreens = [], allowedStations = [], managerPermissions, hallManagerPermissions } = params;
  if (role === 'manager') {
    const mp = managerPermissions || {};
    return {
      canViewOrders: true,
      canAddEditTableOrders: true,
      canEditOpenOrders: mp.canEditOpenOrders !== false,
      canApplyInstantDiscount: mp.canApplyInstantDiscount !== false,
      canCancelOpenOrders: mp.canCancelOpenOrders !== false,
      canSettleChecks: true,
      canEditClosedChecks: mp.canEditClosedChecks === true,
      canUpdatePrepProgress: true,
      canManageServiceCalls: true,
      canPauseItems: mp.canPauseItems !== false,
      canEditMenu: mp.canEditMenu !== false,
      canManageShifts: true,
      canAddDrawerExpenses: true,
      canEditDrawerFloat: mp.canEditDrawerFloat !== false,
      canViewShiftReports: mp.canViewShiftReports !== false,
      canManageHalls: mp.canManageHalls !== false,
      canManageHallAssignments: mp.canManageHallAssignments !== false,
      canManageStations: mp.canManageStations !== false,
      canManageCustomers: true,
      canManageStaff: mp.canManageStaff !== false,
      canConfigureOperations: mp.canConfigureOperations !== false,
    };
  }

  if (role === 'hall_manager') {
    const hm = getResolvedHallManagerPermissions(hallManagerPermissions);
    return {
      ...EMPTY_STAFF_PERMISSIONS,
      canViewOrders: hm.canMonitorFloorAndCalls || hm.canAddEditTableOrders || hm.canApplyInstantDiscount || hm.canCancelOrders || hm.canSettleChecks,
      canAddEditTableOrders: hm.canAddEditTableOrders,
      canEditOpenOrders: hm.canAddEditTableOrders,
      canApplyInstantDiscount: hm.canApplyInstantDiscount,
      canCancelOpenOrders: hm.canCancelOrders,
      canSettleChecks: hm.canSettleChecks,
      canUpdatePrepProgress: hm.canMonitorFloorAndCalls || hm.canAddEditTableOrders,
      canManageServiceCalls: hm.canMonitorFloorAndCalls,
      canManageShifts: true,
      canManageHalls: hm.canManageHalls,
      canManageHallAssignments: hm.canManageHallAssignments,
    };
  }

  const hasCashier = role === 'cashier' || allowedScreens.includes('cashier');
  const hasCaptain = role === 'captain' || allowedScreens.includes('captain');
  const hasStation =
    role === 'kitchen' ||
    role === 'bar' ||
    role === 'pastry' ||
    role === 'station_staff' ||
    allowedStations.length > 0 ||
    allowedScreens.some((s) => screenToStationId(s) !== null);

  return {
    ...EMPTY_STAFF_PERMISSIONS,
    canViewOrders: hasCashier || hasCaptain || hasStation,
    canAddEditTableOrders: hasCashier || hasCaptain,
    canSettleChecks: hasCashier,
    canUpdatePrepProgress: hasCashier || hasCaptain || hasStation,
    canManageServiceCalls: hasCashier || hasCaptain,
    canManageShifts: hasCashier || hasCaptain || hasStation,
    canAddDrawerExpenses: hasCashier,
  };
}

export function resolveEffectiveStaffPermissions(
  staff?: Partial<Pick<StaffMember, 'role' | 'allowedScreens' | 'allowedStations' | 'hallManagerPermissions' | 'effectivePermissions' | 'permissionOverrides' | 'revokedPermissions'>> | Partial<Pick<StaffAccess, 'role' | 'allowedScreens' | 'allowedStations' | 'hallManagerPermissions' | 'effectivePermissions'>> | null,
  managerPermissions?: Partial<ManagerPermissions> | null
): EffectiveStaffPermissions {
  if (!staff) return { ...EMPTY_STAFF_PERMISSIONS };

  const base: EffectiveStaffPermissions = staff.effectivePermissions
    ? sanitizeEffectivePermissions(staff.effectivePermissions)
    : resolveLegacyPermissions({
        role: staff.role || 'custom',
        allowedScreens: staff.allowedScreens || [],
        allowedStations: staff.allowedStations || [],
        managerPermissions,
        hallManagerPermissions: staff.hallManagerPermissions,
      });

  const result = { ...base };
  const overrides = 'permissionOverrides' in staff ? staff.permissionOverrides : undefined;
  if (overrides && typeof overrides === 'object') {
    for (const key of ALL_STAFF_PERMISSION_KEYS) {
      if (typeof overrides[key] === 'boolean') {
        result[key] = overrides[key] as boolean;
      }
    }
  }
  const revoked = 'revokedPermissions' in staff ? staff.revokedPermissions : undefined;
  if (Array.isArray(revoked)) {
    for (const key of revoked) {
      if (key in result) {
        result[key] = false;
      }
    }
  }
  return result;
}

export function resolveEffectiveAllowedScreens(
  staff?: Partial<Pick<StaffMember, 'role' | 'allowedScreens' | 'allowedStations' | 'screenOverrides' | 'revokedScreens' | 'hallManagerPermissions'>> | null
): StaffScreen[] {
  if (!staff) return [];
  const baseScreens = new Set<StaffScreen>(staff.allowedScreens || []);
  (staff.allowedStations || []).forEach((st) => {
    const clean = st.trim();
    if (clean) baseScreens.add(stationIdToScreen(clean));
  });
  (staff.screenOverrides || []).forEach((s) => baseScreens.add(s));
  (staff.revokedScreens || []).forEach((s) => baseScreens.delete(s));
  return Array.from(baseScreens);
}

export function computeCombinedJobTitleGrant(params: {
  selectedJobTitles: JobTitle[];
  permissionOverrides?: Partial<EffectiveStaffPermissions>;
  revokedPermissions?: StaffPermissionKey[];
  screenOverrides?: StaffScreen[];
  revokedScreens?: StaffScreen[];
  extraStations?: string[];
  extraCaptainScreens?: string[];
  preferredDefaultScreen?: StaffScreen;
  preferredDefaultStationId?: string;
  ceiling?: {
    isUnbounded: boolean;
    permissions: EffectiveStaffPermissions;
    allowedScreens: StaffScreen[];
    allowedStations: string[];
    allowedCaptainScreens: string[];
  };
}): {
  role: StaffRole;
  jobTitleIds: string[];
  jobTitleNames: string[];
  jobTitleDisplay: string;
  effectivePermissions: EffectiveStaffPermissions;
  allowedScreens: StaffScreen[];
  allowedStations: string[];
  allowedCaptainScreens: string[];
  defaultScreen: StaffScreen;
  defaultStationId: string;
  hallManagerPermissions?: HallManagerPermissions;
} {
  const {
    selectedJobTitles,
    permissionOverrides,
    revokedPermissions = [],
    screenOverrides = [],
    revokedScreens = [],
    extraStations = [],
    extraCaptainScreens = [],
    preferredDefaultScreen,
    preferredDefaultStationId,
    ceiling,
  } = params;

  const isEn = getActiveLang() === 'en';
  const combinedPerms: EffectiveStaffPermissions = { ...EMPTY_STAFF_PERMISSIONS };
  const screenSet = new Set<StaffScreen>();
  const stationSet = new Set<string>();
  const captainScreenSet = new Set<string>();

  selectedJobTitles.forEach((jt) => {
    for (const key of ALL_STAFF_PERMISSION_KEYS) {
      if (jt.permissions?.[key] === true) {
        combinedPerms[key] = true;
      }
    }
    (jt.allowedScreens || []).forEach((scr) => screenSet.add(scr));
    (jt.allowedStations || []).forEach((st) => {
      if (st) {
        stationSet.add(st);
        screenSet.add(stationIdToScreen(st));
      }
    });
    (jt.allowedCaptainScreens || []).forEach((cs) => {
      if (cs) captainScreenSet.add(cs);
    });
  });

  if (permissionOverrides) {
    for (const key of ALL_STAFF_PERMISSION_KEYS) {
      if (typeof permissionOverrides[key] === 'boolean') {
        combinedPerms[key] = permissionOverrides[key] as boolean;
      }
    }
  }
  revokedPermissions.forEach((key) => {
    if (key in combinedPerms) {
      combinedPerms[key] = false;
    }
  });

  screenOverrides.forEach((scr) => screenSet.add(scr));
  extraStations.forEach((st) => {
    if (st) {
      stationSet.add(st);
      screenSet.add(stationIdToScreen(st));
    }
  });
  extraCaptainScreens.forEach((cs) => {
    if (cs) captainScreenSet.add(cs);
  });

  revokedScreens.forEach((scr) => {
    screenSet.delete(scr);
    const st = screenToStationId(scr);
    if (st) stationSet.delete(st);
  });

  if (captainScreenSet.size > 0 && !revokedScreens.includes('captain')) {
    screenSet.add('captain');
  }

  // Enforce Delegation Ceiling if caller is not Owner / SuperAdmin
  if (ceiling && !ceiling.isUnbounded) {
    for (const key of ALL_STAFF_PERMISSION_KEYS) {
      if (!ceiling.permissions[key]) {
        combinedPerms[key] = false;
      }
    }
    const allowedScreenCeiling = new Set(ceiling.allowedScreens);
    Array.from(screenSet).forEach((scr) => {
      const st = screenToStationId(scr);
      const stationAllowed = st ? ceiling.allowedStations.includes(st) || allowedScreenCeiling.has(scr) : false;
      if (!allowedScreenCeiling.has(scr) && !stationAllowed) {
        screenSet.delete(scr);
      }
    });
    const allowedStationCeiling = new Set(ceiling.allowedStations);
    Array.from(stationSet).forEach((st) => {
      if (!allowedStationCeiling.has(st) && !allowedScreenCeiling.has(stationIdToScreen(st))) {
        stationSet.delete(st);
      }
    });
    const allowedCapCeiling = new Set(ceiling.allowedCaptainScreens);
    if (allowedCapCeiling.size > 0) {
      Array.from(captainScreenSet).forEach((cs) => {
        if (!allowedCapCeiling.has(cs)) {
          captainScreenSet.delete(cs);
        }
      });
    }
  }

  const allowedScreens = Array.from(screenSet).slice(0, 30);
  const allowedStations = Array.from(stationSet).slice(0, 30);
  const allowedCaptainScreens = Array.from(captainScreenSet).slice(0, 30);

  const defaultScreen: StaffScreen =
    preferredDefaultScreen && allowedScreens.includes(preferredDefaultScreen)
      ? preferredDefaultScreen
      : selectedJobTitles[0]?.defaultScreen && allowedScreens.includes(selectedJobTitles[0].defaultScreen)
        ? selectedJobTitles[0].defaultScreen
        : allowedScreens[0] || 'cashier';

  const defaultStationId =
    preferredDefaultStationId && allowedStations.includes(preferredDefaultStationId)
      ? preferredDefaultStationId
      : screenToStationId(defaultScreen) || allowedStations[0] || '';

  const singleHint =
    selectedJobTitles.length === 1 ? selectedJobTitles[0].baseRoleHint : undefined;
  const isCeilingRestricted = Boolean(ceiling && !ceiling.isUnbounded);
  const derivedRole: StaffRole =
    singleHint || (selectedJobTitles.length > 1 ? 'custom' : combinedPerms.canManageStaff ? 'manager' : 'custom');
  const role: StaffRole =
    isCeilingRestricted && derivedRole === 'manager' ? 'custom' : derivedRole;

  const hallManagerPermissions: HallManagerPermissions | undefined =
    role === 'hall_manager' || allowedScreens.includes('hall_manager')
      ? {
          canManageHalls: combinedPerms.canManageHalls,
          canManageHallAssignments: combinedPerms.canManageHallAssignments,
          canMonitorFloorAndCalls: combinedPerms.canManageServiceCalls || combinedPerms.canViewOrders,
          canAddEditTableOrders: combinedPerms.canAddEditTableOrders,
          canApplyInstantDiscount: combinedPerms.canApplyInstantDiscount,
          canCancelOrders: combinedPerms.canCancelOpenOrders,
          canSettleChecks: combinedPerms.canSettleChecks,
          showPrices: true,
        }
      : undefined;

  const jobTitleIds = selectedJobTitles.map((t) => t.id);
  const jobTitleNames = selectedJobTitles.map((t) => (isEn ? t.nameEn || t.nameAr : t.nameAr));
  const jobTitleDisplay = jobTitleNames.join(' + ').slice(0, 80);

  return {
    role,
    jobTitleIds,
    jobTitleNames,
    jobTitleDisplay,
    effectivePermissions: combinedPerms,
    allowedScreens,
    allowedStations,
    allowedCaptainScreens,
    defaultScreen,
    defaultStationId,
    hallManagerPermissions,
  };
}

export function clampPermissionsToCeiling(
  target: EffectiveStaffPermissions,
  ceiling: EffectiveStaffPermissions
): EffectiveStaffPermissions {
  const out = { ...EMPTY_STAFF_PERMISSIONS };
  for (const key of ALL_STAFF_PERMISSION_KEYS) {
    out[key] = target[key] === true && ceiling[key] === true;
  }
  return out;
}

export function actorCoversTargetGrant(params: {
  actorIsUnbounded: boolean;
  actorPermissions: EffectiveStaffPermissions;
  actorScreens: StaffScreen[];
  actorStations: string[];
  targetPermissions: EffectiveStaffPermissions;
  targetScreens: StaffScreen[];
  targetStations: string[];
}): { allowed: boolean; missingPermissions: StaffPermissionKey[]; missingScreens: StaffScreen[] } {
  if (params.actorIsUnbounded) {
    return { allowed: true, missingPermissions: [], missingScreens: [] };
  }
  const missingPermissions = ALL_STAFF_PERMISSION_KEYS.filter(
    (k) => params.targetPermissions[k] === true && params.actorPermissions[k] !== true
  );
  const actorScreenSet = new Set(params.actorScreens);
  const actorStationSet = new Set(params.actorStations);
  const missingScreens = params.targetScreens.filter((scr) => {
    const st = screenToStationId(scr);
    if (st && (actorStationSet.has(st) || actorScreenSet.has(scr))) return false;
    return !actorScreenSet.has(scr);
  });
  return {
    allowed: missingPermissions.length === 0 && missingScreens.length === 0,
    missingPermissions,
    missingScreens,
  };
}
