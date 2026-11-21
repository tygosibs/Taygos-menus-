import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Columns,
  FileSpreadsheet,
  Lock,
  Search,
  ShieldAlert,
  Unlock,
  UserCheck,
  Vault,
  Wallet,
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
  const [selectedDayIso, setSelectedDayIso] = useState(todayIso);

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

    return {
      dayShifts,
      dayOrdersCount: completedDayOrders.length,
      cancelledOrdersCount: dayOrders.filter((o) => o.status === 'cancelled').length,
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
                  يوضح كل ما تم خلال اليوم من مبيعات وحضور وانصراف الكادر وأي تعديلات أو خصومات.
                </p>
              </div>
              <input
                type="date"
                value={selectedDayIso}
                onChange={(e) => setSelectedDayIso(e.target.value || todayIso)}
                className="px-3.5 py-2 rounded-xl border border-zinc-300 text-xs font-mono-num font-bold"
              />
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

            <button
              type="button"
              onClick={() => setStickyMode((m) => (m === 'side_day' ? 'top_header' : 'side_day'))}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-xs font-extrabold text-zinc-900 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Columns className="w-4 h-4 text-indigo-600" />
              <span>
                {stickyMode === 'side_day'
                  ? 'التثبيت الحالي: عمود اليوم والتاريخ (اضغط للتبديل للرأس العلوي)'
                  : 'التثبيت الحالي: الرأس العلوي (اضغط للتبديل لعمود اليوم)'}
              </span>
            </button>
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
                        className={`py-2.5 px-3 font-extrabold text-zinc-950 border-e border-zinc-300 bg-white whitespace-nowrap ${
                          stickyMode === 'side_day' ? 'sticky right-0 z-10' : ''
                        }`}
                      >
                        <div>{row.dayName}</div>
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
    </div>
  );
}
