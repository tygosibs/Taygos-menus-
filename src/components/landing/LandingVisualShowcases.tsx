import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  BellRing,
  Check,
  ChefHat,
  Coffee,
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
import { useLanguage } from '../../contexts/LanguageContext';
import { MENU_THEMES } from '../../data/themes';
import { loc } from '../../data/translations';
import { CustomTheme } from '../../types/menu';

interface LandingVisualShowcasesProps {
  customThemes: CustomTheme[];
  onScrollToContact: () => void;
}

type ShowcaseCategoryKey = 'grills' | 'appetizers' | 'drinks';
type ShowcaseRoleId = 'cashier' | 'captain' | 'kds' | 'manager' | 'owner';
type AddonKey = 'cheddar' | 'smoky';

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
  layoutHintEn: string;
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
    layoutHintEn: 'Classic luxury book layout with crisp editorial edges',
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
    layoutHintEn: 'Signature curved arch header with soft rounded cards',
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
    layoutHintEn: 'Minimal light grid with a floating checkout bar',
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
    layoutHintEn: 'Bold obsidian dark mode with warm amber highlights',
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
    layoutHintAr: 'زوايا حادة وإطارات ذهبية للضيافة الفاخرة',
    layoutHintEn: 'Fine dining midnight palette with sharp gold framing',
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
    layoutHintAr: 'بطاقات عرض عمودية بأزرار عائمة',
    layoutHintEn: 'Vertical story-style cards with floating action buttons',
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
    layoutHintEn: 'Warm cream cafe surfaces with espresso typography',
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
    layoutHintAr: 'بطاقات منظمة بتركيز على الأكثر طلباً',
    layoutHintEn: 'Structured bento cards highlighting top-selling dishes',
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
    layoutHintEn: 'Fast kiosk interface with instant quantity controls',
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
    layoutHintEn: 'Interactive conversational bubbles inspired by chat',
  },
};

