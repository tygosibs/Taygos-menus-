import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpDown,
  CheckCheck,
  Flame,
  LayoutGrid,
  Minus,
  Moon,
  Plus,
  Search,
  Send,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Sun,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { resolveMenuSurfacePalette } from '../../lib/contrastUtils';
import { buildCategoryHierarchy, doesItemMatchHierarchy } from '../../lib/menuHierarchy';
import {
  cycleColorMode,
  getPrimaryItemBadge,
  getResponsiveGridClass,
  sortMenuItems,
} from '../../lib/menuMerchandising';
import {
  CartItem,
  Category,
  MenuColorMode,
  MenuItem,
  MenuSortMode,
  Restaurant,
} from '../../types/menu';
import { LanguageToggleButton } from '../LanguageToggleButton';
import { SafeImage } from '../SafeImage';
import { OffersBannerZone } from './OffersBannerZone';

interface WhatsAppChatThemeProps {
  restaurant: Restaurant;
  categories: Category[];
  items: MenuItem[];
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  colorModeOverride?: MenuColorMode;
  onChangeColorMode?: (mode: MenuColorMode) => void;
  onApplyPromoCode?: (code: string) => void;
  onSelectItem: (item: MenuItem) => void;
  onQuickStepItem: (item: MenuItem, delta: number) => void;
  onOpenCart: () => void;
}

const WHATSAPP_WALLPAPER_SVG = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96' fill='none' stroke='%23000000' stroke-opacity='0.055' stroke-width='1.3'><circle cx='20' cy='20' r='7'/><path d='M62 14l8 12H54l8-12z'/><rect x='14' y='58' width='14' height='10' rx='3'/><path d='M64 60c4-4 10-4 14 0s4 10 0 14-10 4-14 0'/><path d='M42 38l6 6m0-6l-6 6'/></svg>`
);

const COMPLEMENTARY_KEYWORD_RE =
  /مشروب|عصير|قهوة|شاي|لاتيه|موهيتو|بيبسي|كولا|مياه|بطاطس|مقبلات|حلو|حلى|كيك|تراميسو|صودا|drink|juice|coffee|latte|tea|mojito|soda|cola|water|fries|side|dessert|cake/i;

