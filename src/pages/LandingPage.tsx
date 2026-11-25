import { FormEvent, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  Cake,
  Calendar,
  Check,
  ChefHat,
  Coffee,
  CreditCard,
  Gift,
  Languages,
  Lock,
  Menu,
  MessageCircle,
  QrCode,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { LanguageToggleButton } from '../components/LanguageToggleButton';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { OwnerAuthCard } from '../components/auth/OwnerAuthCard';
import { LandingOperationsShowcases } from '../components/landing/LandingOperationsShowcases';
import { LandingVisualShowcases } from '../components/landing/LandingVisualShowcases';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenUi } from '../contexts/PlatformUiContext';
import { DEFAULT_PLATFORM_LANDING } from '../data/defaultLandingSettings';
import { MENU_THEMES } from '../data/themes';
import { auth, isSuperAdminEmail } from '../lib/firebase';
import {
  fetchActiveCustomThemes,
  fetchPlatformLandingSettings,
} from '../lib/firestoreService';
import { applySeoMetadata, getPlatformShareMetadata } from '../lib/seoHead';
import { CustomTheme, PlatformLandingSettings } from '../types/menu';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

type DrawerNavId =
  | 'hero'
  | 'showcase_menu_qr'
  | 'showcase_themes'
  | 'showcase_roles'
  | 'showcase_supervision'
  | 'showcase_roles_access'
  | 'showcase_treasury_shifts'
  | 'showcase_reports_audit'
  | 'showcase_crm'
  | 'showcase_loyalty_marketing'
  | 'digital_menu'
  | 'hall_captain'
  | 'cashier'
  | 'kds'
  | 'management'
  | 'loyalty'
  | 'tygos'
  | 'pricing'
  | 'contact';

interface DrawerNavItem {
  id: DrawerNavId;
  ar: string;
  en: string;
  sectionId: string;
}

const DRAWER_ITEMS: DrawerNavItem[] = [
  { id: 'hero', ar: 'الرئيسية', en: 'Home', sectionId: 'hero' },
  {
    id: 'showcase_menu_qr',
    ar: 'المنيو الرقمي وكود الطاولة',
    en: 'Digital Menu & Table QR Code',
    sectionId: 'showcase-menu-qr',
  },
  { id: 'showcase_themes', ar: 'معرض الثيمات', en: 'Themes Gallery', sectionId: 'showcase-themes' },
  { id: 'showcase_roles', ar: 'شاشة لكل دور', en: 'Screen per Role', sectionId: 'showcase-roles' },
  {
    id: 'showcase_supervision',
    ar: 'المدير الإشرافي',
    en: 'Supervisory Manager',
    sectionId: 'showcase-supervision',
  },
  {
    id: 'showcase_roles_access',
    ar: 'الأدوار والصلاحيات والحسابات',
    en: 'Roles, Permissions & Accounts',
    sectionId: 'showcase-roles-access',
  },
  {
    id: 'showcase_treasury_shifts',
    ar: 'الخزنة والورديات',
    en: 'Treasury & Shifts',
    sectionId: 'showcase-treasury-shifts',
  },
  {
    id: 'showcase_reports_audit',
    ar: 'التقارير وسجل الرقابة',
    en: 'Reports & Audit Log',
    sectionId: 'showcase-reports-audit',
  },
  { id: 'showcase_crm', ar: 'إدارة العملاء', en: 'Customer CRM', sectionId: 'showcase-crm' },
  {
    id: 'showcase_loyalty_marketing',
    ar: 'الولاء والتسويق',
    en: 'Loyalty & Marketing',
    sectionId: 'showcase-loyalty-marketing',
  },
  {
    id: 'digital_menu',
    ar: 'تحديث المنيو والأسعار',
    en: 'Live Menu Updates',
    sectionId: 'digital-menu',
  },
  { id: 'hall_captain', ar: 'الصالة والكابتن', en: 'Dine-in & Captain', sectionId: 'hall-captain' },
  { id: 'cashier', ar: 'الكاشير', en: 'Cashier / POS', sectionId: 'cashier' },
  { id: 'kds', ar: 'شاشات المطبخ', en: 'Kitchen Display System', sectionId: 'kds' },
  {
    id: 'management',
    ar: 'الإدارة والتقارير',
    en: 'Management & Reports',
    sectionId: 'management',
  },
  { id: 'loyalty', ar: 'العملاء والولاء', en: 'Customers & Loyalty', sectionId: 'loyalty' },
  { id: 'tygos', ar: 'التكامل مع تايجوس', en: 'Tygos ERP Sync', sectionId: 'tygos' },
  { id: 'pricing', ar: 'الأسعار', en: 'Pricing', sectionId: 'pricing' },
  { id: 'contact', ar: 'تواصل معنا', en: 'Contact Us', sectionId: 'contact' },
];

type TableStatusKey = 'available' | 'occupied' | 'bill' | 'delayed';
type PaymentMethodKey = 'cash' | 'visa' | 'split';

const TABLE_STATUS_ORDER: TableStatusKey[] = ['available', 'occupied', 'bill', 'delayed'];

const TABLE_STATUS_META: Record<
  TableStatusKey,
  { ar: string; en: string; bg: string; border: string; text: string; badgeBg: string; badgeText: string }
> = {
  available: {
    ar: 'متاحة',
    en: 'Available',
    bg: '#FBF7EF',
    border: '#2F8F5B',
    text: '#14285A',
    badgeBg: 'rgba(47, 143, 91, 0.14)',
    badgeText: '#2F8F5B',
  },
  occupied: {
    ar: 'مشغولة',
    en: 'Occupied',
    bg: '#14285A',
    border: '#14285A',
    text: '#FBF7EF',
    badgeBg: 'rgba(251, 247, 239, 0.16)',
    badgeText: '#FBF7EF',
  },
  bill: {
    ar: 'طلب فاتورة',
    en: 'Bill Requested',
    bg: '#F3EBDD',
    border: '#E8833A',
    text: '#14285A',
    badgeBg: 'rgba(232, 131, 58, 0.18)',
    badgeText: '#E8833A',
  },
  delayed: {
    ar: 'متأخرة',
    en: 'Overdue',
    bg: '#FFF3E8',
    border: '#E8833A',
    text: '#0E1B3D',
    badgeBg: '#E8833A',
    badgeText: '#FBF7EF',
  },
};

type KdsStage = 0 | 1 | 2;

const KDS_STAGE_META: Record<
  KdsStage,
  { ar: string; en: string; badgeBg: string; badgeText: string }
> = {
  0: {
    ar: 'قيد التحضير',
    en: 'Preparing',
    badgeBg: 'rgba(232, 131, 58, 0.16)',
    badgeText: '#E8833A',
  },
  1: { ar: 'جاهز', en: 'Ready', badgeBg: '#14285A', badgeText: '#FBF7EF' },
  2: { ar: 'تم التقديم', en: 'Served', badgeBg: 'rgba(47, 143, 91, 0.15)', badgeText: '#2F8F5B' },
};

const SHIFT_ARCHIVE_EXAMPLE = [
  {
    dayKey: 'thu',
    dayAr: 'الخميس',
    dayEn: 'Thursday',
    totalSales: '14,200',
    checksCount: 38,
    checks: [
      {
        id: '#401',
        tableAr: 'طاولة 3',
        tableEn: 'Table 3',
        methodAr: 'فيزا',
        methodEn: 'Card',
        amount: '460',
      },
      {
        id: '#402',
        tableAr: 'تيك أواي',
        tableEn: 'Takeaway',
        methodAr: 'كاش',
        methodEn: 'Cash',
        amount: '195',
      },
    ],
  },
  {
    dayKey: 'fri',
    dayAr: 'الجمعة',
    dayEn: 'Friday',
    totalSales: '18,950',
    checksCount: 51,
    checks: [
      {
        id: '#512',
        tableAr: 'طاولة 8',
        tableEn: 'Table 8',
        methodAr: 'مختلط',
        methodEn: 'Split',
        amount: '740',
      },
      {
        id: '#513',
        tableAr: 'طاولة 2',
        tableEn: 'Table 2',
        methodAr: 'فيزا',
        methodEn: 'Card',
        amount: '380',
      },
    ],
  },
  {
    dayKey: 'sat',
    dayAr: 'السبت',
    dayEn: 'Saturday',
    totalSales: '16,400',
    checksCount: 44,
    checks: [
      {
        id: '#604',
        tableAr: 'طاولة 1',
        tableEn: 'Table 1',
        methodAr: 'كاش',
        methodEn: 'Cash',
        amount: '510',
      },
      {
        id: '#605',
        tableAr: 'دليفري',
        tableEn: 'Delivery',
        methodAr: 'فيزا',
        methodEn: 'Card',
        amount: '290',
      },
    ],
  },
];

const TYGOS_MEAL_EXAMPLES = [
  {
    id: 'burger',
    shortAr: 'برجر (مثال)',
    shortEn: 'Burger (Example)',
    nameAr: 'وجبة سماش برجر (مثال)',
    nameEn: 'Smash Burger Meal (Example)',
    sellPrice: 200,
    cost: 76,
    marginPercent: 62,
    ingredientsAr: 'لحم صافي + خبز بريوش + جبن + صوص خاص',
    ingredientsEn: 'Beef patty + brioche bun + cheddar + house sauce',
  },
  {
    id: 'pasta',
    shortAr: 'باستا (مثال)',
    shortEn: 'Pasta (Example)',
    nameAr: 'باستا دجاج ألفريدو (مثال)',
    nameEn: 'Chicken Alfredo Pasta (Example)',
    sellPrice: 180,
    cost: 63,
    marginPercent: 65,
    ingredientsAr: 'مكرونة + صدور دجاج + كريمة طهي + بارميزان',
    ingredientsEn: 'Fettuccine + chicken breast + cooking cream + parmesan',
  },
];

