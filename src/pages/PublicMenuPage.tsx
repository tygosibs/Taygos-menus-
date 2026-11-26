import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  Home,
  LayoutDashboard,
  Palette,
  PauseCircle,
  X,
} from 'lucide-react';
import { LanguageToggleButton } from '../components/LanguageToggleButton';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { SafeImage } from '../components/SafeImage';
import { CartDrawer } from '../components/menu/CartDrawer';
import { GuestNameModal } from '../components/menu/GuestNameModal';
import { ItemModal } from '../components/menu/ItemModal';
import { LoyaltyBar } from '../components/menu/LoyaltyBar';
import { LoyaltyRegisterModal } from '../components/menu/LoyaltyRegisterModal';
import { TableServiceBar } from '../components/menu/TableServiceBar';
import { ThemeRenderer } from '../components/menu/ThemeRenderer';
import { useLanguage } from '../contexts/LanguageContext';
import { DEMO_RESTAURANTS } from '../data/demoRestaurants';
import { getThemeMeta, isCustomThemeId, MENU_THEMES } from '../data/themes';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  clearCustomerPhone,
  getDemoCustomerProfile,
  getResolvedLoyaltyConfig,
  getSavedCustomerPhone,
} from '../lib/customerLoyaltyUtils';
import { auth, isSuperAdminEmail } from '../lib/firebase';
import {
  clearTableSessionAfterOrder,
  fetchActiveCustomThemes,
  fetchCustomerProfile,
  fetchCustomThemeById,
  fetchRestaurantBySlug,
  fetchRestaurantHalls,
  mutateTableSessionCart,
  registerGuestInTableSession,
  sendServiceCall,
  subscribeTableSession,
} from '../lib/firestoreService';
import {
  applySeoMetadata,
  getRestaurantShareMetadata,
  normalizeRestaurantLogoUrl,
} from '../lib/seoHead';
import { subscribeRestaurantStations } from '../lib/stationsService';
import { buildEffectiveStations } from '../lib/stationUtils';
import {
  buildTableSessionId,
  cartItemToTableSessionItem,
  getOrCreateGuestId,
  getSavedGuestName,
  normalizeHallName,
  normalizeTableNumber,
  saveGuestName,
  tableSessionItemsToCartItems,
} from '../lib/tableSessionUtils';
import {
  ActiveTheme,
  CartItem,
  Category,
  CustomerLastOrderItem,
  CustomerProfile,
  CustomTheme,
  Hall,
  MenuColorMode,
  MenuItem,
  Restaurant,
  RestaurantStation,
  ServiceCallType,
  TableSession,
  TableSessionItem,
} from '../types/menu';

interface PublicMenuPageProps {
  slug: string;
  onNavigate: (path: string) => void;
}

const VALID_THEME_IDS = new Set<string>(MENU_THEMES.map((t) => t.id));

