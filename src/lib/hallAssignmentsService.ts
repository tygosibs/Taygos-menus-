import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  Hall,
  HallCaptainAssignment,
  Restaurant,
  StaffActorInfo,
  StaffAuditEventType,
} from '../types/menu';
import { db, handleFirestoreError, OperationType } from './firebase';
import { getActiveLang } from '../data/translations';
import { StationMeta } from './stationUtils';

function sanitizeAssignmentIdPart(raw: string, fallback: string): string {
  const cleaned = (raw || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || fallback;
}

export function buildHallAssignmentDocId(shiftSlotId: string, captainUid: string): string {
  const slotPart = sanitizeAssignmentIdPart(shiftSlotId, 'shift').slice(0, 40);
  const uidPart = sanitizeAssignmentIdPart(captainUid, 'captain').slice(0, 80);
  return `${slotPart}__${uidPart}`.slice(0, 128);
}

function makeAssignmentAuditId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `hlog_${Date.now()}_${rand}`;
}

export function subscribeHallAssignments(
  restaurantId: string,
  onData: (assignments: HallCaptainAssignment[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `restaurants/${restaurantId}/hall_assignments`;
  const q = query(collection(db, 'restaurants', restaurantId, 'hall_assignments'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as HallCaptainAssignment), id: d.id }))
        .sort((a, b) => a.captainName.localeCompare(b.captainName));
      onData(list);
    },
    (error) => {
      if (onError) {
        onError(
          error instanceof Error
            ? error
            : new Error(
                getActiveLang() === 'en'
                  ? 'Failed to load captain hall assignments'
                  : 'تعذر تحميل توزيع الكباتن على الصالات'
              )
        );
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  );
}

export function subscribeCaptainHallAssignments(
  restaurantId: string,
  captainUid: string,
  onData: (assignments: HallCaptainAssignment[]) => void,
  onError?: (err: Error) => void
): () => void {
  const cleanUid = (captainUid || '').trim();
  if (!cleanUid) {
    onData([]);
    return () => {};
  }
  const path = `restaurants/${restaurantId}/hall_assignments`;
  const q = query(
    collection(db, 'restaurants', restaurantId, 'hall_assignments'),
    where('captainUid', '==', cleanUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ ...(d.data() as HallCaptainAssignment), id: d.id }));
      onData(list);
    },
    (error) => {
      if (onError) {
        onError(
          error instanceof Error
            ? error
            : new Error(
                getActiveLang() === 'en'
                  ? 'Failed to load your shift hall assignments'
                  : 'تعذر تحميل توزيع صالاتك في الوردية'
              )
        );
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  );
}

export interface SaveCaptainShiftInput {
  captainUid: string;
  captainName: string;
  hallIds: string[];
  hallNames: string[];
  tableNumbersByHall: Record<string, string[]>;
  tableNumbers: string[];
}

