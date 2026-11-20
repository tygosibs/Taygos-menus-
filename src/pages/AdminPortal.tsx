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
import { QrGeneratorTab } from '../components/admin/QrGeneratorTab';
import { StaffManagementTab } from '../components/admin/StaffManagementTab';
import { ThemeCustomizerTab } from '../components/admin/ThemeCustomizerTab';
import { OwnerAuthCard } from '../components/auth/OwnerAuthCard';
import { useLanguage } from '../contexts/LanguageContext';
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

type AdminTab = 'orders' | 'captain' | 'staff' | 'customers' | 'menu' | 'offers' | 'theme' | 'qr';

export function AdminPortal({ onNavigate }: AdminPortalProps) {
  const { lang, t, dir, loc } = useLanguage();
  const isEn = lang === 'en';
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [staffPortalSlug, setStaffPortalSlug] = useState<string | null>(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
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
          <OwnerAuthCard />
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
              onClick={() => onNavigate('/')}
              aria-label={t.nav.home}
              className="w-9 h-9 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {staffPortalSlug && (
          <div className="max-w-3xl mx-auto mt-6 px-4">
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-indigo-950">
                  {isEn ? 'You are signed in with a Staff Account' : 'أنت مسجّل الآن بحساب كادر / مدير مطعم'}
                </p>
                <p className="text-xs text-indigo-800">
                  {isEn
                    ? 'Open your dedicated Staff Portal to access your assigned screens.'
                    : 'لوحة المالك مخصصة لمالكي المطاعم. افتح بوابة الكادر المخصصة للدخول مباشرة إلى شاشات عملك.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(`/staff/${staffPortalSlug}`)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isEn ? 'Open Staff Portal' : 'الانتقال لبوابة الكادر'}
              </button>
            </div>
          </div>
        )}

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

  const navItems: { id: AdminTab; label: string; shortLabel: string; icon: typeof BellRing; badge?: number }[] = [
    {
      id: 'orders',
      label: isEn ? 'Cashier & Multi-KDS' : 'شاشات الكاشير والمطبخ',
      shortLabel: isEn ? 'Cashier & KDS' : 'الكاشير والمطبخ',
      icon: BellRing,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
    },
    {
      id: 'captain',
      label: isEn ? 'Captain / Waiter Screen' : 'شاشة الكابتن (الويتر)',
      shortLabel: isEn ? 'Captain Screen' : 'شاشة الكابتن',
      icon: UserCheck,
      badge: pendingCallsCount > 0 ? pendingCallsCount : undefined,
    },
    {
      id: 'staff',
      label: isEn ? 'Manager & Staff RBAC' : 'المدير والكادر والصلاحيات',
      shortLabel: isEn ? 'Staff & Roles' : 'الكادر والصلاحيات',
      icon: ShieldCheck,
    },
    {
      id: 'customers',
      label: isEn ? 'Customers (Smart CRM)' : 'عملائي (CRM والتسويق الذكي)',
      shortLabel: isEn ? 'Customers CRM' : 'عملائي CRM',
      icon: Users,
      badge: upcomingBirthdays.length > 0 ? upcomingBirthdays.length : undefined,
    },
    {
      id: 'menu',
      label: isEn ? 'Menu, Sections & Photos' : 'الأقسام والصور والأصناف',
      shortLabel: isEn ? 'Menu & Photos' : 'القوائم والصور',
      icon: LayoutGrid,
    },
    {
      id: 'offers',
      label: t.admin.tabs.offers,
      shortLabel: isEn ? 'Offers & Codes' : 'العروض والأكواد',
      icon: Tag,
    },
    {
      id: 'theme',
      label: isEn ? 'Themes, Logo & Info' : 'الثيم واللوجو والإعدادات',
      shortLabel: isEn ? 'Theme & Logo' : 'الثيم واللوجو',
      icon: Palette,
    },
    {
      id: 'qr',
      label: isEn ? 'Halls & Table QRs' : 'الصالات وأكواد QR',
      shortLabel: isEn ? 'Halls & QR' : 'الصالات و QR',
      icon: QrCode,
    },
  ];

  const cleanWhatsappDigits = (supportWhatsapp || '').replace(/[^\d]/g, '') || '201000000000';
  const tygosInquiryText = encodeURIComponent(
    isEn
      ? `Hello, I'm using Sufra QR for "${restaurant.name}" and would like to learn about connecting Tygos Cloud ERP (Inventory, Costing, POS, Accounting).`
      : `مرحباً، أستخدم منصة سُفرة لمطعم "${restaurant.name}" وأرغب في معرفة تفاصيل ربط منظومة تايجوس (Tygos) السحابية الكاملة للمخازن والتكاليف ونقاط البيع والحسابات.`
  );
  const tygosWhatsappHref = `https://wa.me/${cleanWhatsappDigits}?text=${tygosInquiryText}`;

  return (
    <div dir={dir} className="min-h-screen bg-[#F5F6F8] text-zinc-900 flex flex-col lg:flex-row overflow-x-clip max-w-full">
      {/* Sidebar */}
      <aside className="print:hidden lg:w-68 bg-white border-b lg:border-b-0 lg:border-e border-zinc-200 shrink-0 flex flex-col justify-between">
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              title={t.nav.home}
              className="text-base sm:text-lg font-extrabold text-zinc-950 cursor-pointer flex items-center gap-1.5 hover:opacity-80"
            >
              <Home className="w-4 h-4 text-zinc-500" />
              <span>{t.brandName}</span>
            </button>
            <div className="lg:hidden flex items-center gap-1.5">
              <LanguageToggleButton compact />
              <button
                type="button"
                onClick={() => onNavigate(`/menu/${restaurant.slug}?preview=1`)}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-800 hover:bg-zinc-50 flex items-center gap-1 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{isEn ? 'Menu' : 'المنيو'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSignOutConfirmOpen(true)}
                aria-label={t.admin.signOut}
                className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50/70 text-red-700 hover:bg-red-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isEn ? 'Exit' : 'خروج'}</span>
              </button>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-zinc-950 truncate">
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
            <p className="text-[11px] font-mono-num text-zinc-500 truncate" dir="ltr">
              /menu/{restaurant.slug}
            </p>
            <div className="pt-1.5 border-t border-zinc-200/80 flex items-center justify-between gap-2">
              {restaurant.appliedPlatformPromoCode ? (
                <span className="text-[11px] font-bold text-emerald-700 truncate flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono-num" dir="ltr">
                    {restaurant.appliedPlatformPromoCode}
                  </span>
                </span>
              ) : (
                <span className="text-[11px] text-zinc-500 truncate">
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
                className="text-[11px] font-extrabold text-amber-700 hover:text-amber-900 underline underline-offset-2 shrink-0 cursor-pointer"
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

          {/* 2-column mobile / 3-column tablet grid so ALL 6 dashboard sections fit cleanly without horizontal overflow */}
          <nav className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    unlockAudioContext();
                    setActiveTab(item.id);
                    if (item.id === 'orders') {
                      setNewOrderToast(null);
                    }
                    if (item.id === 'captain') {
                      setNewCallToast(null);
                    }
                  }}
                  className={`min-h-[44px] flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    active
                      ? 'bg-zinc-950 text-white shadow-xs'
                      : 'bg-zinc-50 lg:bg-transparent border border-zinc-200 lg:border-0 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate lg:hidden">{item.shortLabel}</span>
                    <span className="hidden lg:inline truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span className="font-mono-num text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-500 text-zinc-950 shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:block p-5 border-t border-zinc-200 space-y-2">
          {isSuperAdminEmail(user.email) && (
            <button
              type="button"
              onClick={() => onNavigate('/super-admin')}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-500 text-zinc-950 text-xs font-extrabold hover:bg-amber-400 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{t.admin.superAdminBtn}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate(`/menu/${restaurant.slug}?preview=1`)}
            className="w-full py-2.5 px-3 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-800 hover:bg-zinc-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{t.admin.viewPublicMenu}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="w-full py-2 px-3 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>{t.nav.home}</span>
          </button>
          <button
            type="button"
            onClick={() => setSignOutConfirmOpen(true)}
            className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.admin.signOut}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <header className="print:hidden bg-white border-b border-zinc-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-zinc-500 flex items-center gap-2 min-w-0">
            <span className="hidden sm:inline">{t.admin.workspaceTitle}</span>
            <span className="hidden sm:inline">/</span>
            <span className="font-bold text-zinc-900 truncate">
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden lg:block">
              <LanguageToggleButton />
            </div>
            {isSuperAdminEmail(user.email) && (
              <button
                type="button"
                onClick={() => onNavigate('/super-admin')}
                className="lg:hidden px-3 py-1.5 rounded-lg bg-amber-500 text-zinc-950 text-xs font-bold hover:bg-amber-400 flex items-center gap-1 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t.admin.superAdminBtn}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="lg:hidden px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>{t.nav.home}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate(`/menu/${restaurant.slug}?preview=1`)}
              className="hidden sm:flex px-3.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-800 hover:bg-zinc-50 items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t.admin.themes.previewLink}</span>
            </button>
          </div>
        </header>

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
