import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  BellRing,
  Check,
  ChefHat,
  Coffee,
  CreditCard,
  Flame,
  Gift,
  Languages,
  Lock,
  Monitor,
  Palette,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
  Tag,
  UserCheck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { MENU_THEMES } from '../../data/themes';
import { CustomTheme } from '../../types/menu';

interface LandingVisualShowcasesProps {
  customThemes: CustomTheme[];
  onScrollToContact: () => void;
}

type ShowcaseCategoryKey = 'grills' | 'appetizers' | 'drinks';
type ShowcaseRoleId = 'cashier' | 'captain' | 'kds' | 'manager' | 'owner';

interface ThemeVisualStyle {
  canvasBg: string;
  surfaceBg: string;
  subtleBg: string;
  borderColor: string;
  textColor: string;
  mutedTextColor: string;
  accentBg: string;
  accentText: string;
  cardRadiusClass: string;
  badgeRadiusClass: string;
  headingStyleClass: string;
  layoutHintAr: string;
}

const THEME_VISUAL_STYLES: Record<string, ThemeVisualStyle> = {
  'theme-1': {
    canvasBg: '#1B1612',
    surfaceBg: '#FAF5EE',
    subtleBg: '#EFE6D8',
    borderColor: '#D6C6B2',
    textColor: '#241812',
    mutedTextColor: '#6C5849',
    accentBg: '#A61C1C',
    accentText: '#FAF5EE',
    cardRadiusClass: 'rounded-lg',
    badgeRadiusClass: 'rounded-sm',
    headingStyleClass: 'tracking-tight',
    layoutHintAr: 'تخطيط كتاب فاخر بحواف كلاسيكية',
  },
  'theme-2': {
    canvasBg: '#A61C1C',
    surfaceBg: '#FFFFFF',
    subtleBg: '#FDF2F2',
    borderColor: '#F3D1D1',
    textColor: '#1F1414',
    mutedTextColor: '#6B4C4C',
    accentBg: '#A61C1C',
    accentText: '#FFFFFF',
    cardRadiusClass: 'rounded-3xl',
    badgeRadiusClass: 'rounded-full',
    headingStyleClass: 'tracking-normal',
    layoutHintAr: 'قوس علوي بارز وزوايا دائرية ناعمة',
  },
  'theme-3': {
    canvasBg: '#F5F5F5',
    surfaceBg: '#FFFFFF',
    subtleBg: '#EFEFEF',
    borderColor: '#E2E2E2',
    textColor: '#111111',
    mutedTextColor: '#5A5A5A',
    accentBg: '#111111',
    accentText: '#FFFFFF',
    cardRadiusClass: 'rounded-xl',
    badgeRadiusClass: 'rounded-md',
    headingStyleClass: 'tracking-tight',
    layoutHintAr: 'شبكة فاتحة نظيفة مع شريط سفلي عائم',
  },
  'theme-4': {
    canvasBg: '#0F0F0F',
    surfaceBg: '#1A1A1A',
    subtleBg: '#262626',
    borderColor: '#333333',
    textColor: '#FAFAFA',
    mutedTextColor: '#B5B5B5',
    accentBg: '#F59E0B',
    accentText: '#0F0F0F',
    cardRadiusClass: 'rounded-lg',
    badgeRadiusClass: 'rounded',
    headingStyleClass: 'tracking-wide',
    layoutHintAr: 'وضع ليلي جريء بتباين عنبري واضح',
  },
  'theme-5': {
    canvasBg: '#12151C',
    surfaceBg: '#181C25',
    subtleBg: '#202633',
    borderColor: '#D4AF37',
    textColor: '#F5F2EB',
    mutedTextColor: '#C5BEAF',
    accentBg: '#D4AF37',
    accentText: '#12151C',
    cardRadiusClass: 'rounded-sm',
    badgeRadiusClass: 'rounded-none',
    headingStyleClass: 'tracking-wider',
    layoutHintAr: 'زوايا حادة وإطارات ذهبية للفاين دايننج',
  },
  'theme-6': {
    canvasBg: '#09090B',
    surfaceBg: '#18181B',
    subtleBg: '#27272A',
    borderColor: '#3F3F46',
    textColor: '#FFFFFF',
    mutedTextColor: '#D4D4D8',
    accentBg: '#E11D48',
    accentText: '#FFFFFF',
    cardRadiusClass: 'rounded-3xl',
    badgeRadiusClass: 'rounded-full',
    headingStyleClass: 'tracking-normal',
    layoutHintAr: 'بطاقات ستوري عمودية بأزرار عائمة',
  },
  'theme-7': {
    canvasBg: '#FAF7F2',
    surfaceBg: '#FFFFFF',
    subtleBg: '#F3ECE1',
    borderColor: '#E3D5C3',
    textColor: '#4A3228',
    mutedTextColor: '#7B6052',
    accentBg: '#5C4033',
    accentText: '#FAF7F2',
    cardRadiusClass: 'rounded-2xl',
    badgeRadiusClass: 'rounded-lg',
    headingStyleClass: 'tracking-normal',
    layoutHintAr: 'دفء كريمي وخطوط إسبريسو ناعمة',
  },
  'theme-8': {
    canvasBg: '#F4F6F8',
    surfaceBg: '#FFFFFF',
    subtleBg: '#EAF2F1',
    borderColor: '#D6E2E0',
    textColor: '#0F172A',
    mutedTextColor: '#475569',
    accentBg: '#0F766E',
    accentText: '#FFFFFF',
    cardRadiusClass: 'rounded-2xl',
    badgeRadiusClass: 'rounded-lg',
    headingStyleClass: 'tracking-tight',
    layoutHintAr: 'بطاقات بنتو منظمة بتركيز على الأكثر طلباً',
  },
  'theme-9': {
    canvasBg: '#FFFFFF',
    surfaceBg: '#F8FAFC',
    subtleBg: '#FEE2E2',
    borderColor: '#CBD5E1',
    textColor: '#0F172A',
    mutedTextColor: '#475569',
    accentBg: '#DC2626',
    accentText: '#FFFFFF',
    cardRadiusClass: 'rounded-xl',
    badgeRadiusClass: 'rounded-md',
    headingStyleClass: 'tracking-tight',
    layoutHintAr: 'واجهة كشك سريع بأزرار كمية مباشرة',
  },
  'theme-11': {
    canvasBg: '#EFEAE2',
    surfaceBg: '#FFFFFF',
    subtleBg: '#D9FDD3',
    borderColor: '#D1D7DB',
    textColor: '#111B21',
    mutedTextColor: '#54656F',
    accentBg: '#25D366',
    accentText: '#111B21',
    cardRadiusClass: 'rounded-2xl',
    badgeRadiusClass: 'rounded-full',
    headingStyleClass: 'tracking-normal',
    layoutHintAr: 'فقاعات محادثة تفاعلية بنمط واتساب',
  },
};

