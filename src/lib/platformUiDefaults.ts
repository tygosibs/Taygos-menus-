import {
  CardRadiusStyle,
  PlatformUiConfig,
  ScreenThemeId,
  ScreenThemeTokens,
  UiActionCatalogItem,
  UiScreenConfig,
  UiScreenId,
} from '../types/uiStudio';

export const SCREEN_META: Record<
  UiScreenId,
  { id: UiScreenId; labelAr: string; labelEn: string; descAr: string; descEn: string }
> = {
  super_admin: {
    id: 'super_admin',
    labelAr: 'لوحة مدير المنصة',
    labelEn: 'Super Admin Console',
    descAr: 'تحكم في بطاقات وأزرار وثيم لوحة إدارة المنصة الخاصة بك شخصياً.',
    descEn: 'Customize cards, button labels, layout, and theme of your own Super Admin console.',
  },
  owner_admin: {
    id: 'owner_admin',
    labelAr: 'لوحة صاحب المطعم',
    labelEn: 'Restaurant Owner Console',
    descAr: 'إعادة تنظيم بطاقات وأزرار وثيم لوحة المالك بدون المساس بخطوط سير العمل.',
    descEn: 'Reorganize cards, tabs, labels, and theme of the Owner dashboard safely.',
  },
  manager_console: {
    id: 'manager_console',
    labelAr: 'شاشة المدير الإشرافي',
    labelEn: 'Supervisory Manager Console',
    descAr: 'ترتيب بطاقات الإشراف والمراقبة وشاشات المدير والأقسام.',
    descEn: 'Arrange supervision cards, stations, and quick navigation.',
  },
  cashier_kds: {
    id: 'cashier_kds',
    labelAr: 'الكاشير والمطبخ والبار',
    labelEn: 'Cashier / POS & KDS',
    descAr: 'تخصيص ثيم وأزرار وتبويبات الكاشير ومحطات التحضير.',
    descEn: 'Customize theme, labels, and layout for Cashier / POS and Kitchen Display System (KDS).',
  },
  captain_waiter: {
    id: 'captain_waiter',
    labelAr: 'شاشة الكابتن',
    labelEn: 'Captain',
    descAr: 'تنظيم وتسمية أزرار خريطة الطاولات ونقطة الطلب والنداءات.',
    descEn: 'Customize floor map, quick order pad, and service call views.',
  },
  landing_page: {
    id: 'landing_page',
    labelAr: 'صفحة الهبوط الرئيسية',
    labelEn: 'Public Landing Page',
    descAr: 'تغيير روح وألوان صفحة الهبوط وأسماء الأزرار وترتيب أقسامها.',
    descEn: 'Customize landing page theme, button copy, and section order.',
  },
};

function parseHexRgb(hex: string): [number, number, number] | null {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return [r, g, b];
  }
  return null;
}

function relativeLuminance(rgb: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
}

export function getContrastRatio(hexA: string, hexB: string): number {
  const a = parseHexRgb(hexA);
  const b = parseHexRgb(hexB);
  if (!a || !b) return 21;
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const bright = Math.max(lumA, lumB);
  const dark = Math.min(lumA, lumB);
  return (bright + 0.05) / (dark + 0.05);
}

export function getReadableTextOnBg(
  bgHex: string,
  darkText = '#0E1B3D',
  lightText = '#FBF7EF'
): string {
  const darkRatio = getContrastRatio(bgHex, darkText);
  const lightRatio = getContrastRatio(bgHex, lightText);
  return lightRatio >= darkRatio ? lightText : darkText;
}

export function getSidebarHighlightHex(theme: ScreenThemeTokens): string {
  const candidates = theme.isDarkShell
    ? [theme.highlightHex || '', theme.accentHex, '#FDBA74', '#FDE047', '#FFFFFF']
    : [theme.accentHex, theme.highlightHex || '', '#14285A', '#0F172A'];
  for (const cand of candidates) {
    if (cand && getContrastRatio(cand, theme.sidebarBg) >= 4.5) {
      return cand;
    }
  }
  return theme.isDarkShell ? '#FDBA74' : '#14285A';
}

export function getSidebarActionColors(theme: ScreenThemeTokens): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  if (theme.isDarkShell) {
    const candidates = [
      theme.accentHex,
      theme.highlightHex || '',
      theme.sidebarActiveBg,
      '#E8833A',
      '#FBBF24',
      '#FFFFFF',
    ];
    let bg = '#E8833A';
    for (const cand of candidates) {
      if (!cand) continue;
      const vsSidebar = getContrastRatio(cand, theme.sidebarBg);
      const textCand = getReadableTextOnBg(cand, '#0E1B3D', '#FFFFFF');
      const vsText = getContrastRatio(cand, textCand);
      if (vsSidebar >= 4.5 && vsText >= 4.5) {
        bg = cand;
        break;
      }
    }
    return {
      backgroundColor: bg,
      color: getReadableTextOnBg(bg, '#0E1B3D', '#FFFFFF'),
      borderColor: 'rgba(255,255,255,0.22)',
    };
  }
  return {
    backgroundColor: theme.accentHex,
    color: getReadableTextOnBg(theme.accentHex, '#0E1B3D', '#FFFFFF'),
    borderColor: theme.accentHex,
  };
}

