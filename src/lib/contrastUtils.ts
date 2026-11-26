import { MenuColorMode, ThemeModeColorSet } from '../types/menu';

export interface ResolvedMenuPalette {
  isDarkSurface: boolean;
  pageBg: string;
  cardBg: string;
  subtleBg: string;
  borderColor: string;
  headingColor: string;
  descriptionColor: string;
  priceColor: string;
  accentColor: string;
  accentTextColor: string;
}

function normalizeHex(hex: string): [number, number, number] | null {
  const clean = (hex || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = normalizeHex(hex1);
  const rgb2 = normalizeHex(hex2);
  if (!rgb1 || !rgb2) return 7;
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isValidHexColor(hex?: string): boolean {
  return Boolean(hex && /^#[0-9a-fA-F]{6}$/.test(hex.trim()));
}

export function getContrastOnAccent(accentHex: string): '#FFFFFF' | '#0B132B' {
  const whiteRatio = getContrastRatio('#FFFFFF', accentHex);
  const darkRatio = getContrastRatio('#0B132B', accentHex);
  return whiteRatio >= darkRatio ? '#FFFFFF' : '#0B132B';
}

export interface TypographyPreset {
  id: string;
  labelAr: string;
  labelEn: string;
  mode: 'light' | 'dark';
  menuBgColor?: string;
  menuCardBgColor?: string;
  headingColor: string;
  descriptionColor: string;
  priceColor: string;
}

export const CONTRAST_TYPOGRAPHY_PRESETS: TypographyPreset[] = [
  {
    id: 'light-ink',
    labelAr: 'كلاسيكي فاتح + حبر داكن',
    labelEn: 'Classic Ivory + Deep Ink',
    mode: 'light',
    menuBgColor: '#FAF9F6',
    menuCardBgColor: '#FFFFFF',
    headingColor: '#0B132B',
    descriptionColor: '#334155',
    priceColor: '#991B1B',
  },
  {
    id: 'slate-gold',
    labelAr: 'رمادي داكن + ذهبي أنيق',
    labelEn: 'Charcoal Slate + Gold',
    mode: 'dark',
    menuBgColor: '#2B303B',
    menuCardBgColor: '#363C49',
    headingColor: '#FDE68A',
    descriptionColor: '#E5E7EB',
    priceColor: '#FBBF24',
  },
  {
    id: 'soft-gray-ink',
    labelAr: 'رمادي هادئ + كروت ناصعة',
    labelEn: 'Soft Gray + Crisp Cards',
    mode: 'light',
    menuBgColor: '#E5E7EB',
    menuCardBgColor: '#FFFFFF',
    headingColor: '#0F172A',
    descriptionColor: '#334155',
    priceColor: '#B45309',
  },
  {
    id: 'light-espresso',
    labelAr: 'بيج دافئ + إسبريسو',
    labelEn: 'Warm Sand + Espresso',
    mode: 'light',
    menuBgColor: '#F5EFE6',
    menuCardBgColor: '#FFFDF9',
    headingColor: '#231710',
    descriptionColor: '#5C4033',
    priceColor: '#9A3412',
  },
  {
    id: 'dark-crisp',
    labelAr: 'ليلي عميق + أبيض وذهبي',
    labelEn: 'Midnight + Ivory & Gold',
    mode: 'dark',
    menuBgColor: '#090D16',
    menuCardBgColor: '#131A29',
    headingColor: '#F8FAFC',
    descriptionColor: '#CBD5E1',
    priceColor: '#FBBF24',
  },
  {
    id: 'dark-mint',
    labelAr: 'كحلي ليلي + ثلجي وزمردي',
    labelEn: 'Deep Navy + Frost & Emerald',
    mode: 'dark',
    menuBgColor: '#0B1120',
    menuCardBgColor: '#151E32',
    headingColor: '#FFFFFF',
    descriptionColor: '#E2E8F0',
    priceColor: '#34D399',
  },
];

export interface QuickColorFamily {
  id: string;
  labelAr: string;
  labelEn: string;
  shades: string[];
}

export const QUICK_COLOR_SHADES: QuickColorFamily[] = [
  {
    id: 'light_neutrals',
    labelAr: 'فاتح وكريمي',
    labelEn: 'Ivory & Light',
    shades: ['#FFFFFF', '#FAF9F6', '#F5EFE6', '#E5E7EB', '#CBD5E1'],
  },
  {
    id: 'dark_neutrals',
    labelAr: 'داكن وليلي',
    labelEn: 'Obsidian & Dark',
    shades: ['#090D16', '#131A29', '#1E293B', '#334155', '#475569'],
  },
  {
    id: 'gold_amber',
    labelAr: 'ذهبي وعنبري',
    labelEn: 'Gold & Amber',
    shades: ['#FEF3C7', '#FDE68A', '#FBBF24', '#D97706', '#92400E'],
  },
  {
    id: 'crimson_rose',
    labelAr: 'أحمر وعنابي',
    labelEn: 'Crimson & Berry',
    shades: ['#FFE4E6', '#FB7185', '#DC2626', '#A61C1C', '#7F1D1D'],
  },
  {
    id: 'emerald_mint',
    labelAr: 'زمردي ونعناع',
    labelEn: 'Emerald & Mint',
    shades: ['#D1FAE5', '#34D399', '#10B981', '#047857', '#064E3B'],
  },
  {
    id: 'sapphire_indigo',
    labelAr: 'ياقوتي وكحلي',
    labelEn: 'Sapphire & Navy',
    shades: ['#DBEAFE', '#60A5FA', '#2563EB', '#1D4ED8', '#0F172A'],
  },
];

function isDarkHexSurface(hex: string): boolean {
  const rgb = normalizeHex(hex);
  return Boolean(rgb && relativeLuminance(rgb) < 0.32);
}

export function resolveMenuSurfacePalette(params: {
  themeIsDark: boolean;
  colorMode?: MenuColorMode;
  primaryColor?: string;
  headingColor?: string;
  descriptionColor?: string;
  priceColor?: string;
  menuBgColor?: string;
  menuCardBgColor?: string;
  lightThemeColors?: ThemeModeColorSet;
  darkThemeColors?: ThemeModeColorSet;
}): ResolvedMenuPalette {
  const mode = params.colorMode || 'auto';
  const baseIsDark =
    mode === 'dark' ? true : mode === 'light' ? false : params.themeIsDark;

  const modeColors = baseIsDark ? params.darkThemeColors : params.lightThemeColors;

  const flatPageBg = isValidHexColor(params.menuBgColor) ? params.menuBgColor!.trim() : '';
  const flatCardBg = isValidHexColor(params.menuCardBgColor) ? params.menuCardBgColor!.trim() : '';
  const modePageBg = isValidHexColor(modeColors?.menuBgColor) ? modeColors!.menuBgColor!.trim() : '';
  const modeCardBg = isValidHexColor(modeColors?.menuCardBgColor) ? modeColors!.menuCardBgColor!.trim() : '';

  // When an explicit mode ('light' | 'dark') is active without mode-specific surfaces,
  // only inherit a flat base surface color if its brightness actually matches the requested mode.
  const compatibleFlatPageBg =
    flatPageBg && (mode === 'auto' || isDarkHexSurface(flatPageBg) === baseIsDark)
      ? flatPageBg
      : '';
  const compatibleFlatCardBg =
    flatCardBg && (mode === 'auto' || isDarkHexSurface(flatCardBg) === baseIsDark)
      ? flatCardBg
      : '';

  const customPageBg = modePageBg || compatibleFlatPageBg;
  const customCardBg = modeCardBg || compatibleFlatCardBg;

  const pageBg = customPageBg || (baseIsDark ? '#090D16' : '#FAF9F6');
  const cardBg =
    customCardBg ||
    (customPageBg
      ? isDarkHexSurface(customPageBg)
        ? '#1E2534'
        : '#FFFFFF'
      : baseIsDark
        ? '#131A29'
        : '#FFFFFF');

  const isDarkSurface =
    customCardBg || customPageBg ? isDarkHexSurface(customCardBg || customPageBg) : baseIsDark;

  const subtleBg = isDarkSurface ? 'rgba(255,255,255,0.08)' : '#F1F5F9';
  const borderColor = isDarkSurface ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.12)';

  const defaultHeading = isDarkSurface ? '#F8FAFC' : '#0B132B';
  const defaultDesc = isDarkSurface ? '#CBD5E1' : '#334155';
  const rawAccent = isValidHexColor(params.primaryColor) ? params.primaryColor! : '#A61C1C';

  // Ensure accent & price keep >= 3.6 contrast on surface when using defaults
  let safeAccent = rawAccent;
  if (getContrastRatio(safeAccent, cardBg) < 3.6) {
    safeAccent = isDarkSurface ? '#FBBF24' : '#991B1B';
  }

  const pickColor = (
    modeCustom: string | undefined,
    flatCustom: string | undefined,
    fallback: string,
    minContrast: number
  ) => {
    if (isValidHexColor(modeCustom) && getContrastRatio(modeCustom!, cardBg) >= minContrast) {
      return modeCustom!.trim();
    }
    if (isValidHexColor(flatCustom) && getContrastRatio(flatCustom!, cardBg) >= minContrast) {
      return flatCustom!.trim();
    }
    return fallback;
  };

  const headingColor = pickColor(modeColors?.headingColor, params.headingColor, defaultHeading, 4.2);
  const descriptionColor = pickColor(
    modeColors?.descriptionColor,
    params.descriptionColor,
    defaultDesc,
    3.6
  );
  const priceColor = pickColor(modeColors?.priceColor, params.priceColor, safeAccent, 3.5);

  return {
    isDarkSurface,
    pageBg,
    cardBg,
    subtleBg,
    borderColor,
    headingColor,
    descriptionColor,
    priceColor,
    accentColor: rawAccent,
    accentTextColor: getContrastOnAccent(rawAccent),
  };
}
