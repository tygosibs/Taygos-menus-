import { ActiveTheme, ThemeMeta } from '../types/menu';

export const MENU_THEMES: ThemeMeta[] = [
  {
    id: 'theme-1',
    number: 1,
    name: 'كتاب المنيو ثلاثي الأبعاد',
    shortName: 'كتاب 3D',
    englishName: '3D Flipbook & Floating Dish',
    shortName_en: '3D Flipbook',
    description:
      'كتاب منيو فاخر بتقليب صفحات ثلاثي الأبعاد، صور أطباق طافية، وانتقال تفاعلي للطعام مع الحجم والإضافات.',
    description_en:
      'Luxury physical-style menu book with 3D page flipping, floating dish photography, and smooth interactive customization.',
    coverImage: '/src/assets/images/theme_flipbook_3d_1794974837314.jpg',
    recommendedColor: '#A61C1C',
    bgPreview: '#1B1612',
    cardPreview: '#FAF5EE',
    textPreview: '#F7EFE4',
    isDark: true,
    isFlagship: true,
    badge: 'الأكثر طلباً 🔥',
    badge_en: 'Most Popular 🔥',
  },
  {
    id: 'theme-2',
    number: 2,
    name: 'العجلة المقوّسة التفاعلية',
    shortName: 'العجلة المقوّسة',
    englishName: 'Curved Wheel Interactive',
    shortName_en: 'Curved Wheel',
    description:
      'شاشة مقسومة بقوس علوي بارز وأيقونات أقسام دائرية مع كاروسيل مركزي تفاعلي للأطباق.',
    description_en:
      'Split-screen curved header arch, circular category wheel, and centered interactive dish carousel.',
    coverImage: '/src/assets/images/theme_curved_plates_1794974837119.jpg',
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
    shortName: 'المودرن العائم',
    englishName: 'Modern Light Floating',
    shortName_en: 'Modern Light',
    description:
      'خلفية فاتحة ناعمة مع بطاقات نظيفة بعمودين، شريط أقسام دائري، وشريط تنقل سفلي أسود عائم.',
    description_en:
      'Clean soft-gray editorial grid with circular category rail and a sleek floating dark bottom action bar.',
    coverImage: '/src/assets/images/pasta_truffle_modern_1794967837266.jpg',
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
    shortName: 'الوضع الليلي',
    englishName: 'Midnight Burger Dark',
    shortName_en: 'Midnight Dark',
    description:
      'أسود مطفي عميق وبطاقات داكنة مع أزرار عنبرية متوهجة وتباين عالٍ لمطاعم البرجر والمشاوي.',
    description_en:
      'Deep matte obsidian aesthetic with glowing amber highlights built for smash burgers and grill houses.',
    coverImage: '/src/assets/images/burger_smash_signature_1794967836686.jpg',
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
    shortName: 'اللاونج الذهبي',
    englishName: 'Luxury Lounge Gold',
    shortName_en: 'Luxury Gold',
    description:
      'رمادي فحمي داكن مع إطارات ذهبية معدنية وأزرار أقسام انسيابية تبرز أطباق الفاين دايننج.',
    description_en:
      'Charcoal fine-dining elegance framed in brushed gold accents and refined editorial typography.',
    coverImage: '/src/assets/images/steak_wagyu_luxury_1794967837741.jpg',
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
    shortName: 'منيو الريلز',
    englishName: 'Full-Screen Reels / Stories',
    shortName_en: 'Reels Stories',
    description:
      'عرض عمودي بملء الشاشة بأسلوب الريلز والستوريز مع تدرج سينمائي وأيقونات طلب سريعة طافية.',
    description_en:
      'Full-bleed vertical story-style showcase with cinematic gradients and floating quick-order actions.',
    coverImage: '/src/assets/images/pizza_neapolitan_story_1794967838282.jpg',
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
    shortName: 'الكافيه الدافئ',
    englishName: 'Warm Cafe & Bakery Minimal',
    shortName_en: 'Warm Cafe',
    description:
      'خلفية كريمية دافئة وخطوط بنية بدرجة الإسبريسو مع صفوف تحريرية أنيقة للقهوة والمخبوزات.',
    description_en:
      'Warm cream canvas and espresso typography crafted for specialty coffee bars and artisan bakeries.',
    coverImage: '/src/assets/images/coffee_latte_croissant_1794967837713.jpg',
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
    shortName: 'شبكة البنتو',
    englishName: 'Modern Bento Box Grid',
    shortName_en: 'Bento Grid',
    description:
      'تصميم شبكة غير متماثل يبرز الأطباق الأكثر طلباً بمساحة مزدوجة مع بطاقات مدمجة للأصناف الأخرى.',
    description_en:
      'Asymmetric modern Bento layout spotlighting signature bestsellers alongside crisp compact tiles.',
    coverImage: '/src/assets/images/theme_bento_grid_1794974838183.jpg',
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
    shortName: 'كشك سريع',
    englishName: 'Fast-Food Kiosk Express',
    shortName_en: 'Kiosk Express',
    description:
      'واجهة طلب فائقة السرعة مستوحاة من أجهزة الخدمة الذاتية مع أزرار + و - مباشرة على البطاقة.',
    description_en:
      'High-speed self-service kiosk interface with instant + / - quantity steppers right on every dish card.',
    coverImage: '/src/assets/images/theme_kiosk_fastfood_1794974837450.jpg',
    recommendedColor: '#DC2626',
    bgPreview: '#FFFFFF',
    cardPreview: '#F8FAFC',
    textPreview: '#0F172A',
    isDark: false,
  },
  {
    id: 'theme-11',
    number: 11,
    name: 'شات واتساب التفاعلي',
    shortName: 'شات واتساب',
    englishName: 'WhatsApp Interactive Chat',
    shortName_en: 'WhatsApp Chat',
    badge: 'VIP 👑',
    badge_en: 'VIP 👑',
    description:
      'تجربة طلب ثورية تشبه محادثة واتساب الحقيقية مع ردود فورية، أزرار أقسام سريعة، واقتراحات ذكية لزيادة المبيعات.',
    description_en:
      'Conversational WhatsApp-style ordering chat with instant replies, quick-reply categories, and smart upsell suggestions.',
    coverImage: '/src/assets/images/theme_whatsapp_chat_menu_1795014325145.jpg',
    recommendedColor: '#25D366',
    bgPreview: '#EFEAE2',
    cardPreview: '#FFFFFF',
    textPreview: '#111B21',
    isDark: false,
    isFlagship: true,
  },
];

