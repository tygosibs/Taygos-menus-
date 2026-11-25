import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  AlertCircle,
  Briefcase,
  Crown,
  Eye,
  EyeOff,
  FileSpreadsheet,
  HeartHandshake,
  KeyRound,
  Layers,
  LayoutGrid,
  Loader2,
  Lock,
  LogOut,
  QrCode,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  Utensils,
} from 'lucide-react';
import { ConfirmSignOutModal } from '../components/ConfirmSignOutModal';
import { LanguageToggleButton } from '../components/LanguageToggleButton';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { CaptainAssignmentsTab } from '../components/admin/CaptainAssignmentsTab';
import { CaptainWaiterTab } from '../components/admin/CaptainWaiterTab';
import { CustomersCrmTab } from '../components/admin/CustomersCrmTab';
import { HallManagerConsole } from '../components/admin/HallManagerConsole';
import { JobTitlesTab } from '../components/admin/JobTitlesTab';
import { LiveOrdersTab } from '../components/admin/LiveOrdersTab';
import { ManagerSupervisionDashboard } from '../components/admin/ManagerSupervisionDashboard';
import { MenuBuilderTab } from '../components/admin/MenuBuilderTab';
import { OwnerShiftReportTab } from '../components/admin/OwnerShiftReportTab';
import { QrGeneratorTab } from '../components/admin/QrGeneratorTab';
import { StaffManagementTab } from '../components/admin/StaffManagementTab';
import { StaffShiftBar } from '../components/admin/StaffShiftBar';
import { StationsManagerTab } from '../components/admin/StationsManagerTab';
import { ThermalPrinterSettingsModal } from '../components/admin/ThermalPrinterSettingsModal';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenUi } from '../contexts/PlatformUiContext';
import {
  deactivateStaffDevice,
  registerStaffDeviceAndFcm,
} from '../lib/fcmNotificationService';
import { auth, db } from '../lib/firebase';
import { ActorDelegationCeiling } from '../lib/jobTitlesService';
import { getSidebarHighlightHex } from '../lib/platformUiDefaults';
import {
  getResolvedOperationsConfig,
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
  getResolvedHallManagerPermissions,
  getSavedStaffScreen,
  getScreenMetaDynamic,
  resolveEffectiveAllowedScreens,
  resolveEffectiveStaffPermissions,
  saveStaffScreen,
  STAFF_ROLE_META,
} from '../lib/staffAuthUtils';
import {
  completeForcedPasswordChange,
  fetchRestaurantBySlugForStaff,
  loginStaffMember,
  resolveStaffSuspensionState,
  subscribeMyStaffProfile,
  subscribeRestaurantStaff,
  subscribeStaffAuditLogs,
  unsuspendStaffMember,
} from '../lib/staffService';
import { subscribeRestaurantStations } from '../lib/stationsService';
import {
  buildEffectiveCaptainScreens,
  buildEffectiveStations,
  cleanStationId,
  getStationIconComponent,
  screenToStationId,
  stationIdToScreen,
  StationMeta,
} from '../lib/stationUtils';
import {
  getActivePrinterConnection,
  getSavedPrinterProfile,
  tryAutoReconnectSavedPrinter,
} from '../lib/thermalPrinterService';
import {
  DrawerExpense,
  EffectiveStaffPermissions,
  Restaurant,
  RestaurantStation,
  StaffActorInfo,
  StaffAuditLog,
  StaffMember,
  StaffScreen,
  StaffShift,
  StationScreenType,
  TreasuryTransfer,
} from '../types/menu';

interface StaffPortalPageProps {
  slug: string;
  onNavigate: (path: string) => void;
}

type ManagerPortalMode = 'supervision' | 'stations' | 'menu_editor' | 'shift_reports' | 'screen';

function getScreenIcon(scr: StaffScreen, stations: StationMeta[]) {
  if (scr === 'staff_management') return ShieldCheck;
  if (scr === 'job_titles') return Briefcase;
  if (scr === 'stations') return Layers;
  if (scr === 'menu_editor') return Utensils;
  if (scr === 'shift_reports') return FileSpreadsheet;
  if (scr === 'customers') return HeartHandshake;
  if (scr === 'cashier') return Receipt;
  if (scr === 'captain') return UserCheck;
  if (scr === 'hall_manager') return LayoutGrid;
  if (scr === 'hall_assignments') return Users;
  if (scr === 'halls') return QrCode;
  const stId = screenToStationId(scr);
  if (stId) {
    const found = stations.find((s) => s.stationId === stId);
    if (found) return getStationIconComponent(found.icon);
  }
  return LayoutGrid;
}

function computeEffectiveStaffScreens(
  staff: StaffMember,
  effectivePerms: EffectiveStaffPermissions,
  dynamicStations?: StationMeta[]
): StaffScreen[] {
  const resolvedSet = new Set<StaffScreen>(resolveEffectiveAllowedScreens(staff));

  if (staff.role === 'hall_manager' && !staff.effectivePermissions) {
    const hmPerms = getResolvedHallManagerPermissions(staff.hallManagerPermissions);
    resolvedSet.add('hall_manager');
    if (hmPerms.canManageHallAssignments) resolvedSet.add('hall_assignments');
    if (hmPerms.canManageHalls) resolvedSet.add('halls');
  }

  if (staff.role === 'manager' && !staff.effectivePermissions && dynamicStations) {
    dynamicStations.forEach((st) => {
      resolvedSet.add(stationIdToScreen(st.stationId));
    });
  }

  const revokedSet = new Set<StaffScreen>(staff.revokedScreens || []);
  const syncImpliedScreen = (granted: boolean, scr: StaffScreen) => {
    if (granted && !revokedSet.has(scr)) {
      resolvedSet.add(scr);
    }
    if (!granted) {
      resolvedSet.delete(scr);
    }
  };

  syncImpliedScreen(effectivePerms.canManageStaff, 'staff_management');
  syncImpliedScreen(effectivePerms.canManageStaff, 'job_titles');
  syncImpliedScreen(effectivePerms.canManageStations, 'stations');
  syncImpliedScreen(effectivePerms.canEditMenu || effectivePerms.canPauseItems, 'menu_editor');
  syncImpliedScreen(effectivePerms.canViewShiftReports, 'shift_reports');
  syncImpliedScreen(effectivePerms.canManageCustomers, 'customers');
  syncImpliedScreen(effectivePerms.canManageHallAssignments, 'hall_assignments');
  syncImpliedScreen(effectivePerms.canManageHalls, 'halls');

  if (staff.role === 'manager' && !staff.effectivePermissions) {
    resolvedSet.delete('hall_manager');
  }

  const base = Array.from(resolvedSet);
  return base.length > 0 ? base : [staff.role === 'hall_manager' ? 'hall_manager' : 'cashier'];
}

