import { AppLang } from '../data/translations';
import { MenuColorMode, MenuItem, MenuSortMode } from '../types/menu';

export interface PrimaryDishBadge {
  text: string;
  bg: string;
  fg: string;
  isHighlight: boolean;
}

export function getPrimaryItemBadge(
  item: MenuItem,
  lang: AppLang,
  accentColor: string
): PrimaryDishBadge | null {
  if (item.isBogo || item.badge === 'bogo') {
    return {
      text: lang === 'en' ? '1+1 FREE' : '1+1 مجاناً',
      bg: '#059669',
      fg: '#FFFFFF',
      isHighlight: true,
    };
  }
  if (item.badge === 'trending_week') {
    return {
      text: lang === 'en' ? 'Trending' : 'أشهر طلبات الأسبوع',
      bg: accentColor,
      fg: '#FFFFFF',
      isHighlight: true,
    };
  }
  if (item.badge === 'best_seller') {
    return {
      text: lang === 'en' ? 'Best Seller' : 'الأكثر مبيعاً',
      bg: '#D97706',
      fg: '#FFFFFF',
      isHighlight: false,
    };
  }
  if (item.badge === 'chef_choice') {
    return {
      text: lang === 'en' ? "Chef's Pick" : 'اختيار الشيف',
      bg: '#18181B',
      fg: '#FBBF24',
      isHighlight: false,
    };
  }
  if (item.badge === 'new') {
    return {
      text: lang === 'en' ? 'New' : 'جديد',
      bg: '#2563EB',
      fg: '#FFFFFF',
      isHighlight: false,
    };
  }
  return null;
}

export function sortMenuItems(items: MenuItem[], mode: MenuSortMode): MenuItem[] {
  const list = [...items];
  if (mode === 'lowest_price') {
    return list.sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0));
  }
  if (mode === 'best_selling') {
    return list.sort((a, b) => {
      const scoreA =
        (a.badge === 'best_seller' ? 2000 : a.badge === 'trending_week' ? 1500 : 0) +
        (a.ordersCount || 0);
      const scoreB =
        (b.badge === 'best_seller' ? 2000 : b.badge === 'trending_week' ? 1500 : 0) +
        (b.ordersCount || 0);
      return scoreB - scoreA;
    });
  }
  if (mode === 'chef_quality') {
    return list.sort((a, b) => {
      const rank = (x: MenuItem) =>
        x.badge === 'chef_choice'
          ? 3
          : x.badge === 'trending_week'
            ? 2
            : x.isBogo
              ? 1
              : 0;
      const diff = rank(b) - rank(a);
      if (diff !== 0) return diff;
      return (b.ordersCount || 0) - (a.ordersCount || 0);
    });
  }
  return list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function getResponsiveGridClass(cols?: 1 | 2 | 3, compactCardMobile = false): string {
  if (cols === 1) return 'grid grid-cols-1 gap-3.5 sm:gap-4';
  if (cols === 3) {
    return compactCardMobile
      ? 'grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';
  }
  return compactCardMobile
    ? 'grid grid-cols-2 md:grid-cols-2 gap-3 sm:gap-4'
    : 'grid grid-cols-1 md:grid-cols-2 gap-4';
}

export function cycleColorMode(
  currentOverride: MenuColorMode | undefined,
  themeDefaultIsDark: boolean
): MenuColorMode {
  const effectiveDark =
    currentOverride === 'dark'
      ? true
      : currentOverride === 'light'
        ? false
        : themeDefaultIsDark;
  return effectiveDark ? 'light' : 'dark';
}
