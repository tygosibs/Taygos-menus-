import { MenuColorMode } from '../types/menu';

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
  headingColor: string;
  descriptionColor: string;
  priceColor: string;
}

export const CONTRAST_TYPOGRAPHY_PRESETS: TypographyPreset[] = [
  {
    id: 'light-ink',
    labelAr: 'حبر داكن كلاسيكي (فاتح)',
    labelEn: 'Classic Deep Ink (Light)',
    mode: 'light',
    headingColor: '#0B132B',
    descriptionColor: '#334155',
    priceColor: '#991B1B',
  },
  {
    id: 'light-espresso',
    labelAr: 'إسبريسو دافئ (فاتح)',
    labelEn: 'Warm Espresso (Light)',
    mode: 'light',
    headingColor: '#231710',
    descriptionColor: '#5C4033',
    priceColor: '#9A3412',
  },
  {
    id: 'dark-crisp',
    labelAr: 'أبيض ناصع + ذهبي (داكن)',
    labelEn: 'Crisp Ivory & Gold (Dark)',
    mode: 'dark',
    headingColor: '#F8FAFC',
    descriptionColor: '#CBD5E1',
    priceColor: '#FBBF24',
  },
  {
    id: 'dark-mint',
    labelAr: 'ثلجي + زمردي (داكن)',
    labelEn: 'Frost & Emerald (Dark)',
    mode: 'dark',
    headingColor: '#FFFFFF',
    descriptionColor: '#E2E8F0',
    priceColor: '#34D399',
  },
];

export function resolveMenuSurfacePalette(params: {
  themeIsDark: boolean;
  colorMode?: MenuColorMode;
  primaryColor?: string;
  headingColor?: string;
  descriptionColor?: string;
  priceColor?: string;
}): ResolvedMenuPalette {
  const mode = params.colorMode || 'auto';
  const isDarkSurface =
    mode === 'dark' ? true : mode === 'light' ? false : params.themeIsDark;

  const pageBg = isDarkSurface ? '#090D16' : '#FAF9F6';
  const cardBg = isDarkSurface ? '#131A29' : '#FFFFFF';
  const subtleBg = isDarkSurface ? '#1B2438' : '#F1F5F9';
  const borderColor = isDarkSurface ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.11)';

  const defaultHeading = isDarkSurface ? '#F8FAFC' : '#0B132B';
  const defaultDesc = isDarkSurface ? '#CBD5E1' : '#334155';
  const rawAccent = isValidHexColor(params.primaryColor) ? params.primaryColor! : '#A61C1C';

  // Ensure accent & price keep >= 4.5 contrast on surface when using defaults
  let safeAccent = rawAccent;
  if (getContrastRatio(safeAccent, cardBg) < 3.6) {
    safeAccent = isDarkSurface ? '#FBBF24' : '#991B1B';
  }

  const pickColor = (custom: string | undefined, fallback: string, minContrast: number) => {
    if (!isValidHexColor(custom)) return fallback;
    if (getContrastRatio(custom!, cardBg) < minContrast) {
      return fallback;
    }
    return custom!.trim();
  };

  const headingColor = pickColor(params.headingColor, defaultHeading, 4.5);
  const descriptionColor = pickColor(params.descriptionColor, defaultDesc, 4.0);
  const priceColor = pickColor(params.priceColor, safeAccent, 3.8);

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
