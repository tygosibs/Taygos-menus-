import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  ChefHat,
  Clock,
  CreditCard,
  Grid,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Printer,
  Scissors,
  Search,
  Send,
  Settings,
  ShoppingBag,
  Trash2,
  UserCheck,
  Utensils,
  Volume2,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useScreenUi } from '../../contexts/PlatformUiContext';
import { showOperationalNotification } from '../../lib/fcmNotificationService';
import {
  getHallTableNumbers,
  sendServiceCall,
  submitPublicOrder,
  subscribeCategories,
  subscribeHalls,
  subscribeMenuItems,
  subscribeOwnerOrders,
  subscribeOwnerServiceCalls,
  subscribeRestaurantCustomers,
  updateOrderItemProgress,
  updateServiceCallStatus,
} from '../../lib/firestoreService';
import {
  getResolvedOperationsConfig,
  getTimestampMillis,
  updateRestaurantOperationsConfig,
} from '../../lib/operationsService';
import { playOrderAlertChime, unlockAudioContext } from '../../lib/sound';
import { subscribeRestaurantStations } from '../../lib/stationsService';
import {
  buildEffectiveStations,
  getStationIconComponent,
  resolveOrderItemStation,
  STATION_META_MAP,
  StationMeta,
} from '../../lib/stationUtils';
import {
  getActivePrinterConnection,
  getSavedPrinterProfile,
  tryAutoReconnectSavedPrinter,
} from '../../lib/thermalPrinterService';
import {
  Category,
  CustomerProfile,
  Hall,
  ItemAddon,
  ItemPrepState,
  ItemSize,
  MenuItem,
  Order,
  OrderItemPayload,
  OrderType,
  PrepStation,
  Restaurant,
  RestaurantStation,
  ServiceCall,
  ServiceCallStatus,
  ServiceCallType,
  StaffActorInfo,
  TableGridColors,
} from '../../types/menu';
import { SplitCheckPrintModal } from './SplitCheckPrintModal';
import { ThermalPrinterSettingsModal } from './ThermalPrinterSettingsModal';

interface CaptainWaiterTabProps {
  restaurant: Restaurant;
  defaultHallName?: string;
  staffMode?: boolean;
  actor?: StaffActorInfo;
  onRestaurantUpdated?: (updated: Restaurant) => void;
}

interface ReadyDishEntry {
  orderId: string;
  orderNumber: string;
  hallName: string;
  tableNumber: string;
  customerName: string;
  orderType: Order['orderType'];
  itemIndex: number;
  name: string;
  sizeName?: string;
  addonNames: string[];
  quantity: number;
  guestName?: string;
  notes?: string;
  station: PrepStation;
}

