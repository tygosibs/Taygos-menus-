import { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Home,
  Info,
  LayoutGrid,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { isCustomThemeId } from '../../data/themes';
import { ActiveTheme, CartItem, Category, CustomTheme, MenuItem, Restaurant } from '../../types/menu';
import { SafeImage } from '../SafeImage';
import { CustomThemeIframe } from './CustomThemeIframe';
import { Flipbook3DTheme } from './Flipbook3DTheme';

interface ThemeRendererProps {
  restaurant: Restaurant;
  categories: Category[];
  items: MenuItem[];
  activeTheme: ActiveTheme;
  customTheme?: CustomTheme | null;
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  onSelectItem: (item: MenuItem) => void;
  onAddToCart: (cartItem: CartItem) => void;
  onQuickStepItem: (item: MenuItem, delta: number) => void;
  onOpenCart: () => void;
}

export function ThemeRenderer({
  restaurant,
  categories,
  items,
  activeTheme,
  customTheme,
  cart,
  cartCount,
  cartTotal,
  onSelectItem,
  onAddToCart,
  onQuickStepItem,
  onOpenCart,
}: ThemeRendererProps) {
  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [quickCatsOpen, setQuickCatsOpen] = useState(false);
  const [reelsSearchOpen, setReelsSearchOpen] = useState(false);
  const [reelsToast, setReelsToast] = useState<string | null>(null);
  const categoryScrollRef = useRef<HTMLDivElement | null>(null);

  const availableItems = useMemo(() => items.filter((i) => i.isAvailable), [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return availableItems.filter((item) => {
      const catMatch = selectedCatId === 'all' || item.categoryId === selectedCatId;
      const textMatch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [availableItems, selectedCatId, searchQuery]);

  const itemQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((c) => {
      map.set(c.menuItem.id, (map.get(c.menuItem.id) || 0) + c.quantity);
    });
    return map;
  }, [cart]);

  const formatPrice = (p: number) => `${p.toFixed(2).replace(/\.00$/, '')} ${restaurant.currency}`;
  const accent = restaurant.primaryColor || '#A61C1C';

  // DYNAMIC INJECTED CUSTOM THEME (from Super Admin custom_themes collection)
  if (isCustomThemeId(activeTheme) && customTheme) {
    return (
      <CustomThemeIframe
        customTheme={customTheme}
        restaurant={restaurant}
        categories={categories}
        items={availableItems}
        cartCount={cartCount}
        cartTotal={cartTotal}
        onSelectItem={onSelectItem}
        onAddToCart={onAddToCart}
        onOpenCart={onOpenCart}
      />
    );
  }

  // THEME 1 (FLAGSHIP): 3D FLIPBOOK & FLOATING 3D DISH
  if (activeTheme === 'theme-1') {
    return (
      <Flipbook3DTheme
        restaurant={restaurant}
        categories={categories}
        items={items}
        cartCount={cartCount}
        cartTotal={cartTotal}
        onAddToCart={onAddToCart}
        onOpenCart={onOpenCart}
      />
    );
  }

  const ClosedBanner = () =>
    !restaurant.isOpen ? (
      <div className="bg-red-950/95 text-red-100 text-xs font-bold text-center py-2 px-4 border-b border-red-800">
        المطعم مغلق حالياً لاستقبال الطلبات — يمكنك تصفح القائمة فقط
      </div>
    ) : null;

  const EmptyState = ({ dark }: { dark: boolean }) => (
    <div
      className={`py-16 text-center rounded-2xl border ${
        dark ? 'border-zinc-800 text-zinc-400' : 'border-stone-200 text-stone-500'
      }`}
    >
      <UtensilsCrossed className="w-8 h-8 mx-auto mb-3 opacity-40" />
      <p className="text-base font-semibold">لا توجد أصناف مطابقة للبحث حالياً</p>
    </div>
  );

  const FloatingCartBar = () =>
    cartCount > 0 ? (
      <div className="fixed bottom-4 inset-x-0 z-40 px-4 pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto">
          <button
            type="button"
            onClick={onOpenCart}
            style={{ backgroundColor: accent }}
            className="w-full h-14 px-5 rounded-2xl text-white shadow-xl flex items-center justify-between font-bold text-sm hover:opacity-95 transition-opacity cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5" />
              <span>عرض السلة</span>
              <span className="font-mono-num text-xs bg-black/25 px-2 py-0.5 rounded-md">
                {cartCount}
              </span>
            </span>
            <span className="font-mono-num text-base">{formatPrice(cartTotal)}</span>
          </button>
        </div>
      </div>
    ) : null;

  // THEME 2: CURVED WHEEL INTERACTIVE
  if (activeTheme === 'theme-2') {
    const activeCatIndex = Math.max(
      0,
      categories.findIndex((c) => c.id === selectedCatId)
    );
    const wheelDisplayItems = filteredItems.length > 0 ? filteredItems : availableItems;
    const safeSlideIdx =
      wheelDisplayItems.length > 0 ? carouselIdx % wheelDisplayItems.length : 0;
    const spotlightItem = wheelDisplayItems[safeSlideIdx];

    const stepSlide = (delta: number) => {
      if (wheelDisplayItems.length === 0) return;
      setCarouselIdx((prev) => (prev + delta + wheelDisplayItems.length) % wheelDisplayItems.length);
    };

    return (
      <div dir="rtl" className="min-h-screen bg-[#FAF9F7] text-stone-900 pb-24">
        <ClosedBanner />
        {/* Curved Top Arc */}
        <section
          style={{
            backgroundColor: accent,
            borderBottomLeftRadius: '50% 45px',
            borderBottomRightRadius: '50% 45px',
          }}
          className="text-white pt-5 pb-12 px-4 shadow-lg relative"
        >
          <div className="max-w-5xl mx-auto space-y-5">
            <header className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {restaurant.logoUrl && (
                  <SafeImage
                    src={restaurant.logoUrl}
                    alt={restaurant.name}
                    className="w-11 h-11 rounded-full object-cover border-2 border-white/50 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-extrabold truncate">{restaurant.name}</h1>
                  {restaurant.tagline && (
                    <p className="text-xs text-white/80 line-clamp-1">{restaurant.tagline}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenCart}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-black/25 hover:bg-black/35 text-white text-xs font-bold flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="font-mono-num">{cartCount}</span>
              </button>
            </header>

            {/* Circular Category Icons Along the Curve */}
            <div className="flex items-center justify-start sm:justify-center gap-4 overflow-x-auto no-scrollbar pb-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedCatId('all');
                  setCarouselIdx(0);
                }}
                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
              >
                <div
                  className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedCatId === 'all'
                      ? 'bg-white text-stone-950 border-white scale-105 shadow-md'
                      : 'bg-white/15 text-white border-white/40 group-hover:bg-white/25'
                  }`}
                >
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold whitespace-nowrap">الكل</span>
              </button>

              {categories.map((cat, idx) => {
                const isActive = selectedCatId === cat.id;
                const arcDrop = Math.abs(idx - activeCatIndex) === 0 ? 'translate-y-1' : '';
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCatId(cat.id);
                      setCarouselIdx(0);
                    }}
                    className={`flex flex-col items-center gap-1.5 shrink-0 cursor-pointer transition-transform ${arcDrop}`}
                  >
                    <div
                      className={`w-14 h-14 rounded-full overflow-hidden border-2 transition-all ${
                        isActive
                          ? 'border-white ring-4 ring-white/30 scale-110 shadow-lg'
                          : 'border-white/50 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <SafeImage
                        src={cat.imageUrl}
                        alt={cat.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[11px] font-bold whitespace-nowrap">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Central Swipeable Plate Carousel */}
        {spotlightItem && (
          <section className="max-w-3xl mx-auto px-4 -mt-8 relative z-10">
            <motion.div
              key={spotlightItem.id}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                if (info.offset.x > 50) stepSlide(1);
                else if (info.offset.x < -50) stepSlide(-1);
              }}
              className="flex flex-col items-center text-center"
            >
              <div className="flex items-center justify-center gap-4 sm:gap-8 w-full">
                <button
                  type="button"
                  onClick={() => stepSlide(-1)}
                  aria-label="الطبق السابق"
                  className="w-11 h-11 rounded-full bg-white border border-stone-200 shadow-md flex items-center justify-center text-stone-800 hover:bg-stone-100 cursor-pointer shrink-0"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                <div
                  onClick={() => onSelectItem(spotlightItem)}
                  className="w-52 h-52 sm:w-64 sm:h-64 rounded-full overflow-hidden border-8 border-white shadow-[0_24px_45px_-12px_rgba(0,0,0,0.3)] bg-white cursor-pointer group shrink-0"
                >
                  <SafeImage
                    src={spotlightItem.imageUrl}
                    alt={spotlightItem.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => stepSlide(1)}
                  aria-label="الطبق التالي"
                  className="w-11 h-11 rounded-full bg-white border border-stone-200 shadow-md flex items-center justify-center text-stone-800 hover:bg-stone-100 cursor-pointer shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-1.5 max-w-md">
                <h2 className="text-xl sm:text-2xl font-extrabold text-stone-950 flex items-center justify-center gap-1.5">
                  <span>{spotlightItem.name}</span>
                  {spotlightItem.isSpicy && <Flame className="w-4 h-4 text-red-500 shrink-0" />}
                </h2>
                <p
                  className="font-mono-num text-lg font-extrabold"
                  style={{ color: accent }}
                >
                  {formatPrice(spotlightItem.basePrice)}
                </p>
                {spotlightItem.description && (
                  <p className="text-xs text-stone-500 line-clamp-2">{spotlightItem.description}</p>
                )}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onSelectItem(spotlightItem)}
                    style={{ backgroundColor: accent }}
                    className="min-h-[44px] px-6 py-2.5 rounded-full text-white text-xs font-bold shadow-md hover:opacity-95 cursor-pointer"
                  >
                    عرض التفاصيل والإضافات
                  </button>
                </div>
              </div>
            </motion.div>
          </section>
        )}

        {/* Search & Full List Below */}
        <main className="max-w-5xl mx-auto px-4 pt-10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-stone-900">كل الأطباق المتاحة</h3>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن وجبة..."
                className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-stone-400"
              />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState dark={false} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map((item) => (
                <article
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className="bg-white border border-stone-200 rounded-2xl p-3.5 flex gap-4 items-center hover:shadow-md transition-shadow cursor-pointer"
                >
                  <SafeImage
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-24 h-24 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-bold text-stone-900 truncate flex items-center gap-1.5">
                      <span>{item.name}</span>
                      {item.isSpicy && <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    </h4>
                    {item.description && (
                      <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="font-mono-num text-sm font-extrabold text-stone-900">
                        {formatPrice(item.basePrice)}
                      </span>
                      <span
                        style={{ backgroundColor: accent }}
                        className="w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>

        <FloatingCartBar />
      </div>
    );
  }

  // THEME 3: MODERN LIGHT FLOATING
  if (activeTheme === 'theme-3') {
    return (
      <div dir="rtl" className="min-h-screen bg-[#F5F5F5] text-zinc-900 pb-28">
        <ClosedBanner />

        <div className="max-w-5xl mx-auto px-4 pt-5 space-y-5">
          {/* Header */}
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {restaurant.logoUrl && (
                <SafeImage
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="w-12 h-12 rounded-2xl object-cover border border-zinc-200 bg-white shrink-0"
                />
              )}
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-950 truncate">
                  {restaurant.name}
                </h1>
                {restaurant.tagline && (
                  <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">{restaurant.tagline}</p>
                )}
              </div>
            </div>

            <div className="relative w-40 sm:w-64 shrink-0">
              <Search className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث..."
                className="w-full pr-9 pl-3 py-2.5 rounded-full bg-white border border-zinc-200 text-xs sm:text-sm focus:outline-none focus:border-zinc-950"
              />
            </div>
          </header>

          {/* Circular Category Bar with Active Dark Ring */}
          <div
            ref={categoryScrollRef}
            className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2"
          >
            <button
              type="button"
              onClick={() => setSelectedCatId('all')}
              className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <div
                className={`w-16 h-16 rounded-full bg-white flex items-center justify-center transition-all ${
                  selectedCatId === 'all'
                    ? 'ring-2 ring-zinc-950 ring-offset-2 ring-offset-[#F5F5F5]'
                    : 'border border-zinc-200'
                }`}
              >
                <LayoutGrid className="w-6 h-6 text-zinc-900" />
              </div>
              <span
                className={`text-xs whitespace-nowrap ${
                  selectedCatId === 'all' ? 'font-extrabold text-zinc-950' : 'text-zinc-500 font-medium'
                }`}
              >
                الكل
              </span>
            </button>

            {categories.map((cat) => {
              const active = selectedCatId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatId(cat.id)}
                  className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <div
                    className={`w-16 h-16 rounded-full overflow-hidden bg-white transition-all ${
                      active
                        ? 'ring-2 ring-zinc-950 ring-offset-2 ring-offset-[#F5F5F5]'
                        : 'border border-zinc-200 opacity-85 hover:opacity-100'
                    }`}
                  >
                    <SafeImage
                      src={cat.imageUrl}
                      alt={cat.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span
                    className={`text-xs whitespace-nowrap ${
                      active ? 'font-extrabold text-zinc-950' : 'text-zinc-500 font-medium'
                    }`}
                  >
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 2-Column Clean White Cards */}
          {filteredItems.length === 0 ? (
            <EmptyState dark={false} />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
              {filteredItems.map((item) => (
                <article
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className="bg-white rounded-2xl p-3 sm:p-4 flex flex-col justify-between gap-3 shadow-xs hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="space-y-2.5">
                    <div className="aspect-[4/3] rounded-xl overflow-hidden bg-zinc-100">
                      <SafeImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm sm:text-base font-extrabold text-zinc-950 line-clamp-1 flex items-center gap-1">
                        <span className="truncate">{item.name}</span>
                        {item.isSpicy && <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                        <span className="font-mono-num font-bold text-zinc-950 text-xs sm:text-sm">
                          {formatPrice(item.basePrice)}
                        </span>
                        {typeof item.calories === 'number' && item.calories > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-num">{item.calories} سعرة</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectItem(item);
                    }}
                    className="w-full min-h-[40px] py-2 px-3 rounded-full bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    عرض الاختيارات
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Floating Rounded Black Bottom Navigation Bar */}
        <div className="fixed bottom-4 inset-x-0 z-40 px-4 flex justify-center pointer-events-none">
          <nav
            aria-label="شريط التنقل السريع"
            className="pointer-events-auto bg-[#111111] text-white rounded-full px-3 h-14 shadow-2xl flex items-center gap-2 sm:gap-4 border border-white/10"
          >
            <button
              type="button"
              onClick={() => {
                setSelectedCatId('all');
                setSearchQuery('');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              aria-label="الرئيسية"
              className="min-w-[44px] h-11 px-3 rounded-full hover:bg-white/10 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">الرئيسية</span>
            </button>

            <button
              type="button"
              onClick={() => setQuickCatsOpen((o) => !o)}
              aria-label="الأقسام"
              className="min-w-[44px] h-11 px-3 rounded-full hover:bg-white/10 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">الأقسام</span>
            </button>

            <button
              type="button"
              onClick={() => setInfoModalOpen(true)}
              aria-label="معلومات المطعم"
              className="min-w-[44px] h-11 px-3 rounded-full hover:bg-white/10 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <Info className="w-4 h-4" />
              <span className="hidden sm:inline">المطعم</span>
            </button>

            <button
              type="button"
              onClick={onOpenCart}
              aria-label="السلة"
              style={{ backgroundColor: accent === '#111111' ? '#FFFFFF' : accent }}
              className={`min-w-[44px] h-10 px-4 rounded-full flex items-center justify-center gap-2 text-xs font-extrabold cursor-pointer ${
                accent === '#111111' ? 'text-zinc-950' : 'text-white'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="font-mono-num">{cartCount}</span>
              {cartCount > 0 && (
                <span className="font-mono-num hidden sm:inline">· {formatPrice(cartTotal)}</span>
              )}
            </button>
          </nav>
        </div>

        {/* Quick Categories Sheet */}
        {quickCatsOpen && (
          <div
            onClick={() => setQuickCatsOpen(false)}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-2xl p-5 space-y-3 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold">الانتقال إلى قسم</h3>
                <button
                  type="button"
                  onClick={() => setQuickCatsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCatId('all');
                    setQuickCatsOpen(false);
                  }}
                  className="py-2.5 px-3 rounded-xl border border-zinc-200 text-xs font-bold hover:bg-zinc-50 cursor-pointer"
                >
                  جميع الأصناف
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCatId(cat.id);
                      setQuickCatsOpen(false);
                    }}
                    className="py-2.5 px-3 rounded-xl border border-zinc-200 text-xs font-bold hover:bg-zinc-50 cursor-pointer truncate"
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Restaurant Info Modal */}
        {infoModalOpen && (
          <div
            onClick={() => setInfoModalOpen(false)}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-2xl p-6 space-y-3 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold">{restaurant.name}</h3>
                <button
                  type="button"
                  onClick={() => setInfoModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {restaurant.tagline && (
                <p className="text-xs text-zinc-600 leading-relaxed">{restaurant.tagline}</p>
              )}
              <div className="text-xs text-zinc-700 space-y-1.5 pt-2 border-t border-zinc-100 font-mono-num">
                <p>الحالة: {restaurant.isOpen ? 'مفتوح الآن' : 'مغلق حالياً'}</p>
                <p>نسبة الضريبة: {restaurant.taxRate}%</p>
                <p>رسوم الخدمة: {restaurant.serviceCharge}%</p>
                <p dir="ltr" className="text-right">
                  WhatsApp: +{restaurant.whatsappNumber}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // THEME 4: MIDNIGHT BURGER DARK
  if (activeTheme === 'theme-4') {
    const amber = '#F59E0B';
    return (
      <div dir="rtl" className="min-h-screen bg-[#0F0F0F] text-zinc-100 pb-24">
        <ClosedBanner />
        <div className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
          <header className="bg-[#1A1A1A] border border-zinc-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {restaurant.logoUrl && (
                <SafeImage
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="w-14 h-14 rounded-xl object-cover border border-amber-500/40 shrink-0"
                />
              )}
              <div>
                <h1 className="text-2xl font-extrabold text-white tracking-wide">
                  {restaurant.name}
                </h1>
                {restaurant.tagline && (
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl leading-relaxed">
                    {restaurant.tagline}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenCart}
              style={{ backgroundColor: amber }}
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-zinc-950 font-extrabold text-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer hover:opacity-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>السلة</span>
              <span className="font-mono-num">({cartCount})</span>
            </button>
          </header>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setSelectedCatId('all')}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCatId === 'all'
                    ? 'bg-[#F59E0B] text-zinc-950'
                    : 'bg-[#1A1A1A] border border-zinc-800 text-zinc-300 hover:border-amber-500/40'
                }`}
              >
                جميع الأصناف
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedCatId === cat.id
                      ? 'bg-[#F59E0B] text-zinc-950'
                      : 'bg-[#1A1A1A] border border-zinc-800 text-zinc-300 hover:border-amber-500/40'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن وجبة..."
                className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-zinc-800 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState dark={true} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredItems.map((item) => (
                <article
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className="bg-[#1A1A1A] border border-zinc-800 rounded-2xl overflow-hidden flex flex-col hover:border-amber-500/50 transition-colors cursor-pointer"
                >
                  <div className="aspect-[4/3] bg-zinc-900 overflow-hidden">
                    <SafeImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-extrabold text-white flex items-center gap-1.5">
                        <span>{item.name}</span>
                        {item.isSpicy && <Flame className="w-4 h-4 text-red-400 shrink-0" />}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                      <span className="font-mono-num text-sm font-extrabold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.18)]">
                        {formatPrice(item.basePrice)}
                      </span>
                      <span className="w-9 h-9 rounded-xl bg-[#F59E0B] text-zinc-950 flex items-center justify-center shrink-0">
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        <FloatingCartBar />
      </div>
    );
  }

  // THEME 5: LUXURY LOUNGE GOLD
  if (activeTheme === 'theme-5') {
    const gold = '#D4AF37';
    return (
      <div dir="rtl" className="min-h-screen bg-[#12151C] text-[#F5F2EB] pb-24">
        <ClosedBanner />
        <div className="max-w-5xl mx-auto px-4 pt-10 space-y-9">
          <header className="text-center space-y-3 border-b border-[#D4AF37]/25 pb-8">
            {restaurant.logoUrl && (
              <SafeImage
                src={restaurant.logoUrl}
                alt={restaurant.name}
                className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-[#D4AF37]/60"
              />
            )}
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-wide text-[#F5F2EB]">
              {restaurant.name}
            </h1>
            {restaurant.tagline && (
              <p className="text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
                {restaurant.tagline}
              </p>
            )}
          </header>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setSelectedCatId('all')}
                className={`min-h-[40px] px-4 py-2 rounded-full border text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  selectedCatId === 'all'
                    ? 'border-[#D4AF37] bg-[#D4AF37] text-[#12151C]'
                    : 'border-[#D4AF37]/30 text-zinc-300 hover:border-[#D4AF37]'
                }`}
              >
                جميع الأطباق
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`min-h-[40px] px-4 py-2 rounded-full border text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    selectedCatId === cat.id
                      ? 'border-[#D4AF37] bg-[#D4AF37] text-[#12151C]'
                      : 'border-[#D4AF37]/30 text-zinc-300 hover:border-[#D4AF37]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-[#D4AF37] absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث..."
                className="w-full pr-9 pl-3 py-2 rounded-full bg-[#181C25] border border-[#D4AF37]/30 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState dark={true} />
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => (
                <article
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className="bg-[#181C25] border border-[#D4AF37]/25 hover:border-[#D4AF37]/70 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-5 transition-colors cursor-pointer"
                >
                  <SafeImage
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full sm:w-36 h-44 sm:h-28 rounded-xl object-cover shrink-0 border border-[#D4AF37]/25"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="text-lg font-extrabold tracking-wide flex items-center gap-1.5">
                        <span>{item.name}</span>
                        {item.isSpicy && <Flame className="w-4 h-4 text-red-400 shrink-0" />}
                      </h3>
                      <span
                        className="font-mono-num text-base font-extrabold shrink-0"
                        style={{ color: gold }}
                      >
                        {formatPrice(item.basePrice)}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
                        {item.description}
                      </p>
                    )}
                    <div className="pt-1 flex items-center justify-between text-xs text-zinc-400">
                      <div className="flex items-center gap-2">
                        {typeof item.calories === 'number' && item.calories > 0 && (
                          <span className="font-mono-num">{item.calories} سعرة</span>
                        )}
                        {item.sizes.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-num">متوفر بـ {item.sizes.length} أحجام</span>
                          </>
                        )}
                      </div>
                      <span className="text-[#D4AF37] font-bold">اطلب الآن</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        <FloatingCartBar />
      </div>
    );
  }

  // THEME 6: FULL-SCREEN REELS / STORIES MENU
  if (activeTheme === 'theme-6') {
    const handleReelsQuickAdd = (item: MenuItem) => {
      const defaultSize = item.sizes && item.sizes.length > 0 ? item.sizes[0] : undefined;
      const unitPrice = defaultSize ? defaultSize.price : item.basePrice;
      const cartKey = `${item.id}__${defaultSize?.name || 'std'}____`;
      onAddToCart({
        cartKey,
        menuItem: item,
        selectedSize: defaultSize,
        selectedAddons: [],
        quantity: 1,
        unitPrice,
      });
      setReelsToast(`تمت إضافة "${item.name}" للسلة`);
      setTimeout(() => setReelsToast(null), 2200);
    };

    return (
      <div dir="rtl" className="h-[100dvh] bg-black text-white flex flex-col overflow-hidden relative">
        <ClosedBanner />

        {/* Overlay Header & Category Filter Pills */}
        <header className="absolute top-0 inset-x-0 z-30 bg-gradient-to-b from-black/85 via-black/45 to-transparent px-4 pt-4 pb-6 space-y-3 pointer-events-none">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 pointer-events-auto">
            <div className="flex items-center gap-2.5 min-w-0">
              {restaurant.logoUrl && (
                <SafeImage
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="w-10 h-10 rounded-full object-cover border border-white/40 shrink-0"
                />
              )}
              <h1 className="text-base sm:text-lg font-extrabold truncate">{restaurant.name}</h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setReelsSearchOpen((s) => !s)}
                aria-label="بحث"
                className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onOpenCart}
                style={{ backgroundColor: accent }}
                className="h-10 px-3.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="font-mono-num">{cartCount}</span>
              </button>
            </div>
          </div>

          {reelsSearchOpen && (
            <div className="max-w-3xl mx-auto pointer-events-auto">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن طبق..."
                className="w-full px-4 py-2 rounded-full bg-black/70 backdrop-blur-md border border-white/25 text-sm text-white placeholder:text-zinc-400 focus:outline-none"
              />
            </div>
          )}

          <div className="max-w-3xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar pointer-events-auto">
            <button
              type="button"
              onClick={() => setSelectedCatId('all')}
              style={selectedCatId === 'all' ? { backgroundColor: accent } : undefined}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCatId === 'all'
                  ? 'text-white'
                  : 'bg-black/45 backdrop-blur-md border border-white/20 text-white/85'
              }`}
            >
              الكل
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCatId(cat.id)}
                style={selectedCatId === cat.id ? { backgroundColor: accent } : undefined}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCatId === cat.id
                    ? 'text-white'
                    : 'bg-black/45 backdrop-blur-md border border-white/20 text-white/85'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </header>

        {/* Vertical Snap-Scroll Feed */}
        {filteredItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <EmptyState dark={true} />
          </div>
        ) : (
          <div
            className="flex-1 overflow-y-auto snap-y snap-mandatory no-scrollbar"
            style={{ scrollSnapType: 'y mandatory' }}
          >
            {filteredItems.map((item, idx) => (
              <section
                key={item.id}
                className="snap-start h-full min-h-full relative flex items-end justify-center overflow-hidden bg-zinc-950"
              >
                <SafeImage
                  src={item.imageUrl}
                  alt={item.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/30" />

                <div className="relative z-20 w-full max-w-3xl mx-auto px-5 pb-8 pt-20 flex items-end justify-between gap-4">
                  {/* Dish Info Bottom Overlay */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="font-mono-num text-xs text-white/70">
                      {idx + 1} / {filteredItems.length}
                      {item.ordersCount > 0 ? ` · طُلب +${item.ordersCount} مرة` : ''}
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2">
                      <span>{item.name}</span>
                      {item.isSpicy && <Flame className="w-5 h-5 text-red-400 shrink-0" />}
                    </h2>
                    {item.description && (
                      <p className="text-xs sm:text-sm text-zinc-200 line-clamp-2 max-w-xl leading-relaxed">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 pt-1">
                      <span
                        style={{ backgroundColor: accent }}
                        className="font-mono-num text-base font-extrabold px-3.5 py-1.5 rounded-xl text-white shadow-lg"
                      >
                        {formatPrice(item.basePrice)}
                      </span>
                      {typeof item.calories === 'number' && item.calories > 0 && (
                        <span className="font-mono-num text-xs text-white/80">
                          {item.calories} سعرة
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Floating Vertical Action Icons */}
                  <div className="flex flex-col items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectItem(item)}
                      className="flex flex-col items-center gap-1 cursor-pointer"
                    >
                      <span className="w-12 h-12 rounded-full bg-black/55 backdrop-blur-md border border-white/25 flex items-center justify-center hover:bg-black/75">
                        <Info className="w-5 h-5" />
                      </span>
                      <span className="text-[10px] font-bold">التفاصيل</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectItem(item)}
                      className="flex flex-col items-center gap-1 cursor-pointer"
                    >
                      <span className="w-12 h-12 rounded-full bg-black/55 backdrop-blur-md border border-white/25 flex items-center justify-center hover:bg-black/75">
                        <SlidersHorizontal className="w-5 h-5" />
                      </span>
                      <span className="text-[10px] font-bold">إضافات</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReelsQuickAdd(item)}
                      className="flex flex-col items-center gap-1 cursor-pointer"
                    >
                      <span
                        style={{ backgroundColor: accent }}
                        className="w-12 h-12 rounded-full text-white shadow-xl flex items-center justify-center hover:opacity-90"
                      >
                        <Plus className="w-6 h-6" />
                      </span>
                      <span className="text-[10px] font-bold">إضافة</span>
                    </button>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        {reelsToast && (
          <div className="fixed top-28 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
            <div className="bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg">
              {reelsToast}
            </div>
          </div>
        )}
      </div>
    );
  }

  // THEME 7: WARM CAFE & BAKERY MINIMAL
  if (activeTheme === 'theme-7') {
    const espresso = '#5C4033';
    return (
      <div dir="rtl" className="min-h-screen bg-[#FAF7F2] text-[#5C4033] pb-24">
        <ClosedBanner />
        <div className="max-w-4xl mx-auto px-4 pt-8 space-y-8">
          <header className="text-center space-y-3 border-b border-[#E5DDD0] pb-7">
            {restaurant.logoUrl && (
              <SafeImage
                src={restaurant.logoUrl}
                alt={restaurant.name}
                className="w-16 h-16 rounded-full object-cover mx-auto border border-[#D7CBB8]"
              />
            )}
            <h1 className="text-3xl font-extrabold tracking-tight text-[#3E2A20]">
              {restaurant.name}
            </h1>
            {restaurant.tagline && (
              <p className="text-sm text-[#7A6154] max-w-lg mx-auto leading-relaxed">
                {restaurant.tagline}
              </p>
            )}
          </header>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-5 overflow-x-auto no-scrollbar border-b border-[#E5DDD0] sm:border-b-0">
              <button
                type="button"
                onClick={() => setSelectedCatId('all')}
                style={selectedCatId === 'all' ? { color: espresso, borderColor: espresso } : undefined}
                className={`pb-2 text-sm font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                  selectedCatId === 'all' ? '' : 'border-transparent text-[#8F776A]'
                }`}
              >
                القائمة الكاملة
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatId(cat.id)}
                  style={selectedCatId === cat.id ? { color: espresso, borderColor: espresso } : undefined}
                  className={`pb-2 text-sm font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                    selectedCatId === cat.id ? '' : 'border-transparent text-[#8F776A]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-[#8F776A] absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث..."
                className="w-full pr-9 pl-3 py-2 rounded-xl bg-white border border-[#E5DDD0] text-sm focus:outline-none"
              />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState dark={false} />
          ) : (
            <div className="divide-y divide-[#E7DFD3] border-t border-b border-[#E7DFD3]">
              {filteredItems.map((item) => (
                <article
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className="py-4 px-2 flex items-center gap-4 hover:bg-white/70 transition-colors cursor-pointer"
                >
                  <SafeImage
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shrink-0 border border-[#E5DDD0]"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-extrabold text-[#3E2A20] flex items-center gap-1.5">
                        <span>{item.name}</span>
                        {item.isSpicy && <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      </h3>
                      <span className="font-mono-num text-sm font-extrabold shrink-0 text-[#5C4033]">
                        {formatPrice(item.basePrice)}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-[#7A6154] line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                    <div className="pt-1 flex items-center justify-between text-xs text-[#8F776A]">
                      <span>
                        {typeof item.calories === 'number' && item.calories > 0
                          ? `${item.calories} سعرة حرارية`
                          : 'محضر طازجاً'}
                      </span>
                      <span
                        style={{ backgroundColor: espresso }}
                        className="px-3 py-1 rounded-lg text-white text-[11px] font-bold"
                      >
                        اطلب الآن
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        <FloatingCartBar />
      </div>
    );
  }

  // THEME 8: MODERN BENTO BOX GRID
  if (activeTheme === 'theme-8') {
    const topThreshold = [...availableItems]
      .sort((a, b) => (b.ordersCount || 0) - (a.ordersCount || 0))
      .slice(0, Math.max(2, Math.ceil(availableItems.length * 0.3)))
      .map((i) => i.id);
    const featuredSet = new Set(topThreshold);

    return (
      <div dir="rtl" className="min-h-screen bg-[#F4F6F8] text-slate-900 pb-24">
        <ClosedBanner />
        <div className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
          <header className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {restaurant.logoUrl && (
                <SafeImage
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shrink-0"
                />
              )}
              <div>
                <h1 className="text-2xl font-extrabold text-slate-950">{restaurant.name}</h1>
                {restaurant.tagline && (
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5 line-clamp-1">
                    {restaurant.tagline}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenCart}
              style={{ backgroundColor: accent }}
              className="min-h-[44px] px-4 py-2.5 rounded-2xl text-white text-xs font-bold flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>السلة</span>
              <span className="font-mono-num">({cartCount})</span>
            </button>
          </header>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setSelectedCatId('all')}
                style={selectedCatId === 'all' ? { backgroundColor: accent, color: '#fff' } : undefined}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCatId === 'all' ? '' : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                الكل
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatId(cat.id)}
                  style={selectedCatId === cat.id ? { backgroundColor: accent, color: '#fff' } : undefined}
                  className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedCatId === cat.id ? '' : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في القائمة..."
                className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none"
              />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState dark={false} />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr">
              {filteredItems.map((item) => {
                const isFeatured = featuredSet.has(item.id);
                return (
                  <article
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    className={`bg-white border border-slate-200 rounded-3xl overflow-hidden flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer ${
                      isFeatured ? 'col-span-2' : 'col-span-1'
                    }`}
                  >
                    <div
                      className={`relative bg-slate-100 overflow-hidden ${
                        isFeatured ? 'aspect-[16/9]' : 'aspect-[4/3]'
                      }`}
                    >
                      <SafeImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      {isFeatured && (
                        <span
                          style={{ backgroundColor: accent }}
                          className="absolute top-3 right-3 px-3 py-1 rounded-full text-white text-[11px] font-extrabold shadow-md"
                        >
                          الأكثر طلباً
                        </span>
                      )}
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <h3
                          className={`font-extrabold text-slate-950 flex items-center gap-1.5 ${
                            isFeatured ? 'text-lg' : 'text-sm sm:text-base'
                          }`}
                        >
                          <span className="line-clamp-1">{item.name}</span>
                          {item.isSpicy && <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        </h3>
                        {item.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="font-mono-num text-sm sm:text-base font-extrabold text-slate-950">
                          {formatPrice(item.basePrice)}
                        </span>
                        <span
                          style={{ backgroundColor: accent }}
                          className="w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
        <FloatingCartBar />
      </div>
    );
  }

  // THEME 9: FAST-FOOD KIOSK EXPRESS
  return (
    <div dir="rtl" className="min-h-screen bg-white text-slate-950 pb-28">
      <ClosedBanner />

      {/* Fixed Kiosk Top Header & Large Icon Category Bar */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {restaurant.logoUrl && (
              <SafeImage
                src={restaurant.logoUrl}
                alt={restaurant.name}
                className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold truncate">{restaurant.name}</h1>
              <p className="text-[11px] text-slate-500">اطلب بسرعة بضغطة واحدة</p>
            </div>
          </div>

          <div className="relative w-44 sm:w-64 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث..."
              className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-100 text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-3 flex items-center gap-2.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCatId('all')}
            style={selectedCatId === 'all' ? { backgroundColor: accent, color: '#fff' } : undefined}
            className={`min-h-[48px] px-4 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              selectedCatId === 'all' ? 'shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>الكل</span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCatId(cat.id)}
              style={
                selectedCatId === cat.id ? { backgroundColor: accent, color: '#fff' } : undefined
              }
              className={`min-h-[48px] px-3 py-1.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCatId === cat.id
                  ? 'shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <SafeImage
                src={cat.imageUrl}
                alt={cat.name}
                className="w-8 h-8 rounded-xl object-cover shrink-0"
              />
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ultra-Clean Kiosk Cards with Instant +/- Quantity Controls */}
      <main className="max-w-7xl mx-auto px-4 pt-6">
        {filteredItems.length === 0 ? (
          <EmptyState dark={false} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => {
              const qty = itemQtyMap.get(item.id) || 0;
              return (
                <article
                  key={item.id}
                  className="bg-[#F8FAFC] border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between"
                >
                  <div
                    onClick={() => onSelectItem(item)}
                    className="cursor-pointer space-y-2.5 p-3 pb-0"
                  >
                    <div className="aspect-[4/3] rounded-xl overflow-hidden bg-white border border-slate-100">
                      <SafeImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-950 line-clamp-1 flex items-center gap-1">
                        <span className="truncate">{item.name}</span>
                        {item.isSpicy && <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      </h3>
                      <p
                        className="font-mono-num text-sm sm:text-base font-extrabold mt-0.5"
                        style={{ color: accent }}
                      >
                        {formatPrice(item.basePrice)}
                      </p>
                    </div>
                  </div>

                  {/* Direct Instant + / - Controls */}
                  <div className="p-3 pt-2.5 flex items-center justify-between gap-2">
                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => onQuickStepItem(item, 1)}
                        style={{ backgroundColor: accent }}
                        className="w-full min-h-[44px] py-2 px-3 rounded-xl text-white text-xs font-extrabold flex items-center justify-center gap-1.5 hover:opacity-95 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة سريعة</span>
                      </button>
                    ) : (
                      <div className="w-full min-h-[44px] rounded-xl bg-white border-2 border-slate-900 px-1.5 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => onQuickStepItem(item, 1)}
                          aria-label="زيادة الكمية"
                          style={{ backgroundColor: accent }}
                          className="w-8 h-8 rounded-lg text-white flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <span className="font-mono-num text-sm font-extrabold text-slate-950">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onQuickStepItem(item, -1)}
                          aria-label="تقليل الكمية"
                          className="w-8 h-8 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Persistent Sticky Bottom Checkout Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 p-3 shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-xs text-slate-500 font-semibold">
              {cartCount > 0 ? `${cartCount} أصناف في طلبك` : 'اختر وجباتك للبدء'}
            </p>
            <p className="font-mono-num text-lg font-extrabold text-slate-950">
              {formatPrice(cartTotal)}
            </p>
          </div>
          <button
            type="button"
            disabled={cartCount === 0}
            onClick={onOpenCart}
            style={{ backgroundColor: accent }}
            className="min-h-[48px] px-6 py-3 rounded-xl text-white text-sm font-extrabold flex items-center gap-2 hover:opacity-95 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>إتمام الطلب</span>
          </button>
        </div>
      </div>
    </div>
  );
}
