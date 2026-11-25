import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  EffectiveStaffPermissions,
  JobTitle,
  Restaurant,
  StaffActorInfo,
  StaffAuditEventType,
  StaffMember,
  StaffRole,
  StaffScreen,
} from '../types/menu';
import { getActiveLang } from '../data/translations';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  actorCoversTargetGrant,
  ALL_STAFF_PERMISSION_KEYS,
  computeCombinedJobTitleGrant,
  DEFAULT_JOB_TITLE_TEMPLATES,
  resolveEffectiveStaffPermissions,
  sanitizeEffectivePermissions,
} from './staffAuthUtils';
import { cleanStationIdList, screenToStationId, stationIdToScreen, StationMeta } from './stationUtils';

function makeJobTitleId(): string {
  const rnd = Math.random().toString(36).slice(2, 7);
  return `jt_${Date.now().toString(36)}_${rnd}`;
}

function makeAuditId(): string {
  return `slog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getTsMillis(ts: unknown): number {
  if (!ts) return 0;
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === 'object' && 'seconds' in ts && typeof (ts as { seconds: number }).seconds === 'number') {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return 0;
}

export interface ActorDelegationCeiling {
  isUnbounded: boolean;
  permissions: EffectiveStaffPermissions;
  allowedScreens: StaffScreen[];
  allowedStations: string[];
  allowedCaptainScreens: string[];
}

export interface SaveJobTitleInput {
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  color: string;
  baseRoleHint?: StaffRole;
  allowedScreens: StaffScreen[];
  allowedStations?: string[];
  allowedCaptainScreens?: string[];
  defaultScreen: StaffScreen;
  defaultStationId?: string;
  permissions: EffectiveStaffPermissions;
  isActive?: boolean;
  sortOrder?: number;
}

export function subscribeJobTitles(
  restaurantId: string,
  onData: (titles: JobTitle[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!restaurantId) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, 'restaurants', restaurantId, 'job_titles'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as JobTitle), id: d.id }))
        .sort((a, b) => {
          const orderDiff = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
          if (orderDiff !== 0) return orderDiff;
          return getTsMillis(a.createdAt) - getTsMillis(b.createdAt);
        });
      onData(list);
    },
    (error) => {
      if (onError) {
        onError(
          error instanceof Error
            ? error
            : new Error(
                getActiveLang() === 'en' ? 'Failed to load job titles' : 'تعذر تحميل المسميات الوظيفية'
              )
        );
      } else {
        handleFirestoreError(error, OperationType.LIST, `restaurants/${restaurantId}/job_titles`);
      }
    }
  );
}

export async function fetchJobTitles(restaurantId: string): Promise<JobTitle[]> {
  if (!restaurantId) return [];
  const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'job_titles'));
  return snap.docs
    .map((d) => ({ ...(d.data() as JobTitle), id: d.id }))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
}

export async function seedDefaultJobTitleTemplatesIfEmpty(params: {
  restaurant: Restaurant;
  actor: StaffActorInfo;
  dynamicStations?: StationMeta[];
}): Promise<JobTitle[]> {
  const { restaurant, actor, dynamicStations = [] } = params;
  const existing = await fetchJobTitles(restaurant.id);
  if (existing.length > 0) return existing;

  const prepStations = dynamicStations.filter((s) => s.screenType !== 'captain' && !s.isArchived);
  const activeStationIds = prepStations.length > 0 ? prepStations.map((s) => s.stationId) : ['kitchen', 'bar', 'pastry'];
  const activeCapIds = dynamicStations.filter((s) => s.screenType === 'captain' && !s.isArchived).map((s) => s.stationId);
  const stationScreens = activeStationIds.map((st) => stationIdToScreen(st));

  const mgrPerms = resolveEffectiveStaffPermissions(
    { role: 'manager', allowedScreens: ['staff_management', 'cashier'] },
    restaurant.operationsConfig?.managerPermissions
  );

  const built: JobTitle[] = DEFAULT_JOB_TITLE_TEMPLATES.map((tpl) => {
    const isManager = tpl.baseRoleHint === 'manager';
    const screens = isManager
      ? Array.from(new Set<StaffScreen>([...tpl.allowedScreens, ...stationScreens])).slice(0, 30)
      : tpl.allowedScreens;
    const stations = isManager ? activeStationIds.slice(0, 30) : tpl.allowedStations;
    const capScreens = isManager ? activeCapIds.slice(0, 30) : tpl.allowedCaptainScreens;
    const perms = isManager ? mgrPerms : sanitizeEffectivePermissions(tpl.permissions);
    return {
      id: tpl.id,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      nameAr: tpl.nameAr,
      nameEn: tpl.nameEn,
      descriptionAr: tpl.descriptionAr,
      descriptionEn: tpl.descriptionEn,
      color: tpl.color,
      baseRoleHint: tpl.baseRoleHint,
      allowedScreens: screens,
      allowedStations: stations,
      allowedCaptainScreens: capScreens,
      defaultScreen: tpl.defaultScreen,
      defaultStationId: tpl.defaultStationId || '',
      permissions: perms,
      isSystemDefault: true,
      isActive: true,
      sortOrder: tpl.sortOrder,
      createdBy: actor.uid,
    };
  });

  // Chunk into batches of <= 4 docs to stay within Spark rule read limits
  for (let i = 0; i < built.length; i += 4) {
    const chunk = built.slice(i, i + 4);
    const batch = writeBatch(db);
    chunk.forEach((jt) => {
      batch.set(doc(db, 'restaurants', restaurant.id, 'job_titles', jt.id), {
        ...jt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return built;
}

function normalizeJobTitlePayload(
  input: SaveJobTitleInput
): {
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  color: string;
  baseRoleHint: StaffRole;
  allowedScreens: StaffScreen[];
  allowedStations: string[];
  allowedCaptainScreens: string[];
  defaultScreen: StaffScreen;
  defaultStationId: string;
  permissions: EffectiveStaffPermissions;
  isActive: boolean;
  sortOrder: number;
} {
  const isEn = getActiveLang() === 'en';
  const nameAr = input.nameAr.trim().slice(0, 80);
  const nameEn = (input.nameEn.trim() || nameAr).slice(0, 80);
  if (nameAr.length < 2) {
    throw new Error(
      isEn
        ? 'Job title Arabic name must be at least 2 characters.'
        : 'يجب أن لا يقل اسم المسمى الوظيفي بالعربية عن حرفين.'
    );
  }
  const color = /^#[0-9a-fA-F]{6}$/.test((input.color || '').trim())
    ? input.color.trim()
    : '#4F46E5';

  const allowedCaptainScreens = cleanStationIdList(input.allowedCaptainScreens).slice(0, 30);
  const stationSet = new Set<string>(cleanStationIdList(input.allowedStations));
  const screenSet = new Set<StaffScreen>(input.allowedScreens || []);
  stationSet.forEach((st) => screenSet.add(stationIdToScreen(st)));
  screenSet.forEach((scr) => {
    const st = screenToStationId(scr);
    if (st) stationSet.add(st);
  });
  if (allowedCaptainScreens.length > 0) {
    screenSet.add('captain');
  }

  const allowedScreens = Array.from(screenSet).slice(0, 30);
  const allowedStations = Array.from(stationSet).slice(0, 30);
  if (allowedScreens.length === 0) {
    throw new Error(
      isEn
        ? 'Select at least one accessible screen for this job title.'
        : 'يجب اختيار شاشة واحدة على الأقل لهذا المسمى الوظيفي.'
    );
  }

  const defaultScreen: StaffScreen = allowedScreens.includes(input.defaultScreen)
    ? input.defaultScreen
    : allowedScreens[0];
  const defaultStationId =
    (input.defaultStationId && allowedStations.includes(input.defaultStationId)
      ? input.defaultStationId
      : screenToStationId(defaultScreen) || allowedStations[0]) || '';

  const permissions = sanitizeEffectivePermissions(input.permissions);
  // Ensure viewOrders is cleanly enabled if any order-mutation permission is enabled
  if (
    permissions.canAddEditTableOrders ||
    permissions.canEditOpenOrders ||
    permissions.canApplyInstantDiscount ||
    permissions.canCancelOpenOrders ||
    permissions.canSettleChecks ||
    permissions.canEditClosedChecks ||
    permissions.canUpdatePrepProgress
  ) {
    permissions.canViewOrders = true;
  }

  const baseRoleHint: StaffRole = input.baseRoleHint || (permissions.canManageStaff ? 'manager' : 'custom');

  return {
    nameAr,
    nameEn,
    descriptionAr: (input.descriptionAr || '').trim().slice(0, 240),
    descriptionEn: (input.descriptionEn || '').trim().slice(0, 240),
    color,
    baseRoleHint,
    allowedScreens,
    allowedStations,
    allowedCaptainScreens,
    defaultScreen,
    defaultStationId,
    permissions,
    isActive: input.isActive !== false,
    sortOrder: typeof input.sortOrder === 'number' ? Math.max(0, Math.min(1000, Math.round(input.sortOrder))) : 50,
  };
}

export async function createJobTitle(params: {
  restaurant: Restaurant;
  actor: StaffActorInfo;
  ceiling: ActorDelegationCeiling;
  input: SaveJobTitleInput;
}): Promise<JobTitle> {
  const { restaurant, actor, ceiling, input } = params;
  const isEn = getActiveLang() === 'en';
  const normalized = normalizeJobTitlePayload(input);

  const coverage = actorCoversTargetGrant({
    actorIsUnbounded: ceiling.isUnbounded,
    actorPermissions: ceiling.permissions,
    actorScreens: ceiling.allowedScreens,
    actorStations: ceiling.allowedStations,
    targetPermissions: normalized.permissions,
    targetScreens: normalized.allowedScreens,
    targetStations: normalized.allowedStations,
  });

  if (!coverage.allowed) {
    throw new Error(
      isEn
        ? 'Security restriction: You cannot create a job title with permissions or screens above your own.'
        : 'قيد أمان: لا يمكنك إنشاء مسمى وظيفي بصلاحيات أو شاشات تتجاوز صلاحيات حسابك.'
    );
  }

  const titleId = makeJobTitleId();
  const payload: JobTitle = {
    id: titleId,
    restaurantId: restaurant.id,
    ownerId: restaurant.ownerId,
    ...normalized,
    isSystemDefault: false,
    createdBy: actor.uid,
  };

  try {
    await setDoc(doc(db, 'restaurants', restaurant.id, 'job_titles', titleId), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const logId = makeAuditId();
    await setDoc(doc(db, 'restaurants', restaurant.id, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      eventType: 'job_title_created' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      targetUid: titleId,
      targetName: `${normalized.nameAr} / ${normalized.nameEn}`.slice(0, 100),
      screen: 'job_titles',
      details: isEn
        ? `Created job title "${normalized.nameEn}" with ${ALL_STAFF_PERMISSION_KEYS.filter((k) => normalized.permissions[k]).length} permissions`
        : `إنشاء مسمى وظيفي "${normalized.nameAr}" بعدد ${ALL_STAFF_PERMISSION_KEYS.filter((k) => normalized.permissions[k]).length} صلاحية`,
      createdAt: serverTimestamp(),
    }).catch(() => {});

    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `restaurants/${restaurant.id}/job_titles/${titleId}`);
  }
}

export async function propagateJobTitleToAssignedStaff(params: {
  restaurantId: string;
  updatedJobTitle: JobTitle;
  allJobTitles: JobTitle[];
  staffMembers?: StaffMember[];
}): Promise<number> {
  const { restaurantId, updatedJobTitle, allJobTitles } = params;
  const titleMap = new Map<string, JobTitle>();
  allJobTitles.forEach((jt) => titleMap.set(jt.id, jt));
  titleMap.set(updatedJobTitle.id, updatedJobTitle);

  let staffList = params.staffMembers;
  if (!staffList) {
    const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'staff'));
    staffList = snap.docs.map((d) => ({ ...(d.data() as StaffMember), uid: d.id }));
  }

  const affectedStaff = staffList.filter(
    (st) => Array.isArray(st.jobTitleIds) && st.jobTitleIds.includes(updatedJobTitle.id)
  );
  if (affectedStaff.length === 0) return 0;

  let updatedCount = 0;
  // Max 4 staff per batch (= 8 doc writes + rule reads) so Spark 20-read rule cap is never exceeded
  for (let i = 0; i < affectedStaff.length; i += 4) {
    const chunk = affectedStaff.slice(i, i + 4);
    const batch = writeBatch(db);
    chunk.forEach((member) => {
      const memberTitles = (member.jobTitleIds || [])
        .map((id) => titleMap.get(id))
        .filter((jt): jt is JobTitle => Boolean(jt));
      if (memberTitles.length === 0) return;

      const combined = computeCombinedJobTitleGrant({
        selectedJobTitles: memberTitles,
        permissionOverrides: member.permissionOverrides,
        revokedPermissions: member.revokedPermissions,
        screenOverrides: member.screenOverrides,
        revokedScreens: member.revokedScreens,
        preferredDefaultScreen: member.defaultScreen,
        preferredDefaultStationId: member.defaultStationId,
      });

      if (combined.allowedScreens.length === 0) return;

      batch.update(doc(db, 'restaurants', restaurantId, 'staff', member.uid), {
        role: combined.role,
        jobTitle: combined.jobTitleDisplay || member.jobTitle || '',
        jobTitleIds: combined.jobTitleIds,
        jobTitleNames: combined.jobTitleNames,
        allowedScreens: combined.allowedScreens,
        allowedStations: combined.allowedStations,
        allowedCaptainScreens: combined.allowedCaptainScreens,
        effectivePermissions: combined.effectivePermissions,
        ...(combined.hallManagerPermissions ? { hallManagerPermissions: combined.hallManagerPermissions } : {}),
        defaultScreen: combined.defaultScreen,
        defaultStationId: combined.defaultStationId,
        updatedAt: serverTimestamp(),
      });

      batch.update(doc(db, 'staff_access', member.uid), {
        role: combined.role,
        jobTitleIds: combined.jobTitleIds,
        allowedScreens: combined.allowedScreens,
        allowedStations: combined.allowedStations,
        allowedCaptainScreens: combined.allowedCaptainScreens,
        effectivePermissions: combined.effectivePermissions,
        ...(combined.hallManagerPermissions ? { hallManagerPermissions: combined.hallManagerPermissions } : {}),
        defaultScreen: combined.defaultScreen,
        defaultStationId: combined.defaultStationId,
        updatedAt: serverTimestamp(),
      });
      updatedCount += 1;
    });
    await batch.commit();
  }

  return updatedCount;
}

export async function updateJobTitle(params: {
  restaurant: Restaurant;
  existingTitle: JobTitle;
  allJobTitles: JobTitle[];
  staffMembers?: StaffMember[];
  actor: StaffActorInfo;
  ceiling: ActorDelegationCeiling;
  input: SaveJobTitleInput;
}): Promise<{ updatedTitle: JobTitle; propagatedCount: number }> {
  const { restaurant, existingTitle, allJobTitles, staffMembers, actor, ceiling, input } = params;
  const isEn = getActiveLang() === 'en';
  const normalized = normalizeJobTitlePayload(input);

  const coverage = actorCoversTargetGrant({
    actorIsUnbounded: ceiling.isUnbounded,
    actorPermissions: ceiling.permissions,
    actorScreens: ceiling.allowedScreens,
    actorStations: ceiling.allowedStations,
    targetPermissions: normalized.permissions,
    targetScreens: normalized.allowedScreens,
    targetStations: normalized.allowedStations,
  });

  if (!coverage.allowed) {
    throw new Error(
      isEn
        ? 'Security restriction: You cannot grant permissions or screens above your own access ceiling.'
        : 'قيد أمان: لا يمكنك منح صلاحيات أو شاشات تتجاوز سقف صلاحياتك الحالي.'
    );
  }

  // Also ensure non-owner caller cannot edit a title that already holds permissions outside caller's ceiling
  if (!ceiling.isUnbounded) {
    const existingCoverage = actorCoversTargetGrant({
      actorIsUnbounded: false,
      actorPermissions: ceiling.permissions,
      actorScreens: ceiling.allowedScreens,
      actorStations: ceiling.allowedStations,
      targetPermissions: sanitizeEffectivePermissions(existingTitle.permissions),
      targetScreens: existingTitle.allowedScreens || [],
      targetStations: existingTitle.allowedStations || [],
    });
    if (!existingCoverage.allowed) {
      throw new Error(
        isEn
          ? 'Security restriction: This job title includes privileges above your role and can only be modified by the owner or an authorized administrator.'
          : 'قيد أمان: هذا المسمى يحتوي صلاحيات أعلى من صلاحياتك ولا يمكن تعديله إلا بواسطة المالك أو من يملك نفس الصلاحيات.'
      );
    }
  }

  const updatedTitle: JobTitle = {
    ...existingTitle,
    ...normalized,
  };

  try {
    await setDoc(
      doc(db, 'restaurants', restaurant.id, 'job_titles', existingTitle.id),
      {
        ...updatedTitle,
        createdAt: existingTitle.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const propagatedCount = await propagateJobTitleToAssignedStaff({
      restaurantId: restaurant.id,
      updatedJobTitle: updatedTitle,
      allJobTitles,
      staffMembers,
    });

    const logId = makeAuditId();
    await setDoc(doc(db, 'restaurants', restaurant.id, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      eventType: 'job_title_updated' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      targetUid: existingTitle.id,
      targetName: `${normalized.nameAr} / ${normalized.nameEn}`.slice(0, 100),
      screen: 'job_titles',
      details: isEn
        ? `Updated job title "${normalized.nameEn}" (propagated to ${propagatedCount} staff accounts)`
        : `تحديث المسمى الوظيفي "${normalized.nameAr}" (تم التحديث الفوري لـ ${propagatedCount} موظف)`,
      createdAt: serverTimestamp(),
    }).catch(() => {});

    return { updatedTitle, propagatedCount };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `restaurants/${restaurant.id}/job_titles/${existingTitle.id}`);
  }
}

export async function deleteJobTitle(params: {
  restaurant: Restaurant;
  jobTitle: JobTitle;
  staffMembers?: StaffMember[];
  actor: StaffActorInfo;
}): Promise<void> {
  const { restaurant, jobTitle, actor } = params;
  const isEn = getActiveLang() === 'en';

  let staffList = params.staffMembers;
  if (!staffList) {
    const snap = await getDocs(collection(db, 'restaurants', restaurant.id, 'staff'));
    staffList = snap.docs.map((d) => ({ ...(d.data() as StaffMember), uid: d.id }));
  }

  const assignedCount = staffList.filter(
    (s) => Array.isArray(s.jobTitleIds) && s.jobTitleIds.includes(jobTitle.id)
  ).length;
  if (assignedCount > 0) {
    throw new Error(
      isEn
        ? `Cannot delete "${jobTitle.nameEn}" while ${assignedCount} staff account(s) still use it. Reassign those staff members first.`
        : `لا يمكن حذف المسمى "${jobTitle.nameAr}" لارتباط ${assignedCount} موظف به حالياً. انقل الموظفين إلى مسمى آخر أولاً.`
    );
  }

  try {
    await deleteDoc(doc(db, 'restaurants', restaurant.id, 'job_titles', jobTitle.id));
    const logId = makeAuditId();
    await setDoc(doc(db, 'restaurants', restaurant.id, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      eventType: 'job_title_deleted' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      targetUid: jobTitle.id,
      targetName: `${jobTitle.nameAr} / ${jobTitle.nameEn}`.slice(0, 100),
      screen: 'job_titles',
      details: isEn
        ? `Deleted job title "${jobTitle.nameEn}"`
        : `تم حذف المسمى الوظيفي "${jobTitle.nameAr}"`,
      createdAt: serverTimestamp(),
    }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `restaurants/${restaurant.id}/job_titles/${jobTitle.id}`);
  }
}
