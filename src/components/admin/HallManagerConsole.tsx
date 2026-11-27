import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  BellRing,
  CheckCheck,
  Clock,
  CreditCard,
  Grid,
  Info,
  LayoutGrid,
  Loader2,
  MapPin,
  Minus,
  Plus,
  QrCode,
  Search,
  Send,
  ShieldAlert,
  UserCheck,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useScreenUi } from '../../contexts/PlatformUiContext';
import { formatFirestoreErrorMessage } from '../../lib/firebase';
import {
  getHallTableNumbers,
  sendServiceCall,
  submitPublicOrder,
  subscribeActiveTableSessions,
  subscribeCategories,
  subscribeHalls,
  subscribeMenuItems,
  subscribeOwnerOrders,
  subscribeOwnerServiceCalls,
  updateOrderItemProgress,
  updateServiceCallStatus,
} from '../../lib/firestoreService';
import { subscribeHallAssignments } from '../../lib/hallAssignmentsService';
import {
  getCurrentShiftSlot,
  getResolvedOperationsConfig,
  getTimestampMillis,
} from '../../lib/operationsService';
import { subscribeAllActiveRestaurantShifts } from '../../lib/shiftsService';
import { getResolvedHallManagerPermissions } from '../../lib/staffAuthUtils';
import { subscribeRestaurantStaff } from '../../lib/staffService';
import { subscribeRestaurantStations } from '../../lib/stationsService';
import {
  buildEffectiveStations,
  getDefaultFallbackStationId,
  resolveOrderItemStations,
} from '../../lib/stationUtils';
import {
  doesHallMatch,
  doTableNumbersMatch,
  normalizeTableNumber,
} from '../../lib/tableSessionUtils';
import {
  Category,
  Hall,
  HallCaptainAssignment,
  ItemAddon,
  ItemPrepState,
  ItemSize,
  MenuItem,
  Order,
  OrderItemPayload,
  Restaurant,
  RestaurantStation,
  ServiceCall,
  ServiceCallStatus,
  ServiceCallType,
  StaffActorInfo,
  StaffMember,
  StaffShift,
  TableSession,
} from '../../types/menu';

import { EffectiveStaffPermissions } from '../../types/menu';

interface HallManagerConsoleProps {
  restaurant: Restaurant;
  staff: StaffMember;
  actor: StaffActorInfo;
  activeShifts?: StaffShift[];
  effectivePermissions?: EffectiveStaffPermissions;
  onOpenAssignments?: () => void;
  onOpenHalls?: () => void;
}

