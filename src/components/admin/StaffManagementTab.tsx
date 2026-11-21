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
  Mail,
  MessageCircle,
  Plus,
  Printer,
  QrCode,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { subscribeHalls } from '../../lib/firestoreService';
import { subscribeAllActiveRestaurantShifts } from '../../lib/shiftsService';
import {
  getDefaultScreensForRole,
  getManagerScreensForStations,
  getScreenMetaDynamic,
  STAFF_ROLE_META,
} from '../../lib/staffAuthUtils';
import {
  canResetStaffViaEmail,
  CreatedStaffResult,
  createManagerOrStaffAccount,
  deleteRestaurantStaffMember,
  regenerateStaffInvite,
  sendStaffPasswordResetByEmail,
  subscribeRestaurantStaff,
  subscribeStaffAuditLogs,
  updateStaffPermissionsAndProfile,
} from '../../lib/staffService';
import { subscribeRestaurantStations } from '../../lib/stationsService';
import {
  buildEffectiveStations,
  cleanStationId,
  getStationIconComponent,
  screenToStationId,
  stationIdToScreen,
} from '../../lib/stationUtils';
import {
  Hall,
  Restaurant,
  RestaurantStation,
  StaffActorInfo,
  StaffAuditLog,
  StaffMember,
  StaffRole,
  StaffScreen,
  StaffShift,
} from '../../types/menu';
import { AuthorizedDomainsCard } from './AuthorizedDomainsCard';
import { StaffPortalShareCard } from './StaffPortalShareCard';
import { StationsManagerTab } from './StationsManagerTab';

interface StaffManagementTabProps {
  restaurant: Restaurant;
  mode: 'owner' | 'manager';
  actor: StaffActorInfo;
}

const AUDIT_LABELS: Record<string, string> = {
  staff_created: 'إنشاء عضو كادر',
  staff_updated: 'تحديث بيانات / صلاحيات',
  staff_deleted: 'حذف عضو كادر',
  invite_created: 'إصدار دعوة QR',
  invite_used: 'تفعيل حساب بدعوة QR',
  password_changed: 'تغيير كلمة المرور',
  staff_login: 'تسجيل دخول كادر',
  order_created: 'إنشاء طلب',
  order_status_updated: 'تحديث حالة طلب',
  kds_item_updated: 'تحديث شاشة تحضير (KDS)',
  table_closed: 'إقفال حساب طاولة',
  service_call_handled: 'تلبية نداء طاولة',
  station_created: 'إضافة قسم تحضير',
  station_updated: 'تعديل قسم تحضير',
  station_deleted: 'حذف قسم تحضير',
  shift_started: 'بدء وردية',
  shift_ended: 'إنهاء وردية',
  station_uncovered_alert: 'تنبيه قسم بلا وردية',
  domain_verified: 'فحص نطاق المصادقة',
};

