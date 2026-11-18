import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { buildCategoryHierarchy, doesItemMatchHierarchy } from '../../lib/menuHierarchy';
import { CartItem, Category, ItemAddon, ItemSize, MenuItem, Restaurant } from '../../types/menu';
import { LanguageToggleButton } from '../LanguageToggleButton';
import { SafeImage } from '../SafeImage';

interface Flipbook3DThemeProps {
  restaurant: Restaurant;
  categories: Category[];
  items: MenuItem[];
  cartCount: number;
  cartTotal: number;
  onAddToCart: (cartItem: CartItem) => void;
  onOpenCart: () => void;
}

const ITEMS_PER_PAGE = 4;

export function Flipbook3DTheme({
  restaurant,
  categories,
  items,
  cartCount,
  cartTotal,
  onAddToCart,
  onOpenCart,
}: Flipbook3DThemeProps) {
  const { lang, dir, isRtl, t, loc, formatCurrency } = useLanguage();
  const [selectedMainCatId, setSelectedMainCatId] = useState<string>('all');
  const [selectedSubCatId, setSelectedSubCatId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [flipDir, setFlipDir] = useState<1 | -1>(1);

  // Interactive 3D Dish Transition State
  const [focusedItem, setFocusedItem] = useState<MenuItem | null>(null);
  const [selectedSize, setSelectedSize] = useState<ItemSize | undefined>(undefined);
  const [selectedAddons, setSelectedAddons] = useState<ItemAddon[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [addedToast, setAddedToast] = useState<string | null>(null);

  const accent = restaurant.primaryColor || '#A61C1C';
  const displayCurrency = formatCurrency(restaurant.currency);
  const formatPrice = (p: number) => `${p.toFixed(2).replace(/\.00$/, '')} ${displayCurrency}`;

  const hierarchy = useMemo(() => buildCategoryHierarchy(categories), [categories]);
  const activeSubcategories = useMemo(
    () =>
      selectedMainCatId === 'all'
        ? []
        : hierarchy.subCategoriesByParent.get(selectedMainCatId) || [],
    [selectedMainCatId, hierarchy]
  );

  const selectMainCategory = (mainId: string) => {
    setSelectedMainCatId(mainId);
    setSelectedSubCatId('all');
  };

  const availableItems = useMemo(() => items.filter((i) => i.isAvailable), [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return availableItems.filter((item) => {
      const catMatch = doesItemMatchHierarchy(item, selectedMainCatId, selectedSubCatId, hierarchy);
      const textMatch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.name_en || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.description_en || '').toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [availableItems, selectedMainCatId, selectedSubCatId, hierarchy, searchQuery]);

  const pages = useMemo(() => {
    const chunks: MenuItem[][] = [];
    for (let i = 0; i < filteredItems.length; i += ITEMS_PER_PAGE) {
      chunks.push(filteredItems.slice(i, i + ITEMS_PER_PAGE));
    }
    return chunks.length > 0 ? chunks : [[]];
  }, [filteredItems]);

  useEffect(() => {
    setPageIndex(0);
  }, [selectedMainCatId, selectedSubCatId, searchQuery]);

  useEffect(() => {
    if (focusedItem) {
      setSelectedSize(
        focusedItem.sizes && focusedItem.sizes.length > 0 ? focusedItem.sizes[0] : undefined
      );
      setSelectedAddons([]);
      setQuantity(1);
      setNotes('');
    }
  }, [focusedItem]);

  const unitPrice = useMemo(() => {
    if (!focusedItem) return 0;
    const base = selectedSize ? selectedSize.price : focusedItem.basePrice;
    const addonsSum = selectedAddons.reduce((sum, a) => sum + a.price, 0);
    return Math.max(0, base + addonsSum);
  }, [focusedItem, selectedSize, selectedAddons]);

  const safePageIndex = Math.min(pageIndex, pages.length - 1);
  const currentItems = pages[safePageIndex] || [];

  const goToPage = (nextIdx: number) => {
    if (nextIdx < 0 || nextIdx >= pages.length || nextIdx === safePageIndex) return;
    setFlipDir(nextIdx > safePageIndex ? 1 : -1);
    setPageIndex(nextIdx);
  };

  const toggleAddon = (addon: ItemAddon) => {
    setSelectedAddons((prev) =>
      prev.some((a) => a.name === addon.name)
        ? prev.filter((a) => a.name !== addon.name)
        : [...prev, addon]
    );
  };

  const handleConfirmAdd = () => {
    if (!focusedItem) return;
    const addonNames = selectedAddons
      .map((a) => a.name)
      .sort()
      .join(',');
    const cartKey = `${focusedItem.id}__${selectedSize?.name || 'std'}__${addonNames}__${notes.trim()}`;
    onAddToCart({
      cartKey,
      menuItem: focusedItem,
      selectedSize,
      selectedAddons,
      quantity,
      notes: notes.trim() || undefined,
      unitPrice,
    });
    const addedName = loc(focusedItem.name, focusedItem.name_en);
    setFocusedItem(null);
    setAddedToast(
      lang === 'en' ? `Added "${addedName}" to your cart` : `تمت إضافة "${addedName}" إلى السلة`
    );
    setTimeout(() => setAddedToast(null), 2600);
  };

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, loc(c.name, c.name_en)));
    return map;
  }, [categories, loc]);

  const restName = loc(restaurant.name, restaurant.name_en);
  const restTagline = loc(restaurant.tagline, restaurant.tagline_en);

  return (
    <div
      dir={dir}
      className="min-h-screen bg-[#171310] text-[#2A2018] pb-24 relative overflow-x-hidden"
    >
      {!restaurant.isOpen && (
        <div className="bg-red-950/95 text-red-100 text-xs font-bold text-center py-2.5 px-4 border-b border-red-800">
          {t.menu.closedBanner}
        </div>
      )}

      {/* Top Luxury Cover Header */}
      <header className="max-w-6xl mx-auto px-4 pt-6 pb-4 text-[#F7EFE4]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#C6A46C]/25 pb-5">
          <div className="flex items-center gap-3.5 min-w-0">
            {restaurant.logoUrl && (
              <SafeImage
                src={restaurant.logoUrl}
                alt={restName}
                className="w-14 h-14 rounded-2xl object-cover border border-[#C6A46C]/40 shrink-0 shadow-lg"
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#C6A46C] font-semibold">
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>{t.menu.coverBadge}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate mt-0.5">
                {restName}
              </h1>
              {restTagline && (
                <p className="text-xs text-[#D6C8B8] line-clamp-1 mt-0.5">{restTagline}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="relative flex-1 sm:w-52">
              <Search className="w-4 h-4 text-[#C6A46C] absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.menu.searchPlaceholder}
                className="w-full ps-9 pe-3 py-2.5 rounded-xl bg-[#241D18] border border-[#C6A46C]/30 text-sm text-[#F7EFE4] placeholder:text-[#A39382] focus:outline-none focus:border-[#C6A46C]"
              />
            </div>
            <LanguageToggleButton variant="dark" compact />
            <button
              type="button"
              onClick={onOpenCart}
              style={{ backgroundColor: accent }}
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-lg hover:opacity-95 cursor-pointer shrink-0"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{lang === 'en' ? 'Cart' : 'السلة'}</span>
              <span className="font-mono-num bg-black/25 px-2 py-0.5 rounded-md">{cartCount}</span>
            </button>
          </div>
        </div>

        {/* Main Chapter / Category Bookmarks */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-4">
          <button
            type="button"
            onClick={() => selectMainCategory('all')}
            style={
              selectedMainCatId === 'all'
                ? { backgroundColor: accent, borderColor: accent, color: '#fff' }
                : undefined
            }
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
              selectedMainCatId === 'all'
                ? ''
                : 'bg-[#241D18] border-[#C6A46C]/25 text-[#E8DDD0] hover:border-[#C6A46C]/60'
            }`}
          >
            {t.menu.allCategories}
          </button>
          {hierarchy.mainCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => selectMainCategory(cat.id)}
              style={
                selectedMainCatId === cat.id
                  ? { backgroundColor: accent, borderColor: accent, color: '#fff' }
                  : undefined
              }
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                selectedMainCatId === cat.id
                  ? ''
                  : 'bg-[#241D18] border-[#C6A46C]/25 text-[#E8DDD0] hover:border-[#C6A46C]/60'
              }`}
            >
              {loc(cat.name, cat.name_en)}
            </button>
          ))}
        </div>

        {/* Subcategories Bar (Visible when selected Main Category has subcategories) */}
        {activeSubcategories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5">
            <button
              type="button"
              onClick={() => setSelectedSubCatId('all')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                selectedSubCatId === 'all'
                  ? 'bg-[#C6A46C] border-[#C6A46C] text-[#171310]'
                  : 'bg-[#241D18]/80 border-[#C6A46C]/25 text-[#D6C8B8] hover:border-[#C6A46C]/60'
              }`}
            >
              {lang === 'en' ? 'All Sections' : 'كل الأقسام الفرعية'}
            </button>
            {activeSubcategories.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setSelectedSubCatId(sub.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                  selectedSubCatId === sub.id
                    ? 'bg-[#C6A46C] border-[#C6A46C] text-[#171310]'
                    : 'bg-[#241D18]/80 border-[#C6A46C]/25 text-[#D6C8B8] hover:border-[#C6A46C]/60'
                }`}
              >
                {loc(sub.name, sub.name_en)}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* 3D Luxury Flipbook Container */}
      <main className="max-w-6xl mx-auto px-4 pt-2">
        <div
          className="rounded-3xl p-2 sm:p-4 bg-[#2C211A] border border-[#C6A46C]/30 shadow-[0_30px_70px_rgba(0,0,0,0.65)]"
          style={{ perspective: '1200px' }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${selectedMainCatId}-${selectedSubCatId}-${searchQuery}-${safePageIndex}-${lang}`}
              initial={{
                rotateY: isRtl ? (flipDir > 0 ? -24 : 24) : flipDir > 0 ? 24 : -24,
                opacity: 0,
                scale: 0.97,
              }}
              animate={{
                rotateY: 0,
                opacity: 1,
                scale: 1,
              }}
              exit={{
                rotateY: isRtl ? (flipDir > 0 ? 24 : -24) : flipDir > 0 ? -24 : 24,
                opacity: 0,
                scale: 0.97,
              }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                if (isRtl) {
                  if (info.offset.x > 65) {
                    goToPage(safePageIndex + 1);
                  } else if (info.offset.x < -65) {
                    goToPage(safePageIndex - 1);
                  }
                } else {
                  if (info.offset.x < -65) {
                    goToPage(safePageIndex + 1);
                  } else if (info.offset.x > 65) {
                    goToPage(safePageIndex - 1);
                  }
                }
              }}
              style={{
                transformStyle: 'preserve-3d',
                transformOrigin: isRtl
                  ? flipDir > 0
                    ? 'right center'
                    : 'left center'
                  : flipDir > 0
                    ? 'left center'
                    : 'right center',
              }}
              className="rounded-2xl bg-[#FAF5EE] border border-[#E2D4C0] shadow-inner p-4 sm:p-8 relative overflow-hidden"
            >
              {/* Subtle Book Spine Center Shadow on Desktop */}
              <div className="hidden lg:block pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 bg-gradient-to-r from-transparent via-[#C6A46C]/15 to-transparent" />

              {/* Page Header */}
              <div className="flex items-center justify-between gap-4 border-b border-[#E2D4C0] pb-3.5 mb-6 relative z-10">
                <div className="text-xs font-bold text-[#7A6552]">
                  {selectedMainCatId === 'all'
                    ? lang === 'en'
                      ? "Chef's Curated Menu"
                      : 'قائمة الشيف المختارة'
                    : selectedSubCatId !== 'all'
                      ? `${categoryNameMap.get(selectedMainCatId) || ''} › ${categoryNameMap.get(selectedSubCatId) || ''}`
                      : categoryNameMap.get(selectedMainCatId) || t.menu.allCategories}
                </div>
                <div className="font-mono-num text-xs font-bold text-[#7A6552]">
                  {t.menu.pageLabel} {safePageIndex + 1} / {pages.length}
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="py-16 text-center space-y-3 text-[#7A6552]">
                  <UtensilsCrossed className="w-9 h-9 mx-auto opacity-40" />
                  <p className="text-base font-bold">{t.menu.noResults}</p>
                </div>
              ) : (
                <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 relative z-10"
                  style={{ perspective: '1200px' }}
                >
                  {currentItems.map((item) => {
                    const itemName = loc(item.name, item.name_en);
                    const itemDesc = loc(item.description, item.description_en);
                    return (
                      <article
                        key={item.id}
                        onClick={() => setFocusedItem(item)}
                        className="group rounded-2xl bg-[#FFFDF9] border border-[#E6DAC8] p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer"
                        style={{ transformStyle: 'preserve-3d' }}
                      >
                        {/* Floating 3D Dish Image */}
                        <motion.div
                          layoutId={`dish-img-${item.id}`}
                          style={{
                            transform: 'translateZ(30px)',
                            transformStyle: 'preserve-3d',
                          }}
                          className="w-32 h-32 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 bg-stone-200 shadow-[0_18px_32px_-8px_rgba(42,32,24,0.45)] group-hover:-translate-y-1.5 group-hover:rotate-1 transition-transform duration-300 border-2 border-white"
                        >
                          <SafeImage
                            src={item.imageUrl}
                            alt={itemName}
                            className="w-full h-full object-cover"
                          />
                        </motion.div>

                        <div className="flex-1 min-w-0 w-full space-y-2 text-center sm:text-start">
                          <div className="flex items-center justify-center sm:justify-between gap-2">
                            <h3 className="text-base sm:text-lg font-extrabold text-[#231911] flex items-center gap-1.5 truncate">
                              <span className="truncate">{itemName}</span>
                              {item.isSpicy && <Flame className="w-4 h-4 text-red-600 shrink-0" />}
                            </h3>
                          </div>

                          {itemDesc && (
                            <p className="text-xs text-[#6B5848] line-clamp-2 leading-relaxed">
                              {itemDesc}
                            </p>
                          )}

                          <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 text-[#7A6552]">
                              <span
                                className="font-mono-num text-base font-extrabold"
                                style={{ color: accent }}
                              >
                                {formatPrice(item.basePrice)}
                              </span>
                              {item.ordersCount > 0 && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono-num font-semibold text-amber-800">
                                    🔥 +{item.ordersCount}
                                  </span>
                                </>
                              )}
                            </div>

                            <span
                              style={{ backgroundColor: accent }}
                              className="px-3 py-1.5 rounded-lg text-white text-[11px] font-bold shadow-xs"
                            >
                              {t.menu.customizeOrder}
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {/* Book Bottom Flipper Navigation */}
              <div className="mt-8 pt-4 border-t border-[#E2D4C0] flex items-center justify-between gap-3 relative z-10">
                <button
                  type="button"
                  disabled={safePageIndex === 0}
                  onClick={() => goToPage(safePageIndex - 1)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#D4C3AA] bg-white text-[#2A2018] text-xs font-bold flex items-center gap-1.5 hover:bg-[#F3EADF] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isRtl ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronLeft className="w-4 h-4" />
                  )}
                  <span>{t.menu.prevPage}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {pages.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => goToPage(idx)}
                      aria-label={`${t.menu.pageLabel} ${idx + 1}`}
                      style={
                        idx === safePageIndex ? { backgroundColor: accent } : undefined
                      }
                      className={`h-2.5 rounded-full transition-all cursor-pointer ${
                        idx === safePageIndex ? 'w-7' : 'w-2.5 bg-[#D4C3AA] hover:bg-[#B8A183]'
                      }`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  disabled={safePageIndex >= pages.length - 1}
                  onClick={() => goToPage(safePageIndex + 1)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#D4C3AA] bg-white text-[#2A2018] text-xs font-bold flex items-center gap-1.5 hover:bg-[#F3EADF] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <span>{t.menu.nextPage}</span>
                  {isRtl ? (
                    <ChevronLeft className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="text-center text-[11px] text-[#A39382] mt-3">
          {t.menu.flipbookInstruction}
        </p>
      </main>

      {/* Interactive 3D Dish Fly-To-Top-Center Transition Overlay */}
      <AnimatePresence>
        {focusedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setFocusedItem(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-start sm:justify-center p-3 sm:p-6 overflow-y-auto"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg flex flex-col items-center my-auto"
            >
              {/* Docked Top-Center Clean Dish Image */}
              <div className="relative w-full flex justify-center z-20">
                <button
                  type="button"
                  onClick={() => setFocusedItem(null)}
                  aria-label={lang === 'en' ? 'Close details' : 'إغلاق التفاصيل'}
                  className="absolute top-2 end-2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer z-30"
                >
                  <X className="w-5 h-5" />
                </button>

                <motion.div
                  layoutId={`dish-img-${focusedItem.id}`}
                  transition={{ type: 'spring', stiffness: 280, damping: 26 }}
                  className="w-52 h-52 sm:w-60 sm:h-60 rounded-3xl overflow-hidden shadow-[0_25px_55px_rgba(0,0,0,0.65)] border-4 border-white bg-stone-900 -mb-10"
                >
                  <SafeImage
                    src={focusedItem.imageUrl}
                    alt={loc(focusedItem.name, focusedItem.name_en)}
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              </div>

              {/* Expanding Detailed Panel Underneath */}
              <motion.div
                initial={{ opacity: 0, y: 28, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.96 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="w-full bg-[#FAF5EE] text-[#231911] rounded-3xl pt-14 pb-5 px-5 sm:px-7 shadow-2xl border border-[#E2D4C0] space-y-5"
              >
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-xs font-bold">
                    <span className="font-mono-num text-amber-800">
                      {lang === 'en'
                        ? `🔥 +${focusedItem.ordersCount || 25} ${t.menu.ordersCountLabel}`
                        : `🔥 طُلب +${focusedItem.ordersCount || 25} مرة`}
                    </span>
                    {typeof focusedItem.calories === 'number' && focusedItem.calories > 0 && (
                      <>
                        <span className="text-[#B8A183]">·</span>
                        <span className="font-mono-num text-[#7A6552]">
                          {focusedItem.calories} {t.menu.caloriesUnit}
                        </span>
                      </>
                    )}
                  </div>

                  <h2 className="text-2xl font-extrabold flex items-center justify-center gap-2">
                    <span>{loc(focusedItem.name, focusedItem.name_en)}</span>
                    {focusedItem.isSpicy && <Flame className="w-5 h-5 text-red-600 shrink-0" />}
                  </h2>

                  {loc(focusedItem.description, focusedItem.description_en) && (
                    <p className="text-sm text-[#6B5848] leading-relaxed">
                      {loc(focusedItem.description, focusedItem.description_en)}
                    </p>
                  )}
                </div>

                {/* Interactive Size Selector */}
                {focusedItem.sizes && focusedItem.sizes.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#7A6552]">
                      <span>{t.menu.chooseSize}</span>
                      <span>{lang === 'en' ? 'Required' : 'مطلوب'}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {focusedItem.sizes.map((sz) => {
                        const active = selectedSize?.name === sz.name;
                        return (
                          <button
                            key={sz.name}
                            type="button"
                            onClick={() => setSelectedSize(sz)}
                            style={
                              active
                                ? { backgroundColor: accent, borderColor: accent, color: '#fff' }
                                : undefined
                            }
                            className={`min-h-[44px] px-3 py-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                              active
                                ? 'shadow-sm'
                                : 'bg-white border-[#E2D4C0] text-[#2A2018] hover:border-[#C6A46C]'
                            }`}
                          >
                            <span>{loc(sz.name, sz.name_en)}</span>
                            <span className="font-mono-num opacity-90">{formatPrice(sz.price)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Interactive Add-ons Checkboxes */}
                {focusedItem.addons && focusedItem.addons.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#7A6552]">
                      <span>{t.menu.chooseAddons}</span>
                      <span>{t.menu.optionalAddons}</span>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto pe-1">
                      {focusedItem.addons.map((addon) => {
                        const checked = selectedAddons.some((a) => a.name === addon.name);
                        return (
                          <button
                            key={addon.name}
                            type="button"
                            onClick={() => toggleAddon(addon)}
                            style={checked ? { borderColor: accent } : undefined}
                            className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                              checked
                                ? 'bg-white text-[#231911]'
                                : 'bg-white/60 border-[#E2D4C0] text-[#5B483A]'
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              <span
                                style={
                                  checked
                                    ? { backgroundColor: accent, borderColor: accent }
                                    : undefined
                                }
                                className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                                  checked ? 'text-white' : 'border-[#C6A46C]'
                                }`}
                              >
                                {checked && <Check className="w-3.5 h-3.5" />}
                              </span>
                              <span>{loc(addon.name, addon.name_en)}</span>
                            </span>
                            <span className="font-mono-num">+{formatPrice(addon.price)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Kitchen Notes */}
                <input
                  type="text"
                  maxLength={140}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.menu.notesPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E2D4C0] text-xs text-[#231911] placeholder:text-[#9A8570] focus:outline-none focus:border-[#7A6552]"
                />

                {/* Stepper + Instant Add Button */}
                <div className="pt-2 flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-white border border-[#E2D4C0] rounded-xl px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(25, q + 1))}
                      aria-label={lang === 'en' ? 'Increase quantity' : 'زيادة الكمية'}
                      className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#FAF5EE] cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <span className="w-6 text-center font-mono-num font-bold text-sm">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      aria-label={lang === 'en' ? 'Decrease quantity' : 'تقليل الكمية'}
                      className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#FAF5EE] cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmAdd}
                    style={{ backgroundColor: accent }}
                    className="flex-1 min-h-[48px] py-3 px-4 rounded-xl text-white font-bold text-sm flex items-center justify-between shadow-lg hover:opacity-95 transition-opacity cursor-pointer"
                  >
                    <span>{t.menu.addWithTotal}</span>
                    <span className="font-mono-num">{formatPrice(unitPrice * quantity)}</span>
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instant Added Toast */}
      <AnimatePresence>
        {addedToast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-20 inset-x-0 z-40 flex justify-center px-4 pointer-events-none"
          >
            <div className="bg-emerald-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg">
              {addedToast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Cart Bar */}
      {cartCount > 0 && !focusedItem && (
        <div className="fixed bottom-4 inset-x-0 z-40 px-4 pointer-events-none">
          <div className="max-w-lg mx-auto pointer-events-auto">
            <button
              type="button"
              onClick={onOpenCart}
              style={{ backgroundColor: accent }}
              className="w-full h-14 px-5 rounded-2xl text-white shadow-2xl flex items-center justify-between font-bold text-sm hover:opacity-95 transition-opacity cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5" />
                <span>{t.menu.viewCart}</span>
                <span className="font-mono-num text-xs bg-black/25 px-2 py-0.5 rounded-md">
                  {cartCount}
                </span>
              </span>
              <span className="font-mono-num text-base">{formatPrice(cartTotal)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
