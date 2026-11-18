import { useEffect, useRef, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  BellRing,
  ExternalLink,
  Home,
  LayoutGrid,
  LogOut,
  Palette,
  QrCode,
  ShieldCheck,
  X,
} from 'lucide-react';
import { LanguageToggleButton } from '../components/LanguageToggleButton';
import { LiveOrdersTab } from '../components/admin/LiveOrdersTab';
import { MenuBuilderTab } from '../components/admin/MenuBuilderTab';
import { OnboardingForm } from '../components/admin/OnboardingForm';
import { QrGeneratorTab } from '../components/admin/QrGeneratorTab';
import { ThemeCustomizerTab } from '../components/admin/ThemeCustomizerTab';
import { OwnerAuthCard } from '../components/auth/OwnerAuthCard';
import { useLanguage } from '../contexts/LanguageContext';
import { auth, isSuperAdminEmail } from '../lib/firebase';
import {
  ensureUserProfile,
  fetchOwnerRestaurant,
  subscribeOwnerOrders,
} from '../lib/firestoreService';
import { playOrderAlertChime, unlockAudioContext } from '../lib/sound';
import { Restaurant } from '../types/menu';

interface AdminPortalProps {
  onNavigate: (path: string) => void;
}

type AdminTab = 'orders' | 'menu' | 'theme' | 'qr';

export function AdminPortal({ onNavigate }: AdminPortalProps) {
  const { lang, t, dir, loc } = useLanguage();
  const isEn = lang === 'en';
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [justCreatedBanner, setJustCreatedBanner] = useState(false);

  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [newOrderToast, setNewOrderToast] = useState<string | null>(null);
  const orderInitRef = useRef(false);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unlock = () => unlockAudioContext();
    window.addEventListener('pointerdown', unlock, { once: true });
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
        } catch (err) {
          setAuthError(err instanceof Error ? err.message : t.auth.errGeneric);
        } finally {
          setLoadingRestaurant(false);
        }
      } else {
        setRestaurant(null);
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
      <div dir={dir} className="min-h-screen bg-[#FAFAFA]">
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
              onClick={() => signOut(auth)}
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
      </div>
    );
  }

  const navItems: { id: AdminTab; label: string; shortLabel: string; icon: typeof BellRing; badge?: number }[] = [
    {
      id: 'orders',
      label: t.admin.tabs.orders,
      shortLabel: isEn ? 'Kitchen' : 'المطبخ والطلبات',
      icon: BellRing,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
    },
    {
      id: 'menu',
      label: isEn ? 'Menu, Sections & Photos' : 'الأقسام والصور والأصناف',
      shortLabel: isEn ? 'Menu & Photos' : 'القوائم والصور',
      icon: LayoutGrid,
    },
    {
      id: 'theme',
      label: isEn ? 'Themes, Logo & Info' : 'الثيم واللوجو والإعدادات',
      shortLabel: isEn ? 'Theme & Logo' : 'الثيم واللوجو',
      icon: Palette,
    },
    {
      id: 'qr',
      label: t.admin.tabs.qr,
      shortLabel: isEn ? 'QR Code' : 'كود QR',
      icon: QrCode,
    },
  ];

  return (
    <div dir={dir} className="min-h-screen bg-[#F5F6F8] text-zinc-900 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-68 bg-white border-b lg:border-b-0 lg:border-e border-zinc-200 shrink-0 flex flex-col justify-between">
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
                onClick={() => signOut(auth)}
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
          </div>

          {/* 2-column grid on mobile so ALL 4 dashboard sections are immediately visible without horizontal scrolling */}
          <nav className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-col gap-2">
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
                    if (item.id === 'orders') setNewOrderToast(null);
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
            onClick={() => signOut(auth)}
            className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.admin.signOut}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-zinc-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
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

          {restaurant.isSuspended && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
              {t.menu.suspendedTitle} — {t.menu.suspendedDesc}
            </div>
          )}
          {activeTab === 'orders' && <LiveOrdersTab restaurant={restaurant} />}
          {activeTab === 'menu' && <MenuBuilderTab restaurant={restaurant} />}
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
    </div>
  );
}