export function HallManagerConsole({
  restaurant,
  staff,
  actor,
  activeShifts: externalShifts,
  effectivePermissions,
  onOpenAssignments,
  onOpenHalls,
}: HallManagerConsoleProps) {
  const { lang, dir, loc, formatCurrency } = useLanguage();
  const isEn = lang === 'en';
  const ui = useScreenUi('captain_waiter');
  const currencyLabel = formatCurrency(restaurant.currency);

  const opsConfig = useMemo(() => getResolvedOperationsConfig(restaurant), [restaurant]);
  const legacyHallPerms = useMemo(
    () => getResolvedHallManagerPermissions(staff.hallManagerPermissions),
    [staff.hallManagerPermissions]
  );
  const perms = useMemo(
    () => ({
      ...legacyHallPerms,
      canMonitorFloorAndCalls: effectivePermissions
        ? effectivePermissions.canManageServiceCalls || effectivePermissions.canViewOrders
        : legacyHallPerms.canMonitorFloorAndCalls,
      canManageServiceCalls: effectivePermissions
        ? effectivePermissions.canManageServiceCalls
        : legacyHallPerms.canMonitorFloorAndCalls,
      canAddEditTableOrders: effectivePermissions
        ? effectivePermissions.canAddEditTableOrders
        : legacyHallPerms.canAddEditTableOrders,
      canUpdatePrepProgress: effectivePermissions
        ? effectivePermissions.canUpdatePrepProgress
        : true,
    }),
    [legacyHallPerms, effectivePermissions]
  );

  const [nowTick, setNowTick] = useState(() => Date.now());
  const currentShiftSlot = useMemo(() => getCurrentShiftSlot(opsConfig), [opsConfig, nowTick]);
  const [overlayShiftId, setOverlayShiftId] = useState<string>(() => currentShiftSlot.id);

  useEffect(() => {
    if (!opsConfig.shiftSlots.some((s) => s.id === overlayShiftId)) {
      setOverlayShiftId(currentShiftSlot.id);
    }
  }, [opsConfig.shiftSlots, overlayShiftId, currentShiftSlot.id]);

  const [halls, setHalls] = useState<Hall[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [serviceCalls, setServiceCalls] = useState<ServiceCall[]>([]);
  const [tableSessions, setTableSessions] = useState<TableSession[]>([]);
  const [assignments, setAssignments] = useState<HallCaptainAssignment[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [localShifts, setLocalShifts] = useState<StaffShift[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [dynamicStations, setDynamicStations] = useState<RestaurantStation[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedHallFilter, setSelectedHallFilter] = useState<string>('all');
  const [updatingCallId, setUpdatingCallId] = useState<string | null>(null);
  const [servingKey, setServingKey] = useState<string | null>(null);

  // Table Detail Drawer state
  const [selectedTable, setSelectedTable] = useState<{
    hall: Hall;
    tableNumber: string;
  } | null>(null);
  const [drawerOrderOpen, setDrawerOrderOpen] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [drawerCatId, setDrawerCatId] = useState('all');
  const [drawerCart, setDrawerCart] = useState<
    Array<{
      key: string;
      item: MenuItem;
      size?: ItemSize;
      addons: ItemAddon[];
      quantity: number;
      unitPrice: number;
    }>
  >([]);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [drawerFeedback, setDrawerFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [consoleError, setConsoleError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setLoading(true);
    let firstLoaded = false;
    const markReady = () => {
      if (!firstLoaded) {
        firstLoaded = true;
        setLoading(false);
      }
    };

    const unsubHalls = subscribeHalls(
      restaurant.id,
      (list) => {
        setHalls(list);
        markReady();
      },
      () => markReady()
    );
    const unsubOrders = subscribeOwnerOrders(
      restaurant.id,
      restaurant.ownerId,
      setOrders,
      () => {},
      { staffMode: true }
    );
    const unsubCalls = subscribeOwnerServiceCalls(
      restaurant.id,
      restaurant.ownerId,
      setServiceCalls,
      () => {},
      { staffMode: true }
    );
    const unsubSessions = subscribeActiveTableSessions(
      restaurant.id,
      setTableSessions,
      () => {}
    );
    const unsubAssign = subscribeHallAssignments(restaurant.id, setAssignments, () => {});
    const unsubStaff = subscribeRestaurantStaff(restaurant.id, setStaffList, () => {});
    const unsubCats = subscribeCategories(restaurant.id, setCategories);
    const unsubItems = subscribeMenuItems(restaurant.id, setMenuItems);
    const unsubStations = subscribeRestaurantStations(restaurant.id, setDynamicStations);
    const unsubShifts =
      externalShifts === undefined
        ? subscribeAllActiveRestaurantShifts(restaurant.id, setLocalShifts, () => {})
        : () => {};

    return () => {
      unsubHalls();
      unsubOrders();
      unsubCalls();
      unsubSessions();
      unsubAssign();
      unsubStaff();
      unsubCats();
      unsubItems();
      unsubStations();
      unsubShifts();
    };
  }, [restaurant.id, restaurant.ownerId, externalShifts]);

  const activeShifts = externalShifts ?? localShifts;
  const effectiveStations = useMemo(() => buildEffectiveStations(dynamicStations), [dynamicStations]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const itemMap = useMemo(() => new Map(menuItems.map((m) => [m.id, m])), [menuItems]);

  const captains = useMemo(
    () =>
      staffList
        .filter(
          (m) =>
            m.role !== 'hall_manager' &&
            (m.role === 'captain' || (m.allowedScreens || []).includes('captain'))
        )
        .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)),
    [staffList]
  );

  const activeShiftByStaffUid = useMemo(() => {
    const map = new Map<string, StaffShift>();
    activeShifts.forEach((sh) => {
      if (!map.has(sh.staffId)) map.set(sh.staffId, sh);
    });
    return map;
  }, [activeShifts]);

  const shiftAssignments = useMemo(
    () => assignments.filter((a) => a.shiftSlotId === overlayShiftId && (a.hallIds?.length || 0) > 0),
    [assignments, overlayShiftId]
  );

  const assignmentByCaptainUid = useMemo(() => {
    const map = new Map<string, HallCaptainAssignment>();
    shiftAssignments.forEach((a) => map.set(a.captainUid, a));
    return map;
  }, [shiftAssignments]);

  // Helper: find which captains cover a given hall & optional table in the selected shift
  const getCaptainsForHall = (hallId: string) => {
    return shiftAssignments.filter((a) => a.hallIds.includes(hallId));
  };

  const getCaptainsForTable = (hallId: string, tableNumber: string) => {
    const cleanTbl = tableNumber.trim();
    return shiftAssignments.filter((a) => {
      if (!a.hallIds.includes(hallId)) return false;
      const spec = a.tableNumbersByHall?.[hallId];
      if (Array.isArray(spec) && spec.length > 0) {
        return spec.includes(cleanTbl);
      }
      if (!a.tableNumbersByHall && Array.isArray(a.tableNumbers) && a.tableNumbers.length > 0) {
        return a.tableNumbers.includes(cleanTbl);
      }
      return true;
    });
  };

  const activeCalls = useMemo(
    () => serviceCalls.filter((c) => c.status !== 'resolved'),
    [serviceCalls]
  );

  const getTableSnapshot = (hallName: string, tableNumber: string) => {
    const cleanTbl = tableNumber.trim();
    const cleanHall = hallName.trim();
    const allowEmptyHallFallback = halls.length <= 1 || halls[0]?.name.trim() === cleanHall;
    const tblOrders = orders.filter(
      (o) =>
        o.status !== 'completed' &&
        o.status !== 'cancelled' &&
        o.orderType === 'dine_in' &&
        doTableNumbersMatch(o.tableNumber, cleanTbl) &&
        doesHallMatch(cleanHall, o.hallName, allowEmptyHallFallback)
    );
    const tblCalls = serviceCalls.filter(
      (c) =>
        c.status !== 'resolved' &&
        doTableNumbersMatch(c.tableNumber, cleanTbl) &&
        doesHallMatch(cleanHall, c.hallName, allowEmptyHallFallback)
    );
    const tblSessions = tableSessions.filter(
      (s) =>
        s.status === 'active' &&
        doTableNumbersMatch(s.tableNumber, cleanTbl) &&
        doesHallMatch(cleanHall, s.hallName, allowEmptyHallFallback)
    );

    const guestMap = new Map<string, string>();
    const addGuest = (raw?: string) => {
      const g = (raw || '').trim();
      if (g && !guestMap.has(g.toLowerCase())) {
        guestMap.set(g.toLowerCase(), g);
      }
    };
    tblSessions.forEach((s) => {
      (s.guests || []).forEach(addGuest);
      (s.items || []).forEach((it) => addGuest(it.guestName));
    });
    tblOrders.forEach((o) => {
      if (Array.isArray(o.guestChecks) && o.guestChecks.length > 0) {
        o.guestChecks.forEach((gc) => addGuest(gc.guestName));
      } else {
        addGuest(o.customerName);
      }
      (o.items || []).forEach((it) => addGuest(it.guestName));
    });
    const seatedGuests = Array.from(guestMap.values());
    const sessionItemsCount = tblSessions.reduce(
      (sum, s) => sum + (s.items || []).reduce((isum, it) => isum + (it.quantity || 0), 0),
      0
    );
    const sessionPendingItems = tblSessions.flatMap((s) => s.items || []);

    const hasBillRequest = tblCalls.some(
      (c) => c.callType === 'request_bill_cash' || c.callType === 'request_bill_card'
    );

    let oldestMs = 0;
    tblOrders.forEach((o) => {
      const ms = getTimestampMillis(o.createdAt);
      if (ms > 0 && (oldestMs === 0 || ms < oldestMs)) oldestMs = ms;
    });
    if (oldestMs === 0) {
      tblSessions.forEach((s) => {
        const ms = getTimestampMillis(s.updatedAt || s.createdAt);
        if (ms > 0 && (oldestMs === 0 || ms < oldestMs)) oldestMs = ms;
      });
    }
    const elapsedMins = oldestMs > 0 ? Math.max(0, Math.floor((nowTick - oldestMs) / 60000)) : 0;
    const isOverdue = tblOrders.length > 0 && elapsedMins >= opsConfig.tableOverdueMinutes;
    const isOccupied = tblOrders.length > 0 || seatedGuests.length > 0 || sessionItemsCount > 0;

    const state: 'empty' | 'occupied' | 'billRequested' | 'overdue' = isOverdue
      ? 'overdue'
      : hasBillRequest
        ? 'billRequested'
        : isOccupied
          ? 'occupied'
          : 'empty';

    const total = tblOrders.reduce((s, o) => s + (o.total || 0), 0);
    const itemsCount = tblOrders.reduce(
      (s, o) => s + o.items.reduce((isum, it) => isum + it.quantity, 0),
      0
    );

    return {
      tblOrders,
      tblCalls,
      tblSessions,
      seatedGuests,
      sessionItemsCount,
      sessionPendingItems,
      elapsedMins,
      state,
      total,
      itemsCount,
    };
  };

  const mergedHalls = useMemo(() => {
    const nextHalls = halls.map((h) => ({
      ...h,
      tableNumbers: [...getHallTableNumbers(h)],
    }));
    const unmappedMap = new Map<string, { hallName: string; tables: string[] }>();

    const registerActiveTable = (rawHall?: string | null, rawTbl?: string | null) => {
      const tbl = normalizeTableNumber(rawTbl);
      if (!tbl) return;
      const cleanRecHall = (rawHall || '').trim();
      const matched = nextHalls.find((h) => {
        const allowFallback =
          nextHalls.length <= 1 || nextHalls[0]?.name.trim() === h.name.trim();
        return doesHallMatch(h, cleanRecHall, allowFallback);
      });
      if (matched) {
        if (!matched.tableNumbers.some((t) => doTableNumbersMatch(t, tbl))) {
          matched.tableNumbers.push(tbl);
        }
        return;
      }
      const virtualKey = cleanRecHall.toLowerCase() || '__empty__';
      const existing = unmappedMap.get(virtualKey);
      if (existing) {
        if (!existing.tables.some((t) => doTableNumbersMatch(t, tbl))) {
          existing.tables.push(tbl);
        }
      } else {
        unmappedMap.set(virtualKey, { hallName: cleanRecHall, tables: [tbl] });
      }
    };

    orders.forEach((o) => {
      if (o.status !== 'completed' && o.status !== 'cancelled' && o.orderType === 'dine_in') {
        registerActiveTable(o.hallName, o.tableNumber);
      }
    });
    tableSessions.forEach((s) => {
      if (s.status === 'active' && ((s.guests?.length || 0) > 0 || (s.items?.length || 0) > 0)) {
        registerActiveTable(s.hallName, s.tableNumber);
      }
    });
    serviceCalls.forEach((c) => {
      if (c.status !== 'resolved') {
        registerActiveTable(c.hallName, c.tableNumber);
      }
    });

    unmappedMap.forEach((v, vKey) => {
      nextHalls.push({
        id: `__virtual_${vKey}`,
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        name: v.hallName,
        name_en: v.hallName,
        hallType: isEn ? 'Active QR / Unmapped' : 'طاولات نشطة (QR)',
        tableCount: v.tables.length,
        sortOrder: 999,
        tableNumbers: v.tables,
      });
    });

    return nextHalls;
  }, [halls, orders, tableSessions, serviceCalls, restaurant.id, restaurant.ownerId, isEn]);

  // Floor KPI metrics
  const kpiStats = useMemo(() => {
    let totalTables = 0;
    let occupiedTables = 0;
    let overdueTables = 0;
    mergedHalls.forEach((h) => {
      const nums = getHallTableNumbers(h);
      totalTables += nums.length;
      nums.forEach((tbl) => {
        const snap = getTableSnapshot(h.name, tbl);
        if (snap.state !== 'empty') occupiedTables += 1;
        if (snap.state === 'overdue') overdueTables += 1;
      });
    });
    const onlineCaptainsCount = captains.filter((c) => activeShiftByStaffUid.has(c.uid)).length;
    return {
      totalTables,
      occupiedTables,
      overdueTables,
      pendingCalls: activeCalls.length,
      onlineCaptainsCount,
      assignedCaptainsCount: shiftAssignments.length,
    };
  }, [mergedHalls, orders, serviceCalls, tableSessions, captains, activeShiftByStaffUid, shiftAssignments, nowTick]);

  const visibleHalls = useMemo(() => {
    if (selectedHallFilter === 'all') return mergedHalls;
    return mergedHalls.filter((h) => h.id === selectedHallFilter);
  }, [mergedHalls, selectedHallFilter]);

  const filteredDrawerItems = useMemo(() => {
    const q = drawerSearch.trim().toLowerCase();
    return menuItems.filter((it) => {
      if (it.isAvailable === false) return false;
      if (drawerCatId !== 'all' && it.categoryId !== drawerCatId) return false;
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        (it.name_en || '').toLowerCase().includes(q)
      );
    });
  }, [menuItems, drawerCatId, drawerSearch]);

  const formatMoney = (val: number) => `${Number(val || 0).toFixed(2).replace(/\.00$/, '')} ${currencyLabel}`;

  const getCallMeta = (type: ServiceCallType) => {
    if (type === 'call_waiter') {
      return {
        label: isEn ? 'Call Captain' : 'نداء الكابتن',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
        Icon: BellRing,
      };
    }
    if (type === 'request_bill_cash') {
      return {
        label: isEn ? 'Check Request (Cash)' : 'طلب الشيك (كاش)',
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        Icon: Banknote,
      };
    }
    if (type === 'request_bill_card') {
      return {
        label: isEn ? 'Check Request (Visa)' : 'طلب الشيك (فيزا)',
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

  const handleCallStatus = async (call: ServiceCall, nextStatus: ServiceCallStatus) => {
    setUpdatingCallId(call.id);
    setConsoleError(null);
    try {
      await updateServiceCallStatus(call.id, nextStatus, {
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        tableLabel: `${call.hallName ? `${call.hallName} · ` : ''}${isEn ? `Table ${call.tableNumber}` : `ترابيزة ${call.tableNumber}`}`,
        actor,
      });
    } catch (err) {
      setConsoleError(formatFirestoreErrorMessage(err, isEn));
    } finally {
      setUpdatingCallId(null);
    }
  };

  const handleMarkItemServed = async (orderId: string, orderNumber: string, itemIdx: number) => {
    const key = `${orderId}:${itemIdx}`;
    setServingKey(key);
    setConsoleError(null);
    try {
      const updates: Record<string, ItemPrepState> = { [String(itemIdx)]: 'served' };
      await updateOrderItemProgress(orderId, updates, undefined, {
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        orderNumber,
        actor,
      });
    } catch (err) {
      setConsoleError(formatFirestoreErrorMessage(err, isEn));
    } finally {
      setServingKey(null);
    }
  };

  const handleAddDrawerItem = (item: MenuItem) => {
    const defaultSize = item.sizes?.[0];
    const unitPrice = Number((defaultSize ? defaultSize.price : item.basePrice).toFixed(2));
    const key = `${item.id}::${defaultSize?.name || ''}`;
    setDrawerCart((prev) => {
      const existing = prev.find((p) => p.key === key);
      if (existing) {
        return prev.map((p) => (p.key === key ? { ...p, quantity: p.quantity + 1 } : p));
      }
      return [...prev, { key, item, size: defaultSize, addons: [], quantity: 1, unitPrice }];
    });
  };

  const handleSubmitDrawerOrder = async () => {
    if (!selectedTable || drawerCart.length === 0 || !perms.canAddEditTableOrders) return;
    setDrawerBusy(true);
    setDrawerFeedback(null);
    try {
      const fallbackStation = getDefaultFallbackStationId(effectiveStations);
      const orderItems: OrderItemPayload[] = drawerCart.map((entry) => {
        const stList = resolveOrderItemStations(
          {
            menuItemId: entry.item.id,
            name: entry.item.name,
            addonNames: entry.addons.map((a) => a.name),
            quantity: entry.quantity,
            unitPrice: entry.unitPrice,
            lineTotal: entry.unitPrice * entry.quantity,
            station: entry.item.station || entry.item.stationId,
            stationId: entry.item.stationId || entry.item.station,
            stationIds: entry.item.stationIds,
          },
          itemMap,
          categoryMap,
          fallbackStation
        );
        const primarySt = stList[0] || fallbackStation;
        return {
          menuItemId: entry.item.id,
          name: entry.item.name,
          ...(entry.size ? { sizeName: entry.size.name } : {}),
          addonNames: entry.addons.map((a) => a.name),
          quantity: entry.quantity,
          unitPrice: entry.unitPrice,
          lineTotal: Number((entry.unitPrice * entry.quantity).toFixed(2)),
          station: primarySt,
          stationId: primarySt,
          stationIds: stList,
        };
      });

      const subtotal = Number(drawerCart.reduce((s, c) => s + c.unitPrice * c.quantity, 0).toFixed(2));
      const serviceCharge = Number(((subtotal * (restaurant.serviceCharge || 0)) / 100).toFixed(2));
      const taxAmount = Number((((subtotal + serviceCharge) * (restaurant.taxRate || 0)) / 100).toFixed(2));
      const total = Number((subtotal + serviceCharge + taxAmount).toFixed(2));

      const res = await submitPublicOrder({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        customerName: isEn ? `Hall Manager (${actor.name})` : `مدير الصالات (${actor.name})`,
        customerPhone: '000000',
        orderType: 'dine_in',
        hallName: selectedTable.hall.name,
        tableNumber: normalizeTableNumber(selectedTable.tableNumber),
        items: orderItems,
        subtotal,
        serviceCharge,
        deliveryFee: 0,
        taxAmount,
        total,
        actor,
      });

      setDrawerCart([]);
      setDrawerOrderOpen(false);
      setDrawerFeedback({
        type: 'ok',
        text: isEn
          ? `Order #${res.orderNumber} sent to prep stations & cashier.`
          : `تم إرسال الطلب #${res.orderNumber} للمحطات والكاشير بنجاح.`,
      });
    } catch (err) {
      setDrawerFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : isEn ? 'Failed to send order.' : 'تعذر إرسال الطلب.',
      });
    } finally {
      setDrawerBusy(false);
    }
  };

  const handleRequestBillFromDrawer = async (type: 'request_bill_cash' | 'request_bill_card') => {
    if (!selectedTable) return;
    setDrawerBusy(true);
    setDrawerFeedback(null);
    try {
      await sendServiceCall({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        hallName: selectedTable.hall.name,
        tableNumber: selectedTable.tableNumber,
        guestName: actor.name || (isEn ? 'Hall Manager' : 'مدير الصالات'),
        callType: type,
      });
      setDrawerFeedback({
        type: 'ok',
        text:
          type === 'request_bill_cash'
            ? isEn
              ? 'Check request (Cash) sent to cashier.'
              : 'تم إرسال طلب الشيك (كاش) للكاشير.'
            : isEn
              ? 'Check request (Visa) sent to cashier.'
              : 'تم إرسال طلب الشيك (فيزا) للكاشير.',
      });
    } catch (err) {
      setDrawerFeedback({
        type: 'err',
        text: formatFirestoreErrorMessage(err, isEn),
      });
    } finally {
      setDrawerBusy(false);
    }
  };

  if (loading) {
    return (
      <div
        className={`border p-12 text-center space-y-2 ${ui.radiusClasses.card}`}
        style={{ backgroundColor: ui.theme.surfaceBg, borderColor: ui.theme.surfaceBorder }}
      >
        <Loader2 className="w-7 h-7 animate-spin mx-auto" style={{ color: ui.theme.accentHex }} />
        <p className="text-xs font-bold" style={{ color: ui.theme.mutedText }}>
          {isEn ? 'Loading Hall Manager Console...' : 'جاري تحميل لوحة مدير الصالات الحية...'}
        </p>
      </div>
    );
  }

  return (
    <div dir={dir} className="space-y-5">
      {consoleError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-800 flex items-center justify-between gap-2">
          <span>{consoleError}</span>
          <button type="button" onClick={() => setConsoleError(null)} className="cursor-pointer shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Top Action Header */}
      <section
        className={`border p-4 sm:p-5 space-y-4 ${ui.radiusClasses.card}`}
        style={{
          backgroundColor: ui.theme.surfaceBg,
          borderColor: ui.theme.surfaceBorder,
          boxShadow: ui.theme.cardShadow,
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: ui.theme.sidebarBg,
                color: ui.theme.highlightHex || '#E8833A',
              }}
            >
              <LayoutGrid className="w-5 h-5" />
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold" style={{ color: ui.theme.surfaceText }}>
                  {isEn ? 'Live Dining Halls & Captain Coverage' : 'لوحة مدير الصالات الحية وتغطية الكباتن'}
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-extrabold">
                  <Clock className="w-3 h-3" />
                  <span>
                    {isEn
                      ? `Live Shift: ${currentShiftSlot.nameEn}`
                      : `الوردية الحالية: ${currentShiftSlot.name}`}
                  </span>
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: ui.theme.mutedText }}>
                {isEn
                  ? 'Monitor every dining hall, see which Captain covers each table, respond to guest calls, and place dine-in table orders.'
                  : 'راقب جميع الصالات والطاولات لحظياً، اعرف الكابتن المسؤول عن كل صالة وترابيزة، وتابع نداءات العملاء وطلبات الطاولات.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {perms.canManageHallAssignments && onOpenAssignments && (
              <button
                type="button"
                onClick={onOpenAssignments}
                className={`min-h-[42px] px-4 py-2 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                style={{
                  backgroundColor: ui.theme.accentHex,
                  color: ui.theme.accentTextHex,
                }}
              >
                <Users className="w-4 h-4" />
                <span>{isEn ? 'Captain Assignments' : 'توزيع الكباتن'}</span>
              </button>
            )}
            {perms.canManageHalls && onOpenHalls && (
              <button
                type="button"
                onClick={onOpenHalls}
                className={`min-h-[42px] px-4 py-2 border text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                style={{
                  backgroundColor: ui.theme.surfaceSubtleBg,
                  borderColor: ui.theme.surfaceBorder,
                  color: ui.theme.surfaceText,
                }}
              >
                <QrCode className="w-4 h-4" style={{ color: ui.theme.highlightHex || '#E8833A' }} />
                <span>{isEn ? 'Halls & Table QR' : 'الصالات وأكواد QR'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Floor KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div
            className="p-3 rounded-xl border"
            style={{ backgroundColor: ui.theme.surfaceSubtleBg, borderColor: ui.theme.surfaceBorder }}
          >
            <p className="text-[11px] font-bold" style={{ color: ui.theme.mutedText }}>
              {isEn ? 'Occupied Tables' : 'ترابيزات مشغولة'}
            </p>
            <p className="text-xl font-extrabold font-mono-num mt-0.5" style={{ color: ui.theme.surfaceText }}>
              {kpiStats.occupiedTables} / {kpiStats.totalTables}
            </p>
          </div>

          <div
            className="p-3 rounded-xl border"
            style={{ backgroundColor: ui.theme.surfaceSubtleBg, borderColor: ui.theme.surfaceBorder }}
          >
            <p className="text-[11px] font-bold" style={{ color: ui.theme.mutedText }}>
              {isEn ? 'Active Guest Calls' : 'نداءات العملاء النشطة'}
            </p>
            <p className="text-xl font-extrabold font-mono-num text-amber-600 mt-0.5">
              {perms.canMonitorFloorAndCalls ? kpiStats.pendingCalls : '—'}
            </p>
          </div>

          <div
            className="p-3 rounded-xl border"
            style={{ backgroundColor: ui.theme.surfaceSubtleBg, borderColor: ui.theme.surfaceBorder }}
          >
            <p className="text-[11px] font-bold" style={{ color: ui.theme.mutedText }}>
              {isEn ? 'Overdue Tables' : 'ترابيزات متأخرة'}
            </p>
            <p className="text-xl font-extrabold font-mono-num text-rose-600 mt-0.5">
              {kpiStats.overdueTables}
            </p>
          </div>

          <div
            className="p-3 rounded-xl border"
            style={{ backgroundColor: ui.theme.surfaceSubtleBg, borderColor: ui.theme.surfaceBorder }}
          >
            <p className="text-[11px] font-bold" style={{ color: ui.theme.mutedText }}>
              {isEn ? 'Captains Online / Assigned' : 'كباتن بالوردية / موزّعون'}
            </p>
            <p className="text-xl font-extrabold font-mono-num text-emerald-700 mt-0.5">
              {kpiStats.onlineCaptainsCount} / {kpiStats.assignedCaptainsCount}
            </p>
          </div>
        </div>

        {/* Shift Overlay Preview Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: ui.theme.surfaceBorder }}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-extrabold" style={{ color: ui.theme.mutedText }}>
              {isEn ? 'Captain Shift View:' : 'عرض توزيع وردية:'}
            </span>
            {opsConfig.shiftSlots.map((slot) => {
              const active = slot.id === overlayShiftId;
              const isNow = slot.id === currentShiftSlot.id;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setOverlayShiftId(slot.id)}
                  className={`min-h-[34px] px-3 py-1 border text-[11px] font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
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
                  <span>{isEn ? slot.nameEn : slot.name}</span>
                  {isNow && (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-white text-[9px]">
                      {isEn ? 'Now' : 'الآن'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {!perms.showPrices && (
            <span className="px-2.5 py-1 rounded-lg bg-zinc-100 border border-zinc-200 text-[11px] font-bold text-zinc-700">
              {isEn ? 'Prices Hidden By Policy' : 'الأسعار مخفية حسب الصلاحية'}
            </span>
          )}
        </div>
      </section>

      {/* Captains Online & Coverage Strip */}
      <section
        className={`border p-4 space-y-3 ${ui.radiusClasses.card}`}
        style={{
          backgroundColor: ui.theme.surfaceBg,
          borderColor: ui.theme.surfaceBorder,
          boxShadow: ui.theme.cardShadow,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5" style={{ color: ui.theme.surfaceText }}>
            <UserCheck className="w-4 h-4 text-teal-600" />
            <span>{isEn ? 'Captains Shift Status & Zones' : 'حالة الكباتن ونطاقاتهم بالوردية'}</span>
          </h3>
          {captains.length === 0 && (
            <span className="text-[11px] font-bold text-amber-700">
              {isEn ? 'No captain accounts found yet.' : 'لا توجد حسابات كباتن مضافة بعد.'}
            </span>
          )}
        </div>

        {captains.length > 0 && (
          <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {captains.map((cap) => {
              const liveShift = activeShiftByStaffUid.get(cap.uid);
              const assign = assignmentByCaptainUid.get(cap.uid);
              return (
                <div
                  key={cap.uid}
                  className="min-w-[205px] max-w-[250px] shrink-0 p-3 rounded-xl border space-y-1.5"
                  style={{
                    backgroundColor: ui.theme.surfaceSubtleBg,
                    borderColor: liveShift ? '#10B981' : ui.theme.surfaceBorder,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold truncate" style={{ color: ui.theme.surfaceText }}>
                      {cap.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold shrink-0 inline-flex items-center gap-1 ${
                        liveShift
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-zinc-200/80 text-zinc-600'
                      }`}
                    >
                      {liveShift && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />}
                      <span>
                        {liveShift ? (isEn ? 'On Shift' : 'متصل بالوردية') : isEn ? 'Offline' : 'غير متصل'}
                      </span>
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug line-clamp-2" style={{ color: ui.theme.mutedText }}>
                    {assign?.hallNames && assign.hallNames.length > 0
                      ? assign.hallNames.join(isEn ? ', ' : '، ')
                      : isEn
                        ? 'Unassigned in this shift'
                        : 'غير موزّع بهذه الوردية'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Active Service Calls Queue (if Monitor Floor & Calls permitted) */}
      {perms.canMonitorFloorAndCalls && activeCalls.length > 0 && (
        <section className="space-y-2.5">
          <h3 className="text-sm font-extrabold flex items-center gap-2" style={{ color: ui.theme.canvasText }}>
            <BellRing className="w-4 h-4 text-amber-600" />
            <span>
              {isEn
                ? `Active Floor Calls (${activeCalls.length})`
                : `نداءات الطاولات النشطة (${activeCalls.length})`}
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeCalls.map((call) => {
              const meta = getCallMeta(call.callType);
              const CallIcon = meta.Icon;
              const isAck = call.status === 'acknowledged';
              const matchedHall = halls.find(
                (h) => doesHallMatch(h, call.hallName, halls.length <= 1)
              );
              const responsibleCaps = matchedHall
                ? getCaptainsForTable(matchedHall.id, call.tableNumber || '')
                : [];
              return (
                <div
                  key={call.id}
                  className={`border p-3.5 space-y-2.5 ${ui.radiusClasses.card} ${
                    isAck ? 'border-blue-200' : 'border-amber-300 ring-2 ring-amber-200/60'
                  }`}
                  style={{ backgroundColor: ui.theme.surfaceBg, boxShadow: ui.theme.cardShadow }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-extrabold ${meta.badgeClass}`}
                      >
                        <CallIcon className="w-3 h-3" />
                        <span>{meta.label}</span>
                      </span>
                      <p className="text-sm font-extrabold text-zinc-950 truncate">
                        {call.hallName ? `${call.hallName} · ` : ''}
                        {isEn ? `Table ${call.tableNumber}` : `ترابيزة ${call.tableNumber}`}
                      </p>
                      <p className="text-[11px] text-zinc-600">
                        {isEn ? 'Captain:' : 'الكابتن المسؤول:'}{' '}
                        <strong className="text-teal-800">
                          {responsibleCaps.length > 0
                            ? responsibleCaps.map((c) => c.captainName).join('، ')
                            : isEn
                              ? 'Unassigned'
                              : 'غير محدد'}
                        </strong>
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        isAck ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isAck ? (isEn ? 'Handling' : 'قيد المتابعة') : isEn ? 'Urgent' : 'جديد'}
                    </span>
                  </div>
                  {perms.canManageServiceCalls && (
                    <div className="flex items-center gap-2">
                      {!isAck && (
                        <button
                          type="button"
                          disabled={updatingCallId === call.id}
                          onClick={() => handleCallStatus(call, 'acknowledged')}
                          className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                        >
                          {isEn ? 'Acknowledge' : 'جاري التوجه'}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={updatingCallId === call.id}
                        onClick={() => handleCallStatus(call, 'resolved')}
                        className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Resolve' : 'تمت التلبية'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Hall Filter Strip */}
      {halls.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setSelectedHallFilter('all')}
            className={`min-h-[38px] px-3.5 py-1.5 border text-xs font-extrabold whitespace-nowrap cursor-pointer ${ui.radiusClasses.button}`}
            style={
              selectedHallFilter === 'all'
                ? {
                    backgroundColor: ui.theme.accentHex,
                    borderColor: ui.theme.accentHex,
                    color: ui.theme.accentTextHex,
                  }
                : {
                    backgroundColor: ui.theme.surfaceBg,
                    borderColor: ui.theme.surfaceBorder,
                    color: ui.theme.surfaceText,
                  }
            }
          >
            {isEn ? `All Halls (${halls.length})` : `كل الصالات (${halls.length})`}
          </button>
          {halls.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setSelectedHallFilter(h.id)}
              className={`min-h-[38px] px-3.5 py-1.5 border text-xs font-bold whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 ${ui.radiusClasses.button}`}
              style={
                selectedHallFilter === h.id
                  ? {
                      backgroundColor: ui.theme.highlightHex || ui.theme.accentHex,
                      borderColor: ui.theme.highlightHex || ui.theme.accentHex,
                      color: '#FFFFFF',
                    }
                  : {
                      backgroundColor: ui.theme.surfaceBg,
                      borderColor: ui.theme.surfaceBorder,
                      color: ui.theme.surfaceText,
                    }
              }
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{loc(h.name, h.name_en)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Live Floor Grid Overlays per Hall */}
      {!perms.canMonitorFloorAndCalls ? (
        <div
          className={`border p-6 text-center space-y-2 ${ui.radiusClasses.card}`}
          style={{ backgroundColor: ui.theme.surfaceBg, borderColor: ui.theme.surfaceBorder }}
        >
          <ShieldAlert className="w-7 h-7 mx-auto text-amber-600" />
          <p className="text-sm font-extrabold" style={{ color: ui.theme.surfaceText }}>
            {isEn
              ? 'Live floor & calls monitoring is disabled for your account.'
              : 'مراقبة الصالات الحية ونداءات الطاولات غير مفعّلة لصلاحيات حسابك.'}
          </p>
        </div>
      ) : visibleHalls.length === 0 ? (
        <div
          className={`border p-8 text-center space-y-2 ${ui.radiusClasses.card}`}
          style={{ backgroundColor: ui.theme.surfaceBg, borderColor: ui.theme.surfaceBorder }}
        >
          <Grid className="w-8 h-8 mx-auto opacity-40" style={{ color: ui.theme.mutedText }} />
          <h3 className="text-sm font-extrabold" style={{ color: ui.theme.surfaceText }}>
            {isEn ? 'No dining halls configured yet' : 'لا توجد صالات مضافة بعد'}
          </h3>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleHalls.map((hall) => {
            const tableNums = getHallTableNumbers(hall);
            const hallCaptains = getCaptainsForHall(hall.id);
            return (
              <section
                key={hall.id}
                className={`border p-4 sm:p-5 space-y-3 ${ui.radiusClasses.card}`}
                style={{
                  backgroundColor: ui.theme.surfaceBg,
                  borderColor: ui.theme.surfaceBorder,
                  boxShadow: ui.theme.cardShadow,
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <MapPin className="w-4 h-4 shrink-0" style={{ color: ui.theme.highlightHex || '#E8833A' }} />
                    <h3 className="text-sm font-extrabold" style={{ color: ui.theme.surfaceText }}>
                      {loc(hall.name, hall.name_en) ||
                        (isEn ? 'Active Unmapped / QR Tables' : 'طاولات نشطة (ممسوحة بـ QR)')}
                    </h3>
                    {hallCaptains.length > 0 ? (
                      hallCaptains.map((capAssign) => {
                        const isOnline = activeShiftByStaffUid.has(capAssign.captainUid);
                        return (
                          <span
                            key={capAssign.id}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-extrabold ${
                              isOnline
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : 'bg-teal-50 border-teal-200 text-teal-900'
                            }`}
                          >
                            {isOnline && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />}
                            <span>{capAssign.captainName}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{isEn ? 'No Captain Assigned' : 'بلا كابتن موزّع'}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono-num font-bold" style={{ color: ui.theme.mutedText }}>
                    {tableNums.length} {isEn ? 'tables' : 'ترابيزة'}
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                  {tableNums.map((tblNum) => {
                    const snap = getTableSnapshot(hall.name, tblNum);
                    const tileColor = opsConfig.tableColors[snap.state];
                    const tblCaptains = getCaptainsForTable(hall.id, tblNum);
                    return (
                      <button
                        key={`${hall.id}_${tblNum}`}
                        type="button"
                        onClick={() => {
                          setDrawerFeedback(null);
                          setDrawerOrderOpen(false);
                          setSelectedTable({ hall, tableNumber: tblNum });
                        }}
                        style={{ backgroundColor: tileColor }}
                        className="rounded-2xl p-2.5 text-white shadow-xs hover:opacity-95 transition-transform active:scale-[0.98] flex flex-col items-center justify-between min-h-[104px] cursor-pointer"
                      >
                        <div className="w-full flex items-center justify-between text-[10px] font-extrabold opacity-90">
                          <span>
                            {snap.state === 'empty'
                              ? isEn
                                ? 'Open'
                                : 'شاغرة'
                              : snap.state === 'billRequested'
                                ? isEn
                                  ? 'Check'
                                  : 'شيك'
                                : snap.state === 'overdue'
                                  ? isEn
                                    ? 'Overdue'
                                    : 'متأخرة'
                                  : isEn
                                    ? 'Seated'
                                    : 'مشغولة'}
                          </span>
                          {snap.elapsedMins > 0 && (
                            <span className="font-mono-num">
                              {snap.elapsedMins}
                              {isEn ? 'm' : 'د'}
                            </span>
                          )}
                        </div>

                        <span className="text-xl font-extrabold font-mono-num tracking-tight">
                          {tblNum}
                        </span>

                        <div className="w-full space-y-0.5 text-center">
                          <div className="text-[10px] font-bold opacity-95 truncate">
                            {snap.itemsCount > 0
                              ? perms.showPrices
                                ? `${snap.itemsCount} · ${formatMoney(snap.total)}`
                                : `${snap.itemsCount} ${isEn ? 'items' : 'صنف'}`
                              : snap.seatedGuests.length > 0
                                ? `${snap.seatedGuests.length} ${isEn ? 'guests' : 'ضيوف'} · ${snap.seatedGuests[0]}`
                                : isEn
                                  ? 'Available'
                                  : 'متاحة'}
                          </div>
                          <div className="px-1.5 py-0.5 rounded bg-black/20 text-[9px] font-extrabold truncate">
                            {tblCaptains.length > 0
                              ? tblCaptains.map((c) => c.captainName.split(' ')[0]).join(' · ')
                              : isEn
                                ? 'Unassigned'
                                : 'بلا كابتن'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Table Detail Drawer */}
      {selectedTable && (() => {
        const snap = getTableSnapshot(selectedTable.hall.name, selectedTable.tableNumber);
        const tblCaps = getCaptainsForTable(selectedTable.hall.id, selectedTable.tableNumber);
        return (
          <div
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex justify-end"
            onClick={() => setSelectedTable(null)}
          >
            <div
              dir={dir}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col justify-between"
              style={{ backgroundColor: ui.theme.surfaceBg, color: ui.theme.surfaceText }}
            >
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2 border-b pb-3" style={{ borderColor: ui.theme.surfaceBorder }}>
                  <div>
                    <p className="text-[11px] font-bold" style={{ color: ui.theme.highlightHex || '#E8833A' }}>
                      {loc(selectedTable.hall.name, selectedTable.hall.name_en)}
                    </p>
                    <h3 className="text-lg font-extrabold" style={{ color: ui.theme.surfaceText }}>
                      {isEn ? `Table ${selectedTable.tableNumber}` : `ترابيزة ${selectedTable.tableNumber}`}
                    </h3>
                    <p className="text-[11px] mt-0.5" style={{ color: ui.theme.mutedText }}>
                      {isEn ? 'Assigned Captain:' : 'الكابتن المسؤول:'}{' '}
                      <strong style={{ color: ui.theme.surfaceText }}>
                        {tblCaps.length > 0
                          ? tblCaps.map((c) => c.captainName).join('، ')
                          : isEn
                            ? 'Unassigned in this shift'
                            : 'غير مسندة لكابتن بهذه الوردية'}
                      </strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTable(null)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer"
                    style={{ backgroundColor: ui.theme.surfaceSubtleBg, color: ui.theme.surfaceText }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {drawerFeedback && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold ${
                      drawerFeedback.type === 'ok'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    {drawerFeedback.text}
                  </div>
                )}

                {snap.seatedGuests.length > 0 && (
                  <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 space-y-2">
                    <p className="text-xs font-extrabold text-sky-950 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-sky-700" />
                      <span>
                        {isEn
                          ? `Seated Guests (${snap.seatedGuests.length})`
                          : `الضيوف المسجلون على الطاولة (${snap.seatedGuests.length})`}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {snap.seatedGuests.map((gName) => (
                        <span
                          key={gName}
                          className="px-2.5 py-1 rounded-lg bg-white border border-sky-200 text-[11px] font-extrabold text-sky-950"
                        >
                          {gName}
                        </span>
                      ))}
                    </div>
                    {snap.sessionPendingItems.length > 0 && (
                      <div className="pt-2 border-t border-sky-200/80 space-y-1">
                        <p className="text-[11px] font-extrabold text-sky-900">
                          {isEn ? 'In Guest Shared Cart:' : 'في السلة المشتركة للطاولة:'}
                        </p>
                        {snap.sessionPendingItems.map((it) => (
                          <div key={it.cartKey} className="text-[11px] font-bold text-sky-950 truncate">
                            {it.quantity}× {loc(it.name, it.name_en)}
                            {it.guestName ? ` [${it.guestName}]` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {snap.tblOrders.length === 0 ? (
                  <div
                    className="p-5 rounded-2xl border text-center space-y-1"
                    style={{ backgroundColor: ui.theme.surfaceSubtleBg, borderColor: ui.theme.surfaceBorder }}
                  >
                    <p className="text-xs font-bold" style={{ color: ui.theme.mutedText }}>
                      {snap.seatedGuests.length > 0
                        ? isEn
                          ? 'Guests seated — awaiting first order.'
                          : 'الضيوف جالسون على الطاولة ولم يرسلوا طلبهم بعد.'
                        : isEn
                          ? 'Table currently has no open orders.'
                          : 'لا توجد طلبات مفتوحة على هذه الترابيزة حالياً.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {snap.tblOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3.5 rounded-2xl border space-y-2"
                        style={{ backgroundColor: ui.theme.surfaceSubtleBg, borderColor: ui.theme.surfaceBorder }}
                      >
                        <div className="flex items-center justify-between text-xs font-extrabold">
                          <span className="font-mono-num">#{ord.orderNumber}</span>
                          {perms.showPrices && (
                            <span className="font-mono-num text-emerald-700">{formatMoney(ord.total)}</span>
                          )}
                        </div>
                        <div className="space-y-1.5 text-xs">
                          {ord.items.map((it, idx) => {
                            const stState = ord.itemProgress?.[String(idx)] || 'pending';
                            const key = `${ord.id}:${idx}`;
                            return (
                              <div key={idx} className="flex items-center justify-between gap-2">
                                <span className="font-bold">
                                  {it.quantity}× {it.name} {it.sizeName ? `(${it.sizeName})` : ''}
                                  {it.guestName ? ` [${it.guestName}]` : ''}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {perms.canUpdatePrepProgress && stState === 'ready' && (
                                    <button
                                      type="button"
                                      disabled={servingKey === key}
                                      onClick={() => handleMarkItemServed(ord.id, ord.orderNumber, idx)}
                                      className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-extrabold cursor-pointer disabled:opacity-50"
                                    >
                                      {isEn ? 'Serve' : 'تم التقديم'}
                                    </button>
                                  )}
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded border font-bold"
                                    style={{
                                      backgroundColor: ui.theme.surfaceBg,
                                      borderColor: ui.theme.surfaceBorder,
                                    }}
                                  >
                                    {stState === 'ready'
                                      ? isEn
                                        ? 'Ready'
                                        : 'جاهز'
                                      : stState === 'served'
                                        ? isEn
                                          ? 'Served'
                                          : 'تم التقديم'
                                        : isEn
                                          ? 'Preparing'
                                          : 'تحضير'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Table Order Pad inside Drawer */}
                {perms.canAddEditTableOrders && drawerOrderOpen && (
                  <div
                    className="p-3.5 rounded-2xl border space-y-3"
                    style={{ backgroundColor: ui.theme.surfaceSubtleBg, borderColor: ui.theme.surfaceBorder }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold">
                        {isEn ? 'New Table Ticket' : 'إضافة أصناف على الترابيزة'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDrawerOrderOpen(false)}
                        className="text-[11px] font-bold text-zinc-500 hover:underline cursor-pointer"
                      >
                        {isEn ? 'Hide' : 'إخفاء'}
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        value={drawerSearch}
                        onChange={(e) => setDrawerSearch(e.target.value)}
                        placeholder={isEn ? 'Search menu item...' : 'ابحث عن صنف...'}
                        className="w-full ps-8 pe-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-bold"
                      />
                    </div>

                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                      <button
                        type="button"
                        onClick={() => setDrawerCatId('all')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer ${
                          drawerCatId === 'all' ? 'bg-zinc-950 text-white' : 'bg-white border border-zinc-200'
                        }`}
                      >
                        {isEn ? 'All' : 'الكل'}
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setDrawerCatId(cat.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer ${
                            drawerCatId === cat.id ? 'bg-zinc-950 text-white' : 'bg-white border border-zinc-200'
                          }`}
                        >
                          {loc(cat.name, cat.name_en)}
                        </button>
                      ))}
                    </div>

                    <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-1.5">
                      {filteredDrawerItems.slice(0, 24).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleAddDrawerItem(item)}
                          className="p-2 rounded-xl border border-zinc-200 bg-white hover:bg-amber-50 text-start text-[11px] font-extrabold cursor-pointer flex flex-col justify-between gap-1"
                        >
                          <span className="line-clamp-1">{loc(item.name, item.name_en)}</span>
                          {perms.showPrices && (
                            <span className="font-mono-num text-[10px] text-amber-700">
                              {formatMoney(item.sizes[0]?.price ?? item.basePrice)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {drawerCart.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-zinc-200">
                        {drawerCart.map((c) => (
                          <div key={c.key} className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-bold truncate">
                              {loc(c.item.name, c.item.name_en)}
                              {c.size ? ` (${c.size.name})` : ''}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setDrawerCart((prev) =>
                                    prev
                                      .map((p) => (p.key === c.key ? { ...p, quantity: p.quantity - 1 } : p))
                                      .filter((p) => p.quantity > 0)
                                  )
                                }
                                className="w-6 h-6 rounded bg-zinc-200 flex items-center justify-center cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-mono-num font-extrabold w-5 text-center">{c.quantity}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setDrawerCart((prev) =>
                                    prev.map((p) => (p.key === c.key ? { ...p, quantity: p.quantity + 1 } : p))
                                  )
                                }
                                className="w-6 h-6 rounded bg-zinc-200 flex items-center justify-center cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          disabled={drawerBusy}
                          onClick={handleSubmitDrawerOrder}
                          className="w-full min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Send Order to Kitchen & Cashier' : 'إرسال الطلب للمطبخ والكاشير'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </div>

              <div
                className="p-5 border-t space-y-2"
                style={{ backgroundColor: ui.theme.surfaceSubtleBg, borderColor: ui.theme.surfaceBorder }}
              >
                {perms.canAddEditTableOrders && (
                  <button
                    type="button"
                    onClick={() => setDrawerOrderOpen((v) => !v)}
                    className={`w-full min-h-[44px] text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
                    style={{ backgroundColor: ui.theme.accentHex, color: ui.theme.accentTextHex }}
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {drawerOrderOpen
                        ? isEn
                          ? 'Close Quick Order Pad'
                          : 'إغلاق إضافة الأصناف'
                        : isEn
                          ? 'Add Items to Table'
                          : 'إضافة أصناف على الترابيزة'}
                    </span>
                  </button>
                )}

                {snap.tblOrders.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={drawerBusy}
                      onClick={() => handleRequestBillFromDrawer('request_bill_cash')}
                      className="min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Request Check (Cash)' : 'طلب الشيك كاش'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={drawerBusy}
                      onClick={() => handleRequestBillFromDrawer('request_bill_card')}
                      className="min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Request Check (Visa)' : 'طلب الشيك فيزا'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