export function PublicMenuPage({ slug, onNavigate }: PublicMenuPageProps) {
  const { lang, dir, isRtl, t, loc } = useLanguage();
  const isEn = lang === 'en';
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [dynamicStations, setDynamicStations] = useState<RestaurantStation[]>([]);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const [previewTheme, setPreviewTheme] = useState<ActiveTheme | null>(null);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [resolvedCustomTheme, setResolvedCustomTheme] = useState<CustomTheme | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartHydratedSlug, setCartHydratedSlug] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [topBarDismissed, setTopBarDismissed] = useState(false);
  const [installBannerDismissed, setInstallBannerDismissed] = useState(false);
  const [colorModeOverride, setColorModeOverride] = useState<MenuColorMode>('auto');
  const [prefillPromoCode, setPrefillPromoCode] = useState<string | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [loyaltyModalOpen, setLoyaltyModalOpen] = useState(false);
  const { isInstalled } = usePWAInstall();

  const guestId = useMemo(() => getOrCreateGuestId(), []);
  const [guestName, setGuestName] = useState<string>(() => getSavedGuestName());
  const [hallName, setHallName] = useState<string>(() =>
    typeof window !== 'undefined'
      ? normalizeHallName(new URLSearchParams(window.location.search).get('hall'))
      : ''
  );
  const [tableNumber, setTableNumber] = useState<string>(() =>
    typeof window !== 'undefined'
      ? normalizeTableNumber(new URLSearchParams(window.location.search).get('table'))
      : ''
  );
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [tableSession, setTableSession] = useState<TableSession | null>(null);
  const registeredKeyRef = useRef<string>('');
  const pendingCartActionRef = useRef<
    | { type: 'add'; item: CartItem }
    | { type: 'quick'; item: MenuItem; delta: number }
    | null
  >(null);

  const sessionId = useMemo(
    () => buildTableSessionId(hallName, tableNumber),
    [hallName, tableNumber]
  );

  const urlThemeMode = useMemo(() => {
    if (isDemoMode) return true;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tParam = params.get('theme') || '';
      return params.get('preview') === '1' || VALID_THEME_IDS.has(tParam) || isCustomThemeId(tParam);
    }
    return false;
  }, [isDemoMode]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    fetchActiveCustomThemes().then(setCustomThemes);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!restaurant?.id || isDemoMode) {
      setDynamicStations([]);
      return;
    }
    return subscribeRestaurantStations(restaurant.id, setDynamicStations, () => {});
  }, [restaurant?.id, isDemoMode]);

  const effectiveStations = useMemo(
    () => buildEffectiveStations(dynamicStations),
    [dynamicStations]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setColorModeOverride('auto');
    setPrefillPromoCode(null);
    setTableSession(null);
    registeredKeyRef.current = '';

    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const urlHall = normalizeHallName(params?.get('hall'));
    const urlTable = normalizeTableNumber(params?.get('table'));
    const savedGuest = getSavedGuestName();
    setHallName(urlHall);
    setTableNumber(urlTable);
    setGuestName(savedGuest);
    if (urlTable && !savedGuest) {
      setGuestModalOpen(true);
    }

    let restoredCart: CartItem[] = [];
    if (typeof window !== 'undefined' && slug) {
      try {
        const raw = window.localStorage.getItem(`sufra_cart_v1_${slug}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            restoredCart = parsed.filter(
              (c) => c && typeof c.cartKey === 'string' && c.menuItem && c.quantity > 0
            );
          }
        }
      } catch {
        restoredCart = [];
      }
    }
    setCart(restoredCart);
    setCartHydratedSlug(slug);

    const urlThemeParam = params?.get('theme') || null;
    const requestedTheme =
      urlThemeParam && (VALID_THEME_IDS.has(urlThemeParam) || isCustomThemeId(urlThemeParam))
        ? (urlThemeParam as ActiveTheme)
        : null;

    async function load() {
      const demo = DEMO_RESTAURANTS[slug];
      if (demo) {
        if (!active) return;
        setRestaurant(demo.restaurant);
        setCategories(demo.categories);
        setItems(demo.items);
        setIsDemoMode(true);
        const savedPhone = getSavedCustomerPhone(slug);
        setCustomerProfile(savedPhone ? getDemoCustomerProfile(slug, savedPhone) : null);
        const chosen = requestedTheme || demo.restaurant.activeTheme;
        setPreviewTheme(chosen);
        if (isCustomThemeId(chosen)) {
          const ct = await fetchCustomThemeById(chosen);
          if (active) setResolvedCustomTheme(ct);
        }
        setLoading(false);
        return;
      }

      try {
        const res = await fetchRestaurantBySlug(slug);
        if (!active) return;
        if (!res) {
          setRestaurant(null);
          setHalls([]);
          setCustomerProfile(null);
          setLoading(false);
          return;
        }
        setRestaurant(res.restaurant);
        setCategories(res.categories);
        setItems(res.items);
        setIsDemoMode(false);
        const savedPhone = getSavedCustomerPhone(slug);
        if (savedPhone) {
          fetchCustomerProfile(res.restaurant.id, savedPhone)
            .then((profile) => {
              if (!active) return;
              if (profile) {
                setCustomerProfile(profile);
              } else {
                clearCustomerPhone(slug);
                setCustomerProfile(null);
              }
            })
            .catch(() => {
              if (active) setCustomerProfile(null);
            });
        } else {
          setCustomerProfile(null);
        }
        fetchRestaurantHalls(res.restaurant.id).then((loadedHalls) => {
          if (active) setHalls(loadedHalls);
        });
        const chosen = requestedTheme || res.restaurant.activeTheme;
        setPreviewTheme(chosen);
        if (isCustomThemeId(chosen)) {
          const ct = await fetchCustomThemeById(chosen);
          if (active) setResolvedCustomTheme(ct);
        }
        setLoading(false);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : t.auth.errGeneric);
        setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [slug, t.auth.errGeneric]);

  useEffect(() => {
    if (typeof window === 'undefined' || !slug || cartHydratedSlug !== slug) return;
    try {
      window.localStorage.setItem(`sufra_cart_v1_${slug}`, JSON.stringify(cart));
    } catch {
      // Ignore storage quota errors
    }
  }, [cart, slug, cartHydratedSlug]);

  useEffect(() => {
    if (!restaurant || typeof window === 'undefined') return;
    applySeoMetadata(getRestaurantShareMetadata(restaurant, lang, window.location.origin));
  }, [restaurant, lang]);

  // Real-time Table Session Listener (Firestore for live restaurants, localStorage + BroadcastChannel for demo)
  useEffect(() => {
    if (!restaurant || !sessionId) {
      setTableSession(null);
      return;
    }

    if (!isDemoMode) {
      const unsub = subscribeTableSession(
        restaurant.id,
        sessionId,
        (session) => {
          setTableSession(session);
        },
        (err) => {
          console.warn('Table session sync warning:', err.message);
        }
      );
      return () => unsub();
    }

    if (typeof window === 'undefined') return;
    const storageKey = `sufra_demo_session_${slug}_${sessionId}`;
    const readDemoSession = (): TableSession | null => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return null;
        return JSON.parse(raw) as TableSession;
      } catch {
        return null;
      }
    };

    setTableSession(readDemoSession());

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === storageKey) {
        setTableSession(readDemoSession());
      }
    };
    window.addEventListener('storage', onStorage);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(`sufra_table_${slug}_${sessionId}`);
      bc.onmessage = (ev) => {
        if (ev.data && typeof ev.data === 'object') {
          setTableSession(ev.data as TableSession);
        }
      };
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      bc?.close();
    };
  }, [restaurant, sessionId, isDemoMode, slug]);

  // Register returning guest automatically in active table session
  useEffect(() => {
    if (!restaurant || loading || !sessionId || !tableNumber || !guestName.trim()) return;
    const regKey = `${restaurant.id}:${sessionId}:${guestName.trim().toLowerCase()}`;
    if (registeredKeyRef.current === regKey) return;
    registeredKeyRef.current = regKey;

    if (!isDemoMode) {
      registerGuestInTableSession({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        sessionId,
        hallName,
        tableNumber,
        guestName: guestName.trim(),
      }).catch((err) => {
        console.warn('Failed to register guest in table session:', err);
      });
    } else if (typeof window !== 'undefined') {
      const storageKey = `sufra_demo_session_${slug}_${sessionId}`;
      let current: TableSession | null = null;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) current = JSON.parse(raw) as TableSession;
      } catch {
        current = null;
      }
      const existingGuests = Array.isArray(current?.guests) ? current.guests : [];
      const cleanGuest = guestName.trim();
      const hasGuest = existingGuests.some(
        (g) => g.trim().toLowerCase() === cleanGuest.toLowerCase()
      );
      const nextSession: TableSession = {
        id: sessionId,
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        hallName,
        tableNumber,
        status: 'active',
        guests: hasGuest ? existingGuests : [...existingGuests, cleanGuest],
        items: current?.items || [],
      };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
        setTableSession(nextSession);
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel(`sufra_table_${slug}_${sessionId}`);
          bc.postMessage(nextSession);
          bc.close();
        }
      } catch {
        // Ignore demo storage quota errors
      }
    }
  }, [restaurant, loading, sessionId, hallName, tableNumber, guestName, isDemoMode, slug]);

  const mutateActiveSessionItems = useCallback(
    async (
      targetSessionId: string,
      targetHall: string,
      targetTable: string,
      targetGuest: string,
      mutator: (currentItems: TableSessionItem[]) => TableSessionItem[]
    ) => {
      if (!restaurant || !targetSessionId || !targetTable) return;
      const cleanGuest = targetGuest.trim() || (isEn ? 'Guest' : 'ضيف');

      if (!isDemoMode) {
        await mutateTableSessionCart({
          restaurantId: restaurant.id,
          ownerId: restaurant.ownerId,
          sessionId: targetSessionId,
          hallName: targetHall,
          tableNumber: targetTable,
          guestName: cleanGuest,
          mutator,
        });
        return;
      }

      if (typeof window === 'undefined') return;
      const storageKey = `sufra_demo_session_${slug}_${targetSessionId}`;
      let current: TableSession | null = null;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) current = JSON.parse(raw) as TableSession;
      } catch {
        current = null;
      }
      const currentItems = Array.isArray(current?.items) ? current.items : [];
      const nextItems = mutator(currentItems).slice(0, 80);
      const existingGuests = Array.isArray(current?.guests) ? current.guests : [];
      const hasGuest = existingGuests.some(
        (g) => g.trim().toLowerCase() === cleanGuest.toLowerCase()
      );
      const nextSession: TableSession = {
        id: targetSessionId,
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        hallName: targetHall,
        tableNumber: targetTable,
        status: 'active',
        guests: hasGuest ? existingGuests : [...existingGuests, cleanGuest],
        items: nextItems,
      };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
        setTableSession(nextSession);
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel(`sufra_table_${slug}_${targetSessionId}`);
          bc.postMessage(nextSession);
          bc.close();
        }
      } catch {
        // Ignore storage errors
      }
    },
    [restaurant, isDemoMode, slug, isEn]
  );

  const applyAddItemToSession = (
    currentItems: TableSessionItem[],
    incoming: CartItem,
    activeGuestId: string,
    activeGuestName: string
  ): TableSessionItem[] => {
    const entryId = `${activeGuestId}__${incoming.cartKey}`
      .replace(/[^a-zA-Z0-9_\-:.|]/g, '_')
      .slice(0, 180);
    const idx = currentItems.findIndex((si) => si.entryId === entryId);
    if (idx >= 0) {
      const next = [...currentItems];
      next[idx] = {
        ...next[idx],
        quantity: next[idx].quantity + incoming.quantity,
      };
      return next;
    }
    return [
      ...currentItems,
      cartItemToTableSessionItem({ ...incoming, entryId }, activeGuestId, activeGuestName),
    ];
  };

  const applyQuickStepToSession = (
    currentItems: TableSessionItem[],
    item: MenuItem,
    delta: number,
    activeGuestId: string,
    activeGuestName: string
  ): TableSessionItem[] => {
    const defaultSize = item.sizes && item.sizes.length > 0 ? item.sizes[0] : undefined;
    const unitPrice = defaultSize ? defaultSize.price : item.basePrice;
    const quickKey = `${item.id}__${defaultSize?.name || 'std'}____`;
    const entryId = `${activeGuestId}__${quickKey}`
      .replace(/[^a-zA-Z0-9_\-:.|]/g, '_')
      .slice(0, 180);

    const idx = currentItems.findIndex((si) => si.entryId === entryId);
    if (idx >= 0) {
      const nextQty = currentItems[idx].quantity + delta;
      if (nextQty <= 0) {
        return currentItems.filter((_, i) => i !== idx);
      }
      const next = [...currentItems];
      next[idx] = { ...next[idx], quantity: nextQty };
      return next;
    }

    if (delta > 0) {
      return [
        ...currentItems,
        cartItemToTableSessionItem(
          {
            cartKey: quickKey,
            entryId,
            menuItem: item,
            selectedSize: defaultSize,
            selectedAddons: [],
            quantity: delta,
            unitPrice,
          },
          activeGuestId,
          activeGuestName
        ),
      ];
    }

    // Scope decrements to this guest's own items on the table
    const guestItemIdx = currentItems.findIndex(
      (si) => si.guestId === activeGuestId && si.menuItemId === item.id
    );
    if (guestItemIdx >= 0) {
      const nextQty = currentItems[guestItemIdx].quantity + delta;
      if (nextQty <= 0) {
        return currentItems.filter((_, i) => i !== guestItemIdx);
      }
      const next = [...currentItems];
      next[guestItemIdx] = { ...next[guestItemIdx], quantity: nextQty };
      return next;
    }

    return currentItems;
  };

  const handleAddToCart = (incoming: CartItem) => {
    if (sessionId) {
      if (!guestName.trim()) {
        pendingCartActionRef.current = { type: 'add', item: incoming };
        setGuestModalOpen(true);
        return;
      }
      void mutateActiveSessionItems(sessionId, hallName, tableNumber, guestName, (prev) =>
        applyAddItemToSession(prev, incoming, guestId, guestName)
      );
      return;
    }

    setCart((prev) => {
      const existingIdx = prev.findIndex((c) => c.cartKey === incoming.cartKey);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: next[existingIdx].quantity + incoming.quantity,
        };
        return next;
      }
      return [...prev, incoming];
    });
  };

  const handleQuickStepItem = (item: MenuItem, delta: number) => {
    if (sessionId) {
      if (delta > 0 && !guestName.trim()) {
        pendingCartActionRef.current = { type: 'quick', item, delta };
        setGuestModalOpen(true);
        return;
      }
      const effectiveName = guestName.trim() || (isEn ? 'Guest' : 'ضيف');
      void mutateActiveSessionItems(sessionId, hallName, tableNumber, effectiveName, (prev) =>
        applyQuickStepToSession(prev, item, delta, guestId, effectiveName)
      );
      return;
    }

    const defaultSize = item.sizes && item.sizes.length > 0 ? item.sizes[0] : undefined;
    const unitPrice = defaultSize ? defaultSize.price : item.basePrice;
    const quickKey = `${item.id}__${defaultSize?.name || 'std'}____`;

    setCart((prev) => {
      const idx = prev.findIndex((c) => c.cartKey === quickKey);
      if (idx >= 0) {
        const nextQty = prev[idx].quantity + delta;
        if (nextQty <= 0) {
          return prev.filter((_, i) => i !== idx);
        }
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: nextQty };
        return next;
      }
      if (delta > 0) {
        return [
          ...prev,
          {
            cartKey: quickKey,
            menuItem: item,
            selectedSize: defaultSize,
            selectedAddons: [],
            quantity: delta,
            unitPrice,
          },
        ];
      }
      const anyIdx = prev.findIndex((c) => c.menuItem.id === item.id);
      if (anyIdx >= 0 && delta < 0) {
        const nextQty = prev[anyIdx].quantity + delta;
        if (nextQty <= 0) return prev.filter((_, i) => i !== anyIdx);
        const next = [...prev];
        next[anyIdx] = { ...next[anyIdx], quantity: nextQty };
        return next;
      }
      return prev;
    });
  };

  const handleUpdateQty = (cartKey: string, delta: number) => {
    if (sessionId) {
      const effectiveName = guestName.trim() || (isEn ? 'Guest' : 'ضيف');
      void mutateActiveSessionItems(sessionId, hallName, tableNumber, effectiveName, (prev) =>
        prev
          .map((si) => {
            const key = si.entryId || `${si.guestId}__${si.cartKey}`;
            return key === cartKey ? { ...si, quantity: si.quantity + delta } : si;
          })
          .filter((si) => si.quantity > 0)
      );
      return;
    }

    setCart((prev) =>
      prev
        .map((c) => (c.cartKey === cartKey ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const handleRemoveItem = (cartKey: string) => {
    if (sessionId) {
      const effectiveName = guestName.trim() || (isEn ? 'Guest' : 'ضيف');
      void mutateActiveSessionItems(sessionId, hallName, tableNumber, effectiveName, (prev) =>
        prev.filter((si) => (si.entryId || `${si.guestId}__${si.cartKey}`) !== cartKey)
      );
      return;
    }

    setCart((prev) => prev.filter((c) => c.cartKey !== cartKey));
  };

  const handleConfirmGuestModal = async (payload: {
    guestName: string;
    hallName: string;
    tableNumber: string;
  }) => {
    saveGuestName(payload.guestName);
    setGuestName(payload.guestName);
    setHallName(payload.hallName);
    setTableNumber(payload.tableNumber);
    setGuestModalOpen(false);

    const nextSessionId = buildTableSessionId(payload.hallName, payload.tableNumber);

    // Keep ?hall=&table= reflected in URL so reloads stay bound to this table
    if (typeof window !== 'undefined' && payload.tableNumber) {
      const params = new URLSearchParams(window.location.search);
      if (payload.hallName) {
        params.set('hall', payload.hallName);
      } else {
        params.delete('hall');
      }
      params.set('table', payload.tableNumber);
      const nextUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', nextUrl);
    }

    if (restaurant && nextSessionId) {
      registeredKeyRef.current = `${restaurant.id}:${nextSessionId}:${payload.guestName.trim().toLowerCase()}`;
      const localItemsToMigrate = !sessionId && cart.length > 0 ? [...cart] : [];
      const pendingAction = pendingCartActionRef.current;
      pendingCartActionRef.current = null;

      if (localItemsToMigrate.length > 0 || pendingAction) {
        await mutateActiveSessionItems(
          nextSessionId,
          payload.hallName,
          payload.tableNumber,
          payload.guestName,
          (prev) => {
            let next = [...prev];
            localItemsToMigrate.forEach((localItem) => {
              next = applyAddItemToSession(next, localItem, guestId, payload.guestName);
            });
            if (pendingAction?.type === 'add') {
              next = applyAddItemToSession(next, pendingAction.item, guestId, payload.guestName);
            } else if (pendingAction?.type === 'quick') {
              next = applyQuickStepToSession(
                next,
                pendingAction.item,
                pendingAction.delta,
                guestId,
                payload.guestName
              );
            }
            return next;
          }
        );
        if (localItemsToMigrate.length > 0) {
          setCart([]);
        }
      } else if (!isDemoMode) {
        await registerGuestInTableSession({
          restaurantId: restaurant.id,
          ownerId: restaurant.ownerId,
          sessionId: nextSessionId,
          hallName: payload.hallName,
          tableNumber: payload.tableNumber,
          guestName: payload.guestName,
        });
      }
    }
  };

  const handleTableOrderSubmitted = async (orderNumber: string) => {
    if (!restaurant || !sessionId) return;
    if (!isDemoMode) {
      await clearTableSessionAfterOrder(restaurant.id, sessionId, orderNumber);
    } else if (typeof window !== 'undefined') {
      const storageKey = `sufra_demo_session_${slug}_${sessionId}`;
      try {
        const raw = window.localStorage.getItem(storageKey);
        const current = raw ? (JSON.parse(raw) as TableSession) : null;
        const nextSession: TableSession = {
          id: sessionId,
          restaurantId: restaurant.id,
          ownerId: restaurant.ownerId,
          hallName,
          tableNumber,
          status: 'active',
          guests: current?.guests || (guestName ? [guestName] : []),
          items: [],
          lastOrderNumber: orderNumber,
        };
        window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
        setTableSession(nextSession);
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel(`sufra_table_${slug}_${sessionId}`);
          bc.postMessage(nextSession);
          bc.close();
        }
      } catch {
        // Ignore demo errors
      }
    }
  };

  const handleSendServiceCall = async (callType: ServiceCallType) => {
    if (!restaurant || !tableNumber) return;
    if (isDemoMode) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return;
    }
    await sendServiceCall({
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      hallName,
      tableNumber,
      sessionId,
      guestName: guestName || (isEn ? 'Guest' : 'ضيف'),
      callType,
    });
  };

  const handleReorderLastOrder = (lastItems: CustomerLastOrderItem[]) => {
    const liveMap = new Map(items.filter((i) => i.isAvailable).map((i) => [i.id, i]));
    lastItems.forEach((li) => {
      const menuItem = liveMap.get(li.menuItemId);
      if (!menuItem) return;
      const matchedSize = li.sizeName
        ? menuItem.sizes.find(
            (s) => s.name === li.sizeName || s.name_en === li.sizeName
          )
        : menuItem.sizes[0];
      const matchedAddons = (li.addonNames || [])
        .map((an) => menuItem.addons.find((a) => a.name === an || a.name_en === an))
        .filter((a): a is MenuItem['addons'][number] => Boolean(a));
      const baseUnit = matchedSize ? matchedSize.price : menuItem.basePrice;
      const addonSum = matchedAddons.reduce((acc, a) => acc + a.price, 0);
      const sizeKey = matchedSize?.name || 'std';
      const addonKey = matchedAddons.map((a) => a.name).join('|');
      handleAddToCart({
        cartKey: `${menuItem.id}__${sizeKey}__${addonKey}__`,
        menuItem,
        selectedSize: matchedSize,
        selectedAddons: matchedAddons,
        quantity: Math.max(1, li.quantity || 1),
        unitPrice: baseUnit + addonSum,
      });
    });
  };

  const resolvedLoyaltyConfig = useMemo(
    () => getResolvedLoyaltyConfig(restaurant),
    [restaurant]
  );

  const displayCart = useMemo(() => {
    if (sessionId) {
      return tableSessionItemsToCartItems(tableSession?.items || [], items);
    }
    return cart;
  }, [sessionId, tableSession?.items, items, cart]);

  const cartCount = useMemo(() => displayCart.reduce((s, c) => s + c.quantity, 0), [displayCart]);
  const cartTotal = useMemo(() => {
    if (!restaurant) return 0;
    const sub = displayCart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
    const svc = (sub * (restaurant.serviceCharge || 0)) / 100;
    const tax = ((sub + svc) * (restaurant.taxRate || 0)) / 100;
    return sub + svc + tax;
  }, [displayCart, restaurant]);

  if (loading) {
    return (
      <div dir={dir} className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
          <div className="h-24 rounded-2xl bg-zinc-900" />
          <div className="h-10 w-72 rounded-xl bg-zinc-900" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-64 rounded-2xl bg-zinc-900" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div
        dir={dir}
        className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 sm:p-6"
      >
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <div className="flex justify-between items-center">
            <LanguageToggleButton variant="dark" compact />
            <button
              type="button"
              onClick={() => onNavigate('/')}
              aria-label={t.menu.backHome}
              className="w-9 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <h1 className="text-2xl font-bold">{t.menu.notFoundTitle}</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {error || `${t.menu.notFoundDesc} (${slug})`}
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-4 py-2.5 rounded-xl border border-zinc-700 text-sm font-semibold hover:bg-zinc-800 cursor-pointer"
            >
              {t.menu.backHome}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="px-4 py-2.5 rounded-xl bg-amber-500 text-zinc-950 text-sm font-bold hover:bg-amber-400 cursor-pointer"
            >
              {t.nav.ownerDashboard}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = Boolean(currentUser && currentUser.uid === restaurant.ownerId);
  const isSuperAdmin = isSuperAdminEmail(currentUser?.email);
  const showControlBar = urlThemeMode || isOwner || isSuperAdmin;

  if (!isDemoMode && restaurant.isSuspended) {
    return (
      <div
        dir={dir}
        className="min-h-screen bg-[#FAFAFA] text-zinc-900 flex items-center justify-center p-4 sm:p-6"
      >
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
          <div className="flex justify-between items-center">
            <LanguageToggleButton variant="light" compact />
            <button
              type="button"
              onClick={() => onNavigate('/')}
              aria-label={t.menu.backHome}
              className="w-9 h-9 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <PauseCircle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-zinc-950">{t.menu.suspendedTitle}</h1>
          <p className="text-xs text-zinc-500 leading-relaxed">
            <span className="font-bold text-zinc-800">
              {loc(restaurant.name, restaurant.name_en)}
            </span>{' '}
            — {t.menu.suspendedDesc}
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            {(isOwner || isSuperAdmin) && (
              <button
                type="button"
                onClick={() => onNavigate(isSuperAdmin && !isOwner ? '/super-admin' : '/admin')}
                className="px-4 py-2.5 rounded-xl bg-amber-500 text-zinc-950 text-xs font-extrabold hover:bg-amber-400 cursor-pointer"
              >
                {t.nav.ownerDashboard}
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-5 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 cursor-pointer"
            >
              {t.menu.backHome}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const effectiveTheme: ActiveTheme = previewTheme ?? restaurant.activeTheme;
  const activeCustomTheme = isCustomThemeId(effectiveTheme)
    ? customThemes.find((t) => t.id === effectiveTheme) ||
      (resolvedCustomTheme?.id === effectiveTheme ? resolvedCustomTheme : null)
    : null;
  const themeDefaultDark = getThemeMeta(effectiveTheme).isDark;
  const isDarkSurface =
    colorModeOverride === 'dark'
      ? true
      : colorModeOverride === 'light'
        ? false
        : restaurant.colorMode === 'dark'
          ? true
          : restaurant.colorMode === 'light'
            ? false
            : themeDefaultDark;

  const dashboardTarget = isSuperAdmin && !isOwner ? '/super-admin' : '/admin';

  return (
    <div className="relative min-h-screen overflow-x-clip max-w-full">
      {/* Owner / Preview Quick Navigation & Theme Bar (Dismissible to a compact pill, never traps anyone) */}
      {showControlBar && !topBarDismissed && (
        <div
          dir={dir}
          className="bg-zinc-950 text-zinc-200 border-b border-zinc-800 px-3 sm:px-4 py-2 flex items-center justify-between gap-2.5 overflow-x-auto no-scrollbar"
        >
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-200 hover:bg-zinc-800 hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.nav.home}</span>
            </button>

            {(isOwner || isSuperAdmin) && (
              <button
                type="button"
                onClick={() => onNavigate(dashboardTarget)}
                className="min-h-[34px] px-3 py-1 rounded-lg bg-amber-500 text-zinc-950 text-xs font-extrabold hover:bg-amber-400 flex items-center gap-1.5 cursor-pointer"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>
                  {isEn ? 'Back to Dashboard' : 'العودة للوحة التحكم'}
                </span>
              </button>
            )}

            {!isOwner && !isSuperAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                <span>{t.nav.ownerDashboard}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-zinc-400 flex items-center gap-1 me-1">
              <Palette className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {isEn ? 'Themes:' : 'معاينة الثيمات:'}
              </span>
            </span>
            {MENU_THEMES.map((th) => {
              const active = effectiveTheme === th.id;
              return (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => setPreviewTheme(th.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer font-mono-num ${
                    active
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  {th.number}. {isEn ? th.englishName : th.name}
                </button>
              );
            })}
            {customThemes.map((ct) => {
              const cid = ct.id as ActiveTheme;
              const active = effectiveTheme === cid;
              return (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => setPreviewTheme(cid)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-900 text-amber-300 hover:text-white'
                  }`}
                >
                  {loc(ct.name, ct.name_en)}
                </button>
              );
            })}
            <span className="text-zinc-700 mx-1">|</span>
            <LanguageToggleButton variant="dark" compact />
            <button
              type="button"
              onClick={() => setTopBarDismissed(true)}
              aria-label={isEn ? 'Minimize bar' : 'تصغير الشريط'}
              className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showControlBar && topBarDismissed && (isOwner || isSuperAdmin) && (
        <button
          type="button"
          onClick={() => onNavigate(dashboardTarget)}
          className="fixed bottom-20 end-3 z-40 px-3.5 py-2 rounded-full bg-zinc-950/90 text-white border border-white/15 shadow-lg text-xs font-extrabold flex items-center gap-1.5 hover:bg-zinc-900 cursor-pointer"
        >
          <LayoutDashboard className="w-3.5 h-3.5 text-amber-400" />
          <span>{isEn ? 'Dashboard' : 'لوحة التحكم'}</span>
        </button>
      )}

      {/* Restaurant-branded Quick PWA Install Bar (strictly uses restaurant logo & name, never Sufra icon) */}
      {!isInstalled && !installBannerDismissed && (
        <div
          dir={dir}
          className={`px-3 sm:px-5 py-2 border-b flex items-center justify-between gap-2.5 ${
            isDarkSurface
              ? 'bg-zinc-950 border-zinc-800 text-zinc-100'
              : 'bg-white border-zinc-200 text-zinc-900'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <SafeImage
              src={normalizeRestaurantLogoUrl(restaurant.logoUrl)}
              alt={loc(restaurant.name, restaurant.name_en)}
              className="w-8 h-8 rounded-lg object-cover border border-black/10 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-extrabold truncate">
                {loc(restaurant.name, restaurant.name_en)}
              </p>
              <p
                className={`text-[11px] truncate ${
                  isDarkSurface ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                {isEn
                  ? 'Save this menu as an app on your home screen'
                  : 'أضف المنيو كأيقونة سريعة على شاشة هاتفك'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <PWAInstallButton
              variant="menu"
              appTitle={loc(restaurant.name, restaurant.name_en)}
              accentColor={restaurant.primaryColor}
            />
            <button
              type="button"
              onClick={() => setInstallBannerDismissed(true)}
              aria-label={isEn ? 'Dismiss' : 'إخفاء'}
              className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer ${
                isDarkSurface
                  ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {(() => {
        const guestSet = new Map<string, string>();
        const pushG = (raw?: string) => {
          const clean = (raw || '').trim();
          if (clean && !guestSet.has(clean.toLowerCase())) {
            guestSet.set(clean.toLowerCase(), clean);
          }
        };
        (tableSession?.guests || []).forEach(pushG);
        (tableSession?.items || []).forEach((it) => pushG(it.guestName));
        if (guestName) pushG(guestName);
        const resolvedActiveGuests = Array.from(guestSet.values());
        return (
          <TableServiceBar
            restaurant={restaurant}
            hallName={hallName}
            tableNumber={tableNumber}
            guestName={guestName}
            activeGuests={resolvedActiveGuests}
            isDarkSurface={isDarkSurface}
            isDemoMode={isDemoMode}
            onEditGuestOrTable={() => setGuestModalOpen(true)}
            onSendServiceCall={handleSendServiceCall}
          />
        );
      })()}

      <LoyaltyBar
        restaurant={restaurant}
        items={items}
        customer={customerProfile}
        loyaltyConfig={resolvedLoyaltyConfig}
        isDarkSurface={isDarkSurface}
        onOpenRegisterModal={() => setLoyaltyModalOpen(true)}
        onQuickAddItem={(item) => handleQuickStepItem(item, 1)}
        onReorderLastOrder={handleReorderLastOrder}
      />

      <ThemeRenderer
        restaurant={restaurant}
        categories={categories}
        items={items}
        activeTheme={effectiveTheme}
        customTheme={activeCustomTheme}
        cart={displayCart}
        cartCount={cartCount}
        cartTotal={cartTotal}
        colorModeOverride={colorModeOverride}
        onChangeColorMode={setColorModeOverride}
        onApplyPromoCode={(code) => {
          setPrefillPromoCode(code);
          setCartOpen(true);
        }}
        onSelectItem={(item) => setSelectedItem(item)}
        onAddToCart={handleAddToCart}
        onQuickStepItem={handleQuickStepItem}
        onOpenCart={() => setCartOpen(true)}
      />

      <ItemModal
        item={selectedItem}
        allItems={items}
        currency={restaurant.currency}
        primaryColor={restaurant.primaryColor}
        taxRate={restaurant.taxRate}
        serviceCharge={restaurant.serviceCharge}
        isDarkSurface={isDarkSurface}
        onClose={() => setSelectedItem(null)}
        onAddToCart={handleAddToCart}
        onQuickAddSuggested={(sug) => handleQuickStepItem(sug, 1)}
      />

      <GuestNameModal
        open={guestModalOpen}
        restaurant={restaurant}
        halls={halls}
        initialGuestName={guestName}
        initialHallName={hallName}
        initialTableNumber={tableNumber}
        allowTableEdit={Boolean(!tableNumber)}
        isDarkSurface={isDarkSurface}
        onClose={() => {
          pendingCartActionRef.current = null;
          setGuestModalOpen(false);
        }}
        onConfirm={handleConfirmGuestModal}
      />

      <LoyaltyRegisterModal
        open={loyaltyModalOpen}
        restaurant={restaurant}
        loyaltyConfig={resolvedLoyaltyConfig}
        existingCustomer={customerProfile}
        isDemoMode={isDemoMode}
        isDarkSurface={isDarkSurface}
        onClose={() => setLoyaltyModalOpen(false)}
        onSuccess={(saved) => setCustomerProfile(saved)}
        onSignedOut={() => setCustomerProfile(null)}
      />

      <CartDrawer
        open={cartOpen}
        restaurant={restaurant}
        cart={displayCart}
        categories={categories}
        stations={effectiveStations}
        allItems={items}
        halls={halls}
        isDemoMode={isDemoMode}
        prefillPromoCode={prefillPromoCode}
        customerProfile={customerProfile}
        loyaltyConfig={resolvedLoyaltyConfig}
        onCustomerUpdated={(updated) => setCustomerProfile(updated)}
        onOpenLoyaltyModal={() => {
          setCartOpen(false);
          setLoyaltyModalOpen(true);
        }}
        hallName={hallName}
        tableNumber={tableNumber}
        sessionId={sessionId}
        guestName={guestName}
        activeGuests={(() => {
          const guestSet = new Map<string, string>();
          const pushG = (raw?: string) => {
            const clean = (raw || '').trim();
            if (clean && !guestSet.has(clean.toLowerCase())) {
              guestSet.set(clean.toLowerCase(), clean);
            }
          };
          (tableSession?.guests || []).forEach(pushG);
          (tableSession?.items || []).forEach((it) => pushG(it.guestName));
          if (guestName) pushG(guestName);
          return Array.from(guestSet.values());
        })()}
        onRequestGuestOrTable={() => setGuestModalOpen(true)}
        onTableOrderSubmitted={handleTableOrderSubmitted}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onQuickAddItem={(it) => handleQuickStepItem(it, 1)}
        onClearCart={() => {
          setCart([]);
          setPrefillPromoCode(null);
          if (sessionId) {
            void handleTableOrderSubmitted('');
          }
          if (typeof window !== 'undefined' && slug) {
            try {
              window.localStorage.removeItem(`sufra_cart_v1_${slug}`);
              window.localStorage.removeItem(`sufra_draft_v1_${slug}`);
            } catch {
              // ignore
            }
          }
        }}
      />
    </div>
  );
}
