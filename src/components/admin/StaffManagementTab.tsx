import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Crown,
  Download,
  Edit3,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  PauseCircle,
  Plus,
  Printer,
  QrCode,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatFirestoreErrorMessage } from '../../lib/firebase';
import { subscribeHalls } from '../../lib/firestoreService';
import { ActorDelegationCeiling, subscribeJobTitles } from '../../lib/jobTitlesService';
import {
  getResolvedOperationsConfig,
  updateRestaurantOperationsConfig,
} from '../../lib/operationsService';
import { subscribeAllActiveRestaurantShifts } from '../../lib/shiftsService';
import {
  actorCoversTargetGrant,
  ALL_STAFF_PERMISSION_KEYS,
  computeCombinedJobTitleGrant,
  DEFAULT_HALL_MANAGER_PERMISSIONS,
  EMPTY_STAFF_PERMISSIONS,
  getDefaultScreensForRole,
  getManagerScreensForStations,
  getResolvedHallManagerPermissions,
  getScreenMetaDynamic,
  OWNER_FULL_PERMISSIONS,
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
  resolveEffectiveStaffPermissions,
  sanitizeEffectivePermissions,
  STAFF_ROLE_META,
} from '../../lib/staffAuthUtils';
import {
  canResetStaffViaEmail,
  CreatedStaffResult,
  createManagerOrStaffAccount,
  deleteRestaurantStaffMember,
  regenerateStaffInvite,
  resolveStaffSuspensionState,
  sendStaffPasswordResetByEmail,
  subscribeRestaurantStaff,
  subscribeStaffAuditLogs,
  suspendStaffMember,
  unsuspendStaffMember,
  updateStaffPermissionsAndProfile,
} from '../../lib/staffService';
import { subscribeRestaurantStations } from '../../lib/stationsService';
import {
  buildEffectiveCaptainScreens,
  buildEffectiveStations,
  cleanStationId,
  getStationIconComponent,
  screenToStationId,
  stationIdToScreen,
} from '../../lib/stationUtils';
import {
  EffectiveStaffPermissions,
  Hall,
  HallManagerPermissions,
  JobTitle,
  ManagerPermissions,
  Restaurant,
  RestaurantStation,
  StaffActorInfo,
  StaffAuditLog,
  StaffMember,
  StaffPermissionKey,
  StaffRole,
  StaffScreen,
  StaffShift,
  StationScreenType,
  SuspensionType,
} from '../../types/menu';
import { AuthorizedDomainsCard } from './AuthorizedDomainsCard';
import { StaffPortalShareCard } from './StaffPortalShareCard';
import { StationsManagerTab } from './StationsManagerTab';

interface StaffManagementTabProps {
  restaurant: Restaurant;
  mode: 'owner' | 'manager';
  actor: StaffActorInfo;
  actorCeiling?: ActorDelegationCeiling;
  onRestaurantUpdated?: (updated: Restaurant) => void;
  onOpenAddScreen?: (screenType?: StationScreenType) => void;
  onOpenJobTitles?: () => void;
}

const MANAGER_PERMISSION_LABELS: Array<{
  key: keyof ManagerPermissions;
  labelAr: string;
  labelEn: string;
  hintAr: string;
  hintEn: string;
}> = [
  {
    key: 'canEditMenu',
    labelAr: 'تعديل وإضافة أصناف المنيو',
    labelEn: 'Edit & Add Menu Items',
    hintAr: 'إنشاء وتعديل الأسعار والأصناف والتصنيفات',
    hintEn: 'Create and edit prices, dishes, and categories',
  },
  {
    key: 'canPauseItems',
    labelAr: 'إيقاف/تفعيل الأصناف المؤقت',
    labelEn: 'Pause / Resume Menu Items',
    hintAr: 'إخفاء صنف ناقص من المنيو وإعادة تفعيله',
    hintEn: 'Temporarily hide out-of-stock dishes and re-enable them',
  },
  {
    key: 'canEditOpenOrders',
    labelAr: 'تعديل طلبات الترابيزات المفتوحة',
    labelEn: 'Edit Open Table Orders',
    hintAr: 'إضافة/إزالة أصناف أو كتابة ملاحظات الطاولة',
    hintEn: 'Add/remove order items or write table notes',
  },
  {
    key: 'canCancelOpenOrders',
    labelAr: 'إلغاء الطلبات المفتوحة مع سبب',
    labelEn: 'Cancel Open Orders (With Reason)',
    hintAr: 'إلغاء طلب قيد التشغيل بتوثيق السبب',
    hintEn: 'Cancel an active order with a mandatory reason',
  },
  {
    key: 'canEditClosedChecks',
    labelAr: 'تعديل شيكات مغلقة قبل التسليم',
    labelEn: 'Edit Closed Checks Before Handover',
    hintAr: 'تصحيح فاتورة مغلقة في نفس الوردية قبل الإقفال',
    hintEn: 'Amend a settled check within the same open shift',
  },
  {
    key: 'canApplyInstantDiscount',
    labelAr: 'منح خصومات فورية خاصة',
    labelEn: 'Apply Instant Discounts',
    hintAr: 'خصم مبلغ أو نسبة مع تدوين السبب',
    hintEn: 'Apply fixed or percentage discount with reason',
  },
  {
    key: 'canViewShiftReports',
    labelAr: 'عرض تقرير الورديات اليومي',
    labelEn: 'View Daily Shift Reports',
    hintAr: 'متابعة الحضور والمبيعات وصافي الدرج',
    hintEn: 'Monitor attendance, sales, and drawer net totals',
  },
  {
    key: 'canEditDrawerFloat',
    labelAr: 'تعديل عهدة الدرج (الافتتاحية)',
    labelEn: 'Adjust Opening Drawer Float',
    hintAr: 'رفع أو خفض رصيد بداية الوردية للكاشير',
    hintEn: 'Increase or decrease cashier starting cash float',
  },
  {
    key: 'canManageStaff',
    labelAr: 'إضافة وترقية وإيقاف الموظفين',
    labelEn: 'Add, Promote & Suspend Staff',
    hintAr: 'تعيين وإيقاف (مؤقت/مفتوح) وفصل الموظفين',
    hintEn: 'Onboard, suspend (timed/indefinite), or remove staff',
  },
  {
    key: 'canConfigureOperations',
    labelAr: 'ضبط مواعيد الورديات وألوان الطاولات',
    labelEn: 'Configure Shift Slots & Table Colors',
    hintAr: 'تعديل جدول الورديات ووقت تأخير الترابيزة',
    hintEn: 'Adjust shift schedules and table overdue thresholds',
  },
  {
    key: 'canToggleScreenPrices',
    labelAr: 'إظهار/إخفاء الأسعار على الشاشات',
    labelEn: 'Show/Hide Prices on Screens',
    hintAr: 'التحكم بظهور الأسعار في المطبخ والبار والكابتن',
    hintEn: 'Control price visibility on Kitchen/Bar/Captain screens',
  },
  {
    key: 'canManageHalls',
    labelAr: 'إدارة الصالات وأكواد QR للطاولات',
    labelEn: 'Manage Halls & Table QR Codes',
    hintAr: 'إنشاء وتعديل الصالات وتوليد وطباعة باركود الترابيزات',
    hintEn: 'Create/edit halls and print table QR stands',
  },
  {
    key: 'canManageHallAssignments',
    labelAr: 'توزيع الكباتن على الصالات والطاولات',
    labelEn: 'Assign Captains to Halls & Tables',
    hintAr: 'توزيع الكباتن على الصالات والطاولات لكل وردية ومراقبة التغطية',
    hintEn: 'Assign floor captains to halls and tables per shift',
  },
  {
    key: 'canManageStations',
    labelAr: 'إدارة الشاشات والمحطات',
    labelEn: 'Manage Screens & Stations',
    hintAr: 'إضافة وتعديل وتعطيل وأرشفة محطات التحضير وشاشات الكابتن',
    hintEn: 'Create, edit, pause, and archive prep stations and captain screens',
  },
];

const HALL_MANAGER_PERMISSION_LABELS: Array<{
  key: keyof HallManagerPermissions;
  labelAr: string;
  labelEn: string;
  hintAr: string;
  hintEn: string;
}> = [
  {
    key: 'canManageHalls',
    labelAr: 'إدارة الصالات وأكواد QR للطاولات',
    labelEn: 'Manage Halls & Table QR',
    hintAr: 'إنشاء وتعديل وحذف الصالات وأرقام الطاولات وطباعة QR',
    hintEn: 'Create, edit, delete halls/tables and print QR codes',
  },
  {
    key: 'canManageHallAssignments',
    labelAr: 'توزيع الكباتن على الصالات والطاولات',
    labelEn: 'Captain Hall & Table Assignments',
    hintAr: 'تعيين الكباتن للصالات والطاولات في كل وردية ونسخ التوزيع',
    hintEn: 'Assign captains to halls/tables per shift and copy schedules',
  },
  {
    key: 'canMonitorFloorAndCalls',
    labelAr: 'مراقبة الصالات الحية ونداءات الطاولات',
    labelEn: 'Monitor Live Floor & Calls',
    hintAr: 'متابعة حالة كل الطاولات والرد على نداءات العملاء وطلبات الشيك',
    hintEn: 'Track all tables live and acknowledge/resolve service calls',
  },
  {
    key: 'canAddEditTableOrders',
    labelAr: 'إضافة وتعديل طلبات الطاولات',
    labelEn: 'Add & Edit Dine-In Orders',
    hintAr: 'تسجيل أصناف وطلبات طاولات وتعديل الطلبات المفتوحة من خريطة الصالات',
    hintEn: 'Submit and modify open dine-in orders directly from the floor drawer',
  },
  {
    key: 'canApplyInstantDiscount',
    labelAr: 'منح خصم فوري على الطلبات القائمة',
    labelEn: 'Instant Discount on Existing Orders',
    hintAr: 'تطبيق خصم فوري (بسبب إلزامي) ومفروض في قواعد قاعدة البيانات',
    hintEn: 'Apply instant discount (mandatory reason enforced by Firestore Rules)',
  },
  {
    key: 'canCancelOrders',
    labelAr: 'إلغاء الطلبات القائمة',
    labelEn: 'Cancel Open Orders',
    hintAr: 'إلغاء طلب مفتوح مع سبب موثق — مفروض في قواعد قاعدة البيانات',
    hintEn: 'Cancel open orders with documented reason (enforced by Firestore Rules)',
  },
  {
    key: 'canSettleChecks',
    labelAr: 'تقفيل الشيك والتحصيل',
    labelEn: 'Settle Checks & Collect Payment',
    hintAr: 'تحصيل كاش/فيزا وإغلاق شيك الطاولة — مفروض في قواعد قاعدة البيانات',
    hintEn: 'Collect payment and close table checks (enforced by Firestore Rules)',
  },
  {
    key: 'showPrices',
    labelAr: 'إظهار الأسعار وإجمالي الطاولات (إعداد عرض)',
    labelEn: 'Show Prices & Table Totals (UI Setting)',
    hintAr: 'إعداد عرض فقط: إظهار أو إخفاء أسعار الأصناف في لوحة مدير الصالات',
    hintEn: 'UI display setting: show or hide prices in Hall Manager Console',
  },
];

