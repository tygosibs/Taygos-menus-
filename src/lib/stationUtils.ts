import {
  BellRing,
  ChefHat,
  Coffee,
  Croissant,
  CupSoda,
  Fish,
  Flame,
  Pizza,
  Salad,
  Sparkles,
  UserCheck,
  Utensils,
  Wind,
  Wine,
} from 'lucide-react';
import {
  CaptainTableVisibilityScope,
  Category,
  KdsStatusButtonOption,
  MenuItem,
  OrderItemPayload,
  OrderType,
  RestaurantStation,
  StaffMember,
  StaffScreen,
  StationIconName,
  StationScreenType,
  ThermalPrintMode,
} from '../types/menu';

export interface StationMeta {
  id: string;
  stationId: string;
  label: string;
  label_en: string;
  shortLabel: string;
  shortLabel_en: string;
  color: string;
  icon: StationIconName;
  badgeClass: string;
  screenType: StationScreenType;
  isActive: boolean;
  isArchived: boolean;
  isDefaultFallback: boolean;
  showPrices: boolean;
  allowedOrderTypes: OrderType[];
  soundAlertEnabled: boolean;
  overdueAlertMinutes: number;
  thermalPrintMode: ThermalPrintMode;
  availableStatusButtons: KdsStatusButtonOption[];
  assignedHallIds: string[];
  assignedTableNumbers: string[];
  tableVisibilityScope: CaptainTableVisibilityScope;
  sortOrder: number;
}

export interface StationTemplate {
  suggestedId: string;
  name: string;
  nameEn: string;
  color: string;
  icon: StationIconName;
}

export const STATION_ICON_OPTIONS: Array<{
  id: StationIconName;
  labelAr: string;
  labelEn: string;
}> = [
  { id: 'chef-hat', labelAr: 'قبعة شيف (مطبخ)', labelEn: 'Chef Hat' },
  { id: 'flame', labelAr: 'نار / مشويات', labelEn: 'Grill / Flame' },
  { id: 'wine', labelAr: 'مشروبات / بار', labelEn: 'Bar / Drinks' },
  { id: 'croissant', labelAr: 'حلويات / باستري / مخبز', labelEn: 'Pastry / Bakery' },
  { id: 'coffee', labelAr: 'قهوة مختصة', labelEn: 'Coffee' },
  { id: 'pizza', labelAr: 'بيتزا وفرن', labelEn: 'Pizza / Oven' },
  { id: 'fish', labelAr: 'سوشي / مأكولات بحرية', labelEn: 'Sushi / Seafood' },
  { id: 'salad', labelAr: 'سلطات ومقبلات', labelEn: 'Salads' },
  { id: 'cup-soda', labelAr: 'عصائر فريش', labelEn: 'Juices' },
  { id: 'wind', labelAr: 'شيشة / لاونج', labelEn: 'Shisha / Lounge' },
  { id: 'utensils', labelAr: 'شاورما / سريع', labelEn: 'Shawarma / Fast' },
  { id: 'sparkles', labelAr: 'قسم خاص مميز', labelEn: 'Custom / VIP' },
  { id: 'user-check', labelAr: 'كابتن صالة / ويتر', labelEn: 'Captain / Waiter' },
  { id: 'bell-ring', labelAr: 'استقبال نداءات الصالة', labelEn: 'Service Desk' },
];

export const STATION_COLOR_PRESETS: string[] = [
  '#EA580C', // Orange (Kitchen)
  '#DC2626', // Crimson (Grill)
  '#0284C7', // Sky (Bar)
  '#DB2777', // Pink (Pastry)
  '#78350F', // Espresso (Coffee)
  '#059669', // Emerald (Salads)
  '#D97706', // Amber (Pizza/Bakery)
  '#7C3AED', // Violet (Shisha/Lounge)
  '#0D9488', // Teal (Sushi/Seafood)
  '#2563EB', // Blue (Juices)
];

/**
 * Starter templates shown ONLY as convenience presets when creating stations
 * — never hardcoded limits on station IDs or count.
 */
