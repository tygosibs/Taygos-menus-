import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  Home,
  LayoutGrid,
  Loader2,
  MapPin,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getHallTableNumbers, subscribeHalls } from '../../lib/firestoreService';
import {
  clearShiftHallAssignments,
  copyShiftHallAssignments,
  saveShiftCaptainAssignments,
  SaveCaptainShiftInput,
  subscribeHallAssignments,
} from '../../lib/hallAssignmentsService';
import { getCurrentShiftSlot, getResolvedOperationsConfig } from '../../lib/operationsService';
import { subscribeAllActiveRestaurantShifts } from '../../lib/shiftsService';
import { subscribeRestaurantStaff } from '../../lib/staffService';
import { buildEffectiveCaptainScreens, StationMeta } from '../../lib/stationUtils';
import { subscribeRestaurantStations } from '../../lib/stationsService';
import {
  Hall,
  HallCaptainAssignment,
  Restaurant,
  RestaurantStation,
  StaffActorInfo,
  StaffMember,
  StaffShift,
} from '../../types/menu';

interface CaptainAssignmentsTabProps {
  restaurant: Restaurant;
  actor: StaffActorInfo;
  halls?: Hall[];
  staffMembers?: StaffMember[];
  activeShifts?: StaffShift[];
  captainStations?: StationMeta[];
  onBack?: () => void;
  onGoHome?: () => void;
  canEdit?: boolean;
}

interface DraftCaptainAssignment {
  hallIds: string[];
  tableNumbersByHall: Record<string, string[]>;
}

