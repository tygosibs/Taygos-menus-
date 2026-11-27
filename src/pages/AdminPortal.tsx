import { useEffect, useMemo, useRef, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  BookOpen,
  Cake,
  Calculator,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Gift,
  Globe,
  Home,
  Layers,
  LayoutGrid,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  PackageCheck,
  Palette,
  QrCode,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { ConfirmSignOutModal } from '../components/ConfirmSignOutModal';
import { LanguageToggleButton } from '../components/LanguageToggleButton';
import { UserGuideEntry, UserGuidePage } from '../components/UserGuidePage';
import { CaptainAssignmentsTab } from '../components/admin/CaptainAssignmentsTab';
import { CaptainWaiterTab } from '../components/admin/CaptainWaiterTab';
import { CustomersCrmTab } from '../components/admin/CustomersCrmTab';
import { JobTitlesTab } from '../components/admin/JobTitlesTab';
import { LiveOrdersTab } from '../components/admin/LiveOrdersTab';
import { MenuBuilderTab } from '../components/admin/MenuBuilderTab';
import { OffersPromosTab } from '../components/admin/OffersPromosTab';
import { OnboardingForm } from '../components/admin/OnboardingForm';
import { OwnerShiftReportTab } from '../components/admin/OwnerShiftReportTab';
import { QrGeneratorTab } from '../components/admin/QrGeneratorTab';
import { StaffManagementTab } from '../components/admin/StaffManagementTab';
import { StationsManagerTab } from '../components/admin/StationsManagerTab';
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
import { getFacilityActivityMeta } from '../lib/facilityCodeUtils';
import { auth, formatFirestoreErrorMessage, isSuperAdminEmail } from '../lib/firebase';
import {
  ensureRestaurantFacilityCode,
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
import {
  getReadableTextOnBg,
  getSidebarActionColors,
  getSidebarHighlightHex,
} from '../lib/platformUiDefaults';
import { OWNER_FULL_PERMISSIONS } from '../lib/staffAuthUtils';
import { fetchRestaurantSlugById, getStaffAccessForUid } from '../lib/staffService';
import { CustomerProfile, Restaurant, StationScreenType } from '../types/menu';

interface AdminPortalProps {
  onNavigate: (path: string) => void;
}

type AdminTab =
  | 'orders'
  | 'captain'
  | 'hall_assignments'
  | 'stations'
  | 'staff'
  | 'job_titles'
  | 'reports'
  | 'customers'
  | 'menu'
  | 'offers'
  | 'theme'
  | 'qr'
  | 'user_guide';

const OWNER_TAB_STORAGE_KEY = 'sufra_owner_active_tab';
const VALID_ADMIN_TABS: AdminTab[] = [
  'orders',
  'captain',
  'hall_assignments',
  'stations',
  'staff',
  'job_titles',
  'reports',
  'customers',
  'menu',
  'offers',
  'theme',
  'qr',
  'user_guide',
];

export function AdminPortal({ onNavigate }: AdminPortalProps) {
  const { lang, t, dir, loc } = useLanguage();
  const isEn = lang === 'en';
  const ui = useScreenUi('owner_admin');
  const ownerTheme = ui.theme;
  const ownerDefaultTab: AdminTab = VALID_ADMIN_TABS.includes(ui.screenConfig.defaultPageId as AdminTab)
    ? (ui.screenConfig.defaultPageId as AdminTab)
    : 'orders';
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [staffPortalSlug, setStaffPortalSlug] = useState<string | null>(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(false);
  const [copiedFacilityCode, setCopiedFacilityCode] = useState(false);
  const isRtl = dir === 'rtl';
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [tabHistory, setTabHistory] = useState<AdminTab[]>([]);
  const userInitiatedTabRef = useRef(false);
  const [activeTab, setActiveTabState] = useState<AdminTab>(() => {
    if (typeof window === 'undefined') return ownerDefaultTab;
    const saved = window.sessionStorage.getItem(OWNER_TAB_STORAGE_KEY) as AdminTab | null;
    if (saved && VALID_ADMIN_TABS.includes(saved)) {
      return saved;
    }
    return ownerDefaultTab;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.sessionStorage.getItem(OWNER_TAB_STORAGE_KEY);
    if (!saved && !userInitiatedTabRef.current) {
      setActiveTabState(ownerDefaultTab);
    }
  }, [ownerDefaultTab]);

  const scrollPageTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      window.requestAnimationFrame(() =>
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      );
    }
  };
  const setActiveTab = (tab: AdminTab, opts?: { pushHistory?: boolean }) => {
    userInitiatedTabRef.current = true;
    const pushHistory = opts?.pushHistory ?? true;
    if (pushHistory && tab !== activeTab) {
      setTabHistory((prev) => [...prev.slice(-14), activeTab]);
    }
    setActiveTabState(tab);
    setMobileSidebarOpen(false);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(OWNER_TAB_STORAGE_KEY, tab);
    }
    scrollPageTop();
  };
  const [stationCreateIntent, setStationCreateIntent] = useState<{
    key: number;
    returnTab?: AdminTab;
    returnLabel?: string;
    screenType?: StationScreenType;
  } | null>(null);
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

  const loadOwnerWorkspace = async (u: User) => {
    setLoadingRestaurant(true);
    setAuthError(null);
    // Sync user profile non-blockingly so a profile rule hiccup never prevents opening the owner workspace
    try {
      await ensureUserProfile(
        u.uid,
        u.email || '',
        u.displayName || (lang === 'en' ? 'Restaurant Owner' : 'صاحب مطعم')
      );
    } catch (profileErr) {
      console.warn('Non-blocking ensureUserProfile error:', profileErr);
    }

    try {
      const rest = await fetchOwnerRestaurant(u.uid);
      if (rest) {
        let resolvedRest = rest;
        if (!rest.facilityCode) {
          try {
            resolvedRest = await ensureRestaurantFacilityCode(rest);
          } catch (codeErr) {
            console.warn('Non-blocking facility code backfill failed:', codeErr);
          }
        }
        setRestaurant(resolvedRest);
        setStaffPortalSlug(null);
      } else {
        setRestaurant(null);
        const staffAccess = await getStaffAccessForUid(u.uid);
        if (staffAccess?.isActive) {
          const slug = await fetchRestaurantSlugById(staffAccess.restaurantId);
          setStaffPortalSlug(slug);
        } else {
          setStaffPortalSlug(null);
        }
      }
    } catch (err) {
      setAuthError(formatFirestoreErrorMessage(err, isEn));
    } finally {
      setLoadingRestaurant(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        void loadOwnerWorkspace(u);
      } else {
        setRestaurant(null);
        setStaffPortalSlug(null);
        setAuthError(null);
      }
    });
    return () => unsub();
  }, [lang]);

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
                    ? 'Check (Cash)'
                    : c.callType === 'request_bill_card'
                      ? 'Check (Card)'
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
      <div
        dir={dir}
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: ownerTheme.canvasBg, color: ownerTheme.canvasText }}
      >
        <div className="text-center space-y-2">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: ownerTheme.accentHex, borderTopColor: 'transparent' }}
          />
          <p className="text-sm font-semibold" style={{ color: ownerTheme.mutedText }}>
            {t.admin.loadingWorkspace}
          </p>
        </div>
      </div>
    );
  }

  // Protected Auth Gate
  if (!user) {
    return (
      <div
        dir={dir}
        className="min-h-screen flex flex-col justify-between p-4 sm:p-6"
        style={{ backgroundColor: ownerTheme.canvasBg, color: ownerTheme.canvasText }}
      >
        <header className="max-w-5xl w-full mx-auto flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-lg sm:text-xl font-extrabold cursor-pointer flex items-center gap-2 hover:opacity-80"
            style={{ color: ownerTheme.canvasText }}
          >
            <span>{t.brandName}</span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageToggleButton compact />
            <button
              type="button"
              onClick={() => onNavigate('/menu/buns-lab')}
              className={`min-h-[38px] px-3 py-1.5 border text-xs font-bold cursor-pointer ${ui.radiusClasses.button}`}
              style={{
                backgroundColor: ownerTheme.surfaceBg,
                borderColor: ownerTheme.surfaceBorder,
                color: ownerTheme.surfaceText,
              }}
            >
              {t.landing.openDemoMenu}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              aria-label={t.nav.home}
              className={`w-9 h-9 border flex items-center justify-center cursor-pointer ${ui.radiusClasses.button}`}
              style={{
                backgroundColor: ownerTheme.surfaceBg,
                borderColor: ownerTheme.surfaceBorder,
                color: ownerTheme.surfaceText,
              }}
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
            onStaffNavigate={(staffSlug) => onNavigate(`/staff/${staffSlug}`)}
            onSuccess={(u) => {
              if (isSuperAdminEmail(u?.email)) {
                onNavigate('/super-admin');
              }
            }}
          />
        </main>

        <footer className="text-center text-xs" style={{ color: ownerTheme.mutedText }}>
          {t.brandName} · {t.brandSubtitle}
        </footer>
      </div>
    );
  }

  // First-time Onboarding if owner has no restaurant yet
  if (!restaurant) {
    return (
      <div
        dir={dir}
        className="min-h-screen overflow-x-clip max-w-full"
        style={{ backgroundColor: ownerTheme.canvasBg, color: ownerTheme.canvasText }}
      >
        <header
          className="border-b px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2.5"
          style={{
            backgroundColor: ownerTheme.headerBg,
            borderColor: ownerTheme.headerBorder,
            color: ownerTheme.headerText,
          }}
        >
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-base sm:text-lg font-extrabold cursor-pointer flex items-center gap-1.5 hover:opacity-80"
            style={{ color: ownerTheme.headerText }}
          >
            <Home className="w-4 h-4" style={{ color: ownerTheme.accentHex }} />
            <span>{t.brandName}</span>
          </button>
          <div className="flex items-center gap-2">
            <LanguageToggleButton compact />
            {isSuperAdminEmail(user.email) && (
              <button
                type="button"
                onClick={() => onNavigate('/super-admin')}
                className={`min-h-[44px] sm:min-h-[38px] px-3 py-2 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                style={{
                  backgroundColor: ownerTheme.highlightHex || '#E8833A',
                  color: getReadableTextOnBg(ownerTheme.highlightHex || '#E8833A', '#0E1B3D', '#FFFFFF'),
                }}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{t.admin.superAdminBtn}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSignOutConfirmOpen(true)}
              className={`min-h-[44px] sm:min-h-[38px] px-3 py-2 border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
              style={{
                borderColor: ownerTheme.surfaceBorder,
                color: ownerTheme.headerText,
                backgroundColor: ownerTheme.surfaceSubtleBg,
              }}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t.admin.signOut}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/?view=landing')}
              aria-label={isEn ? 'Landing Preview' : 'معاينة صفحة الهبوط'}
              className={`w-11 h-11 sm:w-9 sm:h-9 border flex items-center justify-center cursor-pointer shrink-0 ${ui.radiusClasses.button}`}
              style={{
                borderColor: ownerTheme.surfaceBorder,
                color: ownerTheme.headerText,
                backgroundColor: ownerTheme.surfaceSubtleBg,
              }}
            >
              <Globe className="w-4 h-4" />
            </button>
          </div>
        </header>

        {authError ? (
          <main className="max-w-xl mx-auto mt-10 px-4 pb-12">
            <div
              className={`border-2 p-6 sm:p-8 space-y-5 text-center ${ui.radiusClasses.card}`}
              style={{
                backgroundColor: ownerTheme.surfaceBg,
                borderColor: '#fecdd3',
                color: ownerTheme.surfaceText,
                boxShadow: ownerTheme.cardShadow,
              }}
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h1 className="text-lg sm:text-xl font-extrabold" style={{ color: ownerTheme.surfaceText }}>
                  {isEn ? 'Could not load your restaurant workspace' : 'تعذر تحميل مساحة عمل المطعم'}
                </h1>
                <p className="text-xs sm:text-sm leading-relaxed text-rose-700 font-semibold">
                  {authError}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => void loadOwnerWorkspace(user)}
                  className={`w-full sm:w-auto min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${ui.radiusClasses.button}`}
                  style={{
                    backgroundColor: ownerTheme.accentHex,
                    color: ownerTheme.accentTextHex,
                  }}
                >
                  <RefreshCw className="w-4 h-4 shrink-0" />
                  <span>{isEn ? 'Retry Loading' : 'إعادة المحاولة'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSignOutConfirmOpen(true)}
                  className={`w-full sm:w-auto min-h-[44px] px-5 py-2.5 border text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer ${ui.radiusClasses.button}`}
                  style={{
                    backgroundColor: ownerTheme.surfaceSubtleBg,
                    borderColor: ownerTheme.surfaceBorder,
                    color: ownerTheme.surfaceText,
                  }}
                >
                  {t.admin.signOut}
                </button>
              </div>
            </div>
          </main>
        ) : staffPortalSlug ? (
          <main className="max-w-xl mx-auto mt-10 px-4 pb-12">
            <div
              className={`border-2 p-6 sm:p-8 space-y-5 text-center ${ui.radiusClasses.card}`}
              style={{
                backgroundColor: ownerTheme.surfaceBg,
                borderColor: ownerTheme.surfaceBorder,
                color: ownerTheme.surfaceText,
                boxShadow: ownerTheme.cardShadow,
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl border flex items-center justify-center mx-auto"
                style={{
                  backgroundColor: ownerTheme.surfaceSubtleBg,
                  borderColor: ownerTheme.surfaceBorder,
                  color: ownerTheme.accentHex,
                }}
              >
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h1 className="text-lg sm:text-xl font-extrabold" style={{ color: ownerTheme.surfaceText }}>
                  {isEn ? 'You are signed in with a Staff Account' : 'أنت مسجّل الآن بحساب كادر / مدير مطعم'}
                </h1>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: ownerTheme.mutedText }}>
                  {isEn
                    ? 'The /admin portal is reserved for restaurant owners. Open your Staff Portal directly, or sign out to switch to an owner account.'
                    : 'بوابة /admin مخصصة لمالكي المطاعم. افتح بوابة الكادر الخاصة بمطعمك مباشرة، أو سجّل الخروج للدخول بحساب مالك آخر.'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate(`/staff/${staffPortalSlug}`)}
                  className={`w-full sm:w-auto min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-extrabold whitespace-nowrap cursor-pointer ${ui.radiusClasses.button}`}
                  style={{
                    backgroundColor: ownerTheme.accentHex,
                    color: ownerTheme.accentTextHex,
                  }}
                >
                  {isEn ? 'Open Staff Portal' : 'الانتقال لبوابة الكادر'}
                </button>
                <button
                  type="button"
                  onClick={() => setSignOutConfirmOpen(true)}
                  className={`w-full sm:w-auto min-h-[44px] px-5 py-2.5 border text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer ${ui.radiusClasses.button}`}
                  style={{
                    backgroundColor: ownerTheme.surfaceSubtleBg,
                    borderColor: ownerTheme.surfaceBorder,
                    color: ownerTheme.surfaceText,
                  }}
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

  type OwnerNavTab = Exclude<AdminTab, 'user_guide'>;

  const navMetaMap: Record<
    OwnerNavTab,
    { id: OwnerNavTab; label: string; shortLabel: string; icon: typeof BellRing; badge?: number }
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
      label: ui.getButtonLabel('captain', lang, isEn ? 'Captain Screen' : 'شاشة الكابتن'),
      shortLabel: ui.getButtonLabel('captain', lang, isEn ? 'Captain Screen' : 'شاشة الكابتن'),
      icon: UserCheck,
      badge: pendingCallsCount > 0 ? pendingCallsCount : undefined,
    },
    hall_assignments: {
      id: 'hall_assignments',
      label: ui.getButtonLabel('hall_assignments', lang, isEn ? 'Captain Assignments' : 'توزيع الكباتن'),
      shortLabel: ui.getButtonLabel('hall_assignments', lang, isEn ? 'Assignments' : 'توزيع الكباتن'),
      icon: Users,
    },
    stations: {
      id: 'stations',
      label: ui.getButtonLabel('stations', lang, isEn ? 'Screens & Stations' : 'الشاشات والمحطات'),
      shortLabel: ui.getButtonLabel('stations', lang, isEn ? 'Screens' : 'الشاشات والمحطات'),
      icon: Layers,
    },
    staff: {
      id: 'staff',
      label: ui.getButtonLabel('staff', lang, isEn ? 'Manager & Staff RBAC' : 'المدير والكادر والصلاحيات'),
      shortLabel: ui.getButtonLabel('staff', lang, isEn ? 'Staff & Roles' : 'الكادر والصلاحيات'),
      icon: ShieldCheck,
    },
    job_titles: {
      id: 'job_titles',
      label: ui.getButtonLabel('job_titles', lang, isEn ? 'Job Titles & Permissions' : 'المسميات الوظيفية والصلاحيات'),
      shortLabel: ui.getButtonLabel('job_titles', lang, isEn ? 'Job Titles' : 'المسميات الوظيفية'),
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
      label: ui.getButtonLabel('customers', lang, isEn ? 'Customer CRM' : 'عملائي والتسويق الذكي'),
      shortLabel: ui.getButtonLabel('customers', lang, isEn ? 'Customer CRM' : 'عملائي'),
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
    .map((id) => navMetaMap[id as OwnerNavTab])
    .filter(Boolean);

  const isOwnerTopDeck = ui.screenConfig.layoutStyle === 'top_deck';
  const isOwnerCompactRail = ui.screenConfig.layoutStyle === 'compact_rail';

  const ownerTabGuides: Record<
    OwnerNavTab,
    { fallbackAr: string; fallbackEn: string; stepsAr: string; stepsEn: string; keywordsAr: string; keywordsEn: string }
  > = {
    orders: {
      fallbackAr: 'شاشات الكاشير والمطبخ',
      fallbackEn: 'Cashier & Multi-KDS',
      stepsAr: 'استلم الطلبات الحية، افتح الوردية والدرج، قفّل الفواتير، وتابع تنفيذ الأصناف في المحطات.',
      stepsEn: 'Receive live orders, manage shifts & cash drawer, settle checks, and monitor KDS prep.',
      keywordsAr: 'كاشير مطبخ طلبات شيك فاتورة درج وردية خصم تقفيل طابعة حرارية kds',
      keywordsEn: 'cashier kds kitchen pos live orders check drawer shift discount settle printer',
    },
    captain: {
      fallbackAr: 'شاشة الكابتن',
      fallbackEn: 'Captain Screen',
      stepsAr: 'تابع خريطة الصالات والطاولات، أضف طلبات الطاولات، واستجب لنداءات العملاء والأصناف الجاهزة.',
      stepsEn: 'View floor & table map, place table orders, and respond to service calls and ready items.',
      keywordsAr: 'كابتن صالة طاولات نداءات خريطة طلب طاولة',
      keywordsEn: 'captain floor tables map calls dine-in ready items',
    },
    hall_assignments: {
      fallbackAr: 'توزيع الكباتن',
      fallbackEn: 'Captain Assignments',
      stepsAr: 'وزّع الكباتن على الصالات والطاولات لكل وردية وتابع التغطية الفورية.',
      stepsEn: 'Assign Captains to dining halls and tables per shift and monitor live coverage.',
      keywordsAr: 'توزيع كباتن صالات طاولات وردية مدير الصالات تغطية',
      keywordsEn: 'captain assignments halls tables shift hall manager coverage',
    },
    stations: {
      fallbackAr: 'الشاشات والمحطات',
      fallbackEn: 'Screens & Stations',
      stepsAr: 'أضف شاشات كابتن أو محطات تحضير (مطبخ، بار، مخبز...) وعدّل اسمها أو أرشفها.',
      stepsEn: 'Create Captain screens or prep stations (Kitchen, Bar, Bakery...), rename, or archive them.',
      keywordsAr: 'شاشات محطات مطبخ بار مخبز كابتن ارشفة اضافة شاشة',
      keywordsEn: 'screens stations prep kitchen bar bakery pastry captain archive',
    },
    staff: {
      fallbackAr: 'المدير والكادر والصلاحيات',
      fallbackEn: 'Manager & Staff RBAC',
      stepsAr: 'أضف المدير العام، مدير الصالات، الكاشير، الكباتن، ومسؤولي المحطات، وأنشئ دعوات QR.',
      stepsEn: 'Add Managers, Hall Managers, Cashiers, Captains, and Station Staff with QR invites.',
      keywordsAr: 'كادر موظفين مدير عام مدير صالات دعوة qr صلاحيات ايقاف حسابات',
      keywordsEn: 'staff team manager hall manager cashier captain invite qr rbac suspend',
    },
    job_titles: {
      fallbackAr: 'المسميات الوظيفية والصلاحيات',
      fallbackEn: 'Job Titles & Permissions',
      stepsAr: 'أنشئ مسميات وظيفية مخصصة وحدد الشاشات والصلاحيات المفروضة على قاعدة البيانات.',
      stepsEn: 'Create custom Job Titles with exact allowed screens and database-enforced permissions.',
      keywordsAr: 'مسميات وظيفية صلاحيات ادوار وظائف تحكم',
      keywordsEn: 'job titles roles permissions rbac security custom role',
    },
    reports: {
      fallbackAr: 'تقرير الورديات والحسابات',
      fallbackEn: 'Shifts, Treasury & Reports',
      stepsAr: 'راجع الورديات المغلقة، المصروفات، تسليم العهدة لخزنة المالك، وسجل التدقيق.',
      stepsEn: 'Review closed shifts, drawer expenses, treasury custody handovers, and audit logs.',
      keywordsAr: 'تقارير ورديات حسابات خزنة المالك عهدة مصروفات عجز سجل تدقيق',
      keywordsEn: 'reports shifts treasury safe vault float variance expenses handover audit log',
    },
    customers: {
      fallbackAr: 'عملائي والتسويق الذكي',
      fallbackEn: 'Customer CRM',
      stepsAr: 'تصفح قائمة العملاء ونقاط الولاء وأعياد الميلاد وأرسل عروضاً عبر واتساب.',
      stepsEn: 'Manage customer profiles, loyalty points, upcoming birthdays, and WhatsApp outreach.',
      keywordsAr: 'عملاء ولاء بطاقة نقاط اعياد ميلاد واتساب تسويق crm',
      keywordsEn: 'customers crm loyalty punch card birthdays whatsapp marketing',
    },
    menu: {
      fallbackAr: 'الأقسام والصور والأصناف',
      fallbackEn: 'Menu, Sections & Photos',
      stepsAr: 'أضف الأقسام والأصناف وارفع الصور وحدد المحطة التي يتوجه إليها كل قسم أو صنف.',
      stepsEn: 'Build categories and menu items with photos and route each to its prep stations.',
      keywordsAr: 'منيو اقسام اصناف وجبات اسعار صور توجيه محطات ايقاف صنف',
      keywordsEn: 'menu categories items dishes photos prices station routing paused item',
    },
    offers: {
      fallbackAr: 'العروض وأكواد الخصم',
      fallbackEn: 'Offers & Promo Codes',
      stepsAr: 'أنشئ العروض الترويجية وأكواد الخصم لعملاء المنيو وتابع حالة تفعيلها.',
      stepsEn: 'Create promotional offers and discount codes for public menu orders.',
      keywordsAr: 'عروض بانر خصم كوبون كود 1+1 ترويج',
      keywordsEn: 'offers banners promo codes coupons bogo discounts',
    },
    theme: {
      fallbackAr: 'الثيم واللوجو والإعدادات',
      fallbackEn: 'Themes, Logo & Info',
      stepsAr: 'اختر ثيم المنيو العام وارفع اللوجو وعدّل بيانات المطعم وساعات العمل.',
      stepsEn: 'Customize public menu theme, logo, restaurant details, and opening hours.',
      keywordsAr: 'ثيم مظهر لوجو شعار الوان ضريبة خدمة مواعيد اعدادات المطعم',
      keywordsEn: 'theme appearance logo branding tax service charge hours settings',
    },
    qr: {
      fallbackAr: 'الصالات وأكواد QR',
      fallbackEn: 'Halls & Table QRs',
      stepsAr: 'أنشئ الصالات والطاولات واطبع أكواد QR الخاصة بكل طاولة أو بالمنيو العام.',
      stepsEn: 'Set up halls and tables, and generate printable table QR codes.',
      keywordsAr: 'صالات طاولات باركود qr طباعة بطاقات رقم الطاولة',
      keywordsEn: 'halls tables qr code printable cards table number',
    },
  };

  const ownerGuideEntries: UserGuideEntry[] = [];
  for (const card of ui.visibleCards) {
    for (const bid of card.buttonIds) {
      const tabId = bid as OwnerNavTab;
      const item = navMetaMap[tabId];
      const guide = ownerTabGuides[tabId];
      if (!item || !guide) continue;
      const labelAr = ui.getButtonLabel(tabId, 'ar', guide.fallbackAr);
      const labelEn = ui.getButtonLabel(tabId, 'en', guide.fallbackEn);
      ownerGuideEntries.push({
        id: tabId,
        icon: item.icon,
        titleAr: labelAr,
        titleEn: labelEn,
        pathAr: `المسار من قائمتك: ${card.titleAr} ← ${labelAr}`,
        pathEn: `From your menu: ${card.titleEn} → ${labelEn}`,
        stepsAr: guide.stepsAr,
        stepsEn: guide.stepsEn,
        keywordsAr: `${guide.keywordsAr} ${card.titleAr}`,
        keywordsEn: `${guide.keywordsEn} ${card.titleEn}`,
        onGo: () => handleSelectOwnerTab(tabId),
      });
    }
  }
  ownerGuideEntries.push({
    id: 'preview_public_menu',
    icon: ExternalLink,
    titleAr: 'معاينة المنيو العام للعملاء',
    titleEn: 'Preview Public Customer Menu',
    pathAr: isOwnerTopDeck ? 'الشريط العلوي ← معاينة المنيو' : 'أسفل القائمة الجانبية ← عرض المنيو للعملاء',
    pathEn: isOwnerTopDeck ? 'Top bar → Preview Menu' : 'Sidebar footer → View Public Menu',
    stepsAr: 'افتح المنيو الرقمي العام لمطعمك كما يظهر للعملاء عند مسح كود QR.',
    stepsEn: 'Open your live customer-facing digital menu exactly as guests see it via QR.',
    keywordsAr: 'معاينة منيو رقمي عام عملاء qr تجربة',
    keywordsEn: 'preview public digital menu customer qr view',
    onGo: () => onNavigate(`/menu/${restaurant.slug}?preview=1`),
  });

  const cleanWhatsappDigits = (supportWhatsapp || '').replace(/[^\d]/g, '') || '201000000000';
  const tygosInquiryText = encodeURIComponent(
    isEn
      ? `Hello, I'm using Sufra QR for "${restaurant.name}" and would like to learn about connecting Tygos Cloud ERP (Inventory, Costing, POS, Accounting).`
      : `مرحباً، أستخدم منصة سُفرة لمطعم "${restaurant.name}" وأرغب في معرفة تفاصيل ربط منظومة تايجوس (Tygos) السحابية الكاملة للمخازن والتكاليف ونقاط البيع والحسابات.`
  );
  const tygosWhatsappHref = `https://wa.me/${cleanWhatsappDigits}?text=${tygosInquiryText}`;

  const handleSelectOwnerTab = (tabId: AdminTab) => {
    unlockAudioContext();
    setStationCreateIntent(null);
    setActiveTab(tabId);
    if (tabId === 'orders') setNewOrderToast(null);
    if (tabId === 'captain') setNewCallToast(null);
  };

  const handleBackOwnerTab = () => {
    setStationCreateIntent(null);
    setMobileSidebarOpen(false);
    if (tabHistory.length > 0) {
      const prevTab = tabHistory[tabHistory.length - 1];
      setTabHistory((prev) => prev.slice(0, -1));
      setActiveTab(prevTab, { pushHistory: false });
    } else if (activeTab !== ownerDefaultTab) {
      setActiveTab(ownerDefaultTab, { pushHistory: false });
    }
  };

  const handleGoOwnerHome = () => {
    setStationCreateIntent(null);
    setTabHistory([]);
    setActiveTab(ownerDefaultTab, { pushHistory: false });
  };

  const facilityActivityMeta = getFacilityActivityMeta(restaurant.businessType);
  const handleCopyFacilityCode = async () => {
    if (!restaurant.facilityCode) return;
    try {
      await navigator.clipboard.writeText(restaurant.facilityCode);
      setCopiedFacilityCode(true);
      window.setTimeout(() => setCopiedFacilityCode(false), 1800);
    } catch {
      // Clipboard may be unavailable in restricted contexts
    }
  };

  const openAddScreenFrom = (returnTab: AdminTab, screenType?: StationScreenType) => {
    const returnLabel =
      returnTab === 'menu'
        ? isEn
          ? 'Back to Menu'
          : 'رجوع للمنيو'
        : returnTab === 'staff'
          ? isEn
            ? 'Back to Staff'
            : 'رجوع للكادر'
          : undefined;
    setStationCreateIntent({
      key: Date.now(),
      returnTab,
      returnLabel,
      screenType,
    });
    setActiveTab('stations');
  };

  return (
    <div
      dir={dir}
      className={`min-h-screen flex flex-col ${isOwnerTopDeck ? '' : 'lg:flex-row'} overflow-x-clip max-w-full`}
      style={{ backgroundColor: ownerTheme.canvasBg, color: ownerTheme.canvasText }}
    >
      {/* Desktop Sidebar (collapsed into drawer on mobile) */}
      {!isOwnerTopDeck && (
        <aside
          className={`print:hidden hidden lg:flex ${isOwnerCompactRail ? 'lg:w-58' : 'lg:w-72'} lg:border-e shrink-0 flex-col justify-between`}
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
                onClick={handleGoOwnerHome}
                title={t.nav.home}
                className="text-base sm:text-lg font-extrabold cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:opacity-80"
                style={{ color: ownerTheme.sidebarText }}
              >
                <Home className="w-4 h-4 shrink-0" style={{ color: getSidebarHighlightHex(ownerTheme) }} />
                <span>{t.brandName}</span>
              </button>
              <div className="lg:hidden flex items-center gap-1.5 shrink-0">
                <LanguageToggleButton variant={ownerTheme.isDarkShell ? 'dark' : 'light'} compact />
                <button
                  type="button"
                  onClick={() => onNavigate(`/menu/${restaurant.slug}?preview=1`)}
                  className={`min-h-[44px] px-3 py-2 border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${ui.radiusClasses.button}`}
                  style={{ borderColor: ownerTheme.sidebarBorder, color: ownerTheme.sidebarText }}
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>{isEn ? 'Menu' : 'المنيو'}</span>
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
              {restaurant.facilityCode && (
                <div
                  className="pt-1.5 border-t flex items-center justify-between gap-2"
                  style={{ borderColor: ownerTheme.sidebarBorder }}
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold truncate" style={{ color: ownerTheme.sidebarMuted }}>
                      {isEn ? facilityActivityMeta.labelEn : facilityActivityMeta.labelAr}
                    </p>
                    <p
                      className="text-xs font-mono-num font-extrabold tracking-wide truncate"
                      dir="ltr"
                      style={{ color: getSidebarHighlightHex(ownerTheme) }}
                    >
                      {restaurant.facilityCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyFacilityCode()}
                    title={isEn ? 'Copy Facility Code' : 'نسخ كود المنشأة'}
                    className={`min-h-[30px] px-2 py-1 border text-[10px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer ${ui.radiusClasses.button}`}
                    style={{
                      backgroundColor: ownerTheme.isDarkShell ? 'rgba(255,255,255,0.08)' : ownerTheme.surfaceBg,
                      borderColor: ownerTheme.sidebarBorder,
                      color: ownerTheme.sidebarText,
                    }}
                  >
                    {copiedFacilityCode ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>{isEn ? 'Copied' : 'نُسخ'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>{isEn ? 'Code' : 'الكود'}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
              <div
                className="pt-1.5 border-t flex items-center justify-between gap-2"
                style={{ borderColor: ownerTheme.sidebarBorder }}
              >
                {restaurant.appliedPlatformPromoCode ? (
                  <span
                    className={`text-xs font-bold truncate flex items-center gap-1 ${
                      ownerTheme.isDarkShell ? 'text-emerald-300' : 'text-emerald-700'
                    }`}
                  >
                    <Gift className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-mono-num" dir="ltr">
                      {restaurant.appliedPlatformPromoCode}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs font-medium" style={{ color: ownerTheme.sidebarMuted }}>
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
                  className="text-xs font-extrabold underline underline-offset-4 px-2 py-1 min-h-[36px] shrink-0 cursor-pointer hover:opacity-90"
                  style={{ color: getSidebarHighlightHex(ownerTheme) }}
                >
                  {restaurant.appliedPlatformPromoCode
                    ? isEn
                      ? 'Change'
                      : 'تغيير'
                    : isEn
                      ? 'Redeem'
                      : 'تفعيل'}
                </button>
              </div>
            </div>

            {isSuperAdminEmail(user.email) && (
              <button
                type="button"
                onClick={() => onNavigate('/super-admin')}
                className={`w-full min-h-[44px] py-2.5 px-3 border text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-xs ${ui.radiusClasses.button}`}
                style={getSidebarActionColors(ownerTheme)}
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
                    className="text-xs font-bold px-2"
                    style={{ color: ownerTheme.sidebarMuted }}
                  >
                    {isEn ? card.titleEn : card.titleAr}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-col gap-2">
                    {card.buttonIds.map((bid) => {
                      const item = navMetaMap[bid as OwnerNavTab];
                      if (!item) return null;
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectOwnerTab(item.id)}
                          className={`min-h-[46px] flex items-center justify-between gap-2 px-3 py-2.5 text-[12.5px] sm:text-[13px] font-bold leading-snug text-start transition-all cursor-pointer ${ui.radiusClasses.button}`}
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
                          <span className="flex items-center gap-2 min-w-0 flex-1">
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="lg:hidden whitespace-normal break-words leading-snug">
                              {item.shortLabel}
                            </span>
                            <span className="hidden lg:inline whitespace-normal break-words leading-snug">
                              {item.label}
                            </span>
                          </span>
                          {item.badge !== undefined && (
                            <span
                              className="font-mono-num text-[11px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0"
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

              <button
                type="button"
                onClick={() => handleSelectOwnerTab('user_guide')}
                className={`w-full min-h-[46px] flex items-center justify-start gap-2 px-3 py-2.5 text-[12.5px] sm:text-[13px] font-bold leading-snug text-start transition-all cursor-pointer border ${ui.radiusClasses.button}`}
                style={
                  activeTab === 'user_guide'
                    ? {
                        backgroundColor: ownerTheme.sidebarActiveBg,
                        borderColor: ownerTheme.sidebarActiveBg,
                        color: ownerTheme.sidebarActiveText,
                      }
                    : {
                        backgroundColor: ownerTheme.isDarkShell
                          ? 'rgba(255,255,255,0.04)'
                          : ownerTheme.surfaceSubtleBg,
                        borderColor: ownerTheme.sidebarBorder,
                        color: ownerTheme.sidebarText,
                      }
                }
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span className="whitespace-normal break-words leading-snug">
                  {isEn ? 'User Guide' : 'دليل الاستخدام'}
                </span>
              </button>
            </nav>
          </div>

          <div
            className="p-4 sm:p-5 border-t space-y-2"
            style={{ borderColor: ownerTheme.sidebarBorder }}
          >
            {isSuperAdminEmail(user.email) && (
              <button
                type="button"
                onClick={() => onNavigate('/super-admin')}
                className={`hidden lg:flex w-full min-h-[44px] py-2.5 px-3 border text-xs font-extrabold items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                style={getSidebarActionColors(ownerTheme)}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{t.admin.superAdminBtn}</span>
              </button>
            )}
            <div className="grid grid-cols-2 lg:flex lg:flex-col gap-2">
              <button
                type="button"
                onClick={() => onNavigate(`/menu/${restaurant.slug}?preview=1`)}
                className={`hidden lg:flex w-full min-h-[44px] py-2.5 px-3 border text-xs font-bold items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                style={{ borderColor: ownerTheme.sidebarBorder, color: ownerTheme.sidebarText }}
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span>{t.admin.viewPublicMenu}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/?view=landing')}
                className={`w-full min-h-[44px] py-2.5 px-3 border text-xs font-semibold flex items-center justify-center gap-1.5 leading-snug cursor-pointer ${ui.radiusClasses.button}`}
                style={{ borderColor: ownerTheme.sidebarBorder, color: ownerTheme.sidebarText }}
              >
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-normal break-words text-center">
                  {isEn ? 'Landing Preview' : 'معاينة صفحة الهبوط'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSignOutConfirmOpen(true)}
                className={`w-full min-h-[44px] py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                  ownerTheme.isDarkShell
                    ? 'text-rose-200 hover:bg-rose-500/20 border border-rose-300/30'
                    : 'text-rose-700 hover:bg-rose-50 border border-rose-200'
                } ${ui.radiusClasses.button}`}
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>{t.admin.signOut}</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile Slide-Over Sidebar Drawer (< lg) */}
      {mobileSidebarOpen && (
        <div
          className="print:hidden fixed inset-0 z-50 lg:hidden flex"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <div className="fixed inset-0 bg-black/55 backdrop-blur-xs" />
          <div
            dir={dir}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-[86%] max-w-xs h-full overflow-y-auto shadow-2xl flex flex-col justify-between"
            style={{
              backgroundColor: ownerTheme.sidebarBg,
              color: ownerTheme.sidebarText,
            }}
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2 border-b" style={{ borderColor: ownerTheme.sidebarBorder }}>
                <button
                  type="button"
                  onClick={handleGoOwnerHome}
                  className="text-base font-extrabold cursor-pointer flex items-center gap-1.5"
                  style={{ color: ownerTheme.sidebarText }}
                >
                  <Home className="w-4 h-4 shrink-0" style={{ color: getSidebarHighlightHex(ownerTheme) }} />
                  <span>{t.brandName}</span>
                </button>
                <div className="flex items-center gap-1.5">
                  <LanguageToggleButton variant={ownerTheme.isDarkShell ? 'dark' : 'light'} compact />
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(false)}
                    aria-label={isEn ? 'Close Menu' : 'إغلاق القائمة'}
                    className={`w-10 h-10 border flex items-center justify-center cursor-pointer ${ui.radiusClasses.button}`}
                    style={{ borderColor: ownerTheme.sidebarBorder, color: ownerTheme.sidebarText }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div
                className={`p-3 border space-y-1.5 ${ui.radiusClasses.card}`}
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
                {restaurant.facilityCode && (
                  <div
                    className="pt-1.5 border-t flex items-center justify-between gap-2"
                    style={{ borderColor: ownerTheme.sidebarBorder }}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold truncate" style={{ color: ownerTheme.sidebarMuted }}>
                        {isEn ? facilityActivityMeta.labelEn : facilityActivityMeta.labelAr}
                      </p>
                      <p
                        className="text-xs font-mono-num font-extrabold tracking-wide truncate"
                        dir="ltr"
                        style={{ color: getSidebarHighlightHex(ownerTheme) }}
                      >
                        {restaurant.facilityCode}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopyFacilityCode()}
                      className={`min-h-[30px] px-2 py-1 border text-[10px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer ${ui.radiusClasses.button}`}
                      style={{
                        backgroundColor: ownerTheme.isDarkShell ? 'rgba(255,255,255,0.08)' : ownerTheme.surfaceBg,
                        borderColor: ownerTheme.sidebarBorder,
                        color: ownerTheme.sidebarText,
                      }}
                    >
                      {copiedFacilityCode ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>{isEn ? 'Copied' : 'نُسخ'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>{isEn ? 'Code' : 'الكود'}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {isSuperAdminEmail(user.email) && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    onNavigate('/super-admin');
                  }}
                  className={`w-full min-h-[44px] py-2.5 px-3 border text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-xs ${ui.radiusClasses.button}`}
                  style={getSidebarActionColors(ownerTheme)}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{t.admin.superAdminBtn}</span>
                </button>
              )}

              <nav className="space-y-3">
                {ui.visibleCards.map((card) => (
                  <div
                    key={`mobile_${card.id}`}
                    className={`p-2.5 border space-y-1.5 ${ui.radiusClasses.card}`}
                    style={{
                      backgroundColor: ownerTheme.isDarkShell
                        ? 'rgba(255,255,255,0.035)'
                        : ownerTheme.surfaceSubtleBg,
                      borderColor: ownerTheme.sidebarBorder,
                    }}
                  >
                    <p className="text-xs font-bold px-1.5" style={{ color: ownerTheme.sidebarMuted }}>
                      {isEn ? card.titleEn : card.titleAr}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {card.buttonIds.map((bid) => {
                        const item = navMetaMap[bid as OwnerNavTab];
                        if (!item) return null;
                        const Icon = item.icon;
                        const active = activeTab === item.id;
                        return (
                          <button
                            key={`mob_${item.id}`}
                            type="button"
                            onClick={() => handleSelectOwnerTab(item.id)}
                            className={`min-h-[44px] flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold leading-snug text-start cursor-pointer ${ui.radiusClasses.button}`}
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
                            <span className="flex items-center gap-2 min-w-0 flex-1">
                              <Icon className="w-4 h-4 shrink-0" />
                              <span className="whitespace-normal break-words leading-snug">
                                {item.label}
                              </span>
                            </span>
                            {item.badge !== undefined && (
                              <span
                                className="font-mono-num text-[11px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0"
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

                <button
                  type="button"
                  onClick={() => handleSelectOwnerTab('user_guide')}
                  className={`w-full min-h-[44px] flex items-center justify-start gap-2 px-3 py-2 text-xs font-bold text-start cursor-pointer border ${ui.radiusClasses.button}`}
                  style={
                    activeTab === 'user_guide'
                      ? {
                          backgroundColor: ownerTheme.sidebarActiveBg,
                          borderColor: ownerTheme.sidebarActiveBg,
                          color: ownerTheme.sidebarActiveText,
                        }
                      : {
                          backgroundColor: ownerTheme.isDarkShell
                            ? 'rgba(255,255,255,0.04)'
                            : ownerTheme.surfaceSubtleBg,
                          borderColor: ownerTheme.sidebarBorder,
                          color: ownerTheme.sidebarText,
                        }
                  }
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>{isEn ? 'Smart User Guide' : 'دليل الاستخدام الذكي'}</span>
                </button>
              </nav>
            </div>

            <div className="p-4 border-t space-y-2" style={{ borderColor: ownerTheme.sidebarBorder }}>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    onNavigate(`/menu/${restaurant.slug}?preview=1`);
                  }}
                  className={`min-h-[44px] py-2 px-3 border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                  style={{ borderColor: ownerTheme.sidebarBorder, color: ownerTheme.sidebarText }}
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>{isEn ? 'Menu' : 'المنيو'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    onNavigate('/?view=landing');
                  }}
                  className={`min-h-[44px] py-2 px-3 border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                  style={{ borderColor: ownerTheme.sidebarBorder, color: ownerTheme.sidebarText }}
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span>{isEn ? 'Landing' : 'الهبوط'}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileSidebarOpen(false);
                  setSignOutConfirmOpen(true);
                }}
                className={`w-full min-h-[44px] py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                  ownerTheme.isDarkShell
                    ? 'text-rose-200 hover:bg-rose-500/20 border border-rose-300/30'
                    : 'text-rose-700 hover:bg-rose-50 border border-rose-200'
                } ${ui.radiusClasses.button}`}
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>{t.admin.signOut}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <header
            className="print:hidden sticky top-0 z-30 border-b px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2"
            style={{
              backgroundColor: ownerTheme.headerBg,
              borderColor: ownerTheme.headerBorder,
              color: ownerTheme.headerText,
            }}
          >
          <div className="text-xs flex items-center gap-2 min-w-0 flex-1" style={{ color: ownerTheme.mutedText }}>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label={isEn ? 'Open Menu' : 'فتح القائمة'}
              className={`lg:hidden min-h-[42px] px-3 py-2 border text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 cursor-pointer ${ui.radiusClasses.button}`}
              style={{
                backgroundColor: ownerTheme.accentHex,
                borderColor: ownerTheme.accentHex,
                color: ownerTheme.accentTextHex,
              }}
            >
              <Menu className="w-4 h-4 shrink-0" />
              <span>{isEn ? 'Menu' : 'القائمة'}</span>
            </button>
            <span className="hidden sm:inline shrink-0">{t.admin.workspaceTitle}</span>
            <span className="hidden sm:inline shrink-0">/</span>
            <span className="font-extrabold whitespace-normal break-words leading-snug" style={{ color: ownerTheme.headerText }}>
              {activeTab === 'user_guide'
                ? isEn
                  ? 'User Guide'
                  : 'دليل الاستخدام'
                : navItems.find((n) => n.id === activeTab)?.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            {(tabHistory.length > 0 || activeTab !== ownerDefaultTab) && (
              <button
                type="button"
                onClick={handleBackOwnerTab}
                className={`min-h-[40px] sm:min-h-[38px] flex px-2.5 sm:px-3 py-1.5 border text-xs font-bold items-center gap-1 cursor-pointer whitespace-nowrap ${ui.radiusClasses.button}`}
                style={{ borderColor: ownerTheme.surfaceBorder, color: ownerTheme.headerText }}
              >
                {isRtl ? <ArrowRight className="w-3.5 h-3.5 shrink-0" /> : <ArrowLeft className="w-3.5 h-3.5 shrink-0" />}
                <span>{isEn ? 'Back' : 'رجوع'}</span>
              </button>
            )}
            {activeTab !== ownerDefaultTab && (
              <button
                type="button"
                onClick={handleGoOwnerHome}
                className={`min-h-[40px] sm:min-h-[38px] flex px-2.5 sm:px-3 py-1.5 border text-xs font-bold items-center gap-1 cursor-pointer whitespace-nowrap ${ui.radiusClasses.button}`}
                style={{ borderColor: ownerTheme.surfaceBorder, color: ownerTheme.headerText }}
              >
                <Home className="w-3.5 h-3.5 shrink-0" />
                <span>{t.nav.home}</span>
              </button>
            )}
            <div className="hidden lg:block">
              <LanguageToggleButton />
            </div>
            {isOwnerTopDeck && (
              <button
                type="button"
                onClick={() => handleSelectOwnerTab('user_guide')}
                className={`hidden lg:flex min-h-[38px] px-3 py-1.5 border text-xs font-bold items-center gap-1.5 cursor-pointer whitespace-nowrap ${ui.radiusClasses.button}`}
                style={
                  activeTab === 'user_guide'
                    ? {
                        backgroundColor: ownerTheme.accentHex,
                        borderColor: ownerTheme.accentHex,
                        color: ownerTheme.accentTextHex,
                      }
                    : { borderColor: ownerTheme.surfaceBorder, color: ownerTheme.headerText }
                }
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>{isEn ? 'User Guide' : 'دليل الاستخدام'}</span>
              </button>
            )}
            {isSuperAdminEmail(user.email) && (
              <button
                type="button"
                onClick={() => onNavigate('/super-admin')}
                className={`hidden sm:flex min-h-[38px] px-3 py-1.5 text-xs font-extrabold items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap ${ui.radiusClasses.button}`}
                style={{ backgroundColor: ownerTheme.accentHex, color: ownerTheme.accentTextHex }}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{t.admin.superAdminBtn}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('/?view=landing')}
              className="hidden sm:flex min-h-[38px] px-3 py-1.5 border text-xs font-bold items-center gap-1 cursor-pointer whitespace-nowrap rounded-xl"
              style={{ borderColor: ownerTheme.surfaceBorder, color: ownerTheme.headerText }}
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>{isEn ? 'Landing' : 'صفحة الهبوط'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate(`/menu/${restaurant.slug}?preview=1`)}
              className={`hidden sm:flex min-h-[38px] px-3.5 py-1.5 border text-xs font-bold items-center gap-1.5 cursor-pointer whitespace-nowrap ${ui.radiusClasses.button}`}
              style={{ borderColor: ownerTheme.surfaceBorder, color: ownerTheme.headerText }}
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              <span>{t.admin.themes.previewLink}</span>
            </button>
            {isOwnerTopDeck && (
              <button
                type="button"
                onClick={() => setSignOutConfirmOpen(true)}
                className={`hidden lg:flex min-h-[38px] px-3 py-1.5 border border-rose-200 text-rose-700 text-xs font-bold cursor-pointer whitespace-nowrap ${ui.radiusClasses.button}`}
              >
                {t.admin.signOut}
              </button>
            )}
          </div>
        </header>

        {isOwnerTopDeck && (
          <div className="print:hidden hidden lg:block px-3 sm:px-6 pt-4 max-w-6xl w-full mx-auto">
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
                      const item = navMetaMap[bid as OwnerNavTab];
                      if (!item) return null;
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectOwnerTab(item.id)}
                          className={`min-h-[44px] px-3 py-2 border text-xs sm:text-[13px] font-bold leading-snug text-start flex items-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
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
                          <span className="whitespace-normal break-words">{item.shortLabel}</span>
                          {item.badge !== undefined && (
                            <span className="font-mono-num text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-black/15 shrink-0">
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
                  aria-label={isEn ? 'Close alert' : 'إغلاق التنبيه'}
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
                  aria-label={isEn ? 'Close alert' : 'إغلاق التنبيه'}
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
                  ? `اليوم عيد ميلاد أستاذ ${nearest.customer.fullName}!`
                  : nearest.daysUntil === 1
                    ? `باقي يوم واحد على عيد ميلاد أستاذ ${nearest.customer.fullName}`
                    : nearest.daysUntil === 2
                      ? `باقي يومان على عيد ميلاد أستاذ ${nearest.customer.fullName}`
                      : `باقي ${nearest.daysUntil} أيام على عيد ميلاد أستاذ ${nearest.customer.fullName}`;

              return (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-amber-200/70 text-amber-900 flex items-center justify-center shrink-0">
                      <Cake className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-extrabold">
                        {isEn
                          ? `Customer Birthdays in the Next 3 Days (${upcomingBirthdays.length})`
                          : `أعياد ميلاد عملائك خلال الـ 3 أيام القادمة (${upcomingBirthdays.length})`}
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
                          : 'أرسل عرض عيد الميلاد عبر واتساب'}
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
          {activeTab === 'user_guide' && (
            <UserGuidePage
              roleTitleAr="صاحب المطعم"
              roleTitleEn="Restaurant Owner"
              subtitleAr="دليل سريع يشرح أين تجد كل ميزة في لوحة مطعمك وكيف تصل إليها مباشرة من قائمتك الجانبية."
              subtitleEn="Quick step-by-step guide to every tool visible in your restaurant owner dashboard."
              theme={ownerTheme}
              radiusClasses={ui.radiusClasses}
              entries={ownerGuideEntries}
              onBackHome={handleGoOwnerHome}
            />
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
          {activeTab === 'hall_assignments' && (
            <CaptainAssignmentsTab
              restaurant={restaurant}
              actor={{
                uid: user.uid,
                name: user.displayName || restaurant.name,
                role: 'owner',
              }}
              onBack={() => setActiveTab('captain')}
              onGoHome={handleGoOwnerHome}
            />
          )}
          {activeTab === 'stations' && (
            <StationsManagerTab
              restaurant={restaurant}
              actor={{
                uid: user.uid,
                name: user.displayName || restaurant.name,
                role: 'owner',
              }}
              createIntent={stationCreateIntent}
              onGoHome={handleGoOwnerHome}
              onReturnAfterCreate={() => {
                const ret = stationCreateIntent?.returnTab;
                setStationCreateIntent(null);
                if (ret) setActiveTab(ret);
              }}
              onCancelReturn={() => {
                const ret = stationCreateIntent?.returnTab;
                setStationCreateIntent(null);
                if (ret) setActiveTab(ret);
              }}
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
              onOpenAddScreen={(screenType) => openAddScreenFrom('staff', screenType)}
              onOpenJobTitles={() => setActiveTab('job_titles')}
            />
          )}
          {activeTab === 'job_titles' && (
            <JobTitlesTab
              restaurant={restaurant}
              mode="owner"
              actor={{
                uid: user.uid,
                name: user.displayName || restaurant.name,
                role: 'owner',
              }}
              actorCeiling={{
                isUnbounded: true,
                permissions: OWNER_FULL_PERMISSIONS,
                allowedScreens: [],
                allowedStations: [],
                allowedCaptainScreens: [],
              }}
              onBack={() => setActiveTab('staff')}
              onGoHome={handleGoOwnerHome}
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
          {activeTab === 'menu' && (
            <MenuBuilderTab
              restaurant={restaurant}
              onOpenAddScreen={() => openAddScreenFrom('menu', 'prep')}
            />
          )}
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
          <div
            className={`border p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${ui.radiusClasses.card}`}
            style={{
              backgroundColor: ownerTheme.sidebarBg,
              borderColor: ownerTheme.sidebarBorder,
              color: ownerTheme.sidebarText,
              boxShadow: ownerTheme.cardShadow,
            }}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderColor: ownerTheme.sidebarBorder,
                  color: ownerTheme.highlightHex || '#E8833A',
                }}
              >
                <Layers className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.12)',
                      color: ownerTheme.highlightHex || '#E8833A',
                    }}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Tygos Cloud ERP</span>
                  </span>
                  <span className="text-[11px] font-semibold" style={{ color: ownerTheme.sidebarMuted }}>
                    {isEn ? 'Enterprise Hospitality Suite' : 'منظومة الإدارة السحابية للمطاعم والكافيهات'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold leading-relaxed" style={{ color: ownerTheme.sidebarText }}>
                  {isEn
                    ? 'Want to connect these screens to inventory, recipe costing, integrated POS, and full accounting? Discover the complete Tygos Cloud ERP.'
                    : 'هل تريد ربط هذه الشاشات بالمخازن، التكاليف، نقاط البيع، والحسابات المتكاملة؟ اكتشف منظومة تايجوس (Tygos) السحابية الكاملة'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTygosModalOpen(true)}
              className={`w-full sm:w-auto shrink-0 min-h-[44px] px-4 py-2.5 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-opacity hover:opacity-95 cursor-pointer ${ui.radiusClasses.button}`}
              style={{
                backgroundColor: ownerTheme.highlightHex || '#E8833A',
                color: getReadableTextOnBg(ownerTheme.highlightHex || '#E8833A', '#0E1B3D', '#FFFFFF'),
              }}
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
          className="print:hidden fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setTygosModalOpen(false)}
        >
          <div
            className="rounded-3xl border max-w-lg w-full p-5 sm:p-6 space-y-5 shadow-2xl"
            style={{
              backgroundColor: ownerTheme.surfaceBg,
              borderColor: ownerTheme.surfaceBorder,
              color: ownerTheme.surfaceText,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold"
                  style={{
                    backgroundColor: ownerTheme.sidebarBg,
                    color: ownerTheme.highlightHex || '#E8833A',
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tygos Cloud ERP</span>
                </span>
                <h3 className="text-lg font-extrabold pt-1" style={{ color: ownerTheme.surfaceText }}>
                  {isEn ? 'Full Restaurant Operations & ERP Integration' : 'منظومة تايجوس (Tygos) السحابية الكاملة'}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: ownerTheme.mutedText }}>
                  {isEn
                    ? 'Upgrade from QR ordering & KDS screens to end-to-end financial, inventory, and branch control.'
                    : 'اربط شاشات الصالة والمطبخ والكاشير في سُفرة مباشرة بإدارة التشغيل الكاملة للمطاعم والسلاسل.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTygosModalOpen(false)}
                aria-label={isEn ? 'Close' : 'إغلاق'}
                className="w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer shrink-0"
                style={{
                  backgroundColor: ownerTheme.surfaceSubtleBg,
                  borderColor: ownerTheme.surfaceBorder,
                  color: ownerTheme.mutedText,
                }}
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
                  <div
                    key={mod.title}
                    className="p-3.5 rounded-2xl border space-y-1.5"
                    style={{
                      backgroundColor: ownerTheme.surfaceSubtleBg,
                      borderColor: ownerTheme.surfaceBorder,
                    }}
                  >
                    <div className="flex items-center gap-2 font-extrabold text-xs" style={{ color: ownerTheme.surfaceText }}>
                      <Icon className="w-4 h-4 shrink-0" style={{ color: ownerTheme.highlightHex || '#E8833A' }} />
                      <span>{mod.title}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: ownerTheme.mutedText }}>
                      {mod.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
              <a
                href={tygosWhatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[42px] py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{isEn ? 'Request Tygos Demo via WhatsApp' : 'اطلب عرضاً توضيحياً لـ Tygos عبر واتساب'}</span>
              </a>
              <button
                type="button"
                onClick={() => setTygosModalOpen(false)}
                className="min-h-[42px] py-3 px-4 rounded-xl border text-xs font-bold cursor-pointer"
                style={{
                  backgroundColor: ownerTheme.surfaceSubtleBg,
                  borderColor: ownerTheme.surfaceBorder,
                  color: ownerTheme.surfaceText,
                }}
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
          className="print:hidden fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
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
            className="rounded-3xl border max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl"
            style={{
              backgroundColor: ownerTheme.surfaceBg,
              borderColor: ownerTheme.surfaceBorder,
              color: ownerTheme.surfaceText,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold"
                  style={{
                    backgroundColor: ownerTheme.surfaceSubtleBg,
                    color: ownerTheme.highlightHex || '#E8833A',
                  }}
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Platform SaaS Gift' : 'هدية وكود خصم المنصة'}</span>
                </span>
                <h3 className="text-base font-extrabold pt-1" style={{ color: ownerTheme.surfaceText }}>
                  {isEn ? 'Redeem Subscription Promo Code' : 'تفعيل كود خصم اشتراك سُفرة'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPromoModalOpen(false)}
                aria-label={isEn ? 'Close' : 'إغلاق'}
                className="w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer"
                style={{
                  backgroundColor: ownerTheme.surfaceSubtleBg,
                  borderColor: ownerTheme.surfaceBorder,
                  color: ownerTheme.mutedText,
                }}
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
              <label className="block text-xs font-bold mb-1.5" style={{ color: ownerTheme.surfaceText }}>
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
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono-num font-bold uppercase focus:outline-none"
                style={{
                  backgroundColor: ownerTheme.surfaceSubtleBg,
                  borderColor: ownerTheme.surfaceBorder,
                  color: ownerTheme.surfaceText,
                }}
              />
            </div>

            {promoMsg && <p className="text-xs font-bold text-emerald-700">{promoMsg}</p>}
            {promoError && <p className="text-xs font-bold text-rose-600">{promoError}</p>}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPromoModalOpen(false)}
                className="min-h-[42px] px-4 py-2.5 rounded-xl border text-xs font-bold cursor-pointer"
                style={{
                  backgroundColor: ownerTheme.surfaceSubtleBg,
                  borderColor: ownerTheme.surfaceBorder,
                  color: ownerTheme.surfaceText,
                }}
              >
                {isEn ? 'Close' : 'إغلاق'}
              </button>
              <button
                type="submit"
                disabled={redeemingPromo || promoCodeInput.trim().length < 2}
                className="min-h-[42px] px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: ownerTheme.accentHex,
                  color: ownerTheme.accentTextHex,
                }}
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