export const STATION_TEMPLATES: StationTemplate[] = [
  { suggestedId: 'kitchen', name: 'المطبخ', nameEn: 'Kitchen', color: '#EA580C', icon: 'chef-hat' },
  { suggestedId: 'sub_kitchen', name: 'مطبخ فرعي', nameEn: 'Sub-Kitchen', color: '#C2410C', icon: 'chef-hat' },
  { suggestedId: 'bakery', name: 'المخبز', nameEn: 'Bakery', color: '#B45309', icon: 'croissant' },
  { suggestedId: 'grill', name: 'المشويات', nameEn: 'Grill', color: '#DC2626', icon: 'flame' },
  { suggestedId: 'bar', name: 'البار', nameEn: 'Bar', color: '#0284C7', icon: 'wine' },
  { suggestedId: 'pastry', name: 'الباستري', nameEn: 'Pastry', color: '#DB2777', icon: 'croissant' },
  { suggestedId: 'coffee', name: 'القهوة', nameEn: 'Coffee', color: '#78350F', icon: 'coffee' },
  { suggestedId: 'pizza', name: 'البيتزا', nameEn: 'Pizza', color: '#D97706', icon: 'pizza' },
  { suggestedId: 'shawarma', name: 'الشاورما', nameEn: 'Shawarma', color: '#B45309', icon: 'utensils' },
  { suggestedId: 'sushi', name: 'السوشي', nameEn: 'Sushi', color: '#0D9488', icon: 'fish' },
  { suggestedId: 'salads', name: 'السلطات', nameEn: 'Salads', color: '#059669', icon: 'salad' },
  { suggestedId: 'juices', name: 'العصائر', nameEn: 'Juices', color: '#2563EB', icon: 'cup-soda' },
  { suggestedId: 'shisha', name: 'الشيشة', nameEn: 'Shisha', color: '#7C3AED', icon: 'wind' },
];

export const DEFAULT_SEED_STATIONS: StationTemplate[] = [
  STATION_TEMPLATES[0], // المطبخ (kitchen)
  STATION_TEMPLATES[4], // البار (bar)
  STATION_TEMPLATES[5], // الباستري (pastry)
];

export const DEFAULT_ALLOWED_ORDER_TYPES: OrderType[] = ['dine_in', 'pickup', 'delivery'];
export const DEFAULT_STATUS_BUTTONS: KdsStatusButtonOption[] = ['preparing', 'ready', 'served'];

export function getStationIconComponent(icon?: StationIconName | string) {
  switch (icon) {
    case 'flame':
      return Flame;
    case 'wine':
      return Wine;
    case 'croissant':
      return Croissant;
    case 'coffee':
      return Coffee;
    case 'fish':
      return Fish;
    case 'pizza':
      return Pizza;
    case 'salad':
      return Salad;
    case 'cup-soda':
      return CupSoda;
    case 'wind':
      return Wind;
    case 'utensils':
      return Utensils;
    case 'sparkles':
      return Sparkles;
    case 'user-check':
      return UserCheck;
    case 'bell-ring':
      return BellRing;
    case 'chef-hat':
    default:
      return ChefHat;
  }
}

export const STATION_LIST: StationMeta[] = DEFAULT_SEED_STATIONS.map((tpl, idx) => ({
  id: tpl.suggestedId,
  stationId: tpl.suggestedId,
  label: `${tpl.name} (${tpl.nameEn})`,
  label_en: tpl.nameEn,
  shortLabel: tpl.name,
  shortLabel_en: tpl.nameEn,
  color: tpl.color,
  icon: tpl.icon,
  badgeClass:
    tpl.suggestedId === 'bar'
      ? 'bg-sky-50 text-sky-800 border-sky-200'
      : tpl.suggestedId === 'pastry'
        ? 'bg-rose-50 text-rose-800 border-rose-200'
        : 'bg-orange-50 text-orange-800 border-orange-200',
  screenType: 'prep',
  isActive: true,
  isArchived: false,
  isDefaultFallback: tpl.suggestedId === 'kitchen',
  showPrices: false,
  allowedOrderTypes: [...DEFAULT_ALLOWED_ORDER_TYPES],
  soundAlertEnabled: true,
  overdueAlertMinutes: 15,
  thermalPrintMode: 'manual',
  availableStatusButtons: [...DEFAULT_STATUS_BUTTONS],
  assignedHallIds: [],
  assignedTableNumbers: [],
  tableVisibilityScope: 'all',
  sortOrder: idx + 1,
}));

export const STATION_META_MAP: Record<string, StationMeta> = Object.fromEntries(
  STATION_LIST.map((s) => [s.stationId, s])
);

export function stationIdToScreen(stationId: string): StaffScreen {
  const clean = cleanStationId(stationId);
  if (clean === 'kitchen' || clean === 'bar' || clean === 'pastry') {
    return clean;
  }
  return `station:${clean}`;
}

export function screenToStationId(screen: string): string | null {
  if (!screen) return null;
  if (screen.startsWith('station:')) {
    const id = cleanStationId(screen.slice('station:'.length));
    return id || null;
  }
  if (screen === 'kitchen' || screen === 'bar' || screen === 'pastry') {
    return screen;
  }
  return null;
}