const ROLE_TABS: Array<{
  id: ShowcaseRoleId;
  labelAr: string;
  labelEn: string;
  subtitleAr: string;
  subtitleEn: string;
  bulletsAr: [string, string, string];
  bulletsEn: [string, string, string];
}> = [
  {
    id: 'cashier',
    labelAr: 'الكاشير',
    labelEn: 'Cashier / POS',
    subtitleAr: 'التحصيل السريع وإدارة الدرج ومتابعة الطاولات',
    subtitleEn: 'Fast check settlement, cash drawer control, and live tables',
    bulletsAr: [
      'يرى الشيكات المفتوحة فقط وألوان الطاولات الحية دون ازدحام بالشيكات المقفولة.',
      'يحصّل الشيك كاش أو فيزا أو مختلط، ويُنشئ طلبات التيك أواي والدليفري مباشرة.',
      'يتابع رصيد الدرج الافتتاحي والمحصّل طوال الوردية مع إقفال آمن في نهايتها.',
    ],
    bulletsEn: [
      'Displays Open checks and live floor table colors without clutter from Paid checks.',
      'Settles checks via Cash, Card, or Split payment, and creates Takeaway or Delivery orders.',
      'Tracks opening float and cash collected throughout the shift with secure Shift Handover.',
    ],
  },
  {
    id: 'captain',
    labelAr: 'الكابتن',
    labelEn: 'Captain',
    subtitleAr: 'إدارة الصالة والطلبات المباشرة ونداءات الضيوف',
    subtitleEn: 'Floor management, tableside ordering, and guest calls',
    bulletsAr: [
      'يرى خريطة الطاولات بألوانها القابلة للتخصيص (متاحة، مشغولة، طلب فاتورة، متأخرة).',
      'يستقبل نداءات الطاولات وتنبيهات الأطباق الجاهزة فور خروجها من المطبخ أو البار.',
      'يضيف أصنافاً للطاولة من لوحة الطلب السريع ويساعد في تقسيم الشيك بين الضيوف.',
    ],
    bulletsEn: [
      'Live floor grid with customizable table colors (Available, Occupied, Check Requested, Overdue).',
      'Receives guest table calls and instant alerts when Kitchen or Bar items are Ready.',
      'Adds items tableside via quick-entry POS and assists guests with Split Check totals.',
    ],
  },
  {
    id: 'kds',
    labelAr: 'المطبخ والبار والحلواني',
    labelEn: 'Kitchen, Bar & Pastry KDS',
    subtitleAr: 'شاشات تحضير مفصولة لكل محطة بأولوية واضحة',
    subtitleEn: 'Dedicated prep displays per station with clear stage progression',
    bulletsAr: [
      'يصل لكل محطة (المطبخ، البار، الحلواني) أصنافها فقط فور إرسال الطلب دون أوراق.',
      'ينقل الصنف بضغطة واحدة من قيد التحضير إلى جاهز ثم تم التقديم لتنبيه الصالة.',
      'تُخفى الأسعار تلقائياً إن حدد المالك ذلك للتركيز على دقة وسرعة التجهيز.',
    ],
    bulletsEn: [
      'Routes only relevant items to Kitchen, Bar, or Pastry screens immediately upon ordering.',
      'One-tap progression from Preparing to Ready and Served, alerting floor staff instantly.',
      'Item prices can be hidden automatically by the owner to keep teams focused on prep speed.',
    ],
  },
  {
    id: 'manager',
    labelAr: 'المدير الإشرافي',
    labelEn: 'Supervisory Manager',
    subtitleAr: 'شاشة إشرافية كاملة على الموظفين والطلبات دون تضارب',
    subtitleEn: 'Full shift supervision across staff screens with zero conflict',
    bulletsAr: [
      'يرى كل كادر باسم الموظف المناوب فيه، ويراجع شاشته أو ينوب عنه عند الغياب فقط.',
      'يعدّل أو يلغي أصناف الطلب مع كتابة سبب إلزامي يُحفظ في سجل الرقابة، أو يوقف صنفاً نفد.',
      'يعمل داخل حدود الصلاحيات التي يمنحها له صاحب المطعم مثل كود الطاولة أو التقارير.',
    ],
    bulletsEn: [
      'Views each station by the on-duty staff member and steps in only when a role is uncovered.',
      'Edits or cancels items with a mandatory reason saved to the Audit Log, or marks a Paused Item.',
      'Operates strictly within Permissions set by the owner, such as Table QR Code setup or reports.',
    ],
  },
  {
    id: 'owner',
    labelAr: 'صاحب المطعم',
    labelEn: 'Restaurant Owner',
    subtitleAr: 'التحكم الكامل في المنيو والتقارير والصلاحيات والولاء',
    subtitleEn: 'Complete control over menu, reports, Permissions, and Loyalty',
    bulletsAr: [
      'يراجع إجمالي المبيعات، وأرشيف الشيكات المغلقة لأي يوم أو وردية، وسجل كل تعديل.',
      'يدير حسابات الموظفين وصلاحيات المدير، ويبدّل ثيم المنيو ويولّد كروت QR للطاولات.',
      'يتابع قاعدة العملاء والأختام ورادار أعياد الميلاد والتكامل المحاسبي مع تايجوس.',
    ],
    bulletsEn: [
      'Reviews daily sales, historical closed check archives for any day or shift, and the Audit Log.',
      'Manages staff accounts, Manager Permissions, live Digital Menu themes, and Table QR Code cards.',
      'Monitors Customer CRM, Punch Card progress, birthday radar, and Tygos ERP accounting sync.',
    ],
  },
];