export function CaptainAssignmentsTab({
  restaurant,
  actor,
  halls: externalHalls,
  staffMembers: externalStaff,
  activeShifts: externalShifts,
  captainStations: externalCaptainStations,
  onBack,
  onGoHome,
  canEdit = true,
}: CaptainAssignmentsTabProps) {
  const { lang, dir } = useLanguage();
  const isEn = lang === 'en';
  const BackArrow = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const opsConfig = useMemo(() => getResolvedOperationsConfig(restaurant), [restaurant]);
  const shiftSlots = opsConfig.shiftSlots;
  const currentAutoSlot = useMemo(() => getCurrentShiftSlot(opsConfig), [opsConfig]);

  const [selectedShiftId, setSelectedShiftId] = useState<string>(() => currentAutoSlot.id);
  const [localHalls, setLocalHalls] = useState<Hall[]>([]);
  const [localStaff, setLocalStaff] = useState<StaffMember[]>([]);
  const [localShifts, setLocalShifts] = useState<StaffShift[]>([]);
  const [rawStations, setRawStations] = useState<RestaurantStation[]>([]);
  const [allAssignments, setAllAssignments] = useState<HallCaptainAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [draftsByCaptain, setDraftsByCaptain] = useState<Record<string, DraftCaptainAssignment>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!shiftSlots.some((s) => s.id === selectedShiftId) && shiftSlots[0]) {
      setSelectedShiftId(shiftSlots[0].id);
    }
  }, [shiftSlots, selectedShiftId]);

  useEffect(() => {
    if (externalHalls) return;
    return subscribeHalls(restaurant.id, setLocalHalls);
  }, [restaurant.id, externalHalls]);

  useEffect(() => {
    if (externalStaff) return;
    return subscribeRestaurantStaff(restaurant.id, setLocalStaff);
  }, [restaurant.id, externalStaff]);

  useEffect(() => {
    if (externalShifts) return;
    return subscribeAllActiveRestaurantShifts(restaurant.id, setLocalShifts);
  }, [restaurant.id, externalShifts]);

  useEffect(() => {
    if (externalCaptainStations) return;
    return subscribeRestaurantStations(restaurant.id, setRawStations);
  }, [restaurant.id, externalCaptainStations]);

  useEffect(() => {
    setLoading(true);
    return subscribeHallAssignments(
      restaurant.id,
      (items) => {
        setAllAssignments(items);
        setLoading(false);
      },
      (err) => {
        setFeedback({ type: 'err', text: err.message });
        setLoading(false);
      }
    );
  }, [restaurant.id]);

  const halls = externalHalls ?? localHalls;
  const staffMembers = externalStaff ?? localStaff;
  const activeShifts = externalShifts ?? localShifts;
  const captainStations = useMemo(
    () => externalCaptainStations ?? buildEffectiveCaptainScreens(rawStations),
    [externalCaptainStations, rawStations]
  );

  const selectedSlot = useMemo(
    () => shiftSlots.find((s) => s.id === selectedShiftId) || shiftSlots[0] || currentAutoSlot,
    [shiftSlots, selectedShiftId, currentAutoSlot]
  );

  const previousSlot = useMemo(() => {
    const idx = shiftSlots.findIndex((s) => s.id === selectedSlot.id);
    if (idx <= 0) return shiftSlots[shiftSlots.length - 1] || selectedSlot;
    return shiftSlots[idx - 1];
  }, [shiftSlots, selectedSlot]);

  const captains = useMemo(
    () =>
      staffMembers
        .filter((m) => m.role !== 'hall_manager' && (m.role === 'captain' || m.allowedScreens.includes('captain')))
        .sort((a, b) => {
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
    [staffMembers]
  );

  const assignmentsForShift = useMemo(
    () => allAssignments.filter((a) => a.shiftSlotId === selectedSlot.id),
    [allAssignments, selectedSlot.id]
  );

  const assignmentsForPreviousShift = useMemo(
    () =>
      allAssignments.filter(
        (a) => a.shiftSlotId === previousSlot.id && Array.isArray(a.hallIds) && a.hallIds.length > 0
      ),
    [allAssignments, previousSlot.id]
  );

  // Sync draft state from Firestore whenever selected shift or remote assignments change (unless user has pending unsaved edits)
  useEffect(() => {
    if (hasUnsavedChanges) return;
    const next: Record<string, DraftCaptainAssignment> = {};
    assignmentsForShift.forEach((a) => {
      next[a.captainUid] = {
        hallIds: Array.isArray(a.hallIds) ? [...a.hallIds] : [],
        tableNumbersByHall: a.tableNumbersByHall
          ? Object.fromEntries(
              Object.entries(a.tableNumbersByHall).map(([hid, tbls]) => [
                hid,
                Array.isArray(tbls) ? [...tbls] : [],
              ])
            )
          : {},
      };
    });
    setDraftsByCaptain(next);
  }, [assignmentsForShift, hasUnsavedChanges]);

  const handleShiftSwitch = (slotId: string) => {
    setSelectedShiftId(slotId);
    setHasUnsavedChanges(false);
    setConfirmClear(false);
    setFeedback(null);
  };

  const activeShiftByCaptainUid = useMemo(() => {
    const map = new Map<string, StaffShift>();
    activeShifts.forEach((sh) => {
      if (sh.status === 'active') {
        map.set(sh.staffId, sh);
      }
    });
    return map;
  }, [activeShifts]);

  const hallById = useMemo(() => {
    const map = new Map<string, Hall>();
    halls.forEach((h) => map.set(h.id, h));
    return map;
  }, [halls]);

  const getDraft = (captainUid: string): DraftCaptainAssignment =>
    draftsByCaptain[captainUid] || { hallIds: [], tableNumbersByHall: {} };

  const toggleCaptainHall = (captainUid: string, hallId: string) => {
    if (!canEdit) return;
    setHasUnsavedChanges(true);
    setFeedback(null);
    setDraftsByCaptain((prev) => {
      const current = prev[captainUid] || { hallIds: [], tableNumbersByHall: {} };
      const exists = current.hallIds.includes(hallId);
      const nextHallIds = exists
        ? current.hallIds.filter((id) => id !== hallId)
        : [...current.hallIds, hallId];
      const nextTables = { ...current.tableNumbersByHall };
      if (exists) {
        delete nextTables[hallId];
      }
      return {
        ...prev,
        [captainUid]: {
          hallIds: nextHallIds,
          tableNumbersByHall: nextTables,
        },
      };
    });
  };

  const toggleAllTablesForHall = (captainUid: string, hallId: string) => {
    if (!canEdit) return;
    setHasUnsavedChanges(true);
    setFeedback(null);
    setDraftsByCaptain((prev) => {
      const current = prev[captainUid] || { hallIds: [], tableNumbersByHall: {} };
      const nextHallIds = current.hallIds.includes(hallId)
        ? current.hallIds
        : [...current.hallIds, hallId];
      const nextTables = { ...current.tableNumbersByHall };
      delete nextTables[hallId]; // empty means whole hall
      return {
        ...prev,
        [captainUid]: {
          hallIds: nextHallIds,
          tableNumbersByHall: nextTables,
        },
      };
    });
  };

  const toggleSpecificTable = (captainUid: string, hallId: string, tableNumber: string) => {
    if (!canEdit) return;
    setHasUnsavedChanges(true);
    setFeedback(null);
    setDraftsByCaptain((prev) => {
      const current = prev[captainUid] || { hallIds: [], tableNumbersByHall: {} };
      const nextHallIds = current.hallIds.includes(hallId)
        ? current.hallIds
        : [...current.hallIds, hallId];
      const existingList = current.tableNumbersByHall[hallId] || [];
      const nextList = existingList.includes(tableNumber)
        ? existingList.filter((t) => t !== tableNumber)
        : [...existingList, tableNumber];
      const nextTables = { ...current.tableNumbersByHall };
      if (nextList.length === 0) {
        delete nextTables[hallId];
      } else {
        nextTables[hallId] = nextList;
      }
      return {
        ...prev,
        [captainUid]: {
          hallIds: nextHallIds,
          tableNumbersByHall: nextTables,
        },
      };
    });
  };

  // Compute live coverage & uncovered halls/tables summary from current draft state
  const coverageSummary = useMemo(() => {
    const hallCoveredFull = new Set<string>();
    const hallCoveredTables = new Map<string, Set<string>>();
    let assignedCaptainsCount = 0;

    captains.forEach((cap) => {
      const draft = draftsByCaptain[cap.uid];
      if (!draft || draft.hallIds.length === 0) return;
      assignedCaptainsCount += 1;
      draft.hallIds.forEach((hid) => {
        const specific = draft.tableNumbersByHall[hid] || [];
        if (specific.length === 0) {
          hallCoveredFull.add(hid);
        } else {
          const set = hallCoveredTables.get(hid) || new Set<string>();
          specific.forEach((t) => set.add(t));
          hallCoveredTables.set(hid, set);
        }
      });
    });

    const uncoveredHalls: Hall[] = [];
    const partiallyCoveredHalls: Array<{ hall: Hall; missingTables: string[] }> = [];

    halls.forEach((hall) => {
      if (hallCoveredFull.has(hall.id)) return;
      const coveredTbls = hallCoveredTables.get(hall.id);
      if (!coveredTbls || coveredTbls.size === 0) {
        uncoveredHalls.push(hall);
        return;
      }
      const allTbls = getHallTableNumbers(hall);
      const missing = allTbls.filter((t) => !coveredTbls.has(t));
      if (missing.length > 0) {
        partiallyCoveredHalls.push({ hall, missingTables: missing });
      }
    });

    return {
      assignedCaptainsCount,
      uncoveredHalls,
      partiallyCoveredHalls,
    };
  }, [captains, draftsByCaptain, halls]);

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    setFeedback(null);
    try {
      const entries: SaveCaptainShiftInput[] = captains.map((cap) => {
        const draft = getDraft(cap.uid);
        const hallNames = draft.hallIds
          .map((hid) => hallById.get(hid)?.name || '')
          .filter(Boolean);
        const flatTables = Array.from(
          new Set(Object.values(draft.tableNumbersByHall).flat().filter(Boolean))
        );
        return {
          captainUid: cap.uid,
          captainName: cap.name,
          hallIds: draft.hallIds,
          hallNames,
          tableNumbersByHall: draft.tableNumbersByHall,
          tableNumbers: flatTables,
        };
      });

      await saveShiftCaptainAssignments({
        restaurant,
        actor,
        shiftSlotId: selectedSlot.id,
        shiftSlotName: isEn ? selectedSlot.nameEn || selectedSlot.name : selectedSlot.name,
        captainAssignments: entries,
        existingAssignmentsForShift: assignmentsForShift,
      });

      setHasUnsavedChanges(false);
      setFeedback({
        type: 'ok',
        text: isEn
          ? `Saved captain assignments for "${selectedSlot.nameEn || selectedSlot.name}" shift.`
          : `تم حفظ توزيع الكباتن لوردية "${selectedSlot.name}" بنجاح.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : isEn ? 'Failed to save assignments' : 'تعذر حفظ التوزيع',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPreviousShift = async () => {
    if (!canEdit || previousSlot.id === selectedSlot.id || assignmentsForPreviousShift.length === 0) return;
    setCopying(true);
    setFeedback(null);
    try {
      const count = await copyShiftHallAssignments({
        restaurant,
        actor,
        sourceShiftSlotId: previousSlot.id,
        sourceShiftSlotName: isEn ? previousSlot.nameEn || previousSlot.name : previousSlot.name,
        targetShiftSlotId: selectedSlot.id,
        targetShiftSlotName: isEn ? selectedSlot.nameEn || selectedSlot.name : selectedSlot.name,
        allAssignments,
      });
      setHasUnsavedChanges(false);
      setFeedback({
        type: 'ok',
        text: isEn
          ? `Copied ${count} captain assignments from "${previousSlot.nameEn || previousSlot.name}" shift.`
          : `تم نسخ توزيع ${count} كابتن من وردية "${previousSlot.name}" بنجاح.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : isEn ? 'Failed to copy assignments' : 'تعذر نسخ التوزيع',
      });
    } finally {
      setCopying(false);
    }
  };

  const handleClearShift = async () => {
    if (!canEdit) return;
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setClearing(true);
    setConfirmClear(false);
    setFeedback(null);
    try {
      await clearShiftHallAssignments({
        restaurant,
        actor,
        shiftSlotId: selectedSlot.id,
        shiftSlotName: isEn ? selectedSlot.nameEn || selectedSlot.name : selectedSlot.name,
        existingAssignmentsForShift: assignmentsForShift,
      });
      setDraftsByCaptain({});
      setHasUnsavedChanges(false);
      setFeedback({
        type: 'ok',
        text: isEn
          ? `Cleared all assignments for "${selectedSlot.nameEn || selectedSlot.name}" shift.`
          : `تم مسح توزيع وردية "${selectedSlot.name}" بالكامل.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : isEn ? 'Failed to clear assignments' : 'تعذر مسح التوزيع',
      });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6 pb-20" dir={dir}>
      {/* Full-Page Header Bar */}
      <div className="bg-white border border-zinc-200 rounded-3xl p-4 sm:p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-extrabold inline-flex items-center gap-2 transition cursor-pointer"
            >
              <BackArrow className="w-4 h-4" />
              <span>{isEn ? 'Back' : 'رجوع'}</span>
            </button>
          )}
          {onGoHome && (
            <button
              type="button"
              onClick={onGoHome}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-extrabold inline-flex items-center gap-2 transition cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>{isEn ? 'Home' : 'الرئيسية'}</span>
            </button>
          )}
          <div className="px-2">
            <h1 className="text-lg sm:text-xl font-extrabold text-zinc-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-600 shrink-0" />
              <span>
                {isEn
                  ? 'Captain Hall & Table Assignments'
                  : 'توزيع الكباتن على الصالات والطاولات'}
              </span>
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isEn
                ? 'Assign each floor Captain to specific dining halls or tables per shift — changes sync live without logging anyone out.'
                : 'وزّع كل كابتن صالة على صالات أو طاولات محددة في كل وردية — يتحدّث التوزيع لحظياً على شاشاتهم دون تسجيل خروج.'}
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {shiftSlots.length > 1 && previousSlot.id !== selectedSlot.id && (
              <button
                type="button"
                disabled={copying || assignmentsForPreviousShift.length === 0}
                onClick={handleCopyPreviousShift}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-extrabold inline-flex items-center gap-2 transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                <span>
                  {isEn
                    ? `Copy "${previousSlot.nameEn || previousSlot.name}" Shift`
                    : `نسخ توزيع وردية "${previousSlot.name}"`}
                </span>
              </button>
            )}

            <button
              type="button"
              disabled={clearing || (assignmentsForShift.length === 0 && Object.keys(draftsByCaptain).length === 0)}
              onClick={handleClearShift}
              onBlur={() => setConfirmClear(false)}
              className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-extrabold inline-flex items-center gap-2 transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                confirmClear
                  ? 'border-red-600 bg-red-600 text-white'
                  : 'border-red-200 bg-red-50 hover:bg-red-100 text-red-700'
              }`}
            >
              {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>
                {confirmClear
                  ? isEn
                    ? 'Click Again to Confirm Clear'
                    : 'اضغط مرة أخرى لتأكيد المسح'
                  : isEn
                    ? 'Clear Shift'
                    : 'مسح التوزيع'}
              </span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isEn ? 'Save Shift Assignments' : 'حفظ التوزيع للوردية'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Shift Selector Strip */}
      <div className="bg-white border border-zinc-200 rounded-3xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-zinc-700 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-teal-600" />
            <span>{isEn ? 'Select Operational Shift Slot' : 'اختر الوردية المطلوب توزيعها'}</span>
          </span>
          {hasUnsavedChanges && (
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-extrabold">
              {isEn ? 'Unsaved changes — press Save' : 'تعديلات غير محفوظة — اضغط حفظ التوزيع'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {shiftSlots.map((slot) => {
            const isSelected = slot.id === selectedSlot.id;
            const isAutoActive = slot.id === currentAutoSlot.id;
            const slotCount = allAssignments.filter(
              (a) => a.shiftSlotId === slot.id && Array.isArray(a.hallIds) && a.hallIds.length > 0
            ).length;
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => handleShiftSwitch(slot.id)}
                className={`min-h-[52px] px-4 py-3 rounded-2xl border text-start transition cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
                    : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold truncate">
                      {isEn ? slot.nameEn || slot.name : slot.name}
                    </span>
                    {isAutoActive && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isEn ? 'Current Now' : 'الحالية الآن'}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[11px] mt-0.5 ${
                      isSelected ? 'text-teal-100' : 'text-zinc-500'
                    }`}
                  >
                    {slot.startTime} → {slot.endTime}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-xl text-xs font-extrabold shrink-0 ${
                    isSelected
                      ? 'bg-white text-teal-700'
                      : slotCount > 0
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-zinc-200 text-zinc-600'
                  }`}
                >
                  {slotCount} {isEn ? 'Captains' : 'كابتن'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-2.5 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {feedback.type === 'ok' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Unassigned / Uncovered Halls & Tables Notices */}
      <div className="space-y-3">
        {!loading && coverageSummary.assignedCaptainsCount === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-extrabold text-amber-950">
                {isEn
                  ? 'No captain assignments configured for this shift'
                  : 'لا يوجد توزيع لهذه الوردية'}
              </p>
              <p className="text-xs text-amber-900 leading-relaxed">
                {isEn
                  ? 'When a shift has no assignments, captains see all halls and tables (unless constrained by a static Captain Screen) so operations never stall.'
                  : 'عند عدم وجود توزيع للوردية، يرى كل كابتن جميع الصالات والطاولات تلقائياً (أو حسب حدود شاشته الثابتة إن وجدت) حتى لا تتعطل الخدمة.'}
              </p>
            </div>
          </div>
        )}

        {halls.length > 0 && coverageSummary.uncoveredHalls.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-extrabold text-orange-950">
                {isEn
                  ? `Unassigned halls in this shift (${coverageSummary.uncoveredHalls.length}):`
                  : `صالات بدون كابتن مسؤول في هذه الوردية (${coverageSummary.uncoveredHalls.length}):`}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {coverageSummary.uncoveredHalls.map((h) => (
                  <span
                    key={h.id}
                    className="px-2.5 py-1 rounded-lg bg-white border border-orange-300 text-orange-900 text-xs font-extrabold"
                  >
                    {isEn ? h.name_en || h.name : h.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {coverageSummary.partiallyCoveredHalls.length > 0 && (
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 flex items-start gap-3">
            <LayoutGrid className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-extrabold text-sky-950">
                {isEn
                  ? 'Partially covered halls (tables without an assigned Captain):'
                  : 'صالات مغطاة جزئياً (طاولات لم تُسند لأي كابتن):'}
              </p>
              <div className="space-y-1 pt-1">
                {coverageSummary.partiallyCoveredHalls.map(({ hall, missingTables }) => (
                  <p key={hall.id} className="text-xs text-sky-900">
                    <span className="font-extrabold">{isEn ? hall.name_en || hall.name : hall.name}:</span>{' '}
                    {missingTables.slice(0, 12).join('، ')}
                    {missingTables.length > 12 ? ` (+${missingTables.length - 12})` : ''}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty States */}
      {loading ? (
        <div className="bg-white border border-zinc-200 rounded-3xl p-12 flex items-center justify-center gap-3 text-zinc-500">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          <span className="text-sm font-bold">
            {isEn ? 'Loading shift captain assignments...' : 'جاري تحميل توزيع الكباتن...'}
          </span>
        </div>
      ) : halls.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-3xl p-10 text-center space-y-2">
          <MapPin className="w-8 h-8 text-zinc-400 mx-auto" />
          <p className="text-sm font-extrabold text-zinc-800">
            {isEn ? 'No dining halls created yet' : 'لم يتم إنشاء صالات بعد'}
          </p>
          <p className="text-xs text-zinc-500">
            {isEn
              ? 'Add halls from Halls & Table QR Codes first so you can assign captains to them.'
              : 'أضف الصالات والطاولات أولاً من قسم «الصالات وأكواد QR» لتتمكن من توزيع الكباتن عليها.'}
          </p>
        </div>
      ) : captains.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-3xl p-10 text-center space-y-2">
          <UserCheck className="w-8 h-8 text-zinc-400 mx-auto" />
          <p className="text-sm font-extrabold text-zinc-800">
            {isEn ? 'No Captain accounts registered yet' : 'لا يوجد حسابات كباتن مسجلة في المطعم بعد'}
          </p>
          <p className="text-xs text-zinc-500">
            {isEn
              ? 'Create Captain staff accounts from Staff & Permissions to assign them to shifts and tables.'
              : 'أضف حسابات الكباتن من «إدارة الكادر والصلاحيات» أولاً ليظهروا هنا للتوزيع.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {captains.map((cap) => {
            const draft = getDraft(cap.uid);
            const activeShift = activeShiftByCaptainUid.get(cap.uid);
            const staticScopedStations = (cap.allowedCaptainScreens || [])
              .map((sid) => captainStations.find((st) => st.stationId === sid))
              .filter((st): st is StationMeta => Boolean(st && st.tableVisibilityScope === 'assigned_only'));

            return (
              <div
                key={cap.uid}
                className="bg-white border border-zinc-200 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4"
              >
                {/* Captain Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-base shrink-0 ${
                        activeShift
                          ? 'bg-emerald-600 text-white'
                          : cap.isActive
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-zinc-200 text-zinc-600'
                      }`}
                    >
                      {cap.name.trim().slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-extrabold text-zinc-900 truncate">
                          {cap.name}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold">
                          {isEn ? 'Captain' : 'كابتن'}
                        </span>
                        {activeShift ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span>{isEn ? 'Active Shift Now' : 'في وردية الآن'}</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 text-[10px] font-bold">
                            {isEn ? 'Off Shift' : 'خارج الوردية'}
                          </span>
                        )}
                        {!cap.isActive && (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-extrabold">
                            {isEn ? 'Account Suspended' : 'حساب موقوف'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        @{cap.username}
                        {cap.hallName
                          ? ` · ${isEn ? 'Profile Hall:' : 'الصالة الافتراضية:'} ${cap.hallName}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold ${
                        draft.hallIds.length > 0
                          ? 'bg-teal-50 text-teal-800 border border-teal-200'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {draft.hallIds.length > 0
                        ? isEn
                          ? `${draft.hallIds.length} Hall(s) Assigned`
                          : `موزّع على ${draft.hallIds.length} صالة`
                        : isEn
                          ? 'Not assigned in this shift'
                          : 'غير محدد في هذه الوردية'}
                    </span>
                  </div>
                </div>

                {/* Static Screen Restriction Hint (Intersection precedence) */}
                {staticScopedStations.length > 0 && (
                  <div className="px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      {isEn
                        ? `Linked Captain Screen has static hall/table bounds (${staticScopedStations.map((s) => s.shortLabel_en).join(', ')}): Captain will see the intersection of static screen bounds and shift assignment.`
                        : `هذا الكابتن مرتبط بشاشة كابتن مقيدة بصالات/طاولات ثابتة (${staticScopedStations.map((s) => s.shortLabel).join('، ')}) — سيُطبّق التقاطع الأضيق تلقائياً.`}
                    </span>
                  </div>
                )}

                {/* Hall Checkboxes + Per-Hall Specific Table Picker */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {halls.map((hall) => {
                    const isHallChecked = draft.hallIds.includes(hall.id);
                    const specificTables = draft.tableNumbersByHall[hall.id] || [];
                    const isAllTables = isHallChecked && specificTables.length === 0;
                    const hallTableNumbers = getHallTableNumbers(hall);

                    return (
                      <div
                        key={hall.id}
                        className={`rounded-2xl border p-3.5 transition ${
                          isHallChecked
                            ? 'border-teal-500 bg-teal-50/40'
                            : 'border-zinc-200 bg-zinc-50/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2.5 cursor-pointer select-none min-h-[44px] flex-1">
                            <input
                              type="checkbox"
                              disabled={!canEdit}
                              checked={isHallChecked}
                              onChange={() => toggleCaptainHall(cap.uid, hall.id)}
                              className="w-5 h-5 rounded accent-teal-600 cursor-pointer"
                            />
                            <div>
                              <p className="text-xs sm:text-sm font-extrabold text-zinc-900">
                                {isEn ? hall.name_en || hall.name : hall.name}
                              </p>
                              <p className="text-[11px] text-zinc-500">
                                {hallTableNumbers.length}{' '}
                                {isEn ? 'tables' : 'طاولة'}
                              </p>
                            </div>
                          </label>

                          {isHallChecked && (
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => toggleAllTablesForHall(cap.uid, hall.id)}
                              className={`min-h-[36px] px-3 py-1 rounded-xl text-[11px] font-extrabold border transition cursor-pointer ${
                                isAllTables
                                  ? 'bg-teal-600 text-white border-teal-600'
                                  : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                              }`}
                            >
                              {isEn ? 'All Tables' : 'كامل الصالة'}
                            </button>
                          )}
                        </div>

                        {isHallChecked && (
                          <div className="mt-3 pt-3 border-t border-teal-200/70 space-y-2">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-zinc-600">
                                {isAllTables
                                  ? isEn
                                    ? 'All tables in this hall are assigned (or tap specific tables below):'
                                    : 'كامل طاولات الصالة مسندة (أو اضغط طاولات محددة أدناه):'
                                  : isEn
                                    ? `Specific tables selected (${specificTables.length}):`
                                    : `طاولات محددة (${specificTables.length}):`}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {hallTableNumbers.map((tbl) => {
                                const selected = specificTables.includes(tbl);
                                return (
                                  <button
                                    key={tbl}
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => toggleSpecificTable(cap.uid, hall.id, tbl)}
                                    className={`min-w-[44px] min-h-[44px] px-2.5 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                                      selected
                                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                                        : isAllTables
                                          ? 'bg-white text-teal-800 border-teal-200 hover:border-teal-500'
                                          : 'bg-white text-zinc-600 border-zinc-200 hover:border-teal-400'
                                    }`}
                                  >
                                    #{tbl}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
