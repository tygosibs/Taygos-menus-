import { useEffect, useMemo, useRef, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  ArrowUpRight,
  BellRing,
  Cake,
  Calculator,
  Check,
  CheckCircle2,
  ExternalLink,
  Gift,
  Globe,
  Home,
  Layers,
  LayoutGrid,
  Loader2,
  LogOut,
  MessageCircle,
  PackageCheck,
  Palette,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
  Tag,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { ConfirmSignOutModal } from '../components/ConfirmSignOutModal';
import { LanguageToggleButton } from '../components/LanguageToggleButton';
import { CaptainWaiterTab } from '../components/admin/CaptainWaiterTab';
import { CustomersCrmTab } from '../components/admin/CustomersCrmTab';
import { LiveOrdersTab } from '../components/admin/LiveOrdersTab';
import { MenuBuilderTab } from '../components/admin/MenuBuilderTab';
import { OffersPromosTab } from '../components/admin/OffersPromosTab';
import { OnboardingForm } from '../components/admin/OnboardingForm';
import { OwnerShiftReportTab } from '../components/admin/OwnerShiftReportTab';
import { QrGeneratorTab } from '../components/admin/QrGeneratorTab';
import { StaffManagementTab } from '../components/admin/StaffManagementTab';
import { ThemeCustomizerTab } from '../components/admin/ThemeCustomizerTab';
import { OwnerAuthCard } from '../components/auth/OwnerAuthCard';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenUi } from '../contexts/PlatformUiContext';
import { DEFAULT_PLATFORM_LANDING } from '../data/defaultLandingSettings';
import {
  buildBirthdayWhatsappUrl,
  getDaysUntilUpcomingBirthday,
  getResolvedLoyaltyConfig,
} from '../lib/customerLoyaltyUtils';
import { auth, isSuperAdminEmail } from '../lib/firebase';
import {
  ensureUserProfile,
  fetchOwnerRestaurant,
  fetchPlatformLandingSettings,
  redeemPlatformPromoCodeForOwner,
  sanitizePlatformPromoCode,
  subscribeOwnerOrders,
  subscribeOwnerServiceCalls,
  subscribeRestaurantCustomers,
} from '../lib/firestoreService';
import { playOrderAlertChime, unlockAudioContext } from '../lib/sound';
import { fetchRestaurantSlugById, getStaffAccessForUid } from '../lib/staffService';
import { CustomerProfile, Restaurant } from '../types/menu';

interface AdminPortalProps {
  onNavigate: (path: string) => void;
}

type AdminTab =
  | 'orders'
  | 'captain'
  | 'staff'
  | 'reports'
  | 'customers'
  | 'menu'
  | 'offers'
  | 'theme'
  | 'qr';

const OWNER_TAB_STORAGE_KEY = 'sufra_owner_active_tab';