export function WhatsAppChatTheme({
  restaurant,
  categories,
  items,
  cart,
  cartCount,
  cartTotal,
  colorModeOverride,
  onChangeColorMode,
  onApplyPromoCode,
  onSelectItem,
  onQuickStepItem,
  onOpenCart,
}: WhatsAppChatThemeProps) {
  const { lang, dir, t, loc, formatCurrency } = useLanguage();
  const isEn = lang === 'en';

  const [selectedMainCatId, setSelectedMainCatId] = useState<string>('all');
  const [selectedSubCatId, setSelectedSubCatId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortMode, setSortMode] = useState<MenuSortMode>('default');
  const [localColorMode, setLocalColorMode] = useState<MenuColorMode>('auto');
  const [emptyCartHint, setEmptyCartHint] = useState(false);

  const activeColorMode: MenuColorMode =
    colorModeOverride && colorModeOverride !== 'auto'
      ? colorModeOverride
      : localColorMode !== 'auto'
        ? localColorMode
        : restaurant.colorMode || 'auto';

  const palette = useMemo(
    () =>
      resolveMenuSurfacePalette({
        themeIsDark: false,
        colorMode: activeColorMode,
        primaryColor: restaurant.primaryColor,
        headingColor: restaurant.headingColor,
        descriptionColor: restaurant.descriptionColor,
        priceColor: restaurant.priceColor,
      }),
    [
      activeColorMode,
      restaurant.primaryColor,
      restaurant.headingColor,
      restaurant.descriptionColor,
      restaurant.priceColor,
    ]
  );

  const isDark = palette.isDarkSurface;
  const hasCustomTextOverride = Boolean(
    restaurant.headingColor || restaurant.descriptionColor || restaurant.priceColor
  );

  const handleToggleContrast = () => {
    const next = cycleColorMode(activeColorMode, false);
    setLocalColorMode(next);
    onChangeColorMode?.(next);
  };

  const hierarchy = useMemo(() => buildCategoryHierarchy(categories), [categories]);
  const activeSubcategories = useMemo(
    () =>
      selectedMainCatId === 'all'
        ? []
        : hierarchy.subCategoriesByParent.get(selectedMainCatId) || [],
    [selectedMainCatId, hierarchy]
  );

  const availableItems = useMemo(() => items.filter((i) => i.isAvailable), [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = availableItems.filter((item) => {
      const catMatch = doesItemMatchHierarchy(item, selectedMainCatId, selectedSubCatId, hierarchy);
      const textMatch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.name_en || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.description_en || '').toLowerCase().includes(q);
      return catMatch && textMatch;
    });
    return sortMenuItems(matched, sortMode);
  }, [availableItems, selectedMainCatId, selectedSubCatId, hierarchy, searchQuery, sortMode]);

  const itemQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((c) => {
      map.set(c.menuItem.id, (map.get(c.menuItem.id) || 0) + c.quantity);
    });
    return map;
  }, [cart]);

  // Smart Complementary Upsell Suggestions whenever cartCount > 0
  const upsellItems = useMemo(() => {
    if (cartCount === 0 || availableItems.length === 0) return [];
    const cartIds = new Set(cart.map((c) => c.menuItem.id));
    const catNameMap = new Map(
      categories.map((c) => [c.id, `${c.name} ${c.name_en || ''}`])
    );

    const explicitIds = new Set<string>();
    cart.forEach((c) => {
      (c.menuItem.suggestedItemIds || []).forEach((sid) => explicitIds.add(sid));
    });

    const chosen: MenuItem[] = [];
    const seen = new Set<string>();

    // Priority 1: Explicit merchant pairings not already in cart
    availableItems.forEach((item) => {
      if (chosen.length >= 3) return;
      if (explicitIds.has(item.id) && !cartIds.has(item.id) && !seen.has(item.id)) {
        chosen.push(item);
        seen.add(item.id);
      }
    });

    // Priority 2: Complementary drinks, sides, or desserts not yet in cart
    availableItems.forEach((item) => {
      if (chosen.length >= 3) return;
      if (cartIds.has(item.id) || seen.has(item.id)) return;
      const catText = catNameMap.get(item.categoryId) || '';
      const combined = `${item.name} ${item.name_en || ''} ${catText}`;
      if (COMPLEMENTARY_KEYWORD_RE.test(combined)) {
        chosen.push(item);
        seen.add(item.id);
      }
    });

    // Priority 3: Top popular remaining items not yet in cart
    const sortedPopular = [...availableItems].sort(
      (a, b) => (b.ordersCount || 0) - (a.ordersCount || 0)
    );
    sortedPopular.forEach((item) => {
      if (chosen.length >= 3) return;
      if (!cartIds.has(item.id) && !seen.has(item.id)) {
        chosen.push(item);
        seen.add(item.id);
      }
    });

    return chosen;
  }, [cart, cartCount, availableItems, categories]);

  const restName = loc(restaurant.name, restaurant.name_en);
  const displayCurrency = formatCurrency(restaurant.currency);
  const formatPrice = (p: number) => `${p.toFixed(2).replace(/\.00$/, '')} ${displayCurrency}`;
  const gridClass = getResponsiveGridClass(restaurant.menuColumns, false);

  const selectedMainCat = hierarchy.mainCategories.find((c) => c.id === selectedMainCatId);
  const selectedSubCat = activeSubcategories.find((c) => c.id === selectedSubCatId);

  const activeCategoryLabel = searchQuery.trim()
    ? isEn
      ? `Search: "${searchQuery.trim()}"`
      : `بحث: "${searchQuery.trim()}"`
    : selectedSubCat
      ? loc(selectedSubCat.name, selectedSubCat.name_en)
      : selectedMainCat
        ? loc(selectedMainCat.name, selectedMainCat.name_en)
        : isEn
          ? 'Full Menu'
          : 'المنيو بالكامل';

  const nowTime = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(isEn ? 'en-US' : 'ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());
    } catch {
      return '12:00';
    }
  }, [isEn]);

  const selectMainCategory = (mainId: string) => {
    setSelectedMainCatId(mainId);
    setSelectedSubCatId('all');
  };

  const resetChat = () => {
    setSelectedMainCatId('all');
    setSelectedSubCatId('all');
    setSearchQuery('');
    setSortMode('default');
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBottomSendClick = () => {
    if (cartCount > 0) {
      onOpenCart();
    } else {
      setEmptyCartHint(true);
      setTimeout(() => setEmptyCartHint(false), 2600);
    }
  };

  const wallpaperBg = isDark ? '#0B141A' : '#EFEAE2';
  const headerBg = isDark ? '#202C33' : '#075E54';
  const incomingBubbleBg = isDark ? '#202C33' : '#FFFFFF';
  const outgoingBubbleBg = isDark ? '#005C4B' : '#D9FDD3';
  const composerBg = isDark ? '#202C33' : '#F0F2F5';

  return (
    <div
      dir={dir}
      style={{
        backgroundColor: wallpaperBg,
        backgroundImage: `url("data:image/svg+xml,${WHATSAPP_WALLPAPER_SVG}")`,
      }}
      className={`min-h-screen flex flex-col overflow-x-clip max-w-full pb-28 ${
        isDark ? 'text-[#E9EDEF]' : 'text-[#111B21]'
      }`}
    >
      {!restaurant.isOpen && (
        <div className="bg-red-950/95 text-red-100 text-xs font-bold text-center py-2 px-4 border-b border-red-800">
          {t.menu.closedBanner}
        </div>
      )}

      {/* Authentic WhatsApp Top Bar */}
      <header
        style={{ backgroundColor: headerBg }}
        className="sticky top-0 z-30 text-white shadow-md border-b border-black/10"
      >
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={resetChat}
            className="flex items-center gap-2.5 min-w-0 text-start cursor-pointer hover:opacity-95 transition-opacity"
          >
            <div className="relative shrink-0">
              {restaurant.logoUrl ? (
                <SafeImage
                  src={restaurant.logoUrl}
                  alt={restName}
                  className="w-10 h-10 rounded-full object-cover border border-white/30 bg-white/10"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#25D366] text-white font-extrabold flex items-center justify-center text-sm">
                  {restName.slice(0, 1)}
                </div>
              )}
              <span
                aria-hidden="true"
                className="absolute bottom-0 end-0 w-3 h-3 rounded-full bg-[#25D366] ring-2 ring-[#075E54]"
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-extrabold truncate leading-tight">
                {restName}
              </h1>
              <p className="text-[11px] text-[#B7F4D0] font-semibold flex items-center gap-1.5 truncate mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] inline-block animate-pulse shrink-0" />
                <span className="truncate">
                  {isEn ? 'Online • Replies instantly' : 'متصل الآن • يرد فوراً'}
                </span>
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label={t.menu.searchPlaceholder}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                searchOpen ? 'bg-white/25' : 'hover:bg-white/15'
              }`}
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToggleContrast}
              aria-label={isDark ? 'Light WhatsApp mode' : 'Dark WhatsApp mode'}
              className="w-10 h-10 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
            </button>

            <LanguageToggleButton variant="glass" compact />

            <button
              type="button"
              onClick={onOpenCart}
              aria-label={t.menu.viewCart}
              className="min-h-[40px] px-2.5 py-1.5 rounded-full bg-[#25D366] text-zinc-950 font-extrabold text-xs flex items-center gap-1.5 shadow-sm hover:bg-[#1EB958] cursor-pointer shrink-0"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="font-mono-num tabular-nums">{cartCount}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Search & Sort Drawer inside WhatsApp Header */}
        {searchOpen && (
          <div className="max-w-3xl mx-auto px-3 sm:px-4 pb-3 pt-1 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-white/60 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.menu.searchPlaceholder}
                className="w-full ps-9 pe-8 py-2 rounded-full bg-black/25 border border-white/20 text-white placeholder:text-white/65 text-xs sm:text-sm focus:outline-none focus:border-white/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={isEn ? 'Clear search' : 'مسح البحث'}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-white/75 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <OffersBannerZone
        offers={restaurant.offers}
        placement="top"
        accentColor="#008069"
        isDarkSurface={isDark}
        onApplyPromoCode={onApplyPromoCode}
      />

      {/* Interactive WhatsApp Conversation Thread */}
      <main className="max-w-3xl w-full mx-auto px-2.5 sm:px-4 py-4 space-y-3.5 flex-1">
        {/* Today Date Pill */}
        <div className="flex justify-center">
          <span
            className={`px-3 py-1 rounded-lg text-[11px] font-bold shadow-xs ${
              isDark ? 'bg-[#182229] text-[#8696A0]' : 'bg-white/90 text-[#54656F]'
            }`}
          >
            {isEn ? 'TODAY • INSTANT ORDERING' : 'اليوم • طلب فوري عبر القائمة'}
          </span>
        </div>

        {/* 1. Restaurant Welcome Message Bubble */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="flex flex-col items-start max-w-[92%] sm:max-w-[82%]"
        >
          <div
            style={{ backgroundColor: incomingBubbleBg }}
            className={`rounded-2xl rounded-ts-none px-4 py-3 shadow-xs border ${
              isDark ? 'border-white/5' : 'border-black/5'
            } space-y-1.5`}
          >
            <p className="text-[11px] font-extrabold text-[#00A884]">{restName}</p>
            <p className="text-sm leading-relaxed font-semibold">
              {isEn
                ? `Welcome to ${restName} 👋 Choose the category you'd like to order from:`
                : `أهلاً بيك في ${restName} 👋 اختار القسم اللي حابب تطلب منه:`}
            </p>
            <div
              className={`flex items-center justify-end gap-1 text-[10px] font-mono-num ${
                isDark ? 'text-[#8696A0]' : 'text-[#667781]'
              }`}
            >
              <span>{nowTime}</span>
              <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
            </div>
          </div>
        </motion.div>

        {/* 2. Interactive Quick-Reply Category Buttons */}
        <section aria-label={t.menu.allCategories} className="space-y-2 ps-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => selectMainCategory('all')}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-xs border transition-all cursor-pointer ${
                selectedMainCatId === 'all'
                  ? 'bg-[#008069] text-white border-[#008069] shadow-sm'
                  : isDark
                    ? 'bg-[#202C33] text-[#E9EDEF] border-white/10 hover:bg-[#2A3942]'
                    : 'bg-white text-[#008069] border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              <span>{t.menu.allCategories}</span>
              <span className="font-mono-num text-[11px] opacity-80">({availableItems.length})</span>
            </button>

            {hierarchy.mainCategories.map((cat) => {
              const active = selectedMainCatId === cat.id;
              const catName = loc(cat.name, cat.name_en);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => selectMainCategory(cat.id)}
                  className={`min-h-[42px] px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-xs border transition-all cursor-pointer ${
                    active
                      ? 'bg-[#008069] text-white border-[#008069] shadow-sm'
                      : isDark
                        ? 'bg-[#202C33] text-[#E9EDEF] border-white/10 hover:bg-[#2A3942]'
                        : 'bg-white text-[#008069] border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  {cat.imageUrl && (
                    <SafeImage
                      src={cat.imageUrl}
                      alt={catName}
                      className="w-6 h-6 rounded-full object-cover shrink-0 border border-black/10"
                    />
                  )}
                  <span className="whitespace-nowrap">{catName}</span>
                </button>
              );
            })}
          </div>

          {activeSubcategories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 pb-1">
              <button
                type="button"
                onClick={() => setSelectedSubCatId('all')}
                className={`min-h-[36px] px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap shrink-0 border cursor-pointer transition-colors ${
                  selectedSubCatId === 'all'
                    ? 'bg-[#25D366] text-zinc-950 border-[#25D366]'
                    : isDark
                      ? 'bg-[#182229] text-[#E9EDEF] border-white/10'
                      : 'bg-white/95 text-[#111B21] border-black/10'
                }`}
              >
                {isEn ? 'All Sections' : 'كل الأقسام الفرعية'}
              </button>
              {activeSubcategories.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubCatId(sub.id)}
                  className={`min-h-[36px] px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap shrink-0 border flex items-center gap-1.5 cursor-pointer transition-colors ${
                    selectedSubCatId === sub.id
                      ? 'bg-[#25D366] text-zinc-950 border-[#25D366]'
                      : isDark
                        ? 'bg-[#182229] text-[#E9EDEF] border-white/10'
                        : 'bg-white/95 text-[#111B21] border-black/10'
                  }`}
                >
                  {sub.imageUrl && (
                    <SafeImage
                      src={sub.imageUrl}
                      alt={loc(sub.name, sub.name_en)}
                      className="w-4 h-4 rounded-full object-cover shrink-0"
                    />
                  )}
                  <span>{loc(sub.name, sub.name_en)}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 3. Customer Outgoing Green Selection Bubble */}
        <motion.div
          key={`${selectedMainCatId}_${selectedSubCatId}_${searchQuery}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="flex justify-end"
        >
          <div
            style={{ backgroundColor: outgoingBubbleBg }}
            className="rounded-2xl rounded-te-none px-4 py-2.5 shadow-xs max-w-[85%] space-y-1 border border-black/5"
          >
            <p className="text-xs sm:text-sm font-bold">
              {isEn ? `Show me: ${activeCategoryLabel}` : `أريد تصفح: ${activeCategoryLabel}`}
            </p>
            <div
              className={`flex items-center justify-end gap-1 text-[10px] font-mono-num ${
                isDark ? 'text-emerald-200/75' : 'text-[#54656F]'
              }`}
            >
              <span>{nowTime}</span>
              <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
            </div>
          </div>
        </motion.div>

        <OffersBannerZone
          offers={restaurant.offers}
          placement="above_grid"
          accentColor="#008069"
          isDarkSurface={isDark}
          onApplyPromoCode={onApplyPromoCode}
        />

        {/* 4. Restaurant Reply Bubble Containing Interactive Dish Cards */}
        <div
          style={{ backgroundColor: incomingBubbleBg }}
          className={`rounded-2xl rounded-ts-none p-3 sm:p-4 shadow-sm border ${
            isDark ? 'border-white/5' : 'border-black/5'
          } space-y-3`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-black/10 dark:border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-extrabold text-[#00A884] truncate">
                {isEn
                  ? `${activeCategoryLabel} (${filteredItems.length} dishes)`
                  : `إليك قائمة ${activeCategoryLabel} (${filteredItems.length} صنف)`}
              </span>
            </div>

            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold shrink-0 ${
                isDark
                  ? 'bg-[#182229] border-white/10 text-[#E9EDEF]'
                  : 'bg-[#F0F2F5] border-black/5 text-[#111B21]'
              }`}
            >
              <ArrowUpDown className="w-3 h-3 opacity-70" />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as MenuSortMode)}
                aria-label={t.menu.sortLabel}
                className="bg-transparent focus:outline-none cursor-pointer font-bold"
              >
                <option value="default" className="text-zinc-900 bg-white">
                  {t.menu.sortDefault}
                </option>
                <option value="best_selling" className="text-zinc-900 bg-white">
                  {t.menu.sortBestSelling}
                </option>
                <option value="chef_quality" className="text-zinc-900 bg-white">
                  {t.menu.sortChefChoice}
                </option>
                <option value="lowest_price" className="text-zinc-900 bg-white">
                  {t.menu.sortLowestPrice}
                </option>
              </select>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-3">
              <UtensilsCrossed className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-sm font-bold">{t.menu.noResults}</p>
              <button
                type="button"
                onClick={resetChat}
                className="px-4 py-2 rounded-full bg-[#008069] text-white text-xs font-bold cursor-pointer"
              >
                {isEn ? 'Show All Dishes' : 'عرض كل الأصناف'}
              </button>
            </div>
          ) : (
            <div className={gridClass}>
              {filteredItems.map((item) => {
                const itemName = loc(item.name, item.name_en);
                const itemDesc = loc(item.description, item.description_en);
                const qty = itemQtyMap.get(item.id) || 0;
                const badge = getPrimaryItemBadge(item, lang, '#008069');

                return (
                  <article
                    key={item.id}
                    className={`rounded-2xl border overflow-hidden flex flex-col justify-between transition-shadow hover:shadow-md ${
                      isDark
                        ? 'bg-[#111B21] border-white/10'
                        : 'bg-[#FAFAFA] border-black/10'
                    }`}
                  >
                    <div
                      onClick={() => onSelectItem(item)}
                      className="cursor-pointer group"
                    >
                      <div className="aspect-[16/10] bg-black/5 overflow-hidden relative">
                        <SafeImage
                          src={item.imageUrl}
                          alt={itemName}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        />
                        {badge && (
                          <span
                            style={{ backgroundColor: badge.bg, color: badge.fg }}
                            className="absolute top-2 start-2 px-2 py-0.5 rounded-md text-[10px] font-extrabold shadow-xs"
                          >
                            {badge.text}
                          </span>
                        )}
                        {qty > 0 && (
                          <span className="absolute top-2 end-2 px-2 py-0.5 rounded-full bg-[#25D366] text-zinc-950 text-[11px] font-mono-num font-extrabold shadow-sm">
                            {qty}×
                          </span>
                        )}
                      </div>

                      <div className="p-3 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            style={
                              hasCustomTextOverride && restaurant.headingColor
                                ? { color: restaurant.headingColor }
                                : undefined
                            }
                            className="text-sm font-extrabold line-clamp-1 flex items-center gap-1"
                          >
                            <span className="truncate">{itemName}</span>
                            {item.isSpicy && <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                          </h3>
                        </div>

                        {itemDesc && (
                          <p
                            style={
                              hasCustomTextOverride && restaurant.descriptionColor
                                ? { color: restaurant.descriptionColor }
                                : undefined
                            }
                            className={`text-xs line-clamp-2 leading-relaxed ${
                              isDark ? 'text-[#8696A0]' : 'text-[#54656F]'
                            }`}
                          >
                            {itemDesc}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <span
                            style={
                              hasCustomTextOverride && restaurant.priceColor
                                ? { color: restaurant.priceColor }
                                : undefined
                            }
                            className={`font-mono-num tabular-nums text-sm font-extrabold ${
                              isDark ? 'text-[#25D366]' : 'text-[#008069]'
                            }`}
                          >
                            {formatPrice(item.basePrice)}
                          </span>
                          {typeof item.calories === 'number' && item.calories > 0 && (
                            <span
                              className={`text-[11px] font-mono-num ${
                                isDark ? 'text-[#8696A0]' : 'text-[#667781]'
                              }`}
                            >
                              {item.calories} {t.menu.caloriesUnit}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Action Footer: Quick +/- AND Customize/Addons */}
                    <div
                      className={`px-3 pb-3 pt-2 border-t flex items-center justify-between gap-2 ${
                        isDark ? 'border-white/10' : 'border-black/5'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectItem(item)}
                        className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                          isDark
                            ? 'bg-white/10 text-[#E9EDEF] hover:bg-white/15'
                            : 'bg-white text-[#111B21] border border-black/10 hover:bg-zinc-100'
                        }`}
                      >
                        <SlidersHorizontal className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {isEn ? 'Customize' : 'تخصيص / إضافات'}
                        </span>
                      </button>

                      {qty > 0 ? (
                        <div className="flex items-center gap-1 rounded-xl bg-[#008069] text-white p-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onQuickStepItem(item, -1)}
                            aria-label={isEn ? 'Decrease quantity' : 'إنقاص الكمية'}
                            className="w-8 h-8 rounded-lg hover:bg-black/20 flex items-center justify-center cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono-num tabular-nums text-xs font-extrabold min-w-[20px] text-center">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => onQuickStepItem(item, 1)}
                            aria-label={isEn ? 'Increase quantity' : 'زيادة الكمية'}
                            className="w-8 h-8 rounded-lg hover:bg-black/20 flex items-center justify-center cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onQuickStepItem(item, 1)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#1EB958] text-zinc-950 text-xs font-extrabold flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Add' : 'أضف'}</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div
            className={`flex items-center justify-end gap-1 text-[10px] font-mono-num ${
              isDark ? 'text-[#8696A0]' : 'text-[#667781]'
            }`}
          >
            <span>{nowTime}</span>
            <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
          </div>
        </div>

        {/* 5. Smart Upsell Suggestion Bubble (Auto-shown when cartCount > 0) */}
        {cartCount > 0 && upsellItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-start max-w-full sm:max-w-[92%]"
          >
            <div
              style={{ backgroundColor: incomingBubbleBg }}
              className={`w-full rounded-2xl rounded-ts-none p-3.5 sm:p-4 shadow-sm border ${
                isDark ? 'border-emerald-500/30' : 'border-emerald-200'
              } space-y-3`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5 text-[#00A884]">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>
                    {isEn
                      ? 'Would you like to add to your order? 🍟🥤'
                      : 'تحب تضيف مع طلبك؟ 🍟🥤'}
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {upsellItems.map((sug) => {
                  const sugName = loc(sug.name, sug.name_en);
                  const sugQty = itemQtyMap.get(sug.id) || 0;
                  return (
                    <div
                      key={sug.id}
                      className={`p-2 rounded-xl border flex items-center gap-2.5 ${
                        isDark
                          ? 'bg-[#111B21] border-white/10'
                          : 'bg-[#F8FAF9] border-black/10'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectItem(sug)}
                        className="w-12 h-12 rounded-lg overflow-hidden shrink-0 cursor-pointer border-0 p-0 bg-transparent"
                      >
                        <SafeImage
                          src={sug.imageUrl}
                          alt={sugName}
                          className="w-full h-full object-cover"
                        />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold truncate">{sugName}</p>
                        <p
                          className={`font-mono-num text-[11px] font-bold ${
                            isDark ? 'text-[#25D366]' : 'text-[#008069]'
                          }`}
                        >
                          {formatPrice(sug.basePrice)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onQuickStepItem(sug, 1)}
                        aria-label={`${isEn ? 'Add' : 'إضافة'} ${sugName}`}
                        className="min-h-[36px] min-w-[36px] px-2.5 rounded-lg bg-[#25D366] hover:bg-[#1EB958] text-zinc-950 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {sugQty > 0 && <span className="font-mono-num">{sugQty}</span>}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div
                className={`flex items-center justify-end gap-1 text-[10px] font-mono-num ${
                  isDark ? 'text-[#8696A0]' : 'text-[#667781]'
                }`}
              >
                <span>{nowTime}</span>
                <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
              </div>
            </div>
          </motion.div>
        )}

        <OffersBannerZone
          offers={restaurant.offers}
          placement="below_grid"
          accentColor="#008069"
          isDarkSurface={isDark}
          onApplyPromoCode={onApplyPromoCode}
        />
      </main>

      <OffersBannerZone
        offers={restaurant.offers}
        placement="floating"
        accentColor="#008069"
        isDarkSurface={isDark}
        onApplyPromoCode={onApplyPromoCode}
      />

      {/* Empty Cart Toast */}
      {emptyCartHint && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-zinc-950 text-white text-xs font-bold shadow-xl border border-white/15 whitespace-nowrap">
          {isEn
            ? 'Pick at least one dish from the chat first!'
            : 'أضف وجبة واحدة على الأقل من المحادثة أولاً!'}
        </div>
      )}

      {/* Authentic WhatsApp Bottom Composer & Send Order Bar */}
      <footer
        style={{ backgroundColor: composerBg }}
        className={`fixed bottom-0 inset-x-0 z-40 border-t ${
          isDark ? 'border-white/10' : 'border-black/10'
        }`}
      >
        <div className="max-w-3xl mx-auto px-2.5 sm:px-4 py-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => (cartCount > 0 ? onOpenCart() : setSearchOpen(true))}
            className={`flex-1 min-w-0 min-h-[46px] px-4 py-2 rounded-full border flex items-center justify-between gap-2 text-start cursor-pointer transition-colors ${
              isDark
                ? 'bg-[#2A3942] border-white/10 text-[#E9EDEF] hover:bg-[#32434d]'
                : 'bg-white border-black/10 text-[#111B21] hover:bg-zinc-50'
            }`}
          >
            {cartCount > 0 ? (
              <div className="flex items-center justify-between w-full gap-2 min-w-0">
                <span className="text-xs sm:text-sm font-bold truncate flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#25D366] shrink-0" />
                  <span className="truncate">
                    {isEn ? `${cartCount} items selected` : `${cartCount} أصناف في طلبك`}
                  </span>
                </span>
                <span className="font-mono-num tabular-nums text-xs sm:text-sm font-extrabold text-[#00A884] shrink-0">
                  {formatPrice(cartTotal)}
                </span>
              </div>
            ) : (
              <span
                className={`text-xs sm:text-sm truncate ${
                  isDark ? 'text-[#8696A0]' : 'text-[#667781]'
                }`}
              >
                {isEn
                  ? 'Tap any dish above to add to your order...'
                  : 'اختر أطباقك من المحادثة أعلاه للإرسال...'}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleBottomSendClick}
            className="min-h-[46px] px-4 sm:px-5 rounded-full bg-[#25D366] hover:bg-[#1EB958] text-zinc-950 font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-md cursor-pointer shrink-0 transition-transform active:scale-[0.98]"
          >
            <span>{isEn ? 'Send Order' : 'إرسال وتأكيد الطلب'}</span>
            <Send className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </footer>
    </div>
  );
}
