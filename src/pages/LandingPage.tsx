import { FormEvent, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  ArrowLeft,
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
import { PWAInstallButton } from '../components/PWAInstallButton';
import { OwnerAuthCard } from '../components/auth/OwnerAuthCard';
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
  label: string;
  sectionId: string;
}

const DRAWER_ITEMS: DrawerNavItem[] = [
  { id: 'hero', label: 'الرئيسية', sectionId: 'hero' },
  { id: 'digital_menu', label: 'المنيو الرقمي', sectionId: 'digital-menu' },
  { id: 'hall_captain', label: 'الصالة والكابتن', sectionId: 'hall-captain' },
  { id: 'cashier', label: 'الكاشير', sectionId: 'cashier' },
  { id: 'kds', label: 'شاشات المطبخ', sectionId: 'kds' },
  { id: 'management', label: 'الإدارة والتقارير', sectionId: 'management' },
  { id: 'loyalty', label: 'العملاء والولاء', sectionId: 'loyalty' },
  { id: 'tygos', label: 'التكامل مع تايجوس', sectionId: 'tygos' },
  { id: 'pricing', label: 'الأسعار', sectionId: 'pricing' },
  { id: 'contact', label: 'تواصل معنا', sectionId: 'contact' },
];

type TableStatusKey = 'available' | 'occupied' | 'bill' | 'delayed';

const TABLE_STATUS_ORDER: TableStatusKey[] = ['available', 'occupied', 'bill', 'delayed'];

const TABLE_STATUS_META: Record<
  TableStatusKey,
  { label: string; bg: string; border: string; text: string; badgeBg: string; badgeText: string }
