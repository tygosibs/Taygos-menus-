import {
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  StaffActorInfo,
  StaffAuditEventType,
  StaffShift,
} from '../types/menu';

function makeShiftId(staffUid: string, stationId: string): string {
  const rnd = Math.random().toString(36).slice(2, 7);
  return `sh_${staffUid.slice(0, 8)}_${stationId.slice(0, 10)}_${Date.now().toString(36)}_${rnd}`;
}

function makeAuditId(): string {
  return `slog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function subscribeMyActiveShifts(
  restaurantId: string,
  staffUid: string,
  onData: (shifts: StaffShift[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!restaurantId || !staffUid) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'restaurants', restaurantId, 'staff_shifts'),
    where('staffId', '==', staffUid),
    where('status', '==', 'active')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ ...(d.data() as StaffShift), id: d.id })));
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export function subscribeAllActiveRestaurantShifts(
  restaurantId: string,
  onData: (shifts: StaffShift[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!restaurantId) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'restaurants', restaurantId, 'staff_shifts'),
    where('status', '==', 'active')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ ...(d.data() as StaffShift), id: d.id })));
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function startStaffShift(params: {
  restaurantId: string;
  ownerId: string;
  staffId: string;
  staffName: string;
  staffRole: StaffActorInfo['role'];
  stationId: string;
  stationName: string;
  hallId?: string;
  shiftSlotId?: string;
  shiftSlotName?: string;
  openingFloat?: number;
  carriedOverCash?: number;
  carriedFromShiftId?: string;
}): Promise<StaffShift> {
  const {
    restaurantId,
    ownerId,
    staffId,
    staffName,
    staffRole,
    stationId,
    stationName,
    hallId = '',
    shiftSlotId,
    shiftSlotName,
    openingFloat,
    carriedOverCash,
    carriedFromShiftId,
  } = params;

  // Prevent duplicate simultaneous active shifts on the same station for this staff member
  const existingQ = query(
    collection(db, 'restaurants', restaurantId, 'staff_shifts'),
    where('staffId', '==', staffId),
    where('status', '==', 'active')
  );
  const existingSnap = await getDocs(existingQ);
  const duplicate = existingSnap.docs.find(
    (d) => (d.data() as StaffShift).stationId === stationId
  );
  if (duplicate) {
    throw new Error(`لديك وردية نشطة بالفعل في شاشة "${stationName}".`);
  }

  const shiftId = makeShiftId(staffId, stationId);
  const isCashier = stationId === 'cashier';
  const safeFloat = Math.max(0, Number(openingFloat) || 0);
  const safeCarry = Math.max(0, Number(carriedOverCash) || 0);

  const shiftPayload: StaffShift = {
    id: shiftId,
    restaurantId,
    ownerId,
    staffId,
    staffName: staffName.slice(0, 100),
    stationId,
    stationName: stationName.slice(0, 80),
    hallId: hallId.slice(0, 128),
    ...(shiftSlotId ? { shiftSlotId: shiftSlotId.slice(0, 40) } : {}),
    ...(shiftSlotName ? { shiftSlotName: shiftSlotName.slice(0, 80) } : {}),
    status: 'active',
    ordersHandled: 0,
    itemsMarkedReady: 0,
    serviceCallsHandled: 0,
    ...(isCashier
      ? {
          openingFloat: safeFloat,
          carriedOverCash: safeCarry,
          ...(carriedFromShiftId ? { carriedFromShiftId: carriedFromShiftId.slice(0, 128) } : {}),
          cashSales: 0,
          visaSales: 0,
          drawerExpensesTotal: 0,
          drawerVarianceTotal: 0,
          expectedCashHandover: Number((safeFloat + safeCarry).toFixed(2)),
        }
      : {}),
  };

  try {
    await setDoc(doc(db, 'restaurants', restaurantId, 'staff_shifts', shiftId), {
      ...shiftPayload,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const logId = makeAuditId();
    await setDoc(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId,
      ownerId,
      eventType: 'shift_started' satisfies StaffAuditEventType,
      actorUid: staffId,
      actorName: staffName.slice(0, 100),
      actorRole: staffRole,
      targetUid: staffId,
      targetName: staffName.slice(0, 100),
      screen: stationId,
      details: `بدأ ${staffName} ورديته على قسم/شاشة: ${stationName}`,
      createdAt: serverTimestamp(),
    });

    return shiftPayload;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `restaurants/${restaurantId}/staff_shifts/${shiftId}`);
  }
}

export async function endStaffShift(params: {
  restaurantId: string;
  ownerId: string;
  shift: StaffShift;
  staffRole: StaffActorInfo['role'];
}): Promise<{ stationNowUncovered: boolean; uncoveredWarning?: string }> {
  const { restaurantId, ownerId, shift, staffRole } = params;
  if (!shift || shift.status !== 'active') {
    throw new Error('لا توجد وردية نشطة لإنهائها.');
  }

  try {
    await updateDoc(doc(db, 'restaurants', restaurantId, 'staff_shifts', shift.id), {
      status: 'completed',
      endedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const endLogId = makeAuditId();
    await setDoc(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', endLogId), {
      id: endLogId,
      restaurantId,
      ownerId,
      eventType: 'shift_ended' satisfies StaffAuditEventType,
      actorUid: shift.staffId,
      actorName: shift.staffName.slice(0, 100),
      actorRole: staffRole,
      targetUid: shift.staffId,
      targetName: shift.staffName.slice(0, 100),
      screen: shift.stationId,
      details: `أنهى ${shift.staffName} ورديته على قسم/شاشة: ${shift.stationName}`,
      createdAt: serverTimestamp(),
    });

    // Check remaining active shifts on the same station
    let remainingCount = 0;
    try {
      const remainingQ = query(
        collection(db, 'restaurants', restaurantId, 'staff_shifts'),
        where('status', '==', 'active'),
        where('stationId', '==', shift.stationId)
      );
      const remainingSnap = await getDocs(remainingQ);
      remainingCount = remainingSnap.docs.filter((d) => d.id !== shift.id).length;
    } catch {
      remainingCount = 0;
    }

    if (remainingCount === 0) {
      const alertText = `لا يوجد موظف نشط في قسم ${shift.stationName} حاليًا.`;
      const alertLogId = makeAuditId();
      await setDoc(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', alertLogId), {
        id: alertLogId,
        restaurantId,
        ownerId,
        eventType: 'station_uncovered_alert' satisfies StaffAuditEventType,
        actorUid: shift.staffId,
        actorName: shift.staffName.slice(0, 100),
        actorRole: staffRole,
        screen: shift.stationId,
        details: alertText,
        createdAt: serverTimestamp(),
      });
      return { stationNowUncovered: true, uncoveredWarning: alertText };
    }

    return { stationNowUncovered: false };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `restaurants/${restaurantId}/staff_shifts/${shift.id}`);
  }
}

export async function incrementActiveShiftMetric(params: {
  restaurantId: string;
  staffUid: string;
  stationId?: string;
  field: 'ordersHandled' | 'itemsMarkedReady' | 'serviceCallsHandled';
  delta?: number;
}): Promise<void> {
  const { restaurantId, staffUid, stationId, field, delta = 1 } = params;
  if (!restaurantId || !staffUid) return;
  try {
    const q = query(
      collection(db, 'restaurants', restaurantId, 'staff_shifts'),
      where('staffId', '==', staffUid),
      where('status', '==', 'active')
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const matchingDoc =
      (stationId
        ? snap.docs.find((d) => (d.data() as StaffShift).stationId === stationId)
        : undefined) || snap.docs[0];

    await updateDoc(matchingDoc.ref, {
      [field]: increment(delta),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking metrics update
  }
}
