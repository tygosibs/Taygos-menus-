import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Crown,
  Eye,
  LayoutGrid,
  Loader2,
  PauseCircle,
  Play,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Sliders,
  UserCheck,
  Utensils,
  Wallet,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useScreenUi } from '../../contexts/PlatformUiContext';
import {
  subscribeCategories,
  subscribeMenuItems,
  toggleMenuItemAvailability,
  writeStaffAuditLog,
} from '../../lib/firestoreService';
import {
  DEFAULT_SHIFT_SLOTS,
  getTimestampMillis,
  getResolvedOperationsConfig,
  getResolvedTreasuryState,
  transferManagerCustodyToOwnerVault,
  updateRestaurantOperationsConfig,
} from '../../lib/operationsService';
import { getScreenMetaDynamic } from '../../lib/staffAuthUtils';
import {
  buildEffectiveStations,
  cleanStationId,
  getStationIconComponent,
  stationIdToScreen,
} from '../../lib/stationUtils';
import {
  Category,
  MenuItem,
  OperationsConfig,
  Restaurant,
  RestaurantStation,
  ShiftSlotConfig,
  StaffActorInfo,
  StaffScreen,
  StaffShift,
  TreasuryTransfer,
} from '../../types/menu';

interface ManagerSupervisionDashboardProps {
  restaurant: Restaurant;
  actor: StaffActorInfo;
  activeShifts: StaffShift[];
  dynamicStations: RestaurantStation[];
  treasuryTransfers: TreasuryTransfer[];
  onNavigateScreen: (screen: StaffScreen, opts?: { supervisory?: boolean; coveringStaffName?: string }) => void;
  onRestaurantUpdated?: (updated: Restaurant) => void;
}

function formatLiveDuration(startedAt: unknown, nowMs: number, isEn: boolean): string {
  const startMs = getTimestampMillis(startedAt);
  if (!startMs) return '00:00';
  const diffMin = Math.max(0, Math.floor((nowMs - startMs) / 60000));
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return isEn
    ? `${h}h ${String(m).padStart(2, '0')}m`
    : `${h}س ${String(m).padStart(2, '0')}د`;
}