export const SCREEN_THEMES: Record<ScreenThemeId, ScreenThemeTokens> = {
  sand_sapphire: {
    id: 'sand_sapphire',
    nameAr: 'رمل وياقوت',
    nameEn: 'Sand & Sapphire',
    taglineAr: 'رملي دافئ مريح للعين مع أزرق ملكي ولمسات برتقالية',
    taglineEn: 'Warm sand canvas with deep royal sapphire and amber accents',
    isDarkShell: true,
    canvasBg: '#F3EBDD',
    canvasText: '#0E1B3D',
    surfaceBg: '#FBF7EF',
    surfaceSubtleBg: '#F3EBDD',
    surfaceBorder: '#E6D9C3',
    surfaceText: '#14285A',
    mutedText: '#334155',
    sidebarBg: '#14285A',
    sidebarBorder: '#2C478A',
    sidebarText: '#FBF7EF',
    sidebarMuted: '#DCE6FA',
    sidebarActiveBg: '#E8833A',
    sidebarActiveText: '#0E1B3D',
    headerBg: '#FBF7EF',
    headerBorder: '#E6D9C3',
    headerText: '#14285A',
    accentHex: '#14285A',
    accentTextHex: '#FBF7EF',
    highlightHex: '#E8833A',
    successHex: '#2F8F5B',
    cardShadow: '0 1px 3px rgba(20, 40, 90, 0.06)',
    previewSwatches: ['#F3EBDD', '#14285A', '#E8833A'],
  },
  obsidian_gold: {
    id: 'obsidian_gold',
    nameAr: 'أوبسيديان الملكي الذهبي',
    nameEn: 'Obsidian Royal Gold',
    taglineAr: 'تباين ملكي فاخر بلمسات ذهبية دافئة',
    taglineEn: 'Deep charcoal architecture with warm sovereign gold accents',
    isDarkShell: true,
    canvasBg: '#F4F3EF',
    canvasText: '#141518',
    surfaceBg: '#FFFFFF',
    surfaceSubtleBg: '#F9F8F5',
    surfaceBorder: '#E5E1D8',
    surfaceText: '#141518',
    mutedText: '#4B473F',
    sidebarBg: '#0B0D12',
    sidebarBorder: '#262B38',
    sidebarText: '#F5F3EE',
    sidebarMuted: '#D4CFC4',
    sidebarActiveBg: '#D99B26',
    sidebarActiveText: '#0B0D12',
    headerBg: '#FFFFFF',
    headerBorder: '#E5E1D8',
    headerText: '#141518',
    accentHex: '#D99B26',
    accentTextHex: '#0B0D12',
    cardShadow: '0 1px 3px rgba(15, 16, 20, 0.06)',
    previewSwatches: ['#0B0D12', '#D99B26', '#F4F3EF'],
  },
  alabaster_editorial: {
    id: 'alabaster_editorial',
    nameAr: 'ألاباستر التحريري الكلاسيكي',
    nameEn: 'Alabaster Editorial',
    taglineAr: 'بياض معماري صافي بروح المجلات الراقية',
    taglineEn: 'Crisp warm ivory paper aesthetic with ink-black precision',
    isDarkShell: false,
    canvasBg: '#FAF9F6',
    canvasText: '#141413',
    surfaceBg: '#FFFFFF',
    surfaceSubtleBg: '#F4F1EA',
    surfaceBorder: '#E6E2D8',
    surfaceText: '#141413',
    mutedText: '#57534E',
    sidebarBg: '#FFFFFF',
    sidebarBorder: '#E6E2D8',
    sidebarText: '#141413',
    sidebarMuted: '#57534E',
    sidebarActiveBg: '#141413',
    sidebarActiveText: '#FAF9F6',
    headerBg: '#FFFFFF',
    headerBorder: '#E6E2D8',
    headerText: '#141413',
    accentHex: '#B45309',
    accentTextHex: '#FFFFFF',
    cardShadow: '0 1px 2px rgba(20, 20, 19, 0.04)',
    previewSwatches: ['#FAF9F6', '#141413', '#B45309'],
  },
  emerald_hospitality: {
    id: 'emerald_hospitality',
    nameAr: 'الزمرد للضيافة الفاخرة',
    nameEn: 'Emerald Hospitality',
    taglineAr: 'هدوء أخضر زمردي مريح للعين طوال الوردية',
    taglineEn: 'Refined botanical emerald calm engineered for hospitality flow',
    isDarkShell: true,
    canvasBg: '#F2F7F5',
    canvasText: '#0B241C',
    surfaceBg: '#FFFFFF',
    surfaceSubtleBg: '#ECF6F1',
    surfaceBorder: '#D4E6DD',
    surfaceText: '#0B241C',
    mutedText: '#345347',
    sidebarBg: '#063B2C',
    sidebarBorder: '#125F49',
    sidebarText: '#ECFDF5',
    sidebarMuted: '#CBEAE0',
    sidebarActiveBg: '#10B981',
    sidebarActiveText: '#052E21',
    headerBg: '#FFFFFF',
    headerBorder: '#D4E6DD',
    headerText: '#0B241C',
    accentHex: '#047857',
    accentTextHex: '#FFFFFF',
    highlightHex: '#34D399',
    cardShadow: '0 2px 6px rgba(6, 59, 44, 0.05)',
    previewSwatches: ['#063B2C', '#10B981', '#F2F7F5'],
  },
  midnight_sapphire: {
    id: 'midnight_sapphire',
    nameAr: 'الياقوت الليلي للتشغيل',
    nameEn: 'Midnight Sapphire',
    taglineAr: 'أزرق ياقوتي واضح ومثالي للكاشير والمطبخ',
    taglineEn: 'High-clarity cobalt slate built for high-speed Cashier / POS and KDS screens',
    isDarkShell: true,
    canvasBg: '#F1F5F9',
    canvasText: '#0F172A',
    surfaceBg: '#FFFFFF',
    surfaceSubtleBg: '#F8FAFC',
    surfaceBorder: '#CBD5E1',
    surfaceText: '#0F172A',
    mutedText: '#334155',
    sidebarBg: '#0F172A',
    sidebarBorder: '#28354D',
    sidebarText: '#F8FAFC',
    sidebarMuted: '#CBD5E1',
    sidebarActiveBg: '#0369A1',
    sidebarActiveText: '#FFFFFF',
    headerBg: '#FFFFFF',
    headerBorder: '#CBD5E1',
    headerText: '#0F172A',
    accentHex: '#0369A1',
    accentTextHex: '#FFFFFF',
    highlightHex: '#38BDF8',
    cardShadow: '0 2px 6px rgba(15, 23, 42, 0.06)',
    previewSwatches: ['#0F172A', '#0369A1', '#F1F5F9'],
  },
  espresso_bistro: {
    id: 'espresso_bistro',
    nameAr: 'إسبريسو بيسترو الدافئ',
    nameEn: 'Warm Espresso Bistro',
    taglineAr: 'دفء القهوة المحمصة والنحاس المصقول للمطاعم',
    taglineEn: 'Roasted espresso depth paired with warm parchment and copper tones',
    isDarkShell: true,
    canvasBg: '#FBF7F2',
    canvasText: '#261710',
    surfaceBg: '#FFFFFF',
    surfaceSubtleBg: '#F6EFE6',
    surfaceBorder: '#E5D8C8',
    surfaceText: '#261710',
    mutedText: '#573F32',
    sidebarBg: '#2A1810',
    sidebarBorder: '#4B2D20',
    sidebarText: '#FBF7F2',
    sidebarMuted: '#E5D3C8',
    sidebarActiveBg: '#D97706',
    sidebarActiveText: '#1F110A',
    headerBg: '#FFFDF9',
    headerBorder: '#E5D8C8',
    headerText: '#261710',
    accentHex: '#C2410C',
    accentTextHex: '#FFFFFF',
    highlightHex: '#FBBF24',
    cardShadow: '0 2px 6px rgba(42, 24, 16, 0.06)',
    previewSwatches: ['#2A1810', '#C2410C', '#FBF7F2'],
  },
  nordic_slate: {
    id: 'nordic_slate',
    nameAr: 'الأردواز الإسكندنافي المصقول',
    nameEn: 'Nordic Slate Crisp',
    taglineAr: 'بساطة هندسية ناعمة وتنظيم فائق الوضوح',
    taglineEn: 'Nordic steel neutral canvas with crisp indigo structural highlights',
    isDarkShell: false,
    canvasBg: '#F3F5F8',
    canvasText: '#111827',
    surfaceBg: '#FFFFFF',
    surfaceSubtleBg: '#F8FAFC',
    surfaceBorder: '#DDE3EC',
    surfaceText: '#111827',
    mutedText: '#475569',
    sidebarBg: '#F8FAFC',
    sidebarBorder: '#DDE3EC',
    sidebarText: '#0F172A',
    sidebarMuted: '#475569',
    sidebarActiveBg: '#3730A3',
    sidebarActiveText: '#FFFFFF',
    headerBg: '#FFFFFF',
    headerBorder: '#DDE3EC',
    headerText: '#111827',
    accentHex: '#3730A3',
    accentTextHex: '#FFFFFF',
    cardShadow: '0 1px 3px rgba(17, 24, 39, 0.05)',
    previewSwatches: ['#F8FAFC', '#3730A3', '#111827'],
  },
  burgundy_velvet: {
    id: 'burgundy_velvet',
    nameAr: 'المخمل العنابي الفاخر',
    nameEn: 'Burgundy Velvet',
    taglineAr: 'أجواء المطاعم الراقية والضيافة الكلاسيكية',
    taglineEn: 'Rich velvet burgundy paired with warm champagne gold & cream',
    isDarkShell: true,
    canvasBg: '#FCF7F8',
    canvasText: '#2A0A12',
    surfaceBg: '#FFFFFF',
    surfaceSubtleBg: '#FAF0F2',
    surfaceBorder: '#EAD5DA',
    surfaceText: '#2A0A12',
    mutedText: '#5C3842',
    sidebarBg: '#3E0B18',
    sidebarBorder: '#63172B',
    sidebarText: '#FFF5F7',
    sidebarMuted: '#F3CFD8',
    sidebarActiveBg: '#EAB308',
    sidebarActiveText: '#2A0A12',
    headerBg: '#FFFFFF',
    headerBorder: '#EAD5DA',
    headerText: '#2A0A12',
    accentHex: '#9F1239',
    accentTextHex: '#FFFFFF',
    highlightHex: '#FDE047',
    cardShadow: '0 2px 6px rgba(62, 11, 24, 0.06)',
    previewSwatches: ['#3E0B18', '#9F1239', '#EAB308'],
  },
  saffron_sunrise: {
    id: 'saffron_sunrise',
    nameAr: 'الزعفران والتراكوتا الدافئ',
    nameEn: 'Saffron Heritage',
    taglineAr: 'حيوية مطاعم الشرق العصرية بإشراقة زعفرانية',
    taglineEn: 'Sunlit sandstone surface energized by terracotta saffron accents',
    isDarkShell: false,
    canvasBg: '#FFFBF5',
    canvasText: '#1F1610',
    surfaceBg: '#FFFFFF',
    surfaceSubtleBg: '#FEF3E7',
    surfaceBorder: '#F0DEC9',
    surfaceText: '#1F1610',
    mutedText: '#5E4736',
    sidebarBg: '#FFFFFF',
    sidebarBorder: '#F0DEC9',
    sidebarText: '#1F1610',
    sidebarMuted: '#654C39',
    sidebarActiveBg: '#C2410C',
    sidebarActiveText: '#FFFFFF',
    headerBg: '#FFFFFF',
    headerBorder: '#F0DEC9',
    headerText: '#1F1610',
    accentHex: '#C2410C',
    accentTextHex: '#FFFFFF',
    cardShadow: '0 1px 4px rgba(194, 65, 12, 0.06)',
    previewSwatches: ['#FFFBF5', '#C2410C', '#1F1610'],
  },
};