export function LandingVisualShowcases({
  customThemes,
  onScrollToContact,
}: LandingVisualShowcasesProps) {
  const { lang, dir } = useLanguage();
  const isAr = lang === 'ar';
  const DirectionalArrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const PrevIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const NextIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  // Showcase 1 interactive demo state (UI only)
  const [qrStage, setQrStage] = useState<'scan' | 'menu'>('menu');
  const [menuLang, setMenuLang] = useState<'ar' | 'en'>(lang);
  const [activeCategory, setActiveCategory] = useState<ShowcaseCategoryKey>('grills');
  const [selectedSize, setSelectedSize] = useState<'medium' | 'large'>('medium');
  const [selectedAddons, setSelectedAddons] = useState<AddonKey[]>(['cheddar']);
  const [promoApplied, setPromoApplied] = useState(true);
  const [tableNotice, setTableNotice] = useState<'captain' | 'bill' | null>(null);

  useEffect(() => {
    setMenuLang(lang);
  }, [lang]);

  // Showcase 2 gallery state (real themes from MENU_THEMES + active customThemes)
  const allRealThemes = useMemo(() => {
    const builtIn = MENU_THEMES.map((t) => ({
      id: t.id,
      name: loc(t.name, t.englishName, lang),
      shortName: loc(t.shortName, t.shortName_en, lang),
      bgPreview: t.bgPreview,
      cardPreview: t.cardPreview,
      recommendedColor: t.recommendedColor,
      isDark: t.isDark,
      isCustom: false,
      style: THEME_VISUAL_STYLES[t.id] || THEME_VISUAL_STYLES['theme-1'],
    }));
    const injected = customThemes.map((ct) => ({
      id: `custom_${ct.id}`,
      name: loc(ct.name, ct.name_en, lang),
      shortName: loc(ct.name, ct.name_en, lang),
      bgPreview: '#18181B',
      cardPreview: '#FFFFFF',
      recommendedColor: '#14285A',
      isDark: false,
      isCustom: true,
      style: THEME_VISUAL_STYLES['theme-3'],
    }));
    return [...builtIn, ...injected];
  }, [customThemes, lang]);

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

  const toggleAddon = (key: AddonKey) => {
    setSelectedAddons((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const baseDishPrice = selectedSize === 'medium' ? 165 : 215;
  const addonsTotal =
    (selectedAddons.includes('cheddar') ? 20 : 0) +
    (selectedAddons.includes('smoky') ? 15 : 0);
  const sampleDishTotal = baseDishPrice + addonsTotal;

  const currencyLabel = isAr ? 'ج.م' : 'EGP';
  const menuCurrencyLabel = menuLang === 'ar' ? 'ج.م' : 'EGP';

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* Showcase 1: Digital Menu & Printable Table QR Cards                     */}
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
                <span>
                  {isAr
                    ? 'معاينة حية · المنيو الرقمي وبطاقات الطاولات'
                    : 'Live Preview · Digital Menu & Table QR Codes'}
                </span>
              </p>
              <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
                {isAr
                  ? 'مسحة واحدة تفتح منيو مطعمك الكامل على طاولة الضيف'
                  : 'One scan opens your full Digital Menu right at the table'}
              </h2>
              <p className="text-sm sm:text-base text-[#0E1B3D]/80 leading-relaxed">
                {isAr
                  ? 'بيانات توضيحية (مثال) تُظهر تجربة الضيف الفعلية من كود الطاولة المطبوع وحتى الطلب الجماعي وتقسيم الشيك.'
                  : 'Interactive example showcasing the real guest journey from Table QR Code scan to group ordering and Split Check.'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setQrStage((s) => (s === 'scan' ? 'menu' : 'scan'))}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] text-[#14285A] text-xs font-bold hover:border-[#14285A]/40 transition-colors motion-reduce:transition-none cursor-pointer whitespace-nowrap"
              >
                {qrStage === 'scan'
                  ? isAr
                    ? 'عرض المنيو المفتوح (مثال)'
                    : 'Show Open Menu (Example)'
                  : isAr
                    ? 'إعادة محاكاة المسح (مثال)'
                    : 'Replay Scan Simulation (Example)'}
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
                      {isAr
                        ? 'مسح الكود وفتح المنيو (مثال)'
                        : 'QR Scan & Menu Launch (Example)'}
                    </span>
                    <span className="text-[11px] font-bold text-[#E8833A]">
                      {qrStage === 'scan'
                        ? isAr
                          ? 'جارٍ المسح...'
                          : 'Scanning...'
                        : isAr
                          ? 'تم فتح المنيو'
                          : 'Menu Opened'}
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
                            {isAr ? 'مطعم السرايا (مثال)' : 'Al-Saraya Kitchen (Example)'}
                          </p>
                          <p className="text-[11px] text-[#0E1B3D]/70 truncate">
                            {isAr
                              ? 'يفتح تلقائياً بالاسم والشعار واللغة'
                              : 'Opens instantly with brand logo & language'}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-opacity duration-200 motion-reduce:transition-none flex items-center gap-1.5 ${
                          qrStage === 'menu'
                            ? 'bg-[#2F8F5B]/10 border-[#2F8F5B]/30 text-[#2F8F5B]'
                            : 'bg-[#E8833A]/10 border-[#E8833A]/30 text-[#E8833A]'
                        }`}
                      >
                        {qrStage === 'menu' && <Check className="w-3.5 h-3.5 shrink-0" />}
                        <span>
                          {qrStage === 'menu'
                            ? isAr
                              ? 'تم فتح منيو طاولة 7 مباشرة'
                              : 'Table 7 menu opened directly'
                            : isAr
                              ? 'قراءة رابط الطاولة المشفّر...'
                              : 'Decoding encrypted table link...'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Printable Table QR Cards Preview */}
                <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-5 space-y-3.5 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="landing-cairo-heading text-sm text-[#14285A]">
                      {isAr
                        ? 'بطاقات طباعة كود الطاولة (مثال)'
                        : 'Printable Table QR Cards (Example)'}
                    </h3>
                    <span className="text-[11px] font-semibold text-[#0E1B3D]/70">
                      {isAr ? 'جاهزة للطباعة والقص' : 'Print & cut ready'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        table: '4',
                        hallAr: 'الصالة الرئيسية',
                        hallEn: 'Main Hall',
                        hallTypeAr: 'عائلات · مثال',
                        hallTypeEn: 'Family · Example',
                        welcomeAr: 'مرحباً بكم في مطعم السرايا',
                        welcomeEn: 'Welcome to Al-Saraya',
                      },
                      {
                        table: '12',
                        hallAr: 'التراس الخارجي',
                        hallEn: 'Outdoor Terrace',
                        hallTypeAr: 'جلسات مفتوحة · مثال',
                        hallTypeEn: 'Open Seating · Example',
                        welcomeAr: 'مرحباً بكم في مطعم السرايا',
                        welcomeEn: 'Welcome to Al-Saraya',
                      },
                    ].map((card) => (
                      <div
                        key={card.table}
                        className="rounded-2xl border-2 border-dashed border-[#E6D9C3] bg-white p-3.5 text-center space-y-2 flex flex-col justify-between"
                      >
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-extrabold text-[#14285A] leading-tight">
                            {isAr ? card.welcomeAr : card.welcomeEn}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-[#0E1B3D]/60">
                            {isAr ? 'ترابيزة رقم' : 'Table'}
                          </p>
                          <p className="landing-cairo-heading text-3xl text-[#14285A] font-mono-num leading-none">
                            {card.table}
                          </p>
                          <div className="w-16 h-16 mx-auto rounded-lg border border-[#E6D9C3] bg-[#FBF7EF] p-1.5 flex items-center justify-center">
                            <QrCode className="w-full h-full text-[#14285A]" />
                          </div>
                        </div>

                        <div className="pt-1.5 border-t border-[#E6D9C3]/70 space-y-0.5">
                          <p className="text-[11px] font-extrabold text-[#14285A] truncate">
                            {isAr ? card.hallAr : card.hallEn}
                          </p>
                          <p className="text-[10px] font-semibold text-[#E8833A] truncate">
                            {isAr ? card.hallTypeAr : card.hallTypeEn}
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
                          ? 'الصالة الرئيسية · طاولة 7 · طلب جماعي نشط'
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
                    <span>{menuLang === 'ar' ? 'العربية' : 'English'}</span>
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
                          <span>{menuLang === 'ar' ? 'عرض 1+1' : 'BOGO (1+1)'}</span>
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
                          ? '640 سعرة حرارية · مناسب للمشاركة'
                          : '640 kcal · Prepared fresh to order'}
                      </p>
                    </div>

                    <div className="text-end">
                      <p className="text-[11px] text-[#0E1B3D]/65">
                        {menuLang === 'ar' ? 'السعر بالإضافات' : 'Item Total'}
                      </p>
                      <p className="landing-cairo-heading text-xl text-[#14285A] font-mono-num">
                        {sampleDishTotal} {menuCurrencyLabel}
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
                          {menuLang === 'ar' ? 'وسط · 165' : 'Med · 165'}
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
                          {menuLang === 'ar' ? 'كبير · 215' : 'Large · 215'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-[#14285A]">
                        {menuLang === 'ar' ? 'إضافات اختيارية:' : 'Add-ons:'}
                      </p>
                      <div className="flex items-center gap-2">
                        {(
                          [
                            { id: 'cheddar', labelEn: '+ Cheddar 20', labelAr: '+ جبن شيدر 20' },
                            { id: 'smoky', labelEn: '+ Smoky Sauce 15', labelAr: '+ صوص مدخن 15' },
                          ] as const
                        ).map((addon) => {
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
                          ? 'اقتراحات مكملة: بطاطس ترافل (+45)'
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
                            : 'Group Order & Split Check (Example)'}
                        </span>
                      </span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span>{menuLang === 'ar' ? 'أحمد (طاولة 7)' : 'Ahmed (Table 7)'}</span>
                        <span className="font-mono-num font-bold text-[#14285A]">
                          185 {menuCurrencyLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{menuLang === 'ar' ? 'سارة (طاولة 7)' : 'Sara (Table 7)'}</span>
                        <span className="font-mono-num font-bold text-[#14285A]">
                          140 {menuCurrencyLabel}
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
                            ? 'خصم 15% مفعّل'
                            : '15% Off Active'
                          : menuLang === 'ar'
                            ? 'تطبيق الكود'
                            : 'Apply'}
                      </span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTableNotice('captain')}
                        className="min-h-[40px] px-2.5 py-2 rounded-xl bg-[#14285A] text-[#FBF7EF] text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <BellRing className="w-3.5 h-3.5 text-[#E8833A]" />
                        <span>{menuLang === 'ar' ? 'نداء الكابتن' : 'Call Captain'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTableNotice('bill')}
                        className="min-h-[40px] px-2.5 py-2 rounded-xl border border-[#14285A]/30 bg-[#FBF7EF] text-[#14285A] text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5 text-[#E8833A]" />
                        <span>{menuLang === 'ar' ? 'طلب الفاتورة' : 'Request Check'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {tableNotice && (
                  <p className="text-xs font-bold text-[#2F8F5B] bg-[#2F8F5B]/10 border border-[#2F8F5B]/25 rounded-xl px-3.5 py-2">
                    {tableNotice === 'captain'
                      ? menuLang === 'ar'
                        ? 'تم إرسال نداء الكابتن لطاولة 7 (مثال)'
                        : 'Captain notified for Table 7 (Example)'
                      : menuLang === 'ar'
                        ? 'تم إرسال طلب الفاتورة للكاشير (مثال)'
                        : 'Check request sent to Cashier (Example)'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* Showcase 2: Live Menu Themes Gallery                                    */}
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
                <span>
                  {isAr ? 'معرض ثيمات المنيو الفعلية' : 'Live Menu Themes Gallery'}
                </span>
              </p>
              <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
                {customThemes.length > 0
                  ? isAr
                    ? `${allRealThemes.length} ثيماً حياً لهوية مطعمك (${MENU_THEMES.length} مدمج + ${customThemes.length} مخصص)`
                    : `${allRealThemes.length} Live Themes for Your Brand (${MENU_THEMES.length} Built-in + ${customThemes.length} Custom)`
                  : isAr
                    ? `${MENU_THEMES.length} ثيمات مدمجة فعلية جاهزة + ثيمات مخصصة`
                    : `${MENU_THEMES.length} Built-in Ready Themes + Custom Themes`}
              </h2>
              <p className="text-sm sm:text-base text-[#0E1B3D]/85 font-semibold">
                {isAr
                  ? 'الثيم يتغير دون تغيير رابط الكود المطبوع — اضغط على أي ثيم بالأسفل لمعاينة المنيو التجريبي فوراً.'
                  : 'Switch your menu appearance without changing the printed Table QR Code — pick any theme below to preview live.'}
              </p>
            </div>

            <span className="text-xs font-bold text-[#14285A] bg-[#FBF7EF] border border-[#E6D9C3] rounded-xl px-4 py-2.5 self-start lg:self-auto">
              {isAr ? `المعروض الآن: ${selectedTheme.name}` : `Active Preview: ${selectedTheme.name}`}
            </span>
          </div>

          {/* Horizontal / Grid Strip of ALL Real Themes */}
          <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-5 sm:p-7 space-y-6">
            <div
              className="flex items-stretch gap-3 overflow-x-auto pb-2 no-scrollbar"
              role="listbox"
              aria-label={isAr ? 'قائمة ثيمات المنيو الفعلية' : 'Menu themes list'}
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
                    className={`min-w-[168px] sm:min-w-[184px] p-3.5 rounded-2xl border-2 text-start transition-colors motion-reduce:transition-none cursor-pointer flex flex-col justify-between gap-2.5 shrink-0 ${
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
                      {isAr
                        ? `مطعم السرايا · مثال (${selectedTheme.name})`
                        : `Al-Saraya Kitchen · Example (${selectedTheme.name})`}
                    </h3>
                    <p
                      className="text-xs"
                      style={{ color: selectedTheme.style.mutedTextColor }}
                    >
                      {isAr
                        ? selectedTheme.style.layoutHintAr
                        : selectedTheme.style.layoutHintEn}
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
                  {isAr ? 'نفس رابط طاولة 7' : 'Same Table 7 Link'}
                </span>
              </div>

              {/* Demo Menu Items inside the Selected Theme */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    titleAr: 'ستيك ريب آي مشوي (مثال)',
                    titleEn: 'Grilled Ribeye Steak (Example)',
                    descAr: 'صوص فلفل أسود · بطاطس بيوريه',
                    descEn: 'Black pepper sauce · Whipped mashed potatoes',
                    tagAr: 'اختيار الشيف',
                    tagEn: "Chef's Choice",
                    price: `340 ${currencyLabel}`,
                  },
                  {
                    titleAr: 'ترافل سماش برجر (مثال)',
                    titleEn: 'Truffle Smash Burger (Example)',
                    descAr: 'لحم أنجوس · شيدر معتق · 590 سعرة',
                    descEn: 'Angus beef · Aged cheddar · 590 kcal',
                    tagAr: 'الأكثر مبيعاً',
                    tagEn: 'Best Seller',
                    price: `195 ${currencyLabel}`,
                  },
                  {
                    titleAr: 'لاتيه كراميل مملح (مثال)',
                    titleEn: 'Salted Caramel Latte (Example)',
                    descAr: 'حجم وسط أو كبير · ساخن أو مثلج',
                    descEn: 'Medium or large · Hot or iced',
                    tagAr: 'جديد',
                    tagEn: 'New',
                    price: `85 ${currencyLabel}`,
                  },
                ].map((dish) => (
                  <div
                    key={dish.titleEn}
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
                        {isAr ? dish.tagAr : dish.tagEn}
                      </span>
                      <h4
                        className={`landing-cairo-heading text-sm ${selectedTheme.style.headingStyleClass}`}
                        style={{ color: selectedTheme.style.textColor }}
                      >
                        {isAr ? dish.titleAr : dish.titleEn}
                      </h4>
                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: selectedTheme.style.mutedTextColor }}
                      >
                        {isAr ? dish.descAr : dish.descEn}
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
                        + {isAr ? 'أضف' : 'Add'}
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
      {/* Showcase 3: Role-Based Screens (Tabs + Carousel)                        */}
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
                <span>
                  {isAr
                    ? 'شاشات التشغيل والإدارة حسب الدور'
                    : 'Operations & Management Screens by Role'}
                </span>
              </p>
              <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
                {isAr
                  ? 'شاشة مصممة لكل فرد في فريق المطعم'
                  : 'A dedicated screen tailored for every role on your team'}
              </h2>
              <p className="text-sm sm:text-base text-[#0E1B3D]/80 leading-relaxed">
                {isAr
                  ? 'تنقّل بين أدوار التشغيل الخمسة لمعاينة شكل الشاشة الحقيقية بالبيانات التوضيحية (مثال).'
                  : 'Switch across all five operational roles to preview their live interfaces with sample data (Example).'}
              </p>
            </div>

            {/* Carousel Next/Prev Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => stepRole(-1)}
                aria-label={isAr ? 'الدور السابق' : 'Previous role'}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] text-[#14285A] text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:border-[#14285A]/40 transition-colors"
              >
                <PrevIcon className="w-4 h-4" />
                <span>{isAr ? 'السابق' : 'Previous'}</span>
              </button>
              <button
                type="button"
                onClick={() => stepRole(1)}
                aria-label={isAr ? 'الدور التالي' : 'Next role'}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:opacity-95 transition-opacity"
              >
                <span>{isAr ? 'التالي' : 'Next'}</span>
                <NextIcon className="w-4 h-4 text-[#E8833A]" />
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
                {isAr
                  ? 'كل موظف يدخل بحسابه الخاص وكلمة مروره من بوابة الموظفين ولا يرى إلا شاشته المصرح له بها فقط.'
                  : 'Each staff member signs in via the Staff Portal with personal credentials and accesses only their authorized screen.'}
              </p>
            </div>
            <span className="text-xs font-bold text-[#2F8F5B] shrink-0 inline-flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>{isAr ? 'عزل كامل للصلاحيات' : 'Full Role Isolation'}</span>
            </span>
          </div>

          {/* Role Tabs */}
          <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-5 sm:p-8 space-y-6">
            <div
              className="flex flex-wrap items-center gap-2"
              role="tablist"
              aria-label={isAr ? 'أدوار فريق المطعم' : 'Restaurant team roles'}
            >
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
                    {isAr ? role.labelAr : role.labelEn}
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
                    {isAr
                      ? `معاينة شاشة ${activeRole.labelAr} (مثال)`
                      : `${activeRole.labelEn} Screen Preview (Example)`}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[#FBF7EF]/80">
                  {isAr ? activeRole.subtitleAr : activeRole.subtitleEn}
                </span>
              </div>

              <div className="p-5 sm:p-6 bg-[#F3EBDD]/60">
                {activeRole.id === 'cashier' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-7 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-[#E6D9C3] pb-2.5">
                        <span className="landing-cairo-heading text-sm text-[#14285A]">
                          {isAr
                            ? 'الشيكات المفتوحة · طاولة 5 (#108 مثال)'
                            : 'Open Checks · Table 5 (#108 Example)'}
                        </span>
                        <span className="font-mono-num text-sm font-extrabold text-[#14285A]">
                          250 {currencyLabel}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs font-bold text-center">
                        <div className="py-2 rounded-xl bg-[#14285A] text-[#FBF7EF]">
                          {isAr ? 'كاش' : 'Cash'}
                        </div>
                        <div className="py-2 rounded-xl bg-[#F3EBDD] border border-[#E6D9C3] text-[#14285A]">
                          {isAr ? 'فيزا' : 'Card'}
                        </div>
                        <div className="py-2 rounded-xl bg-[#F3EBDD] border border-[#E6D9C3] text-[#14285A]">
                          {isAr ? 'مختلط' : 'Split'}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#2F8F5B] font-bold pt-1">
                        <span>
                          {isAr ? '+ طلب تيك أواي / دليفري' : '+ Takeaway / Delivery Order'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span>{isAr ? 'إقفال وإخفاء الشيك' : 'Close & Clear Check'}</span>
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                    <div className="md:col-span-5 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex flex-col justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#14285A]">
                        <Banknote className="w-4 h-4 text-[#E8833A]" />
                        <span>
                          {isAr ? 'درج الكاشير بالوردية (مثال)' : 'Shift Cash Drawer (Example)'}
                        </span>
                      </div>
                      <p className="landing-cairo-heading text-2xl text-[#14285A] font-mono-num">
                        4,850 {currencyLabel}
                      </p>
                      <p className="text-[11px] text-[#0E1B3D]/70 font-mono-num">
                        {isAr
                          ? 'عهدة افتتاحية: 1,000 ج.م + مبيعات كاش'
                          : 'Opening Float: 1,000 EGP + cash sales'}
                      </p>
                    </div>
                  </div>
                )}

                {activeRole.id === 'captain' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { num: '1', labelAr: 'متاحة', labelEn: 'Available', bg: '#FBF7EF', border: '#2F8F5B', text: '#14285A' },
                        { num: '2', labelAr: 'مشغولة', labelEn: 'Occupied', bg: '#14285A', border: '#14285A', text: '#FBF7EF' },
                        { num: '3', labelAr: 'طلب فاتورة', labelEn: 'Check Requested', bg: '#F3EBDD', border: '#E8833A', text: '#14285A' },
                        { num: '4', labelAr: 'متأخرة', labelEn: 'Overdue', bg: '#FFF3E8', border: '#E8833A', text: '#0E1B3D' },
                      ].map((t) => (
                        <div
                          key={t.num}
                          className="rounded-xl border-2 p-3 flex flex-col justify-between min-h-[76px]"
                          style={{ backgroundColor: t.bg, borderColor: t.border, color: t.text }}
                        >
                          <span className="landing-cairo-heading text-sm font-mono-num">
                            {isAr ? `طاولة ${t.num}` : `Table ${t.num}`}
                          </span>
                          <span className="text-[10px] font-bold">
                            {isAr ? t.labelAr : t.labelEn}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="md:col-span-5 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                        <span>
                          {isAr ? 'نداءات وأطباق جاهزة (مثال)' : 'Calls & Ready Dishes (Example)'}
                        </span>
                        <span className="text-[#E8833A]">{isAr ? 'الآن' : 'Now'}</span>
                      </div>
                      <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-between">
                        <span>{isAr ? 'طاولة 3 · طلب فاتورة' : 'Table 3 · Check Requested'}</span>
                        <span className="text-[#E8833A] font-bold">
                          {isAr ? 'استلام' : 'Acknowledge'}
                        </span>
                      </div>
                      <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-between">
                        <span>{isAr ? 'طاولة 2 · طبق جاهز بالمطبخ' : 'Table 2 · Kitchen Dish Ready'}</span>
                        <span className="text-[#2F8F5B] font-bold">
                          {isAr ? 'تم' : 'Served'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {activeRole.id === 'kds' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {[
                      {
                        stationAr: 'المطبخ',
                        stationEn: 'Kitchen',
                        icon: ChefHat,
                        orderAr: '#214 · طاولة 5',
                        orderEn: '#214 · Table 5',
                        dishAr: '2× سماش برجر دبل (مثال)',
                        dishEn: '2x Double Smash Burger (Example)',
                        statusAr: 'قيد التحضير',
                        statusEn: 'Preparing',
                        statusBg: 'rgba(232, 131, 58, 0.16)',
                        statusText: '#E8833A',
                      },
                      {
                        stationAr: 'البار',
                        stationEn: 'Bar',
                        icon: Coffee,
                        orderAr: '#214 · طاولة 5',
                        orderEn: '#214 · Table 5',
                        dishAr: '1× موهيتو نعناع (مثال)',
                        dishEn: '1x Mint Mojito (Example)',
                        statusAr: 'جاهز للاستلام',
                        statusEn: 'Ready to Serve',
                        statusBg: '#14285A',
                        statusText: '#FBF7EF',
                      },
                      {
                        stationAr: 'الحلواني',
                        stationEn: 'Pastry',
                        icon: Sparkles,
                        orderAr: '#214 · طاولة 5',
                        orderEn: '#214 · Table 5',
                        dishAr: '1× مولتن كيك شوكولاتة (مثال)',
                        dishEn: '1x Chocolate Molten Cake (Example)',
                        statusAr: 'تم التقديم',
                        statusEn: 'Served',
                        statusBg: 'rgba(47, 143, 91, 0.15)',
                        statusText: '#2F8F5B',
                      },
                    ].map((card) => {
                      const StIcon = card.icon;
                      return (
                        <div
                          key={card.stationEn}
                          className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-[#14285A]">
                              <StIcon className="w-4 h-4 text-[#E8833A]" />
                              <span>{isAr ? card.stationAr : card.stationEn}</span>
                            </span>
                            <span
                              className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold"
                              style={{ backgroundColor: card.statusBg, color: card.statusText }}
                            >
                              {isAr ? card.statusAr : card.statusEn}
                            </span>
                          </div>
                          <div>
                            <p className="text-[11px] text-[#0E1B3D]/65 font-mono-num">
                              {isAr ? card.orderAr : card.orderEn}
                            </p>
                            <p className="landing-cairo-heading text-sm text-[#14285A] mt-0.5">
                              {isAr ? card.dishAr : card.dishEn}
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
                        <p className="text-xs font-bold text-[#14285A]">
                          {isAr ? 'الكاشير · كريم عادل (مثال)' : 'Cashier · Karim Adel (Example)'}
                        </p>
                        <p className="text-[11px] font-bold text-[#2F8F5B]">
                          {isAr ? 'مناوب الآن · شاشة نشطة' : 'On Duty · Screen Active'}
                        </p>
                      </div>
                      <div className="bg-[#FBF7EF] border border-[#E8833A]/50 rounded-2xl p-3.5 space-y-1">
                        <p className="text-xs font-bold text-[#14285A]">
                          {isAr ? 'البار · لا يوجد مناوب' : 'Bar · Unassigned Shift'}
                        </p>
                        <p className="text-[11px] font-bold text-[#E8833A]">
                          {isAr ? 'متاح للمدير بدء المناوبة' : 'Available for Manager Relief'}
                        </p>
                      </div>
                    </div>
                    <div className="md:col-span-5 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#14285A]">
                        <UserCheck className="w-4 h-4 text-[#E8833A]" />
                        <span>
                          {isAr
                            ? 'تعديل أو إلغاء برقابة السبب (مثال)'
                            : 'Reason-Logged Edit / Cancel (Example)'}
                        </span>
                      </div>
                      <p className="text-xs text-[#0E1B3D]/80">
                        {isAr
                          ? '«إزالة صنف طاولة 4 — السبب: طلب الضيف التبديل قبل التحضير».'
                          : '"Removed Table 4 item — Reason: Guest requested swap before prep."'}
                      </p>
                    </div>
                  </div>
                )}

                {activeRole.id === 'owner' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-1">
                      <p className="text-[11px] font-bold text-[#0E1B3D]/65">
                        {isAr ? 'مبيعات اليوم (مثال)' : "Today's Sales (Example)"}
                      </p>
                      <p className="landing-cairo-heading text-xl text-[#14285A] font-mono-num">
                        18,950 {currencyLabel}
                      </p>
                      <p className="text-[11px] font-bold text-[#2F8F5B]">
                        {isAr ? '51 شيك مغلق بالأرشيف' : '51 closed checks archived'}
                      </p>
                    </div>
                    <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-1">
                      <p className="text-[11px] font-bold text-[#0E1B3D]/65">
                        {isAr ? 'الصلاحيات والثيمات (مثال)' : 'Permissions & Themes (Example)'}
                      </p>
                      <p className="landing-cairo-heading text-sm text-[#14285A]">
                        {isAr ? 'تحكم كامل بالمدير والكوادر' : 'Full control over managers & team'}
                      </p>
                      <p className="text-[11px] text-[#0E1B3D]/70">
                        {isAr ? 'كود الطاولة + إخفاء الأسعار' : 'Table QR Code + price visibility'}
                      </p>
                    </div>
                    <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-1">
                      <p className="text-[11px] font-bold text-[#0E1B3D]/65">
                        {isAr ? 'الولاء وتايجوس (مثال)' : 'Loyalty & Tygos ERP (Example)'}
                      </p>
                      <p className="landing-cairo-heading text-sm text-[#14285A]">
                        {isAr ? 'أختام وأعياد ميلاد + جرد مخزون' : 'Punch Card, birthdays + inventory sync'}
                      </p>
                      <p className="text-[11px] text-[#E8833A] font-bold">
                        {isAr ? 'ربط سحابي متكامل' : 'Integrated cloud connection'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3 Bullets Beneath Each Role Screen */}
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
              {(isAr ? activeRole.bulletsAr : activeRole.bulletsEn).map((point) => (
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
                <span>
                  {isAr
                    ? `الدور المحدد: ${activeRole.labelAr}`
                    : `Selected Role: ${activeRole.labelEn}`}
                </span>
              </div>
              <button
                type="button"
                onClick={onScrollToContact}
                className="min-h-[42px] px-6 py-2.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>
                  {isAr ? 'اطلب عرضاً حياً لجميع الشاشات' : 'Request a Live Demo of All Screens'}
                </span>
                <DirectionalArrow className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