export function CaptainWaiterTab({
  restaurant,
  defaultHallName,
  staffMode = false,
  actor,
  onRestaurantUpdated,
}: CaptainWaiterTabProps) {
  const { lang, dir, loc, formatCurrency } = useLanguage();
  const isEn = lang === 'en';
  const ui = useScreenUi('captain_waiter');
  const currencyLabel = formatCurrency(restaurant.currency);

  const opsConfig = useMemo(() => getResolvedOperationsConfig(restaurant), [restaurant]);
  const showCaptainPrices =
    !staffMode || actor?.role === 'owner' || Boolean(opsConfig.showPricesByRole.captain);

  const [captainMode, setCaptainMode] = useState<'grid' | 'pos' | 'calls'>('grid');
  const [serviceCalls, setServiceCalls] = useState<ServiceCall[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [dynamicStations, setDynamicStations] = useState<RestaurantStation[]>([]);
  const [selectedHall, setSelectedHall] = useState<string>(() => defaultHallName?.trim() || 'all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [updatingCallId, setUpdatingCallId] = useState<string | null>(null);
  const [servingKey, setServingKey] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Floor Grid Settings & Table Drawer state
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);
  const [colorDraft, setColorDraft] = useState<TableGridColors>(opsConfig.tableColors);
  const [overdueDraft, setOverdueDraft] = useState<number>(opsConfig.tableOverdueMinutes);
  const [savingGridSettings, setSavingGridSettings] = useState(false);
  const [selectedTableDrawer, setSelectedTableDrawer] = useState<{
    hallName: string;
    tableNumber: string;
  } | null>(null);
  const [requestingBillBusy, setRequestingBillBusy] = useState(false);
  const [drawerNotice, setDrawerNotice] = useState<string | null>(null);

  // Text-Only Fast Captain Order Pad (no images)
  const [posOrderType, setPosOrderType] = useState<OrderType>('dine_in');
  const [posHallName, setPosHallName] = useState<string>(() => defaultHallName?.trim() || '');
  const [posTableNumber, setPosTableNumber] = useState<string>('');
  const [posCustomerName, setPosCustomerName] = useState<string>('');
  const [posCustomerPhone, setPosCustomerPhone] = useState<string>('');
  const [posDeliveryAddress, setPosDeliveryAddress] = useState<string>('');
  const [posOrderNotes, setPosOrderNotes] = useState<string>('');
  const [posSelectedCatId, setPosSelectedCatId] = useState<string>('all');
  const [posSearchQuery, setPosSearchQuery] = useState<string>('');
  const [posCart, setPosCart] = useState<
    Array<{
      key: string;
      item: MenuItem;
      size?: ItemSize;
      addons: ItemAddon[];
      quantity: number;
      notes?: string;
      unitPrice: number;
    }>
  >([]);
  const [posPickerItem, setPosPickerItem] = useState<MenuItem | null>(null);
  const [posPickerSize, setPosPickerSize] = useState<ItemSize | undefined>(undefined);
  const [posPickerAddons, setPosPickerAddons] = useState<ItemAddon[]>([]);
  const [posPickerNotes, setPosPickerNotes] = useState<string>('');
  const [posSubmitting, setPosSubmitting] = useState(false);
  const [posFeedback, setPosFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [printerStatusLabel, setPrinterStatusLabel] = useState<string>(() => {
    const conn = getActivePrinterConnection();
    if (conn.connected && conn.name) return conn.name;
    return getSavedPrinterProfile()?.name || '';
  });
  const [splitCheckOrder, setSplitCheckOrder] = useState<Order | null>(null);

  const callsInitRef = useRef(false);
  const knownCallIdsRef = useRef<Set<string>>(new Set());
  const readyInitRef = useRef(false);
  const knownReadyKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setColorDraft(opsConfig.tableColors);
    setOverdueDraft(opsConfig.tableOverdueMinutes);
  }, [opsConfig]);

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
    const unsubHalls = subscribeHalls(
      restaurant.id,
      setHalls,
      () => {}
    );
    const unsubCustomers = subscribeRestaurantCustomers(
      restaurant.id,
      restaurant.ownerId,
      setCustomers,
      () => {}
    );
    return () => {
      unsubCats();
      unsubItems();
      unsubStations();
      unsubHalls();
      unsubCustomers();
    };
  }, [restaurant.id, restaurant.ownerId]);

  useEffect(() => {
    if (defaultHallName?.trim()) {
      setSelectedHall(defaultHallName.trim());
      setPosHallName(defaultHallName.trim());
    }
  }, [defaultHallName]);

  useEffect(() => {
    if (!posHallName && halls.length > 0) {
      setPosHallName(halls[0].name);
    }
  }, [halls, posHallName]);

  useEffect(() => {
    callsInitRef.current = false;
    knownCallIdsRef.current = new Set();

    const unsubCalls = subscribeOwnerServiceCalls(
      restaurant.id,
      restaurant.ownerId,
      (incoming) => {
        if (!callsInitRef.current) {
          incoming.forEach((c) => knownCallIdsRef.current.add(c.id));
          callsInitRef.current = true;
        } else {
          const newPendingCalls: ServiceCall[] = [];
          incoming.forEach((c) => {
            if (!knownCallIdsRef.current.has(c.id)) {
              knownCallIdsRef.current.add(c.id);
              if (c.status === 'pending') newPendingCalls.push(c);
            }
          });
          if (newPendingCalls.length > 0) {
            if (soundEnabled) playOrderAlertChime();
            if (staffMode) {
              const firstCall = newPendingCalls[0];
              void showOperationalNotification({
                title: `نداء طاولة ${firstCall.tableNumber}`,
                body: `${firstCall.hallName ? `${firstCall.hallName} · ` : ''}${firstCall.guestName}`,
                url: `/staff/${restaurant.slug}`,
                tag: `call_${firstCall.id}`,
              });
            }
          }
        }
        setServiceCalls(incoming);
      },
      () => {},
      { staffMode }
    );

    readyInitRef.current = false;
    knownReadyKeysRef.current = new Set();

    const unsubOrders = subscribeOwnerOrders(
      restaurant.id,
      restaurant.ownerId,
      (incoming) => {
        const currentReadyKeys = new Set<string>();
        incoming.forEach((o) => {
          if (o.status === 'completed' || o.status === 'cancelled') return;
          o.items.forEach((_, idx) => {
            if (o.itemProgress?.[String(idx)] === 'ready') {
              currentReadyKeys.add(`${o.id}:${idx}`);
            }
          });
        });

        if (!readyInitRef.current) {
          knownReadyKeysRef.current = currentReadyKeys;
          readyInitRef.current = true;
        } else {
          let hasNewReady = false;
          currentReadyKeys.forEach((key) => {
            if (!knownReadyKeysRef.current.has(key)) {
              hasNewReady = true;
            }
          });
          knownReadyKeysRef.current = currentReadyKeys;
          if (hasNewReady) {
            if (soundEnabled) playOrderAlertChime();
            if (staffMode) {
              void showOperationalNotification({
                title: 'صنف جاهز للاستلام!',
                body: 'أحد الأقسام جهّز أصنافاً جديدة بانتظار التقديم للطاولة.',
                url: `/staff/${restaurant.slug}`,
                tag: `ready_${Date.now()}`,
              });
            }
          }
        }
        setOrders(incoming);
      },
      () => {},
      { staffMode }
    );

    return () => {
      unsubCalls();
      unsubOrders();
    };
  }, [restaurant.id, restaurant.ownerId, restaurant.slug, soundEnabled, staffMode]);

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

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const itemMap = useMemo(
    () => new Map(menuItems.map((m) => [m.id, m])),
    [menuItems]
  );

  const hallFilterOptions = useMemo(() => {
    const names = new Set<string>();
    halls.forEach((h) => {
      if (h.name.trim()) names.add(h.name.trim());
    });
    serviceCalls.forEach((c) => {
      if (c.status !== 'resolved' && c.hallName?.trim()) names.add(c.hallName.trim());
    });
    orders.forEach((o) => {
      if (o.status !== 'completed' && o.status !== 'cancelled' && o.hallName?.trim()) {
        names.add(o.hallName.trim());
      }
    });
    return Array.from(names);
  }, [halls, serviceCalls, orders]);

  const activeCalls = useMemo(() => {
    return serviceCalls.filter((c) => {
      if (c.status === 'resolved') return false;
      if (selectedHall !== 'all' && (c.hallName || '').trim() !== selectedHall) return false;
      return true;
    });
  }, [serviceCalls, selectedHall]);

  const readyDishes = useMemo<ReadyDishEntry[]>(() => {
    const list: ReadyDishEntry[] = [];
    orders.forEach((order) => {
      if (order.status === 'completed' || order.status === 'cancelled') return;
      if (selectedHall !== 'all' && (order.hallName || '').trim() !== selectedHall) return;

      order.items.forEach((it, idx) => {
        const state = order.itemProgress?.[String(idx)] || 'pending';
        if (state === 'ready') {
          list.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            hallName: order.hallName || '',
            tableNumber: order.tableNumber || '',
            customerName: order.customerName,
            orderType: order.orderType,
            itemIndex: idx,
            name: it.name,
            sizeName: it.sizeName,
            addonNames: it.addonNames || [],
            quantity: it.quantity,
            guestName: it.guestName,
            notes: it.notes,
            station: resolveOrderItemStation(
              it,
              itemMap,
              categoryMap,
              effectiveStations[0]?.stationId || 'kitchen'
            ),
          });
        }
      });
    });
    return list;
  }, [orders, selectedHall, itemMap, categoryMap, effectiveStations]);

  const readyGroupedByOrder = useMemo(() => {
    const map = new Map<
      string,
      {
        orderId: string;
        orderNumber: string;
        hallName: string;
        tableNumber: string;
        customerName: string;
        orderType: Order['orderType'];
        entries: ReadyDishEntry[];
      }
    >();
    readyDishes.forEach((entry) => {
      const existingGroup = map.get(entry.orderId);
      if (existingGroup) {
        existingGroup.entries.push(entry);
      } else {
        map.set(entry.orderId, {
          orderId: entry.orderId,
          orderNumber: entry.orderNumber,
          hallName: entry.hallName,
          tableNumber: entry.tableNumber,
          customerName: entry.customerName,
          orderType: entry.orderType,
          entries: [entry],
        });
      }
    });
    return Array.from(map.values());
  }, [readyDishes]);

  const handleToggleFullscreen = () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    if (next) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleCallStatus = async (call: ServiceCall, nextStatus: ServiceCallStatus) => {
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

  const handleMarkItemServed = async (
    orderId: string,
    orderNumber: string,
    itemIndices: number[]
  ) => {
    const key = `${orderId}:${itemIndices.join(',')}`;
    setServingKey(key);
    try {
      const updates: Record<string, ItemPrepState> = {};
      itemIndices.forEach((idx) => {
        updates[String(idx)] = 'served';
      });
      await updateOrderItemProgress(orderId, updates, undefined, {
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        orderNumber,
        actor,
      });
    } finally {
      setServingKey(null);
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
        label: isEn ? 'Bill Request (Cash)' : 'طلب الشيك (كاش)',
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        Icon: Banknote,
      };
    }
    if (type === 'request_bill_card') {
      return {
        label: isEn ? 'Bill Request (Visa / Card)' : 'طلب الشيك (فيزا)',
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

  // Build Floor Grid Hall sections
  const gridHalls = useMemo(() => {
    const filtered =
      selectedHall === 'all' ? halls : halls.filter((h) => h.name.trim() === selectedHall);
    return filtered.map((h) => ({
      hall: h,
      tableNumbers: getHallTableNumbers(h),
    }));
  }, [halls, selectedHall]);

  const getTableSnapshot = (hallName: string, tableNumber: string) => {
    const cleanTbl = tableNumber.trim();
    const cleanHall = hallName.trim();
    const tblOrders = orders.filter(
      (o) =>
        o.status !== 'completed' &&
        o.status !== 'cancelled' &&
        o.orderType === 'dine_in' &&
        (o.tableNumber || '').trim() === cleanTbl &&
        (!o.hallName || o.hallName.trim() === cleanHall)
    );
    const tblCalls = serviceCalls.filter(
      (c) =>
        c.status !== 'resolved' &&
        (c.tableNumber || '').trim() === cleanTbl &&
        (!c.hallName || c.hallName.trim() === cleanHall)
    );
    const hasBillRequest = tblCalls.some(
      (c) => c.callType === 'request_bill_cash' || c.callType === 'request_bill_card'
    );

    let oldestMs = 0;
    tblOrders.forEach((o) => {
      const ms = getTimestampMillis(o.createdAt);
      if (ms > 0 && (oldestMs === 0 || ms < oldestMs)) oldestMs = ms;
    });
    const elapsedMins = oldestMs > 0 ? Math.max(0, Math.floor((nowTick - oldestMs) / 60000)) : 0;
    const isOverdue = tblOrders.length > 0 && elapsedMins >= opsConfig.tableOverdueMinutes;

    const state: 'empty' | 'occupied' | 'billRequested' | 'overdue' = isOverdue
      ? 'overdue'
      : hasBillRequest
        ? 'billRequested'
        : tblOrders.length > 0
          ? 'occupied'
          : 'empty';

    const total = tblOrders.reduce((s, o) => s + (o.total || 0), 0);
    const itemsCount = tblOrders.reduce(
      (s, o) => s + o.items.reduce((isum, it) => isum + it.quantity, 0),
      0
    );

    return { tblOrders, tblCalls, elapsedMins, state, total, itemsCount };
  };

  const handleSaveGridSettings = async () => {
    setSavingGridSettings(true);
    try {
      const nextConfig = {
        ...opsConfig,
        tableColors: { ...colorDraft },
        tableOverdueMinutes: Math.max(10, Math.min(1440, Math.round(Number(overdueDraft) || 120))),
      };
      await updateRestaurantOperationsConfig({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        config: nextConfig,
        actor,
      });
      onRestaurantUpdated?.({ ...restaurant, operationsConfig: nextConfig });
      setGridSettingsOpen(false);
    } finally {
      setSavingGridSettings(false);
    }
  };

  const handleRequestBillFromDrawer = async (
    hallName: string,
    tableNumber: string,
    type: 'request_bill_cash' | 'request_bill_card'
  ) => {
    setRequestingBillBusy(true);
    setDrawerNotice(null);
    try {
      await sendServiceCall({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        hallName,
        tableNumber,
        guestName: actor?.name || 'الكابتن',
        callType: type,
      });
      setDrawerNotice(
        type === 'request_bill_cash'
          ? 'تم إرسال طلب الشيك (كاش) للكاشير.'
          : 'تم إرسال طلب الشيك (فيزا) للكاشير.'
      );
    } finally {
      setRequestingBillBusy(false);
    }
  };

  // POS Helpers (text-only)
  const matchingCustomers = useMemo(() => {
    const q = posCustomerPhone.trim();
    if (q.length < 3 || posOrderType === 'dine_in') return [];
    return customers.filter((c) => c.phone.includes(q) || c.fullName.includes(q)).slice(0, 5);
  }, [customers, posCustomerPhone, posOrderType]);

  const posFilteredItems = useMemo(() => {
    const q = posSearchQuery.trim().toLowerCase();
    return menuItems.filter((item) => {
      if (item.isAvailable === false) return false;
      if (posSelectedCatId !== 'all' && item.categoryId !== posSelectedCatId) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.name_en || '').toLowerCase().includes(q)
      );
    });
  }, [menuItems, posSelectedCatId, posSearchQuery]);

  const handlePosAddItem = (
    item: MenuItem,
    size?: ItemSize,
    addons: ItemAddon[] = [],
    notes?: string
  ) => {
    const unitPrice = Number(
      (
        (size ? size.price : item.basePrice) +
        addons.reduce((s, a) => s + (a.price || 0), 0)
      ).toFixed(2)
    );
    const addonKey = addons
      .map((a) => a.name)
      .sort()
      .join(',');
    const cleanNote = (notes || '').trim();
    const cartKey = `${item.id}::${size?.name || ''}::${addonKey}::${cleanNote}`;

    setPosCart((prev) => {
      const existing = prev.find((p) => p.key === cartKey);
      if (existing) {
        return prev.map((p) => (p.key === cartKey ? { ...p, quantity: p.quantity + 1 } : p));
      }
      return [
        ...prev,
        {
          key: cartKey,
          item,
          size,
          addons,
          quantity: 1,
          notes: cleanNote || undefined,
          unitPrice,
        },
      ];
    });
  };

  const posTotals = useMemo(() => {
    const subtotal = Number(
      posCart.reduce((s, c) => s + c.unitPrice * c.quantity, 0).toFixed(2)
    );
    const serviceCharge =
      posOrderType === 'dine_in'
        ? Number(((subtotal * (restaurant.serviceCharge || 0)) / 100).toFixed(2))
        : 0;
    const deliveryFee =
      posOrderType === 'delivery' ? Number(restaurant.deliveryFee || 0) : 0;
    const taxAmount = Number(
      (((subtotal + serviceCharge) * (restaurant.taxRate || 0)) / 100).toFixed(2)
    );
    const total = Number((subtotal + serviceCharge + taxAmount + deliveryFee).toFixed(2));
    return { subtotal, serviceCharge, deliveryFee, taxAmount, total };
  }, [posCart, posOrderType, restaurant.serviceCharge, restaurant.deliveryFee, restaurant.taxRate]);

  const handleSubmitCaptainOrder = async () => {
    setPosFeedback(null);
    if (posCart.length === 0) {
      setPosFeedback({ type: 'err', text: 'أضف صنفاً واحداً على الأقل قبل الإرسال.' });
      return;
    }
    if (posOrderType === 'dine_in' && !posTableNumber.trim()) {
      setPosFeedback({ type: 'err', text: 'يرجى تحديد رقم الترابيزة لطلب الصالة.' });
      return;
    }
    if (posOrderType !== 'dine_in' && !posCustomerName.trim()) {
      setPosFeedback({ type: 'err', text: 'يرجى إدخال اسم العميل للطلب.' });
      return;
    }

    setPosSubmitting(true);
    try {
      const fallbackStation = effectiveStations[0]?.stationId || 'kitchen';
      const orderItems: OrderItemPayload[] = posCart.map((entry) => {
        const st = resolveOrderItemStation(
          {
            menuItemId: entry.item.id,
            name: entry.item.name,
            addonNames: entry.addons.map((a) => a.name),
            quantity: entry.quantity,
            unitPrice: entry.unitPrice,
            lineTotal: entry.unitPrice * entry.quantity,
            station: entry.item.station || entry.item.stationId,
            stationId: entry.item.stationId || entry.item.station,
          },
          itemMap,
          categoryMap,
          fallbackStation
        );
        return {
          menuItemId: entry.item.id,
          name: entry.item.name,
          ...(entry.size ? { sizeName: entry.size.name } : {}),
          addonNames: entry.addons.map((a) => a.name),
          quantity: entry.quantity,
          unitPrice: entry.unitPrice,
          lineTotal: Number((entry.unitPrice * entry.quantity).toFixed(2)),
          ...(entry.notes ? { notes: entry.notes } : {}),
          station: st,
          stationId: st,
        };
      });

      const res = await submitPublicOrder({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        customerName:
          posOrderType === 'dine_in'
            ? posCustomerName.trim() || `كابتن (${actor?.name || 'صالة'})`
            : posCustomerName.trim(),
        customerPhone: posCustomerPhone.trim() || '000000',
        orderType: posOrderType,
        hallName: posOrderType === 'dine_in' ? posHallName.trim() : undefined,
        tableNumber: posOrderType === 'dine_in' ? posTableNumber.trim() : undefined,
        deliveryAddress: posOrderType === 'delivery' ? posDeliveryAddress.trim() : undefined,
        notes: posOrderNotes.trim() || undefined,
        items: orderItems,
        subtotal: posTotals.subtotal,
        serviceCharge: posTotals.serviceCharge,
        deliveryFee: posTotals.deliveryFee,
        taxAmount: posTotals.taxAmount,
        total: posTotals.total,
        actor,
      });

      setPosCart([]);
      setPosOrderNotes('');
      setPosFeedback({
        type: 'ok',
        text: `تم إرسال الطلب #${res.orderNumber} إلى المحطات والكاشير بنجاح.`,
      });
    } catch (err) {
      setPosFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذر إرسال الطلب.',
      });
    } finally {
      setPosSubmitting(false);
    }
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
      {/* Captain Screen Header & Controls */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-zinc-950 text-amber-400 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-zinc-950">
              {isEn ? 'Captain & Waiter Floor Screen' : 'شاشة الكابتن (الويتر) وخدمة الصالة'}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
              {isEn
                ? 'Live table calls paired with ready dishes & drinks waiting for table delivery.'
                : 'تنبيهات نداء الطاولات لحظياً مع قائمة الأصناف الجاهزة للاستلام من المطبخ والبار والباستري.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
            <span>{printerStatusLabel ? `طابعة: ${printerStatusLabel}` : isEn ? 'Printer' : 'طابعة حرارية'}</span>
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
            <span>{isEn ? 'Test Alert' : 'تجربة الصوت'}</span>
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
            <span>{soundEnabled ? (isEn ? 'Sound ON' : 'الصوت مفعّل') : isEn ? 'Muted' : 'صامت'}</span>
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
            <span>{isFullscreen ? (isEn ? 'Exit Fullscreen' : 'خروج من ملء الشاشة') : isEn ? 'Full Screen' : 'ملء الشاشة'}</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs: Interactive Table Grid (Default), Text-Only Order Pad, Alerts & Ready Dishes */}
      <div
        className={`border p-2 flex flex-wrap items-center justify-between gap-2 ${ui.radiusClasses.card}`}
        style={{
          backgroundColor: ui.theme.surfaceBg,
          borderColor: ui.theme.surfaceBorder,
          boxShadow: ui.theme.cardShadow,
        }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {(() => {
            const tabMap = {
              grid: {
                id: 'grid' as const,
                label: ui.getButtonLabel(
                  'grid',
                  lang,
                  isEn ? 'Live Table Map' : 'خريطة الترابيزات الحية'
                ),
                Icon: Grid,
                badge: undefined as number | undefined,
              },
              pos: {
                id: 'pos' as const,
                label: ui.getButtonLabel(
                  'pos',
                  lang,
                  isEn ? 'Captain Order Pad (No Photos)' : 'نقطة طلب الكابتن (بدون صور)'
                ),
                Icon: ShoppingBag,
                badge:
                  posCart.length > 0
                    ? posCart.reduce((s, x) => s + x.quantity, 0)
                    : undefined,
              },
              calls: {
                id: 'calls' as const,
                label: ui.getButtonLabel(
                  'calls',
                  lang,
                  isEn ? 'Calls & Ready Dishes' : 'النداءات والأصناف الجاهزة'
                ),
                Icon: BellRing,
                badge:
                  activeCalls.length + readyDishes.length > 0
                    ? activeCalls.length + readyDishes.length
                    : undefined,
              },
            };
            const orderedIds = ui.orderedButtonIds.filter(
              (id): id is 'grid' | 'pos' | 'calls' => id === 'grid' || id === 'pos' || id === 'calls'
            );
            const list = (orderedIds.length > 0 ? orderedIds : (['grid', 'pos', 'calls'] as const)).map(
              (id) => tabMap[id]
            );
            return list.map((tItem) => {
              const TabIcon = tItem.Icon;
              const active = captainMode === tItem.id;
              return (
                <button
                  key={tItem.id}
                  type="button"
                  onClick={() => setCaptainMode(tItem.id)}
                  className={`min-h-[40px] px-3.5 py-2 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer border transition-colors ${ui.radiusClasses.button}`}
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
                  <TabIcon className="w-4 h-4 shrink-0" />
                  <span>{tItem.label}</span>
                  {tItem.badge !== undefined && (
                    <span
                      className="font-mono-num px-1.5 py-0.5 rounded text-[10px] font-extrabold"
                      style={{
                        backgroundColor: active ? ui.theme.accentTextHex : ui.theme.accentHex,
                        color: active ? ui.theme.accentHex : ui.theme.accentTextHex,
                      }}
                    >
                      {tItem.badge}
                    </span>
                  )}
                </button>
              );
            });
          })()}
        </div>

        {captainMode === 'grid' && (
          <button
            type="button"
            onClick={() => setGridSettingsOpen(true)}
            className={`min-h-[38px] px-3 py-1.5 border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
            style={{
              backgroundColor: ui.theme.surfaceSubtleBg,
              borderColor: ui.theme.surfaceBorder,
              color: ui.theme.surfaceText,
            }}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{isEn ? 'Grid Colors & SLA' : 'ألوان الترابيزات ووقت التأخير'}</span>
          </button>
        )}
      </div>

      {/* Live Hall Filter Strip */}
      {captainMode !== 'pos' && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setSelectedHall('all')}
            className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
              selectedHall === 'all'
                ? 'bg-zinc-950 text-white'
                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            {isEn ? 'All Halls / Zones' : 'كل الصالات'}
          </button>
          {hallFilterOptions.map((hName) => (
            <button
              key={hName}
              type="button"
              onClick={() => setSelectedHall(hName)}
              className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                selectedHall === hName
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{hName}</span>
            </button>
          ))}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1: INTERACTIVE LIVE TABLE GRID (DEFAULT)                   */}
      {/* ============================================================== */}
      {captainMode === 'grid' && (
        <div className="space-y-4">
          {gridHalls.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center space-y-2">
              <Grid className="w-8 h-8 text-zinc-300 mx-auto" />
              <h3 className="text-sm font-extrabold text-zinc-900">
                لا توجد صالات مضافة بعد
              </h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                أضف الصالات وأرقام الترابيزات من تبويب الصالات و QR، أو استخدم نقطة طلب الكابتن لتسجيل الطلبات مباشرة.
              </p>
            </div>
          ) : (
            gridHalls.map(({ hall, tableNumbers }) => (
              <section key={hall.id} className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-extrabold text-zinc-950">
                      {loc(hall.name, hall.name_en)}
                    </h3>
                    {hall.hallType && (
                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 text-[11px] font-bold">
                        {hall.hallType}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono-num text-zinc-500 font-bold">
                    {tableNumbers.length} ترابيزة
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                  {tableNumbers.map((tblNum) => {
                    const snap = getTableSnapshot(hall.name, tblNum);
                    const tileColor = opsConfig.tableColors[snap.state];
                    return (
                      <button
                        key={`${hall.id}_${tblNum}`}
                        type="button"
                        onClick={() => {
                          setDrawerNotice(null);
                          setSelectedTableDrawer({ hallName: hall.name, tableNumber: tblNum });
                        }}
                        style={{ backgroundColor: tileColor }}
                        className="rounded-2xl p-3 text-white shadow-xs hover:opacity-95 transition-transform active:scale-[0.98] flex flex-col items-center justify-between min-h-[92px] cursor-pointer relative overflow-hidden"
                      >
                        <div className="w-full flex items-center justify-between text-[10px] font-extrabold opacity-90">
                          <span>
                            {snap.state === 'empty'
                              ? 'شاغرة'
                              : snap.state === 'billRequested'
                                ? 'شيك'
                                : snap.state === 'overdue'
                                  ? 'متأخرة'
                                  : 'مشغولة'}
                          </span>
                          {snap.elapsedMins > 0 && (
                            <span className="font-mono-num">{snap.elapsedMins}د</span>
                          )}
                        </div>

                        <span className="text-xl font-extrabold font-mono-num tracking-tight">
                          {tblNum}
                        </span>

                        <div className="text-[10px] font-bold opacity-95 truncate w-full text-center">
                          {snap.itemsCount > 0
                            ? showCaptainPrices
                              ? `${snap.itemsCount} صنف · ${formatMoney(snap.total)}`
                              : `${snap.itemsCount} صنف`
                            : 'جاهزة للجلوس'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          )}

          {/* Bottom Color Legend */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-zinc-700">
            <span className="text-[11px] font-extrabold text-zinc-500">دليل الألوان:</span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-3.5 h-3.5 rounded-sm inline-block"
                style={{ backgroundColor: opsConfig.tableColors.empty }}
              />
              <span>شاغرة</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-3.5 h-3.5 rounded-sm inline-block"
                style={{ backgroundColor: opsConfig.tableColors.occupied }}
              />
              <span>مشغولة</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-3.5 h-3.5 rounded-sm inline-block"
                style={{ backgroundColor: opsConfig.tableColors.billRequested }}
              />
              <span>طلب الشيك</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-3.5 h-3.5 rounded-sm inline-block"
                style={{ backgroundColor: opsConfig.tableColors.overdue }}
              />
              <span>متأخرة (+{opsConfig.tableOverdueMinutes} د)</span>
            </span>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: TEXT-ONLY FAST CAPTAIN ORDER PAD (ZERO IMAGES)          */}
      {/* ============================================================== */}
      {captainMode === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
            {/* Search & Categories */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={posSearchQuery}
                  onChange={(e) => setPosSearchQuery(e.target.value)}
                  placeholder="ابحث عن صنف بالاسم للطلب السريع..."
                  className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setPosSelectedCatId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap cursor-pointer ${
                  posSelectedCatId === 'all'
                    ? 'bg-zinc-950 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                كل الأقسام ({menuItems.filter((m) => m.isAvailable !== false).length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setPosSelectedCatId(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap cursor-pointer ${
                    posSelectedCatId === cat.id
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {loc(cat.name, cat.name_en)}
                </button>
              ))}
            </div>

            {/* Text-Only Compact Menu Buttons (NO images) */}
            {posFilteredItems.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-8">
                لا توجد أصناف متاحة تطابق البحث الآن.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {posFilteredItems.map((item) => {
                  const hasOptions = item.sizes.length > 0 || item.addons.length > 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (hasOptions) {
                          setPosPickerItem(item);
                          setPosPickerSize(item.sizes[0]);
                          setPosPickerAddons([]);
                          setPosPickerNotes('');
                        } else {
                          handlePosAddItem(item);
                        }
                      }}
                      className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-amber-50 hover:border-amber-300 text-start transition-colors flex flex-col justify-between gap-1.5 min-h-[76px] cursor-pointer"
                    >
                      <span className="text-xs font-extrabold text-zinc-950 line-clamp-2 leading-snug">
                        {loc(item.name, item.name_en)}
                      </span>
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        {showCaptainPrices ? (
                          <span className="font-mono-num font-extrabold text-amber-800">
                            {formatMoney(item.sizes[0]?.price ?? item.basePrice)}
                          </span>
                        ) : (
                          <span className="text-zinc-500 font-bold">+ أضف</span>
                        )}
                        {hasOptions && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-zinc-200 text-zinc-600 font-bold">
                            خيارات
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel: Order Destination + Cart */}
          <div className="lg:col-span-4 bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'dine_in' as const, label: 'صالة' },
                  { id: 'pickup' as const, label: 'استلام' },
                  { id: 'delivery' as const, label: 'توصيل' },
                ] as const
              ).map((ot) => (
                <button
                  key={ot.id}
                  type="button"
                  onClick={() => setPosOrderType(ot.id)}
                  className={`py-2 rounded-xl border text-xs font-extrabold cursor-pointer ${
                    posOrderType === ot.id
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                  }`}
                >
                  {ot.label}
                </button>
              ))}
            </div>

            {posOrderType === 'dine_in' ? (
              <div className="grid grid-cols-2 gap-2">
                {halls.length > 0 ? (
                  <select
                    value={posHallName}
                    onChange={(e) => setPosHallName(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold bg-white"
                  >
                    {halls.map((h) => (
                      <option key={h.id} value={h.name}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="الصالة"
                    value={posHallName}
                    onChange={(e) => setPosHallName(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold"
                  />
                )}
                <input
                  type="text"
                  placeholder="رقم الترابيزة *"
                  value={posTableNumber}
                  onChange={(e) => setPosTableNumber(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono-num font-extrabold"
                />
                <input
                  type="text"
                  placeholder="اسم الضيف (اختياري)"
                  value={posCustomerName}
                  onChange={(e) => setPosCustomerName(e.target.value)}
                  className="col-span-2 px-3 py-2 rounded-xl border border-zinc-200 text-xs"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="هاتف العميل (بحث أو تسجيل)"
                  value={posCustomerPhone}
                  onChange={(e) => setPosCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-mono-num"
                />
                {matchingCustomers.length > 0 && (
                  <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 bg-zinc-50">
                    {matchingCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setPosCustomerName(c.fullName);
                          setPosCustomerPhone(c.phone);
                          if (c.address) setPosDeliveryAddress(c.address);
                        }}
                        className="w-full px-3 py-1.5 text-start text-[11px] hover:bg-amber-50 flex justify-between cursor-pointer"
                      >
                        <span className="font-bold text-zinc-900">{c.fullName}</span>
                        <span className="font-mono-num text-zinc-500">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  placeholder="اسم العميل *"
                  value={posCustomerName}
                  onChange={(e) => setPosCustomerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold"
                />
                {posOrderType === 'delivery' && (
                  <input
                    type="text"
                    placeholder="عنوان التوصيل"
                    value={posDeliveryAddress}
                    onChange={(e) => setPosDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs"
                  />
                )}
              </div>
            )}

            {/* Cart Items */}
            <div className="border-t border-zinc-100 pt-3 space-y-2 max-h-60 overflow-y-auto">
              {posCart.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-4">
                  اضغط على أي صنف من القائمة لإضافته للأوردر
                </p>
              ) : (
                posCart.map((c) => (
                  <div
                    key={c.key}
                    className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-extrabold text-zinc-900 truncate">
                        {c.item.name} {c.size ? `(${c.size.name})` : ''}
                      </p>
                      {c.addons.length > 0 && (
                        <p className="text-[10px] text-zinc-500 truncate">
                          + {c.addons.map((a) => a.name).join('، ')}
                        </p>
                      )}
                      {c.notes && (
                        <p className="text-[10px] text-amber-800 font-bold truncate">{c.notes}</p>
                      )}
                      {showCaptainPrices && (
                        <p className="text-[11px] font-mono-num text-zinc-600">
                          {formatMoney(c.unitPrice * c.quantity)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setPosCart((prev) =>
                            prev
                              .map((x) =>
                                x.key === c.key ? { ...x, quantity: x.quantity - 1 } : x
                              )
                              .filter((x) => x.quantity > 0)
                          )
                        }
                        className="w-7 h-7 rounded-lg bg-white border border-zinc-300 flex items-center justify-center cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono-num font-extrabold w-5 text-center">
                        {c.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPosCart((prev) =>
                            prev.map((x) =>
                              x.key === c.key ? { ...x, quantity: x.quantity + 1 } : x
                            )
                          )
                        }
                        className="w-7 h-7 rounded-lg bg-white border border-zinc-300 flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPosCart((prev) => prev.filter((x) => x.key !== c.key))}
                        className="w-7 h-7 rounded-lg text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <input
              type="text"
              placeholder="ملاحظات على الأوردر (اختياري)"
              value={posOrderNotes}
              onChange={(e) => setPosOrderNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs"
            />

            {showCaptainPrices && posCart.length > 0 && (
              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1 text-xs">
                <div className="flex justify-between text-zinc-600">
                  <span>المجموع الفرعي:</span>
                  <span className="font-mono-num font-bold">{formatMoney(posTotals.subtotal)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-zinc-950 text-sm pt-1 border-t border-zinc-200">
                  <span>الإجمالي:</span>
                  <span className="font-mono-num">{formatMoney(posTotals.total)}</span>
                </div>
              </div>
            )}

            {posFeedback && (
              <div
                className={`p-2.5 rounded-xl text-xs font-bold border ${
                  posFeedback.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {posFeedback.text}
              </div>
            )}

            <button
              type="button"
              disabled={posSubmitting || posCart.length === 0}
              onClick={handleSubmitCaptainOrder}
              className="w-full min-h-[44px] rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4 text-amber-400" />
              <span>{posSubmitting ? 'جاري الإرسال...' : 'إرسال الطلب للمحطات 🚀'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: CALLS & READY DISHES                                    */}
      {/* ============================================================== */}
      {captainMode === 'calls' && (
        <>
          {/* KPI Quick Strip */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-zinc-500">
                  {isEn ? 'Active Table Calls' : 'نداءات الطاولات النشطة'}
                </p>
                <p className="text-2xl font-extrabold font-mono-num text-zinc-950 mt-0.5">
                  {activeCalls.length}
                </p>
              </div>
              <span className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <BellRing className="w-5 h-5" />
              </span>
            </div>

            <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-zinc-500">
                  {isEn ? 'Dishes Ready to Serve' : 'أصناف جاهزة للتقديم'}
                </p>
                <p className="text-2xl font-extrabold font-mono-num text-emerald-700 mt-0.5">
                  {readyDishes.length}
                </p>
              </div>
              <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCheck className="w-5 h-5" />
              </span>
            </div>
          </div>

          {/* Section 1: Table Service Calls */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-zinc-950 flex items-center gap-2">
                <BellRing className="w-4 h-4 text-amber-600" />
                <span>{isEn ? 'Table Service Requests' : 'تنبيهات النداء وطلبات الشيك'}</span>
              </h3>
            </div>

        {activeCalls.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-center text-xs text-zinc-500">
            {isEn
              ? 'No pending waiter calls right now.'
              : 'لا توجد نداءات معلّقة من الترابيزات حالياً.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeCalls.map((call) => {
              const meta = getCallMeta(call.callType);
              const CallIcon = meta.Icon;
              const isAck = call.status === 'acknowledged';
              return (
                <div
                  key={call.id}
                  className={`bg-white rounded-2xl border p-4 space-y-3 shadow-2xs ${
                    isAck ? 'border-blue-200' : 'border-amber-300 ring-2 ring-amber-200/60'
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
                      <p className="text-sm font-extrabold text-zinc-950 flex items-center gap-1.5 pt-1">
                        <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="truncate">
                          {call.hallName ? `${call.hallName} · ` : ''}
                          {isEn ? `Table ${call.tableNumber}` : `ترابيزة ${call.tableNumber}`}
                        </span>
                      </p>
                      <p className="text-xs text-zinc-600">
                        {isEn ? 'Guest:' : 'العميل:'}{' '}
                        <strong className="text-zinc-950">{call.guestName}</strong>
                      </p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                        isAck
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isAck ? (isEn ? 'Heading there' : 'جاري التوجه') : isEn ? 'Urgent' : 'نداء جديد'}
                    </span>
                  </div>

                  {call.handledByName && (
                    <p className="text-[11px] font-bold text-blue-700">
                      {isEn ? `Handled by: ${call.handledByName}` : `تحت متابعة: ${call.handledByName}`}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    {!isAck && (
                      <button
                        type="button"
                        disabled={updatingCallId === call.id}
                        onClick={() => handleCallStatus(call, 'acknowledged')}
                        className="flex-1 min-h-[40px] py-2 px-3 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                      >
                        {isEn ? 'On My Way' : 'جاري التوجه'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={updatingCallId === call.id}
                      onClick={() => handleCallStatus(call, 'resolved')}
                      className="flex-1 min-h-[40px] py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCheck className="w-4 h-4" />
                      <span>{isEn ? 'Fulfilled' : 'تمت التلبية'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: Ready Dishes & Drinks from Kitchen / Bar / Pastry */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-zinc-950 flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-emerald-600" />
            <span>
              {isEn
                ? 'Ready for Pickup (Kitchen / Bar / Pastry)'
                : 'أصناف جاهزة من المحطات بانتظار التقديم'}
            </span>
          </h3>
        </div>

        {readyGroupedByOrder.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center space-y-2">
            <Clock className="w-7 h-7 text-zinc-300 mx-auto" />
            <p className="text-xs font-bold text-zinc-700">
              {isEn
                ? 'No items marked Ready yet by Kitchen, Bar, or Pastry.'
                : 'لا توجد أصناف جاهزة للاستلام حالياً. بمجرد ضغط "جاهز" من المطبخ أو البار أو الباستري ستظهر هنا فوراً.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {readyGroupedByOrder.map((group) => {
              const allIndices = group.entries.map((e) => e.itemIndex);
              const batchKey = `${group.orderId}:${allIndices.join(',')}`;
              return (
                <article
                  key={group.orderId}
                  className="bg-white border-2 border-emerald-300 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-sm font-extrabold text-zinc-950">
                          #{group.orderNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 text-[11px] font-extrabold">
                          {group.orderType === 'dine_in'
                            ? `${group.hallName ? `${group.hallName} · ` : ''}${
                                isEn ? `Table ${group.tableNumber || '-'}` : `ترابيزة ${group.tableNumber || '-'}`
                              }`
                            : group.orderType === 'delivery'
                              ? isEn
                                ? 'Delivery'
                                : 'توصيل'
                              : isEn
                                ? 'Pickup'
                                : 'استلام'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1">{group.customerName}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {(() => {
                        const matchedOrder = orders.find((o) => o.id === group.orderId) || null;
                        if (!matchedOrder) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => setSplitCheckOrder(matchedOrder)}
                            className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                          >
                            <Scissors className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Split Check' : 'تقسيم الشيك'}</span>
                          </button>
                        );
                      })()}

                      {group.entries.length > 1 && (
                        <button
                          type="button"
                          disabled={servingKey === batchKey}
                          onClick={() => handleMarkItemServed(group.orderId, group.orderNumber, allIndices)}
                          className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-[11px] font-extrabold hover:bg-emerald-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Serve All Ready' : 'تم تقديم الكل'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {group.entries.map((dish) => {
                      const stMeta = resolveStationMeta(dish.station);
                      const StIcon = getStationIconComponent(stMeta.icon);
                      const singleKey = `${dish.orderId}:${dish.itemIndex}`;
                      return (
                        <div
                          key={singleKey}
                          className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/80 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-extrabold ${stMeta.badgeClass}`}
                              >
                                <StIcon className="w-3 h-3" />
                                <span>{isEn ? stMeta.shortLabel_en : stMeta.shortLabel}</span>
                              </span>
                              {dish.guestName && (
                                <span className="px-2 py-0.5 rounded bg-zinc-900 text-white text-[10px] font-extrabold">
                                  {dish.guestName}
                                </span>
                              )}
                            </div>

                            <p className="text-xs sm:text-sm font-extrabold text-zinc-950">
                              <span className="font-mono-num">{dish.quantity}×</span> {dish.name}
                              {dish.sizeName ? ` (${dish.sizeName})` : ''}
                            </p>
                            {dish.addonNames.length > 0 && (
                              <p className="text-[11px] text-zinc-600">
                                + {dish.addonNames.join(isEn ? ', ' : '، ')}
                              </p>
                            )}
                            {dish.notes && (
                              <p className="text-[11px] text-amber-700 font-semibold">
                                {isEn ? 'Note:' : 'ملاحظة:'} {dish.notes}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={servingKey === singleKey}
                            onClick={() => handleMarkItemServed(dish.orderId, dish.orderNumber, [dish.itemIndex])}
                            className="min-h-[40px] px-3 py-2 rounded-xl bg-zinc-950 text-white text-xs font-extrabold hover:bg-zinc-800 flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{isEn ? 'Served' : 'تم التقديم'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      </>
      )}

      {/* Table Detail Drawer */}
      {selectedTableDrawer && (() => {
        const snap = getTableSnapshot(
          selectedTableDrawer.hallName,
          selectedTableDrawer.tableNumber
        );
        return (
          <div
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex justify-end"
            onClick={() => setSelectedTableDrawer(null)}
          >
            <div
              dir={dir}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col justify-between"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-3">
                  <div>
                    <p className="text-[11px] font-bold text-amber-700">
                      {selectedTableDrawer.hallName}
                    </p>
                    <h3 className="text-lg font-extrabold text-zinc-950">
                      ترابيزة {selectedTableDrawer.tableNumber}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTableDrawer(null)}
                    className="w-9 h-9 rounded-xl hover:bg-zinc-100 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {drawerNotice && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900">
                    {drawerNotice}
                  </div>
                )}

                {snap.tblOrders.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 text-center space-y-2">
                    <p className="text-xs font-bold text-zinc-700">الترابيزة شاغرة حالياً</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {snap.tblOrders.map((ord) => (
                      <div key={ord.id} className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2">
                        <div className="flex items-center justify-between text-xs font-extrabold">
                          <span className="font-mono-num text-zinc-950">#{ord.orderNumber}</span>
                          {showCaptainPrices && (
                            <span className="font-mono-num text-emerald-700">
                              {formatMoney(ord.total)}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-xs">
                          {ord.items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2">
                              <span className="font-bold text-zinc-800">
                                {it.quantity}× {it.name} {it.sizeName ? `(${it.sizeName})` : ''}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-zinc-200 font-bold">
                                {ord.itemProgress?.[String(idx)] === 'ready'
                                  ? 'جاهز'
                                  : ord.itemProgress?.[String(idx)] === 'served'
                                    ? 'تم التقديم'
                                    : 'تحضير'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-zinc-200 bg-zinc-50 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setPosOrderType('dine_in');
                    setPosHallName(selectedTableDrawer.hallName);
                    setPosTableNumber(selectedTableDrawer.tableNumber);
                    setSelectedTableDrawer(null);
                    setCaptainMode('pos');
                  }}
                  className="w-full min-h-[42px] rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>إضافة أصناف على الترابيزة</span>
                </button>

                {snap.tblOrders.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={requestingBillBusy}
                      onClick={() =>
                        handleRequestBillFromDrawer(
                          selectedTableDrawer.hallName,
                          selectedTableDrawer.tableNumber,
                          'request_bill_cash'
                        )
                      }
                      className="min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>طلب الشيك كاش</span>
                    </button>
                    <button
                      type="button"
                      disabled={requestingBillBusy}
                      onClick={() =>
                        handleRequestBillFromDrawer(
                          selectedTableDrawer.hallName,
                          selectedTableDrawer.tableNumber,
                          'request_bill_card'
                        )
                      }
                      className="min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>طلب الشيك فيزا</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Grid Colors & Overdue Settings Modal */}
      {gridSettingsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
          onClick={() => !savingGridSettings && setGridSettingsOpen(false)}
        >
          <div
            dir={dir}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-zinc-950">
                تخصيص ألوان خريطة الترابيزات ووقت التنبيه
              </h3>
              <button
                type="button"
                onClick={() => setGridSettingsOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-bold">
              {(
                [
                  { key: 'empty' as const, label: 'ترابيزة شاغرة' },
                  { key: 'occupied' as const, label: 'ترابيزة مشغولة' },
                  { key: 'billRequested' as const, label: 'طلب الشيك' },
                  { key: 'overdue' as const, label: 'ترابيزة متأخرة' },
                ] as const
              ).map((entry) => (
                <label
                  key={entry.key}
                  className="p-2.5 rounded-xl border border-zinc-200 flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span>{entry.label}</span>
                  <input
                    type="color"
                    value={colorDraft[entry.key]}
                    onChange={(e) =>
                      setColorDraft((prev) => ({ ...prev, [entry.key]: e.target.value }))
                    }
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                  />
                </label>
              ))}
            </div>

            <label className="block space-y-1 text-xs font-bold text-zinc-800">
              <span>حد التأخير لتغيير لون الترابيزة (بالدقائق):</span>
              <input
                type="number"
                min={10}
                max={1440}
                dir="ltr"
                value={overdueDraft}
                onChange={(e) => setOverdueDraft(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono-num font-bold text-sm"
              />
            </label>

            <button
              type="button"
              disabled={savingGridSettings}
              onClick={handleSaveGridSettings}
              className="w-full min-h-[42px] rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
            >
              {savingGridSettings ? 'جاري الحفظ...' : 'حفظ ألوان وإعدادات الصالة'}
            </button>
          </div>
        </div>
      )}

      {/* POS Size/Addons/Notes Quick Picker Modal (No Images) */}
      {posPickerItem && (
        <div
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
          onClick={() => setPosPickerItem(null)}
        >
          <div
            dir={dir}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-zinc-950">
                {loc(posPickerItem.name, posPickerItem.name_en)}
              </h3>
              <button
                type="button"
                onClick={() => setPosPickerItem(null)}
                className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {posPickerItem.sizes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-zinc-700">الحجم:</p>
                <div className="flex flex-wrap gap-1.5">
                  {posPickerItem.sizes.map((sz) => (
                    <button
                      key={sz.name}
                      type="button"
                      onClick={() => setPosPickerSize(sz)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${
                        posPickerSize?.name === sz.name
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                      }`}
                    >
                      {sz.name}
                      {showCaptainPrices ? ` (${formatMoney(sz.price)})` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {posPickerItem.addons.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-zinc-700">الإضافات:</p>
                <div className="flex flex-wrap gap-1.5">
                  {posPickerItem.addons.map((ad) => {
                    const active = posPickerAddons.some((a) => a.name === ad.name);
                    return (
                      <button
                        key={ad.name}
                        type="button"
                        onClick={() =>
                          setPosPickerAddons((prev) =>
                            active ? prev.filter((x) => x.name !== ad.name) : [...prev, ad]
                          )
                        }
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${
                          active
                            ? 'bg-amber-500 text-zinc-950 border-amber-500'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                        }`}
                      >
                        {ad.name}
                        {showCaptainPrices ? ` (+${formatMoney(ad.price)})` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <input
              type="text"
              placeholder="ملاحظة خاصة على الصنف (بدون ملح / زيادة صوص...)"
              value={posPickerNotes}
              onChange={(e) => setPosPickerNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs"
            />

            <button
              type="button"
              onClick={() => {
                handlePosAddItem(posPickerItem, posPickerSize, posPickerAddons, posPickerNotes);
                setPosPickerItem(null);
              }}
              className="w-full min-h-[42px] rounded-xl bg-zinc-950 text-white text-xs font-extrabold cursor-pointer"
            >
              إضافة للطلب
            </button>
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
    </div>
  );
}
