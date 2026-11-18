import { useEffect, useMemo, useState } from 'react';
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
import { CartDrawer } from '../components/menu/CartDrawer';
import { ItemModal } from '../components/menu/ItemModal';
import { ThemeRenderer } from '../components/menu/ThemeRenderer';
import { useLanguage } from '../contexts/LanguageContext';
import { DEMO_RESTAURANTS } from '../data/demoRestaurants';
import { getThemeMeta, isCustomThemeId, MENU_THEMES } from '../data/themes';
import { auth, isSuperAdminEmail } from '../lib/firebase';
import {
  fetchActiveCustomThemes,
  fetchCustomThemeById,
  fetchRestaurantBySlug,
} from '../lib/firestoreService';
import { applySeoMetadata, getRestaurantShareMetadata } from '../lib/seoHead';
import {
  ActiveTheme,
  CartItem,
  Category,
  CustomTheme,
  MenuColorMode,
  MenuItem,
  Restaurant,
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
  const [isDemoMode, setIsDemoMode] = useState(false);

  const [previewTheme, setPreviewTheme] = useState<ActiveTheme | null>(null);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [resolvedCustomTheme, setResolvedCustomTheme] = useState<CustomTheme | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartHydratedSlug, setCartHydratedSlug] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [topBarDismissed, setTopBarDismissed] = useState(false);
  const [colorModeOverride, setColorModeOverride] = useState<MenuColorMode>('auto');
  const [prefillPromoCode, setPrefillPromoCode] = useState<string | null>(null);

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
    let active = true;
    setLoading(true);
    setError(null);
    setColorModeOverride('auto');
    setPrefillPromoCode(null);

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

    const urlThemeParam =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('theme')
        : null;
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
          setLoading(false);
          return;
        }
        setRestaurant(res.restaurant);
        setCategories(res.categories);
        setItems(res.items);
        setIsDemoMode(false);
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

  const handleAddToCart = (incoming: CartItem) => {
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
    setCart((prev) =>
      prev
        .map((c) => (c.cartKey === cartKey ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const handleRemoveItem = (cartKey: string) => {
    setCart((prev) => prev.filter((c) => c.cartKey !== cartKey));
  };

  const cartCount = useMemo(() => cart.reduce((s, c) => s + c.quantity, 0), [cart]);
  const cartTotal = useMemo(() => {
    if (!restaurant) return 0;
    const sub = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
    const svc = (sub * (restaurant.serviceCharge || 0)) / 100;
    const tax = ((sub + svc) * (restaurant.taxRate || 0)) / 100;
    return sub + svc + tax;
  }, [cart, restaurant]);

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

      <ThemeRenderer
        restaurant={restaurant}
        categories={categories}
        items={items}
        activeTheme={effectiveTheme}
        customTheme={activeCustomTheme}
        cart={cart}
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

      <CartDrawer
        open={cartOpen}
        restaurant={restaurant}
        cart={cart}
        allItems={items}
        isDemoMode={isDemoMode}
        prefillPromoCode={prefillPromoCode}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onQuickAddItem={(it) => handleQuickStepItem(it, 1)}
        onClearCart={() => {
          setCart([]);
          setPrefillPromoCode(null);
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
