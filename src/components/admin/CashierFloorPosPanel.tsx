import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  BellRing,
  CheckCheck,
  Clock,
  CreditCard,
  Edit3,
  Grid,
  MapPin,
  Minus,
  Percent,
  Phone,
  Plus,
  Printer,
  Scissors,
  Search,
  Send,
  Settings,
  ShoppingBag,
  Trash2,
  Truck,
  User,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  getHallTableNumbers,
  submitPublicOrder,
} from '../../lib/firestoreService';
import {
  getTimestampMillis,
  updateRestaurantOperationsConfig,
} from '../../lib/operationsService';
import {
  getDefaultFallbackStationId,
  resolveOrderItemStations,
  StationMeta,
} from '../../lib/stationUtils';
import {
  Category,
  CustomerProfile,
  Hall,
  ItemAddon,
  ItemSize,
  MenuItem,
  OperationsConfig,
  Order,
  OrderItemPayload,
  OrderPaymentMethod,
  OrderType,
  Restaurant,
  ServiceCall,
  ServiceCallStatus,
  StaffActorInfo,
  TableGridColors,
} from '../../types/menu';
import type { SettleTarget, TableMasterGroup } from './LiveOrdersTab';

interface CashierFloorPosPanelProps {
  restaurant: Restaurant;
  halls: Hall[];
  orders: Order[];
  serviceCalls: ServiceCall[];
  categories: Category[];
  menuItems: MenuItem[];
  customers: CustomerProfile[];
  effectiveStations: StationMeta[];
  opsConfig: OperationsConfig;
  actor: StaffActorInfo;
  openTableGroups: TableMasterGroup[];
  canEditOpenOrders: boolean;
  canApplyInstantDiscount: boolean;
  canCancelOpenOrders: boolean;
  canConfigureGridColors: boolean;
  canAddEditTableOrders?: boolean;
  canSettleChecks?: boolean;
  canManageServiceCalls?: boolean;
  mode: 'tables' | 'pos';
  prefillPosTable: { hallName: string; tableNumber: string } | null;
  onConsumePrefill: () => void;
  onSelectTablePos: (hallName: string, tableNumber: string) => void;
  onOpenSettlement: (target: SettleTarget, preferredMethod?: OrderPaymentMethod) => void;
  onOpenModifyOrder: (order: Order) => void;
  onOpenSplitCheck: (order: Order) => void;
  onOpenReceipt: (payload: { tableGroup?: TableMasterGroup; order?: Order }) => void;
  onResolveCall: (call: ServiceCall, status: ServiceCallStatus) => Promise<void>;
  onRestaurantUpdated?: (updated: Restaurant) => void;
}