export function ManagerSupervisionDashboard({
  restaurant,
  actor,
  activeShifts,
  dynamicStations,
  treasuryTransfers,
  onNavigateScreen,
  onRestaurantUpdated,
}: ManagerSupervisionDashboardProps) {
  const { lang, dir, formatCurrency, loc } = useLanguage();
  const isEn = lang === 'en';
  const ui = useScreenUi('manager_console');
  const theme = ui.theme;
  const currencyLabel = formatCurrency(restaurant.currency);
  const opsConfig = useMemo(() => getResolvedOperationsConfig(restaurant), [restaurant]);
  const treasury = useMemo(() => getResolvedTreasuryState(restaurant), [restaurant]);
  const managerPerms = opsConfig.managerPermissions;
  const isOwner = actor.role === 'owner';

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [menuSearch, setMenuSearch] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manager Custody Transfer state
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferring, setTransferring] = useState(false);

  // Operations Settings editor state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftConfig, setDraftConfig] = useState<OperationsConfig>(() => opsConfig);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setDraftConfig(opsConfig);
  }, [opsConfig]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubCats = subscribeCategories(restaurant.id, setCategories);
    const unsubItems = subscribeMenuItems(restaurant.id, setMenuItems);
    return () => {
      unsubCats();
      unsubItems();
    };
  }, [restaurant.id]);

  const effectiveStations = useMemo(
    () => buildEffectiveStations(dynamicStations),
    [dynamicStations]
  );

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const pausedItems = useMemo(
    () => menuItems.filter((it) => !it.isAvailable),
    [menuItems]
  );

  const quickSearchItems = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    if (!q) return [];
    return menuItems
      .filter((it) => it.name.toLowerCase().includes(q) || (it.name_en || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [menuItems, menuSearch]);

  // Supervisory station & screen cards: Cashier, Captain, and every prep station
  const supervisoryCards = useMemo(() => {
    const entries: Array<{
      key: string;
      screen: StaffScreen;
      title: string;
      subtitle: string;
      activeShift: StaffShift | null;
      iconName: string;
    }> = [
      {
        key: 'cashier',
        screen: 'cashier',
        title: isEn ? 'Cashier & Billing (Master)' : 'الكاشير والحسابات (الأساسي)',
        subtitle: isEn
          ? 'Collect checks, manage cash drawer, and monitor active orders'
          : 'تحصيل الفواتير، حساب الدرج، ومتابعة الطلبات الجارية',
        activeShift: activeShifts.find((s) => cleanStationId(s.stationId) === 'cashier') || null,
        iconName: 'cashier',
      },
      {
        key: 'captain',
        screen: 'captain',
        title: isEn ? 'Captain & Floor Service' : 'الكابتن وخدمة الصالات',
        subtitle: isEn
          ? 'Live floor map, customer service calls, and captain ordering'
          : 'خريطة الترابيزات الحية، نداءات العملاء، ونقطة طلب الكابتن',
        activeShift: activeShifts.find((s) => cleanStationId(s.stationId) === 'captain') || null,
        iconName: 'captain',
      },
      ...effectiveStations.map((st) => {
        const scr = stationIdToScreen(st.stationId);
        const scrMeta = getScreenMetaDynamic(scr, effectiveStations);
        return {
          key: st.stationId,
          screen: scr,
          title: isEn ? scrMeta.labelEn : scrMeta.labelAr,
          subtitle: isEn
            ? 'Live preparation screen for items routed to this station'
            : 'شاشة التحضير اللحظية للأصناف المسندة لهذا القسم',
          activeShift:
            activeShifts.find((s) => cleanStationId(s.stationId) === cleanStationId(st.stationId)) ||
            null,
          iconName: st.icon,
        };
      }),
    ];
    return entries;
  }, [activeShifts, effectiveStations, isEn]);

  const formatMoney = (val: number) => `${Number(val || 0).toFixed(2).replace(/\.00$/, '')} ${currencyLabel}`;

  const handleToggleItemAvailability = async (item: MenuItem, nextAvailable: boolean) => {
    if (!isOwner && !managerPerms.canPauseItems && !managerPerms.canEditMenu) {
      setErrorMsg(
        isEn
          ? 'Pausing/resuming items is not enabled for manager accounts by the owner.'
          : 'صلاحية إيقاف وتفعيل الأصناف غير مفعّلة لحساب المدير من المالك.'
      );
      return;
    }
    setReactivatingId(item.id);
    setErrorMsg(null);
    const itemNameDisplay = loc(item.name, item.name_en);
    try {
      await toggleMenuItemAvailability(item.id, nextAvailable);
      await writeStaffAuditLog({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        eventType: 'menu_item_paused',
        actor,
        targetUid: item.id,
        targetName: item.name,
        details: nextAvailable
          ? `إعادة تفعيل صنف "${item.name}" (${formatMoney(item.basePrice)}) بالمنيو`
          : `إيقاف مؤقت لصنف "${item.name}" (${formatMoney(item.basePrice)}) لعدم توفره`,
      });
      setFeedback(
        nextAvailable
          ? isEn
            ? `Re-enabled "${itemNameDisplay}" on the public menu.`
            : `تمت إعادة تفعيل "${itemNameDisplay}" وظهوره للعملاء بالمنيو.`
          : isEn
            ? `Paused "${itemNameDisplay}" and temporarily hid it from the menu.`
            : `تم إيقاف "${itemNameDisplay}" مؤقتاً وإخفاؤه من المنيو.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Unable to update item status.'
            : 'تعذر تحديث حالة الصنف.'
      );
    } finally {
      setReactivatingId(null);
    }
  };

  const handleTransferCustody = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedback(null);
    const amountNum = Number(transferAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setErrorMsg(
        isEn
          ? 'Enter a valid amount to transfer to the owner vault.'
          : 'أدخل مبلغاً صحيحاً لتحويله للخزنة الرئيسية.'
      );
      return;
    }
    setTransferring(true);
    try {
      await transferManagerCustodyToOwnerVault({
        restaurant,
        amountCash: amountNum,
        note: transferNote,
        actor,
      });
      setTransferAmount('');
      setTransferNote('');
      setFeedback(
        isEn
          ? `Transferred ${formatMoney(amountNum)} from Manager Custody to Owner Main Vault.`
          : `تم تحويل ${formatMoney(amountNum)} من خزنة المدير إلى خزنة صاحب المطعم الرئيسية.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Unable to complete transfer.'
            : 'تعذر تنفيذ التحويل.'
      );
    } finally {
      setTransferring(false);
    }
  };

  const handleSaveOperationsConfig = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setErrorMsg(null);
    try {
      await updateRestaurantOperationsConfig({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        config: draftConfig,
        actor,
      });
      onRestaurantUpdated?.({ ...restaurant, operationsConfig: draftConfig });
      setSettingsOpen(false);
      setFeedback(
        isEn
          ? 'Shift schedule, screens, and price visibility settings saved.'
          : 'تم حفظ إعدادات الورديات والشاشات وأسعار الأقسام بنجاح.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Unable to save operational settings.'
            : 'تعذر حفظ الإعدادات.'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSlotChange = (index: number, patch: Partial<ShiftSlotConfig>) => {
    setDraftConfig((prev) => {
      const nextSlots = prev.shiftSlots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot));
      return { ...prev, shiftSlots: nextSlots };
    });
  };

  const canModifyOperations = isOwner || managerPerms.canConfigureOperations || managerPerms.canToggleScreenPrices;
  const canPauseOrEditMenu = isOwner || managerPerms.canPauseItems || managerPerms.canEditMenu;

  return (
    <div dir={dir} className="space-y-6">
      {/* Header Summary Bar */}
      <section
        className={`border p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${ui.radiusClasses.card}`}
        style={{
          backgroundColor: theme.surfaceBg,
          borderColor: theme.surfaceBorder,
          boxShadow: theme.cardShadow,
        }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 shrink-0" style={{ color: theme.accentHex }} />
            <h2 className="text-base sm:text-lg font-extrabold" style={{ color: theme.surfaceText }}>
              {isEn
                ? `Supervisory Console & Staff Monitoring — ${loc(restaurant.name, restaurant.name_en)}`
                : `لوحة الإشراف العام ومتابعة الكادر — ${loc(restaurant.name, restaurant.name_en)}`}
            </h2>
          </div>
          <p className="text-xs max-w-3xl leading-relaxed" style={{ color: theme.mutedText }}>
            {isEn
              ? 'Monitor every station and screen by the currently assigned employee. Covered screens open in supervisory mode to review, edit, or cancel with a reason; uncovered screens can be staffed immediately.'
              : 'راقب كل قسم وشاشة باسم الموظف المشغّل لها حالياً. إذا كان القسم مغطى بموظف تدخل بوضع الإشراف للمراجعة والتعديل أو إلغاء أصناف مع سبب؛ وإذا كان شاغراً يمكنك تغطيته بوردية بديلة.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            className={`min-h-[42px] px-3.5 py-2 border text-xs font-bold font-mono-num flex items-center ${ui.radiusClasses.button}`}
            style={{
              backgroundColor: theme.surfaceSubtleBg,
              borderColor: theme.surfaceBorder,
              color: theme.mutedText,
            }}
          >
            {isEn ? 'Active Shifts:' : 'الورديات النشطة:'}{' '}
            <strong className="ms-1" style={{ color: theme.surfaceText }}>{activeShifts.length}</strong>
          </div>
          {(isOwner || managerPerms.canManageHalls) && (
            <button
              type="button"
              onClick={() => onNavigateScreen('halls')}
              className={`min-h-[42px] px-4 py-2 border text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
              style={{
                backgroundColor: theme.surfaceSubtleBg,
                borderColor: theme.surfaceBorder,
                color: theme.surfaceText,
              }}
            >
              <LayoutGrid className="w-4 h-4" style={{ color: theme.highlightHex || '#E8833A' }} />
              <span>{isEn ? 'Halls & Table QR' : 'الصالات وأكواد QR'}</span>
            </button>
          )}
          {canModifyOperations && (
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className={`min-h-[42px] px-4 py-2 border text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${ui.radiusClasses.button}`}
              style={{
                backgroundColor: theme.surfaceSubtleBg,
                borderColor: theme.surfaceBorder,
                color: theme.surfaceText,
              }}
            >
              <Settings className="w-4 h-4" style={{ color: theme.accentHex }} />
              <span>{isEn ? 'Shifts & Prices Settings' : 'إعدادات الورديات والأسعار'}</span>
            </button>
          )}
        </div>
      </section>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center justify-between gap-2">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-emerald-700 underline text-[11px] cursor-pointer">
            {isEn ? 'Close' : 'إغلاق'}
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900 flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-700 underline text-[11px] cursor-pointer">
            {isEn ? 'Close' : 'إغلاق'}
          </button>
        </div>
      )}

      {/* CRITICAL PAUSED ITEMS ALERT (Never forget disabled items + show price) */}
      {canPauseOrEditMenu && (
        <section
          className={`border p-4 sm:p-5 space-y-4 ${ui.radiusClasses.card} ${
            pausedItems.length > 0 ? 'bg-amber-50/70 border-amber-300' : ''
          }`}
          style={
            pausedItems.length > 0
              ? undefined
              : {
                  backgroundColor: theme.surfaceBg,
                  borderColor: theme.surfaceBorder,
                  boxShadow: theme.cardShadow,
                }
          }
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {pausedItems.length > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
                <h3 className="text-sm font-extrabold text-zinc-950">
                  {pausedItems.length > 0
                    ? isEn
                      ? `Paused Items Alert (${pausedItems.length} hidden from menu)`
                      : `تنبيه الأصناف الموقوفة حالياً (${pausedItems.length} صنف مخفي من المنيو)`
                    : isEn
                      ? 'All menu items are currently available and active'
                      : 'كل أصناف المنيو متاحة ومفعّلة حالياً'}
                </h3>
              </div>
              <p className="text-xs text-zinc-600">
                {pausedItems.length > 0
                  ? isEn
                    ? 'Listed here with prices so out-of-stock dishes are not forgotten once ingredients are restocked.'
                    : 'تظهر هذه القائمة مع الأسعار حتى لا يُنسى أي صنف مغلق عن العملاء بعد توفر خاماته.'
                  : isEn
                    ? 'Quickly pause an unavailable item or restore it in one click using search below.'
                    : 'يمكنك إيقاف أي صنف غير متوفر مؤقتاً من البحث أدناه أو إعادة تفعيله بضغطة واحدة.'}
              </p>
            </div>

            <div className="w-full md:w-72">
              <input
                type="search"
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                placeholder={isEn ? 'Quick search to pause or resume...' : 'بحث سريع لإيقاف أو تفعيل صنف...'}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          {quickSearchItems.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
              {quickSearchItems.map((it) => {
                const catObj = categoryMap.get(it.categoryId);
                const catName = catObj ? loc(catObj.name, catObj.name_en) : '';
                const busy = reactivatingId === it.id;
                return (
                  <div
                    key={it.id}
                    className="bg-white border border-zinc-200 rounded-xl p-3 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-zinc-950 truncate">
                        {loc(it.name, it.name_en)}
                      </p>
                      <p className="text-[11px] text-zinc-500 font-mono-num truncate">
                        {formatMoney(it.basePrice)} {catName ? `· ${catName}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleItemAvailability(it, !it.isAvailable)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold shrink-0 cursor-pointer disabled:opacity-50 ${
                        it.isAvailable
                          ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {busy
                        ? '...'
                        : it.isAvailable
                          ? isEn
                            ? 'Pause'
                            : 'إيقاف مؤقت'
                          : isEn
                            ? 'Resume'
                            : 'تفعيل'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {pausedItems.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pausedItems.map((item) => {
                const catObj = categoryMap.get(item.categoryId);
                const catName = catObj ? loc(catObj.name, catObj.name_en) : isEn ? 'Item' : 'صنف';
                const busy = reactivatingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="bg-white border border-amber-300 rounded-xl p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <PauseCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <p className="text-xs sm:text-sm font-extrabold text-zinc-950 truncate">
                          {loc(item.name, item.name_en)}
                        </p>
                      </div>
                      <p className="text-xs text-zinc-600 font-mono-num">
                        {isEn ? 'Price:' : 'السعر:'}{' '}
                        <strong className="text-zinc-950">{formatMoney(item.basePrice)}</strong>
                        {' · '}
                        <span className="text-zinc-500">{catName}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleItemAvailability(item, true)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>{isEn ? 'Restore' : 'إعادة تفعيل'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Operations & Shift Schedule Settings (collapsible) */}
      {settingsOpen && canModifyOperations && (
        <form
          onSubmit={handleSaveOperationsConfig}
          className={`border p-5 space-y-5 ${ui.radiusClasses.card}`}
          style={{
            backgroundColor: theme.surfaceBg,
            borderColor: theme.surfaceBorder,
            boxShadow: theme.cardShadow,
          }}
        >
          <div className="flex items-center justify-between gap-3 border-b pb-3" style={{ borderColor: theme.surfaceBorder }}>
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4" style={{ color: theme.accentHex }} />
              <h3 className="text-sm font-extrabold" style={{ color: theme.surfaceText }}>
                {isEn
                  ? 'Shift Slots, Default Float & Screen Price Visibility'
                  : 'ضبط الورديات والعهدة الافتراضية وإظهار الأسعار للشاشات'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="text-xs font-bold cursor-pointer hover:opacity-80"
              style={{ color: theme.mutedText }}
            >
              {isEn ? 'Close' : 'إغلاق'}
            </button>
          </div>

          {(isOwner || managerPerms.canConfigureOperations) && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="space-y-1 text-xs font-bold text-zinc-800">
                  <span>
                    {isEn
                      ? `Default Cashier Opening Float (${currencyLabel})`
                      : `العهدة الافتراضية لبداية درج الكاشير (${currencyLabel})`}
                  </span>
                  <input
                    type="number"
                    dir="ltr"
                    min={0}
                    step="any"
                    value={draftConfig.defaultCashierFloat}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        defaultCashierFloat: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono-num text-sm"
                  />
                </label>

                <label className="space-y-1 text-xs font-bold text-zinc-800">
                  <span>
                    {isEn
                      ? 'Table Overdue Threshold (minutes)'
                      : 'مهلة اعتبار الترابيزة متأخرة (بالدقائق)'}
                  </span>
                  <input
                    type="number"
                    dir="ltr"
                    min={15}
                    max={720}
                    value={draftConfig.tableOverdueMinutes}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        tableOverdueMinutes: Math.max(15, Number(e.target.value) || 120),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono-num text-sm"
                  />
                </label>

                <div className="space-y-1 text-xs font-bold text-zinc-800">
                  <span>
                    {isEn ? 'Daily Shift Slots Count (1–4)' : 'عدد فترات الورديات اليومية (1–4)'}
                  </span>
                  <select
                    value={draftConfig.shiftSlots.length}
                    onChange={(e) => {
                      const count = Math.max(1, Math.min(4, Number(e.target.value) || 3));
                      setDraftConfig((prev) => {
                        const base = [...prev.shiftSlots];
                        while (base.length < count) {
                          const fallback = DEFAULT_SHIFT_SLOTS[base.length] || {
                            id: `shift_${base.length + 1}`,
                            name: `الوردية ${base.length + 1}`,
                            nameEn: `Shift ${base.length + 1}`,
                            startTime: '08:00',
                            endTime: '16:00',
                          };
                          base.push({ ...fallback, id: `shift_${base.length + 1}` });
                        }
                        return { ...prev, shiftSlots: base.slice(0, count) };
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-sm bg-white"
                  >
                    <option value={1}>{isEn ? '1 Shift' : 'وردية واحدة'}</option>
                    <option value={2}>{isEn ? '2 Shifts' : 'ورديتان'}</option>
                    <option value={3}>
                      {isEn
                        ? '3 Shifts (Morning · Evening · Night)'
                        : '3 ورديات (صباحية · مسائية · ليلية)'}
                    </option>
                    <option value={4}>{isEn ? '4 Shifts' : '4 ورديات'}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-extrabold text-zinc-800">
                  {isEn ? 'Shift Schedule:' : 'جدول مواعيد الورديات:'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {draftConfig.shiftSlots.map((slot, idx) => (
                    <div key={slot.id} className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2">
                      <input
                        type="text"
                        value={isEn ? slot.nameEn || slot.name : slot.name}
                        onChange={(e) =>
                          handleSlotChange(
                            idx,
                            isEn ? { nameEn: e.target.value } : { name: e.target.value }
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-extrabold"
                      />
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <label className="space-y-0.5">
                          <span className="text-zinc-500">{isEn ? 'From' : 'من'}</span>
                          <input
                            type="time"
                            dir="ltr"
                            value={slot.startTime}
                            onChange={(e) => handleSlotChange(idx, { startTime: e.target.value })}
                            className="w-full px-2 py-1 rounded-lg border border-zinc-300 bg-white font-mono-num"
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="text-zinc-500">{isEn ? 'To' : 'إلى'}</span>
                          <input
                            type="time"
                            dir="ltr"
                            value={slot.endTime}
                            onChange={(e) => handleSlotChange(idx, { endTime: e.target.value })}
                            className="w-full px-2 py-1 rounded-lg border border-zinc-300 bg-white font-mono-num"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {(isOwner || managerPerms.canToggleScreenPrices) && (
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <p className="text-xs font-extrabold text-zinc-800">
                {isEn
                  ? 'Show or Hide Item Prices on Screens & Tickets:'
                  : 'إظهار أو إخفاء الأسعار على الشاشات والتذاكر:'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(
                  [
                    { key: 'kitchen', labelAr: 'شاشة المطبخ', labelEn: 'Kitchen Screen' },
                    { key: 'bar', labelAr: 'شاشة البار', labelEn: 'Bar Screen' },
                    { key: 'pastry', labelAr: 'شاشة الباستري', labelEn: 'Pastry Screen' },
                    { key: 'captain', labelAr: 'شاشة الكابتن والنداءات', labelEn: 'Captain & Calls' },
                  ] as const
                ).map((entry) => (
                  <label
                    key={entry.key}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-bold cursor-pointer"
                  >
                    <span>{isEn ? entry.labelEn : entry.labelAr}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(draftConfig.showPricesByRole[entry.key])}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          showPricesByRole: {
                            ...prev.showPricesByRole,
                            [entry.key]: e.target.checked,
                          },
                        }))
                      }
                      className="w-4 h-4 accent-zinc-950"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className={`min-h-[42px] px-5 py-2 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${ui.radiusClasses.button}`}
              style={{
                backgroundColor: theme.accentHex,
                color: theme.accentTextHex,
              }}
            >
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isEn ? 'Save Operational Settings' : 'حفظ الإعدادات التشغيلية'}</span>
            </button>
          </div>
        </form>
      )}

      {/* LIVE STATION & FLOOR SUPERVISORY CONSOLE */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold flex items-center gap-2" style={{ color: theme.canvasText }}>
            <ShieldCheck className="w-4 h-4" style={{ color: theme.accentHex }} />
            <span>
              {isEn
                ? 'Live Screens, Prep Stations & Active Staff in Charge'
                : 'الشاشات والأقسام المباشرة واسم الموظف المسؤول الآن'}
            </span>
          </h3>
          <span className="text-[11px]" style={{ color: theme.mutedText }}>
            {isEn
              ? 'Supervisory entry lets you inspect, edit, or note items/tables without opening a duplicate shift'
              : 'الدخول الإشرافي يسمح بالمراقبة والتعديل وكتابة ملاحظات الصنف/الترابيزة دون فتح وردية مكررة'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {supervisoryCards.map((card) => {
            const coveredByOther = card.activeShift && card.activeShift.staffId !== actor.uid;
            const coveredByMe = card.activeShift && card.activeShift.staffId === actor.uid;
            const Icon =
              card.iconName === 'cashier'
                ? Wallet
                : card.iconName === 'captain'
                ? UserCheck
                : getStationIconComponent(card.iconName as RestaurantStation['icon']);

            return (
              <article
                key={card.key}
                className={`border p-4 sm:p-5 flex flex-col justify-between gap-4 ${ui.radiusClasses.card} ${
                  card.activeShift ? '' : 'border-amber-300 bg-amber-50/20'
                }`}
                style={
                  card.activeShift
                    ? {
                        backgroundColor: theme.surfaceBg,
                        borderColor: theme.surfaceBorder,
                        boxShadow: theme.cardShadow,
                      }
                    : { boxShadow: theme.cardShadow }
                }
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: theme.sidebarBg,
                          color: theme.highlightHex || '#E8833A',
                        }}
                      >
                        <Icon className="w-5 h-5" />
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-extrabold truncate" style={{ color: theme.surfaceText }}>
                          {card.title}
                        </h4>
                        <p className="text-[11px] truncate" style={{ color: theme.mutedText }}>
                          {card.subtitle}
                        </p>
                      </div>
                    </div>
                  </div>

                  {card.activeShift ? (
                    <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-extrabold text-emerald-950 truncate">
                          {isEn ? 'Current Staff:' : 'الموظف الحالي:'} {card.activeShift.staffName}
                        </span>
                        <span className="font-mono-num text-[11px] font-bold text-emerald-800 shrink-0">
                          {formatLiveDuration(card.activeShift.startedAt, nowMs, isEn)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-emerald-900/80 font-mono-num">
                        {card.activeShift.shiftSlotName && <span>{card.activeShift.shiftSlotName}</span>}
                        <span>
                          {isEn ? 'Orders:' : 'طلبات:'} {card.activeShift.ordersHandled || 0}
                        </span>
                        {card.activeShift.itemsMarkedReady > 0 && (
                          <span>
                            {isEn ? 'Prepared:' : 'تجهيز:'} {card.activeShift.itemsMarkedReady}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-950 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        {isEn
                          ? 'Station uncovered — no active shift logged'
                          : 'القسم شاغر حالياً — لا يوجد موظف مسجل لوردية'}
                      </span>
                    </div>
                  )}
                </div>

                {coveredByOther ? (
                  <button
                    type="button"
                    onClick={() =>
                      onNavigateScreen(card.screen, {
                        supervisory: true,
                        coveringStaffName: card.activeShift?.staffName,
                      })
                    }
                    className={`w-full min-h-[44px] px-4 py-2 text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer ${ui.radiusClasses.button}`}
                    style={{
                      backgroundColor: theme.accentHex,
                      color: theme.accentTextHex,
                    }}
                  >
                    <Eye className="w-4 h-4" style={{ color: theme.highlightHex || '#E8833A' }} />
                    <span>
                      {isEn
                        ? `Supervise ${card.activeShift?.staffName}'s Screen`
                        : `مراقبة وإشراف على شاشة ${card.activeShift?.staffName}`}
                    </span>
                  </button>
                ) : coveredByMe ? (
                  <button
                    type="button"
                    onClick={() => onNavigateScreen(card.screen, { supervisory: false })}
                    className={`w-full min-h-[44px] px-4 py-2 text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer ${ui.radiusClasses.button}`}
                    style={{
                      backgroundColor: theme.highlightHex || '#E8833A',
                      color: '#FFFFFF',
                    }}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span>
                      {isEn ? 'Return to My Coverage Shift Here' : 'العودة لورديتي البديلة في هذا القسم'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigateScreen(card.screen, { supervisory: false })}
                    className={`w-full min-h-[44px] px-4 py-2 border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer ${ui.radiusClasses.button}`}
                  >
                    <Play className="w-4 h-4" />
                    <span>
                      {isEn
                        ? 'Enter & Start Coverage Shift (Uncovered)'
                        : 'دخول وبدء وردية بديلة (القسم شاغر)'}
                    </span>
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* MANAGER CUSTODY VAULT CARD */}
      <section
        className={`border p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start ${ui.radiusClasses.card}`}
        style={{
          backgroundColor: theme.surfaceBg,
          borderColor: theme.surfaceBorder,
          boxShadow: theme.cardShadow,
        }}
      >
        <div className="lg:col-span-5 space-y-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5" style={{ color: theme.accentHex }} />
            <h3 className="text-sm font-extrabold" style={{ color: theme.surfaceText }}>
              {isEn ? 'Manager Cash Custody Vault' : 'خزنة وعهدة المدير'}
            </h3>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: theme.mutedText }}>
            {isEn
              ? 'Cash handed over by cashiers at shift end accumulates here until transferred to the owner vault or carried over to the next cashier shift.'
              : 'المبالغ الكاش التي يسلمها الكاشير للمدير عند انتهاء الوردية تتجمع هنا حتى تسليمها لصاحب المطعم أو ترحيلها لكاشير الوردية التالية.'}
          </p>
          <div
            className="p-4 rounded-xl border flex items-center justify-between"
            style={{ backgroundColor: theme.surfaceSubtleBg, borderColor: theme.surfaceBorder }}
          >
            <span className="text-xs font-bold" style={{ color: theme.mutedText }}>
              {isEn ? 'Cash Balance in Manager Custody' : 'الرصيد الكاش في عهدة المدير'}
            </span>
            <span className="text-xl font-extrabold font-mono-num" dir="ltr" style={{ color: theme.surfaceText }}>
              {formatMoney(treasury.managerCustodyBalance)}
            </span>
          </div>
        </div>

        <form
          onSubmit={handleTransferCustody}
          className="lg:col-span-7 space-y-3 border rounded-xl p-4"
          style={{ backgroundColor: theme.surfaceSubtleBg, borderColor: theme.surfaceBorder }}
        >
          <p className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: theme.surfaceText }}>
            <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
            <span>
              {isEn
                ? 'Transfer Cash to Owner Main Safe Vault'
                : 'توريد / تسليم نقدية إلى الخزنة الرئيسية لصاحب المطعم'}
            </span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="number"
              dir="ltr"
              min={1}
              max={Math.max(1, treasury.managerCustodyBalance)}
              step="any"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder={isEn ? `Amount (${currencyLabel})` : `المبلغ (${currencyLabel})`}
              className="w-full px-3 py-2 rounded-xl border text-xs font-mono-num font-bold"
              style={{
                backgroundColor: theme.surfaceBg,
                borderColor: theme.surfaceBorder,
                color: theme.surfaceText,
              }}
            />
            <input
              type="text"
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder={isEn ? 'Handover note (optional)' : 'ملاحظة التسليم (اختياري)'}
              className="w-full px-3 py-2 rounded-xl border text-xs"
              style={{
                backgroundColor: theme.surfaceBg,
                borderColor: theme.surfaceBorder,
                color: theme.surfaceText,
              }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={treasury.managerCustodyBalance <= 0}
              onClick={() => setTransferAmount(String(treasury.managerCustodyBalance))}
              className="text-[11px] font-bold underline cursor-pointer disabled:opacity-40"
              style={{ color: theme.accentHex }}
            >
              {isEn
                ? `Select full custody (${formatMoney(treasury.managerCustodyBalance)})`
                : `تحديد كامل العهدة (${formatMoney(treasury.managerCustodyBalance)})`}
            </button>
            <button
              type="submit"
              disabled={transferring || treasury.managerCustodyBalance <= 0}
              className={`min-h-[42px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${ui.radiusClasses.button}`}
            >
              {transferring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Utensils className="w-3.5 h-3.5" />}
              <span>{isEn ? 'Transfer to Owner Vault' : 'توريد للخزنة الرئيسية'}</span>
            </button>
          </div>
          {treasuryTransfers.length > 0 && (
            <div className="pt-2 border-t space-y-1 max-h-28 overflow-y-auto" style={{ borderColor: theme.surfaceBorder }}>
              {treasuryTransfers.slice(0, 4).map((tr) => (
                <div key={tr.id} className="flex items-center justify-between text-[11px]" style={{ color: theme.mutedText }}>
                  <span className="truncate">
                    {tr.fromName} → {tr.toName}
                  </span>
                  <span className="font-mono-num font-bold shrink-0" dir="ltr" style={{ color: theme.surfaceText }}>
                    {formatMoney(tr.amountCash)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