export async function saveShiftCaptainAssignments(params: {
  restaurant: Restaurant;
  actor: StaffActorInfo;
  shiftSlotId: string;
  shiftSlotName: string;
  captainAssignments: SaveCaptainShiftInput[];
  existingAssignmentsForShift: HallCaptainAssignment[];
}): Promise<void> {
  const {
    restaurant,
    actor,
    shiftSlotId,
    shiftSlotName,
    captainAssignments,
    existingAssignmentsForShift,
  } = params;
  const cleanShiftId = sanitizeAssignmentIdPart(shiftSlotId, 'morning').slice(0, 40);
  const cleanShiftName = (shiftSlotName || cleanShiftId).trim().slice(0, 80);

  const existingByDocId = new Map<string, HallCaptainAssignment>();
  existingAssignmentsForShift.forEach((item) => {
    existingByDocId.set(item.id, item);
  });

  const batch = writeBatch(db);
  const keptDocIds = new Set<string>();
  let activeCount = 0;

  captainAssignments.forEach((entry) => {
    const cleanHallIds = Array.from(new Set(entry.hallIds.map((h) => h.trim()).filter(Boolean))).slice(0, 30);
    const docId = buildHallAssignmentDocId(cleanShiftId, entry.captainUid);
    if (cleanHallIds.length === 0) {
      if (existingByDocId.has(docId)) {
        batch.delete(doc(db, 'restaurants', restaurant.id, 'hall_assignments', docId));
      }
      return;
    }

    activeCount += 1;
    keptDocIds.add(docId);

    const sanitizedByHall: Record<string, string[]> = {};
    cleanHallIds.forEach((hid) => {
      const arr = Array.isArray(entry.tableNumbersByHall?.[hid])
        ? Array.from(
            new Set(
              entry.tableNumbersByHall[hid]
                .map((t) => String(t).trim())
                .filter(Boolean)
            )
          ).slice(0, 200)
        : [];
      if (arr.length > 0) {
        sanitizedByHall[hid] = arr;
      }
    });

    const cleanFlatTables = Array.from(
      new Set(
        (entry.tableNumbers || [])
          .map((t) => String(t).trim())
          .filter(Boolean)
      )
    ).slice(0, 200);

    const cleanHallNames = Array.from(
      new Set(entry.hallNames.map((n) => n.trim().slice(0, 80)).filter(Boolean))
    ).slice(0, 30);

    const prev = existingByDocId.get(docId);
    const ref = doc(db, 'restaurants', restaurant.id, 'hall_assignments', docId);
    batch.set(ref, {
      id: docId,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      shiftSlotId: cleanShiftId,
      shiftSlotName: cleanShiftName,
      captainUid: entry.captainUid,
      captainName: entry.captainName.trim().slice(0, 100) || 'Captain',
      hallIds: cleanHallIds,
      hallNames: cleanHallNames,
      tableNumbersByHall: sanitizedByHall,
      tableNumbers: cleanFlatTables,
      assignedByUid: actor.uid,
      assignedByName: actor.name.trim().slice(0, 100),
      assignedByRole: actor.role,
      createdAt: prev?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  // Delete any orphaned assignment docs from this shift whose captain wasn't included
  existingAssignmentsForShift.forEach((prev) => {
    if (!keptDocIds.has(prev.id)) {
      batch.delete(doc(db, 'restaurants', restaurant.id, 'hall_assignments', prev.id));
    }
  });

  await batch.commit();

  // Non-fatal accountability log
  try {
    const isEn = getActiveLang() === 'en';
    const auditBatch = writeBatch(db);
    const logId = makeAssignmentAuditId();
    auditBatch.set(doc(db, 'restaurants', restaurant.id, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      eventType: 'hall_assignment_updated' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      screen: 'hall_assignments',
      details: isEn
        ? `Updated captain hall assignments for shift "${cleanShiftName}" (${activeCount} active captains)`
        : `تم تحديث توزيع الكباتن لوردية "${cleanShiftName}" (${activeCount} كابتن موزّع)`,
      createdAt: serverTimestamp(),
    });
    await auditBatch.commit();
  } catch {
    // Non-fatal audit logging
  }
}

export async function copyShiftHallAssignments(params: {
  restaurant: Restaurant;
  actor: StaffActorInfo;
  sourceShiftSlotId: string;
  sourceShiftSlotName: string;
  targetShiftSlotId: string;
  targetShiftSlotName: string;
  allAssignments: HallCaptainAssignment[];
}): Promise<number> {
  const {
    restaurant,
    actor,
    sourceShiftSlotId,
    sourceShiftSlotName,
    targetShiftSlotId,
    targetShiftSlotName,
    allAssignments,
  } = params;
  const sourceList = allAssignments.filter(
    (a) => a.shiftSlotId === sourceShiftSlotId && Array.isArray(a.hallIds) && a.hallIds.length > 0
  );
  const existingTarget = allAssignments.filter((a) => a.shiftSlotId === targetShiftSlotId);

  const batch = writeBatch(db);
  const newIds = new Set<string>();

  sourceList.forEach((src) => {
    const docId = buildHallAssignmentDocId(targetShiftSlotId, src.captainUid);
    newIds.add(docId);
    const prevTarget = existingTarget.find((t) => t.id === docId);
    batch.set(doc(db, 'restaurants', restaurant.id, 'hall_assignments', docId), {
      id: docId,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      shiftSlotId: sanitizeAssignmentIdPart(targetShiftSlotId, 'shift').slice(0, 40),
      shiftSlotName: (targetShiftSlotName || targetShiftSlotId).trim().slice(0, 80),
      captainUid: src.captainUid,
      captainName: src.captainName.slice(0, 100),
      hallIds: src.hallIds,
      hallNames: src.hallNames || [],
      tableNumbersByHall: src.tableNumbersByHall || {},
      tableNumbers: src.tableNumbers || [],
      assignedByUid: actor.uid,
      assignedByName: actor.name.trim().slice(0, 100),
      assignedByRole: actor.role,
      createdAt: prevTarget?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  existingTarget.forEach((old) => {
    if (!newIds.has(old.id)) {
      batch.delete(doc(db, 'restaurants', restaurant.id, 'hall_assignments', old.id));
    }
  });

  await batch.commit();

  try {
    const isEn = getActiveLang() === 'en';
    const auditBatch = writeBatch(db);
    const logId = makeAssignmentAuditId();
    auditBatch.set(doc(db, 'restaurants', restaurant.id, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      eventType: 'hall_assignment_updated' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      screen: 'hall_assignments',
      details: isEn
        ? `Copied ${sourceList.length} captain assignments from "${sourceShiftSlotName}" to "${targetShiftSlotName}"`
        : `تم نسخ توزيع ${sourceList.length} كابتن من وردية "${sourceShiftSlotName}" إلى "${targetShiftSlotName}"`,
      createdAt: serverTimestamp(),
    });
    await auditBatch.commit();
  } catch {
    // Non-fatal audit logging
  }

  return sourceList.length;
}

export async function clearShiftHallAssignments(params: {
  restaurant: Restaurant;
  actor: StaffActorInfo;
  shiftSlotId: string;
  shiftSlotName: string;
  existingAssignmentsForShift: HallCaptainAssignment[];
}): Promise<number> {
  const { restaurant, actor, shiftSlotName, existingAssignmentsForShift } = params;
  if (existingAssignmentsForShift.length === 0) return 0;

  const batch = writeBatch(db);
  existingAssignmentsForShift.forEach((item) => {
    batch.delete(doc(db, 'restaurants', restaurant.id, 'hall_assignments', item.id));
  });
  await batch.commit();

  try {
    const isEn = getActiveLang() === 'en';
    const auditBatch = writeBatch(db);
    const logId = makeAssignmentAuditId();
    auditBatch.set(doc(db, 'restaurants', restaurant.id, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      eventType: 'hall_assignment_updated' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      screen: 'hall_assignments',
      details: isEn
        ? `Cleared all captain hall assignments for shift "${shiftSlotName}"`
        : `تم مسح جميع توزيعات الكباتن لوردية "${shiftSlotName}"`,
      createdAt: serverTimestamp(),
    });
    await auditBatch.commit();
  } catch {
    // Non-fatal audit logging
  }

  return existingAssignmentsForShift.length;
}

export interface CaptainEffectiveScope {
  hasDynamicAssignment: boolean;
  hasStaticBounds: boolean;
  effectiveHallIds: string[]; // empty array = all halls allowed
  effectiveHallNames: string[];
  tableNumbersByHall: Record<string, string[]>; // empty array per hall = all tables in that hall
  staticTableFallback: string[];
  isHallAllowed: (hallId: string, hallName?: string) => boolean;
  isTableAllowed: (hallId: string, hallName: string | undefined, tableNumber: string) => boolean;
  summaryLabelAr: string;
  summaryLabelEn: string;
}

/**
 * Computes live Captain floor visibility scope using strict Intersection / Narrowest Wins precedence:
 * 1) Static Captain Station bounds (`tableVisibilityScope === 'assigned_only'` -> assignedHallIds & assignedTableNumbers)
 * 2) Dynamic Shift Hall Assignment (`hall_assignments` doc for current shiftSlotId & captainUid)
 * If dynamic assignment exists -> intersects with static bounds (when static is `assigned_only`).
 * If dynamic assignment does NOT exist -> keeps static bounds or allows all halls (never empty due to missing shift schedule).
 */
export function computeCaptainEffectiveScope(params: {
  captainScreenMeta?: StationMeta | null;
  shiftAssignment?: HallCaptainAssignment | null;
  halls: Hall[];
  isEn?: boolean;
}): CaptainEffectiveScope {
  const { captainScreenMeta, shiftAssignment, halls } = params;
  const staticScoped =
    captainScreenMeta?.screenType === 'captain' &&
    captainScreenMeta?.tableVisibilityScope === 'assigned_only';
  const staticHallIds = staticScoped
    ? Array.from(new Set((captainScreenMeta?.assignedHallIds || []).filter(Boolean)))
    : [];
  const staticTableNumbers = staticScoped
    ? Array.from(new Set((captainScreenMeta?.assignedTableNumbers || []).map((t) => String(t).trim()).filter(Boolean)))
    : [];

  const hasDynamicAssignment = Boolean(
    shiftAssignment && Array.isArray(shiftAssignment.hallIds) && shiftAssignment.hallIds.length > 0
  );
  const dynamicHallIds = hasDynamicAssignment
    ? Array.from(new Set(shiftAssignment!.hallIds.filter(Boolean)))
    : [];

  let effectiveHallIds: string[] = [];
  if (staticScoped && staticHallIds.length > 0 && hasDynamicAssignment) {
    const staticSet = new Set(staticHallIds);
    effectiveHallIds = dynamicHallIds.filter((id) => staticSet.has(id));
  } else if (hasDynamicAssignment) {
    effectiveHallIds = dynamicHallIds;
  } else if (staticScoped) {
    effectiveHallIds = staticHallIds;
  }

  // If static was 'assigned_only' with 0 halls AND 0 tables, or if intersection of two non-empty hall sets is empty, keep special marker ['__none__']
  const intersectionEmpty =
    (staticScoped && staticHallIds.length > 0 && hasDynamicAssignment && effectiveHallIds.length === 0) ||
    (staticScoped && staticHallIds.length === 0 && staticTableNumbers.length === 0 && !hasDynamicAssignment);

  const resolvedHallIds = intersectionEmpty ? ['__none__'] : effectiveHallIds;

  const hallById = new Map<string, Hall>();
  const hallByNameLower = new Map<string, Hall>();
  halls.forEach((h) => {
    hallById.set(h.id, h);
    hallByNameLower.set(h.name.trim().toLowerCase(), h);
    if (h.name_en) hallByNameLower.set(h.name_en.trim().toLowerCase(), h);
  });

  const tableNumbersByHall: Record<string, string[]> = {};
  const hallIdsForTableCalc =
    resolvedHallIds.length > 0 && !intersectionEmpty
      ? resolvedHallIds
      : halls.map((h) => h.id);

  hallIdsForTableCalc.forEach((hid) => {
    const dynTables =
      hasDynamicAssignment && Array.isArray(shiftAssignment?.tableNumbersByHall?.[hid])
        ? shiftAssignment!.tableNumbersByHall![hid].map((t) => String(t).trim()).filter(Boolean)
        : hasDynamicAssignment && Array.isArray(shiftAssignment?.tableNumbers)
          ? shiftAssignment!.tableNumbers.map((t) => String(t).trim()).filter(Boolean)
          : [];

    if (staticScoped && staticTableNumbers.length > 0 && dynTables.length > 0) {
      const sSet = new Set(staticTableNumbers);
      const inter = dynTables.filter((t) => sSet.has(t));
      tableNumbersByHall[hid] = inter.length > 0 ? inter : ['__none__'];
    } else if (dynTables.length > 0) {
      tableNumbersByHall[hid] = dynTables;
    } else if (staticScoped && staticTableNumbers.length > 0) {
      tableNumbersByHall[hid] = staticTableNumbers;
    } else {
      tableNumbersByHall[hid] = [];
    }
  });

  const effectiveHallNames = intersectionEmpty
    ? []
    : resolvedHallIds
        .map((id) => {
          const h = hallById.get(id);
          return h ? h.name : '';
        })
        .filter(Boolean);

  const isHallAllowed = (hallId: string, hallName?: string): boolean => {
    if (intersectionEmpty) return false;
    if (resolvedHallIds.length === 0) return true;
    if (hallId && resolvedHallIds.includes(hallId)) return true;
    if (hallName) {
      const matched = hallByNameLower.get(hallName.trim().toLowerCase());
      if (matched && resolvedHallIds.includes(matched.id)) return true;
    }
    return false;
  };

  const isTableAllowed = (
    hallId: string,
    hallName: string | undefined,
    tableNumber: string
  ): boolean => {
    if (intersectionEmpty) return false;
    const cleanTbl = String(tableNumber || '').trim();
    const resolvedHall =
      (hallId ? hallById.get(hallId) : undefined) ||
      (hallName ? hallByNameLower.get(hallName.trim().toLowerCase()) : undefined);
    const targetHid = resolvedHall?.id || hallId;

    if (resolvedHallIds.length > 0) {
      if (!targetHid || !resolvedHallIds.includes(targetHid)) {
        return false;
      }
    }

    const allowedForHall = targetHid ? tableNumbersByHall[targetHid] : undefined;
    if (allowedForHall && allowedForHall.length > 0) {
      if (allowedForHall.includes('__none__')) return false;
      return cleanTbl ? allowedForHall.includes(cleanTbl) : false;
    }

    if (staticScoped && staticTableNumbers.length > 0) {
      return cleanTbl ? staticTableNumbers.includes(cleanTbl) : false;
    }
    return true;
  };

  // Build crisp summary string for badge: «أنت مسؤول عن: صالة VIP، صالة 1 (طاولات 1-5)»
  const formatHallPart = (useEn: boolean): string => {
    if (intersectionEmpty) {
      return useEn ? 'No tables in overlapping assignment' : 'لا توجد طاولات ضمن النطاق المشترك';
    }
    const parts: string[] = [];
    const targetHids = resolvedHallIds.length > 0 ? resolvedHallIds : [];
    targetHids.forEach((hid) => {
      const h = hallById.get(hid);
      const hLabel = useEn ? h?.name_en || h?.name || hid : h?.name || hid;
      const tbls = tableNumbersByHall[hid] || [];
      if (tbls.length > 0 && !tbls.includes('__none__')) {
        const tablePreview = tbls.length <= 6 ? tbls.join('، ') : `${tbls.slice(0, 5).join(', ')} (+${tbls.length - 5})`;
        parts.push(useEn ? `${hLabel} (Tables: ${tablePreview})` : `${hLabel} (طاولات: ${tablePreview})`);
      } else {
        parts.push(hLabel);
      }
    });
    if (parts.length === 0 && staticScoped && staticTableNumbers.length > 0) {
      const tblStr = staticTableNumbers.slice(0, 8).join(', ');
      return useEn ? `Tables: ${tblStr}` : `طاولات: ${tblStr}`;
    }
    if (parts.length === 0) {
      return useEn ? 'All Dining Halls' : 'جميع الصالات والطاولات';
    }
    return parts.join(useEn ? ' · ' : ' · ');
  };

  return {
    hasDynamicAssignment,
    hasStaticBounds: staticScoped,
    effectiveHallIds: resolvedHallIds,
    effectiveHallNames,
    tableNumbersByHall,
    staticTableFallback: staticTableNumbers,
    isHallAllowed,
    isTableAllowed,
    summaryLabelAr: formatHallPart(false),
    summaryLabelEn: formatHallPart(true),
  };
}