function formatAuditTime(ts: unknown): string {
  if (!ts) return 'الآن';
  let ms = 0;
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    ms = Number((ts as { seconds: number }).seconds) * 1000;
  } else if (ts instanceof Date) {
    ms = ts.getTime();
  }
  if (!ms) return 'الآن';
  return new Date(ms).toLocaleString('ar-EG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StaffManagementTab({ restaurant, mode, actor }: StaffManagementTabProps) {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<StaffAuditLog[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [dynamicStations, setDynamicStations] = useState<RestaurantStation[]>([]);
  const [activeShifts, setActiveShifts] = useState<StaffShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subView, setSubView] = useState<'members' | 'stations' | 'audit'>('members');
  const [roleFilter, setRoleFilter] = useState<'all' | StaffRole>('all');
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);

  // Form Modal State (Add Manager / Add Employee / Edit Staff)
  const [formOpen, setFormOpen] = useState(false);
  const [formKind, setFormKind] = useState<'manager' | 'employee' | 'edit'>('employee');
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);

  const [nameInput, setNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [jobTitleInput, setJobTitleInput] = useState('');
  const [roleInput, setRoleInput] = useState<StaffRole>('cashier');
  const [hallIdInput, setHallIdInput] = useState('');
  const [allowedScreensInput, setAllowedScreensInput] = useState<StaffScreen[]>(['cashier']);
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
    setLoading(true);
    setLoadError(null);

    const unsubStaff = subscribeRestaurantStaff(
      restaurant.id,
      (list) => {
        setStaffList(list);
        setLoading(false);
      },
      (err) => {
        setLoadError(err.message || 'تعذر تحميل قائمة الكادر');
        setLoading(false);
      }
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
      unsubAudit();
      unsubHalls();
      unsubStations();
      unsubShifts();
    };
  }, [restaurant.id]);

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

  const dynamicManagerScreens = useMemo(
    () => getManagerScreensForStations(effectiveStations),
    [effectiveStations]
  );

  const dynamicEmployeeAssignableScreens = useMemo<StaffScreen[]>(
    () => [
      'cashier',
      ...effectiveStations.map((st) => stationIdToScreen(st.stationId)),
      'captain',
      'halls',
    ],
    [effectiveStations]
  );

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
    if (roleFilter === 'all') return staffList;
    return staffList.filter((m) => m.role === roleFilter);
  }, [staffList, roleFilter]);

  const openCreateManagerModal = () => {
    setFormKind('manager');
    setEditingMember(null);
    setNameInput('');
    setUsernameInput('');
    setPhoneInput('');
    setEmailInput('');
    setJobTitleInput('مدير تشغيل المطعم');
    setRoleInput('manager');
    setHallIdInput('');
    setAllowedScreensInput([...dynamicManagerScreens]);
    setDefaultScreenInput('staff_management');
    setUseOneTimeInvite(true);
    setDirectPasswordInput('');
    setFormError(null);
    setFormOpen(true);
  };

  const openCreateEmployeeModal = () => {
    const defaults = getDefaultScreensForRole('cashier', effectiveStations);
    setFormKind('employee');
    setEditingMember(null);
    setNameInput('');
    setUsernameInput('');
    setPhoneInput('');
    setEmailInput('');
    setJobTitleInput('');
    setRoleInput('cashier');
    setHallIdInput('');
    setAllowedScreensInput(defaults.allowedScreens);
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
    setRoleInput(member.role);
    setHallIdInput(member.hallId || '');
    setAllowedScreensInput(member.allowedScreens || ['cashier']);
    setDefaultScreenInput(member.defaultScreen || member.allowedScreens?.[0] || 'cashier');
    setUseOneTimeInvite(false);
    setDirectPasswordInput('');
    setFormError(null);
    setFormOpen(true);
  };

  const handleRoleSelectionChange = (nextRole: StaffRole) => {
    setRoleInput(nextRole);
    const defaults = getDefaultScreensForRole(nextRole, effectiveStations);
    setAllowedScreensInput(defaults.allowedScreens);
    setDefaultScreenInput(defaults.defaultScreen);
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

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    setActionMsg(null);
    setActionError(null);

    const selectedHall = halls.find((h) => h.id === hallIdInput);
    const hallName = selectedHall ? selectedHall.name : editingMember?.hallName || '';

    const finalScreens =
      formKind === 'manager' || roleInput === 'manager'
        ? Array.from(new Set([...dynamicManagerScreens, ...allowedScreensInput]))
        : allowedScreensInput;

    const extractedStations = Array.from(
      new Set(
        finalScreens
          .map((scr) => screenToStationId(scr))
          .filter((id): id is string => Boolean(id))
      )
    );
    const defaultFromScreen = screenToStationId(
      formKind === 'manager' ? 'staff_management' : defaultScreenInput
    );
    const defaultStationId = defaultFromScreen || extractedStations[0] || '';

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
            jobTitle: jobTitleInput,
            role: mode === 'owner' ? roleInput : editingMember.role === 'manager' ? 'manager' : roleInput,
            allowedScreens: finalScreens,
            allowedStations: extractedStations,
            defaultStationId,
            defaultScreen: defaultScreenInput,
            hallId: hallIdInput,
            hallName: selectedHall ? selectedHall.name : '',
          },
        });
        setFormOpen(false);
        setActionMsg(`تم تحديث بيانات وصلاحيات "${nameInput.trim()}" بنجاح.`);
      } else {
        const result = await createManagerOrStaffAccount({
          restaurant,
          actor,
          name: nameInput,
          username: usernameInput,
          phone: phoneInput,
          email: emailInput,
          jobTitle: jobTitleInput,
          role: formKind === 'manager' ? 'manager' : roleInput,
          allowedScreens: finalScreens,
          allowedStations: extractedStations,
          defaultStationId,
          defaultScreen:
            formKind === 'manager' ? 'staff_management' : defaultScreenInput,
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
          setActionMsg(
            `تم إنشاء حساب "${result.staff.name}" (${STAFF_ROLE_META[result.staff.role]?.labelAr || result.staff.role}) وتفعيله مباشرة.`
          );
        }
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'تعذر حفظ بيانات الموظف.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStaffMember = async (member: StaffMember) => {
    if (mode === 'manager' && member.role === 'manager') {
      setActionError('حذف المدير يتم من حساب المالك فقط.');
      return;
    }
    if (member.uid === actor.uid) {
      setActionError('لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول.');
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
      setActionMsg(`تم حذف "${member.name}" وإلغاء وصوله وصلاحياته فوراً.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر حذف الموظف.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleActive = async (member: StaffMember) => {
    if (mode === 'manager' && member.role === 'manager' && member.uid !== actor.uid) {
      setActionError('لا يمكن للمدير إيقاف مدير آخر. يتم هذا من حساب المالك فقط.');
      return;
    }
    if (member.uid === actor.uid) {
      setActionError('لا يمكنك إيقاف حسابك الحالي أثناء تسجيل الدخول.');
      return;
    }
    setBusyUid(member.uid);
    setActionError(null);
    setActionMsg(null);
    try {
      await updateStaffPermissionsAndProfile({
        restaurantId: restaurant.id,
        staff: member,
        actor,
        updates: { isActive: !member.isActive },
      });
      setActionMsg(
        !member.isActive
          ? `تم تفعيل حساب "${member.name}" بنجاح.`
          : `تم إيقاف حساب "${member.name}" فوراً.`
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر تغيير حالة الحساب.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleRegenerateInvite = async (member: StaffMember) => {
    if (mode === 'manager' && member.role === 'manager' && member.uid !== actor.uid) {
      setActionError('إعادة تعيين وصول مدير آخر يتم من حساب المالك.');
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
      setActionError(err instanceof Error ? err.message : 'تعذر إنشاء رابط دعوة جديد.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleSendPasswordReset = async (member: StaffMember) => {
    if (!canResetStaffViaEmail(member)) {
      setActionError(
        'هذا الحساب مفعّل بدعوة QR وبمعرّف داخلي (@staff.sufra.local). لإعادة تعيين كلمة المرور استخدم زر "دعوة QR جديدة / تصفير".'
      );
      return;
    }
    setBusyUid(member.uid);
    setActionError(null);
    setActionMsg(null);
    try {
      await sendStaffPasswordResetByEmail(member.email || '', member.authEmail);
      setActionMsg(`تم إرسال رابط إعادة تعيين كلمة المرور إلى ${member.email}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر إرسال رابط استعادة البريد.');
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
    <div dir="rtl" className="space-y-5">
      {/* Top Action Header */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-zinc-950">
                إدارة المدير والكادر والصلاحيات
              </h2>
              <span className="text-xs font-bold text-zinc-500 font-mono-num">
                ({staffList.length} إجمالي · {activeStaffCount} مفعّل)
              </span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-2xl">
              {mode === 'owner'
                ? 'أنشئ حساب مدير المطعم (Manager) ليتولى إدارة الكادر والتشغيل، أو أضف الموظفين بدعوة QR آمنة لمرة واحدة دون صلاحيات حساسة للمالك.'
                : 'أنشئ موظفي الصالة والمطبخ والبار والكاشير، وحدد الشاشات المسموح بها لكل موظف مع رابط دعوة QR لمرة واحدة.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {mode === 'owner' && (
              <button
                type="button"
                onClick={openCreateManagerModal}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
              >
                <Crown className="w-4 h-4 shrink-0" />
                <span>إنشاء حساب مدير (Manager)</span>
              </button>
            )}
            <button
              type="button"
              onClick={openCreateEmployeeModal}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>إضافة موظف + دعوة QR</span>
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
              <span>أعضاء الكادر والصلاحيات</span>
            </button>
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
              <span>الأقسام الرئيسية والمحطات ({effectiveStations.length})</span>
            </button>
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
              <span>سجل التتبع والأمان ({auditLogs.length})</span>
            </button>
          </div>

          {subView === 'members' && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                ['all', 'manager', 'cashier', 'station_staff', 'kitchen', 'bar', 'pastry', 'captain', 'custom'] as const
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
                  {r === 'all' ? 'الكل' : STAFF_ROLE_META[r].labelAr}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Owner-only Authorized Domains Verification Card */}
      <AuthorizedDomainsCard restaurant={restaurant} actor={actor} auditLogs={auditLogs} />

      {/* Auto Staff Portal Card once a Manager exists (plus owner preview tip if none yet) */}
      {managers.length > 0 ? (
        <StaffPortalShareCard restaurant={restaurant} managersCount={managers.length} />
      ) : mode === 'owner' ? (
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>بطاقة صفحة الكادر (/staff/{restaurant.slug}) ستظهر هنا تلقائياً عند إنشاء أول مدير</span>
            </p>
            <p className="text-[11px] text-indigo-800">
              يمنح حساب المدير صلاحيات إدارة الكادر والشاشات والصالات والطلبات فقط دون حذف المطعم أو الاشتراك أو بيانات العملاء.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateManagerModal}
            className="min-h-[38px] px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer"
          >
            أنشئ حساب مدير الآن
          </button>
        </div>
      ) : null}

      {actionMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center justify-between gap-2">
          <span>{actionMsg}</span>
          <button type="button" onClick={() => setActionMsg(null)} className="p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900 flex items-center justify-between gap-2">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="p-1 cursor-pointer">
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

      {subView === 'stations' ? (
        <StationsManagerTab restaurant={restaurant} actor={actor} activeShifts={activeShifts} />
      ) : loading ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center space-y-2">
          <Loader2 className="w-7 h-7 animate-spin text-zinc-500 mx-auto" />
          <p className="text-xs font-bold text-zinc-600">جاري تحميل بيانات الكادر...</p>
        </div>
      ) : subView === 'audit' ? (
        /* AUDIT LOGS VIEW */
        <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-extrabold text-zinc-900">
              سجل العمليات والأمان (آخر 120 عملية)
            </h3>
            <span className="text-[11px] text-zinc-500">محمي ضد التعديل أو الحذف</span>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-10 text-center text-xs text-zinc-500">
              لا توجد عمليات مسجلة حتى الآن.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-zinc-50/60"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-zinc-900 text-white text-[10px] font-bold">
                        {AUDIT_LABELS[log.eventType] || log.eventType}
                      </span>
                      <span className="font-extrabold text-zinc-950">{log.actorName}</span>
                      <span className="text-[11px] text-zinc-500">
                        ({log.actorRole === 'owner' ? 'المالك' : STAFF_ROLE_META[log.actorRole as StaffRole]?.labelAr || log.actorRole})
                      </span>
                      {log.screen && (
                        <span className="text-[11px] text-indigo-700 font-bold">
                          · {getScreenMetaDynamic(log.screen, effectiveStations).shortAr}
                        </span>
                      )}
                    </div>
                    {log.details && <p className="text-zinc-600">{log.details}</p>}
                  </div>
                  <span className="text-[11px] font-mono-num text-zinc-400 shrink-0">
                    {formatAuditTime(log.createdAt)}
                  </span>
                </div>
              ))}
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
                <span>الورديات النشطة الآن: {activeShifts.length}</span>
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
                <span>أقسام بدون وردية حالياً:</span>
                {uncoveredStations.map((st) => (
                  <span
                    key={st.stationId}
                    className="px-2 py-0.5 rounded-md bg-white border border-amber-300 text-[11px] font-extrabold text-amber-950"
                  >
                    {st.shortLabel}
                  </span>
                ))}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700">
                <Check className="w-4 h-4" />
                <span>جميع أقسام التحضير مغطاة بوردية نشطة</span>
              </span>
            )}
          </div>

          {filteredStaff.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center space-y-3">
              <Users className="w-10 h-10 text-zinc-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-zinc-900">لا يوجد أعضاء في هذه الفئة بعد</h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  ابدأ بإنشاء حساب المدير أو أضف أفراد الكادر بدعوة QR لمرة واحدة لتفعيل شاشات التشغيل المخصصة لهم.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {mode === 'owner' && (
                  <button
                    type="button"
                    onClick={openCreateManagerModal}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-extrabold cursor-pointer"
                  >
                    إنشاء حساب مدير
                  </button>
                )}
                <button
                  type="button"
                  onClick={openCreateEmployeeModal}
                  className="px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-extrabold cursor-pointer"
                >
                  إضافة موظف جديد
                </button>
              </div>
            </div>
          ) : (
            /* STAFF MEMBERS CARDS GRID */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredStaff.map((member) => {
                const roleMeta = STAFF_ROLE_META[member.role] || STAFF_ROLE_META.cashier;
                const isBusy = busyUid === member.uid;
                const isManagerLocked = mode === 'manager' && member.role === 'manager' && member.uid !== actor.uid;
                const memberShifts = activeShiftByStaffUid.get(member.uid) || [];

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
                              {roleMeta.labelAr}
                            </span>
                            {memberShifts.length > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-900 text-[10px] font-extrabold inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                <span>في الوردية الآن ({memberShifts[0].stationName})</span>
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
                          </p>
                          {(member.jobTitle || member.hallName) && (
                            <p className="text-[11px] text-zinc-600 font-semibold">
                              {member.jobTitle ? member.jobTitle : ''}
                              {member.jobTitle && member.hallName ? ' · ' : ''}
                              {member.hallName ? `الصالة: ${member.hallName}` : ''}
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
                            ? 'بانتظار تفعيل QR'
                            : member.isActive
                              ? 'نشط'
                              : 'موقوف'}
                        </span>
                      </div>

                      {/* Assigned Screens */}
                      <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-2.5 space-y-1.5">
                        <p className="text-[11px] font-bold text-zinc-500">
                          الشاشات المصرّح بها (الافتراضية: {getScreenMetaDynamic(member.defaultScreen, effectiveStations).shortAr}):
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(member.allowedScreens || []).map((scr) => {
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
                                {meta.shortAr}
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
                          <span>تعديل الصلاحيات</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy || isManagerLocked}
                          onClick={() => handleRegenerateInvite(member)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                        >
                          {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                          <span>دعوة QR جديدة / تصفير</span>
                        </button>

                        {canResetStaffViaEmail(member) && (
                          <button
                            type="button"
                            disabled={isBusy || isManagerLocked}
                            onClick={() => handleSendPasswordReset(member)}
                            className="min-h-[36px] px-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>استعادة بالإيميل</span>
                          </button>
                        )}

                        {member.uid !== actor.uid && !isManagerLocked && (
                          <>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleToggleActive(member)}
                              className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 ${
                                member.isActive
                                  ? 'border border-amber-300 text-amber-800 hover:bg-amber-50'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                              }`}
                            >
                              {member.isActive ? (
                                <>
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>إيقاف</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>تفعيل</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                setConfirmDeleteUid((prev) => (prev === member.uid ? null : member.uid))
                              }
                              className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                              title="حذف الموظف نهائياً"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          </>
                        )}
                      </div>

                      {!canResetStaffViaEmail(member) && (
                        <p className="text-[11px] text-zinc-500">
                          حساب مُدار بدعوة QR — لتغيير كلمة المرور أو استعادتها استخدم{' '}
                          <span className="font-bold text-indigo-700">دعوة QR جديدة / تصفير</span>.
                        </p>
                      )}

                      {confirmDeleteUid === member.uid && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-rose-900">
                            تأكيد حذف "{member.name}" وإلغاء جميع صلاحياته؟
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDeleteStaffMember(member)}
                              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold cursor-pointer disabled:opacity-50"
                            >
                              تأكيد الحذف
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUid(null)}
                              className="px-2.5 py-1 rounded-lg border border-zinc-300 bg-white text-zinc-700 font-bold cursor-pointer"
                            >
                              تراجع
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
                      <span>إنشاء حساب مدير المطعم (Manager)</span>
                    </>
                  ) : formKind === 'edit' ? (
                    <>
                      <Edit3 className="w-5 h-5 text-zinc-800" />
                      <span>تعديل بيانات وصلاحيات الكادر</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5 text-zinc-900" />
                      <span>إضافة موظف جديد وتحديد الصلاحيات</span>
                    </>
                  )}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {formKind === 'manager'
                    ? 'يحصل المدير تلقائياً على صلاحيات إدارة الكادر والشاشات والصالات دون صلاحيات المالك الحساسة.'
                    : 'اختر الدور والشاشات المصرّح بها، ثم اختر طريقة التفعيل عبر QR لمرة واحدة أو كلمة مرور مباشرة.'}
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setFormOpen(false)}
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
                  <span>الاسم الكامل *</span>
                  <input
                    type="text"
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="مثال: أحمد محمود"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </label>

                <label className="space-y-1 text-xs font-bold text-zinc-800">
                  <span>اسم المستخدم (Username) *</span>
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
                  <span>رقم الهاتف *</span>
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
                  <span>البريد الإلكتروني (اختياري)</span>
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
                    <span>الدور الوظيفي *</span>
                    <select
                      value={roleInput}
                      disabled={formKind === 'edit' && editingMember?.role === 'manager'}
                      onChange={(e) => handleRoleSelectionChange(e.target.value as StaffRole)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-100"
                    >
                      {mode === 'owner' && (
                        <option value="manager">مدير المطعم (Manager)</option>
                      )}
                      <option value="cashier">كاشير</option>
                      <option value="station_staff">شيف / مسؤول قسم تحضير</option>
                      <option value="kitchen">شيف المطبخ</option>
                      <option value="bar">باريستا / بار</option>
                      <option value="pastry">باستري / حلويات</option>
                      <option value="captain">كابتن صالة / ويتر</option>
                      <option value="custom">صلاحيات مخصصة</option>
                    </select>
                  </label>
                )}

                <label className="space-y-1 text-xs font-bold text-zinc-800">
                  <span>المسمى الوظيفي (اختياري)</span>
                  <input
                    type="text"
                    value={jobTitleInput}
                    onChange={(e) => setJobTitleInput(e.target.value)}
                    placeholder="مثال: كاشير شيفت مسائي"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </label>

                <label className="space-y-1 text-xs font-bold text-zinc-800 sm:col-span-2">
                  <span>الصالة المسندة (اختياري — خاصةً للكابتن والويتر)</span>
                  <select
                    value={hallIdInput}
                    onChange={(e) => setHallIdInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <option value="">كل الصالات / غير محدد</option>
                    {halls.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.tableCount} طاولة)
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Allowed Screens */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-zinc-900">
                    الشاشات والأقسام المسموح بها لهذا الحساب
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    يمكن اختيار أي مزيج من الشاشات وأقسام التحضير ({assignableScreens.length} متاح)
                  </span>
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
                          <span className="truncate">{meta.labelAr}</span>
                        </span>
                        {locked && <span className="text-[10px] text-indigo-600 shrink-0">تلقائي</span>}
                      </label>
                    );
                  })}
                </div>

                <label className="block space-y-1 text-xs font-bold text-zinc-800 pt-1">
                  <span>الشاشة الافتراضية عند تسجيل الدخول</span>
                  <select
                    value={defaultScreenInput}
                    onChange={(e) => setDefaultScreenInput(e.target.value as StaffScreen)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs bg-white font-bold"
                  >
                    {allowedScreensInput.map((scr) => (
                      <option key={scr} value={scr}>
                        {getScreenMetaDynamic(scr, effectiveStations).labelAr}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Activation Mode for new creation */}
              {formKind !== 'edit' && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3">
                  <span className="text-xs font-extrabold text-indigo-950 block">
                    طريقة تفعيل الحساب وكلمة المرور
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
                        <span>دعوة QR لمرة واحدة (الأكثر أماناً)</span>
                      </span>
                      <span className="text-[11px] text-zinc-500 block">
                        يمسح الموظف الكود ويعيّن كلمة مروره القوية بنفسه خلال 24 ساعة.
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
                        <span>كلمة مرور أولية مباشرة</span>
                      </span>
                      <span className="text-[11px] text-zinc-500 block">
                        تفعيل فوري للحساب والدخول المباشر عبر /staff/{restaurant.slug}.
                      </span>
                    </button>
                  </div>

                  {!useOneTimeInvite && (
                    <label className="block space-y-1 text-xs font-bold text-zinc-800">
                      <span>كلمة المرور الأولية القوية * (لا تُحفظ نصياً في قاعدة البيانات)</span>
                      <input
                        type="password"
                        required={!useOneTimeInvite}
                        dir="ltr"
                        value={directPasswordInput}
                        onChange={(e) => setDirectPasswordInput(e.target.value)}
                        placeholder="مثال: Sufra@2026"
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
                      <span>جاري الحفظ...</span>
                    </>
                  ) : formKind === 'edit' ? (
                    <span>حفظ التعديلات والصلاحيات</span>
                  ) : useOneTimeInvite ? (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>إنشاء الحساب وإصدار دعوة QR</span>
                    </>
                  ) : (
                    <span>إنشاء الحساب وتفعيله الآن</span>
                  )}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setFormOpen(false)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  إلغاء
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
        >
          <div
            className="bg-white border border-zinc-200 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 print:hidden">
              <div className="space-y-0.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-extrabold">
                  <Check className="w-3.5 h-3.5" />
                  <span>تم تجهيز دعوة الكادر الآمنة</span>
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-zinc-950 pt-1">
                  بطاقة دعوة التفعيل لمرة واحدة (QR)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalData(null)}
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
                <p className="text-xs font-bold text-indigo-700">{restaurant.name}</p>
                <h4 className="text-base font-extrabold text-zinc-950">
                  {inviteModalData.staff.name}
                </h4>
                <div className="space-y-1 text-xs text-zinc-700">
                  <p>
                    <span className="text-zinc-500">اسم المستخدم:</span>{' '}
                    <strong className="font-mono-num" dir="ltr">@{inviteModalData.staff.username}</strong>
                  </p>
                  <p>
                    <span className="text-zinc-500">الوظيفة:</span>{' '}
                    <strong>{STAFF_ROLE_META[inviteModalData.staff.role]?.labelAr}</strong>
                  </p>
                  {inviteModalData.staff.hallName && (
                    <p>
                      <span className="text-zinc-500">الصالة:</span>{' '}
                      <strong>{inviteModalData.staff.hallName}</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-950 leading-relaxed space-y-1 print:hidden">
              <p>
                رابط الدعوة صالح لمرة واحدة فقط ولمدة 24 ساعة. لا يحتوي رمز QR على أي اسم مستخدم أو كلمة مرور — يضبط الموظف كلمة مروره القوية عند المسح.
              </p>
              <p className="text-indigo-900">
                بعد التفعيل، يسجّل المدير أو الموظف دخوله من بوابة الكادر{' '}
                <span dir="ltr" className="font-mono-num underline">/staff/{restaurant.slug}</span>{' '}
                (وليس عبر تسجيل دخول جوجل في /admin).
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
                <span>تحميل PNG</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الكارت</span>
              </button>

              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {inviteCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{inviteCopied ? 'تم نسخ الرابط' : 'نسخ رابط الدعوة'}</span>
              </button>

              <a
                href={`https://wa.me/${inviteModalData.staff.phone ? inviteModalData.staff.phone.replace(/^0/, '20') : ''}?text=${encodeURIComponent(
                  `مرحباً ${inviteModalData.staff.name}،\nهذه دعوتك الخاصة لتفعيل حسابك في كادر مطعم "${restaurant.name}" (${STAFF_ROLE_META[inviteModalData.staff.role].labelAr}):\n${inviteModalData.inviteUrl}\n\n⚠️ الرابط صالح لمرة واحدة ولمدة 24 ساعة.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>إرسال عبر واتساب</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
