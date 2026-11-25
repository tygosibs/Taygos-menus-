import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Edit3,
  Home,
  Layers,
  Loader2,
  Lock,
  Plus,
  Save,
  Shield,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatFirestoreErrorMessage } from '../../lib/firebase';
import {
  ActorDelegationCeiling,
  createJobTitle,
  deleteJobTitle,
  SaveJobTitleInput,
  seedDefaultJobTitleTemplatesIfEmpty,
  subscribeJobTitles,
  updateJobTitle,
} from '../../lib/jobTitlesService';
import {
  actorCoversTargetGrant,
  ALL_STAFF_PERMISSION_KEYS,
  DEFAULT_JOB_TITLE_TEMPLATES,
  EMPTY_STAFF_PERMISSIONS,
  getScreenMetaDynamic,
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
  sanitizeEffectivePermissions,
} from '../../lib/staffAuthUtils';
import { subscribeRestaurantStaff } from '../../lib/staffService';
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
  JobTitle,
  Restaurant,
  RestaurantStation,
  StaffActorInfo,
  StaffMember,
  StaffPermissionKey,
  StaffRole,
  StaffScreen,
} from '../../types/menu';

interface JobTitlesTabProps {
  restaurant: Restaurant;
  mode: 'owner' | 'manager';
  actor: StaffActorInfo;
  actorCeiling: ActorDelegationCeiling;
  onBack?: () => void;
  onGoHome?: () => void;
}

const ACCENT_PRESETS = [
  '#4F46E5',
  '#0D9488',
  '#D97706',
  '#059669',
  '#EA580C',
  '#0284C7',
  '#DB2777',
  '#18181B',
  '#7C3AED',
  '#DC2626',
];

const CORE_OPERATIONAL_SCREENS: StaffScreen[] = [
  'cashier',
  'captain',
  'hall_manager',
  'hall_assignments',
];

const CORE_MANAGEMENT_SCREENS: StaffScreen[] = [
  'halls',
  'stations',
  'menu_editor',
  'shift_reports',
  'customers',
  'staff_management',
  'job_titles',
];

