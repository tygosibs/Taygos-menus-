import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Gift,
  Globe,
  LayoutTemplate,
  Loader2,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import { LanguageToggleButton } from '../components/LanguageToggleButton';
import { ConfirmSignOutModal } from '../components/ConfirmSignOutModal';
import { OwnerAuthCard } from '../components/auth/OwnerAuthCard';
import { LandingCmsTab } from '../components/superadmin/LandingCmsTab';
import { PlatformPromosTab } from '../components/superadmin/PlatformPromosTab';
import { TenantsManagerTab } from '../components/superadmin/TenantsManagerTab';
import { ThemeInjectorTab } from '../components/superadmin/ThemeInjectorTab';
import { UiStudioTab } from '../components/superadmin/UiStudioTab';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenUi } from '../contexts/PlatformUiContext';
import { auth, isSuperAdminEmail, testConnection } from '../lib/firebase';

interface SuperAdminPortalProps {
  onNavigate: (path: string) => void;
}

type SuperAdminTab = 'tenants' | 'promos' | 'ui_studio' | 'themes' | 'landing' | 'domain';
const SUPER_TAB_STORAGE_KEY = 'sufra_superadmin_active_tab';

export function SuperAdminPortal({ onNavigate }: SuperAdminPortalProps) {
  const { lang, t, dir, isRtl } = useLanguage();
  const isEn = lang === 'en';
  const ui = useScreenUi('super_admin');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTabState] = useState<SuperAdminTab>(() => {
    if (typeof window === 'undefined') return 'tenants';
    const saved = window.sessionStorage.getItem(SUPER_TAB_STORAGE_KEY) as SuperAdminTab | null;
    if (
      saved &&
      ['tenants', 'promos', 'ui_studio', 'themes', 'landing', 'domain'].includes(saved)
    ) {
      return saved;
    }
    return 'tenants';
  });
  const setActiveTab = (tab: SuperAdminTab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SUPER_TAB_STORAGE_KEY, tab);
    }
  };
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<'idle' | 'ok' | 'error'>('idle');
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const handleCopyText = async (val: string, key: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Clipboard may be restricted in non-HTTPS contexts
    }
  };

  const handleTestFirestore = async () => {
    setTestingConn(true);
    setConnResult('idle');
    try {
      await testConnection();
      setConnResult('ok');
    } catch {
      setConnResult('error');
    } finally {
      setTestingConn(false);
    }
  };

  if (!authReady) {
    return (
      <div dir={dir} className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-zinc-600">{t.superAdmin.title}...</p>
        </div>
      </div>
    );
  }

  // Gate 1: Require login
  if (!user) {
    return (
      <div dir={dir} className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between p-6">
        <header className="max-w-5xl w-full mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-xl font-extrabold text-zinc-950 cursor-pointer flex items-center gap-2"
          >
            <span>{t.brandName}</span>
            <span className="text-xs font-bold text-amber-700">· {t.nav.superAdmin}</span>
          </button>
          <div className="flex items-center gap-3">
            <LanguageToggleButton />
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-xs font-bold text-zinc-600 hover:text-zinc-950 flex items-center gap-1 cursor-pointer"
            >
              {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
              <span>{t.superAdmin.backToHome}</span>
            </button>
          </div>
        </header>

        <main className="max-w-md w-full mx-auto my-8 space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{t.superAdmin.loginRequiredDesc}</span>
          </div>
          <OwnerAuthCard />
        </main>

        <footer className="text-center text-xs text-zinc-400">
          {t.brandName} · {t.superAdmin.title}
        </footer>
      </div>
    );
  }

  // Gate 2: Strictly enforce tygosibs@gmail.com
  if (!isSuperAdminEmail(user.email)) {
    return (
      <div dir={dir} className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <div className="flex justify-end">
            <LanguageToggleButton compact />
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-zinc-950">{t.superAdmin.accessDeniedTitle}</h1>
          <p className="text-xs text-zinc-600 leading-relaxed">
            {t.superAdmin.accessDeniedDesc}{' '}
            <span className="font-mono-num font-bold text-zinc-900" dir="ltr">
              ({user.email})
            </span>
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="px-4 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 cursor-pointer"
            >
              {t.superAdmin.backToOwner}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              {t.superAdmin.backToHome}
            </button>
            <button
              type="button"
              onClick={() => setSignOutConfirmOpen(true)}
              className="px-4 py-2.5 rounded-xl border border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-50 cursor-pointer"
            >
              {t.admin.signOut}
            </button>
          </div>
        </div>
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

  const baseNavMap: Record<SuperAdminTab, { id: SuperAdminTab; fallbackLabel: string; icon: typeof Building2 }> = {
    tenants: { id: 'tenants', fallbackLabel: t.superAdmin.tabs.tenants, icon: Building2 },
    promos: {
      id: 'promos',
      fallbackLabel: isEn ? 'SaaS Promo Codes' : 'أكواد الخصم والهدايا',
      icon: Gift,
    },
    ui_studio: {
      id: 'ui_studio',
      fallbackLabel: isEn ? 'UI Studio & Themes' : 'استوديو الواجهات والثيمات',
      icon: Sparkles,
    },
    themes: { id: 'themes', fallbackLabel: t.superAdmin.tabs.themeInjector, icon: Code2 },
    landing: { id: 'landing', fallbackLabel: t.superAdmin.tabs.cms, icon: LayoutTemplate },
    domain: {
      id: 'domain',
      fallbackLabel: isEn ? 'Domain & Firebase' : 'النطاق وربط Firebase',
      icon: Globe,
    },
  };

  const getSuperItem = (id: string) => {
    const meta = baseNavMap[id as SuperAdminTab];
    if (!meta) return null;
    return {
      ...meta,
      label: ui.getButtonLabel(id, lang, meta.fallbackLabel),
    };
  };

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'suofra.vercel.app';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://suofra.vercel.app';
  const isTopDeck = ui.screenConfig.layoutStyle === 'top_deck';
  const isCompactRail = ui.screenConfig.layoutStyle === 'compact_rail';
  const theme = ui.theme;

  return (
    <div
      dir={dir}
      className={`min-h-screen flex flex-col ${isTopDeck ? '' : 'lg:flex-row'} overflow-x-clip max-w-full`}
      style={{ backgroundColor: theme.canvasBg, color: theme.canvasText }}
    >
      {/* Sidebar (or compact rail) */}
      {!isTopDeck && (
        <aside
          className={`${isCompactRail ? 'lg:w-58' : 'lg:w-72'} shrink-0 flex flex-col justify-between border-b lg:border-b-0 lg:border-e`}
          style={{
            backgroundColor: theme.sidebarBg,
            borderColor: theme.sidebarBorder,
            color: theme.sidebarText,
          }}
        >
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => onNavigate('/')}
                className="text-lg font-extrabold cursor-pointer flex items-center gap-2"
                style={{ color: theme.sidebarText }}
              >
                <ShieldCheck className="w-5 h-5" style={{ color: theme.accentHex }} />
                <span>{t.nav.superAdmin}</span>
              </button>
              <div className="lg:hidden flex items-center gap-2">
                <LanguageToggleButton variant={theme.isDarkShell ? 'dark' : 'light'} compact />
                <button
                  type="button"
                  onClick={() => setSignOutConfirmOpen(true)}
                  aria-label={t.admin.signOut}
                  className="p-2 rounded-lg opacity-80 hover:opacity-100 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              className={`p-3.5 border space-y-1 ${ui.radiusClasses.card}`}
              style={{
                backgroundColor: theme.isDarkShell ? 'rgba(255,255,255,0.05)' : theme.surfaceSubtleBg,
                borderColor: theme.sidebarBorder,
              }}
            >
              <p className="text-[11px] font-bold" style={{ color: theme.accentHex }}>
                Super Admin
              </p>
              <p className="text-xs font-mono-num truncate" dir="ltr" style={{ color: theme.sidebarText }}>
                {user.email}
              </p>
            </div>

            <nav className="space-y-3">
              {ui.visibleCards.map((card) => (
                <div
                  key={card.id}
                  className={
                    ui.screenConfig.layoutStyle === 'sidebar_cards'
                      ? `p-2.5 border space-y-1.5 ${ui.radiusClasses.card}`
                      : 'space-y-1'
                  }
                  style={
                    ui.screenConfig.layoutStyle === 'sidebar_cards'
                      ? {
                          backgroundColor: theme.isDarkShell
                            ? 'rgba(255,255,255,0.035)'
                            : theme.surfaceSubtleBg,
                          borderColor: theme.sidebarBorder,
                        }
                      : undefined
                  }
                >
                  <p
                    className="text-[10px] font-extrabold uppercase tracking-wider px-2"
                    style={{ color: theme.sidebarMuted }}
                  >
                    {isEn ? card.titleEn : card.titleAr}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-col gap-1">
                    {card.buttonIds.map((bid) => {
                      const item = getSuperItem(bid);
                      if (!item) return null;
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          className={`flex items-center justify-center lg:justify-start gap-2 px-3 py-2.5 text-xs font-bold transition-all cursor-pointer min-h-[40px] ${ui.radiusClasses.button}`}
                          style={
                            active
                              ? {
                                  backgroundColor: theme.sidebarActiveBg,
                                  color: theme.sidebarActiveText,
                                }
                              : {
                                  color: theme.sidebarText,
                                }
                          }
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="grid grid-cols-2 gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className={`py-2 px-3 border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                style={{ borderColor: theme.sidebarBorder, color: theme.sidebarText }}
              >
                <Store className="w-3.5 h-3.5" />
                <span className="truncate">{t.superAdmin.backToOwner}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/')}
                className={`py-2 px-3 border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                style={{ borderColor: theme.sidebarBorder, color: theme.sidebarText }}
              >
                {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                <span className="truncate">{t.superAdmin.backToHome}</span>
              </button>
            </div>
          </div>

          <div className="hidden lg:block p-5 border-t space-y-2" style={{ borderColor: theme.sidebarBorder }}>
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className={`w-full py-2.5 px-3 border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
              style={{ borderColor: theme.sidebarBorder, color: theme.sidebarText }}
            >
              <Store className="w-3.5 h-3.5" />
              <span>{t.superAdmin.backToOwner}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className={`w-full py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer opacity-80 hover:opacity-100 ${ui.radiusClasses.button}`}
              style={{ color: theme.sidebarText }}
            >
              {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
              <span>{t.superAdmin.backToHome}</span>
            </button>
            <button
              type="button"
              onClick={() => setSignOutConfirmOpen(true)}
              className={`w-full py-2 px-3 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.admin.signOut}</span>
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className="border-b px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3"
          style={{
            backgroundColor: theme.headerBg,
            borderColor: theme.headerBorder,
            color: theme.headerText,
          }}
        >
          <div className="text-xs flex items-center gap-2 min-w-0 truncate" style={{ color: theme.mutedText }}>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="font-semibold cursor-pointer shrink-0 hover:opacity-80"
              style={{ color: theme.headerText }}
            >
              {t.brandName}
            </button>
            <span>/</span>
            <span className="hidden sm:inline">{t.nav.superAdmin}</span>
            <span className="hidden sm:inline">/</span>
            <span className="font-bold truncate" style={{ color: theme.headerText }}>
              {getSuperItem(activeTab)?.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isTopDeck && (
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className={`px-3 py-1.5 border text-xs font-bold cursor-pointer ${ui.radiusClasses.button}`}
                style={{ borderColor: theme.surfaceBorder, color: theme.headerText }}
              >
                {t.superAdmin.backToOwner}
              </button>
            )}
            <div className={isTopDeck ? 'block' : 'hidden lg:block'}>
              <LanguageToggleButton />
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className={`px-3.5 py-1.5 border text-xs font-bold cursor-pointer ${ui.radiusClasses.button}`}
              style={{ borderColor: theme.surfaceBorder, color: theme.headerText }}
            >
              {t.superAdmin.backToHome}
            </button>
            {isTopDeck && (
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

        {/* Top-Deck Mode Card Grid */}
        {isTopDeck && (
          <div className="px-4 sm:px-6 pt-4 max-w-6xl w-full mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ui.visibleCards.map((card) => (
                <div
                  key={card.id}
                  className={`p-3 border space-y-2 ${ui.radiusClasses.card}`}
                  style={{
                    backgroundColor: theme.surfaceBg,
                    borderColor: theme.surfaceBorder,
                    boxShadow: theme.cardShadow,
                  }}
                >
                  <p className="text-[11px] font-extrabold" style={{ color: theme.mutedText }}>
                    {isEn ? card.titleEn : card.titleAr}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {card.buttonIds.map((bid) => {
                      const item = getSuperItem(bid);
                      if (!item) return null;
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${ui.radiusClasses.button}`}
                          style={
                            active
                              ? {
                                  backgroundColor: theme.accentHex,
                                  borderColor: theme.accentHex,
                                  color: theme.accentTextHex,
                                }
                              : {
                                  backgroundColor: theme.surfaceSubtleBg,
                                  borderColor: theme.surfaceBorder,
                                  color: theme.surfaceText,
                                }
                          }
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <main className="p-4 sm:p-6 max-w-6xl w-full mx-auto">
          {activeTab === 'tenants' && (
            <TenantsManagerTab onOpenPublicMenu={(path) => onNavigate(path)} />
          )}
          {activeTab === 'promos' && <PlatformPromosTab />}
          {activeTab === 'ui_studio' && (
            <UiStudioTab adminEmail={user.email || 'tygosibs@gmail.com'} />
          )}
          {activeTab === 'themes' && <ThemeInjectorTab />}
          {activeTab === 'landing' && <LandingCmsTab />}
          {activeTab === 'domain' && (
            <div className="space-y-6">
              <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-zinc-950">
                      {isEn
                        ? 'Custom Domain & Firebase Production Link Audit'
                        : 'حالة ربط النطاق الخارجي و Firebase'}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {isEn
                        ? 'Verify suofra.vercel.app SPA routing, Firebase Auth domains, and Firestore connectivity.'
                        : 'مراجعة إعدادات النطاق suofra.vercel.app، توجيه الروابط SPA، وصلاحيات تسجيل الدخول وقاعدة البيانات.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={testingConn}
                    onClick={handleTestFirestore}
                    className="px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {testingConn && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isEn ? 'Test Firestore Connection' : 'فحص الاتصال بـ Firestore'}</span>
                  </button>
                </div>

                {connResult === 'ok' && (
                  <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 pt-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isEn
                        ? 'Firestore database connection verified successfully.'
                        : 'تم الاتصال بقاعدة بيانات Firestore بنجاح.'}
                    </span>
                  </p>
                )}
                {connResult === 'error' && (
                  <p className="text-xs font-bold text-rose-700 pt-2">
                    {isEn
                      ? 'Could not reach Firestore. Check network or Firebase config.'
                      : 'تعذر الوصول إلى Firestore. تأكد من الاتصال أو الإعدادات.'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-extrabold text-zinc-950">
                    {isEn ? 'Firebase Project Binding' : 'بيانات الربط النشطة في Firebase'}
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-2">
                      <span className="text-zinc-500 font-semibold">Project ID</span>
                      <span className="font-mono-num font-bold text-zinc-900" dir="ltr">
                        {firebaseConfig.projectId}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-2">
                      <span className="text-zinc-500 font-semibold">Auth Domain</span>
                      <span className="font-mono-num font-bold text-zinc-900" dir="ltr">
                        {firebaseConfig.authDomain}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-2">
                      <span className="text-zinc-500 font-semibold">Firestore DB ID</span>
                      <span className="font-mono-num font-bold text-zinc-900 truncate" dir="ltr">
                        {firebaseConfig.firestoreDatabaseId}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-2">
                      <span className="text-zinc-500 font-semibold">Current Origin</span>
                      <span className="font-mono-num font-bold text-zinc-900 truncate" dir="ltr">
                        {currentOrigin}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-extrabold text-zinc-950">
                    {isEn
                      ? 'Firebase Authorized Domains Checklist'
                      : 'نطاقات تسجيل الدخول المطلوبة في Firebase Console'}
                  </h3>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    {isEn
                      ? 'Ensure the domains below are listed under Firebase Console → Authentication → Settings → Authorized domains so Google & Email Auth work seamlessly on production:'
                      : 'لضمان عمل تسجيل الدخول عبر Google والحسابات الجديدة على موقعك المباشر بدون أخطاء، تأكد من وجود هذه النطاقات في Firebase Console ← Authentication ← Settings ← Authorized domains:'}
                  </p>

                  <div className="space-y-2">
                    {['suofra.vercel.app', currentHost]
                      .filter((v, idx, arr) => v && arr.indexOf(v) === idx)
                      .map((domain) => (
                        <div
                          key={domain}
                          className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between gap-3"
                        >
                          <span className="font-mono-num text-xs font-extrabold text-amber-950" dir="ltr">
                            {domain}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(domain, domain)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-[11px] font-bold text-amber-900 hover:bg-amber-100 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey === domain ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>{isEn ? 'Copied' : 'تم النسخ'}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>{isEn ? 'Copy' : 'نسخ'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed">
                    {isEn
                      ? 'Vercel SPA rewrites (/admin, /super-admin, /menu/:slug) and Cross-Origin-Opener-Policy popup headers are pre-configured in vercel.json.'
                      : 'ملف vercel.json مُعد مسبقاً لدعم فتح جميع الروابط مباشرة (/admin و /super-admin و /menu/:slug) والسماح بنوافذ تسجيل دخول Google.'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
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
