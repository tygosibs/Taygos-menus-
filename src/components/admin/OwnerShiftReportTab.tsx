import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Calendar,
  Columns,
  Eye,
  FileSpreadsheet,
  Lock,
  Printer,
  Receipt,
  Search,
  ShieldAlert,
  Unlock,
  UserCheck,
  Vault,
  Wallet,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { subscribeOwnerOrders } from '../../lib/firestoreService';
import {
  adjustOwnerVaultBalance,
  getResolvedOperationsConfig,
  getResolvedTreasuryState,
  getTimestampMillis,
  subscribeAllRestaurantShifts,
  subscribeDrawerExpenses,
  subscribeTreasuryTransfers,
} from '../../lib/operationsService';
import { STAFF_ROLE_META } from '../../lib/staffAuthUtils';
import { subscribeStaffAuditLogs } from '../../lib/staffService';
import {
  DrawerExpense,
  Order,
  Restaurant,
  StaffActorInfo,
  StaffAuditLog,
  StaffRole,
  StaffShift,
  TreasuryTransfer,
} from '../../types/menu';

interface OwnerShiftReportTabProps {
  restaurant: Restaurant;
  actor: StaffActorInfo;
  shiftsOverride?: StaffShift[];
  expensesOverride?: DrawerExpense[];
  auditLogsOverride?: StaffAuditLog[];
  transfersOverride?: TreasuryTransfer[];
  onRestaurantUpdated?: (updated: Restaurant) => void;
}

