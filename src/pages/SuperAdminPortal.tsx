import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Gift,
  Globe,
  Home,
  LayoutTemplate,
  Loader2,
  LogOut,
  Menu,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  X,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import { LanguageToggleButton } from '../components/LanguageToggleButton';
import { ConfirmSignOutModal } from '../components/ConfirmSignOutModal';
import { UserGuideEntry, UserGuidePage } from '../components/UserGuidePage';
import { OwnerAuthCard } from '../components/auth/OwnerAuthCard';
import { LandingCmsTab } from '../components/superadmin/LandingCmsTab';
import { PlatformPromosTab } from '../components/superadmin/PlatformPromosTab';
import { TenantsManagerTab } from '../components/superadmin/TenantsManagerTab';
import { ThemeInjectorTab } from '../components/superadmin/ThemeInjectorTab';
import { UiStudioTab } from '../components/superadmin/UiStudioTab';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenUi } from '../contexts/PlatformUiContext';
import { auth, isSuperAdminEmail, testConnection } from '../lib/firebase';
import { getSidebarHighlightHex } from '../lib/platformUiDefaults';

interface SuperAdminPortalProps {
  onNavigate: (path: string) => void;
}

type SuperAdminTab =
  | 'tenants'
  | 'promos'
  | 'ui_studio'
  | 'themes'
  | 'landing'
  | 'domain'
  | 'user_guide';
const SUPER_TAB_STORAGE_KEY = 'sufra_superadmin_active_tab';