const ROLE_TABS: Array<{
  id: ShowcaseRoleId;
  label: string;
  subtitle: string;
  bullets: [string, string, string];
}> = [
  {
    id: 'cashier',
    label: 'الكاشير',
    subtitle: 'التحصيل السريع وإدارة الدرج ومتابعة الطاولات',
    bullets: [
      'يرى الشيكات المفتوحة فقط وألوان الطاولات الحية دون ازدحام بالشيكات المقفولة.',
      'يحصّل الشيك كاش أو فيزا أو مختلط، ويُنشئ طلبات التيك أواي والدليفري مباشرة.',
      'يتابع رصيد الدرج الافتتاحي والمحصل طوال الوردية مع إقفال آمن في نهايتها.',
    ],
  },
  {
    id: 'captain',
    label: 'الكابتن / الويتر',
    subtitle: 'إدارة الصالة والطلبات المباشرة ونداءات الضيوف',
    bullets: [
      'يرى خريطة الطاولات بألوانها القابلة للتخصيص (متاحة، مشغولة، طلب فاتورة، متأخرة).',
      'يستقبل نداءات الطاولات وتنبيهات الأطباق الجاهزة فور خروجها من المطبخ أو البار.',
      'يضيف أصنافاً للطاولة من لوحة الطلب السريع ويساعد في تقسيم الشيك بين الضيوف.',
    ],
  },
  {
    id: 'kds',
    label: 'المطبخ والبار والحلواني',
    subtitle: 'شاشات تحضير مفصولة لكل محطة بأولوية واضحة',
    bullets: [
      'يصل لكل محطة (المطبخ، البار، الحلواني) أصنافها فقط فور إرسال الطلب دون أوراق.',
      'ينقل الصنف بضغطة واحدة من قيد التحضير إلى جاهز ثم تم التقديم لتنبيه الصالة.',
      'تُخفى الأسعار تلقائياً إن حدد المالك ذلك للتركيز على دقة وسرعة التجهيز.',
    ],
  },
  {
    id: 'manager',
    label: 'المدير',
    subtitle: 'شاشة إشرافية كاملة على الموظفين والطلبات دون تضارب',
    bullets: [
      'يرى كل كادر باسم الموظف المناوب فيه، ويراجع شاشته أو ينوب عنه عند الغياب فقط.',
      'يعدّل أو يلغي أصناف الطلب مع كتابة سبب إلزامي يُحفظ في سجل الرقابة، أو يوقف صنفاً نفد.',
      'يعمل داخل حدود الصلاحيات التي يمنحها له صاحب المطعم مثل QR الطاولات أو التقارير.',
    ],
  },
  {
    id: 'owner',
    label: 'المالك',
    subtitle: 'التحكم الكامل في المنيو والتقارير والصلاحيات والولاء',
    bullets: [
      'يراجع إجمالي المبيعات، وأرشيف الشيكات المغلقة لأي يوم أو وردية، وسجل كل تعديل.',
      'يدير حسابات الموظفين وصلاحيات المدير، ويبدّل ثيم المنيو ويولّد كروت QR للطاولات.',
      'يتابع قاعدة العملاء والأختام ورادار أعياد الميلاد والتكامل المحاسبي مع تايجوس.',
    ],
  },
];

