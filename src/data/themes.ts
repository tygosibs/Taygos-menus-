import { ActiveTheme, ThemeMeta } from '../types/menu';

export const MENU_THEMES: ThemeMeta[] = [
  {
    id: 'theme-1',
    number: 1,
    name: 'كتاب المنيو ثلاثي الأبعاد',
    englishName: '3D Flipbook & Floating Dish',
    description:
      'كتاب منيو فاخر بتقليب صفحات ثلاثي الأبعاد، صور أطباق طافية، وانتقال تفاعلي للطعام مع الحجم والإضافات.',
    recommendedColor: '#A61C1C',
    bgPreview: '#1B1612',
    cardPreview: '#FAF5EE',
    textPreview: '#F7EFE4',
    isDark: true,
    isFlagship: true,
  },
  {
    id: 'theme-2',
    number: 2,
    name: 'العجلة المقوّسة التفاعلية',
    englishName: 'Curved Wheel Interactive',
    description:
      'شاشة مقسومة بقوس علوي بارز وأيقونات أقسام دائرية مع كاروسيل مركزي تفاعلي للأطباق.',
    recommendedColor: '#A61C1C',
    bgPreview: '#A61C1C',
    cardPreview: '#FFFFFF',
    textPreview: '#FFFFFF',
    isDark: false,
  },
  {
    id: 'theme-3',
    number: 3,
    name: 'المودرن الفاتح بالشريط العائم',
    englishName: 'Modern Light Floating',
    description:
      'خلفية فاتحة ناعمة مع بطاقات نظيفة بعمودين، شريط أقسام دائري، وشريط تنقل سفلي أسود عائم.',
    recommendedColor: '#111111',
    bgPreview: '#F5F5F5',
    cardPreview: '#FFFFFF',
    textPreview: '#111111',
    isDark: false,
  },
  {
    id: 'theme-4',
    number: 4,
    name: 'الوضع الليلي الجريء',
    englishName: 'Midnight Burger Dark',
    description:
      'أسود مطفي عميق وبطاقات داكنة مع أزرار عنبرية متوهجة وتباين عالٍ لمطاعم البرجر والمشاوي.',
    recommendedColor: '#F59E0B',
    bgPreview: '#0F0F0F',
    cardPreview: '#1A1A1A',
    textPreview: '#FAFAFA',
    isDark: true,
  },
  {
    id: 'theme-5',
    number: 5,
    name: 'اللاونج الفاخر الذهبي',
    englishName: 'Luxury Lounge Gold',
    description:
      'رمادي فحمي داكن مع إطارات ذهبية معدنية وأزرار أقسام انسيابية تبرز أطباق الفاين دايننج.',
    recommendedColor: '#D4AF37',
    bgPreview: '#12151C',
    cardPreview: '#181C25',
    textPreview: '#F5F2EB',
    isDark: true,
  },
  {
    id: 'theme-6',
    number: 6,
    name: 'منيو الريلز والستوري',
    englishName: 'Full-Screen Reels / Stories',
    description:
      'عرض عمودي بملء الشاشة بأسلوب الريلز والستوريز مع تدرج سينمائي وأيقونات طلب سريعة طافية.',
    recommendedColor: '#E11D48',
    bgPreview: '#09090B',
    cardPreview: '#18181B',
    textPreview: '#FFFFFF',
    isDark: true,
  },
  {
    id: 'theme-7',
    number: 7,
    name: 'الكافيهات والمخبوزات الدافئ',
    englishName: 'Warm Cafe & Bakery Minimal',
    description:
      'خلفية كريمية دافئة وخطوط بنية بدرجة الإسبريسو مع صفوف تحريرية أنيقة للقهوة والمخبوزات.',
    recommendedColor: '#5C4033',
    bgPreview: '#FAF7F2',
    cardPreview: '#FFFFFF',
    textPreview: '#5C4033',
    isDark: false,
  },
  {
    id: 'theme-8',
    number: 8,
    name: 'شبكة البنتو العصرية',
    englishName: 'Modern Bento Box Grid',
    description:
      'تصميم شبكة غير متماثل يبرز الأطباق الأكثر طلباً بمساحة مزدوجة مع بطاقات مدمجة للأصناف الأخرى.',
    recommendedColor: '#0F766E',
    bgPreview: '#F4F6F8',
    cardPreview: '#FFFFFF',
    textPreview: '#0F172A',
    isDark: false,
  },
  {
    id: 'theme-9',
    number: 9,
    name: 'كشك الطلب السريع',
    englishName: 'Fast-Food Kiosk Express',
    description:
      'واجهة طلب فائقة السرعة مستوحاة من أجهزة الخدمة الذاتية مع أزرار + و - مباشرة على البطاقة.',
    recommendedColor: '#DC2626',
    bgPreview: '#FFFFFF',
    cardPreview: '#F8FAFC',
    textPreview: '#0F172A',
    isDark: false,
  },
];

export const COLOR_PRESETS = [
  { name: 'عنابي كلاسيكي', hex: '#A61C1C' },
  { name: 'عنبر جريء', hex: '#F59E0B' },
  { name: 'ذهبي فاخر', hex: '#D4AF37' },
  { name: 'أسود عصري', hex: '#111111' },
  { name: 'زمردي حديث', hex: '#0F766E' },
  { name: 'بني إسبريسو', hex: '#5C4033' },
  { name: 'ياقوتي', hex: '#E11D48' },
];

export function isCustomThemeId(themeId?: string | null): boolean {
  return Boolean(themeId && themeId.startsWith('custom_'));
}

export function getThemeMeta(themeId: ActiveTheme): ThemeMeta {
  const found = MENU_THEMES.find((t) => t.id === themeId);
  if (found) return found;
  if (isCustomThemeId(themeId)) {
    return {
      id: themeId,
      number: 10,
      name: 'ثيم مخصص (مُضاف)',
      englishName: 'Custom Injected Theme',
      description: 'تصميم مخصص تم حقنه من لوحة الإدارة العليا.',
      recommendedColor: '#111111',
      bgPreview: '#18181B',
      cardPreview: '#FFFFFF',
      textPreview: '#FAFAFA',
      isDark: false,
    };
  }
  return MENU_THEMES[0];
}
