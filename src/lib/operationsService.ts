import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  DrawerExpense,
  HandoverStatus,
  ManagerPermissions,
  OperationsConfig,
  Order,
  OrderAdjustmentEntry,
  OrderItemPayload,
  OrderPaymentMethod,
  Restaurant,
  ShiftSlotConfig,
  ShowPricesByRole,
  StaffActorInfo,
  StaffAuditEventType,
  StaffShift,
  TableGridColors,
  TreasuryState,
  TreasuryTransfer,
} from '../types/menu';
import { db, handleFirestoreError, OperationType } from './firebase';
import { startStaffShift } from './shiftsService';

function makeOpId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getTimestampMillis(ts: unknown): number {
  if (!ts) return 0;
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'object' && 'seconds' in ts && typeof (ts as { seconds: number }).seconds === 'number') {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return 0;
}

export const DEFAULT_SHIFT_SLOTS: ShiftSlotConfig[] = [
  { id: 'morning', name: 'الصباحية', nameEn: 'Morning', startTime: '08:00', endTime: '16:00' },
  { id: 'evening', name: 'المسائية', nameEn: 'Evening', startTime: '16:00', endTime: '00:00' },
  { id: 'night', name: 'الليلية', nameEn: 'Night', startTime: '00:00', endTime: '08:00' },
];

export const DEFAULT_TABLE_COLORS: TableGridColors = {
  empty: '#16A34A',
  occupied: '#EA580C',
  billRequested: '#EAB308',
  overdue: '#DC2626',
};

export const DEFAULT_MANAGER_PERMISSIONS: ManagerPermissions = {
  canEditMenu: true,
  canPauseItems: true,
  canEditOpenOrders: true,
  canCancelOpenOrders: true,
  canEditClosedChecks: false,
  canApplyInstantDiscount: true,
  canViewShiftReports: true,
  canEditDrawerFloat: true,
  canManageStaff: true,
  canConfigureOperations: true,
  canToggleScreenPrices: true,
};

export const DEFAULT_SHOW_PRICES_BY_ROLE: ShowPricesByRole = {
  cashier: true,
  manager: true,
  kitchen: false,
  bar: false,
  pastry: false,
  captain: false,
};

export function getDefaultOperationsConfig(): OperationsConfig {
  return {
    shiftSlots: DEFAULT_SHIFT_SLOTS.map((s) => ({ ...s })),
    defaultCashierFloat: 0,
    tableOverdueMinutes: 120,
    tableColors: { ...DEFAULT_TABLE_COLORS },
    managerPermissions: { ...DEFAULT_MANAGER_PERMISSIONS },
    showPricesByRole: { ...DEFAULT_SHOW_PRICES_BY_ROLE },
  };
}

export function getResolvedOperationsConfig(restaurant?: Partial<Restaurant> | null): OperationsConfig {
  const defaults = getDefaultOperationsConfig();
  const cfg = restaurant?.operationsConfig;
  if (!cfg) return defaults;

  const shiftSlots =
    Array.isArray(cfg.shiftSlots) && cfg.shiftSlots.length >= 1
      ? cfg.shiftSlots.slice(0, 4).map((slot, idx) => ({
          id: slot.id || `shift_${idx + 1}`,
          name: slot.name || `وردية ${idx + 1}`,
          nameEn: slot.nameEn || `Shift ${idx + 1}`,
          startTime: slot.startTime || '08:00',
          endTime: slot.endTime || '16:00',
        }))
      : defaults.shiftSlots;

  return {
    shiftSlots,
    defaultCashierFloat: Math.max(0, Number(cfg.defaultCashierFloat ?? defaults.defaultCashierFloat)),
    tableOverdueMinutes: Math.max(10, Math.min(1440, Number(cfg.tableOverdueMinutes ?? defaults.tableOverdueMinutes))),
    tableColors: {
      empty: cfg.tableColors?.empty || defaults.tableColors.empty,
      occupied: cfg.tableColors?.occupied || defaults.tableColors.occupied,
      billRequested: cfg.tableColors?.billRequested || defaults.tableColors.billRequested,
      overdue: cfg.tableColors?.overdue || defaults.tableColors.overdue,
    },
    managerPermissions: {
      ...defaults.managerPermissions,
      ...(cfg.managerPermissions || {}),
    },
    showPricesByRole: {
      ...defaults.showPricesByRole,
      ...(cfg.showPricesByRole || {}),
    },
  };
}

export function getResolvedTreasuryState(restaurant?: Partial<Restaurant> | null): TreasuryState {
  const t = restaurant?.treasuryState;
  return {
    managerCustodyBalance: Number(t?.managerCustodyBalance || 0),
    ownerVaultCashBalance: Number(t?.ownerVaultCashBalance || 0),
    ownerVaultVisaTotal: Number(t?.ownerVaultVisaTotal || 0),
    lastUpdatedByUid: t?.lastUpdatedByUid,
    lastUpdatedByName: t?.lastUpdatedByName,
    updatedAt: t?.updatedAt,
  };
}

