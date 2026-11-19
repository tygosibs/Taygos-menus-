import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  ChefHat,
  Clock,
  CreditCard,
  Croissant,
  MapPin,
  Maximize2,
  Minimize2,
  Printer,
  Receipt,
  RefreshCw,
  Users,
  Utensils,
  Volume2,
  Wine,
  X,
  XCircle,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  closeTableOrdersAndSession,
  subscribeCategories,
  subscribeMenuItems,
  subscribeOwnerOrders,
  subscribeOwnerServiceCalls,
  updateOrderItemProgress,
  updateOrderStatus,
  updateServiceCallStatus,
} from '../../lib/firestoreService';
import { playOrderAlertChime, unlockAudioContext } from '../../lib/sound';
import { resolveOrderItemStation, STATION_META_MAP } from '../../lib/stationUtils';
import {
  Category,
  ItemPrepState,
  MenuItem,
  Order,
  OrderItemPayload,
  OrderStatus,
  PrepStation,
  Restaurant,
  ServiceCall,
  ServiceCallStatus,
  ServiceCallType,
} from '../../types/menu';

interface LiveOrdersTabProps {
  restaurant: Restaurant;
}

type StationView = 'cashier' | PrepStation;

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

export function LiveOrdersTab({ restaurant }: LiveOrdersTabProps) {
  const { lang, dir, t, loc, formatCurrency } = useLanguage();
  const isEn = lang === 'en';
  const currencyLabel = formatCurrency(restaurant.currency);

  const [orders, setOrders] = useState<Order[]>([]);
  const [serviceCalls, setServiceCalls] = useState<ServiceCall[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [activeStation, setActiveStation] = useState<StationView>('cashier');
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');
  const [kdsShowCompletedItems, setKdsShowCompletedItems] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updatingItemKey, setUpdatingItemKey] = useState<string | null>(null);
  const [closingTableKey, setClosingTableKey] = useState<string | null>(null);
  const [updatingCallId, setUpdatingCallId] = useState<string | null>(null);
  const [receiptModalTable, setReceiptModalTable] = useState<TableMasterGroup | null>(null);
  const [receiptModalOrder, setReceiptModalOrder] = useState<Order | null>(null);

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
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    const unsubCats = subscribeCategories(restaurant.id, setCategories);
    const unsubItems = subscribeMenuItems(restaurant.id, setMenuItems);
    return () => {
      unsubCats();
      unsubItems();
    };
  }, [restaurant.id]);

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
          let hasNewPending = false;
          incoming.forEach((o) => {
            if (!knownIdsRef.current.has(o.id)) {
              knownIdsRef.current.add(o.id);
              if (o.status === 'pending') hasNewPending = true;
            }
          });
          if (hasNewPending && soundEnabled) {
            playOrderAlertChime();
          }
        }
        setOrders(incoming);
        setLoadError(null);
        setLoading(false);
      },
      (err) => {
        setLoadError(err.message || (isEn ? 'Could not load orders.' : 'تعذر تحميل الطلبات.'));
        setLoading(false);
      }
    );

    return () => unsub();
  }, [restaurant.id, restaurant.ownerId, soundEnabled, retryKey, isEn]);

  useEffect(() => {
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
      () => {}
    );

    return () => unsub();
  }, [restaurant.id, restaurant.ownerId, soundEnabled, retryKey]);

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

  // Station KDS filtering & counts
  const stationOrdersMap = useMemo(() => {
    const res: Record<
      PrepStation,
      Array<{
        order: Order;
        items: Array<{ item: OrderItemPayload; originalIndex: number; prepState: ItemPrepState }>;
        pendingCount: number;
      }>
    > = {
      kitchen: [],
      bar: [],
      pastry: [],
    };

    activeOrders.forEach((order) => {
      const grouped: Record<
        PrepStation,
        Array<{ item: OrderItemPayload; originalIndex: number; prepState: ItemPrepState }>
      > = { kitchen: [], bar: [], pastry: [] };

      order.items.forEach((it, idx) => {
        const st = resolveOrderItemStation(it, itemMap, categoryMap);
        const prepState: ItemPrepState = order.itemProgress?.[String(idx)] || 'pending';
        grouped[st].push({ item: it, originalIndex: idx, prepState });
      });

      (['kitchen', 'bar', 'pastry'] as PrepStation[]).forEach((st) => {
        const stItems = grouped[st];
        if (stItems.length === 0) return;
        const pendingCount = stItems.filter(
          (x) => x.prepState === 'pending' || x.prepState === 'preparing'
        ).length;
        res[st].push({ order, items: stItems, pendingCount });
      });
    });

    return res;
  }, [activeOrders, itemMap, categoryMap]);

  const stationOpenCounts = useMemo(
    () => ({
      kitchen: stationOrdersMap.kitchen.filter((c) => c.pendingCount > 0).length,
      bar: stationOrdersMap.bar.filter((c) => c.pendingCount > 0).length,
      pastry: stationOrdersMap.pastry.filter((c) => c.pendingCount > 0).length,
    }),
    [stationOrdersMap]
  );

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

  const filteredOrders = useMemo(() => {
    if (filterStatus === 'all') return orders;
    return orders.filter((o) => o.status === filterStatus);
  }, [orders, filterStatus]);

  const handleToggleFullscreen = () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    if (next) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, nextStatus);
    } finally {
      setUpdatingId(null);
    }
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
        order.status === 'pending' ? 'preparing' : undefined
      );
    } finally {
      setUpdatingItemKey(null);
    }
  };

  const handleCloseTableCheck = async (group: TableMasterGroup) => {
    setClosingTableKey(group.groupKey);
    try {
      await closeTableOrdersAndSession({
        restaurantId: restaurant.id,
        orderIds: group.orderIds,
        sessionId: group.sessionId,
      });
    } finally {
      setClosingTableKey(null);
    }
  };

  const handleCallStatusChange = async (callId: string, nextStatus: ServiceCallStatus) => {
    setUpdatingCallId(callId);
    try {
      await updateServiceCallStatus(callId, nextStatus);
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

  const stationTabs: Array<{
    id: StationView;
    label: string;
    icon: typeof Receipt;
    count?: number;
  }> = [
    {
      id: 'cashier',
      label: isEn ? 'Cashier Master View' : 'شاشة الكاشير (Master)',
      icon: Receipt,
      count: activeOrders.length,
    },
    {
      id: 'kitchen',
      label: isEn ? 'Kitchen KDS' : 'شاشة المطبخ (Kitchen)',
      icon: ChefHat,
      count: stationOpenCounts.kitchen,
    },
    {
      id: 'bar',
      label: isEn ? 'Bar KDS' : 'شاشة البار (Bar)',
      icon: Wine,
      count: stationOpenCounts.bar,
    },
    {
      id: 'pastry',
      label: isEn ? 'Pastry KDS' : 'شاشة الباستري (Pastry)',
      icon: Croissant,
      count: stationOpenCounts.pastry,
    },
  ];

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
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-zinc-950">
              {isEn ? 'Multi-Station Operations & KDS' : 'شاشات التشغيل والمحطات (Cashier & Multi-KDS)'}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
              {t.admin.orders.subtitle}
              {pendingCount > 0 && (
                <span className="font-mono-num font-bold text-amber-700 ms-2">
                  · {pendingCount} {t.admin.orders.statsPending}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
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

        {/* 4 Station Tabs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
          {stationTabs.map((tab) => {
            const TabIcon = tab.icon;
            const active = activeStation === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveStation(tab.id)}
                className={`min-h-[46px] px-3.5 py-2.5 rounded-xl border text-xs font-extrabold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                  active
                    ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <TabIcon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-400' : 'text-zinc-500'}`} />
                  <span className="truncate">{tab.label}</span>
                </span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`font-mono-num text-[11px] font-extrabold px-2 py-0.5 rounded-md shrink-0 ${
                      active ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-200 text-zinc-800'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
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
        /* KITCHEN / BAR / PASTRY DEDICATED KDS SCREEN                    */
        /* ============================================================== */
        (() => {
          const stMeta = STATION_META_MAP[activeStation];
          const allStationOrders = stationOrdersMap[activeStation];
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
                            {stItems.map(({ item: it, originalIndex, prepState }) => {
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
                            })}
                          </div>

                          {order.notes && (
                            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                              {t.admin.orders.notesLabel} {order.notes}
                            </p>
                          )}
                        </div>

                        {unreadyIndices.length > 1 && (
                          <button
                            type="button"
                            disabled={updatingItemKey === batchKey}
                            onClick={() => handleMarkStationItemsReady(order, unreadyIndices)}
                            className="w-full min-h-[42px] py-2.5 px-3 rounded-xl bg-zinc-950 text-white text-xs font-extrabold hover:bg-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCheck className="w-4 h-4 text-emerald-400" />
                            <span>
                              {isEn
                                ? `Mark All ${stMeta.shortLabel_en} Items Ready`
                                : `تجهيز كل أصناف ${stMeta.shortLabel} (${unreadyIndices.length})`}
                            </span>
                          </button>
                        )}
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

                      <div className="flex items-center gap-2 pt-1">
                        {!isAck && (
                          <button
                            type="button"
                            disabled={updatingCallId === call.id}
                            onClick={() => handleCallStatusChange(call.id, 'acknowledged')}
                            className="flex-1 py-2 px-2.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                          >
                            {isEn ? 'On the Way' : 'جاري التلبية'}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={updatingCallId === call.id}
                          onClick={() => handleCallStatusChange(call.id, 'resolved')}
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
                            const st = resolveOrderItemStation(it, itemMap, categoryMap);
                            const stMeta = STATION_META_MAP[st];
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

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100">
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
                        disabled={closingTableKey === group.groupKey}
                        onClick={() => handleCloseTableCheck(group)}
                        className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCheck className="w-4 h-4" />
                        <span>
                          {closingTableKey === group.groupKey
                            ? isEn
                              ? 'Closing...'
                              : 'جاري الإغلاق...'
                            : isEn
                              ? 'Close Table Check'
                              : 'إغلاق حساب الترابيزة'}
                        </span>
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
                {isEn ? 'All Orders Ledger' : 'سجل كافة الطلبات (توصيل / استلام / أرشيف الصالة)'}
              </h3>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'all' as const, label: `${t.admin.orders.filterAll} (${orders.length})` },
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
                            const itemSt = resolveOrderItemStation(item, itemMap, categoryMap);
                            const stMeta = STATION_META_MAP[itemSt];
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
                          </div>
                          <span className="text-sm font-extrabold text-zinc-950 font-mono-num">
                            {t.admin.orders.total}: {formatMoney(order.total)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
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

                          {!isTerminal && (
                            <>
                              {order.status === 'pending' && (
                                <button
                                  type="button"
                                  disabled={updatingId === order.id}
                                  onClick={() => handleStatusChange(order.id, 'preparing')}
                                  className="flex-1 py-2 px-3 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                                >
                                  {t.admin.orders.btnStartPreparing}
                                </button>
                              )}
                              {order.status === 'preparing' && (
                                <button
                                  type="button"
                                  disabled={updatingId === order.id}
                                  onClick={() => handleStatusChange(order.id, 'completed')}
                                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{t.admin.orders.btnComplete}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={updatingId === order.id}
                                onClick={() => handleStatusChange(order.id, 'cancelled')}
                                className="py-2 px-3 rounded-xl border border-red-200 text-red-700 text-xs font-bold hover:bg-red-50 cursor-pointer flex items-center gap-1 disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>{t.admin.orders.btnCancel}</span>
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
    </div>
  );
}