export const UI_ACTION_CATALOG: Record<UiScreenId, UiActionCatalogItem[]> = {
  super_admin: [
    { id: 'tenants', defaultLabelAr: 'إدارة المطاعم والحسابات', defaultLabelEn: 'Tenants & Audit', iconName: 'Building2' },
    { id: 'promos', defaultLabelAr: 'أكواد الخصم والهدايا', defaultLabelEn: 'Platform Promo Codes', iconName: 'Gift' },
    { id: 'ui_studio', defaultLabelAr: 'استوديو الواجهات والثيمات', defaultLabelEn: 'UI Studio & Themes', iconName: 'Sparkles', lockedVisible: true },
    { id: 'themes', defaultLabelAr: 'محقن الثيمات المتقدم', defaultLabelEn: 'Custom Theme Injector', iconName: 'Code2' },
    { id: 'landing', defaultLabelAr: 'إدارة صفحة الهبوط', defaultLabelEn: 'Landing Page Content', iconName: 'LayoutTemplate' },
    { id: 'domain', defaultLabelAr: 'النطاق وربط الخادم', defaultLabelEn: 'Domain & Connectivity', iconName: 'Globe' },
  ],
  owner_admin: [
    { id: 'orders', defaultLabelAr: 'شاشات الكاشير والمطبخ', defaultLabelEn: 'Cashier / POS & KDS', iconName: 'BellRing' },
    { id: 'captain', defaultLabelAr: 'شاشة الكابتن', defaultLabelEn: 'Captain', iconName: 'UserCheck' },
    { id: 'hall_assignments', defaultLabelAr: 'توزيع الكباتن', defaultLabelEn: 'Captain Assignments', iconName: 'Users' },
    { id: 'stations', defaultLabelAr: 'الشاشات والمحطات', defaultLabelEn: 'Screens & Stations', iconName: 'Layers' },
    { id: 'staff', defaultLabelAr: 'المدير والكادر والصلاحيات', defaultLabelEn: 'Manager, Roles & Permissions', iconName: 'ShieldCheck' },
    { id: 'job_titles', defaultLabelAr: 'المسميات الوظيفية والصلاحيات', defaultLabelEn: 'Job Titles & RBAC', iconName: 'ShieldCheck' },
    { id: 'reports', defaultLabelAr: 'تقرير الورديات والحسابات', defaultLabelEn: 'Shifts & Vault Reports', iconName: 'Calculator' },
    { id: 'customers', defaultLabelAr: 'إدارة العملاء والولاء', defaultLabelEn: 'Customer CRM & Loyalty', iconName: 'Users' },
    { id: 'menu', defaultLabelAr: 'الأقسام والصور والأصناف', defaultLabelEn: 'Menu & Categories', iconName: 'LayoutGrid' },
    { id: 'offers', defaultLabelAr: 'العروض وأكواد الخصم', defaultLabelEn: 'Offers & Promo Codes', iconName: 'Tag' },
    { id: 'theme', defaultLabelAr: 'الثيم واللوجو والإعدادات', defaultLabelEn: 'Theme & Storefront', iconName: 'Palette' },
    { id: 'qr', defaultLabelAr: 'الصالات وأكواد QR', defaultLabelEn: 'Halls & Table QR Codes', iconName: 'QrCode' },
  ],
  manager_console: [
    { id: 'supervision', defaultLabelAr: 'لوحة الإشراف العام', defaultLabelEn: 'Supervision Console', iconName: 'Crown', lockedVisible: true },
    { id: 'stations', defaultLabelAr: 'الشاشات والمحطات', defaultLabelEn: 'Screens & Stations', iconName: 'Layers' },
    { id: 'menu_editor', defaultLabelAr: 'المنيو والأصناف', defaultLabelEn: 'Digital Menu & Items', iconName: 'Utensils' },
    { id: 'shift_reports', defaultLabelAr: 'تقرير الورديات', defaultLabelEn: 'Shift Reports', iconName: 'FileSpreadsheet' },
    { id: 'staff_management', defaultLabelAr: 'إدارة الكادر', defaultLabelEn: 'Staff & Permissions', iconName: 'ShieldCheck' },
    { id: 'job_titles', defaultLabelAr: 'المسميات الوظيفية', defaultLabelEn: 'Job Titles & RBAC', iconName: 'ShieldCheck' },
    { id: 'customers', defaultLabelAr: 'إدارة العملاء والولاء', defaultLabelEn: 'Customers & CRM', iconName: 'Users' },
    { id: 'cashier', defaultLabelAr: 'شاشة الكاشير', defaultLabelEn: 'Cashier / POS', iconName: 'Receipt' },
    { id: 'captain', defaultLabelAr: 'شاشة الكابتن', defaultLabelEn: 'Captain', iconName: 'UserCheck' },
    { id: 'hall_assignments', defaultLabelAr: 'توزيع الكباتن', defaultLabelEn: 'Captain Assignments', iconName: 'Users' },
    { id: 'kitchen', defaultLabelAr: 'المطبخ', defaultLabelEn: 'Kitchen KDS', iconName: 'ChefHat' },
    { id: 'bar', defaultLabelAr: 'البار', defaultLabelEn: 'Bar KDS', iconName: 'Wine' },
    { id: 'pastry', defaultLabelAr: 'الباستري', defaultLabelEn: 'Pastry KDS', iconName: 'Croissant' },
    { id: 'halls', defaultLabelAr: 'الصالات وأكواد QR', defaultLabelEn: 'Halls & Table QR Codes', iconName: 'QrCode' },
  ],
  cashier_kds: [
    { id: 'cashier_station', defaultLabelAr: 'شاشة الكاشير والتقفيل', defaultLabelEn: 'Cashier / POS & Checks', iconName: 'Receipt' },
    { id: 'drawer_handover', defaultLabelAr: 'الدرج وتسليم الوردية', defaultLabelEn: 'Cash Drawer & Handover', iconName: 'Wallet' },
    { id: 'kds_kitchen', defaultLabelAr: 'المطبخ الرئيسي', defaultLabelEn: 'Main Kitchen', iconName: 'ChefHat' },
    { id: 'kds_bar', defaultLabelAr: 'شاشة البار', defaultLabelEn: 'Bar KDS', iconName: 'Wine' },
    { id: 'kds_pastry', defaultLabelAr: 'شاشة الباستري', defaultLabelEn: 'Pastry KDS', iconName: 'Croissant' },
    { id: 'service_calls', defaultLabelAr: 'نداءات الطاولات والفواتير', defaultLabelEn: 'Table Calls & Checks', iconName: 'BellRing' },
  ],
  captain_waiter: [
    { id: 'grid', defaultLabelAr: 'خريطة الطاولات الحية', defaultLabelEn: 'Live Table Floor Map', iconName: 'Grid', lockedVisible: true },
    { id: 'pos', defaultLabelAr: 'نقطة طلب الكابتن السريعة', defaultLabelEn: 'Fast Order Pad', iconName: 'Utensils' },
    { id: 'calls', defaultLabelAr: 'النداءات والأصناف الجاهزة', defaultLabelEn: 'Service Calls & Ready', iconName: 'BellRing' },
  ],
  landing_page: [
    { id: 'hero', defaultLabelAr: 'القسم الترحيبي', defaultLabelEn: 'Overview Showcase', iconName: 'Sparkles' },
    { id: 'themes', defaultLabelAr: 'معرض الثيمات التفاعلية', defaultLabelEn: 'Interactive Themes', iconName: 'Palette' },
    { id: 'features', defaultLabelAr: 'مميزات المنصة', defaultLabelEn: 'Platform Capabilities', iconName: 'Layers' },
    { id: 'operations', defaultLabelAr: 'تشغيل الصالة والمطبخ', defaultLabelEn: 'Floor & KDS Workflow', iconName: 'Utensils' },
    { id: 'loyalty', defaultLabelAr: 'منظومة الولاء وإدارة العملاء', defaultLabelEn: 'Loyalty & Customer CRM', iconName: 'Gift' },
    { id: 'pricing', defaultLabelAr: 'باقات الاشتراك والأسعار', defaultLabelEn: 'Pricing Plans', iconName: 'Calculator' },
    { id: 'tygos_promo', defaultLabelAr: 'منظومة Tygos السحابية', defaultLabelEn: 'Tygos Cloud ERP', iconName: 'ShieldCheck' },
    { id: 'demos', defaultLabelAr: 'المطاعم التجريبية الحية', defaultLabelEn: 'Live Demo Menus', iconName: 'Eye' },
    { id: 'owner_login', defaultLabelAr: 'دخول أصحاب المطاعم', defaultLabelEn: 'Owner Login Portal', iconName: 'UserCheck' },
  ],
};

