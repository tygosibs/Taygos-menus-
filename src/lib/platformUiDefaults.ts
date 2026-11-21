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
    labelAr: 'لوحة السوبر أدمن',
    labelEn: 'Super Admin Console',
    descAr: 'تحكم في بطاقات وأزرار وثيم لوحة السوبر أدمن الخاصة بك شخصياً.',
    descEn: 'Customize cards, button labels, layout, and theme of your own Super Admin console.',
  },
  owner_admin: {
    id: 'owner_admin',
    labelAr: 'لوحة صاحب المطعم (/admin)',
    labelEn: 'Restaurant Owner (/admin)',
    descAr: 'إعادة تنظيم بطاقات وأزرار وثيم لوحة المالك بدون المساس بخطوط سير العمل.',
    descEn: 'Reorganize cards, tabs, labels, and theme of the Owner dashboard safely.',
  },
  manager_console: {
    id: 'manager_console',
    labelAr: 'شاشة مدير المطعم',
    labelEn: 'Manager Supervision',
    descAr: 'ترتيب بطاقات الإشراف والمراقبة وشاشات المدير والأقسام.',
    descEn: 'Arrange manager supervision cards, stations, and quick navigation.',
  },
  cashier_kds: {
    id: 'cashier_kds',
    labelAr: 'الكاشير والمطبخ والبار',
    labelEn: 'Cashier & Multi-KDS',
    descAr: 'تخصيص ثيم وأزرار وتبويبات الكاشير ومحطات التحضير.',
    descEn: 'Customize theme, labels, and layout for Cashier and kitchen prep stations.',
  },
  captain_waiter: {
    id: 'captain_waiter',
    labelAr: 'شاشة الكابتن (الويتر)',
    labelEn: 'Captain / Waiter',
    descAr: 'تنظيم وتسمية أزرار خريطة الطاولات ونقطة الطلب والنداءات.',
    descEn: 'Customize floor map, quick order pad, and service call views.',
  },
  landing_page: {
    id: 'landing_page',
    labelAr: 'صفحة الهبوط الرئيسية (/)',
    labelEn: 'Public Landing Page',
    descAr: 'تغيير روح وألوان صفحة الهبوط وأسماء الأزرار وترتيب أقسامها.',
    descEn: 'Customize landing page theme, button copy, and section order.',
  },
};