export function AdminPortal({ onNavigate }: AdminPortalProps) {
  const { lang, t, dir, loc } = useLanguage();
  const isEn = lang === 'en';
  const ui = useScreenUi('owner_admin');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [staffPortalSlug, setStaffPortalSlug] = useState<string | null>(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(false);
  const [activeTab, setActiveTabState] = useState<AdminTab>(() => {
    if (typeof window === 'undefined') return 'orders';
    const saved = window.sessionStorage.getItem(OWNER_TAB_STORAGE_KEY) as AdminTab | null;
    if (
      saved &&
      ['orders', 'captain', 'staff', 'reports', 'customers', 'menu', 'offers', 'theme', 'qr'].includes(saved)
    ) {
      return saved;
    }
    return 'orders';
  });
  const setActiveTab = (tab: AdminTab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(OWNER_TAB_STORAGE_KEY, tab);
    }
  };
  const [justCreatedBanner, setJustCreatedBanner] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);

  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [pendingCallsCount, setPendingCallsCount] = useState(0);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [birthdayAlertDismissed, setBirthdayAlertDismissed] = useState(false);
  const [newOrderToast, setNewOrderToast] = useState<string | null>(null);
  const [newCallToast, setNewCallToast] = useState<string | null>(null);
  const [tygosModalOpen, setTygosModalOpen] = useState(false);
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [redeemingPromo, setRedeemingPromo] = useState(false);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [supportWhatsapp, setSupportWhatsapp] = useState(DEFAULT_PLATFORM_LANDING.supportWhatsapp);
  const orderInitRef = useRef(false);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const callInitRef = useRef(false);
  const knownCallIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unlock = () => unlockAudioContext();
    window.addEventListener('pointerdown', unlock, { once: true });
    fetchPlatformLandingSettings()
      .then((cms) => {
        if (cms.supportWhatsapp) {
          setSupportWhatsapp(cms.supportWhatsapp);
        }
      })
      .catch(() => {
        // Fallback to DEFAULT_PLATFORM_LANDING.supportWhatsapp
      });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        setLoadingRestaurant(true);
        setAuthError(null);
        try {
          await ensureUserProfile(
            u.uid,
            u.email || '',
            u.displayName || 'صاحب مطعم'
          );
          const rest = await fetchOwnerRestaurant(u.uid);
          setRestaurant(rest);
          if (!rest) {
            const staffAccess = await getStaffAccessForUid(u.uid);
            if (staffAccess?.isActive) {
              const slug = await fetchRestaurantSlugById(staffAccess.restaurantId);
              setStaffPortalSlug(slug);
            } else {
              setStaffPortalSlug(null);
            }
          } else {
            setStaffPortalSlug(null);
          }
        } catch (err) {
          setAuthError(err instanceof Error ? err.message : t.auth.errGeneric);
        } finally {
          setLoadingRestaurant(false);
        }
      } else {
        setRestaurant(null);
        setStaffPortalSlug(null);
      }
    });
    return () => unsub();
  }, [t.auth.errGeneric]);

  // Global live orders listener across ALL dashboard tabs so incoming kitchen orders ring even when editing menu/themes
  useEffect(() => {
    if (!restaurant?.id || !restaurant?.ownerId) {
      setPendingOrdersCount(0);
      return;
    }

    orderInitRef.current = false;
    knownOrderIdsRef.current = new Set();

    const unsub = subscribeOwnerOrders(
      restaurant.id,
      restaurant.ownerId,
      (orders) => {
        const pending = orders.filter((o) => o.status === 'pending');
        setPendingOrdersCount(pending.length);

        if (!orderInitRef.current) {
          orders.forEach((o) => knownOrderIdsRef.current.add(o.id));
          orderInitRef.current = true;
          return;
        }

        let latestNewOrderNum: string | null = null;
        orders.forEach((o) => {
          if (!knownOrderIdsRef.current.has(o.id)) {
            knownOrderIdsRef.current.add(o.id);
            if (o.status === 'pending') {
              latestNewOrderNum = o.orderNumber;
            }
          }
        });

        if (latestNewOrderNum && activeTab !== 'orders') {
          playOrderAlertChime();
          setNewOrderToast(latestNewOrderNum);
        }
      },
      () => {
        // Non-fatal fallback; LiveOrdersTab surfaces interactive retry UI
      }
    );

    return () => unsub();
  }, [restaurant?.id, restaurant?.ownerId, activeTab]);

  // Global live captain/service calls listener across ALL dashboard tabs
  useEffect(() => {
    if (!restaurant?.id || !restaurant?.ownerId) {
      setPendingCallsCount(0);
      return;
    }

    callInitRef.current = false;
    knownCallIdsRef.current = new Set();

    const unsub = subscribeOwnerServiceCalls(
      restaurant.id,
      restaurant.ownerId,
      (calls) => {
        const pending = calls.filter((c) => c.status === 'pending');
        setPendingCallsCount(pending.length);

        if (!callInitRef.current) {
          calls.forEach((c) => knownCallIdsRef.current.add(c.id));
          callInitRef.current = true;
          return;
        }

        let latestLabel: string | null = null;
        calls.forEach((c) => {
          if (!knownCallIdsRef.current.has(c.id)) {
            knownCallIdsRef.current.add(c.id);
            if (c.status === 'pending') {
              const typeText = isEn
                ? c.callType === 'call_waiter'
                  ? 'Call Captain'
                  : c.callType === 'request_bill_cash'
                    ? 'Bill (Cash)'
                    : c.callType === 'request_bill_card'
                      ? 'Bill (Card)'
                      : 'Cutlery / Water'
                : c.callType === 'call_waiter'
                  ? 'نداء كابتن'
                  : c.callType === 'request_bill_cash'
                    ? 'طلب فاتورة (كاش)'
                    : c.callType === 'request_bill_card'
                      ? 'طلب فاتورة (فيزا)'
                      : 'أدوات طعام / مياه';
              const locPart = c.hallName ? `${c.hallName} · ` : '';
              latestLabel = `${locPart}${isEn ? `Table ${c.tableNumber}` : `ترابيزة ${c.tableNumber}`} (${c.guestName}) — ${typeText}`;
            }
          }
        });

        if (latestLabel && activeTab !== 'captain') {
          playOrderAlertChime();
          setNewCallToast(latestLabel);
        }
      },
      () => {
        // Non-fatal fallback; LiveOrdersTab displays retry UI
      }
    );

    return () => unsub();
  }, [restaurant?.id, restaurant?.ownerId, activeTab, isEn]);

  // Global customers subscription for proactive 3-day Birthday Radar across dashboard
  useEffect(() => {
    if (!restaurant?.id || !restaurant?.ownerId) {
      setCustomers([]);
      return;
    }
    const unsub = subscribeRestaurantCustomers(
      restaurant.id,
      restaurant.ownerId,
      (list) => setCustomers(list),
      () => {
        // Non-fatal fallback; CustomersCrmTab shows interactive load state
      }
    );
    return () => unsub();
  }, [restaurant?.id, restaurant?.ownerId]);

  const upcomingBirthdays = useMemo(() => {
    return customers
      .map((customer) => ({
        customer,
        daysUntil: getDaysUntilUpcomingBirthday(customer.birthDay, customer.birthMonth),
      }))
      .filter(
        (entry): entry is { customer: CustomerProfile; daysUntil: number } =>
          entry.daysUntil !== null
      )
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [customers]);

  if (!authReady || (user && loadingRestaurant)) {
    return (
      <div dir={dir} className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-zinc-600">{t.admin.loadingWorkspace}</p>
        </div>
      </div>
    );
  }

  // Protected Auth Gate
  if (!user) {
    return (
      <div dir={dir} className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between p-4 sm:p-6">
        <header className="max-w-5xl w-full mx-auto flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-lg sm:text-xl font-extrabold text-zinc-950 cursor-pointer flex items-center gap-2 hover:opacity-80"
          >
            <span>{t.brandName}</span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageToggleButton compact />
            <button
              type="button"
              onClick={() => onNavigate('/menu/buns-lab')}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              {t.landing.openDemoMenu}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              aria-label={t.nav.home}
              className="w-9 h-9 rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="max-w-md w-full mx-auto my-8 space-y-4">
          {authError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {authError}
            </div>
          )}
          <OwnerAuthCard
            onSuccess={(u) => {
              if (isSuperAdminEmail(u?.email)) {
                onNavigate('/super-admin');
              }
            }}
          />
        </main>

        <footer className="text-center text-xs text-zinc-400">
          {t.brandName} · {t.brandSubtitle}
        </footer>
      </div>
    );
  }

  // First-time Onboarding if owner has no restaurant yet
  if (!restaurant) {
    return (
      <div dir={dir} className="min-h-screen bg-[#FAFAFA] overflow-x-clip max-w-full">
        <header className="bg-white border-b border-zinc-200 px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-base sm:text-lg font-extrabold text-zinc-950 cursor-pointer flex items-center gap-1.5 hover:opacity-80"
          >
            <Home className="w-4 h-4 text-zinc-500" />
            <span>{t.brandName}</span>
          </button>
          <div className="flex items-center gap-2">
            <LanguageToggleButton compact />
            {isSuperAdminEmail(user.email) && (
              <button
                type="button"
                onClick={() => onNavigate('/super-admin')}
                className="px-2.5 sm:px-3.5 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold hover:bg-amber-400 flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden sm:inline">{t.admin.superAdminBtn}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSignOutConfirmOpen(true)}
              className="px-2.5 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t.admin.signOut}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/?view=landing')}
              aria-label={isEn ? 'Landing Preview' : 'معاينة صفحة الهبوط'}
              className="w-9 h-9 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 flex items-center justify-center cursor-pointer"
            >
              <Globe className="w-4 h-4" />
            </button>
          </div>
        </header>

        {staffPortalSlug ? (
          <main className="max-w-xl mx-auto mt-10 px-4 pb-12">
            <div className="bg-white border-2 border-indigo-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-zinc-950">
                  {isEn ? 'You are signed in with a Staff Account' : 'أنت مسجّل الآن بحساب كادر / مدير مطعم'}
                </h1>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                  {isEn
                    ? 'The /admin portal is reserved for restaurant owners. Open your Staff Portal directly, or sign out to switch to an owner account.'
                    : 'بوابة /admin مخصصة لمالكي المطاعم. افتح بوابة الكادر الخاصة بمطعمك مباشرة، أو سجّل الخروج للدخول بحساب مالك آخر.'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate(`/staff/${staffPortalSlug}`)}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-extrabold whitespace-nowrap cursor-pointer"
                >
                  {isEn ? 'Open Staff Portal' : 'الانتقال لبوابة الكادر'}
                </button>
                <button
                  type="button"
                  onClick={() => setSignOutConfirmOpen(true)}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer"
                >
                  {t.admin.signOut}
                </button>
              </div>
            </div>
          </main>
        ) : (
          <OnboardingForm
            ownerId={user.uid}
            ownerDisplayName={user.displayName || user.email || 'Owner'}
            onCreated={(created) => {
              setRestaurant(created);
              setActiveTab('menu');
              setJustCreatedBanner(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
        <ConfirmSignOutModal
          open={signOutConfirmOpen}
          onCancel={() => setSignOutConfirmOpen(false)}
          onConfirm={() => {
            setSignOutConfirmOpen(false);
            void signOut(auth);
          }}
        />
      </div>
    );
  }

  const navMetaMap: Record<
    AdminTab,
    { id: AdminTab; label: string; shortLabel: string; icon: typeof BellRing; badge?: number }
  > = {
    orders: {
      id: 'orders',
      label: ui.getButtonLabel('orders', lang, isEn ? 'Cashier & Multi-KDS' : 'شاشات الكاشير والمطبخ'),
      shortLabel: ui.getButtonLabel('orders', lang, isEn ? 'Cashier & KDS' : 'الكاشير والمطبخ'),
      icon: BellRing,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
    },
    captain: {
      id: 'captain',
      label: ui.getButtonLabel('captain', lang, isEn ? 'Captain / Waiter Screen' : 'شاشة الكابتن (الويتر)'),
      shortLabel: ui.getButtonLabel('captain', lang, isEn ? 'Captain Screen' : 'شاشة الكابتن'),
      icon: UserCheck,
      badge: pendingCallsCount > 0 ? pendingCallsCount : undefined,
    },
    staff: {
      id: 'staff',
      label: ui.getButtonLabel('staff', lang, isEn ? 'Manager & Staff RBAC' : 'المدير والكادر والصلاحيات'),
      shortLabel: ui.getButtonLabel('staff', lang, isEn ? 'Staff & Roles' : 'الكادر والصلاحيات'),
      icon: ShieldCheck,
    },
    reports: {
      id: 'reports',
      label: ui.getButtonLabel('reports', lang, isEn ? 'Shifts, Treasury & Reports' : 'تقرير الورديات والحسابات'),
      shortLabel: ui.getButtonLabel('reports', lang, isEn ? 'Shifts & Vault' : 'الورديات والحسابات'),
      icon: Calculator,
    },
    customers: {
      id: 'customers',
      label: ui.getButtonLabel('customers', lang, isEn ? 'Customers (Smart CRM)' : 'عملائي (CRM والتسويق الذكي)'),
      shortLabel: ui.getButtonLabel('customers', lang, isEn ? 'Customers CRM' : 'عملائي CRM'),
      icon: Users,
      badge: upcomingBirthdays.length > 0 ? upcomingBirthdays.length : undefined,
    },
    menu: {
      id: 'menu',
      label: ui.getButtonLabel('menu', lang, isEn ? 'Menu, Sections & Photos' : 'الأقسام والصور والأصناف'),
      shortLabel: ui.getButtonLabel('menu', lang, isEn ? 'Menu & Photos' : 'القوائم والصور'),
      icon: LayoutGrid,
    },
    offers: {
      id: 'offers',
      label: ui.getButtonLabel('offers', lang, t.admin.tabs.offers),
      shortLabel: ui.getButtonLabel('offers', lang, isEn ? 'Offers & Codes' : 'العروض والأكواد'),
      icon: Tag,
    },
    theme: {
      id: 'theme',
      label: ui.getButtonLabel('theme', lang, isEn ? 'Themes, Logo & Info' : 'الثيم واللوجو والإعدادات'),
      shortLabel: ui.getButtonLabel('theme', lang, isEn ? 'Theme & Logo' : 'الثيم واللوجو'),
      icon: Palette,
    },
    qr: {
      id: 'qr',
      label: ui.getButtonLabel('qr', lang, isEn ? 'Halls & Table QRs' : 'الصالات وأكواد QR'),
      shortLabel: ui.getButtonLabel('qr', lang, isEn ? 'Halls & QR' : 'الصالات و QR'),
      icon: QrCode,
    },
  };

  const navItems = ui.orderedButtonIds
    .map((id) => navMetaMap[id as AdminTab])
    .filter(Boolean);

  const ownerTheme = ui.theme;
  const isOwnerTopDeck = ui.screenConfig.layoutStyle === 'top_deck';
  const isOwnerCompactRail = ui.screenConfig.layoutStyle === 'compact_rail';

  const cleanWhatsappDigits = (supportWhatsapp || '').replace(/[^\d]/g, '') || '201000000000';
  const tygosInquiryText = encodeURIComponent(
    isEn
      ? `Hello, I'm using Sufra QR for "${restaurant.name}" and would like to learn about connecting Tygos Cloud ERP (Inventory, Costing, POS, Accounting).`
      : `مرحباً، أستخدم منصة سُفرة لمطعم "${restaurant.name}" وأرغب في معرفة تفاصيل ربط منظومة تايجوس (Tygos) السحابية الكاملة للمخازن والتكاليف ونقاط البيع والحسابات.`
  );
  const tygosWhatsappHref = `https://wa.me/${cleanWhatsappDigits}?text=${tygosInquiryText}`;

  const handleSelectOwnerTab = (tabId: AdminTab) => {
    unlockAudioContext();
    setActiveTab(tabId);
    if (tabId === 'orders') setNewOrderToast(null);
    if (tabId === 'captain') setNewCallToast(null);
  };

  return (
    <div
      dir={dir}
      className={`min-h-screen flex flex-col ${isOwnerTopDeck ? '' : 'lg:flex-row'} overflow-x-clip max-w-full`}
      style={{ backgroundColor: ownerTheme.canvasBg, color: ownerTheme.canvasText }}
    >
      {/* Sidebar */}
      {!isOwnerTopDeck && (
        <aside
          className={`print:hidden ${isOwnerCompactRail ? 'lg:w-58' : 'lg:w-72'} border-b lg:border-b-0 lg:border-e shrink-0 flex flex-col justify-between`}
          style={{
            backgroundColor: ownerTheme.sidebarBg,
            borderColor: ownerTheme.sidebarBorder,
            color: ownerTheme.sidebarText,
          }}
        >
          <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                title={t.nav.home}
                className="text-base sm:text-lg font-extrabold cursor-pointer flex items-center gap-1.5 hover:opacity-80"
                style={{ color: ownerTheme.sidebarText }}
              >
                <Home className="w-4 h-4" style={{ color: ownerTheme.accentHex }} />
                <span>{t.brandName}</span>
              </button>
              <div className="lg:hidden flex items-center gap-1.5">
                <LanguageToggleButton variant={ownerTheme.isDarkShell ? 'dark' : 'light'} compact />
                <button
                  type="button"
                  onClick={() => onNavigate(`/menu/${restaurant.slug}?preview=1`)}
                  className={`px-2.5 py-1.5 border text-xs font-bold flex items-center gap-1 cursor-pointer ${ui.radiusClasses.button}`}
                  style={{ borderColor: ownerTheme.sidebarBorder, color: ownerTheme.sidebarText }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Menu' : 'المنيو'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSignOutConfirmOpen(true)}
                  aria-label={t.admin.signOut}
                  className={`px-2.5 py-1.5 border border-rose-300/60 bg-rose-500/15 text-rose-500 text-xs font-bold flex items-center gap-1 cursor-pointer ${ui.radiusClasses.button}`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Exit' : 'خروج'}</span>
                </button>
              </div>
            </div>

            <div
              className={`p-3 sm:p-3.5 border space-y-1.5 ${ui.radiusClasses.card}`}
              style={{
                backgroundColor: ownerTheme.isDarkShell
                  ? 'rgba(255,255,255,0.05)'
                  : ownerTheme.surfaceSubtleBg,
                borderColor: ownerTheme.sidebarBorder,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold truncate" style={{ color: ownerTheme.sidebarText }}>
                  {loc(restaurant.name, restaurant.name_en)}
                </p>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                    restaurant.isOpen
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {restaurant.isOpen ? t.menu.openNow : t.menu.closedNow}
                </span>
              </div>
              <p className="text-[11px] font-mono-num truncate" dir="ltr" style={{ color: ownerTheme.sidebarMuted }}>
                /menu/{restaurant.slug}
              </p>
              <div
                className="pt-1.5 border-t flex items-center justify-between gap-2"
                style={{ borderColor: ownerTheme.sidebarBorder }}
              >
                {restaurant.appliedPlatformPromoCode ? (
                  <span className="text-[11px] font-bold text-emerald-500 truncate flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-mono-num" dir="ltr">
                      {restaurant.appliedPlatformPromoCode}
                    </span>
                  </span>
                ) : (
                  <span className="text-[11px] truncate" style={{ color: ownerTheme.sidebarMuted }}>
                    {isEn ? 'Have a promo code?' : 'لديك كود خصم من المنصة؟'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPromoCodeInput(restaurant.appliedPlatformPromoCode || '');
                    setPromoMsg(null);
                    setPromoError(null);
                    setPromoModalOpen(true);
                  }}
                  className="text-[11px] font-extrabold underline underline-offset-2 shrink-0 cursor-pointer"
                  style={{ color: ownerTheme.accentHex }}
                >
                  {restaurant.appliedPlatformPromoCode
                    ? isEn
                      ? 'Change'
                      : 'تغيير'
                    : isEn
                      ? 'Redeem'
                      : 'تفعيل 🎁'}
                </button>
              </div>
            </div>

            {isSuperAdminEmail(user.email) && (
              <button
                type="button"
                onClick={() => onNavigate('/super-admin')}
                className={`w-full py-2.5 px-3 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-xs ${ui.radiusClasses.button}`}
                style={{
                  backgroundColor: ownerTheme.accentHex,
                  color: ownerTheme.accentTextHex,
                }}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{t.admin.superAdminBtn}</span>
              </button>
            )}

            {/* Dynamic Card-Grouped Navigation */}
            <nav className="space-y-3">
              {ui.visibleCards.map((card) => (
                <div
                  key={card.id}
                  className={
                    ui.screenConfig.layoutStyle === 'sidebar_cards'
                      ? `p-2.5 border space-y-1.5 ${ui.radiusClasses.card}`
                      : 'space-y-1.5'
                  }
                  style={
                    ui.screenConfig.layoutStyle === 'sidebar_cards'
                      ? {
                          backgroundColor: ownerTheme.isDarkShell
                            ? 'rgba(255,255,255,0.035)'
                            : ownerTheme.surfaceSubtleBg,
                          borderColor: ownerTheme.sidebarBorder,
                        }
                      : undefined
                  }
                >
                  <p
                    className="text-[10px] font-extrabold uppercase tracking-wider px-2"
                    style={{ color: ownerTheme.sidebarMuted }}
                  >
                    {isEn ? card.titleEn : card.titleAr}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-col gap-1.5">
                    {card.buttonIds.map((bid) => {
                      const item = navMetaMap[bid as AdminTab];
                      if (!item) return null;
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectOwnerTab(item.id)}
                          className={`min-h-[42px] flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold transition-all cursor-pointer ${ui.radiusClasses.button}`}
                          style={
                            active
                              ? {
                                  backgroundColor: ownerTheme.sidebarActiveBg,
                                  color: ownerTheme.sidebarActiveText,
                                }
                              : {
                                  color: ownerTheme.sidebarText,
                                }
                          }
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="truncate lg:hidden">{item.shortLabel}</span>
                            <span className="hidden lg:inline truncate">{item.label}</span>
                          </span>
                          {item.badge !== undefined && (
                            <span
                              className="font-mono-num text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0"
                              style={{
                                backgroundColor: active ? ownerTheme.sidebarActiveText : ownerTheme.accentHex,
                                color: active ? ownerTheme.sidebarActiveBg : ownerTheme.accentTextHex,
                              }}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <div
            className="hidden lg:block p-5 border-t space-y-2"
            style={{ borderColor: ownerTheme.sidebarBorder }}
          >
            {isSuperAdminEmail(user.email) && (
              <button
                type="button"
                onClick={() => onNavigate('/super-admin')}
                className={`w-full py-2.5 px-3 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                style={{
                  backgroundColor: ownerTheme.accentHex,
                  color: ownerTheme.accentTextHex,
                }}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{t.admin.superAdminBtn}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate(`/menu/${restaurant.slug}?preview=1`)}
              className={`w-full py-2.5 px-3 border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
              style={{ borderColor: ownerTheme.sidebarBorder, color: ownerTheme.sidebarText }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t.admin.viewPublicMenu}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/?view=landing')}
              className={`w-full py-2 px-3 border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
              style={{ borderColor: ownerTheme.sidebarBorder, color: ownerTheme.sidebarText }}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isEn ? 'Landing Preview' : 'معاينة صفحة الهبوط'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSignOutConfirmOpen(true)}
              className={`w-full py-2 px-3 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.admin.signOut}</span>
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <header
            className="print:hidden border-b px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3"
            style={{
              backgroundColor: ownerTheme.headerBg,
              borderColor: ownerTheme.headerBorder,
              color: ownerTheme.headerText,
            }}
          >
          <div className="text-xs flex items-center gap-2 min-w-0" style={{ color: ownerTheme.mutedText }}>
            <span className="hidden sm:inline">{t.admin.workspaceTitle}</span>
            <span className="hidden sm:inline">/</span>
            <span className="font-bold truncate" style={{ color: ownerTheme.headerText }}>
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className={isOwnerTopDeck ? 'block' : 'hidden lg:block'}>
              <LanguageToggleButton />
            </div>
            {isSuperAdminEmail(user.email) && (
              <button
                type="button"
                onClick={() => onNavigate('/super-admin')}
                className={`flex px-3 py-1.5 text-xs font-extrabold items-center gap-1.5 cursor-pointer shadow-xs ${ui.radiusClasses.button}`}
                style={{ backgroundColor: ownerTheme.accentHex, color: ownerTheme.accentTextHex }}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{t.admin.superAdminBtn}</span>
              </button>
            )}
            {activeTab !== 'orders' && (
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className={`flex px-3 py-1.5 border text-xs font-bold items-center gap-1 cursor-pointer ${ui.radiusClasses.button}`}
                style={{ borderColor: ownerTheme.surfaceBorder, color: ownerTheme.headerText }}
              >
                <Home className="w-3.5 h-3.5" />
                <span>{t.nav.home}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('/?view=landing')}
              className={`${isOwnerTopDeck ? 'flex' : 'hidden sm:flex'} px-3 py-1.5 border text-xs font-bold items-center gap-1 cursor-pointer ${ui.radiusClasses.button}`}
              style={{ borderColor: ownerTheme.surfaceBorder, color: ownerTheme.headerText }}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isEn ? 'Landing' : 'صفحة الهبوط'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate(`/menu/${restaurant.slug}?preview=1`)}
              className={`hidden sm:flex px-3.5 py-1.5 border text-xs font-bold items-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
              style={{ borderColor: ownerTheme.surfaceBorder, color: ownerTheme.headerText }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t.admin.themes.previewLink}</span>
            </button>
            {isOwnerTopDeck && (
              <button
                type="button"
                onClick={() => setSignOutConfirmOpen(true)}
                className={`px-3 py-1.5 border border-rose-200 text-rose-700 text-xs font-bold cursor-pointer ${ui.radiusClasses.button}`}
              >
                {t.admin.signOut}
              </button>
            )}
          </div>
        </header>

        {isOwnerTopDeck && (
          <div className="print:hidden px-3 sm:px-6 pt-4 max-w-6xl w-full mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ui.visibleCards.map((card) => (
                <div
                  key={card.id}
                  className={`p-3 border space-y-2 ${ui.radiusClasses.card}`}
                  style={{
                    backgroundColor: ownerTheme.surfaceBg,
                    borderColor: ownerTheme.surfaceBorder,
                    boxShadow: ownerTheme.cardShadow,
                  }}
                >
                  <p className="text-[11px] font-extrabold" style={{ color: ownerTheme.mutedText }}>
                    {isEn ? card.titleEn : card.titleAr}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {card.buttonIds.map((bid) => {
                      const item = navMetaMap[bid as AdminTab];
                      if (!item) return null;
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectOwnerTab(item.id)}
                          className={`px-3 py-2 border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                          style={
                            active
                              ? {
                                  backgroundColor: ownerTheme.accentHex,
                                  borderColor: ownerTheme.accentHex,
                                  color: ownerTheme.accentTextHex,
                                }
                              : {
                                  backgroundColor: ownerTheme.surfaceSubtleBg,
                                  borderColor: ownerTheme.surfaceBorder,
                                  color: ownerTheme.surfaceText,
                                }
                          }
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span>{item.shortLabel}</span>
                          {item.badge !== undefined && (
                            <span className="font-mono-num text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-black/15">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <main className="p-3 sm:p-6 max-w-6xl w-full mx-auto space-y-4">
          {justCreatedBanner && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start justify-between gap-3 text-xs text-emerald-950">
              <div className="space-y-1">
                <p className="font-extrabold text-sm">
                  {isEn
                    ? 'Your restaurant dashboard is ready!'
                    : 'تم إنشاء لوحة تحكم مطعمك بنجاح!'}
                </p>
                <p className="text-emerald-800 leading-relaxed">
                  {isEn
                    ? 'Here you can manage Main Categories, Subcategories, Dish Photos, Themes/Logo, and Kitchen Orders anytime.'
                    : 'أنت الآن في قسم القوائم والصور والأصناف: يمكنك إضافة القوائم الرئيسية والفرعية ورفع صور أطباقك، أو التنقل بين المطبخ والثيم وكود QR.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setJustCreatedBanner(false)}
                aria-label={isEn ? 'Dismiss' : 'إغلاق'}
                className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-800 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {newOrderToast && activeTab !== 'orders' && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-3 text-xs text-amber-950 shadow-sm">
              <div className="flex items-center gap-2 font-bold">
                <BellRing className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  {isEn
                    ? `New incoming order #${newOrderToast}!`
                    : `وصل طلب جديد الآن #${newOrderToast}!`}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('orders');
                    setNewOrderToast(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-950 text-white font-bold cursor-pointer"
                >
                  {isEn ? 'Open Kitchen' : 'عرض في المطبخ'}
                </button>
                <button
                  type="button"
                  onClick={() => setNewOrderToast(null)}
                  aria-label="Close alert"
                  className="p-1 rounded-lg hover:bg-amber-200/60 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {newCallToast && activeTab !== 'captain' && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 flex items-center justify-between gap-3 text-xs text-rose-950 shadow-sm">
              <div className="flex items-center gap-2 font-bold min-w-0">
                <BellRing className="w-4 h-4 text-rose-600 shrink-0 animate-bounce" />
                <span className="truncate">{newCallToast}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('captain');
                    setNewCallToast(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
                >
                  {isEn ? 'Open Captain Screen' : 'عرض في شاشة الكابتن'}
                </button>
                <button
                  type="button"
                  onClick={() => setNewCallToast(null)}
                  aria-label="Close alert"
                  className="p-1 rounded-lg hover:bg-rose-200/60 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {upcomingBirthdays.length > 0 &&
            activeTab !== 'customers' &&
            !birthdayAlertDismissed && (() => {
              const nearest = upcomingBirthdays[0];
              const resolvedCfg = getResolvedLoyaltyConfig(restaurant);
              const publicMenuUrl =
                typeof window !== 'undefined'
                  ? `${window.location.origin}/menu/${restaurant.slug}`
                  : `/menu/${restaurant.slug}`;
              const quickWaUrl = buildBirthdayWhatsappUrl(
                nearest.customer,
                loc(restaurant.name, restaurant.name_en),
                resolvedCfg,
                publicMenuUrl,
                lang
              );
              const countdownText = isEn
                ? nearest.daysUntil === 0
                  ? `Today is ${nearest.customer.fullName}'s birthday!`
                  : `${nearest.daysUntil} day${nearest.daysUntil === 1 ? '' : 's'} until ${nearest.customer.fullName}'s birthday`
                : nearest.daysUntil === 0
                  ? `اليوم عيد ميلاد أستاذ ${nearest.customer.fullName}! 🎈`
                  : nearest.daysUntil === 1
                    ? `باقي يوم واحد على عيد ميلاد أستاذ ${nearest.customer.fullName} 🎈`
                    : nearest.daysUntil === 2
                      ? `باقي يومين على عيد ميلاد أستاذ ${nearest.customer.fullName} 🎈`
                      : `باقي ${nearest.daysUntil} أيام على عيد ميلاد أستاذ ${nearest.customer.fullName} 🎈`;

              return (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-amber-200/70 text-amber-900 flex items-center justify-center shrink-0">
                      <Cake className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-extrabold">
                        {isEn
                          ? `🎂 Customer Birthdays in the Next 3 Days (${upcomingBirthdays.length})`
                          : `🎂 أعياد ميلاد عملائك خلال الـ 3 أيام القادمة (${upcomingBirthdays.length})`}
                      </p>
                      <p className="text-[11px] text-amber-900 font-semibold truncate">
                        {countdownText}{' '}
                        <span className="font-mono-num">
                          ({nearest.customer.birthDay}/{nearest.customer.birthMonth})
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <a
                      href={quickWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center gap-1.5 transition-colors"
                    >
                      <Gift className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isEn
                          ? 'Send Birthday Offer'
                          : 'أرسل عرض عيد الميلاد عبر واتساب 🎁'}
                      </span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setActiveTab('customers')}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-zinc-950 text-white font-bold hover:bg-zinc-800 cursor-pointer"
                    >
                      {isEn ? 'Open Customers Radar' : 'عرض الكل في عملائي'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBirthdayAlertDismissed(true)}
                      aria-label={isEn ? 'Dismiss alert' : 'إغلاق التنبيه'}
                      className="p-1.5 rounded-lg hover:bg-amber-200/60 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}

          {restaurant.isSuspended && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
              {t.menu.suspendedTitle} — {t.menu.suspendedDesc}
            </div>
          )}
          {activeTab === 'orders' && (
            <LiveOrdersTab
              restaurant={restaurant}
              actor={{
                uid: user.uid,
                name: user.displayName || restaurant.name,
                role: 'owner',
              }}
              onOpenShiftReports={() => setActiveTab('reports')}
              onRestaurantUpdated={(updated) => setRestaurant(updated)}
            />
          )}
          {activeTab === 'captain' && (
            <CaptainWaiterTab
              restaurant={restaurant}
              actor={{
                uid: user.uid,
                name: user.displayName || restaurant.name,
                role: 'owner',
              }}
              onRestaurantUpdated={(updated) => setRestaurant(updated)}
            />
          )}
          {activeTab === 'staff' && (
            <StaffManagementTab
              restaurant={restaurant}
              mode="owner"
              actor={{
                uid: user.uid,
                name: user.displayName || restaurant.name,
                role: 'owner',
              }}
              onRestaurantUpdated={(updated) => setRestaurant(updated)}
            />
          )}
          {activeTab === 'reports' && (
            <OwnerShiftReportTab
              restaurant={restaurant}
              actor={{
                uid: user.uid,
                name: user.displayName || restaurant.name,
                role: 'owner',
              }}
              onRestaurantUpdated={(updated) => setRestaurant(updated)}
            />
          )}
          {activeTab === 'customers' && (
            <CustomersCrmTab
              restaurant={restaurant}
              onRestaurantUpdated={(updated) => setRestaurant(updated)}
            />
          )}
          {activeTab === 'menu' && <MenuBuilderTab restaurant={restaurant} />}
          {activeTab === 'offers' && (
            <OffersPromosTab
              restaurant={restaurant}
              onRestaurantUpdated={(updated) => setRestaurant(updated)}
              onOpenCustomersTab={() => setActiveTab('customers')}
            />
          )}
          {activeTab === 'theme' && (
            <ThemeCustomizerTab
              restaurant={restaurant}
              onRestaurantUpdated={(updated) => setRestaurant(updated)}
              onOpenPublicMenu={(path) => onNavigate(path)}
            />
          )}
          {activeTab === 'qr' && <QrGeneratorTab restaurant={restaurant} />}
        </main>
        </div>

        {/* Tygos Cloud ERP Footer Banner */}
        <footer className="print:hidden px-3 sm:px-6 pb-6 pt-2 max-w-6xl w-full mx-auto">
          <div className="rounded-2xl bg-zinc-950 text-white border border-zinc-800 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Layers className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[11px] font-extrabold">
                    <Sparkles className="w-3 h-3" />
                    <span>Tygos Cloud ERP</span>
                  </span>
                  <span className="text-[11px] text-zinc-400 font-semibold">
                    {isEn ? 'Enterprise Hospitality Suite' : 'منظومة الإدارة السحابية للمطاعم والكافيهات'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-zinc-100 leading-relaxed">
                  {isEn
                    ? 'Want to connect these screens to inventory, recipe costing, integrated POS, and full accounting? Discover the complete Tygos Cloud ERP.'
                    : 'هل تريد ربط هذه الشاشات بالمخازن، التكاليف، نقاط البيع، والحسابات المتكاملة؟ اكتشف منظومة تايجوس (Tygos) السحابية الكاملة'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTygosModalOpen(true)}
              className="w-full sm:w-auto shrink-0 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>{isEn ? 'Discover Tygos Cloud' : 'اكتشف منظومة تايجوس'}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </footer>
      </div>

      {/* Tygos Cloud ERP Overview Modal */}
      {tygosModalOpen && (
        <div
          className="print:hidden fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setTygosModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl border border-zinc-200 max-w-lg w-full p-5 sm:p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950 text-amber-400 text-[11px] font-extrabold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tygos Cloud ERP</span>
                </span>
                <h3 className="text-lg font-extrabold text-zinc-950 pt-1">
                  {isEn ? 'Full Restaurant Operations & ERP Integration' : 'منظومة تايجوس (Tygos) السحابية الكاملة'}
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  {isEn
                    ? 'Upgrade from QR ordering & KDS screens to end-to-end financial, inventory, and branch control.'
                    : 'اربط شاشات الصالة والمطبخ والكاشير في سُفرة مباشرة بإدارة التشغيل الكاملة للمطاعم والسلاسل.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTygosModalOpen(false)}
                aria-label={isEn ? 'Close' : 'إغلاق'}
                className="w-9 h-9 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  icon: PackageCheck,
                  title: isEn ? 'Smart Inventory & Stock' : 'إدارة المخازن والجرد اللحظي',
                  desc: isEn ? 'Automatic raw-material deduction per sold dish & waste tracking.' : 'خصم تلقائي للخامات مع كل أوردر وتنبيهات الحد الأدنى والهالك.',
                },
                {
                  icon: Calculator,
                  title: isEn ? 'Recipe Costing & Margins' : 'حساب التكاليف والريسبي',
                  desc: isEn ? 'Live Food Cost % and profit margin per dish & branch.' : 'تكلفة كل وجبة بدقة وصافي الربح لكل صنف وفرع.',
                },
                {
                  icon: Receipt,
                  title: isEn ? 'Integrated Cloud POS' : 'نقاط البيع الكاملة (POS)',
                  desc: isEn ? 'Shifts, cash drawers, tax invoices, delivery & aggregators.' : 'إدارة الورديات والخزائن والفواتير الضريبية والتوصيل.',
                },
                {
                  icon: CheckCircle2,
                  title: isEn ? 'Full General Ledger' : 'الحسابات العامة المتكاملة',
                  desc: isEn ? 'Suppliers, P&L statements, payroll & multi-branch reports.' : 'حسابات الموردين وقوائم الدخل والأرباح وتقارير الفروع.',
                },
              ].map((mod) => {
                const Icon = mod.icon;
                return (
                  <div key={mod.title} className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1.5">
                    <div className="flex items-center gap-2 text-zinc-950 font-extrabold text-xs">
                      <Icon className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{mod.title}</span>
                    </div>
                    <p className="text-[11px] text-zinc-600 leading-relaxed">{mod.desc}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
              <a
                href={tygosWhatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{isEn ? 'Request Tygos Demo via WhatsApp' : 'اطلب عرضاً توضيحياً لـ Tygos عبر واتساب'}</span>
              </a>
              <button
                type="button"
                onClick={() => setTygosModalOpen(false)}
                className="py-3 px-4 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                {isEn ? 'Continue Using Sufra' : 'العودة للوحة التحكم'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Platform Promo Code Redemption Modal */}
      {promoModalOpen && (
        <div
          className="print:hidden fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPromoModalOpen(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPromoError(null);
              setPromoMsg(null);
              setRedeemingPromo(true);
              try {
                const res = await redeemPlatformPromoCodeForOwner(
                  restaurant.id,
                  promoCodeInput,
                  lang
                );
                setRestaurant((prev) =>
                  prev
                    ? {
                        ...prev,
                        appliedPlatformPromoCode: res.code,
                        appliedPlatformPromoSummary: res.summary,
                        appliedPlatformPromoSummary_en: res.summary_en,
                      }
                    : prev
                );
                setPromoMsg(
                  isEn
                    ? `Code ${res.code} activated: ${res.summary_en}`
                    : `تم تفعيل كود الخصم (${res.code}) بنجاح: ${res.summary}`
                );
              } catch (err) {
                setPromoError(
                  err instanceof Error
                    ? err.message
                    : isEn
                      ? 'Could not apply code'
                      : 'تعذر تفعيل الكود'
                );
              } finally {
                setRedeemingPromo(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl border border-zinc-200 max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-[11px] font-extrabold">
                  <Gift className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Platform SaaS Gift' : 'هدية وكود خصم المنصة'}</span>
                </span>
                <h3 className="text-base font-extrabold text-zinc-950 pt-1">
                  {isEn ? 'Redeem Subscription Promo Code' : 'تفعيل كود خصم اشتراك سُفرة'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPromoModalOpen(false)}
                aria-label={isEn ? 'Close' : 'إغلاق'}
                className="w-9 h-9 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {restaurant.appliedPlatformPromoCode && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  <span className="font-mono-num" dir="ltr">
                    {restaurant.appliedPlatformPromoCode}
                  </span>{' '}
                  —{' '}
                  {loc(
                    restaurant.appliedPlatformPromoSummary || '',
                    restaurant.appliedPlatformPromoSummary_en
                  )}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                {isEn ? 'Promo Code' : 'كود الخصم أو الهدية'}
              </label>
              <input
                type="text"
                dir="ltr"
                required
                maxLength={32}
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(sanitizePlatformPromoCode(e.target.value))}
                placeholder="BDAY50"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num font-bold uppercase focus:outline-none focus:border-zinc-900"
              />
            </div>

            {promoMsg && <p className="text-xs font-bold text-emerald-700">{promoMsg}</p>}
            {promoError && <p className="text-xs font-bold text-rose-600">{promoError}</p>}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPromoModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                {isEn ? 'Close' : 'إغلاق'}
              </button>
              <button
                type="submit"
                disabled={redeemingPromo || promoCodeInput.trim().length < 2}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {redeemingPromo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{isEn ? 'Activate Code' : 'تفعيل الكود'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmSignOutModal
        open={signOutConfirmOpen}
        onCancel={() => setSignOutConfirmOpen(false)}
        onConfirm={() => {
          setSignOutConfirmOpen(false);
          void signOut(auth);
        }}
      />
    </div>
  );
}
