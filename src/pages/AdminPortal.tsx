import { useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  BellRing,
  ExternalLink,
  LayoutGrid,
  LogOut,
  Palette,
  QrCode,
  ShieldCheck,
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
import { ensureUserProfile, fetchOwnerRestaurant } from '../lib/firestoreService';
import { Restaurant } from '../types/menu';

interface AdminPortalProps {
  onNavigate: (path: string) => void;
}

type AdminTab = 'orders' | 'menu' | 'theme' | 'qr';

export function AdminPortal({ onNavigate }: AdminPortalProps) {
  const { t, dir, loc } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');

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
      <div dir={dir} className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between p-6">
        <header className="max-w-5xl w-full mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-xl font-extrabold text-zinc-950 cursor-pointer"
          >
            {t.brandName}
          </button>
          <div className="flex items-center gap-3">
            <LanguageToggleButton />
            <button
              type="button"
              onClick={() => onNavigate('/menu/buns-lab')}
              className="text-xs font-bold text-zinc-600 hover:text-zinc-950 cursor-pointer"
            >
              {t.landing.openDemoMenu}
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
        <header className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-lg font-extrabold text-zinc-950 cursor-pointer"
          >
            {t.brandName}
          </button>
          <div className="flex items-center gap-3">
            <LanguageToggleButton />
            {isSuperAdminEmail(user.email) && (
              <button
                type="button"
                onClick={() => onNavigate('/super-admin')}
                className="px-3.5 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold hover:bg-amber-400 flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{t.admin.superAdminBtn}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="text-xs font-bold text-zinc-600 hover:text-zinc-950 flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.admin.signOut}</span>
            </button>
          </div>
        </header>

        <OnboardingForm
          ownerId={user.uid}
          ownerDisplayName={user.displayName || user.email || 'Owner'}
          onCreated={(created) => setRestaurant(created)}
        />
      </div>
    );
  }

  const navItems: { id: AdminTab; label: string; icon: typeof BellRing }[] = [
    { id: 'orders', label: t.admin.tabs.orders, icon: BellRing },
    { id: 'menu', label: t.admin.tabs.menu, icon: LayoutGrid },
    { id: 'theme', label: t.admin.tabs.themes, icon: Palette },
    { id: 'qr', label: t.admin.tabs.qr, icon: QrCode },
  ];

  return (
    <div dir={dir} className="min-h-screen bg-[#F5F6F8] text-zinc-900 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-64 bg-white border-b lg:border-b-0 lg:border-e border-zinc-200 shrink-0 flex flex-col justify-between">
        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-lg font-extrabold text-zinc-950 cursor-pointer"
            >
              {t.brandName}
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <LanguageToggleButton compact />
              <button
                type="button"
                onClick={() => signOut(auth)}
                aria-label={t.admin.signOut}
                className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
            <p className="text-xs font-bold text-zinc-950 truncate">
              {loc(restaurant.name, restaurant.name_en)}
            </p>
            <p className="text-[11px] font-mono-num text-zinc-500 truncate" dir="ltr">
              /menu/{restaurant.slug}
            </p>
          </div>

          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-zinc-950 text-white'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:block p-5 border-t border-zinc-200 space-y-2.5">
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
            onClick={() => onNavigate(`/menu/${restaurant.slug}`)}
            className="w-full py-2.5 px-3 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-800 hover:bg-zinc-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{t.admin.viewPublicMenu}</span>
          </button>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-zinc-500 hover:text-red-600 hover:bg-red-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.admin.signOut}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-zinc-200 px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="text-xs text-zinc-500 flex items-center gap-2">
            <span>{t.admin.workspaceTitle}</span>
            <span>/</span>
            <span className="font-bold text-zinc-900">
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
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
              onClick={() => onNavigate(`/menu/${restaurant.slug}`)}
              className="px-3.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-800 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t.admin.themes.previewLink}</span>
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-4">
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
