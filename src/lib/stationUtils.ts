import { Category, MenuItem, OrderItemPayload, PrepStation } from '../types/menu';

export interface StationMeta {
  id: PrepStation;
  label: string;
  label_en: string;
  shortLabel: string;
  shortLabel_en: string;
  badgeClass: string;
}

export const STATION_LIST: StationMeta[] = [
  {
    id: 'kitchen',
    label: 'المطبخ الرئيسي (Kitchen)',
    label_en: 'Main Kitchen',
    shortLabel: 'المطبخ',
    shortLabel_en: 'Kitchen',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
  },
  {
    id: 'bar',
    label: 'البار والمشروبات (Bar)',
    label_en: 'Bar & Beverages',
    shortLabel: 'البار',
    shortLabel_en: 'Bar',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  {
    id: 'pastry',
    label: 'الباستري والحلويات (Pastry)',
    label_en: 'Pastry & Desserts',
    shortLabel: 'الباستري',
    shortLabel_en: 'Pastry',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
  },
];

export const STATION_META_MAP: Record<PrepStation, StationMeta> = {
  kitchen: STATION_LIST[0],
  bar: STATION_LIST[1],
  pastry: STATION_LIST[2],
};

export function normalizeStation(val?: string | null): PrepStation | undefined {
  if (val === 'kitchen' || val === 'bar' || val === 'pastry') return val;
  return undefined;
}

export function resolveCategoryStation(
  categoryId: string | undefined,
  categoryMap: Map<string, Category>
): PrepStation {
  if (!categoryId) return 'kitchen';
  const cat = categoryMap.get(categoryId);
  if (!cat) return 'kitchen';
  const direct = normalizeStation(cat.station);
  if (direct) return direct;
  if (cat.parentId) {
    const parent = categoryMap.get(cat.parentId);
    const parentStation = normalizeStation(parent?.station);
    if (parentStation) return parentStation;
  }
  return 'kitchen';
}

export function resolveMenuItemStation(
  item: MenuItem | undefined,
  categoryMap: Map<string, Category>
): PrepStation {
  if (!item) return 'kitchen';
  const direct = normalizeStation(item.station);
  if (direct) return direct;
  return resolveCategoryStation(item.categoryId, categoryMap);
}

export function resolveOrderItemStation(
  orderItem: OrderItemPayload,
  itemMap: Map<string, MenuItem>,
  categoryMap: Map<string, Category>
): PrepStation {
  const direct = normalizeStation(orderItem.station);
  if (direct) return direct;
  const menuItem = itemMap.get(orderItem.menuItemId);
  return resolveMenuItemStation(menuItem, categoryMap);
}