export function CashierFloorPosPanel({
  restaurant,
  halls,
  orders,
  serviceCalls,
  categories,
  menuItems,
  customers,
  effectiveStations,
  opsConfig,
  actor,
  openTableGroups,
  canEditOpenOrders,
  canApplyInstantDiscount,
  canCancelOpenOrders,
  canConfigureGridColors,
  canAddEditTableOrders = true,
  canSettleChecks = true,
  canManageServiceCalls = true,
  mode,
  prefillPosTable,
  onConsumePrefill,
  onSelectTablePos,
  onOpenSettlement,
  onOpenModifyOrder,
  onOpenSplitCheck,
  onOpenReceipt,
  onResolveCall,
  onRestaurantUpdated,
}: CashierFloorPosPanelProps) {
  const { lang, dir, loc, formatCurrency } = useLanguage();
  const isEn = lang === 'en';
  const currencyLabel = formatCurrency(restaurant.currency);
  const formatMoney = (val: number) => `${Number(val || 0).toFixed(2).replace(/\.00$/, '')} ${currencyLabel}`;

  const [selectedHallFilter, setSelectedHallFilter] = useState<string>('all');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [selectedTableDrawer, setSelectedTableDrawer] = useState<{
    hallName: string;
    tableNumber: string;
  } | null>(null);
  const [callBusyId, setCallBusyId] = useState<string | null>(null);

  // Color & SLA settings modal (Owner / permitted Manager only)
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);
  const [colorDraft, setColorDraft] = useState<TableGridColors>(opsConfig.tableColors);
  const [overdueDraft, setOverdueDraft] = useState<number>(opsConfig.tableOverdueMinutes);
  const [savingGridSettings, setSavingGridSettings] = useState(false);
  const [gridSettingsError, setGridSettingsError] = useState<string | null>(null);

  // Cashier Fast POS state
  const [posOrderType, setPosOrderType] = useState<OrderType>('dine_in');
  const [posHallName, setPosHallName] = useState<string>('');
  const [posTableNumber, setPosTableNumber] = useState<string>('');
  const [posCustomerName, setPosCustomerName] = useState<string>('');
  const [posCustomerPhone, setPosCustomerPhone] = useState<string>('');
  const [posDeliveryAddress, setPosDeliveryAddress] = useState<string>('');
  const [posOrderNotes, setPosOrderNotes] = useState<string>('');
  const [posSelectedCatId, setPosSelectedCatId] = useState<string>('all');
  const [posSearchQuery, setPosSearchQuery] = useState<string>('');
  const [posDiscountMode, setPosDiscountMode] = useState<'none' | 'amount' | 'percent'>('none');
  const [posDiscountValue, setPosDiscountValue] = useState<string>('');
  const [posDiscountReason, setPosDiscountReason] = useState<string>('');
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
  const [posSubmitting, setPosSubmitting] = useState<'send' | 'settle' | null>(null);
  const [posFeedback, setPosFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setColorDraft(opsConfig.tableColors);
    setOverdueDraft(opsConfig.tableOverdueMinutes);
  }, [opsConfig.tableColors, opsConfig.tableOverdueMinutes]);

  useEffect(() => {
    if (!posHallName && halls.length > 0) {
      setPosHallName(halls[0].name);
    }
  }, [halls, posHallName]);

  useEffect(() => {
    if (prefillPosTable && mode === 'pos') {
      setPosOrderType('dine_in');
      if (prefillPosTable.hallName) setPosHallName(prefillPosTable.hallName);
      if (prefillPosTable.tableNumber) setPosTableNumber(prefillPosTable.tableNumber);
      setPosFeedback(null);
      onConsumePrefill();
    }
  }, [prefillPosTable, mode, onConsumePrefill]);

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
    return Array.from(names);
  }, [halls]);

  const gridHalls = useMemo(() => {
    const filtered =
      selectedHallFilter === 'all'
        ? halls
        : halls.filter((h) => h.name.trim() === selectedHallFilter);
    return filtered.map((h) => ({
      hall: h,
      tableNumbers: getHallTableNumbers(h),
    }));
  }, [halls, selectedHallFilter]);

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

  const floorSummary = useMemo(() => {
    let empty = 0;
    let occupied = 0;
    let billRequested = 0;
    let overdue = 0;
    let activeRevenue = 0;

    gridHalls.forEach(({ hall, tableNumbers }) => {
      tableNumbers.forEach((tblNum) => {
        const snap = getTableSnapshot(hall.name, tblNum);
        if (snap.state === 'empty') empty += 1;
        else if (snap.state === 'billRequested') billRequested += 1;
        else if (snap.state === 'overdue') overdue += 1;
        else occupied += 1;
        activeRevenue += snap.total;
      });
    });

    return { empty, occupied, billRequested, overdue, activeRevenue };
  }, [gridHalls, orders, serviceCalls, nowTick, opsConfig.tableOverdueMinutes]);

  const findTableGroupForDrawer = (hallName: string, tableNumber: string): TableMasterGroup | null => {
    const cleanTbl = tableNumber.trim();
    const cleanHall = hallName.trim();
    return (
      openTableGroups.find(
        (g) =>
          g.tableNumber.trim() === cleanTbl &&
          (!g.hallName || !cleanHall || g.hallName.trim() === cleanHall)
      ) || null
    );
  };

  const handleSaveGridSettings = async () => {
    setSavingGridSettings(true);
    setGridSettingsError(null);
    try {
      const nextConfig: OperationsConfig = {
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
    } catch (err) {
      setGridSettingsError(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not save color settings.'
            : 'تعذر حفظ إعدادات الألوان.'
      );
    } finally {
      setSavingGridSettings(false);
    }
  };

  // POS Helpers
  const selectedHallTableOptions = useMemo(() => {
    const matchedHall = halls.find((h) => h.name === posHallName);
    return matchedHall ? getHallTableNumbers(matchedHall) : [];
  }, [halls, posHallName]);

  const matchingCustomers = useMemo(() => {
    const q = posCustomerPhone.trim();
    if (q.length < 3 || posOrderType === 'dine_in') return [];
    return customers.filter((c) => c.phone.includes(q) || c.fullName.includes(q)).slice(0, 6);
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
    const rawDiscVal = Math.max(0, Number(posDiscountValue) || 0);
    let discountAmount = 0;
    let manualDiscountPercent = 0;
    if (canApplyInstantDiscount && posDiscountMode === 'percent' && rawDiscVal > 0) {
      manualDiscountPercent = Math.min(100, rawDiscVal);
      discountAmount = Number(((subtotal * manualDiscountPercent) / 100).toFixed(2));
    } else if (canApplyInstantDiscount && posDiscountMode === 'amount' && rawDiscVal > 0) {
      discountAmount = Number(Math.min(subtotal, rawDiscVal).toFixed(2));
    }
    const netSubtotal = Math.max(0, Number((subtotal - discountAmount).toFixed(2)));
    const serviceCharge =
      posOrderType === 'dine_in'
        ? Number(((netSubtotal * (restaurant.serviceCharge || 0)) / 100).toFixed(2))
        : 0;
    const deliveryFee =
      posOrderType === 'delivery' ? Number(restaurant.deliveryFee || 0) : 0;
    const taxAmount = Number(
      (((netSubtotal + serviceCharge) * (restaurant.taxRate || 0)) / 100).toFixed(2)
    );
    const total = Number((netSubtotal + serviceCharge + taxAmount + deliveryFee).toFixed(2));
    return {
      subtotal,
      discountAmount,
      manualDiscountPercent,
      serviceCharge,
      deliveryFee,
      taxAmount,
      total,
    };
  }, [
    posCart,
    posOrderType,
    restaurant.serviceCharge,
    restaurant.deliveryFee,
    restaurant.taxRate,
    canApplyInstantDiscount,
    posDiscountMode,
    posDiscountValue,
  ]);

  const handleSubmitCashierPos = async (andSettleNow: boolean) => {
    setPosFeedback(null);
    if (posCart.length === 0) {
      setPosFeedback({
        type: 'err',
        text: isEn ? 'Add at least one item before sending the order.' : 'أضف صنفاً واحداً على الأقل قبل إرسال الطلب.',
      });
      return;
    }
    if (posOrderType === 'dine_in' && !posTableNumber.trim()) {
      setPosFeedback({
        type: 'err',
        text: isEn ? 'Please select the table number for dine-in.' : 'يرجى تحديد رقم الترابيزة لطلب الصالة.',
      });
      return;
    }
    if (posOrderType === 'delivery' && !posDeliveryAddress.trim()) {
      setPosFeedback({
        type: 'err',
        text: isEn ? 'Please enter the delivery address.' : 'يرجى كتابة عنوان التوصيل لطلب الدليفري.',
      });
      return;
    }
    if (posOrderType === 'delivery' && !posCustomerName.trim()) {
      setPosFeedback({
        type: 'err',
        text: isEn ? 'Please enter the customer name for delivery.' : 'يرجى إدخال اسم العميل لطلب الدليفري.',
      });
      return;
    }
    if (posTotals.discountAmount > 0 && posDiscountReason.trim().length < 2) {
      setPosFeedback({
        type: 'err',
        text: isEn
          ? 'Enter a discount reason (at least 2 characters).'
          : 'يرجى كتابة سبب الخصم (حرفين على الأقل).',
      });
      return;
    }

    const resolvedCustomerName =
      posOrderType === 'dine_in'
        ? posCustomerName.trim() || (isEn ? `Dine-in (${actor.name})` : `صالة (${actor.name})`)
        : posOrderType === 'pickup'
          ? posCustomerName.trim() || (isEn ? 'Takeaway Guest' : 'عميل تيك أواي')
          : posCustomerName.trim();

    setPosSubmitting(andSettleNow ? 'settle' : 'send');
    try {
      const fallbackStation = getDefaultFallbackStationId(effectiveStations);
      const orderItems: OrderItemPayload[] = posCart.map((entry) => {
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
          ...(entry.notes ? { notes: entry.notes } : {}),
          station: primarySt,
          stationId: primarySt,
          stationIds: stList,
        };
      });

      const res = await submitPublicOrder({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        customerName: resolvedCustomerName,
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
        discountAmount: posTotals.discountAmount > 0 ? posTotals.discountAmount : undefined,
        manualDiscountAmount: posTotals.discountAmount > 0 ? posTotals.discountAmount : undefined,
        manualDiscountPercent:
          posTotals.manualDiscountPercent > 0 ? posTotals.manualDiscountPercent : undefined,
        manualDiscountReason:
          posTotals.discountAmount > 0 ? posDiscountReason.trim() : undefined,
        taxAmount: posTotals.taxAmount,
        total: posTotals.total,
        actor,
      });

      const syntheticOrder: Order = {
        id: res.id,
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        orderNumber: res.orderNumber,
        customerName: resolvedCustomerName,
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
        discountAmount: posTotals.discountAmount > 0 ? posTotals.discountAmount : undefined,
        manualDiscountAmount: posTotals.discountAmount > 0 ? posTotals.discountAmount : undefined,
        manualDiscountPercent:
          posTotals.manualDiscountPercent > 0 ? posTotals.manualDiscountPercent : undefined,
        manualDiscountReason:
          posTotals.discountAmount > 0 ? posDiscountReason.trim() : undefined,
        taxAmount: posTotals.taxAmount,
        total: posTotals.total,
        status: 'pending',
        createdAt: new Date(),
        createdByUid: actor.uid,
        createdByName: actor.name,
        createdByRole: actor.role,
      };

      setPosCart([]);
      setPosOrderNotes('');
      setPosDiscountMode('none');
      setPosDiscountValue('');
      setPosDiscountReason('');
      if (posOrderType !== 'dine_in') {
        setPosCustomerName('');
        setPosCustomerPhone('');
        setPosDeliveryAddress('');
      }
      setPosFeedback({
        type: 'ok',
        text: andSettleNow
          ? isEn
            ? `Order #${res.orderNumber} sent to stations — opening instant settlement...`
            : `تم إرسال الطلب #${res.orderNumber} للمحطات وجاري فتح نافذة التحصيل الفوري...`
          : isEn
            ? `Order #${res.orderNumber} sent to kitchen and stations.`
            : `تم إرسال الطلب #${res.orderNumber} للمحطات والمطبخ بنجاح.`,
      });

      if (andSettleNow) {
        onOpenSettlement({ type: 'order', order: syntheticOrder }, 'cash');
      }
    } catch (err) {
      setPosFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : isEn ? 'Could not submit order right now.' : 'تعذر إرسال الطلب الآن.',
      });
    } finally {
      setPosSubmitting(null);
    }
  };

  return (
    <div dir={dir} className="space-y-4">
      {/* ============================================================== */}
      {/* VIEW 1: LIVE COLOR-CODED FLOOR MAP FOR CASHIER                 */}
      {/* ============================================================== */}
      {mode === 'tables' && (
        <div className="space-y-4">
          {/* Summary KPI Strip + Hall Filter + Conditional Color Settings */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold text-zinc-500">
                    {isEn ? 'Available Tables' : 'ترابيزات شاغرة'}
                  </p>
                  <p className="text-lg font-extrabold font-mono-num text-zinc-950">{floorSummary.empty}</p>
                </div>
                <span
                  className="w-3.5 h-3.5 rounded-sm shrink-0"
                  style={{ backgroundColor: opsConfig.tableColors.empty }}
                />
              </div>

              <div className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold text-zinc-500">
                    {isEn ? 'Occupied Now' : 'مشغولة الآن'}
                  </p>
                  <p className="text-lg font-extrabold font-mono-num text-zinc-950">{floorSummary.occupied}</p>
                </div>
                <span
                  className="w-3.5 h-3.5 rounded-sm shrink-0"
                  style={{ backgroundColor: opsConfig.tableColors.occupied }}
                />
              </div>

              <div className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold text-zinc-500">
                    {isEn ? 'Check Requested' : 'طلب الشيك'}
                  </p>
                  <p className="text-lg font-extrabold font-mono-num text-zinc-950">{floorSummary.billRequested}</p>
                </div>
                <span
                  className="w-3.5 h-3.5 rounded-sm shrink-0"
                  style={{ backgroundColor: opsConfig.tableColors.billRequested }}
                />
              </div>

              <div className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold text-zinc-500">
                    {isEn
                      ? `Overdue (+${opsConfig.tableOverdueMinutes}m)`
                      : `متأخرة (+${opsConfig.tableOverdueMinutes}د)`}
                  </p>
                  <p className="text-lg font-extrabold font-mono-num text-zinc-950">{floorSummary.overdue}</p>
                </div>
                <span
                  className="w-3.5 h-3.5 rounded-sm shrink-0"
                  style={{ backgroundColor: opsConfig.tableColors.overdue }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-100">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedHallFilter('all')}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedHallFilter === 'all'
                      ? 'bg-zinc-950 text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {isEn ? `All Halls (${halls.length})` : `كل الصالات (${halls.length})`}
                </button>
                {hallFilterOptions.map((hName) => (
                  <button
                    key={hName}
                    type="button"
                    onClick={() => setSelectedHallFilter(hName)}
                    className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
                      selectedHallFilter === hName
                        ? 'bg-amber-500 text-zinc-950'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{hName}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {floorSummary.activeRevenue > 0 && (
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-extrabold font-mono-num whitespace-nowrap">
                    {isEn ? 'Open Checks:' : 'شيكات مفتوحة:'} {formatMoney(floorSummary.activeRevenue)}
                  </span>
                )}
                {canConfigureGridColors && (
                  <button
                    type="button"
                    onClick={() => setGridSettingsOpen(true)}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-extrabold text-zinc-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{isEn ? 'Table Colors & Overdue SLA' : 'ألوان الترابيزات ووقت التأخير'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Color-coded Hall Grids */}
          {gridHalls.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center space-y-2">
              <Grid className="w-8 h-8 text-zinc-300 mx-auto" />
              <h3 className="text-sm font-extrabold text-zinc-900">
                {isEn ? 'No halls or tables added yet' : 'لا توجد صالات أو ترابيزات مضافة بعد'}
              </h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                {isEn
                  ? 'Halls and QR codes are created from the Owner or Manager panel. You can still take Takeaway & Delivery orders from the Cashier POS.'
                  : 'تُنشأ الصالات وأكواد QR من لوحة صاحب المطعم أو المدير المصرّح له، ويمكنك حالياً استقبال طلبات التيك أواي والدليفري من نقطة بيع الكاشير.'}
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
                    {tableNumbers.length}{' '}
                    {isEn ? (tableNumbers.length === 1 ? 'table' : 'tables') : 'ترابيزة'}
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
                        onClick={() => setSelectedTableDrawer({ hallName: hall.name, tableNumber: tblNum })}
                        style={{ backgroundColor: tileColor }}
                        className="rounded-2xl p-3 text-white shadow-xs hover:opacity-95 transition-transform active:scale-[0.98] flex flex-col items-center justify-between min-h-[96px] cursor-pointer relative overflow-hidden"
                      >
                        <div className="w-full flex items-center justify-between text-[10px] font-extrabold opacity-95">
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
                          <span className="flex items-center gap-1 font-mono-num">
                            {snap.tblCalls.length > 0 && <BellRing className="w-3 h-3 animate-pulse" />}
                            {snap.elapsedMins > 0 ? `${snap.elapsedMins}${isEn ? 'm' : 'د'}` : ''}
                          </span>
                        </div>

                        <span className="text-xl font-extrabold font-mono-num tracking-tight">
                          {tblNum}
                        </span>

                        <div className="text-[10px] font-bold opacity-95 truncate w-full text-center font-mono-num">
                          {snap.itemsCount > 0
                            ? `${snap.itemsCount} ${isEn ? 'items' : 'صنف'} · ${formatMoney(snap.total)}`
                            : isEn
                              ? 'Ready for guests'
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
            <span className="text-[11px] font-extrabold text-zinc-500">
              {isEn ? 'Color Legend:' : 'دليل الألوان:'}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-3.5 h-3.5 rounded-sm inline-block"
                style={{ backgroundColor: opsConfig.tableColors.empty }}
              />
              <span>{isEn ? 'Available' : 'شاغرة'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-3.5 h-3.5 rounded-sm inline-block"
                style={{ backgroundColor: opsConfig.tableColors.occupied }}
              />
              <span>{isEn ? 'Occupied' : 'مشغولة'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-3.5 h-3.5 rounded-sm inline-block"
                style={{ backgroundColor: opsConfig.tableColors.billRequested }}
              />
              <span>{isEn ? 'Check Requested' : 'طلب الشيك'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-3.5 h-3.5 rounded-sm inline-block"
                style={{ backgroundColor: opsConfig.tableColors.overdue }}
              />
              <span>
                {isEn
                  ? `Overdue (+${opsConfig.tableOverdueMinutes}m)`
                  : `متأخرة (+${opsConfig.tableOverdueMinutes} د)`}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 2: CASHIER FAST POS (DINE-IN / TAKEAWAY / DELIVERY)       */}
      {/* ============================================================== */}
      {mode === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left 8 cols: Search, Category Pills & Fast Text-Only Menu Grid */}
          <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={posSearchQuery}
                  onChange={(e) => setPosSearchQuery(e.target.value)}
                  placeholder={isEn ? 'Search item by name to add instantly...' : 'ابحث عن صنف بالاسم لإضافته فوراً للفاتورة...'}
                  className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <span className="text-[11px] font-bold text-zinc-500 whitespace-nowrap">
                {posFilteredItems.length} {isEn ? 'available items' : 'صنف متاح'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setPosSelectedCatId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer ${
                  posSelectedCatId === 'all'
                    ? 'bg-zinc-950 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {isEn ? 'All Categories' : 'كل الأقسام'} ({menuItems.filter((m) => m.isAvailable !== false).length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setPosSelectedCatId(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer ${
                    posSelectedCatId === cat.id
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {loc(cat.name, cat.name_en)}
                </button>
              ))}
            </div>

            {posFilteredItems.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-8">
                {isEn ? 'No available items match your search.' : 'لا توجد أصناف متاحة تطابق البحث الآن.'}
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
                      className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-amber-50 hover:border-amber-300 text-start transition-colors flex flex-col justify-between gap-1.5 min-h-[78px] cursor-pointer"
                    >
                      <span className="text-xs font-extrabold text-zinc-950 line-clamp-2 leading-snug">
                        {loc(item.name, item.name_en)}
                      </span>
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="font-mono-num font-extrabold text-amber-800">
                          {formatMoney(item.sizes[0]?.price ?? item.basePrice)}
                        </span>
                        {hasOptions && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-zinc-200 text-zinc-600 font-bold">
                            {isEn ? 'Options' : 'خيارات'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right 4 cols: Order Type + Customer/Table Details + Cart + Send/Instant Settle */}
          <div className="lg:col-span-4 bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'dine_in' as const, label: isEn ? 'Dine-in' : 'صالة', Icon: Utensils },
                  { id: 'pickup' as const, label: isEn ? 'Takeaway' : 'تيك أواي', Icon: ShoppingBag },
                  { id: 'delivery' as const, label: isEn ? 'Delivery' : 'دليفري', Icon: Truck },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPosOrderType(id)}
                  className={`py-2 px-2 rounded-xl border text-xs font-extrabold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    posOrderType === id
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {posOrderType === 'dine_in' ? (
              <div className="grid grid-cols-2 gap-2">
                {halls.length > 0 ? (
                  <select
                    value={posHallName}
                    onChange={(e) => {
                      setPosHallName(e.target.value);
                      setPosTableNumber('');
                    }}
                    className="px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold bg-white"
                  >
                    {halls.map((h) => (
                      <option key={h.id} value={h.name}>
                        {loc(h.name, h.name_en)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder={isEn ? 'Hall name' : 'اسم الصالة'}
                    value={posHallName}
                    onChange={(e) => setPosHallName(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold"
                  />
                )}

                {selectedHallTableOptions.length > 0 ? (
                  <select
                    value={posTableNumber}
                    onChange={(e) => setPosTableNumber(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono-num font-extrabold bg-white"
                  >
                    <option value="">{isEn ? 'Table # *' : 'رقم الترابيزة *'}</option>
                    {selectedHallTableOptions.map((tbl) => (
                      <option key={tbl} value={tbl}>
                        {isEn ? `Table ${tbl}` : `ترابيزة ${tbl}`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder={isEn ? 'Table # *' : 'رقم الترابيزة *'}
                    value={posTableNumber}
                    onChange={(e) => setPosTableNumber(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono-num font-extrabold"
                  />
                )}

                <input
                  type="text"
                  placeholder={isEn ? 'Guest name on table (optional)' : 'اسم الضيف على الطاولة (اختياري)'}
                  value={posCustomerName}
                  onChange={(e) => setPosCustomerName(e.target.value)}
                  className="col-span-2 px-3 py-2 rounded-xl border border-zinc-200 text-xs"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder={
                      posOrderType === 'delivery'
                        ? isEn
                          ? 'Customer phone (auto-lookup address)'
                          : 'رقم هاتف العميل (بحث تلقائي عن العنوان)'
                        : isEn
                          ? 'Customer phone (optional for lookup/save)'
                          : 'هاتف العميل (اختياري للبحث أو الحفظ)'
                    }
                    value={posCustomerPhone}
                    onChange={(e) => setPosCustomerPhone(e.target.value)}
                    className="w-full ps-8 pe-3 py-2 rounded-xl border border-zinc-200 text-xs font-mono-num"
                  />
                </div>
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
                        className="w-full px-3 py-1.5 text-start text-[11px] hover:bg-amber-50 flex justify-between gap-2 cursor-pointer"
                      >
                        <span className="font-bold text-zinc-900 truncate">{c.fullName}</span>
                        <span className="font-mono-num text-zinc-500 shrink-0">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={
                      posOrderType === 'pickup'
                        ? isEn
                          ? 'Customer name (optional — default: Takeaway Guest)'
                          : 'اسم العميل (اختياري — افتراضي: عميل تيك أواي)'
                        : isEn
                          ? 'Customer name *'
                          : 'اسم العميل *'
                    }
                    value={posCustomerName}
                    onChange={(e) => setPosCustomerName(e.target.value)}
                    className="w-full ps-8 pe-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold"
                  />
                </div>
                {posOrderType === 'delivery' && (
                  <input
                    type="text"
                    placeholder={isEn ? 'Full delivery address *' : 'عنوان التوصيل بالتفصيل *'}
                    value={posDeliveryAddress}
                    onChange={(e) => setPosDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-bold"
                  />
                )}
              </div>
            )}

            {/* Cart Items */}
            <div className="border-t border-zinc-100 pt-3 space-y-2 max-h-60 overflow-y-auto">
              {posCart.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-5">
                  {isEn
                    ? 'Tap any menu item to add it to the check'
                    : 'اضغط على أي صنف من القائمة لإضافته للفاتورة'}
                </p>
              ) : (
                posCart.map((c) => (
                  <div
                    key={c.key}
                    className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-extrabold text-zinc-900 truncate">
                        {loc(c.item.name, c.item.name_en)} {c.size ? `(${c.size.name})` : ''}
                      </p>
                      {c.addons.length > 0 && (
                        <p className="text-[10px] text-zinc-500 truncate">
                          + {c.addons.map((a) => a.name).join(isEn ? ', ' : '، ')}
                        </p>
                      )}
                      {c.notes && (
                        <p className="text-[10px] text-amber-800 font-bold truncate">{c.notes}</p>
                      )}
                      <p className="text-[11px] font-mono-num text-zinc-700 font-bold">
                        {formatMoney(c.unitPrice * c.quantity)}
                      </p>
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
              placeholder={isEn ? 'General order notes (optional)' : 'ملاحظات عامة على الطلب (اختياري)'}
              value={posOrderNotes}
              onChange={(e) => setPosOrderNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs"
            />

            {/* Optional Instant Discount for Owner / Permitted Manager */}
            {canApplyInstantDiscount && posCart.length > 0 && (
              <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold text-indigo-950 flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-indigo-700" />
                    <span>{isEn ? 'Special Instant Discount' : 'خصم فوري خاص'}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { id: 'none' as const, label: isEn ? 'None' : 'بدون' },
                        { id: 'amount' as const, label: isEn ? 'Amount' : 'مبلغ' },
                        { id: 'percent' as const, label: '%' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPosDiscountMode(opt.id)}
                        className={`px-2 py-1 rounded-lg border text-[10px] font-extrabold cursor-pointer ${
                          posDiscountMode === opt.id
                            ? 'bg-indigo-700 text-white border-indigo-700'
                            : 'bg-white border-indigo-200 text-indigo-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {posDiscountMode !== 'none' && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="number"
                      min={0}
                      dir="ltr"
                      placeholder={
                        posDiscountMode === 'percent'
                          ? isEn
                            ? 'Percent %'
                            : 'النسبة %'
                          : isEn
                            ? 'Amount'
                            : 'القيمة'
                      }
                      value={posDiscountValue}
                      onChange={(e) => setPosDiscountValue(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white text-xs font-mono-num font-bold"
                    />
                    <input
                      type="text"
                      placeholder={isEn ? 'Discount reason' : 'سبب الخصم'}
                      value={posDiscountReason}
                      onChange={(e) => setPosDiscountReason(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white text-xs"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Totals Breakdown */}
            {posCart.length > 0 && (
              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1 text-xs">
                <div className="flex justify-between text-zinc-600">
                  <span>{isEn ? 'Subtotal:' : 'المجموع الفرعي:'}</span>
                  <span className="font-mono-num font-bold">{formatMoney(posTotals.subtotal)}</span>
                </div>
                {posTotals.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>{isEn ? 'Admin Discount:' : 'الخصم الإداري:'}</span>
                    <span className="font-mono-num">-{formatMoney(posTotals.discountAmount)}</span>
                  </div>
                )}
                {posTotals.serviceCharge > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>
                      {isEn
                        ? `Service Charge (${restaurant.serviceCharge || 0}%):`
                        : `رسوم الخدمة (${restaurant.serviceCharge || 0}%):`}
                    </span>
                    <span className="font-mono-num font-bold">{formatMoney(posTotals.serviceCharge)}</span>
                  </div>
                )}
                {posTotals.deliveryFee > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>{isEn ? 'Delivery Fee:' : 'رسوم التوصيل:'}</span>
                    <span className="font-mono-num font-bold">{formatMoney(posTotals.deliveryFee)}</span>
                  </div>
                )}
                {posTotals.taxAmount > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>
                      {isEn ? `Tax (${restaurant.taxRate || 0}%):` : `الضريبة (${restaurant.taxRate || 0}%):`}
                    </span>
                    <span className="font-mono-num font-bold">{formatMoney(posTotals.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-zinc-950 text-sm pt-1.5 border-t border-zinc-200">
                  <span>{isEn ? 'Total Due:' : 'الإجمالي المستحق:'}</span>
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

            {canAddEditTableOrders && (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={posSubmitting !== null || posCart.length === 0}
                  onClick={() => handleSubmitCashierPos(false)}
                  className="w-full min-h-[42px] rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4 text-amber-400" />
                  <span>
                    {posSubmitting === 'send'
                      ? isEn
                        ? 'Sending to kitchen...'
                        : 'جاري الإرسال للمطبخ...'
                      : isEn
                        ? 'Send to Kitchen & Stations (Open Check)'
                        : 'إرسال للمطبخ والمحطات (حساب مفتوح)'}
                  </span>
                </button>

                {canSettleChecks && (
                  <button
                    type="button"
                    disabled={posSubmitting !== null || posCart.length === 0}
                    onClick={() => handleSubmitCashierPos(true)}
                    className="w-full min-h-[42px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Banknote className="w-4 h-4" />
                    <span>
                      {posSubmitting === 'settle'
                        ? isEn
                          ? 'Creating & opening settlement...'
                          : 'جاري الإنشاء وفتح التحصيل...'
                        : isEn
                          ? 'Send + Instant Settle (Cash / Visa)'
                          : 'إرسال + تحصيل فوري (كاش / فيزا)'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CASHIER TABLE CONTROL DRAWER                                   */}
      {/* ============================================================== */}
      {selectedTableDrawer && (() => {
        const snap = getTableSnapshot(
          selectedTableDrawer.hallName,
          selectedTableDrawer.tableNumber
        );
        const matchedGroup = findTableGroupForDrawer(
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
                    <h3 className="text-lg font-extrabold text-zinc-950 flex items-center gap-2">
                      <span>
                        {isEn
                          ? `Table ${selectedTableDrawer.tableNumber}`
                          : `ترابيزة ${selectedTableDrawer.tableNumber}`}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-extrabold text-white"
                        style={{ backgroundColor: opsConfig.tableColors[snap.state] }}
                      >
                        {snap.state === 'empty'
                          ? isEn
                            ? 'Open'
                            : 'شاغرة'
                          : snap.state === 'billRequested'
                            ? isEn
                              ? 'Check Requested'
                              : 'طلب شيك'
                            : snap.state === 'overdue'
                              ? isEn
                                ? 'Overdue'
                                : 'متأخرة'
                              : isEn
                                ? 'Occupied'
                                : 'مشغولة'}
                      </span>
                    </h3>
                    {snap.elapsedMins > 0 && (
                      <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5 font-mono-num">
                        <Clock className="w-3 h-3" />
                        <span>
                          {isEn
                            ? `${snap.elapsedMins} min elapsed since opening`
                            : `مضى ${snap.elapsedMins} دقيقة منذ فتح الطاولة`}
                        </span>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTableDrawer(null)}
                    className="w-9 h-9 rounded-xl hover:bg-zinc-100 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Active Service Calls on this table */}
                {snap.tblCalls.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 space-y-2">
                    <p className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                      <BellRing className="w-4 h-4 text-amber-600" />
                      <span>
                        {isEn
                          ? `Active Calls on Table (${snap.tblCalls.length})`
                          : `نداءات نشطة على الطاولة (${snap.tblCalls.length})`}
                      </span>
                    </p>
                    {snap.tblCalls.map((call) => (
                      <div
                        key={call.id}
                        className="p-2.5 rounded-xl bg-white border border-amber-200 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-extrabold text-zinc-900">
                            {call.callType === 'request_bill_cash'
                              ? isEn
                                ? 'Check Request (Cash)'
                                : 'طلب الشيك (كاش)'
                              : call.callType === 'request_bill_card'
                                ? isEn
                                  ? 'Check Request (Visa)'
                                  : 'طلب الشيك (فيزا)'
                                : call.callType === 'call_waiter'
                                  ? isEn
                                    ? 'Call Captain'
                                    : 'نداء الكابتن'
                                  : isEn
                                    ? 'Cutlery & Water'
                                    : 'أدوات طعام / مياه'}
                          </p>
                          <p className="text-[10px] text-zinc-500 truncate">
                            {isEn ? `Guest: ${call.guestName}` : `باسم: ${call.guestName}`}
                          </p>
                        </div>
                        {canManageServiceCalls && (
                          <button
                            type="button"
                            disabled={callBusyId === call.id}
                            onClick={async () => {
                              setCallBusyId(call.id);
                              try {
                                await onResolveCall(call, 'resolved');
                              } finally {
                                setCallBusyId(null);
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Done' : 'تم'}</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {snap.tblOrders.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 text-center space-y-1.5">
                    <p className="text-xs font-extrabold text-zinc-800">
                      {isEn ? 'Table is currently available' : 'الترابيزة شاغرة حالياً'}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {isEn
                        ? 'You can open a new check for this table directly from the Cashier POS.'
                        : 'يمكنك فتح طلب جديد على هذه الترابيزة مباشرة من نقطة بيع الكاشير.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {matchedGroup && (
                      <div className="p-3 rounded-2xl bg-zinc-950 text-white flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-zinc-400 font-bold">
                            {isEn ? 'Table Check Total' : 'إجمالي حساب الترابيزة'}
                          </p>
                          <p className="text-base font-extrabold font-mono-num text-amber-400">
                            {formatMoney(matchedGroup.grandTotal)}
                          </p>
                        </div>
                        <span className="text-[11px] font-mono-num text-zinc-300">
                          {matchedGroup.orders.length}{' '}
                          {isEn ? (matchedGroup.orders.length === 1 ? 'order' : 'orders') : 'طلب'}
                        </span>
                      </div>
                    )}

                    {snap.tblOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs font-extrabold">
                          <span className="font-mono-num text-zinc-950">#{ord.orderNumber}</span>
                          <span className="font-mono-num text-emerald-700">
                            {formatMoney(ord.total)}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs">
                          {ord.items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2">
                              <span className="font-bold text-zinc-800">
                                {it.quantity}× {it.name} {it.sizeName ? `(${it.sizeName})` : ''}
                                {it.guestName ? ` [${it.guestName}]` : ''}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-zinc-200 font-bold shrink-0">
                                {ord.itemProgress?.[String(idx)] === 'ready'
                                  ? isEn
                                    ? 'Ready'
                                    : 'جاهز'
                                  : ord.itemProgress?.[String(idx)] === 'served'
                                    ? isEn
                                      ? 'Served'
                                      : 'تم التقديم'
                                    : isEn
                                      ? 'Preparing'
                                      : 'تحضير'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {matchedGroup && matchedGroup.guestsBreakdown.length > 0 && (
                      <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1.5">
                        <p className="text-[11px] font-extrabold text-zinc-800 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-amber-600" />
                          <span>{isEn ? 'Guest Check Breakdown' : 'تفصيل حساب الضيوف'}</span>
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {matchedGroup.guestsBreakdown.map((g, i) => (
                            <div
                              key={i}
                              className="px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 flex justify-between text-[11px]"
                            >
                              <span className="font-bold truncate">{g.guestName}</span>
                              <span className="font-mono-num font-extrabold shrink-0">
                                {formatMoney(g.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Drawer Action Footer */}
              <div className="p-5 border-t border-zinc-200 bg-zinc-50 space-y-2">
                {canAddEditTableOrders && (
                  <button
                    type="button"
                    onClick={() => {
                      const { hallName, tableNumber } = selectedTableDrawer;
                      setSelectedTableDrawer(null);
                      onSelectTablePos(hallName, tableNumber);
                    }}
                    className="w-full min-h-[42px] rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-amber-400" />
                    <span>
                      {snap.tblOrders.length > 0
                        ? isEn
                          ? 'Add Items to Table from Cashier'
                          : 'إضافة أصناف للترابيزة من الكاشير'
                        : isEn
                          ? 'Open New Order on Table'
                          : 'فتح طلب جديد على الترابيزة'}
                    </span>
                  </button>
                )}

                {snap.tblOrders.length > 0 && matchedGroup && (
                  <>
                    {canSettleChecks && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTableDrawer(null);
                            onOpenSettlement({ type: 'table', group: matchedGroup }, 'cash');
                          }}
                          className="min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Settle Cash/Mixed' : 'تحصيل كاش/مختلط'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTableDrawer(null);
                            onOpenSettlement({ type: 'table', group: matchedGroup }, 'visa');
                          }}
                          className="min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Settle Visa' : 'تحصيل فيزا'}</span>
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTableDrawer(null);
                          onOpenReceipt({ tableGroup: matchedGroup });
                        }}
                        className="flex-1 min-h-[38px] rounded-xl border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-900 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Print Receipt' : 'طباعة الريسيت'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const consolidated: Order = {
                            ...matchedGroup.orders[0],
                            id: matchedGroup.groupKey,
                            orderNumber: matchedGroup.orderNumbers.join('+'),
                            items: matchedGroup.orders.flatMap((o) => o.items),
                            subtotal: matchedGroup.subtotal,
                            serviceCharge: matchedGroup.serviceCharge,
                            taxAmount: matchedGroup.taxAmount,
                            discountAmount: matchedGroup.discountAmount,
                            total: matchedGroup.grandTotal,
                            guestChecks: matchedGroup.guestsBreakdown.map((g) => ({
                              guestName: g.guestName,
                              itemsCount: g.itemsCount,
                              subtotal: g.subtotal,
                              serviceCharge: g.serviceCharge,
                              taxAmount: g.taxAmount,
                              total: g.total,
                            })),
                            hallName: matchedGroup.hallName,
                            tableNumber: matchedGroup.tableNumber,
                            orderType: 'dine_in',
                          };
                          setSelectedTableDrawer(null);
                          onOpenSplitCheck(consolidated);
                        }}
                        className="flex-1 min-h-[38px] rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Split Check' : 'تقسيم الشيك'}</span>
                      </button>

                      {(canEditOpenOrders || canApplyInstantDiscount || canCancelOpenOrders) &&
                        snap.tblOrders[0] && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTableDrawer(null);
                              onOpenModifyOrder(snap.tblOrders[0]);
                            }}
                            className="w-full min-h-[38px] rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Edit / Discount / Cancel' : 'تعديل / خصم إداري / إلغاء'}</span>
                          </button>
                        )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Grid Colors & SLA Settings Modal */}
      {gridSettingsOpen && canConfigureGridColors && (
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
                {isEn
                  ? 'Customize Table Grid Colors & Overdue SLA'
                  : 'تخصيص ألوان خريطة الترابيزات ووقت التأخير'}
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
                  { key: 'empty' as const, label: isEn ? 'Available Table' : 'ترابيزة شاغرة' },
                  { key: 'occupied' as const, label: isEn ? 'Occupied Table' : 'ترابيزة مشغولة' },
                  { key: 'billRequested' as const, label: isEn ? 'Check Requested' : 'طلب الشيك' },
                  { key: 'overdue' as const, label: isEn ? 'Overdue Table' : 'ترابيزة متأخرة' },
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
              <span>
                {isEn
                  ? 'Overdue threshold to change table color (minutes):'
                  : 'حد التأخير لتغيير لون الترابيزة (بالدقائق):'}
              </span>
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

            {gridSettingsError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{gridSettingsError}</span>
              </div>
            )}

            <button
              type="button"
              disabled={savingGridSettings}
              onClick={handleSaveGridSettings}
              className="w-full min-h-[42px] rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
            >
              {savingGridSettings
                ? isEn
                  ? 'Saving...'
                  : 'جاري الحفظ...'
                : isEn
                  ? 'Save Floor Colors & Settings'
                  : 'حفظ ألوان وإعدادات الصالة'}
            </button>
          </div>
        </div>
      )}

      {/* POS Size / Addons / Notes Quick Picker Modal */}
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
                <p className="text-xs font-bold text-zinc-700">{isEn ? 'Size:' : 'الحجم:'}</p>
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
                      {sz.name} ({formatMoney(sz.price)})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {posPickerItem.addons.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-zinc-700">{isEn ? 'Add-ons:' : 'الإضافات:'}</p>
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
                        {ad.name} (+{formatMoney(ad.price)})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <input
              type="text"
              placeholder={isEn ? 'Special item note (no onions / extra sauce...)' : 'ملاحظة خاصة على الصنف (بدون بصل / زيادة صوص...)'}
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
              {isEn ? 'Add to Check' : 'إضافة للفاتورة'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
