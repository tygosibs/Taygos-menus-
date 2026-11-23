import {
  ChefHat,
  Coffee,
  Croissant,
  CupSoda,
  Fish,
  Flame,
  Pizza,
  Salad,
  Sparkles,
  Utensils,
  Wind,
  Wine,
} from 'lucide-react';
import {
  Category,
  MenuItem,
  OrderItemPayload,
  RestaurantStation,
  StaffMember,
  StaffScreen,
  StationIconName,
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
  isActive: boolean;
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
  { id: 'croissant', labelAr: 'حلويات / باستري', labelEn: 'Pastry' },
  { id: 'coffee', labelAr: 'قهوة مختصة', labelEn: 'Coffee' },
  { id: 'pizza', labelAr: 'بيتزا وفرن', labelEn: 'Pizza' },
  { id: 'fish', labelAr: 'سوشي / مأكولات بحرية', labelEn: 'Sushi / Seafood' },
  { id: 'salad', labelAr: 'سلطات ومقبلات', labelEn: 'Salads' },
  { id: 'cup-soda', labelAr: 'عصائر فريش', labelEn: 'Juices' },
  { id: 'wind', labelAr: 'شيشة / لاونج', labelEn: 'Shisha / Lounge' },
  { id: 'utensils', labelAr: 'شاورما / سريع', labelEn: 'Shawarma / Fast' },
  { id: 'sparkles', labelAr: 'قسم خاص مميز', labelEn: 'Custom / VIP' },
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
  STATION_TEMPLATES[0], // المطبخ
  STATION_TEMPLATES[2], // البار
  STATION_TEMPLATES[3], // الباستري
];

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
  isActive: true,
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

export function getStationTopicName(restaurantId: string, stationId: string): string {
  const cleanRest = cleanStationId(restaurantId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanSt = cleanStationId(stationId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `restaurant_${cleanRest}_station_${cleanSt}`;
}

export function buildEffectiveStations(
  dynamicStations: RestaurantStation[],
  includeInactive = false
): StationMeta[] {
  const source =
    dynamicStations.length > 0
      ? dynamicStations
      : DEFAULT_SEED_STATIONS.map((tpl, idx) => ({
          id: tpl.suggestedId,
          stationId: tpl.suggestedId,
          restaurantId: '',
          ownerId: '',
          name: tpl.name,
          nameEn: tpl.nameEn,
          color: tpl.color,
          icon: tpl.icon,
          isActive: true,
          sortOrder: idx + 1,
        }));

  return source
    .filter((st) => includeInactive || st.isActive !== false)
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
    .map((st) => {
      const id = cleanStationId(st.stationId || st.id) || 'kitchen';
      const nameAr = (st.name || '').trim() || id;
      const nameEn = (st.nameEn || '').trim() || nameAr;
      return {
        id,
        stationId: id,
        label: nameEn && nameEn !== nameAr ? `${nameAr} (${nameEn})` : nameAr,
        label_en: nameEn,
        shortLabel: nameAr,
        shortLabel_en: nameEn,
        color: st.color || '#EA580C',
        icon: st.icon || 'chef-hat',
        badgeClass: 'bg-zinc-50 text-zinc-900 border-zinc-200',
        isActive: st.isActive !== false,
        sortOrder: st.sortOrder ?? 1,
      };
    });
}

export function getStaffEffectiveAllowedStations(staff: Pick<StaffMember, 'role' | 'allowedScreens' | 'allowedStations'>, allStations: StationMeta[]): string[] {
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

export function resolveCategoryStation(
  categoryId: string | undefined,
  categoryMap: Map<string, Category>,
  fallbackStationId = 'kitchen'
): string {
  if (!categoryId) return fallbackStationId;
  const cat = categoryMap.get(categoryId);
  if (!cat) return fallbackStationId;
  const direct = normalizeStation(cat.stationId || cat.station);
  if (direct) return direct;
  if (cat.parentId) {
    const parent = categoryMap.get(cat.parentId);
    const parentStation = normalizeStation(parent?.stationId || parent?.station);
    if (parentStation) return parentStation;
  }
  return fallbackStationId;
}

export function resolveMenuItemStation(
  item: MenuItem | undefined,
  categoryMap: Map<string, Category>,
  fallbackStationId = 'kitchen'
): string {
  if (!item) return fallbackStationId;
  // Inherit from category hierarchy first if category explicitly defines stationId, or direct item override
  const catStation = item.categoryId
    ? resolveCategoryStation(item.categoryId, categoryMap, '')
    : '';
  const direct = normalizeStation(item.stationId || item.station);
  return direct || catStation || fallbackStationId;
}

export function resolveOrderItemStation(
  orderItem: OrderItemPayload,
  itemMap: Map<string, MenuItem>,
  categoryMap: Map<string, Category>,
  fallbackStationId = 'kitchen'
): string {
  const direct = normalizeStation(orderItem.stationId || orderItem.station);
  if (direct) return direct;
  const menuItem = itemMap.get(orderItem.menuItemId);
  return resolveMenuItemStation(menuItem, categoryMap, fallbackStationId);
}