export function createDefaultScreenConfig(screenId: UiScreenId): UiScreenConfig {
  switch (screenId) {
    case 'super_admin':
      return {
        themeId: 'sand_sapphire',
        layoutStyle: 'sidebar_cards',
        cardRadius: 'rounded',
        cards: [
          {
            id: 'card_core_sa',
            titleAr: 'إدارة المنصة والمشتركين',
            titleEn: 'Platform & Tenants',
            buttonIds: ['tenants', 'promos'],
          },
          {
            id: 'card_studio_sa',
            titleAr: 'التصميم والثيمات والصفحة الرئيسية',
            titleEn: 'Visual Studio & Landing',
            buttonIds: ['ui_studio', 'themes', 'landing'],
          },
          {
            id: 'card_infra_sa',
            titleAr: 'البنية والنطاق والأمان',
            titleEn: 'Domain & Infrastructure',
            buttonIds: ['domain'],
          },
        ],
        buttonOverrides: {},
      };
    case 'owner_admin':
      return {
        themeId: 'sand_sapphire',
        layoutStyle: 'sidebar_cards',
        cardRadius: 'rounded',
        cards: [
          {
            id: 'card_ops_owner',
            titleAr: 'التشغيل اليومي المباشر',
            titleEn: 'Daily Floor Operations',
            buttonIds: ['orders', 'captain', 'hall_assignments', 'stations'],
          },
          {
            id: 'card_team_finance',
            titleAr: 'الإدارة والكادر والخزنة',
            titleEn: 'Team, Roles & Finance',
            buttonIds: ['staff', 'job_titles', 'reports', 'customers'],
          },
          {
            id: 'card_menu_brand',
            titleAr: 'المنيو والعروض والهوية',
            titleEn: 'Menu, Promos & Branding',
            buttonIds: ['menu', 'offers', 'theme', 'qr'],
          },
        ],
        buttonOverrides: {},
      };
    case 'manager_console':
      return {
        themeId: 'sand_sapphire',
        layoutStyle: 'top_deck',
        cardRadius: 'rounded',
        cards: [
          {
            id: 'card_mgr_lead',
            titleAr: 'القيادة والإشراف',
            titleEn: 'Leadership & Reports',
            buttonIds: ['supervision', 'stations', 'menu_editor', 'shift_reports', 'staff_management', 'job_titles', 'customers'],
          },
          {
            id: 'card_mgr_stations',
            titleAr: 'شاشات الصالة والمطبخ',
            titleEn: 'Operational Screens',
            buttonIds: ['cashier', 'captain', 'hall_assignments', 'kitchen', 'bar', 'pastry', 'halls'],
          },
        ],
        buttonOverrides: {},
      };
    case 'cashier_kds':
      return {
        themeId: 'sand_sapphire',
        layoutStyle: 'top_deck',
        cardRadius: 'rounded',
        cards: [
          {
            id: 'card_cashier_pos',
            titleAr: 'الكاشير والخزنة',
            titleEn: 'Cashier / POS & Cash Drawer',
            buttonIds: ['cashier_station', 'drawer_handover', 'service_calls'],
          },
          {
            id: 'card_kds_stations',
            titleAr: 'شاشات المطبخ ومحطات التحضير',
            titleEn: 'Kitchen Display System (KDS)',
            buttonIds: ['kds_kitchen', 'kds_bar', 'kds_pastry'],
          },
        ],
        buttonOverrides: {},
      };
    case 'captain_waiter':
      return {
        themeId: 'sand_sapphire',
        layoutStyle: 'top_deck',
        cardRadius: 'rounded',
        cards: [
          {
            id: 'card_captain_main',
            titleAr: 'شاشة الكابتن السريعة',
            titleEn: 'Captain Controls',
            buttonIds: ['grid', 'pos', 'calls'],
          },
        ],
        buttonOverrides: {},
      };
    case 'landing_page':
      return {
        themeId: 'sand_sapphire',
        layoutStyle: 'top_deck',
        cardRadius: 'rounded',
        cards: [
          {
            id: 'card_landing_showcase',
            titleAr: 'واجهة العرض والتعريف',
            titleEn: 'Showcase Sections',
            buttonIds: ['hero', 'themes', 'features', 'operations', 'loyalty'],
          },
          {
            id: 'card_landing_convert',
            titleAr: 'الباقات والتجربة والدخول',
            titleEn: 'Plans, Demos & Login',
            buttonIds: ['pricing', 'tygos_promo', 'demos', 'owner_login'],
          },
        ],
        buttonOverrides: {},
      };
  }
}

