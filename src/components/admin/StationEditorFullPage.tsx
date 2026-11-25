import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BellOff,
  Check,
  ChefHat,
  Clock,
  Eye,
  EyeOff,
  Home,
  Layers,
  Loader2,
  Printer,
  Save,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Utensils,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  DEFAULT_ALLOWED_ORDER_TYPES,
  DEFAULT_STATUS_BUTTONS,
  getStationIconComponent,
  resolveCategoryStations,
  resolveMenuItemStations,
  STATION_COLOR_PRESETS,
  STATION_ICON_OPTIONS,
  STATION_TEMPLATES,
  StationTemplate,
} from '../../lib/stationUtils';
import { saveRestaurantStation, syncStationMenuAssignments } from '../../lib/stationsService';
import {
  CaptainTableVisibilityScope,
  Category,
  Hall,
  KdsStatusButtonOption,
  MenuItem,
  OrderType,
  Restaurant,
  RestaurantStation,
  StaffActorInfo,
  StationIconName,
  StationScreenType,
  ThermalPrintMode,
} from '../../types/menu';

interface StationEditorFullPageProps {
  restaurant: Restaurant;
  actor: StaffActorInfo;
  initialStation?: RestaurantStation | null;
  initialTemplate?: StationTemplate | null;
  initialScreenType?: StationScreenType;
  existingStationsCount: number;
  fallbackStationId: string;
  halls: Hall[];
  categories: Category[];
  menuItems: MenuItem[];
  backLabel?: string;
  onCancel: () => void;
  onGoHome?: () => void;
  onSaved: (saved: RestaurantStation) => void;
}

