import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  AlertCircle,
  Crown,
  Eye,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  LayoutGrid,
  Loader2,
  Lock,
  LogOut,
  QrCode,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Utensils,
} from 'lucide-react';
import { ConfirmSignOutModal } from '../components/ConfirmSignOutModal';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { CaptainWaiterTab } from '../components/admin/CaptainWaiterTab';
import { LiveOrdersTab } from '../components/admin/LiveOrdersTab';
import { ManagerSupervisionDashboard } from '../components/admin/ManagerSupervisionDashboard';
import { MenuBuilderTab } from '../components/admin/MenuBuilderTab';
import { OwnerShiftReportTab } from '../components/admin/OwnerShiftReportTab';
import { QrGeneratorTab } from '../components/admin/QrGeneratorTab';
import { StaffManagementTab } from '../components/admin/StaffManagementTab';
import { StaffShiftBar } from '../components/admin/StaffShiftBar';
import { ThermalPrinterSettingsModal } from '../components/admin/ThermalPrinterSettingsModal';
import {
  deactivateStaffDevice,
  registerStaffDeviceAndFcm,
} from '../lib/fcmNotificationService';
import { auth, db } from '../lib/firebase';
import {
  getResolvedOperationsConfig,
  getTimestampMillis,
  subscribeAllRestaurantShifts,
  subscribeDrawerExpenses,
  subscribeTreasuryTransfers,
} from '../lib/operationsService';
import {
  subscribeAllActiveRestaurantShifts,
  subscribeMyActiveShifts,
} from '../lib/shiftsService';
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
  resolveStaffSuspensionState,
  subscribeRestaurantStaff,
  subscribeStaffAuditLogs,
  unsuspendStaffMember,
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
  DrawerExpense,
  Restaurant,
  RestaurantStation,
  StaffActorInfo,
  StaffAuditLog,
  StaffMember,
  StaffScreen,
  StaffShift,
  TreasuryTransfer,
} from '../types/menu';

interface StaffPortalPageProps {
  slug: string;
  onNavigate: (path: string) => void;
}

