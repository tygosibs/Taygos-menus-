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
  X,
} from 'lucide-react';
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCatFilter, setActiveCatFilter] = useState<string>('all');
  const [seeding, setSeeding] = useState(false);

  // Category Form State
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catImageUrl, setCatImageUrl] = useState(CURATED_FOOD_IMAGES[0].url);
  const [catSortOrder, setCatSortOrder] = useState(1);
  const [savingCat, setSavingCat] = useState(false);

  // Item Form State
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCatId, setItemCatId] = useState('');
  const [itemDesc, setItemDesc] = useState('');
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
    setCatImageUrl(CURATED_FOOD_IMAGES[0].url);
    setCatSortOrder(categories.length + 1);
    setCatModalOpen(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatImageUrl(cat.imageUrl || CURATED_FOOD_IMAGES[0].url);
    setCatSortOrder(cat.sortOrder);
    setCatModalOpen(true);
  };

  const handleSaveCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setSavingCat(true);
    try {
      await saveCategory(restaurant.id, restaurant.ownerId, {
        id: editingCat?.id,
        name: catName,
        imageUrl: catImageUrl,
        sortOrder: catSortOrder,
      });
      setCatModalOpen(false);
    } finally {
      setSavingCat(false);
    }
  };

  const openNewItem = () => {
    setEditingItem(null);
    setItemName('');
    setItemCatId(categories[0]?.id || '');
    setItemDesc('');
    setItemBasePrice(150);
    setItemCalories(450);
    setItemImageUrl(CURATED_FOOD_IMAGES[0].url);
    setItemIsSpicy(false);
    setItemAvailable(true);
    setItemOrdersCount(25);
    setItemSizes([
      { name: 'وسط', price: 150 },
      { name: 'كبير', price: 195 },
    ]);
    setItemAddons([{ name: 'جبنة إضافية', price: 25 }]);
    setItemSortOrder(items.length + 1);
    setItemModalOpen(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemCatId(item.categoryId);
    setItemDesc(item.description || '');
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

  const handleSaveItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemCatId) return;
    setSavingItem(true);
    try {
      await saveMenuItem(restaurant.id, restaurant.ownerId, {
        id: editingItem?.id,
        categoryId: itemCatId,
        name: itemName,
        description: itemDesc,
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
    } finally {
      setSavingItem(false);
    }
  };

  const handleImageFile = async (file: File, target: 'cat' | 'item') => {
    setUploadingImg(true);
    try {
      const url = await uploadRestaurantAsset(
        file,
        restaurant.ownerId,
        target === 'cat' ? 'categories' : 'items'
      );
      if (target === 'cat') setCatImageUrl(url);
      else setItemImageUrl(url);
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
          <h2 className="text-lg font-extrabold text-zinc-950">إدارة الأقسام والوجبات</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            إضافة وتعديل وترتيب الأقسام والأصناف مع الأحجام والإضافات والسعرات الحرارية
          </p>
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
              <span>{seeding ? 'جاري التعبئة...' : 'تعبئة قائمة تجريبية'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={openNewCategory}
            className="px-4 py-2 rounded-xl border border-zinc-300 text-zinc-800 text-xs font-bold hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>قسم جديد</span>
          </button>
          <button
            type="button"
            disabled={categories.length === 0}
            onClick={openNewItem}
            className="px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            <span>وجبة جديدة</span>
          </button>
        </div>
      </div>

      {/* Categories List with Reorder Controls */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-zinc-900">
          أقسام المنيو ({categories.length})
        </h3>
        {categories.length === 0 ? (
          <p className="text-xs text-zinc-500">
            لا توجد أقسام بعد. ابدأ بإضافة قسم جديد أو استخدم زر التعبئة التجريبية.
          </p>
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
                    alt={cat.name}
                    className="w-11 h-11 rounded-lg object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-900 truncate">{cat.name}</p>
                    <p className="text-[11px] text-zinc-500 font-mono-num">
                      ترتيب: {idx + 1}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveCategory(idx, -1)}
                    aria-label="تقديم القسم"
                    className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/60 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === categories.length - 1}
                    onClick={() => moveCategory(idx, 1)}
                    aria-label="تأخير القسم"
                    className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/60 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditCategory(cat)}
                    aria-label="تعديل القسم"
                    className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCategory(cat.id)}
                    aria-label="حذف القسم"
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
            كل الوجبات ({items.length})
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
              {cat.name}
            </button>
          ))}
        </div>

        {visibleItems.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center text-sm text-zinc-500">
            لا توجد وجبات في هذا القسم حتى الآن.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleItems.map((item) => {
              const catName = categories.find((c) => c.id === item.categoryId)?.name || 'قسم';
              return (
                <article
                  key={item.id}
                  className="bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-[4/3] bg-zinc-100 relative">
                    <SafeImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-500">
                        <span>{catName}</span>
                        <span className="font-mono-num">
                          {item.sizes.length} أحجام · {item.addons.length} إضافات
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-zinc-950 mt-1 flex items-center gap-1.5">
                        <span>{item.name}</span>
                        {item.isSpicy && <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      </h4>
                      {item.description && (
                        <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                      <span className="font-mono-num text-sm font-extrabold text-zinc-950">
                        {item.basePrice} {restaurant.currency}
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
                          {item.isAvailable ? 'متاح' : 'مخفي'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditItem(item)}
                          aria-label="تعديل الوجبة"
                          className="p-2 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMenuItem(item.id)}
                          aria-label="حذف الوجبة"
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

      {/* Category Modal */}
      {catModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setCatModalOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveCategory}
            className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                {editingCat ? 'تعديل القسم' : 'إضافة قسم جديد'}
              </h3>
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">اسم القسم *</label>
              <input
                type="text"
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="مثال: برجر اللحم"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">الترتيب</label>
              <input
                type="number"
                min={0}
                value={catSortOrder}
                onChange={(e) => setCatSortOrder(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold">صورة القسم</label>
              <div className="flex items-center gap-3">
                <SafeImage
                  src={catImageUrl}
                  alt="صورة القسم"
                  className="w-14 h-14 rounded-xl object-cover border border-zinc-200"
                />
                <label className="px-3 py-2 rounded-xl border border-zinc-300 text-xs font-bold cursor-pointer hover:bg-zinc-50 flex items-center gap-1.5">
                  {uploadingImg ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>رفع صورة</span>
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

            <button
              type="submit"
              disabled={savingCat}
              className="w-full py-3 rounded-xl bg-zinc-950 text-white text-sm font-bold hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
            >
              {savingCat ? 'جاري الحفظ...' : 'حفظ القسم'}
            </button>
          </form>
        </div>
      )}

      {/* Menu Item Modal */}
      {itemModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setItemModalOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveItem}
            className="w-full max-w-2xl bg-white rounded-2xl p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-lg font-extrabold">
                {editingItem ? 'تعديل الوجبة' : 'إضافة وجبة جديدة'}
              </h3>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1">اسم الوجبة *</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="مثال: دبل سماش برجر"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">القسم *</label>
                <select
                  required
                  value={itemCatId}
                  onChange={(e) => setItemCatId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">الوصف والمكونات</label>
              <textarea
                rows={2}
                value={itemDesc}
                onChange={(e) => setItemDesc(e.target.value)}
                placeholder="وصف شهي مختصر يظهر تحت اسم الوجبة..."
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">
                  السعر الأساسي ({restaurant.currency}) *
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
                <label className="block text-xs font-bold mb-1">السعرات</label>
                <input
                  type="number"
                  min={0}
                  value={itemCalories}
                  onChange={(e) => setItemCalories(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">عدد الطلبات</label>
                <input
                  type="number"
                  min={0}
                  value={itemOrdersCount}
                  onChange={(e) => setItemOrdersCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">الترتيب</label>
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
              <label className="block text-xs font-bold">صورة الوجبة</label>
              <div className="flex flex-wrap items-center gap-3">
                <SafeImage
                  src={itemImageUrl}
                  alt="صورة الوجبة"
                  className="w-16 h-16 rounded-xl object-cover border border-zinc-200"
                />
                <label className="px-3.5 py-2 rounded-xl border border-zinc-300 text-xs font-bold cursor-pointer hover:bg-zinc-50 flex items-center gap-1.5">
                  {uploadingImg ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{uploadingImg ? 'جاري الرفع...' : 'رفع من الجهاز'}</span>
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

            {/* Sizes Array Builder */}
            <div className="space-y-2.5 border-t border-zinc-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900">الأحجام والأسعار (Sizes)</span>
                <button
                  type="button"
                  onClick={() =>
                    setItemSizes((prev) => [...prev, { name: '', price: itemBasePrice }])
                  }
                  className="text-xs font-bold text-[#A61C1C] hover:opacity-80 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة حجم</span>
                </button>
              </div>
              {itemSizes.map((sz, idx) => (
                <div key={`sz_${idx}`} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={sz.name}
                    onChange={(e) =>
                      setItemSizes((prev) =>
                        prev.map((s, i) => (i === idx ? { ...s, name: e.target.value } : s))
                      )
                    }
                    placeholder="اسم الحجم (مثال: كبير)"
                    className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-xs"
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
                    placeholder="سعر الحجم"
                    className="w-32 px-3 py-2 rounded-lg border border-zinc-200 text-xs font-mono-num"
                  />
                  <button
                    type="button"
                    onClick={() => setItemSizes((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Addons Array Builder */}
            <div className="space-y-2.5 border-t border-zinc-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900">الإضافات (Add-ons)</span>
                <button
                  type="button"
                  onClick={() =>
                    setItemAddons((prev) => [...prev, { name: '', price: 20 }])
                  }
                  className="text-xs font-bold text-[#A61C1C] hover:opacity-80 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة خيار</span>
                </button>
              </div>
              {itemAddons.map((ad, idx) => (
                <div key={`ad_${idx}`} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ad.name}
                    onChange={(e) =>
                      setItemAddons((prev) =>
                        prev.map((a, i) => (i === idx ? { ...a, name: e.target.value } : a))
                      )
                    }
                    placeholder="اسم الإضافة (مثال: صوص ترافل)"
                    className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-xs"
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
                    placeholder="السعر"
                    className="w-32 px-3 py-2 rounded-lg border border-zinc-200 text-xs font-mono-num"
                  />
                  <button
                    type="button"
                    onClick={() => setItemAddons((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-100">
              <div className="flex items-center gap-5">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemAvailable}
                    onChange={(e) => setItemAvailable(e.target.checked)}
                    className="w-4 h-4 accent-zinc-950"
                  />
                  <span>متاح للطلب</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemIsSpicy}
                    onChange={(e) => setItemIsSpicy(e.target.checked)}
                    className="w-4 h-4 accent-red-600"
                  />
                  <span>صنف حار (Spicy)</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={savingItem}
                className="px-6 py-2.5 rounded-xl bg-zinc-950 text-white text-sm font-bold hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
              >
                {savingItem ? 'جاري الحفظ...' : 'حفظ الوجبة'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