export const StationEditorFullPage: React.FC<StationEditorFullPageProps> = ({
  restaurant,
  actor,
  initialStation = null,
  initialTemplate = null,
  initialScreenType,
  existingStationsCount,
  fallbackStationId,
  halls,
  categories,
  menuItems,
  backLabel,
  onCancel,
  onGoHome,
  onSaved,
}) => {
  const { lang, dir, loc } = useLanguage();
  const isEn = lang === 'en';
  const isEdit = Boolean(initialStation);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const initialCategoryLinks = useMemo(() => {
    if (!initialStation) return [] as string[];
    const stId = initialStation.stationId;
    return categories
      .filter((c) => resolveCategoryStations(c.id, categoryById, '').includes(stId))
      .map((c) => c.id);
  }, [initialStation, categories, categoryById]);

  const initialItemLinks = useMemo(() => {
    if (!initialStation) return [] as string[];
    const stId = initialStation.stationId;
    return menuItems
      .filter((it) => resolveMenuItemStations(it, categoryById, '').includes(stId))
      .map((it) => it.id);
  }, [initialStation, menuItems, categoryById]);

  const [screenType, setScreenType] = useState<StationScreenType>(
    initialStation?.screenType === 'captain' || initialScreenType === 'captain'
      ? 'captain'
      : 'prep'
  );
  const [nameAr, setNameAr] = useState(
    initialStation?.name ?? initialTemplate?.name ?? ''
  );
  const [nameEn, setNameEn] = useState(
    initialStation?.nameEn ?? initialTemplate?.nameEn ?? ''
  );
  const [color, setColor] = useState(
    initialStation?.color ||
      initialTemplate?.color ||
      STATION_COLOR_PRESETS[existingStationsCount % STATION_COLOR_PRESETS.length]
  );
  const [icon, setIcon] = useState<StationIconName>(
    initialStation?.icon ||
      initialTemplate?.icon ||
      (initialScreenType === 'captain' ? 'user-check' : 'chef-hat')
  );
  const [isActive, setIsActive] = useState(initialStation ? initialStation.isActive !== false : true);
  const [isDefaultFallback, setIsDefaultFallback] = useState(
    Boolean(initialStation?.isDefaultFallback)
  );
  const [showPrices, setShowPrices] = useState(Boolean(initialStation?.showPrices));
  const [allowedOrderTypes, setAllowedOrderTypes] = useState<OrderType[]>(
    initialStation?.allowedOrderTypes && initialStation.allowedOrderTypes.length > 0
      ? initialStation.allowedOrderTypes
      : [...DEFAULT_ALLOWED_ORDER_TYPES]
  );
  const [availableStatusButtons, setAvailableStatusButtons] = useState<KdsStatusButtonOption[]>(
    initialStation?.availableStatusButtons && initialStation.availableStatusButtons.length > 0
      ? initialStation.availableStatusButtons
      : [...DEFAULT_STATUS_BUTTONS]
  );
  const [soundAlertEnabled, setSoundAlertEnabled] = useState(
    initialStation ? initialStation.soundAlertEnabled !== false : true
  );
  const [overdueAlertMinutes, setOverdueAlertMinutes] = useState<number>(
    initialStation?.overdueAlertMinutes ?? 15
  );
  const [thermalPrintMode, setThermalPrintMode] = useState<ThermalPrintMode>(
    initialStation?.thermalPrintMode || 'manual'
  );

  // Prep linking
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(initialCategoryLinks);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(initialItemLinks);
  const [showItemPicker, setShowItemPicker] = useState(false);

  // Captain scope
  const [tableVisibilityScope, setTableVisibilityScope] = useState<CaptainTableVisibilityScope>(
    initialStation?.tableVisibilityScope === 'assigned_only' ? 'assigned_only' : 'all'
  );
  const [assignedHallIds, setAssignedHallIds] = useState<string[]>(
    initialStation?.assignedHallIds || []
  );
  const [assignedTableNumbers, setAssignedTableNumbers] = useState<string[]>(
    initialStation?.assignedTableNumbers || []
  );
  const [customTablesInput, setCustomTablesInput] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const applyTemplate = (tpl: StationTemplate) => {
    setScreenType('prep');
    setNameAr(tpl.name);
    setNameEn(tpl.nameEn);
    setColor(tpl.color);
    setIcon(tpl.icon);
  };

  const applyCaptainTemplate = (labelAr: string, labelEn: string, clr: string) => {
    setScreenType('captain');
    setNameAr(labelAr);
    setNameEn(labelEn);
    setColor(clr);
    setIcon('user-check');
    setIsDefaultFallback(false);
    setShowPrices(true);
  };

  const toggleOrderType = (ot: OrderType) => {
    setAllowedOrderTypes((prev) => {
      const exists = prev.includes(ot);
      if (exists && prev.length === 1) return prev;
      return exists ? prev.filter((x) => x !== ot) : [...prev, ot];
    });
  };

  const toggleStatusButton = (btn: KdsStatusButtonOption) => {
    setAvailableStatusButtons((prev) => {
      const exists = prev.includes(btn);
      if (exists && prev.length === 1) return prev;
      return exists ? prev.filter((x) => x !== btn) : [...prev, btn];
    });
  };

  const toggleCategoryLink = (catId: string) => {
    const childItemIds = menuItems.filter((it) => it.categoryId === catId).map((it) => it.id);
    setSelectedCategoryIds((prev) => {
      const exists = prev.includes(catId);
      const next = exists ? prev.filter((id) => id !== catId) : [...prev, catId];
      if (!exists) {
        setSelectedItemIds((cur) => Array.from(new Set([...cur, ...childItemIds])));
      } else {
        setSelectedItemIds((cur) => cur.filter((id) => !childItemIds.includes(id)));
      }
      return next;
    });
  };

  const toggleItemLink = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleHallId = (hallId: string) => {
    setAssignedHallIds((prev) =>
      prev.includes(hallId) ? prev.filter((id) => id !== hallId) : [...prev, hallId]
    );
  };

  const toggleTableNumber = (num: string) => {
    const clean = num.trim();
    if (!clean) return;
    setAssignedTableNumbers((prev) =>
      prev.includes(clean) ? prev.filter((t) => t !== clean) : [...prev, clean]
    );
  };

  const handleAddCustomTables = () => {
    const parts = customTablesInput
      .split(/[,،\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setAssignedTableNumbers((prev) => Array.from(new Set([...prev, ...parts])));
    setCustomTablesInput('');
  };

  const hallCandidateTables = useMemo(() => {
    const relevantHalls =
      assignedHallIds.length > 0
        ? halls.filter((h) => assignedHallIds.includes(h.id))
        : halls;
    const list: Array<{ tableNum: string; hallName: string }> = [];
    const seen = new Set<string>();
    relevantHalls.forEach((h) => {
      const nums =
        h.tableNumbers && h.tableNumbers.length > 0
          ? h.tableNumbers
          : Array.from({ length: Math.min(40, h.tableCount || 0) }, (_, i) => String(i + 1));
      nums.forEach((n) => {
        const clean = String(n).trim();
        if (clean && !seen.has(clean)) {
          seen.add(clean);
          list.push({ tableNum: clean, hallName: loc(h.name, h.name_en) });
        }
      });
    });
    return list.slice(0, 60);
  }, [halls, assignedHallIds, loc]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      const saved = await saveRestaurantStation({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        actor,
        station: {
          id: initialStation?.id,
          stationId: initialStation?.stationId,
          name: nameAr,
          nameEn,
          color,
          icon,
          screenType,
          isActive,
          isArchived: false,
          isDefaultFallback: screenType === 'prep' ? isDefaultFallback : false,
          showPrices,
          allowedOrderTypes,
          soundAlertEnabled,
          overdueAlertMinutes,
          thermalPrintMode: screenType === 'prep' ? thermalPrintMode : 'off',
          availableStatusButtons:
            screenType === 'prep' ? availableStatusButtons : ['preparing', 'ready', 'served'],
          assignedHallIds: screenType === 'captain' ? assignedHallIds : [],
          assignedTableNumbers: screenType === 'captain' ? assignedTableNumbers : [],
          tableVisibilityScope: screenType === 'captain' ? tableVisibilityScope : 'all',
          sortOrder: initialStation?.sortOrder ?? existingStationsCount + 1,
        },
      });

      if (screenType === 'prep') {
        await syncStationMenuAssignments({
          stationId: saved.stationId,
          fallbackStationId,
          categories,
          menuItems,
          selectedCategoryIds,
          selectedItemIds,
        });
      }

      onSaved(saved);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Unable to save screen configuration'
            : 'تعذر حفظ إعدادات الشاشة'
      );
    } finally {
      setSaving(false);
    }
  };

  const PreviewIcon = getStationIconComponent(icon);
  const BackArrow = isEn ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-5" dir={dir}>
      {/* Dedicated Top Navigation Bar: Back + Home + Title */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-xs font-extrabold text-zinc-800 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <BackArrow className="w-4 h-4 shrink-0" />
            <span>{backLabel || (isEn ? 'Back' : 'رجوع')}</span>
          </button>

          {onGoHome && (
            <button
              type="button"
              onClick={onGoHome}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Home className="w-4 h-4 shrink-0" />
              <span>{isEn ? 'Home' : 'الرئيسية'}</span>
            </button>
          )}

          <div className="ps-1">
            <h2 className="text-base sm:text-lg font-extrabold text-zinc-950">
              {isEdit
                ? isEn
                  ? `Edit Screen: ${loc(initialStation?.name || '', initialStation?.nameEn)}`
                  : `تعديل شاشة: ${loc(initialStation?.name || '', initialStation?.nameEn)}`
                : isEn
                  ? 'Add New Screen / Prep Station'
                  : 'إضافة شاشة أو محطة جديدة'}
            </h2>
            <p className="text-[11px] text-zinc-500">
              {isEn
                ? 'Choose screen type, link categories or floor tables, and customize alerts and printing.'
                : 'اختر نوع الشاشة (محطة تحضير أو شاشة كابتن) واضبط التوجيه، التنبيهات، والطباعة بالكامل.'}
            </p>
          </div>
        </div>

        <span
          className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold text-white inline-flex items-center gap-1.5"
          style={{ backgroundColor: color }}
        >
          <PreviewIcon className="w-3.5 h-3.5" />
          <span>
            {screenType === 'captain'
              ? isEn
                ? 'Captain / Floor Screen'
                : 'شاشة كابتن صالة'
              : isEn
                ? 'Prep Station (KDS)'
                : 'محطة تحضير KDS'}
          </span>
        </span>
      </div>

      {/* Quick Presets Bar on Create */}
      {!isEdit && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-zinc-800">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {isEn
                ? 'Quick Starter Presets (click to prefill settings):'
                : 'قوالب سريعة لتعبئة البيانات بضغطة واحدة:'}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATION_TEMPLATES.map((tpl) => {
              const IconComp = getStationIconComponent(tpl.icon);
              return (
                <button
                  key={tpl.suggestedId}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-800 hover:border-zinc-900 hover:bg-white cursor-pointer"
                >
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded text-white"
                    style={{ backgroundColor: tpl.color }}
                  >
                    <IconComp className="h-2.5 w-2.5" />
                  </span>
                  <span>{loc(tpl.name, tpl.nameEn)}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() =>
                applyCaptainTemplate('كابتن الصالة الرئيسية', 'Main Hall Captain', '#0D9488')
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-extrabold text-teal-900 hover:bg-teal-100 cursor-pointer"
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>{isEn ? 'Captain Screen Preset' : 'قالب شاشة كابتن صالة'}</span>
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Main Form Column */}
        <div className="lg:col-span-8 space-y-5">
          {/* 1. Screen Type & Name */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-zinc-950 flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-600" />
              <span>{isEn ? '1. Screen Type & Identity' : '1. نوع الشاشة والبيانات الأساسية'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isEdit}
                onClick={() => {
                  setScreenType('prep');
                  if (icon === 'user-check' || icon === 'bell-ring') setIcon('chef-hat');
                }}
                className={`p-4 rounded-2xl border text-start transition cursor-pointer disabled:cursor-default ${
                  screenType === 'prep'
                    ? 'border-zinc-950 bg-zinc-950 text-white shadow-sm'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-sm">
                  <ChefHat className="w-4 h-4 shrink-0" />
                  <span>{isEn ? 'Prep Station (KDS)' : 'محطة تحضير (KDS)'}</span>
                </div>
                <p
                  className={`text-[11px] mt-1 leading-relaxed ${
                    screenType === 'prep' ? 'text-zinc-300' : 'text-zinc-500'
                  }`}
                >
                  {isEn
                    ? 'Kitchen, Bakery, Grill, Bar, Sushi, Pastry... receives routed menu items with thermal tickets & prep tracking.'
                    : 'مطبخ، مخبز، شواية، بار، سوشي، باستري... تستقبل الأصناف الموجهة لها مع تذاكر الطباعة وحالات التجهيز.'}
                </p>
              </button>

              <button
                type="button"
                disabled={isEdit}
                onClick={() => {
                  setScreenType('captain');
                  setIsDefaultFallback(false);
                  if (icon === 'chef-hat') setIcon('user-check');
                }}
                className={`p-4 rounded-2xl border text-start transition cursor-pointer disabled:cursor-default ${
                  screenType === 'captain'
                    ? 'border-teal-700 bg-teal-700 text-white shadow-sm'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-sm">
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span>{isEn ? 'Captain Screen' : 'شاشة كابتن صالة'}</span>
                </div>
                <p
                  className={`text-[11px] mt-1 leading-relaxed ${
                    screenType === 'captain' ? 'text-teal-100' : 'text-zinc-500'
                  }`}
                >
                  {isEn
                    ? 'Dedicated floor screen scoped to specific halls or table numbers, assignable to specific captains.'
                    : 'شاشة خدمة صالة مخصصة لصالات أو أرقام طاولات محددة، وتُسند لحساب الكابتن المسؤول.'}
                </p>
              </button>
            </div>

            {isEdit && (
              <p className="text-[11px] text-zinc-500">
                {isEn
                  ? 'Screen type is locked after creation to preserve linked order history.'
                  : 'نوع الشاشة ثابت بعد الإنشاء للحفاظ على سلامة ربط الطلبات التاريخية.'}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <label className="space-y-1 block">
                <span className="text-xs font-bold text-zinc-800">
                  {isEn ? 'Screen Name (Arabic) *' : 'اسم الشاشة بالعربية *'}
                </span>
                <input
                  type="text"
                  required
                  dir="rtl"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder={
                    screenType === 'captain'
                      ? isEn
                        ? 'e.g. كابتن التراس'
                        : 'مثلاً: كابتن الصالة VIP / التراس'
                      : isEn
                        ? 'e.g. المخبز'
                        : 'مثلاً: المخبز / الشواية / السوشي'
                  }
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm font-bold text-zinc-900 focus:border-zinc-950 focus:outline-none"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-bold text-zinc-800">
                  {isEn ? 'Screen Name (English)' : 'الاسم بالإنجليزية (اختياري)'}
                </span>
                <input
                  type="text"
                  dir="ltr"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder={screenType === 'captain' ? 'e.g. Terrace Captain' : 'e.g. Bakery / Grill'}
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm font-medium text-zinc-900 text-left focus:border-zinc-950 focus:outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="space-y-2">
                <span className="block text-xs font-bold text-zinc-800">
                  {isEn ? 'Accent Color' : 'لون الشاشة المميز'}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {STATION_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setColor(preset)}
                      className={`h-7 w-7 rounded-lg transition cursor-pointer ${
                        color === preset ? 'ring-2 ring-zinc-950 ring-offset-2 scale-110' : ''
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

              <div className="space-y-2">
                <span className="block text-xs font-bold text-zinc-800">
                  {isEn ? 'Screen Icon' : 'أيقونة الشاشة'}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pe-1">
                  {STATION_ICON_OPTIONS.map((opt) => {
                    const IconComp = getStationIconComponent(opt.id);
                    const selected = icon === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setIcon(opt.id)}
                        className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-bold transition cursor-pointer ${
                          selected
                            ? 'border-zinc-950 bg-zinc-950 text-white'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white'
                        }`}
                      >
                        <IconComp className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {isEn ? opt.labelEn : opt.labelAr.split('(')[0].trim()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* 2A. Prep Station Routing & Category/Item Links */}
          {screenType === 'prep' ? (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-zinc-950 flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-orange-600" />
                  <span>
                    {isEn
                      ? '2. Menu Categories & Items Linked to This Station'
                      : '2. ربط أقسام وأصناف المنيو بهذه المحطة'}
                  </span>
                </h3>
                <span className="text-[11px] font-bold text-zinc-500 font-mono-num">
                  {isEn
                    ? `${selectedCategoryIds.length} categories · ${selectedItemIds.length} dishes`
                    : `${selectedCategoryIds.length} قسم · ${selectedItemIds.length} صنف`}
                </span>
              </div>

              <label className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefaultFallback}
                  onChange={(e) => setIsDefaultFallback(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-amber-700 shrink-0"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-amber-950 block">
                    {isEn
                      ? 'Set as Default Fallback Prep Station'
                      : 'تعيينها كمحطة افتراضية (Fallback) للأصناف غير المربوطة'}
                  </span>
                  <span className="text-[11px] text-amber-800 block leading-relaxed">
                    {isEn
                      ? 'Any category or dish without an explicit station automatically routes here. Enabling this replaces any previous fallback station.'
                      : 'أي صنف أو قسم غير مرتبط بمحطة محددة يتجه تلقائياً إلى هذه المحطة (يُلغي تفعيل الافتراضي عن المحطة السابقة تلقائياً).'}
                  </span>
                </div>
              </label>

              {categories.length === 0 ? (
                <p className="text-xs text-zinc-500 bg-zinc-50 border border-dashed border-zinc-200 rounded-xl p-3">
                  {isEn
                    ? 'No menu categories created yet. You can save this station now and link categories anytime from Menu Builder.'
                    : 'لا توجد أقسام منيو مضافة بعد. يمكنك حفظ المحطة الآن وربط الأقسام لاحقاً من إدارة المنيو.'}
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-zinc-700">
                    {isEn
                      ? 'Select categories that prepare on this screen (multi-station supported):'
                      : 'اختر الأقسام التي تُحضَّر على هذه الشاشة (يدعم توجيه نفس القسم لأكثر من محطة):'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pe-1">
                    {categories.map((cat) => {
                      const checked = selectedCategoryIds.includes(cat.id);
                      const parent = cat.parentId ? categoryById.get(cat.parentId) : undefined;
                      const label = parent
                        ? `${loc(parent.name, parent.name_en)} › ${loc(cat.name, cat.name_en)}`
                        : loc(cat.name, cat.name_en);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCategoryLink(cat.id)}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 text-start transition cursor-pointer ${
                            checked
                              ? 'bg-zinc-950 text-white border-zinc-950'
                              : 'bg-zinc-50 text-zinc-800 border-zinc-200 hover:bg-white'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                              checked
                                ? 'bg-white text-zinc-950 border-white'
                                : 'bg-white border-zinc-300'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3" />}
                          </span>
                          <span className="truncate">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {menuItems.length > 0 && (
                <div className="pt-1 border-t border-zinc-100 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowItemPicker((v) => !v)}
                    className="text-xs font-extrabold text-indigo-700 hover:underline cursor-pointer"
                  >
                    {showItemPicker
                      ? isEn
                        ? 'Hide individual dish overrides'
                        : 'إخفاء تخصيص الأصناف الفردية'
                      : isEn
                        ? `Customize specific dishes (${selectedItemIds.length} linked)`
                        : `تخصيص أصناف محددة يدوياً (${selectedItemIds.length} صنف مرتبط)`}
                  </button>

                  {showItemPicker && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-52 overflow-y-auto p-2 rounded-xl bg-zinc-50 border border-zinc-200">
                      {menuItems.map((it) => {
                        const checked = selectedItemIds.includes(it.id);
                        return (
                          <label
                            key={it.id}
                            className={`px-2.5 py-2 rounded-lg border text-[11px] font-bold flex items-center gap-2 cursor-pointer ${
                              checked
                                ? 'bg-white border-zinc-900 text-zinc-950'
                                : 'bg-transparent border-zinc-200 text-zinc-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleItemLink(it.id)}
                              className="w-3.5 h-3.5 accent-zinc-950 shrink-0"
                            />
                            <span className="truncate">{loc(it.name, it.name_en)}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          ) : (
            /* 2B. Captain Screen Hall & Table Scope */
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
              <h3 className="text-sm font-extrabold text-zinc-950 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-teal-600" />
                <span>
                  {isEn
                    ? '2. Assigned Halls & Table Numbers Scope'
                    : '2. نطاق الصالات وأرقام الطاولات المخصصة للكابتن'}
                </span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTableVisibilityScope('assigned_only')}
                  className={`p-3.5 rounded-xl border text-start cursor-pointer transition ${
                    tableVisibilityScope === 'assigned_only'
                      ? 'border-teal-700 bg-teal-50 text-teal-950'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <p className="text-xs font-extrabold">
                    {isEn ? 'Assigned Tables Only (Strict Focus)' : 'عرض الطاولات المخصصة فقط'}
                  </p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {isEn
                      ? 'Captain only sees tables, orders, and calls inside their assigned halls/tables.'
                      : 'لا يرى الكابتن إلا الطاولات والنداءات والطلبات التابعة لصالاته وأرقامه المحددة.'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTableVisibilityScope('all')}
                  className={`p-3.5 rounded-xl border text-start cursor-pointer transition ${
                    tableVisibilityScope === 'all'
                      ? 'border-teal-700 bg-teal-50 text-teal-950'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <p className="text-xs font-extrabold">
                    {isEn ? 'All Tables (Highlight Assigned)' : 'عرض جميع الطاولات مع تمييز طاولاته'}
                  </p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {isEn
                      ? 'Shows the full restaurant floor while pinning/highlighting this screen’s assigned zone.'
                      : 'يرى كامل خريطة الصالة للمساندة عند اللزوم مع تمييز واضح لطاولاته المسندة.'}
                  </p>
                </button>
              </div>

              {halls.length > 0 && (
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-zinc-800">
                    {isEn ? 'Assigned Halls:' : 'الصالات المخصصة لهذه الشاشة:'}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {halls.map((h) => {
                      const active = assignedHallIds.includes(h.id);
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => toggleHallId(h.id)}
                          className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                            active
                              ? 'bg-teal-700 text-white border-teal-700'
                              : 'bg-zinc-50 text-zinc-800 border-zinc-200 hover:bg-white'
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5" />}
                          <span>{loc(h.name, h.name_en)}</span>
                          <span className="text-[10px] opacity-75 font-mono-num">
                            ({h.tableCount})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-zinc-800">
                    {isEn
                      ? 'Specific Table Numbers (optional — leave empty to cover entire selected halls):'
                      : 'أرقام طاولات محددة (اختياري — اتركه فارغاً لتغطية كل طاولات الصالات المختارة):'}
                  </span>
                  {assignedTableNumbers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAssignedTableNumbers([])}
                      className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      {isEn ? 'Clear selection' : 'مسح الأرقام'}
                    </button>
                  )}
                </div>

                {hallCandidateTables.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                    {hallCandidateTables.map(({ tableNum, hallName }) => {
                      const active = assignedTableNumbers.includes(tableNum);
                      return (
                        <button
                          key={tableNum}
                          type="button"
                          onClick={() => toggleTableNumber(tableNum)}
                          title={hallName}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-mono-num font-bold cursor-pointer ${
                            active
                              ? 'bg-teal-700 text-white border-teal-700'
                              : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
                          }`}
                        >
                          #{tableNum}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={customTablesInput}
                    onChange={(e) => setCustomTablesInput(e.target.value)}
                    placeholder={isEn ? 'Add custom table numbers: e.g. 1, 2, VIP1' : 'أضف أرقام طاولات يدوياً مثل: 1, 2, VIP1'}
                    className="flex-1 px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono-num"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTables}
                    className="px-3.5 py-2 rounded-xl border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-xs font-bold cursor-pointer"
                  >
                    {isEn ? 'Add' : 'إضافة'}
                  </button>
                </div>

                {assignedTableNumbers.length > 0 && (
                  <p className="text-[11px] text-teal-800 font-bold">
                    {isEn ? 'Assigned tables:' : 'الطاولات المختارة:'}{' '}
                    <span className="font-mono-num" dir="ltr">
                      {assignedTableNumbers.join(', ')}
                    </span>
                  </p>
                )}
              </div>
            </section>
          )}

          {/* 3. Display, Order Types, Status Buttons, Sound & Thermal Print */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-zinc-950 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                {isEn
                  ? '3. Display Rules, Alerts & Thermal Printing'
                  : '3. خيارات العرض، التنبيهات، والطباعة الحرارية'}
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-xs font-bold text-zinc-800 cursor-pointer">
                <span className="flex items-center gap-2">
                  {showPrices ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-zinc-500" />}
                  <span>{isEn ? 'Show Item Prices on Screen' : 'إظهار أسعار الأصناف على الشاشة'}</span>
                </span>
                <input
                  type="checkbox"
                  checked={showPrices}
                  onChange={(e) => setShowPrices(e.target.checked)}
                  className="h-4 w-4 accent-zinc-950"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-xs font-bold text-zinc-800 cursor-pointer">
                <span className="flex items-center gap-2">
                  {soundAlertEnabled ? <Bell className="w-4 h-4 text-amber-600" /> : <BellOff className="w-4 h-4 text-zinc-500" />}
                  <span>{isEn ? 'Audio Sound Alert on New Order' : 'تنبيه صوتي عند وصول طلب جديد'}</span>
                </span>
                <input
                  type="checkbox"
                  checked={soundAlertEnabled}
                  onChange={(e) => setSoundAlertEnabled(e.target.checked)}
                  className="h-4 w-4 accent-zinc-950"
                />
              </label>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-bold text-zinc-800">
                {isEn ? 'Allowed Order Types Displayed:' : 'أنواع الطلبات التي تظهر في هذه الشاشة:'}
              </span>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'dine_in', ar: 'صالة (ترابيزات)', en: 'Dine-in' },
                    { id: 'pickup', ar: 'استلام (تيك أواي)', en: 'Pickup' },
                    { id: 'delivery', ar: 'توصيل (دليفري)', en: 'Delivery' },
                  ] as const
                ).map((ot) => {
                  const active = allowedOrderTypes.includes(ot.id);
                  return (
                    <button
                      key={ot.id}
                      type="button"
                      onClick={() => toggleOrderType(ot.id)}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                        active
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                      }`}
                    >
                      {active && <Check className="w-3.5 h-3.5" />}
                      <span>{isEn ? ot.en : ot.ar}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {screenType === 'prep' && (
              <>
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-zinc-800">
                    {isEn ? 'Available Status Buttons on Station KDS:' : 'أزرار تغيير الحالة المتاحة للشيف:'}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'preparing', ar: 'جاري التحضير', en: 'Preparing' },
                        { id: 'ready', ar: 'جاهز للتقديم', en: 'Ready' },
                        { id: 'served', ar: 'تم التسليم', en: 'Served' },
                      ] as const
                    ).map((btn) => {
                      const active = availableStatusButtons.includes(btn.id);
                      return (
                        <button
                          key={btn.id}
                          type="button"
                          onClick={() => toggleStatusButton(btn.id)}
                          className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                            active
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5" />}
                          <span>{isEn ? btn.en : btn.ar}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <label className="space-y-1 block">
                    <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>{isEn ? 'Overdue Order Alert (minutes)' : 'مهلة تأخير الطلب (بالدقائق)'}</span>
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={240}
                      dir="ltr"
                      value={overdueAlertMinutes}
                      onChange={(e) => setOverdueAlertMinutes(Math.max(1, Number(e.target.value) || 15))}
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-mono-num"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                      <Printer className="w-3.5 h-3.5 text-zinc-700" />
                      <span>{isEn ? 'Thermal Ticket Printing' : 'طباعة تذكرة المحطة الحرارية'}</span>
                    </span>
                    <select
                      value={thermalPrintMode}
                      onChange={(e) => setThermalPrintMode(e.target.value as ThermalPrintMode)}
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs font-bold bg-white"
                    >
                      <option value="manual">{isEn ? 'Manual Print Button' : 'يدوي (زر طباعة على الطلب)'}</option>
                      <option value="auto">{isEn ? 'Auto-Trigger Ticket on New Order' : 'تلقائي فور وصول طلب جديد'}</option>
                      <option value="off">{isEn ? 'Screen Only (No Ticket Print)' : 'عرض شاشة فقط (بدون طباعة)'}</option>
                    </select>
                  </label>
                </div>
              </>
            )}

            <label className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-xs font-bold text-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-zinc-950"
              />
              <span>
                {isEn
                  ? 'Activate this screen immediately and display it to staff'
                  : 'تفعيل هذه الشاشة فوراً وإتاحتها لحسابات الكادر والتشغيل'}
              </span>
            </label>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] px-5 py-2.5 rounded-xl border border-zinc-300 text-xs font-extrabold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              {backLabel || (isEn ? 'Cancel & Go Back' : 'إلغاء ورجوع')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>
                {isEdit
                  ? isEn
                    ? 'Save Screen Changes'
                    : 'حفظ تعديلات الشاشة'
                  : isEn
                    ? 'Create & Activate Screen'
                    : 'حفظ وإنشاء الشاشة فوراً'}
              </span>
            </button>
          </div>
        </div>

        {/* Sticky Live Preview Column */}
        <aside className="lg:col-span-4 lg:sticky lg:top-6 space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-xs">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
              {isEn ? 'Live Screen Card Preview' : 'معاينة بطاقة الشاشة'}
            </p>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm"
                  style={{ backgroundColor: color }}
                >
                  <PreviewIcon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-extrabold text-zinc-950 truncate">
                    {isEn ? nameEn || nameAr || 'New Screen' : nameAr || 'شاشة جديدة'}
                  </h4>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {screenType === 'captain'
                      ? isEn
                        ? 'Captain Floor Screen'
                        : 'شاشة كابتن صالة'
                      : isEn
                        ? 'KDS Preparation Station'
                        : 'محطة تحضير المطبخ'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                <span
                  className={`px-2 py-0.5 rounded-md ${
                    isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-700'
                  }`}
                >
                  {isActive ? (isEn ? 'Active' : 'نشطة') : isEn ? 'Paused' : 'متوقفة'}
                </span>
                {isDefaultFallback && screenType === 'prep' && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                    {isEn ? 'Default Fallback' : 'الافتراضية'}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md bg-white border border-zinc-200 text-zinc-700">
                  {showPrices
                    ? isEn
                      ? 'Prices Visible'
                      : 'الأسعار ظاهرة'
                    : isEn
                      ? 'Prices Hidden'
                      : 'بدون أسعار'}
                </span>
                {screenType === 'prep' ? (
                  <span className="px-2 py-0.5 rounded-md bg-white border border-zinc-200 text-zinc-700 font-mono-num">
                    {isEn ? `Alert >${overdueAlertMinutes}m` : `تأخير >${overdueAlertMinutes}د`}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-900">
                    {tableVisibilityScope === 'assigned_only'
                      ? isEn
                        ? 'Assigned Only'
                        : 'طاولاته فقط'
                      : isEn
                        ? 'All Tables'
                        : 'كل الطاولات'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
};