export const DEFAULT_PLATFORM_UI_CONFIG: PlatformUiConfig = {
  id: 'ui_config',
  version: 1,
  publishedBy: 'tygosibs@gmail.com',
  refreshNoticeAr:
    'عفواً، سيتم تحديث المنظومة وتحميل الشاشة من جديد — لا تقلق نهائياً، لن يتأثر أي شيء من شغلك الحالي أو طلباتك أو البيانات التي لم يتم حفظها بعد.',
  refreshNoticeEn:
    'System UI update in progress — please do not worry, none of your open orders, active shifts, or unsaved work will be lost or signed out.',
  screens: {
    super_admin: createDefaultScreenConfig('super_admin'),
    owner_admin: createDefaultScreenConfig('owner_admin'),
    manager_console: createDefaultScreenConfig('manager_console'),
    cashier_kds: createDefaultScreenConfig('cashier_kds'),
    captain_waiter: createDefaultScreenConfig('captain_waiter'),
    landing_page: createDefaultScreenConfig('landing_page'),
  },
};

export function normalizeScreenConfig(
  screenId: UiScreenId,
  raw?: Partial<UiScreenConfig> | null
): UiScreenConfig {
  const def = createDefaultScreenConfig(screenId);
  const catalog = UI_ACTION_CATALOG[screenId];
  const validIds = new Set(catalog.map((c) => c.id));
  const themeId: ScreenThemeId =
    raw?.themeId && raw.themeId in SCREEN_THEMES ? raw.themeId : def.themeId;
  const layoutStyle =
    raw?.layoutStyle === 'compact_rail' || raw?.layoutStyle === 'top_deck' || raw?.layoutStyle === 'sidebar_cards'
      ? raw.layoutStyle
      : def.layoutStyle;
  const cardRadius: CardRadiusStyle =
    raw?.cardRadius === 'sharp' || raw?.cardRadius === 'soft' || raw?.cardRadius === 'rounded'
      ? raw.cardRadius
      : def.cardRadius;

  const seenButtons = new Set<string>();
  const rawCards = Array.isArray(raw?.cards) && raw.cards.length > 0 ? raw.cards : def.cards;
  const cleanCards = rawCards
    .slice(0, 12)
    .map((card, idx) => {
      const btnList: string[] = [];
      if (Array.isArray(card.buttonIds)) {
        for (const bid of card.buttonIds) {
          if (typeof bid === 'string' && validIds.has(bid) && !seenButtons.has(bid)) {
            seenButtons.add(bid);
            btnList.push(bid);
          }
        }
      }
      return {
        id: (card.id || `card_${idx + 1}`).toString().slice(0, 64),
        titleAr: (card.titleAr || `بطاقة ${idx + 1}`).toString().slice(0, 80),
        titleEn: (card.titleEn || `Group ${idx + 1}`).toString().slice(0, 80),
        buttonIds: btnList,
      };
    });

  if (cleanCards.length === 0) {
    cleanCards.push(...def.cards.map((c) => ({ ...c, buttonIds: [...c.buttonIds] })));
    cleanCards.forEach((c) => c.buttonIds.forEach((b) => seenButtons.add(b)));
  }

  // Ensure every catalog action exists in at least one card so no feature is ever orphaned
  const missingIds = catalog.map((c) => c.id).filter((id) => !seenButtons.has(id));
  if (missingIds.length > 0) {
    cleanCards[0] = {
      ...cleanCards[0],
      buttonIds: [...cleanCards[0].buttonIds, ...missingIds],
    };
  }

  const buttonOverrides: Record<string, { labelAr?: string; labelEn?: string; hidden?: boolean }> = {};
  if (raw?.buttonOverrides && typeof raw.buttonOverrides === 'object') {
    for (const [k, v] of Object.entries(raw.buttonOverrides)) {
      if (!validIds.has(k) || !v || typeof v !== 'object') continue;
      const catItem = catalog.find((c) => c.id === k);
      buttonOverrides[k] = {
        ...(typeof v.labelAr === 'string' && v.labelAr.trim() ? { labelAr: v.labelAr.trim().slice(0, 80) } : {}),
        ...(typeof v.labelEn === 'string' && v.labelEn.trim() ? { labelEn: v.labelEn.trim().slice(0, 80) } : {}),
        hidden: catItem?.lockedVisible ? false : Boolean(v.hidden),
      };
    }
  }

  const accentColorOverride =
    typeof raw?.accentColorOverride === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.accentColorOverride)
      ? raw.accentColorOverride
      : undefined;

  const defaultPageId =
    typeof raw?.defaultPageId === 'string' && validIds.has(raw.defaultPageId)
      ? raw.defaultPageId
      : undefined;

  return {
    themeId,
    layoutStyle,
    cardRadius,
    ...(accentColorOverride ? { accentColorOverride } : {}),
    ...(defaultPageId ? { defaultPageId } : {}),
    cards: cleanCards,
    buttonOverrides,
  };
}

