import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  Flame,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { autoSuggestEnglish } from '../../data/translations';
import {
  removeCategory,
  removeMenuItem,
  reorderCategories,
  saveCategory,
  saveMenuItem,
  seedStarterMenuForRestaurant,
  subscribeCategories,
  subscribeMenuItems,
  toggleMenuItemAvailability,
} from '../../lib/firestoreService';
import { CURATED_FOOD_IMAGES, uploadRestaurantAsset } from '../../lib/imageUtils';
import { Category, ItemAddon, ItemSize, MenuItem, Restaurant } from '../../types/menu';
import { SafeImage } from '../SafeImage';

interface MenuBuilderTabProps {
  restaurant: Restaurant;
}

export function MenuBuilderTab({ restaurant }: MenuBuilderTabProps) {
  const { lang, dir, t, loc, formatCurrency } = useLanguage();
  const isEn = lang === 'en';
  const currencyLabel = formatCurrency(restaurant.currency);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCatFilter, setActiveCatFilter] = useState<string>('all');
  const [seeding, setSeeding] = useState(false);

  // Category Form State
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catNameEn, setCatNameEn] = useState('');
  const [catImageUrl, setCatImageUrl] = useState(CURATED_FOOD_IMAGES[0].url);
  const [catSortOrder, setCatSortOrder] = useState(1);
  const [savingCat, setSavingCat] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  // Item Form State
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemNameEn, setItemNameEn] = useState('');
  const [itemCatId, setItemCatId] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemDescEn, setItemDescEn] = useState('');
  const [itemBasePrice, setItemBasePrice] = useState(120);
  const [itemCalories, setItemCalories] = useState(450);
  const [itemImageUrl, setItemImageUrl] = useState(CURATED_FOOD_IMAGES[0].url);
  const [itemIsSpicy, setItemIsSpicy] = useState(false);
  const [itemAvailable, setItemAvailable] = useState(true);
  const [itemOrdersCount, setItemOrdersCount] = useState(25);
  const [itemSizes, setItemSizes] = useState<ItemSize[]>([]);
  const [itemAddons, setItemAddons] = useState<ItemAddon[]>([]);
  const [itemSortOrder, setItemSortOrder] = useState(1);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  useEffect(() => {
    const unsubCats = subscribeCategories(restaurant.id, setCategories);
    const unsubItems = subscribeMenuItems(restaurant.id, setItems);
    return () => {
      unsubCats();
      unsubItems();
    };
  }, [restaurant.id]);

  const moveCategory = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= categories.length) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    setCategories(reordered);
    await reorderCategories(reordered);
  };

  const openNewCategory = () => {
    setEditingCat(null);
    setCatName('');
    setCatNameEn('');
    setCatError(null);
    setCatImageUrl(CURATED_FOOD_IMAGES[0].url);
    setCatSortOrder(categories.length + 1);
    setCatModalOpen(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatNameEn(cat.name_en || '');
    setCatError(null);
    setCatImageUrl(cat.imageUrl || CURATED_FOOD_IMAGES[0].url);
    setCatSortOrder(cat.sortOrder);
    setCatModalOpen(true);
  };

  const handleSaveCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setSavingCat(true);
    setCatError(null);
    try {
      await saveCategory(restaurant.id, restaurant.ownerId, {
        id: editingCat?.id,
        name: catName,
        name_en: catNameEn,
        imageUrl: catImageUrl,
        sortOrder: catSortOrder,
      });
      setCatModalOpen(false);
    } catch (err) {
      setCatError(err instanceof Error ? err.message : t.auth.errGeneric);
    } finally {
      setSavingCat(false);
    }
  };

  const openNewItem = () => {
    setEditingItem(null);
    setItemName('');
    setItemNameEn('');
    setItemCatId(categories[0]?.id || '');
    setItemDesc('');
    setItemDescEn('');
    setItemError(null);
    setItemBasePrice(150);
    setItemCalories(450);
    setItemImageUrl(CURATED_FOOD_IMAGES[0].url);
    setItemIsSpicy(false);
    setItemAvailable(true);
    setItemOrdersCount(25);
    setItemSizes([
      { name: 'وسط', name_en: 'Medium', price: 150 },
      { name: 'كبير', name_en: 'Large', price: 195 },
    ]);
    setItemAddons([{ name: 'جبنة إضافية', name_en: 'Extra Cheese', price: 25 }]);
    setItemSortOrder(items.length + 1);
    setItemModalOpen(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemNameEn(item.name_en || '');
    setItemCatId(item.categoryId);
    setItemDesc(item.description || '');
    setItemDescEn(item.description_en || '');
    setItemError(null);
    setItemBasePrice(item.basePrice);
    setItemCalories(item.calories ?? 0);
    setItemImageUrl(item.imageUrl || CURATED_FOOD_IMAGES[0].url);
    setItemIsSpicy(Boolean(item.isSpicy));
    setItemAvailable(item.isAvailable);
    setItemOrdersCount(item.ordersCount ?? 25);
    setItemSizes(item.sizes || []);
    setItemAddons(item.addons || []);
    setItemSortOrder(item.sortOrder);
    setItemModalOpen(true);
  };

  const handleAutoFillItemEn = () => {
    if (itemName.trim() && !itemNameEn.trim()) {
      const suggested = autoSuggestEnglish(itemName);
      if (suggested) setItemNameEn(suggested);
    }
    if (itemDesc.trim() && !itemDescEn.trim()) {
      const suggested = autoSuggestEnglish(itemDesc);
      if (suggested) setItemDescEn(suggested);
    }
    setItemSizes((prev) =>
      prev.map((sz) => {
        if (sz.name.trim() && !sz.name_en?.trim()) {
          const suggested = autoSuggestEnglish(sz.name);
          return suggested ? { ...sz, name_en: suggested } : sz;
        }
        return sz;
      })
    );
    setItemAddons((prev) =>
      prev.map((ad) => {
        if (ad.name.trim() && !ad.name_en?.trim()) {
          const suggested = autoSuggestEnglish(ad.name);
          return suggested ? { ...ad, name_en: suggested } : ad;
        }
        return ad;
      })
    );
  };

  const handleSaveItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemCatId) return;
    setSavingItem(true);
    setItemError(null);
    try {
      await saveMenuItem(restaurant.id, restaurant.ownerId, {
        id: editingItem?.id,
        categoryId: itemCatId,
        name: itemName,
        name_en: itemNameEn,
        description: itemDesc,
        description_en: itemDescEn,
        basePrice: itemBasePrice,
        calories: itemCalories,
        imageUrl: itemImageUrl,
        isSpicy: itemIsSpicy,
        isAvailable: itemAvailable,
        ordersCount: itemOrdersCount,
        sizes: itemSizes.filter((s) => s.name.trim()),
        addons: itemAddons.filter((a) => a.name.trim()),
        sortOrder: itemSortOrder,
      });
      setItemModalOpen(false);
    } catch (err) {
      setItemError(err instanceof Error ? err.message : t.auth.errGeneric);
    } finally {
      setSavingItem(false);
    }
  };

  const handleImageFile = async (file: File, target: 'cat' | 'item') => {
    setUploadingImg(true);
    if (target === 'cat') setCatError(null);
    else setItemError(null);
    try {
      const url = await uploadRestaurantAsset(
        file,
        restaurant.ownerId,
        target === 'cat' ? 'categories' : 'items'
      );
      if (target === 'cat') setCatImageUrl(url);
      else setItemImageUrl(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.auth.errGeneric;
      if (target === 'cat') setCatError(msg);
      else setItemError(msg);
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSeedStarter = async () => {
    setSeeding(true);
    try {
      await seedStarterMenuForRestaurant(restaurant.id, restaurant.ownerId);
    } finally {
      setSeeding(false);
    }
  };

  const visibleItems =
    activeCatFilter === 'all' ? items : items.filter((i) => i.categoryId === activeCatFilter);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-zinc-950">{t.admin.menu.title}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{t.admin.menu.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {categories.length === 0 && (
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedStarter}
              className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs font-bold hover:bg-amber-100 flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{seeding ? t.admin.menu.seedingBtn : t.admin.menu.seedBtn}</span>
            </button>
          )}
          <button
            type="button"
            onClick={openNewCategory}
            className="px-4 py-2 rounded-xl border border-zinc-300 text-zinc-800 text-xs font-bold hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.admin.menu.addCategoryBtn}</span>
          </button>
          <button
            type="button"
            disabled={categories.length === 0}
            onClick={openNewItem}
            className="px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            <span>{t.admin.menu.addItemBtn}</span>
          </button>
        </div>
      </div>

      {/* Categories List with Reorder Controls */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-zinc-900">
          {t.admin.menu.categoriesHeading} ({categories.length})
        </h3>
        {categories.length === 0 ? (
          <p className="text-xs text-zinc-500">{t.admin.menu.emptyCategories}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map((cat, idx) => (
              <div
                key={cat.id}
                className="p-3 rounded-xl border border-zinc-200 flex items-center justify-between gap-2 bg-zinc-50/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <SafeImage
                    src={cat.imageUrl}
                    alt={loc(cat.name, cat.name_en)}
                    className="w-11 h-11 rounded-lg object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-900 truncate">
                      {loc(cat.name, cat.name_en)}
                    </p>
                    <p className="text-[11px] text-zinc-500 font-mono-num truncate">
                      {cat.name_en ? `${cat.name} / ${cat.name_en}` : `${isEn ? 'Order' : 'ترتيب'}: ${idx + 1}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveCategory(idx, -1)}
                    aria-label="Move Up"
                    className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/60 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === categories.length - 1}
                    onClick={() => moveCategory(idx, 1)}
                    aria-label="Move Down"
                    className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/60 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditCategory(cat)}
                    aria-label="Edit Category"
                    className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCategory(cat.id)}
                    aria-label="Delete Category"
                    className="p-1.5 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Menu Items Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveCatFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
              activeCatFilter === 'all'
                ? 'bg-zinc-950 text-white'
                : 'bg-white border border-zinc-200 text-zinc-600'
            }`}
          >
            {t.admin.menu.allCategories} ({items.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCatFilter(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                activeCatFilter === cat.id
                  ? 'bg-zinc-950 text-white'
                  : 'bg-white border border-zinc-200 text-zinc-600'
              }`}
            >
              {loc(cat.name, cat.name_en)}
            </button>
          ))}
        </div>

        {visibleItems.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center text-sm text-zinc-500">
            {t.admin.menu.emptyItemsTitle}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleItems.map((item) => {
              const catObj = categories.find((c) => c.id === item.categoryId);
              const catName = catObj ? loc(catObj.name, catObj.name_en) : isEn ? 'Category' : 'قسم';
              return (
                <article
                  key={item.id}
                  className="bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-[4/3] bg-zinc-100 relative">
                    <SafeImage
                      src={item.imageUrl}
                      alt={loc(item.name, item.name_en)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-500">
                        <span>{catName}</span>
                        <span className="font-mono-num">
                          {item.sizes.length} {isEn ? 'sizes' : 'أحجام'} · {item.addons.length}{' '}
                          {isEn ? 'add-ons' : 'إضافات'}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-zinc-950 mt-1 flex items-center gap-1.5">
                        <span className="truncate">{loc(item.name, item.name_en)}</span>
                        {item.isSpicy && <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      </h4>
                      <p className="text-[11px] font-mono-num text-zinc-400 mt-0.5 truncate" dir={isEn ? 'rtl' : 'ltr'}>
                        {isEn
                          ? item.name
                            ? `AR: ${item.name}`
                            : 'AR: —'
                          : item.name_en
                            ? `EN: ${item.name_en}`
                            : 'EN: غير مضاف'}
                      </p>
                      {loc(item.description, item.description_en) && (
                        <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                          {loc(item.description, item.description_en)}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                      <span className="font-mono-num text-sm font-extrabold text-zinc-950">
                        {item.basePrice} {currencyLabel}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            toggleMenuItemAvailability(item.id, !item.isAvailable)
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                            item.isAvailable
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-zinc-100 text-zinc-500 border border-zinc-200'
                          }`}
                        >
                          {item.isAvailable
                            ? t.admin.menu.availableBadge
                            : t.admin.menu.unavailableBadge}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditItem(item)}
                          aria-label="Edit Dish"
                          className="p-2 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMenuItem(item.id)}
                          aria-label="Delete Dish"
                          className="p-2 rounded-lg border border-zinc-200 text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Category Modal (Bilingual AR + EN) */}
      {catModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setCatModalOpen(false)}
        >
          <form
            dir={dir}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveCategory}
            className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                {editingCat ? t.admin.menu.editCategoryTitle : t.admin.menu.addCategoryBtn}
              </h3>
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">
                  {isEn ? 'Category Name (AR) *' : 'اسم القسم (عربي) *'}
                </label>
                <input
                  type="text"
                  dir="rtl"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="مثال: برجر اللحم"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold">
                    {isEn ? 'Category Name (EN)' : 'اسم القسم (إنجليزي)'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (catName.trim()) {
                        const suggested = autoSuggestEnglish(catName);
                        if (suggested) setCatNameEn(suggested);
                      }
                    }}
                    className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
                  >
                    {isEn ? 'Auto EN' : 'تعبئة EN'}
                  </button>
                </div>
                <input
                  type="text"
                  dir="ltr"
                  value={catNameEn}
                  onChange={(e) => setCatNameEn(e.target.value)}
                  placeholder="e.g. Smash Burgers"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm text-left"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">
                {isEn ? 'Sort Order' : 'الترتيب'}
              </label>
              <input
                type="number"
                min={0}
                value={catSortOrder}
                onChange={(e) => setCatSortOrder(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold">
                {isEn ? 'Category Image' : 'صورة القسم'}
              </label>
              <div className="flex items-center gap-3">
                <SafeImage
                  src={catImageUrl}
                  alt="Category"
                  className="w-14 h-14 rounded-xl object-cover border border-zinc-200"
                />
                <label className="px-3 py-2 rounded-xl border border-zinc-300 text-xs font-bold cursor-pointer hover:bg-zinc-50 flex items-center gap-1.5">
                  {uploadingImg ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{t.admin.menu.uploadImage}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageFile(f, 'cat');
                    }}
                  />
                </label>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {CURATED_FOOD_IMAGES.map((img) => (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => setCatImageUrl(img.url)}
                    className={`w-10 h-10 rounded-lg overflow-hidden border-2 cursor-pointer ${
                      catImageUrl === img.url ? 'border-zinc-950' : 'border-transparent opacity-70'
                    }`}
                  >
                    <SafeImage src={img.url} alt={img.label} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {catError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                {catError}
              </div>
            )}

            <button
              type="submit"
              disabled={savingCat}
              className="w-full py-3 rounded-xl bg-zinc-950 text-white text-sm font-bold hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
            >
              {savingCat ? t.admin.themes.savingBtn : t.admin.menu.saveCategoryBtn}
            </button>
          </form>
        </div>
      )}

      {/* Menu Item Modal (Full Bilingual AR + EN) */}
      {itemModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setItemModalOpen(false)}
        >
          <form
            dir={dir}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveItem}
            className="w-full max-w-2xl bg-white rounded-2xl p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-lg font-extrabold">
                {editingItem ? t.admin.menu.editItemTitle : t.admin.menu.newItemTitle}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoFillItemEn}
                  className="px-2.5 py-1.5 rounded-lg border border-zinc-200 text-[11px] font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1 cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>{t.admin.menu.autoFillEn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1">{t.admin.menu.nameArLabel}</label>
                <input
                  type="text"
                  dir="rtl"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="مثال: دبل سماش برجر"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">{t.admin.menu.nameEnLabel}</label>
                <input
                  type="text"
                  dir="ltr"
                  value={itemNameEn}
                  onChange={(e) => setItemNameEn(e.target.value)}
                  placeholder="e.g. Double Smash Burger"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm text-left"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">{t.admin.menu.categoryLabel}</label>
              <select
                required
                value={itemCatId}
                onChange={(e) => setItemCatId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                    {cat.name_en ? ` / ${cat.name_en}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1">{t.admin.menu.descArLabel}</label>
                <textarea
                  dir="rtl"
                  rows={2}
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  placeholder="وصف شهي مختصر يظهر تحت اسم الوجبة..."
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">{t.admin.menu.descEnLabel}</label>
                <textarea
                  dir="ltr"
                  rows={2}
                  value={itemDescEn}
                  onChange={(e) => setItemDescEn(e.target.value)}
                  placeholder="Short appetizing dish description..."
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-sm text-left"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">
                  {t.admin.menu.basePriceLabel} ({currencyLabel})
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  required
                  value={itemBasePrice}
                  onChange={(e) => setItemBasePrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">{t.admin.menu.caloriesLabel}</label>
                <input
                  type="number"
                  min={0}
                  value={itemCalories}
                  onChange={(e) => setItemCalories(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">
                  {isEn ? 'Orders Count' : 'عدد الطلبات'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={itemOrdersCount}
                  onChange={(e) => setItemOrdersCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">
                  {isEn ? 'Sort Order' : 'الترتيب'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={itemSortOrder}
                  onChange={(e) => setItemSortOrder(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-mono-num"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold">{t.admin.menu.imageLabel}</label>
              <div className="flex flex-wrap items-center gap-3">
                <SafeImage
                  src={itemImageUrl}
                  alt="Dish"
                  className="w-16 h-16 rounded-xl object-cover border border-zinc-200"
                />
                <label className="px-3.5 py-2 rounded-xl border border-zinc-300 text-xs font-bold cursor-pointer hover:bg-zinc-50 flex items-center gap-1.5">
                  {uploadingImg ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{uploadingImg ? t.onboarding.logoUploading : t.admin.menu.uploadImage}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageFile(f, 'item');
                    }}
                  />
                </label>
                <div className="flex items-center gap-1.5">
                  {CURATED_FOOD_IMAGES.map((img) => (
                    <button
                      key={img.url}
                      type="button"
                      onClick={() => setItemImageUrl(img.url)}
                      title={img.label}
                      className={`w-10 h-10 rounded-lg overflow-hidden border-2 cursor-pointer ${
                        itemImageUrl === img.url ? 'border-zinc-950' : 'border-transparent opacity-70'
                      }`}
                    >
                      <SafeImage src={img.url} alt={img.label} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bilingual Sizes Array Builder */}
            <div className="space-y-2.5 border-t border-zinc-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900">{t.admin.menu.sizesHeading}</span>
                <button
                  type="button"
                  onClick={() =>
                    setItemSizes((prev) => [
                      ...prev,
                      { name: '', name_en: '', price: itemBasePrice },
                    ])
                  }
                  className="text-xs font-bold text-[#A61C1C] hover:opacity-80 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.admin.menu.addSizeBtn}</span>
                </button>
              </div>
              {itemSizes.map((sz, idx) => (
                <div key={`sz_${idx}`} className="grid grid-cols-12 items-center gap-2">
                  <input
                    type="text"
                    dir="rtl"
                    value={sz.name}
                    onChange={(e) =>
                      setItemSizes((prev) =>
                        prev.map((s, i) => (i === idx ? { ...s, name: e.target.value } : s))
                      )
                    }
                    placeholder={t.admin.menu.sizeArPlaceholder}
                    className="col-span-4 px-3 py-2 rounded-lg border border-zinc-200 text-xs"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={sz.name_en || ''}
                    onChange={(e) =>
                      setItemSizes((prev) =>
                        prev.map((s, i) => (i === idx ? { ...s, name_en: e.target.value } : s))
                      )
                    }
                    placeholder={t.admin.menu.sizeEnPlaceholder}
                    className="col-span-4 px-3 py-2 rounded-lg border border-zinc-200 text-xs text-left"
                  />
                  <input
                    type="number"
                    min={0}
                    value={sz.price}
                    onChange={(e) =>
                      setItemSizes((prev) =>
                        prev.map((s, i) =>
                          i === idx ? { ...s, price: Number(e.target.value) } : s
                        )
                      )
                    }
                    placeholder={isEn ? 'Price' : 'السعر'}
                    className="col-span-3 px-3 py-2 rounded-lg border border-zinc-200 text-xs font-mono-num"
                  />
                  <button
                    type="button"
                    onClick={() => setItemSizes((prev) => prev.filter((_, i) => i !== idx))}
                    className="col-span-1 p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer flex justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Bilingual Addons Array Builder */}
            <div className="space-y-2.5 border-t border-zinc-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900">{t.admin.menu.addonsHeading}</span>
                <button
                  type="button"
                  onClick={() =>
                    setItemAddons((prev) => [...prev, { name: '', name_en: '', price: 20 }])
                  }
                  className="text-xs font-bold text-[#A61C1C] hover:opacity-80 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.admin.menu.addAddonBtn}</span>
                </button>
              </div>
              {itemAddons.map((ad, idx) => (
                <div key={`ad_${idx}`} className="grid grid-cols-12 items-center gap-2">
                  <input
                    type="text"
                    dir="rtl"
                    value={ad.name}
                    onChange={(e) =>
                      setItemAddons((prev) =>
                        prev.map((a, i) => (i === idx ? { ...a, name: e.target.value } : a))
                      )
                    }
                    placeholder={t.admin.menu.addonArPlaceholder}
                    className="col-span-4 px-3 py-2 rounded-lg border border-zinc-200 text-xs"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={ad.name_en || ''}
                    onChange={(e) =>
                      setItemAddons((prev) =>
                        prev.map((a, i) => (i === idx ? { ...a, name_en: e.target.value } : a))
                      )
                    }
                    placeholder={t.admin.menu.addonEnPlaceholder}
                    className="col-span-4 px-3 py-2 rounded-lg border border-zinc-200 text-xs text-left"
                  />
                  <input
                    type="number"
                    min={0}
                    value={ad.price}
                    onChange={(e) =>
                      setItemAddons((prev) =>
                        prev.map((a, i) => (i === idx ? { ...a, price: Number(e.target.value) } : a))
                      )
                    }
                    placeholder={isEn ? 'Price' : 'السعر'}
                    className="col-span-3 px-3 py-2 rounded-lg border border-zinc-200 text-xs font-mono-num"
                  />
                  <button
                    type="button"
                    onClick={() => setItemAddons((prev) => prev.filter((_, i) => i !== idx))}
                    className="col-span-1 p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer flex justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {itemError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                {itemError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-100">
              <div className="flex items-center gap-5">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemAvailable}
                    onChange={(e) => setItemAvailable(e.target.checked)}
                    className="w-4 h-4 accent-zinc-950"
                  />
                  <span>{t.admin.menu.availableToggle}</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemIsSpicy}
                    onChange={(e) => setItemIsSpicy(e.target.checked)}
                    className="w-4 h-4 accent-red-600"
                  />
                  <span>{t.admin.menu.spicyToggle}</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={savingItem}
                className="px-6 py-2.5 rounded-xl bg-zinc-950 text-white text-sm font-bold hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
              >
                {savingItem ? t.admin.themes.savingBtn : t.admin.menu.saveItemBtn}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