export function isPrepScreen(screen: string): boolean {
  return screenToStationId(screen) !== null;
}

export function cleanStationId(raw?: string | null): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

export function cleanStationIdList(list?: Array<string | null | undefined> | null): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  list.forEach((raw) => {
    const c = cleanStationId(raw);
    if (c && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  });
  return out.slice(0, 20);
}

export function getStationTopicName(restaurantId: string, stationId: string): string {
  const cleanRest = cleanStationId(restaurantId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanSt = cleanStationId(stationId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `restaurant_${cleanRest}_station_${cleanSt}`;
}

function mapRestaurantStationToMeta(st: RestaurantStation): StationMeta {
  const id = cleanStationId(st.stationId || st.id) || 'kitchen';
  const nameAr = (st.name || '').trim() || id;
  const nameEn = (st.nameEn || '').trim() || nameAr;
  const screenType: StationScreenType = st.screenType === 'captain' ? 'captain' : 'prep';
  const allowedOrderTypes =
    Array.isArray(st.allowedOrderTypes) && st.allowedOrderTypes.length > 0
      ? st.allowedOrderTypes.filter((t): t is OrderType => t === 'dine_in' || t === 'pickup' || t === 'delivery')
      : [...DEFAULT_ALLOWED_ORDER_TYPES];
  const availableStatusButtons =
    Array.isArray(st.availableStatusButtons) && st.availableStatusButtons.length > 0
      ? st.availableStatusButtons.filter(
          (b): b is KdsStatusButtonOption => b === 'preparing' || b === 'ready' || b === 'served'
        )
      : [...DEFAULT_STATUS_BUTTONS];

  return {
    id,
    stationId: id,
    label: nameEn && nameEn !== nameAr ? `${nameAr} (${nameEn})` : nameAr,
    label_en: nameEn,
    shortLabel: nameAr,
    shortLabel_en: nameEn,
    color: st.color || (screenType === 'captain' ? '#0D9488' : '#EA580C'),
    icon: st.icon || (screenType === 'captain' ? 'user-check' : 'chef-hat'),
    badgeClass: 'bg-zinc-50 text-zinc-900 border-zinc-200',
    screenType,
    isActive: st.isActive !== false,
    isArchived: st.isArchived === true,
    isDefaultFallback: st.isDefaultFallback === true,
    showPrices: st.showPrices === true,
    allowedOrderTypes: allowedOrderTypes.length > 0 ? allowedOrderTypes : [...DEFAULT_ALLOWED_ORDER_TYPES],
    soundAlertEnabled: st.soundAlertEnabled !== false,
    overdueAlertMinutes:
      typeof st.overdueAlertMinutes === 'number' && st.overdueAlertMinutes >= 1
        ? Math.min(240, Math.round(st.overdueAlertMinutes))
        : 15,
    thermalPrintMode:
      st.thermalPrintMode === 'auto' || st.thermalPrintMode === 'off' ? st.thermalPrintMode : 'manual',
    availableStatusButtons:
      availableStatusButtons.length > 0 ? availableStatusButtons : [...DEFAULT_STATUS_BUTTONS],
    assignedHallIds: Array.isArray(st.assignedHallIds) ? st.assignedHallIds.filter(Boolean) : [],
    assignedTableNumbers: Array.isArray(st.assignedTableNumbers)
      ? st.assignedTableNumbers.map((t) => String(t).trim()).filter(Boolean)
      : [],
    tableVisibilityScope: st.tableVisibilityScope === 'assigned_only' ? 'assigned_only' : 'all',
    sortOrder: st.sortOrder ?? 1,
  };
}

export function buildEffectiveStations(
  dynamicStations: RestaurantStation[],
  includeInactive = false
): StationMeta[] {
  const prepDynamic = dynamicStations.filter((st) => st.screenType !== 'captain');
  const source: RestaurantStation[] =
    prepDynamic.length > 0
      ? prepDynamic
      : DEFAULT_SEED_STATIONS.map((tpl, idx) => ({
          id: tpl.suggestedId,
          stationId: tpl.suggestedId,
          restaurantId: '',
          ownerId: '',
          name: tpl.name,
          nameEn: tpl.nameEn,
          color: tpl.color,
          icon: tpl.icon,
          screenType: 'prep' as const,
          isActive: true,
          isArchived: false,
          isDefaultFallback: idx === 0,
          sortOrder: idx + 1,
        }));

  return source
    .filter((st) => includeInactive || (st.isActive !== false && st.isArchived !== true))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
    .map(mapRestaurantStationToMeta);
}

export function buildEffectiveCaptainScreens(
  dynamicStations: RestaurantStation[],
  includeInactive = false
): StationMeta[] {
  return dynamicStations
    .filter((st) => st.screenType === 'captain')
    .filter((st) => includeInactive || (st.isActive !== false && st.isArchived !== true))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
    .map(mapRestaurantStationToMeta);
}

export function getDefaultFallbackStationId(effectiveStations: StationMeta[]): string {
  const activePrep = effectiveStations.filter((s) => s.screenType !== 'captain' && s.isActive && !s.isArchived);
  const explicitDefault = activePrep.find((s) => s.isDefaultFallback);
  return explicitDefault?.stationId || activePrep[0]?.stationId || effectiveStations[0]?.stationId || 'kitchen';
}

export function getStaffEffectiveAllowedStations(
  staff: Pick<StaffMember, 'role' | 'allowedScreens' | 'allowedStations'>,
  allStations: StationMeta[]
): string[] {
  const allIds = allStations.map((s) => s.stationId);
  if (staff.role === 'manager') {
    return allIds;
  }
  const set = new Set<string>();
  (staff.allowedStations || []).forEach((id) => {
    const clean = cleanStationId(id);
    if (clean) set.add(clean);
  });
  (staff.allowedScreens || []).forEach((scr) => {
    const st = screenToStationId(scr);
    if (st) set.add(st);
  });
  return Array.from(set);
}

export function normalizeStation(val?: string | null): string | undefined {
  const clean = cleanStationId(val);
  return clean || undefined;
}

export function resolveCategoryStations(
  categoryId: string | undefined,
  categoryMap: Map<string, Category>,
  fallbackStationId = 'kitchen'
): string[] {
  if (!categoryId) return fallbackStationId ? [fallbackStationId] : [];
  const cat = categoryMap.get(categoryId);
  if (!cat) return fallbackStationId ? [fallbackStationId] : [];

  const explicitList = cleanStationIdList(cat.stationIds);
  if (explicitList.length > 0) return explicitList;

  const direct = normalizeStation(cat.stationId || cat.station);
  if (direct) return [direct];

  if (cat.parentId) {
    const parent = categoryMap.get(cat.parentId);
    const parentList = cleanStationIdList(parent?.stationIds);
    if (parentList.length > 0) return parentList;
    const parentStation = normalizeStation(parent?.stationId || parent?.station);
    if (parentStation) return [parentStation];
  }

  return fallbackStationId ? [fallbackStationId] : [];
}

export function resolveCategoryStation(
  categoryId: string | undefined,
  categoryMap: Map<string, Category>,
  fallbackStationId = 'kitchen'
): string {
  return resolveCategoryStations(categoryId, categoryMap, fallbackStationId)[0] || fallbackStationId;
}

export function resolveMenuItemStations(
  item: MenuItem | undefined,
  categoryMap: Map<string, Category>,
  fallbackStationId = 'kitchen'
): string[] {
  if (!item) return fallbackStationId ? [fallbackStationId] : [];
  const catStations = item.categoryId
    ? resolveCategoryStations(item.categoryId, categoryMap, '')
    : [];
  const itemList = cleanStationIdList(item.stationIds);
  if (itemList.length > 0) return itemList;

  const direct = normalizeStation(item.stationId || item.station);
  if (direct) return [direct];
  if (catStations.length > 0) return catStations;
  return fallbackStationId ? [fallbackStationId] : [];
}

export function resolveMenuItemStation(
  item: MenuItem | undefined,
  categoryMap: Map<string, Category>,
  fallbackStationId = 'kitchen'
): string {
  return resolveMenuItemStations(item, categoryMap, fallbackStationId)[0] || fallbackStationId;
}

export function resolveOrderItemStations(
  orderItem: OrderItemPayload,
  itemMap: Map<string, MenuItem>,
  categoryMap: Map<string, Category>,
  fallbackStationId = 'kitchen'
): string[] {
  const payloadList = cleanStationIdList(orderItem.stationIds);
  if (payloadList.length > 0) return payloadList;

  const direct = normalizeStation(orderItem.stationId || orderItem.station);
  if (direct) return [direct];

  const menuItem = itemMap.get(orderItem.menuItemId);
  return resolveMenuItemStations(menuItem, categoryMap, fallbackStationId);
}

export function resolveOrderItemStation(
  orderItem: OrderItemPayload,
  itemMap: Map<string, MenuItem>,
  categoryMap: Map<string, Category>,
  fallbackStationId = 'kitchen'
): string {
  return resolveOrderItemStations(orderItem, itemMap, categoryMap, fallbackStationId)[0] || fallbackStationId;
}
