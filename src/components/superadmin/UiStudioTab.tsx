import { DragEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Crown,
  Edit3,
  Eye,
  EyeOff,
  FolderPlus,
  GripVertical,
  Layout,
  Lock,
  Monitor,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { usePlatformUi } from '../../contexts/PlatformUiContext';
import {
  createDefaultScreenConfig,
  getRadiusClasses,
  normalizePlatformUiConfig,
  normalizeScreenConfig,
  SCREEN_META,
  SCREEN_THEMES,
  UI_ACTION_CATALOG,
} from '../../lib/platformUiDefaults';
import {
  CardRadiusStyle,
  PlatformUiConfig,
  ScreenLayoutStyle,
  ScreenThemeId,
  UiScreenId,
} from '../../types/uiStudio';

interface UiStudioTabProps {
  adminEmail: string;
}

const ALL_SCREEN_IDS: UiScreenId[] = [
  'owner_admin',
  'manager_console',
  'cashier_kds',
  'captain_waiter',
  'landing_page',
  'super_admin',
];

const ALL_THEME_IDS: ScreenThemeId[] = [
  'sand_sapphire',
  'obsidian_gold',
  'alabaster_editorial',
  'emerald_hospitality',
  'midnight_sapphire',
  'espresso_bistro',
  'nordic_slate',
  'burgundy_velvet',
  'saffron_sunrise',
];

export function UiStudioTab({ adminEmail }: UiStudioTabProps) {
  const { lang, dir } = useLanguage();
  const isEn = lang === 'en';
  const { uiConfig, publishPlatformUiConfig, triggerSimulatedRefreshTest } = usePlatformUi();

  const [draft, setDraft] = useState<PlatformUiConfig>(() => normalizePlatformUiConfig(uiConfig));
  const [selectedScreen, setSelectedScreen] = useState<UiScreenId>('owner_admin');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Double-click inline rename state
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardTitleArDraft, setCardTitleArDraft] = useState('');
  const [cardTitleEnDraft, setCardTitleEnDraft] = useState('');

  const [editingButtonId, setEditingButtonId] = useState<string | null>(null);
  const [btnLabelArDraft, setBtnLabelArDraft] = useState('');
  const [btnLabelEnDraft, setBtnLabelEnDraft] = useState('');

  // Drag and Drop state
  const [draggingButton, setDraggingButton] = useState<{
    buttonId: string;
    fromCardId: string;
  } | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dropTargetCardId, setDropTargetCardId] = useState<string | null>(null);
  const [dropTargetButtonId, setDropTargetButtonId] = useState<string | null>(null);

  const screenCfg = draft.screens[selectedScreen];
  const catalog = UI_ACTION_CATALOG[selectedScreen];
  const catalogMap = useMemo(() => {
    const map = new Map(catalog.map((c) => [c.id, c]));
    return map;
  }, [catalog]);

  const activeThemeBase = SCREEN_THEMES[screenCfg.themeId] || SCREEN_THEMES.sand_sapphire;
  const resolvedAccent = screenCfg.accentColorOverride || activeThemeBase.accentHex;
  const radiusCls = getRadiusClasses(screenCfg.cardRadius);

  const updateScreen = (updater: (prev: typeof screenCfg) => typeof screenCfg) => {
    setDraft((prev) => {
      const updatedScreen = normalizeScreenConfig(selectedScreen, updater(prev.screens[selectedScreen]));
      return {
        ...prev,
        screens: {
          ...prev.screens,
          [selectedScreen]: updatedScreen,
        },
      };
    });
    setHasUnsavedChanges(true);
    setStatusMsg(null);
  };

  const handleApplyThemeToAllScreens = (themeId: ScreenThemeId) => {
    setDraft((prev) => {
      const nextScreens = { ...prev.screens };
      ALL_SCREEN_IDS.forEach((sid) => {
        nextScreens[sid] = {
          ...nextScreens[sid],
          themeId,
          accentColorOverride: undefined,
        };
      });
      return { ...prev, screens: nextScreens };
    });
    setHasUnsavedChanges(true);
    setStatusMsg({
      type: 'ok',
      text: isEn
        ? `Theme "${SCREEN_THEMES[themeId].nameEn}" applied across all 6 screens. Click Publish to go live.`
        : `تم تطبيق ثيم "${SCREEN_THEMES[themeId].nameAr}" على جميع الشاشات الـ 6. اضغط "حفظ ونشر للجميع" لتفعيله فوراً.`,
    });
  };

  const handleResetScreen = () => {
    setDraft((prev) => ({
      ...prev,
      screens: {
        ...prev.screens,
        [selectedScreen]: createDefaultScreenConfig(selectedScreen),
      },
    }));
    setHasUnsavedChanges(true);
    setStatusMsg({
      type: 'ok',
      text: isEn
        ? 'Current screen reset to default cards and theme.'
        : 'تمت إعادة الشاشة المختارة إلى البطاقات والثيم الافتراضي.',
    });
  };

  // Card Create / Delete / Reorder / Double-click Rename
  const handleAddCard = () => {
    const newId = `card_custom_${Date.now().toString(36)}`;
    const nextIdx = screenCfg.cards.length + 1;
    updateScreen((prev) => ({
      ...prev,
      cards: [
        ...prev.cards,
        {
          id: newId,
          titleAr: `بطاقة جديدة ${nextIdx}`,
          titleEn: `New Group ${nextIdx}`,
          buttonIds: [],
        },
      ],
    }));
    setEditingCardId(newId);
    setCardTitleArDraft(`بطاقة جديدة ${nextIdx}`);
    setCardTitleEnDraft(`New Group ${nextIdx}`);
  };

  const handleDeleteCard = (cardId: string) => {
    if (screenCfg.cards.length <= 1) return;
    updateScreen((prev) => {
      const victim = prev.cards.find((c) => c.id === cardId);
      const remaining = prev.cards.filter((c) => c.id !== cardId);
      if (victim && victim.buttonIds.length > 0 && remaining.length > 0) {
        remaining[0] = {
          ...remaining[0],
          buttonIds: [...remaining[0].buttonIds, ...victim.buttonIds],
        };
      }
      return { ...prev, cards: remaining };
    });
  };

  const handleMoveCard = (cardId: string, dir: -1 | 1) => {
    updateScreen((prev) => {
      const idx = prev.cards.findIndex((c) => c.id === cardId);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.cards.length) return prev;
      const copy = [...prev.cards];
      const [moved] = copy.splice(idx, 1);
      copy.splice(target, 0, moved);
      return { ...prev, cards: copy };
    });
  };

  const startEditCard = (cardId: string, titleAr: string, titleEn: string) => {
    setEditingButtonId(null);
    setEditingCardId(cardId);
    setCardTitleArDraft(titleAr);
    setCardTitleEnDraft(titleEn);
  };

  const commitCardRename = () => {
    if (!editingCardId) return;
    const ar = cardTitleArDraft.trim();
    const en = cardTitleEnDraft.trim();
    updateScreen((prev) => ({
      ...prev,
      cards: prev.cards.map((c) =>
        c.id === editingCardId
          ? {
              ...c,
              titleAr: ar || c.titleAr,
              titleEn: en || c.titleEn,
            }
          : c
      ),
    }));
    setEditingCardId(null);
  };

  // Button Rename (Double-Click) / Move Across Cards / Reorder / Visibility
  const getBtnDisplayLabel = (btnId: string, forceLang?: 'ar' | 'en') => {
    const item = catalogMap.get(btnId);
    const ov = screenCfg.buttonOverrides[btnId];
    const targetLang = forceLang || (isEn ? 'en' : 'ar');
    if (targetLang === 'en') return ov?.labelEn || item?.defaultLabelEn || btnId;
    return ov?.labelAr || item?.defaultLabelAr || btnId;
  };

  const startEditButton = (btnId: string) => {
    setEditingCardId(null);
    setEditingButtonId(btnId);
    setBtnLabelArDraft(getBtnDisplayLabel(btnId, 'ar'));
    setBtnLabelEnDraft(getBtnDisplayLabel(btnId, 'en'));
  };

  const commitButtonRename = () => {
    if (!editingButtonId) return;
    const ar = btnLabelArDraft.trim();
    const en = btnLabelEnDraft.trim();
    updateScreen((prev) => ({
      ...prev,
      buttonOverrides: {
        ...prev.buttonOverrides,
        [editingButtonId]: {
          ...prev.buttonOverrides[editingButtonId],
          ...(ar ? { labelAr: ar } : {}),
          ...(en ? { labelEn: en } : {}),
        },
      },
    }));
    setEditingButtonId(null);
  };

  const handleToggleButtonVisibility = (btnId: string) => {
    const item = catalogMap.get(btnId);
    if (item?.lockedVisible) return;
    updateScreen((prev) => ({
      ...prev,
      buttonOverrides: {
        ...prev.buttonOverrides,
        [btnId]: {
          ...prev.buttonOverrides[btnId],
          hidden: !(prev.buttonOverrides[btnId]?.hidden === true),
        },
      },
    }));
  };

  const moveButtonBetweenCards = (
    buttonId: string,
    fromCardId: string,
    toCardId: string,
    insertBeforeButtonId?: string
  ) => {
    if (buttonId === insertBeforeButtonId) return;
    updateScreen((prev) => {
      // Allow empty custom cards temporarily in local draft by doing direct manipulation before normalize
      const nextCards = prev.cards.map((c) => ({ ...c, buttonIds: [...c.buttonIds] }));
      const source = nextCards.find((c) => c.id === fromCardId);
      const target = nextCards.find((c) => c.id === toCardId);
      if (!source || !target) return prev;

      source.buttonIds = source.buttonIds.filter((id) => id !== buttonId);
      if (insertBeforeButtonId) {
        const targetIdx = target.buttonIds.indexOf(insertBeforeButtonId);
        if (targetIdx >= 0) {
          target.buttonIds.splice(targetIdx, 0, buttonId);
        } else {
          target.buttonIds.push(buttonId);
        }
      } else {
        target.buttonIds.push(buttonId);
      }
      return { ...prev, cards: nextCards };
    });
  };

  const moveButtonStep = (cardId: string, buttonId: string, dir: -1 | 1) => {
    updateScreen((prev) => {
      const nextCards = prev.cards.map((c) => {
        if (c.id !== cardId) return c;
        const idx = c.buttonIds.indexOf(buttonId);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= c.buttonIds.length) return c;
        const arr = [...c.buttonIds];
        const [moved] = arr.splice(idx, 1);
        arr.splice(target, 0, moved);
        return { ...c, buttonIds: arr };
      });
      return { ...prev, cards: nextCards };
    });
  };

  // Drag & Drop handlers
  const handleButtonDragStart = (e: DragEvent, buttonId: string, fromCardId: string) => {
    e.stopPropagation();
    setDraggingCardId(null);
    setDraggingButton({ buttonId, fromCardId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `btn:${buttonId}`);
  };

  const handleCardDragStart = (e: DragEvent, cardId: string) => {
    setDraggingButton(null);
    setDraggingCardId(cardId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `card:${cardId}`);
  };

  const handleDropOnCard = (e: DragEvent, targetCardId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggingButton) {
      moveButtonBetweenCards(draggingButton.buttonId, draggingButton.fromCardId, targetCardId);
    } else if (draggingCardId && draggingCardId !== targetCardId) {
      updateScreen((prev) => {
        const fromIdx = prev.cards.findIndex((c) => c.id === draggingCardId);
        const toIdx = prev.cards.findIndex((c) => c.id === targetCardId);
        if (fromIdx < 0 || toIdx < 0) return prev;
        const copy = [...prev.cards];
        const [moved] = copy.splice(fromIdx, 1);
        copy.splice(toIdx, 0, moved);
        return { ...prev, cards: copy };
      });
    }
    setDraggingButton(null);
    setDraggingCardId(null);
    setDropTargetCardId(null);
    setDropTargetButtonId(null);
  };

  const handleDropOnButton = (e: DragEvent, targetCardId: string, targetButtonId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggingButton) {
      moveButtonBetweenCards(
        draggingButton.buttonId,
        draggingButton.fromCardId,
        targetCardId,
        targetButtonId
      );
    }
    setDraggingButton(null);
    setDropTargetCardId(null);
    setDropTargetButtonId(null);
  };

  const handlePublish = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const published = await publishPlatformUiConfig(draft, adminEmail);
      setDraft(published);
      setHasUnsavedChanges(false);
      setStatusMsg({
        type: 'ok',
        text: isEn
          ? `Published v${published.version}! All connected screens are updating gently in 2 seconds with zero data loss.`
          : `تم نشر التحديث بنجاح (الإصدار v${published.version})! يتم الآن تحديث جميع الشاشات تلقائياً خلال ثانيتين دون أي تأثير على عمل المطاعم.`,
      });
    } catch (err) {
      const errCode =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      const rawMsg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      const isPermDenied =
        errCode.includes('permission-denied') ||
        rawMsg.includes('missing or insufficient permissions') ||
        rawMsg.includes('permission-denied');
      const isUnauth =
        errCode.includes('unauthenticated') || rawMsg.includes('unauthenticated');
      const isOffline =
        errCode.includes('unavailable') ||
        rawMsg.includes('offline') ||
        rawMsg.includes('network');

      let friendlyMsg: string;
      if (isPermDenied) {
        friendlyMsg = isEn
          ? 'Could not save to the database because permissions were denied for this payload or account. Your unsaved edits are still kept on screen — please ensure you are signed in as Super Admin and try again.'
          : 'تعذر حفظ التغييرات في قاعدة البيانات بسبب رفض الصلاحية لهذا الحساب أو البيانات المرسلة. لا تزال تعديلاتك محفوظة في المسودة على الشاشة — تأكد من تسجيل الدخول بحساب السوبر أدمن وحاول مرة أخرى.';
      } else if (isUnauth) {
        friendlyMsg = isEn
          ? 'Your sign-in session has expired. Your edits are still on screen — please sign in again and republish.'
          : 'انتهت جلسة تسجيل الدخول الحالية. تعديلاتك ما زالت محفوظة على الشاشة — أعد تسجيل الدخول ثم اضغط نشر مجدداً.';
      } else if (isOffline) {
        friendlyMsg = isEn
          ? 'Could not reach the server due to a connection issue. Your edits remain on screen so you can retry once connected.'
          : 'تعذر الاتصال بالخادم حالياً. تعديلاتك ما زالت محفوظة في المسودة ويمكنك إعادة المحاولة فور عودة الاتصال.';
      } else {
        friendlyMsg = isEn
          ? 'Could not save and publish UI settings. Your unsaved edits remain on screen — please retry.'
          : 'تعذر حفظ ونشر إعدادات الواجهة. تعديلاتك ما زالت محفوظة على الشاشة ويمكنك المحاولة مرة أخرى.';
      }

      setHasUnsavedChanges(true);
      setStatusMsg({
        type: 'err',
        text: friendlyMsg,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir={dir} className="space-y-6">
      {/* Studio Command Header */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-extrabold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isEn ? 'Live UI Studio & Theme Engine' : 'استوديو الواجهات والثيمات الحي'}</span>
              </span>
              <span className="font-mono-num text-[11px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700">
                v{uiConfig.version}
              </span>
              {hasUnsavedChanges && (
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700">
                  {isEn ? 'Unsaved draft' : 'مسودة غير منشورة'}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-zinc-950">
              {isEn
                ? 'Customize Screens, Drag Cards & Publish Global Themes'
                : 'تحكم في كل الشاشات والبطاقات والأزرار والثيمات العالمية'}
            </h2>
            <p className="text-xs text-zinc-500 max-w-3xl leading-relaxed">
              {isEn
                ? 'Drag and drop buttons across cards, double-click any card or button title to rename it, choose curated themes, and publish instantly across all active screens without disrupting any live order or shift.'
                : 'اسحب وأفلت الأزرار بين البطاقات، أو اضغط مرتين لتغيير اسم أي زر أو بطاقة، أنشئ بطاقات جديدة، واختر من الثيمات العالمية الفاخرة وانشر التحديث فوراً للجميع بدون أي خروج أو ضياع لأي شغل مفتوح.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                triggerSimulatedRefreshTest(draft.refreshNoticeAr, draft.refreshNoticeEn)
              }
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isEn ? 'Preview 2s Notice' : 'معاينة رسالة الـ 2 ثانية'}</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handlePublish}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <Save className="w-4 h-4 text-amber-400" />
              )}
              <span>{isEn ? 'Save & Publish Globally' : 'حفظ ونشر للجميع مباشرة'}</span>
            </button>
          </div>
        </div>

        {statusMsg && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
              statusMsg.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMsg.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMsg(null)}
              className="p-1 rounded hover:bg-black/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Screen Picker Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
          {ALL_SCREEN_IDS.map((sid) => {
            const meta = SCREEN_META[sid];
            const sCfg = draft.screens[sid];
            const th = SCREEN_THEMES[sCfg.themeId] || SCREEN_THEMES.sand_sapphire;
            const active = selectedScreen === sid;
            return (
              <button
                key={sid}
                type="button"
                onClick={() => {
                  setSelectedScreen(sid);
                  setEditingCardId(null);
                  setEditingButtonId(null);
                }}
                className={`p-3 rounded-xl border text-start transition-all cursor-pointer space-y-1.5 ${
                  active
                    ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-800 hover:bg-white hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {th.previewSwatches.map((hex, idx) => (
                      <span
                        key={idx}
                        className="w-2.5 h-2.5 rounded-full border border-black/15"
                        style={{ backgroundColor: idx === 1 && sCfg.accentColorOverride ? sCfg.accentColorOverride : hex }}
                      />
                    ))}
                  </div>
                  {sid === 'super_admin' && (
                    <Crown className={`w-3.5 h-3.5 ${active ? 'text-amber-400' : 'text-amber-600'}`} />
                  )}
                </div>
                <p className="text-xs font-extrabold truncate">
                  {isEn ? meta.labelEn : meta.labelAr}
                </p>
                <p className={`text-[10px] truncate ${active ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  {isEn ? th.nameEn : th.nameAr}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split Workspace: Controls + Live Interactive Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Editor Column (7 cols on XL) */}
        <div className="xl:col-span-7 space-y-5">
          {/* 1. World-Class Themes Gallery */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-extrabold text-zinc-950">
                  {isEn
                    ? `Preset Themes for: ${SCREEN_META[selectedScreen].labelEn}`
                    : `ثيمات عالمية مختارة لـ: ${SCREEN_META[selectedScreen].labelAr}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => handleApplyThemeToAllScreens(screenCfg.themeId)}
                className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>{isEn ? 'Apply Current Theme to All Screens' : 'تطبيق الثيم على كل الشاشات'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ALL_THEME_IDS.map((tid) => {
                const th = SCREEN_THEMES[tid];
                const isSelected = screenCfg.themeId === tid;
                return (
                  <div
                    key={tid}
                    onClick={() =>
                      updateScreen((prev) => ({
                        ...prev,
                        themeId: tid,
                        accentColorOverride: undefined,
                      }))
                    }
                    className={`rounded-2xl border p-3.5 cursor-pointer transition-all space-y-2.5 ${
                      isSelected
                        ? 'border-zinc-950 ring-2 ring-zinc-950/15 bg-zinc-50/70'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white'
                    }`}
                  >
                    {/* Live Micro Mockup Bar */}
                    <div
                      className="h-12 rounded-xl overflow-hidden border flex"
                      style={{ borderColor: th.surfaceBorder, backgroundColor: th.canvasBg }}
                    >
                      <div
                        className="w-10 h-full p-1.5 flex flex-col gap-1"
                        style={{ backgroundColor: th.sidebarBg }}
                      >
                        <span
                          className="h-2 rounded-xs w-full"
                          style={{ backgroundColor: th.sidebarActiveBg }}
                        />
                        <span
                          className="h-1.5 rounded-xs w-3/4 opacity-40"
                          style={{ backgroundColor: th.sidebarText }}
                        />
                        <span
                          className="h-1.5 rounded-xs w-2/3 opacity-30"
                          style={{ backgroundColor: th.sidebarText }}
                        />
                      </div>
                      <div className="flex-1 p-1.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span
                            className="h-2 w-12 rounded-xs"
                            style={{ backgroundColor: th.surfaceText, opacity: 0.8 }}
                          />
                          <span
                            className="h-2.5 w-6 rounded-xs"
                            style={{ backgroundColor: th.accentHex }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <span
                            className="h-3.5 rounded-xs border"
                            style={{ backgroundColor: th.surfaceBg, borderColor: th.surfaceBorder }}
                          />
                          <span
                            className="h-3.5 rounded-xs border"
                            style={{ backgroundColor: th.surfaceBg, borderColor: th.surfaceBorder }}
                          />
                          <span
                            className="h-3.5 rounded-xs border"
                            style={{ backgroundColor: th.surfaceBg, borderColor: th.surfaceBorder }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-zinc-950 truncate">
                          {isEn ? th.nameEn : th.nameAr}
                        </p>
                        <p className="text-[11px] text-zinc-500 line-clamp-1">
                          {isEn ? th.taglineEn : th.taglineAr}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-zinc-950 text-amber-400 flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Layout Architecture, Radius, Accent Color & Default Page */}
            <div className="pt-3 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-zinc-700 flex items-center gap-1">
                  <Layout className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{isEn ? 'Navigation Style' : 'نظام عرض البطاقات'}</span>
                </label>
                <div className="grid grid-cols-3 gap-1 bg-zinc-100 p-1 rounded-xl">
                  {(
                    [
                      { id: 'sidebar_cards', labelAr: 'بطاقات جانبية', labelEn: 'Cards' },
                      { id: 'compact_rail', labelAr: 'جانبي مدمج', labelEn: 'Rail' },
                      { id: 'top_deck', labelAr: 'شريط علوي', labelEn: 'Top' },
                    ] as { id: ScreenLayoutStyle; labelAr: string; labelEn: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateScreen((p) => ({ ...p, layoutStyle: opt.id }))}
                      className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition-colors ${
                        screenCfg.layoutStyle === opt.id
                          ? 'bg-white text-zinc-950 shadow-2xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      {isEn ? opt.labelEn : opt.labelAr}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-zinc-700">
                  {isEn ? 'Corner Geometry' : 'انحناء الزوايا والحواف'}
                </label>
                <div className="grid grid-cols-3 gap-1 bg-zinc-100 p-1 rounded-xl">
                  {(
                    [
                      { id: 'sharp', labelAr: 'حاد', labelEn: 'Sharp' },
                      { id: 'rounded', labelAr: 'متوازن', labelEn: 'Std' },
                      { id: 'soft', labelAr: 'ناعم', labelEn: 'Soft' },
                    ] as { id: CardRadiusStyle; labelAr: string; labelEn: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateScreen((p) => ({ ...p, cardRadius: opt.id }))}
                      className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition-colors ${
                        screenCfg.cardRadius === opt.id
                          ? 'bg-white text-zinc-950 shadow-2xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      {isEn ? opt.labelEn : opt.labelAr}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-zinc-700">
                  {isEn ? 'Custom Accent Override' : 'لون التمييز المخصص'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={resolvedAccent}
                    onChange={(e) =>
                      updateScreen((p) => ({ ...p, accentColorOverride: e.target.value }))
                    }
                    className="w-9 h-8 rounded-lg border border-zinc-200 cursor-pointer bg-white p-0.5"
                  />
                  <span className="font-mono-num text-[11px] font-bold text-zinc-700" dir="ltr">
                    {resolvedAccent}
                  </span>
                  {screenCfg.accentColorOverride && (
                    <button
                      type="button"
                      onClick={() =>
                        updateScreen((p) => ({ ...p, accentColorOverride: undefined }))
                      }
                      className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 underline cursor-pointer"
                    >
                      {isEn ? 'Reset' : 'افتراضي'}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-zinc-700 block">
                  {isEn ? 'Default Starting Page' : 'الصفحة الافتراضية عند الفتح'}
                </label>
                <select
                  value={screenCfg.defaultPageId || ''}
                  onChange={(e) =>
                    updateScreen((p) => ({ ...p, defaultPageId: e.target.value || undefined }))
                  }
                  className="w-full min-h-[34px] px-2.5 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-900 focus:outline-none focus:border-zinc-900"
                >
                  <option value="">
                    {isEn ? 'Automatic (First Page)' : 'تلقائي (الشاشة الأولى)'}
                  </option>
                  {(UI_ACTION_CATALOG[selectedScreen] || []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {getBtnDisplayLabel(item.id)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Drag & Drop + Double-Click Card & Button Organizer */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-zinc-950">
                  {isEn
                    ? 'Cards & Buttons Organizer (Drag & Drop + Double-Click Rename)'
                    : 'ترتيب البطاقات والأزرار (سحب وإفلات + ضغط مزدوج لتغيير الاسم)'}
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {isEn
                    ? 'Double-click any card header or button label to rename it safely without affecting permissions or routes.'
                    : 'اسحب أي زر وأفلته داخل بطاقة أخرى، أو اضغط مرتين على اسم البطاقة أو الزر لتعديله بدون تغيير البرمجة.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetScreen}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 text-[11px] font-bold text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Reset Screen' : 'إعادة الافتراضي'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddCard}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-[11px] font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isEn ? '+ New Card' : '+ إنشاء بطاقة جديدة'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {screenCfg.cards.map((card, cardIdx) => {
                const isCardDropping = dropTargetCardId === card.id;
                const isEditingCard = editingCardId === card.id;

                return (
                  <div
                    key={card.id}
                    draggable={!isEditingCard}
                    onDragStart={(e) => handleCardDragStart(e, card.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropTargetCardId(card.id);
                    }}
                    onDragLeave={() => {
                      if (dropTargetCardId === card.id) setDropTargetCardId(null);
                    }}
                    onDrop={(e) => handleDropOnCard(e, card.id)}
                    className={`rounded-2xl border p-3.5 transition-all space-y-3 ${
                      isCardDropping
                        ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-400/30'
                        : 'border-zinc-200 bg-zinc-50/60'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          title={isEn ? 'Drag to reorder card' : 'اسحب لإعادة ترتيب البطاقة'}
                          className="p-1 text-zinc-400 hover:text-zinc-700 cursor-grab active:cursor-grabbing shrink-0"
                        >
                          <GripVertical className="w-4 h-4" />
                        </span>

                        {isEditingCard ? (
                          <div className="flex flex-wrap items-center gap-1.5 flex-1">
                            <input
                              type="text"
                              dir="rtl"
                              autoFocus
                              value={cardTitleArDraft}
                              onChange={(e) => setCardTitleArDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitCardRename();
                                if (e.key === 'Escape') setEditingCardId(null);
                              }}
                              placeholder={isEn ? 'Arabic Card Title' : 'اسم البطاقة بالعربي'}
                              className="px-2.5 py-1 rounded-lg border border-zinc-300 bg-white text-xs font-bold text-zinc-950 min-w-[140px]"
                            />
                            <input
                              type="text"
                              dir="ltr"
                              value={cardTitleEnDraft}
                              onChange={(e) => setCardTitleEnDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitCardRename();
                                if (e.key === 'Escape') setEditingCardId(null);
                              }}
                              placeholder={isEn ? 'English Card Title' : 'اسم البطاقة بالإنجليزي'}
                              className="px-2.5 py-1 rounded-lg border border-zinc-300 bg-white text-xs font-semibold text-zinc-800 min-w-[130px]"
                            />
                            <button
                              type="button"
                              onClick={commitCardRename}
                              className="px-2.5 py-1 rounded-lg bg-zinc-950 text-white text-[11px] font-bold cursor-pointer"
                            >
                              {isEn ? 'Save' : 'حفظ'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCardId(null)}
                              className="p-1 rounded-lg text-zinc-500 hover:bg-zinc-200 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onDoubleClick={() => startEditCard(card.id, card.titleAr, card.titleEn)}
                            title={
                              isEn
                                ? 'Double-click to rename card'
                                : 'اضغط مرتين لتعديل اسم البطاقة'
                            }
                            className="flex items-center gap-2 min-w-0 cursor-text select-none group"
                          >
                            <span className="text-xs font-extrabold text-zinc-950 truncate">
                              {isEn ? card.titleEn : card.titleAr}
                            </span>
                            <span className="text-[10px] font-mono-num text-zinc-400">
                              ({card.buttonIds.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => startEditCard(card.id, card.titleAr, card.titleEn)}
                              className="p-1 rounded hover:bg-zinc-200/70 text-zinc-400 hover:text-zinc-800 cursor-pointer"
                              aria-label={isEn ? 'Rename card' : 'تعديل اسم البطاقة'}
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={cardIdx === 0}
                          onClick={() => handleMoveCard(card.id, -1)}
                          className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 disabled:opacity-35 cursor-pointer"
                          title={isEn ? 'Move card up' : 'تحريك لأعلى'}
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={cardIdx === screenCfg.cards.length - 1}
                          onClick={() => handleMoveCard(card.id, 1)}
                          className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 disabled:opacity-35 cursor-pointer"
                          title={isEn ? 'Move card down' : 'تحريك لأسفل'}
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        {screenCfg.cards.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCard(card.id)}
                            className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                            title={
                              isEn
                                ? 'Delete card (buttons safely move to first card)'
                                : 'حذف البطاقة (تنتقل الأزرار بأمان للبطاقة الأولى)'
                            }
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Buttons List Inside Card */}
                    <div className="space-y-2">
                      {card.buttonIds.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-zinc-300 bg-white/70 text-center text-[11px] font-semibold text-zinc-500">
                          {isEn
                            ? 'Drop any button here, or use the "Move to..." menu on any button'
                            : 'اسحب أي زر وأفلته هنا، أو اختر هذه البطاقة من قائمة النقل داخل أي زر'}
                        </div>
                      ) : (
                        card.buttonIds.map((btnId, bIdx) => {
                          const cat = catalogMap.get(btnId);
                          const isHidden = !cat?.lockedVisible && screenCfg.buttonOverrides[btnId]?.hidden === true;
                          const isEditingBtn = editingButtonId === btnId;
                          const isBtnDropping = dropTargetButtonId === btnId;

                          return (
                            <div
                              key={btnId}
                              draggable={!isEditingBtn}
                              onDragStart={(e) => handleButtonDragStart(e, btnId, card.id)}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDropTargetButtonId(btnId);
                              }}
                              onDragLeave={() => {
                                if (dropTargetButtonId === btnId) setDropTargetButtonId(null);
                              }}
                              onDrop={(e) => handleDropOnButton(e, card.id, btnId)}
                              className={`rounded-xl border px-3 py-2.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${
                                isBtnDropping
                                  ? 'border-amber-500 ring-2 ring-amber-400/30'
                                  : 'border-zinc-200 hover:border-zinc-300'
                              } ${isHidden ? 'opacity-55' : ''}`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span
                                  className="text-zinc-400 hover:text-zinc-700 cursor-grab active:cursor-grabbing shrink-0"
                                  title={isEn ? 'Drag button' : 'اسحب الزر للنقل أو الترتيب'}
                                >
                                  <GripVertical className="w-4 h-4" />
                                </span>

                                {isEditingBtn ? (
                                  <div className="flex flex-wrap items-center gap-1.5 flex-1">
                                    <input
                                      type="text"
                                      dir="rtl"
                                      autoFocus
                                      value={btnLabelArDraft}
                                      onChange={(e) => setBtnLabelArDraft(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') commitButtonRename();
                                        if (e.key === 'Escape') setEditingButtonId(null);
                                      }}
                                      placeholder={isEn ? 'Arabic Label' : 'الاسم بالعربي'}
                                      className="px-2 py-1 rounded-lg border border-zinc-300 text-xs font-bold text-zinc-950 min-w-[130px]"
                                    />
                                    <input
                                      type="text"
                                      dir="ltr"
                                      value={btnLabelEnDraft}
                                      onChange={(e) => setBtnLabelEnDraft(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') commitButtonRename();
                                        if (e.key === 'Escape') setEditingButtonId(null);
                                      }}
                                      placeholder={isEn ? 'English Label' : 'الاسم بالإنجليزي'}
                                      className="px-2 py-1 rounded-lg border border-zinc-300 text-xs font-semibold text-zinc-800 min-w-[120px]"
                                    />
                                    <button
                                      type="button"
                                      onClick={commitButtonRename}
                                      className="px-2.5 py-1 rounded-lg bg-zinc-950 text-white text-[11px] font-bold cursor-pointer"
                                    >
                                      {isEn ? 'Apply' : 'حفظ'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingButtonId(null)}
                                      className="p-1 rounded text-zinc-500 hover:bg-zinc-100 cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div
                                    onDoubleClick={() => startEditButton(btnId)}
                                    title={
                                      isEn
                                        ? 'Double-click to rename button'
                                        : 'اضغط مرتين لتغيير اسم الزر'
                                    }
                                    className="flex items-center gap-2 min-w-0 flex-1 cursor-text select-none"
                                  >
                                    <span className="text-xs font-bold text-zinc-900 truncate">
                                      {getBtnDisplayLabel(btnId)}
                                    </span>
                                    <span
                                      dir="ltr"
                                      className="font-mono-num text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 shrink-0"
                                    >
                                      #{btnId}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => startEditButton(btnId)}
                                      className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-800 cursor-pointer shrink-0"
                                      aria-label={isEn ? 'Rename button' : 'تعديل اسم الزر'}
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Quick Move Card Select + Reorder + Visibility */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {screenCfg.cards.length > 1 && (
                                  <select
                                    value={card.id}
                                    onChange={(e) => {
                                      const toCard = e.target.value;
                                      if (toCard && toCard !== card.id) {
                                        moveButtonBetweenCards(btnId, card.id, toCard);
                                      }
                                    }}
                                    aria-label={isEn ? 'Move button to card' : 'نقل الزر لبطاقة'}
                                    className="px-2 py-1 rounded-lg border border-zinc-200 bg-zinc-50 text-[10px] font-bold text-zinc-700 cursor-pointer max-w-[125px]"
                                  >
                                    {screenCfg.cards.map((cOpt) => (
                                      <option key={cOpt.id} value={cOpt.id}>
                                        {isEn ? cOpt.titleEn : cOpt.titleAr}
                                      </option>
                                    ))}
                                  </select>
                                )}

                                <button
                                  type="button"
                                  disabled={bIdx === 0}
                                  onClick={() => moveButtonStep(card.id, btnId, -1)}
                                  className="p-1 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={bIdx === card.buttonIds.length - 1}
                                  onClick={() => moveButtonStep(card.id, btnId, 1)}
                                  className="p-1 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>

                                <button
                                  type="button"
                                  disabled={Boolean(cat?.lockedVisible)}
                                  onClick={() => handleToggleButtonVisibility(btnId)}
                                  title={
                                    cat?.lockedVisible
                                      ? isEn
                                        ? 'Core control locked visible'
                                        : 'زر أساسي محمي لا يمكن إخفاؤه'
                                      : isHidden
                                        ? isEn
                                          ? 'Show button'
                                          : 'إظهار الزر'
                                        : isEn
                                          ? 'Hide button'
                                          : 'إخفاء مؤقت'
                                  }
                                  className={`p-1.5 rounded-lg border cursor-pointer ${
                                    cat?.lockedVisible
                                      ? 'border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed'
                                      : isHidden
                                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  {cat?.lockedVisible ? (
                                    <Lock className="w-3 h-3" />
                                  ) : isHidden ? (
                                    <EyeOff className="w-3 h-3" />
                                  ) : (
                                    <Eye className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Refresh Notice Configuration */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-zinc-950">
              {isEn
                ? 'Live 2-Second Update Message (Shown on Active Screens)'
                : 'الرسالة اللطيفة عند النشر المباشر (تظهر ثانيتين دون التأثير على أي عمل)'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-xs font-bold text-zinc-700">
                <span>{isEn ? 'Arabic Message' : 'النص بالعربية'}</span>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={draft.refreshNoticeAr}
                  onChange={(e) => {
                    setDraft((p) => ({ ...p, refreshNoticeAr: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </label>
              <label className="space-y-1 text-xs font-bold text-zinc-700">
                <span>{isEn ? 'English Message' : 'النص بالإنجليزية'}</span>
                <textarea
                  rows={2}
                  dir="ltr"
                  value={draft.refreshNoticeEn}
                  onChange={(e) => {
                    setDraft((p) => ({ ...p, refreshNoticeEn: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right Live Preview Column (5 cols on XL) */}
        <div className="xl:col-span-5 xl:sticky xl:top-4 space-y-3">
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-extrabold text-zinc-950">
                  {isEn ? 'Live Screen Preview' : 'معاينة حية للشاشة المختارة'}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {isEn ? SCREEN_META[selectedScreen].labelEn : SCREEN_META[selectedScreen].labelAr}
                </p>
              </div>
              <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1.5 rounded-lg cursor-pointer ${
                    previewDevice === 'desktop' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-500'
                  }`}
                  aria-label={isEn ? 'Desktop Preview' : 'معاينة سطح المكتب'}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1.5 rounded-lg cursor-pointer ${
                    previewDevice === 'mobile' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-500'
                  }`}
                  aria-label={isEn ? 'Mobile Preview' : 'معاينة الجوال'}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Miniature Interactive Viewport */}
            <div
              className={`mx-auto border overflow-hidden transition-all ${radiusCls.card} ${
                previewDevice === 'mobile' ? 'max-w-[320px]' : 'w-full'
              }`}
              style={{
                backgroundColor: activeThemeBase.canvasBg,
                borderColor: activeThemeBase.surfaceBorder,
                color: activeThemeBase.canvasText,
                boxShadow: activeThemeBase.cardShadow,
              }}
            >
              {/* Simulated Header */}
              <div
                className="px-3.5 py-2.5 border-b flex items-center justify-between gap-2"
                style={{
                  backgroundColor: activeThemeBase.headerBg,
                  borderColor: activeThemeBase.headerBorder,
                  color: activeThemeBase.headerText,
                }}
              >
                <span className="text-[11px] font-extrabold truncate">
                  {isEn ? SCREEN_META[selectedScreen].labelEn : SCREEN_META[selectedScreen].labelAr}
                </span>
                <span
                  className={`px-2 py-0.5 text-[9px] font-extrabold ${radiusCls.pill}`}
                  style={{
                    backgroundColor: resolvedAccent,
                    color: activeThemeBase.accentTextHex,
                  }}
                >
                  {isEn ? activeThemeBase.nameEn : activeThemeBase.nameAr}
                </span>
              </div>

              {/* Simulated Shell */}
              {screenCfg.layoutStyle === 'top_deck' || previewDevice === 'mobile' ? (
                <div className="p-3 space-y-2.5">
                  {screenCfg.cards.map((card) => {
                    const visibleBtns = card.buttonIds.filter(
                      (id) => catalogMap.get(id)?.lockedVisible || screenCfg.buttonOverrides[id]?.hidden !== true
                    );
                    if (visibleBtns.length === 0) return null;
                    return (
                      <div
                        key={card.id}
                        className={`p-2.5 border space-y-2 ${radiusCls.card}`}
                        style={{
                          backgroundColor: activeThemeBase.surfaceBg,
                          borderColor: activeThemeBase.surfaceBorder,
                        }}
                      >
                        <p
                          className="text-[10px] font-extrabold"
                          style={{ color: activeThemeBase.mutedText }}
                        >
                          {isEn ? card.titleEn : card.titleAr}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {visibleBtns.map((bid, idx) => (
                            <span
                              key={bid}
                              className={`px-2.5 py-1 text-[10px] font-extrabold border ${radiusCls.button}`}
                              style={
                                idx === 0 && card.id === screenCfg.cards[0]?.id
                                  ? {
                                      backgroundColor: resolvedAccent,
                                      borderColor: resolvedAccent,
                                      color: activeThemeBase.accentTextHex,
                                    }
                                  : {
                                      backgroundColor: activeThemeBase.surfaceSubtleBg,
                                      borderColor: activeThemeBase.surfaceBorder,
                                      color: activeThemeBase.surfaceText,
                                    }
                              }
                            >
                              {getBtnDisplayLabel(bid)}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[290px]">
                  <aside
                    className={`${
                      screenCfg.layoutStyle === 'compact_rail' ? 'w-36' : 'w-44'
                    } p-2.5 border-e space-y-2.5 shrink-0`}
                    style={{
                      backgroundColor: activeThemeBase.sidebarBg,
                      borderColor: activeThemeBase.sidebarBorder,
                      color: activeThemeBase.sidebarText,
                    }}
                  >
                    {screenCfg.cards.map((card, cIdx) => {
                      const visibleBtns = card.buttonIds.filter(
                        (id) => catalogMap.get(id)?.lockedVisible || screenCfg.buttonOverrides[id]?.hidden !== true
                      );
                      if (visibleBtns.length === 0) return null;
                      return (
                        <div key={card.id} className="space-y-1">
                          <p
                            className="text-[9px] font-extrabold px-1.5 truncate"
                            style={{ color: activeThemeBase.sidebarMuted }}
                          >
                            {isEn ? card.titleEn : card.titleAr}
                          </p>
                          <div className="space-y-1">
                            {visibleBtns.map((bid, bIdx) => {
                              const active = cIdx === 0 && bIdx === 0;
                              return (
                                <div
                                  key={bid}
                                  className={`px-2 py-1.5 text-[10px] font-bold truncate ${radiusCls.button}`}
                                  style={
                                    active
                                      ? {
                                          backgroundColor: resolvedAccent,
                                          color: activeThemeBase.accentTextHex,
                                        }
                                      : {
                                          color: activeThemeBase.sidebarText,
                                          opacity: 0.85,
                                        }
                                  }
                                >
                                  {getBtnDisplayLabel(bid)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </aside>

                  <div className="flex-1 p-3 space-y-2.5">
                    <div
                      className={`p-3 border space-y-1.5 ${radiusCls.card}`}
                      style={{
                        backgroundColor: activeThemeBase.surfaceBg,
                        borderColor: activeThemeBase.surfaceBorder,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold">
                          {screenCfg.cards[0]?.buttonIds[0]
                            ? getBtnDisplayLabel(screenCfg.cards[0].buttonIds[0])
                            : isEn
                              ? 'Workspace Area'
                              : 'منطقة العمل النشطة'}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[9px] font-extrabold ${radiusCls.pill}`}
                          style={{
                            backgroundColor: resolvedAccent,
                            color: activeThemeBase.accentTextHex,
                          }}
                        >
                          {isEn ? 'Live' : 'مباشر'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <div
                          className={`h-10 border ${radiusCls.button}`}
                          style={{
                            backgroundColor: activeThemeBase.surfaceSubtleBg,
                            borderColor: activeThemeBase.surfaceBorder,
                          }}
                        />
                        <div
                          className={`h-10 border ${radiusCls.button}`}
                          style={{
                            backgroundColor: activeThemeBase.surfaceSubtleBg,
                            borderColor: activeThemeBase.surfaceBorder,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