export function LandingVisualShowcases({
  customThemes,
  onScrollToContact,
}: LandingVisualShowcasesProps) {
  // Showcase 1 interactive demo state (UI only)
  const [qrStage, setQrStage] = useState<'scan' | 'menu'>('menu');
  const [menuLang, setMenuLang] = useState<'ar' | 'en'>('ar');
  const [activeCategory, setActiveCategory] = useState<ShowcaseCategoryKey>('grills');
  const [selectedSize, setSelectedSize] = useState<'medium' | 'large'>('medium');
  const [selectedAddons, setSelectedAddons] = useState<string[]>(['جبن شيدر']);
  const [promoApplied, setPromoApplied] = useState(true);
  const [tableNotice, setTableNotice] = useState<string | null>(null);

  // Showcase 2 gallery state (real themes from MENU_THEMES + active customThemes)
  const allRealThemes = useMemo(() => {
    const builtIn = MENU_THEMES.map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      bgPreview: t.bgPreview,
      cardPreview: t.cardPreview,
      recommendedColor: t.recommendedColor,
      isDark: t.isDark,
      isCustom: false,
      style: THEME_VISUAL_STYLES[t.id] || THEME_VISUAL_STYLES['theme-1'],
    }));
    const injected = customThemes.map((ct) => ({
      id: `custom_${ct.id}`,
      name: ct.name,
      shortName: ct.name,
      bgPreview: '#18181B',
      cardPreview: '#FFFFFF',
      recommendedColor: '#14285A',
      isDark: false,
      isCustom: true,
      style: THEME_VISUAL_STYLES['theme-3'],
    }));
    return [...builtIn, ...injected];
  }, [customThemes]);

  const [selectedThemeId, setSelectedThemeId] = useState<string>(MENU_THEMES[0].id);

  // Showcase 3 role tabs state
  const [activeRoleId, setActiveRoleId] = useState<ShowcaseRoleId>('cashier');

  // Respect prefers-reduced-motion on subtle auto QR-to-Menu cycle
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setQrStage('menu');
      return;
    }
    const timer = window.setInterval(() => {
      setQrStage((prev) => (prev === 'scan' ? 'menu' : 'scan'));
    }, 5200);
    return () => window.clearInterval(timer);
  }, []);

  const selectedTheme =
    allRealThemes.find((t) => t.id === selectedThemeId) || allRealThemes[0];

  const activeRoleIndex = ROLE_TABS.findIndex((r) => r.id === activeRoleId);
  const activeRole = ROLE_TABS[activeRoleIndex >= 0 ? activeRoleIndex : 0];

  const stepRole = (delta: number) => {
    const nextIdx = (activeRoleIndex + delta + ROLE_TABS.length) % ROLE_TABS.length;
    setActiveRoleId(ROLE_TABS[nextIdx].id);
  };

  const toggleAddon = (name: string) => {
    setSelectedAddons((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  const baseDishPrice = selectedSize === 'medium' ? 165 : 215;
  const addonsTotal =
    (selectedAddons.includes('جبن شيدر') ? 20 : 0) +
    (selectedAddons.includes('صوص مدخن') ? 15 : 0);
  const sampleDishTotal = baseDishPrice + addonsTotal;

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* Showcase 1: المنيو الرقمي و QR وبطاقات الطاولات                          */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="showcase-menu-qr"
        className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-2.5 max-w-2xl">
              <p className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#E8833A]" />
                <span>معاينة حية · المنيو الرقمي وبطاقات QR</span>
              </p>
              <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
                مسحة واحدة تفتح منيو مطعمك الكامل على طاولة الضيف
              </h2>
              <p className="text-sm sm:text-base text-[#0E1B3D]/80 leading-relaxed">
                بيانات توضيحية (مثال) تُظهر تجربة الضيف الفعلية من كود الطاولة المطبوع وحتى الطلب الجماعي وتقسيم الشيك.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setQrStage((s) => (s === 'scan' ? 'menu' : 'scan'))}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] text-[#14285A] text-xs font-bold hover:border-[#14285A]/40 transition-colors motion-reduce:transition-none cursor-pointer whitespace-nowrap"
              >
                {qrStage === 'scan' ? 'عرض المنيو المفتوح (مثال)' : 'إعادة محاكاة المسح (مثال)'}
              </button>
            </div>
          </div>

          {/* Animated QR-to-Menu Showcase Frame */}
          <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-5 sm:p-8 space-y-7">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Column: Animated QR Scan + Printable Table Cards */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-5">
                {/* Animated QR Scan Card */}
                <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#14285A]">
                      مسح الكود وفتح المنيو (مثال)
                    </span>
                    <span className="text-[11px] font-bold text-[#E8833A]">
                      {qrStage === 'scan' ? 'جارٍ المسح...' : 'تم فتح المنيو'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="relative w-24 h-24 rounded-2xl bg-[#F3EBDD] border border-[#E6D9C3] p-2.5 flex items-center justify-center shrink-0 overflow-hidden">
                      <svg
                        viewBox="0 0 80 80"
                        className="w-full h-full text-[#14285A]"
                        fill="none"
                        aria-hidden="true"
                      >
                        <rect x="6" y="6" width="22" height="22" rx="4" stroke="currentColor" strokeWidth="4" />
                        <rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor" />
                        <rect x="52" y="6" width="22" height="22" rx="4" stroke="currentColor" strokeWidth="4" />
                        <rect x="59" y="13" width="8" height="8" rx="1.5" fill="currentColor" />
                        <rect x="6" y="52" width="22" height="22" rx="4" stroke="currentColor" strokeWidth="4" />
                        <rect x="13" y="59" width="8" height="8" rx="1.5" fill="currentColor" />
                        <rect x="35" y="10" width="8" height="8" rx="2" fill="currentColor" />
                        <rect x="35" y="25" width="8" height="8" rx="2" fill="#E8833A" />
                        <rect x="26" y="38" width="12" height="8" rx="2" fill="currentColor" />
                        <rect x="46" y="36" width="10" height="8" rx="2" fill="currentColor" />
                        <rect x="36" y="52" width="10" height="10" rx="2" fill="currentColor" />
                        <rect x="52" y="52" width="20" height="8" rx="2" fill="currentColor" />
                      </svg>
                      <div
                        className="landing-qr-scan-line absolute inset-x-2 top-2 h-0.5 bg-[#E8833A] rounded-full"
                        aria-hidden="true"
                      />
                    </div>

                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        {/* Inline SVG Restaurant Logo Emblem */}
                        <span className="w-10 h-10 rounded-xl bg-[#14285A] text-[#FBF7EF] flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" aria-hidden="true">
                            <circle cx="16" cy="16" r="11" stroke="#E8833A" strokeWidth="2" />
                            <path
                              d="M11 20C11 16.5 13 13 16 11C19 13 21 16.5 21 20"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                            <path d="M9 21H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </span>
                        <div className="min-w-0">
                          <p className="landing-cairo-heading text-sm text-[#14285A] truncate">
                            مطعم السرايا (مثال)
                          </p>
                          <p className="text-[11px] text-[#0E1B3D]/70 truncate">
                            يفتح تلقائياً بالاسم والشعار واللغة
                          </p>
                        </div>
                      </div>
                      <div
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-opacity duration-200 motion-reduce:transition-none ${
                          qrStage === 'menu'
                            ? 'bg-[#2F8F5B]/10 border-[#2F8F5B]/30 text-[#2F8F5B]'
                            : 'bg-[#E8833A]/10 border-[#E8833A]/30 text-[#E8833A]'
                        }`}
                      >
                        {qrStage === 'menu'
                          ? 'تم فتح منيو طاولة ٧ مباشرة ✓'
                          : 'قراءة رابط الطاولة المشفّر...'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Printable Table QR Cards Preview */}
                <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-5 space-y-3.5 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="landing-cairo-heading text-sm text-[#14285A]">
                      بطاقات طباعة QR للطاولات (مثال)
                    </h3>
                    <span className="text-[11px] font-semibold text-[#0E1B3D]/70">
                      جاهزة للطباعة والقص
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        table: '٤',
                        hall: 'الصالة الرئيسية',
                        hallType: 'عائلات',
                        arWelcome: 'مرحباً بكم في مطعم السرايا',
                        enWelcome: 'Welcome to Al-Saraya',
                      },
                      {
                        table: '١٢',
                        hall: 'التراس الخارجي',
                        hallType: 'جلسات مفتوحة',
                        arWelcome: 'مرحباً بكم في مطعم السرايا',
                        enWelcome: 'Welcome to Al-Saraya',
                      },
                    ].map((card) => (
                      <div
                        key={card.table}
                        className="rounded-2xl border-2 border-dashed border-[#E6D9C3] bg-white p-3.5 text-center space-y-2 flex flex-col justify-between"
                      >
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-extrabold text-[#14285A] leading-tight">
                            {card.arWelcome}
                          </p>
                          <p className="text-[9px] font-semibold text-[#0E1B3D]/55" dir="ltr">
                            {card.enWelcome}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-[#0E1B3D]/60">ترابيزة رقم</p>
                          <p className="landing-cairo-heading text-3xl text-[#14285A] font-mono-num leading-none">
                            {card.table}
                          </p>
                          <div className="w-16 h-16 mx-auto rounded-lg border border-[#E6D9C3] bg-[#FBF7EF] p-1.5 flex items-center justify-center">
                            <QrCode className="w-full h-full text-[#14285A]" />
                          </div>
                        </div>

                        <div className="pt-1.5 border-t border-[#E6D9C3]/70 space-y-0.5">
                          <p className="text-[11px] font-extrabold text-[#14285A] truncate">
                            {card.hall}
                          </p>
                          <p className="text-[10px] font-semibold text-[#E8833A] truncate">
                            {card.hallType} · مثال
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Real-Code Menu Capabilities Mockup */}
              <div
                dir={menuLang === 'en' ? 'ltr' : 'rtl'}
                className="lg:col-span-7 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-5 sm:p-6 space-y-5 flex flex-col justify-between"
              >
                {/* Mock Menu Header: Logo + Restaurant Name + Bilingual Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E6D9C3]">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-[#14285A] text-[#FBF7EF] flex items-center justify-center shrink-0">
                      <UtensilsCrossed className="w-5 h-5 text-[#E8833A]" />
                    </span>
                    <div>
                      <p className="landing-cairo-heading text-base text-[#14285A]">
                        {menuLang === 'ar'
                          ? 'مطعم السرايا · مثال منيو الضيف'
                          : 'Al-Saraya Kitchen · Example Guest Menu'}
                      </p>
                      <p className="text-[11px] text-[#0E1B3D]/70">
                        {menuLang === 'ar'
                          ? 'الصالة الرئيسية · طاولة ٧ · طلب جماعي نشط'
                          : 'Main Hall · Table 7 · Group Order Active'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMenuLang((l) => (l === 'ar' ? 'en' : 'ar'))}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] text-[#14285A] text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:border-[#14285A]/40 transition-colors whitespace-nowrap"
                  >
                    <Languages className="w-4 h-4 text-[#E8833A]" />
                    <span>{menuLang === 'ar' ? 'عربي / EN' : 'English / AR'}</span>
                  </button>
                </div>

                {/* Categories Tabs */}
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { key: 'grills', ar: 'المشويات', en: 'Signature Grills' },
                      { key: 'appetizers', ar: 'المقبلات', en: 'Appetizers' },
                      { key: 'drinks', ar: 'المشروبات', en: 'Cold Drinks' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setActiveCategory(cat.key)}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                        activeCategory === cat.key
                          ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                          : 'bg-[#F3EBDD] border-[#E6D9C3] text-[#14285A]'
                      }`}
                    >
                      {menuLang === 'ar' ? cat.ar : cat.en}
                    </button>
                  ))}
                </div>

                {/* Dish Details Card: Tags + Calories + Sizes + Addons + Notes */}
                <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      {/* All 4 Real Badges from ItemBadge */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                        <span className="px-2 py-0.5 rounded-md bg-[#14285A] text-[#FBF7EF] inline-flex items-center gap-1">
                          <Flame className="w-3 h-3 text-[#E8833A]" />
                          <span>{menuLang === 'ar' ? 'الأكثر مبيعاً' : 'Best Seller'}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#2F8F5B]/15 text-[#2F8F5B]">
                          {menuLang === 'ar' ? 'جديد' : 'New'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#E8833A]/15 text-[#E8833A]">
                          {menuLang === 'ar' ? 'اختيار الشيف' : "Chef's Choice"}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#14285A]/10 text-[#14285A] inline-flex items-center gap-1">
                          <Gift className="w-3 h-3 text-[#E8833A]" />
                          <span>BOGO (١+١)</span>
                        </span>
                      </div>

                      <h3 className="landing-cairo-heading text-lg text-[#14285A]">
                        {activeCategory === 'grills'
                          ? menuLang === 'ar'
                            ? 'سماش برجر دبل (مثال)'
                            : 'Double Smash Burger (Example)'
                          : activeCategory === 'appetizers'
                            ? menuLang === 'ar'
                              ? 'حمص باللحم والصنوبر (مثال)'
                              : 'Hummus with Spiced Beef (Example)'
                            : menuLang === 'ar'
                              ? 'موهيتو باشن فروت (مثال)'
                              : 'Passion Fruit Mojito (Example)'}
                      </h3>

                      <p className="text-xs text-[#0E1B3D]/75 font-mono-num">
                        {menuLang === 'ar'
                          ? '٦٤٠ سعرة حرارية · مناسب للمشاركة'
                          : '640 kcal · Prepared fresh to order'}
                      </p>
                    </div>

                    <div className="text-end">
                      <p className="text-[11px] text-[#0E1B3D]/65">
                        {menuLang === 'ar' ? 'السعر بالإضافات' : 'Item Total'}
                      </p>
                      <p className="landing-cairo-heading text-xl text-[#14285A] font-mono-num">
                        {sampleDishTotal} {menuLang === 'ar' ? 'ج.م' : 'EGP'}
                      </p>
                    </div>
                  </div>

                  {/* Sizes & Addons + Dish Note */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-[#14285A]">
                        {menuLang === 'ar' ? 'اختر الحجم:' : 'Size:'}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSize('medium')}
                          className={`flex-1 min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${
                            selectedSize === 'medium'
                              ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                              : 'bg-[#FBF7EF] border-[#E6D9C3] text-[#14285A]'
                          }`}
                        >
                          {menuLang === 'ar' ? 'وسط · ١٦٥' : 'Med · 165'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedSize('large')}
                          className={`flex-1 min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${
                            selectedSize === 'large'
                              ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                              : 'bg-[#FBF7EF] border-[#E6D9C3] text-[#14285A]'
                          }`}
                        >
                          {menuLang === 'ar' ? 'كبير · ٢١٥' : 'Large · 215'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-[#14285A]">
                        {menuLang === 'ar' ? 'إضافات اختيارية:' : 'Add-ons:'}
                      </p>
                      <div className="flex items-center gap-2">
                        {[
                          { id: 'جبن شيدر', labelEn: '+ Cheddar 20', labelAr: '+ جبن شيدر ٢٠' },
                          { id: 'صوص مدخن', labelEn: '+ Smoky Sauce 15', labelAr: '+ صوص مدخن ١٥' },
                        ].map((addon) => {
                          const active = selectedAddons.includes(addon.id);
                          return (
                            <button
                              key={addon.id}
                              type="button"
                              onClick={() => toggleAddon(addon.id)}
                              className={`flex-1 min-h-[38px] px-2 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer ${
                                active
                                  ? 'bg-[#E8833A]/15 border-[#E8833A] text-[#14285A]'
                                  : 'bg-[#FBF7EF] border-[#E6D9C3] text-[#0E1B3D]/80'
                              }`}
                            >
                              {menuLang === 'ar' ? addon.labelAr : addon.labelEn}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Notes + Suggested Pairings */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-xl px-3 py-2 text-xs text-[#0E1B3D]/80">
                      <span className="font-bold text-[#14285A]">
                        {menuLang === 'ar' ? 'ملاحظات المطبخ (مثال): ' : 'Kitchen Note (Example): '}
                      </span>
                      {menuLang === 'ar' ? 'تسوية جيدة بدون بصل' : 'Well-done, no onions'}
                    </div>
                    <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-xl px-3 py-2 text-xs flex items-center justify-between gap-2">
                      <span className="font-bold text-[#14285A] truncate">
                        {menuLang === 'ar'
                          ? 'اقتراحات مكملة: بطاطس ترافل (+٤٥)'
                          : 'Suggested Pairing: Truffle Fries (+45)'}
                      </span>
                      <span className="text-[11px] font-bold text-[#E8833A] shrink-0">
                        + {menuLang === 'ar' ? 'أضف' : 'Add'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Group Table Split Check + Promo Code + Captain & Bill Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Collaborative Group Order & Per-Guest Split */}
                  <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#E8833A]" />
                        <span>
                          {menuLang === 'ar'
                            ? 'الطلب الجماعي وتقسيم الشيك (مثال)'
                            : 'Group Order & Guest Split (Example)'}
                        </span>
                      </span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span>{menuLang === 'ar' ? 'أحمد (طاولة ٧)' : 'Ahmed (Table 7)'}</span>
                        <span className="font-mono-num font-bold text-[#14285A]">
                          {menuLang === 'ar' ? '١٨٥ ج.م' : '185 EGP'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{menuLang === 'ar' ? 'سارة (طاولة ٧)' : 'Sara (Table 7)'}</span>
                        <span className="font-mono-num font-bold text-[#14285A]">
                          {menuLang === 'ar' ? '١٤٠ ج.م' : '140 EGP'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Promo Code + Waiter Call & Request Bill */}
                  <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-3.5 flex flex-col justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPromoApplied((p) => !p)}
                      className="w-full px-3 py-1.5 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] flex items-center justify-between text-xs cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5 font-bold text-[#14285A]">
                        <Tag className="w-3.5 h-3.5 text-[#E8833A]" />
                        <span>
                          {menuLang === 'ar' ? 'كود خصم: SUFRA15' : 'Promo: SUFRA15'}
                        </span>
                      </span>
                      <span
                        className={`font-bold ${promoApplied ? 'text-[#2F8F5B]' : 'text-[#0E1B3D]/60'}`}
                      >
                        {promoApplied
                          ? menuLang === 'ar'
                            ? 'خصم ١٥٪ مفعّل'
                            : '15% Off Active'
                          : menuLang === 'ar'
                            ? 'تطبيق الكود'
                            : 'Apply'}
                      </span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setTableNotice(
                            menuLang === 'ar'
                              ? 'تم إرسال نداء الكابتن لطاولة ٧ (مثال)'
                              : 'Captain notified for Table 7 (Example)'
                          )
                        }
                        className="min-h-[40px] px-2.5 py-2 rounded-xl bg-[#14285A] text-[#FBF7EF] text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <BellRing className="w-3.5 h-3.5 text-[#E8833A]" />
                        <span>{menuLang === 'ar' ? 'نداء الكابتن' : 'Call Captain'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTableNotice(
                            menuLang === 'ar'
                              ? 'تم إرسال طلب الفاتورة للكاشير (مثال)'
                              : 'Bill request sent to Cashier (Example)'
                          )
                        }
                        className="min-h-[40px] px-2.5 py-2 rounded-xl border border-[#14285A]/30 bg-[#FBF7EF] text-[#14285A] text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5 text-[#E8833A]" />
                        <span>{menuLang === 'ar' ? 'طلب الفاتورة' : 'Request Bill'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {tableNotice && (
                  <p className="text-xs font-bold text-[#2F8F5B] bg-[#2F8F5B]/10 border border-[#2F8F5B]/25 rounded-xl px-3.5 py-2">
                    {tableNotice}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* Showcase 2: معرض الثيمات الفعليّة                                      */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="showcase-themes"
        className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#F3EBDD]"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-2.5 max-w-2xl">
              <p className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#E8833A]" />
                <span>معرض ثيمات المنيو الفعلية</span>
              </p>
              <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
                {customThemes.length > 0
                  ? `${allRealThemes.length} ثيماً حياً لهوية مطعمك (${MENU_THEMES.length} مدمج + ${customThemes.length} مخصص)`
                  : `${MENU_THEMES.length} ثيمات مدمجة فعلية جاهزة + ثيمات مخصصة`}
              </h2>
              <p className="text-sm sm:text-base text-[#0E1B3D]/85 font-semibold">
                الثيم يتغير دون تغيير رابط QR المطبوع — اضغط على أي ثيم بالأسفل لمعاينة المنيو التجريبي فوراً.
              </p>
            </div>

            <span className="text-xs font-bold text-[#14285A] bg-[#FBF7EF] border border-[#E6D9C3] rounded-xl px-4 py-2.5 self-start lg:self-auto">
              المعروض الآن: {selectedTheme.name}
            </span>
          </div>

          {/* Horizontal / Grid Strip of ALL Real Themes */}
          <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-5 sm:p-7 space-y-6">
            <div
              className="flex items-stretch gap-3 overflow-x-auto pb-2 no-scrollbar"
              role="listbox"
              aria-label="قائمة ثيمات المنيو الفعلية"
            >
              {allRealThemes.map((th) => {
                const isSelected = th.id === selectedTheme.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedThemeId(th.id)}
                    className={`min-w-[168px] sm:min-w-[184px] p-3.5 rounded-2xl border-2 text-right transition-colors motion-reduce:transition-none cursor-pointer flex flex-col justify-between gap-2.5 shrink-0 ${
                      isSelected
                        ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                        : 'bg-[#F3EBDD] border-[#E6D9C3] text-[#14285A] hover:border-[#14285A]/45'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* 3-Color Real Theme Swatches */}
                      <div className="flex items-center gap-1" aria-hidden="true">
                        <span
                          className="w-4 h-4 rounded-full border border-black/15"
                          style={{ backgroundColor: th.bgPreview }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/15"
                          style={{ backgroundColor: th.cardPreview }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/15"
                          style={{ backgroundColor: th.recommendedColor }}
                        />
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#E8833A] shrink-0" />}
                    </div>
                    <div>
                      <p className="landing-cairo-heading text-xs leading-snug">{th.name}</p>
                      <p
                        className={`text-[11px] mt-0.5 ${
                          isSelected ? 'text-[#FBF7EF]/75' : 'text-[#0E1B3D]/65'
                        }`}
                      >
                        {th.shortName}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Live Demo Menu Frame — Immediately Changes Colors, Typography & Corner Radii */}
            <div
              className={`border-2 p-5 sm:p-7 transition-colors duration-200 motion-reduce:transition-none ${selectedTheme.style.cardRadiusClass}`}
              style={{
                backgroundColor: selectedTheme.style.canvasBg,
                borderColor: selectedTheme.style.borderColor,
                color: selectedTheme.style.textColor,
              }}
            >
              {/* Demo Menu Top Bar */}
              <div
                className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b"
                style={{ borderColor: selectedTheme.style.borderColor }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-10 h-10 flex items-center justify-center shrink-0 ${selectedTheme.style.badgeRadiusClass}`}
                    style={{
                      backgroundColor: selectedTheme.style.accentBg,
                      color: selectedTheme.style.accentText,
                    }}
                  >
                    <Sparkles className="w-5 h-5" />
                  </span>
                  <div>
                    <h3
                      className={`landing-cairo-heading text-lg ${selectedTheme.style.headingStyleClass}`}
                      style={{ color: selectedTheme.style.textColor }}
                    >
                      مطعم السرايا · مثال ({selectedTheme.name})
                    </h3>
                    <p
                      className="text-xs"
                      style={{ color: selectedTheme.style.mutedTextColor }}
                    >
                      {selectedTheme.style.layoutHintAr}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-3 py-1.5 text-xs font-bold ${selectedTheme.style.badgeRadiusClass}`}
                  style={{
                    backgroundColor: selectedTheme.style.accentBg,
                    color: selectedTheme.style.accentText,
                  }}
                >
                  نفس رابط طاولة ٧
                </span>
              </div>

              {/* Demo Menu Items inside the Selected Theme */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    title: 'ستيك ريب آي مشوي (مثال)',
                    desc: 'صوص فلفل أسود · بطاطس بيوريه',
                    tag: 'اختيار الشيف',
                    price: '٣٤٠ ج.م',
                  },
                  {
                    title: 'ترافل سماش برجر (مثال)',
                    desc: 'لحم أنجوس · شيدر معتق · ٥٩٠ سعرة',
                    tag: 'الأكثر مبيعاً',
                    price: '١٩٥ ج.م',
                  },
                  {
                    title: 'لاتيه كراميل مملح (مثال)',
                    desc: 'حجم وسط أو كبير · ساخن أو مثلج',
                    tag: 'جديد',
                    price: '٨٥ ج.م',
                  },
                ].map((dish) => (
                  <div
                    key={dish.title}
                    className={`border p-4 space-y-3 flex flex-col justify-between ${selectedTheme.style.cardRadiusClass}`}
                    style={{
                      backgroundColor: selectedTheme.style.surfaceBg,
                      borderColor: selectedTheme.style.borderColor,
                    }}
                  >
                    <div className="space-y-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-bold ${selectedTheme.style.badgeRadiusClass}`}
                        style={{
                          backgroundColor: selectedTheme.style.subtleBg,
                          color: selectedTheme.style.textColor,
                        }}
                      >
                        {dish.tag}
                      </span>
                      <h4
                        className={`landing-cairo-heading text-sm ${selectedTheme.style.headingStyleClass}`}
                        style={{ color: selectedTheme.style.textColor }}
                      >
                        {dish.title}
                      </h4>
                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: selectedTheme.style.mutedTextColor }}
                      >
                        {dish.desc}
                      </p>
                    </div>

                    <div
                      className="pt-2.5 border-t flex items-center justify-between"
                      style={{ borderColor: selectedTheme.style.borderColor }}
                    >
                      <span
                        className="font-mono-num text-sm font-extrabold"
                        style={{ color: selectedTheme.style.textColor }}
                      >
                        {dish.price}
                      </span>
                      <span
                        className={`px-3 py-1 text-[11px] font-bold ${selectedTheme.style.badgeRadiusClass}`}
                        style={{
                          backgroundColor: selectedTheme.style.accentBg,
                          color: selectedTheme.style.accentText,
                        }}
                      >
                        + أضف
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* Showcase 3: شاشة لكل دور (تبويبات + كاروسيل)                          */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="showcase-roles"
        className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-2.5 max-w-2xl">
              <p className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <Monitor className="w-4 h-4 text-[#E8833A]" />
                <span>شاشات التشغيل والإدارة حسب الدور</span>
              </p>
              <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
                شاشة مصممة لكل فرد في فريق المطعم
              </h2>
              <p className="text-sm sm:text-base text-[#0E1B3D]/80 leading-relaxed">
                تنقّل بين أدوار التشغيل الخمسة لمعاينة شكل الشاشة الحقيقية بالبيانات التوضيحية (مثال).
              </p>
            </div>

            {/* Carousel Next/Prev Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => stepRole(-1)}
                aria-label="الدور السابق"
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] text-[#14285A] text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:border-[#14285A]/40 transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
                <span>السابق</span>
              </button>
              <button
                type="button"
                onClick={() => stepRole(1)}
                aria-label="الدور التالي"
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:opacity-95 transition-opacity"
              >
                <span>التالي</span>
                <ArrowLeft className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>

          {/* Account Isolation Confirmation Banner */}
          <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#14285A] text-[#FBF7EF] flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-[#E8833A]" />
              </span>
              <p className="text-xs sm:text-sm font-bold text-[#14285A]">
                كل موظف يدخل بحسابه الخاص وكلمة مروره من بوابة الموظفين ولا يرى إلا شاشته المصرح له بها فقط.
              </p>
            </div>
            <span className="text-xs font-bold text-[#2F8F5B] shrink-0">
              عزل كامل للصلاحيات ✓
            </span>
          </div>

          {/* Role Tabs */}
          <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-5 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="أدوار فريق المطعم">
              {ROLE_TABS.map((role) => {
                const isActive = role.id === activeRole.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveRoleId(role.id)}
                    className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-colors motion-reduce:transition-none cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                        : 'bg-[#FBF7EF] border-[#E6D9C3] text-[#14285A] hover:border-[#14285A]/45'
                    }`}
                  >
                    {role.label}
                  </button>
                );
              })}
            </div>

            {/* Mini Authentic Screen Preview */}
            <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl overflow-hidden">
              {/* Mock App Top Header Bar */}
              <div className="bg-[#14285A] text-[#FBF7EF] px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E8833A]" />
                  <span className="landing-cairo-heading text-sm">
                    معاينة شاشة {activeRole.label} (مثال)
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[#FBF7EF]/80">
                  {activeRole.subtitle}
                </span>
              </div>

              <div className="p-5 sm:p-6 bg-[#F3EBDD]/60">
                {activeRole.id === 'cashier' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-7 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-[#E6D9C3] pb-2.5">
                        <span className="landing-cairo-heading text-sm text-[#14285A]">
                          الشيكات المفتوحة · طاولة ٥ (#١٠٨ مثال)
                        </span>
                        <span className="font-mono-num text-sm font-extrabold text-[#14285A]">
                          ٢٥٠ ج.م
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs font-bold text-center">
                        <div className="py-2 rounded-xl bg-[#14285A] text-[#FBF7EF]">كاش</div>
                        <div className="py-2 rounded-xl bg-[#F3EBDD] border border-[#E6D9C3] text-[#14285A]">
                          فيزا
                        </div>
                        <div className="py-2 rounded-xl bg-[#F3EBDD] border border-[#E6D9C3] text-[#14285A]">
                          مختلط
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#2F8F5B] font-bold pt-1">
                        <span>+ طلب تيك أواي / دليفري</span>
                        <span>إقفال وإخفاء الشيك ✓</span>
                      </div>
                    </div>
                    <div className="md:col-span-5 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex flex-col justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#14285A]">
                        <Banknote className="w-4 h-4 text-[#E8833A]" />
                        <span>درج الكاشير بالوردية (مثال)</span>
                      </div>
                      <p className="landing-cairo-heading text-2xl text-[#14285A] font-mono-num">
                        ٤,٨٥٠ ج.م
                      </p>
                      <p className="text-[11px] text-[#0E1B3D]/70">
                        عهدة افتتاحية: ١,٠٠٠ ج.م + مبيعات كاش
                      </p>
                    </div>
                  </div>
                )}

                {activeRole.id === 'captain' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { num: '١', label: 'متاحة', bg: '#FBF7EF', border: '#2F8F5B', text: '#14285A' },
                        { num: '٢', label: 'مشغولة', bg: '#14285A', border: '#14285A', text: '#FBF7EF' },
                        { num: '٣', label: 'طلب فاتورة', bg: '#F3EBDD', border: '#E8833A', text: '#14285A' },
                        { num: '٤', label: 'متأخرة', bg: '#FFF3E8', border: '#E8833A', text: '#0E1B3D' },
                      ].map((t) => (
                        <div
                          key={t.num}
                          className="rounded-xl border-2 p-3 flex flex-col justify-between min-h-[76px]"
                          style={{ backgroundColor: t.bg, borderColor: t.border, color: t.text }}
                        >
                          <span className="landing-cairo-heading text-sm">طاولة {t.num}</span>
                          <span className="text-[10px] font-bold">{t.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="md:col-span-5 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                        <span>نداءات وأطباق جاهزة (مثال)</span>
                        <span className="text-[#E8833A]">الآن</span>
                      </div>
                      <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-between">
                        <span>طاولة ٣ · طلب فاتورة</span>
                        <span className="text-[#E8833A] font-bold">استلام</span>
                      </div>
                      <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-between">
                        <span>طاولة ٢ · طبق جاهز بالمطبخ</span>
                        <span className="text-[#2F8F5B] font-bold">تم</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeRole.id === 'kds' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {[
                      {
                        station: 'المطبخ',
                        icon: ChefHat,
                        order: '#٢١٤ · طاولة ٥',
                        dish: '٢× سماش برجر دبل (مثال)',
                        status: 'قيد التحضير',
                        statusBg: 'rgba(232, 131, 58, 0.16)',
                        statusText: '#E8833A',
                      },
                      {
                        station: 'البار',
                        icon: Coffee,
                        order: '#٢١٤ · طاولة ٥',
                        dish: '١× موهيتو نعناع (مثال)',
                        status: 'جاهز للاستلام',
                        statusBg: '#14285A',
                        statusText: '#FBF7EF',
                      },
                      {
                        station: 'الحلواني',
                        icon: Sparkles,
                        order: '#٢١٤ · طاولة ٥',
                        dish: '١× مولتن كيك شوكولاتة (مثال)',
                        status: 'تم التقديم',
                        statusBg: 'rgba(47, 143, 91, 0.15)',
                        statusText: '#2F8F5B',
                      },
                    ].map((card) => {
                      const StIcon = card.icon;
                      return (
                        <div
                          key={card.station}
                          className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-[#14285A]">
                              <StIcon className="w-4 h-4 text-[#E8833A]" />
                              <span>{card.station}</span>
                            </span>
                            <span
                              className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold"
                              style={{ backgroundColor: card.statusBg, color: card.statusText }}
                            >
                              {card.status}
                            </span>
                          </div>
                          <div>
                            <p className="text-[11px] text-[#0E1B3D]/65 font-mono-num">{card.order}</p>
                            <p className="landing-cairo-heading text-sm text-[#14285A] mt-0.5">
                              {card.dish}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeRole.id === 'manager' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-7 grid grid-cols-2 gap-3">
                      <div className="bg-[#FBF7EF] border border-[#2F8F5B]/40 rounded-2xl p-3.5 space-y-1">
                        <p className="text-xs font-bold text-[#14285A]">الكاشير · كريم عادل (مثال)</p>
                        <p className="text-[11px] font-bold text-[#2F8F5B]">مناوب الآن · شاشة نشطة</p>
                      </div>
                      <div className="bg-[#FBF7EF] border border-[#E8833A]/50 rounded-2xl p-3.5 space-y-1">
                        <p className="text-xs font-bold text-[#14285A]">البار · لا يوجد مناوب</p>
                        <p className="text-[11px] font-bold text-[#E8833A]">متاح للمدير بدء المناوبة</p>
                      </div>
                    </div>
                    <div className="md:col-span-5 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#14285A]">
                        <UserCheck className="w-4 h-4 text-[#E8833A]" />
                        <span>تعديل/إلغاء برقابة السبب (مثال)</span>
                      </div>
                      <p className="text-xs text-[#0E1B3D]/80">
                        «إزالة صنف طاولة ٤ — السبب: طلب الضيف التبديل قبل التحضير».
                      </p>
                    </div>
                  </div>
                )}

                {activeRole.id === 'owner' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-1">
                      <p className="text-[11px] font-bold text-[#0E1B3D]/65">مبيعات اليوم (مثال)</p>
                      <p className="landing-cairo-heading text-xl text-[#14285A] font-mono-num">
                        ١٨,٩٥٠ ج.م
                      </p>
                      <p className="text-[11px] font-bold text-[#2F8F5B]">٥١ شيك مغلق بالأرشيف</p>
                    </div>
                    <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-1">
                      <p className="text-[11px] font-bold text-[#0E1B3D]/65">الصلاحيات والثيمات (مثال)</p>
                      <p className="landing-cairo-heading text-sm text-[#14285A]">
                        تحكم كامل بالمدير والكوادر
                      </p>
                      <p className="text-[11px] text-[#0E1B3D]/70">QR الطاولات + إخفاء الأسعار</p>
                    </div>
                    <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-1">
                      <p className="text-[11px] font-bold text-[#0E1B3D]/65">الولاء وتايجوس (مثال)</p>
                      <p className="landing-cairo-heading text-sm text-[#14285A]">
                        أختام وأعياد ميلاد + جرد ERP
                      </p>
                      <p className="text-[11px] text-[#E8833A] font-bold">ربط سحابي متكامل</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3 Bullets Beneath Each Role Screen */}
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
              {activeRole.bullets.map((point) => (
                <li
                  key={point}
                  className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5"
                >
                  <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#14285A]">
                <ShieldCheck className="w-4 h-4 text-[#2F8F5B]" />
                <span>الدور المحدد: {activeRole.label}</span>
              </div>
              <button
                type="button"
                onClick={onScrollToContact}
                className="min-h-[42px] px-6 py-2.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>اطلب عرضاً حياً لجميع الشاشات</span>
                <ArrowLeft className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