export function parseTimeToMinutes(hhmm: string): number {
  const [hStr, mStr] = (hhmm || '00:00').split(':');
  const h = Math.max(0, Math.min(23, Number(hStr) || 0));
  const m = Math.max(0, Math.min(59, Number(mStr) || 0));
  return h * 60 + m;
}

export function getCurrentShiftSlot(config: OperationsConfig, now = new Date()): ShiftSlotConfig {
  const slots = config.shiftSlots.length > 0 ? config.shiftSlots : DEFAULT_SHIFT_SLOTS;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const slot of slots) {
    const startMin = parseTimeToMinutes(slot.startTime);
    const endMin = parseTimeToMinutes(slot.endTime);
    if (startMin < endMin) {
      if (nowMin >= startMin && nowMin < endMin) return slot;
    } else if (startMin > endMin) {
      // Overnight shift e.g. 16:00 -> 00:00 or 20:00 -> 04:00
      if (nowMin >= startMin || nowMin < endMin) return slot;
    } else {
      return slot;
    }
  }
  return slots[0];
}

export function getNextShiftSlot(config: OperationsConfig, currentSlotId?: string): ShiftSlotConfig {
  const slots = config.shiftSlots.length > 0 ? config.shiftSlots : DEFAULT_SHIFT_SLOTS;
  const idx = slots.findIndex((s) => s.id === currentSlotId);
  if (idx === -1) return slots[0];
  return slots[(idx + 1) % slots.length];
}

export function getShiftSlotRemainingMinutes(
  slot: ShiftSlotConfig,
  extendedHours = 0,
  now = new Date()
): number {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = parseTimeToMinutes(slot.startTime);
  let endMin = parseTimeToMinutes(slot.endTime);
  if (endMin <= startMin) {
    endMin += 24 * 60;
  }
  let adjustedNow = nowMin;
  if (adjustedNow < startMin) {
    adjustedNow += 24 * 60;
  }
  const endWithExtra = endMin + Math.max(0, Number(extendedHours) || 0) * 60;
  return endWithExtra - adjustedNow;
}

export function calculateCashSettlementAndVariance(params: {
  totalDue: number;
  paymentMethod: OrderPaymentMethod;
  cashPaidAmount?: number;
  visaPaidAmount?: number;
  customerCashTendered?: number;
  currency: string;
  autoRoundToCoinless: boolean;
}): {
  cashDue: number;
  visaDue: number;
  customerCashTendered: number;
  exactChangeDue: number;
  changeReturned: number;
  drawerVariance: number;
  roundingStep: number;
} {
  const totalDue = Math.max(0, Number(params.totalDue) || 0);
  const currencyClean = (params.currency || '').trim().toUpperCase();
  const roundingStep =
    currencyClean === 'EGP' || currencyClean === 'ج.م' || currencyClean === 'جنيه' ? 5 : 1;

  let cashDue = 0;
  let visaDue = 0;

  if (params.paymentMethod === 'visa') {
    visaDue = Number(totalDue.toFixed(2));
  } else if (params.paymentMethod === 'split') {
    const reqVisa = Math.max(0, Math.min(totalDue, Number(params.visaPaidAmount) || 0));
    visaDue = Number(reqVisa.toFixed(2));
    cashDue = Number(Math.max(0, totalDue - visaDue).toFixed(2));
  } else {
    cashDue = Number(totalDue.toFixed(2));
  }

  const tenderedRaw =
    params.paymentMethod === 'visa'
      ? 0
      : typeof params.customerCashTendered === 'number' && !Number.isNaN(params.customerCashTendered)
      ? Math.max(0, params.customerCashTendered)
      : cashDue;

  const exactChangeDue = Math.max(0, Number((tenderedRaw - cashDue).toFixed(2)));
  let changeReturned = exactChangeDue;

  if (params.autoRoundToCoinless && exactChangeDue > 0) {
    changeReturned = Math.floor(exactChangeDue / roundingStep) * roundingStep;
  } else if (params.autoRoundToCoinless && cashDue > 0 && tenderedRaw === cashDue) {
    // Even if tendered wasn't entered higher, keep exact when exact match
    changeReturned = 0;
  }

  // Positive drawerVariance means cashier kept coin surplus (+4 EGP if 29 -> 25 change returned)
  // Negative means cashier returned extra or accepted short cash
  const drawerVariance =
    params.paymentMethod === 'visa'
      ? 0
      : Number((tenderedRaw - changeReturned - cashDue).toFixed(2));

  return {
    cashDue,
    visaDue,
    customerCashTendered: Number(tenderedRaw.toFixed(2)),
    exactChangeDue,
    changeReturned: Number(changeReturned.toFixed(2)),
    drawerVariance,
    roundingStep,
  };
}

export function subscribeAllRestaurantShifts(
  restaurantId: string,
  onData: (shifts: StaffShift[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!restaurantId) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, 'restaurants', restaurantId, 'staff_shifts'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as StaffShift), id: d.id }))
        .sort((a, b) => getTimestampMillis(b.startedAt) - getTimestampMillis(a.startedAt));
      onData(list);
    },
    (err) => {
      if (onError) onError(err instanceof Error ? err : new Error('تعذر تحميل الورديات'));
    }
  );
}

