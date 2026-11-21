import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  Crown,
  Loader2,
  Play,
  Printer,
  Square,
  Wallet,
  X,
} from 'lucide-react';
import {
  extendActiveShiftDuration,
  getCurrentShiftSlot,
  getNextShiftSlot,
  getResolvedOperationsConfig,
  getResolvedTreasuryState,
  getShiftSlotRemainingMinutes,
  startCashierShiftWithCarryover,
} from '../../lib/operationsService';
import { endStaffShift, startStaffShift } from '../../lib/shiftsService';
import {
  registerStaffDeviceAndFcm,
  syncDeviceShiftTopics,
} from '../../lib/fcmNotificationService';
import { StationMeta } from '../../lib/stationUtils';
import {
  Restaurant,
  StaffActorInfo,
  StaffMember,
  StaffScreen,
  StaffShift,
} from '../../types/menu';

interface StaffShiftBarProps {
  restaurant: Restaurant;
  staff: StaffMember;
  activeScreen: StaffScreen;
  screenLabel: string;
  stationId?: string;
  allStations: StationMeta[];
  myActiveShifts: StaffShift[];
  onOpenPrinterSettings: () => void;
  printerLabel?: string;
  supervisoryMode?: boolean;
  coveringStaffName?: string;
  lastClosedCashierShift?: StaffShift | null;
  onRequestCashierHandoverModal?: () => void;
  onSwitchCashierNextSlot?: () => void;
}

