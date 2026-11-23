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

function getDayName(isoDate: string, isEn: boolean): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString(isEn ? 'en-US' : 'ar-EG-u-nu-latn', {
    weekday: 'long',
  });
}

function formatShortTime(ts: unknown, isEn: boolean): string {
  const ms = getTimestampMillis(ts);
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString(isEn ? 'en-US' : 'ar-EG-u-nu-latn', {
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const { lang, dir, isRtl, loc, formatCurrency } = useLanguage();
  const isEn = lang === 'en';
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
        const staffNames = Array.from(new Set(matched.map((x) => x.staffName))).join(
          isEn ? ', ' : '، '
        );
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
        dayName: getDayName(iso, isEn),
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
  }, [opsConfig.shiftSlots, shifts, fromDate, toDate, searchTerm, isEn]);

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
        note:
          vaultNote ||
          (sign > 0
            ? isEn
              ? 'Deposit to main vault'
              : 'إيداع بالخزنة الرئيسية'
            : isEn
              ? 'Withdrawal from main vault'
              : 'سحب من الخزنة الرئيسية'),
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
      setVaultMsg(
        sign > 0
          ? isEn
            ? `Added ${formatMoney(raw)} to main vault.`
            : `تمت إضافة ${formatMoney(raw)} للخزنة.`
          : isEn
            ? `Withdrew ${formatMoney(raw)} from main vault.`
            : `تم خصم ${formatMoney(raw)} من الخزنة.`
      );
    } finally {
      setSavingVault(false);
    }
  };

  return (
    <div dir={dir} className="space-y-6">
      {/* Main Treasury Overview */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
            <span>
              {isEn ? 'Owner Main Vault (Cash)' : 'الخزنة الرئيسية لصاحب المطعم (كاش)'}
            </span>
            <Vault className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold font-mono-num text-zinc-950">
            {formatMoney(treasury.ownerVaultCashBalance)}
          </p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
            <span>{isEn ? 'Total Card / Bank Sales' : 'إجمالي مبيعات الفيزا / البنك'}</span>
            <Wallet className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-extrabold font-mono-num text-blue-700">
            {formatMoney(treasury.ownerVaultVisaTotal)}
          </p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
            <span>{isEn ? 'Pending Manager Custody' : 'رصيد عهدة المدير المعلّقة'}</span>
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
              {isEn
                ? 'Manual Main Vault Adjustment / Deposit or Withdrawal (Owner Only)'
                : 'تسوية أو سحب / إيداع يدوي بالخزنة الرئيسية (للمالك فقط)'}
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
              placeholder={isEn ? `Amount (${currencyLabel})` : `المبلغ (${currencyLabel})`}
              className="px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono-num font-bold"
            />
            <input
              type="text"
              value={vaultNote}
              onChange={(e) => setVaultNote(e.target.value)}
              placeholder={isEn ? 'Note / Reason' : 'البيان / السبب'}
              className="sm:col-span-2 px-3 py-2 rounded-xl border border-zinc-300 text-xs"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={savingVault || !vaultDelta}
                onClick={(e) => handleAdjustVault(e, 1)}
                className="flex-1 min-h-[38px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
              >
                {isEn ? '+ Deposit' : '+ إيداع'}
              </button>
              <button
                type="button"
                disabled={savingVault || !vaultDelta}
                onClick={(e) => handleAdjustVault(e, -1)}
                className="flex-1 min-h-[38px] px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
              >
                {isEn ? '- Withdraw' : '- سحب'}
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
            <span>{isEn ? 'Daily Detailed Report' : 'التقرير اليومي المفصل'}</span>
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
            <span>{isEn ? 'Multi-Day Shift Matrix' : 'جدول تقارير الورديات (متعدد الأيام)'}</span>
          </button>
        </div>

        <span className="text-[11px] font-bold text-zinc-500 flex items-center gap-1">
          <Lock className="w-3.5 h-3.5 text-zinc-400" />
          <span>
            {isEn
              ? 'Closed shifts are edit-locked (unless exceptionally unlocked by Super Admin)'
              : 'الورديات المغلقة محمية ضد التعديل (إلا بفتح استثنائي من مدير المنصة)'}
          </span>
        </span>
      </div>

      {activeSubTab === 'daily' ? (
        <div className="space-y-5">
          {/* Date Picker & KPIs */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-zinc-950">
                  {isEn
                    ? `Daily Operations Summary — ${getDayName(selectedDayIso, true)} (${selectedDayIso})`
                    : `ملخص تشغيل اليوم — ${getDayName(selectedDayIso, false)} (${selectedDayIso})`}
                </h3>
                <p className="text-xs text-zinc-500">
                  {isEn
                    ? 'Full breakdown of daily sales, staff attendance, settled & cancelled checks, and audit adjustments.'
                    : 'يوضح كل ما تم خلال اليوم من مبيعات وحضور وانصراف الكادر والشيكات المغلقة والملغاة وأي تعديلات.'}
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
                  {isEn ? 'Today' : 'اليوم'}
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
                  {isEn ? 'Yesterday' : 'أمس'}
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
                {
                  label: isEn ? 'Settled Orders' : 'الطلبات المحصّلة',
                  value: String(dailySummary.dayOrdersCount),
                },
                {
                  label: isEn ? 'Cash Sales' : 'مبيعات الكاش',
                  value: formatMoney(dailySummary.cashSales),
                },
                {
                  label: isEn ? 'Visa / Card Sales' : 'مبيعات الفيزا',
                  value: formatMoney(dailySummary.visaSales),
                },
                {
                  label: isEn ? 'Expenses' : 'المصروفات',
                  value: formatMoney(dailySummary.totalExpenses),
                },
                {
                  label: isEn ? 'Drawer Variance' : 'فرق الدرج (تقريب)',
                  value: formatMoney(dailySummary.variance),
                },
                {
                  label: isEn ? 'Net Day Revenue' : 'صافي إيراد اليوم',
                  value: formatMoney(dailySummary.netDay),
                },
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
                {isEn
                  ? `Staff Attendance & Shifts (${dailySummary.dayShifts.length})`
                  : `سجل حضور وانصراف الكادر (${dailySummary.dayShifts.length})`}
              </h4>
              <span className="text-[11px] text-zinc-500">
                {isEn ? 'From check-in until shift handover' : 'من ساعة الدخول حتى تسليم الوردية'}
              </span>
            </div>
            {dailySummary.dayShifts.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                {isEn ? 'No shifts recorded for this date.' : 'لا توجد ورديات مسجلة في هذا التاريخ.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-zinc-50/70 text-zinc-600 border-b border-zinc-200">
                    <tr>
                      <th className="py-2.5 px-4 font-extrabold text-start">
                        {isEn ? 'Staff' : 'الموظف'}
                      </th>
                      <th className="py-2.5 px-4 font-extrabold text-start">
                        {isEn ? 'Station / Screen' : 'القسم / الشاشة'}
                      </th>
                      <th className="py-2.5 px-4 font-extrabold text-start">
                        {isEn ? 'In' : 'دخول'}
                      </th>
                      <th className="py-2.5 px-4 font-extrabold text-start">
                        {isEn ? 'Out' : 'خروج'}
                      </th>
                      <th className="py-2.5 px-4 font-extrabold text-start">
                        {isEn ? 'Performance / Cash' : 'الأداء / الكاش'}
                      </th>
                      <th className="py-2.5 px-4 font-extrabold text-start">
                        {isEn ? 'Status' : 'الحالة'}
                      </th>
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
                        <td className="py-2.5 px-4 font-mono-num">
                          {formatShortTime(sh.startedAt, isEn)}
                        </td>
                        <td className="py-2.5 px-4 font-mono-num">
                          {sh.status === 'active'
                            ? isEn
                              ? 'Active now'
                              : 'مستمرة الآن'
                            : formatShortTime(sh.endedAt, isEn)}
                        </td>
                        <td className="py-2.5 px-4 font-mono-num text-zinc-700">
                          {sh.stationId === 'cashier'
                            ? isEn
                              ? `Cash ${formatMoney(sh.cashSales || 0)} · Visa ${formatMoney(sh.visaSales || 0)}`
                              : `كاش ${formatMoney(sh.cashSales || 0)} · فيزا ${formatMoney(sh.visaSales || 0)}`
                            : isEn
                              ? `Orders: ${sh.ordersHandled || 0} · Ready: ${sh.itemsMarkedReady || 0}`
                              : `طلبات: ${sh.ordersHandled || 0} · تجهيز: ${sh.itemsMarkedReady || 0}`}
                        </td>
                        <td className="py-2.5 px-4">
                          {sh.superAdminUnlocked ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700">
                              <Unlock className="w-3 h-3" />{' '}
                              {isEn ? 'Exceptionally Unlocked' : 'مفتوحة استثنائياً'}
                            </span>
                          ) : sh.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-600">
                              <Lock className="w-3 h-3" /> {isEn ? 'Locked' : 'مغلقة'}
                            </span>
                          ) : (
                            <span className="text-[11px] font-extrabold text-emerald-700">
                              {isEn ? 'Active' : 'نشطة'}
                            </span>
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
                    {isEn
                      ? `Daily Checks & Receipts Archive (${filteredDayChecks.length} of ${dailySummary.dayOrders.length})`
                      : `سجل شيكات وفواتير اليوم (${filteredDayChecks.length} من ${dailySummary.dayOrders.length})`}
                  </span>
                </h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {isEn
                    ? 'Click any check to inspect items, discounts, payment split, or print a receipt copy.'
                    : 'اضغط على أي شيك لعرض تفاصيل الأصناف والخصومات وطريقة التحصيل أو طباعة نسخة الإيصال.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    {
                      id: 'all' as const,
                      label: isEn
                        ? `All (${dailySummary.dayOrders.length})`
                        : `الكل (${dailySummary.dayOrders.length})`,
                    },
                    {
                      id: 'completed' as const,
                      label: isEn
                        ? `Settled (${dailySummary.dayOrdersCount})`
                        : `المحصّلة (${dailySummary.dayOrdersCount})`,
                    },
                    {
                      id: 'cancelled' as const,
                      label: isEn
                        ? `Cancelled (${dailySummary.cancelledOrdersCount})`
                        : `الملغاة (${dailySummary.cancelledOrdersCount})`,
                    },
                    {
                      id: 'open' as const,
                      label: isEn
                        ? `Open (${dailySummary.openOrdersCount})`
                        : `المفتوحة (${dailySummary.openOrdersCount})`,
                    },
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
                  placeholder={
                    isEn
                      ? 'Search check #, table, guest, or cashier...'
                      : 'بحث برقم الشيك أو الطاولة أو العميل أو الكاشير...'
                  }
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
                <option value="all">{isEn ? 'All Order Types' : 'كل أنواع الطلبات'}</option>
                <option value="dine_in">{isEn ? 'Dine-In (Tables)' : 'صالة (طاولات)'}</option>
                <option value="pickup">{isEn ? 'Takeaway (Pickup)' : 'تيك أواي (استلام)'}</option>
                <option value="delivery">{isEn ? 'Delivery' : 'دليفري (توصيل)'}</option>
              </select>

              <select
                value={checkShiftFilter}
                onChange={(e) => setCheckShiftFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-zinc-200 text-xs font-bold bg-white"
              >
                <option value="all">{isEn ? 'All Shifts on This Day' : 'كل ورديات هذا اليوم'}</option>
                {dailySummary.dayCashierShifts.map((sh) => (
                  <option key={sh.id} value={sh.id}>
                    {sh.shiftSlotName || (isEn ? 'Shift' : 'وردية')} — {sh.staffName} (
                    {formatShortTime(sh.startedAt, isEn)})
                  </option>
                ))}
              </select>
            </div>

            {filteredDayChecks.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                {isEn
                  ? 'No matching checks found for this date or filter.'
                  : 'لا توجد شيكات مطابقة في هذا التاريخ أو الفلتر المحدد.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-zinc-50/80 text-zinc-600 border-b border-zinc-200">
                    <tr>
                      <th className="py-2.5 px-4 font-extrabold text-start">
                        {isEn ? 'Check #' : 'رقم الشيك'}
                      </th>
                      <th className="py-2.5 px-4 font-extrabold text-start">
                        {isEn ? 'Type / Table' : 'النوع / الطاولة'}
                      </th>
                      <th className="py-2.5 px-4 font-extrabold text-start">
                        {isEn ? 'Customer' : 'العميل'}
                      </th>
                      <th className="py-2.5 px-4 font-extrabold text-start">
                        {isEn ? 'Payment' : 'الدفع'}
                      </th>
                      <th className="py-2.5 px-4 font-extrabold text-start">
                        {isEn ? 'Total' : 'الإجمالي'}
                      </th>
                      <th className="py-2.5 px-4 font-extrabold text-start">
                        {isEn ? 'Status & Closer' : 'الحالة والمُغلق'}
                      </th>
                      <th className="py-2.5 px-4 font-extrabold text-start">
                        {isEn ? 'Time' : 'الوقت'}
                      </th>
                      <th className="py-2.5 px-4 font-extrabold text-end">
                        {isEn ? 'Inspect' : 'مراجعة'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredDayChecks.map((ord) => {
                      const totalDisc =
                        Number(ord.discountAmount || 0) + Number(ord.manualDiscountAmount || 0);
                      const typeText =
                        ord.orderType === 'dine_in'
                          ? isEn
                            ? `Dine-In${ord.hallName ? ` · ${ord.hallName}` : ''} · Table ${ord.tableNumber || '-'}`
                            : `صالة${ord.hallName ? ` · ${ord.hallName}` : ''} · طاولة ${ord.tableNumber || '-'}`
                          : ord.orderType === 'delivery'
                            ? isEn
                              ? 'Delivery'
                              : 'دليفري'
                            : isEn
                              ? 'Takeaway'
                              : 'تيك أواي';
                      const payText =
                        ord.status === 'cancelled'
                          ? isEn
                            ? 'Cancelled'
                            : 'ملغي'
                          : ord.paymentMethod === 'visa'
                            ? isEn
                              ? 'Visa / Card'
                              : 'فيزا'
                            : ord.paymentMethod === 'split'
                              ? isEn
                                ? 'Split'
                                : 'مختلط'
                              : ord.status === 'completed'
                                ? isEn
                                  ? 'Cash'
                                  : 'كاش'
                                : isEn
                                  ? 'Unpaid'
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
                                {isEn ? 'Discount' : 'خصم'} -{formatMoney(totalDisc)}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            {ord.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold">
                                {isEn ? 'Settled' : 'محصّل'}
                                {ord.closedByName ? ` · ${ord.closedByName}` : ''}
                              </span>
                            ) : ord.status === 'cancelled' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-extrabold">
                                {isEn ? 'Cancelled' : 'ملغي'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold">
                                {isEn ? 'Open Now' : 'مفتوح الآن'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-mono-num text-zinc-500 whitespace-nowrap">
                            {formatShortTime(ord.closedAt || ord.createdAt, isEn)}
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
                              <span>{isEn ? 'View' : 'عرض'}</span>
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
                <span>
                  {isEn
                    ? `Sensitive Audit Log (Modifications, Cancellations, Discounts & Expenses) (${dailySummary.dayAudit.length})`
                    : `سجل التعديلات والإلغاءات والخصومات والمصروفات لليوم (${dailySummary.dayAudit.length})`}
                </span>
              </h4>
            </div>
            {dailySummary.dayAudit.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                {isEn
                  ? 'No modifications, cancellations, or discounts recorded on this day.'
                  : 'لا توجد تعديلات أو إلغاءات أو خصومات مسجلة في هذا اليوم.'}
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {dailySummary.dayAudit.map((log) => (
                  <div key={log.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5">
                      <p className="font-extrabold text-zinc-950">
                        {log.actorName}{' '}
                        <span className="font-normal text-zinc-500">
                          (
                          {log.actorRole === 'owner'
                            ? isEn
                              ? 'Owner'
                              : 'المالك'
                            : log.actorRole === 'superadmin'
                              ? isEn
                                ? 'Platform Admin'
                                : 'إدارة المنصة'
                              : isEn
                                ? STAFF_ROLE_META[log.actorRole as StaffRole]?.labelEn ||
                                  log.actorRole
                                : STAFF_ROLE_META[log.actorRole as StaffRole]?.labelAr ||
                                  log.actorRole}
                          )
                        </span>
                      </p>
                      <p className="text-zinc-700">{log.details}</p>
                    </div>
                    <span className="text-[11px] font-mono-num text-zinc-500 shrink-0">
                      {formatShortTime(log.createdAt, isEn)}
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
                <span>{isEn ? 'From Date' : 'من تاريخ'}</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono-num text-zinc-900"
                />
              </label>
              <label className="space-y-1 text-[11px] font-bold text-zinc-600">
                <span>{isEn ? 'To Date' : 'إلى تاريخ'}</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono-num text-zinc-900"
                />
              </label>
              <label className="space-y-1 text-[11px] font-bold text-zinc-600">
                <span>{isEn ? 'Search Cashier / Receiver / Shift' : 'بحث بالكاشير / المستلم / الوردية'}</span>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={isEn ? 'Cashier name...' : 'اسم الكاشير...'}
                    className="w-full ps-8 pe-3 py-2 rounded-xl border border-zinc-300 text-xs text-zinc-900"
                  />
                </div>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {[
                { days: 0, label: isEn ? 'Today' : 'اليوم' },
                { days: 6, label: isEn ? '7 Days' : '7 أيام' },
                { days: 13, label: isEn ? '14 Days' : '14 يوماً' },
                { days: 29, label: isEn ? '30 Days' : '30 يوماً' },
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
                    ? isEn
                      ? 'Sticky: Day Column (Tap to switch)'
                      : 'التثبيت: عمود اليوم (اضغط للتبديل)'
                    : isEn
                      ? 'Sticky: Top Header (Tap to switch)'
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
                      stickyMode === 'side_day'
                        ? isRtl
                          ? 'sticky right-0 z-30 shadow-2xs'
                          : 'sticky left-0 z-30 shadow-2xs'
                        : ''
                    }`}
                  >
                    {isEn ? 'Day & Date' : 'اليوم والتاريخ'}
                  </th>
                  {matrixData.slots.map((slot) => (
                    <th
                      key={slot.id}
                      colSpan={5}
                      className="py-2 px-3 font-extrabold text-center border-e border-zinc-300 bg-zinc-100/90 whitespace-nowrap"
                    >
                      {isEn ? slot.nameEn || slot.name : slot.name} ({slot.startTime}–{slot.endTime})
                    </th>
                  ))}
                  <th
                    colSpan={4}
                    className="py-2 px-3 font-extrabold text-center bg-zinc-900 text-white whitespace-nowrap"
                  >
                    {isEn ? 'Day Totals' : 'إجماليات اليوم'}
                  </th>
                </tr>
                <tr className="border-b border-zinc-300 text-[11px] bg-zinc-50">
                  {matrixData.slots.map((slot) => (
                    <Fragment key={`hdr_${slot.id}`}>
                      <th className="py-2 px-2.5 text-start border-e border-zinc-200 whitespace-nowrap">
                        {isEn ? 'Cashier' : 'الكاشير'}
                      </th>
                      <th className="py-2 px-2.5 text-end border-e border-zinc-200 whitespace-nowrap">
                        {isEn ? 'Cash' : 'كاش'}
                      </th>
                      <th className="py-2 px-2.5 text-end border-e border-zinc-200 whitespace-nowrap">
                        {isEn ? 'Visa' : 'فيزا'}
                      </th>
                      <th className="py-2 px-2.5 text-end border-e border-zinc-200 whitespace-nowrap">
                        {isEn ? 'Exp.' : 'مصروف'}
                      </th>
                      <th className="py-2 px-2.5 text-end border-e border-zinc-300 whitespace-nowrap">
                        {isEn ? 'Net' : 'صافي'}
                      </th>
                    </Fragment>
                  ))}
                  <th className="py-2 px-2.5 text-end bg-zinc-800 text-white whitespace-nowrap">
                    {isEn ? 'Cash' : 'الكاش'}
                  </th>
                  <th className="py-2 px-2.5 text-end bg-zinc-800 text-white whitespace-nowrap">
                    {isEn ? 'Visa' : 'الفيزا'}
                  </th>
                  <th className="py-2 px-2.5 text-end bg-zinc-800 text-white whitespace-nowrap">
                    {isEn ? 'Expenses' : 'المصروف'}
                  </th>
                  <th className="py-2 px-2.5 text-end bg-zinc-900 text-amber-400 whitespace-nowrap">
                    {isEn ? 'Net' : 'الصافي'}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-200 bg-white">
                {matrixData.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={1 + matrixData.slots.length * 5 + 4}
                      className="py-10 text-center text-zinc-500"
                    >
                      {isEn ? 'No shift data in the selected range.' : 'لا توجد بيانات ورديات في النطاق المحدد.'}
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
                        title={
                          isEn
                            ? 'Click to view full details and checks for this day'
                            : 'اضغط لعرض تفاصيل هذا اليوم وشيكاته'
                        }
                        className={`py-2.5 px-3 font-extrabold text-zinc-950 border-e border-zinc-300 bg-white hover:bg-amber-50/70 cursor-pointer whitespace-nowrap group ${
                          stickyMode === 'side_day'
                            ? isRtl
                              ? 'sticky right-0 z-10'
                              : 'sticky left-0 z-10'
                            : ''
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
                              <span className="inline-flex items-center gap-1 font-bold text-zinc-800">
                                <span className="truncate">{cell.staffNames}</span>
                                {cell.allLocked ? (
                                  <Lock className="w-3 h-3 text-zinc-500 shrink-0" />
                                ) : cell.hasUnlocked ? (
                                  <Unlock className="w-3 h-3 text-indigo-600 shrink-0" />
                                ) : null}
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
                      stickyMode === 'side_day'
                        ? isRtl
                          ? 'sticky right-0 z-20'
                          : 'sticky left-0 z-20'
                        : ''
                    }`}
                  >
                    {isEn
                      ? `Grand Total (${matrixData.rows.length} days)`
                      : `الإجمالي العام (${matrixData.rows.length} يوم)`}
                  </td>
                  {matrixData.grandPerSlot.map((gp, idx) => (
                    <Fragment key={`gf_${idx}`}>
                      <td className="py-3 px-2.5 border-e border-zinc-800 text-zinc-400">
                        {isEn ? 'Subtotal' : 'المجموع'}
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
              dir={dir}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden"
            >
              <div className="px-5 py-3.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between print:hidden">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-600" />
                  <span className="text-xs sm:text-sm font-extrabold text-zinc-950">
                    {isEn
                      ? `Check Inspection #${selectedCheckOrder.orderNumber}`
                      : `تفاصيل ومراجعة الشيك #${selectedCheckOrder.orderNumber}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCheckOrder(null)}
                  aria-label={isEn ? 'Close' : 'إغلاق'}
                  className="w-8 h-8 rounded-lg hover:bg-zinc-200 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="qr-bulk-print-area p-5 space-y-4 text-zinc-900 bg-white max-h-[72vh] overflow-y-auto print:max-h-none">
                <div className="text-center border-b border-dashed border-zinc-300 pb-3 space-y-1">
                  <h3 className="text-base font-extrabold">
                    {loc(restaurant.name, restaurant.name_en)}
                  </h3>
                  <p className="text-xs font-mono-num font-bold text-zinc-700">
                    {isEn ? `Check #${selectedCheckOrder.orderNumber}` : `شيك رقم #${selectedCheckOrder.orderNumber}`} ·{' '}
                    {selectedCheckOrder.orderType === 'dine_in'
                      ? isEn
                        ? `Dine-In${selectedCheckOrder.hallName ? ` (${selectedCheckOrder.hallName})` : ''} · Table ${selectedCheckOrder.tableNumber || '-'}`
                        : `صالة${selectedCheckOrder.hallName ? ` (${selectedCheckOrder.hallName})` : ''} · طاولة ${selectedCheckOrder.tableNumber || '-'}`
                      : selectedCheckOrder.orderType === 'delivery'
                        ? isEn
                          ? 'Delivery'
                          : 'توصيل دليفري'
                        : isEn
                          ? 'Takeaway'
                          : 'استلام تيك أواي'}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {isEn ? 'Customer:' : 'العميل:'}{' '}
                    <strong className="text-zinc-900">{selectedCheckOrder.customerName}</strong>
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
                        ? isEn
                          ? 'Settled & Closed'
                          : 'محصّل ومغلق'
                        : selectedCheckOrder.status === 'cancelled'
                          ? isEn
                            ? 'Cancelled'
                            : 'ملغي'
                          : isEn
                            ? 'Open'
                            : 'مفتوح'}
                    </span>
                    {linkedShift && (
                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200 inline-flex items-center gap-1">
                        {isLockedShift ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        <span>
                          {linkedShift.shiftSlotName || (isEn ? 'Shift' : 'وردية')} ({linkedShift.staffName})
                        </span>
                      </span>
                    )}
                    <span className="font-mono-num text-zinc-500">
                      {isEn ? 'Opened:' : 'إنشاء:'} {formatShortTime(selectedCheckOrder.createdAt, isEn)}
                      {selectedCheckOrder.closedAt
                        ? ` · ${isEn ? 'Closed:' : 'إقفال:'} ${formatShortTime(selectedCheckOrder.closedAt, isEn)}`
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
                          <p className="text-[11px] text-zinc-500">+ {item.addonNames.join(isEn ? ', ' : '، ')}</p>
                        )}
                        {item.notes && (
                          <p className="text-[11px] text-amber-700 font-semibold">
                            {isEn ? 'Note:' : 'ملاحظة:'} {item.notes}
                          </p>
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
                    <span className="text-zinc-600">{isEn ? 'Subtotal' : 'المجموع الفرعي'}</span>
                    <span className="font-mono-num font-bold">{formatMoney(selectedCheckOrder.subtotal)}</span>
                  </div>
                  {Number(selectedCheckOrder.discountAmount || 0) > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>
                        {isEn ? 'Promo Discount' : 'خصم العرض'}
                        {selectedCheckOrder.promoCode ? ` (${selectedCheckOrder.promoCode})` : ''}
                      </span>
                      <span className="font-mono-num">-{formatMoney(selectedCheckOrder.discountAmount || 0)}</span>
                    </div>
                  )}
                  {Number(selectedCheckOrder.manualDiscountAmount || 0) > 0 && (
                    <div className="flex justify-between text-indigo-700 font-bold">
                      <span>
                        {isEn ? 'Special Discount' : 'خصم إداري خاص'} (
                        {selectedCheckOrder.manualDiscountReason || (isEn ? 'Management' : 'إدارة')})
                      </span>
                      <span className="font-mono-num">
                        -{formatMoney(selectedCheckOrder.manualDiscountAmount || 0)}
                      </span>
                    </div>
                  )}
                  {selectedCheckOrder.serviceCharge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-zinc-600">{isEn ? 'Service Charge' : 'رسوم الخدمة'}</span>
                      <span className="font-mono-num">{formatMoney(selectedCheckOrder.serviceCharge)}</span>
                    </div>
                  )}
                  {Number(selectedCheckOrder.deliveryFee || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-zinc-600">{isEn ? 'Delivery Fee' : 'رسوم التوصيل'}</span>
                      <span className="font-mono-num">{formatMoney(selectedCheckOrder.deliveryFee || 0)}</span>
                    </div>
                  )}
                  {selectedCheckOrder.taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-zinc-600">{isEn ? 'Tax' : 'الضريبة'}</span>
                      <span className="font-mono-num">{formatMoney(selectedCheckOrder.taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-extrabold text-zinc-950 pt-1 border-t border-zinc-200">
                    <span>{isEn ? 'Final Total' : 'الإجمالي النهائي'}</span>
                    <span className="font-mono-num">{formatMoney(selectedCheckOrder.total)}</span>
                  </div>
                </div>

                {/* Payment & Settlement Info */}
                {selectedCheckOrder.status === 'completed' && (
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs space-y-1">
                    <p className="font-extrabold text-zinc-900">
                      {isEn ? 'Payment Method: ' : 'وسيلة الدفع: '}
                      {selectedCheckOrder.paymentMethod === 'visa'
                        ? isEn
                          ? 'Visa / Card'
                          : 'فيزا / بطاقة'
                        : selectedCheckOrder.paymentMethod === 'split'
                          ? isEn
                            ? `Split (Cash ${formatMoney(selectedCheckOrder.cashPaidAmount || 0)} + Visa ${formatMoney(selectedCheckOrder.visaPaidAmount || 0)})`
                            : `مختلط (كاش ${formatMoney(selectedCheckOrder.cashPaidAmount || 0)} + فيزا ${formatMoney(selectedCheckOrder.visaPaidAmount || 0)})`
                          : isEn
                            ? `Cash (${formatMoney(selectedCheckOrder.cashPaidAmount ?? selectedCheckOrder.total)})`
                            : `كاش (${formatMoney(selectedCheckOrder.cashPaidAmount ?? selectedCheckOrder.total)})`}
                    </p>
                    {typeof selectedCheckOrder.customerCashTendered === 'number' &&
                      selectedCheckOrder.customerCashTendered > 0 && (
                        <p className="text-[11px] text-zinc-600 font-mono-num">
                          {isEn ? 'Tendered:' : 'المبلغ المستلم:'}{' '}
                          {formatMoney(selectedCheckOrder.customerCashTendered)} ·{' '}
                          {isEn ? 'Change:' : 'الباقي:'}{' '}
                          {formatMoney(selectedCheckOrder.changeReturned || 0)}
                        </p>
                      )}
                    {selectedCheckOrder.closedByName && (
                      <p className="text-[11px] text-zinc-600">
                        {isEn ? 'Settled by:' : 'أُغلق بواسطة:'}{' '}
                        <strong>{selectedCheckOrder.closedByName}</strong>
                      </p>
                    )}
                  </div>
                )}

                {selectedCheckOrder.cancelReason && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-bold">
                    {isEn ? 'Cancellation Reason:' : 'سبب الإلغاء:'} {selectedCheckOrder.cancelReason}
                  </div>
                )}

                {(selectedCheckOrder.notes || selectedCheckOrder.tableNotes) && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
                    {selectedCheckOrder.notes && (
                      <p>
                        {isEn ? 'Order Notes:' : 'ملاحظات الطلب:'} {selectedCheckOrder.notes}
                      </p>
                    )}
                    {selectedCheckOrder.tableNotes && (
                      <p className="font-bold">
                        {isEn ? 'Table Notes:' : 'ملاحظات الطاولة:'} {selectedCheckOrder.tableNotes}
                      </p>
                    )}
                  </div>
                )}

                {selectedCheckOrder.adjustmentHistory && selectedCheckOrder.adjustmentHistory.length > 0 && (
                  <div className="space-y-1.5 pt-1 print:hidden">
                    <p className="text-[11px] font-extrabold text-zinc-700">
                      {isEn ? 'Check Adjustment History:' : 'سجل التعديلات على هذا الشيك:'}
                    </p>
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
                  <span>{isEn ? 'Print Check Copy' : 'طباعة نسخة الشيك'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCheckOrder(null)}
                  className="px-4 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-bold text-zinc-800 cursor-pointer"
                >
                  {isEn ? 'Close' : 'إغلاق'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
