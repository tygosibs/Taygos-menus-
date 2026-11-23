import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Bell,
  CheckCircle2,
  ChefHat,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  subscribeCategories,
  subscribeHalls,
  subscribeMenuItems,
} from '../../lib/firestoreService';
import {
  archiveRestaurantStation,
  deleteRestaurantStationChecked,
  reorderRestaurantStations,
  saveRestaurantStation,
  seedStarterStationsForRestaurant,
  subscribeRestaurantStations,
} from '../../lib/stationsService';
import {
  buildEffectiveCaptainScreens,
  buildEffectiveStations,
  cleanStationId,
  getDefaultFallbackStationId,
  getStationIconComponent,
  STATION_TEMPLATES,
  StationTemplate,
} from '../../lib/stationUtils';
import {
  Category,
  Hall,
  MenuItem,
  Restaurant,
  RestaurantStation,
  StaffActorInfo,
  StaffShift,
  StationScreenType,
} from '../../types/menu';
import { StationEditorFullPage } from './StationEditorFullPage';

interface StationCreateIntent {
  key: number;
  screenType?: StationScreenType;
  returnLabel?: string;
}

interface StationsManagerTabProps {
  restaurant: Restaurant;
  actor: StaffActorInfo;
  activeShifts?: StaffShift[];
  createIntent?: StationCreateIntent | null;
  onGoHome?: () => void;
  onReturnAfterCreate?: (created: RestaurantStation) => void;
  onCancelReturn?: () => void;
}

type EditorState =
  | { open: false }
  | {
      open: true;
      station: RestaurantStation | null;
      template: StationTemplate | null;
      screenType?: StationScreenType;
      fromExternalIntent?: boolean;
      backLabel?: string;
    };