function toIsoDateLocal(ms: number): string {
  const d = new Date(ms || Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getArabicDayName(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('ar-EG', { weekday: 'long' });
}

function formatShortTime(ts: unknown): string {
  const ms = getTimestampMillis(ts);
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

export function OwnerShiftReportTab({
  restaurant,
  actor,
  shiftsOverride,
  expensesOverride,
  auditLogsOverride,
  transfersOverride,
  onRestaurantUpdated,
}: OwnerShiftReportTabProps) {
  const { formatCurrency } = useLanguage();
  const currencyLabel = formatCurrency(restaurant.currency);
  const opsConfig = useMemo(() => getResolvedOperationsConfig(restaurant), [restaurant]);
  const treasury = useMemo(() => getResolvedTreasuryState(restaurant), [restaurant]);
  const isOwner = actor.role === 'owner';

  const [shifts, setShifts] = useState<StaffShift[]>(shiftsOverride || []);
  const [expenses, setExpenses] = useState<DrawerExpense[]>(expensesOverride || []);
  const [auditLogs, setAuditLogs] = useState<StaffAuditLog[]>(auditLogsOverride || []);
  const [transfers, setTransfers] = useState<TreasuryTransfer[]>(transfersOverride || []);
  const [orders, setOrders] = useState<Order[]>([]);

  // Daily operational report date
  const todayIso = useMemo(() => toIsoDateLocal(Date.now()), []);
  const yesterdayIso = useMemo(() => toIsoDateLocal(Date.now() - 86400000), []);
  const [selectedDayIso, setSelectedDayIso] = useState(todayIso);

  // Daily Checks Archive Filters & Check Inspection Modal
  const [checkStatusFilter, setCheckStatusFilter] = useState<'all' | 'completed' | 'cancelled' | 'open'>('all');
  const [checkTypeFilter, setCheckTypeFilter] = useState<'all' | 'dine_in' | 'pickup' | 'delivery'>('all');
  const [checkShiftFilter, setCheckShiftFilter] = useState<string>('all');
  const [checkSearchQuery, setCheckSearchQuery] = useState('');
  const [selectedCheckOrder, setSelectedCheckOrder] = useState<Order | null>(null);

  // Matrix filter & sticky mode
  const [fromDate, setFromDate] = useState(() => toIsoDateLocal(Date.now() - 13 * 86400000));
  const [toDate, setToDate] = useState(todayIso);
  const [searchTerm, setSearchTerm] = useState('');
  const [stickyMode, setStickyMode] = useState<'side_day' | 'top_header'>('side_day');
  const [activeSubTab, setActiveSubTab] = useState<'daily' | 'matrix'>('daily');

  // Owner vault adjustment form
  const [vaultDelta, setVaultDelta] = useState('');
  const [vaultNote, setVaultNote] = useState('');
  const [savingVault, setSavingVault] = useState(false);
  const [vaultMsg, setVaultMsg] = useState<string | null>(null);

  useEffect(() => {
    setCheckShiftFilter('all');
  }, [selectedDayIso]);

  useEffect(() => {
    if (!selectedCheckOrder) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedCheckOrder(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedCheckOrder]);

  useEffect(() => {
    if (shiftsOverride) setShifts(shiftsOverride);
  }, [shiftsOverride]);
  useEffect(() => {
    if (expensesOverride) setExpenses(expensesOverride);
  }, [expensesOverride]);
  useEffect(() => {
    if (auditLogsOverride) setAuditLogs(auditLogsOverride);
  }, [auditLogsOverride]);
  useEffect(() => {
    if (transfersOverride) setTransfers(transfersOverride);
  }, [transfersOverride]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    if (!shiftsOverride) {
      unsubs.push(subscribeAllRestaurantShifts(restaurant.id, setShifts));
    }
    if (!expensesOverride) {
      unsubs.push(subscribeDrawerExpenses(restaurant.id, setExpenses));
    }
    if (!auditLogsOverride) {
      unsubs.push(subscribeStaffAuditLogs(restaurant.id, setAuditLogs));
    }
    if (!transfersOverride) {
      unsubs.push(subscribeTreasuryTransfers(restaurant.id, setTransfers));
    }
    unsubs.push(
      subscribeOwnerOrders(
        restaurant.id,
        restaurant.ownerId,
        setOrders,
        () => {},
        { staffMode: !isOwner }
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [
    restaurant.id,
    restaurant.ownerId,
    isOwner,
    shiftsOverride,
    expensesOverride,
    auditLogsOverride,
    transfersOverride,
  ]);

  const formatMoney = (val: number) => `${Number(val || 0).toFixed(2).replace(/\.00$/, '')} ${currencyLabel}`;

  // Daily operational summary computations
  const dailySummary = useMemo(() => {
    const dayShifts = shifts.filter((sh) => toIsoDateLocal(getTimestampMillis(sh.startedAt)) === selectedDayIso);
    const dayCashierShifts = dayShifts.filter((sh) => sh.stationId === 'cashier');
    const dayOrders = orders.filter((o) => toIsoDateLocal(getTimestampMillis(o.createdAt)) === selectedDayIso);
    const completedDayOrders = dayOrders.filter((o) => o.status === 'completed');

    let cashSales = dayCashierShifts.reduce((s, sh) => s + Number(sh.cashSales || 0), 0);
    let visaSales = dayCashierShifts.reduce((s, sh) => s + Number(sh.visaSales || 0), 0);
    let variance = dayCashierShifts.reduce((s, sh) => s + Number(sh.drawerVarianceTotal || 0), 0);
    // Fallback if owner closed orders directly without cashier shift
    if (cashSales === 0 && visaSales === 0 && completedDayOrders.length > 0) {
      completedDayOrders.forEach((o) => {
        if (o.paymentMethod === 'visa') {
          visaSales += Number(o.visaPaidAmount ?? o.total ?? 0);
        } else if (o.paymentMethod === 'split') {
          cashSales += Number(o.cashPaidAmount || 0);
          visaSales += Number(o.visaPaidAmount || 0);
        } else {
          cashSales += Number(o.cashPaidAmount ?? o.total ?? 0);
        }
        variance += Number(o.drawerVariance || 0);
      });
    }

    const dayExpensesList = expenses.filter(
      (ex) => toIsoDateLocal(getTimestampMillis(ex.createdAt)) === selectedDayIso
    );
    const totalExpenses = dayExpensesList.reduce((s, ex) => s + Number(ex.amount || 0), 0);
    const totalDiscount = completedDayOrders.reduce(
      (s, o) => s + Number(o.discountAmount || 0) + Number(o.manualDiscountAmount || 0),
      0
    );
    const netDay = cashSales + visaSales + variance - totalExpenses;

    const sensitiveEvents = new Set([
      'order_modified',
      'order_cancelled',
      'instant_discount_applied',
      'menu_item_paused',
      'staff_suspended',
      'staff_unsuspended',
      'staff_promoted',
      'drawer_expense_added',
      'cash_handover_recorded',
      'float_adjusted',
      'superadmin_shift_unlocked',
    ]);
    const dayAudit = auditLogs.filter(
      (log) =>
        toIsoDateLocal(getTimestampMillis(log.createdAt)) === selectedDayIso &&
        sensitiveEvents.has(log.eventType)
    );

    const dayOrdersSorted = [...dayOrders].sort(
      (a, b) =>
        getTimestampMillis(b.closedAt || b.createdAt) -
        getTimestampMillis(a.closedAt || a.createdAt)
    );

    return {
      dayShifts,
      dayCashierShifts,
      dayOrders: dayOrdersSorted,
      dayOrdersCount: completedDayOrders.length,
      cancelledOrdersCount: dayOrders.filter((o) => o.status === 'cancelled').length,
      openOrdersCount: dayOrders.filter((o) => o.status === 'pending' || o.status === 'preparing').length,
      cashSales,
      visaSales,
      variance,
      totalExpenses,
      totalDiscount,
      netDay,
      dayAudit,
      dayExpensesList,
    };
  }, [shifts, orders, expenses, auditLogs, selectedDayIso]);

  const shiftMap = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);

  const filteredDayChecks = useMemo(() => {
    const q = checkSearchQuery.trim().toLowerCase();
    return dailySummary.dayOrders.filter((o) => {
      if (checkStatusFilter === 'completed' && o.status !== 'completed') return false;
      if (checkStatusFilter === 'cancelled' && o.status !== 'cancelled') return false;
      if (checkStatusFilter === 'open' && o.status !== 'pending' && o.status !== 'preparing') {
        return false;
      }
      if (checkTypeFilter !== 'all' && o.orderType !== checkTypeFilter) return false;
      if (checkShiftFilter !== 'all' && o.shiftId !== checkShiftFilter) return false;
      if (q) {
        const hay = [
          o.orderNumber,
          o.customerName,
          o.customerPhone,
          o.tableNumber || '',
          o.hallName || '',
          o.closedByName || '',
          o.createdByName || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    dailySummary.dayOrders,
    checkStatusFilter,
    checkTypeFilter,
    checkShiftFilter,
    checkSearchQuery,
  ]);

  // Multi-day Shift Matrix rows
  const matrixData = useMemo(() => {
    const slots = opsConfig.shiftSlots;
    const cashierShifts = shifts.filter((sh) => sh.stationId === 'cashier');
    const q = searchTerm.trim().toLowerCase();

    const filteredCashierShifts = cashierShifts.filter((sh) => {
      const iso = toIsoDateLocal(getTimestampMillis(sh.startedAt));
      if (fromDate && iso < fromDate) return false;
      if (toDate && iso > toDate) return false;
      if (q) {
        const hay = `${sh.staffName} ${sh.handedOverToName || ''} ${sh.shiftSlotName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Build calendar date list between fromDate and toDate (or dates present in filtered shifts)
    const datesSet = new Set<string>();
    filteredCashierShifts.forEach((sh) => datesSet.add(toIsoDateLocal(getTimestampMillis(sh.startedAt))));
    if (!q && fromDate && toDate && fromDate <= toDate) {
      const start = new Date(`${fromDate}T00:00:00`);
      const end = new Date(`${toDate}T00:00:00`);
      let cursor = start.getTime();
      let safety = 0;
      while (cursor <= end.getTime() && safety < 62) {
        datesSet.add(toIsoDateLocal(cursor));
        cursor += 86400000;
        safety += 1;
      }
    }

    const sortedDates = Array.from(datesSet).sort((a, b) => (a < b ? 1 : -1));

    const rows = sortedDates.map((iso) => {
      const dayShifts = filteredCashierShifts.filter(
        (sh) => toIsoDateLocal(getTimestampMillis(sh.startedAt)) === iso
      );

      const perSlot = slots.map((slot, slotIdx) => {
        const matched = dayShifts.filter(
          (sh) => sh.shiftSlotId === slot.id || (!sh.shiftSlotId && slotIdx === 0)
        );
        const cash = matched.reduce((s, x) => s + Number(x.cashSales || 0), 0);
        const visa = matched.reduce((s, x) => s + Number(x.visaSales || 0), 0);
        const exp = matched.reduce((s, x) => s + Number(x.drawerExpensesTotal || 0), 0);
        const variance = matched.reduce((s, x) => s + Number(x.drawerVarianceTotal || 0), 0);
        const net = cash + visa + variance - exp;
        const staffNames = Array.from(new Set(matched.map((x) => x.staffName))).join('، ');
        const allLocked = matched.length > 0 && matched.every((x) => x.status === 'completed');
        const hasUnlocked = matched.some((x) => Boolean(x.superAdminUnlocked));
        return {
          slotId: slot.id,
          matchedCount: matched.length,
          staffNames,
          cash,
          visa,
          exp,
          net,
          allLocked,
          hasUnlocked,
        };
      });

      const dayCash = perSlot.reduce((s, x) => s + x.cash, 0);
      const dayVisa = perSlot.reduce((s, x) => s + x.visa, 0);
      const dayExp = perSlot.reduce((s, x) => s + x.exp, 0);
      const dayNet = perSlot.reduce((s, x) => s + x.net, 0);

      return {
        iso,
        dayName: getArabicDayName(iso),
        perSlot,
        dayCash,
        dayVisa,
        dayExp,
        dayNet,
      };
    });

    const grandPerSlot = slots.map((_, idx) => ({
      cash: rows.reduce((s, r) => s + r.perSlot[idx].cash, 0),
      visa: rows.reduce((s, r) => s + r.perSlot[idx].visa, 0),
      exp: rows.reduce((s, r) => s + r.perSlot[idx].exp, 0),
      net: rows.reduce((s, r) => s + r.perSlot[idx].net, 0),
    }));

    return {
      slots,
      rows,
      grandPerSlot,
      grandCash: rows.reduce((s, r) => s + r.dayCash, 0),
      grandVisa: rows.reduce((s, r) => s + r.dayVisa, 0),
      grandExp: rows.reduce((s, r) => s + r.dayExp, 0),
      grandNet: rows.reduce((s, r) => s + r.dayNet, 0),
    };
  }, [opsConfig.shiftSlots, shifts, fromDate, toDate, searchTerm]);

  const handleAdjustVault = async (e: FormEvent, sign: 1 | -1) => {
    e.preventDefault();
    const raw = Number(vaultDelta);
    if (!Number.isFinite(raw) || raw <= 0) return;
    setSavingVault(true);
    setVaultMsg(null);
    try {
      const delta = sign * raw;
      await adjustOwnerVaultBalance({
        restaurant,
        deltaCash: delta,
        note: vaultNote || (sign > 0 ? 'إيداع بالخزنة الرئيسية' : 'سحب من الخزنة الرئيسية'),
        actor,
      });
      const nextCash = Math.max(0, treasury.ownerVaultCashBalance + delta);
      onRestaurantUpdated?.({
        ...restaurant,
        treasuryState: {
          ...treasury,
          ownerVaultCashBalance: nextCash,
          updatedAt: Date.now(),
        },
      });
      setVaultDelta('');
      setVaultNote('');
      setVaultMsg(sign > 0 ? `تمت إضافة ${formatMoney(raw)} للخزنة.` : `تم خصم ${formatMoney(raw)} من الخزنة.`);
    } finally {
      setSavingVault(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* Main Treasury Overview */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
            <span>الخزنة الرئيسية لصاحب المطعم (كاش)</span>
            <Vault className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold font-mono-num text-zinc-950">
            {formatMoney(treasury.ownerVaultCashBalance)}
          </p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
            <span>إجمالي مبيعات الفيزا / البنك</span>
            <Wallet className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-extrabold font-mono-num text-blue-700">
            {formatMoney(treasury.ownerVaultVisaTotal)}
          </p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
            <span>رصيد عهدة المدير المعلّقة</span>
            <UserCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-extrabold font-mono-num text-indigo-700">
            {formatMoney(treasury.managerCustodyBalance)}
          </p>
        </div>
      </section>

      {isOwner && (
        <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-extrabold text-zinc-950">
              تسوية أو سحب / إيداع يدوي بالخزنة الرئيسية (للمالك فقط)
            </h3>
            {vaultMsg && <span className="text-xs font-bold text-emerald-700">{vaultMsg}</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <input
              type="number"
              min={1}
              step="any"
              value={vaultDelta}
              onChange={(e) => setVaultDelta(e.target.value)}
              placeholder={`المبلغ (${currencyLabel})`}
              className="px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono-num font-bold"
            />
            <input
              type="text"
              value={vaultNote}
              onChange={(e) => setVaultNote(e.target.value)}
              placeholder="البيان / السبب"
              className="sm:col-span-2 px-3 py-2 rounded-xl border border-zinc-300 text-xs"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={savingVault || !vaultDelta}
                onClick={(e) => handleAdjustVault(e, 1)}
                className="flex-1 min-h-[38px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
              >
                + إيداع
              </button>
              <button
                type="button"
                disabled={savingVault || !vaultDelta}
                onClick={(e) => handleAdjustVault(e, -1)}
                className="flex-1 min-h-[38px] px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
              >
                - سحب
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Sub-navigation: Daily Detailed Report vs Multi-Day Shift Matrix */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-zinc-200 rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('daily')}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'daily'
                ? 'bg-zinc-950 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>التقرير اليومي المفصل</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('matrix')}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'matrix'
                ? 'bg-zinc-950 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>جدول تقارير الورديات (متعدد الأيام)</span>
          </button>
        </div>

        <span className="text-[11px] font-bold text-zinc-500 flex items-center gap-1">
          <Lock className="w-3.5 h-3.5 text-zinc-400" />
          <span>الورديات المغلقة محمية ضد التعديل (إلا بفتح استثنائي من السوبر أدمن)</span>
        </span>
      </div>

      {activeSubTab === 'daily' ? (
        <div className="space-y-5">
          {/* Date Picker & KPIs */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-zinc-950">
                  ملخص تشغيل اليوم — {getArabicDayName(selectedDayIso)} ({selectedDayIso})
                </h3>
                <p className="text-xs text-zinc-500">
                  يوضح كل ما تم خلال اليوم من مبيعات وحضور وانصراف الكادر والشيكات المغلقة والملغاة وأي تعديلات.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDayIso(todayIso)}
                  className={`px-3 py-2 rounded-xl border text-xs font-extrabold cursor-pointer ${
                    selectedDayIso === todayIso
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDayIso(yesterdayIso)}
                  className={`px-3 py-2 rounded-xl border text-xs font-extrabold cursor-pointer ${
                    selectedDayIso === yesterdayIso
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  أمس
                </button>
                <input
                  type="date"
                  value={selectedDayIso}
                  onChange={(e) => setSelectedDayIso(e.target.value || todayIso)}
                  className="px-3.5 py-2 rounded-xl border border-zinc-300 text-xs font-mono-num font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'الطلبات المحصّلة', value: String(dailySummary.dayOrdersCount) },
                { label: 'مبيعات الكاش', value: formatMoney(dailySummary.cashSales) },
                { label: 'مبيعات الفيزا', value: formatMoney(dailySummary.visaSales) },
                { label: 'المصروفات', value: formatMoney(dailySummary.totalExpenses) },
                { label: 'فرق الدرج (تقريب)', value: formatMoney(dailySummary.variance) },
                { label: 'صافي إيراد اليوم', value: formatMoney(dailySummary.netDay) },
              ].map((stat) => (
                <div key={stat.label} className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <p className="text-[11px] font-bold text-zinc-500">{stat.label}</p>
                  <p className="text-sm sm:text-base font-extrabold font-mono-num text-zinc-950 mt-1">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Attendance & Shifts Timeline */}
          <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-extrabold text-zinc-950">
                سجل حضور وانصراف الكادر ({dailySummary.dayShifts.length})
              </h4>
              <span className="text-[11px] text-zinc-500">من ساعة الدخول حتى تسليم الوردية</span>
            </div>
            {dailySummary.dayShifts.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                لا توجد ورديات مسجلة في هذا التاريخ.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-zinc-50/70 text-zinc-600 border-b border-zinc-200">
                    <tr>
                      <th className="py-2.5 px-4 font-extrabold text-start">الموظف</th>
                      <th className="py-2.5 px-4 font-extrabold text-start">القسم / الشاشة</th>
                      <th className="py-2.5 px-4 font-extrabold text-start">دخول</th>
                      <th className="py-2.5 px-4 font-extrabold text-start">خروج</th>
                      <th className="py-2.5 px-4 font-extrabold text-start">الأداء / الكاش</th>
                      <th className="py-2.5 px-4 font-extrabold text-start">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {dailySummary.dayShifts.map((sh) => (
                      <tr key={sh.id} className="hover:bg-zinc-50/60">
                        <td className="py-2.5 px-4 font-extrabold text-zinc-950">{sh.staffName}</td>
                        <td className="py-2.5 px-4 text-zinc-700">
                          {sh.stationName}
                          {sh.shiftSlotName ? ` · ${sh.shiftSlotName}` : ''}
                        </td>
                        <td className="py-2.5 px-4 font-mono-num">{formatShortTime(sh.startedAt)}</td>
                        <td className="py-2.5 px-4 font-mono-num">
                          {sh.status === 'active' ? 'مستمرة الآن' : formatShortTime(sh.endedAt)}
                        </td>
                        <td className="py-2.5 px-4 font-mono-num text-zinc-700">
                          {sh.stationId === 'cashier'
                            ? `كاش ${formatMoney(sh.cashSales || 0)} · فيزا ${formatMoney(sh.visaSales || 0)}`
                            : `طلبات: ${sh.ordersHandled || 0} · تجهيز: ${sh.itemsMarkedReady || 0}`}
                        </td>
                        <td className="py-2.5 px-4">
                          {sh.superAdminUnlocked ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700">
                              <Unlock className="w-3 h-3" /> مفتوحة استثنائياً
                            </span>
                          ) : sh.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-600">
                              <Lock className="w-3 h-3" /> مغلقة
                            </span>
                          ) : (
                            <span className="text-[11px] font-extrabold text-emerald-700">نشطة</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Daily Checks & Receipts Review Archive */}
          <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-zinc-950 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-600" />
                  <span>
                    سجل شيكات وفواتير اليوم ({filteredDayChecks.length} من {dailySummary.dayOrders.length})
                  </span>
                </h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  اضغط على أي شيك لعرض تفاصيل الأصناف والخصومات وطريقة التحصيل أو طباعة نسخة الريسيت.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: 'all' as const, label: `الكل (${dailySummary.dayOrders.length})` },
                    { id: 'completed' as const, label: `المحصّلة (${dailySummary.dayOrdersCount})` },
                    { id: 'cancelled' as const, label: `الملغاة (${dailySummary.cancelledOrdersCount})` },
                    { id: 'open' as const, label: `المفتوحة (${dailySummary.openOrdersCount})` },
                  ]
                ).map((stTab) => (
                  <button
                    key={stTab.id}
                    type="button"
                    onClick={() => setCheckStatusFilter(stTab.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                      checkStatusFilter === stTab.id
                        ? 'bg-zinc-950 text-white'
                        : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {stTab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 py-3 border-b border-zinc-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={checkSearchQuery}
                  onChange={(e) => setCheckSearchQuery(e.target.value)}
                  placeholder="بحث برقم الشيك أو الطاولة أو العميل أو الكاشير..."
                  className="w-full ps-8 pe-3 py-2 rounded-xl border border-zinc-200 text-xs"
                />
              </div>

              <select
                value={checkTypeFilter}
                onChange={(e) =>
                  setCheckTypeFilter(e.target.value as 'all' | 'dine_in' | 'pickup' | 'delivery')
                }
                className="px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold bg-white"
              >
                <option value="all">كل أنواع الطلبات</option>
                <option value="dine_in">صالة (طاولات)</option>
                <option value="pickup">تيك أواي (استلام)</option>
                <option value="delivery">دليفري (توصيل)</option>
              </select>

              <select
                value={checkShiftFilter}
                onChange={(e) => setCheckShiftFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold bg-white"
              >
                <option value="all">كل ورديات هذا اليوم</option>
                {dailySummary.dayCashierShifts.map((sh) => (
                  <option key={sh.id} value={sh.id}>
                    {sh.shiftSlotName || 'وردية'} — {sh.staffName} ({formatShortTime(sh.startedAt)})
                  </option>
                ))}
              </select>
            </div>

            {filteredDayChecks.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                لا توجد شيكات مطابقة في هذا التاريخ أو الفلتر المحدد.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-zinc-50/80 text-zinc-600 border-b border-zinc-200">
                    <tr>
                      <th className="py-2.5 px-4 font-extrabold text-start">رقم الشيك</th>
                      <th className="py-2.5 px-4 font-extrabold text-start">النوع / الطاولة</th>
                      <th className="py-2.5 px-4 font-extrabold text-start">العميل</th>
                      <th className="py-2.5 px-4 font-extrabold text-start">الدفع</th>
                      <th className="py-2.5 px-4 font-extrabold text-start">الإجمالي</th>
                      <th className="py-2.5 px-4 font-extrabold text-start">الحالة والمُغلق</th>
                      <th className="py-2.5 px-4 font-extrabold text-start">الوقت</th>
                      <th className="py-2.5 px-4 font-extrabold text-end">مراجعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredDayChecks.map((ord) => {
                      const totalDisc =
                        Number(ord.discountAmount || 0) + Number(ord.manualDiscountAmount || 0);
                      const typeText =
                        ord.orderType === 'dine_in'
                          ? `صالة${ord.hallName ? ` · ${ord.hallName}` : ''} · طاولة ${ord.tableNumber || '-'}`
                          : ord.orderType === 'delivery'
                            ? 'دليفري'
                            : 'تيك أواي';
                      const payText =
                        ord.status === 'cancelled'
                          ? 'ملغي'
                          : ord.paymentMethod === 'visa'
                            ? 'فيزا 💳'
                            : ord.paymentMethod === 'split'
                              ? 'مختلط'
                              : ord.status === 'completed'
                                ? 'كاش 💵'
                                : 'غير محصّل';
                      return (
                        <tr
                          key={ord.id}
                          onClick={() => setSelectedCheckOrder(ord)}
                          className="hover:bg-amber-50/40 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-4 font-mono-num font-extrabold text-zinc-950 whitespace-nowrap">
                            #{ord.orderNumber}
                          </td>
                          <td className="py-2.5 px-4 text-zinc-700 font-semibold whitespace-nowrap">
                            {typeText}
                          </td>
                          <td className="py-2.5 px-4 text-zinc-800">
                            <span className="font-bold">{ord.customerName}</span>
                            {ord.customerPhone && (
                              <span className="block text-[10px] font-mono-num text-zinc-400">
                                {ord.customerPhone}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-zinc-700 whitespace-nowrap">
                            {payText}
                          </td>
                          <td className="py-2.5 px-4 font-mono-num whitespace-nowrap">
                            <span className="font-extrabold text-zinc-950">
                              {formatMoney(ord.total)}
                            </span>
                            {totalDisc > 0 && (
                              <span className="block text-[10px] text-indigo-700 font-bold">
                                خصم -{formatMoney(totalDisc)}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            {ord.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold">
                                محصّل{ord.closedByName ? ` · ${ord.closedByName}` : ''}
                              </span>
                            ) : ord.status === 'cancelled' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-extrabold">
                                ملغي
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold">
                                مفتوح الآن
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-mono-num text-zinc-500 whitespace-nowrap">
                            {formatShortTime(ord.closedAt || ord.createdAt)}
                          </td>
                          <td className="py-2.5 px-4 text-end whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCheckOrder(ord);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-950 hover:text-white text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Eye className="w-3 h-3" />
                              <span>عرض</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Sensitive Audit Events (Modifications / Cancellations / Discounts / Suspensions) */}
          <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-extrabold text-zinc-950 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>سجل التعديلات والإلغاءات والخصومات والمصروفات لليوم ({dailySummary.dayAudit.length})</span>
              </h4>
            </div>
            {dailySummary.dayAudit.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                لا توجد تعديلات أو إلغاءات أو خصومات مسجلة في هذا اليوم.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {dailySummary.dayAudit.map((log) => (
                  <div key={log.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5">
                      <p className="font-extrabold text-zinc-950">
                        {log.actorName}{' '}
                        <span className="font-normal text-zinc-500">
                          ({log.actorRole === 'owner' ? 'المالك' : log.actorRole === 'superadmin' ? 'السوبر أدمن' : STAFF_ROLE_META[log.actorRole as StaffRole]?.labelAr || log.actorRole})
                        </span>
                      </p>
                      <p className="text-zinc-700">{log.details}</p>
                    </div>
                    <span className="text-[11px] font-mono-num text-zinc-500 shrink-0">
                      {formatShortTime(log.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        /* MULTI-DAY SHIFT MATRIX TABLE */
        <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1">
              <label className="space-y-1 text-[11px] font-bold text-zinc-600">
                <span>من تاريخ</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono-num text-zinc-900"
                />
              </label>
              <label className="space-y-1 text-[11px] font-bold text-zinc-600">
                <span>إلى تاريخ</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono-num text-zinc-900"
                />
              </label>
              <label className="space-y-1 text-[11px] font-bold text-zinc-600">
                <span>بحث بالكاشير / المستلم / الوردية</span>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="اسم الكاشير..."
                    className="w-full ps-8 pe-3 py-2 rounded-xl border border-zinc-300 text-xs text-zinc-900"
                  />
                </div>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {[
                { days: 0, label: 'اليوم' },
                { days: 6, label: '7 أيام' },
                { days: 13, label: '14 يوماً' },
                { days: 29, label: '30 يوماً' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setToDate(todayIso);
                    setFromDate(toIsoDateLocal(Date.now() - preset.days * 86400000));
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100 text-[11px] font-extrabold text-zinc-800 cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setStickyMode((m) => (m === 'side_day' ? 'top_header' : 'side_day'))}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-xs font-extrabold text-zinc-900 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Columns className="w-4 h-4 text-indigo-600" />
                <span>
                  {stickyMode === 'side_day'
                    ? 'التثبيت: عمود اليوم (اضغط للتبديل)'
                    : 'التثبيت: الرأس العلوي (اضغط للتبديل)'}
                </span>
              </button>
            </div>
          </div>

          <div className="overflow-auto max-h-[65vh] border border-zinc-200 rounded-xl">
            <table className="min-w-full text-xs border-collapse">
              <thead
                className={`bg-zinc-100 text-zinc-900 ${
                  stickyMode === 'top_header' ? 'sticky top-0 z-20 shadow-2xs' : ''
                }`}
              >
                <tr className="border-b border-zinc-300">
                  <th
                    rowSpan={2}
                    className={`py-3 px-3 font-extrabold text-start border-e border-zinc-300 bg-zinc-100 whitespace-nowrap ${
                      stickyMode === 'side_day' ? 'sticky right-0 z-30 shadow-2xs' : ''
                    }`}
                  >
                    اليوم والتاريخ
                  </th>
                  {matrixData.slots.map((slot) => (
                    <th
                      key={slot.id}
                      colSpan={5}
                      className="py-2 px-3 font-extrabold text-center border-e border-zinc-300 bg-zinc-100/90 whitespace-nowrap"
                    >
                      {slot.name} ({slot.startTime}–{slot.endTime})
                    </th>
                  ))}
                  <th
                    colSpan={4}
                    className="py-2 px-3 font-extrabold text-center bg-zinc-900 text-white whitespace-nowrap"
                  >
                    إجماليات اليوم
                  </th>
                </tr>
                <tr className="border-b border-zinc-300 text-[11px] bg-zinc-50">
                  {matrixData.slots.map((slot) => (
                    <Fragment key={`hdr_${slot.id}`}>
                      <th className="py-2 px-2.5 text-start border-e border-zinc-200 whitespace-nowrap">
                        الكاشير
                      </th>
                      <th className="py-2 px-2.5 text-end border-e border-zinc-200 whitespace-nowrap">
                        كاش
                      </th>
                      <th className="py-2 px-2.5 text-end border-e border-zinc-200 whitespace-nowrap">
                        فيزا
                      </th>
                      <th className="py-2 px-2.5 text-end border-e border-zinc-200 whitespace-nowrap">
                        مصروف
                      </th>
                      <th className="py-2 px-2.5 text-end border-e border-zinc-300 whitespace-nowrap">
                        صافي
                      </th>
                    </Fragment>
                  ))}
                  <th className="py-2 px-2.5 text-end bg-zinc-800 text-white whitespace-nowrap">الكاش</th>
                  <th className="py-2 px-2.5 text-end bg-zinc-800 text-white whitespace-nowrap">الفيزا</th>
                  <th className="py-2 px-2.5 text-end bg-zinc-800 text-white whitespace-nowrap">المصروف</th>
                  <th className="py-2 px-2.5 text-end bg-zinc-900 text-amber-400 whitespace-nowrap">الصافي</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-200 bg-white">
                {matrixData.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={1 + matrixData.slots.length * 5 + 4}
                      className="py-10 text-center text-zinc-500"
                    >
                      لا توجد بيانات ورديات في النطاق المحدد.
                    </td>
                  </tr>
                ) : (
                  matrixData.rows.map((row) => (
                    <tr key={row.iso} className="hover:bg-zinc-50/70">
                      <td
                        onClick={() => {
                          setSelectedDayIso(row.iso);
                          setActiveSubTab('daily');
                        }}
                        title="اضغط لعرض تفاصيل هذا اليوم وشيكاته"
                        className={`py-2.5 px-3 font-extrabold text-zinc-950 border-e border-zinc-300 bg-white hover:bg-amber-50/70 cursor-pointer whitespace-nowrap group ${
                          stickyMode === 'side_day' ? 'sticky right-0 z-10' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>{row.dayName}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 opacity-70 group-hover:opacity-100" />
                        </div>
                        <div className="text-[11px] font-mono-num text-zinc-500">{row.iso}</div>
                      </td>

                      {row.perSlot.map((cell) => (
                        <Fragment key={`${row.iso}_${cell.slotId}`}>
                          <td
                            className="py-2.5 px-2.5 border-e border-zinc-200 whitespace-nowrap max-w-[140px] truncate"
                            title={cell.staffNames}
                          >
                            {cell.matchedCount > 0 ? (
                              <span className="font-bold text-zinc-800">
                                {cell.staffNames} {cell.allLocked ? '🔒' : cell.hasUnlocked ? '🔓' : ''}
                              </span>
                            ) : (
                              <span className="text-zinc-300">—</span>
                            )}
                          </td>
                          <td
                            className="py-2.5 px-2.5 text-end font-mono-num border-e border-zinc-200 whitespace-nowrap"
                          >
                            {cell.matchedCount > 0 ? cell.cash.toFixed(0) : '—'}
                          </td>
                          <td
                            className="py-2.5 px-2.5 text-end font-mono-num border-e border-zinc-200 whitespace-nowrap"
                          >
                            {cell.matchedCount > 0 ? cell.visa.toFixed(0) : '—'}
                          </td>
                          <td
                            className="py-2.5 px-2.5 text-end font-mono-num text-rose-700 border-e border-zinc-200 whitespace-nowrap"
                          >
                            {cell.matchedCount > 0 ? cell.exp.toFixed(0) : '—'}
                          </td>
                          <td
                            className="py-2.5 px-2.5 text-end font-mono-num font-extrabold text-zinc-950 border-e border-zinc-300 whitespace-nowrap"
                          >
                            {cell.matchedCount > 0 ? cell.net.toFixed(0) : '—'}
                          </td>
                        </Fragment>
                      ))}

                      <td className="py-2.5 px-2.5 text-end font-mono-num font-bold bg-zinc-50 whitespace-nowrap">
                        {row.dayCash.toFixed(0)}
                      </td>
                      <td className="py-2.5 px-2.5 text-end font-mono-num font-bold bg-zinc-50 whitespace-nowrap">
                        {row.dayVisa.toFixed(0)}
                      </td>
                      <td className="py-2.5 px-2.5 text-end font-mono-num font-bold text-rose-700 bg-zinc-50 whitespace-nowrap">
                        {row.dayExp.toFixed(0)}
                      </td>
                      <td className="py-2.5 px-2.5 text-end font-mono-num font-extrabold text-emerald-800 bg-emerald-50/60 whitespace-nowrap">
                        {row.dayNet.toFixed(0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              <tfoot className="bg-zinc-950 text-white font-extrabold">
                <tr>
                  <td
                    className={`py-3 px-3 border-e border-zinc-700 bg-zinc-950 whitespace-nowrap ${
                      stickyMode === 'side_day' ? 'sticky right-0 z-20' : ''
                    }`}
                  >
                    الإجمالي العام ({matrixData.rows.length} يوم)
                  </td>
                  {matrixData.grandPerSlot.map((gp, idx) => (
                    <Fragment key={`gf_${idx}`}>
                      <td className="py-3 px-2.5 border-e border-zinc-800 text-zinc-400">
                        المجموع
                      </td>
                      <td className="py-3 px-2.5 text-end font-mono-num border-e border-zinc-800">
                        {gp.cash.toFixed(0)}
                      </td>
                      <td className="py-3 px-2.5 text-end font-mono-num border-e border-zinc-800">
                        {gp.visa.toFixed(0)}
                      </td>
                      <td className="py-3 px-2.5 text-end font-mono-num text-rose-300 border-e border-zinc-800">
                        {gp.exp.toFixed(0)}
                      </td>
                      <td className="py-3 px-2.5 text-end font-mono-num text-amber-400 border-e border-zinc-700">
                        {gp.net.toFixed(0)}
                      </td>
                    </Fragment>
                  ))}
                  <td className="py-3 px-2.5 text-end font-mono-num">{matrixData.grandCash.toFixed(0)}</td>
                  <td className="py-3 px-2.5 text-end font-mono-num">{matrixData.grandVisa.toFixed(0)}</td>
                  <td className="py-3 px-2.5 text-end font-mono-num text-rose-300">{matrixData.grandExp.toFixed(0)}</td>
                  <td className="py-3 px-2.5 text-end font-mono-num text-emerald-400">{matrixData.grandNet.toFixed(0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Detailed Check & Printable Receipt Inspection Modal */}
      {selectedCheckOrder && (() => {
        const linkedShift = selectedCheckOrder.shiftId
          ? shiftMap.get(selectedCheckOrder.shiftId)
          : undefined;
        const isLockedShift =
          linkedShift?.status === 'completed' && !selectedCheckOrder.superAdminUnlocked;
        return (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setSelectedCheckOrder(null)}
          >
            <div
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden"
            >
              <div className="px-5 py-3.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between print:hidden">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-600" />
                  <span className="text-xs sm:text-sm font-extrabold text-zinc-950">
                    تفاصيل ومراجعة الشيك #{selectedCheckOrder.orderNumber}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCheckOrder(null)}
                  aria-label="إغلاق"
                  className="w-8 h-8 rounded-lg hover:bg-zinc-200 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="qr-bulk-print-area p-5 space-y-4 text-zinc-900 bg-white max-h-[72vh] overflow-y-auto print:max-h-none">
                <div className="text-center border-b border-dashed border-zinc-300 pb-3 space-y-1">
                  <h3 className="text-base font-extrabold">{restaurant.name}</h3>
                  <p className="text-xs font-mono-num font-bold text-zinc-700">
                    شيك رقم #{selectedCheckOrder.orderNumber} ·{' '}
                    {selectedCheckOrder.orderType === 'dine_in'
                      ? `صالة${selectedCheckOrder.hallName ? ` (${selectedCheckOrder.hallName})` : ''} · طاولة ${selectedCheckOrder.tableNumber || '-'}`
                      : selectedCheckOrder.orderType === 'delivery'
                        ? 'توصيل دليفري'
                        : 'استلام تيك أواي'}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    العميل: <strong className="text-zinc-900">{selectedCheckOrder.customerName}</strong>
                    {selectedCheckOrder.customerPhone ? ` · ${selectedCheckOrder.customerPhone}` : ''}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[10px] font-bold">
                    <span
                      className={`px-2 py-0.5 rounded-md border ${
                        selectedCheckOrder.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : selectedCheckOrder.status === 'cancelled'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {selectedCheckOrder.status === 'completed'
                        ? 'محصّل ومغلق'
                        : selectedCheckOrder.status === 'cancelled'
                          ? 'ملغي'
                          : 'مفتوح'}
                    </span>
                    {linkedShift && (
                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200 inline-flex items-center gap-1">
                        {isLockedShift ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        <span>
                          {linkedShift.shiftSlotName || 'وردية'} ({linkedShift.staffName})
                        </span>
                      </span>
                    )}
                    <span className="font-mono-num text-zinc-500">
                      إنشاء: {formatShortTime(selectedCheckOrder.createdAt)}
                      {selectedCheckOrder.closedAt
                        ? ` · إقفال: ${formatShortTime(selectedCheckOrder.closedAt)}`
                        : ''}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2 border-b border-dashed border-zinc-300 pb-3">
                  {selectedCheckOrder.items.map((item, idx) => (
                    <div key={`${item.menuItemId}_${idx}`} className="flex items-start justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-zinc-950">
                          <span className="font-mono-num">{item.quantity}×</span> {item.name}
                          {item.sizeName ? ` (${item.sizeName})` : ''}
                          {item.guestName ? ` [${item.guestName}]` : ''}
                        </p>
                        {item.addonNames?.length > 0 && (
                          <p className="text-[11px] text-zinc-500">+ {item.addonNames.join('، ')}</p>
                        )}
                        {item.notes && (
                          <p className="text-[11px] text-amber-700 font-semibold">ملاحظة: {item.notes}</p>
                        )}
                      </div>
                      <span className="font-mono-num font-bold text-zinc-900 shrink-0">
                        {formatMoney(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Financial Totals */}
                <div className="space-y-1.5 text-xs border-b border-dashed border-zinc-300 pb-3">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">المجموع الفرعي</span>
                    <span className="font-mono-num font-bold">{formatMoney(selectedCheckOrder.subtotal)}</span>
                  </div>
                  {Number(selectedCheckOrder.discountAmount || 0) > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>
                        خصم العرض{selectedCheckOrder.promoCode ? ` (${selectedCheckOrder.promoCode})` : ''}
                      </span>
                      <span className="font-mono-num">-{formatMoney(selectedCheckOrder.discountAmount || 0)}</span>
                    </div>
                  )}
                  {Number(selectedCheckOrder.manualDiscountAmount || 0) > 0 && (
                    <div className="flex justify-between text-indigo-700 font-bold">
                      <span>خصم إداري خاص ({selectedCheckOrder.manualDiscountReason || 'إدارة'})</span>
                      <span className="font-mono-num">
                        -{formatMoney(selectedCheckOrder.manualDiscountAmount || 0)}
                      </span>
                    </div>
                  )}
                  {selectedCheckOrder.serviceCharge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-zinc-600">رسوم الخدمة</span>
                      <span className="font-mono-num">{formatMoney(selectedCheckOrder.serviceCharge)}</span>
                    </div>
                  )}
                  {Number(selectedCheckOrder.deliveryFee || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-zinc-600">رسوم التوصيل</span>
                      <span className="font-mono-num">{formatMoney(selectedCheckOrder.deliveryFee || 0)}</span>
                    </div>
                  )}
                  {selectedCheckOrder.taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-zinc-600">الضريبة</span>
                      <span className="font-mono-num">{formatMoney(selectedCheckOrder.taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-extrabold text-zinc-950 pt-1 border-t border-zinc-200">
                    <span>الإجمالي النهائي</span>
                    <span className="font-mono-num">{formatMoney(selectedCheckOrder.total)}</span>
                  </div>
                </div>

                {/* Payment & Settlement Info */}
                {selectedCheckOrder.status === 'completed' && (
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs space-y-1">
                    <p className="font-extrabold text-zinc-900">
                      وسيلة الدفع:{' '}
                      {selectedCheckOrder.paymentMethod === 'visa'
                        ? 'فيزا / بطاقة 💳'
                        : selectedCheckOrder.paymentMethod === 'split'
                          ? `مختلط (كاش ${formatMoney(selectedCheckOrder.cashPaidAmount || 0)} + فيزا ${formatMoney(selectedCheckOrder.visaPaidAmount || 0)})`
                          : `كاش 💵 (${formatMoney(selectedCheckOrder.cashPaidAmount ?? selectedCheckOrder.total)})`}
                    </p>
                    {typeof selectedCheckOrder.customerCashTendered === 'number' &&
                      selectedCheckOrder.customerCashTendered > 0 && (
                        <p className="text-[11px] text-zinc-600 font-mono-num">
                          المبلغ المستلم: {formatMoney(selectedCheckOrder.customerCashTendered)} · الباقي:{' '}
                          {formatMoney(selectedCheckOrder.changeReturned || 0)}
                        </p>
                      )}
                    {selectedCheckOrder.closedByName && (
                      <p className="text-[11px] text-zinc-600">
                        أُغلق بواسطة: <strong>{selectedCheckOrder.closedByName}</strong>
                      </p>
                    )}
                  </div>
                )}

                {selectedCheckOrder.cancelReason && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-bold">
                    سبب الإلغاء: {selectedCheckOrder.cancelReason}
                  </div>
                )}

                {(selectedCheckOrder.notes || selectedCheckOrder.tableNotes) && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
                    {selectedCheckOrder.notes && <p>ملاحظات الطلب: {selectedCheckOrder.notes}</p>}
                    {selectedCheckOrder.tableNotes && (
                      <p className="font-bold">ملاحظات الطاولة: {selectedCheckOrder.tableNotes}</p>
                    )}
                  </div>
                )}

                {selectedCheckOrder.adjustmentHistory && selectedCheckOrder.adjustmentHistory.length > 0 && (
                  <div className="space-y-1.5 pt-1 print:hidden">
                    <p className="text-[11px] font-extrabold text-zinc-700">سجل التعديلات على هذا الشيك:</p>
                    <div className="space-y-1">
                      {selectedCheckOrder.adjustmentHistory.map((adj, i) => (
                        <div
                          key={`${adj.at}_${i}`}
                          className="p-2 rounded-lg bg-zinc-50 border border-zinc-200 text-[11px] text-zinc-700"
                        >
                          <span className="font-extrabold text-zinc-900">{adj.actorName}</span>:{' '}
                          {adj.details || adj.action}
                          {adj.reason ? ` — (${adj.reason})` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 py-3.5 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة نسخة الشيك</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCheckOrder(null)}
                  className="px-4 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-bold text-zinc-800 cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
