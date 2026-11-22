import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  Banknote,
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  Clock,
  CreditCard,
  Edit3,
  Lock,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Percent,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Scissors,
  Trash2,
  Users,
  Utensils,
  Volume2,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useScreenUi } from '../../contexts/PlatformUiContext';
import { showOperationalNotification } from '../../lib/fcmNotificationService';
import {
  subscribeCategories,
  subscribeMenuItems,
  subscribeOwnerOrders,
  subscribeOwnerServiceCalls,
  updateOrderItemProgress,
  updateOrderStatus,
  updateServiceCallStatus,
} from '../../lib/firestoreService';
import {
  addDrawerExpense,
  adjustActiveCashierFloat,
  calculateCashSettlementAndVariance,
  closeCashierShiftWithHandover,
  getNextShiftSlot,
  getResolvedOperationsConfig,
  getTimestampMillis,
  modifyOrderWithAudit,
  settleOrdersCheck,
  subscribeAllRestaurantShifts,
  subscribeDrawerExpenses,
} from '../../lib/operationsService';
import { playOrderAlertChime, unlockAudioContext } from '../../lib/sound';
import { subscribeRestaurantStations } from '../../lib/stationsService';
import {
  buildEffectiveStations,
  cleanStationId,
  getStationIconComponent,
  resolveOrderItemStation,
  screenToStationId,
  STATION_META_MAP,
  StationMeta,
} from '../../lib/stationUtils';
import {
  buildStationTicketJob,
  getActivePrinterConnection,
  getSavedPrinterProfile,
  printThermalJobsSequentially,
  tryAutoReconnectSavedPrinter,
} from '../../lib/thermalPrinterService';
import {
  Category,
  DrawerExpense,
  ItemPrepState,
  MenuItem,
  Order,
  OrderItemPayload,
  OrderPaymentMethod,
  OrderStatus,
  PrepStation,
  Restaurant,
  RestaurantStation,
  ServiceCall,
  ServiceCallStatus,
  ServiceCallType,
  StaffActorInfo,
  StaffMember,
  StaffShift,
} from '../../types/menu';
import { SplitCheckPrintModal } from './SplitCheckPrintModal';
import { ThermalPrinterSettingsModal } from './ThermalPrinterSettingsModal';

type StationView = 'cashier' | PrepStation;

function normalizeStationView(raw?: string): StationView | undefined {
  if (!raw) return undefined;
  if (raw === 'cashier') return 'cashier';
  const extracted = screenToStationId(raw);
  return extracted || cleanStationId(raw);
}

interface LiveOrdersTabProps {
  restaurant: Restaurant;
  allowedStations?: StationView[];
  initialStation?: StationView;
  staffMode?: boolean;
  actor?: StaffActorInfo;
  activeCashierShift?: StaffShift | null;
  allShifts?: StaffShift[];
  staffList?: StaffMember[];
  expenses?: DrawerExpense[];
  supervisoryMode?: boolean;
  coveringStaffName?: string;
  hideHistoryArchive?: boolean;
  openHandoverSignal?: number;
}

interface AggregatedGuestCheck {
  guestName: string;
  itemsCount: number;
  subtotal: number;
  serviceCharge: number;
  taxAmount: number;
  total: number;
}

interface TableMasterGroup {
  groupKey: string;
  hallName: string;
  tableNumber: string;
  sessionId?: string;
  orders: Order[];
  orderIds: string[];
  orderNumbers: string[];
  guestsBreakdown: AggregatedGuestCheck[];
  subtotal: number;
  serviceCharge: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
}

type SettleTarget =
  | { type: 'table'; group: TableMasterGroup }
  | { type: 'order'; order: Order };