export function subscribeDrawerExpenses(
  restaurantId: string,
  onData: (expenses: DrawerExpense[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!restaurantId) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, 'restaurants', restaurantId, 'drawer_expenses'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as DrawerExpense), id: d.id }))
        .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
      onData(list);
    },
    (err) => {
      if (onError) onError(err instanceof Error ? err : new Error('تعذر تحميل مصروفات الدرج'));
    }
  );
}

export function subscribeTreasuryTransfers(
  restaurantId: string,
  onData: (transfers: TreasuryTransfer[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!restaurantId) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, 'restaurants', restaurantId, 'treasury_transfers'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as TreasuryTransfer), id: d.id }))
        .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
      onData(list);
    },
    (err) => {
      if (onError) onError(err instanceof Error ? err : new Error('تعذر تحميل حركة الخزنة'));
    }
  );
}

export async function addDrawerExpense(params: {
  restaurantId: string;
  ownerId: string;
  shift: StaffShift;
  amount: number;
  description: string;
  note?: string;
  actor: StaffActorInfo;
}): Promise<void> {
  const { restaurantId, ownerId, shift, actor } = params;
  const amount = Number(Number(params.amount || 0).toFixed(2));
  const description = params.description.trim().slice(0, 200);
  const note = (params.note || '').trim().slice(0, 300);

  if (amount <= 0) throw new Error('يرجى إدخال مبلغ مصروف صحيح أكبر من صفر.');
  if (!description) throw new Error('يرجى كتابة بيان/سبب المصروف.');
  if (shift.status !== 'active') throw new Error('لا يمكن إضافة مصروفات على وردية مغلقة.');

  const expenseId = makeOpId('exp');
  const nextExpensesTotal = Number(((shift.drawerExpensesTotal || 0) + amount).toFixed(2));
  const nextExpectedHandover = Number(
    (
      (shift.openingFloat || 0) +
      (shift.carriedOverCash || 0) +
      (shift.cashSales || 0) +
      (shift.drawerVarianceTotal || 0) -
      nextExpensesTotal
    ).toFixed(2)
  );

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'restaurants', restaurantId, 'drawer_expenses', expenseId), {
      id: expenseId,
      restaurantId,
      ownerId,
      shiftId: shift.id,
      cashierUid: actor.uid,
      cashierName: actor.name.slice(0, 100),
      amount,
      description,
      ...(note ? { note } : {}),
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'restaurants', restaurantId, 'staff_shifts', shift.id), {
      drawerExpensesTotal: nextExpensesTotal,
      expectedCashHandover: nextExpectedHandover,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    const logId = makeOpId('slog');
    await setDoc(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId,
      ownerId,
      eventType: 'drawer_expense_added' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      screen: 'cashier',
      details: `مصروف من الدرج (${amount}): ${description}${note ? ` — ${note}` : ''}`,
      createdAt: serverTimestamp(),
    }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `restaurants/${restaurantId}/drawer_expenses/${expenseId}`);
  }
}