const AUDIT_LABELS_AR: Record<string, string> = {
  staff_created: 'إنشاء عضو كادر',
  staff_updated: 'تحديث بيانات / صلاحيات',
  staff_deleted: 'حذف عضو كادر',
  staff_suspended: 'إيقاف شاشة موظف',
  staff_unsuspended: 'رفع إيقاف موظف',
  staff_promoted: 'ترقية / تغيير وظيفة موظف',
  invite_created: 'إصدار دعوة QR',
  invite_used: 'تفعيل حساب بدعوة QR',
  password_changed: 'تغيير كلمة المرور',
  staff_login: 'تسجيل دخول كادر',
  order_created: 'إنشاء طلب',
  order_status_updated: 'تحديث حالة طلب',
  order_modified: 'تعديل طلب إداري',
  order_cancelled: 'إلغاء طلب بسبب',
  instant_discount_applied: 'خصم إداري فوري',
  menu_item_paused: 'إيقاف/تفعيل صنف بالمنيو',
  drawer_expense_added: 'مصروف من درج الكاشير',
  cash_handover_recorded: 'تسليم وردية وعهدة كاشير',
  treasury_transferred: 'توريد للخزنة الرئيسية',
  float_adjusted: 'تعديل عهدة الدرج',
  superadmin_shift_unlocked: 'فتح استثنائي للوردية (إدارة المنصة)',
  kds_item_updated: 'تحديث شاشة التحضير',
  table_closed: 'إقفال حساب طاولة',
  service_call_handled: 'تلبية نداء طاولة',
  hall_assignment_updated: 'تحديث توزيع الكباتن',
  job_title_created: 'إنشاء مسمى وظيفي',
  job_title_updated: 'تحديث مسمى وظيفي',
  job_title_deleted: 'حذف مسمى وظيفي',
  staff_permissions_updated: 'تحديث صلاحيات موظف',
  station_created: 'إضافة قسم تحضير',
  station_updated: 'تعديل قسم تحضير',
  station_deleted: 'حذف قسم تحضير',
  shift_started: 'بدء وردية',
  shift_ended: 'إنهاء وردية',
  station_uncovered_alert: 'تنبيه قسم بلا وردية',
  domain_verified: 'فحص نطاق المصادقة',
};

const AUDIT_LABELS_EN: Record<string, string> = {
  staff_created: 'Staff Member Created',
  staff_updated: 'Profile / Permissions Updated',
  staff_deleted: 'Staff Member Deleted',
  staff_suspended: 'Staff Access Suspended',
  staff_unsuspended: 'Staff Suspension Lifted',
  staff_promoted: 'Staff Role Updated / Promoted',
  invite_created: 'QR Invite Generated',
  invite_used: 'Account Activated via QR',
  password_changed: 'Password Changed',
  staff_login: 'Staff Sign-In',
  order_created: 'Order Created',
  order_status_updated: 'Order Status Updated',
  order_modified: 'Order Modified by Management',
  order_cancelled: 'Order Cancelled (With Reason)',
  instant_discount_applied: 'Instant Discount Applied',
  menu_item_paused: 'Menu Item Paused / Resumed',
  drawer_expense_added: 'Drawer Expense Recorded',
  cash_handover_recorded: 'Cashier Shift Handover',
  treasury_transferred: 'Transferred to Main Vault',
  float_adjusted: 'Drawer Float Adjusted',
  superadmin_shift_unlocked: 'Super Admin Shift Audit Unlock',
  kds_item_updated: 'Prep Station Item Updated',
  table_closed: 'Table Check Closed',
  service_call_handled: 'Service Call Handled',
  hall_assignment_updated: 'Captain Hall Assignment Updated',
  job_title_created: 'Job Title Created',
  job_title_updated: 'Job Title Updated',
  job_title_deleted: 'Job Title Deleted',
  staff_permissions_updated: 'Staff Permissions Updated',
  station_created: 'Prep Station Created',
  station_updated: 'Prep Station Updated',
  station_deleted: 'Prep Station Deleted',
  shift_started: 'Shift Started',
  shift_ended: 'Shift Ended',
  station_uncovered_alert: 'Uncovered Station Alert',
  domain_verified: 'Auth Domain Verified',
};