export function LiveOrdersTab({
  restaurant,
  allowedStations,
  initialStation,
  staffMode = false,
  actor,
  activeCashierShift,
  allShifts,
  staffList = [],
  expenses,
  supervisoryMode = false,
  coveringStaffName,
  hideHistoryArchive = false,
  openHandoverSignal = 0,
}: LiveOrdersTabProps) {
  const { lang, dir, t, loc, formatCurrency } = useLanguage();
  const isEn = lang === 'en';
  const currencyLabel = formatCurrency(restaurant.currency);

  const opsConfig = useMemo(() => getResolvedOperationsConfig(restaurant), [restaurant]);
  const isOwnerActor = !actor || actor.role === 'owner';
  const isManagerActor = actor?.role === 'manager';
  const managerPerms = opsConfig.managerPermissions;

  const canEditOpenOrders = isOwnerActor || (isManagerActor && managerPerms.canEditOpenOrders);
  const canCancelOpenOrders = isOwnerActor || (isManagerActor && managerPerms.canCancelOpenOrders);
  const canApplyInstantDiscount = isOwnerActor || (isManagerActor && managerPerms.canApplyInstantDiscount);
  const canEditClosedChecks = isOwnerActor || (isManagerActor && managerPerms.canEditClosedChecks);
  const canEditDrawerFloat = isOwnerActor || (isManagerActor && managerPerms.canEditDrawerFloat);

  const effectiveActor: StaffActorInfo = useMemo(
    () =>
      actor || {
        uid: restaurant.ownerId,
        name: restaurant.name,
        role: 'owner',
      },
    [actor, restaurant.name, restaurant.ownerId]
  );

  const [orders, setOrders] = useState<Order[]>([]);
  const [serviceCalls, setServiceCalls] = useState<ServiceCall[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [dynamicStations, setDynamicStations] = useState<RestaurantStation[]>([]);
  const [internalShifts, setInternalShifts] = useState<StaffShift[]>([]);
  const [internalExpenses, setInternalExpenses] = useState<DrawerExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const effectiveShifts = allShifts ?? internalShifts;
  const effectiveExpenses = expenses ?? internalExpenses;
  const effectiveActiveCashierShift = useMemo(
    () =>
      activeCashierShift !== undefined
        ? activeCashierShift
        : effectiveShifts.find((s) => s.status === 'active' && s.stationId === 'cashier') || null,
    [activeCashierShift, effectiveShifts]
  );

  const shiftById = useMemo(
    () => new Map(effectiveShifts.map((s) => [s.id, s])),
    [effectiveShifts]
  );

  const isOrderShiftLocked = (order: Order): boolean => {
    if (!order.shiftId) return false;
    const sh = shiftById.get(order.shiftId);
    if (!sh) return false;
    return sh.status === 'completed' && !order.superAdminUnlocked;
  };

  const normalizedAllowedStations = useMemo(() => {
    if (!allowedStations || allowedStations.length === 0) return undefined;
    return Array.from(
      new Set(
        allowedStations
          .map((s) => normalizeStationView(s))
          .filter((s): s is StationView => Boolean(s))
      )
    );
  }, [allowedStations]);

  const normalizedInitialStation = useMemo(
    () => normalizeStationView(initialStation),
    [initialStation]
  );

  const [activeStation, setActiveStation] = useState<StationView>(() => {
    if (
      normalizedInitialStation &&
      (!normalizedAllowedStations || normalizedAllowedStations.includes(normalizedInitialStation))
    ) {
      return normalizedInitialStation;
    }
    return normalizedAllowedStations?.[0] || 'cashier';
  });
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');
  const [kdsShowCompletedItems, setKdsShowCompletedItems] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updatingItemKey, setUpdatingItemKey] = useState<string | null>(null);
  const [updatingCallId, setUpdatingCallId] = useState<string | null>(null);
  const [receiptModalTable, setReceiptModalTable] = useState<TableMasterGroup | null>(null);
  const [receiptModalOrder, setReceiptModalOrder] = useState<Order | null>(null);

  // Settlement modal state
  const [settleTarget, setSettleTarget] = useState<SettleTarget | null>(null);
  const [settleMethod, setSettleMethod] = useState<OrderPaymentMethod>('cash');
  const [settleVisaAmount, setSettleVisaAmount] = useState<string>('0');
  const [settleCashTendered, setSettleCashTendered] = useState<string>('');
  const [autoRoundCoinless, setAutoRoundCoinless] = useState<boolean>(true);
  const [settlingBusy, setSettlingBusy] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  // Drawer & Handover modal state
  const [drawerModalOpen, setDrawerModalOpen] = useState(false);
  const [expenseAmountInput, setExpenseAmountInput] = useState('');
  const [expenseDescInput, setExpenseDescInput] = useState('');
  const [expenseNoteInput, setExpenseNoteInput] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);
  const [editingFloatOpen, setEditingFloatOpen] = useState(false);
  const [floatInput, setFloatInput] = useState('');
  const [savingFloat, setSavingFloat] = useState(false);
  const [handoverRecipientType, setHandoverRecipientType] = useState<
    'cashier' | 'manager' | 'owner' | 'self_next_slot'
  >('cashier');
  const [handoverRecipientUid, setHandoverRecipientUid] = useState('');
  const [handoverCustomName, setHandoverCustomName] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [closingHandover, setClosingHandover] = useState(false);
  const [drawerFeedback, setDrawerFeedback] = useState<string | null>(null);

  // Order Modify / Instant Discount / Cancel modal state
  const [modifyTargetOrder, setModifyTargetOrder] = useState<Order | null>(null);
  const [modifyItems, setModifyItems] = useState<OrderItemPayload[]>([]);
  const [modifyDiscountMode, setModifyDiscountMode] = useState<'none' | 'amount' | 'percent'>('none');
  const [modifyDiscountValue, setModifyDiscountValue] = useState('');
  const [modifyDiscountReason, setModifyDiscountReason] = useState('');
  const [modifyOrderNotes, setModifyOrderNotes] = useState('');
  const [modifyTableNotes, setModifyTableNotes] = useState('');
  const [modifyAuditReason, setModifyAuditReason] = useState('');
  const [modifyBusy, setModifyBusy] = useState(false);
  const [modifyError, setModifyError] = useState<string | null>(null);

  // Thermal printer + Split Check state
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [printerStatusLabel, setPrinterStatusLabel] = useState<string>(() => {
    const conn = getActivePrinterConnection();
    if (conn.connected && conn.name) return conn.name;
    return getSavedPrinterProfile()?.name || '';
  });
  const [splitCheckOrder, setSplitCheckOrder] = useState<Order | null>(null);
  const [printingKdsOrderId, setPrintingKdsOrderId] = useState<string | null>(null);
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const callsInitializedRef = useRef(false);
  const knownCallIdsRef = useRef<Set<string>>(new Set());

  const statusMeta: Record<OrderStatus, { label: string; colorClass: string }> = {
    pending: {
      label: t.admin.orders.statusPending,
      colorClass: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    preparing: {
      label: t.admin.orders.statusPreparing,
      colorClass: 'text-blue-700 bg-blue-50 border-blue-200',
    },
    completed: {
      label: t.admin.orders.statusCompleted,
      colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    cancelled: {
      label: t.admin.orders.statusCancelled,
      colorClass: 'text-red-700 bg-red-50 border-red-200',
    },
  };

  useEffect(() => {
    const unlock = () => unlockAudioContext();
    window.addEventListener('pointerdown', unlock, { once: true });
    void tryAutoReconnectSavedPrinter().then((ok) => {
      if (ok) {
        const conn = getActivePrinterConnection();
        if (conn.name) setPrinterStatusLabel(conn.name);
      }
    });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    const unsubCats = subscribeCategories(restaurant.id, setCategories);
    const unsubItems = subscribeMenuItems(restaurant.id, setMenuItems);
    const unsubStations = subscribeRestaurantStations(restaurant.id, setDynamicStations);
    const unsubShifts = allShifts
      ? () => {}
      : subscribeAllRestaurantShifts(restaurant.id, setInternalShifts, () => {});
    const unsubExpenses = expenses
      ? () => {}
      : subscribeDrawerExpenses(restaurant.id, setInternalExpenses, () => {});
    return () => {
      unsubCats();
      unsubItems();
      unsubStations();
      unsubShifts();
      unsubExpenses();
    };
  }, [restaurant.id, allShifts, expenses]);

  useEffect(() => {
    if (openHandoverSignal > 0) {
      setDrawerFeedback(null);
      setDrawerModalOpen(true);
    }
  }, [openHandoverSignal]);

  useEffect(() => {
    if (
      normalizedInitialStation &&
      (!normalizedAllowedStations || normalizedAllowedStations.includes(normalizedInitialStation))
    ) {
      setActiveStation(normalizedInitialStation);
    } else if (
      normalizedAllowedStations &&
      normalizedAllowedStations.length > 0 &&
      !normalizedAllowedStations.includes(activeStation)
    ) {
      setActiveStation(normalizedAllowedStations[0]);
    }
  }, [normalizedInitialStation, normalizedAllowedStations, activeStation]);

  const canReadServiceCalls =
    !normalizedAllowedStations || normalizedAllowedStations.includes('cashier');

  useEffect(() => {
    initializedRef.current = false;
    knownIdsRef.current = new Set();
    setLoading(true);
    setLoadError(null);

    const unsub = subscribeOwnerOrders(
      restaurant.id,
      restaurant.ownerId,
      (incoming) => {
        if (!initializedRef.current) {
          incoming.forEach((o) => knownIdsRef.current.add(o.id));
          initializedRef.current = true;
        } else {
          const newPendingOrders: Order[] = [];
          incoming.forEach((o) => {
            if (!knownIdsRef.current.has(o.id)) {
              knownIdsRef.current.add(o.id);
              if (o.status === 'pending') newPendingOrders.push(o);
            }
          });
          if (newPendingOrders.length > 0) {
            if (soundEnabled) {
              playOrderAlertChime();
            }
            if (staffMode) {
              const firstNew = newPendingOrders[0];
              void showOperationalNotification({
                title: `طلب جديد #${firstNew.orderNumber}`,
                body:
                  firstNew.orderType === 'dine_in'
                    ? `${firstNew.hallName ? `${firstNew.hallName} · ` : ''}ترابيزة ${firstNew.tableNumber || '-'}`
                    : `${firstNew.customerName} · ${firstNew.items.length} أصناف`,
                url: `/staff/${restaurant.slug}`,
                tag: `order_${firstNew.id}`,
              });
            }
          }
        }
        setOrders(incoming);
        setLoadError(null);
        setLoading(false);
      },
      (err) => {
        setLoadError(err.message || (isEn ? 'Could not load orders.' : 'تعذر تحميل الطلبات.'));
        setLoading(false);
      },
      { staffMode }
    );

    return () => unsub();
  }, [restaurant.id, restaurant.ownerId, restaurant.slug, soundEnabled, retryKey, isEn, staffMode]);

  useEffect(() => {
    if (!canReadServiceCalls) {
      setServiceCalls([]);
      return;
    }

    callsInitializedRef.current = false;
    knownCallIdsRef.current = new Set();

    const unsub = subscribeOwnerServiceCalls(
      restaurant.id,
      restaurant.ownerId,
      (incoming) => {
        if (!callsInitializedRef.current) {
          incoming.forEach((c) => knownCallIdsRef.current.add(c.id));
          callsInitializedRef.current = true;
        } else {
          let hasNewPendingCall = false;
          incoming.forEach((c) => {
            if (!knownCallIdsRef.current.has(c.id)) {
              knownCallIdsRef.current.add(c.id);
              if (c.status === 'pending') hasNewPendingCall = true;
            }
          });
          if (hasNewPendingCall && soundEnabled) {
            playOrderAlertChime();
          }
        }
        setServiceCalls(incoming);
      },
      () => {},
      { staffMode }
    );

    return () => unsub();
  }, [restaurant.id, restaurant.ownerId, soundEnabled, retryKey, staffMode, canReadServiceCalls]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const itemMap = useMemo(
    () => new Map(menuItems.map((m) => [m.id, m])),
    [menuItems]
  );

  const activeCalls = useMemo(
    () => serviceCalls.filter((c) => c.status !== 'resolved'),
    [serviceCalls]
  );

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending' || o.status === 'preparing'),
    [orders]
  );

  const effectiveStations = useMemo(
    () => buildEffectiveStations(dynamicStations),
    [dynamicStations]
  );

  const stationById = useMemo(() => {
    const map = new Map<string, StationMeta>();
    effectiveStations.forEach((st) => map.set(st.stationId, st));
    return map;
  }, [effectiveStations]);

  const resolveStationMeta = (stationId: string): StationMeta => {
    return (
      stationById.get(stationId) ||
      STATION_META_MAP[stationId] || {
        ...STATION_META_MAP.kitchen,
        id: stationId,
        stationId,
        label: stationId,
        label_en: stationId,
        shortLabel: stationId,
        shortLabel_en: stationId,
      }
    );
  };

  // Dynamic Station KDS filtering & counts
  const stationOrdersMap = useMemo(() => {
    const map = new Map<
      string,
      Array<{
        order: Order;
        items: Array<{ item: OrderItemPayload; originalIndex: number; prepState: ItemPrepState }>;
        pendingCount: number;
      }>
    >();

    effectiveStations.forEach((st) => map.set(st.stationId, []));
    const fallbackStationId = effectiveStations[0]?.stationId || 'kitchen';

    activeOrders.forEach((order) => {
      const grouped = new Map<
        string,
        Array<{ item: OrderItemPayload; originalIndex: number; prepState: ItemPrepState }>
      >();

      order.items.forEach((it, idx) => {
        const st = resolveOrderItemStation(it, itemMap, categoryMap, fallbackStationId);
        const prepState: ItemPrepState = order.itemProgress?.[String(idx)] || 'pending';
        const list = grouped.get(st) || [];
        list.push({ item: it, originalIndex: idx, prepState });
        grouped.set(st, list);
      });

      grouped.forEach((stItems, stId) => {
        const pendingCount = stItems.filter(
          (x) => x.prepState === 'pending' || x.prepState === 'preparing'
        ).length;
        const bucket = map.get(stId) || [];
        bucket.push({ order, items: stItems, pendingCount });
        map.set(stId, bucket);
      });
    });

    return map;
  }, [activeOrders, itemMap, categoryMap, effectiveStations]);

  const stationOpenCounts = useMemo(() => {
    const counts = new Map<string, number>();
    stationOrdersMap.forEach((entries, stId) => {
      counts.set(
        stId,
        entries.filter((c) => c.pendingCount > 0).length
      );
    });
    return counts;
  }, [stationOrdersMap]);

  // Cashier Master View: Group active dine-in orders per Table (Hall + Table Number) with aggregated Separate Checks
  const openTableGroups = useMemo<TableMasterGroup[]>(() => {
    const map = new Map<string, Order[]>();
    activeOrders.forEach((order) => {
      if (order.orderType !== 'dine_in') return;
      const hall = (order.hallName || '').trim();
      const tbl = (order.tableNumber || '').trim();
      if (!tbl && !order.sessionId) return;
      const key = `${hall}::${tbl || order.sessionId || order.id}`;
      const list = map.get(key) || [];
      list.push(order);
      map.set(key, list);
    });

    const groups: TableMasterGroup[] = [];
    map.forEach((tblOrders, groupKey) => {
      const first = tblOrders[0];
      const hallName = (first.hallName || '').trim();
      const tableNumber = (first.tableNumber || '').trim();
      const sessionId = tblOrders.find((o) => o.sessionId)?.sessionId;

      const guestMap = new Map<string, AggregatedGuestCheck>();
      let subtotal = 0;
      let serviceCharge = 0;
      let taxAmount = 0;
      let discountAmount = 0;
      let grandTotal = 0;

      tblOrders.forEach((ord) => {
        subtotal += ord.subtotal || 0;
        serviceCharge += ord.serviceCharge || 0;
        taxAmount += ord.taxAmount || 0;
        discountAmount += ord.discountAmount || 0;
        grandTotal += ord.total || 0;

        if (Array.isArray(ord.guestChecks) && ord.guestChecks.length > 0) {
          ord.guestChecks.forEach((gc) => {
            const gName = (gc.guestName || (isEn ? 'Guest' : 'ضيف')).trim();
            const existing = guestMap.get(gName.toLowerCase());
            if (existing) {
              existing.itemsCount += gc.itemsCount;
              existing.subtotal += gc.subtotal;
              existing.serviceCharge += gc.serviceCharge;
              existing.taxAmount += gc.taxAmount;
              existing.total += gc.total;
            } else {
              guestMap.set(gName.toLowerCase(), {
                guestName: gName,
                itemsCount: gc.itemsCount,
                subtotal: gc.subtotal,
                serviceCharge: gc.serviceCharge,
                taxAmount: gc.taxAmount,
                total: gc.total,
              });
            }
          });
        } else {
          // Compute breakdown from items + proportional fees
          const ordSub = ord.subtotal > 0 ? ord.subtotal : ord.items.reduce((s, i) => s + i.lineTotal, 0);
          const factor = ordSub > 0 ? ord.total / ordSub : 1;
          ord.items.forEach((it) => {
            const gName = (it.guestName || ord.customerName || (isEn ? 'Guest' : 'ضيف')).trim();
            const existing = guestMap.get(gName.toLowerCase());
            const shareSub = it.lineTotal;
            const shareTotal = shareSub * factor;
            if (existing) {
              existing.itemsCount += it.quantity;
              existing.subtotal += shareSub;
              existing.total += shareTotal;
            } else {
              guestMap.set(gName.toLowerCase(), {
                guestName: gName,
                itemsCount: it.quantity,
                subtotal: shareSub,
                serviceCharge: 0,
                taxAmount: 0,
                total: shareTotal,
              });
            }
          });
        }
      });

      groups.push({
        groupKey,
        hallName,
        tableNumber,
        sessionId,
        orders: tblOrders,
        orderIds: tblOrders.map((o) => o.id),
        orderNumbers: tblOrders.map((o) => o.orderNumber),
        guestsBreakdown: Array.from(guestMap.values()),
        subtotal,
        serviceCharge,
        taxAmount,
        discountAmount,
        grandTotal,
      });
    });

    return groups;
  }, [activeOrders, isEn]);

  const visibleLedgerOrders = useMemo(() => {
    if (!hideHistoryArchive) return orders;
    const shiftId = effectiveActiveCashierShift?.id;
    const shiftStartMs = effectiveActiveCashierShift
      ? getTimestampMillis(effectiveActiveCashierShift.startedAt)
      : 0;
    return orders.filter((o) => {
      if (o.status === 'pending' || o.status === 'preparing') return true;
      if (shiftId && o.shiftId === shiftId) return true;
      if (shiftStartMs > 0 && getTimestampMillis(o.createdAt) >= shiftStartMs) return true;
      return false;
    });
  }, [orders, hideHistoryArchive, effectiveActiveCashierShift]);

  const filteredOrders = useMemo(() => {
    if (filterStatus === 'all') return visibleLedgerOrders;
    return visibleLedgerOrders.filter((o) => o.status === filterStatus);
  }, [visibleLedgerOrders, filterStatus]);

  const handleToggleFullscreen = () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    if (next) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleStatusChange = async (order: Order, nextStatus: OrderStatus) => {
    setUpdatingId(order.id);
    try {
      await updateOrderStatus(order.id, nextStatus, {
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        orderNumber: order.orderNumber,
        actor,
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePrintKdsTicket = async (
    order: Order,
    stationMeta: StationMeta,
    stationItems: OrderItemPayload[]
  ) => {
    setPrintingKdsOrderId(order.id);
    setPrintFeedback(null);
    try {
      const job = buildStationTicketJob({
        restaurant,
        order,
        station: stationMeta,
        stationItems,
      });
      const res = await printThermalJobsSequentially([job]);
      setPrintFeedback(
        res.mode === 'hardware'
          ? `تمت طباعة تذكرة #${order.orderNumber} (${stationMeta.shortLabel}) على الطابعة الحرارية.`
          : `تم تجهيز تذكرة #${order.orderNumber} (${stationMeta.shortLabel}) للطباعة.`
      );
    } finally {
      setPrintingKdsOrderId(null);
    }
  };

  const openSplitCheckForTableGroup = (group: TableMasterGroup) => {
    const first = group.orders[0];
    if (!first) return;
    const consolidated: Order = {
      ...first,
      id: group.groupKey,
      orderNumber: group.orderNumbers.join('+'),
      items: group.orders.flatMap((o) => o.items),
      subtotal: group.subtotal,
      serviceCharge: group.serviceCharge,
      taxAmount: group.taxAmount,
      discountAmount: group.discountAmount,
      total: group.grandTotal,
      guestChecks: group.guestsBreakdown.map((g) => ({
        guestName: g.guestName,
        itemsCount: g.itemsCount,
        subtotal: g.subtotal,
        serviceCharge: g.serviceCharge,
        taxAmount: g.taxAmount,
        total: g.total,
      })),
      hallName: group.hallName,
      tableNumber: group.tableNumber,
      orderType: 'dine_in',
    };
    setSplitCheckOrder(consolidated);
  };

  const handleMarkStationItemsReady = async (order: Order, itemIndices: number[]) => {
    if (itemIndices.length === 0) return;
    const key = `${order.id}:${itemIndices.join(',')}`;
    setUpdatingItemKey(key);
    try {
      const updates: Record<string, ItemPrepState> = {};
      itemIndices.forEach((idx) => {
        updates[String(idx)] = 'ready';
      });
      await updateOrderItemProgress(
        order.id,
        updates,
        order.status === 'pending' ? 'preparing' : undefined,
        {
          restaurantId: restaurant.id,
          ownerId: restaurant.ownerId,
          orderNumber: order.orderNumber,
          station:
            activeStation === 'cashier'
              ? effectiveStations[0]?.stationId || 'kitchen'
              : activeStation,
          actor,
        }
      );
    } finally {
      setUpdatingItemKey(null);
    }
  };

  const openSettlementModal = (target: SettleTarget, preferredMethod: OrderPaymentMethod = 'cash') => {
    const due = target.type === 'table' ? target.group.grandTotal : target.order.total;
    setSettleTarget(target);
    setSettleMethod(preferredMethod);
    setSettleVisaAmount(preferredMethod === 'visa' ? due.toFixed(2) : '0');
    setSettleCashTendered(preferredMethod === 'visa' ? '0' : due.toFixed(2));
    setSettleError(null);
  };

  const settleTotalDue = settleTarget
    ? settleTarget.type === 'table'
      ? settleTarget.group.grandTotal
      : settleTarget.order.total
    : 0;

  const settlementCalc = useMemo(() => {
    const parsedCashTendered =
      settleCashTendered.trim() === '' ? undefined : Math.max(0, Number(settleCashTendered) || 0);
    return calculateCashSettlementAndVariance({
      totalDue: settleTotalDue,
      paymentMethod: settleMethod,
      visaPaidAmount: Number(settleVisaAmount) || 0,
      customerCashTendered: parsedCashTendered,
      currency: restaurant.currency,
      autoRoundToCoinless: autoRoundCoinless,
    });
  }, [
    settleTotalDue,
    settleMethod,
    settleVisaAmount,
    settleCashTendered,
    restaurant.currency,
    autoRoundCoinless,
  ]);

  const handleConfirmSettlement = async () => {
    if (!settleTarget) return;
    setSettlingBusy(true);
    setSettleError(null);
    try {
      const targetOrders =
        settleTarget.type === 'table' ? settleTarget.group.orders : [settleTarget.order];
      await settleOrdersCheck({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        orders: targetOrders,
        sessionId: settleTarget.type === 'table' ? settleTarget.group.sessionId : settleTarget.order.sessionId,
        hallName: settleTarget.type === 'table' ? settleTarget.group.hallName : settleTarget.order.hallName,
        tableNumber:
          settleTarget.type === 'table' ? settleTarget.group.tableNumber : settleTarget.order.tableNumber,
        activeShift: effectiveActiveCashierShift,
        paymentMethod: settleMethod,
        cashPaidAmount: settlementCalc.cashDue,
        visaPaidAmount: settlementCalc.visaDue,
        customerCashTendered: settlementCalc.customerCashTendered,
        changeReturned: settlementCalc.changeReturned,
        drawerVariance: settlementCalc.drawerVariance,
        actor: effectiveActor,
      });
      setSettleTarget(null);
    } catch (err) {
      setSettleError(err instanceof Error ? err.message : 'تعذر إقفال الحساب حالياً.');
    } finally {
      setSettlingBusy(false);
    }
  };

  const openModifyOrderModal = (order: Order) => {
    setModifyTargetOrder(order);
    setModifyItems(order.items.map((it) => ({ ...it })));
    if ((order.manualDiscountPercent || 0) > 0) {
      setModifyDiscountMode('percent');
      setModifyDiscountValue(String(order.manualDiscountPercent));
    } else if ((order.manualDiscountAmount || 0) > 0) {
      setModifyDiscountMode('amount');
      setModifyDiscountValue(String(order.manualDiscountAmount));
    } else {
      setModifyDiscountMode('none');
      setModifyDiscountValue('');
    }
    setModifyDiscountReason(order.manualDiscountReason || '');
    setModifyOrderNotes(order.notes || '');
    setModifyTableNotes(order.tableNotes || '');
    setModifyAuditReason('');
    setModifyError(null);
  };

  const handleSaveModifiedOrder = async (cancelOrder = false) => {
    if (!modifyTargetOrder) return;
    if (!modifyAuditReason.trim()) {
      setModifyError('يجب كتابة سبب التعديل أو الإلغاء.');
      return;
    }
    setModifyBusy(true);
    setModifyError(null);
    try {
      await modifyOrderWithAudit({
        order: modifyTargetOrder,
        restaurant,
        updates: cancelOrder
          ? {
              cancelOrder: true,
              cancelReason: modifyAuditReason.trim(),
              notes: modifyOrderNotes,
              tableNotes: modifyTableNotes,
            }
          : {
              items: modifyItems,
              manualDiscountAmount:
                modifyDiscountMode === 'amount'
                  ? Math.max(0, Number(modifyDiscountValue) || 0)
                  : modifyDiscountMode === 'none'
                    ? 0
                    : undefined,
              manualDiscountPercent:
                modifyDiscountMode === 'percent'
                  ? Math.max(0, Math.min(100, Number(modifyDiscountValue) || 0))
                  : modifyDiscountMode === 'none'
                    ? 0
                    : undefined,
              manualDiscountReason: modifyDiscountReason.trim() || modifyAuditReason.trim(),
              notes: modifyOrderNotes,
              tableNotes: modifyTableNotes,
            },
        reason: modifyAuditReason.trim(),
        actor: effectiveActor,
      });
      setModifyTargetOrder(null);
    } catch (err) {
      setModifyError(err instanceof Error ? err.message : 'تعذر حفظ التعديل.');
    } finally {
      setModifyBusy(false);
    }
  };

  const handleAddShiftExpense = async () => {
    if (!effectiveActiveCashierShift) return;
    const amt = Number(expenseAmountInput);
    if (!amt || amt <= 0 || !expenseDescInput.trim()) {
      setDrawerFeedback('أدخل مبلغاً صحيحاً وبيان المصروف أولاً.');
      return;
    }
    setSavingExpense(true);
    setDrawerFeedback(null);
    try {
      await addDrawerExpense({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        shift: effectiveActiveCashierShift,
        amount: amt,
        description: expenseDescInput.trim(),
        note: expenseNoteInput.trim(),
        actor: effectiveActor,
      });
      setExpenseAmountInput('');
      setExpenseDescInput('');
      setExpenseNoteInput('');
      setDrawerFeedback('تم خصم المصروف من الدرج وتسجيله بنجاح.');
    } catch (err) {
      setDrawerFeedback(err instanceof Error ? err.message : 'تعذر تسجيل المصروف.');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleSaveFloatAdjustment = async () => {
    if (!effectiveActiveCashierShift) return;
    setSavingFloat(true);
    setDrawerFeedback(null);
    try {
      await adjustActiveCashierFloat({
        restaurant,
        shift: effectiveActiveCashierShift,
        newOpeningFloat: Math.max(0, Number(floatInput) || 0),
        actor: effectiveActor,
      });
      setEditingFloatOpen(false);
      setDrawerFeedback('تم تحديث العهدة الافتتاحية للدرج.');
    } catch (err) {
      setDrawerFeedback(err instanceof Error ? err.message : 'تعذر تحديث العهدة.');
    } finally {
      setSavingFloat(false);
    }
  };

  const handleConfirmHandoverClose = async () => {
    if (!effectiveActiveCashierShift) return;
    const cashiers = staffList.filter(
      (s) => s.isActive && s.role === 'cashier' && s.uid !== effectiveActiveCashierShift.staffId
    );
    const managers = staffList.filter((s) => s.isActive && s.role === 'manager');

    let recipientName = handoverCustomName.trim();
    let recipientUid = handoverRecipientUid;

    if (handoverRecipientType === 'self_next_slot') {
      recipientName = effectiveActor.name;
      recipientUid = effectiveActor.uid;
    } else if (handoverRecipientType === 'owner') {
      recipientName = recipientName || 'صاحب المطعم (الخزنة الرئيسية)';
      recipientUid = restaurant.ownerId;
    } else if (handoverRecipientType === 'manager') {
      const m = managers.find((x) => x.uid === handoverRecipientUid) || managers[0];
      recipientName = m?.name || recipientName || 'مدير المطعم';
      recipientUid = m?.uid || '';
    } else {
      const c = cashiers.find((x) => x.uid === handoverRecipientUid);
      if (c) {
        recipientName = c.name;
        recipientUid = c.uid;
      }
    }

    if (!recipientName) {
      setDrawerFeedback('يرجى تحديد أو كتابة اسم مستلم العهدة والكاش.');
      return;
    }

    setClosingHandover(true);
    setDrawerFeedback(null);
    try {
      const openTablesList = openTableGroups.map(
        (g) => `${g.hallName ? `${g.hallName} · ` : ''}ترابيزة ${g.tableNumber}`
      );
      const nextSlot = getNextShiftSlot(opsConfig, effectiveActiveCashierShift.shiftSlotId);
      const res = await closeCashierShiftWithHandover({
        restaurant,
        shift: effectiveActiveCashierShift,
        recipientType: handoverRecipientType,
        recipientUid,
        recipientName,
        openTables: openTablesList,
        note: handoverNote.trim(),
        actor: effectiveActor,
        nextSlot,
      });
      setHandoverNote('');
      setDrawerFeedback(
        handoverRecipientType === 'self_next_slot'
          ? `تم ترحيل ${formatMoney(res.expectedCashHandover)} وبدء وردية ${nextSlot.name} تلقائياً.`
          : `تم تسليم الوردية وإغلاق الدرج بقيمة ${formatMoney(res.expectedCashHandover)} إلى ${recipientName}.`
      );
      window.setTimeout(() => setDrawerModalOpen(false), 1200);
    } catch (err) {
      setDrawerFeedback(err instanceof Error ? err.message : 'تعذر إغلاق الوردية وتسليم الدرج.');
    } finally {
      setClosingHandover(false);
    }
  };

  const handleCallStatusChange = async (call: ServiceCall, nextStatus: ServiceCallStatus) => {
    setUpdatingCallId(call.id);
    try {
      await updateServiceCallStatus(call.id, nextStatus, {
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        tableLabel: `${call.hallName ? `${call.hallName} · ` : ''}ترابيزة ${call.tableNumber}`,
        actor,
      });
    } finally {
      setUpdatingCallId(null);
    }
  };

  const getCallMeta = (type: ServiceCallType) => {
    if (type === 'call_waiter') {
      return {
        label: isEn ? 'Call Captain / Waiter' : 'نداء الكابتن / الويتر',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
        Icon: BellRing,
      };
    }
    if (type === 'request_bill_cash') {
      return {
        label: isEn ? 'Bill Request (Cash)' : 'طلب الفاتورة (كاش)',
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        Icon: Banknote,
      };
    }
    if (type === 'request_bill_card') {
      return {
        label: isEn ? 'Bill Request (Visa / Card)' : 'طلب الفاتورة (فيزا)',
        badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
        Icon: CreditCard,
      };
    }
    return {
      label: isEn ? 'Cutlery & Water' : 'أدوات طعام / مياه',
      badgeClass: 'bg-sky-100 text-sky-900 border-sky-300',
      Icon: Utensils,
    };
  };

  const formatMoney = (val: number) => `${val.toFixed(2).replace(/\.00$/, '')} ${currencyLabel}`;

  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  const ui = useScreenUi('cashier_kds');

  const stationTabs = useMemo(() => {
    const mapStationToUiId = (stationId: string) => {
      if (stationId === 'cashier') return 'cashier_station';
      if (stationId === 'kitchen') return 'kds_kitchen';
      if (stationId === 'bar') return 'kds_bar';
      if (stationId === 'pastry') return 'kds_pastry';
      return null;
    };

    const base: Array<{
      id: StationView;
      label: string;
      icon: typeof Receipt;
      count?: number;
    }> = [
      {
        id: 'cashier',
        label: ui.getButtonLabel(
          'cashier_station',
          lang,
          isEn ? 'Cashier Master View' : 'شاشة الكاشير (Master)'
        ),
        icon: Receipt,
        count: activeOrders.length,
      },
      ...effectiveStations.map((st) => {
        const uiId = mapStationToUiId(st.stationId);
        const fallbackLabel = isEn ? `${st.shortLabel_en} KDS` : st.label;
        return {
          id: st.stationId as StationView,
          label: uiId ? ui.getButtonLabel(uiId, lang, fallbackLabel) : fallbackLabel,
          icon: getStationIconComponent(st.icon),
          count: stationOpenCounts.get(st.stationId) || 0,
        };
      }),
    ];
    return base;
  }, [isEn, lang, ui, activeOrders.length, effectiveStations, stationOpenCounts]);

  const visibleStationTabs = useMemo(
    () =>
      normalizedAllowedStations && normalizedAllowedStations.length > 0
        ? stationTabs.filter((tab) => normalizedAllowedStations.includes(tab.id))
        : stationTabs,
    [normalizedAllowedStations, stationTabs]
  );

  const getPrepBadge = (state: ItemPrepState) => {
    if (state === 'served') {
      return (
        <span className="px-2 py-0.5 rounded bg-zinc-200 text-zinc-700 text-[10px] font-bold">
          {isEn ? 'Served' : 'تم التقديم'}
        </span>
      );
    }
    if (state === 'ready') {
      return (
        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
          {isEn ? 'Ready' : 'جاهز للتقديم'}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
        {isEn ? 'In Prep' : 'قيد التحضير'}
      </span>
    );
  };

  return (
    <div
      dir={dir}
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[#F5F6F8] overflow-y-auto p-4 sm:p-6 space-y-5'
          : 'space-y-5'
      }
    >
      {/* Top Bar with Station Switcher, Sound Controls, and Full-Screen Toggle */}
      <div
        className={`border p-4 sm:p-5 space-y-4 ${ui.radiusClasses.card}`}
        style={{
          backgroundColor: ui.theme.surfaceBg,
          borderColor: ui.theme.surfaceBorder,
          boxShadow: ui.theme.cardShadow,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold" style={{ color: ui.theme.surfaceText }}>
              {visibleStationTabs.length === 1
                ? visibleStationTabs[0].label
                : isEn
                  ? 'Multi-Station Operations & KDS'
                  : 'شاشات التشغيل والمحطات (Cashier & Multi-KDS)'}
            </h2>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: ui.theme.mutedText }}>
              {t.admin.orders.subtitle}
              {pendingCount > 0 && (
                <span className="font-mono-num font-bold text-amber-700 ms-2">
                  · {pendingCount} {t.admin.orders.statsPending}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {activeStation === 'cashier' && ui.isButtonVisible('drawer_handover') && (
              <button
                type="button"
                onClick={() => {
                  setDrawerFeedback(null);
                  setDrawerModalOpen(true);
                }}
                className={`min-h-[40px] px-3.5 py-2 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                style={{
                  backgroundColor: ui.theme.accentHex,
                  color: ui.theme.accentTextHex,
                }}
              >
                <Wallet className="w-4 h-4" />
                <span>
                  {ui.getButtonLabel(
                    'drawer_handover',
                    lang,
                    isEn ? 'Drawer & Handover' : 'ح/الدرج والتسليم'
                  )}
                </span>
                {effectiveActiveCashierShift && (
                  <span className="font-mono-num px-1.5 py-0.5 rounded bg-black/15 text-[10px]">
                    {formatMoney(
                      (effectiveActiveCashierShift.openingFloat || 0) +
                        (effectiveActiveCashierShift.carriedOverCash || 0) +
                        (effectiveActiveCashierShift.cashSales || 0) +
                        (effectiveActiveCashierShift.drawerVarianceTotal || 0) -
                        (effectiveActiveCashierShift.drawerExpensesTotal || 0)
                    )}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setPrinterModalOpen(true)}
              className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${
                printerStatusLabel
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>{printerStatusLabel ? `طابعة: ${printerStatusLabel}` : isEn ? 'Thermal Printer' : 'طابعة حرارية'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                unlockAudioContext();
                playOrderAlertChime();
              }}
              className="min-h-[40px] px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t.admin.orders.testSound}</span>
            </button>
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                soundEnabled
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-500'
              }`}
            >
              {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              <span className="hidden sm:inline">
                {soundEnabled ? t.admin.orders.soundOn : t.admin.orders.soundOff}
              </span>
            </button>
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${
                isFullscreen
                  ? 'bg-zinc-950 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50'
              }`}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>
                {isFullscreen
                  ? isEn
                    ? 'Exit Fullscreen'
                    : 'خروج من ملء الشاشة'
                  : isEn
                    ? 'Full Screen'
                    : 'ملء الشاشة'}
              </span>
            </button>
          </div>
        </div>

        {printFeedback && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center justify-between gap-2">
            <span>{printFeedback}</span>
            <button type="button" onClick={() => setPrintFeedback(null)} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Station Tabs (hidden if single isolated station screen) */}
        {visibleStationTabs.length > 1 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
            {visibleStationTabs.map((tab) => {
              const TabIcon = tab.icon;
              const active = activeStation === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveStation(tab.id)}
                  className={`min-h-[46px] px-3.5 py-2.5 border text-xs font-extrabold transition-all flex items-center justify-between gap-2 cursor-pointer ${ui.radiusClasses.button}`}
                  style={
                    active
                      ? {
                          backgroundColor: ui.theme.accentHex,
                          borderColor: ui.theme.accentHex,
                          color: ui.theme.accentTextHex,
                        }
                      : {
                          backgroundColor: ui.theme.surfaceSubtleBg,
                          borderColor: ui.theme.surfaceBorder,
                          color: ui.theme.surfaceText,
                        }
                  }
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <TabIcon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className="font-mono-num text-[11px] font-extrabold px-2 py-0.5 rounded-md shrink-0"
                      style={{
                        backgroundColor: active ? ui.theme.accentTextHex : ui.theme.accentHex,
                        color: active ? ui.theme.accentHex : ui.theme.accentTextHex,
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-red-800">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold flex items-center gap-1.5 hover:bg-red-700 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isEn ? 'Retry' : 'إعادة المحاولة'}</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((n) => (
            <div key={n} className="h-36 rounded-2xl bg-zinc-200/70" />
          ))}
        </div>
      ) : activeStation !== 'cashier' ? (
        /* ============================================================== */
        /* DYNAMIC STATION DEDICATED KDS SCREEN                           */
        /* ============================================================== */
        (() => {
          const stMeta = resolveStationMeta(activeStation);
          const allStationOrders = stationOrdersMap.get(activeStation) || [];
          const visibleKdsOrders = kdsShowCompletedItems
            ? allStationOrders
            : allStationOrders.filter((entry) => entry.pendingCount > 0);

          return (
            <div className="space-y-4">
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`px-3 py-1 rounded-lg border text-xs font-extrabold ${stMeta.badgeClass}`}>
                    {isEn ? stMeta.label_en : stMeta.label}
                  </span>
                  <span className="text-xs text-zinc-600 font-semibold">
                    {isEn
                      ? `${visibleKdsOrders.length} active ticket(s) for this screen`
                      : `${visibleKdsOrders.length} تذكرة تحضير مخصصة لهذه الشاشة`}
                  </span>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={kdsShowCompletedItems}
                    onChange={(e) => setKdsShowCompletedItems(e.target.checked)}
                    className="w-4 h-4 accent-zinc-950"
                  />
                  <span>
                    {isEn ? 'Show already ready/served tickets' : 'إظهار الطلبات التي تم تجهيزها أيضاً'}
                  </span>
                </label>
              </div>

              {visibleKdsOrders.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center space-y-2">
                  <CheckCheck className="w-9 h-9 text-emerald-500 mx-auto" />
                  <h3 className="text-base font-extrabold text-zinc-900">
                    {isEn
                      ? `All clear on ${stMeta.shortLabel_en} screen!`
                      : `لا توجد طلبات معلّقة على شاشة ${stMeta.shortLabel} الآن`}
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-md mx-auto">
                    {isEn
                      ? 'Any new order containing items from categories assigned to this station will appear here immediately.'
                      : 'أي أوردر جديد يحتوي على أصناف تابعة لهذه المحطة سيظهر هنا فوراً مع رقم الترابيزة واسم العميل.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleKdsOrders.map(({ order, items: stItems, pendingCount: stPending }) => {
                    const unreadyIndices = stItems
                      .filter((x) => x.prepState === 'pending' || x.prepState === 'preparing')
                      .map((x) => x.originalIndex);
                    const batchKey = `${order.id}:${unreadyIndices.join(',')}`;
                    const locationLabel =
                      order.orderType === 'dine_in'
                        ? `${order.hallName ? `${order.hallName} · ` : ''}${
                            isEn ? `Table ${order.tableNumber || '-'}` : `ترابيزة ${order.tableNumber || '-'}`
                          }`
                        : order.orderType === 'delivery'
                          ? isEn
                            ? 'Delivery'
                            : 'توصيل'
                          : isEn
                            ? 'Pickup'
                            : 'استلام';

                    return (
                      <article
                        key={order.id}
                        className={`bg-white rounded-2xl border-2 p-4 flex flex-col justify-between gap-4 shadow-2xs ${
                          stPending > 0 ? 'border-amber-300' : 'border-emerald-200 bg-emerald-50/20'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono-num text-base font-extrabold text-zinc-950">
                                  #{order.orderNumber}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-lg bg-zinc-950 text-white text-xs font-extrabold">
                                  {locationLabel}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-500 mt-1">{order.customerName}</p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold shrink-0 ${
                                stPending > 0
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {stPending > 0
                                ? isEn
                                  ? `${stPending} Pending`
                                  : `${stPending} قيد التجهيز`
                                : isEn
                                  ? 'Done'
                                  : 'مكتمل'}
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            {(() => {
                              const showStationPrices = Boolean(
                                opsConfig.showPricesByRole?.[
                                  activeStation as keyof typeof opsConfig.showPricesByRole
                                ]
                              );
                              return stItems.map(({ item: it, originalIndex, prepState }) => {
                                const isDone = prepState === 'ready' || prepState === 'served';
                                const itemKey = `${order.id}:${originalIndex}`;
                                return (
                                  <div
                                    key={itemKey}
                                    className={`p-3 rounded-xl border flex items-start justify-between gap-2.5 ${
                                      isDone
                                        ? 'bg-emerald-50/70 border-emerald-200'
                                        : 'bg-zinc-50 border-zinc-200'
                                    }`}
                                  >
                                    <div className="min-w-0 space-y-1">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-mono-num text-sm font-extrabold text-zinc-950">
                                          {it.quantity}×
                                        </span>
                                        <span className="text-xs sm:text-sm font-extrabold text-zinc-950">
                                          {it.name}
                                          {it.sizeName ? ` (${it.sizeName})` : ''}
                                        </span>
                                        {showStationPrices && (
                                          <span className="font-mono-num text-[11px] font-bold text-zinc-600">
                                            ({formatMoney(it.lineTotal)})
                                          </span>
                                        )}
                                        {it.guestName && (
                                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 text-[10px] font-extrabold">
                                            {it.guestName}
                                          </span>
                                        )}
                                      </div>
                                      {it.addonNames?.length > 0 && (
                                        <p className="text-[11px] text-zinc-600">
                                          + {it.addonNames.join(isEn ? ', ' : '، ')}
                                        </p>
                                      )}
                                      {it.notes && (
                                        <p className="text-[11px] text-rose-700 font-bold">
                                          {isEn ? 'Note:' : 'ملاحظة:'} {it.notes}
                                        </p>
                                      )}
                                      <div className="pt-0.5">{getPrepBadge(prepState)}</div>
                                    </div>

                                  {!isDone && (
                                    <button
                                      type="button"
                                      disabled={updatingItemKey === itemKey}
                                      onClick={() => handleMarkStationItemsReady(order, [originalIndex])}
                                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 shrink-0 cursor-pointer disabled:opacity-50"
                                    >
                                      {activeStation === 'kitchen'
                                        ? isEn
                                          ? 'Ready to Serve'
                                          : 'جاهز للتقديم'
                                        : isEn
                                          ? 'Ready'
                                          : 'جاهز'}
                                    </button>
                                  )}
                                </div>
                              );
                            });
                            })()}
                          </div>

                          {order.notes && (
                            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                              {t.admin.orders.notesLabel} {order.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {unreadyIndices.length > 1 && (
                            <button
                              type="button"
                              disabled={updatingItemKey === batchKey}
                              onClick={() => handleMarkStationItemsReady(order, unreadyIndices)}
                              className="flex-1 min-h-[42px] py-2.5 px-3 rounded-xl bg-zinc-950 text-white text-xs font-extrabold hover:bg-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <CheckCheck className="w-4 h-4 text-emerald-400" />
                              <span>
                                {isEn
                                  ? `Mark All ${stMeta.shortLabel_en} Ready`
                                  : `تجهيز كل أصناف ${stMeta.shortLabel} (${unreadyIndices.length})`}
                              </span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={printingKdsOrderId === order.id}
                            onClick={() =>
                              handlePrintKdsTicket(
                                order,
                                stMeta,
                                stItems.map((x) => x.item)
                              )
                            }
                            className="min-h-[42px] py-2.5 px-3 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Printer className="w-4 h-4" />
                            <span>{isEn ? 'Print Ticket' : 'طباعة التذكرة'}</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()
      ) : (
        /* ============================================================== */
        /* 1. CASHIER MASTER VIEW                                         */
        /* ============================================================== */
        <div className="space-y-6">
          {/* Active Captain Calls Strip */}
          {activeCalls.length > 0 && (
            <section className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center shrink-0">
                  <BellRing className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-950">
                    {isEn ? 'Live Captain & Table Service Calls' : 'نداءات الكابتن وخدمة الصالة المباشرة'}
                  </h3>
                  <p className="text-[11px] text-zinc-600">
                    {isEn
                      ? `${activeCalls.length} active table request(s)`
                      : `${activeCalls.length} طلب خدمة نشط الآن من الطاولات`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeCalls.map((call) => {
                  const meta = getCallMeta(call.callType);
                  const CallIcon = meta.Icon;
                  const isAck = call.status === 'acknowledged';
                  return (
                    <div
                      key={call.id}
                      className={`bg-white rounded-xl border p-3.5 space-y-3 shadow-2xs ${
                        isAck ? 'border-blue-200' : 'border-amber-300 ring-2 ring-amber-200/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold ${meta.badgeClass}`}
                          >
                            <CallIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{meta.label}</span>
                          </span>
                          <p className="text-xs font-extrabold text-zinc-950 flex items-center gap-1.5 pt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">
                              {call.hallName ? `${call.hallName} · ` : ''}
                              {isEn ? `Table ${call.tableNumber}` : `ترابيزة ${call.tableNumber}`}
                            </span>
                          </p>
                          <p className="text-[11px] text-zinc-600">
                            {isEn ? 'Guest:' : 'باسم:'}{' '}
                            <strong className="text-zinc-900">{call.guestName}</strong>
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                            isAck ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isAck ? (isEn ? 'On the way' : 'جاري التلبية') : isEn ? 'New' : 'جديد'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {(call.callType === 'request_bill_cash' || call.callType === 'request_bill_card') &&
                          (() => {
                            const matchedGroup = openTableGroups.find(
                              (g) =>
                                g.tableNumber.trim() === (call.tableNumber || '').trim() &&
                                (!call.hallName || !g.hallName || g.hallName === call.hallName.trim())
                            );
                            if (!matchedGroup) return null;
                            return (
                              <button
                                type="button"
                                onClick={() =>
                                  openSettlementModal(
                                    { type: 'table', group: matchedGroup },
                                    call.callType === 'request_bill_card' ? 'visa' : 'cash'
                                  )
                                }
                                className="w-full py-2 px-3 rounded-lg bg-zinc-950 text-white text-[11px] font-extrabold hover:bg-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Banknote className="w-3.5 h-3.5 text-amber-400" />
                                <span>
                                  {isEn ? 'Settle & Close Check' : 'إقفال شيك الطاولة الآن'} (
                                  {formatMoney(matchedGroup.grandTotal)})
                                </span>
                              </button>
                            );
                          })()}
                        {!isAck && (
                          <button
                            type="button"
                            disabled={updatingCallId === call.id}
                            onClick={() => handleCallStatusChange(call, 'acknowledged')}
                            className="flex-1 py-2 px-2.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                          >
                            {isEn ? 'On the Way' : 'جاري التلبية'}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={updatingCallId === call.id}
                          onClick={() => handleCallStatusChange(call, 'resolved')}
                          className="flex-1 py-2 px-2.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Done' : 'تم التنفيذ'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Open Tables Master Checks (Aggregated by Hall + Table with Separate Check & Close Check) */}
          {openTableGroups.length > 0 && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-zinc-950 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-600" />
                  <span>
                    {isEn
                      ? `Open Table Master Checks (${openTableGroups.length})`
                      : `شيكات الترابيزات المفتوحة الآن (${openTableGroups.length})`}
                  </span>
                </h3>
                <span className="text-[11px] text-zinc-500">
                  {isEn
                    ? 'Grouped per table with Separate Check guest totals, print receipt, and Close Table.'
                    : 'مجمّعة لكل ترابيزة مع حساب كل ضيف بالاسم وإغلاق وطباعة الشيك.'}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {openTableGroups.map((group) => (
                  <article
                    key={group.groupKey}
                    className="bg-white border-2 border-zinc-900/15 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-2xs"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-zinc-950 text-white text-xs font-extrabold flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-amber-400" />
                              <span>
                                {group.hallName ? `${group.hallName} · ` : ''}
                                {isEn ? `Table ${group.tableNumber}` : `ترابيزة ${group.tableNumber}`}
                              </span>
                            </span>
                            <span className="text-[11px] font-mono-num text-zinc-500 font-bold">
                              ({group.orderNumbers.map((n) => `#${n}`).join(' + ')})
                            </span>
                          </div>
                        </div>

                        <div className="text-end shrink-0">
                          <p className="text-[10px] text-zinc-500 font-bold">
                            {isEn ? 'Table Grand Total' : 'إجمالي الترابيزة'}
                          </p>
                          <p className="text-base font-extrabold font-mono-num text-zinc-950">
                            {formatMoney(group.grandTotal)}
                          </p>
                        </div>
                      </div>

                      {/* Combined Items with Station & Prep Status */}
                      <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
                        {group.orders.flatMap((ord) =>
                          ord.items.map((it, idx) => {
                            const st = resolveOrderItemStation(
                              it,
                              itemMap,
                              categoryMap,
                              effectiveStations[0]?.stationId || 'kitchen'
                            );
                            const stMeta = resolveStationMeta(st);
                            const prepState = ord.itemProgress?.[String(idx)] || 'pending';
                            return (
                              <div
                                key={`${ord.id}_${idx}`}
                                className="flex items-start justify-between gap-2 text-xs py-1 border-b border-zinc-50 last:border-0"
                              >
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-mono-num font-bold text-zinc-900">
                                      {it.quantity}×
                                    </span>
                                    <span className="font-bold text-zinc-900">
                                      {it.name}
                                      {it.sizeName ? ` (${it.sizeName})` : ''}
                                    </span>
                                    {it.guestName && (
                                      <span className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-700 text-[10px] font-extrabold">
                                        {it.guestName}
                                      </span>
                                    )}
                                    <span
                                      className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${stMeta.badgeClass}`}
                                    >
                                      {isEn ? stMeta.shortLabel_en : stMeta.shortLabel}
                                    </span>
                                    {getPrepBadge(prepState)}
                                  </div>
                                </div>
                                <span className="font-mono-num font-bold text-zinc-800 shrink-0">
                                  {formatMoney(it.lineTotal)}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Separate Check Guest Breakdown */}
                      <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                        <p className="text-[11px] font-extrabold text-zinc-800 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-amber-600" />
                          <span>
                            {isEn
                              ? 'Separate Check Breakdown (By Guest Name)'
                              : 'حساب كل فرد على الترابيزة (Separate Check)'}
                          </span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {group.guestsBreakdown.map((gc, idx) => (
                            <div
                              key={`${gc.guestName}_${idx}`}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-[11px]"
                            >
                              <span className="font-bold text-zinc-800 truncate">
                                {gc.guestName}{' '}
                                <span className="text-zinc-400 font-normal">({gc.itemsCount})</span>
                              </span>
                              <span className="font-mono-num font-extrabold text-zinc-950 shrink-0">
                                {formatMoney(gc.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {group.orders.some((o) => o.tableNotes) && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-950">
                        ملاحظات الترابيزة:{' '}
                        {group.orders
                          .map((o) => o.tableNotes)
                          .filter(Boolean)
                          .join(' | ')}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100">
                      {(canEditOpenOrders || canApplyInstantDiscount || canCancelOpenOrders) &&
                        group.orders[0] && (
                          <button
                            type="button"
                            onClick={() => openModifyOrderModal(group.orders[0])}
                            className="min-h-[42px] px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Edit / Discount' : 'تعديل / خصم'}</span>
                          </button>
                        )}

                      <button
                        type="button"
                        onClick={() => openSplitCheckForTableGroup(group)}
                        className="min-h-[42px] px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Scissors className="w-4 h-4" />
                        <span>{isEn ? 'Split Check' : 'تقسيم الشيك'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setReceiptModalOrder(null);
                          setReceiptModalTable(group);
                        }}
                        className="min-h-[42px] px-4 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-xs font-extrabold hover:bg-zinc-50 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>{isEn ? 'Print Receipt' : 'طباعة الريسيت'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openSettlementModal({ type: 'table', group }, 'cash')}
                        className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Banknote className="w-4 h-4" />
                        <span>{isEn ? 'Settle & Close' : 'تحصيل وإقفال الشيك'}</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Individual Orders Ledger (Delivery, Pickup & Completed/Cancelled History) */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-zinc-950">
                {hideHistoryArchive
                  ? isEn
                    ? 'Current Shift Orders Ledger'
                    : 'طلبات الوردية الحالية والطلبات النشطة'
                  : isEn
                    ? 'All Orders Ledger'
                    : 'سجل كافة الطلبات (توصيل / استلام / أرشيف الصالة)'}
              </h3>
              {supervisoryMode && coveringStaffName && (
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                  إشراف على وردية: {coveringStaffName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'all' as const, label: `${t.admin.orders.filterAll} (${visibleLedgerOrders.length})` },
                { id: 'pending' as const, label: t.admin.orders.statsPending },
                { id: 'preparing' as const, label: t.admin.orders.statsPreparing },
                { id: 'completed' as const, label: t.admin.orders.statusCompleted },
                { id: 'cancelled' as const, label: t.admin.orders.statusCancelled },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id)}
                  className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                    filterStatus === tab.id
                      ? 'bg-zinc-950 text-white'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-2xl p-8 sm:p-12 text-center space-y-2">
                <Clock className="w-8 h-8 text-zinc-300 mx-auto" />
                <h3 className="text-base font-bold text-zinc-800">{t.admin.orders.emptyTitle}</h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                  {t.admin.orders.emptyDesc}{' '}
                  <span className="font-mono-num" dir="ltr">/menu/{restaurant.slug}</span>
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredOrders.map((order) => {
                  const st = statusMeta[order.status] || statusMeta.pending;
                  const isTerminal = order.status === 'completed' || order.status === 'cancelled';
                  const typeLabel =
                    order.orderType === 'dine_in'
                      ? `${t.admin.orders.typeDineIn}${
                          order.hallName ? ` · ${order.hallName}` : ''
                        } · ${t.admin.orders.tablePrefix} ${order.tableNumber || '-'}`
                      : order.orderType === 'delivery'
                        ? t.admin.orders.typeDelivery
                        : t.admin.orders.typePickup;

                  return (
                    <article
                      key={order.id}
                      className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono-num text-base font-extrabold text-zinc-950">
                                #{order.orderNumber}
                              </span>
                              <span className="text-xs text-zinc-600 font-semibold">· {typeLabel}</span>
                              {order.isGroupOrder && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-extrabold">
                                  <Users className="w-3 h-3" />
                                  <span>{isEn ? 'Group Table' : 'طلب جماعي'}</span>
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-600 mt-1">
                              {order.customerName}
                              {order.customerPhone ? (
                                <>
                                  {' '}
                                  · <span className="font-mono-num">{order.customerPhone}</span>
                                </>
                              ) : null}
                            </p>
                            {order.deliveryAddress && (
                              <p className="text-xs text-zinc-500 mt-0.5">
                                {isEn ? 'Address:' : 'العنوان:'} {order.deliveryAddress}
                              </p>
                            )}
                          </div>

                          <span
                            className={`px-2.5 py-1 rounded-lg border text-xs font-bold shrink-0 ${st.colorClass}`}
                          >
                            {st.label}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {order.items.map((item, idx) => {
                            const itemSt = resolveOrderItemStation(
                              item,
                              itemMap,
                              categoryMap,
                              effectiveStations[0]?.stationId || 'kitchen'
                            );
                            const stMeta = resolveStationMeta(itemSt);
                            const prepState = order.itemProgress?.[String(idx)] || 'pending';
                            return (
                              <div
                                key={`${order.id}_${idx}`}
                                className="flex items-start justify-between gap-3 text-xs"
                              >
                                <div>
                                  <p className="font-bold text-zinc-900 flex flex-wrap items-center gap-1.5">
                                    <span>
                                      <span className="font-mono-num">{item.quantity}×</span> {item.name}
                                      {item.sizeName ? ` (${item.sizeName})` : ''}
                                    </span>
                                    {item.guestName && (
                                      <span className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-700 text-[10px] font-extrabold">
                                        {item.guestName}
                                      </span>
                                    )}
                                    <span
                                      className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${stMeta.badgeClass}`}
                                    >
                                      {isEn ? stMeta.shortLabel_en : stMeta.shortLabel}
                                    </span>
                                    {order.status !== 'completed' && order.status !== 'cancelled' && getPrepBadge(prepState)}
                                  </p>
                                  {item.addonNames?.length > 0 && (
                                    <p className="text-zinc-500">
                                      + {item.addonNames.join(isEn ? ', ' : '، ')}
                                    </p>
                                  )}
                                  {item.notes && (
                                    <p className="text-amber-700">
                                      {isEn ? 'Note:' : 'ملاحظة:'} {item.notes}
                                    </p>
                                  )}
                                </div>
                                <span className="font-mono-num font-semibold text-zinc-800 shrink-0">
                                  {formatMoney(item.lineTotal)}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {order.guestChecks && order.guestChecks.length > 0 && (
                          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5">
                            <p className="text-[11px] font-extrabold text-zinc-800 flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-amber-600" />
                              <span>
                                {isEn ? 'Separate Check Breakdown' : 'تقسيم الفاتورة بالاسم (Separate Check)'}
                              </span>
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {order.guestChecks.map((gc, idx) => (
                                <div
                                  key={`${gc.guestName}_${idx}`}
                                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-[11px]"
                                >
                                  <span className="font-bold text-zinc-800 truncate">
                                    {gc.guestName}{' '}
                                    <span className="text-zinc-400 font-normal">({gc.itemsCount})</span>
                                  </span>
                                  <span className="font-mono-num font-extrabold text-zinc-950 shrink-0">
                                    {formatMoney(gc.total)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {order.notes && (
                          <p className="text-xs text-amber-800 bg-amber-50/70 border border-amber-200/70 rounded-lg px-3 py-2">
                            {t.admin.orders.notesLabel} {order.notes}
                          </p>
                        )}
                        {order.tableNotes && (
                          <p className="text-xs text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 font-semibold">
                            ملاحظات الترابيزة: {order.tableNotes}
                          </p>
                        )}
                        {order.cancelReason && (
                          <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 font-bold">
                            سبب الإلغاء: {order.cancelReason}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-zinc-100 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span>
                              {t.admin.orders.tax}:{' '}
                              <span className="font-mono-num">{formatMoney(order.taxAmount)}</span>
                            </span>
                            {order.serviceCharge > 0 && (
                              <span>
                                · {t.admin.orders.service}:{' '}
                                <span className="font-mono-num">{formatMoney(order.serviceCharge)}</span>
                              </span>
                            )}
                            {typeof order.deliveryFee === 'number' && order.deliveryFee > 0 && (
                              <span>
                                · {t.menu.deliveryFeeLabel}:{' '}
                                <span className="font-mono-num">{formatMoney(order.deliveryFee)}</span>
                              </span>
                            )}
                            {typeof order.discountAmount === 'number' && order.discountAmount > 0 && (
                              <span className="text-emerald-700 font-bold">
                                · {t.menu.discountLabel}
                                {order.promoCode ? ` (${order.promoCode})` : ''}:{' '}
                                <span className="font-mono-num">-{formatMoney(order.discountAmount)}</span>
                              </span>
                            )}
                            {typeof order.manualDiscountAmount === 'number' &&
                              order.manualDiscountAmount > 0 && (
                                <span className="text-indigo-700 font-bold">
                                  · خصم خاص ({order.manualDiscountReason || 'إدارة'}):{' '}
                                  <span className="font-mono-num">
                                    -{formatMoney(order.manualDiscountAmount)}
                                  </span>
                                </span>
                              )}
                          </div>
                          <span className="text-sm font-extrabold text-zinc-950 font-mono-num">
                            {t.admin.orders.total}: {formatMoney(order.total)}
                          </span>
                        </div>

                        {order.paymentMethod && (
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5">
                            <span>
                              الدفع:{' '}
                              {order.paymentMethod === 'visa'
                                ? 'فيزا 💳'
                                : order.paymentMethod === 'split'
                                  ? `مختلط (كاش ${formatMoney(order.cashPaidAmount || 0)} + فيزا ${formatMoney(order.visaPaidAmount || 0)})`
                                  : `كاش 💵 (${formatMoney(order.cashPaidAmount ?? order.total)})`}
                            </span>
                            {typeof order.drawerVariance === 'number' && order.drawerVariance !== 0 && (
                              <span
                                className={`font-mono-num ${
                                  order.drawerVariance > 0 ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                · فرق درج: {order.drawerVariance > 0 ? `+${order.drawerVariance}` : order.drawerVariance}
                              </span>
                            )}
                          </div>
                        )}

                        {order.lastUpdatedByName && (
                          <p className="text-[11px] text-zinc-500 font-semibold">
                            {order.status === 'completed' && order.closedByName
                              ? isEn
                                ? `Closed by: ${order.closedByName}`
                                : `أُغلق بواسطة: ${order.closedByName}`
                              : isEn
                                ? `Last updated by: ${order.lastUpdatedByName}`
                                : `آخر تحديث: ${order.lastUpdatedByName}`}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSplitCheckOrder(order)}
                            className="py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Scissors className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Split Check' : 'تقسيم الشيك'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setReceiptModalTable(null);
                              setReceiptModalOrder(order);
                            }}
                            className="py-2 px-3 rounded-xl border border-zinc-200 text-zinc-700 text-xs font-bold hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Receipt' : 'ريسيت'}</span>
                          </button>

                          {(canEditOpenOrders ||
                            canApplyInstantDiscount ||
                            canCancelOpenOrders ||
                            (isTerminal && canEditClosedChecks)) && (
                            <button
                              type="button"
                              onClick={() => openModifyOrderModal(order)}
                              className={`py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${
                                isOrderShiftLocked(order)
                                  ? 'border-zinc-300 bg-zinc-100 text-zinc-600'
                                  : 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                              }`}
                            >
                              {isOrderShiftLocked(order) ? (
                                <Lock className="w-3.5 h-3.5" />
                              ) : (
                                <Edit3 className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {isOrderShiftLocked(order)
                                  ? 'وردية مغلقة 🔒'
                                  : isEn
                                    ? 'Edit / Discount'
                                    : 'تعديل / خصم'}
                              </span>
                            </button>
                          )}

                          {!isTerminal && (
                            <>
                              {order.status === 'pending' && (
                                <button
                                  type="button"
                                  disabled={updatingId === order.id}
                                  onClick={() => handleStatusChange(order, 'preparing')}
                                  className="flex-1 py-2 px-3 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                                >
                                  {t.admin.orders.btnStartPreparing}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openSettlementModal({ type: 'order', order }, 'cash')}
                                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 cursor-pointer flex items-center justify-center gap-1"
                              >
                                <Banknote className="w-3.5 h-3.5" />
                                <span>{isEn ? 'Settle & Close' : 'تحصيل وإغلاق'}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Printable Cashier Receipt Modal (Supports both Aggregated Table Check & Single Order) */}
      {(receiptModalTable || receiptModalOrder) && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            setReceiptModalTable(null);
            setReceiptModalOrder(null);
          }}
        >
          <div
            dir={dir}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden"
          >
            <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between print:hidden">
              <span className="text-xs font-extrabold text-zinc-900">
                {isEn ? 'Cashier Receipt Preview' : 'معاينة ريسيت الكاشير'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setReceiptModalTable(null);
                  setReceiptModalOrder(null);
                }}
                aria-label={isEn ? 'Close' : 'إغلاق'}
                className="w-8 h-8 rounded-lg hover:bg-zinc-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="qr-bulk-print-area p-5 space-y-3 text-zinc-900 bg-white max-h-[70vh] overflow-y-auto print:max-h-none">
              <div className="text-center border-b border-dashed border-zinc-300 pb-3 space-y-1">
                <h3 className="text-base font-extrabold">{loc(restaurant.name, restaurant.name_en)}</h3>
                {receiptModalTable ? (
                  <>
                    <p className="text-xs font-bold">
                      {receiptModalTable.hallName ? `${receiptModalTable.hallName} · ` : ''}
                      {isEn
                        ? `Table ${receiptModalTable.tableNumber}`
                        : `ترابيزة ${receiptModalTable.tableNumber}`}
                    </p>
                    <p className="text-[11px] font-mono-num text-zinc-500">
                      {receiptModalTable.orderNumbers.map((n) => `#${n}`).join(' · ')}
                    </p>
                  </>
                ) : receiptModalOrder ? (
                  <>
                    <p className="text-xs font-extrabold font-mono-num">
                      #{receiptModalOrder.orderNumber}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {receiptModalOrder.orderType === 'dine_in'
                        ? `${receiptModalOrder.hallName ? `${receiptModalOrder.hallName} · ` : ''}${
                            isEn
                              ? `Table ${receiptModalOrder.tableNumber || '-'}`
                              : `ترابيزة ${receiptModalOrder.tableNumber || '-'}`
                          }`
                        : receiptModalOrder.customerName}
                    </p>
                  </>
                ) : null}
              </div>

              {/* Items List */}
              <div className="space-y-1.5 border-b border-dashed border-zinc-300 pb-3 text-xs">
                {(receiptModalTable
                  ? receiptModalTable.orders.flatMap((o) => o.items)
                  : receiptModalOrder?.items || []
                ).map((it, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono-num font-bold">{it.quantity}×</span> {it.name}
                      {it.sizeName ? ` (${it.sizeName})` : ''}
                      {it.guestName ? ` [${it.guestName}]` : ''}
                    </div>
                    <span className="font-mono-num font-bold shrink-0">{formatMoney(it.lineTotal)}</span>
                  </div>
                ))}
              </div>

              {/* Separate Check Guest Breakdown if present */}
              {((receiptModalTable && receiptModalTable.guestsBreakdown.length > 0) ||
                (receiptModalOrder?.guestChecks && receiptModalOrder.guestChecks.length > 0)) && (
                <div className="space-y-1 border-b border-dashed border-zinc-300 pb-3 text-[11px]">
                  <p className="font-extrabold text-zinc-700">
                    {isEn ? 'Separate Check Summary:' : 'تفصيل الحساب بالاسم:'}
                  </p>
                  {(receiptModalTable
                    ? receiptModalTable.guestsBreakdown
                    : receiptModalOrder?.guestChecks || []
                  ).map((gc, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <span>
                        {gc.guestName} ({gc.itemsCount})
                      </span>
                      <span className="font-mono-num font-extrabold">{formatMoney(gc.total)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Financial Totals */}
              {(() => {
                const sub = receiptModalTable ? receiptModalTable.subtotal : receiptModalOrder?.subtotal || 0;
                const svc = receiptModalTable
                  ? receiptModalTable.serviceCharge
                  : receiptModalOrder?.serviceCharge || 0;
                const tax = receiptModalTable ? receiptModalTable.taxAmount : receiptModalOrder?.taxAmount || 0;
                const disc = receiptModalTable
                  ? receiptModalTable.discountAmount
                  : receiptModalOrder?.discountAmount || 0;
                const deliv = receiptModalTable ? 0 : receiptModalOrder?.deliveryFee || 0;
                const grand = receiptModalTable ? receiptModalTable.grandTotal : receiptModalOrder?.total || 0;
                return (
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>{isEn ? 'Subtotal' : 'المجموع الفرعي'}</span>
                      <span className="font-mono-num">{formatMoney(sub)}</span>
                    </div>
                    {disc > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>{isEn ? 'Discount' : 'الخصم'}</span>
                        <span className="font-mono-num">-{formatMoney(disc)}</span>
                      </div>
                    )}
                    {svc > 0 && (
                      <div className="flex justify-between">
                        <span>{t.admin.orders.service}</span>
                        <span className="font-mono-num">{formatMoney(svc)}</span>
                      </div>
                    )}
                    {deliv > 0 && (
                      <div className="flex justify-between">
                        <span>{t.menu.deliveryFeeLabel}</span>
                        <span className="font-mono-num">{formatMoney(deliv)}</span>
                      </div>
                    )}
                    {tax > 0 && (
                      <div className="flex justify-between">
                        <span>{t.admin.orders.tax}</span>
                        <span className="font-mono-num">{formatMoney(tax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-extrabold pt-2 border-t border-zinc-200">
                      <span>{t.admin.orders.total}</span>
                      <span className="font-mono-num">{formatMoney(grand)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-950 text-white text-xs font-extrabold hover:bg-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{isEn ? 'Print Now' : 'طباعة الآن'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setReceiptModalTable(null);
                  setReceiptModalOrder(null);
                }}
                className="py-2.5 px-4 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-bold hover:bg-zinc-100 cursor-pointer"
              >
                {isEn ? 'Close' : 'إغلاق'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ThermalPrinterSettingsModal
        isOpen={printerModalOpen}
        onClose={() => setPrinterModalOpen(false)}
        restaurant={restaurant}
        onProfileChanged={(prof) => setPrinterStatusLabel(prof?.name || '')}
      />

      <SplitCheckPrintModal
        isOpen={Boolean(splitCheckOrder)}
        onClose={() => setSplitCheckOrder(null)}
        order={splitCheckOrder}
        restaurant={restaurant}
        stations={effectiveStations}
        itemsMap={itemMap}
        categoriesMap={categoryMap}
        onOpenPrinterSettings={() => {
          setSplitCheckOrder(null);
          setPrinterModalOpen(true);
        }}
      />

      {/* Settlement Modal (Cash / Visa / Split + Coinless Rounding & Drawer Variance) */}
      {settleTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !settlingBusy && setSettleTarget(null)}
        >
          <div
            dir={dir}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden"
          >
            <div className="px-5 py-4 bg-zinc-950 text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-extrabold">
                    {settleTarget.type === 'table'
                      ? `تحصيل وإقفال ${settleTarget.group.hallName ? `${settleTarget.group.hallName} · ` : ''}ترابيزة ${settleTarget.group.tableNumber}`
                      : `تحصيل الطلب #${settleTarget.order.orderNumber}`}
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-mono-num">
                    المطلوب سداده: {formatMoney(settleTotalDue)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={settlingBusy}
                onClick={() => setSettleTarget(null)}
                className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'cash' as const, label: 'كاش 💵' },
                    { id: 'visa' as const, label: 'فيزا 💳' },
                    { id: 'split' as const, label: 'مختلط ⚖️' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSettleMethod(m.id);
                      if (m.id === 'visa') {
                        setSettleVisaAmount(settleTotalDue.toFixed(2));
                        setSettleCashTendered('0');
                      } else if (m.id === 'split') {
                        const halfVisa = Number((settleTotalDue / 2).toFixed(2));
                        setSettleVisaAmount(String(halfVisa));
                        setSettleCashTendered(String((settleTotalDue - halfVisa).toFixed(2)));
                      } else {
                        setSettleVisaAmount('0');
                        setSettleCashTendered(settleTotalDue.toFixed(2));
                      }
                    }}
                    className={`min-h-[42px] rounded-xl border text-xs font-extrabold cursor-pointer ${
                      settleMethod === m.id
                        ? 'bg-zinc-950 text-white border-zinc-950'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {settleMethod === 'split' && (
                <label className="block space-y-1 text-xs font-bold text-zinc-800">
                  <span>المبلغ المدفوع بالفيزا *</span>
                  <input
                    type="number"
                    min={0}
                    max={settleTotalDue}
                    step="0.5"
                    dir="ltr"
                    value={settleVisaAmount}
                    onChange={(e) => setSettleVisaAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 font-mono-num font-bold text-sm"
                  />
                </label>
              )}

              {(settleMethod === 'cash' || settleMethod === 'split') && (
                <div className="space-y-2.5">
                  <label className="block space-y-1 text-xs font-bold text-zinc-800">
                    <span>المبلغ المستلم نقداً من العميل (كاش مستحق: {formatMoney(settlementCalc.cashDue)})</span>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      dir="ltr"
                      value={settleCashTendered}
                      onChange={(e) => setSettleCashTendered(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 font-mono-num font-extrabold text-sm"
                    />
                  </label>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSettleCashTendered(String(settlementCalc.cashDue))}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-[11px] font-bold cursor-pointer"
                    >
                      المبلغ بالضبط
                    </button>
                    {[50, 100, 200, 500].map((bill) => (
                      <button
                        key={bill}
                        type="button"
                        onClick={() => setSettleCashTendered(String(bill))}
                        className="px-2.5 py-1 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-[11px] font-mono-num font-bold cursor-pointer"
                      >
                        {bill}
                      </button>
                    ))}
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={autoRoundCoinless}
                      onChange={(e) => setAutoRoundCoinless(e.target.checked)}
                      className="w-4 h-4 accent-zinc-950"
                    />
                    <span>
                      تقريب الباقي تلقائياً بدون فكة (مضاعفات {settlementCalc.roundingStep}) وتسجيل فرق الدرج
                    </span>
                  </label>

                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-600">الباقي الدقيق:</span>
                      <span className="font-mono-num font-bold">{formatMoney(settlementCalc.exactChangeDue)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-800 font-extrabold">
                      <span>الباقي المردود للعميل:</span>
                      <span className="font-mono-num">{formatMoney(settlementCalc.changeReturned)}</span>
                    </div>
                    <div className="flex justify-between font-extrabold pt-1 border-t border-zinc-200">
                      <span>فرق الدرج (كسر الفكة):</span>
                      <span
                        className={`font-mono-num ${
                          settlementCalc.drawerVariance > 0
                            ? 'text-emerald-700'
                            : settlementCalc.drawerVariance < 0
                              ? 'text-rose-700'
                              : 'text-zinc-700'
                        }`}
                      >
                        {settlementCalc.drawerVariance > 0
                          ? `+${formatMoney(settlementCalc.drawerVariance)}`
                          : formatMoney(settlementCalc.drawerVariance)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {settleError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                  {settleError}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={settlingBusy}
                  onClick={handleConfirmSettlement}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
                >
                  {settlingBusy ? 'جاري التحصيل...' : 'تأكيد التحصيل وإقفال الشيك'}
                </button>
                <button
                  type="button"
                  disabled={settlingBusy}
                  onClick={() => setSettleTarget(null)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-bold hover:bg-zinc-50 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cashier Drawer (ح/الدرج), Expenses & Shift Handover Modal */}
      {drawerModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !closingHandover && setDrawerModalOpen(false)}
        >
          <div
            dir={dir}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="px-5 py-4 bg-zinc-950 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <Wallet className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold">
                    حساب الدرج والمصروفات وتسليم الوردية (ح/الدرج)
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {effectiveActiveCashierShift
                      ? `${effectiveActiveCashierShift.staffName} · ${effectiveActiveCashierShift.shiftSlotName || 'الوردية الحالية'}`
                      : 'لا توجد وردية كاشير مفتوحة حالياً'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {drawerFeedback && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900">
                  {drawerFeedback}
                </div>
              )}

              {!effectiveActiveCashierShift ? (
                <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200 text-center space-y-2">
                  <p className="text-sm font-extrabold text-zinc-900">
                    لم تبدأ وردية كاشير نشطة بعد
                  </p>
                  <p className="text-xs text-zinc-500">
                    ابدأ وردية الكاشير من شريط الورديات أعلى الصفحة لتسجيل مبيعات الدرج والمصروفات وتسليم العهدة.
                  </p>
                </div>
              ) : (
                <>
                  {/* Drawer KPIs */}
                  {(() => {
                    const opening = effectiveActiveCashierShift.openingFloat || 0;
                    const carried = effectiveActiveCashierShift.carriedOverCash || 0;
                    const cashSales = effectiveActiveCashierShift.cashSales || 0;
                    const visaSales = effectiveActiveCashierShift.visaSales || 0;
                    const variance = effectiveActiveCashierShift.drawerVarianceTotal || 0;
                    const expensesSum = effectiveActiveCashierShift.drawerExpensesTotal || 0;
                    const netExpectedCash = Number(
                      (opening + carried + cashSales + variance - expensesSum).toFixed(2)
                    );
                    const shiftExpenses = effectiveExpenses.filter(
                      (ex) => ex.shiftId === effectiveActiveCashierShift.id
                    );
                    const otherCashiers = staffList.filter(
                      (s) =>
                        s.isActive &&
                        s.role === 'cashier' &&
                        s.uid !== effectiveActiveCashierShift.staffId
                    );
                    const activeManagers = staffList.filter(
                      (s) => s.isActive && s.role === 'manager'
                    );

                    return (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-bold text-zinc-500">العهدة الافتتاحية</span>
                              {canEditDrawerFloat && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFloatInput(String(opening));
                                    setEditingFloatOpen((v) => !v);
                                  }}
                                  className="text-[10px] font-extrabold text-indigo-700 hover:underline cursor-pointer"
                                >
                                  تعديل
                                </button>
                              )}
                            </div>
                            <p className="text-sm font-extrabold font-mono-num text-zinc-950 mt-1">
                              {formatMoney(opening)}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                            <span className="text-[11px] font-bold text-zinc-500">رصيد مرحّل للدرج</span>
                            <p className="text-sm font-extrabold font-mono-num text-zinc-950 mt-1">
                              {formatMoney(carried)}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                            <span className="text-[11px] font-bold text-emerald-700">مبيعات الكاش</span>
                            <p className="text-sm font-extrabold font-mono-num text-emerald-950 mt-1">
                              {formatMoney(cashSales)}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                            <span className="text-[11px] font-bold text-blue-700">مبيعات الفيزا</span>
                            <p className="text-sm font-extrabold font-mono-num text-blue-950 mt-1">
                              {formatMoney(visaSales)}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                            <span className="text-[11px] font-bold text-amber-800">فرق الدرج (كسر الفكة)</span>
                            <p className="text-sm font-extrabold font-mono-num text-amber-950 mt-1">
                              {variance > 0 ? `+${formatMoney(variance)}` : formatMoney(variance)}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                            <span className="text-[11px] font-bold text-rose-700">مصروفات الدرج</span>
                            <p className="text-sm font-extrabold font-mono-num text-rose-950 mt-1">
                              -{formatMoney(expensesSum)}
                            </p>
                          </div>
                        </div>

                        {editingFloatOpen && canEditDrawerFloat && (
                          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-wrap items-end gap-2">
                            <label className="flex-1 min-w-[160px] text-xs font-bold text-indigo-950 space-y-1">
                              <span>قيمة العهدة الافتتاحية الجديدة</span>
                              <input
                                type="number"
                                min={0}
                                dir="ltr"
                                value={floatInput}
                                onChange={(e) => setFloatInput(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-indigo-300 bg-white font-mono-num font-bold text-sm"
                              />
                            </label>
                            <button
                              type="button"
                              disabled={savingFloat}
                              onClick={handleSaveFloatAdjustment}
                              className="min-h-[38px] px-4 py-2 rounded-lg bg-indigo-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
                            >
                              {savingFloat ? 'جاري التحديث...' : 'حفظ العهدة'}
                            </button>
                          </div>
                        )}

                        <div className="p-4 rounded-2xl bg-zinc-950 text-white flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] text-zinc-400 font-bold">
                              صافي الكاش المتوقع تسليمه بالدرج الآن
                            </p>
                            <p className="text-xl font-extrabold font-mono-num text-amber-400 mt-0.5">
                              {formatMoney(netExpectedCash)}
                            </p>
                          </div>
                          <span className="text-[11px] text-zinc-400 font-mono-num">
                            {effectiveActiveCashierShift.ordersHandled} طلب
                          </span>
                        </div>

                        {/* Quick Expense Entry */}
                        <div className="p-4 rounded-2xl border border-zinc-200 space-y-3">
                          <h4 className="text-xs font-extrabold text-zinc-950">
                            إضافة مصروف/نثريات من الدرج
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="number"
                              min={1}
                              dir="ltr"
                              placeholder="المبلغ *"
                              value={expenseAmountInput}
                              onChange={(e) => setExpenseAmountInput(e.target.value)}
                              className="px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono-num font-bold"
                            />
                            <input
                              type="text"
                              placeholder="بيان المصروف (مثال: ثلج / دليفري) *"
                              value={expenseDescInput}
                              onChange={(e) => setExpenseDescInput(e.target.value)}
                              className="sm:col-span-2 px-3 py-2 rounded-xl border border-zinc-300 text-xs font-bold"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              placeholder="ملاحظة إضافية (اختياري)"
                              value={expenseNoteInput}
                              onChange={(e) => setExpenseNoteInput(e.target.value)}
                              className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 text-xs"
                            />
                            <button
                              type="button"
                              disabled={savingExpense}
                              onClick={handleAddShiftExpense}
                              className="min-h-[38px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
                            >
                              {savingExpense ? 'جاري التسجيل...' : 'تسجيل مصروف من الدرج'}
                            </button>
                          </div>

                          {shiftExpenses.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-zinc-100 max-h-32 overflow-y-auto">
                              {shiftExpenses.map((ex) => (
                                <div
                                  key={ex.id}
                                  className="flex items-center justify-between text-[11px] bg-zinc-50 px-3 py-1.5 rounded-lg"
                                >
                                  <span className="font-bold text-zinc-800">
                                    {ex.description}
                                    {ex.note ? ` (${ex.note})` : ''}
                                  </span>
                                  <span className="font-mono-num font-extrabold text-rose-700">
                                    -{formatMoney(ex.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Open Tables Warning */}
                        {openTableGroups.length > 0 && (
                          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-1">
                            <p className="font-extrabold flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>
                                تنبيه: توجد ({openTableGroups.length}) ترابيزات مفتوحة لم تُغلق بعد:
                              </span>
                            </p>
                            <p className="text-[11px] font-bold text-amber-900">
                              {openTableGroups
                                .map((g) => `${g.hallName ? `${g.hallName} · ` : ''}ترابيزة ${g.tableNumber}`)
                                .join(' ، ')}{' '}
                              — سيتم توثيقها في محضر استلام الوردية.
                            </p>
                          </div>
                        )}

                        {/* Shift Handover Form */}
                        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                          <h4 className="text-xs font-extrabold text-zinc-950 flex items-center gap-1.5">
                            <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                            <span>تقفيل الوردية وتسليم الدرج إلى:</span>
                          </h4>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(
                              [
                                { id: 'cashier' as const, label: 'كاشير تالي' },
                                { id: 'manager' as const, label: 'عهدة المدير' },
                                { id: 'owner' as const, label: 'خزنة المالك' },
                                { id: 'self_next_slot' as const, label: 'استمر للوردية التالية' },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setHandoverRecipientType(opt.id)}
                                className={`min-h-[38px] px-2.5 py-2 rounded-xl border text-[11px] font-extrabold cursor-pointer ${
                                  handoverRecipientType === opt.id
                                    ? 'bg-indigo-700 text-white border-indigo-700'
                                    : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {handoverRecipientType === 'cashier' && (
                            <div className="space-y-2">
                              {otherCashiers.length > 0 && (
                                <select
                                  value={handoverRecipientUid}
                                  onChange={(e) => setHandoverRecipientUid(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs font-bold"
                                >
                                  <option value="">اختر الكاشير المستلم...</option>
                                  {otherCashiers.map((c) => (
                                    <option key={c.uid} value={c.uid}>
                                      {c.name} (@{c.username})
                                    </option>
                                  ))}
                                </select>
                              )}
                              {(!otherCashiers.length || !handoverRecipientUid) && (
                                <input
                                  type="text"
                                  placeholder="أو اكتب اسم الكاشير المستلم يدوياً"
                                  value={handoverCustomName}
                                  onChange={(e) => setHandoverCustomName(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs font-bold"
                                />
                              )}
                            </div>
                          )}

                          {handoverRecipientType === 'manager' && (
                            <div className="space-y-2">
                              {activeManagers.length > 0 ? (
                                <select
                                  value={handoverRecipientUid}
                                  onChange={(e) => setHandoverRecipientUid(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs font-bold"
                                >
                                  <option value="">اختر المدير المستلم...</option>
                                  {activeManagers.map((m) => (
                                    <option key={m.uid} value={m.uid}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="اسم المدير المستلم (افتراضي: مدير المطعم)"
                                  value={handoverCustomName}
                                  onChange={(e) => setHandoverCustomName(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs font-bold"
                                />
                              )}
                            </div>
                          )}

                          <input
                            type="text"
                            placeholder="ملاحظة التسليم (اختياري)"
                            value={handoverNote}
                            onChange={(e) => setHandoverNote(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs"
                          />

                          <button
                            type="button"
                            disabled={closingHandover}
                            onClick={handleConfirmHandoverClose}
                            className="w-full min-h-[44px] rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
                          >
                            {closingHandover
                              ? 'جاري تسليم وإغلاق الوردية...'
                              : handoverRecipientType === 'self_next_slot'
                                ? 'ترحيل الكاش وبدء الوردية التالية'
                                : 'تأكيد تسليم الدرج وإنهاء الوردية'}
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order Modify / Instant Discount / Cancel Modal with Audit Trail */}
      {modifyTargetOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !modifyBusy && setModifyTargetOrder(null)}
        >
          <div
            dir={dir}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="px-5 py-4 bg-zinc-950 text-white flex items-center justify-between gap-2 shrink-0">
              <div>
                <h3 className="text-sm font-extrabold">
                  إدارة وتعديل الطلب #{modifyTargetOrder.orderNumber}
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {modifyTargetOrder.hallName ? `${modifyTargetOrder.hallName} · ` : ''}
                  {modifyTargetOrder.tableNumber
                    ? `ترابيزة ${modifyTargetOrder.tableNumber}`
                    : modifyTargetOrder.customerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModifyTargetOrder(null)}
                className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {isOrderShiftLocked(modifyTargetOrder) ? (
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-xs font-extrabold text-rose-950 flex items-start gap-2.5">
                  <Lock className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    مغلقة 🔒 — التعديل مغلق بعد تسليم الوردية إلا بفتح استثنائي من السوبر أدمن.
                  </span>
                </div>
              ) : (
                <>
                  {/* Items Adjustment */}
                  {(canEditOpenOrders || canEditClosedChecks) && (
                    <div className="space-y-2">
                      <p className="text-xs font-extrabold text-zinc-900">الأصناف والكميات</p>
                      <div className="space-y-2">
                        {modifyItems.map((it, idx) => (
                          <div
                            key={`${it.menuItemId}_${idx}`}
                            className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-zinc-900 truncate">
                                {it.name} {it.sizeName ? `(${it.sizeName})` : ''}
                              </p>
                              <p className="text-[11px] font-mono-num text-zinc-500">
                                {formatMoney(it.unitPrice)} × {it.quantity} ={' '}
                                <strong className="text-zinc-900">{formatMoney(it.lineTotal)}</strong>
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setModifyItems((prev) =>
                                    prev.map((x, i) =>
                                      i === idx && x.quantity > 1
                                        ? {
                                            ...x,
                                            quantity: x.quantity - 1,
                                            lineTotal: Number((x.unitPrice * (x.quantity - 1)).toFixed(2)),
                                          }
                                        : x
                                    )
                                  )
                                }
                                className="w-7 h-7 rounded-lg border border-zinc-300 bg-white flex items-center justify-center cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-mono-num font-extrabold w-5 text-center">
                                {it.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setModifyItems((prev) =>
                                    prev.map((x, i) =>
                                      i === idx
                                        ? {
                                            ...x,
                                            quantity: x.quantity + 1,
                                            lineTotal: Number((x.unitPrice * (x.quantity + 1)).toFixed(2)),
                                          }
                                        : x
                                    )
                                  )
                                }
                                className="w-7 h-7 rounded-lg border border-zinc-300 bg-white flex items-center justify-center cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={modifyItems.length <= 1}
                                onClick={() =>
                                  setModifyItems((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="w-7 h-7 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 flex items-center justify-center cursor-pointer disabled:opacity-40"
                                title="إزالة الصنف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Instant Discount */}
                  {canApplyInstantDiscount && (
                    <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2.5">
                      <p className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5 text-indigo-700" />
                        <span>خصم فوري خاص مع السبب</span>
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            { id: 'none' as const, label: 'بدون خصم' },
                            { id: 'amount' as const, label: 'مبلغ ثابت' },
                            { id: 'percent' as const, label: 'نسبة %' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setModifyDiscountMode(opt.id)}
                            className={`py-1.5 rounded-lg border text-[11px] font-extrabold cursor-pointer ${
                              modifyDiscountMode === opt.id
                                ? 'bg-indigo-700 text-white border-indigo-700'
                                : 'bg-white border-indigo-200 text-indigo-900'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {modifyDiscountMode !== 'none' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="number"
                            min={0}
                            dir="ltr"
                            placeholder={modifyDiscountMode === 'percent' ? 'النسبة %' : 'قيمة الخصم'}
                            value={modifyDiscountValue}
                            onChange={(e) => setModifyDiscountValue(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-indigo-200 bg-white text-xs font-mono-num font-bold"
                          />
                          <input
                            type="text"
                            placeholder="سبب الخصم الخاص (مثال: ترضية ضيف)"
                            value={modifyDiscountReason}
                            onChange={(e) => setModifyDiscountReason(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-indigo-200 bg-white text-xs font-bold"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes & Table Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="block space-y-1 text-xs font-bold text-zinc-800">
                      <span>ملاحظات الطلب</span>
                      <input
                        type="text"
                        value={modifyOrderNotes}
                        onChange={(e) => setModifyOrderNotes(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs"
                      />
                    </label>
                    <label className="block space-y-1 text-xs font-bold text-zinc-800">
                      <span>ملاحظات الترابيزة</span>
                      <input
                        type="text"
                        value={modifyTableNotes}
                        onChange={(e) => setModifyTableNotes(e.target.value)}
                        placeholder="مثال: ضيف VIP / بدون بصل..."
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs"
                      />
                    </label>
                  </div>

                  {/* Mandatory Audit Reason */}
                  <label className="block space-y-1 text-xs font-extrabold text-zinc-950">
                    <span>سبب التعديل أو الإلغاء (إجباري للتدقيق) *</span>
                    <input
                      type="text"
                      required
                      value={modifyAuditReason}
                      onChange={(e) => setModifyAuditReason(e.target.value)}
                      placeholder="اكتب السبب بوضوح لتوثيقه في سجل الرقابة..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-xs font-bold"
                    />
                  </label>

                  {modifyError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                      {modifyError}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={modifyBusy}
                      onClick={() => handleSaveModifiedOrder(false)}
                      className="flex-1 min-h-[42px] px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
                    >
                      {modifyBusy ? 'جاري الحفظ...' : 'حفظ التعديلات في الفاتورة'}
                    </button>
                    {canCancelOpenOrders &&
                      modifyTargetOrder.status !== 'completed' &&
                      modifyTargetOrder.status !== 'cancelled' && (
                        <button
                          type="button"
                          disabled={modifyBusy}
                          onClick={() => handleSaveModifiedOrder(true)}
                          className="min-h-[42px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>إلغاء الطلب</span>
                        </button>
                      )}
                  </div>
                </>
              )}

              {Array.isArray(modifyTargetOrder.adjustmentHistory) &&
                modifyTargetOrder.adjustmentHistory.length > 0 && (
                  <div className="pt-3 border-t border-zinc-200 space-y-1.5">
                    <p className="text-[11px] font-extrabold text-zinc-600">سجل التعديلات السابقة:</p>
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {modifyTargetOrder.adjustmentHistory.map((h, i) => (
                        <div key={i} className="text-[11px] bg-zinc-50 rounded-lg px-2.5 py-1.5 text-zinc-700">
                          <strong className="text-zinc-950">{h.actorName}</strong>: {h.reason}{' '}
                          {h.details ? <span className="text-zinc-500">({h.details})</span> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
