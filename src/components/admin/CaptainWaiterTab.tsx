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
  MapPin,
  Maximize2,
  Minimize2,
  Printer,
  Scissors,
  UserCheck,
  Utensils,
  Volume2,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { showOperationalNotification } from '../../lib/fcmNotificationService';
import {
  subscribeCategories,
  subscribeHalls,
  subscribeMenuItems,
  subscribeOwnerOrders,
  subscribeOwnerServiceCalls,
  updateOrderItemProgress,
  updateServiceCallStatus,
} from '../../lib/firestoreService';
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
  Hall,
  ItemPrepState,
  MenuItem,
  Order,
  PrepStation,
  Restaurant,
  RestaurantStation,
  ServiceCall,
  ServiceCallStatus,
  ServiceCallType,
  StaffActorInfo,
} from '../../types/menu';
import { SplitCheckPrintModal } from './SplitCheckPrintModal';
import { ThermalPrinterSettingsModal } from './ThermalPrinterSettingsModal';

interface CaptainWaiterTabProps {
  restaurant: Restaurant;
  defaultHallName?: string;
  staffMode?: boolean;
  actor?: StaffActorInfo;
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
}: CaptainWaiterTabProps) {
  const { lang, dir } = useLanguage();
  const isEn = lang === 'en';

  const [serviceCalls, setServiceCalls] = useState<ServiceCall[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [dynamicStations, setDynamicStations] = useState<RestaurantStation[]>([]);
  const [selectedHall, setSelectedHall] = useState<string>(() => defaultHallName?.trim() || 'all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [updatingCallId, setUpdatingCallId] = useState<string | null>(null);
  const [servingKey, setServingKey] = useState<string | null>(null);

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
    return () => {
      unsubCats();
      unsubItems();
      unsubStations();
      unsubHalls();
    };
  }, [restaurant.id]);

  useEffect(() => {
    if (defaultHallName?.trim()) {
      setSelectedHall(defaultHallName.trim());
    }
  }, [defaultHallName]);

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

      {/* Live Hall Filter Strip */}
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