function formatAuditTime(ts: unknown, isEn: boolean): string {
  if (!ts) return isEn ? 'Just now' : 'الآن';
  let ms = 0;
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    ms = Number((ts as { seconds: number }).seconds) * 1000;
  } else if (ts instanceof Date) {
    ms = ts.getTime();
  }
  if (!ms) return isEn ? 'Just now' : 'الآن';
  return new Date(ms).toLocaleString(isEn ? 'en-US' : 'ar-EG-u-nu-latn', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StaffManagementTab({
  restaurant,
  mode,
  actor,
  actorCeiling,
  onRestaurantUpdated,
  onOpenAddScreen,
  onOpenJobTitles,
}: StaffManagementTabProps) {
  const { lang, dir, loc } = useLanguage();
  const isEn = lang === 'en';
  const restDisplayName = loc(restaurant.name, restaurant.name_en);

  const opsConfig = useMemo(() => getResolvedOperationsConfig(restaurant), [restaurant]);
  const [managerPermsOpen, setManagerPermsOpen] = useState(false);
  const [draftManagerPerms, setDraftManagerPerms] = useState<ManagerPermissions>(
    () => opsConfig.managerPermissions
  );
  const [savingManagerPerms, setSavingManagerPerms] = useState(false);

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [auditLogs, setAuditLogs] = useState<StaffAuditLog[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [dynamicStations, setDynamicStations] = useState<RestaurantStation[]>([]);
  const [activeShifts, setActiveShifts] = useState<StaffShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subView, setSubView] = useState<'members' | 'stations' | 'audit'>('members');
  const [roleFilter, setRoleFilter] = useState<'all' | StaffRole>('all');
  const [jobTitleFilter, setJobTitleFilter] = useState<string>('all');
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);

  // Suspension Modal State
  const [suspendTarget, setSuspendTarget] = useState<StaffMember | null>(null);
  const [suspendType, setSuspendType] = useState<SuspensionType>('timed');
  const [suspendHours, setSuspendHours] = useState<number>(24);
  const [suspendCustomUntil, setSuspendCustomUntil] = useState<string>('');
  const [suspendReason, setSuspendReason] = useState<string>('');
  const [suspending, setSuspending] = useState(false);

  // Form Modal State (Add Manager / Add Employee / Edit Staff)
  const [formOpen, setFormOpen] = useState(false);
  const [formKind, setFormKind] = useState<'manager' | 'employee' | 'edit'>('employee');
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);

  const [nameInput, setNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [jobTitleInput, setJobTitleInput] = useState('');
  const [selectedJobTitleIdsInput, setSelectedJobTitleIdsInput] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState<StaffRole>('cashier');
  const [hallIdInput, setHallIdInput] = useState('');
  const [allowedScreensInput, setAllowedScreensInput] = useState<StaffScreen[]>(['cashier']);
  const [allowedCaptainScreensInput, setAllowedCaptainScreensInput] = useState<string[]>([]);
  const [hallManagerPermsInput, setHallManagerPermsInput] = useState<HallManagerPermissions>(() => ({
    ...DEFAULT_HALL_MANAGER_PERMISSIONS,
  }));
  const [effectivePermissionsInput, setEffectivePermissionsInput] =
    useState<EffectiveStaffPermissions>(() => ({ ...EMPTY_STAFF_PERMISSIONS }));
  const [useCustomPermsOverride, setUseCustomPermsOverride] = useState(false);
  const [showGranularOverrides, setShowGranularOverrides] = useState(false);
  const [defaultScreenInput, setDefaultScreenInput] = useState<StaffScreen>('cashier');
  const [useOneTimeInvite, setUseOneTimeInvite] = useState(true);
  const [directPasswordInput, setDirectPasswordInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Action feedback
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Instant Invite QR Modal
  const [inviteModalData, setInviteModalData] = useState<CreatedStaffResult | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const inviteCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setDraftManagerPerms(opsConfig.managerPermissions);
  }, [opsConfig.managerPermissions]);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);

    const unsubStaff = subscribeRestaurantStaff(
      restaurant.id,
      (list) => {
        setStaffList(list);
        setLoading(false);
      },
      (err) => {
        setLoadError(formatFirestoreErrorMessage(err, isEn));
        setLoading(false);
      }
    );

    const unsubTitles = subscribeJobTitles(
      restaurant.id,
      setJobTitles,
      () => {}
    );

    const unsubAudit = subscribeStaffAuditLogs(
      restaurant.id,
      setAuditLogs,
      () => {}
    );

    const unsubHalls = subscribeHalls(
      restaurant.id,
      setHalls,
      () => {}
    );

    const unsubStations = subscribeRestaurantStations(
      restaurant.id,
      setDynamicStations,
      () => {}
    );

    const unsubShifts = subscribeAllActiveRestaurantShifts(
      restaurant.id,
      setActiveShifts,
      () => {}
    );

    return () => {
      unsubStaff();
      unsubTitles();
      unsubAudit();
      unsubHalls();
      unsubStations();
      unsubShifts();
    };
  }, [restaurant.id, isEn]);

  useEffect(() => {
    if (!inviteModalData?.inviteUrl || !inviteCanvasRef.current) return;
    QRCode.toCanvas(
      inviteCanvasRef.current,
      inviteModalData.inviteUrl,
      {
        width: 240,
        margin: 2,
        color: { dark: '#09090B', light: '#FFFFFF' },
      },
      () => {}
    );
  }, [inviteModalData]);

  const effectiveStations = useMemo(
    () => buildEffectiveStations(dynamicStations),
    [dynamicStations]
  );

  const effectiveCaptainScreens = useMemo(
    () => buildEffectiveCaptainScreens(dynamicStations),
    [dynamicStations]
  );

  const effectiveCeiling = useMemo<ActorDelegationCeiling>(() => {
    if (actorCeiling) return actorCeiling;
    if (mode === 'owner') {
      return {
        isUnbounded: true,
        permissions: { ...OWNER_FULL_PERMISSIONS },
        allowedScreens: [
          'staff_management',
          'job_titles',
          'cashier',
          'captain',
          'hall_manager',
          'hall_assignments',
          'halls',
          'stations',
          'menu_editor',
          'shift_reports',
          'customers',
          ...effectiveStations.map((s) => stationIdToScreen(s.stationId)),
        ],
        allowedStations: effectiveStations.map((s) => s.stationId),
        allowedCaptainScreens: effectiveCaptainScreens.map((c) => c.stationId),
      };
    }
    const mgrPerms = resolveEffectiveStaffPermissions(
      { role: 'manager', allowedScreens: ['staff_management', 'cashier'] },
      opsConfig.managerPermissions
    );
    return {
      isUnbounded: false,
      permissions: mgrPerms,
      allowedScreens: [
        'staff_management',
        'job_titles',
        'cashier',
        'captain',
        'hall_manager',
        ...(mgrPerms.canManageHallAssignments ? (['hall_assignments'] as StaffScreen[]) : []),
        ...(mgrPerms.canManageHalls ? (['halls'] as StaffScreen[]) : []),
        ...(mgrPerms.canManageStations ? (['stations'] as StaffScreen[]) : []),
        ...(mgrPerms.canEditMenu || mgrPerms.canPauseItems ? (['menu_editor'] as StaffScreen[]) : []),
        ...(mgrPerms.canViewShiftReports ? (['shift_reports'] as StaffScreen[]) : []),
        ...(mgrPerms.canManageCustomers ? (['customers'] as StaffScreen[]) : []),
        ...effectiveStations.map((s) => stationIdToScreen(s.stationId)),
      ],
      allowedStations: effectiveStations.map((s) => s.stationId),
      allowedCaptainScreens: effectiveCaptainScreens.map((c) => c.stationId),
    };
  }, [actorCeiling, mode, effectiveStations, effectiveCaptainScreens, opsConfig.managerPermissions]);

  const canManageStations =
    mode === 'owner' ||
    (effectiveCeiling.permissions.canManageStations &&
      opsConfig.managerPermissions.canManageStations !== false);

  const dynamicManagerScreens = useMemo(
    () =>
      getManagerScreensForStations(
        effectiveStations,
        opsConfig.managerPermissions.canManageHalls,
        opsConfig.managerPermissions.canManageHallAssignments !== false
      ),
    [
      effectiveStations,
      opsConfig.managerPermissions.canManageHalls,
      opsConfig.managerPermissions.canManageHallAssignments,
    ]
  );

  const dynamicEmployeeAssignableScreens = useMemo<StaffScreen[]>(() => {
    const base: StaffScreen[] = [
      'cashier',
      ...effectiveStations.map((st) => stationIdToScreen(st.stationId)),
      'captain',
      'hall_manager',
      'hall_assignments',
      'halls',
      'stations',
      'menu_editor',
      'shift_reports',
      'customers',
      'job_titles',
      'staff_management',
    ];
    if (effectiveCeiling.isUnbounded) return base;
    return base.filter((scr) => {
      if (effectiveCeiling.allowedScreens.includes(scr)) return true;
      const st = screenToStationId(scr);
      return st ? effectiveCeiling.allowedStations.includes(st) : false;
    });
  }, [effectiveStations, effectiveCeiling]);

  const activeShiftByStaffUid = useMemo(() => {
    const map = new Map<string, StaffShift[]>();
    activeShifts.forEach((sh) => {
      const list = map.get(sh.staffId) || [];
      list.push(sh);
      map.set(sh.staffId, list);
    });
    return map;
  }, [activeShifts]);

  const uncoveredStations = useMemo(() => {
    const covered = new Set<string>();
    activeShifts.forEach((sh) => {
      if (sh.stationId) covered.add(cleanStationId(sh.stationId));
    });
    return effectiveStations.filter((st) => !covered.has(cleanStationId(st.stationId)));
  }, [activeShifts, effectiveStations]);

  const managers = useMemo(
    () => staffList.filter((m) => m.role === 'manager'),
    [staffList]
  );

  const activeStaffCount = useMemo(
    () => staffList.filter((m) => m.isActive).length,
    [staffList]
  );

  const filteredStaff = useMemo(() => {
    return staffList.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (
        jobTitleFilter !== 'all' &&
        (!Array.isArray(m.jobTitleIds) || !m.jobTitleIds.includes(jobTitleFilter))
      ) {
        return false;
      }
      return true;
    });
  }, [staffList, roleFilter, jobTitleFilter]);

  const memberExceedsCeiling = (member: StaffMember): boolean => {
    if (effectiveCeiling.isUnbounded) return false;
    if (member.role === 'manager' && member.uid !== actor.uid) return true;
    const memberPerms = resolveEffectiveStaffPermissions(
      member,
      opsConfig.managerPermissions
    );
    const cov = actorCoversTargetGrant({
      actorIsUnbounded: false,
      actorPermissions: effectiveCeiling.permissions,
      actorScreens: effectiveCeiling.allowedScreens,
      actorStations: effectiveCeiling.allowedStations,
      targetPermissions: memberPerms,
      targetScreens: member.allowedScreens || [],
      targetStations: member.allowedStations || [],
    });
    return !cov.allowed;
  };

  const permAllowedInCeiling = (key: StaffPermissionKey): boolean => {
    if (effectiveCeiling.isUnbounded) return true;
    return effectiveCeiling.permissions[key] === true;
  };

  const openCreateManagerModal = () => {
    const defaults = resolveEffectiveStaffPermissions(
      { role: 'manager', allowedScreens: dynamicManagerScreens },
      opsConfig.managerPermissions
    );
    setFormKind('manager');
    setEditingMember(null);
    setNameInput('');
    setUsernameInput('');
    setPhoneInput('');
    setEmailInput('');
    setJobTitleInput(isEn ? 'Restaurant Operations Manager' : 'مدير تشغيل المطعم');
    setSelectedJobTitleIdsInput([]);
    setRoleInput('manager');
    setHallIdInput('');
    setAllowedScreensInput([...dynamicManagerScreens]);
    setAllowedCaptainScreensInput(effectiveCaptainScreens.map((c) => c.stationId));
    setEffectivePermissionsInput(defaults);
    setUseCustomPermsOverride(false);
    setShowGranularOverrides(false);
    setDefaultScreenInput('staff_management');
    setUseOneTimeInvite(true);
    setDirectPasswordInput('');
    setFormError(null);
    setFormOpen(true);
  };

  const openCreateEmployeeModal = () => {
    const defaults = getDefaultScreensForRole('cashier', effectiveStations);
    const defaultPerms = resolveEffectiveStaffPermissions(
      { role: 'cashier', allowedScreens: defaults.allowedScreens },
      opsConfig.managerPermissions
    );
    setFormKind('employee');
    setEditingMember(null);
    setNameInput('');
    setUsernameInput('');
    setPhoneInput('');
    setEmailInput('');
    setJobTitleInput('');
    setSelectedJobTitleIdsInput([]);
    setRoleInput('cashier');
    setHallIdInput('');
    setAllowedScreensInput(defaults.allowedScreens);
    setAllowedCaptainScreensInput([]);
    setHallManagerPermsInput({ ...DEFAULT_HALL_MANAGER_PERMISSIONS });
    setEffectivePermissionsInput(defaultPerms);
    setUseCustomPermsOverride(false);
    setShowGranularOverrides(false);
    setDefaultScreenInput(defaults.defaultScreen);
    setUseOneTimeInvite(true);
    setDirectPasswordInput('');
    setFormError(null);
    setFormOpen(true);
  };

  const openEditStaffModal = (member: StaffMember) => {
    setFormKind('edit');
    setEditingMember(member);
    setNameInput(member.name);
    setUsernameInput(member.username);
    setPhoneInput(member.phone);
    setEmailInput(member.email || '');
    setJobTitleInput(member.jobTitle || '');
    setSelectedJobTitleIdsInput(member.jobTitleIds || []);
    setRoleInput(member.role);
    setHallIdInput(member.hallId || '');
    const nextScreens: StaffScreen[] =
      member.allowedScreens && member.allowedScreens.length > 0
        ? [...member.allowedScreens]
        : ['cashier'];
    setAllowedScreensInput(nextScreens);
    setAllowedCaptainScreensInput(member.allowedCaptainScreens || []);
    setHallManagerPermsInput(getResolvedHallManagerPermissions(member.hallManagerPermissions));
    setEffectivePermissionsInput(
      resolveEffectiveStaffPermissions(member, opsConfig.managerPermissions)
    );
    setUseCustomPermsOverride(Boolean(member.effectivePermissions));
    setShowGranularOverrides(Boolean(member.effectivePermissions));
    const preferredDefault =
      member.defaultScreen && nextScreens.includes(member.defaultScreen)
        ? member.defaultScreen
        : nextScreens[0];
    setDefaultScreenInput(preferredDefault);
    setUseOneTimeInvite(false);
    setDirectPasswordInput('');
    setFormError(null);
    setFormOpen(true);
  };

  const handleToggleJobTitleSelection = (titleId: string) => {
    const nextIds = selectedJobTitleIdsInput.includes(titleId)
      ? selectedJobTitleIdsInput.filter((id) => id !== titleId)
      : [...selectedJobTitleIdsInput, titleId];
    setSelectedJobTitleIdsInput(nextIds);
    const chosenTitles = jobTitles.filter((jt) => nextIds.includes(jt.id));
    if (chosenTitles.length === 0) {
      return;
    }
    const combined = computeCombinedJobTitleGrant({
      selectedJobTitles: chosenTitles,
      ceiling: effectiveCeiling,
    });
    setRoleInput(combined.role);
    setJobTitleInput(combined.jobTitleDisplay);
    setAllowedScreensInput(
      combined.allowedScreens.length > 0
        ? combined.allowedScreens
        : ([effectiveCeiling.allowedScreens[0] || 'cashier'] as StaffScreen[])
    );
    setAllowedCaptainScreensInput(combined.allowedCaptainScreens);
    setEffectivePermissionsInput(combined.effectivePermissions);
    setUseCustomPermsOverride(true);
    setDefaultScreenInput(combined.defaultScreen);
    if (combined.hallManagerPermissions) {
      setHallManagerPermsInput(combined.hallManagerPermissions);
    }
  };

  const handleRoleSelectionChange = (nextRole: StaffRole) => {
    setRoleInput(nextRole);
    setSelectedJobTitleIdsInput([]);
    const defaults = getDefaultScreensForRole(
      nextRole,
      effectiveStations,
      nextRole === 'hall_manager' ? DEFAULT_HALL_MANAGER_PERMISSIONS : undefined
    );
    setAllowedScreensInput(defaults.allowedScreens);
    setDefaultScreenInput(defaults.defaultScreen);
    const rolePerms = resolveEffectiveStaffPermissions(
      {
        role: nextRole,
        allowedScreens: defaults.allowedScreens,
        allowedStations: defaults.allowedStations,
        hallManagerPermissions:
          nextRole === 'hall_manager' ? DEFAULT_HALL_MANAGER_PERMISSIONS : undefined,
      },
      opsConfig.managerPermissions
    );
    if (!effectiveCeiling.isUnbounded) {
      for (const k of ALL_STAFF_PERMISSION_KEYS) {
        if (!permAllowedInCeiling(k)) rolePerms[k] = false;
      }
    }
    setEffectivePermissionsInput(rolePerms);
    if (nextRole === 'hall_manager') {
      setHallManagerPermsInput({ ...DEFAULT_HALL_MANAGER_PERMISSIONS });
      setAllowedCaptainScreensInput([]);
    } else if (nextRole === 'captain' && effectiveCaptainScreens.length > 0) {
      setAllowedCaptainScreensInput([effectiveCaptainScreens[0].stationId]);
    } else if (nextRole === 'manager') {
      setAllowedCaptainScreensInput(effectiveCaptainScreens.map((c) => c.stationId));
    } else {
      setAllowedCaptainScreensInput([]);
    }
  };

  const toggleAllowedScreen = (screen: StaffScreen) => {
    if (roleInput === 'manager' && screen === 'staff_management') return;
    setAllowedScreensInput((prev) => {
      const exists = prev.includes(screen);
      if (exists && prev.length === 1) return prev;
      const next = exists ? prev.filter((s) => s !== screen) : [...prev, screen];
      if (!next.includes(defaultScreenInput)) {
        setDefaultScreenInput(next[0]);
      }
      return next;
    });
  };

  const toggleAllowedCaptainScreen = (captainScreenId: string) => {
    setAllowedCaptainScreensInput((prev) => {
      const exists = prev.includes(captainScreenId);
      const next = exists ? prev.filter((id) => id !== captainScreenId) : [...prev, captainScreenId];
      if (!exists && !allowedScreensInput.includes('captain')) {
        setAllowedScreensInput((cur) => [...cur, 'captain']);
      }
      return next;
    });
  };

  const toggleSinglePermissionOverride = (key: StaffPermissionKey) => {
    if (!permAllowedInCeiling(key)) return;
    setUseCustomPermsOverride(true);
    setEffectivePermissionsInput((prev) => {
      const nextVal = !prev[key];
      const next = { ...prev, [key]: nextVal };
      if (
        nextVal &&
        key !== 'canViewOrders' &&
        (key === 'canAddEditTableOrders' ||
          key === 'canEditOpenOrders' ||
          key === 'canApplyInstantDiscount' ||
          key === 'canCancelOpenOrders' ||
          key === 'canSettleChecks' ||
          key === 'canEditClosedChecks' ||
          key === 'canUpdatePrepProgress') &&
        permAllowedInCeiling('canViewOrders')
      ) {
        next.canViewOrders = true;
      }
      return next;
    });
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    setActionMsg(null);
    setActionError(null);

    const selectedHall = halls.find((h) => h.id === hallIdInput);
    const hallName = selectedHall ? selectedHall.name : editingMember?.hallName || '';

    const chosenTitles = jobTitles.filter((jt) => selectedJobTitleIdsInput.includes(jt.id));
    const hasJobTitles = chosenTitles.length > 0;
    const isTargetManager = !hasJobTitles && (formKind === 'manager' || roleInput === 'manager');
    const isTargetHallManager = !hasJobTitles && !isTargetManager && roleInput === 'hall_manager';

    let finalScreens: StaffScreen[];
    if (hasJobTitles || useCustomPermsOverride) {
      finalScreens = Array.from(new Set<StaffScreen>(allowedScreensInput));
    } else if (isTargetManager) {
      finalScreens = Array.from(new Set([...dynamicManagerScreens, ...allowedScreensInput])).filter(
        (s) =>
          !(s === 'halls' && !opsConfig.managerPermissions.canManageHalls) &&
          !(s === 'hall_assignments' && opsConfig.managerPermissions.canManageHallAssignments === false)
      );
    } else if (isTargetHallManager) {
      finalScreens = getDefaultScreensForRole('hall_manager', effectiveStations, hallManagerPermsInput).allowedScreens;
    } else {
      finalScreens = allowedScreensInput;
    }

    const extractedStations = Array.from(
      new Set(
        finalScreens
          .map((scr) => screenToStationId(scr))
          .filter((id): id is string => Boolean(id))
      )
    );
    const chosenDefaultScreen: StaffScreen = finalScreens.includes(defaultScreenInput)
      ? defaultScreenInput
      : finalScreens[0] || 'cashier';
    const defaultStationId =
      screenToStationId(chosenDefaultScreen) || extractedStations[0] || '';

    const computedEffectivePerms = sanitizeEffectivePermissions(
      hasJobTitles || useCustomPermsOverride
        ? effectivePermissionsInput
        : resolveEffectiveStaffPermissions(
            {
              role: formKind === 'manager' ? 'manager' : roleInput,
              allowedScreens: finalScreens,
              allowedStations: extractedStations,
              hallManagerPermissions: isTargetHallManager ? hallManagerPermsInput : undefined,
            },
            opsConfig.managerPermissions
          )
    );

    if (!effectiveCeiling.isUnbounded) {
      const cov = actorCoversTargetGrant({
        actorIsUnbounded: false,
        actorPermissions: effectiveCeiling.permissions,
        actorScreens: effectiveCeiling.allowedScreens,
        actorStations: effectiveCeiling.allowedStations,
        targetPermissions: computedEffectivePerms,
        targetScreens: finalScreens,
        targetStations: extractedStations,
      });
      if (!cov.allowed) {
        setFormError(
          isEn
            ? 'Security restriction: Cannot assign permissions or screens beyond your own account ceiling.'
            : 'قيد أمان: لا يمكنك منح صلاحيات أو شاشات تتجاوز سقف صلاحيات حسابك الحالي.'
        );
        setSubmitting(false);
        return;
      }
    }

    const jobTitleNames = chosenTitles.map((jt) => (isEn ? jt.nameEn || jt.nameAr : jt.nameAr));

    try {
      if (formKind === 'edit' && editingMember) {
        await updateStaffPermissionsAndProfile({
          restaurantId: restaurant.id,
          staff: editingMember,
          actor,
          updates: {
            name: nameInput,
            phone: phoneInput,
            email: emailInput,
            jobTitle: jobTitleInput || jobTitleNames.join(' + '),
            jobTitleIds: selectedJobTitleIdsInput,
            jobTitleNames,
            role: effectiveCeiling.isUnbounded
              ? roleInput
              : editingMember.role === 'manager'
                ? 'manager'
                : roleInput === 'manager'
                  ? 'custom'
                  : roleInput,
            allowedScreens: finalScreens,
            allowedStations: extractedStations,
            allowedCaptainScreens: isTargetHallManager ? [] : allowedCaptainScreensInput,
            hallManagerPermissions: isTargetHallManager ? hallManagerPermsInput : undefined,
            effectivePermissions: computedEffectivePerms,
            defaultStationId,
            defaultScreen: chosenDefaultScreen,
            hallId: hallIdInput,
            hallName: selectedHall ? selectedHall.name : '',
          },
        });
        setFormOpen(false);
        setActionMsg(
          isEn
            ? `Updated profile & permissions for "${nameInput.trim()}".`
            : `تم تحديث بيانات وصلاحيات "${nameInput.trim()}" بنجاح.`
        );
      } else {
        const result = await createManagerOrStaffAccount({
          restaurant,
          actor,
          name: nameInput,
          username: usernameInput,
          phone: phoneInput,
          email: emailInput,
          jobTitle: jobTitleInput || jobTitleNames.join(' + '),
          jobTitleIds: selectedJobTitleIdsInput,
          jobTitleNames,
          role: effectiveCeiling.isUnbounded
            ? hasJobTitles
              ? roleInput
              : formKind === 'manager'
                ? 'manager'
                : roleInput
            : roleInput === 'manager'
              ? 'custom'
              : roleInput,
          allowedScreens: finalScreens,
          allowedStations: extractedStations,
          allowedCaptainScreens: isTargetHallManager ? [] : allowedCaptainScreensInput,
          hallManagerPermissions: isTargetHallManager ? hallManagerPermsInput : undefined,
          effectivePermissions: computedEffectivePerms,
          defaultStationId,
          defaultScreen: chosenDefaultScreen,
          hallId: hallIdInput,
          hallName,
          useOneTimeInvite,
          directPassword: directPasswordInput,
        });
        setFormOpen(false);
        if (result.inviteUrl) {
          setInviteCopied(false);
          setInviteModalData(result);
        } else {
          const displayLabel =
            jobTitleNames.join(' + ') ||
            (isEn
              ? STAFF_ROLE_META[result.staff.role]?.labelEn || result.staff.role
              : STAFF_ROLE_META[result.staff.role]?.labelAr || result.staff.role);
          setActionMsg(
            isEn
              ? `Account created and activated for "${result.staff.name}" (${displayLabel}).`
              : `تم إنشاء حساب "${result.staff.name}" (${displayLabel}) وتفعيله مباشرة.`
          );
        }
      }
    } catch (err) {
      setFormError(formatFirestoreErrorMessage(err, isEn));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStaffMember = async (member: StaffMember) => {
    if (memberExceedsCeiling(member)) {
      setActionError(
        isEn
          ? 'Security restriction: You cannot delete an account holding higher privileges than yours.'
          : 'قيد أمان: لا يمكنك حذف حساب يمتلك صلاحيات أعلى من صلاحياتك.'
      );
      return;
    }
    if (member.uid === actor.uid) {
      setActionError(
        isEn
          ? 'You cannot delete your own account while signed in.'
          : 'لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول.'
      );
      return;
    }
    setBusyUid(member.uid);
    setActionError(null);
    setActionMsg(null);
    try {
      await deleteRestaurantStaffMember({
        restaurantId: restaurant.id,
        staff: member,
        actor,
      });
      setConfirmDeleteUid(null);
      setActionMsg(
        isEn
          ? `Deleted "${member.name}" and revoked all access immediately.`
          : `تم حذف "${member.name}" وإلغاء وصوله وصلاحياته فوراً.`
      );
    } catch (err) {
      setActionError(formatFirestoreErrorMessage(err, isEn));
    } finally {
      setBusyUid(null);
    }
  };

  const handleSaveManagerPerms = async () => {
    setSavingManagerPerms(true);
    setActionError(null);
    setActionMsg(null);
    try {
      const nextCfg = { ...opsConfig, managerPermissions: draftManagerPerms };
      await updateRestaurantOperationsConfig({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        config: nextCfg,
        actor,
      });
      onRestaurantUpdated?.({ ...restaurant, operationsConfig: nextCfg });
      setActionMsg(
        isEn
          ? 'Manager permissions saved and synced immediately.'
          : 'تم حفظ صلاحيات المدير ومزامنتها لحظياً مع حسابات المديرين.'
      );
    } catch (err) {
      setActionError(formatFirestoreErrorMessage(err, isEn));
    } finally {
      setSavingManagerPerms(false);
    }
  };

  const openSuspendModal = (member: StaffMember) => {
    if (mode === 'manager' && member.role === 'manager' && member.uid !== actor.uid) {
      setActionError(
        isEn
          ? 'Managers cannot suspend another manager. Owner access required.'
          : 'لا يمكن للمدير إيقاف مدير آخر. يتم هذا من حساب المالك فقط.'
      );
      return;
    }
    if (member.uid === actor.uid) {
      setActionError(
        isEn
          ? 'You cannot suspend your own account while signed in.'
          : 'لا يمكنك إيقاف حسابك الحالي أثناء تسجيل الدخول.'
      );
      return;
    }
    setSuspendTarget(member);
    setSuspendType('timed');
    setSuspendHours(24);
    setSuspendCustomUntil('');
    setSuspendReason('');
    setActionError(null);
  };

  const handleConfirmSuspend = async (e: FormEvent) => {
    e.preventDefault();
    if (!suspendTarget) return;
    if (!suspendReason.trim()) {
      setActionError(
        isEn
          ? 'Please write a clear suspension reason to show on sign-in attempt.'
          : 'يجب كتابة سبب واضح لإيقاف الموظف ليظهر له عند محاولة الدخول.'
      );
      return;
    }
    setSuspending(true);
    setActionError(null);
    setActionMsg(null);
    try {
      const customMs = suspendCustomUntil ? new Date(suspendCustomUntil).getTime() : 0;
      await suspendStaffMember({
        restaurantId: restaurant.id,
        staff: suspendTarget,
        actor,
        suspendedType: suspendType === 'indefinite' ? 'indefinite' : 'timed',
        durationHours: suspendType === 'timed' && !customMs ? suspendHours : undefined,
        suspendedUntilMs: suspendType === 'timed' && customMs > Date.now() ? customMs : undefined,
        reason: suspendReason.trim(),
      });
      setActionMsg(
        isEn
          ? `Suspended "${suspendTarget.name}" and logged the reason.`
          : `تم إيقاف شاشة "${suspendTarget.name}" بنجاح وتسجيل السبب في السجل.`
      );
      setSuspendTarget(null);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Unable to suspend staff member.'
            : 'تعذر إيقاف الموظف.'
      );
    } finally {
      setSuspending(false);
    }
  };

  const handleUnsuspend = async (member: StaffMember) => {
    if (mode === 'manager' && member.role === 'manager' && member.uid !== actor.uid) {
      setActionError(
        isEn
          ? 'Managers cannot unsuspend another manager. Owner access required.'
          : 'لا يمكن للمدير تفعيل مدير آخر. يتم هذا من حساب المالك فقط.'
      );
      return;
    }
    setBusyUid(member.uid);
    setActionError(null);
    setActionMsg(null);
    try {
      await unsuspendStaffMember({
        restaurantId: restaurant.id,
        staff: member,
        actor,
      });
      setActionMsg(
        isEn
          ? `Lifted suspension and restored access for "${member.name}".`
          : `تم رفع الإيقاف وإعادة تفعيل شاشة "${member.name}" بنجاح.`
      );
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Unable to lift suspension.'
            : 'تعذر رفع الإيقاف.'
      );
    } finally {
      setBusyUid(null);
    }
  };

  const handleRegenerateInvite = async (member: StaffMember) => {
    if (mode === 'manager' && member.role === 'manager' && member.uid !== actor.uid) {
      setActionError(
        isEn
          ? 'Resetting another manager’s invite requires the owner account.'
          : 'إعادة تعيين وصول مدير آخر يتم من حساب المالك.'
      );
      return;
    }
    setBusyUid(member.uid);
    setActionError(null);
    setActionMsg(null);
    try {
      const result = await regenerateStaffInvite({
        restaurant,
        existingStaff: member,
        actor,
      });
      setInviteCopied(false);
      setInviteModalData(result);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Unable to generate a new invite link.'
            : 'تعذر إنشاء رابط دعوة جديد.'
      );
    } finally {
      setBusyUid(null);
    }
  };

  const handleSendPasswordReset = async (member: StaffMember) => {
    if (!canResetStaffViaEmail(member)) {
      setActionError(
        isEn
          ? 'This account was activated with a QR invite and internal ID. Use "New QR Invite / Reset" to reset its password.'
          : 'هذا الحساب مفعّل بدعوة QR وبمعرّف داخلي. لإعادة تعيين كلمة المرور استخدم زر "دعوة QR جديدة / تصفير".'
      );
      return;
    }
    setBusyUid(member.uid);
    setActionError(null);
    setActionMsg(null);
    try {
      await sendStaffPasswordResetByEmail(member.email || '', member.authEmail);
      setActionMsg(
        isEn
          ? `Password reset link sent to ${member.email}.`
          : `تم إرسال رابط إعادة تعيين كلمة المرور إلى ${member.email}.`
      );
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Unable to send reset email.'
            : 'تعذر إرسال رابط استعادة البريد.'
      );
    } finally {
      setBusyUid(null);
    }
  };

  const handleDownloadInviteQr = () => {
    if (!inviteCanvasRef.current || !inviteModalData) return;
    const dataUrl = inviteCanvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `invite-${inviteModalData.staff.username}-${restaurant.slug}.png`;
    a.click();
  };

  const handleCopyInviteLink = async () => {
    if (!inviteModalData?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteModalData.inviteUrl);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const assignableScreens =
    formKind === 'manager' || roleInput === 'manager'
      ? dynamicManagerScreens
      : dynamicEmployeeAssignableScreens;

  return (
    <div dir={dir} className="space-y-5">
      {/* Top Action Header */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-zinc-950">
                {isEn
                  ? 'Managers, Staff & Permissions Management'
                  : 'إدارة المدير والكادر والصلاحيات'}
              </h2>
              <span className="text-xs font-bold text-zinc-500 font-mono-num">
                {isEn
                  ? `(${staffList.length} total · ${activeStaffCount} active)`
                  : `(${staffList.length} إجمالي · ${activeStaffCount} مفعّل)`}
              </span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-2xl">
              {mode === 'owner'
                ? isEn
                  ? 'Create a Manager account to oversee operations and staff, or onboard employees via secure one-time QR invites without exposing sensitive owner privileges.'
                  : 'أنشئ حساب مدير المطعم ليتولى إدارة الكادر والتشغيل، أو أضف الموظفين بدعوة QR آمنة لمرة واحدة دون صلاحيات حساسة للمالك.'
                : isEn
                  ? 'Create floor, kitchen, bar, and cashier staff accounts and assign allowed operational screens via one-time QR invites.'
                  : 'أنشئ موظفي الصالة والمطبخ والبار والكاشير، وحدد الشاشات المسموح بها لكل موظف مع رابط دعوة QR لمرة واحدة.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenJobTitles && (
              <button
                type="button"
                onClick={onOpenJobTitles}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>{isEn ? `Job Titles (${jobTitles.length})` : `المسميات الوظيفية (${jobTitles.length})`}</span>
              </button>
            )}
            {mode === 'owner' && (
              <button
                type="button"
                onClick={openCreateManagerModal}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
              >
                <Crown className="w-4 h-4 shrink-0" />
                <span>{isEn ? 'Create Manager Account' : 'إنشاء حساب مدير'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={openCreateEmployeeModal}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>{isEn ? 'Add Staff + QR Invite' : 'إضافة موظف + دعوة QR'}</span>
            </button>
          </div>
        </div>

        {/* Sub-view switcher: Staff list vs Dynamic Stations vs Audit Logs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSubView('members')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                subView === 'members'
                  ? 'bg-zinc-950 text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{isEn ? 'Team Members & Access' : 'أعضاء الكادر والصلاحيات'}</span>
            </button>
            {canManageStations && (
              <button
                type="button"
                onClick={() => setSubView('stations')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  subView === 'stations'
                    ? 'bg-zinc-950 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>
                  {isEn
                    ? `Screens & Stations (${effectiveStations.length + effectiveCaptainScreens.length})`
                    : `الشاشات والمحطات (${effectiveStations.length + effectiveCaptainScreens.length})`}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSubView('audit')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                subView === 'audit'
                  ? 'bg-zinc-950 text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>
                {isEn
                  ? `Security & Audit Log (${auditLogs.length})`
                  : `سجل التتبع والأمان (${auditLogs.length})`}
              </span>
            </button>
          </div>

          {subView === 'members' && (
            <div className="flex flex-wrap items-center gap-2">
              {jobTitles.length > 0 && (
                <select
                  value={jobTitleFilter}
                  onChange={(e) => setJobTitleFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-[11px] font-bold text-zinc-800"
                >
                  <option value="all">{isEn ? 'All Job Titles' : 'كل المسميات الوظيفية'}</option>
                  {jobTitles.map((jt) => (
                    <option key={jt.id} value={jt.id}>
                      {isEn ? jt.nameEn : jt.nameAr}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {(
                  ['all', 'manager', 'hall_manager', 'cashier', 'station_staff', 'kitchen', 'bar', 'pastry', 'captain', 'custom'] as const
                ).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoleFilter(r)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                      roleFilter === r
                        ? 'bg-amber-500 text-zinc-950'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {r === 'all'
                      ? isEn
                        ? 'All'
                        : 'الكل'
                      : isEn
                        ? STAFF_ROLE_META[r].labelEn
                        : STAFF_ROLE_META[r].labelAr}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Owner-only Authorized Domains Verification Card */}
      <AuthorizedDomainsCard restaurant={restaurant} actor={actor} auditLogs={auditLogs} />

      {/* Owner-only Configurable Manager Permissions Matrix */}
      {mode === 'owner' && (
        <section className="bg-white border border-indigo-200 rounded-2xl overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => setManagerPermsOpen((v) => !v)}
            className="w-full px-4 py-3.5 bg-indigo-50/60 hover:bg-indigo-50 flex items-center justify-between gap-3 text-start cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Sliders className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-indigo-950">
                  {isEn
                    ? 'Manager Permissions Matrix (Customize Operational Scope)'
                    : 'صلاحيات المدير المصرح بها (تخصيص اختصاصات المدير)'}
                </h3>
                <p className="text-[11px] text-indigo-700">
                  {isEn
                    ? 'Control administrative and operational privileges granted to managers with instant effect'
                    : 'تحكّم في الصلاحيات الإدارية والتشغيلية الممنوحة للمدير مع إمكانية التعديل في أي وقت'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-[11px] font-extrabold text-indigo-800 shrink-0">
              {managerPermsOpen
                ? isEn
                  ? 'Hide'
                  : 'إخفاء'
                : isEn
                  ? 'Edit Permissions'
                  : 'تعديل الصلاحيات'}
            </span>
          </button>

          {managerPermsOpen && (
            <div className="p-4 sm:p-5 space-y-4 border-t border-indigo-100">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {MANAGER_PERMISSION_LABELS.map((item) => {
                  const checked = Boolean(draftManagerPerms[item.key]);
                  return (
                    <label
                      key={item.key}
                      className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                        checked
                          ? 'bg-indigo-50/50 border-indigo-300 text-zinc-950'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setDraftManagerPerms((prev) => ({
                            ...prev,
                            [item.key]: e.target.checked,
                          }))
                        }
                        className="mt-0.5 w-4 h-4 accent-indigo-600 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold">
                          {isEn ? item.labelEn : item.labelAr}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
                          {isEn ? item.hintEn : item.hintAr}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100">
                <p className="text-[11px] text-zinc-500">
                  {isEn
                    ? 'These permissions apply immediately to manager supervision, cashier, and menu screens.'
                    : 'تؤثر هذه الإعدادات فوراً على شاشة الإشراف والكاشير والمنيو الخاصة بالمدير.'}
                </p>
                <button
                  type="button"
                  disabled={savingManagerPerms}
                  onClick={handleSaveManagerPerms}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingManagerPerms ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{isEn ? 'Save Manager Permissions' : 'حفظ صلاحيات المدير'}</span>
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Auto Staff Portal Card once a Manager exists (plus owner preview tip if none yet) */}
      {managers.length > 0 ? (
        <StaffPortalShareCard restaurant={restaurant} managersCount={managers.length} />
      ) : mode === 'owner' ? (
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                {isEn
                  ? `Staff Portal Card (/staff/${restaurant.slug}) will appear here automatically once your first manager is created`
                  : `بطاقة صفحة الكادر (/staff/${restaurant.slug}) ستظهر هنا تلقائياً عند إنشاء أول مدير`}
              </span>
            </p>
            <p className="text-[11px] text-indigo-800">
              {isEn
                ? 'Manager accounts handle staff, screens, halls, and orders without access to restaurant deletion, subscription, or customer billing data.'
                : 'يمنح حساب المدير صلاحيات إدارة الكادر والشاشات والصالات والطلبات فقط دون حذف المطعم أو الاشتراك أو بيانات العملاء.'}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateManagerModal}
            className="min-h-[38px] px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isEn ? 'Create Manager Now' : 'أنشئ حساب مدير الآن'}
          </button>
        </div>
      ) : null}

      {actionMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center justify-between gap-2">
          <span>{actionMsg}</span>
          <button
            type="button"
            onClick={() => setActionMsg(null)}
            aria-label={isEn ? 'Close' : 'إغلاق'}
            className="p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900 flex items-center justify-between gap-2">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label={isEn ? 'Close' : 'إغلاق'}
            className="p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loadError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {subView === 'stations' && canManageStations ? (
        <StationsManagerTab
          restaurant={restaurant}
          actor={actor}
          activeShifts={activeShifts}
          onGoHome={() => setSubView('members')}
        />
      ) : loading ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center space-y-2">
          <Loader2 className="w-7 h-7 animate-spin text-zinc-500 mx-auto" />
          <p className="text-xs font-bold text-zinc-600">
            {isEn ? 'Loading staff roster...' : 'جاري تحميل بيانات الكادر...'}
          </p>
        </div>
      ) : subView === 'audit' ? (
        /* AUDIT LOGS VIEW */
        <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-extrabold text-zinc-900">
              {isEn ? 'Security & Operations Audit Log (Last 120 Events)' : 'سجل العمليات والأمان (آخر 120 عملية)'}
            </h3>
            <span className="text-[11px] text-zinc-500">
              {isEn ? 'Tamper-protected log' : 'محمي ضد التعديل أو الحذف'}
            </span>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-10 text-center text-xs text-zinc-500">
              {isEn ? 'No audit events recorded yet.' : 'لا توجد عمليات مسجلة حتى الآن.'}
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {auditLogs.map((log) => {
                const eventLabel = isEn
                  ? AUDIT_LABELS_EN[log.eventType] || log.eventType
                  : AUDIT_LABELS_AR[log.eventType] || log.eventType;
                const roleLabel =
                  log.actorRole === 'owner'
                    ? isEn
                      ? 'Owner'
                      : 'المالك'
                    : isEn
                      ? STAFF_ROLE_META[log.actorRole as StaffRole]?.labelEn || log.actorRole
                      : STAFF_ROLE_META[log.actorRole as StaffRole]?.labelAr || log.actorRole;
                const scrMeta = log.screen
                  ? getScreenMetaDynamic(log.screen, effectiveStations)
                  : null;
                return (
                  <div
                    key={log.id}
                    className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-zinc-50/60"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-zinc-900 text-white text-[10px] font-bold">
                          {eventLabel}
                        </span>
                        <span className="font-extrabold text-zinc-950">{log.actorName}</span>
                        <span className="text-[11px] text-zinc-500">({roleLabel})</span>
                        {scrMeta && (
                          <span className="text-[11px] text-indigo-700 font-bold">
                            · {isEn ? scrMeta.shortEn : scrMeta.shortAr}
                          </span>
                        )}
                      </div>
                      {log.details && <p className="text-zinc-600">{log.details}</p>}
                    </div>
                    <span className="text-[11px] font-mono-num text-zinc-400 shrink-0">
                      {formatAuditTime(log.createdAt, isEn)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-4">
          {/* Active Shifts & Station Coverage Status Banner */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {isEn
                    ? `Active Shifts Now: ${activeShifts.length}`
                    : `الورديات النشطة الآن: ${activeShifts.length}`}
                </span>
              </span>
              {activeShifts.length > 0 && (
                <span className="text-xs text-zinc-600 font-semibold">
                  {activeShifts
                    .slice(0, 4)
                    .map((s) => `${s.staffName} (${s.stationName})`)
                    .join(' · ')}
                  {activeShifts.length > 4 ? ` +${activeShifts.length - 4}` : ''}
                </span>
              )}
            </div>

            {uncoveredStations.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{isEn ? 'Stations without active shift:' : 'أقسام بدون وردية حالياً:'}</span>
                {uncoveredStations.map((st) => (
                  <span
                    key={st.stationId}
                    className="px-2 py-0.5 rounded-md bg-white border border-amber-300 text-[11px] font-extrabold text-amber-950"
                  >
                    {loc(st.shortLabel, st.shortLabel_en)}
                  </span>
                ))}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700">
                <Check className="w-4 h-4" />
                <span>
                  {isEn
                    ? 'All prep stations are covered by an active shift'
                    : 'جميع أقسام التحضير مغطاة بوردية نشطة'}
                </span>
              </span>
            )}
          </div>

          {filteredStaff.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center space-y-3">
              <Users className="w-10 h-10 text-zinc-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-zinc-900">
                  {isEn ? 'No staff members in this category yet' : 'لا يوجد أعضاء في هذه الفئة بعد'}
                </h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  {isEn
                    ? 'Start by creating a Manager account or add staff members with one-time QR invites to activate their screens.'
                    : 'ابدأ بإنشاء حساب المدير أو أضف أفراد الكادر بدعوة QR لمرة واحدة لتفعيل شاشات التشغيل المخصصة لهم.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {mode === 'owner' && (
                  <button
                    type="button"
                    onClick={openCreateManagerModal}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-extrabold cursor-pointer"
                  >
                    {isEn ? 'Create Manager Account' : 'إنشاء حساب مدير'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={openCreateEmployeeModal}
                  className="px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-extrabold cursor-pointer"
                >
                  {isEn ? 'Add New Staff' : 'إضافة موظف جديد'}
                </button>
              </div>
            </div>
          ) : (
            /* STAFF MEMBERS CARDS GRID */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredStaff.map((member) => {
                const roleMeta = STAFF_ROLE_META[member.role] || STAFF_ROLE_META.cashier;
                const isBusy = busyUid === member.uid;
                const isManagerLocked = memberExceedsCeiling(member);
                const memberShifts = activeShiftByStaffUid.get(member.uid) || [];
                const defaultMeta = getScreenMetaDynamic(member.defaultScreen, effectiveStations);
                const resolvedMemberPerms = resolveEffectiveStaffPermissions(
                  member,
                  opsConfig.managerPermissions
                );
                const activePermsCount = ALL_STAFF_PERMISSION_KEYS.filter(
                  (k) => resolvedMemberPerms[k] === true
                ).length;

                return (
                  <article
                    key={member.uid}
                    className={`bg-white rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-4 ${
                      member.isActive ? 'border-zinc-200' : 'border-amber-300 bg-amber-50/20'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm sm:text-base font-extrabold text-zinc-950 truncate">
                              {member.name}
                            </h3>
                            <span
                              className={`px-2 py-0.5 rounded-md border text-[11px] font-extrabold ${roleMeta.badgeClass}`}
                            >
                              {member.jobTitleNames && member.jobTitleNames.length > 0
                                ? member.jobTitleNames.join(' + ')
                                : isEn
                                  ? roleMeta.labelEn
                                  : roleMeta.labelAr}
                            </span>
                            {memberShifts.length > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-900 text-[10px] font-extrabold inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                <span>
                                  {isEn
                                    ? `On Shift (${memberShifts[0].stationName})`
                                    : `في الوردية الآن (${memberShifts[0].stationName})`}
                                </span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-mono-num" dir="ltr">@{member.username}</span>
                            <span>·</span>
                            <span className="font-mono-num" dir="ltr">{member.phone}</span>
                            {member.email ? (
                              <>
                                <span>·</span>
                                <span dir="ltr">{member.email}</span>
                              </>
                            ) : null}
                            <span>·</span>
                            <span className="font-mono-num">
                              {isEn
                                ? `${activePermsCount} permissions`
                                : `${activePermsCount} صلاحية`}
                            </span>
                          </p>
                          {(member.jobTitle || member.hallName) && (
                            <p className="text-[11px] text-zinc-600 font-semibold">
                              {member.jobTitle ? member.jobTitle : ''}
                              {member.jobTitle && member.hallName ? ' · ' : ''}
                              {member.hallName
                                ? isEn
                                  ? `Hall: ${member.hallName}`
                                  : `الصالة: ${member.hallName}`
                                : ''}
                            </p>
                          )}
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold shrink-0 ${
                            member.mustChangePassword && !member.isActive
                              ? 'bg-amber-100 text-amber-900'
                              : member.isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {member.mustChangePassword && !member.isActive
                            ? isEn
                              ? 'Pending QR Activation'
                              : 'بانتظار تفعيل QR'
                            : member.isActive
                              ? isEn
                                ? 'Active'
                                : 'نشط'
                              : member.suspendedType === 'timed'
                                ? isEn
                                  ? 'Timed Suspension'
                                  : 'موقوف مؤقتاً'
                                : isEn
                                  ? 'Suspended'
                                  : 'موقوف'}
                        </span>
                      </div>

                      {!member.isActive && !member.mustChangePassword && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-900 flex items-start gap-2">
                          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <span>{resolveStaffSuspensionState(member).message}</span>
                        </div>
                      )}

                      {/* Assigned Screens */}
                      <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-2.5 space-y-1.5">
                        <p className="text-[11px] font-bold text-zinc-500">
                          {isEn
                            ? `Authorized Screens (Default: ${defaultMeta.shortEn}):`
                            : `الشاشات المصرّح بها (الافتراضية: ${defaultMeta.shortAr}):`}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(member.allowedScreens || [])
                            .filter((scr) => !(member.role === 'hall_manager' && scr === 'captain'))
                            .map((scr) => {
                            const meta = getScreenMetaDynamic(scr, effectiveStations);
                            return (
                              <span
                                key={scr}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                  scr === member.defaultScreen
                                    ? 'bg-zinc-950 text-white border-zinc-950'
                                    : 'bg-white text-zinc-700 border-zinc-200'
                                }`}
                              >
                                {isEn ? meta.shortEn : meta.shortAr}
                              </span>
                            );
                          })}
                          {member.role === 'hall_manager' && (() => {
                            const hmPerms = getResolvedHallManagerPermissions(member.hallManagerPermissions);
                            return (
                              <>
                                {hmPerms.canMonitorFloorAndCalls && (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold border bg-teal-50 text-teal-800 border-teal-200">
                                    {isEn ? 'Floor & Calls' : 'مراقبة الصالات والنداءات'}
                                  </span>
                                )}
                                {hmPerms.canAddEditTableOrders && (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold border bg-emerald-50 text-emerald-800 border-emerald-200">
                                    {isEn ? 'Add Table Orders' : 'إضافة طلبات طاولات'}
                                  </span>
                                )}
                                {!hmPerms.showPrices && (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold border bg-zinc-100 text-zinc-600 border-zinc-200">
                                    {isEn ? 'Prices Hidden' : 'بدون أسعار'}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                          {(member.allowedCaptainScreens || []).map((capId) => {
                            const capMeta = effectiveCaptainScreens.find(
                              (c) => cleanStationId(c.stationId) === cleanStationId(capId)
                            );
                            if (!capMeta) return null;
                            return (
                              <span
                                key={`cap_${capId}`}
                                className="px-2 py-0.5 rounded-md text-[11px] font-bold border bg-teal-50 text-teal-800 border-teal-200"
                              >
                                {isEn ? capMeta.label_en : capMeta.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Member Action Buttons */}
                    <div className="space-y-2 pt-2 border-t border-zinc-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy || isManagerLocked}
                          onClick={() => openEditStaffModal(member)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Edit / Promote' : 'تعديل / ترقية'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy || isManagerLocked}
                          onClick={() => handleRegenerateInvite(member)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                        >
                          {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                          <span>{isEn ? 'New QR Invite / Reset' : 'دعوة QR جديدة / تصفير'}</span>
                        </button>

                        {canResetStaffViaEmail(member) && (
                          <button
                            type="button"
                            disabled={isBusy || isManagerLocked}
                            onClick={() => handleSendPasswordReset(member)}
                            className="min-h-[36px] px-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Email Reset' : 'استعادة بالإيميل'}</span>
                          </button>
                        )}

                        {member.uid !== actor.uid && !isManagerLocked && (
                          <>
                            {member.isActive ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => openSuspendModal(member)}
                                className="min-h-[36px] px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50/70 text-amber-900 hover:bg-amber-100 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                              >
                                <PauseCircle className="w-3.5 h-3.5" />
                                <span>{isEn ? 'Suspend' : 'إيقاف مؤقت / دائم'}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleUnsuspend(member)}
                                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>{isEn ? 'Unsuspend & Restore' : 'رفع الإيقاف وتفعيل الشاشة'}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                setConfirmDeleteUid((prev) => (prev === member.uid ? null : member.uid))
                              }
                              className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                              title={isEn ? 'Dismiss and permanently remove staff member' : 'حذف وفصل الموظف نهائياً'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{isEn ? 'Remove' : 'فصل وحذف'}</span>
                            </button>
                          </>
                        )}
                      </div>

                      {!canResetStaffViaEmail(member) && (
                        <p className="text-[11px] text-zinc-500">
                          {isEn ? (
                            <>
                              QR-invite managed account — to reset password use{' '}
                              <span className="font-bold text-indigo-700">New QR Invite / Reset</span>.
                            </>
                          ) : (
                            <>
                              حساب مُدار بدعوة QR — لتغيير كلمة المرور أو استعادتها استخدم{' '}
                              <span className="font-bold text-indigo-700">دعوة QR جديدة / تصفير</span>.
                            </>
                          )}
                        </p>
                      )}

                      {confirmDeleteUid === member.uid && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-rose-900">
                            {isEn
                              ? `Confirm deleting "${member.name}" and revoking all access?`
                              : `تأكيد حذف "${member.name}" وإلغاء جميع صلاحياته؟`}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDeleteStaffMember(member)}
                              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold cursor-pointer disabled:opacity-50"
                            >
                              {isEn ? 'Confirm Delete' : 'تأكيد الحذف'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUid(null)}
                              className="px-2.5 py-1 rounded-lg border border-zinc-300 bg-white text-zinc-700 font-bold cursor-pointer"
                            >
                              {isEn ? 'Cancel' : 'تراجع'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT STAFF MODAL */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => !submitting && setFormOpen(false)}
          dir={dir}
        >
          <div
            className="bg-white border border-zinc-200 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-zinc-950 flex items-center gap-2">
                  {formKind === 'manager' ? (
                    <>
                      <Crown className="w-5 h-5 text-indigo-600" />
                      <span>{isEn ? 'Create Restaurant Manager Account' : 'إنشاء حساب مدير المطعم'}</span>
                    </>
                  ) : formKind === 'edit' ? (
                    <>
                      <Edit3 className="w-5 h-5 text-zinc-800" />
                      <span>{isEn ? 'Edit Staff Details & Permissions' : 'تعديل بيانات وصلاحيات الكادر'}</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5 text-zinc-900" />
                      <span>{isEn ? 'Add New Staff & Assign Permissions' : 'إضافة موظف جديد وتحديد الصلاحيات'}</span>
                    </>
                  )}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {formKind === 'manager'
                    ? isEn
                      ? 'Managers oversee staff and operational screens without sensitive owner controls — Hall & QR permissions are configured from the manager permissions matrix.'
                      : 'يحصل المدير على صلاحيات إدارة الكادر والشاشات دون صلاحيات المالك الحساسة — وتُدار صلاحية الصالات و QR من مصفوفة صلاحيات المدير.'
                    : isEn
                      ? 'Choose role and permitted screens, then activate via one-time QR invite or a direct initial password.'
                      : 'اختر الدور والشاشات المصرّح بها، ثم اختر طريقة التفعيل عبر QR لمرة واحدة أو كلمة مرور مباشرة.'}
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setFormOpen(false)}
                aria-label={isEn ? 'Close' : 'إغلاق'}
                className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="space-y-1 text-xs font-bold text-zinc-800">
                  <span>{isEn ? 'Full Name *' : 'الاسم الكامل *'}</span>
                  <input
                    type="text"
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder={isEn ? 'e.g. Ahmed Mahmoud' : 'مثال: أحمد محمود'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </label>

                <label className="space-y-1 text-xs font-bold text-zinc-800">
                  <span>{isEn ? 'Username *' : 'اسم المستخدم *'}</span>
                  <input
                    type="text"
                    required
                    disabled={formKind === 'edit'}
                    dir="ltr"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="ahmed_cashier"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-100"
                  />
                </label>

                <label className="space-y-1 text-xs font-bold text-zinc-800">
                  <span>{isEn ? 'Phone Number *' : 'رقم الهاتف *'}</span>
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="01012345678"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </label>

                <label className="space-y-1 text-xs font-bold text-zinc-800">
                  <span>{isEn ? 'Email (Optional)' : 'البريد الإلكتروني (اختياري)'}</span>
                  <input
                    type="email"
                    dir="ltr"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="staff@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </label>

                {formKind !== 'manager' && (
                  <label className="space-y-1 text-xs font-bold text-zinc-800">
                    <span>{isEn ? 'Job Role *' : 'الدور الوظيفي *'}</span>
                    <select
                      value={roleInput}
                      disabled={formKind === 'edit' && editingMember?.role === 'manager'}
                      onChange={(e) => handleRoleSelectionChange(e.target.value as StaffRole)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-100"
                    >
                      {mode === 'owner' && (
                        <option value="manager">
                          {isEn ? 'Restaurant Manager' : 'مدير المطعم'}
                        </option>
                      )}
                      <option value="hall_manager">
                        {isEn ? 'Hall Manager' : 'مدير الصالات'}
                      </option>
                      <option value="cashier">{isEn ? 'Cashier' : 'كاشير'}</option>
                      <option value="station_staff">
                        {isEn ? 'Station Chef / Lead' : 'شيف / مسؤول قسم تحضير'}
                      </option>
                      <option value="kitchen">{isEn ? 'Kitchen Chef' : 'شيف المطبخ'}</option>
                      <option value="bar">{isEn ? 'Barista / Bar' : 'باريستا / بار'}</option>
                      <option value="pastry">{isEn ? 'Pastry / Desserts' : 'باستري / حلويات'}</option>
                      <option value="captain">{isEn ? 'Floor Captain' : 'كابتن صالة'}</option>
                      <option value="custom">{isEn ? 'Custom Permissions' : 'صلاحيات مخصصة'}</option>
                    </select>
                  </label>
                )}

                <label className="space-y-1 text-xs font-bold text-zinc-800">
                  <span>{isEn ? 'Job Title (Optional)' : 'المسمى الوظيفي (اختياري)'}</span>
                  <input
                    type="text"
                    value={jobTitleInput}
                    onChange={(e) => setJobTitleInput(e.target.value)}
                    placeholder={isEn ? 'e.g. Evening Shift Cashier' : 'مثال: كاشير شيفت مسائي'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </label>

                <label className="space-y-1 text-xs font-bold text-zinc-800 sm:col-span-2">
                  <span>
                    {isEn
                      ? 'Assigned Hall (Optional — mainly for Captains)'
                      : 'الصالة المسندة (اختياري — خاصةً للكابتن)'}
                  </span>
                  <select
                    value={hallIdInput}
                    onChange={(e) => setHallIdInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <option value="">
                      {isEn ? 'All Halls / Unspecified' : 'كل الصالات / غير محدد'}
                    </option>
                    {halls.map((h) => (
                      <option key={h.id} value={h.id}>
                        {loc(h.name, h.name_en)} ({isEn ? `${h.tableCount} tables` : `${h.tableCount} طاولة`})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Flexible Job Titles Assignment (Multi-select) */}
              {formKind !== 'manager' && jobTitles.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-extrabold text-indigo-950 block">
                        {isEn
                          ? 'Assign Job Titles (Single or Combined — Optional)'
                          : 'تعيين المسمى الوظيفي (مسمى واحد أو دمج أكثر من مسمى)'}
                      </span>
                      <span className="text-[11px] text-indigo-700">
                        {isEn
                          ? 'Selecting multiple job titles automatically combines their screens and DB permissions.'
                          : 'اختيار أكثر من مسمى وظيفي يدمج الشاشات والصلاحيات تلقائياً داخل نفس الحساب الواحد.'}
                      </span>
                    </div>
                    {onOpenJobTitles && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormOpen(false);
                          onOpenJobTitles();
                        }}
                        className="text-[11px] font-extrabold text-indigo-700 hover:underline cursor-pointer"
                      >
                        {isEn ? 'Manage Titles' : 'إدارة المسميات'}
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {jobTitles
                      .filter((jt) => jt.isActive !== false)
                      .map((jt) => {
                        const checked = selectedJobTitleIdsInput.includes(jt.id);
                        const cov = actorCoversTargetGrant({
                          actorIsUnbounded: effectiveCeiling.isUnbounded,
                          actorPermissions: effectiveCeiling.permissions,
                          actorScreens: effectiveCeiling.allowedScreens,
                          actorStations: effectiveCeiling.allowedStations,
                          targetPermissions: sanitizeEffectivePermissions(jt.permissions),
                          targetScreens: jt.allowedScreens || [],
                          targetStations: jt.allowedStations || [],
                        });
                        return (
                          <button
                            key={jt.id}
                            type="button"
                            disabled={!cov.allowed && !checked}
                            onClick={() => handleToggleJobTitleSelection(jt.id)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors ${
                              !cov.allowed && !checked
                                ? 'bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed'
                                : checked
                                  ? 'bg-zinc-950 text-white border-zinc-950 cursor-pointer'
                                  : 'bg-white text-zinc-800 border-zinc-200 hover:bg-zinc-50 cursor-pointer'
                            }`}
                          >
                            <span
                              style={{ backgroundColor: jt.color || '#4F46E5' }}
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                            />
                            <span>{isEn ? jt.nameEn : jt.nameAr}</span>
                            {!cov.allowed && <Lock className="w-3 h-3 shrink-0" />}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Hall Manager Permissions Matrix OR Allowed Screens + Granular Permissions */}
              {formKind !== 'manager' && roleInput === 'hall_manager' && selectedJobTitleIdsInput.length === 0 ? (
                <div className="p-3.5 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-extrabold text-teal-950 block">
                      {isEn ? 'Hall Manager Permissions' : 'صلاحيات مدير الصالات'}
                    </span>
                    <p className="text-[11px] text-teal-800">
                      {isEn
                        ? 'All operational toggles here are directly enforced by Firestore security rules.'
                        : 'جميع المفاتيح التشغيلية هنا مفروضة ومطبقة مباشرة في قواعد قاعدة البيانات.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {HALL_MANAGER_PERMISSION_LABELS.map((item) => {
                      const checked = Boolean(hallManagerPermsInput[item.key]);
                      return (
                        <label
                          key={item.key}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer ${
                            checked
                              ? 'bg-white border-teal-700 text-zinc-950'
                              : 'bg-white/60 border-teal-200/80 text-zinc-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setHallManagerPermsInput((prev) => ({
                                ...prev,
                                [item.key]: e.target.checked,
                              }))
                            }
                            className="mt-0.5 w-4 h-4 accent-teal-700 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-extrabold leading-snug">
                              {isEn ? item.labelEn : item.labelAr}
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">
                              {isEn ? item.hintEn : item.hintAr}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-zinc-900">
                    {isEn ? 'Allowed Screens & Prep Stations' : 'الشاشات والأقسام المسموح بها لهذا الحساب'}
                  </span>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[11px] text-zinc-500 tabular-nums">
                      {isEn
                        ? `${assignableScreens.length} screens`
                        : `${assignableScreens.length} شاشة متاحة`}
                    </span>
                    {canManageStations && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormOpen(false);
                          if (onOpenAddScreen) {
                            onOpenAddScreen();
                          } else {
                            setSubView('stations');
                          }
                        }}
                        className="text-[11px] font-extrabold text-orange-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Add New Screen' : 'إضافة شاشة جديدة'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {assignableScreens.map((scr) => {
                    const checked = allowedScreensInput.includes(scr);
                    const locked = roleInput === 'manager' && scr === 'staff_management';
                    const meta = getScreenMetaDynamic(scr, effectiveStations);
                    const stId = screenToStationId(scr);
                    const stObj = stId
                      ? effectiveStations.find((st) => st.stationId === stId)
                      : undefined;
                    const StIcon = stObj ? getStationIconComponent(stObj.icon) : null;
                    return (
                      <label
                        key={scr}
                        className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                          checked
                            ? 'bg-white border-zinc-900 text-zinc-950'
                            : 'bg-zinc-100/60 border-zinc-200 text-zinc-600'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={locked}
                            onChange={() => toggleAllowedScreen(scr)}
                            className="w-4 h-4 accent-zinc-950 shrink-0"
                          />
                          {StIcon && <StIcon className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
                          <span className="truncate">{isEn ? meta.labelEn : meta.labelAr}</span>
                        </span>
                        {locked && (
                          <span className="text-[10px] text-indigo-600 shrink-0">
                            {isEn ? 'Auto' : 'تلقائي'}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>

                {/* Custom Captain Screens Section */}
                <div className="pt-2 border-t border-zinc-200/80 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold text-teal-900">
                      {isEn
                        ? 'Assigned Captain Floor Screens (Optional hall/table scope)'
                        : 'شاشات الكابتن المخصصة (لتحديد صالة أو طاولات محددة لكل كابتن)'}
                    </span>
                    {canManageStations && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormOpen(false);
                          if (onOpenAddScreen) {
                            onOpenAddScreen('captain');
                          } else {
                            setSubView('stations');
                          }
                        }}
                        className="text-[11px] font-extrabold text-teal-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isEn ? 'New Captain Screen' : 'إضافة شاشة كابتن'}</span>
                      </button>
                    )}
                  </div>

                  {effectiveCaptainScreens.length === 0 ? (
                    <p className="text-[11px] text-zinc-500">
                      {isEn
                        ? 'No custom captain screens created yet — Captain access covers all tables by default.'
                        : 'لا توجد شاشات كابتن مخصصة بعد — افتراضياً تغطي شاشة الكابتن كل الطاولات.'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {effectiveCaptainScreens.map((cap) => {
                        const checked = allowedCaptainScreensInput.includes(cap.stationId);
                        return (
                          <label
                            key={cap.stationId}
                            className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                              checked
                                ? 'bg-teal-50 border-teal-700 text-teal-950'
                                : 'bg-white border-zinc-200 text-zinc-700'
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleAllowedCaptainScreen(cap.stationId)}
                                className="w-4 h-4 accent-teal-700 shrink-0"
                              />
                              <UserCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                              <span className="truncate">{loc(cap.label, cap.label_en)}</span>
                            </span>
                            <span className="text-[10px] text-teal-700 shrink-0">
                              {cap.tableVisibilityScope === 'assigned_only'
                                ? isEn
                                  ? 'Scoped'
                                  : 'مخصصة'
                                : isEn
                                  ? 'All'
                                  : 'الكل'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <label className="block space-y-1 text-xs font-bold text-zinc-800 pt-1">
                  <span>{isEn ? 'Default Screen After Sign-In' : 'الشاشة الافتراضية عند تسجيل الدخول'}</span>
                  <select
                    value={defaultScreenInput}
                    onChange={(e) => setDefaultScreenInput(e.target.value as StaffScreen)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs bg-white font-bold"
                  >
                    {allowedScreensInput.map((scr) => {
                      const meta = getScreenMetaDynamic(scr, effectiveStations);
                      return (
                        <option key={scr} value={scr}>
                          {isEn ? meta.labelEn : meta.labelAr}
                        </option>
                      );
                    })}
                  </select>
                </label>

                {/* Per-Employee Granular DB Permissions Override */}
                <div className="pt-2 border-t border-zinc-200/80 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowGranularOverrides((v) => !v)}
                    className="w-full flex items-center justify-between text-xs font-extrabold text-zinc-900 py-1 cursor-pointer"
                  >
                    <span>
                      {isEn
                        ? `Granular Permissions Override (${ALL_STAFF_PERMISSION_KEYS.filter((k) => effectivePermissionsInput[k]).length}/${ALL_STAFF_PERMISSION_KEYS.length} active)`
                        : `تخصيص الصلاحيات التفصيلية للموظف (${ALL_STAFF_PERMISSION_KEYS.filter((k) => effectivePermissionsInput[k]).length}/${ALL_STAFF_PERMISSION_KEYS.length} مفعّلة)`}
                    </span>
                    <span className="text-[11px] text-indigo-700">
                      {showGranularOverrides ? (isEn ? 'Hide' : 'إخفاء') : isEn ? 'Customize' : 'تخصيص'}
                    </span>
                  </button>

                  {showGranularOverrides && (
                    <div className="space-y-3 pt-1">
                      {PERMISSION_GROUPS.map((grp) => {
                        const grpItems = PERMISSION_CATALOG.filter((p) => p.group === grp.id);
                        return (
                          <div key={grp.id} className="space-y-1.5">
                            <p className="text-[11px] font-extrabold text-zinc-600">
                              {isEn ? grp.titleEn : grp.titleAr}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {grpItems.map((perm) => {
                                const checked = Boolean(effectivePermissionsInput[perm.key]);
                                const allowed = permAllowedInCeiling(perm.key);
                                return (
                                  <label
                                    key={perm.key}
                                    className={`flex items-start justify-between gap-2 p-2 rounded-xl border text-[11px] font-bold ${
                                      !allowed
                                        ? 'bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed'
                                        : checked
                                          ? 'bg-emerald-50 border-emerald-500 text-zinc-950 cursor-pointer'
                                          : 'bg-white border-zinc-200 text-zinc-700 cursor-pointer'
                                    }`}
                                  >
                                    <span className="flex items-start gap-2 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={!allowed}
                                        onChange={() => toggleSinglePermissionOverride(perm.key)}
                                        className="mt-0.5 w-3.5 h-3.5 accent-emerald-700 shrink-0"
                                      />
                                      <span className="leading-snug">
                                        {isEn ? perm.labelEn : perm.labelAr}
                                      </span>
                                    </span>
                                    {!allowed && <Lock className="w-3 h-3 shrink-0 mt-0.5" />}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Activation Mode for new creation */}
              {formKind !== 'edit' && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3">
                  <span className="text-xs font-extrabold text-indigo-950 block">
                    {isEn ? 'Account Activation & Password Setup' : 'طريقة تفعيل الحساب وكلمة المرور'}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUseOneTimeInvite(true)}
                      className={`p-3 rounded-xl border text-start space-y-0.5 cursor-pointer ${
                        useOneTimeInvite
                          ? 'bg-white border-indigo-600 ring-2 ring-indigo-200'
                          : 'bg-white/60 border-indigo-200/70'
                      }`}
                    >
                      <span className="text-xs font-extrabold text-zinc-950 flex items-center gap-1.5">
                        <QrCode className="w-4 h-4 text-indigo-600" />
                        <span>{isEn ? 'One-Time QR Invite (Most Secure)' : 'دعوة QR لمرة واحدة (الأكثر أماناً)'}</span>
                      </span>
                      <span className="text-[11px] text-zinc-500 block">
                        {isEn
                          ? 'Staff member scans the QR code and sets their strong password within 24 hours.'
                          : 'يمسح الموظف الكود ويعيّن كلمة مروره القوية بنفسه خلال 24 ساعة.'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUseOneTimeInvite(false)}
                      className={`p-3 rounded-xl border text-start space-y-0.5 cursor-pointer ${
                        !useOneTimeInvite
                          ? 'bg-white border-indigo-600 ring-2 ring-indigo-200'
                          : 'bg-white/60 border-indigo-200/70'
                      }`}
                    >
                      <span className="text-xs font-extrabold text-zinc-950 flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4 text-zinc-800" />
                        <span>{isEn ? 'Direct Initial Password' : 'كلمة مرور أولية مباشرة'}</span>
                      </span>
                      <span className="text-[11px] text-zinc-500 block">
                        {isEn
                          ? `Instant activation with direct sign-in at /staff/${restaurant.slug}.`
                          : `تفعيل فوري للحساب والدخول المباشر عبر /staff/${restaurant.slug}.`}
                      </span>
                    </button>
                  </div>

                  {!useOneTimeInvite && (
                    <label className="block space-y-1 text-xs font-bold text-zinc-800">
                      <span>
                        {isEn
                          ? 'Strong Initial Password * (never stored in plain text)'
                          : 'كلمة المرور الأولية القوية * (لا تُحفظ نصياً في قاعدة البيانات)'}
                      </span>
                      <input
                        type="password"
                        required={!useOneTimeInvite}
                        dir="ltr"
                        value={directPasswordInput}
                        onChange={(e) => setDirectPasswordInput(e.target.value)}
                        placeholder={isEn ? 'e.g. Sufra@2026' : 'مثال: Sufra@2026'}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </label>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isEn ? 'Saving...' : 'جاري الحفظ...'}</span>
                    </>
                  ) : formKind === 'edit' ? (
                    <span>{isEn ? 'Save Changes & Permissions' : 'حفظ التعديلات والصلاحيات'}</span>
                  ) : useOneTimeInvite ? (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>{isEn ? 'Create Account & Issue QR Invite' : 'إنشاء الحساب وإصدار دعوة QR'}</span>
                    </>
                  ) : (
                    <span>{isEn ? 'Create & Activate Now' : 'إنشاء الحساب وتفعيله الآن'}</span>
                  )}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setFormOpen(false)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  {isEn ? 'Cancel' : 'إلغاء'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ONE-TIME INVITE QR MODAL */}
      {inviteModalData && inviteModalData.inviteUrl && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setInviteModalData(null)}
          dir={dir}
        >
          <div
            className="bg-white border border-zinc-200 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 print:hidden">
              <div className="space-y-0.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-extrabold">
                  <Check className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Secure Staff Invite Ready' : 'تم تجهيز دعوة الكادر الآمنة'}</span>
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-zinc-950 pt-1">
                  {isEn ? 'One-Time Activation Card (QR)' : 'بطاقة دعوة التفعيل لمرة واحدة'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalData(null)}
                aria-label={isEn ? 'Close' : 'إغلاق'}
                className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Card Area */}
            <div className="qr-bulk-print-area bg-zinc-50 border border-zinc-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5">
              <div className="bg-white p-3 rounded-2xl border border-zinc-200 shadow-2xs shrink-0">
                <canvas ref={inviteCanvasRef} className="block" />
              </div>

              <div className="space-y-2 text-center sm:text-start flex-1 min-w-0">
                <p className="text-xs font-bold text-indigo-700">{restDisplayName}</p>
                <h4 className="text-base font-extrabold text-zinc-950">
                  {inviteModalData.staff.name}
                </h4>
                <div className="space-y-1 text-xs text-zinc-700">
                  <p>
                    <span className="text-zinc-500">{isEn ? 'Username:' : 'اسم المستخدم:'}</span>{' '}
                    <strong className="font-mono-num" dir="ltr">@{inviteModalData.staff.username}</strong>
                  </p>
                  <p>
                    <span className="text-zinc-500">{isEn ? 'Role:' : 'الوظيفة:'}</span>{' '}
                    <strong>
                      {isEn
                        ? STAFF_ROLE_META[inviteModalData.staff.role]?.labelEn
                        : STAFF_ROLE_META[inviteModalData.staff.role]?.labelAr}
                    </strong>
                  </p>
                  {inviteModalData.staff.hallName && (
                    <p>
                      <span className="text-zinc-500">{isEn ? 'Hall:' : 'الصالة:'}</span>{' '}
                      <strong>{inviteModalData.staff.hallName}</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-950 leading-relaxed space-y-1 print:hidden">
              <p>
                {isEn
                  ? 'This invite link is valid once only and expires in 24 hours. The QR contains no username or password — the employee sets their own strong password on scan.'
                  : 'رابط الدعوة صالح لمرة واحدة فقط ولمدة 24 ساعة. لا يحتوي رمز الاستجابة على أي اسم مستخدم أو كلمة مرور — يضبط الموظف كلمة مروره القوية عند المسح.'}
              </p>
              <p className="text-indigo-900">
                {isEn ? (
                  <>
                    After activation, managers & staff sign in through the Staff Portal{' '}
                    <span dir="ltr" className="font-mono-num underline">/staff/{restaurant.slug}</span>{' '}
                    (not Google Sign-In on /admin).
                  </>
                ) : (
                  <>
                    بعد التفعيل، يسجّل المدير أو الموظف دخوله من بوابة الكادر{' '}
                    <span dir="ltr" className="font-mono-num underline">/staff/{restaurant.slug}</span>{' '}
                    (وليس عبر تسجيل دخول جوجل في لوحة المالك).
                  </>
                )}
              </p>
            </div>

            <div
              dir="ltr"
              className="px-3 py-2 rounded-xl bg-zinc-100 border border-zinc-200 text-[11px] font-mono-num text-zinc-800 truncate select-all print:hidden"
            >
              {inviteModalData.inviteUrl}
            </div>

            <div className="grid grid-cols-2 gap-2 print:hidden">
              <button
                type="button"
                onClick={handleDownloadInviteQr}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isEn ? 'Download PNG' : 'تحميل PNG'}</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{isEn ? 'Print Card' : 'طباعة الكارت'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {inviteCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>
                  {inviteCopied
                    ? isEn
                      ? 'Link Copied'
                      : 'تم نسخ الرابط'
                    : isEn
                      ? 'Copy Invite Link'
                      : 'نسخ رابط الدعوة'}
                </span>
              </button>

              <a
                href={`https://wa.me/${inviteModalData.staff.phone ? inviteModalData.staff.phone.replace(/^0/, '20') : ''}?text=${encodeURIComponent(
                  isEn
                    ? `Hello ${inviteModalData.staff.name},\nHere is your personal one-time invite to activate your staff account at "${restDisplayName}" (${STAFF_ROLE_META[inviteModalData.staff.role].labelEn}):\n${inviteModalData.inviteUrl}\n\nNote: This link works once and expires in 24 hours.`
                    : `مرحباً ${inviteModalData.staff.name}،\nهذه دعوتك الخاصة لتفعيل حسابك في كادر مطعم "${restDisplayName}" (${STAFF_ROLE_META[inviteModalData.staff.role].labelAr}):\n${inviteModalData.inviteUrl}\n\nتنبيه: الرابط صالح لمرة واحدة ولمدة 24 ساعة.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{isEn ? 'Send via WhatsApp' : 'إرسال عبر واتساب'}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* STAFF SUSPENSION MODAL */}
      {suspendTarget && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => !suspending && setSuspendTarget(null)}
          dir={dir}
        >
          <form
            onSubmit={handleConfirmSuspend}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-zinc-200 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto"
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3">
              <div className="space-y-0.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-extrabold">
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Suspend Staff Access' : 'إيقاف شاشة الموظف'}</span>
                </span>
                <h3 className="text-base font-extrabold text-zinc-950 pt-1">
                  {isEn ? `Suspend ${suspendTarget.name}` : `إيقاف ${suspendTarget.name}`}
                </h3>
              </div>
              <button
                type="button"
                disabled={suspending}
                onClick={() => setSuspendTarget(null)}
                aria-label={isEn ? 'Close' : 'إغلاق'}
                className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSuspendType('timed')}
                className={`p-3 rounded-xl border text-start space-y-0.5 cursor-pointer ${
                  suspendType === 'timed'
                    ? 'bg-amber-50 border-amber-500 text-amber-950'
                    : 'bg-white border-zinc-200 text-zinc-700'
                }`}
              >
                <p className="text-xs font-extrabold">{isEn ? 'Timed Suspension' : 'إيقاف محدد المدة'}</p>
                <p className="text-[11px] text-zinc-500">
                  {isEn ? 'Automatically lifts when time ends' : 'يُرفع تلقائياً بانتهاء الوقت'}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSuspendType('indefinite')}
                className={`p-3 rounded-xl border text-start space-y-0.5 cursor-pointer ${
                  suspendType === 'indefinite'
                    ? 'bg-rose-50 border-rose-500 text-rose-950'
                    : 'bg-white border-zinc-200 text-zinc-700'
                }`}
              >
                <p className="text-xs font-extrabold">{isEn ? 'Indefinite Suspension' : 'إيقاف مفتوح'}</p>
                <p className="text-[11px] text-zinc-500">
                  {isEn ? 'Until manually restored by management' : 'حتى تفعيله يدوياً من الإدارة'}
                </p>
              </button>
            </div>

            {suspendType === 'timed' && (
              <div className="space-y-2.5 p-3 rounded-2xl bg-zinc-50 border border-zinc-200">
                <span className="text-xs font-bold text-zinc-800 block">
                  {isEn ? 'Choose suspension duration:' : 'اختر مدة الإيقاف:'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[2, 6, 24, 72].map((hrs) => (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => {
                        setSuspendHours(hrs);
                        setSuspendCustomUntil('');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${
                        !suspendCustomUntil && suspendHours === hrs
                          ? 'bg-zinc-950 text-white'
                          : 'bg-white border border-zinc-200 text-zinc-700'
                      }`}
                    >
                      {isEn ? `${hrs}h` : `${hrs} ساعة`}
                    </button>
                  ))}
                </div>
                <label className="block space-y-1 text-[11px] font-bold text-zinc-700">
                  <span>
                    {isEn
                      ? 'Or set exact end date & time:'
                      : 'أو حدد تاريخ وساعة انتهاء الإيقاف:'}
                  </span>
                  <input
                    type="datetime-local"
                    dir="ltr"
                    value={suspendCustomUntil}
                    onChange={(e) => setSuspendCustomUntil(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs bg-white"
                  />
                </label>
              </div>
            )}

            <label className="block space-y-1 text-xs font-bold text-zinc-800">
              <span>
                {isEn
                  ? 'Suspension Reason (shown to staff if they attempt sign-in) *'
                  : 'سبب الإيقاف (يظهر للموظف عند محاولة الدخول) *'}
              </span>
              <textarea
                required
                rows={2}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder={
                  isEn
                    ? 'e.g. Leave / Administrative review / Repeated tardiness...'
                    : 'مثال: إجازة / مراجعة إدارية / تأخير متكرر...'
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </label>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={suspending}
                className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {suspending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                <span>{isEn ? 'Confirm Suspension' : 'تأكيد إيقاف الشاشة'}</span>
              </button>
              <button
                type="button"
                disabled={suspending}
                onClick={() => setSuspendTarget(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                {isEn ? 'Cancel' : 'إلغاء'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