export function normalizePlatformUiConfig(
  raw?: Partial<PlatformUiConfig> | null
): PlatformUiConfig {
  const screenIds: UiScreenId[] = [
    'super_admin',
    'owner_admin',
    'manager_console',
    'cashier_kds',
    'captain_waiter',
    'landing_page',
  ];
  const screens = {} as Record<UiScreenId, UiScreenConfig>;
  for (const id of screenIds) {
    screens[id] = normalizeScreenConfig(id, raw?.screens?.[id]);
  }
  return {
    id: 'ui_config',
    version: typeof raw?.version === 'number' && raw.version >= 1 ? Math.round(raw.version) : 1,
    publishedBy:
      typeof raw?.publishedBy === 'string' && raw.publishedBy.trim()
        ? raw.publishedBy.trim().slice(0, 128)
        : 'tygosibs@gmail.com',
    refreshNoticeAr:
      typeof raw?.refreshNoticeAr === 'string' && raw.refreshNoticeAr.trim()
        ? raw.refreshNoticeAr.trim().slice(0, 300)
        : DEFAULT_PLATFORM_UI_CONFIG.refreshNoticeAr,
    refreshNoticeEn:
      typeof raw?.refreshNoticeEn === 'string' && raw.refreshNoticeEn.trim()
        ? raw.refreshNoticeEn.trim().slice(0, 300)
        : DEFAULT_PLATFORM_UI_CONFIG.refreshNoticeEn,
    screens,
    updatedAt: raw?.updatedAt,
  };
}

export function getRadiusClasses(radius: CardRadiusStyle) {
  switch (radius) {
    case 'sharp':
      return { card: 'rounded-lg', button: 'rounded-md', pill: 'rounded-md' };
    case 'soft':
      return { card: 'rounded-3xl', button: 'rounded-2xl', pill: 'rounded-xl' };
    case 'rounded':
    default:
      return { card: 'rounded-2xl', button: 'rounded-xl', pill: 'rounded-lg' };
  }
}
