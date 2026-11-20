import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Edit3,
  Layers,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  Restaurant,
  RestaurantStation,
  StaffActorInfo,
  StaffShift,
  StationIconName,
} from '../../types/menu';
import {
  getStationIconComponent,
  STATION_COLOR_PRESETS,
  STATION_ICON_OPTIONS,
  STATION_TEMPLATES,
  StationTemplate,
} from '../../lib/stationUtils';
import {
  deleteRestaurantStationChecked,
  reorderRestaurantStations,
  saveRestaurantStation,
  seedStarterStationsForRestaurant,
  subscribeRestaurantStations,
} from '../../lib/stationsService';

interface StationsManagerTabProps {
  restaurant: Restaurant;
  actor: StaffActorInfo;
  activeShifts?: StaffShift[];
}

export const StationsManagerTab: React.FC<StationsManagerTabProps> = ({
  restaurant,
  actor,
  activeShifts = [],
}) => {
  const [stations, setStations] = useState<RestaurantStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<RestaurantStation | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [color, setColor] = useState('#EA580C');
  const [icon, setIcon] = useState<StationIconName>('chef-hat');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeRestaurantStations(
      restaurant.id,
      (list) => {
        setStations(list);
        setLoading(false);
      },
      (err) => {
        setErrorMsg(err.message || 'تعذر تحميل الأقسام الرئيسية');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [restaurant.id]);

  const activeStaffCountByStation = useMemo(() => {
    const counts = new Map<string, StaffShift[]>();
    activeShifts.forEach((sh) => {
      if (sh.status === 'active') {
        const prev = counts.get(sh.stationId) || [];
        prev.push(sh);
        counts.set(sh.stationId, prev);
      }
    });
    return counts;
  }, [activeShifts]);

  const openCreateModal = (tpl?: StationTemplate) => {
    setEditingStation(null);
    setNameAr(tpl ? tpl.name : '');
    setNameEn(tpl ? tpl.nameEn : '');
    setColor(tpl ? tpl.color : STATION_COLOR_PRESETS[stations.length % STATION_COLOR_PRESETS.length]);
    setIcon(tpl ? tpl.icon : 'chef-hat');
    setIsActive(true);
    setErrorMsg('');
    setModalOpen(true);
  };

  const openEditModal = (st: RestaurantStation) => {
    setEditingStation(st);
    setNameAr(st.name);
    setNameEn(st.nameEn || '');
    setColor(st.color || '#EA580C');
    setIcon(st.icon || 'chef-hat');
    setIsActive(st.isActive !== false);
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleSeedStarter = async () => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const created = await seedStarterStationsForRestaurant({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        actor,
      });
      setSuccessMsg(
        created.length > 0
          ? `تمت تهيئة ${created.length} أقسام تحضير أساسية وربط شاشات KDS بها فوراً.`
          : 'الأقسام الأساسية موجودة بالفعل.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر تهيئة الأقسام');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAddTemplate = async (tpl: StationTemplate) => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const created = await saveRestaurantStation({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        actor,
        station: {
          stationId: tpl.suggestedId,
          name: tpl.name,
          nameEn: tpl.nameEn,
          color: tpl.color,
          icon: tpl.icon,
          isActive: true,
          sortOrder: stations.length + 1,
        },
      });
      setSuccessMsg(`تمت إضافة قسم "${created.name}" وإنشاء شاشة KDS مستقلة له.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إضافة القسم');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const saved = await saveRestaurantStation({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        actor,
        station: {
          id: editingStation?.id,
          stationId: editingStation?.stationId,
          name: nameAr,
          nameEn,
          color,
          icon,
          isActive,
          sortOrder: editingStation?.sortOrder ?? stations.length + 1,
        },
      });
      setSuccessMsg(
        editingStation
          ? `تم تحديث بيانات قسم "${saved.name}".`
          : `تم إنشاء قسم "${saved.name}" وتوليد شاشة تحضير (KDS) له تلقائياً.`
      );
      setModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر حفظ القسم');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (st: RestaurantStation) => {
    setSaving(true);
    setErrorMsg('');
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
          isActive: st.isActive === false,
          sortOrder: st.sortOrder,
        },
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر تغيير حالة القسم');
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (index: number, dir: -1 | 1) => {
    const nextIndex = index + dir;
    if (nextIndex < 0 || nextIndex >= stations.length) return;
    const copy = [...stations];
    const [item] = copy.splice(index, 1);
    copy.splice(nextIndex, 0, item);
    try {
      await reorderRestaurantStations(restaurant.id, copy);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إعادة الترتيب');
    }
  };

  const handleDelete = async (st: RestaurantStation) => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await deleteRestaurantStationChecked({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        station: st,
        actor,
      });
      setSuccessMsg(`تم حذف قسم "${st.name}" بنجاح.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر حذف القسم');
    } finally {
      setSaving(false);
    }
  };

  const existingNamesSet = new Set(stations.map((s) => s.stationId));

  return (
    <div className="space-y-5" dir="rtl">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-zinc-900">
              <Layers className="h-5 w-5 text-orange-600" />
              الأقسام الرئيسية / محطات التحضير (غير محدودة)
            </h3>
            <p className="max-w-2xl text-xs leading-relaxed text-zinc-600">
              أنشئ أي عدد من محطات التحضير التي تناسب مطعمك (شاورما، بيتزا، مشويات، سوشي، قهوة، شيشة، حلويات...)
              بلا حد أقصى. كل قسم نشط هنا ينشئ تلقائياً شاشة KDS مستقلة، ويتيح ربط فئات المنيو وتذاكر الطباعة وتعيين الموظفين والورديات عليه.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {stations.length === 0 && (
              <button
                type="button"
                disabled={saving}
                onClick={handleSeedStarter}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                تهيئة الأقسام الأساسية (مطبخ / بار / باستري)
              </button>
            )}
            <button
              type="button"
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4" />
              إضافة قسم جديد
            </button>
          </div>
        </div>

        {/* Quick Preset Templates */}
        <div className="mt-4 border-t border-zinc-100 pt-4">
          <div className="mb-2 text-[11px] font-bold text-zinc-500">
            قوالب جاهزة للإضافة بضغطة واحدة (اختياري):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATION_TEMPLATES.map((tpl) => {
              const IconComp = getStationIconComponent(tpl.icon);
              const alreadyAdded = existingNamesSet.has(tpl.suggestedId);
              return (
                <button
                  key={tpl.suggestedId}
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    alreadyAdded ? openCreateModal(tpl) : handleQuickAddTemplate(tpl)
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[11px] font-bold text-zinc-800 transition hover:border-zinc-400 hover:bg-white disabled:opacity-50"
                >
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-md text-white"
                    style={{ backgroundColor: tpl.color }}
                  >
                    <IconComp className="h-2.5 w-2.5" />
                  </span>
                  <span>{tpl.name}</span>
                  {alreadyAdded ? (
                    <span className="text-[10px] text-emerald-700">+ نسخة</span>
                  ) : (
                    <span className="text-[10px] text-zinc-500">+ إضافة</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
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
          جاري تحميل الأقسام الرئيسية...
        </div>
      ) : stations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
          <p className="text-sm font-bold text-zinc-800">
            لم يتم إنشاء أقسام مخصصة بعد (سيعتمد النظام افتراضياً على المطبخ والبار والباستري حتى تبدأ بتخصيص أقسامك).
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            اضغط "تهيئة الأقسام الأساسية" أو أضف أي قسم من القوالب أعلاه لتفعيله فوراً.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {stations.map((st, idx) => {
            const IconComp = getStationIconComponent(st.icon);
            const activeOnStation = activeStaffCountByStation.get(st.stationId) || [];
            const activeState = st.isActive !== false;
            return (
              <div
                key={st.id}
                className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                  activeState
                    ? 'border-zinc-200 bg-white shadow-sm'
                    : 'border-zinc-200 bg-zinc-50 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                        style={{ backgroundColor: st.color || '#EA580C' }}
                      >
                        <IconComp className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-extrabold text-zinc-900">{st.name}</h4>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              activeState
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-zinc-200 text-zinc-700'
                            }`}
                          >
                            {activeState ? 'نشط' : 'موقف'}
                          </span>
                        </div>
                        {st.nameEn && (
                          <div className="text-[11px] font-medium text-zinc-500">{st.nameEn}</div>
                        )}
                        <div className="mt-0.5 font-mono text-[10px] text-zinc-400">
                          ID: {st.stationId}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, -1)}
                        title="تحريك للأعلى"
                        className="rounded-lg border border-zinc-200 p-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === stations.length - 1}
                        onClick={() => handleMove(idx, 1)}
                        title="تحريك للأسفل"
                        className="rounded-lg border border-zinc-200 p-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Active shift indicator for this station */}
                  <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2">
                    {activeOnStation.length > 0 ? (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1 font-bold text-emerald-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          {activeOnStation.length} موظف في الوردية الآن
                        </span>
                        <span className="truncate text-zinc-600 max-w-[140px]">
                          {activeOnStation.map((s) => s.staffName).join('، ')}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>لا يوجد موظف في وردية نشطة حالياً</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(st)}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-800 hover:bg-zinc-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      تعديل
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleToggleActive(st)}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {activeState ? (
                        <>
                          <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                          إيقاف
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
                          تفعيل
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleDelete(st)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" dir="rtl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h4 className="text-base font-extrabold text-zinc-900">
                {editingStation ? `تعديل قسم: ${editingStation.name}` : 'إضافة قسم تحضير رئيسي جديد'}
              </h4>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStation} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-zinc-700">
                    اسم القسم بالعربية *
                  </label>
                  <input
                    type="text"
                    required
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder="مثلاً: المشويات أو القهوة المختصة"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-bold text-zinc-900 focus:border-zinc-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-zinc-700">
                    الاسم بالإنجليزية (اختياري)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. Grill / Coffee"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 focus:border-zinc-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-zinc-700">لون التمييز في الشاشات</label>
                <div className="flex flex-wrap items-center gap-2">
                  {STATION_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setColor(preset)}
                      className={`h-7 w-7 rounded-lg transition ${
                        color === preset ? 'ring-2 ring-zinc-900 ring-offset-2 scale-110' : ''
                      }`}
                      style={{ backgroundColor: preset }}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-7 w-10 cursor-pointer rounded border border-zinc-200"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-zinc-700">أيقونة القسم</label>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                  {STATION_ICON_OPTIONS.map((opt) => {
                    const IconComp = getStationIconComponent(opt.id);
                    const selected = icon === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setIcon(opt.id)}
                        className={`flex items-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-bold transition ${
                          selected
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white'
                        }`}
                      >
                        <IconComp className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{opt.labelAr.split('(')[0].trim()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs font-bold text-zinc-800">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded accent-zinc-900"
                />
                تفعيل هذا القسم وإظهار شاشة KDS الخاصة به فوراً
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-5 py-2 text-xs font-extrabold text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editingStation ? 'حفظ التعديلات' : 'إنشاء القسم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
