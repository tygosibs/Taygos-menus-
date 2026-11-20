import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  LayoutGrid,
  Loader2,
  Lock,
  LogOut,
  QrCode,
  Receipt,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { ConfirmSignOutModal } from '../components/ConfirmSignOutModal';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { CaptainWaiterTab } from '../components/admin/CaptainWaiterTab';
import { LiveOrdersTab } from '../components/admin/LiveOrdersTab';
import { QrGeneratorTab } from '../components/admin/QrGeneratorTab';
import { StaffManagementTab } from '../components/admin/StaffManagementTab';
import { StaffShiftBar } from '../components/admin/StaffShiftBar';
import { ThermalPrinterSettingsModal } from '../components/admin/ThermalPrinterSettingsModal';
import {
  deactivateStaffDevice,
  registerStaffDeviceAndFcm,
} from '../lib/fcmNotificationService';
import { auth } from '../lib/firebase';
import { subscribeMyActiveShifts } from '../lib/shiftsService';
import {
  classifyLoginIdentifier,
  getSavedStaffScreen,
  getScreenMetaDynamic,
  saveStaffScreen,
  STAFF_ROLE_META,
} from '../lib/staffAuthUtils';
import {
  completeForcedPasswordChange,
  fetchRestaurantBySlugForStaff,
  getMyStaffProfile,
  loginStaffMember,
} from '../lib/staffService';
import { subscribeRestaurantStations } from '../lib/stationsService';
import {
  buildEffectiveStations,
  cleanStationId,
  getStationIconComponent,
  screenToStationId,
  StationMeta,
} from '../lib/stationUtils';
import {
  getActivePrinterConnection,
  getSavedPrinterProfile,
  tryAutoReconnectSavedPrinter,
} from '../lib/thermalPrinterService';
import {
  Restaurant,
  RestaurantStation,
  StaffActorInfo,
  StaffMember,
  StaffScreen,
  StaffShift,
} from '../types/menu';

interface StaffPortalPageProps {
  slug: string;
  onNavigate: (path: string) => void;
}

function getScreenIcon(scr: StaffScreen, stations: StationMeta[]) {
  if (scr === 'staff_management') return ShieldCheck;
  if (scr === 'cashier') return Receipt;
  if (scr === 'captain') return UserCheck;
  if (scr === 'halls') return QrCode;
  const stId = screenToStationId(scr);
  if (stId) {
    const found = stations.find((s) => s.stationId === stId);
    if (found) return getStationIconComponent(found.icon);
  }
  return LayoutGrid;
}

function resolveInitialScreenWithQuery(
  restaurantId: string,
  staff: StaffMember
): StaffScreen {
  if (typeof window !== 'undefined') {
    const urlScr = (new URLSearchParams(window.location.search).get('screen') || '').trim();
    if (urlScr && staff.allowedScreens.includes(urlScr as StaffScreen)) {
      return urlScr as StaffScreen;
    }
  }
  return getSavedStaffScreen(
    restaurantId,
    staff.uid,
    staff.allowedScreens,
    staff.defaultScreen
  );
}