export const SCREEN_THEMES: Record<ScreenThemeId, ScreenThemeTokens> = {
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
    mutedText: '#625E55',
    sidebarBg: '#0B0D12',
    sidebarBorder: '#1E222D',
    sidebarText: '#F5F3EE',
    sidebarMuted: '#98948A',
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
    mutedText: '#6B675E',
    sidebarBg: '#FFFFFF',
    sidebarBorder: '#E6E2D8',
    sidebarText: '#141413',
    sidebarMuted: '#78736A',
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
    mutedText: '#4B6B5E',
    sidebarBg: '#063B2C',
    sidebarBorder: '#0D503D',
    sidebarText: '#ECFDF5',
    sidebarMuted: '#99C7B6',
    sidebarActiveBg: '#10B981',
    sidebarActiveText: '#052E21',
    headerBg: '#FFFFFF',
    headerBorder: '#D4E6DD',
    headerText: '#0B241C',
    accentHex: '#059669',
    accentTextHex: '#FFFFFF',
    cardShadow: '0 2px 6px rgba(6, 59, 44, 0.05)',
    previewSwatches: ['#063B2C', '#10B981', '#F2F7F5'],
  },
  midnight_sapphire: {
    id: 'midnight_sapphire',
    nameAr: 'الياقوت الليلي للتشغيل',
    nameEn: 'Midnight Sapphire',
    taglineAr: 'أزرق ياقوتي واضح ومثالي للكاشير والمطبخ',
    taglineEn: 'High-clarity cobalt slate built for high-speed POS and KDS screens',
    isDarkShell: true,
    canvasBg: '#F1F5F9',
    canvasText: '#0F172A',
    surfaceBg: '#FFFFFF',
    surfaceSubtleBg: '#F8FAFC',
    surfaceBorder: '#CBD5E1',
    surfaceText: '#0F172A',
    mutedText: '#475569',
    sidebarBg: '#0F172A',
    sidebarBorder: '#1E293B',
    sidebarText: '#F8FAFC',
    sidebarMuted: '#94A3B8',
    sidebarActiveBg: '#0284C7',
    sidebarActiveText: '#FFFFFF',
    headerBg: '#FFFFFF',
    headerBorder: '#CBD5E1',
    headerText: '#0F172A',
    accentHex: '#0284C7',
    accentTextHex: '#FFFFFF',
    cardShadow: '0 2px 6px rgba(15, 23, 42, 0.06)',
    previewSwatches: ['#0F172A', '#0284C7', '#F1F5F9'],
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
    mutedText: '#6F5546',
    sidebarBg: '#2A1810',
    sidebarBorder: '#41271B',
    sidebarText: '#FBF7F2',
    sidebarMuted: '#C7AE9E',
    sidebarActiveBg: '#D97706',
    sidebarActiveText: '#1F110A',
    headerBg: '#FFFDF9',
    headerBorder: '#E5D8C8',
    headerText: '#261710',
    accentHex: '#C2410C',
    accentTextHex: '#FFFFFF',
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
    mutedText: '#526075',
    sidebarBg: '#F8FAFC',
    sidebarBorder: '#DDE3EC',
    sidebarText: '#0F172A',
    sidebarMuted: '#64748B',
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
    mutedText: '#734B56',
    sidebarBg: '#3E0B18',
    sidebarBorder: '#5A1324',
    sidebarText: '#FFF5F7',
    sidebarMuted: '#D6A8B3',
    sidebarActiveBg: '#EAB308',
    sidebarActiveText: '#2A0A12',
    headerBg: '#FFFFFF',
    headerBorder: '#EAD5DA',
    headerText: '#2A0A12',
    accentHex: '#9F1239',
    accentTextHex: '#FFFFFF',
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
    mutedText: '#765D49',
    sidebarBg: '#FFFFFF',
    sidebarBorder: '#F0DEC9',
    sidebarText: '#1F1610',
    sidebarMuted: '#876B54',
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
    { id: 'promos', defaultLabelAr: 'أكواد الخصم والهدايا', defaultLabelEn: 'SaaS Promo Codes', iconName: 'Gift' },
    { id: 'ui_studio', defaultLabelAr: 'استوديو الواجهات والثيمات', defaultLabelEn: 'UI Studio & Themes', iconName: 'Sparkles', lockedVisible: true },
    { id: 'themes', defaultLabelAr: 'محقن الثيمات المتقدم', defaultLabelEn: 'Custom Theme Injector', iconName: 'Code2' },
    { id: 'landing', defaultLabelAr: 'إدارة صفحة الهبوط', defaultLabelEn: 'Landing Page CMS', iconName: 'LayoutTemplate' },
    { id: 'domain', defaultLabelAr: 'النطاق وربط Firebase', defaultLabelEn: 'Domain & Firebase', iconName: 'Globe' },
  ],
  owner_admin: [
    { id: 'orders', defaultLabelAr: 'شاشات الكاشير والمطبخ', defaultLabelEn: 'Cashier & Multi-KDS', iconName: 'BellRing' },
    { id: 'captain', defaultLabelAr: 'شاشة الكابتن (الويتر)', defaultLabelEn: 'Captain / Waiter', iconName: 'UserCheck' },
    { id: 'staff', defaultLabelAr: 'المدير والكادر والصلاحيات', defaultLabelEn: 'Manager & Staff RBAC', iconName: 'ShieldCheck' },
    { id: 'reports', defaultLabelAr: 'تقرير الورديات والحسابات', defaultLabelEn: 'Shifts & Vault Reports', iconName: 'Calculator' },
    { id: 'customers', defaultLabelAr: 'عملائي (CRM والتسويق)', defaultLabelEn: 'Customers Smart CRM', iconName: 'Users' },
    { id: 'menu', defaultLabelAr: 'الأقسام والصور والأصناف', defaultLabelEn: 'Menu & Categories', iconName: 'LayoutGrid' },
    { id: 'offers', defaultLabelAr: 'العروض وأكواد الخصم', defaultLabelEn: 'Offers & Promo Codes', iconName: 'Tag' },
    { id: 'theme', defaultLabelAr: 'الثيم واللوجو والإعدادات', defaultLabelEn: 'Theme & Storefront', iconName: 'Palette' },
    { id: 'qr', defaultLabelAr: 'الصالات وأكواد QR', defaultLabelEn: 'Halls & Table QRs', iconName: 'QrCode' },
  ],
  manager_console: [
    { id: 'supervision', defaultLabelAr: 'لوحة الإشراف العام', defaultLabelEn: 'Supervision Console', iconName: 'Crown', lockedVisible: true },
    { id: 'menu_editor', defaultLabelAr: 'المنيو والأصناف', defaultLabelEn: 'Menu & Availability', iconName: 'Utensils' },
    { id: 'shift_reports', defaultLabelAr: 'تقرير الورديات', defaultLabelEn: 'Shift Reports', iconName: 'FileSpreadsheet' },
    { id: 'staff_management', defaultLabelAr: 'إدارة الكادر', defaultLabelEn: 'Staff Management', iconName: 'ShieldCheck' },
    { id: 'cashier', defaultLabelAr: 'شاشة الكاشير', defaultLabelEn: 'Cashier Screen', iconName: 'Receipt' },
    { id: 'captain', defaultLabelAr: 'شاشة الكابتن', defaultLabelEn: 'Captain Screen', iconName: 'UserCheck' },
    { id: 'kitchen', defaultLabelAr: 'المطبخ', defaultLabelEn: 'Kitchen KDS', iconName: 'ChefHat' },
    { id: 'bar', defaultLabelAr: 'البار', defaultLabelEn: 'Bar Station', iconName: 'Wine' },
    { id: 'pastry', defaultLabelAr: 'الباستري', defaultLabelEn: 'Pastry Station', iconName: 'Croissant' },
    { id: 'halls', defaultLabelAr: 'الصالات و QR', defaultLabelEn: 'Halls & QR', iconName: 'QrCode' },
  ],
  cashier_kds: [
    { id: 'cashier_station', defaultLabelAr: 'شاشة الكاشير والتقفيل', defaultLabelEn: 'Cashier & Settlement', iconName: 'Receipt' },
    { id: 'drawer_handover', defaultLabelAr: 'ح/الدرج والتسليم', defaultLabelEn: 'Drawer & Handover', iconName: 'Wallet' },
    { id: 'kds_kitchen', defaultLabelAr: 'المطبخ الرئيسي', defaultLabelEn: 'Main Kitchen', iconName: 'ChefHat' },
    { id: 'kds_bar', defaultLabelAr: 'شاشة البار', defaultLabelEn: 'Bar KDS', iconName: 'Wine' },
    { id: 'kds_pastry', defaultLabelAr: 'شاشة الباستري', defaultLabelEn: 'Pastry KDS', iconName: 'Croissant' },
    { id: 'service_calls', defaultLabelAr: 'نداءات الطاولات والفواتير', defaultLabelEn: 'Table Calls & Bills', iconName: 'BellRing' },
  ],
  captain_waiter: [
    { id: 'grid', defaultLabelAr: 'خريطة الترابيزات الحية', defaultLabelEn: 'Live Table Floor Map', iconName: 'Grid', lockedVisible: true },
    { id: 'pos', defaultLabelAr: 'نقطة طلب الكابتن (بدون صور)', defaultLabelEn: 'Fast Order Pad', iconName: 'Utensils' },
    { id: 'calls', defaultLabelAr: 'النداءات والأصناف الجاهزة', defaultLabelEn: 'Service Calls & Ready', iconName: 'BellRing' },
  ],
  landing_page: [
    { id: 'hero', defaultLabelAr: 'القسم الترحيبي (Hero)', defaultLabelEn: 'Hero Showcase', iconName: 'Sparkles' },
    { id: 'themes', defaultLabelAr: 'معرض الثيمات التفاعلية', defaultLabelEn: 'Interactive Themes', iconName: 'Palette' },
    { id: 'features', defaultLabelAr: 'مميزات المنصة', defaultLabelEn: 'Platform Capabilities', iconName: 'Layers' },
    { id: 'operations', defaultLabelAr: 'تشغيل الصالة والمطبخ', defaultLabelEn: 'Floor & KDS Workflow', iconName: 'Utensils' },
    { id: 'loyalty', defaultLabelAr: 'منظومة الولاء وعملائي', defaultLabelEn: 'Loyalty & CRM', iconName: 'Gift' },
    { id: 'pricing', defaultLabelAr: 'باقات الاشتراك والأسعار', defaultLabelEn: 'Pricing Plans', iconName: 'Calculator' },
    { id: 'tygos_promo', defaultLabelAr: 'منظومة تايجوس Cloud ERP', defaultLabelEn: 'Tygos Cloud ERP', iconName: 'ShieldCheck' },
    { id: 'demos', defaultLabelAr: 'المطاعم التجريبية الحية', defaultLabelEn: 'Live Demo Menus', iconName: 'Eye' },
    { id: 'owner_login', defaultLabelAr: 'دخول أصحاب المطاعم', defaultLabelEn: 'Owner Login Portal', iconName: 'UserCheck' },
  ],
};

