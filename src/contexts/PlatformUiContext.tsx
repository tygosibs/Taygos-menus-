import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useLanguage } from './LanguageContext';
import { db } from '../lib/firebase';
import {
  DEFAULT_PLATFORM_UI_CONFIG,
  getRadiusClasses,
  getReadableTextOnBg,
  normalizePlatformUiConfig,
  SCREEN_THEMES,
  UI_ACTION_CATALOG,
} from '../lib/platformUiDefaults';
import {
  PlatformUiConfig,
  ScreenThemeTokens,
  UiActionCatalogItem,
  UiScreenCard,
  UiScreenConfig,
  UiScreenId,
} from '../types/uiStudio';

type RefreshPhase = 'idle' | 'countdown' | 'done';

interface PlatformUiContextValue {
  uiConfig: PlatformUiConfig;
  loading: boolean;
  refreshPhase: RefreshPhase;
  refreshCycle: number;
  publishPlatformUiConfig: (
    nextConfig: PlatformUiConfig,
    publisherEmail: string
  ) => Promise<PlatformUiConfig>;
  triggerSimulatedRefreshTest: (noticeAr?: string, noticeEn?: string) => void;
}

const PlatformUiContext = createContext<PlatformUiContextValue>({
  uiConfig: DEFAULT_PLATFORM_UI_CONFIG,
  loading: false,
  refreshPhase: 'idle',
  refreshCycle: 0,
  publishPlatformUiConfig: async (cfg) => cfg,
  triggerSimulatedRefreshTest: () => {},
});

