import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Palette, PauseCircle } from 'lucide-react';
import { CartDrawer } from '../components/menu/CartDrawer';
import { ItemModal } from '../components/menu/ItemModal';
import { ThemeRenderer } from '../components/menu/ThemeRenderer';
import { DEMO_RESTAURANTS } from '../data/demoRestaurants';
import { getThemeMeta, isCustomThemeId, MENU_THEMES } from '../data/themes';
import {
  fetchActiveCustomThemes,
  fetchCustomThemeById,
  fetchRestaurantBySlug,
} from '../lib/firestoreService';
import { ActiveTheme, CartItem, Category, CustomTheme, MenuItem, Restaurant } from '../types/menu';

interface PublicMenuPageProps {
  slug: string;
  onNavigate: (path: string) => void;
}

const VALID_THEME_IDS = new Set<string>(MENU_THEMES.map((t) => t.id));

export function PublicMenuPage({ slug, onNavigate }: PublicMenuPageProps) {
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
  const [cartOpen, setCartOpen] = useState(false);

  const showThemeSwitcher = useMemo(() => {
    if (isDemoMode) return true;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tParam = params.get('theme') || '';
      return params.get('preview') === '1' || VALID_THEME_IDS.has(tParam) || isCustomThemeId(tParam);
    }
    return false;
  }, [isDemoMode]);

  useEffect(() => {
    fetchActiveCustomThemes().then(setCustomThemes);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setCart([]);

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
        setError(err instanceof Error ? err.message : 'تعذر تحميل المنيو');
        setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [slug]);

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
      // If decrementing an item that was added with custom options, reduce the last matching item
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
      <div dir="rtl" className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
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
        dir="rtl"
        className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6"
      >
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold">المنيو غير متوفر</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {error ||
              `لم يتم العثور على مطعم بالرابط (${slug}). تأكد من الرابط أو أنشئ منيو جديداً من لوحة التحكم.`}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-4 py-2.5 rounded-xl border border-zinc-700 text-sm font-semibold hover:bg-zinc-800 cursor-pointer"
            >
              الرئيسية
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="px-4 py-2.5 rounded-xl bg-amber-500 text-zinc-950 text-sm font-bold hover:bg-amber-400 cursor-pointer"
            >
              لوحة تحكم المطاعم
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isDemoMode && restaurant.isSuspended) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#FAFAFA] text-zinc-900 flex items-center justify-center p-6"
      >
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <PauseCircle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-zinc-950">عذراً، هذا المنيو متوقف مؤقتاً</h1>
          <p className="text-xs text-zinc-500 leading-relaxed">
            منيو مطعم <span className="font-bold text-zinc-800">{restaurant.name}</span> متوقف عن
            العرض في الوقت الحالي. يرجى المحاولة لاحقاً أو التواصل مع إدارة المطعم.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-5 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 cursor-pointer"
            >
              العودة للصفحة الرئيسية
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
  const isDarkSurface = getThemeMeta(effectiveTheme).isDark;

  return (
    <div className="relative min-h-screen">
      {/* Unobtrusive Theme Preview Strip for Demos / Owner Preview */}
      {showThemeSwitcher && (
        <div
          dir="rtl"
          className="bg-zinc-950 text-zinc-200 border-b border-zinc-800 px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar"
        >
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>الرئيسية</span>
            </button>
            <span className="text-zinc-700">|</span>
            <span className="text-xs text-zinc-400 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" />
              <span>معاينة الثيمات:</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {MENU_THEMES.map((t) => {
              const active = effectiveTheme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPreviewTheme(t.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer font-mono-num ${
                    active
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  {t.number}. {t.name}
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
                  {ct.name}
                </button>
              );
            })}
          </div>
        </div>
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
        onSelectItem={(item) => setSelectedItem(item)}
        onAddToCart={handleAddToCart}
        onQuickStepItem={handleQuickStepItem}
        onOpenCart={() => setCartOpen(true)}
      />

      <ItemModal
        item={selectedItem}
        currency={restaurant.currency}
        primaryColor={restaurant.primaryColor}
        taxRate={restaurant.taxRate}
        serviceCharge={restaurant.serviceCharge}
        isDarkSurface={isDarkSurface}
        onClose={() => setSelectedItem(null)}
        onAddToCart={handleAddToCart}
      />

      <CartDrawer
        open={cartOpen}
        restaurant={restaurant}
        cart={cart}
        isDemoMode={isDemoMode}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={() => setCart([])}
      />
    </div>
  );
}