export function createDefaultScreenConfig(screenId: UiScreenId): UiScreenConfig {
  switch (screenId) {
    case 'super_admin':
      return {
        themeId: 'obsidian_gold',
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
        themeId: 'alabaster_editorial',
        layoutStyle: 'sidebar_cards',
        cardRadius: 'rounded',
        cards: [
          {
            id: 'card_ops_owner',
            titleAr: 'التشغيل اليومي المباشر',
            titleEn: 'Daily Floor Operations',
            buttonIds: ['orders', 'captain'],
          },
          {
            id: 'card_team_finance',
            titleAr: 'الإدارة والكادر والخزنة',
            titleEn: 'Team, Roles & Finance',
            buttonIds: ['staff', 'reports', 'customers'],
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
        themeId: 'nordic_slate',
        layoutStyle: 'top_deck',
        cardRadius: 'rounded',
        cards: [
          {
            id: 'card_mgr_lead',
            titleAr: 'القيادة والإشراف',
            titleEn: 'Leadership & Reports',
            buttonIds: ['supervision', 'menu_editor', 'shift_reports', 'staff_management'],
          },
          {
            id: 'card_mgr_stations',
            titleAr: 'شاشات الصالة والمطبخ',
            titleEn: 'Operational Screens',
            buttonIds: ['cashier', 'captain', 'kitchen', 'bar', 'pastry', 'halls'],
          },
        ],
        buttonOverrides: {},
      };
    case 'cashier_kds':
      return {
        themeId: 'midnight_sapphire',
        layoutStyle: 'top_deck',
        cardRadius: 'rounded',
        cards: [
          {
            id: 'card_cashier_pos',
            titleAr: 'الكاشير والخزنة',
            titleEn: 'Cashier & Drawer',
            buttonIds: ['cashier_station', 'drawer_handover', 'service_calls'],
          },
          {
            id: 'card_kds_stations',
            titleAr: 'محطات التحضير (KDS)',
            titleEn: 'Prep Stations',
            buttonIds: ['kds_kitchen', 'kds_bar', 'kds_pastry'],
          },
        ],
        buttonOverrides: {},
      };
    case 'captain_waiter':
      return {
        themeId: 'emerald_hospitality',
        layoutStyle: 'top_deck',
        cardRadius: 'rounded',
        cards: [
          {
            id: 'card_captain_main',
            titleAr: 'شاشة الكابتن السريعة',
            titleEn: 'Captain Floor Controls',
            buttonIds: ['grid', 'pos', 'calls'],
          },
        ],
        buttonOverrides: {},
      };
    case 'landing_page':
      return {
        themeId: 'alabaster_editorial',
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

  return {
    themeId,
    layoutStyle,
    cardRadius,
    ...(accentColorOverride ? { accentColorOverride } : {}),
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