function formatDuration(startedAt: unknown, nowMs: number): string {
  let startMs = nowMs;
  if (startedAt && typeof startedAt === 'object' && 'seconds' in startedAt) {
    startMs = Number((startedAt as { seconds: number }).seconds) * 1000;
  } else if (startedAt instanceof Date) {
    startMs = startedAt.getTime();
  }
  const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const StaffShiftBar: React.FC<StaffShiftBarProps> = ({
  restaurant,
  staff,
  activeScreen,
  screenLabel,
  stationId,
  myActiveShifts,
  onOpenPrinterSettings,
  printerLabel,
  supervisoryMode = false,
  coveringStaffName,
  lastClosedCashierShift,
  onRequestCashierHandoverModal,
  onSwitchCashierNextSlot,
}) => {
  const opsConfig = useMemo(() => getResolvedOperationsConfig(restaurant), [restaurant]);
  const treasury = useMemo(() => getResolvedTreasuryState(restaurant), [restaurant]);

  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [warningMsg, setWarningMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [softBannerDismissed, setSoftBannerDismissed] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  // Cashier Shift Start Modal State
  const [cashierModalOpen, setCashierModalOpen] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string>(
    () => getCurrentShiftSlot(opsConfig).id
  );
  const [openingFloatInput, setOpeningFloatInput] = useState<number>(
    () => opsConfig.defaultCashierFloat || 0
  );
  const [carryoverSource, setCarryoverSource] = useState<'none' | 'previous_shift' | 'manager_custody'>(
    () =>
      lastClosedCashierShift && (lastClosedCashierShift.expectedCashHandover || 0) > 0
        ? 'previous_shift'
        : 'none'
  );
  const [customCarryoverAmount, setCustomCarryoverAmount] = useState<number>(0);

  const shiftKey = stationId || activeScreen;
  const isCashierScreen = shiftKey === 'cashier';

  const activeShiftForScreen = useMemo(
    () => myActiveShifts.find((sh) => sh.stationId === shiftKey) || null,
    [myActiveShifts, shiftKey]
  );

  useEffect(() => {
    if (!activeShiftForScreen) return;
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [activeShiftForScreen]);

  useEffect(() => {
    setSoftBannerDismissed(false);
  }, [activeShiftForScreen?.id, activeShiftForScreen?.extendedHours]);

  const activeSlotObj = useMemo(() => {
    if (!activeShiftForScreen) return getCurrentShiftSlot(opsConfig);
    return (
      opsConfig.shiftSlots.find((s) => s.id === activeShiftForScreen.shiftSlotId) ||
      getCurrentShiftSlot(opsConfig)
    );
  }, [activeShiftForScreen, opsConfig]);

  const remainingMinutes = useMemo(() => {
    if (!activeShiftForScreen) return 999;
    return getShiftSlotRemainingMinutes(
      activeSlotObj,
      activeShiftForScreen.extendedHours || 0,
      new Date(nowMs)
    );
  }, [activeShiftForScreen, activeSlotObj, nowMs]);

  const showSoftShiftEndBanner = Boolean(
    activeShiftForScreen && !softBannerDismissed && remainingMinutes <= 0
  );

  const syncTopicsAfterShiftChange = async (nextActiveStationIds: string[]) => {
    await syncDeviceShiftTopics({
      restaurantId: restaurant.id,
      activeStations: nextActiveStationIds,
    });
  };

  const handleOpenCashierStartModal = () => {
    setSelectedSlotId(getCurrentShiftSlot(opsConfig).id);
    setOpeningFloatInput(opsConfig.defaultCashierFloat || 0);
    if (lastClosedCashierShift && (lastClosedCashierShift.expectedCashHandover || 0) > 0) {
      setCarryoverSource('previous_shift');
      setCustomCarryoverAmount(Number(lastClosedCashierShift.expectedCashHandover || 0));
    } else if (treasury.managerCustodyBalance > 0) {
      setCarryoverSource('manager_custody');
      setCustomCarryoverAmount(treasury.managerCustodyBalance);
    } else {
      setCarryoverSource('none');
      setCustomCarryoverAmount(0);
    }
    setErrorMsg('');
    setCashierModalOpen(true);
  };

  const handleStartCashierShiftConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    setWarningMsg('');
    try {
      const slot =
        opsConfig.shiftSlots.find((s) => s.id === selectedSlotId) || getCurrentShiftSlot(opsConfig);
      const actor: StaffActorInfo = {
        uid: staff.uid,
        name: staff.name,
        role: staff.role,
      };
      const carriedOverCash =
        carryoverSource === 'none' ? 0 : Math.max(0, Number(customCarryoverAmount || 0));
      const takeFromCustody =
        carryoverSource === 'manager_custody' ? carriedOverCash : 0;

      await startCashierShiftWithCarryover({
        restaurant,
        actor,
        shiftSlot: slot,
        openingFloat: Math.max(0, Number(openingFloatInput || 0)),
        carriedOverCash,
        carriedFromShiftId:
          carryoverSource === 'previous_shift' ? lastClosedCashierShift?.id : undefined,
        takeFromManagerCustody: takeFromCustody,
      });

      const updatedStations = Array.from(
        new Set([...myActiveShifts.map((s) => s.stationId), shiftKey])
      );
      await syncTopicsAfterShiftChange(updatedStations);
      setCashierModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر بدء وردية الكاشير.');
    } finally {
      setBusy(false);
    }
  };

  const handleStartShift = async () => {
    if (isCashierScreen) {
      handleOpenCashierStartModal();
      return;
    }
    setBusy(true);
    setErrorMsg('');
    setWarningMsg('');
    try {
      const slot = getCurrentShiftSlot(opsConfig);
      await startStaffShift({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        staffId: staff.uid,
        staffName: staff.name,
        staffRole: staff.role,
        stationId: shiftKey,
        stationName: screenLabel,
        hallId: staff.hallId,
        shiftSlotId: slot.id,
        shiftSlotName: slot.name,
      });
      const updatedStations = Array.from(
        new Set([...myActiveShifts.map((s) => s.stationId), shiftKey])
      );
      await syncTopicsAfterShiftChange(updatedStations);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر بدء الوردية.');
    } finally {
      setBusy(false);
    }
  };

  const handleEndShift = async () => {
    if (!activeShiftForScreen) return;
    if (isCashierScreen && onRequestCashierHandoverModal) {
      onRequestCashierHandoverModal();
      return;
    }
    setBusy(true);
    setErrorMsg('');
    setWarningMsg('');
    try {
      const res = await endStaffShift({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        shift: activeShiftForScreen,
        staffRole: staff.role,
      });
      const remainingStations = myActiveShifts
        .filter((s) => s.id !== activeShiftForScreen.id)
        .map((s) => s.stationId);
      await syncTopicsAfterShiftChange(remainingStations);
      if (res.stationNowUncovered && res.uncoveredWarning) {
        setWarningMsg(res.uncoveredWarning);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إنهاء الوردية.');
    } finally {
      setBusy(false);
    }
  };

  const handleExtendShift = async () => {
    if (!activeShiftForScreen) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await extendActiveShiftDuration({
        restaurantId: restaurant.id,
        shift: activeShiftForScreen,
        extraHours: 1,
      });
      setSoftBannerDismissed(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر تمديد الوردية.');
    } finally {
      setBusy(false);
    }
  };

  const handleEnableNotifications = async () => {
    const activeStations = myActiveShifts.map((s) => s.stationId);
    const res = await registerStaffDeviceAndFcm({
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      staffId: staff.uid,
      staffName: staff.name,
      activeStations: activeStations.length > 0 ? activeStations : [shiftKey],
      requestPermissionNow: true,
    });
    setNotifPerm(res.permission);
  };

  const isBlockedSupervisory = Boolean(supervisoryMode && coveringStaffName && !activeShiftForScreen);

  return (
    <div className="space-y-2" dir="rtl">
      {isBlockedSupervisory && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-300 bg-indigo-950 text-white px-4 py-2.5 text-xs shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Crown className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-extrabold">
              وضع الإشراف المباشر — القسم مغطى حالياً بواسطة الموظف:{' '}
              <strong className="text-amber-300">{coveringStaffName}</strong>
            </span>
          </div>
          <span className="text-[11px] text-indigo-200 font-semibold">
            يُفتح هذا القسم للمراجعة والإدارة دون الحاجة لبدء وردية جديدة بدلاً عن الموظف المداوم.
          </span>
        </div>
      )}

      {showSoftShiftEndBanner && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-xs text-amber-950 shadow-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="font-extrabold">
              انتهى الموعد الرسمي لوردية "{activeSlotObj.name}" ({activeSlotObj.endTime}) — يمكنك الاستمرار بساعة إضافية، الانتقال لـ "{getNextShiftSlot(opsConfig, activeSlotObj.id).name}"، أو تسليم الدرج.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={busy}
              onClick={handleExtendShift}
              className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-extrabold cursor-pointer disabled:opacity-50"
            >
              تكملة (+1 ساعة)
            </button>
            {isCashierScreen && onSwitchCashierNextSlot && (
              <button
                type="button"
                disabled={busy}
                onClick={onSwitchCashierNextSlot}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span>تطبيق للوردية التالية</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={handleEndShift}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold cursor-pointer disabled:opacity-50"
            >
              {isCashierScreen ? 'تسليم وإنهاء الوردية' : 'إنهاء ورديتي'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 shadow-xs">
        {/* Left: Shift Status & Start/End CTA */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeShiftForScreen ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  ورديتك نشطة ({screenLabel}
                  {activeShiftForScreen.shiftSlotName ? ` · ${activeShiftForScreen.shiftSlotName}` : ''})
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-xl bg-zinc-100 px-2.5 py-1.5 font-mono text-xs font-bold text-zinc-700">
                <Clock className="h-3.5 w-3.5 text-zinc-500" />
                {formatDuration(activeShiftForScreen.startedAt, nowMs)}
              </span>
              {(activeShiftForScreen.ordersHandled > 0 ||
                activeShiftForScreen.itemsMarkedReady > 0 ||
                activeShiftForScreen.serviceCallsHandled > 0) && (
                <span className="hidden sm:inline-flex items-center gap-2 text-[11px] font-bold text-zinc-600">
                  {activeShiftForScreen.itemsMarkedReady > 0 && (
                    <span>تجهيز: {activeShiftForScreen.itemsMarkedReady}</span>
                  )}
                  {activeShiftForScreen.ordersHandled > 0 && (
                    <span>طلبات: {activeShiftForScreen.ordersHandled}</span>
                  )}
                  {activeShiftForScreen.serviceCallsHandled > 0 && (
                    <span>نداءات: {activeShiftForScreen.serviceCallsHandled}</span>
                  )}
                </span>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={handleEndShift}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-extrabold text-red-700 transition hover:bg-red-100 disabled:opacity-50 cursor-pointer"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                <span>{isCashierScreen ? 'تسليم الدرج وإنهاء الوردية' : 'إنهاء ورديتي'}</span>
              </button>
            </>
          ) : isBlockedSupervisory ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-900">
              معاينة إشرافية (شاشة {coveringStaffName})
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
                لم تبدأ ورديتك على "{screenLabel}" بعد
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={handleStartShift}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-extrabold text-white transition hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                <span>{isCashierScreen ? 'فتح درج وبدء وردية الكاشير' : 'بدء ورديتي'}</span>
              </button>
            </>
          )}
        </div>

        {/* Right: Notifications & Thermal Printer */}
        <div className="flex flex-wrap items-center gap-2">
          {notifPerm === 'granted' ? (
            <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              الإشعارات اللحظية مفعلة
            </span>
          ) : notifPerm === 'default' ? (
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-extrabold text-amber-900 hover:bg-amber-100 cursor-pointer"
            >
              <Bell className="h-3.5 w-3.5" />
              تفعيل إشعارات الخلفية
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[11px] font-bold text-zinc-500">
              <BellOff className="h-3.5 w-3.5" />
              الإشعارات مغلقة بالمتصفح
            </span>
          )}

          <button
            type="button"
            onClick={onOpenPrinterSettings}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-[11px] font-extrabold text-zinc-800 hover:bg-zinc-50 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>{printerLabel || 'طابعة حرارية'}</span>
          </button>
        </div>
      </div>

      {warningMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-extrabold text-amber-950">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>تنبيه تغطية القسم: {warningMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-800">
          {errorMsg}
        </div>
      )}

      {/* Cashier Shift Start & Carryover / Float Modal */}
      {cashierModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => !busy && setCashierModalOpen(false)}
        >
          <form
            onSubmit={handleStartCashierShiftConfirm}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-zinc-200 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto"
          >
            <div className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-zinc-950 text-amber-400 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-zinc-950">
                    فتح درج الكاشير وبدء الوردية
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    اختر فترة الوردية وحدد العهدة الافتتاحية وأي كاش مرحّل بالدرج
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCashierModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="block space-y-1 text-xs font-bold text-zinc-800">
              <span>فترة الوردية:</span>
              <select
                value={selectedSlotId}
                onChange={(e) => setSelectedSlotId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm bg-white font-bold"
              >
                {opsConfig.shiftSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.name} ({slot.startTime} – {slot.endTime})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-xs font-bold text-zinc-800">
              <span>العهدة الافتتاحية (فكّة بداية الدرج) — {restaurant.currency}</span>
              <input
                type="number"
                min={0}
                step="0.5"
                value={openingFloatInput}
                onChange={(e) => setOpeningFloatInput(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm font-mono-num font-extrabold"
              />
            </label>

            <div className="space-y-2 p-3 rounded-2xl bg-zinc-50 border border-zinc-200">
              <span className="text-xs font-extrabold text-zinc-800 block">
                استلام رصيد مرحّل بالدرج (اختياري):
              </span>
              <div className="space-y-1.5 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="carrySource"
                    checked={carryoverSource === 'none'}
                    onChange={() => {
                      setCarryoverSource('none');
                      setCustomCarryoverAmount(0);
                    }}
                  />
                  <span>درج فارغ بدون ترحيل كاش سابق</span>
                </label>

                {lastClosedCashierShift && (lastClosedCashierShift.expectedCashHandover || 0) > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="carrySource"
                      checked={carryoverSource === 'previous_shift'}
                      onChange={() => {
                        setCarryoverSource('previous_shift');
                        setCustomCarryoverAmount(
                          Number(lastClosedCashierShift.expectedCashHandover || 0)
                        );
                      }}
                    />
                    <span>
                      استلام المتبقي من وردية ({lastClosedCashierShift.staffName}):{' '}
                      <strong className="font-mono-num">
                        {lastClosedCashierShift.expectedCashHandover} {restaurant.currency}
                      </strong>
                    </span>
                  </label>
                )}

                {treasury.managerCustodyBalance > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="carrySource"
                      checked={carryoverSource === 'manager_custody'}
                      onChange={() => {
                        setCarryoverSource('manager_custody');
                        setCustomCarryoverAmount(treasury.managerCustodyBalance);
                      }}
                    />
                    <span>
                      صرف من عهدة المدير الحالية ({treasury.managerCustodyBalance}{' '}
                      {restaurant.currency})
                    </span>
                  </label>
                )}
              </div>

              {carryoverSource !== 'none' && (
                <label className="block space-y-1 text-[11px] font-bold text-zinc-700 pt-1">
                  <span>المبلغ المستلم بالدرج ({restaurant.currency}):</span>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={customCarryoverAmount}
                    onChange={(e) => setCustomCarryoverAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono-num font-extrabold bg-white"
                  />
                </label>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>تأكيد فتح الدرج وبدء العمل</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCashierModalOpen(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