const PREVIEW_THEMES = [
  {
    id: 'sand-royal',
    labelAr: 'كلاسيك رملي',
    labelEn: 'Sand & Royal',
    bg: '#F3EBDD',
    surface: '#FBF7EF',
    border: '#E6D9C3',
    heading: '#14285A',
    text: '#0E1B3D',
    ctaBg: '#14285A',
    ctaText: '#FBF7EF',
  },
  {
    id: 'obsidian-gold',
    labelAr: 'داكن فاخر',
    labelEn: 'Midnight Dark',
    bg: '#0E1B3D',
    surface: '#14285A',
    border: '#263F80',
    heading: '#FBF7EF',
    text: '#F3EBDD',
    ctaBg: '#E8833A',
    ctaText: '#0E1B3D',
  },
  {
    id: 'crisp-bistro',
    labelAr: 'أبيض هادئ',
    labelEn: 'Crisp Bistro',
    bg: '#FBF7EF',
    surface: '#FFFFFF',
    border: '#E6D9C3',
    heading: '#14285A',
    text: '#0E1B3D',
    ctaBg: '#14285A',
    ctaText: '#FBF7EF',
  },
  {
    id: 'warm-editorial',
    labelAr: 'تراثي دافئ',
    labelEn: 'Warm Editorial',
    bg: '#EFE4D1',
    surface: '#FBF7EF',
    border: '#DAC7A7',
    heading: '#14285A',
    text: '#0E1B3D',
    ctaBg: '#14285A',
    ctaText: '#F3EBDD',
  },
];

const PLACEHOLDER_PRICING_CARDS = [
  {
    id: 'plan-1',
    badgeAr: 'الباقة الأساسية',
    badgeEn: 'Starter Plan',
    nameAr: '[اسم الباقة الأولى — قابل للتعديل]',
    nameEn: '[Starter Plan Name — Editable]',
    priceAr: '[السعر يُحدد لاحقاً]',
    priceEn: '[Price Configured Later]',
    periodAr: '[دورة الاشتراك]',
    periodEn: '[Billing Cycle]',
    descriptionAr: '[وصف مختصر يوضح الفئة المناسبة للمقاهي والمطاعم الناشئة]',
    descriptionEn: '[Short summary tailored for cafes and growing single-branch venues]',
    bulletsAr: ['[ميزة أولى قابلة للتعديل]', '[ميزة ثانية قابلة للتعديل]', '[ميزة ثالثة قابلة للتعديل]'],
    bulletsEn: ['[Editable Feature One]', '[Editable Feature Two]', '[Editable Feature Three]'],
    featured: false,
  },
  {
    id: 'plan-2',
    badgeAr: 'الأكثر طلباً',
    badgeEn: 'Most Popular',
    nameAr: '[اسم الباقة المتكاملة — قابل للتعديل]',
    nameEn: '[Complete Operations Plan — Editable]',
    priceAr: '[السعر يُحدد لاحقاً]',
    priceEn: '[Price Configured Later]',
    periodAr: '[دورة الاشتراك]',
    periodEn: '[Billing Cycle]',
    descriptionAr: '[وصف مختصر يوضح التشغيل الكامل للصالة والكاشير والمطبخ والولاء]',
    descriptionEn: '[Short summary covering full Dine-in, Cashier / POS, Kitchen Display System, and Loyalty]',
    bulletsAr: ['[ميزة أولى قابلة للتعديل]', '[ميزة ثانية قابلة للتعديل]', '[ميزة ثالثة قابلة للتعديل]'],
    bulletsEn: ['[Editable Feature One]', '[Editable Feature Two]', '[Editable Feature Three]'],
    featured: true,
  },
  {
    id: 'plan-3',
    badgeAr: 'الباقة المتقدمة',
    badgeEn: 'Enterprise Plan',
    nameAr: '[اسم باقة التجهيز والربط — قابل للتعديل]',
    nameEn: '[Multi-Branch & Sync Plan — Editable]',
    priceAr: '[السعر يُحدد لاحقاً]',
    priceEn: '[Price Configured Later]',
    periodAr: '[دورة الاشتراك]',
    periodEn: '[Billing Cycle]',
    descriptionAr: '[وصف مختصر للفروع المتعددة والتجهيز الكامل والتكامل السحابي]',
    descriptionEn: '[Short summary for multi-branch onboarding, hardware setup, and cloud sync]',
    bulletsAr: ['[ميزة أولى قابلة للتعديل]', '[ميزة ثانية قابلة للتعديل]', '[ميزة ثالثة قابلة للتعديل]'],
    bulletsEn: ['[Editable Feature One]', '[Editable Feature Two]', '[Editable Feature Three]'],
    featured: false,
  },
];