export function PlatformUiProvider({ children }: { children: ReactNode }) {
  const { lang, dir } = useLanguage();
  const isEn = lang === 'en';
  const [uiConfig, setUiConfig] = useState<PlatformUiConfig>(DEFAULT_PLATFORM_UI_CONFIG);
  const [loading, setLoading] = useState(true);
  const [refreshPhase, setRefreshPhase] = useState<RefreshPhase>('idle');
  const [refreshCycle, setRefreshCycle] = useState(0);
  const [pendingNotice, setPendingNotice] = useState<{ ar: string; en: string } | null>(null);
  const [countdownProgress, setCountdownProgress] = useState(0);

  const initialLoadedRef = useRef(false);
  const activeVersionRef = useRef<number>(1);
  const refreshTimerRef = useRef<number | null>(null);
  const doneTimerRef = useRef<number | null>(null);
  const progressRafRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (doneTimerRef.current) {
      window.clearTimeout(doneTimerRef.current);
      doneTimerRef.current = null;
    }
    if (progressRafRef.current) {
      window.cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
  }, []);

  const runSoftLiveReload = useCallback(
    (incomingConfig: PlatformUiConfig | null, noticeAr: string, noticeEn: string) => {
      clearTimers();
      setPendingNotice({ ar: noticeAr, en: noticeEn });
      setRefreshPhase('countdown');
      setCountdownProgress(0);

      const startedAt = performance.now();
      const durationMs = 2000;

      const stepProgress = (now: number) => {
        const pct = Math.min(100, ((now - startedAt) / durationMs) * 100);
        setCountdownProgress(pct);
        if (pct < 100) {
          progressRafRef.current = window.requestAnimationFrame(stepProgress);
        }
      };
      progressRafRef.current = window.requestAnimationFrame(stepProgress);

      // Preserve 100% of unsaved forms, carts, open shifts, modals, and auth state
      refreshTimerRef.current = window.setTimeout(() => {
        if (incomingConfig) {
          activeVersionRef.current = incomingConfig.version;
          setUiConfig(incomingConfig);
        }
        setRefreshCycle((c) => c + 1);
        setRefreshPhase('done');
        doneTimerRef.current = window.setTimeout(() => {
          setRefreshPhase('idle');
          setPendingNotice(null);
        }, 2600);
      }, durationMs);
    },
    [clearTimers]
  );

  useEffect(() => {
    const ref = doc(db, 'platform_settings', 'ui_config');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setLoading(false);
        if (!snap.exists()) {
          if (!initialLoadedRef.current) {
            initialLoadedRef.current = true;
            activeVersionRef.current = DEFAULT_PLATFORM_UI_CONFIG.version;
            setUiConfig(DEFAULT_PLATFORM_UI_CONFIG);
          }
          return;
        }

        const normalized = normalizePlatformUiConfig(snap.data() as Partial<PlatformUiConfig>);
        if (!initialLoadedRef.current) {
          initialLoadedRef.current = true;
          activeVersionRef.current = normalized.version;
          setUiConfig(normalized);
          return;
        }

        if (normalized.version > activeVersionRef.current) {
          runSoftLiveReload(
            normalized,
            normalized.refreshNoticeAr,
            normalized.refreshNoticeEn
          );
        } else {
          setUiConfig(normalized);
        }
      },
      () => {
        setLoading(false);
      }
    );

    return () => {
      unsub();
      clearTimers();
    };
  }, [clearTimers, runSoftLiveReload]);

  const publishPlatformUiConfig = useCallback(
    async (nextConfig: PlatformUiConfig, publisherEmail: string): Promise<PlatformUiConfig> => {
      const nextVersion = Math.max(activeVersionRef.current + 1, (nextConfig.version || 1) + 1);
      const clean = normalizePlatformUiConfig({
        ...nextConfig,
        id: 'ui_config',
        version: nextVersion,
        publishedBy: publisherEmail || 'tygosibs@gmail.com',
      });

      const payload: Record<string, unknown> = {
        id: 'ui_config',
        version: clean.version,
        publishedBy: clean.publishedBy,
        refreshNoticeAr: clean.refreshNoticeAr,
        refreshNoticeEn: clean.refreshNoticeEn,
        screens: clean.screens,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'platform_settings', 'ui_config'), payload);
      return clean;
    },
    []
  );

  const triggerSimulatedRefreshTest = useCallback(
    (noticeAr?: string, noticeEn?: string) => {
      runSoftLiveReload(
        null,
        noticeAr || uiConfig.refreshNoticeAr,
        noticeEn || uiConfig.refreshNoticeEn
      );
    },
    [runSoftLiveReload, uiConfig.refreshNoticeAr, uiConfig.refreshNoticeEn]
  );

  const value = useMemo<PlatformUiContextValue>(
    () => ({
      uiConfig,
      loading,
      refreshPhase,
      refreshCycle,
      publishPlatformUiConfig,
      triggerSimulatedRefreshTest,
    }),
    [uiConfig, loading, refreshPhase, refreshCycle, publishPlatformUiConfig, triggerSimulatedRefreshTest]
  );

  return (
    <PlatformUiContext.Provider value={value}>
      <div
        className={`transition-opacity duration-200 ${
          refreshPhase === 'countdown' ? 'opacity-95' : 'opacity-100'
        }`}
      >
        {children}
      </div>

      {/* Gentle 2-Second Live System Update Overlay (Zero data loss, zero logout) */}
      {refreshPhase === 'countdown' && (
        <div
          dir={dir}
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[120] bg-[#0E1B3D]/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F3EBDD] border border-[#E6D9C3] text-[#E8833A] flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#E8833A]">
                {isEn ? 'Live UI Update (2s)' : 'تحديث مباشر للواجهة (ثانيتين)'}
              </p>
              <h3 className="text-base font-extrabold text-[#14285A] leading-snug">
                {isEn
                  ? 'Refreshing screen layout gently...'
                  : 'عفواً، سيتم تحديث المنظومة وتحميل الشاشة من جديد'}
              </h3>
              <p className="text-xs text-[#0E1B3D]/80 leading-relaxed">
                {isEn
                  ? pendingNotice?.en || uiConfig.refreshNoticeEn
                  : pendingNotice?.ar || uiConfig.refreshNoticeAr}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-[#E6D9C3] overflow-hidden">
                <div
                  className="h-full bg-[#E8833A] rounded-full transition-none"
                  style={{ width: `${countdownProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#2F8F5B]">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isEn
                    ? 'Unsaved edits, active orders & shifts remain 100% safe'
                    : 'كل بياناتك وطلباتك وحقولك غير المحفوظة مؤمّنة بالكامل بدون أي خروج'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Brief post-update confirmation toast */}
      {refreshPhase === 'done' && (
        <div
          dir={dir}
          className="fixed bottom-4 inset-x-0 z-[120] flex justify-center px-4 pointer-events-none"
        >
          <div className="bg-[#14285A] text-[#FBF7EF] border border-[#2F8F5B]/60 px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-2 text-xs font-extrabold">
            <CheckCircle2 className="w-4 h-4 text-[#2F8F5B] shrink-0" />
            <span>
              {isEn
                ? 'Screen updated smoothly — all your work is intact'
                : 'تم تحديث تصميم المنظومة بنجاح — كل شغلك وبياناتك محفوظة كما هي'}
            </span>
          </div>
        </div>
      )}
    </PlatformUiContext.Provider>
  );
}

export function usePlatformUi() {
  return useContext(PlatformUiContext);
}

export interface ResolvedScreenUi {
  screenConfig: UiScreenConfig;
  theme: ScreenThemeTokens;
  radiusClasses: { card: string; button: string; pill: string };
  visibleCards: (UiScreenCard & { items: UiActionCatalogItem[] })[];
  orderedButtonIds: string[];
  getButtonLabel: (buttonId: string, lang: 'ar' | 'en', fallback?: string) => string;
  isButtonVisible: (buttonId: string) => boolean;
}

export function useScreenUi(
  screenId: UiScreenId,
  overrideConfig?: UiScreenConfig | null
): ResolvedScreenUi {
  const { uiConfig } = usePlatformUi();
  const screenConfig = overrideConfig || uiConfig.screens[screenId];
  const baseTheme = SCREEN_THEMES[screenConfig.themeId] || SCREEN_THEMES.sand_sapphire;

  const theme = useMemo<ScreenThemeTokens>(() => {
    const accent = screenConfig.accentColorOverride || baseTheme.accentHex;
    const readableAccentText = screenConfig.accentColorOverride
      ? getReadableTextOnBg(accent, '#0E1B3D', '#FFFFFF')
      : baseTheme.accentTextHex;
    return {
      ...baseTheme,
      accentHex: accent,
      accentTextHex: readableAccentText,
      highlightHex: baseTheme.highlightHex || '#E8833A',
      successHex: baseTheme.successHex || '#2F8F5B',
      sidebarActiveBg: screenConfig.accentColorOverride ? accent : baseTheme.sidebarActiveBg,
      sidebarActiveText: screenConfig.accentColorOverride ? readableAccentText : baseTheme.sidebarActiveText,
    };
  }, [baseTheme, screenConfig.accentColorOverride]);

  const radiusClasses = useMemo(
    () => getRadiusClasses(screenConfig.cardRadius),
    [screenConfig.cardRadius]
  );

  const catalogMap = useMemo(() => {
    const m = new Map<string, UiActionCatalogItem>();
    UI_ACTION_CATALOG[screenId].forEach((item) => m.set(item.id, item));
    return m;
  }, [screenId]);

  const isButtonVisible = useCallback(
    (buttonId: string): boolean => {
      const cat = catalogMap.get(buttonId);
      if (cat?.lockedVisible) return true;
      return screenConfig.buttonOverrides[buttonId]?.hidden !== true;
    },
    [catalogMap, screenConfig.buttonOverrides]
  );

  const getButtonLabel = useCallback(
    (buttonId: string, lang: 'ar' | 'en', fallback?: string): string => {
      const ov = screenConfig.buttonOverrides[buttonId];
      if (lang === 'en') {
        if (ov?.labelEn && ov.labelEn.trim()) return ov.labelEn;
        return catalogMap.get(buttonId)?.defaultLabelEn || fallback || buttonId;
      }
      if (ov?.labelAr && ov.labelAr.trim()) return ov.labelAr;
      return catalogMap.get(buttonId)?.defaultLabelAr || fallback || buttonId;
    },
    [catalogMap, screenConfig.buttonOverrides]
  );

  const visibleCards = useMemo(() => {
    return screenConfig.cards
      .map((card) => {
        const items = card.buttonIds
          .filter((bid) => isButtonVisible(bid))
          .map((bid) => catalogMap.get(bid))
          .filter((item): item is UiActionCatalogItem => Boolean(item));
        return {
          ...card,
          buttonIds: items.map((i) => i.id),
          items,
        };
      })
      .filter((card) => card.items.length > 0);
  }, [screenConfig.cards, isButtonVisible, catalogMap]);

  const orderedButtonIds = useMemo(
    () => visibleCards.flatMap((c) => c.buttonIds),
    [visibleCards]
  );

  return {
    screenConfig,
    theme,
    radiusClasses,
    visibleCards,
    orderedButtonIds,
    getButtonLabel,
    isButtonVisible,
  };
}