function resolveInitialScreenWithQuery(
  restaurant: Restaurant,
  staff: StaffMember
): StaffScreen {
  const perms = getResolvedOperationsConfig(restaurant).managerPermissions;
  const effectivePerms = resolveEffectiveStaffPermissions(staff, perms);
  const effectiveAllowed = computeEffectiveStaffScreens(staff, effectivePerms);
  if (typeof window !== 'undefined') {
    const urlScr = (new URLSearchParams(window.location.search).get('screen') || '').trim();
    if (urlScr && effectiveAllowed.includes(urlScr as StaffScreen)) {
      return urlScr as StaffScreen;
    }
  }
  const safeDefault = effectiveAllowed.includes(staff.defaultScreen)
    ? staff.defaultScreen
    : effectiveAllowed[0];
  return getSavedStaffScreen(
    restaurant.id,
    staff.uid,
    effectiveAllowed,
    safeDefault
  );
}

export function StaffPortalPage({ slug, onNavigate }: StaffPortalPageProps) {
  const { lang, dir, loc, t } = useLanguage();
  const isEn = lang === 'en';
  const managerUi = useScreenUi('manager_console');
  const cashierUi = useScreenUi('cashier_kds');
  const captainUi = useScreenUi('captain_waiter');
  const shellTheme = cashierUi.theme;
  const shellRadius = cashierUi.radiusClasses;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loadingRest, setLoadingRest] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [authUid, setAuthUid] = useState<string | null>(null);

  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [suspendedNotice, setSuspendedNotice] = useState<string | null>(null);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [mismatchAuthNotice, setMismatchAuthNotice] = useState(false);

  const [activeScreen, setActiveScreen] = useState<StaffScreen>('cashier');
  const [activeCaptainScreenId, setActiveCaptainScreenId] = useState<string>('');
  const [managerMode, setManagerModeState] = useState<ManagerPortalMode>(() => {
    if (typeof window === 'undefined') return 'supervision';
    const saved = window.sessionStorage.getItem(`sufra_staff_mgr_mode_${slug}`) as ManagerPortalMode | null;
    if (saved && ['supervision', 'stations', 'menu_editor', 'shift_reports', 'screen'].includes(saved)) {
      return saved;
    }
    return 'supervision';
  });
  const setManagerMode = (mode: ManagerPortalMode) => {
    setManagerModeState(mode);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(`sufra_staff_mgr_mode_${slug}`, mode);
    }
  };
  const [stationCreateIntent, setStationCreateIntent] = useState<{
    key: number;
    returnMode: ManagerPortalMode;
    returnScreen?: StaffScreen;
    screenType?: StationScreenType;
    returnLabel?: string;
  } | null>(null);
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
  const hydratedStaffUidRef = useRef<string | null>(null);
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
      })
      .finally(() => {
        if (mounted) setLoadingRest(false);
      });
    return () => {
      mounted = false;
    };
  }, [slug]);

  useEffect(() => {
    if (restaurant) {
      const restName = loc(restaurant.name, restaurant.name_en);
      document.title = isEn ? `${restName} — Staff Portal` : `${restName} — دخول الكادر`;
    } else {
      document.title = isEn ? 'Staff Portal — Sufra QR' : 'دخول الكادر — سُفرة QR';
    }
  }, [restaurant, isEn, loc]);

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
      hydratedStaffUidRef.current = null;
      setStaff(null);
      setSuspendedNotice(null);
      setMismatchAuthNotice(false);
      setLoadingStaff(false);
      return;
    }

    setLoadingStaff(true);
    setMismatchAuthNotice(false);
    setSuspendedNotice(null);

    const unsub = subscribeMyStaffProfile(
      restaurantId,
      authUid,
      (profile) => {
        setLoadingStaff(false);
        if (!profile || profile.restaurantId !== restaurantId) {
          hydratedStaffUidRef.current = null;
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
          hydratedStaffUidRef.current = null;
          setStaff(null);
          setSuspendedNotice(suspState.message);
          return;
        }

        setStaff(effectiveProfile);
        setMismatchAuthNotice(false);
        setSuspendedNotice(null);

        if (hydratedStaffUidRef.current !== effectiveProfile.uid && restaurant) {
          hydratedStaffUidRef.current = effectiveProfile.uid;
          const initial = resolveInitialScreenWithQuery(restaurant, effectiveProfile);
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
        }
      },
      () => {
        setLoadingStaff(false);
      }
    );

    return () => unsub();
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

    const perms = resolveEffectiveStaffPermissions(
      staff,
      restaurant?.operationsConfig?.managerPermissions
    );
    const needsShiftRecords =
      staff.role === 'manager' ||
      perms.canSettleChecks ||
      perms.canManageShifts ||
      perms.canViewShiftReports ||
      perms.canEditDrawerFloat ||
      staff.allowedScreens?.includes('cashier');
    const needsStaffDirectory =
      staff.role === 'manager' ||
      perms.canManageStaff ||
      perms.canManageHallAssignments ||
      perms.canManageShifts ||
      perms.canSettleChecks;
    const needsDrawerExpenses =
      staff.role === 'manager' || perms.canViewShiftReports || perms.canAddDrawerExpenses;
    const needsTreasury =
      staff.role === 'manager' ||
      perms.canViewShiftReports ||
      perms.canEditDrawerFloat ||
      perms.canManageShifts;
    const needsAuditLogs =
      staff.role === 'manager' || perms.canViewShiftReports || perms.canManageStaff;

    const unsubs: Array<() => void> = [];
    unsubs.push(subscribeAllActiveRestaurantShifts(restaurantId, setAllActiveShifts, () => {}));

    if (needsShiftRecords) {
      unsubs.push(subscribeAllRestaurantShifts(restaurantId, setAllRestaurantShifts, () => {}));
    } else {
      setAllRestaurantShifts([]);
    }
    if (needsStaffDirectory) {
      unsubs.push(subscribeRestaurantStaff(restaurantId, setRestaurantStaffList, () => {}));
    } else {
      setRestaurantStaffList([]);
    }
    if (needsDrawerExpenses) {
      unsubs.push(subscribeDrawerExpenses(restaurantId, setDrawerExpenses, () => {}));
    } else {
      setDrawerExpenses([]);
    }
    if (needsTreasury) {
      unsubs.push(subscribeTreasuryTransfers(restaurantId, setTreasuryTransfers, () => {}));
    } else {
      setTreasuryTransfers([]);
    }
    if (needsAuditLogs) {
      unsubs.push(subscribeStaffAuditLogs(restaurantId, setAuditLogs, () => {}));
    } else {
      setAuditLogs([]);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [
    restaurantId,
    restaurant?.operationsConfig?.managerPermissions,
    staff?.uid,
    staff?.role,
    staff?.allowedScreens,
    staff?.effectivePermissions,
    staff?.permissionOverrides,
    staff?.revokedPermissions,
  ]);

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

  const effectiveCaptainScreens = useMemo(
    () => buildEffectiveCaptainScreens(dynamicStations),
    [dynamicStations]
  );

  const opsConfig = useMemo(() => getResolvedOperationsConfig(restaurant), [restaurant]);
  const managerPerms = opsConfig.managerPermissions;

  const detectedIdentifier = useMemo(() => {
    if (!identifier.trim()) return null;
    const c = classifyLoginIdentifier(identifier);
    return isEn
      ? c.type === 'email'
        ? 'Email'
        : c.type === 'phone'
          ? 'Phone Number'
          : 'Username'
      : c.type === 'email'
        ? 'بريد إلكتروني'
        : c.type === 'phone'
          ? 'رقم هاتف'
          : 'اسم مستخدم';
  }, [identifier, isEn]);

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
      const initial = resolveInitialScreenWithQuery(restaurant, loggedStaff);
      setActiveScreen(initial);
      if (loggedStaff.role === 'manager') {
        setManagerMode('supervision');
      } else {
        setManagerMode('screen');
      }
      setPassword('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : isEn ? 'Could not sign in.' : 'تعذر تسجيل الدخول.';
      if (msg.includes('تم إيقاف شاشتك') || msg.toLowerCase().includes('suspended')) {
        setSuspendedNotice(msg);
      }
      setLoginError(msg);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleScreenChange = (
    scr: StaffScreen,
    opts?: { supervisory?: boolean; coveringStaffName?: string; captainScreenId?: string }
  ) => {
    if (!restaurant || !staff) return;
    const effPerms = resolveEffectiveStaffPermissions(staff, managerPerms);
    const effective = computeEffectiveStaffScreens(staff, effPerms, effectiveStations);
    if (!effective.includes(scr)) return;
    setActiveScreen(scr);
    if (opts?.captainScreenId) {
      setActiveCaptainScreenId(opts.captainScreenId);
    }
    setStationCreateIntent(null);
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

  const openManagerAddScreen = (
    returnMode: ManagerPortalMode,
    returnScreen?: StaffScreen,
    screenType?: StationScreenType
  ) => {
    const effPerms = staff ? resolveEffectiveStaffPermissions(staff, managerPerms) : null;
    if (effPerms && !effPerms.canManageStations) return;
    const returnLabel =
      returnMode === 'menu_editor'
        ? isEn
          ? 'Menu & Items'
          : 'المنيو والأصناف'
        : returnScreen === 'staff_management'
          ? isEn
            ? 'Staff & Permissions'
            : 'إدارة الكادر'
          : isEn
            ? 'Supervision'
            : 'لوحة الإشراف';
    setStationCreateIntent({
      key: Date.now(),
      returnMode,
      returnScreen,
      screenType,
      returnLabel,
    });
    if (staff?.role === 'manager') {
      setManagerMode('stations');
    } else {
      setActiveScreen('stations');
      setManagerMode('screen');
    }
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
      setPwError(
        err instanceof Error ? err.message : isEn ? 'Could not update password.' : 'تعذر تحديث كلمة المرور.'
      );
    } finally {
      setSavingPw(false);
    }
  };

  if (loadingRest || !authReady || (authUid && loadingStaff)) {
    return (
      <div
        dir={dir}
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: shellTheme.canvasBg, color: shellTheme.canvasText }}
      >
        <div className="text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: shellTheme.accentHex }} />
          <p className="text-xs sm:text-sm font-bold" style={{ color: shellTheme.mutedText }}>
            {isEn ? 'Loading Staff Portal...' : 'جاري تحميل بوابة الكادر...'}
          </p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div
        dir={dir}
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: shellTheme.canvasBg, color: shellTheme.canvasText }}
      >
        <div
          className={`max-w-md w-full border p-6 text-center space-y-4 ${shellRadius.card}`}
          style={{
            backgroundColor: shellTheme.surfaceBg,
            borderColor: shellTheme.surfaceBorder,
            color: shellTheme.surfaceText,
            boxShadow: shellTheme.cardShadow,
          }}
        >
          <div className="flex justify-end">
            <LanguageToggleButton compact />
          </div>
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h1 className="text-lg font-extrabold" style={{ color: shellTheme.surfaceText }}>
            {isEn ? 'Restaurant Not Found' : 'المطعم غير موجود'}
          </h1>
          <p className="text-xs" style={{ color: shellTheme.mutedText }}>
            {isEn ? (
              <>
                Check the restaurant staff portal URL (<span dir="ltr">/staff/{slug}</span>).
              </>
            ) : (
              <>
                تأكد من صحة رابط صفحة الكادر الخاص بالمطعم (<span dir="ltr">/staff/{slug}</span>).
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className={`min-h-[42px] px-4 py-2.5 text-xs font-extrabold cursor-pointer ${shellRadius.button}`}
            style={{ backgroundColor: shellTheme.accentHex, color: shellTheme.accentTextHex }}
          >
            {t.nav.home}
          </button>
        </div>
      </div>
    );
  }

  const displayRestName = loc(restaurant.name, restaurant.name_en);

  // Dedicated Suspension Block Screen
  if (suspendedNotice && !staff) {
    return (
      <div
        dir={dir}
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: shellTheme.canvasBg, color: shellTheme.canvasText }}
      >
        <div
          className="max-w-md w-full border-2 border-rose-300 rounded-3xl p-6 sm:p-7 shadow-xl text-center space-y-4"
          style={{ backgroundColor: shellTheme.surfaceBg, color: shellTheme.surfaceText }}
        >
          <div className="flex justify-end">
            <LanguageToggleButton compact />
          </div>
          <span className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </span>
          <div className="space-y-1">
            <h1 className="text-lg font-extrabold" style={{ color: shellTheme.surfaceText }}>
              {displayRestName}
            </h1>
            <p className="text-xs font-bold text-rose-700">
              {isEn ? 'Access to this screen has been restricted' : 'تم تقييد الدخول لهذه الشاشة'}
            </p>
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
                className={`min-h-[42px] px-4 py-2 text-xs font-extrabold cursor-pointer ${shellRadius.button}`}
                style={{ backgroundColor: shellTheme.accentHex, color: shellTheme.accentTextHex }}
              >
                {isEn ? 'Sign Out & Return' : 'تسجيل الخروج والعودة'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSuspendedNotice(null)}
              className={`min-h-[42px] px-4 py-2 border text-xs font-bold cursor-pointer ${shellRadius.button}`}
              style={{
                backgroundColor: shellTheme.surfaceSubtleBg,
                borderColor: shellTheme.surfaceBorder,
                color: shellTheme.surfaceText,
              }}
            >
              {isEn ? 'Sign in with Another Account' : 'الدخول بحساب آخر'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Forced password change screen (only if mustChangePassword === true)
  if (staff && staff.mustChangePassword) {
    return (
      <div
        dir={dir}
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: shellTheme.canvasBg, color: shellTheme.canvasText }}
      >
        <div
          className="max-w-md w-full border rounded-3xl p-6 sm:p-7 space-y-5"
          style={{
            backgroundColor: shellTheme.surfaceBg,
            borderColor: shellTheme.surfaceBorder,
            color: shellTheme.surfaceText,
            boxShadow: shellTheme.cardShadow,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold"
              style={{
                backgroundColor: shellTheme.surfaceSubtleBg,
                borderColor: shellTheme.surfaceBorder,
                color: shellTheme.highlightHex || '#E8833A',
              }}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isEn ? 'Password Update Required' : 'تحديث كلمة المرور مطلوب'}</span>
            </span>
            <LanguageToggleButton compact />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-extrabold" style={{ color: shellTheme.surfaceText }}>
              {isEn ? `Welcome, ${staff.name}` : `مرحباً ${staff.name}`}
            </h1>
            <p className="text-xs" style={{ color: shellTheme.mutedText }}>
              {isEn
                ? `For account security, please set a permanent strong password before starting work at ${displayRestName}.`
                : `لأمان حسابك، يرجى تعيين كلمة مرور دائمة وقوية قبل بدء العمل في ${displayRestName}.`}
            </p>
          </div>

          {pwError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
              {pwError}
            </div>
          )}

          <form onSubmit={handleForcedPasswordSubmit} className="space-y-3">
            <label className="block space-y-1 text-xs font-bold" style={{ color: shellTheme.surfaceText }}>
              <span>
                {isEn
                  ? 'New Password (8+ letters & numbers) *'
                  : 'كلمة المرور الجديدة (8+ أحرف وأرقام) *'}
              </span>
              <input
                type="password"
                required
                dir="ltr"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
                style={{
                  backgroundColor: shellTheme.surfaceSubtleBg,
                  borderColor: shellTheme.surfaceBorder,
                  color: shellTheme.surfaceText,
                }}
              />
            </label>
            <label className="block space-y-1 text-xs font-bold" style={{ color: shellTheme.surfaceText }}>
              <span>{isEn ? 'Confirm New Password *' : 'تأكيد كلمة المرور الجديدة *'}</span>
              <input
                type="password"
                required
                dir="ltr"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
                style={{
                  backgroundColor: shellTheme.surfaceSubtleBg,
                  borderColor: shellTheme.surfaceBorder,
                  color: shellTheme.surfaceText,
                }}
              />
            </label>
            <button
              type="submit"
              disabled={savingPw}
              className={`w-full min-h-[44px] text-sm font-extrabold cursor-pointer disabled:opacity-50 ${shellRadius.button}`}
              style={{
                backgroundColor: shellTheme.accentHex,
                color: shellTheme.accentTextHex,
              }}
            >
              {savingPw
                ? isEn
                  ? 'Saving...'
                  : 'جاري الحفظ...'
                : isEn
                  ? 'Save Password & Enter'
                  : 'حفظ كلمة المرور والدخول'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Staff Login View (Not logged in or signed in with non-staff/other-tenant account)
  if (!staff) {
    return (
      <div
        dir={dir}
        className="min-h-screen flex flex-col justify-between p-4 sm:p-6"
        style={{ backgroundColor: shellTheme.canvasBg, color: shellTheme.canvasText }}
      >
        <header className="max-w-4xl w-full mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {restaurant.logoUrl ? (
              <img
                src={restaurant.logoUrl}
                alt={displayRestName}
                className="w-9 h-9 rounded-xl object-cover border"
                style={{
                  borderColor: shellTheme.surfaceBorder,
                  backgroundColor: shellTheme.surfaceBg,
                }}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm"
                style={{
                  backgroundColor: shellTheme.sidebarBg,
                  color: shellTheme.highlightHex || '#E8833A',
                }}
              >
                <ShieldCheck className="w-5 h-5" />
              </div>
            )}
            <div>
              <p className="text-sm font-extrabold" style={{ color: shellTheme.canvasText }}>
                {displayRestName}
              </p>
              <p className="text-[11px]" style={{ color: shellTheme.mutedText }}>
                {isEn ? 'Staff & Operations Portal' : 'بوابة دخول فريق العمل والكادر'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageToggleButton variant={shellTheme.isDarkShell ? 'dark' : 'light'} compact />
            <PWAInstallButton variant="compact" />
          </div>
        </header>

        <main className="max-w-md w-full mx-auto my-8 space-y-4">
          {mismatchAuthNotice && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-2.5 text-xs text-amber-950">
              <p className="font-extrabold">
                {isEn
                  ? 'The currently signed-in browser account does not have active staff access for this restaurant.'
                  : 'الحساب المسجّل حالياً في المتصفح لا يملك صلاحية كادر فعّالة لهذا المطعم.'}
              </p>
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-950 text-white font-bold cursor-pointer"
              >
                {isEn ? 'Sign Out to Staff Login' : 'تسجيل الخروج للعودة لدخول الكادر'}
              </button>
            </div>
          )}

          <div
            className="border rounded-3xl p-6 sm:p-7 space-y-5"
            style={{
              backgroundColor: shellTheme.surfaceBg,
              borderColor: shellTheme.surfaceBorder,
              color: shellTheme.surfaceText,
              boxShadow: shellTheme.cardShadow,
            }}
          >
            <div className="space-y-1">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold"
                style={{
                  backgroundColor: shellTheme.surfaceSubtleBg,
                  borderColor: shellTheme.surfaceBorder,
                  color: shellTheme.accentHex,
                }}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isEn ? 'Secure Isolated Restaurant Access' : 'دخول آمن ومعزول للمطعم'}</span>
              </span>
              <h1 className="text-xl font-extrabold pt-1" style={{ color: shellTheme.surfaceText }}>
                {isEn ? `${displayRestName} — Staff Sign In` : `${displayRestName} — دخول الكادر`}
              </h1>
              <p className="text-xs leading-relaxed" style={{ color: shellTheme.mutedText }}>
                {isEn ? (
                  <>
                    Sign in using your <strong>username</strong>, <strong>phone number</strong>, or{' '}
                    <strong>email</strong> and password.
                  </>
                ) : (
                  <>
                    سجّل الدخول باستخدام <strong>اسم المستخدم</strong> أو <strong>رقم الهاتف</strong> أو{' '}
                    <strong>البريد الإلكتروني</strong> وكلمة المرور.
                  </>
                )}
              </p>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <label className="block space-y-1.5 text-xs font-bold" style={{ color: shellTheme.surfaceText }}>
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {isEn
                      ? 'Username, Phone Number, or Email *'
                      : 'اسم المستخدم أو رقم الهاتف أو البريد الإلكتروني *'}
                  </span>
                  {detectedIdentifier && (
                    <span className="text-[11px] font-extrabold" style={{ color: shellTheme.highlightHex || '#E8833A' }}>
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
                  className="w-full px-3.5 py-3 rounded-xl border text-sm font-mono-num focus:outline-none"
                  style={{
                    backgroundColor: shellTheme.surfaceSubtleBg,
                    borderColor: shellTheme.surfaceBorder,
                    color: shellTheme.surfaceText,
                  }}
                />
              </label>

              <label className="block space-y-1.5 text-xs font-bold" style={{ color: shellTheme.surfaceText }}>
                <span>{isEn ? 'Password *' : 'كلمة المرور *'}</span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    dir="ltr"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-3 rounded-xl border text-sm focus:outline-none"
                    style={{
                      backgroundColor: shellTheme.surfaceSubtleBg,
                      borderColor: shellTheme.surfaceBorder,
                      color: shellTheme.surfaceText,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={isEn ? 'Show or hide password' : 'إظهار أو إخفاء كلمة المرور'}
                    className="absolute inset-y-0 end-2 px-2 flex items-center cursor-pointer"
                    style={{ color: shellTheme.mutedText }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={loggingIn}
                className={`w-full min-h-[46px] px-4 py-3 text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${shellRadius.button}`}
                style={{
                  backgroundColor: shellTheme.accentHex,
                  color: shellTheme.accentTextHex,
                }}
              >
                {loggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isEn ? 'Verifying & Signing In...' : 'جاري التحقق والدخول...'}</span>
                  </>
                ) : (
                  <span>{isEn ? 'Sign In & Start Shift' : 'تسجيل الدخول لبدء العمل'}</span>
                )}
              </button>
            </form>

            <div className="pt-3 border-t text-[11px] leading-relaxed" style={{ borderColor: shellTheme.surfaceBorder, color: shellTheme.mutedText }}>
              {isEn ? (
                <>
                  Forgot your password? Ask your restaurant manager to issue a <strong>new QR invite link</strong> or send a password reset email.
                </>
              ) : (
                <>
                  هل نسيت كلمة المرور؟ اطلب من مدير المطعم إصدار <strong>رابط دعوة QR جديد</strong> أو إرسال رابط استعادة للبريد الإلكتروني.
                </>
              )}
            </div>
          </div>
        </main>

        <footer className="text-center text-[11px]" style={{ color: shellTheme.mutedText }}>
          {displayRestName} · {isEn ? 'Staff Operations Portal' : 'بوابة تشغيل الكادر'}
        </footer>
      </div>
    );
  }

  // Authenticated Active Staff Workspace (strictly screen-isolated)
  const roleMeta = STAFF_ROLE_META[staff.role] || STAFF_ROLE_META.custom;
  const isManager = staff.role === 'manager';
  const isHallManager = staff.role === 'hall_manager';
  const effectivePerms = resolveEffectiveStaffPermissions(staff, managerPerms);
  const canManageStations = effectivePerms.canManageStations;
  const allowedScreens = computeEffectiveStaffScreens(
    staff,
    effectivePerms,
    effectiveStations
  );
  const safeCurrentScreen: StaffScreen = allowedScreens.includes(activeScreen)
    ? activeScreen
    : allowedScreens[0] || (isHallManager ? 'hall_manager' : 'cashier');

  const allowedCaptainScreenList: StationMeta[] = (() => {
    if (effectiveCaptainScreens.length === 0) return [];
    if (isManager) return effectiveCaptainScreens;
    const explicitCapIds = (staff.allowedCaptainScreens || [])
      .map((id) => cleanStationId(id))
      .filter(Boolean);
    if (explicitCapIds.length > 0) {
      return effectiveCaptainScreens.filter((c) => explicitCapIds.includes(cleanStationId(c.stationId)));
    }
    return effectiveCaptainScreens;
  })();

  const callerCeiling: ActorDelegationCeiling = {
    isUnbounded: false,
    permissions: effectivePerms,
    allowedScreens,
    allowedStations: staff.allowedStations || [],
    allowedCaptainScreens: allowedCaptainScreenList.map((c) => c.stationId),
  };

  const activeCaptainScreenMeta: StationMeta | undefined =
    allowedCaptainScreenList.length > 0
      ? allowedCaptainScreenList.find((c) => c.stationId === activeCaptainScreenId) ||
        allowedCaptainScreenList[0]
      : undefined;

  const currentScreenMeta = getScreenMetaDynamic(safeCurrentScreen, effectiveStations);
  const currentStationId = screenToStationId(safeCurrentScreen)
    ? cleanStationId(screenToStationId(safeCurrentScreen) || '')
    : undefined;
  const currentShiftKey =
    safeCurrentScreen === 'captain' && activeCaptainScreenMeta
      ? activeCaptainScreenMeta.stationId
      : currentStationId || safeCurrentScreen;

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

  const activePortalUi =
    isManager
      ? managerUi
      : safeCurrentScreen === 'captain' || safeCurrentScreen === 'hall_manager'
        ? captainUi
        : cashierUi;
  const portalTheme = activePortalUi.theme;

  const isNonShiftManagementScreen =
    safeCurrentScreen === 'staff_management' ||
    safeCurrentScreen === 'job_titles' ||
    safeCurrentScreen === 'stations' ||
    safeCurrentScreen === 'menu_editor' ||
    safeCurrentScreen === 'shift_reports' ||
    safeCurrentScreen === 'customers' ||
    safeCurrentScreen === 'hall_assignments' ||
    safeCurrentScreen === 'halls' ||
    safeCurrentScreen === 'hall_manager';

  const canShowShiftBar =
    !isNonShiftManagementScreen &&
    (!isManager || managerMode === 'screen');

  // Build ordered navigation list for Manager & Staff respecting UI Studio order/labels while enforcing RBAC
  const orderedManagerNavIds = (() => {
    const baseAllowed = [
      ...(isManager ? ['supervision'] : []),
      ...allowedScreens,
    ];
    if (!isManager) return allowedScreens;
    const preferredOrder = managerUi.orderedButtonIds;
    const seen = new Set<string>();
    const result: string[] = [];
    for (const id of preferredOrder) {
      if (baseAllowed.includes(id) && !seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
    for (const id of baseAllowed) {
      if (!seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
    return result;
  })();

  return (
    <div
      dir={dir}
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: portalTheme.canvasBg, color: portalTheme.canvasText }}
    >
      {/* Staff Top Operational Header */}
      <header
        className="print:hidden border-b px-3 sm:px-6 py-3 sticky top-0 z-30"
        style={{
          backgroundColor: portalTheme.headerBg,
          borderColor: portalTheme.headerBorder,
          color: portalTheme.headerText,
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between gap-2.5 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {restaurant.logoUrl ? (
                <img
                  src={restaurant.logoUrl}
                  alt={displayRestName}
                  className={`w-9 h-9 object-cover border shrink-0 ${activePortalUi.radiusClasses.button}`}
                  style={{ borderColor: portalTheme.surfaceBorder }}
                />
              ) : (
                <div
                  className={`w-9 h-9 flex items-center justify-center shrink-0 ${activePortalUi.radiusClasses.button}`}
                  style={{
                    backgroundColor: portalTheme.sidebarBg,
                    color: getSidebarHighlightHex(portalTheme),
                  }}
                >
                  <LayoutGrid className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-extrabold leading-snug" style={{ color: portalTheme.headerText }}>
                    {displayRestName}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md border text-[11px] font-extrabold ${roleMeta.badgeClass}`}
                  >
                    {staff.jobTitle ||
                      (staff.jobTitleNames && staff.jobTitleNames.length > 0
                        ? staff.jobTitleNames.join(' + ')
                        : '') ||
                      (isEn ? roleMeta.labelEn : roleMeta.labelAr)}
                  </span>
                </div>
                <p className="text-xs leading-snug" style={{ color: portalTheme.mutedText }}>
                  {staff.name}
                  {staff.hallName ? ` · ${isEn ? 'Hall:' : 'الصالة:'} ${staff.hallName}` : ''}
                </p>
              </div>
            </div>

            <div className="flex lg:hidden items-center gap-1.5 shrink-0">
              <LanguageToggleButton variant={portalTheme.isDarkShell ? 'dark' : 'light'} compact />
            </div>
          </div>

          {/* Navigation Strip & Utility Actions */}
          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2">
            {(isManager || orderedManagerNavIds.length > 1) && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
                {orderedManagerNavIds.map((navId) => {
                  if (isManager && navId === 'supervision') {
                    const isActive = managerMode === 'supervision';
                    return (
                      <button
                        key="supervision"
                        type="button"
                        onClick={() => {
                          setManagerMode('supervision');
                          setSupervisoryOverride(null);
                        }}
                        className={`min-h-[44px] px-3.5 py-2 text-xs sm:text-[13px] font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors border ${activePortalUi.radiusClasses.button}`}
                        style={
                          isActive
                            ? {
                                backgroundColor: portalTheme.accentHex,
                                borderColor: portalTheme.accentHex,
                                color: portalTheme.accentTextHex,
                              }
                            : {
                                backgroundColor: portalTheme.surfaceSubtleBg,
                                borderColor: portalTheme.surfaceBorder,
                                color: portalTheme.surfaceText,
                              }
                        }
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>
                          {managerUi.getButtonLabel(
                            'supervision',
                            lang,
                            isEn ? 'Supervision' : 'لوحة الإشراف'
                          )}
                        </span>
                      </button>
                    );
                  }

                  const scr = navId as StaffScreen;
                  const Icon = getScreenIcon(scr, effectiveStations);
                  const isActive =
                    (isManager && managerMode === scr) ||
                    (managerMode === 'screen' && safeCurrentScreen === scr);
                  const meta = getScreenMetaDynamic(scr, effectiveStations);
                  const fallbackShort = isEn ? meta.shortEn : meta.shortAr;
                  const labelText = isManager
                    ? managerUi.getButtonLabel(scr, lang, fallbackShort)
                    : fallbackShort;
                  return (
                    <button
                      key={scr}
                      type="button"
                      onClick={() => {
                        if (
                          isManager &&
                          (scr === 'stations' || scr === 'menu_editor' || scr === 'shift_reports')
                        ) {
                          setStationCreateIntent(null);
                          setManagerMode(scr);
                          setSupervisoryOverride(null);
                          setActiveScreen(scr);
                        } else {
                          handleScreenChange(scr);
                        }
                      }}
                      className={`min-h-[44px] px-3.5 py-2 text-xs sm:text-[13px] font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors border ${activePortalUi.radiusClasses.button}`}
                      style={
                        isActive
                          ? {
                              backgroundColor: portalTheme.accentHex,
                              borderColor: portalTheme.accentHex,
                              color: portalTheme.accentTextHex,
                            }
                          : {
                              backgroundColor: portalTheme.surfaceSubtleBg,
                              borderColor: portalTheme.surfaceBorder,
                              color: portalTheme.surfaceText,
                            }
                      }
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{labelText}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <LanguageToggleButton variant={portalTheme.isDarkShell ? 'dark' : 'light'} compact />
              <PWAInstallButton variant="outline" />
              <button
                type="button"
                onClick={() => setSignOutConfirmOpen(true)}
                className={`min-h-[38px] px-3 py-2 border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${activePortalUi.radiusClasses.button}`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t.admin.signOut}</span>
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
            screenLabel={isEn ? currentScreenMeta.shortEn : currentScreenMeta.shortAr}
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
            canManageShifts={effectivePerms.canManageShifts}
          />
        )}

        {isManager && managerMode === 'supervision' ? (
          <ManagerSupervisionDashboard
            restaurant={restaurant}
            actor={actor}
            activeShifts={allActiveShifts}
            dynamicStations={dynamicStations}
            treasuryTransfers={treasuryTransfers}
            effectivePermissions={effectivePerms}
            onNavigateScreen={(scr, opts) => handleScreenChange(scr, opts)}
            onOpenStations={
              canManageStations
                ? () => {
                    setStationCreateIntent(null);
                    setManagerMode('stations');
                  }
                : undefined
            }
            onOpenAssignments={
              effectivePerms.canManageHallAssignments
                ? () => handleScreenChange('hall_assignments')
                : undefined
            }
            onRestaurantUpdated={(updated) => setRestaurant(updated)}
          />
        ) : ((isManager && managerMode === 'stations') || safeCurrentScreen === 'stations') && canManageStations ? (
          <StationsManagerTab
            restaurant={restaurant}
            actor={actor}
            activeShifts={allActiveShifts}
            createIntent={stationCreateIntent}
            onGoHome={() => {
              setStationCreateIntent(null);
              if (isManager) {
                setManagerMode('supervision');
              } else {
                handleScreenChange(allowedScreens.find((s) => s !== 'stations') || 'cashier');
              }
            }}
            onReturnAfterCreate={() => {
              const retMode = stationCreateIntent?.returnMode;
              const retScreen = stationCreateIntent?.returnScreen;
              setStationCreateIntent(null);
              if (retMode === 'screen' && retScreen) {
                setActiveScreen(retScreen);
                setManagerMode('screen');
              } else if (retMode) {
                setManagerMode(retMode);
              }
            }}
            onCancelReturn={() => {
              const retMode = stationCreateIntent?.returnMode;
              const retScreen = stationCreateIntent?.returnScreen;
              setStationCreateIntent(null);
              if (retMode === 'screen' && retScreen) {
                setActiveScreen(retScreen);
                setManagerMode('screen');
              } else if (retMode) {
                setManagerMode(retMode);
              }
            }}
          />
        ) : ((isManager && managerMode === 'menu_editor') || safeCurrentScreen === 'menu_editor') &&
          (effectivePerms.canEditMenu || effectivePerms.canPauseItems) ? (
          <MenuBuilderTab
            restaurant={restaurant}
            canEditMenu={effectivePerms.canEditMenu}
            canPauseItems={effectivePerms.canPauseItems}
            onOpenAddScreen={
              canManageStations
                ? () =>
                    openManagerAddScreen(
                      isManager ? 'menu_editor' : 'screen',
                      isManager ? undefined : 'menu_editor',
                      'prep'
                    )
                : undefined
            }
          />
        ) : ((isManager && managerMode === 'shift_reports') || safeCurrentScreen === 'shift_reports') &&
          effectivePerms.canViewShiftReports ? (
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
            {safeCurrentScreen === 'staff_management' && effectivePerms.canManageStaff && (
              <StaffManagementTab
                restaurant={restaurant}
                mode="manager"
                actor={actor}
                actorCeiling={callerCeiling}
                onRestaurantUpdated={(updated) => setRestaurant(updated)}
                onOpenJobTitles={() => handleScreenChange('job_titles')}
                onOpenAddScreen={
                  canManageStations
                    ? (scrType) => openManagerAddScreen('screen', 'staff_management', scrType)
                    : undefined
                }
              />
            )}

            {safeCurrentScreen === 'job_titles' && effectivePerms.canManageStaff && (
              <JobTitlesTab
                restaurant={restaurant}
                mode="manager"
                actor={actor}
                actorCeiling={callerCeiling}
                onBack={() => handleScreenChange('staff_management')}
                onGoHome={() =>
                  isManager
                    ? setManagerMode('supervision')
                    : handleScreenChange(allowedScreens.find((s) => s !== 'job_titles') || 'cashier')
                }
              />
            )}

            {safeCurrentScreen === 'customers' && effectivePerms.canManageCustomers && (
              <CustomersCrmTab
                restaurant={restaurant}
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
                effectivePermissions={effectivePerms}
                activeCashierShift={activeCashierShift}
                allShifts={allRestaurantShifts}
                staffList={restaurantStaffList}
                expenses={drawerExpenses}
                supervisoryMode={isSupervisoryHere}
                coveringStaffName={coveringName}
                hideHistoryArchive={!effectivePerms.canViewShiftReports}
                openHandoverSignal={openHandoverSignal}
                onOpenShiftReports={
                  effectivePerms.canViewShiftReports
                    ? () => {
                        if (isManager) {
                          setManagerMode('shift_reports');
                        } else {
                          handleScreenChange('shift_reports');
                        }
                      }
                    : undefined
                }
                onRestaurantUpdated={(updated) => setRestaurant(updated)}
              />
            )}

            {currentStationId && (
              <LiveOrdersTab
                restaurant={restaurant}
                allowedStations={[currentStationId]}
                initialStation={currentStationId}
                staffMode
                actor={actor}
                effectivePermissions={effectivePerms}
                supervisoryMode={isSupervisoryHere}
                coveringStaffName={coveringName}
              />
            )}

            {safeCurrentScreen === 'captain' && (
              <div className="space-y-3">
                {allowedCaptainScreenList.length > 1 && (
                  <div
                    className={`border p-2.5 flex flex-wrap items-center gap-2 ${activePortalUi.radiusClasses.card}`}
                    style={{
                      backgroundColor: portalTheme.surfaceBg,
                      borderColor: portalTheme.surfaceBorder,
                    }}
                  >
                    <span className="text-[11px] font-extrabold px-2" style={{ color: portalTheme.mutedText }}>
                      {isEn ? 'Captain Screen:' : 'شاشة الكابتن:'}
                    </span>
                    {allowedCaptainScreenList.map((cap) => {
                      const active = activeCaptainScreenMeta?.stationId === cap.stationId;
                      return (
                        <button
                          key={cap.stationId}
                          type="button"
                          onClick={() => setActiveCaptainScreenId(cap.stationId)}
                          className={`min-h-[36px] px-3 py-1.5 text-xs font-extrabold border inline-flex items-center gap-1.5 cursor-pointer ${activePortalUi.radiusClasses.button}`}
                          style={
                            active
                              ? {
                                  backgroundColor: cap.color || portalTheme.accentHex,
                                  borderColor: cap.color || portalTheme.accentHex,
                                  color: '#FFFFFF',
                                }
                              : {
                                  backgroundColor: portalTheme.surfaceSubtleBg,
                                  borderColor: portalTheme.surfaceBorder,
                                  color: portalTheme.surfaceText,
                                }
                          }
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>{isEn ? cap.shortLabel_en : cap.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <CaptainWaiterTab
                  restaurant={restaurant}
                  captainScreenMeta={activeCaptainScreenMeta}
                  defaultHallName={staff.hallName}
                  staffMode
                  captainUid={staff.uid}
                  staffRole={staff.role}
                  actor={actor}
                  effectivePermissions={effectivePerms}
                  onRestaurantUpdated={(updated) => setRestaurant(updated)}
                />
              </div>
            )}

            {safeCurrentScreen === 'hall_manager' && (
              <HallManagerConsole
                restaurant={restaurant}
                staff={staff}
                actor={actor}
                activeShifts={allActiveShifts}
                effectivePermissions={effectivePerms}
                onOpenAssignments={
                  effectivePerms.canManageHallAssignments
                    ? () => handleScreenChange('hall_assignments')
                    : undefined
                }
                onOpenHalls={
                  effectivePerms.canManageHalls
                    ? () => handleScreenChange('halls')
                    : undefined
                }
              />
            )}

            {safeCurrentScreen === 'hall_assignments' && effectivePerms.canManageHallAssignments && (
              <CaptainAssignmentsTab
                restaurant={restaurant}
                actor={actor}
                staffMembers={restaurantStaffList}
                activeShifts={allActiveShifts}
                captainStations={effectiveCaptainScreens}
                onBack={() =>
                  isManager
                    ? setManagerMode('supervision')
                    : handleScreenChange(
                        allowedScreens.includes('hall_manager')
                          ? 'hall_manager'
                          : allowedScreens.find((s) => s !== 'hall_assignments') || 'cashier'
                      )
                }
                onGoHome={() =>
                  isManager
                    ? setManagerMode('supervision')
                    : handleScreenChange(
                        allowedScreens.includes('hall_manager')
                          ? 'hall_manager'
                          : allowedScreens.find((s) => s !== 'hall_assignments') || 'cashier'
                      )
                }
              />
            )}

            {safeCurrentScreen === 'halls' && effectivePerms.canManageHalls && (
              <QrGeneratorTab restaurant={restaurant} />
            )}
          </>
        )}

        <div
          className={`lg:hidden pt-3 border-t flex flex-wrap items-center justify-between gap-2.5`}
          style={{ borderColor: portalTheme.surfaceBorder }}
        >
          <PWAInstallButton variant="compact" />
          <button
            type="button"
            onClick={() => setSignOutConfirmOpen(true)}
            className={`min-h-[44px] px-4 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${activePortalUi.radiusClasses.button}`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>{t.admin.signOut}</span>
          </button>
        </div>
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