export const COLOR_PRESETS = [
  { name: 'عنابي كلاسيكي', name_en: 'Classic Crimson', hex: '#A61C1C' },
  { name: 'عنبر جريء', name_en: 'Bold Amber', hex: '#F59E0B' },
  { name: 'ذهبي فاخر', name_en: 'Luxury Gold', hex: '#D4AF37' },
  { name: 'أسود عصري', name_en: 'Modern Jet', hex: '#111111' },
  { name: 'زمردي حديث', name_en: 'Emerald Teal', hex: '#0F766E' },
  { name: 'بني إسبريسو', name_en: 'Espresso Brown', hex: '#5C4033' },
  { name: 'ياقوتي', name_en: 'Ruby Rose', hex: '#E11D48' },
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
      shortName: 'ثيم مخصص',
      englishName: 'Custom Injected Theme',
      shortName_en: 'Custom Theme',
      description: 'تصميم مخصص تم حقنه من لوحة الإدارة العليا.',
      description_en: 'Bespoke custom HTML/CSS/JS theme injected via Super Admin.',
      coverImage: '/src/assets/images/theme_flipbook_3d_1794974837314.jpg',
      recommendedColor: '#111111',
      bgPreview: '#18181B',
      cardPreview: '#FFFFFF',
      textPreview: '#FAFAFA',
      isDark: false,
    };
  }
  return MENU_THEMES[0];
}