export function LandingPage({ onNavigate }: LandingPageProps) {
  const { lang, dir } = useLanguage();
  const isAr = lang === 'ar';
  const DirectionalArrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const currencyLabel = isAr ? 'ج.م' : 'EGP';

  useScreenUi('landing_page');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cms, setCms] = useState<PlatformLandingSettings>(DEFAULT_PLATFORM_LANDING);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeNavId, setActiveNavId] = useState<DrawerNavId>('hero');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Hero Theme Switcher
  const [activeThemeIdx, setActiveThemeIdx] = useState(0);

  // Page 1: Digital Menu Simulation
  const [menuPriceUpdated, setMenuPriceUpdated] = useState(true);
  const [menuExampleLang, setMenuExampleLang] = useState<'ar' | 'en'>(lang);

  useEffect(() => {
    setMenuExampleLang(lang);
  }, [lang]);

  // Page 2: Hall & Captain Simulation
  const [tableStatuses, setTableStatuses] = useState<TableStatusKey[]>([
    'available',
    'occupied',
    'bill',
    'delayed',
  ]);
  const [selectedTableIndex, setSelectedTableIndex] = useState(1);

  // Page 3: Cashier Simulation
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodKey>('cash');
  const [checkClosed, setCheckClosed] = useState(false);

  // Page 4: KDS Simulation
  const [kdsStations, setKdsStations] = useState<[KdsStage, KdsStage, KdsStage]>([0, 1, 2]);

  // Page 5: Management & Reports Simulation
  const [selectedShiftIdx, setSelectedShiftIdx] = useState(1);
  const [managerPerms, setManagerPerms] = useState({
    pauseItems: true,
    editWithReason: true,
    tableQr: false,
  });

  // Page 6: Loyalty Simulation
  const [stampCount, setStampCount] = useState(4);
  const [birthdayGreetSent, setBirthdayGreetSent] = useState(false);

  // Page 7: Tygos Simulation
  const [selectedMealIdx, setSelectedMealIdx] = useState(0);

  // Page 9: Contact Form (local UI only)
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactNotes, setContactNotes] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);

  const isSuperAdmin = isSuperAdminEmail(currentUser?.email);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    fetchPlatformLandingSettings().then(setCms);
    fetchActiveCustomThemes().then(setCustomThemes);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    applySeoMetadata(getPlatformShareMetadata(cms, lang, window.location.origin));
  }, [cms, lang]);

  useEffect(() => {
    if (!drawerOpen && !authModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        setAuthModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen, authModalOpen]);

  // Scroll Progress Bar + Live Active Section Detection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0;
      setScrollProgress(pct);

      const triggerY = scrollTop + 160;
      let currentActive: DrawerNavId = 'hero';
      for (const item of DRAWER_ITEMS) {
        const el = document.getElementById(item.sectionId);
        if (el && el.offsetTop <= triggerY) {
          currentActive = item.id;
        }
      }
      setActiveNavId(currentActive);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Gentle auto-simulation for Digital Menu price toggle (respects reduced motion)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const timer = window.setInterval(() => {
      setMenuPriceUpdated((prev) => !prev);
    }, 3600);
    return () => window.clearInterval(timer);
  }, []);

  const cleanWhatsappDigits = (
    cms.supportWhatsapp ||
    DEFAULT_PLATFORM_LANDING.supportWhatsapp ||
    '201000000000'
  ).replace(/[^\d]/g, '');
  const whatsappNumber = cleanWhatsappDigits || '201000000000';
  const whatsappDirectHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    isAr
      ? 'أهلاً فريق سُفرة QR، أرغب في معرفة التفاصيل وتجهيز مطعمي.'
      : 'Hello Sufra QR team, I would like to learn more and set up my restaurant.'
  )}`;

  const totalThemesCount = MENU_THEMES.length + customThemes.length;
  const activeHeroTheme = PREVIEW_THEMES[activeThemeIdx] || PREVIEW_THEMES[0];
  const activeShift = SHIFT_ARCHIVE_EXAMPLE[selectedShiftIdx] || SHIFT_ARCHIVE_EXAMPLE[0];
  const activeMeal = TYGOS_MEAL_EXAMPLES[selectedMealIdx] || TYGOS_MEAL_EXAMPLES[0];

  const scrollToSection = (sectionId: string, navId?: DrawerNavId) => {
    if (navId) setActiveNavId(navId);
    setDrawerOpen(false);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePrimaryStart = () => {
    onNavigate(isSuperAdmin ? '/super-admin' : '/admin');
  };

  const cycleTableStatus = (index: number) => {
    setSelectedTableIndex(index);
    setTableStatuses((prev) =>
      prev.map((st, idx) => {
        if (idx !== index) return st;
        const nextIdx = (TABLE_STATUS_ORDER.indexOf(st) + 1) % TABLE_STATUS_ORDER.length;
        return TABLE_STATUS_ORDER[nextIdx];
      })
    );
  };

  const advanceKdsStation = (stationIdx: 0 | 1 | 2) => {
    setKdsStations((prev) => {
      const next = [...prev] as [KdsStage, KdsStage, KdsStage];
      next[stationIdx] = ((next[stationIdx] + 1) % 3) as KdsStage;
      return next;
    });
  };

  const handleContactSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactPhone.trim()) return;
    setContactSubmitted(true);
  };

  const contactPreFilledWhatsapp = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    isAr
      ? `مرحباً فريق سُفرة QR، الاسم/المطعم: ${contactName || 'غير محدد'} | الموبايل: ${
          contactPhone || 'غير محدد'
        }${contactNotes ? ` | ملاحظات: ${contactNotes}` : ''}`
      : `Hello Sufra QR team, Name/Restaurant: ${contactName || 'Unspecified'} | Phone: ${
          contactPhone || 'Unspecified'
        }${contactNotes ? ` | Notes: ${contactNotes}` : ''}`
  )}`;

  const paymentMethodLabel = (m: PaymentMethodKey) => {
    if (m === 'cash') return isAr ? 'كاش' : 'Cash';
    if (m === 'visa') return isAr ? 'فيزا' : 'Card';
    return isAr ? 'مختلط' : 'Split';
  };

  const activeDrawerItem = DRAWER_ITEMS.find((d) => d.id === activeNavId);

  return (
    <div
      dir={dir}
      className="landing-plex-body min-h-screen bg-[#F3EBDD] text-[#0E1B3D] flex flex-col selection:bg-[#14285A]/15 selection:text-[#14285A]"
    >
      {/* Sticky Header + Scroll Progress Bar */}
      <header className="sticky top-0 z-40 bg-[#F3EBDD]/95 backdrop-blur-sm border-b border-[#E6D9C3]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={isAr ? 'فتح القائمة الجانبية' : 'Open navigation menu'}
              aria-expanded={drawerOpen}
              className="w-11 h-11 rounded-2xl border border-[#E6D9C3] bg-[#FBF7EF] text-[#14285A] flex items-center justify-center hover:border-[#14285A]/40 transition-colors cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <a
              href="#hero"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('hero', 'hero');
              }}
              className="flex items-center gap-2.5 shrink-0"
            >
              <span className="w-9 h-9 rounded-xl bg-[#14285A] text-[#FBF7EF] flex items-center justify-center">
                <svg viewBox="0 0 28 28" className="w-5 h-5" fill="none" aria-hidden="true">
                  <rect x="4" y="4" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2.2" />
                  <rect x="16" y="4" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2.2" />
                  <rect x="4" y="16" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2.2" />
                  <circle cx="20" cy="20" r="3.5" fill="#E8833A" />
                </svg>
              </span>
              <span className="landing-cairo-heading text-lg sm:text-xl text-[#14285A]">
                {isAr ? 'سُفرة QR' : 'Sufra QR'}
              </span>
            </a>

            <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E1B3D]/70 ps-3 border-s border-[#E6D9C3] truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8833A] shrink-0" />
              <span className="truncate">
                {activeDrawerItem ? (isAr ? activeDrawerItem.ar : activeDrawerItem.en) : isAr ? 'الرئيسية' : 'Home'}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <LanguageToggleButton variant="light" compact />
            {currentUser ? (
              <button
                type="button"
                onClick={handlePrimaryStart}
                className="px-4 py-2.5 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs sm:text-sm font-bold hover:opacity-95 transition-opacity cursor-pointer flex items-center gap-2 whitespace-nowrap"
              >
                {isSuperAdmin && <ShieldCheck className="w-4 h-4 text-[#E8833A]" />}
                <span>
                  {isSuperAdmin
                    ? isAr
                      ? 'لوحة مدير المنصة'
                      : 'Super Admin'
                    : isAr
                      ? 'لوحة التحكم'
                      : 'Dashboard'}
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="hidden sm:inline-flex px-4 py-2.5 rounded-xl border border-[#E6D9C3] bg-[#FBF7EF] text-[#14285A] text-xs sm:text-sm font-bold hover:border-[#14285A]/40 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isAr ? 'دخول الحساب' : 'Sign In'}
                </button>
                <button
                  type="button"
                  onClick={handlePrimaryStart}
                  className="px-4 py-2.5 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs sm:text-sm font-bold hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap"
                >
                  {isAr ? 'ابدأ الآن' : 'Get Started'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Scroll Progress Bar */}
        <div className="h-1 w-full bg-[#E6D9C3]/70 overflow-hidden" aria-hidden="true">
          <div
            className="h-full bg-[#14285A] transition-[width] duration-150 ease-out"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </header>

      {/* Slide-Over Directional Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label={isAr ? 'القائمة الجانبية' : 'Navigation drawer'}
        >
          <div
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 bg-[#0E1B3D]/45 backdrop-blur-[2px] transition-opacity"
          />
          <aside
            className={`fixed inset-y-0 ${
              dir === 'rtl' ? 'right-0 border-l' : 'left-0 border-r'
            } w-80 max-w-[85vw] bg-[#FBF7EF] border-[#E6D9C3] shadow-2xl flex flex-col justify-between p-6 overflow-y-auto`}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E6D9C3]">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-[#14285A] text-[#FBF7EF] flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </span>
                  <span className="landing-cairo-heading text-lg text-[#14285A]">
                    {isAr ? 'سُفرة QR' : 'Sufra QR'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'}
                  className="w-10 h-10 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] text-[#14285A] flex items-center justify-center hover:border-[#14285A]/40 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1.5" aria-label={isAr ? 'أقسام المنصة' : 'Platform sections'}>
                {DRAWER_ITEMS.map((item) => {
                  const isActive = activeNavId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollToSection(item.sectionId, item.id)}
                      className={`w-full text-start px-4 py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                        isActive
                          ? 'bg-[#14285A] text-[#FBF7EF]'
                          : 'text-[#0E1B3D] hover:bg-[#F3EBDD]'
                      }`}
                    >
                      <span>{isAr ? item.ar : item.en}</span>
                      {isActive ? (
                        <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                      ) : (
                        <DirectionalArrow className="w-4 h-4 opacity-40 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-6 mt-6 border-t border-[#E6D9C3] space-y-3">
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  if (currentUser) {
                    handlePrimaryStart();
                  } else {
                    setAuthModalOpen(true);
                  }
                }}
                className="w-full py-3 px-4 rounded-xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4 text-[#E8833A]" />
                <span>
                  {currentUser
                    ? isAr
                      ? 'فتح لوحة التحكم'
                      : 'Open Dashboard'
                    : isAr
                      ? 'تسجيل دخول الإدارة'
                      : 'Owner & Admin Sign In'}
                </span>
              </button>
              <div className="flex items-center justify-center gap-2">
                <LanguageToggleButton variant="light" />
              </div>
              <div className="flex justify-center">
                <PWAInstallButton variant="compact" />
              </div>
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1">
        {/* 0. Hero Section + Interactive Theme Preview Strip */}
        <section id="hero" className="scroll-mt-20 py-14 sm:py-20 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              <div className="lg:col-span-6 space-y-6">
                <p className="text-xs sm:text-sm font-bold text-[#14285A] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                  <span>
                    {isAr
                      ? 'منظومة الضيافة الرقمية للمطاعم والكافيهات'
                      : 'Complete Hospitality Operating System for Restaurants & Cafes'}
                  </span>
                </p>

                <h1 className="landing-cairo-heading text-3xl sm:text-5xl lg:text-[3.35rem] text-[#14285A] leading-[1.18]">
                  {isAr
                    ? 'مطعمك شغّال أسرع.. من أول مسحة QR'
                    : 'Your restaurant runs faster—from the very first QR scan'}
                </h1>

                <p className="text-base sm:text-lg text-[#0E1B3D]/85 leading-relaxed max-w-xl">
                  {isAr
                    ? 'منيو تفاعلي يربط الضيف بالصالة والمطبخ والكاشير في خط واحد دون طباعة ورق أو ضياع طلبات.'
                    : 'An interactive Digital Menu uniting your guests, Dine-in floor, Kitchen Display System, and Cashier / POS in one synchronized flow.'}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handlePrimaryStart}
                    className="px-7 py-4 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm sm:text-base font-bold hover:opacity-95 transition-opacity flex items-center gap-2.5 cursor-pointer"
                  >
                    <span>{isAr ? 'ابدأ الآن' : 'Get Started'}</span>
                    <DirectionalArrow className="w-4 h-4 text-[#E8833A]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('digital-menu', 'digital_menu')}
                    className="px-7 py-4 rounded-2xl border border-[#E6D9C3] bg-[#FBF7EF] text-[#14285A] text-sm sm:text-base font-bold hover:border-[#14285A]/40 transition-colors cursor-pointer"
                  >
                    {isAr ? 'استعرض الأقسام' : 'Explore Modules'}
                  </button>
                </div>
              </div>

              {/* Animated QR-to-Order Card */}
              <div className="lg:col-span-6">
                <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-5 sm:p-8">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[#14285A]">
                      {isAr ? 'مسار الطلب اللحظي' : 'Real-Time Order Routing'}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-[#F3EBDD] border border-[#E6D9C3] text-[11px] font-bold text-[#0E1B3D]">
                      {isAr ? 'مثال توضيحي' : 'Live Example'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    <div className="sm:col-span-5 bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-5 flex flex-col items-center justify-center">
                      <div className="relative w-28 h-28 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-2.5 flex items-center justify-center overflow-hidden">
                        <svg viewBox="0 0 80 80" className="w-full h-full text-[#14285A]" fill="none" aria-hidden="true">
                          <rect x="6" y="6" width="22" height="22" rx="4" stroke="currentColor" strokeWidth="4" />
                          <rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor" />
                          <rect x="52" y="6" width="22" height="22" rx="4" stroke="currentColor" strokeWidth="4" />
                          <rect x="59" y="13" width="8" height="8" rx="1.5" fill="currentColor" />
                          <rect x="6" y="52" width="22" height="22" rx="4" stroke="currentColor" strokeWidth="4" />
                          <rect x="13" y="59" width="8" height="8" rx="1.5" fill="currentColor" />
                          <rect x="35" y="10" width="8" height="8" rx="2" fill="currentColor" />
                          <rect x="35" y="25" width="8" height="8" rx="2" fill="#E8833A" />
                          <rect x="10" y="36" width="8" height="8" rx="2" fill="currentColor" />
                          <rect x="26" y="38" width="12" height="8" rx="2" fill="currentColor" />
                          <rect x="46" y="36" width="10" height="8" rx="2" fill="currentColor" />
                          <rect x="62" y="36" width="8" height="12" rx="2" fill="currentColor" />
                          <rect x="36" y="52" width="10" height="10" rx="2" fill="currentColor" />
                          <rect x="52" y="52" width="20" height="8" rx="2" fill="currentColor" />
                        </svg>
                        <div
                          className="landing-qr-scan-line absolute inset-x-2 top-2 h-0.5 bg-[#E8833A] rounded-full"
                          aria-hidden="true"
                        />
                      </div>
                      <span className="mt-2.5 text-[11px] font-bold text-[#14285A] font-mono-num">
                        {isAr ? 'طاولة رقم 4' : 'Table #4'}
                      </span>
                    </div>

                    <div className="sm:col-span-1 flex items-center justify-center">
                      <span
                        className={`w-8 h-8 rounded-full bg-[#F3EBDD] border border-[#E6D9C3] flex items-center justify-center text-[#E8833A] ${
                          dir === 'rtl' ? '-rotate-90 sm:rotate-0' : 'rotate-90 sm:rotate-0'
                        }`}
                      >
                        <DirectionalArrow className="w-4 h-4" />
                      </span>
                    </div>

                    <div className="sm:col-span-6 bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-[#14285A] pb-2 border-b border-[#E6D9C3]">
                        <span>{isAr ? 'إشعار التشغيل' : 'Station Dispatch'}</span>
                        <span className="w-2 h-2 rounded-full bg-[#E8833A] landing-stage-dot" />
                      </div>
                      <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                        <span className="font-semibold">
                          {isAr ? 'طلب ساخن · المطبخ' : 'Hot Kitchen · Grill'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#E8833A]/15 text-[#E8833A] font-bold">
                          {isAr ? 'انتظار' : 'Pending'}
                        </span>
                      </div>
                      <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                        <span className="font-semibold">
                          {isAr ? 'مشروب بارد · البار' : 'Cold Drink · Bar'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#2F8F5B]/15 text-[#2F8F5B] font-bold">
                          {isAr ? 'تم' : 'Ready'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Theme Switcher Overview Strip */}
            <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-5 space-y-3">
                <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E8833A]" />
                  <span>
                    {customThemes.length > 0
                      ? isAr
                        ? `${totalThemesCount} ثيماً حياً لهوية مطعمك`
                        : `${totalThemesCount} Live Themes for Your Restaurant`
                      : isAr
                        ? `${MENU_THEMES.length} ثيمات مدمجة جاهزة لهوية مطعمك`
                        : `${MENU_THEMES.length} Built-in Themes Ready for Your Brand`}
                  </span>
                </span>
                <h2 className="landing-cairo-heading text-xl sm:text-2xl text-[#14285A]">
                  {isAr
                    ? 'بدّل مظهر المنيو بنفس كود الطاولة'
                    : 'Switch menu styling with the same Table QR Code'}
                </h2>
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {PREVIEW_THEMES.map((themeItem, idx) => (
                    <button
                      key={themeItem.id}
                      type="button"
                      onClick={() => setActiveThemeIdx(idx)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-start transition-colors cursor-pointer flex items-center justify-between ${
                        activeThemeIdx === idx
                          ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                          : 'bg-[#F3EBDD] border-[#E6D9C3] text-[#14285A]'
                      }`}
                    >
                      <span>{isAr ? themeItem.labelAr : themeItem.labelEn}</span>
                      <span
                        className="w-3 h-3 rounded-full border border-white/40"
                        style={{ backgroundColor: themeItem.bg }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-7">
                <div
                  className="rounded-2xl border p-4 sm:p-5 transition-colors duration-300"
                  style={{
                    backgroundColor: activeHeroTheme.bg,
                    borderColor: activeHeroTheme.border,
                    color: activeHeroTheme.text,
                  }}
                >
                  <div
                    className="flex items-center justify-between pb-3 mb-3 border-b"
                    style={{ borderColor: activeHeroTheme.border }}
                  >
                    <span
                      className="landing-cairo-heading text-sm sm:text-base"
                      style={{ color: activeHeroTheme.heading }}
                    >
                      {isAr
                        ? `مثال معاينة · ${activeHeroTheme.labelAr}`
                        : `Live Preview · ${activeHeroTheme.labelEn}`}
                    </span>
                    <span
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold"
                      style={{
                        backgroundColor: activeHeroTheme.ctaBg,
                        color: activeHeroTheme.ctaText,
                      }}
                    >
                      {isAr ? 'ثابت على نفس الكود' : 'Same Table QR Code'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(isAr
                      ? ['وجبة شيش مشوي · 195 ج.م', 'قهوة مثلجة · 70 ج.م']
                      : ['Chargrilled Shish Meal · 195 EGP', 'Iced Specialty Coffee · 70 EGP']
                    ).map((sample) => (
                      <div
                        key={sample}
                        className="rounded-xl border px-3.5 py-3 text-xs font-bold font-mono-num"
                        style={{
                          backgroundColor: activeHeroTheme.surface,
                          borderColor: activeHeroTheme.border,
                        }}
                      >
                        {sample}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Three Visual Showcases: Menu & QR, Real Themes Gallery, Role Screens */}
        <LandingVisualShowcases
          customThemes={customThemes}
          onScrollToContact={() => scrollToSection('contact', 'contact')}
        />

        {/* Six Verified Operations, Treasury, Reporting, CRM & Loyalty Showcases */}
        <LandingOperationsShowcases
          onScrollToContact={() => scrollToSection('contact', 'contact')}
        />

        {/* 1. Digital Menu */}
        <section id="digital-menu" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span className="font-mono-num">
                  {isAr ? '01 · المنيو الرقمي' : '01 · Digital Menu'}
                </span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                {isAr ? 'منيو يتحدث لحظياً في كل طاولة' : 'A Digital Menu that updates instantly at every table'}
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                {isAr
                  ? 'غيّر السعر أو لغة العرض ليصل التحديث لضيفك في نفس الثانية دون إعادة طباعة.'
                  : 'Update any price or toggle Arabic and English—guests see live changes in seconds with zero reprinting.'}
              </p>
            </div>

            {/* Interactive Simulation Card */}
            <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="px-3 py-1 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                  {isAr
                    ? 'مثال · محاكاة تحديث السعر واللغة'
                    : 'Example · Live Price & Language Sync'}
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMenuPriceUpdated((prev) => !prev)}
                    className="px-3.5 py-2 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs font-bold cursor-pointer hover:opacity-95 transition-opacity font-mono-num"
                  >
                    {menuPriceUpdated
                      ? isAr
                        ? 'إرجاع السعر 120'
                        : 'Reset Price to 120'
                      : isAr
                        ? 'تحديث السعر إلى 135'
                        : 'Update Price to 135'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuExampleLang((l) => (l === 'ar' ? 'en' : 'ar'))}
                    className="px-3.5 py-2 rounded-xl border border-[#E6D9C3] bg-[#FBF7EF] text-[#14285A] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Languages className="w-4 h-4 text-[#E8833A]" />
                    <span>
                      {menuExampleLang === 'ar'
                        ? isAr
                          ? 'التبديل إلى الإنجليزية'
                          : 'Switch Card to EN'
                        : isAr
                          ? 'التبديل إلى العربية'
                          : 'Switch Card to AR'}
                    </span>
                  </button>
                </div>
              </div>

              <div
                dir={menuExampleLang === 'en' ? 'ltr' : 'rtl'}
                className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#F3EBDD] border border-[#E6D9C3] flex items-center justify-center text-[#14285A] shrink-0">
                    <UtensilsCrossed className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[#E8833A]">
                      {menuExampleLang === 'ar' ? 'الأطباق الرئيسية · مثال' : 'Main Courses · Example'}
                    </p>
                    <h3 className="landing-cairo-heading text-lg sm:text-xl text-[#14285A]">
                      {menuExampleLang === 'ar' ? 'شيش طاووق مشوي على الفحم' : 'Chargrilled Shish Tawook'}
                    </h3>
                    <p className="text-xs text-[#0E1B3D]/75 mt-0.5">
                      {menuExampleLang === 'ar'
                        ? 'يُقدّم مع بطاطس محمرة وخبز طازج'
                        : 'Served with crispy fries and warm pita bread'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="text-end">
                    <span className="block text-[11px] text-[#0E1B3D]/55 line-through font-mono-num">
                      {menuPriceUpdated ? (menuExampleLang === 'ar' ? '120 ج.م' : '120 EGP') : ''}
                    </span>
                    <span className="landing-price-pulse inline-block landing-cairo-heading text-2xl text-[#14285A] font-mono-num">
                      {menuPriceUpdated
                        ? menuExampleLang === 'ar'
                          ? '135 ج.م'
                          : '135 EGP'
                        : menuExampleLang === 'ar'
                          ? '120 ج.م'
                          : '120 EGP'}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                      menuPriceUpdated
                        ? 'bg-[#2F8F5B]/15 text-[#2F8F5B]'
                        : 'bg-[#E8833A]/15 text-[#E8833A]'
                    }`}
                  >
                    {menuPriceUpdated
                      ? menuExampleLang === 'ar'
                        ? 'تم التحديث'
                        : 'Live Updated'
                      : menuExampleLang === 'ar'
                        ? 'السعر السابق'
                        : 'Previous'}
                  </span>
                </div>
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'تعديل الأسعار والأحجام والإضافات يظهر للضيوف في لحظتها.'
                    : 'Edits to prices, sizes, and add-ons reflect on guest devices immediately.'}
                </span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'تبديل سلس بين العربية والإنجليزية بلمسة واحدة داخل المنيو.'
                    : 'Seamless one-tap Arabic and English switching built directly into the menu.'}
                </span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'نفس كود الطاولة يظل ثابتاً على كل ترابيزة دون تكاليف طباعة.'
                    : 'Your printed Table QR Code never changes—zero reprinting costs.'}
                </span>
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className="px-6 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>
                  {isAr ? 'تواصل لتفعيل المنيو الرقمي' : 'Activate Your Digital Menu'}
                </span>
                <DirectionalArrow className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </section>

        {/* 2. Hall & Captain */}
        <section id="hall-captain" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#F3EBDD]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span className="font-mono-num">
                  {isAr ? '02 · الصالة والكابتن' : '02 · Dine-in & Captain'}
                </span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                {isAr
                  ? 'خريطة طاولات حية وطلب جماعي وفصل الحساب'
                  : 'Live table grid, group ordering & per-guest Split Check'}
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                {isAr
                  ? 'متابعة فورية لحالة كل طاولة على الصالة مع تقسيم الشيك بالاسم بين أفراد الترابيزة.'
                  : 'Track every Dine-in table color in real time while guests combine group carts or split the Check by name.'}
              </p>
            </div>

            {/* Interactive Simulation Card */}
            <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="px-3 py-1 rounded-xl bg-[#F3EBDD] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                  {isAr
                    ? 'مثال · اضغط على أي طاولة لتغيير حالتها'
                    : 'Example · Click any table to cycle its live status'}
                </span>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                  {TABLE_STATUS_ORDER.map((k) => (
                    <span
                      key={k}
                      className="px-2.5 py-1 rounded-lg border"
                      style={{
                        backgroundColor: TABLE_STATUS_META[k].badgeBg,
                        borderColor: TABLE_STATUS_META[k].border,
                        color:
                          TABLE_STATUS_META[k].badgeText === '#FBF7EF' && k === 'occupied'
                            ? '#14285A'
                            : TABLE_STATUS_META[k].text,
                      }}
                    >
                      {isAr ? TABLE_STATUS_META[k].ar : TABLE_STATUS_META[k].en}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* 4 Interactive Tables */}
                <div className="lg:col-span-6 grid grid-cols-2 gap-3.5">
                  {tableStatuses.map((statusKey, idx) => {
                    const meta = TABLE_STATUS_META[statusKey];
                    const isFocused = selectedTableIndex === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => cycleTableStatus(idx)}
                        className={`p-4 rounded-2xl border-2 text-start transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[104px] ${
                          isFocused ? 'ring-2 ring-[#E8833A]/40' : ''
                        }`}
                        style={{
                          backgroundColor: meta.bg,
                          borderColor: meta.border,
                          color: meta.text,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="landing-cairo-heading text-base font-mono-num">
                            {isAr ? `طاولة ${idx + 1}` : `Table ${idx + 1}`}
                          </span>
                          <Users className="w-4 h-4 opacity-75" />
                        </div>
                        <span
                          className="self-start px-2.5 py-1 rounded-lg text-[11px] font-bold"
                          style={{ backgroundColor: meta.badgeBg, color: meta.badgeText }}
                        >
                          {isAr ? meta.ar : meta.en}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Collaborative Group Table & Split Check */}
                <div className="lg:col-span-6 bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-5 space-y-3.5">
                  <div className="flex items-center justify-between border-b border-[#E6D9C3] pb-2.5">
                    <span className="landing-cairo-heading text-sm text-[#14285A]">
                      {isAr
                        ? `الطلب الجماعي وتقسيم الشيك · طاولة ${selectedTableIndex + 1} (مثال)`
                        : `Group Order & Split Check · Table ${selectedTableIndex + 1} (Example)`}
                    </span>
                    <span className="text-xs font-bold text-[#E8833A]">
                      {isAr ? 'حساب منفصل' : 'Per Guest'}
                    </span>
                  </div>

                  {[
                    {
                      ar: 'أحمد (برجر + كولا)',
                      en: 'Ahmed (Burger + Cola)',
                      amount: `165 ${currencyLabel}`,
                    },
                    {
                      ar: 'سارة (سلطة + قهوة)',
                      en: 'Sara (Salad + Coffee)',
                      amount: `120 ${currencyLabel}`,
                    },
                    {
                      ar: 'كريم (باستا + عصير)',
                      en: 'Karim (Pasta + Juice)',
                      amount: `155 ${currencyLabel}`,
                    },
                  ].map((split) => (
                    <div
                      key={split.en}
                      className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-[#0E1B3D]">
                        {isAr ? split.ar : split.en}
                      </span>
                      <span className="font-mono-num font-bold text-[#14285A]">{split.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'ألوان فورية تميز الطاولة المتاحة والمشغولة وطلب الفاتورة والمتأخرة.'
                    : 'Instant color states distinguish Available, Occupied, Bill Requested, and Overdue tables.'}
                </span>
              </li>
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'طلب جماعي مشترك من موبايلات الضيوف في سلة واحدة للترابيزة.'
                    : 'Collaborative multi-phone ordering merges into one unified table session.'}
                </span>
              </li>
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'فصل وتقسيم الشيك لكل ضيف بالاسم دون حسابات يدوية.'
                    : 'Instant Split Check totals per guest by name with zero manual math.'}
                </span>
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className="px-6 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>
                  {isAr ? 'تواصل لتجهيز الصالة والكابتن' : 'Set Up Your Dine-in Floor & Captain'}
                </span>
                <DirectionalArrow className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </section>

        {/* 3. Cashier / POS */}
        <section id="cashier" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span className="font-mono-num">
                  {isAr ? '03 · الكاشير' : '03 · Cashier / POS'}
                </span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                {isAr
                  ? 'تحصيل مرن وشاشة نظيفة من الشيكات المقفولة'
                  : 'Fast settlement and a queue clear of Paid checks'}
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                {isAr
                  ? 'أغلق الشيك كاش أو فيزا أو مختلط ليُضاف الرصيد للدرج ويختفي الشيك فوراً من أمامك.'
                  : 'Close each Check via Cash, Card, or Split tender—the Cash Drawer updates live and Paid checks move straight to history.'}
              </p>
            </div>

            {/* Interactive Simulation Card */}
            <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="px-3 py-1 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                  {isAr
                    ? 'مثال · محاكاة إقفال شيك وتحديث رصيد الدرج'
                    : 'Example · Check Settlement & Cash Drawer Update'}
                </span>
                <div className="bg-[#14285A] text-[#FBF7EF] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#E8833A]" />
                  <span>{isAr ? 'رصيد الدرج الحالي:' : 'Cash Drawer Balance:'}</span>
                  <span className="font-mono-num text-base">
                    {checkClosed ? `4,850 ${currencyLabel}` : `4,600 ${currencyLabel}`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                <div className="md:col-span-7">
                  {!checkClosed ? (
                    <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-5 space-y-4 transition-all duration-300">
                      <div className="flex items-center justify-between border-b border-[#E6D9C3] pb-3">
                        <div>
                          <p className="landing-cairo-heading text-base text-[#14285A]">
                            {isAr
                              ? 'شيك مفتوح #108 · طاولة 5 (مثال)'
                              : 'Open Check #108 · Table 5 (Example)'}
                          </p>
                          <p className="text-xs text-[#0E1B3D]/70 font-mono-num">
                            {isAr ? '3 أصناف جاهزة للتحصيل' : '3 items ready for settlement'}
                          </p>
                        </div>
                        <span className="landing-cairo-heading text-xl text-[#14285A] font-mono-num">
                          250 {currencyLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {(['cash', 'visa', 'split'] as const).map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setPaymentMethod(method)}
                            className={`px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                              paymentMethod === method
                                ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                                : 'bg-[#F3EBDD] border-[#E6D9C3] text-[#14285A]'
                            }`}
                          >
                            {paymentMethodLabel(method)}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setCheckClosed(true)}
                        className="w-full py-3 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs sm:text-sm font-bold hover:opacity-95 transition-opacity cursor-pointer"
                      >
                        {isAr
                          ? `تأكيد التحصيل (${paymentMethodLabel(paymentMethod)}) وإغلاق الشيك`
                          : `Confirm Payment (${paymentMethodLabel(paymentMethod)}) & Close Check`}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-[#FBF7EF] border border-dashed border-[#E6D9C3] rounded-2xl p-6 text-center space-y-3">
                      <span className="inline-flex px-3 py-1 rounded-lg bg-[#2F8F5B]/15 text-[#2F8F5B] text-xs font-bold">
                        {isAr
                          ? `تم إقفال الشيك (${paymentMethodLabel(paymentMethod)}) واختفاؤه من القائمة`
                          : `Check Paid (${paymentMethodLabel(paymentMethod)}) & cleared from active queue`}
                      </span>
                      <p className="text-xs text-[#0E1B3D]/80">
                        {isAr
                          ? 'الشيكات المقفولة لا تزدحم بها شاشة الكاشير وتُحفظ في أرشيف صاحب المطعم.'
                          : 'Paid checks keep your Cashier / POS screen uncluttered and remain archived for the owner.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setCheckClosed(false)}
                        className="px-4 py-2 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] text-[#14285A] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{isAr ? 'إعادة عرض الشيك (مثال)' : 'Reset Check Example'}</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="md:col-span-5 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-5 space-y-3">
                  <p className="landing-cairo-heading text-sm text-[#14285A]">
                    {isAr ? 'ملخص حركة الدرج (مثال)' : 'Cash Drawer Summary (Example)'}
                  </p>
                  <div className="flex items-center justify-between text-xs py-2 border-b border-[#E6D9C3]">
                    <span>{isAr ? 'رصيد افتتاح الوردية' : 'Shift Opening Float'}</span>
                    <span className="font-mono-num font-bold">4,600 {currencyLabel}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-2 border-b border-[#E6D9C3]">
                    <span>
                      {isAr
                        ? `آخر شيك محصّل (${paymentMethodLabel(paymentMethod)})`
                        : `Last Paid Check (${paymentMethodLabel(paymentMethod)})`}
                    </span>
                    <span className="font-mono-num font-bold text-[#2F8F5B]">
                      {checkClosed ? `+ 250 ${currencyLabel}` : `0 ${currencyLabel}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#14285A] pt-1">
                    <span>{isAr ? 'الرصيد المتوقع بالدرج' : 'Expected Drawer Cash'}</span>
                    <span className="font-mono-num">
                      {checkClosed ? `4,850 ${currencyLabel}` : `4,600 ${currencyLabel}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'تحصيل سريع كاش أو فيزا أو مختلط بينهما داخل نفس الشيك.'
                    : 'Fast Cash, Card, or Split settlement within a single Check.'}
                </span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'إضافة طلبات تيك أواي ودليفري ومتابعة خريطة الطاولات من شاشة الكاشير.'
                    : 'Create Takeaway and Delivery orders while monitoring live Dine-in tables from one POS.'}
                </span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'إخفاء الشيكات المقفولة تلقائياً لمنع الزحام طوال الوردية.'
                    : 'Automatically clears Paid checks so active queues stay fast throughout the Shift.'}
                </span>
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className="px-6 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>
                  {isAr ? 'تواصل لتجربة شاشة الكاشير' : 'Schedule a Cashier / POS Demo'}
                </span>
                <DirectionalArrow className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </section>

        {/* 4. Kitchen Display System (KDS) */}
        <section id="kds" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#F3EBDD]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span className="font-mono-num">
                  {isAr ? '04 · شاشات المطبخ' : '04 · Kitchen Display System (KDS)'}
                </span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                {isAr
                  ? 'توجيه تلقائي للمطبخ والبار والحلواني'
                  : 'Automatic routing to Kitchen, Bar, and Pastry'}
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                {isAr
                  ? 'الطلب الواحد يتقسم على كل محطة تحضير بحالة واضحة من قيد التحضير حتى تم التقديم.'
                  : 'Every order splits automatically across prep stations with clear status from Preparing to Ready and Served.'}
              </p>
            </div>

            {/* Interactive Simulation Card */}
            <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="px-3 py-1 rounded-xl bg-[#F3EBDD] border border-[#E6D9C3] text-xs font-bold text-[#14285A] font-mono-num">
                  {isAr
                    ? 'مثال · طلب #214 (طاولة 5) — اضغط على المحطة لتحديث الحالة'
                    : 'Example · Order #214 (Table 5) — Tap a station to advance status'}
                </span>
                <span className="text-xs font-semibold text-[#0E1B3D]/70">
                  {isAr
                    ? 'برتقالي: قيد التحضير · أزرق: جاهز · أخضر: تم التقديم'
                    : 'Orange: Preparing · Royal Blue: Ready · Green: Served'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    titleAr: 'شاشة المطبخ',
                    titleEn: 'Kitchen Display',
                    itemAr: 'سماش برجر دبل',
                    itemEn: 'Double Smash Burger',
                    icon: ChefHat,
                  },
                  {
                    titleAr: 'شاشة البار',
                    titleEn: 'Bar Display',
                    itemAr: 'موهيتو نعناع مثلج',
                    itemEn: 'Iced Mint Mojito',
                    icon: Coffee,
                  },
                  {
                    titleAr: 'شاشة الحلواني',
                    titleEn: 'Pastry Display',
                    itemAr: 'مولتن كيك شوكولاتة',
                    itemEn: 'Chocolate Molten Cake',
                    icon: Sparkles,
                  },
                ].map((station, idx) => {
                  const stage = kdsStations[idx];
                  const meta = KDS_STAGE_META[stage];
                  const IconComp = station.icon;
                  return (
                    <button
                      key={station.titleEn}
                      type="button"
                      onClick={() => advanceKdsStation(idx as 0 | 1 | 2)}
                      className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-5 text-start space-y-4 hover:border-[#14285A]/45 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="w-10 h-10 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-[#14285A] flex items-center justify-center">
                          <IconComp className="w-5 h-5" />
                        </span>
                        <span
                          className="px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                          style={{ backgroundColor: meta.badgeBg, color: meta.badgeText }}
                        >
                          {isAr ? meta.ar : meta.en}
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-[#0E1B3D]/65">
                          {isAr ? station.titleAr : station.titleEn}
                        </p>
                        <p className="landing-cairo-heading text-base text-[#14285A] mt-0.5">
                          {isAr ? station.itemAr : station.itemEn}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'فصل تلقائي لأصناف المطبخ والبار والحلواني لحظة تأكيد الطلب.'
                    : 'Automatic routing splits Kitchen, Bar, and Pastry items upon submission.'}
                </span>
              </li>
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'تتبع واضح للحالة: قيد التحضير ثم جاهز ثم تم التقديم.'
                    : 'Clear stage tracking: Preparing, Ready for pickup, and Served.'}
                </span>
              </li>
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'تنبيهات فورية تقلل زمن التحضير وتمنع نسيان أي صنف.'
                    : 'Instant ready alerts speed up ticket times and eliminate missed dishes.'}
                </span>
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className="px-6 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>
                  {isAr ? 'تواصل لتجهيز شاشات المطبخ' : 'Configure Your Kitchen Display System'}
                </span>
                <DirectionalArrow className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </section>

        {/* 5. Management & Reports */}
        <section id="management" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span className="font-mono-num">
                  {isAr ? '05 · الإدارة والتقارير' : '05 · Management & Reports'}
                </span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                {isAr
                  ? 'مراجعة الورديات السابقة وسجل الرقابة والصلاحيات'
                  : 'Past shift archives, Audit Log, and granular Permissions'}
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                {isAr
                  ? 'افتح شيكات أي يوم بضغطة، راجع أسباب التعديل، وحدد صلاحيات المدير بدقة.'
                  : 'Inspect any closed day’s checks in one click, review documented edits, and toggle Manager Permissions anytime.'}
              </p>
            </div>

            {/* Interactive Simulation Card */}
            <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="px-3 py-1 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                  {isAr
                    ? 'مثال · مصفوفة الورديات وسجل الرقابة وصلاحيات المدير'
                    : 'Example · Shift Matrix, Audit Log & Manager Permissions'}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Shift Matrix */}
                <div className="lg:col-span-6 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#14285A]">
                    <Calendar className="w-4 h-4 text-[#E8833A]" />
                    <span>
                      {isAr
                        ? 'اضغط على أي يوم لفتح شيكاته (مثال)'
                        : 'Select any day to inspect archived checks (Example)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {SHIFT_ARCHIVE_EXAMPLE.map((day, idx) => (
                      <button
                        key={day.dayKey}
                        type="button"
                        onClick={() => setSelectedShiftIdx(idx)}
                        className={`p-2.5 rounded-xl border text-center cursor-pointer transition-colors ${
                          selectedShiftIdx === idx
                            ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                            : 'bg-[#F3EBDD] border-[#E6D9C3] text-[#14285A]'
                        }`}
                      >
                        <p className="text-xs font-bold">{isAr ? day.dayAr : day.dayEn}</p>
                        <p className="text-[11px] opacity-80 font-mono-num">
                          {isAr ? `${day.checksCount} شيك` : `${day.checksCount} checks`}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                      <span>
                        {isAr ? `شيكات ${activeShift.dayAr}` : `${activeShift.dayEn} Checks`}
                      </span>
                      <span className="font-mono-num">
                        {activeShift.totalSales} {currencyLabel}
                      </span>
                    </div>
                    {activeShift.checks.map((chk) => (
                      <div
                        key={chk.id}
                        className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                      >
                        <span>
                          {chk.id} · {isAr ? chk.tableAr : chk.tableEn} ({isAr ? chk.methodAr : chk.methodEn})
                        </span>
                        <span className="font-mono-num font-bold text-[#14285A]">
                          {chk.amount} {currencyLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audit Log & Manager Permission Toggles */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                      <span className="flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-[#E8833A]" />
                        <span>{isAr ? 'سجل الرقابة (مثال)' : 'Audit Log (Example)'}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#E8833A]/15 text-[#E8833A]">
                        {isAr ? 'موثّق' : 'Logged'}
                      </span>
                    </div>
                    <p className="text-xs text-[#0E1B3D]/85">
                      {isAr
                        ? 'المدير (@mosalah) قام بإلغاء صنف من طاولة 6 · السبب: «طلب الضيف قبل التحضير».'
                        : 'Manager (@mosalah) cancelled an item on Table 6 · Reason: "Guest request before prep."'}
                    </p>
                  </div>

                  <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-2.5">
                    <p className="text-xs font-bold text-[#14285A]">
                      {isAr
                        ? 'صلاحيات المدير (تبديل مثال)'
                        : 'Manager Permissions (Interactive Example)'}
                    </p>
                    {(
                      [
                        {
                          key: 'pauseItems',
                          ar: 'إيقاف الأصناف غير المتوفرة مؤقتاً',
                          en: 'Pause out-of-stock items',
                        },
                        {
                          key: 'editWithReason',
                          ar: 'تعديل أو إلغاء الشيك بكتابة سبب',
                          en: 'Edit or cancel checks with reason',
                        },
                        {
                          key: 'tableQr',
                          ar: 'صلاحية توليد كود الطاولات',
                          en: 'Generate Table QR Codes',
                        },
                      ] as const
                    ).map((perm) => {
                      const active = managerPerms[perm.key];
                      return (
                        <button
                          key={perm.key}
                          type="button"
                          onClick={() =>
                            setManagerPerms((p) => ({ ...p, [perm.key]: !p[perm.key] }))
                          }
                          className="w-full bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl px-3 py-2 flex items-center justify-between text-xs cursor-pointer"
                        >
                          <span className="font-semibold text-[#0E1B3D] text-start">
                            {isAr ? perm.ar : perm.en}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-md font-bold transition-colors shrink-0 ${
                              active
                                ? 'bg-[#2F8F5B]/15 text-[#2F8F5B]'
                                : 'bg-[#E6D9C3] text-[#0E1B3D]/70'
                            }`}
                          >
                            {active ? (isAr ? 'مفعّل' : 'Enabled') : isAr ? 'مقفل' : 'Locked'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'مراجعة شيكات أي يوم أو وردية مغلقة في أرشيف صاحب المطعم.'
                    : 'Revisit closed shifts and inspect every check inside the owner archive.'}
                </span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'سجل رقابة إلزامي لسبب كل تعديل أو إلغاء يقوم به المدير.'
                    : 'Mandatory reason-locked Audit Log for every manager edit or cancellation.'}
                </span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'تحكم مرن من المالك في فتح أو إغلاق صلاحيات المدير لحظياً.'
                    : 'Instant owner toggle switches to grant or restrict Manager Permissions.'}
                </span>
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className="px-6 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>
                  {isAr ? 'تواصل لمعرفة أدوات الإدارة' : 'Explore Management & Audit Tools'}
                </span>
                <DirectionalArrow className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </section>

        {/* 6. Customers & Loyalty */}
        <section id="loyalty" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#F3EBDD]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span className="font-mono-num">
                  {isAr ? '06 · العملاء والولاء' : '06 · Customers & Loyalty'}
                </span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                {isAr
                  ? 'بطاقة أختام ورادار أعياد الميلاد لعملائك'
                  : 'Digital Punch Card & automated Birthday Radar'}
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                {isAr
                  ? 'كافئ الزيارات المتكررة وتواصل مع ضيفك قبل عيد ميلاده بهدية عبر واتساب.'
                  : 'Reward repeat guests automatically and send timely birthday treats via WhatsApp before their big day.'}
              </p>
            </div>

            {/* Interactive Simulation Card */}
            <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="px-3 py-1 rounded-xl bg-[#F3EBDD] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                  {isAr
                    ? 'مثال · بطاقة أختام تفاعلية وتنبيه عيد ميلاد'
                    : 'Example · Interactive Punch Card & Birthday Alert'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                {/* Stamp Card */}
                <div className="md:col-span-6 bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                    <span className="flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-[#E8833A]" />
                      <span>
                        {isAr ? 'بطاقة أختام الزيارات (مثال)' : 'Visit Punch Card (Example)'}
                      </span>
                    </span>
                    <span className="font-mono-num">{stampCount} / 5</span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((slot) => {
                      const filled = slot <= stampCount;
                      return (
                        <div
                          key={slot}
                          className={`h-12 rounded-xl border flex items-center justify-center transition-all duration-300 ${
                            filled
                              ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                              : 'bg-[#FBF7EF] border-[#E6D9C3] text-[#E8833A]'
                          }`}
                        >
                          {filled ? <Check className="w-4 h-4" /> : <Gift className="w-4 h-4" />}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setStampCount((c) => (c >= 5 ? 1 : c + 1))}
                      className="px-4 py-2 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs font-bold cursor-pointer"
                    >
                      {stampCount >= 5
                        ? isAr
                          ? 'إعادة مثال الأختام'
                          : 'Reset Stamp Example'
                        : isAr
                          ? 'أضف ختم زيارة'
                          : 'Add Visit Stamp'}
                    </button>
                    {stampCount >= 5 && (
                      <span className="px-2.5 py-1 rounded-lg bg-[#2F8F5B]/15 text-[#2F8F5B] text-xs font-bold">
                        {isAr ? 'تم اكتمال المكافأة' : 'Reward Complete'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Birthday Radar */}
                <div className="md:col-span-6 bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-5 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-[#14285A]">
                        <Cake className="w-4 h-4 text-[#E8833A]" />
                        <span>
                          {isAr ? 'تنبيه عيد ميلاد قريب (مثال)' : 'Upcoming Birthday Alert (Example)'}
                        </span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#E8833A]/15 text-[#E8833A] text-[11px] font-bold">
                        {isAr ? 'بعد يومين' : 'In 2 days'}
                      </span>
                    </div>
                    <p className="landing-cairo-heading text-base text-[#14285A]">
                      {isAr ? 'أ. منى محمود · عميل متكرر' : 'Mona Mahmoud · Regular Guest'}
                    </p>
                    <p className="text-xs text-[#0E1B3D]/80">
                      {isAr
                        ? 'مفضل لها: قهوة لاتيه + مولتن كيك — جاهزة لإرسال معايدة وخصم ضيافة.'
                        : 'Favorites: Cafe Latte + Molten Cake — ready for a birthday greeting & hospitality perk.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setBirthdayGreetSent((v) => !v)}
                      className="px-4 py-2.5 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4 text-[#E8833A]" />
                      <span>
                        {birthdayGreetSent
                          ? isAr
                            ? 'إعادة ضبط المثال'
                            : 'Reset Example'
                          : isAr
                            ? 'معايدة عبر واتساب'
                            : 'Send WhatsApp Wish'}
                      </span>
                    </button>
                    {birthdayGreetSent && (
                      <span className="px-2.5 py-1 rounded-lg bg-[#2F8F5B]/15 text-[#2F8F5B] text-xs font-bold">
                        {isAr ? 'تم تجهيز التهنئة' : 'Greeting Ready'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'تسجيل سريع برقم الهاتف لبناء قاعدة عملاء حقيقية لمطعمك.'
                    : 'Fast phone sign-up builds a verified Customer CRM database for your venue.'}
                </span>
              </li>
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'بطاقة أختام رقمية تكافئ الضيوف وتشجعهم على العودة.'
                    : 'Digital Punch Card rewards keep loyal diners coming back.'}
                </span>
              </li>
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'رادار أعياد الميلاد قبل 3 أيام مع إرسال تهنئة بضغطة واحدة.'
                    : 'Birthday radar alerts your team 3 days prior with 1-click WhatsApp wishes.'}
                </span>
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className="px-6 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>{isAr ? 'تواصل لتفعيل نظام الولاء' : 'Enable Loyalty for Your Venue'}</span>
                <DirectionalArrow className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </section>

        {/* 7. Tygos Integration */}
        <section id="tygos" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span className="font-mono-num">
                  {isAr ? '07 · التكامل مع تايجوس' : '07 · Tygos ERP Integration'}
                </span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                {isAr
                  ? 'من المبيعات إلى تكلفة الوجبة والمخازن مع تايجوس'
                  : 'From guest sales to dish costing and inventory with Tygos'}
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                {isAr
                  ? 'ربط مباشر بين طلبات سُفرة QR ومنظومة تايجوس لحساب خامات كل طبق وهامش ربحه.'
                  : 'Direct cloud sync connecting Sufra QR orders to Tygos for recipe ingredient deduction and live dish profitability.'}
              </p>
            </div>

            {/* Interactive Simulation Card */}
            <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="px-3 py-1 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                  {isAr
                    ? 'مثال · كارت تكلفة الوجبة وهامش الربح (بيانات توضيحية)'
                    : 'Example · Recipe Cost & Gross Margin Card'}
                </span>
                <div className="flex items-center gap-2">
                  {TYGOS_MEAL_EXAMPLES.map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMealIdx(idx)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                        selectedMealIdx === idx
                          ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                          : 'bg-[#FBF7EF] border-[#E6D9C3] text-[#14285A]'
                      }`}
                    >
                      {isAr ? m.shortAr : m.shortEn}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-5 sm:p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6D9C3] pb-3.5">
                  <div>
                    <h3 className="landing-cairo-heading text-lg text-[#14285A]">
                      {isAr ? activeMeal.nameAr : activeMeal.nameEn}
                    </h3>
                    <p className="text-xs text-[#0E1B3D]/75 mt-0.5">
                      {isAr ? 'الخامات المخصومة:' : 'Deducted Ingredients:'}{' '}
                      {isAr ? activeMeal.ingredientsAr : activeMeal.ingredientsEn}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#14285A] font-mono-num">
                    <TrendingUp className="w-4 h-4 text-[#E8833A]" />
                    <span>
                      {isAr
                        ? `هامش الربح التقديري: ${activeMeal.marginPercent}%`
                        : `Estimated Margin: ${activeMeal.marginPercent}%`}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl p-4 space-y-2">
                    <p className="text-xs text-[#0E1B3D]/75">
                      {isAr ? 'سعر البيع (مثال)' : 'Selling Price (Example)'}
                    </p>
                    <p className="landing-cairo-heading text-2xl text-[#14285A] font-mono-num">
                      {activeMeal.sellPrice} {currencyLabel}
                    </p>
                    <div className="h-2 rounded-full bg-[#E6D9C3] overflow-hidden">
                      <div className="h-full bg-[#14285A] w-full transition-all duration-300" />
                    </div>
                  </div>

                  <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl p-4 space-y-2">
                    <p className="text-xs text-[#0E1B3D]/75">
                      {isAr ? 'تكلفة الخامات (مثال)' : 'Ingredient Cost (Example)'}
                    </p>
                    <p className="landing-cairo-heading text-2xl text-[#14285A] font-mono-num">
                      {activeMeal.cost} {currencyLabel}
                    </p>
                    <div className="h-2 rounded-full bg-[#E6D9C3] overflow-hidden">
                      <div
                        className="h-full bg-[#E8833A] transition-all duration-300"
                        style={{ width: `${Math.round((activeMeal.cost / activeMeal.sellPrice) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl p-4 space-y-2">
                    <p className="text-xs text-[#0E1B3D]/75">
                      {isAr ? 'صافي الهامش (مثال)' : 'Net Margin (Example)'}
                    </p>
                    <p className="landing-cairo-heading text-2xl text-[#14285A] font-mono-num">
                      {activeMeal.sellPrice - activeMeal.cost} {currencyLabel}
                    </p>
                    <div className="h-2 rounded-full bg-[#E6D9C3] overflow-hidden">
                      <div
                        className="h-full bg-[#2F8F5B] transition-all duration-300"
                        style={{ width: `${activeMeal.marginPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'خصم آلي لمكونات كل وجبة من المخزون فور إتمام الطلب.'
                    : 'Automatic recipe ingredient deduction from inventory the moment an order completes.'}
                </span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'حساب فوري لتكلفة الطبق وهامش الربح في كل فرع.'
                    : 'Instant plate costing and profit margin visibility across every branch.'}
                </span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'توحيد الجرد والموردين والحسابات العامة في منظومة تايجوس.'
                    : 'Unifies stocktakes, supplier procurement, and general ledger inside Tygos.'}
                </span>
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className="px-6 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>
                  {isAr ? 'اطلب عرض ربط مع تايجوس' : 'Request a Tygos Integration Demo'}
                </span>
                <DirectionalArrow className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </section>

        {/* 8. Pricing */}
        <section id="pricing" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#F3EBDD]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span className="font-mono-num">{isAr ? '08 · الأسعار' : '08 · Pricing'}</span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                {isAr
                  ? 'ثلاث باقات مرنة تناسب حجم مطعمك'
                  : 'Three flexible plans tailored to your restaurant'}
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                {isAr
                  ? 'نصوص وأسعار نائبة قابلة للتعديل حسب خطة التشغيل وعدد الصالات.'
                  : 'Editable placeholder packages adaptable to your operating scale and number of dining halls.'}
              </p>
            </div>

            {/* Interactive Simulation Card Container (3 Placeholder Cards) */}
            <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-5">
              <span className="inline-block px-3 py-1 rounded-xl bg-[#F3EBDD] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                {isAr
                  ? 'مثال · باقات نائبة قابلة للتعديل (الأكثر طلباً مميزة)'
                  : 'Example · Customizable Placeholder Plans (Popular Tier Highlighted)'}
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
                {PLACEHOLDER_PRICING_CARDS.map((plan) => (
                  <article
                    key={plan.id}
                    className={`rounded-2xl p-6 flex flex-col justify-between gap-5 border transition-transform duration-300 hover:-translate-y-1 ${
                      plan.featured
                        ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF] shadow-lg'
                        : 'bg-[#F3EBDD] border-[#E6D9C3] text-[#0E1B3D]'
                    }`}
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            plan.featured
                              ? 'bg-[#E8833A] text-[#0E1B3D]'
                              : 'bg-[#FBF7EF] border border-[#E6D9C3] text-[#14285A]'
                          }`}
                        >
                          {isAr ? plan.badgeAr : plan.badgeEn}
                        </span>
                      </div>

                      <h3
                        className={`landing-cairo-heading text-lg ${
                          plan.featured ? 'text-[#FBF7EF]' : 'text-[#14285A]'
                        }`}
                      >
                        {isAr ? plan.nameAr : plan.nameEn}
                      </h3>

                      <div
                        className={`py-2.5 border-y ${
                          plan.featured ? 'border-[#FBF7EF]/20' : 'border-[#E6D9C3]'
                        }`}
                      >
                        <p className="landing-cairo-heading text-xl">
                          {isAr ? plan.priceAr : plan.priceEn}
                        </p>
                        <p className="text-xs opacity-75">
                          {isAr ? plan.periodAr : plan.periodEn}
                        </p>
                      </div>

                      <p className="text-xs opacity-85 leading-relaxed">
                        {isAr ? plan.descriptionAr : plan.descriptionEn}
                      </p>

                      <ul className="space-y-2 text-xs">
                        {(isAr ? plan.bulletsAr : plan.bulletsEn).map((bullet) => (
                          <li key={bullet} className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E8833A] mt-1.5 shrink-0" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => scrollToSection('contact', 'contact')}
                      className={`w-full py-3 rounded-xl text-xs font-bold cursor-pointer transition-opacity hover:opacity-95 ${
                        plan.featured
                          ? 'bg-[#FBF7EF] text-[#14285A]'
                          : 'bg-[#14285A] text-[#FBF7EF]'
                      }`}
                    >
                      {isAr ? 'طلب تسعير الباقة' : 'Request Plan Quote'}
                    </button>
                  </article>
                ))}
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'باقات مرنة تناسب الكافيهات الفردية والمطاعم متعددة الفروع.'
                    : 'Flexible tiers designed for independent cafes and multi-branch chains.'}
                </span>
              </li>
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'إمكانية الترقية لاحقاً بدون إعادة إدخال المنيو أو البيانات.'
                    : 'Upgrade anytime without re-entering menus, tables, or customer history.'}
                </span>
              </li>
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'تدريب مبدئي لفريق الصالة والكاشير عند بدء التشغيل.'
                    : 'Guided onboarding and team training for floor and Cashier / POS staff.'}
                </span>
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className="px-6 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>
                  {isAr ? 'تواصل لمعرفة الباقة الأنسب' : 'Find the Best Plan for Your Team'}
                </span>
                <DirectionalArrow className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </section>

        {/* 9. Contact Us */}
        <section id="contact" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span className="font-mono-num">{isAr ? '09 · تواصل معنا' : '09 · Contact Us'}</span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                {isAr
                  ? 'ابدأ تجهيز مطعمك اليوم عبر واتساب'
                  : 'Launch your restaurant setup today on WhatsApp'}
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                {isAr
                  ? 'راسلنا مباشرة على واتساب أو اكتب بيانات مطعمك في النموذج لإرسال رسالة جاهزة.'
                  : 'Message us directly on WhatsApp or fill in your venue details below to send a ready-to-go inquiry.'}
              </p>
            </div>

            {/* Interactive Contact Card */}
            <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-6">
              <span className="inline-block px-3 py-1 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                {isAr
                  ? 'مثال · تواصل مباشر أو نموذج تجهيز رسالة واتساب'
                  : 'Example · Direct WhatsApp Chat or Prefilled Inquiry Form'}
              </span>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-5 bg-[#14285A] text-[#FBF7EF] rounded-2xl p-6 flex flex-col justify-between gap-6">
                  <div className="space-y-3">
                    <div className="w-11 h-11 rounded-xl bg-[#FBF7EF]/15 flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-[#E8833A]" />
                    </div>
                    <h3 className="landing-cairo-heading text-xl">
                      {isAr ? 'محادثة فورية مع الفريق' : 'Instant Chat with Our Team'}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#FBF7EF]/85 leading-relaxed">
                      {isAr
                        ? 'أرسل اسم مطعمك عبر واتساب لنرسل لك تجربة مباشرة ونجهز معك المنيو وطاولات الصالة.'
                        : 'Send your restaurant name on WhatsApp to receive a live walkthrough and set up your menu and tables.'}
                    </p>
                  </div>

                  <a
                    href={whatsappDirectHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-4 rounded-xl bg-[#FBF7EF] text-[#14285A] text-sm font-bold text-center hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4 text-[#E8833A]" />
                    <span>{isAr ? 'تواصل عبر واتساب الآن' : 'Chat on WhatsApp Now'}</span>
                  </a>
                </div>

                <form
                  onSubmit={handleContactSubmit}
                  className="lg:col-span-7 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-6 space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-[#14285A] mb-1.5">
                        {isAr ? 'اسمك أو اسم المطعم' : 'Your Name or Restaurant'}
                      </label>
                      <input
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => {
                          setContactName(e.target.value);
                          setContactSubmitted(false);
                        }}
                        placeholder={isAr ? 'مثال: مطعم الأصيل' : 'Example: Al-Saraya Kitchen'}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] text-sm text-[#0E1B3D] focus:outline-none focus:border-[#14285A] text-start"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#14285A] mb-1.5">
                        {isAr ? 'رقم الواتساب' : 'WhatsApp Number'}
                      </label>
                      <input
                        type="tel"
                        dir="ltr"
                        required
                        value={contactPhone}
                        onChange={(e) => {
                          setContactPhone(e.target.value);
                          setContactSubmitted(false);
                        }}
                        placeholder={isAr ? 'مثال: 01000000000' : 'Example: 01000000000'}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] text-sm text-[#0E1B3D] font-mono-num focus:outline-none focus:border-[#14285A] text-start"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14285A] mb-1.5">
                      {isAr ? 'ملاحظة سريعة (اختياري)' : 'Quick Note (Optional)'}
                    </label>
                    <input
                      type="text"
                      value={contactNotes}
                      onChange={(e) => {
                        setContactNotes(e.target.value);
                        setContactSubmitted(false);
                      }}
                      placeholder={
                        isAr ? 'مثال: 15 طاولة + شاشة مطبخ' : 'Example: 15 tables + Kitchen Display'
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] text-sm text-[#0E1B3D] focus:outline-none focus:border-[#14285A] text-start"
                    />
                  </div>

                  {!contactSubmitted ? (
                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity cursor-pointer"
                    >
                      {isAr ? 'تجهيز طلب التواصل' : 'Prepare Inquiry Message'}
                    </button>
                  ) : (
                    <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="px-2.5 py-1 rounded-lg bg-[#2F8F5B]/15 text-[#2F8F5B] text-xs font-bold self-start sm:self-center">
                        {isAr ? 'تم تجهيز الرسالة بنجاح' : 'Message prepared successfully'}
                      </span>
                      <a
                        href={contactPreFilledWhatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs font-bold inline-flex items-center justify-center gap-1.5"
                      >
                        <span>{isAr ? 'إرسال في واتساب' : 'Send on WhatsApp'}</span>
                        <DirectionalArrow className="w-3.5 h-3.5 text-[#E8833A]" />
                      </a>
                    </div>
                  )}
                </form>
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'رد مباشر لتنسيق عرض حي للمنيو وشاشات الصالة والمطبخ.'
                    : 'Direct response to schedule a live demo of the menu, Dine-in floor, and KDS.'}
                </span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'مساعدة في اختيار الباقة الملائمة لعدد الطاولات والأقسام.'
                    : 'Tailored guidance picking the right tier for your table count and stations.'}
                </span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>
                  {isAr
                    ? 'مرافقة خطوة بخطوة حتى يبدأ فريقك العمل بسلاسة.'
                    : 'Step-by-step onboarding support until your team is running smoothly.'}
                </span>
              </li>
            </ul>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={whatsappDirectHref}
                target="_blank"
                rel="noopener noreferrer"
                className="px-7 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4 text-[#E8833A]" />
                <span>{isAr ? 'تواصل معنا عبر واتساب' : 'Message Us on WhatsApp'}</span>
              </a>
              <button
                type="button"
                onClick={handlePrimaryStart}
                className="px-6 py-3.5 rounded-2xl border border-[#E6D9C3] bg-[#F3EBDD] text-[#14285A] text-sm font-bold hover:border-[#14285A]/40 transition-colors cursor-pointer"
              >
                {isAr ? 'دخول لوحة الإدارة' : 'Open Admin Console'}
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-[#E6D9C3] bg-[#F3EBDD] py-6 pb-20 sm:pb-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#0E1B3D]/75">
          <span className="font-semibold text-[#14285A]">
            {isAr
              ? 'سُفرة QR · المنيو الرقمي وتشغيل الصالة والمطبخ'
              : 'Sufra QR · Digital Menu & Restaurant Floor, Cashier & Kitchen Operations'}
          </span>
          <div className="flex items-center gap-5">
            <a
              href="/menu/buns-lab"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/menu/buns-lab');
              }}
              className="hover:text-[#14285A] font-semibold"
            >
              {isAr ? 'معاينة منيو حي' : 'Live Menu Preview'}
            </a>
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                handlePrimaryStart();
              }}
              className="hover:text-[#14285A] font-semibold"
            >
              {isAr ? 'لوحة التحكم' : 'Dashboard'}
            </a>
          </div>
        </div>
      </footer>

      {/* Fixed Bottom WhatsApp Button */}
      <a
        href={whatsappDirectHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={isAr ? 'تواصل معنا عبر واتساب' : 'Contact us on WhatsApp'}
        className={`fixed bottom-4 ${
          dir === 'rtl' ? 'left-4' : 'right-4'
        } z-30 px-4 py-3 rounded-2xl bg-[#14285A] text-[#FBF7EF] border border-[#E6D9C3]/30 shadow-lg hover:opacity-95 transition-opacity flex items-center gap-2 text-xs sm:text-sm font-bold`}
      >
        <MessageCircle className="w-4 h-4 text-[#E8833A]" />
        <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
      </a>

      {/* Owner Auth Modal */}
      {authModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={isAr ? 'تسجيل دخول الإدارة' : 'Owner & Admin Sign In'}
        >
          <div
            onClick={() => setAuthModalOpen(false)}
            className="fixed inset-0 bg-[#0E1B3D]/50 backdrop-blur-[2px]"
          />
          <div className="relative z-10 w-full max-w-md bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="landing-cairo-heading text-lg text-[#14285A]">
                {isAr ? 'دخول صاحب المطعم والإدارة' : 'Restaurant Owner & Admin Sign In'}
              </span>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                aria-label={isAr ? 'إغلاق نافذة الدخول' : 'Close sign-in dialog'}
                className="w-9 h-9 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] text-[#14285A] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <OwnerAuthCard
              compact
              onSuccess={(u) => {
                setAuthModalOpen(false);
                onNavigate(
                  isSuperAdminEmail(u?.email || auth.currentUser?.email)
                    ? '/super-admin'
                    : '/admin'
                );
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