export function SuperAdminPortal({ onNavigate }: SuperAdminPortalProps) {
  const { lang, t, dir, isRtl } = useLanguage();
  const isEn = lang === 'en';
  const ui = useScreenUi('super_admin');
  const theme = ui.theme;
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [tabHistory, setTabHistory] = useState<SuperAdminTab[]>([]);
  const [activeTab, setActiveTabState] = useState<SuperAdminTab>(() => {
    if (typeof window === 'undefined') return 'tenants';
    const saved = window.sessionStorage.getItem(SUPER_TAB_STORAGE_KEY) as SuperAdminTab | null;
    if (
      saved &&
      ['tenants', 'promos', 'ui_studio', 'themes', 'landing', 'domain', 'user_guide'].includes(saved)
    ) {
      return saved;
    }
    return 'tenants';
  });
  const scrollPageTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      window.requestAnimationFrame(() =>
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      );
    }
  };
  const setActiveTab = (tab: SuperAdminTab, opts?: { pushHistory?: boolean }) => {
    const pushHistory = opts?.pushHistory ?? true;
    if (pushHistory && tab !== activeTab) {
      setTabHistory((prev) => [...prev.slice(-14), activeTab]);
    }
    setActiveTabState(tab);
    setMobileSidebarOpen(false);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SUPER_TAB_STORAGE_KEY, tab);
    }
    scrollPageTop();
  };
  const handleBackSuperTab = () => {
    setMobileSidebarOpen(false);
    if (tabHistory.length > 0) {
      const prevTab = tabHistory[tabHistory.length - 1];
      setTabHistory((prev) => prev.slice(0, -1));
      setActiveTab(prevTab, { pushHistory: false });
    } else if (activeTab !== 'tenants') {
      setActiveTab('tenants', { pushHistory: false });
    }
  };
  const handleGoSuperHome = () => {
    setTabHistory([]);
    setActiveTab('tenants', { pushHistory: false });
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
      <div
        dir={dir}
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: theme.canvasBg, color: theme.canvasText }}
      >
        <div className="text-center space-y-2">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: theme.accentHex, borderTopColor: 'transparent' }}
          />
          <p className="text-sm font-semibold" style={{ color: theme.mutedText }}>
            {t.superAdmin.title}...
          </p>
        </div>
      </div>
    );
  }

  // Gate 1: Require login
  if (!user) {
    return (
      <div
        dir={dir}
        className="min-h-screen flex flex-col justify-between p-6"
        style={{ backgroundColor: theme.canvasBg, color: theme.canvasText }}
      >
        <header className="max-w-5xl w-full mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-xl font-extrabold cursor-pointer flex items-center gap-2 hover:opacity-80"
            style={{ color: theme.canvasText }}
          >
            <span>{t.brandName}</span>
            <span className="text-xs font-bold" style={{ color: theme.highlightHex || '#E8833A' }}>
              · {t.nav.superAdmin}
            </span>
          </button>
          <div className="flex items-center gap-3">
            <LanguageToggleButton />
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className={`min-h-[40px] px-3 py-1.5 border text-xs font-bold flex items-center gap-1 cursor-pointer ${ui.radiusClasses.button}`}
              style={{
                backgroundColor: theme.surfaceBg,
                borderColor: theme.surfaceBorder,
                color: theme.surfaceText,
              }}
            >
              {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
              <span>{t.superAdmin.backToHome}</span>
            </button>
          </div>
        </header>

        <main className="max-w-md w-full mx-auto my-8 space-y-4">
          <div
            className={`p-4 border text-xs font-semibold flex items-center gap-2 ${ui.radiusClasses.card}`}
            style={{
              backgroundColor: theme.surfaceBg,
              borderColor: theme.surfaceBorder,
              color: theme.surfaceText,
            }}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: theme.highlightHex || '#E8833A' }} />
            <span>{t.superAdmin.loginRequiredDesc}</span>
          </div>
          <OwnerAuthCard />
        </main>

        <footer className="text-center text-xs" style={{ color: theme.mutedText }}>
          {t.brandName} · {t.superAdmin.title}
        </footer>
      </div>
    );
  }

  // Gate 2: Strictly enforce tygosibs@gmail.com
  if (!isSuperAdminEmail(user.email)) {
    return (
      <div
        dir={dir}
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: theme.canvasBg, color: theme.canvasText }}
      >
        <div
          className={`max-w-md w-full border p-8 text-center space-y-4 ${ui.radiusClasses.card}`}
          style={{
            backgroundColor: theme.surfaceBg,
            borderColor: theme.surfaceBorder,
            color: theme.surfaceText,
            boxShadow: theme.cardShadow,
          }}
        >
          <div className="flex justify-end">
            <LanguageToggleButton compact />
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold" style={{ color: theme.surfaceText }}>
            {t.superAdmin.accessDeniedTitle}
          </h1>
          <p className="text-xs leading-relaxed" style={{ color: theme.mutedText }}>
            {t.superAdmin.accessDeniedDesc}{' '}
            <span className="font-mono-num font-bold" style={{ color: theme.surfaceText }} dir="ltr">
              ({user.email})
            </span>
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className={`min-h-[42px] px-4 py-2.5 text-xs font-extrabold cursor-pointer ${ui.radiusClasses.button}`}
              style={{ backgroundColor: theme.accentHex, color: theme.accentTextHex }}
            >
              {t.superAdmin.backToOwner}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className={`min-h-[42px] px-4 py-2.5 border text-xs font-bold cursor-pointer ${ui.radiusClasses.button}`}
              style={{
                backgroundColor: theme.surfaceSubtleBg,
                borderColor: theme.surfaceBorder,
                color: theme.surfaceText,
              }}
            >
              {t.superAdmin.backToHome}
            </button>
            <button
              type="button"
              onClick={() => setSignOutConfirmOpen(true)}
              className={`min-h-[42px] px-4 py-2.5 border border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-50 cursor-pointer ${ui.radiusClasses.button}`}
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

  const baseNavMap: Record<
    Exclude<SuperAdminTab, 'user_guide'>,
    { id: Exclude<SuperAdminTab, 'user_guide'>; fallbackLabel: string; icon: typeof Building2 }
  > = {
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
    if (id === 'user_guide') {
      return {
        id: 'user_guide' as SuperAdminTab,
        fallbackLabel: isEn ? 'User Guide' : 'دليل الاستخدام',
        label: isEn ? 'User Guide' : 'دليل الاستخدام',
        icon: BookOpen,
      };
    }
    const meta = baseNavMap[id as Exclude<SuperAdminTab, 'user_guide'>];
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

  const superTabGuides: Record<
    Exclude<SuperAdminTab, 'user_guide'>,
    { stepsAr: string; stepsEn: string; keywordsAr: string; keywordsEn: string }
  > = {
    tenants: {
      stepsAr: 'أنشئ مطعماً جديداً، فعّل أو أوقف الحسابات، وادخل لمعاينة أي مطعم أو منيو عام.',
      stepsEn: 'Create new restaurants, enable or suspend accounts, and preview any restaurant or public menu.',
      keywordsAr: 'مطاعم مشتركين حسابات تفعيل ايقاف تعليق منيو باقة اعياد ميلاد',
      keywordsEn: 'restaurants tenants accounts activate suspend digital menu plans birthdays',
    },
    promos: {
      stepsAr: 'أنشئ أكواد خصم المنصة وحدد نسبة الخصم وعدد الاستخدامات وتابع تفعيلها.',
      stepsEn: 'Create SaaS promo codes, set discount rates and usage limits, and monitor redemptions.',
      keywordsAr: 'اكواد خصم هدايا اشتراك كوبون تفعيل',
      keywordsEn: 'promo codes discounts coupons gifts subscription saas',
    },
    ui_studio: {
      stepsAr: 'خصّص الثيم وتخطيط البطاقات وأسماء الأزرار لكل شاشة ثم انشر التحديث للجميع.',
      stepsEn: 'Customize screen themes, card groups, and button labels, then publish live for all users.',
      keywordsAr: 'استوديو واجهات الوان ثيم بطاقات ازرار تخطيط نشر',
      keywordsEn: 'ui studio themes colors cards buttons layout labels publish',
    },
    themes: {
      stepsAr: 'أدر الثيمات المخصصة وشفرات الألوان المتقدمة على مستوى المنصة.',
      stepsEn: 'Manage custom platform color themes and advanced styling tokens.',
      keywordsAr: 'حقن ثيمات اكواد مخصصة مظهر منيو html css',
      keywordsEn: 'theme injector custom html css js templates styling',
    },
    landing: {
      stepsAr: 'عدّل نصوص صفحة الهبوط الرئيسية، الباقات، الأسعار، وأرقام الدعم الفني.',
      stepsEn: 'Edit landing page headlines, subscription plans, pricing, and support contacts.',
      keywordsAr: 'صفحة الهبوط باقات اسعار واتساب دعم رئيسية',
      keywordsEn: 'landing page cms headlines pricing plans whatsapp support',
    },
    domain: {
      stepsAr: 'افحص اتصال قاعدة بيانات Firestore وانسخ النطاقات المصرح بها في Firebase.',
      stepsEn: 'Test Firestore connectivity and copy authorized domains for Firebase Authentication.',
      keywordsAr: 'دومين نطاق فايربيس قاعدة بيانات اتصال مصادقة',
      keywordsEn: 'domain firebase firestore connection authorized auth vercel',
    },
  };

  const superGuideEntries: UserGuideEntry[] = [];
  for (const card of ui.visibleCards) {
    for (const bid of card.buttonIds) {
      const item = getSuperItem(bid);
      if (!item || item.id === 'user_guide') continue;
      const guide = superTabGuides[item.id];
      const labelAr = ui.getButtonLabel(item.id, 'ar', baseNavMap[item.id].fallbackLabel);
      const labelEn = ui.getButtonLabel(item.id, 'en', baseNavMap[item.id].fallbackLabel);
      superGuideEntries.push({
        id: item.id,
        icon: item.icon,
        titleAr: labelAr,
        titleEn: labelEn,
        pathAr: `المسار من قائمتك: ${card.titleAr} ← ${labelAr}`,
        pathEn: `From your menu: ${card.titleEn} → ${labelEn}`,
        stepsAr: guide.stepsAr,
        stepsEn: guide.stepsEn,
        keywordsAr: `${guide.keywordsAr} ${card.titleAr}`,
        keywordsEn: `${guide.keywordsEn} ${card.titleEn}`,
        onGo: () => setActiveTab(item.id),
      });
    }
  }
  superGuideEntries.push(
    {
      id: 'open_test_restaurant',
      icon: Store,
      titleAr: 'فتح المطعم التجريبي',
      titleEn: 'Open Test Restaurant',
      pathAr: isTopDeck ? 'الشريط العلوي ← المطعم التجريبي' : 'أسفل القائمة الجانبية ← فتح المطعم التجريبي',
      pathEn: isTopDeck ? 'Top bar → Test Restaurant' : 'Sidebar footer → Open Test Restaurant',
      stepsAr: 'انتقل مباشرة إلى لوحة إدارة المطعم لتجربة شاشات المالك والمنيو.',
      stepsEn: 'Jump straight to the Owner dashboard to test restaurant and menu operations.',
      keywordsAr: 'مطعم تجريبي لوحة المالك معاينة كاشير كابتن',
      keywordsEn: 'test restaurant owner dashboard preview cashier captain',
      onGo: () => onNavigate('/admin'),
    },
    {
      id: 'preview_landing',
      icon: Globe,
      titleAr: 'معاينة صفحة الهبوط',
      titleEn: 'Preview Landing Page',
      pathAr: isTopDeck ? 'الشريط العلوي ← معاينة صفحة الهبوط' : 'أسفل القائمة الجانبية ← معاينة صفحة الهبوط',
      pathEn: isTopDeck ? 'Top bar → Landing Preview' : 'Sidebar footer → Preview Landing Page',
      stepsAr: 'افتح الصفحة الرئيسية العامة للمنصة كما يراها الزوار وأصحاب المطاعم.',
      stepsEn: 'Open the public SaaS landing page as seen by visitors and restaurant owners.',
      keywordsAr: 'صفحة الهبوط رئيسية زوار عرض عام',
      keywordsEn: 'landing page public preview home visitors',
      onGo: () => onNavigate('/?view=landing'),
    }
  );

  return (
    <div
      dir={dir}
      className={`min-h-screen flex flex-col ${isTopDeck ? '' : 'lg:flex-row'} overflow-x-clip max-w-full`}
      style={{ backgroundColor: theme.canvasBg, color: theme.canvasText }}
    >
      {/* Desktop Sidebar (collapsed into drawer on mobile) */}
      {!isTopDeck && (
        <aside
          className={`hidden lg:flex ${isCompactRail ? 'lg:w-58' : 'lg:w-72'} shrink-0 flex-col justify-between lg:border-e`}
          style={{
            backgroundColor: theme.sidebarBg,
            borderColor: theme.sidebarBorder,
            color: theme.sidebarText,
          }}
        >
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('tenants')}
                className="text-base sm:text-lg font-extrabold cursor-pointer flex items-center gap-2 min-w-0"
                style={{ color: theme.sidebarText }}
              >
                <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: getSidebarHighlightHex(theme) }} />
                <span className="whitespace-normal break-words leading-snug text-start">{t.nav.superAdmin}</span>
              </button>
              <div className="lg:hidden flex items-center gap-2 shrink-0">
                <LanguageToggleButton variant={theme.isDarkShell ? 'dark' : 'light'} compact />
              </div>
            </div>

            <div
              className={`p-3.5 border space-y-1 ${ui.radiusClasses.card}`}
              style={{
                backgroundColor: theme.isDarkShell ? 'rgba(255,255,255,0.06)' : theme.surfaceSubtleBg,
                borderColor: theme.sidebarBorder,
              }}
            >
              <p className="text-xs font-extrabold" style={{ color: getSidebarHighlightHex(theme) }}>
                {isEn ? 'Super Admin' : 'المدير العام للمنصة'}
              </p>
              <p className="text-xs font-mono-num truncate font-semibold" dir="ltr" style={{ color: theme.sidebarText }}>
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
                    className="text-xs font-bold px-2"
                    style={{ color: theme.sidebarMuted }}
                  >
                    {isEn ? card.titleEn : card.titleAr}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-col gap-2">
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
                          className={`min-h-[46px] flex items-center justify-start gap-2 px-3 py-2.5 text-[12.5px] sm:text-[13px] font-bold leading-snug text-start transition-all cursor-pointer ${ui.radiusClasses.button}`}
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
                          <span className="whitespace-normal break-words leading-snug">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setActiveTab('user_guide')}
                className={`w-full min-h-[46px] flex items-center justify-start gap-2 px-3 py-2.5 text-[12.5px] sm:text-[13px] font-bold leading-snug text-start transition-all cursor-pointer border ${ui.radiusClasses.button}`}
                style={
                  activeTab === 'user_guide'
                    ? {
                        backgroundColor: theme.sidebarActiveBg,
                        borderColor: theme.sidebarActiveBg,
                        color: theme.sidebarActiveText,
                      }
                    : {
                        backgroundColor: theme.isDarkShell
                          ? 'rgba(255,255,255,0.04)'
                          : theme.surfaceSubtleBg,
                        borderColor: theme.sidebarBorder,
                        color: theme.sidebarText,
                      }
                }
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span className="whitespace-normal break-words leading-snug">
                  {isEn ? 'User Guide' : 'دليل الاستخدام'}
                </span>
              </button>
            </nav>

            <div className="grid grid-cols-2 gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className={`min-h-[44px] py-2.5 px-3 border text-xs font-bold leading-snug flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                style={{ borderColor: theme.sidebarBorder, color: theme.sidebarText }}
              >
                <Store className="w-4 h-4 shrink-0" />
                <span className="whitespace-normal break-words text-center">{isEn ? 'Test Restaurant' : 'المطعم التجريبي'}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/?view=landing')}
                className={`min-h-[44px] py-2.5 px-3 border text-xs font-bold leading-snug flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                style={{ borderColor: theme.sidebarBorder, color: theme.sidebarText }}
              >
                <Globe className="w-4 h-4 shrink-0" />
                <span className="whitespace-normal break-words text-center">{isEn ? 'Landing Preview' : 'معاينة الهبوط'}</span>
              </button>
            </div>
            <div className="lg:hidden pt-1">
              <button
                type="button"
                onClick={() => setSignOutConfirmOpen(true)}
                className={`w-full min-h-[44px] py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                  theme.isDarkShell
                    ? 'text-rose-200 hover:bg-rose-500/20 border border-rose-300/30'
                    : 'text-rose-700 hover:bg-rose-50 border border-rose-200'
                } ${ui.radiusClasses.button}`}
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>{t.admin.signOut}</span>
              </button>
            </div>
          </div>

          <div className="hidden lg:block p-5 border-t space-y-2" style={{ borderColor: theme.sidebarBorder }}>
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className={`w-full min-h-[44px] py-2.5 px-3 border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
              style={{ borderColor: theme.sidebarBorder, color: theme.sidebarText }}
            >
              <Store className="w-3.5 h-3.5" />
              <span>{isEn ? 'Open Test Restaurant' : 'فتح المطعم التجريبي'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/?view=landing')}
              className={`w-full min-h-[44px] py-2.5 px-3 border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
              style={{ borderColor: theme.sidebarBorder, color: theme.sidebarText }}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isEn ? 'Preview Landing Page' : 'معاينة صفحة الهبوط'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSignOutConfirmOpen(true)}
              className={`w-full min-h-[44px] py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                theme.isDarkShell
                  ? 'text-rose-200 hover:bg-rose-500/20 border border-rose-300/30'
                  : 'text-rose-700 hover:bg-rose-50 border border-rose-200'
              } ${ui.radiusClasses.button}`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.admin.signOut}</span>
            </button>
          </div>
        </aside>
      )}

      {/* Mobile Slide-Over Sidebar Drawer (< lg) */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <div className="fixed inset-0 bg-black/55 backdrop-blur-xs" />
          <div
            dir={dir}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-[86%] max-w-xs h-full overflow-y-auto shadow-2xl flex flex-col justify-between"
            style={{
              backgroundColor: theme.sidebarBg,
              color: theme.sidebarText,
            }}
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2 border-b" style={{ borderColor: theme.sidebarBorder }}>
                <button
                  type="button"
                  onClick={handleGoSuperHome}
                  className="text-base font-extrabold cursor-pointer flex items-center gap-2 min-w-0"
                  style={{ color: theme.sidebarText }}
                >
                  <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: getSidebarHighlightHex(theme) }} />
                  <span className="truncate">{t.nav.superAdmin}</span>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <LanguageToggleButton variant={theme.isDarkShell ? 'dark' : 'light'} compact />
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(false)}
                    aria-label={isEn ? 'Close Menu' : 'إغلاق القائمة'}
                    className={`w-10 h-10 border flex items-center justify-center cursor-pointer ${ui.radiusClasses.button}`}
                    style={{ borderColor: theme.sidebarBorder, color: theme.sidebarText }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div
                className={`p-3 border space-y-1 ${ui.radiusClasses.card}`}
                style={{
                  backgroundColor: theme.isDarkShell ? 'rgba(255,255,255,0.06)' : theme.surfaceSubtleBg,
                  borderColor: theme.sidebarBorder,
                }}
              >
                <p className="text-xs font-extrabold" style={{ color: getSidebarHighlightHex(theme) }}>
                  {isEn ? 'Super Admin' : 'المدير العام للمنصة'}
                </p>
                <p className="text-xs font-mono-num truncate font-semibold" dir="ltr" style={{ color: theme.sidebarText }}>
                  {user.email}
                </p>
              </div>

              <nav className="space-y-3">
                {ui.visibleCards.map((card) => (
                  <div
                    key={`mob_sup_${card.id}`}
                    className={`p-2.5 border space-y-1.5 ${ui.radiusClasses.card}`}
                    style={{
                      backgroundColor: theme.isDarkShell
                        ? 'rgba(255,255,255,0.035)'
                        : theme.surfaceSubtleBg,
                      borderColor: theme.sidebarBorder,
                    }}
                  >
                    <p className="text-xs font-bold px-1.5" style={{ color: theme.sidebarMuted }}>
                      {isEn ? card.titleEn : card.titleAr}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {card.buttonIds.map((bid) => {
                        const item = getSuperItem(bid);
                        if (!item) return null;
                        const Icon = item.icon;
                        const active = activeTab === item.id;
                        return (
                          <button
                            key={`mobsup_${item.id}`}
                            type="button"
                            onClick={() => setActiveTab(item.id)}
                            className={`min-h-[44px] flex items-center justify-start gap-2 px-3 py-2 text-xs font-bold leading-snug text-start cursor-pointer ${ui.radiusClasses.button}`}
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
                            <span className="whitespace-normal break-words leading-snug">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setActiveTab('user_guide')}
                  className={`w-full min-h-[44px] flex items-center justify-start gap-2 px-3 py-2 text-xs font-bold text-start cursor-pointer border ${ui.radiusClasses.button}`}
                  style={
                    activeTab === 'user_guide'
                      ? {
                          backgroundColor: theme.sidebarActiveBg,
                          borderColor: theme.sidebarActiveBg,
                          color: theme.sidebarActiveText,
                        }
                      : {
                          backgroundColor: theme.isDarkShell
                            ? 'rgba(255,255,255,0.04)'
                            : theme.surfaceSubtleBg,
                          borderColor: theme.sidebarBorder,
                          color: theme.sidebarText,
                        }
                  }
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>{isEn ? 'Smart User Guide' : 'دليل الاستخدام الذكي'}</span>
                </button>
              </nav>
            </div>

            <div className="p-4 border-t space-y-2" style={{ borderColor: theme.sidebarBorder }}>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    onNavigate('/admin');
                  }}
                  className={`min-h-[44px] py-2 px-3 border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                  style={{ borderColor: theme.sidebarBorder, color: theme.sidebarText }}
                >
                  <Store className="w-4 h-4 shrink-0" />
                  <span>{isEn ? 'Test Store' : 'المطعم التجريبي'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    onNavigate('/?view=landing');
                  }}
                  className={`min-h-[44px] py-2 px-3 border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                  style={{ borderColor: theme.sidebarBorder, color: theme.sidebarText }}
                >
                  <Globe className="w-4 h-4 shrink-0" />
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
                  theme.isDarkShell
                    ? 'text-rose-200 hover:bg-rose-500/20 border border-rose-300/30'
                    : 'text-rose-700 hover:bg-rose-50 border border-rose-200'
                } ${ui.radiusClasses.button}`}
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>{t.admin.signOut}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className="sticky top-0 z-30 border-b px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2"
          style={{
            backgroundColor: theme.headerBg,
            borderColor: theme.headerBorder,
            color: theme.headerText,
          }}
        >
          <div className="text-xs flex items-center gap-2 min-w-0 flex-1" style={{ color: theme.mutedText }}>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label={isEn ? 'Open Menu' : 'فتح القائمة'}
              className={`lg:hidden min-h-[42px] px-3 py-2 border text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 cursor-pointer ${ui.radiusClasses.button}`}
              style={{
                backgroundColor: theme.accentHex,
                borderColor: theme.accentHex,
                color: theme.accentTextHex,
              }}
            >
              <Menu className="w-4 h-4 shrink-0" />
              <span>{isEn ? 'Menu' : 'القائمة'}</span>
            </button>
            <button
              type="button"
              onClick={handleGoSuperHome}
              className="hidden sm:inline font-extrabold cursor-pointer whitespace-nowrap shrink-0 hover:opacity-80"
              style={{ color: theme.headerText }}
            >
              {t.brandName}
            </button>
            <span className="hidden sm:inline shrink-0">/</span>
            <span className="hidden sm:inline shrink-0">{t.nav.superAdmin}</span>
            <span className="hidden sm:inline shrink-0">/</span>
            <span className="font-extrabold whitespace-normal break-words leading-snug" style={{ color: theme.headerText }}>
              {getSuperItem(activeTab)?.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            {(tabHistory.length > 0 || activeTab !== 'tenants') && (
              <button
                type="button"
                onClick={handleBackSuperTab}
                className={`min-h-[40px] sm:min-h-[38px] px-2.5 sm:px-3 py-1.5 border text-xs font-bold cursor-pointer flex items-center gap-1 whitespace-nowrap ${ui.radiusClasses.button}`}
                style={{ borderColor: theme.surfaceBorder, color: theme.headerText }}
              >
                {isRtl ? <ArrowRight className="w-3.5 h-3.5 shrink-0" /> : <ArrowLeft className="w-3.5 h-3.5 shrink-0" />}
                <span>{isEn ? 'Back' : 'رجوع'}</span>
              </button>
            )}
            {activeTab !== 'tenants' && (
              <button
                type="button"
                onClick={handleGoSuperHome}
                className={`min-h-[40px] sm:min-h-[38px] px-2.5 sm:px-3 py-1.5 text-xs font-extrabold cursor-pointer flex items-center gap-1 whitespace-nowrap ${ui.radiusClasses.button}`}
                style={{ backgroundColor: theme.accentHex, color: theme.accentTextHex }}
              >
                <Home className="w-3.5 h-3.5 shrink-0" />
                <span>{isEn ? 'Home' : 'الرئيسية'}</span>
              </button>
            )}
            {isTopDeck && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('user_guide')}
                  className={`hidden lg:flex min-h-[38px] px-3 py-1.5 border text-xs font-bold items-center gap-1.5 cursor-pointer whitespace-nowrap ${ui.radiusClasses.button}`}
                  style={
                    activeTab === 'user_guide'
                      ? {
                          backgroundColor: theme.accentHex,
                          borderColor: theme.accentHex,
                          color: theme.accentTextHex,
                        }
                      : {
                          borderColor: theme.surfaceBorder,
                          color: theme.headerText,
                        }
                  }
                >
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>{isEn ? 'User Guide' : 'دليل الاستخدام'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/admin')}
                  className={`hidden lg:flex min-h-[38px] px-3 py-1.5 border text-xs font-bold cursor-pointer whitespace-nowrap ${ui.radiusClasses.button}`}
                  style={{ borderColor: theme.surfaceBorder, color: theme.headerText }}
                >
                  {isEn ? 'Test Restaurant' : 'المطعم التجريبي'}
                </button>
              </>
            )}
            <div className="hidden lg:block">
              <LanguageToggleButton />
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/?view=landing')}
              className={`hidden sm:flex min-h-[38px] px-3 py-1.5 border text-xs font-bold items-center gap-1.5 cursor-pointer whitespace-nowrap ${ui.radiusClasses.button}`}
              style={{ borderColor: theme.surfaceBorder, color: theme.headerText }}
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>{isEn ? 'Landing Preview' : 'معاينة صفحة الهبوط'}</span>
            </button>
            {isTopDeck && (
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

        {/* Top-Deck Mode Card Grid (Desktop Only) */}
        {isTopDeck && (
          <div className="hidden lg:block px-4 sm:px-6 pt-4 max-w-6xl w-full mx-auto">
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
                          className={`min-h-[44px] px-3 py-2 text-xs sm:text-[13px] font-bold leading-snug text-start flex items-center gap-1.5 cursor-pointer border ${ui.radiusClasses.button}`}
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
                          <span className="whitespace-normal break-words">{item.label}</span>
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
          {activeTab === 'user_guide' && (
            <UserGuidePage
              roleTitleAr="السوبر أدمن"
              roleTitleEn="Super Admin"
              subtitleAr="دليل سريع لأهم أقسام لوحة الإدارة العليا المتاحة لك وكيفية الوصول إليها من قائمتك."
              subtitleEn="Quick step-by-step guide to every Super Admin tool visible in your console."
              theme={theme}
              radiusClasses={ui.radiusClasses}
              entries={superGuideEntries}
              onBackHome={() => setActiveTab('tenants')}
            />
          )}
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
              <div
                className={`border p-6 space-y-2 ${ui.radiusClasses.card}`}
                style={{
                  backgroundColor: theme.surfaceBg,
                  borderColor: theme.surfaceBorder,
                  boxShadow: theme.cardShadow,
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold" style={{ color: theme.surfaceText }}>
                      {isEn
                        ? 'Custom Domain & Firebase Production Link Audit'
                        : 'حالة ربط النطاق الخارجي و Firebase'}
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: theme.mutedText }}>
                      {isEn
                        ? 'Verify suofra.vercel.app SPA routing, Firebase Auth domains, and Firestore connectivity.'
                        : 'مراجعة إعدادات النطاق suofra.vercel.app، توجيه الروابط SPA، وصلاحيات تسجيل الدخول وقاعدة البيانات.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={testingConn}
                    onClick={handleTestFirestore}
                    className={`min-h-[42px] px-4 py-2 text-xs font-extrabold flex items-center gap-2 cursor-pointer disabled:opacity-50 ${ui.radiusClasses.button}`}
                    style={{
                      backgroundColor: theme.accentHex,
                      color: theme.accentTextHex,
                    }}
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
                <div
                  className={`border p-5 space-y-3 ${ui.radiusClasses.card}`}
                  style={{
                    backgroundColor: theme.surfaceBg,
                    borderColor: theme.surfaceBorder,
                    boxShadow: theme.cardShadow,
                  }}
                >
                  <h3 className="text-sm font-extrabold" style={{ color: theme.surfaceText }}>
                    {isEn ? 'Firebase Project Binding' : 'بيانات الربط النشطة في Firebase'}
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div
                      className="p-3 rounded-xl border flex items-center justify-between gap-2"
                      style={{ backgroundColor: theme.surfaceSubtleBg, borderColor: theme.surfaceBorder }}
                    >
                      <span className="font-semibold" style={{ color: theme.mutedText }}>
                        {isEn ? 'Project ID' : 'معرّف المشروع'}
                      </span>
                      <span className="font-mono-num font-bold" style={{ color: theme.surfaceText }} dir="ltr">
                        {firebaseConfig.projectId}
                      </span>
                    </div>
                    <div
                      className="p-3 rounded-xl border flex items-center justify-between gap-2"
                      style={{ backgroundColor: theme.surfaceSubtleBg, borderColor: theme.surfaceBorder }}
                    >
                      <span className="font-semibold" style={{ color: theme.mutedText }}>
                        {isEn ? 'Auth Domain' : 'نطاق المصادقة'}
                      </span>
                      <span className="font-mono-num font-bold" style={{ color: theme.surfaceText }} dir="ltr">
                        {firebaseConfig.authDomain}
                      </span>
                    </div>
                    <div
                      className="p-3 rounded-xl border flex items-center justify-between gap-2"
                      style={{ backgroundColor: theme.surfaceSubtleBg, borderColor: theme.surfaceBorder }}
                    >
                      <span className="font-semibold" style={{ color: theme.mutedText }}>
                        {isEn ? 'Firestore DB ID' : 'معرّف قاعدة البيانات'}
                      </span>
                      <span className="font-mono-num font-bold truncate" style={{ color: theme.surfaceText }} dir="ltr">
                        {firebaseConfig.firestoreDatabaseId}
                      </span>
                    </div>
                    <div
                      className="p-3 rounded-xl border flex items-center justify-between gap-2"
                      style={{ backgroundColor: theme.surfaceSubtleBg, borderColor: theme.surfaceBorder }}
                    >
                      <span className="font-semibold" style={{ color: theme.mutedText }}>
                        {isEn ? 'Current Origin' : 'النطاق الحالي'}
                      </span>
                      <span className="font-mono-num font-bold truncate" style={{ color: theme.surfaceText }} dir="ltr">
                        {currentOrigin}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className={`border p-5 space-y-3 ${ui.radiusClasses.card}`}
                  style={{
                    backgroundColor: theme.surfaceBg,
                    borderColor: theme.surfaceBorder,
                    boxShadow: theme.cardShadow,
                  }}
                >
                  <h3 className="text-sm font-extrabold" style={{ color: theme.surfaceText }}>
                    {isEn
                      ? 'Firebase Authorized Domains Checklist'
                      : 'نطاقات تسجيل الدخول المطلوبة في Firebase Console'}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: theme.mutedText }}>
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
                          className="p-3 rounded-xl border flex items-center justify-between gap-3"
                          style={{
                            backgroundColor: theme.surfaceSubtleBg,
                            borderColor: theme.surfaceBorder,
                          }}
                        >
                          <span className="font-mono-num text-xs font-extrabold" style={{ color: theme.surfaceText }} dir="ltr">
                            {domain}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(domain, domain)}
                            className={`min-h-[34px] px-3 py-1 border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${ui.radiusClasses.button}`}
                            style={{
                              backgroundColor: theme.surfaceBg,
                              borderColor: theme.surfaceBorder,
                              color: theme.surfaceText,
                            }}
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