type ManagerPortalMode = 'supervision' | 'menu_editor' | 'shift_reports' | 'screen';

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
  const [suspendedNotice, setSuspendedNotice] = useState<string | null>(null);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [mismatchAuthNotice, setMismatchAuthNotice] = useState(false);

  const [activeScreen, setActiveScreen] = useState<StaffScreen>('cashier');
  const [managerMode, setManagerMode] = useState<ManagerPortalMode>('supervision');
  const [supervisoryOverride, setSupervisoryOverride] = useState<{
    screen: StaffScreen;
    supervisory?: boolean;
    coveringStaffName?: string;
  } | null>(null);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);

  const [dynamicStations, setDynamicStations] = useState<RestaurantStation[]>([]);
  const [myActiveShifts, setMyActiveShifts] = useState<StaffShift[]>([]);
  const [allActiveShifts, setAllActiveShifts] = useState<StaffShift[]>([]);
  const [allRestaurantShifts, setAllRestaurantShifts] = useState<StaffShift[]>([]);
  const [restaurantStaffList, setRestaurantStaffList] = useState<StaffMember[]>([]);
  const [drawerExpenses, setDrawerExpenses] = useState<DrawerExpense[]>([]);
  const [treasuryTransfers, setTreasuryTransfers] = useState<TreasuryTransfer[]>([]);
  const [auditLogs, setAuditLogs] = useState<StaffAuditLog[]>([]);
  const [openHandoverSignal, setOpenHandoverSignal] = useState(0);

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

  const restaurantId = restaurant?.id;

  // Live subscribe to restaurant document once staff is signed in so operationsConfig & treasuryState update immediately
  useEffect(() => {
    if (!restaurantId || !authUid) return;
    return onSnapshot(
      doc(db, 'restaurants', restaurantId),
      (snap) => {
        if (snap.exists()) {
          setRestaurant({ ...(snap.data() as Restaurant), id: snap.id });
        }
      },
      () => {}
    );
  }, [restaurantId, authUid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUid(u?.uid || null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !restaurantId) return;
    if (!authUid) {
      setStaff(null);
      setSuspendedNotice(null);
      setMismatchAuthNotice(false);
      return;
    }

    let mounted = true;
    setLoadingStaff(true);
    setMismatchAuthNotice(false);
    setSuspendedNotice(null);

    getMyStaffProfile(restaurantId, authUid)
      .then(async (profile) => {
        if (!mounted) return;
        if (!profile || profile.restaurantId !== restaurantId) {
          setStaff(null);
          setMismatchAuthNotice(true);
          return;
        }

        const suspState = resolveStaffSuspensionState(profile);
        let effectiveProfile = profile;
        if (suspState.isExpiredTimed) {
          effectiveProfile = { ...profile, isActive: true, suspendedType: undefined, suspendedReason: '' };
          void unsuspendStaffMember({
            restaurantId,
            staff: profile,
            actor: { uid: profile.uid, name: profile.name, role: profile.role },
          }).catch(() => {});
        } else if (suspState.isSuspended && !profile.mustChangePassword) {
          setStaff(null);
          setSuspendedNotice(suspState.message);
          return;
        }

        setStaff(effectiveProfile);
        setMismatchAuthNotice(false);
        setSuspendedNotice(null);

        const initial = resolveInitialScreenWithQuery(restaurantId, effectiveProfile);
        setActiveScreen(initial);
        const urlScr =
          typeof window !== 'undefined'
            ? (new URLSearchParams(window.location.search).get('screen') || '').trim()
            : '';
        if (effectiveProfile.role === 'manager' && !urlScr) {
          setManagerMode('supervision');
        } else {
          setManagerMode('screen');
        }
      })
      .finally(() => {
        if (mounted) setLoadingStaff(false);
      });
    return () => {
      mounted = false;
    };
  }, [authReady, authUid, restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    return subscribeRestaurantStations(restaurantId, setDynamicStations, () => {});
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId || !staff?.uid) {
      setMyActiveShifts([]);
      return;
    }
    return subscribeMyActiveShifts(restaurantId, staff.uid, setMyActiveShifts);
  }, [restaurantId, staff?.uid]);

  useEffect(() => {
    if (!restaurantId || !staff?.uid) {
      setAllActiveShifts([]);
      setAllRestaurantShifts([]);
      setRestaurantStaffList([]);
      setDrawerExpenses([]);
      setTreasuryTransfers([]);
      setAuditLogs([]);
      return;
    }
    const isManagerOrCashier =
      staff.role === 'manager' ||
      staff.role === 'cashier' ||
      staff.allowedScreens?.includes('cashier');

    const unsubs: Array<() => void> = [];
    unsubs.push(subscribeAllActiveRestaurantShifts(restaurantId, setAllActiveShifts, () => {}));

    if (isManagerOrCashier) {
      unsubs.push(subscribeAllRestaurantShifts(restaurantId, setAllRestaurantShifts, () => {}));
      unsubs.push(subscribeRestaurantStaff(restaurantId, setRestaurantStaffList, () => {}));
      unsubs.push(subscribeDrawerExpenses(restaurantId, setDrawerExpenses, () => {}));
    }
    if (staff.role === 'manager') {
      unsubs.push(subscribeTreasuryTransfers(restaurantId, setTreasuryTransfers, () => {}));
      unsubs.push(subscribeStaffAuditLogs(restaurantId, setAuditLogs, () => {}));
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [restaurantId, staff?.uid, staff?.role, staff?.allowedScreens]);

  useEffect(() => {
    if (!restaurant?.id || !staff?.uid || staff.mustChangePassword) return;
    const activeStationsFromShifts = myActiveShifts.map((s) => s.stationId).filter(Boolean);
    const activeStationsFallback =
      staff.allowedStations && staff.allowedStations.length > 0
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

  const opsConfig = useMemo(() => getResolvedOperationsConfig(restaurant), [restaurant]);
  const managerPerms = opsConfig.managerPermissions;

  const detectedIdentifier = useMemo(() => {
    if (!identifier.trim()) return null;
    const c = classifyLoginIdentifier(identifier);
    return c.type === 'email'
      ? 'بريد إلكتروني'
      : c.type === 'phone'
        ? 'رقم هاتف'
        : 'اسم مستخدم';
  }, [identifier]);

  const lastClosedCashierShift = useMemo(() => {
    return (
      allRestaurantShifts.find(
        (s) => s.stationId === 'cashier' && s.status === 'completed'
      ) || null
    );
  }, [allRestaurantShifts]);

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;
    setLoginError(null);
    setSuspendedNotice(null);
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
      if (loggedStaff.role === 'manager') {
        setManagerMode('supervision');
      } else {
        setManagerMode('screen');
      }
      setPassword('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر تسجيل الدخول.';
      if (msg.includes('تم إيقاف شاشتك')) {
        setSuspendedNotice(msg);
      }
      setLoginError(msg);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleScreenChange = (
    scr: StaffScreen,
    opts?: { supervisory?: boolean; coveringStaffName?: string }
  ) => {
    if (!restaurant || !staff || !staff.allowedScreens.includes(scr)) return;
    setActiveScreen(scr);
    setManagerMode('screen');
    if (opts) {
      setSupervisoryOverride({
        screen: scr,
        supervisory: opts.supervisory,
        coveringStaffName: opts.coveringStaffName,
      });
    } else {
      setSupervisoryOverride(null);
    }
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

  // Dedicated Suspension Block Screen
  if (suspendedNotice && !staff) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border-2 border-rose-300 rounded-3xl p-6 sm:p-7 shadow-xl text-center space-y-4">
          <span className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </span>
          <div className="space-y-1">
            <h1 className="text-lg font-extrabold text-zinc-950">{restaurant.name}</h1>
            <p className="text-xs font-bold text-rose-700">تم تقييد الدخول لهذه الشاشة</p>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs sm:text-sm font-extrabold text-rose-950 leading-relaxed">
            {suspendedNotice}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {authUid && (
              <button
                type="button"
                onClick={() => {
                  setSuspendedNotice(null);
                  void signOut(auth);
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold cursor-pointer"
              >
                تسجيل الخروج والعودة
              </button>
            )}
            <button
              type="button"
              onClick={() => setSuspendedNotice(null)}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-bold hover:bg-zinc-50 cursor-pointer"
            >
              الدخول بحساب آخر
            </button>
          </div>
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
                سجّل الدخول باستخدام <strong>اسم المستخدم</strong> أو <strong>رقم الهاتف</strong> أو{' '}
                <strong>البريد الإلكتروني</strong> وكلمة المرور.
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
  const isManager = staff.role === 'manager';
  const allowedScreens = staff.allowedScreens || [];
  const safeCurrentScreen: StaffScreen = allowedScreens.includes(activeScreen)
    ? activeScreen
    : allowedScreens[0] || 'cashier';

  const currentScreenMeta = getScreenMetaDynamic(safeCurrentScreen, effectiveStations);
  const currentStationId = screenToStationId(safeCurrentScreen)
    ? cleanStationId(screenToStationId(safeCurrentScreen) || '')
    : undefined;
  const currentShiftKey = currentStationId || safeCurrentScreen;

  // Determine if another staff member covers this screen while Manager is supervising
  const liveCoveringShift =
    allActiveShifts.find(
      (sh) => sh.stationId === currentShiftKey && sh.staffId !== staff.uid
    ) || null;
  const isSupervisoryHere = Boolean(
    isManager &&
      managerMode === 'screen' &&
      (supervisoryOverride?.screen === safeCurrentScreen
        ? supervisoryOverride.supervisory
        : Boolean(liveCoveringShift))
  );
  const coveringName =
    supervisoryOverride?.screen === safeCurrentScreen && supervisoryOverride.coveringStaffName
      ? supervisoryOverride.coveringStaffName
      : liveCoveringShift?.staffName;

  // Determine Active Cashier Shift (for cashier or manager viewing cashier)
  const myCashierShift =
    myActiveShifts.find((sh) => sh.stationId === 'cashier') || null;
  const activeCashierShift =
    myCashierShift ||
    allActiveShifts.find((sh) => sh.stationId === 'cashier') ||
    null;

  const actor: StaffActorInfo = {
    uid: staff.uid,
    name: staff.name,
    role: staff.role,
  };

  const canShowShiftBar =
    !isManager ||
    (managerMode === 'screen' &&
      safeCurrentScreen !== 'staff_management' &&
      safeCurrentScreen !== 'halls');

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

          {/* Navigation Strip: Manager gets Supervision Console + Menu + Shift Reports + Screens; regular staff gets their allowedScreens */}
          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2">
            {(isManager || allowedScreens.length > 1) && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
                {isManager && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setManagerMode('supervision');
                        setSupervisoryOverride(null);
                      }}
                      className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        managerMode === 'supervision'
                          ? 'bg-indigo-700 text-white shadow-2xs'
                          : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100'
                      }`}
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>لوحة الإشراف</span>
                    </button>

                    {(managerPerms.canEditMenu || managerPerms.canPauseItems) && (
                      <button
                        type="button"
                        onClick={() => {
                          setManagerMode('menu_editor');
                          setSupervisoryOverride(null);
                        }}
                        className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          managerMode === 'menu_editor'
                            ? 'bg-zinc-950 text-white shadow-2xs'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                      >
                        <Utensils className="w-3.5 h-3.5" />
                        <span>المنيو والأصناف</span>
                      </button>
                    )}

                    {managerPerms.canViewShiftReports && (
                      <button
                        type="button"
                        onClick={() => {
                          setManagerMode('shift_reports');
                          setSupervisoryOverride(null);
                        }}
                        className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          managerMode === 'shift_reports'
                            ? 'bg-zinc-950 text-white shadow-2xs'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>تقرير الورديات</span>
                      </button>
                    )}
                  </>
                )}

                {allowedScreens.map((scr) => {
                  if (scr === 'staff_management' && isManager && !managerPerms.canManageStaff) {
                    return null;
                  }
                  const Icon = getScreenIcon(scr, effectiveStations);
                  const isActive = managerMode === 'screen' && safeCurrentScreen === scr;
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
        {canShowShiftBar && (
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
            supervisoryMode={isSupervisoryHere}
            coveringStaffName={coveringName}
            lastClosedCashierShift={lastClosedCashierShift}
            onRequestCashierHandoverModal={() => setOpenHandoverSignal((n) => n + 1)}
            onSwitchCashierNextSlot={() => setOpenHandoverSignal((n) => n + 1)}
          />
        )}

        {isManager && managerMode === 'supervision' ? (
          <ManagerSupervisionDashboard
            restaurant={restaurant}
            actor={actor}
            activeShifts={allActiveShifts}
            dynamicStations={dynamicStations}
            treasuryTransfers={treasuryTransfers}
            onNavigateScreen={(scr, opts) => handleScreenChange(scr, opts)}
            onRestaurantUpdated={(updated) => setRestaurant(updated)}
          />
        ) : isManager && managerMode === 'menu_editor' ? (
          <MenuBuilderTab restaurant={restaurant} />
        ) : isManager && managerMode === 'shift_reports' ? (
          <OwnerShiftReportTab
            restaurant={restaurant}
            actor={actor}
            shiftsOverride={allRestaurantShifts}
            expensesOverride={drawerExpenses}
            auditLogsOverride={auditLogs}
            transfersOverride={treasuryTransfers}
            onRestaurantUpdated={(updated) => setRestaurant(updated)}
          />
        ) : (
          <>
            {safeCurrentScreen === 'staff_management' && isManager && managerPerms.canManageStaff && (
              <StaffManagementTab
                restaurant={restaurant}
                mode="manager"
                actor={actor}
                onRestaurantUpdated={(updated) => setRestaurant(updated)}
              />
            )}

            {safeCurrentScreen === 'cashier' && (
              <LiveOrdersTab
                restaurant={restaurant}
                allowedStations={['cashier']}
                initialStation="cashier"
                staffMode
                actor={actor}
                activeCashierShift={activeCashierShift}
                allShifts={allRestaurantShifts}
                staffList={restaurantStaffList}
                expenses={drawerExpenses}
                supervisoryMode={isSupervisoryHere}
                coveringStaffName={coveringName}
                hideHistoryArchive={staff.role === 'cashier'}
                openHandoverSignal={openHandoverSignal}
              />
            )}

            {currentStationId && (
              <LiveOrdersTab
                restaurant={restaurant}
                allowedStations={[currentStationId]}
                initialStation={currentStationId}
                staffMode
                actor={actor}
                supervisoryMode={isSupervisoryHere}
                coveringStaffName={coveringName}
              />
            )}

            {safeCurrentScreen === 'captain' && (
              <CaptainWaiterTab
                restaurant={restaurant}
                defaultHallName={staff.hallName}
                staffMode
                actor={actor}
                onRestaurantUpdated={(updated) => setRestaurant(updated)}
              />
            )}

            {safeCurrentScreen === 'halls' && <QrGeneratorTab restaurant={restaurant} />}
          </>
        )}
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