> = {
  available: {
    label: 'متاحة',
    bg: '#FBF7EF',
    border: '#2F8F5B',
    text: '#14285A',
    badgeBg: 'rgba(47, 143, 91, 0.14)',
    badgeText: '#2F8F5B',
  },
  occupied: {
    label: 'مشغولة',
    bg: '#14285A',
    border: '#14285A',
    text: '#FBF7EF',
    badgeBg: 'rgba(251, 247, 239, 0.16)',
    badgeText: '#FBF7EF',
  },
  bill: {
    label: 'طلب فاتورة',
    bg: '#F3EBDD',
    border: '#E8833A',
    text: '#14285A',
    badgeBg: 'rgba(232, 131, 58, 0.18)',
    badgeText: '#E8833A',
  },
  delayed: {
    label: 'متأخرة',
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
  { label: string; badgeBg: string; badgeText: string }
> = {
  0: { label: 'قيد التحضير', badgeBg: 'rgba(232, 131, 58, 0.16)', badgeText: '#E8833A' },
  1: { label: 'جاهز', badgeBg: '#14285A', badgeText: '#FBF7EF' },
  2: { label: 'تم التقديم', badgeBg: 'rgba(47, 143, 91, 0.15)', badgeText: '#2F8F5B' },
};

const SHIFT_ARCHIVE_EXAMPLE = [
  {
    dayKey: 'thu',
    dayLabel: 'الخميس',
    totalSales: '١٤,٢٠٠ ج.م',
    checksCount: '٣٨ شيك',
    checks: [
      { id: '#٤٠١', table: 'طاولة ٣', method: 'فيزا', amount: '٤٦٠ ج.م' },
      { id: '#٤٠٢', table: 'تيك أواي', method: 'كاش', amount: '١٩٥ ج.م' },
    ],
  },
  {
    dayKey: 'fri',
    dayLabel: 'الجمعة',
    totalSales: '١٨,٩٥٠ ج.م',
    checksCount: '٥١ شيك',
    checks: [
      { id: '#٥١٢', table: 'طاولة ٨', method: 'مختلط', amount: '٧٤٠ ج.م' },
      { id: '#٥١٣', table: 'طاولة ٢', method: 'فيزا', amount: '٣٨٠ ج.م' },
    ],
  },
  {
    dayKey: 'sat',
    dayLabel: 'السبت',
    totalSales: '١٦,٤٠٠ ج.م',
    checksCount: '٤٤ شيك',
    checks: [
      { id: '#٦٠٤', table: 'طاولة ١', method: 'كاش', amount: '٥١٠ ج.م' },
      { id: '#٦٠٥', table: 'دليفري', method: 'فيزا', amount: '٢٩٠ ج.م' },
    ],
  },
];

const TYGOS_MEAL_EXAMPLES = [
  {
    id: 'burger',
    name: 'وجبة سماش برجر (مثال)',
    sellPrice: 200,
    cost: 76,
    marginPercent: 62,
    ingredients: 'لحم صافي + خبز بريوش + جبن + صوص خاص',
  },
  {
    id: 'pasta',
    name: 'باستا دجاج ألفريدو (مثال)',
    sellPrice: 180,
    cost: 63,
    marginPercent: 65,
    ingredients: 'مكرونة + صدور دجاج + كريمة طهي + بارميزان',
  },
];

const PREVIEW_THEMES = [
  {
    id: 'sand-royal',
    label: 'كلاسيك رملي',
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
    label: 'داكن فاخر',
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
    label: 'أبيض هادئ',
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
    label: 'تراثي دافئ',
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
    badge: 'الباقة الأساسية',
    name: '[اسم الباقة الأولى — قابل للتعديل]',
    price: '[السعر يُحدد لاحقاً]',
    period: '[دورة الاشتراك]',
    description: '[وصف مختصر يوضح الفئة المناسبة للمقاهي والمطاعم الناشئة]',
    bullets: ['[ميزة أولى قابلة للتعديل]', '[ميزة ثانية قابلة للتعديل]', '[ميزة ثالثة قابلة للتعديل]'],
    featured: false,
  },
  {
    id: 'plan-2',
    badge: 'الأكثر طلباً',
    name: '[اسم الباقة المتكاملة — قابل للتعديل]',
    price: '[السعر يُحدد لاحقاً]',
    period: '[دورة الاشتراك]',
    description: '[وصف مختصر يوضح التشغيل الكامل للصالة والكاشير والمطبخ والولاء]',
    bullets: ['[ميزة أولى قابلة للتعديل]', '[ميزة ثانية قابلة للتعديل]', '[ميزة ثالثة قابلة للتعديل]'],
    featured: true,
  },
  {
    id: 'plan-3',
    badge: 'الباقة المتقدمة',
    name: '[اسم باقة التجهيز والربط — قابل للتعديل]',
    price: '[السعر يُحدد لاحقاً]',
    period: '[دورة الاشتراك]',
    description: '[وصف مختصر للفروع المتعددة والتجهيز الكامل والتكامل السحابي]',
    bullets: ['[ميزة أولى قابلة للتعديل]', '[ميزة ثانية قابلة للتعديل]', '[ميزة ثالثة قابلة للتعديل]'],
    featured: false,
  },
];

export function LandingPage({ onNavigate }: LandingPageProps) {
  const { lang } = useLanguage();
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
  const [menuExampleLang, setMenuExampleLang] = useState<'ar' | 'en'>('ar');

  // Page 2: Hall & Captain Simulation
  const [tableStatuses, setTableStatuses] = useState<TableStatusKey[]>([
    'available',
    'occupied',
    'bill',
    'delayed',
  ]);
  const [selectedTableIndex, setSelectedTableIndex] = useState(1);

  // Page 3: Cashier Simulation
  const [paymentMethod, setPaymentMethod] = useState<'كاش' | 'فيزا' | 'مختلط'>('كاش');
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

  // Gentle auto-simulation for Digital Menu price toggle & KDS progression (respects reduced motion)
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
    'أهلاً فريق سُفرة QR، أرغب في معرفة التفاصيل وتجهيز مطعمي.'
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
    `مرحباً فريق سُفرة QR، الاسم/المطعم: ${contactName || 'غير محدد'} | الموبايل: ${
      contactPhone || 'غير محدد'
    }${contactNotes ? ` | ملاحظات: ${contactNotes}` : ''}`
  )}`;

  return (
    <div
      dir="rtl"
      className="landing-plex-body min-h-screen bg-[#F3EBDD] text-[#0E1B3D] flex flex-col selection:bg-[#14285A]/15 selection:text-[#14285A]"
    >
      {/* Sticky Header + Scroll Progress Bar */}
      <header className="sticky top-0 z-40 bg-[#F3EBDD]/95 backdrop-blur-sm border-b border-[#E6D9C3]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="فتح القائمة الجانبية"
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
                سُفرة QR
              </span>
            </a>

            <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E1B3D]/70 pr-3 border-r border-[#E6D9C3]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8833A]" />
              <span>{DRAWER_ITEMS.find((d) => d.id === activeNavId)?.label || 'الرئيسية'}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {currentUser ? (
              <button
                type="button"
                onClick={handlePrimaryStart}
                className="px-4 py-2.5 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs sm:text-sm font-bold hover:opacity-95 transition-opacity cursor-pointer flex items-center gap-2 whitespace-nowrap"
              >
                {isSuperAdmin && <ShieldCheck className="w-4 h-4 text-[#E8833A]" />}
                <span>{isSuperAdmin ? 'لوحة السوبر أدمن' : 'لوحة التحكم'}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="hidden sm:inline-flex px-4 py-2.5 rounded-xl border border-[#E6D9C3] bg-[#FBF7EF] text-[#14285A] text-xs sm:text-sm font-bold hover:border-[#14285A]/40 transition-colors cursor-pointer whitespace-nowrap"
                >
                  دخول الحساب
                </button>
                <button
                  type="button"
                  onClick={handlePrimaryStart}
                  className="px-4 py-2.5 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs sm:text-sm font-bold hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap"
                >
                  ابدأ الآن
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

      {/* Slide-Over RTL Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="القائمة الجانبية">
          <div
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 bg-[#0E1B3D]/45 backdrop-blur-[2px] transition-opacity"
          />
          <aside className="fixed inset-y-0 right-0 w-80 max-w-[85vw] bg-[#FBF7EF] border-l border-[#E6D9C3] shadow-2xl flex flex-col justify-between p-6 overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E6D9C3]">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-[#14285A] text-[#FBF7EF] flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </span>
                  <span className="landing-cairo-heading text-lg text-[#14285A]">سُفرة QR</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="إغلاق القائمة"
                  className="w-10 h-10 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] text-[#14285A] flex items-center justify-center hover:border-[#14285A]/40 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1.5" aria-label="أقسام المنصة">
                {DRAWER_ITEMS.map((item) => {
                  const isActive = activeNavId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollToSection(item.sectionId, item.id)}
                      className={`w-full text-right px-4 py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                        isActive
                          ? 'bg-[#14285A] text-[#FBF7EF]'
                          : 'text-[#0E1B3D] hover:bg-[#F3EBDD]'
                      }`}
                    >
                      <span>{item.label}</span>
                      {isActive ? (
                        <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                      ) : (
                        <ArrowLeft className="w-4 h-4 opacity-40" />
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
                <span>{currentUser ? 'فتح لوحة التحكم' : 'تسجيل دخول الإدارة'}</span>
              </button>
              <div className="flex justify-center">
                <PWAInstallButton variant="compact" />
              </div>
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1">
        {/* 0. الرئيسية (الغلاف + تبديل ثيمات الواجهة) */}
        <section id="hero" className="scroll-mt-20 py-14 sm:py-20 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              <div className="lg:col-span-6 space-y-6">
                <p className="text-xs sm:text-sm font-bold text-[#14285A] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                  <span>منظومة الضيافة الرقمية للمطاعم والكافيهات</span>
                </p>

                <h1 className="landing-cairo-heading text-3xl sm:text-5xl lg:text-[3.35rem] text-[#14285A] leading-[1.18]">
                  مطعمك شغّال أسرع.. من أول مسحة QR
                </h1>

                <p className="text-base sm:text-lg text-[#0E1B3D]/85 leading-relaxed max-w-xl">
                  منيو تفاعلي يربط الضيف بالصالة والمطبخ والكاشير في خط واحد دون طباعة ورق أو ضياع طلبات.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handlePrimaryStart}
                    className="px-7 py-4 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm sm:text-base font-bold hover:opacity-95 transition-opacity flex items-center gap-2.5 cursor-pointer"
                  >
                    <span>ابدأ الآن</span>
                    <ArrowLeft className="w-4 h-4 text-[#E8833A]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('digital-menu', 'digital_menu')}
                    className="px-7 py-4 rounded-2xl border border-[#E6D9C3] bg-[#FBF7EF] text-[#14285A] text-sm sm:text-base font-bold hover:border-[#14285A]/40 transition-colors cursor-pointer"
                  >
                    استعرض الأقسام
                  </button>
                </div>
              </div>

              {/* Animated QR-to-Order Card */}
              <div className="lg:col-span-6">
                <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-5 sm:p-8">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[#14285A]">مسار الطلب اللحظي</span>
                    <span className="px-2.5 py-1 rounded-lg bg-[#F3EBDD] border border-[#E6D9C3] text-[11px] font-bold text-[#0E1B3D]">
                      مثال توضيحي
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
                      <span className="mt-2.5 text-[11px] font-bold text-[#14285A]">طاولة رقم ٤</span>
                    </div>

                    <div className="sm:col-span-1 flex items-center justify-center">
                      <span className="w-8 h-8 rounded-full bg-[#F3EBDD] border border-[#E6D9C3] flex items-center justify-center text-[#E8833A] rotate-90 sm:rotate-0">
                        <ArrowLeft className="w-4 h-4" />
                      </span>
                    </div>

                    <div className="sm:col-span-6 bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-[#14285A] pb-2 border-b border-[#E6D9C3]">
                        <span>إشعار التشغيل</span>
                        <span className="w-2 h-2 rounded-full bg-[#E8833A] landing-stage-dot" />
                      </div>
                      <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                        <span className="font-semibold">طلب ساخن · المطبخ</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#E8833A]/15 text-[#E8833A] font-bold">
                          انتظار
                        </span>
                      </div>
                      <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                        <span className="font-semibold">مشروب بارد · البار</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#2F8F5B]/15 text-[#2F8F5B] font-bold">
                          تم
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
                  <span>{totalThemesCount} ثيماً جاهزاً لهوية مطعمك</span>
                </span>
                <h2 className="landing-cairo-heading text-xl sm:text-2xl text-[#14285A]">
                  بدّل مظهر المنيو بنفس كود الطاولة
                </h2>
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {PREVIEW_THEMES.map((themeItem, idx) => (
                    <button
                      key={themeItem.id}
                      type="button"
                      onClick={() => setActiveThemeIdx(idx)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-right transition-colors cursor-pointer flex items-center justify-between ${
                        activeThemeIdx === idx
                          ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                          : 'bg-[#F3EBDD] border-[#E6D9C3] text-[#14285A]'
                      }`}
                    >
                      <span>{themeItem.label}</span>
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
                  <div className="flex items-center justify-between pb-3 mb-3 border-b" style={{ borderColor: activeHeroTheme.border }}>
                    <span className="landing-cairo-heading text-sm sm:text-base" style={{ color: activeHeroTheme.heading }}>
                      مثال معاينة · {activeHeroTheme.label}
                    </span>
                    <span
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold"
                      style={{ backgroundColor: activeHeroTheme.ctaBg, color: activeHeroTheme.ctaText }}
                    >
                      ثابت على نفس الـ QR
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {['وجبة شيش مشوي · ١٩٥ ج.م', 'قهوة مثلجة · ٧٠ ج.م'].map((sample) => (
                      <div
                        key={sample}
                        className="rounded-xl border px-3.5 py-3 text-xs font-bold"
                        style={{ backgroundColor: activeHeroTheme.surface, borderColor: activeHeroTheme.border }}
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

        {/* 1. المنيو الرقمي */}
        <section id="digital-menu" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span>٠١ · المنيو الرقمي</span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                منيو يتحدث لحظياً في كل طاولة
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                غيّر السعر أو لغة العرض ليصل التحديث لضيفك في نفس الثانية دون إعادة طباعة.
              </p>
            </div>

            {/* Interactive Simulation Card */}
            <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="px-3 py-1 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                  مثال · محاكاة تحديث السعر واللغة
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMenuPriceUpdated((prev) => !prev)}
                    className="px-3.5 py-2 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs font-bold cursor-pointer hover:opacity-95 transition-opacity"
                  >
                    {menuPriceUpdated ? 'إرجاع السعر ١٢٠' : 'تحديث السعر إلى ١٣٥'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuExampleLang((l) => (l === 'ar' ? 'en' : 'ar'))}
                    className="px-3.5 py-2 rounded-xl border border-[#E6D9C3] bg-[#FBF7EF] text-[#14285A] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Languages className="w-4 h-4 text-[#E8833A]" />
                    <span>{menuExampleLang === 'ar' ? 'التبديل إلى EN' : 'التبديل إلى عربي'}</span>
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
                  <div className="text-left sm:text-right">
                    <span className="block text-[11px] text-[#0E1B3D]/55 line-through font-mono-num">
                      {menuPriceUpdated ? (menuExampleLang === 'ar' ? '١٢٠ ج.م' : '120 EGP') : ''}
                    </span>
                    <span className="landing-price-pulse inline-block landing-cairo-heading text-2xl text-[#14285A] font-mono-num">
                      {menuPriceUpdated
                        ? menuExampleLang === 'ar'
                          ? '١٣٥ ج.م'
                          : '135 EGP'
                        : menuExampleLang === 'ar'
                          ? '١٢٠ ج.م'
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
                <span>تعديل الأسعار والأحجام والإضافات يظهر للضيوف في لحظتها.</span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>تبديل سلس بين العربية والإنجليزية بلمسة واحدة داخل المنيو.</span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>نفس كود الـ QR يظل ثابتاً على كل طاولة دون تكاليف طباعة.</span>
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className="px-6 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>تواصل لتفعيل المنيو الرقمي</span>
                <ArrowLeft className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </section>

        {/* 2. الصالة والكابتن */}
        <section id="hall-captain" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#F3EBDD]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span>٠٢ · الصالة والكابتن</span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                خريطة طاولات حية وطلب جماعي وفصل الحساب
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                متابعة فورية لحالة كل طاولة على الصالة مع تقسيم الشيك بالاسم بين أفراد الترابيزة.
              </p>
            </div>

            {/* Interactive Simulation Card */}
            <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="px-3 py-1 rounded-xl bg-[#F3EBDD] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                  مثال · اضغط على أي طاولة لتغيير حالتها
                </span>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                  {TABLE_STATUS_ORDER.map((k) => (
                    <span
                      key={k}
                      className="px-2.5 py-1 rounded-lg border"
                      style={{
                        backgroundColor: TABLE_STATUS_META[k].badgeBg,
                        borderColor: TABLE_STATUS_META[k].border,
                        color: TABLE_STATUS_META[k].badgeText === '#FBF7EF' && k === 'occupied' ? '#14285A' : TABLE_STATUS_META[k].text,
                      }}
                    >
                      {TABLE_STATUS_META[k].label}
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
                        className={`p-4 rounded-2xl border-2 text-right transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[104px] ${
                          isFocused ? 'ring-2 ring-[#E8833A]/40' : ''
                        }`}
                        style={{
                          backgroundColor: meta.bg,
                          borderColor: meta.border,
                          color: meta.text,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="landing-cairo-heading text-base">طاولة {idx + 1}</span>
                          <Users className="w-4 h-4 opacity-75" />
                        </div>
                        <span
                          className="self-start px-2.5 py-1 rounded-lg text-[11px] font-bold"
                          style={{ backgroundColor: meta.badgeBg, color: meta.badgeText }}
                        >
                          {meta.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Collaborative Group Table & Split Check */}
                <div className="lg:col-span-6 bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-5 space-y-3.5">
                  <div className="flex items-center justify-between border-b border-[#E6D9C3] pb-2.5">
                    <span className="landing-cairo-heading text-sm text-[#14285A]">
                      الطلب الجماعي وتقسيم الشيك · طاولة {selectedTableIndex + 1} (مثال)
                    </span>
                    <span className="text-xs font-bold text-[#E8833A]">حساب منفصل</span>
                  </div>

                  {[
                    { guest: 'أحمد (برجر + كولا)', amount: '١٦٥ ج.م' },
                    { guest: 'سارة (سلطة + قهوة)', amount: '١٢٠ ج.م' },
                    { guest: 'كريم (باستا + عصير)', amount: '١٥٥ ج.م' },
                  ].map((split) => (
                    <div
                      key={split.guest}
                      className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-[#0E1B3D]">{split.guest}</span>
                      <span className="font-mono-num font-bold text-[#14285A]">{split.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>ألوان فورية تميز الطاولة المتاحة والمشغولة وطلب الفاتورة والمتأخرة.</span>
              </li>
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>طلب جماعي مشترك من موبايلات الضيوف في سلة واحدة للترابيزة.</span>
              </li>
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>فصل وتقسيم الشيك لكل ضيف بالاسم دون حسابات يدوية.</span>
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className="px-6 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>تواصل لتجهيز الصالة والكابتن</span>
                <ArrowLeft className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </section>

        {/* 3. الكاشير */}
        <section id="cashier" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span>٠٣ · الكاشير</span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                تحصيل مرن وشاشة نظيفة من الشيكات المقفولة
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                أغلق الشيك كاش أو فيزا أو مختلط ليُضاف الرصيد للدرج ويختفي الشيك فوراً من أمامك.
              </p>
            </div>

            {/* Interactive Simulation Card */}
            <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="px-3 py-1 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                  مثال · محاكاة إقفال شيك وتحديث رصيد الدرج
                </span>
                <div className="bg-[#14285A] text-[#FBF7EF] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#E8833A]" />
                  <span>رصيد الدرج الحالي:</span>
                  <span className="font-mono-num text-base">
                    {checkClosed ? '٤,٨٥٠ ج.م' : '٤,٦٠٠ ج.م'}
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
                            شيك مفتوح #١٠٨ · طاولة ٥ (مثال)
                          </p>
                          <p className="text-xs text-[#0E1B3D]/70">٣ أصناف جاهزة للتحصيل</p>
                        </div>
                        <span className="landing-cairo-heading text-xl text-[#14285A] font-mono-num">
                          ٢٥٠ ج.م
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {(['كاش', 'فيزا', 'مختلط'] as const).map((method) => (
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
                            {method}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setCheckClosed(true)}
                        className="w-full py-3 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs sm:text-sm font-bold hover:opacity-95 transition-opacity cursor-pointer"
                      >
                        تأكيد التحصيل ({paymentMethod}) وإغلاق الشيك
                      </button>
                    </div>
                  ) : (
                    <div className="bg-[#FBF7EF] border border-dashed border-[#E6D9C3] rounded-2xl p-6 text-center space-y-3">
                      <span className="inline-flex px-3 py-1 rounded-lg bg-[#2F8F5B]/15 text-[#2F8F5B] text-xs font-bold">
                        تم إقفال الشيك ({paymentMethod}) واختفاؤه من القائمة
                      </span>
                      <p className="text-xs text-[#0E1B3D]/80">
                        الشيكات المقفولة لا تزدحم بها شاشة الكاشير وتُحفظ في أرشيف صاحب المطعم.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCheckClosed(false)}
                        className="px-4 py-2 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] text-[#14285A] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إعادة عرض الشيك (مثال)</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="md:col-span-5 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-5 space-y-3">
                  <p className="landing-cairo-heading text-sm text-[#14285A]">ملخص حركة الدرج (مثال)</p>
                  <div className="flex items-center justify-between text-xs py-2 border-b border-[#E6D9C3]">
                    <span>رصيد افتتاح الوردية</span>
                    <span className="font-mono-num font-bold">٤,٦٠٠ ج.م</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-2 border-b border-[#E6D9C3]">
                    <span>آخر شيك محصّل ({paymentMethod})</span>
                    <span className="font-mono-num font-bold text-[#2F8F5B]">
                      {checkClosed ? '+ ٢٥٠ ج.م' : '٠ ج.م'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#14285A] pt-1">
                    <span>الرصيد المتوقع بالدرج</span>
                    <span className="font-mono-num">{checkClosed ? '٤,٨٥٠ ج.م' : '٤,٦٠٠ ج.م'}</span>
                  </div>
                </div>
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>تحصيل سريع كاش أو فيزا أو مختلط بينهما داخل نفس الشيك.</span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>إضافة طلبات تيك أواي ودليفري ومتابعة خريطة الطاولات من شاشة الكاشير.</span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>إخفاء الشيكات المقفولة تلقائياً لمنع الزحام طوال الوردية.</span>
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className="px-6 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>تواصل لتجربة شاشة الكاشير</span>
                <ArrowLeft className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </section>

        {/* 4. شاشات المطبخ */}
        <section id="kds" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#F3EBDD]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span>٠٤ · شاشات المطبخ (KDS)</span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                توجيه تلقائي للمطبخ والبار والحلواني
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                الطلب الواحد يتقسم على كل محطة تحضير بحالة واضحة من قيد التحضير حتى تم التقديم.
              </p>
            </div>

            {/* Interactive Simulation Card */}
            <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="px-3 py-1 rounded-xl bg-[#F3EBDD] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                  مثال · طلب #٢١٤ (طاولة ٥) — اضغط على المحطة لتحديث الحالة
                </span>
                <span className="text-xs font-semibold text-[#0E1B3D]/70">
                  برتقالي: قيد التحضير · أزرق: جاهز · أخضر: تم التقديم
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: 'شاشة المطبخ', item: 'سماش برجر دبل', icon: ChefHat },
                  { title: 'شاشة البار', item: 'موهيتو نعناع مثلج', icon: Coffee },
                  { title: 'شاشة الحلواني', item: 'مولتن كيك شوكولاتة', icon: Sparkles },
                ].map((station, idx) => {
                  const stage = kdsStations[idx];
                  const meta = KDS_STAGE_META[stage];
                  const IconComp = station.icon;
                  return (
                    <button
                      key={station.title}
                      type="button"
                      onClick={() => advanceKdsStation(idx as 0 | 1 | 2)}
                      className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-5 text-right space-y-4 hover:border-[#14285A]/45 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="w-10 h-10 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-[#14285A] flex items-center justify-center">
                          <IconComp className="w-5 h-5" />
                        </span>
                        <span
                          className="px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                          style={{ backgroundColor: meta.badgeBg, color: meta.badgeText }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-[#0E1B3D]/65">{station.title}</p>
                        <p className="landing-cairo-heading text-base text-[#14285A] mt-0.5">
                          {station.item}
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
                <span>فصل تلقائي لأصناف المطبخ والبار والحلواني لحظة تأكيد الطلب.</span>
              </li>
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>تتبع واضح للحالة: قيد التحضير ثم جاهز ثم تم التقديم.</span>
              </li>
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>تنبيهات فورية تقلل زمن التحضير وتمنع نسيان أي صنف.</span>
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className="px-6 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>تواصل لتجهيز شاشات المطبخ</span>
                <ArrowLeft className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </section>

        {/* 5. الإدارة والتقارير */}
        <section id="management" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span>٠٥ · الإدارة والتقارير</span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                مراجعة الورديات السابقة وسجل الرقابة والصلاحيات
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                افتح شيكات أي يوم بضغطة، راجع أسباب التعديل، وحدد صلاحيات المدير بدقة.
              </p>
            </div>

            {/* Interactive Simulation Card */}
            <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="px-3 py-1 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                  مثال · مصفوفة الورديات وسجل الرقابة وصلاحيات المدير
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Shift Matrix */}
                <div className="lg:col-span-6 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#14285A]">
                    <Calendar className="w-4 h-4 text-[#E8833A]" />
                    <span>اضغط على أي يوم لفتح شيكاته (مثال)</span>
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
                        <p className="text-xs font-bold">{day.dayLabel}</p>
                        <p className="text-[11px] opacity-80 font-mono-num">{day.checksCount}</p>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                      <span>شيكات {activeShift.dayLabel}</span>
                      <span className="font-mono-num">{activeShift.totalSales}</span>
                    </div>
                    {activeShift.checks.map((chk) => (
                      <div
                        key={chk.id}
                        className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                      >
                        <span>
                          {chk.id} · {chk.table} ({chk.method})
                        </span>
                        <span className="font-mono-num font-bold text-[#14285A]">{chk.amount}</span>
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
                        <span>سجل الرقابة (مثال)</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#E8833A]/15 text-[#E8833A]">موثّق</span>
                    </div>
                    <p className="text-xs text-[#0E1B3D]/85">
                      المدير (@mosalah) قام بإلغاء صنف من طاولة ٦ · السبب: «طلب الضيف قبل التحضير».
                    </p>
                  </div>

                  <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-2.5">
                    <p className="text-xs font-bold text-[#14285A]">صلاحيات المدير (تبديل مثال)</p>
                    {(
                      [
                        { key: 'pauseItems', label: 'إيقاف الأصناف غير المتوفرة مؤقتاً' },
                        { key: 'editWithReason', label: 'تعديل أو إلغاء الشيك بكتابة سبب' },
                        { key: 'tableQr', label: 'صلاحية توليد QR الطاولات' },
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
                          <span className="font-semibold text-[#0E1B3D]">{perm.label}</span>
                          <span
                            className={`px-2.5 py-0.5 rounded-md font-bold transition-colors ${
                              active
                                ? 'bg-[#2F8F5B]/15 text-[#2F8F5B]'
                                : 'bg-[#E6D9C3] text-[#0E1B3D]/70'
                            }`}
                          >
                            {active ? 'مفعّل' : 'مقفل'}
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
                <span>مراجعة شيكات أي يوم أو وردية مغلقة في أرشيف صاحب المطعم.</span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>سجل رقابة إلزامي لسبب كل تعديل أو إلغاء يقوم به المدير.</span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>تحكم مرن من المالك في فتح أو إغلاق صلاحيات المدير لحظياً.</span>
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className="px-6 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>تواصل لمعرفة أدوات الإدارة</span>
                <ArrowLeft className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </section>

        {/* 6. العملاء والولاء */}
        <section id="loyalty" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#F3EBDD]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span>٠٦ · العملاء والولاء</span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                بطاقة أختام ورادار أعياد الميلاد لعملائك
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                كافئ الزيارات المتكررة وتواصل مع ضيفك قبل عيد ميلاده بهدية عبر واتساب.
              </p>
            </div>

            {/* Interactive Simulation Card */}
            <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="px-3 py-1 rounded-xl bg-[#F3EBDD] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                  مثال · بطاقة أختام تفاعلية وتنبيه عيد ميلاد
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                {/* Stamp Card */}
                <div className="md:col-span-6 bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                    <span className="flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-[#E8833A]" />
                      <span>بطاقة أختام الزيارات (مثال)</span>
                    </span>
                    <span className="font-mono-num">{stampCount} / ٥</span>
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
                      {stampCount >= 5 ? 'إعادة مثال الأختام' : 'أضف ختم زيارة'}
                    </button>
                    {stampCount >= 5 && (
                      <span className="px-2.5 py-1 rounded-lg bg-[#2F8F5B]/15 text-[#2F8F5B] text-xs font-bold">
                        تم اكتمال المكافأة
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
                        <span>تنبيه عيد ميلاد قريب (مثال)</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#E8833A]/15 text-[#E8833A] text-[11px] font-bold">
                        بعد يومين
                      </span>
                    </div>
                    <p className="landing-cairo-heading text-base text-[#14285A]">
                      أ. منى محمود · عميل متكرر
                    </p>
                    <p className="text-xs text-[#0E1B3D]/80">
                      مفضل لها: قهوة لاتيه + مولتن كيك — جاهزة لإرسال معايدة وخصم ضيافة.
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setBirthdayGreetSent((v) => !v)}
                      className="px-4 py-2.5 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4 text-[#E8833A]" />
                      <span>{birthdayGreetSent ? 'إعادة ضبط المثال' : 'معايدة عبر واتساب'}</span>
                    </button>
                    {birthdayGreetSent && (
                      <span className="px-2.5 py-1 rounded-lg bg-[#2F8F5B]/15 text-[#2F8F5B] text-xs font-bold">
                        تم تجهيز التهنئة
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>تسجيل سريع برقم الهاتف لبناء قاعدة عملاء حقيقية لمطعمك.</span>
              </li>
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>بطاقة أختام رقمية تكافئ الضيوف وتشجعهم على العودة.</span>
              </li>
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>رادار أعياد الميلاد قبل ٣ أيام مع إرسال تهنئة بضغطة واحدة.</span>
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className="px-6 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>تواصل لتفعيل نظام الولاء</span>
                <ArrowLeft className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </section>

        {/* 7. التكامل مع تايجوس */}
        <section id="tygos" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span>٠٧ · التكامل مع تايجوس</span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                من المبيعات إلى تكلفة الوجبة والمخازن مع تايجوس
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                ربط مباشر بين طلبات سُفرة QR ومنظومة تايجوس لحساب خامات كل طبق وهامش ربحه.
              </p>
            </div>

            {/* Interactive Simulation Card */}
            <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="px-3 py-1 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                  مثال · كارت تكلفة الوجبة وهامش الربح (بيانات توضيحية)
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
                      {idx === 0 ? 'برجر (مثال)' : 'باستا (مثال)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-5 sm:p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6D9C3] pb-3.5">
                  <div>
                    <h3 className="landing-cairo-heading text-lg text-[#14285A]">{activeMeal.name}</h3>
                    <p className="text-xs text-[#0E1B3D]/75 mt-0.5">الخامات المخصومة: {activeMeal.ingredients}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#14285A]">
                    <TrendingUp className="w-4 h-4 text-[#E8833A]" />
                    <span>هامش الربح التقديري: {activeMeal.marginPercent}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl p-4 space-y-2">
                    <p className="text-xs text-[#0E1B3D]/75">سعر البيع (مثال)</p>
                    <p className="landing-cairo-heading text-2xl text-[#14285A] font-mono-num">
                      {activeMeal.sellPrice} ج.م
                    </p>
                    <div className="h-2 rounded-full bg-[#E6D9C3] overflow-hidden">
                      <div className="h-full bg-[#14285A] w-full transition-all duration-300" />
                    </div>
                  </div>

                  <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl p-4 space-y-2">
                    <p className="text-xs text-[#0E1B3D]/75">تكلفة الخامات (مثال)</p>
                    <p className="landing-cairo-heading text-2xl text-[#14285A] font-mono-num">
                      {activeMeal.cost} ج.م
                    </p>
                    <div className="h-2 rounded-full bg-[#E6D9C3] overflow-hidden">
                      <div
                        className="h-full bg-[#E8833A] transition-all duration-300"
                        style={{ width: `${Math.round((activeMeal.cost / activeMeal.sellPrice) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl p-4 space-y-2">
                    <p className="text-xs text-[#0E1B3D]/75">صافي الهامش (مثال)</p>
                    <p className="landing-cairo-heading text-2xl text-[#14285A] font-mono-num">
                      {activeMeal.sellPrice - activeMeal.cost} ج.م
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
                <span>خصم آلي لمكونات كل وجبة من المخزون فور إتمام الطلب.</span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>حساب فوري لتكلفة الطبق وهامش الربح في كل فرع.</span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>توحيد الجرد والموردين والحسابات العامة في منظومة تايجوس.</span>
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className="px-6 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>اطلب عرض ربط مع تايجوس</span>
                <ArrowLeft className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </section>

        {/* 8. الأسعار */}
        <section id="pricing" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#F3EBDD]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span>٠٨ · الأسعار</span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                ثلاث باقات مرنة تناسب حجم مطعمك
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                نصوص وأسعار نائبة قابلة للتعديل حسب خطة التشغيل وعدد الصالات.
              </p>
            </div>

            {/* Interactive Simulation Card Container (3 Placeholder Cards) */}
            <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-5">
              <span className="inline-block px-3 py-1 rounded-xl bg-[#F3EBDD] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                مثال · باقات نائبة قابلة للتعديل (الأكثر طلباً مميزة)
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
                          {plan.badge}
                        </span>
                      </div>

                      <h3
                        className={`landing-cairo-heading text-lg ${
                          plan.featured ? 'text-[#FBF7EF]' : 'text-[#14285A]'
                        }`}
                      >
                        {plan.name}
                      </h3>

                      <div
                        className={`py-2.5 border-y ${
                          plan.featured ? 'border-[#FBF7EF]/20' : 'border-[#E6D9C3]'
                        }`}
                      >
                        <p className="landing-cairo-heading text-xl">{plan.price}</p>
                        <p className="text-xs opacity-75">{plan.period}</p>
                      </div>

                      <p className="text-xs opacity-85 leading-relaxed">{plan.description}</p>

                      <ul className="space-y-2 text-xs">
                        {plan.bullets.map((bullet) => (
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
                      طلب تسعير الباقة
                    </button>
                  </article>
                ))}
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>باقات مرنة تناسب الكافيهات الفردية والمطاعم متعددة الفروع.</span>
              </li>
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>إمكانية الترقية لاحقاً بدون إعادة إدخال المنيو أو البيانات.</span>
              </li>
              <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>تدريب مبدئي لفريق الصالة والكاشير عند بدء التشغيل.</span>
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => scrollToSection('contact', 'contact')}
                className="px-6 py-3.5 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <span>تواصل لمعرفة الباقة الأنسب</span>
                <ArrowLeft className="w-4 h-4 text-[#E8833A]" />
              </button>
            </div>
          </div>
        </section>

        {/* 9. تواصل معنا */}
        <section id="contact" className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8833A]" />
                <span>٠٩ · تواصل معنا</span>
              </span>
              <h2 className="landing-cairo-heading text-3xl sm:text-4xl text-[#14285A]">
                ابدأ تجهيز مطعمك اليوم عبر واتساب
              </h2>
              <p className="text-base sm:text-lg text-[#0E1B3D]/85">
                راسلنا مباشرة على واتساب أو اكتب بيانات مطعمك في النموذج لإرسال رسالة جاهزة.
              </p>
            </div>

            {/* Interactive Contact Card */}
            <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-6 sm:p-8 space-y-6">
              <span className="inline-block px-3 py-1 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                مثال · تواصل مباشر أو نموذج تجهيز رسالة واتساب
              </span>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-5 bg-[#14285A] text-[#FBF7EF] rounded-2xl p-6 flex flex-col justify-between gap-6">
                  <div className="space-y-3">
                    <div className="w-11 h-11 rounded-xl bg-[#FBF7EF]/15 flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-[#E8833A]" />
                    </div>
                    <h3 className="landing-cairo-heading text-xl">محادثة فورية مع الفريق</h3>
                    <p className="text-xs sm:text-sm text-[#FBF7EF]/85 leading-relaxed">
                      أرسل اسم مطعمك عبر واتساب لنرسل لك تجربة مباشرة ونجهز معك المنيو وطاولات الصالة.
                    </p>
                  </div>

                  <a
                    href={whatsappDirectHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-4 rounded-xl bg-[#FBF7EF] text-[#14285A] text-sm font-bold text-center hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4 text-[#E8833A]" />
                    <span>تواصل عبر واتساب الآن</span>
                  </a>
                </div>

                <form
                  onSubmit={handleContactSubmit}
                  className="lg:col-span-7 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-6 space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-[#14285A] mb-1.5">
                        اسمك أو اسم المطعم
                      </label>
                      <input
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => {
                          setContactName(e.target.value);
                          setContactSubmitted(false);
                        }}
                        placeholder="مثال: مطعم الأصيل"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] text-sm text-[#0E1B3D] focus:outline-none focus:border-[#14285A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#14285A] mb-1.5">
                        رقم الواتساب
                      </label>
                      <input
                        type="tel"
                        required
                        value={contactPhone}
                        onChange={(e) => {
                          setContactPhone(e.target.value);
                          setContactSubmitted(false);
                        }}
                        placeholder="مثال: 01000000000"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] text-sm text-[#0E1B3D] focus:outline-none focus:border-[#14285A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14285A] mb-1.5">
                      ملاحظة سريعة (اختياري)
                    </label>
                    <input
                      type="text"
                      value={contactNotes}
                      onChange={(e) => {
                        setContactNotes(e.target.value);
                        setContactSubmitted(false);
                      }}
                      placeholder="مثال: ١٥ طاولة + شاشة مطبخ"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] text-sm text-[#0E1B3D] focus:outline-none focus:border-[#14285A]"
                    />
                  </div>

                  {!contactSubmitted ? (
                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity cursor-pointer"
                    >
                      تجهيز طلب التواصل
                    </button>
                  ) : (
                    <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="px-2.5 py-1 rounded-lg bg-[#2F8F5B]/15 text-[#2F8F5B] text-xs font-bold self-start sm:self-center">
                        تم تجهيز الرسالة بنجاح
                      </span>
                      <a
                        href={contactPreFilledWhatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs font-bold inline-flex items-center justify-center gap-1.5"
                      >
                        <span>إرسال في واتساب</span>
                        <ArrowLeft className="w-3.5 h-3.5 text-[#E8833A]" />
                      </a>
                    </div>
                  )}
                </form>
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>رد مباشر لتنسيق عرض حي للمنيو وشاشات الصالة والمطبخ.</span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>مساعدة في اختيار الباقة الملائمة لعدد الطاولات والأقسام.</span>
              </li>
              <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
                <span>مرافقة خطوة بخطوة حتى يبدأ فريقك العمل بسلاسة.</span>
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
                <span>تواصل معنا عبر واتساب</span>
              </a>
              <button
                type="button"
                onClick={handlePrimaryStart}
                className="px-6 py-3.5 rounded-2xl border border-[#E6D9C3] bg-[#F3EBDD] text-[#14285A] text-sm font-bold hover:border-[#14285A]/40 transition-colors cursor-pointer"
              >
                دخول لوحة الإدارة
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-[#E6D9C3] bg-[#F3EBDD] py-6 pb-20 sm:pb-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#0E1B3D]/75">
          <span className="font-semibold text-[#14285A]">
            سُفرة QR · المنيو الرقمي وتشغيل الصالة والمطبخ
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
              معاينة منيو حي
            </a>
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                handlePrimaryStart();
              }}
              className="hover:text-[#14285A] font-semibold"
            >
              لوحة التحكم
            </a>
          </div>
        </div>
      </footer>

      {/* Fixed Bottom WhatsApp Button */}
      <a
        href={whatsappDirectHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="تواصل معنا عبر واتساب"
        className="fixed bottom-4 left-4 z-30 px-4 py-3 rounded-2xl bg-[#14285A] text-[#FBF7EF] border border-[#E6D9C3]/30 shadow-lg hover:opacity-95 transition-opacity flex items-center gap-2 text-xs sm:text-sm font-bold"
      >
        <MessageCircle className="w-4 h-4 text-[#E8833A]" />
        <span>واتساب</span>
      </a>

      {/* Owner Auth Modal */}
      {authModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تسجيل دخول الإدارة"
        >
          <div
            onClick={() => setAuthModalOpen(false)}
            className="fixed inset-0 bg-[#0E1B3D]/50 backdrop-blur-[2px]"
          />
          <div className="relative z-10 w-full max-w-md bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="landing-cairo-heading text-lg text-[#14285A]">
                دخول صاحب المطعم والإدارة
              </span>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                aria-label="إغلاق نافذة الدخول"
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