export const StationsManagerTab: React.FC<StationsManagerTabProps> = ({
  restaurant,
  actor,
  activeShifts = [],
  createIntent = null,
  onGoHome,
  onReturnAfterCreate,
  onCancelReturn,
}) => {
  const { lang, dir, loc } = useLanguage();
  const isEn = lang === 'en';
  const [stations, setStations] = useState<RestaurantStation[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteBlockedStation, setDeleteBlockedStation] = useState<RestaurantStation | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'prep' | 'captain' | 'archived'>('all');

  const [editorState, setEditorState] = useState<EditorState>({ open: false });

  useEffect(() => {
    setLoading(true);
    const unsubStations = subscribeRestaurantStations(
      restaurant.id,
      (list) => {
        setStations(list);
        setLoading(false);
      },
      (err) => {
        setErrorMsg(
          err.message ||
            (isEn ? 'Unable to load screens & preparation stations' : 'تعذر تحميل الشاشات والمحطات')
        );
        setLoading(false);
      }
    );
    const unsubHalls = subscribeHalls(restaurant.id, setHalls, () => {});
    const unsubCats = subscribeCategories(restaurant.id, setCategories);
    const unsubItems = subscribeMenuItems(restaurant.id, setMenuItems);
    return () => {
      unsubStations();
      unsubHalls();
      unsubCats();
      unsubItems();
    };
  }, [restaurant.id, isEn]);

  useEffect(() => {
    if (!createIntent?.key) return;
    setErrorMsg('');
    setDeleteBlockedStation(null);
    setEditorState({
      open: true,
      station: null,
      template: null,
      screenType: createIntent.screenType,
      fromExternalIntent: true,
      backLabel: createIntent.returnLabel,
    });
  }, [createIntent?.key, createIntent?.screenType, createIntent?.returnLabel]);

  const effectivePrepStations = useMemo(
    () => buildEffectiveStations(stations, true),
    [stations]
  );

  const effectiveCaptainScreens = useMemo(
    () => buildEffectiveCaptainScreens(stations, true),
    [stations]
  );

  const fallbackStationId = useMemo(
    () => getDefaultFallbackStationId(effectivePrepStations),
    [effectivePrepStations]
  );

  const activeStaffCountByStation = useMemo(() => {
    const counts = new Map<string, StaffShift[]>();
    activeShifts.forEach((sh) => {
      if (sh.status === 'active') {
        const key = cleanStationId(sh.stationId);
        const prev = counts.get(key) || [];
        prev.push(sh);
        counts.set(key, prev);
      }
    });
    return counts;
  }, [activeShifts]);

  const activeNonArchivedStations = useMemo(
    () => stations.filter((s) => !s.isArchived),
    [stations]
  );

  const archivedStations = useMemo(
    () => stations.filter((s) => s.isArchived === true),
    [stations]
  );

  const displayedStations = useMemo(() => {
    if (filterTab === 'archived') return archivedStations;
    if (filterTab === 'prep') {
      return activeNonArchivedStations.filter((s) => s.screenType !== 'captain');
    }
    if (filterTab === 'captain') {
      return activeNonArchivedStations.filter((s) => s.screenType === 'captain');
    }
    return activeNonArchivedStations;
  }, [filterTab, activeNonArchivedStations, archivedStations]);

  const prepCount = useMemo(
    () => activeNonArchivedStations.filter((s) => s.screenType !== 'captain').length,
    [activeNonArchivedStations]
  );

  const captainCount = useMemo(
    () => activeNonArchivedStations.filter((s) => s.screenType === 'captain').length,
    [activeNonArchivedStations]
  );

  const openCreateFullPage = (opts?: {
    template?: StationTemplate | null;
    screenType?: StationScreenType;
  }) => {
    setErrorMsg('');
    setDeleteBlockedStation(null);
    setEditorState({
      open: true,
      station: null,
      template: opts?.template || null,
      screenType: opts?.screenType,
      fromExternalIntent: false,
    });
  };

  const openEditFullPage = (st: RestaurantStation) => {
    setErrorMsg('');
    setDeleteBlockedStation(null);
    setEditorState({
      open: true,
      station: st,
      template: null,
      screenType: st.screenType === 'captain' ? 'captain' : 'prep',
      fromExternalIntent: false,
    });
  };

  const handleSeedStarter = async () => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    setDeleteBlockedStation(null);
    try {
      const created = await seedStarterStationsForRestaurant({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        actor,
      });
      setSuccessMsg(
        created.length > 0
          ? isEn
            ? `Initialized ${created.length} starter stations and linked their prep screens.`
            : `تمت تهيئة ${created.length} أقسام تحضير أساسية وربط شاشاتها فوراً.`
          : isEn
            ? 'Starter stations already exist.'
            : 'الأقسام الأساسية موجودة بالفعل.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Unable to initialize starter stations'
            : 'تعذر تهيئة المحطات'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (st: RestaurantStation) => {
    setSaving(true);
    setErrorMsg('');
    setDeleteBlockedStation(null);
    try {
      await saveRestaurantStation({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        actor,
        station: {
          id: st.id,
          stationId: st.stationId,
          name: st.name,
          nameEn: st.nameEn,
          color: st.color,
          icon: st.icon,
          screenType: st.screenType,
          isActive: st.isActive === false,
          isArchived: Boolean(st.isArchived),
          isDefaultFallback: st.isDefaultFallback,
          showPrices: st.showPrices,
          allowedOrderTypes: st.allowedOrderTypes,
          soundAlertEnabled: st.soundAlertEnabled,
          overdueAlertMinutes: st.overdueAlertMinutes,
          thermalPrintMode: st.thermalPrintMode,
          availableStatusButtons: st.availableStatusButtons,
          assignedHallIds: st.assignedHallIds,
          assignedTableNumbers: st.assignedTableNumbers,
          tableVisibilityScope: st.tableVisibilityScope,
          sortOrder: st.sortOrder,
        },
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Unable to update screen status'
            : 'تعذر تغيير حالة الشاشة'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (st: RestaurantStation, archived: boolean) => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    setDeleteBlockedStation(null);
    try {
      await archiveRestaurantStation({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        station: st,
        actor,
        archived,
      });
      const stLabel = loc(st.name, st.nameEn);
      setSuccessMsg(
        archived
          ? isEn
            ? `Archived "${stLabel}". Order history is preserved and hidden from active screens.`
            : `تمت أرشفة "${stLabel}" بنجاح مع الحفاظ الكامل على سجل الطلبات السابقة.`
          : isEn
            ? `Restored "${stLabel}" to active screens.`
            : `تمت استعادة "${stLabel}" إلى الشاشات النشطة.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Unable to update archive status'
            : 'تعذر تحديث الأرشفة'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (stId: string, delta: -1 | 1) => {
    const index = stations.findIndex((s) => s.id === stId);
    if (index === -1) return;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= stations.length) return;
    const copy = [...stations];
    const [item] = copy.splice(index, 1);
    copy.splice(nextIndex, 0, item);
    try {
      await reorderRestaurantStations(restaurant.id, copy);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Unable to reorder screens'
            : 'تعذر إعادة الترتيب'
      );
    }
  };

  const handleDelete = async (st: RestaurantStation) => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    setDeleteBlockedStation(null);
    try {
      await deleteRestaurantStationChecked({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        station: st,
        actor,
      });
      const stLabel = loc(st.name, st.nameEn);
      setSuccessMsg(
        isEn ? `Deleted "${stLabel}" successfully.` : `تم حذف "${stLabel}" بنجاح.`
      );
    } catch (err) {
      setDeleteBlockedStation(st);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Unable to delete screen'
            : 'تعذر حذف الشاشة'
      );
    } finally {
      setSaving(false);
    }
  };

  // Full Dedicated Editor Page View (Never a modal)
  if (editorState.open) {
    return (
      <StationEditorFullPage
        restaurant={restaurant}
        actor={actor}
        initialStation={editorState.station}
        initialTemplate={editorState.template}
        initialScreenType={editorState.screenType}
        existingStationsCount={stations.length}
        fallbackStationId={fallbackStationId}
        halls={halls}
        categories={categories}
        menuItems={menuItems}
        backLabel={editorState.backLabel}
        onGoHome={onGoHome}
        onCancel={() => {
          const wasExternal = editorState.fromExternalIntent;
          setEditorState({ open: false });
          if (wasExternal && onCancelReturn) {
            onCancelReturn();
          }
        }}
        onSaved={(saved) => {
          const wasExternal = editorState.fromExternalIntent;
          const savedLabel = loc(saved.name, saved.nameEn);
          setEditorState({ open: false });
          setSuccessMsg(
            editorState.station
              ? isEn
                ? `Saved changes to "${savedLabel}".`
                : `تم حفظ تعديلات "${savedLabel}".`
              : isEn
                ? `Created "${savedLabel}" (${saved.screenType === 'captain' ? 'Captain Screen' : 'Prep Station'}).`
                : `تم إنشاء "${savedLabel}" وتفعيله بنجاح.`
          );
          if (wasExternal && onReturnAfterCreate) {
            onReturnAfterCreate(saved);
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-5" dir={dir}>
      {/* Hero Header + Primary Big CTA + Quick Templates */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="flex items-center gap-2 text-lg sm:text-xl font-extrabold text-zinc-950">
              <Layers className="h-5 w-5 text-orange-600 shrink-0" />
              <span>
                {isEn
                  ? 'Screens & Preparation Stations (Unlimited)'
                  : 'الشاشات والمحطات المرنة (بلا حد أقصى)'}
              </span>
            </h2>
            <p className="max-w-2xl text-xs leading-relaxed text-zinc-600">
              {isEn
                ? 'Create unlimited Prep Stations (Bakery, Sub-Kitchen, Grill, Sushi, Coffee...) and Floor Captain Screens scoped to specific halls or tables, with custom routing, alerts, and thermal printing.'
                : 'أنشئ أي عدد من محطات التحضير (مخبز، مطبخ فرعي، شواية، سوشي، بيتزا، قهوة...) وشاشات الكابتن المخصصة للصالات والطاولات، مع تحكم كامل في التوجيه والأسعار والتنبيهات والطباعة.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {stations.length === 0 && (
              <button
                type="button"
                disabled={saving}
                onClick={handleSeedStarter}
                className="min-h-[46px] inline-flex items-center gap-1.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-extrabold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {isEn
                    ? 'Initialize Starter Stations'
                    : 'تهيئة المحطات الأساسية'}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => openCreateFullPage()}
              className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-6 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-zinc-800 cursor-pointer"
            >
              <Plus className="h-5 w-5 shrink-0" />
              <span>{isEn ? '+ Add Screen' : '+ إضافة شاشة'}</span>
            </button>
          </div>
        </div>

        {/* Quick Preset Templates Underneath */}
        <div className="border-t border-zinc-100 pt-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-zinc-700">
              {isEn
                ? 'Quick Starter Templates (opens full customization page pre-filled):'
                : 'قوالب سريعة جاهزة (تفتح صفحة الإضافة الكاملة معبأة وجاهزة للحفظ أو التخصيص):'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATION_TEMPLATES.map((tpl) => {
              const IconComp = getStationIconComponent(tpl.icon);
              return (
                <button
                  key={tpl.suggestedId}
                  type="button"
                  onClick={() => openCreateFullPage({ template: tpl, screenType: 'prep' })}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-800 transition hover:border-zinc-900 hover:bg-white cursor-pointer"
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-lg text-white shrink-0"
                    style={{ backgroundColor: tpl.color }}
                  >
                    <IconComp className="h-3 w-3" />
                  </span>
                  <span>{loc(tpl.name, tpl.nameEn)}</span>
                  <span className="text-[10px] text-zinc-400">+</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => openCreateFullPage({ screenType: 'captain' })}
              className="inline-flex items-center gap-2 rounded-xl border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-extrabold text-teal-900 transition hover:bg-teal-100 cursor-pointer"
            >
              <UserCheck className="h-4 w-4 text-teal-700 shrink-0" />
              <span>{isEn ? 'Captain Floor Screen' : 'شاشة كابتن صالة'}</span>
              <span className="text-[10px]">+</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              {
                id: 'all',
                labelAr: `الكل (${activeNonArchivedStations.length})`,
                labelEn: `All Active (${activeNonArchivedStations.length})`,
              },
              {
                id: 'prep',
                labelAr: `محطات التحضير (${prepCount})`,
                labelEn: `Prep Stations (${prepCount})`,
              },
              {
                id: 'captain',
                labelAr: `شاشات الكابتن (${captainCount})`,
                labelEn: `Captain Screens (${captainCount})`,
              },
              {
                id: 'archived',
                labelAr: `المؤرشفة (${archivedStations.length})`,
                labelEn: `Archived (${archivedStations.length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                filterTab === tab.id
                  ? 'bg-zinc-950 text-white shadow-xs'
                  : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {isEn ? tab.labelEn : tab.labelAr}
            </button>
          ))}
        </div>

        <span className="text-[11px] font-bold text-zinc-500">
          {isEn
            ? `Active runtime fallback: ${loc(
                effectivePrepStations.find((s) => s.stationId === fallbackStationId)?.label || 'Kitchen',
                effectivePrepStations.find((s) => s.stationId === fallbackStationId)?.label_en
              )}`
            : `المحطة الافتراضية الحالية: ${
                effectivePrepStations.find((s) => s.stationId === fallbackStationId)?.label || 'المطبخ'
              }`}
        </span>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-900 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
            <span>{errorMsg}</span>
          </div>
          {deleteBlockedStation && !deleteBlockedStation.isArchived && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleArchiveToggle(deleteBlockedStation, true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 text-xs font-extrabold cursor-pointer disabled:opacity-50"
              >
                <Archive className="h-3.5 w-3.5" />
                <span>
                  {isEn
                    ? `Archive "${loc(deleteBlockedStation.name, deleteBlockedStation.nameEn)}" Instead`
                    : `أرشفة "${loc(deleteBlockedStation.name, deleteBlockedStation.nameEn)}" بدلاً من الحذف`}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white p-10 text-sm font-bold text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          {isEn ? 'Loading screens and stations...' : 'جاري تحميل الشاشات والمحطات...'}
        </div>
      ) : stations.length === 0 ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-7 text-center space-y-2">
            <p className="text-sm font-extrabold text-zinc-900">
              {isEn
                ? 'No custom screens saved yet — using default Kitchen, Bar, and Pastry stations automatically.'
                : 'لم تُضف شاشات مخصصة بعد — يعمل النظام حالياً بالشاشات الافتراضية (المطبخ، البار، الباستري) تلقائياً.'}
            </p>
            <p className="text-xs text-zinc-500 max-w-xl mx-auto">
              {isEn
                ? 'Click "+ Add Screen" or any starter template above to add Bakery, Sub-Kitchen, Grill, Sushi, or custom Captain floor screens.'
                : 'اضغط "+ إضافة شاشة" أو اختر أي قالب سريع بالأعلى لإضافة مخبز، مطبخ فرعي، شواية، سوشي، أو شاشة كابتن صالة خاصة.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {effectivePrepStations.map((st) => {
              const IconComp = getStationIconComponent(st.icon);
              return (
                <div
                  key={st.stationId}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 flex items-center gap-3 opacity-85"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: st.color }}
                  >
                    <IconComp className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-zinc-900 truncate">
                      {loc(st.label, st.label_en)}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {isEn ? 'Default system fallback station' : 'محطة افتراضية مدمجة بالنظام'}
                    </p>
                  </div>
                </div>
              );
            })}
            {effectiveCaptainScreens.map((cap) => (
              <div
                key={cap.stationId}
                className="rounded-2xl border border-teal-200 bg-teal-50/40 p-4 flex items-center gap-3 opacity-85"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: cap.color }}
                >
                  <UserCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-zinc-900 truncate">
                    {loc(cap.label, cap.label_en)}
                  </p>
                  <p className="text-[11px] text-teal-700">
                    {isEn ? 'Default captain floor screen' : 'شاشة الكابتن الافتراضية'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : displayedStations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
          <p className="text-sm font-bold text-zinc-700">
            {filterTab === 'archived'
              ? isEn
                ? 'No archived screens.'
                : 'لا توجد شاشات مؤرشفة.'
              : isEn
                ? 'No screens match this filter.'
                : 'لا توجد شاشات في هذا التبويب حالياً.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayedStations.map((st) => {
            const IconComp = getStationIconComponent(st.icon);
            const isCaptain = st.screenType === 'captain';
            const cleanId = cleanStationId(st.stationId);
            const activeOnStation =
              activeStaffCountByStation.get(cleanId) ||
              (isCaptain ? activeStaffCountByStation.get('captain') || [] : []);
            const activeState = st.isActive !== false && !st.isArchived;
            const globalIndex = stations.findIndex((s) => s.id === st.id);
            const linkedCategoriesCount = categories.filter(
              (c) =>
                (c.stationIds || []).includes(cleanId) ||
                cleanStationId(c.stationId || c.station) === cleanId
            ).length;

            return (
              <div
                key={st.id}
                className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                  st.isArchived
                    ? 'border-zinc-200 bg-zinc-100/70 opacity-75'
                    : activeState
                      ? 'border-zinc-200 bg-white shadow-xs'
                      : 'border-amber-200 bg-amber-50/20 opacity-85'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
                        style={{ backgroundColor: st.color || '#EA580C' }}
                      >
                        <IconComp className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="text-sm font-extrabold text-zinc-950 truncate">
                            {loc(st.name, st.nameEn)}
                          </h4>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              st.isArchived
                                ? 'bg-zinc-200 text-zinc-700'
                                : activeState
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {st.isArchived
                              ? isEn
                                ? 'Archived'
                                : 'مؤرشفة'
                              : activeState
                                ? isEn
                                  ? 'Active'
                                  : 'نشط'
                                : isEn
                                  ? 'Paused'
                                  : 'متوقف'}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                          <span
                            className={`px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${
                              isCaptain
                                ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                : 'bg-orange-50 text-orange-800 border border-orange-200'
                            }`}
                          >
                            {isCaptain ? (
                              <UserCheck className="w-2.5 h-2.5" />
                            ) : (
                              <ChefHat className="w-2.5 h-2.5" />
                            )}
                            <span>
                              {isCaptain
                                ? isEn
                                  ? 'Captain Screen'
                                  : 'شاشة كابتن'
                                : isEn
                                  ? 'Prep Station'
                                  : 'محطة تحضير'}
                            </span>
                          </span>
                          {st.isDefaultFallback && !isCaptain && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                              {isEn ? 'Default Fallback' : 'الافتراضية'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!st.isArchived && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={globalIndex <= 0}
                          onClick={() => handleMove(st.id, -1)}
                          title={isEn ? 'Move Up' : 'تحريك للأعلى'}
                          className="rounded-lg border border-zinc-200 p-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={globalIndex === -1 || globalIndex >= stations.length - 1}
                          onClick={() => handleMove(st.id, 1)}
                          title={isEn ? 'Move Down' : 'تحريك للأسفل'}
                          className="rounded-lg border border-zinc-200 p-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Operational Rules Summary Badges */}
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-bold text-zinc-700">
                    <span className="px-2 py-0.5 rounded-md bg-zinc-100 inline-flex items-center gap-1">
                      {st.showPrices ? (
                        <Eye className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <EyeOff className="w-3 h-3 text-zinc-500" />
                      )}
                      <span>
                        {st.showPrices
                          ? isEn
                            ? 'Prices Shown'
                            : 'تُظهر الأسعار'
                          : isEn
                            ? 'Prices Hidden'
                            : 'بدون أسعار'}
                      </span>
                    </span>

                    {!isCaptain ? (
                      <>
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 font-mono-num inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>
                            {isEn
                              ? `Alert ${st.overdueAlertMinutes ?? 15}m`
                              : `تنبيه ${st.overdueAlertMinutes ?? 15}د`}
                          </span>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 inline-flex items-center gap-1">
                          <Printer className="w-3 h-3 text-zinc-600" />
                          <span>
                            {st.thermalPrintMode === 'auto'
                              ? isEn
                                ? 'Auto Print'
                                : 'طباعة تلقائية'
                              : st.thermalPrintMode === 'off'
                                ? isEn
                                  ? 'No Print'
                                  : 'بدون طباعة'
                                : isEn
                                  ? 'Manual Print'
                                  : 'طباعة يدوية'}
                          </span>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 font-mono-num">
                          {isEn
                            ? `${linkedCategoriesCount} categories`
                            : `${linkedCategoriesCount} أقسام`}
                        </span>
                      </>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-900">
                        {st.tableVisibilityScope === 'assigned_only'
                          ? isEn
                            ? `Assigned Scope (${st.assignedHallIds?.length || 0} halls · ${st.assignedTableNumbers?.length || 0} tables)`
                            : `مخصص (${st.assignedHallIds?.length || 0} صالة · ${st.assignedTableNumbers?.length || 0} طاولة)`
                          : isEn
                            ? 'All Floor Tables'
                            : 'كل طاولات الصالة'}
                      </span>
                    )}

                    {st.soundAlertEnabled !== false && (
                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 inline-flex items-center gap-1">
                        <Bell className="w-3 h-3 text-amber-600" />
                        <span>{isEn ? 'Sound' : 'صوت'}</span>
                      </span>
                    )}
                  </div>

                  {/* Active shift indicator */}
                  {!st.isArchived && (
                    <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2">
                      {activeOnStation.length > 0 ? (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1 font-bold text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            {isEn
                              ? `${activeOnStation.length} active shift`
                              : `${activeOnStation.length} وردية نشطة`}
                          </span>
                          <span className="truncate text-zinc-600 max-w-[140px]">
                            {activeOnStation.map((s) => s.staffName).join(isEn ? ', ' : '، ')}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {isEn
                              ? 'No staff currently on active shift'
                              : 'لا يوجد موظف في وردية نشطة حالياً'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-zinc-100 pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!st.isArchived && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditFullPage(st)}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-800 hover:bg-zinc-50 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>{isEn ? 'Edit' : 'تعديل'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleToggleActive(st)}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
                        >
                          {activeState ? (
                            <>
                              <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                              <span>{isEn ? 'Pause' : 'تعطيل'}</span>
                            </>
                          ) : (
                            <>
                              <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
                              <span>{isEn ? 'Activate' : 'تفعيل'}</span>
                            </>
                          )}
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleArchiveToggle(st, !st.isArchived)}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
                    >
                      {st.isArchived ? (
                        <>
                          <ArchiveRestore className="h-3.5 w-3.5 text-emerald-600" />
                          <span>{isEn ? 'Restore' : 'استعادة'}</span>
                        </>
                      ) : (
                        <>
                          <Archive className="h-3.5 w-3.5 text-amber-700" />
                          <span>{isEn ? 'Archive' : 'أرشفة'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleDelete(st)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{isEn ? 'Delete' : 'حذف'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