export function JobTitlesTab({
  restaurant,
  mode,
  actor,
  actorCeiling,
  onBack,
  onGoHome,
}: JobTitlesTabProps) {
  const { lang, dir, loc } = useLanguage();
  const isEn = lang === 'en';
  const BackArrow = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [dynamicStations, setDynamicStations] = useState<RestaurantStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [editingTitle, setEditingTitle] = useState<JobTitle | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Editor state
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [color, setColor] = useState('#4F46E5');
  const [baseRoleHint, setBaseRoleHint] = useState<StaffRole>('custom');
  const [allowedScreens, setAllowedScreens] = useState<StaffScreen[]>(['captain']);
  const [allowedCaptainScreens, setAllowedCaptainScreens] = useState<string[]>([]);
  const [defaultScreen, setDefaultScreen] = useState<StaffScreen>('captain');
  const [permissions, setPermissions] = useState<EffectiveStaffPermissions>({
    ...EMPTY_STAFF_PERMISSIONS,
  });
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubTitles = subscribeJobTitles(
      restaurant.id,
      (list) => {
        setJobTitles(list);
        setLoading(false);
      },
      (err) => {
        setErrorMsg(formatFirestoreErrorMessage(err, isEn));
        setLoading(false);
      }
    );
    const unsubStaff = subscribeRestaurantStaff(
      restaurant.id,
      setStaffList,
      () => {}
    );
    const unsubStations = subscribeRestaurantStations(
      restaurant.id,
      setDynamicStations,
      () => {}
    );
    return () => {
      unsubTitles();
      unsubStaff();
      unsubStations();
    };
  }, [restaurant.id, isEn]);

  const effectiveStations = useMemo(
    () => buildEffectiveStations(dynamicStations),
    [dynamicStations]
  );

  const effectiveCaptainScreens = useMemo(
    () => buildEffectiveCaptainScreens(dynamicStations),
    [dynamicStations]
  );

  const assignedStaffCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    staffList.forEach((member) => {
      (member.jobTitleIds || []).forEach((jtId) => {
        counts.set(jtId, (counts.get(jtId) || 0) + 1);
      });
    });
    return counts;
  }, [staffList]);

  const allDynamicPrepScreens = useMemo<StaffScreen[]>(
    () => effectiveStations.map((st) => stationIdToScreen(st.stationId)),
    [effectiveStations]
  );

  const screenAllowedInCeiling = (scr: StaffScreen): boolean => {
    if (actorCeiling.isUnbounded) return true;
    if (actorCeiling.allowedScreens.includes(scr)) return true;
    const stId = screenToStationId(scr);
    if (stId && actorCeiling.allowedStations.includes(stId)) return true;
    return false;
  };

  const permAllowedInCeiling = (key: StaffPermissionKey): boolean => {
    if (actorCeiling.isUnbounded) return true;
    return actorCeiling.permissions[key] === true;
  };

  const captainScreenAllowedInCeiling = (capId: string): boolean => {
    if (actorCeiling.isUnbounded) return true;
    if (actorCeiling.allowedCaptainScreens.length === 0) {
      return actorCeiling.allowedScreens.includes('captain');
    }
    return actorCeiling.allowedCaptainScreens.includes(cleanStationId(capId));
  };

  const canModifyExistingTitle = (jt: JobTitle): boolean => {
    if (actorCeiling.isUnbounded) return true;
    const cov = actorCoversTargetGrant({
      actorIsUnbounded: false,
      actorPermissions: actorCeiling.permissions,
      actorScreens: actorCeiling.allowedScreens,
      actorStations: actorCeiling.allowedStations,
      targetPermissions: sanitizeEffectivePermissions(jt.permissions),
      targetScreens: jt.allowedScreens || [],
      targetStations: jt.allowedStations || [],
    });
    return cov.allowed;
  };

  const openCreateBlank = () => {
    const initialScr: StaffScreen =
      screenAllowedInCeiling('captain')
        ? 'captain'
        : actorCeiling.allowedScreens[0] || 'cashier';
    setEditingTitle(null);
    setNameAr('');
    setNameEn('');
    setDescriptionAr('');
    setDescriptionEn('');
    setColor('#4F46E5');
    setBaseRoleHint('custom');
    setAllowedScreens([initialScr]);
    setAllowedCaptainScreens([]);
    setDefaultScreen(initialScr);
    setPermissions({
      ...EMPTY_STAFF_PERMISSIONS,
      canViewOrders: permAllowedInCeiling('canViewOrders'),
    });
    setIsActive(true);
    setErrorMsg(null);
    setViewMode('editor');
  };

  const openFromStarterPreset = (presetId: string) => {
    const tpl = DEFAULT_JOB_TITLE_TEMPLATES.find((t) => t.id === presetId);
    if (!tpl) return;
    const filteredScreens = tpl.allowedScreens.filter((s) => screenAllowedInCeiling(s));
    const safeScreens =
      filteredScreens.length > 0
        ? filteredScreens
        : ([actorCeiling.allowedScreens[0] || 'captain'] as StaffScreen[]);
    const safePerms = sanitizeEffectivePermissions(tpl.permissions);
    if (!actorCeiling.isUnbounded) {
      for (const k of ALL_STAFF_PERMISSION_KEYS) {
        if (!permAllowedInCeiling(k)) safePerms[k] = false;
      }
    }
    setEditingTitle(null);
    setNameAr(tpl.nameAr);
    setNameEn(tpl.nameEn);
    setDescriptionAr(tpl.descriptionAr);
    setDescriptionEn(tpl.descriptionEn);
    setColor(tpl.color);
    setBaseRoleHint(tpl.baseRoleHint);
    setAllowedScreens(safeScreens);
    setAllowedCaptainScreens([]);
    setDefaultScreen(
      safeScreens.includes(tpl.defaultScreen) ? tpl.defaultScreen : safeScreens[0]
    );
    setPermissions(safePerms);
    setIsActive(true);
    setErrorMsg(null);
    setViewMode('editor');
  };

  const openEditTitle = (jt: JobTitle) => {
    setEditingTitle(jt);
    setNameAr(jt.nameAr);
    setNameEn(jt.nameEn);
    setDescriptionAr(jt.descriptionAr || '');
    setDescriptionEn(jt.descriptionEn || '');
    setColor(jt.color || '#4F46E5');
    setBaseRoleHint(jt.baseRoleHint || 'custom');
    setAllowedScreens(jt.allowedScreens && jt.allowedScreens.length > 0 ? [...jt.allowedScreens] : ['captain']);
    setAllowedCaptainScreens([...(jt.allowedCaptainScreens || [])]);
    setDefaultScreen(jt.defaultScreen || jt.allowedScreens?.[0] || 'captain');
    setPermissions(sanitizeEffectivePermissions(jt.permissions));
    setIsActive(jt.isActive !== false);
    setErrorMsg(null);
    setViewMode('editor');
  };

  const openDuplicateTitle = (jt: JobTitle) => {
    const filteredScreens = (jt.allowedScreens || ['captain']).filter((s) =>
      screenAllowedInCeiling(s)
    );
    const safeScreens =
      filteredScreens.length > 0
        ? filteredScreens
        : ([actorCeiling.allowedScreens[0] || 'captain'] as StaffScreen[]);
    const safePerms = sanitizeEffectivePermissions(jt.permissions);
    if (!actorCeiling.isUnbounded) {
      for (const k of ALL_STAFF_PERMISSION_KEYS) {
        if (!permAllowedInCeiling(k)) safePerms[k] = false;
      }
    }
    setEditingTitle(null);
    setNameAr(`${jt.nameAr} (نسخة)`.slice(0, 80));
    setNameEn(`${jt.nameEn} (Copy)`.slice(0, 80));
    setDescriptionAr(jt.descriptionAr || '');
    setDescriptionEn(jt.descriptionEn || '');
    setColor(jt.color || '#4F46E5');
    setBaseRoleHint(jt.baseRoleHint || 'custom');
    setAllowedScreens(safeScreens);
    setAllowedCaptainScreens(
      (jt.allowedCaptainScreens || []).filter((c) => captainScreenAllowedInCeiling(c))
    );
    setDefaultScreen(
      safeScreens.includes(jt.defaultScreen) ? jt.defaultScreen : safeScreens[0]
    );
    setPermissions(safePerms);
    setIsActive(true);
    setErrorMsg(null);
    setViewMode('editor');
  };

  const handleSeedStarterTemplates = async () => {
    if (!actorCeiling.isUnbounded) return;
    setSeeding(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      await seedDefaultJobTitleTemplatesIfEmpty({
        restaurant,
        actor,
        dynamicStations: effectiveStations,
      });
      setFeedbackMsg(
        isEn
          ? 'Added starter job title templates. You can customize or create more anytime.'
          : 'تمت إضافة قوالب المسميات الوظيفية الافتراضية بنجاح. يمكنك تعديلها أو إضافة مسميات جديدة بحرية.'
      );
    } catch (err) {
      setErrorMsg(formatFirestoreErrorMessage(err, isEn));
    } finally {
      setSeeding(false);
    }
  };

  const toggleScreen = (scr: StaffScreen) => {
    if (!screenAllowedInCeiling(scr)) return;
    setAllowedScreens((prev) => {
      const exists = prev.includes(scr);
      if (exists && prev.length === 1) return prev;
      const next = exists ? prev.filter((s) => s !== scr) : [...prev, scr];
      if (!next.includes(defaultScreen)) {
        setDefaultScreen(next[0]);
      }
      return next;
    });
  };

  const toggleCaptainSubScreen = (capId: string) => {
    const clean = cleanStationId(capId);
    if (!captainScreenAllowedInCeiling(clean)) return;
    setAllowedCaptainScreens((prev) => {
      const exists = prev.includes(clean);
      const next = exists ? prev.filter((x) => x !== clean) : [...prev, clean];
      if (!exists && !allowedScreens.includes('captain')) {
        setAllowedScreens((cur) => [...cur, 'captain']);
      }
      return next;
    });
  };

  const togglePermission = (key: StaffPermissionKey) => {
    if (!permAllowedInCeiling(key)) return;
    setPermissions((prev) => {
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
          key === 'canUpdatePrepProgress')
      ) {
        if (permAllowedInCeiling('canViewOrders')) {
          next.canViewOrders = true;
        }
      }
      return next;
    });
  };

  const handleSaveJobTitle = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setFeedbackMsg(null);

    const extractedStations = Array.from(
      new Set(
        allowedScreens
          .map((s) => screenToStationId(s))
          .filter((id): id is string => Boolean(id))
      )
    );

    const input: SaveJobTitleInput = {
      nameAr,
      nameEn,
      descriptionAr,
      descriptionEn,
      color,
      baseRoleHint:
        !actorCeiling.isUnbounded && baseRoleHint === 'manager'
          ? 'custom'
          : editingTitle?.baseRoleHint === 'manager' && actorCeiling.isUnbounded
            ? 'manager'
            : baseRoleHint || 'custom',
      allowedScreens,
      allowedStations: extractedStations,
      allowedCaptainScreens,
      defaultScreen,
      defaultStationId: screenToStationId(defaultScreen) || extractedStations[0] || '',
      permissions,
      isActive,
    };

    try {
      if (editingTitle) {
        const res = await updateJobTitle({
          restaurant,
          existingTitle: editingTitle,
          allJobTitles: jobTitles,
          staffMembers: staffList,
          actor,
          ceiling: actorCeiling,
          input,
        });
        setViewMode('list');
        setFeedbackMsg(
          isEn
            ? `Saved "${res.updatedTitle.nameEn}" and synced changes immediately to ${res.propagatedCount} staff account(s).`
            : `تم حفظ "${res.updatedTitle.nameAr}" وتطبيق التعديل لحظياً على ${res.propagatedCount} حساب موظف.`
        );
      } else {
        const created = await createJobTitle({
          restaurant,
          actor,
          ceiling: actorCeiling,
          input,
        });
        setViewMode('list');
        setFeedbackMsg(
          isEn
            ? `Created new job title "${created.nameEn}".`
            : `تم إنشاء المسمى الوظيفي "${created.nameAr}" بنجاح.`
        );
      }
    } catch (err) {
      setErrorMsg(formatFirestoreErrorMessage(err, isEn));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteJobTitle = async (jt: JobTitle) => {
    setDeletingId(jt.id);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      await deleteJobTitle({
        restaurant,
        jobTitle: jt,
        staffMembers: staffList,
        actor,
      });
      setConfirmDeleteId(null);
      setFeedbackMsg(
        isEn
          ? `Deleted job title "${jt.nameEn}".`
          : `تم حذف المسمى الوظيفي "${jt.nameAr}".`
      );
    } catch (err) {
      setErrorMsg(formatFirestoreErrorMessage(err, isEn));
    } finally {
      setDeletingId(null);
    }
  };

  const filteredTitles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return jobTitles;
    return jobTitles.filter(
      (jt) =>
        jt.nameAr.toLowerCase().includes(q) ||
        jt.nameEn.toLowerCase().includes(q) ||
        (jt.descriptionAr || '').toLowerCase().includes(q) ||
        (jt.descriptionEn || '').toLowerCase().includes(q)
    );
  }, [jobTitles, searchQuery]);

  if (viewMode === 'editor') {
    const enabledPermCount = ALL_STAFF_PERMISSION_KEYS.filter((k) => permissions[k]).length;
    const isReadLocked = editingTitle ? !canModifyExistingTitle(editingTitle) : false;

    return (
      <div dir={dir} className="space-y-5">
        {/* Top Full-Page Navigation Header */}
        <header className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setViewMode('list');
              }}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BackArrow className="w-4 h-4 shrink-0" />
              <span>{isEn ? 'Back' : 'رجوع'}</span>
            </button>
            {onGoHome && (
              <button
                type="button"
                onClick={onGoHome}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Home className="w-4 h-4 shrink-0" />
                <span>{isEn ? 'Home' : 'الرئيسية'}</span>
              </button>
            )}
            <div className="min-w-0 ps-1">
              <h2 className="text-sm sm:text-base font-extrabold text-zinc-950 truncate">
                {editingTitle
                  ? isEn
                    ? `Edit Job Title: ${editingTitle.nameEn}`
                    : `تعديل المسمى الوظيفي: ${editingTitle.nameAr}`
                  : isEn
                    ? 'Create New Job Title'
                    : 'إنشاء مسمى وظيفي جديد'}
              </h2>
              <p className="text-[11px] text-zinc-500 tabular-nums">
                {isEn
                  ? `${allowedScreens.length} screens · ${enabledPermCount}/${ALL_STAFF_PERMISSION_KEYS.length} permissions enforced in DB`
                  : `${allowedScreens.length} شاشة · ${enabledPermCount} من ${ALL_STAFF_PERMISSION_KEYS.length} صلاحية مفروضة في قاعدة البيانات`}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={saving || isReadLocked}
            onClick={(e) => void handleSaveJobTitle(e)}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isEn ? 'Save & Apply Immediately' : 'حفظ وتطبيق لحظياً'}</span>
          </button>
        </header>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900 flex items-center justify-between gap-2">
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg(null)} className="p-1 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {isReadLocked && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs font-bold text-amber-950 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p>
              {isEn
                ? 'This job title grants screens or permissions above your current account ceiling. Only the restaurant owner or a higher-privilege admin can edit it.'
                : 'هذا المسمى الوظيفي يتضمن شاشات أو صلاحيات أعلى من سقف صلاحيات حسابك الحالي، ولذلك لا يمكن تعديله إلا من حساب المالك أو مدير يملك نفس الصلاحيات.'}
            </p>
          </div>
        )}

        <form onSubmit={handleSaveJobTitle} className="space-y-5">
          {/* Basic Details Card */}
          <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="border-b border-zinc-100 pb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-zinc-950">
                  {isEn ? '1. Job Title Identity' : '1. هوية المسمى الوظيفي'}
                </h3>
                <p className="text-xs text-zinc-500">
                  {isEn
                    ? 'Name the job title in Arabic and English (e.g., Captain + Cashier, Shift Supervisor, Grill Chef).'
                    : 'أدخل اسم المسمى بالعربية والإنجليزية (مثل: كابتن + كاشير، مشرف وردية، شيف مشويات).'}
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-extrabold text-zinc-800 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isActive}
                  disabled={isReadLocked}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-zinc-950"
                />
                <span>{isEn ? 'Active Title' : 'مسمى مفعّل'}</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1 text-xs font-bold text-zinc-800">
                <span>{isEn ? 'Arabic Name *' : 'الاسم بالعربية *'}</span>
                <input
                  type="text"
                  required
                  disabled={isReadLocked}
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder={isEn ? 'e.g. كابتن + كاشير' : 'مثال: كابتن + كاشير'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-100"
                />
              </label>

              <label className="space-y-1 text-xs font-bold text-zinc-800">
                <span>{isEn ? 'English Name' : 'الاسم بالإنجليزية'}</span>
                <input
                  type="text"
                  disabled={isReadLocked}
                  dir="ltr"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Captain + Cashier"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-100"
                />
              </label>

              <label className="space-y-1 text-xs font-bold text-zinc-800">
                <span>{isEn ? 'Description (Arabic)' : 'وصف مختصر (عربي)'}</span>
                <input
                  type="text"
                  disabled={isReadLocked}
                  value={descriptionAr}
                  onChange={(e) => setDescriptionAr(e.target.value)}
                  placeholder={isEn ? 'Operational duties summary' : 'وصف مهام هذا المسمى داخل التشغيل'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-100"
                />
              </label>

              <label className="space-y-1 text-xs font-bold text-zinc-800">
                <span>{isEn ? 'Description (English)' : 'وصف مختصر (إنجليزي)'}</span>
                <input
                  type="text"
                  disabled={isReadLocked}
                  dir="ltr"
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  placeholder="Optional role summary in English"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-100"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-zinc-800 block">
                  {isEn ? 'Badge Accent Color' : 'اللون المميز للمسمى'}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {ACCENT_PRESETS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      disabled={isReadLocked}
                      onClick={() => setColor(hex)}
                      style={{ backgroundColor: hex }}
                      aria-label={hex}
                      className={`w-7 h-7 rounded-lg cursor-pointer transition-transform ${
                        color === hex ? 'ring-2 ring-offset-2 ring-zinc-950 scale-105' : 'opacity-85 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <label className="space-y-1 text-xs font-bold text-zinc-800 min-w-[240px]">
                <span>{isEn ? 'Default Screen Upon Sign-In' : 'الشاشة الافتراضية عند تسجيل الدخول'}</span>
                <select
                  value={defaultScreen}
                  disabled={isReadLocked}
                  onChange={(e) => setDefaultScreen(e.target.value as StaffScreen)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-xs font-bold bg-white"
                >
                  {allowedScreens.map((scr) => {
                    const meta = getScreenMetaDynamic(scr, effectiveStations);
                    return (
                      <option key={scr} value={scr}>
                        {isEn ? meta.labelEn : meta.labelAr}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>
          </section>

          {/* Accessible Screens Card */}
          <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="border-b border-zinc-100 pb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-zinc-950">
                  {isEn ? '2. Authorized Operational & Management Screens' : '2. الشاشات والمحطات المصرّح برؤيتها'}
                </h3>
                <p className="text-xs text-zinc-500">
                  {isEn
                    ? 'Employees assigned to this title can switch freely between all selected screens using the same unified account.'
                    : 'يمكن للموظف الحامل لهذا المسمى التنقل بحرية بين كل الشاشات المحددة هنا من نفس الحساب الواحد.'}
                </p>
              </div>
              <span className="text-xs font-extrabold text-zinc-700 tabular-nums">
                {isEn ? `${allowedScreens.length} selected` : `${allowedScreens.length} شاشة مختارة`}
              </span>
            </div>

            {/* Group A: Core Operational Screens */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-zinc-700">
                {isEn ? 'POS, Floor & Supervision' : 'نقطة البيع والصالات والإشراف'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {CORE_OPERATIONAL_SCREENS.map((scr) => {
                  const meta = getScreenMetaDynamic(scr, effectiveStations);
                  const checked = allowedScreens.includes(scr);
                  const allowed = screenAllowedInCeiling(scr) && !isReadLocked;
                  return (
                    <label
                      key={scr}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-bold transition-colors ${
                        !allowed
                          ? 'bg-zinc-50 border-zinc-200 text-zinc-400 cursor-not-allowed'
                          : checked
                            ? 'bg-zinc-950 text-white border-zinc-950 cursor-pointer'
                            : 'bg-white border-zinc-200 text-zinc-800 hover:bg-zinc-50 cursor-pointer'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!allowed}
                          onChange={() => toggleScreen(scr)}
                          className="w-4 h-4 accent-amber-500 shrink-0"
                        />
                        <span className="whitespace-normal break-words leading-snug text-start">{isEn ? meta.labelEn : meta.labelAr}</span>
                      </span>
                      {!screenAllowedInCeiling(scr) && <Lock className="w-3.5 h-3.5 shrink-0" />}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Group B: Dynamic Prep Stations */}
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <h4 className="text-xs font-extrabold text-zinc-700">
                {isEn ? 'Preparation Stations (KDS)' : 'محطات التحضير (المطبخ / البار / المخبوزات...)'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {effectiveStations.map((st) => {
                  const scr = stationIdToScreen(st.stationId);
                  const checked = allowedScreens.includes(scr);
                  const allowed = screenAllowedInCeiling(scr) && !isReadLocked;
                  const StIcon = getStationIconComponent(st.icon);
                  return (
                    <label
                      key={st.stationId}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-bold transition-colors ${
                        !allowed
                          ? 'bg-zinc-50 border-zinc-200 text-zinc-400 cursor-not-allowed'
                          : checked
                            ? 'bg-zinc-900 text-white border-zinc-900 cursor-pointer'
                            : 'bg-white border-zinc-200 text-zinc-800 hover:bg-zinc-50 cursor-pointer'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!allowed}
                          onChange={() => toggleScreen(scr)}
                          className="w-4 h-4 accent-amber-500 shrink-0"
                        />
                        <StIcon className="w-4 h-4 shrink-0" />
                        <span className="whitespace-normal break-words leading-snug text-start">{loc(st.label, st.label_en)}</span>
                      </span>
                      {!screenAllowedInCeiling(scr) && <Lock className="w-3.5 h-3.5 shrink-0" />}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Group C: Custom Captain Screens */}
            {effectiveCaptainScreens.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-zinc-100">
                <h4 className="text-xs font-extrabold text-zinc-700">
                  {isEn ? 'Scoped Captain Floor Screens (Optional)' : 'شاشات الكابتن المخصصة (اختياري)'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {effectiveCaptainScreens.map((cap) => {
                    const cleanId = cleanStationId(cap.stationId);
                    const checked = allowedCaptainScreens.includes(cleanId);
                    const allowed = captainScreenAllowedInCeiling(cleanId) && !isReadLocked;
                    return (
                      <label
                        key={cap.stationId}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-bold ${
                          !allowed
                            ? 'bg-zinc-50 border-zinc-200 text-zinc-400 cursor-not-allowed'
                            : checked
                              ? 'bg-teal-900 text-white border-teal-900 cursor-pointer'
                              : 'bg-white border-zinc-200 text-zinc-800 hover:bg-zinc-50 cursor-pointer'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!allowed}
                            onChange={() => toggleCaptainSubScreen(cleanId)}
                            className="w-4 h-4 accent-teal-400 shrink-0"
                          />
                          <span className="whitespace-normal break-words leading-snug text-start">{loc(cap.label, cap.label_en)}</span>
                        </span>
                        {!captainScreenAllowedInCeiling(cleanId) && <Lock className="w-3.5 h-3.5 shrink-0" />}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Group D: Management & Admin Consoles */}
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <h4 className="text-xs font-extrabold text-zinc-700">
                {isEn ? 'Administration & Backoffice Modules' : 'شاشات الإدارة والتقارير والمنيو'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {CORE_MANAGEMENT_SCREENS.map((scr) => {
                  const meta = getScreenMetaDynamic(scr, effectiveStations);
                  const checked = allowedScreens.includes(scr);
                  const allowed = screenAllowedInCeiling(scr) && !isReadLocked;
                  return (
                    <label
                      key={scr}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-bold ${
                        !allowed
                          ? 'bg-zinc-50 border-zinc-200 text-zinc-400 cursor-not-allowed'
                          : checked
                            ? 'bg-indigo-950 text-white border-indigo-950 cursor-pointer'
                            : 'bg-white border-zinc-200 text-zinc-800 hover:bg-zinc-50 cursor-pointer'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!allowed}
                          onChange={() => toggleScreen(scr)}
                          className="w-4 h-4 accent-indigo-400 shrink-0"
                        />
                        <span className="whitespace-normal break-words leading-snug text-start">{isEn ? meta.labelEn : meta.labelAr}</span>
                      </span>
                      {!screenAllowedInCeiling(scr) && <Lock className="w-3.5 h-3.5 shrink-0" />}
                    </label>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Granular 21 DB-Enforced Permissions */}
          <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="border-b border-zinc-100 pb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-zinc-950 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-zinc-800" />
                  <span>
                    {isEn
                      ? '3. Database-Enforced Granular Permissions'
                      : '3. الصلاحيات التفصيلية المفروضة في قاعدة البيانات'}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500">
                  {isEn
                    ? 'Every toggle here is strictly validated by Firestore Security Rules on read and write.'
                    : 'كل مفتاح صلاحية هنا مربوط 100% بقواعد أمان Firestore وتُرفض أي عملية غير مصرّح بها تلقائياً من قاعدة البيانات.'}
                </p>
              </div>
              <span className="text-xs font-extrabold text-zinc-800 tabular-nums">
                {isEn
                  ? `${enabledPermCount} / ${ALL_STAFF_PERMISSION_KEYS.length} active`
                  : `${enabledPermCount} / ${ALL_STAFF_PERMISSION_KEYS.length} مفعّلة`}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-[11px] text-zinc-700 leading-relaxed">
              {isEn
                ? 'Note: Visual price display preferences (hiding prices on Kitchen/Bar/Captain UI screens) are presentation settings configured in Operations Settings under "Configure Operations Settings" rather than database field-level security permissions.'
                : 'ملاحظة: خيار إظهار أو إخفاء الأسعار على شاشات العرض (المطبخ/البار/الكابتن) هو إعداد عرض للواجهة يُضبط من إعدادات التشغيل (تحت صلاحية إعدادات التشغيل)، وليس صلاحية حجب حقول في قاعدة البيانات.'}
            </div>

            <div className="space-y-5">
              {PERMISSION_GROUPS.map((grp) => {
                const items = PERMISSION_CATALOG.filter((item) => item.group === grp.id);
                return (
                  <div key={grp.id} className="space-y-2.5">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
                      <h4 className="text-xs font-extrabold text-zinc-900">
                        {isEn ? grp.titleEn : grp.titleAr}
                      </h4>
                      <span className="text-[11px] text-zinc-500 tabular-nums">
                        {items.filter((i) => permissions[i.key]).length} / {items.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {items.map((item) => {
                        const checked = Boolean(permissions[item.key]);
                        const allowed = permAllowedInCeiling(item.key) && !isReadLocked;
                        return (
                          <label
                            key={item.key}
                            className={`p-3 rounded-xl border flex items-start gap-2.5 transition-colors ${
                              !allowed
                                ? 'bg-zinc-50 border-zinc-200 text-zinc-400 cursor-not-allowed'
                                : checked
                                  ? 'bg-emerald-50/60 border-emerald-500 text-zinc-950 cursor-pointer'
                                  : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 cursor-pointer'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!allowed}
                              onChange={() => togglePermission(item.key)}
                              className="mt-0.5 w-4 h-4 accent-emerald-700 shrink-0"
                            />
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-extrabold leading-snug">
                                  {isEn ? item.labelEn : item.labelAr}
                                </span>
                                {!permAllowedInCeiling(item.key) && (
                                  <Lock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-zinc-500 leading-snug">
                                {isEn ? item.descriptionEn : item.descriptionAr}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Bottom Action Bar */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => setViewMode('list')}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold cursor-pointer"
            >
              {isEn ? 'Cancel' : 'إلغاء'}
            </button>
            <button
              type="submit"
              disabled={saving || isReadLocked}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>
                {editingTitle
                  ? isEn
                    ? 'Save & Sync Staff Accounts'
                    : 'حفظ ومزامنة حسابات الموظفين'
                  : isEn
                    ? 'Create Job Title'
                    : 'إنشاء المسمى الوظيفي'}
              </span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div dir={dir} className="space-y-5">
      {/* Top Bar with Back + Home + Create Action */}
      <header className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <BackArrow className="w-4 h-4 shrink-0" />
                  <span>{isEn ? 'Back' : 'رجوع'}</span>
                </button>
              )}
              {onGoHome && (
                <button
                  type="button"
                  onClick={onGoHome}
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Home className="w-4 h-4 shrink-0" />
                  <span>{isEn ? 'Home' : 'الرئيسية'}</span>
                </button>
              )}
            </div>

            <div className="min-w-0 space-y-0.5">
              <h2 className="text-base sm:text-lg font-extrabold text-zinc-950 truncate">
                {isEn ? 'Job Titles & Granular Permissions' : 'المسميات الوظيفية والصلاحيات المرنة'}
              </h2>
              <p className="text-xs text-zinc-500">
                {isEn
                  ? `${jobTitles.length} job titles · Real-time sync across assigned staff accounts`
                  : `${jobTitles.length} مسمى وظيفي · مزامنة فورية على جميع الحسابات المرتبطة`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {jobTitles.length === 0 && actorCeiling.isUnbounded && (
              <button
                type="button"
                disabled={seeding}
                onClick={handleSeedStarterTemplates}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{isEn ? 'Load Starter Titles' : 'إضافة المسميات القياسية'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={openCreateBlank}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>{isEn ? 'New Job Title' : '+ إضافة مسمى وظيفي'}</span>
            </button>
          </div>
        </div>

        {/* Delegation Ceiling Notice for Non-Owner Managers */}
        {mode !== 'owner' && !actorCeiling.isUnbounded && (
          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs font-bold text-indigo-950 flex items-start gap-2">
            <Lock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              {isEn
                ? 'Delegation Ceiling active: You can create or edit job titles only within the screens and permissions granted to your account.'
                : 'سقف التفويض مفعّل: يمكنك إنشاء أو تعديل المسميات الوظيفية ضمن حدود الشاشات والصلاحيات الممنوحة لحسابك فقط.'}
            </span>
          </div>
        )}

        {/* Filter Bar & Quick Starter Presets */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-100">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isEn
                ? 'Search job titles by Arabic or English name...'
                : 'ابحث عن مسمى وظيفي بالاسم العربي أو الإنجليزي...'
            }
            className="w-full sm:max-w-xs px-3.5 py-2 rounded-xl border border-zinc-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-zinc-500 whitespace-nowrap shrink-0">
              {isEn ? 'Quick create:' : 'بدء سريع:'}
            </span>
            {DEFAULT_JOB_TITLE_TEMPLATES.slice(0, 5).map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => openFromStarterPreset(tpl.id)}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-[11px] font-bold text-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                + {isEn ? tpl.nameEn : tpl.nameAr}
              </button>
            ))}
          </div>
        </div>
      </header>

      {feedbackMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg}</span>
          </span>
          <button type="button" onClick={() => setFeedbackMsg(null)} className="p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </span>
          <button type="button" onClick={() => setErrorMsg(null)} className="p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center space-y-2">
          <Loader2 className="w-7 h-7 animate-spin text-zinc-500 mx-auto" />
          <p className="text-xs font-bold text-zinc-600">
            {isEn ? 'Loading job titles...' : 'جاري تحميل المسميات الوظيفية...'}
          </p>
        </div>
      ) : filteredTitles.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center space-y-3">
          <Layers className="w-10 h-10 text-zinc-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-zinc-900">
              {jobTitles.length === 0
                ? isEn
                  ? 'No custom job titles defined yet'
                  : 'لم يتم إنشاء مسميات وظيفية بعد'
                : isEn
                  ? 'No job titles match your search'
                  : 'لا توجد نتائج مطابقة للبحث'}
            </h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              {isEn
                ? 'Load the standard starter titles or create a custom multi-screen role like "Captain + Cashier" or "Kitchen Supervisor".'
                : 'يمكنك تحميل القوالب القياسية بضغطة واحدة أو إنشاء مسمى جديد يجمع أكثر من شاشة وصلاحيات مخصصة مثل "كابتن + كاشير".'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {jobTitles.length === 0 && actorCeiling.isUnbounded && (
              <button
                type="button"
                disabled={seeding}
                onClick={handleSeedStarterTemplates}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{isEn ? 'Load Starter Titles' : 'تحميل القوالب القياسية'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={openCreateBlank}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isEn ? 'Create Job Title' : 'إنشاء مسمى جديد'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTitles.map((jt) => {
            const assignedCount = assignedStaffCountMap.get(jt.id) || 0;
            const permCount = ALL_STAFF_PERMISSION_KEYS.filter(
              (k) => jt.permissions?.[k] === true
            ).length;
            const canModify = canModifyExistingTitle(jt);

            return (
              <article
                key={jt.id}
                className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        style={{ backgroundColor: jt.color || '#4F46E5' }}
                        className="w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0 font-extrabold text-sm"
                      >
                        {(isEn ? jt.nameEn : jt.nameAr).slice(0, 1)}
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <h3 className="text-sm sm:text-base font-extrabold text-zinc-950 truncate">
                          {isEn ? jt.nameEn : jt.nameAr}
                        </h3>
                        <p className="text-xs text-zinc-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
                          <span>{isEn ? jt.nameAr : jt.nameEn}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {isEn ? `${assignedCount} staff` : `${assignedCount} موظف`}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {isEn
                              ? `${permCount} permissions`
                              : `${permCount} صلاحية`}
                          </span>
                          {!jt.isActive && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-700 font-bold">
                                {isEn ? 'Inactive' : 'معطّل'}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {!canModify && (
                      <span
                        title={
                          isEn
                            ? 'Above your permission ceiling'
                            : 'يتجاوز سقف صلاحياتك'
                        }
                        className="text-zinc-400 shrink-0"
                      >
                        <Lock className="w-4 h-4" />
                      </span>
                    )}
                  </div>

                  {(jt.descriptionAr || jt.descriptionEn) && (
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      {isEn ? jt.descriptionEn || jt.descriptionAr : jt.descriptionAr}
                    </p>
                  )}

                  {/* Clean screen list summary */}
                  <div className="text-[11px] text-zinc-600 pt-2 border-t border-zinc-100 leading-relaxed">
                    <span className="font-bold text-zinc-800">
                      {isEn ? 'Screens: ' : 'الشاشات: '}
                    </span>
                    {(jt.allowedScreens || [])
                      .map((scr) => {
                        const meta = getScreenMetaDynamic(scr, effectiveStations);
                        return isEn ? meta.shortEn : meta.shortAr;
                      })
                      .join(' · ')}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!canModify}
                      onClick={() => openEditTitle(jt)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Edit & Permissions' : 'تعديل الصلاحيات'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openDuplicateTitle(jt)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Duplicate' : 'نسخ'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={!canModify || deletingId === jt.id}
                      onClick={() =>
                        setConfirmDeleteId((prev) => (prev === jt.id ? null : jt.id))
                      }
                      className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Delete' : 'حذف'}</span>
                    </button>
                  </div>

                  {confirmDeleteId === jt.id && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-rose-900">
                        {assignedCount > 0
                          ? isEn
                            ? `Assigned to ${assignedCount} staff member(s). Reassign them before deleting.`
                            : `مرتبط بـ ${assignedCount} موظف حالياً — انقلهم أولاً قبل الحذف.`
                          : isEn
                            ? `Confirm deleting "${jt.nameEn}"?`
                            : `تأكيد حذف المسمى "${jt.nameAr}"؟`}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {assignedCount === 0 && (
                          <button
                            type="button"
                            disabled={deletingId === jt.id}
                            onClick={() => handleDeleteJobTitle(jt)}
                            className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold cursor-pointer disabled:opacity-50"
                          >
                            {deletingId === jt.id
                              ? isEn
                                ? 'Deleting...'
                                : 'جاري الحذف...'
                              : isEn
                                ? 'Confirm Delete'
                                : 'تأكيد الحذف'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
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
  );
}