export async function settleOrdersCheck(params: {
  restaurantId: string;
  ownerId: string;
  orders: Order[];
  sessionId?: string;
  hallName?: string;
  tableNumber?: string;
  activeShift?: StaffShift | null;
  paymentMethod: OrderPaymentMethod;
  cashPaidAmount: number;
  visaPaidAmount: number;
  customerCashTendered: number;
  changeReturned: number;
  drawerVariance: number;
  actor: StaffActorInfo;
}): Promise<void> {
  const {
    restaurantId,
    ownerId,
    orders,
    sessionId,
    hallName,
    tableNumber,
    activeShift,
    paymentMethod,
    cashPaidAmount,
    visaPaidAmount,
    customerCashTendered,
    changeReturned,
    drawerVariance,
    actor,
  } = params;

  const openOrders = orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
  if (openOrders.length === 0) return;

  const groupTotal = openOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const safeShiftId = activeShift?.status === 'active' ? activeShift.id : '';

  try {
    // Keep batches <= 4 writes per batch to respect Firestore rules 20-read limit safely
    for (let i = 0; i < openOrders.length; i += 3) {
      const chunk = openOrders.slice(i, i + 3);
      const batch = writeBatch(db);
      chunk.forEach((order, chunkIdx) => {
        const isFirst = i === 0 && chunkIdx === 0;
        const ratio = groupTotal > 0 ? (Number(order.total) || 0) / groupTotal : 1 / openOrders.length;
        const orderCash =
          openOrders.length === 1
            ? cashPaidAmount
            : Number((cashPaidAmount * ratio).toFixed(2));
        const orderVisa =
          openOrders.length === 1
            ? visaPaidAmount
            : Number((visaPaidAmount * ratio).toFixed(2));

        batch.update(doc(db, 'orders', order.id), {
          status: 'completed',
          ...(safeShiftId ? { shiftId: safeShiftId } : {}),
          paymentMethod,
          cashPaidAmount: orderCash,
          visaPaidAmount: orderVisa,
          customerCashTendered: isFirst ? Number(customerCashTendered.toFixed(2)) : 0,
          changeReturned: isFirst ? Number(changeReturned.toFixed(2)) : 0,
          drawerVariance: isFirst ? Number(drawerVariance.toFixed(2)) : 0,
          closedAt: serverTimestamp(),
          lastUpdatedByUid: actor.uid,
          lastUpdatedByName: actor.name.slice(0, 100),
          lastUpdatedByRole: actor.role,
          closedByUid: actor.uid,
          closedByName: actor.name.slice(0, 100),
          closedByRole: actor.role,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }

    if (sessionId?.trim()) {
      await updateDoc(doc(db, 'restaurants', restaurantId, 'table_sessions', sessionId.trim()), {
        status: 'closed',
        items: [],
        guests: [],
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }

    // Resolve open bill service calls for this table so alert clears
    if (tableNumber?.trim()) {
      try {
        const callsSnap = await getDocs(
          query(
            collection(db, 'service_calls'),
            where('restaurantId', '==', restaurantId),
            where('tableNumber', '==', tableNumber.trim())
          )
        );
        const pendingCalls = callsSnap.docs.filter((d) => d.data().status !== 'resolved');
        if (pendingCalls.length > 0) {
          const callBatch = writeBatch(db);
          pendingCalls.slice(0, 4).forEach((d) => {
            callBatch.update(d.ref, {
              status: 'resolved',
              handledByUid: actor.uid,
              handledByName: actor.name.slice(0, 100),
              handledByRole: actor.role,
              updatedAt: serverTimestamp(),
            });
          });
          await callBatch.commit();
        }
      } catch {
        // Non-fatal
      }
    }

    if (activeShift && activeShift.status === 'active') {
      const nextCashSales = Number(((activeShift.cashSales || 0) + cashPaidAmount).toFixed(2));
      const nextVisaSales = Number(((activeShift.visaSales || 0) + visaPaidAmount).toFixed(2));
      const nextVarianceTotal = Number(((activeShift.drawerVarianceTotal || 0) + drawerVariance).toFixed(2));
      const nextExpected = Number(
        (
          (activeShift.openingFloat || 0) +
          (activeShift.carriedOverCash || 0) +
          nextCashSales +
          nextVarianceTotal -
          (activeShift.drawerExpensesTotal || 0)
        ).toFixed(2)
      );
      await updateDoc(doc(db, 'restaurants', restaurantId, 'staff_shifts', activeShift.id), {
        ordersHandled: (activeShift.ordersHandled || 0) + openOrders.length,
        cashSales: nextCashSales,
        visaSales: nextVisaSales,
        drawerVarianceTotal: nextVarianceTotal,
        expectedCashHandover: nextExpected,
        updatedAt: serverTimestamp(),
      });
    }

    const logId = makeOpId('slog');
    await setDoc(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId,
      ownerId,
      eventType: 'table_closed' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      targetUid: openOrders[0].id,
      targetName: tableNumber ? `طاولة ${tableNumber}` : openOrders[0].orderNumber,
      screen: 'cashier',
      details: `إقفال فاتورة ${hallName ? `${hallName} - ` : ''}${tableNumber ? `طاولة ${tableNumber}` : openOrders[0].orderNumber} (${paymentMethod}: كاش ${cashPaidAmount} / فيزا ${visaPaidAmount}${drawerVariance ? ` / فرق درج ${drawerVariance > 0 ? `+${drawerVariance}` : drawerVariance}` : ''})`,
      createdAt: serverTimestamp(),
    }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${openOrders[0].id}`);
  }
}

export async function modifyOrderWithAudit(params: {
  order: Order;
  restaurant: Restaurant;
  updates: {
    items?: OrderItemPayload[];
    manualDiscountAmount?: number;
    manualDiscountPercent?: number;
    manualDiscountReason?: string;
    notes?: string;
    tableNotes?: string;
    cancelOrder?: boolean;
    cancelReason?: string;
  };
  reason: string;
  actor: StaffActorInfo;
}): Promise<void> {
  const { order, restaurant, updates, reason, actor } = params;
  const cleanReason = reason.trim().slice(0, 300);
  if (!cleanReason) {
    throw new Error('يجب كتابة سبب التعديل أو الإلغاء.');
  }

  const nextItems = (updates.items ?? order.items).filter((it) => it.quantity > 0);
  if (!updates.cancelOrder && nextItems.length === 0) {
    throw new Error('لا يمكن إفراغ الطلب بالكامل بدون إلغاء الطلب.');
  }

  const nextSubtotal = Number(
    nextItems.reduce((sum, it) => sum + Number(it.lineTotal || it.unitPrice * it.quantity), 0).toFixed(2)
  );
  const serviceRate = Number(restaurant.serviceCharge || 0);
  const taxRate = Number(restaurant.taxRate || 0);
  const promoDiscount = Number(order.discountAmount || 0);
  const deliveryFee = order.orderType === 'delivery' ? Number(order.deliveryFee || 0) : 0;

  let manualDiscountAmt = Number(updates.manualDiscountAmount ?? order.manualDiscountAmount ?? 0);
  const manualDiscountPct = Number(updates.manualDiscountPercent ?? order.manualDiscountPercent ?? 0);
  if (updates.manualDiscountPercent !== undefined && updates.manualDiscountPercent > 0) {
    manualDiscountAmt = Number(((nextSubtotal * Math.min(100, manualDiscountPct)) / 100).toFixed(2));
  }
  manualDiscountAmt = Math.max(0, Math.min(nextSubtotal, Number(manualDiscountAmt.toFixed(2))));

  const discountedBase = Math.max(0, nextSubtotal - promoDiscount - manualDiscountAmt);
  const nextService =
    order.orderType === 'dine_in' ? Number(((discountedBase * serviceRate) / 100).toFixed(2)) : 0;
  const nextTax = Number((((discountedBase + nextService) * taxRate) / 100).toFixed(2));
  const nextTotal = Number(Math.max(0, discountedBase + nextService + nextTax + deliveryFee).toFixed(2));

  const actionType: OrderAdjustmentEntry['action'] = updates.cancelOrder
    ? 'order_cancelled'
    : updates.manualDiscountAmount !== undefined || updates.manualDiscountPercent !== undefined
    ? 'discount_applied'
    : updates.items
    ? 'items_modified'
    : 'notes_updated';

  const nextHistory: OrderAdjustmentEntry[] = [
    ...(order.adjustmentHistory || []).slice(-48),
    {
      at: Date.now(),
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      action: actionType,
      reason: cleanReason,
      details: updates.cancelOrder
        ? `إلغاء الطلب: ${cleanReason}`
        : `الإجمالي بعد التعديل: ${nextTotal}`,
    },
  ];

  const payload: Record<string, unknown> = {
    items: nextItems.length > 0 ? nextItems : order.items,
    subtotal: nextSubtotal,
    serviceCharge: nextService,
    deliveryFee,
    discountAmount: promoDiscount,
    manualDiscountAmount: manualDiscountAmt,
    manualDiscountPercent: Math.max(0, Math.min(100, manualDiscountPct)),
    manualDiscountReason: (updates.manualDiscountReason ?? order.manualDiscountReason ?? cleanReason).slice(0, 300),
    taxAmount: nextTax,
    total: nextTotal,
    notes: (updates.notes ?? order.notes ?? '').slice(0, 400),
    tableNotes: (updates.tableNotes ?? order.tableNotes ?? '').slice(0, 400),
    adjustmentHistory: nextHistory,
    lastUpdatedByUid: actor.uid,
    lastUpdatedByName: actor.name.slice(0, 100),
    lastUpdatedByRole: actor.role,
    updatedAt: serverTimestamp(),
  };

  if (updates.cancelOrder) {
    payload.status = 'cancelled';
    payload.cancelReason = (updates.cancelReason || cleanReason).slice(0, 300);
    payload.closedAt = serverTimestamp();
    payload.closedByUid = actor.uid;
    payload.closedByName = actor.name.slice(0, 100);
    payload.closedByRole = actor.role;
  }

  try {
    await updateDoc(doc(db, 'orders', order.id), payload);
    const eventType: StaffAuditEventType = updates.cancelOrder
      ? 'order_cancelled'
      : actionType === 'discount_applied'
      ? 'instant_discount_applied'
      : 'order_modified';

    const logId = makeOpId('slog');
    await setDoc(doc(db, 'restaurants', restaurant.id, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      eventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      targetUid: order.id,
      targetName: order.orderNumber,
      screen: 'cashier',
      details: `${updates.cancelOrder ? 'إلغاء' : 'تعديل'} الطلب ${order.orderNumber} (${order.tableNumber ? `طاولة ${order.tableNumber}` : order.customerName}) — السبب: ${cleanReason}`,
      createdAt: serverTimestamp(),
    }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
  }
}

export async function closeCashierShiftWithHandover(params: {
  restaurant: Restaurant;
  shift: StaffShift;
  recipientType: 'cashier' | 'manager' | 'owner' | 'self_next_slot';
  recipientUid?: string;
  recipientName: string;
  openTables: string[];
  note?: string;
  actor: StaffActorInfo;
  nextSlot?: ShiftSlotConfig;
}): Promise<{ newShift?: StaffShift; expectedCashHandover: number }> {
  const { restaurant, shift, recipientType, recipientUid, recipientName, openTables, note, actor, nextSlot } = params;
  if (shift.status !== 'active') throw new Error('الوردية مغلقة بالفعل.');

  const cleanRecipientName = recipientName.trim().slice(0, 100);
  if (!cleanRecipientName) throw new Error('يرجى تحديد اسم مستلم العهدة والكاش.');

  const expectedCashHandover = Number(
    (
      (shift.openingFloat || 0) +
      (shift.carriedOverCash || 0) +
      (shift.cashSales || 0) +
      (shift.drawerVarianceTotal || 0) -
      (shift.drawerExpensesTotal || 0)
    ).toFixed(2)
  );
  const visaTotal = Number((shift.visaSales || 0).toFixed(2));

  const handoverStatus: HandoverStatus =
    recipientType === 'self_next_slot'
      ? 'self_continued'
      : recipientType === 'manager'
      ? 'handed_to_manager'
      : recipientType === 'owner'
      ? 'handed_to_owner'
      : 'handed_to_cashier';

  const handedRole: 'cashier' | 'manager' | 'owner' =
    recipientType === 'manager'
      ? 'manager'
      : recipientType === 'owner'
      ? 'owner'
      : 'cashier';

  const currentTreasury = getResolvedTreasuryState(restaurant);
  const nextTreasury: TreasuryState = {
    managerCustodyBalance:
      recipientType === 'manager'
        ? Number((currentTreasury.managerCustodyBalance + expectedCashHandover).toFixed(2))
        : currentTreasury.managerCustodyBalance,
    ownerVaultCashBalance:
      recipientType === 'owner'
        ? Number((currentTreasury.ownerVaultCashBalance + expectedCashHandover).toFixed(2))
        : currentTreasury.ownerVaultCashBalance,
    ownerVaultVisaTotal: Number((currentTreasury.ownerVaultVisaTotal + visaTotal).toFixed(2)),
    lastUpdatedByUid: actor.uid,
    lastUpdatedByName: actor.name.slice(0, 100),
    updatedAt: Date.now(),
  };

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'restaurants', restaurant.id, 'staff_shifts', shift.id), {
      status: 'completed',
      endedAt: serverTimestamp(),
      cashSales: Number((shift.cashSales || 0).toFixed(2)),
      visaSales: visaTotal,
      drawerExpensesTotal: Number((shift.drawerExpensesTotal || 0).toFixed(2)),
      drawerVarianceTotal: Number((shift.drawerVarianceTotal || 0).toFixed(2)),
      expectedCashHandover,
      handedOverToUid: (recipientUid || '').slice(0, 128),
      handedOverToName: cleanRecipientName,
      handedOverToRole: handedRole,
      handoverNote: (note || '').trim().slice(0, 300),
      handoverOpenTables: openTables.slice(0, 100),
      handoverStatus,
      updatedAt: serverTimestamp(),
    });

    if (recipientType === 'manager' || recipientType === 'owner' || visaTotal > 0) {
      batch.update(doc(db, 'restaurants', restaurant.id), {
        treasuryState: nextTreasury,
        updatedAt: serverTimestamp(),
      });
    }

    const transferId = makeOpId('trn');
    batch.set(doc(db, 'restaurants', restaurant.id, 'treasury_transfers', transferId), {
      id: transferId,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      fromType: 'cashier_shift',
      toType:
        recipientType === 'manager'
          ? 'manager_custody'
          : recipientType === 'owner'
          ? 'owner_vault'
          : 'cashier_shift',
      fromUid: actor.uid,
      fromName: actor.name.slice(0, 100),
      ...(recipientUid ? { toUid: recipientUid.slice(0, 128) } : {}),
      toName: cleanRecipientName,
      shiftId: shift.id,
      amountCash: expectedCashHandover,
      amountVisa: visaTotal,
      ...(note?.trim() ? { note: note.trim().slice(0, 300) } : {}),
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    const logId = makeOpId('slog');
    await setDoc(doc(db, 'restaurants', restaurant.id, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      eventType: 'cash_handover_recorded' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      screen: 'cashier',
      details: `تسليم وردية الكاشير (${shift.shiftSlotName || 'الوردية'}) إلى ${cleanRecipientName} — كاش الدرج: ${expectedCashHandover} | فيزا: ${visaTotal}${openTables.length ? ` | ترابيزات مفتوحة: ${openTables.join('، ')}` : ''}`,
      createdAt: serverTimestamp(),
    }).catch(() => {});

    let newShift: StaffShift | undefined;
    if (recipientType === 'self_next_slot') {
      const cfg = getResolvedOperationsConfig(restaurant);
      const targetSlot = nextSlot || getNextShiftSlot(cfg, shift.shiftSlotId);
      newShift = await startStaffShift({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        staffId: actor.uid,
        staffName: actor.name,
        staffRole: actor.role,
        stationId: 'cashier',
        stationName: 'الكاشير',
        shiftSlotId: targetSlot.id,
        shiftSlotName: targetSlot.name,
        openingFloat: 0,
        carriedOverCash: expectedCashHandover,
        carriedFromShiftId: shift.id,
      });
    }

    return { newShift, expectedCashHandover };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `restaurants/${restaurant.id}/staff_shifts/${shift.id}`);
  }
}

export async function startCashierShiftWithCarryover(params: {
  restaurant: Restaurant;
  actor: StaffActorInfo;
  shiftSlot: ShiftSlotConfig;
  openingFloat: number;
  carriedOverCash: number;
  carriedFromShiftId?: string;
  takeFromManagerCustody?: number;
}): Promise<StaffShift> {
  const { restaurant, actor, shiftSlot, openingFloat, carriedOverCash, carriedFromShiftId, takeFromManagerCustody = 0 } = params;
  const shift = await startStaffShift({
    restaurantId: restaurant.id,
    ownerId: restaurant.ownerId,
    staffId: actor.uid,
    staffName: actor.name,
    staffRole: actor.role,
    stationId: 'cashier',
    stationName: 'الكاشير',
    shiftSlotId: shiftSlot.id,
    shiftSlotName: shiftSlot.name,
    openingFloat,
    carriedOverCash,
    carriedFromShiftId,
  });

  if (takeFromManagerCustody > 0) {
    try {
      const current = getResolvedTreasuryState(restaurant);
      const nextBalance = Number(Math.max(0, current.managerCustodyBalance - takeFromManagerCustody).toFixed(2));
      const transferId = makeOpId('trn');
      const batch = writeBatch(db);
      batch.update(doc(db, 'restaurants', restaurant.id), {
        treasuryState: {
          ...current,
          managerCustodyBalance: nextBalance,
          lastUpdatedByUid: actor.uid,
          lastUpdatedByName: actor.name.slice(0, 100),
          updatedAt: Date.now(),
        },
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'restaurants', restaurant.id, 'treasury_transfers', transferId), {
        id: transferId,
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        fromType: 'manager_custody',
        toType: 'cashier_shift',
        fromUid: actor.uid,
        fromName: 'عهدة المدير',
        toUid: actor.uid,
        toName: actor.name.slice(0, 100),
        shiftId: shift.id,
        amountCash: Number(takeFromManagerCustody.toFixed(2)),
        note: `تسليم رصيد مرحّل لبداية وردية ${shiftSlot.name}`,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    } catch {
      // Non-fatal custody sync
    }
  }

  return shift;
}

export async function transferManagerCustodyToOwnerVault(params: {
  restaurant: Restaurant;
  amountCash: number;
  note?: string;
  actor: StaffActorInfo;
}): Promise<void> {
  const { restaurant, note, actor } = params;
  const amountCash = Number(Number(params.amountCash || 0).toFixed(2));
  const current = getResolvedTreasuryState(restaurant);
  if (amountCash <= 0 || amountCash > current.managerCustodyBalance + 0.01) {
    throw new Error('المبلغ غير صالح أو يتجاوز رصيد عهدة المدير الحالي.');
  }

  const nextTreasury: TreasuryState = {
    managerCustodyBalance: Number(Math.max(0, current.managerCustodyBalance - amountCash).toFixed(2)),
    ownerVaultCashBalance: Number((current.ownerVaultCashBalance + amountCash).toFixed(2)),
    ownerVaultVisaTotal: current.ownerVaultVisaTotal,
    lastUpdatedByUid: actor.uid,
    lastUpdatedByName: actor.name.slice(0, 100),
    updatedAt: Date.now(),
  };

  try {
    const transferId = makeOpId('trn');
    const batch = writeBatch(db);
    batch.update(doc(db, 'restaurants', restaurant.id), {
      treasuryState: nextTreasury,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'restaurants', restaurant.id, 'treasury_transfers', transferId), {
      id: transferId,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      fromType: 'manager_custody',
      toType: 'owner_vault',
      fromUid: actor.uid,
      fromName: actor.name.slice(0, 100),
      toUid: restaurant.ownerId,
      toName: 'الخزنة الرئيسية لصاحب المطعم',
      amountCash,
      ...(note?.trim() ? { note: note.trim().slice(0, 300) } : {}),
      createdAt: serverTimestamp(),
    });
    await batch.commit();

    const logId = makeOpId('slog');
    await setDoc(doc(db, 'restaurants', restaurant.id, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      eventType: 'treasury_transferred' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      screen: 'cashier',
      details: `تحويل ${amountCash} ${restaurant.currency} من عهدة المدير إلى الخزنة الرئيسية لصاحب المطعم`,
      createdAt: serverTimestamp(),
    }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `restaurants/${restaurant.id}`);
  }
}

export async function adjustActiveCashierFloat(params: {
  restaurant: Restaurant;
  shift: StaffShift;
  newOpeningFloat: number;
  actor: StaffActorInfo;
}): Promise<void> {
  const { restaurant, shift, newOpeningFloat, actor } = params;
  if (shift.status !== 'active') throw new Error('الوردية مغلقة ولا يمكن تعديل العهدة عليها.');
  const safeFloat = Math.max(0, Number(Number(newOpeningFloat).toFixed(2)));
  try {
    await updateDoc(doc(db, 'restaurants', restaurant.id, 'staff_shifts', shift.id), {
      openingFloat: safeFloat,
      updatedAt: serverTimestamp(),
    });
    const logId = makeOpId('slog');
    await setDoc(doc(db, 'restaurants', restaurant.id, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      eventType: 'float_adjusted' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      targetUid: shift.staffId,
      targetName: shift.staffName,
      screen: 'cashier',
      details: `تعديل عهدة درج الكاشير إلى ${safeFloat} ${restaurant.currency}`,
      createdAt: serverTimestamp(),
    }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `restaurants/${restaurant.id}/staff_shifts/${shift.id}`);
  }
}

export async function extendActiveShiftDuration(params: {
  restaurantId: string;
  shift: StaffShift;
  extraHours: number;
}): Promise<void> {
  const { restaurantId, shift, extraHours } = params;
  if (shift.status !== 'active') return;
  const nextExtra = Math.min(24, (shift.extendedHours || 0) + Math.max(0.5, extraHours));
  await updateDoc(doc(db, 'restaurants', restaurantId, 'staff_shifts', shift.id), {
    extendedHours: nextExtra,
    updatedAt: serverTimestamp(),
  });
}

export async function updateRestaurantOperationsConfig(params: {
  restaurantId: string;
  ownerId: string;
  config: OperationsConfig;
  actor?: StaffActorInfo;
}): Promise<void> {
  const { restaurantId, config } = params;
  try {
    await updateDoc(doc(db, 'restaurants', restaurantId), {
      operationsConfig: config,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `restaurants/${restaurantId}`);
  }
}

export async function superAdminUnlockShiftAndOrders(params: {
  restaurantId: string;
  shift: StaffShift;
  superAdminActor: StaffActorInfo;
}): Promise<void> {
  const { restaurantId, shift, superAdminActor } = params;
  try {
    await updateDoc(doc(db, 'restaurants', restaurantId, 'staff_shifts', shift.id), {
      status: 'active',
      superAdminUnlocked: true,
      updatedAt: serverTimestamp(),
    });

    // Also mark orders belonging to this shift as superAdminUnlocked so audit trail stays explicit
    const ordersSnap = await getDocs(
      query(
        collection(db, 'orders'),
        where('restaurantId', '==', restaurantId),
        where('shiftId', '==', shift.id)
      )
    );
    const docs = ordersSnap.docs;
    for (let i = 0; i < docs.length; i += 4) {
      const chunk = docs.slice(i, i + 4);
      const batch = writeBatch(db);
      chunk.forEach((d) => {
        batch.update(d.ref, {
          superAdminUnlocked: true,
          superAdminUnlockedBy: superAdminActor.uid,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }

    const logId = makeOpId('slog');
    await setDoc(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId,
      ownerId: shift.ownerId,
      eventType: 'superadmin_shift_unlocked' satisfies StaffAuditEventType,
      actorUid: superAdminActor.uid,
      actorName: superAdminActor.name.slice(0, 100),
      actorRole: 'superadmin',
      targetUid: shift.id,
      targetName: `${shift.staffName} (${shift.stationName})`,
      details: `فتح استثنائي للوردية المغلقة بواسطة السوبر أدمن (${superAdminActor.name})`,
      createdAt: serverTimestamp(),
    }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `restaurants/${restaurantId}/staff_shifts/${shift.id}`);
  }
}

export async function adjustOwnerVaultBalance(params: {
  restaurant: Restaurant;
  deltaCash: number;
  note: string;
  actor: StaffActorInfo;
}): Promise<void> {
  const { restaurant, deltaCash, note, actor } = params;
  const current = getResolvedTreasuryState(restaurant);
  const nextCash = Number(Math.max(0, current.ownerVaultCashBalance + deltaCash).toFixed(2));
  const transferId = makeOpId('trn');
  const batch = writeBatch(db);
  batch.update(doc(db, 'restaurants', restaurant.id), {
    treasuryState: {
      ...current,
      ownerVaultCashBalance: nextCash,
      lastUpdatedByUid: actor.uid,
      lastUpdatedByName: actor.name.slice(0, 100),
      updatedAt: Date.now(),
    },
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'restaurants', restaurant.id, 'treasury_transfers', transferId), {
    id: transferId,
    restaurantId: restaurant.id,
    ownerId: restaurant.ownerId,
    fromType: 'owner_adjustment',
    toType: 'owner_vault',
    fromUid: actor.uid,
    fromName: actor.name.slice(0, 100),
    toUid: restaurant.ownerId,
    toName: 'الخزنة الرئيسية لصاحب المطعم',
    amountCash: Number(deltaCash.toFixed(2)),
    note: note.trim().slice(0, 300) || 'تعديل رصيد الخزنة الرئيسية',
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function recalculateShiftAfterSuperAdminEdit(
  restaurantId: string,
  shiftId: string
): Promise<void> {
  const shiftSnap = await getDoc(doc(db, 'restaurants', restaurantId, 'staff_shifts', shiftId));
  if (!shiftSnap.exists()) return;
  const shift = shiftSnap.data() as StaffShift;
  const ordersSnap = await getDocs(
    query(
      collection(db, 'orders'),
      where('restaurantId', '==', restaurantId),
      where('shiftId', '==', shiftId)
    )
  );
  let cashSales = 0;
  let visaSales = 0;
  let variance = 0;
  ordersSnap.docs.forEach((d) => {
    const o = d.data() as Order;
    if (o.status === 'completed') {
      cashSales += Number(o.cashPaidAmount ?? (o.paymentMethod === 'visa' ? 0 : o.total) ?? 0);
      visaSales += Number(o.visaPaidAmount ?? (o.paymentMethod === 'visa' ? o.total : 0) ?? 0);
      variance += Number(o.drawerVariance || 0);
    }
  });
  const expected =
    (shift.openingFloat || 0) +
    (shift.carriedOverCash || 0) +
    cashSales +
    variance -
    (shift.drawerExpensesTotal || 0);
  await updateDoc(doc(db, 'restaurants', restaurantId, 'staff_shifts', shiftId), {
    cashSales: Number(cashSales.toFixed(2)),
    visaSales: Number(visaSales.toFixed(2)),
    drawerVarianceTotal: Number(variance.toFixed(2)),
    expectedCashHandover: Number(expected.toFixed(2)),
    updatedAt: serverTimestamp(),
  });
}

// Re-export increment for convenience
export { increment };
