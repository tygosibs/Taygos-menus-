import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Printer,
  Square,
} from 'lucide-react';
import {
  Restaurant,
  StaffMember,
  StaffScreen,
  StaffShift,
} from '../../types/menu';
import { endStaffShift, startStaffShift } from '../../lib/shiftsService';
import {
  registerStaffDeviceAndFcm,
  syncDeviceShiftTopics,
} from '../../lib/fcmNotificationService';
import { StationMeta } from '../../lib/stationUtils';

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
}) => {
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [warningMsg, setWarningMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  const shiftKey = stationId || activeScreen;

  const activeShiftForScreen = useMemo(
    () => myActiveShifts.find((sh) => sh.stationId === shiftKey) || null,
    [myActiveShifts, shiftKey]
  );

  useEffect(() => {
    if (!activeShiftForScreen) return;
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [activeShiftForScreen]);

  const syncTopicsAfterShiftChange = async (nextActiveStationIds: string[]) => {
    await syncDeviceShiftTopics({
      restaurantId: restaurant.id,
      activeStations: nextActiveStationIds,
    });
  };

  const handleStartShift = async () => {
    setBusy(true);
    setErrorMsg('');
    setWarningMsg('');
    try {
      await startStaffShift({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        staffId: staff.uid,
        staffName: staff.name,
        staffRole: staff.role,
        stationId: shiftKey,
        stationName: screenLabel,
        hallId: staff.hallId,
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

  return (
    <div className="space-y-2" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 shadow-xs">
        {/* Left: Shift Status & Start/End CTA */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeShiftForScreen ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                ورديتك نشطة الآن ({screenLabel})
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
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-extrabold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                إنهاء ورديتي
              </button>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
                لم تبدأ ورديتك على "{screenLabel}" بعد
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={handleStartShift}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-extrabold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                بدء ورديتي
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
              className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-extrabold text-amber-900 hover:bg-amber-100"
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-[11px] font-extrabold text-zinc-800 hover:bg-zinc-50"
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
    </div>
  );
};