export function StaffPortalPage({ slug, onNavigate }: StaffPortalPageProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loadingRest, setLoadingRest] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [authUid, setAuthUid] = useState<string | null>(null);

  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [mismatchAuthNotice, setMismatchAuthNotice] = useState(false);
  const [activeScreen, setActiveScreen] = useState<StaffScreen>('cashier');
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);

  const [dynamicStations, setDynamicStations] = useState<RestaurantStation[]>([]);
  const [myActiveShifts, setMyActiveShifts] = useState<StaffShift[]>([]);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [printerLabel, setPrinterLabel] = useState<string>(() => {
    const conn = getActivePrinterConnection();
    if (conn.connected && conn.name) return conn.name;
    return getSavedPrinterProfile()?.name || '';
  });

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Forced password change state (if mustChangePassword is true on direct login)
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoadingRest(true);
    fetchRestaurantBySlugForStaff(slug)
      .then((rest) => {
        if (!mounted) return;
        setRestaurant(rest);
        document.title = rest ? `${rest.name} — دخول الكادر` : 'دخول الكادر — سُفرة QR';
      })
      .finally(() => {
        if (mounted) setLoadingRest(false);
      });
    return () => {
      mounted = false;
    };
  }, [slug]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUid(u?.uid || null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !restaurant) return;
    if (!authUid) {
      setStaff(null);
      setMismatchAuthNotice(false);
      return;
    }

    let mounted = true;
    setLoadingStaff(true);
    setMismatchAuthNotice(false);
    getMyStaffProfile(restaurant.id, authUid)
      .then((profile) => {
        if (!mounted) return;
        if (!profile || profile.restaurantId !== restaurant.id || !profile.isActive) {
          setStaff(null);
          setMismatchAuthNotice(true);
          return;
        }
        setStaff(profile);
        setMismatchAuthNotice(false);
        const initial = resolveInitialScreenWithQuery(restaurant.id, profile);
        setActiveScreen(initial);
      })
      .finally(() => {
        if (mounted) setLoadingStaff(false);
      });
    return () => {
      mounted = false;
    };
  }, [authReady, authUid, restaurant]);

  useEffect(() => {
    if (!restaurant?.id) return;
    return subscribeRestaurantStations(restaurant.id, setDynamicStations, () => {});
  }, [restaurant?.id]);

  useEffect(() => {
    if (!restaurant?.id || !staff?.uid) {
      setMyActiveShifts([]);
      return;
    }
    return subscribeMyActiveShifts(restaurant.id, staff.uid, setMyActiveShifts);
  }, [restaurant?.id, staff?.uid]);

  useEffect(() => {
    if (!restaurant?.id || !staff?.uid || staff.mustChangePassword) return;
    const activeStationsFromShifts = myActiveShifts.map((s) => s.stationId).filter(Boolean);
    const activeStationsFallback = (staff.allowedStations && staff.allowedStations.length > 0)
      ? staff.allowedStations
      : (staff.allowedScreens || [])
          .map((scr) => screenToStationId(scr))
          .filter((id): id is string => Boolean(id));
    void registerStaffDeviceAndFcm({
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      staffId: staff.uid,
      staffName: staff.name,
      activeStations:
        activeStationsFromShifts.length > 0 ? activeStationsFromShifts : activeStationsFallback,
      requestPermissionNow: false,
    });
    void tryAutoReconnectSavedPrinter().then((ok) => {
      if (ok) {
        const conn = getActivePrinterConnection();
        if (conn.name) setPrinterLabel(conn.name);
      }
    });
  }, [restaurant?.id, restaurant?.ownerId, staff?.uid, staff?.name, staff?.mustChangePassword]);

  const effectiveStations = useMemo(
    () => buildEffectiveStations(dynamicStations),
    [dynamicStations]
  );

  const detectedIdentifier = useMemo(() => {
    if (!identifier.trim()) return null;
    const c = classifyLoginIdentifier(identifier);
    return c.type === 'email'
      ? 'بريد إلكتروني'
      : c.type === 'phone'
        ? 'رقم هاتف'
        : 'اسم مستخدم';
  }, [identifier]);

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;
    setLoginError(null);
    setLoggingIn(true);
    try {
      const loggedStaff = await loginStaffMember({
        restaurant,
        rawIdentifier: identifier,
        password,
      });
      setStaff(loggedStaff);
      setMismatchAuthNotice(false);
      const initial = resolveInitialScreenWithQuery(restaurant.id, loggedStaff);
      setActiveScreen(initial);
      setPassword('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleScreenChange = (scr: StaffScreen) => {
    if (!restaurant || !staff || !staff.allowedScreens.includes(scr)) return;
    setActiveScreen(scr);
    saveStaffScreen(restaurant.id, staff.uid, scr);
  };

  const handleForcedPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!restaurant || !staff) return;
    setPwError(null);
    setSavingPw(true);
    try {
      await completeForcedPasswordChange({
        restaurantId: restaurant.id,
        staff,
        newPassword: newPw,
        confirmPassword: confirmPw,
      });
      setStaff({ ...staff, mustChangePassword: false });
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'تعذر تحديث كلمة المرور.');
    } finally {
      setSavingPw(false);
    }
  };

  if (loadingRest || !authReady || (authUid && loadingStaff)) {
    return (
      <div dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-900 mx-auto" />
          <p className="text-xs sm:text-sm font-bold text-zinc-600">
            جاري تحميل بوابة الكادر...
          </p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-3xl p-6 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h1 className="text-lg font-extrabold text-zinc-950">المطعم غير موجود</h1>
          <p className="text-xs text-zinc-500">
            تأكد من صحة رابط صفحة الكادر الخاص بالمطعم (/staff/{slug}).
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="px-4 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-extrabold cursor-pointer"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  // Forced password change screen (only if mustChangePassword === true)
  if (staff && staff.mustChangePassword) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-3xl p-6 sm:p-7 shadow-lg space-y-5">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-extrabold">
              <KeyRound className="w-3.5 h-3.5" />
              <span>تحديث كلمة المرور مطلوب</span>
            </span>
            <h1 className="text-lg font-extrabold text-zinc-950 pt-1">
              مرحباً {staff.name}
            </h1>
            <p className="text-xs text-zinc-600">
              لأمان حسابك، يرجى تعيين كلمة مرور دائمة وقوية قبل بدء العمل في {restaurant.name}.
            </p>
          </div>

          {pwError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
              {pwError}
            </div>
          )}

          <form onSubmit={handleForcedPasswordSubmit} className="space-y-3">
            <label className="block space-y-1 text-xs font-bold text-zinc-800">
              <span>كلمة المرور الجديدة (8+ أحرف وأرقام) *</span>
              <input
                type="password"
                required
                dir="ltr"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </label>
            <label className="block space-y-1 text-xs font-bold text-zinc-800">
              <span>تأكيد كلمة المرور الجديدة *</span>
              <input
                type="password"
                required
                dir="ltr"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </label>
            <button
              type="submit"
              disabled={savingPw}
              className="w-full min-h-[44px] rounded-xl bg-zinc-950 text-white text-sm font-extrabold hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
            >
              {savingPw ? 'جاري الحفظ...' : 'حفظ كلمة المرور والدخول'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Staff Login View (Not logged in or signed in with non-staff/other-tenant account)
  if (!staff) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#F5F6F8] flex flex-col justify-between p-4 sm:p-6">
        <header className="max-w-4xl w-full mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {restaurant.logoUrl ? (
              <img
                src={restaurant.logoUrl}
                alt={restaurant.name}
                className="w-9 h-9 rounded-xl object-cover border border-zinc-200 bg-white"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-zinc-950 text-amber-400 flex items-center justify-center font-extrabold text-sm">
                <ShieldCheck className="w-5 h-5" />
              </div>
            )}
            <div>
              <p className="text-sm font-extrabold text-zinc-950">{restaurant.name}</p>
              <p className="text-[11px] text-zinc-500">بوابة دخول فريق العمل والكادر</p>
            </div>
          </div>

          <PWAInstallButton variant="compact" />
        </header>

        <main className="max-w-md w-full mx-auto my-8 space-y-4">
          {mismatchAuthNotice && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-2.5 text-xs text-amber-950">
              <p className="font-extrabold">
                الحساب المسجّل حالياً في المتصفح لا يملك صلاحية كادر فعّالة لهذا المطعم.
              </p>
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="px-3.5 py-2 rounded-xl bg-amber-950 text-white font-bold cursor-pointer"
              >
                تسجيل الخروج للعودة لدخول الكادر
              </button>
            </div>
          )}

          <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-extrabold">
                <Lock className="w-3.5 h-3.5" />
                <span>دخول آمن ومعزول للمطعم</span>
              </span>
              <h1 className="text-xl font-extrabold text-zinc-950 pt-1">
                {restaurant.name} — دخول الكادر
              </h1>
              <p className="text-xs text-zinc-500 leading-relaxed">
                سجّل الدخول باستخدام <strong>اسم المستخدم</strong> أو <strong>رقم الهاتف</strong> أو <strong>البريد الإلكتروني</strong> وكلمة المرور.
              </p>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <label className="block space-y-1.5 text-xs font-bold text-zinc-800">
                <div className="flex items-center justify-between gap-2">
                  <span>اسم المستخدم أو رقم الهاتف أو الإيميل *</span>
                  {detectedIdentifier && (
                    <span className="text-[11px] text-indigo-700 font-extrabold">
                      {detectedIdentifier}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  dir="ltr"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="username / 01012345678 / email"
                  className="w-full px-3.5 py-3 rounded-xl border border-zinc-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </label>

              <label className="block space-y-1.5 text-xs font-bold text-zinc-800">
                <span>كلمة المرور *</span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    dir="ltr"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-3 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label="إظهار أو إخفاء كلمة المرور"
                    className="absolute inset-y-0 end-2 px-2 flex items-center text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري التحقق والدخول...</span>
                  </>
                ) : (
                  <span>تسجيل الدخول لبدء العمل</span>
                )}
              </button>
            </form>

            <div className="pt-3 border-t border-zinc-100 text-[11px] text-zinc-500 leading-relaxed">
              هل نسيت كلمة المرور؟ اطلب من مدير المطعم إصدار <strong>رابط دعوة QR جديد</strong> أو إرسال رابط استعادة للإيميل.
            </div>
          </div>
        </main>

        <footer className="text-center text-[11px] text-zinc-400">
          {restaurant.name} · بوابة تشغيل الكادر
        </footer>
      </div>
    );
  }

  // Authenticated Active Staff Workspace (strictly screen-isolated)
  const roleMeta = STAFF_ROLE_META[staff.role] || STAFF_ROLE_META.cashier;
  const allowedScreens = staff.allowedScreens || [];
  const safeCurrentScreen: StaffScreen = allowedScreens.includes(activeScreen)
    ? activeScreen
    : allowedScreens[0] || 'cashier';

  const currentScreenMeta = getScreenMetaDynamic(safeCurrentScreen, effectiveStations);
  const currentStationId = screenToStationId(safeCurrentScreen)
    ? cleanStationId(screenToStationId(safeCurrentScreen) || '')
    : undefined;

  const actor: StaffActorInfo = {
    uid: staff.uid,
    name: staff.name,
    role: staff.role,
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F5F6F8] text-zinc-900 flex flex-col">
      {/* Staff Top Operational Header */}
      <header className="print:hidden bg-white border-b border-zinc-200 px-3 sm:px-6 py-3 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {restaurant.logoUrl ? (
                <img
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="w-9 h-9 rounded-xl object-cover border border-zinc-200 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-zinc-950 text-amber-400 flex items-center justify-center shrink-0">
                  <LayoutGrid className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-extrabold text-zinc-950 truncate">
                    {restaurant.name}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${roleMeta.badgeClass}`}
                  >
                    {roleMeta.labelAr}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 truncate">
                  {staff.name}
                  {staff.hallName ? ` · الصالة: ${staff.hallName}` : ''}
                </p>
              </div>
            </div>

            <div className="flex lg:hidden items-center gap-1.5 shrink-0">
              <PWAInstallButton variant="compact" />
              <button
                type="button"
                onClick={() => setSignOutConfirmOpen(true)}
                className="px-2.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>خروج</span>
              </button>
            </div>
          </div>

          {/* Multi-Screen Switcher ("تغيير الشاشة") when staff has >1 allowedScreen */}
          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2">
            {allowedScreens.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <span className="text-[11px] font-bold text-zinc-400 shrink-0 hidden sm:inline">
                  تغيير الشاشة:
                </span>
                {allowedScreens.map((scr) => {
                  const Icon = getScreenIcon(scr, effectiveStations);
                  const isActive = safeCurrentScreen === scr;
                  const meta = getScreenMetaDynamic(scr, effectiveStations);
                  return (
                    <button
                      key={scr}
                      type="button"
                      onClick={() => handleScreenChange(scr)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-zinc-950 text-white shadow-2xs'
                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-zinc-500'}`} />
                      <span>{meta.shortAr}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <PWAInstallButton variant="outline" />
              <button
                type="button"
                onClick={() => setSignOutConfirmOpen(true)}
                className="min-h-[38px] px-3 py-2 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Isolated Screen Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-4">
        <StaffShiftBar
          restaurant={restaurant}
          staff={staff}
          activeScreen={safeCurrentScreen}
          screenLabel={currentScreenMeta.shortAr}
          stationId={currentStationId}
          allStations={effectiveStations}
          myActiveShifts={myActiveShifts}
          onOpenPrinterSettings={() => setPrinterModalOpen(true)}
          printerLabel={printerLabel}
        />

        {safeCurrentScreen === 'staff_management' && staff.role === 'manager' && (
          <StaffManagementTab restaurant={restaurant} mode="manager" actor={actor} />
        )}

        {safeCurrentScreen === 'cashier' && (
          <LiveOrdersTab
            restaurant={restaurant}
            allowedStations={['cashier']}
            initialStation="cashier"
            staffMode
            actor={actor}
          />
        )}

        {currentStationId && (
          <LiveOrdersTab
            restaurant={restaurant}
            allowedStations={[currentStationId]}
            initialStation={currentStationId}
            staffMode
            actor={actor}
          />
        )}

        {safeCurrentScreen === 'captain' && (
          <CaptainWaiterTab
            restaurant={restaurant}
            defaultHallName={staff.hallName}
            staffMode
            actor={actor}
          />
        )}

        {safeCurrentScreen === 'halls' && <QrGeneratorTab restaurant={restaurant} />}
      </main>

      <ThermalPrinterSettingsModal
        isOpen={printerModalOpen}
        onClose={() => setPrinterModalOpen(false)}
        restaurant={restaurant}
        onProfileChanged={(prof) => setPrinterLabel(prof?.name || '')}
      />

      <ConfirmSignOutModal
        open={signOutConfirmOpen}
        onCancel={() => setSignOutConfirmOpen(false)}
        onConfirm={async () => {
          setSignOutConfirmOpen(false);
          if (restaurant?.id) {
            await deactivateStaffDevice(restaurant.id);
          }
          void signOut(auth);
        }}
      />
    </div>
  );
}
