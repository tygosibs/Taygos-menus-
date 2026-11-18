import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Edit3,
  Flame,
  FolderTree,
  GripVertical,
  Layers,
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
  reorderMenuItems,
  saveCategory,
  saveMenuItem,
  seedStarterMenuForRestaurant,
  subscribeCategories,
  subscribeMenuItems,
  toggleMenuItemAvailability,
} from '../../lib/firestoreService';
import { CURATED_FOOD_IMAGES, uploadRestaurantAsset } from '../../lib/imageUtils';
import { buildCategoryHierarchy, doesItemMatchHierarchy } from '../../lib/menuHierarchy';
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
  const [activeMainFilter, setActiveMainFilter] = useState<string>('all');
  const [activeSubFilter, setActiveSubFilter] = useState<string>('all');
  const [seeding, setSeeding] = useState(false);

  // Drag & Drop Reordering State
  const [draggingCatId, setDraggingCatId] = useState<string | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [orderSyncStatus, setOrderSyncStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [orderError, setOrderError] = useState<string | null>(null);

  const categoriesRef = useRef<Category[]>([]);
  const itemsRef = useRef<MenuItem[]>([]);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  // Category Form State
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catIsSub, setCatIsSub] = useState(false);
  const [catParentId, setCatParentId] = useState('');
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
    categoriesRef.current = categories;
  }, [categories]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const unsubCats = subscribeCategories(restaurant.id, setCategories);
    const unsubItems = subscribeMenuItems(restaurant.id, setItems);
    return () => {
      unsubCats();
      unsubItems();
      dragCleanupRef.current?.();
    };
  }, [restaurant.id]);

  const markSavedToast = () => {
    setOrderSyncStatus('saved');
    window.setTimeout(() => {
      setOrderSyncStatus((prev) => (prev === 'saved' ? 'idle' : prev));
    }, 2200);
  };

  const persistCategoryOrder = async (reordered: Category[]) => {
    const normalized = reordered.map((c, idx) => ({ ...c, sortOrder: idx + 1 }));
    categoriesRef.current = normalized;
    setCategories(normalized);
    setOrderError(null);
    setOrderSyncStatus('saving');
    try {
      await reorderCategories(normalized);
      markSavedToast();
    } catch (err) {
      setOrderSyncStatus('idle');
      setOrderError(err instanceof Error ? err.message : t.auth.errGeneric);
    }
  };

  const persistItemOrder = async (reordered: MenuItem[]) => {
    const normalized = reordered.map((it, idx) => ({ ...it, sortOrder: idx + 1 }));
    itemsRef.current = normalized;
    setItems(normalized);
    setOrderError(null);
    setOrderSyncStatus('saving');
    try {
      await reorderMenuItems(normalized);
      markSavedToast();
    } catch (err) {
      setOrderSyncStatus('idle');
      setOrderError(err instanceof Error ? err.message : t.auth.errGeneric);
    }
  };

  const hierarchy = useMemo(() => buildCategoryHierarchy(categories), [categories]);

  const flattenOrderedHierarchy = (
    mains: Category[],
    subsByParent: Map<string, Category[]>
  ): Category[] => {
    const out: Category[] = [];
    mains.forEach((m) => {
      out.push(m);
      const children = subsByParent.get(m.id) || [];
      children.forEach((sub) => out.push(sub));
    });
    return out;
  };

  const moveMainCategory = async (index: number, direction: -1 | 1) => {
    const mains = [...hierarchy.mainCategories];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= mains.length) return;
    const [moved] = mains.splice(index, 1);
    mains.splice(targetIdx, 0, moved);
    const flattened = flattenOrderedHierarchy(mains, hierarchy.subCategoriesByParent);
    await persistCategoryOrder(flattened);
  };

  const moveSubCategory = async (parentId: string, index: number, direction: -1 | 1) => {
    const subs = [...(hierarchy.subCategoriesByParent.get(parentId) || [])];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= subs.length) return;
    const [moved] = subs.splice(index, 1);
    subs.splice(targetIdx, 0, moved);
    const updatedMap = new Map(hierarchy.subCategoriesByParent);
    updatedMap.set(parentId, subs);
    const flattened = flattenOrderedHierarchy(hierarchy.mainCategories, updatedMap);
    await persistCategoryOrder(flattened);
  };

  const startMainCategoryDrag = (e: ReactPointerEvent<HTMLButtonElement>, catId: string) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    dragCleanupRef.current?.();

    const scrollParent = (e.currentTarget as HTMLElement).closest('.overflow-y-auto') as HTMLElement | null;
    const initialOrder = categoriesRef.current.map((c) => c.id).join(',');
    setDraggingCatId(catId);
    setOrderError(null);

    const scrollIfNearEdge = (clientY: number) => {
      if (scrollParent) {
        const rect = scrollParent.getBoundingClientRect();
        if (clientY < rect.top + 64) scrollParent.scrollTop -= 14;
        else if (clientY > rect.bottom - 64) scrollParent.scrollTop += 14;
      } else {
        if (clientY < 72) window.scrollBy({ top: -14, behavior: 'auto' });
        else if (clientY > window.innerHeight - 72) window.scrollBy({ top: 14, behavior: 'auto' });
      }
    };

    const handlePointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      scrollIfNearEdge(ev.clientY);
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const card = el?.closest('[data-main-cat-id]') as HTMLElement | null;
      const targetId = card?.getAttribute('data-main-cat-id');
      if (!targetId || targetId === catId) return;

      const curH = buildCategoryHierarchy(categoriesRef.current);
      const mains = [...curH.mainCategories];
      const fromIdx = mains.findIndex((c) => c.id === catId);
      const toIdx = mains.findIndex((c) => c.id === targetId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

      const [moved] = mains.splice(fromIdx, 1);
      mains.splice(toIdx, 0, moved);
      const flattened = flattenOrderedHierarchy(mains, curH.subCategoriesByParent).map((c, idx) => ({
        ...c,
        sortOrder: idx + 1,
      }));
      categoriesRef.current = flattened;
      setCategories(flattened);
    };

    const finishDrag = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
      dragCleanupRef.current = null;
      setDraggingCatId(null);

      const finalOrder = categoriesRef.current.map((c) => c.id).join(',');
      if (finalOrder !== initialOrder) {
        void persistCategoryOrder(categoriesRef.current);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  };

  const startSubCategoryDrag = (
    e: ReactPointerEvent<HTMLButtonElement>,
    subCatId: string,
    parentId: string
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    dragCleanupRef.current?.();

    const scrollParent = (e.currentTarget as HTMLElement).closest('.overflow-y-auto') as HTMLElement | null;
    const initialOrder = categoriesRef.current.map((c) => c.id).join(',');
    setDraggingCatId(subCatId);
    setOrderError(null);

    const scrollIfNearEdge = (clientY: number) => {
      if (scrollParent) {
        const rect = scrollParent.getBoundingClientRect();
        if (clientY < rect.top + 64) scrollParent.scrollTop -= 14;
        else if (clientY > rect.bottom - 64) scrollParent.scrollTop += 14;
      } else {
        if (clientY < 72) window.scrollBy({ top: -14, behavior: 'auto' });
        else if (clientY > window.innerHeight - 72) window.scrollBy({ top: 14, behavior: 'auto' });
      }
    };

    const handlePointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      scrollIfNearEdge(ev.clientY);
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const card = el?.closest('[data-sub-cat-id]') as HTMLElement | null;
      const targetId = card?.getAttribute('data-sub-cat-id');
      const targetParent = card?.getAttribute('data-parent-id');
      if (!targetId || targetId === subCatId || targetParent !== parentId) return;

      const curH = buildCategoryHierarchy(categoriesRef.current);
      const subs = [...(curH.subCategoriesByParent.get(parentId) || [])];
      const fromIdx = subs.findIndex((c) => c.id === subCatId);
      const toIdx = subs.findIndex((c) => c.id === targetId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

      const [moved] = subs.splice(fromIdx, 1);
      subs.splice(toIdx, 0, moved);
      const updatedMap = new Map(curH.subCategoriesByParent);
      updatedMap.set(parentId, subs);
      const flattened = flattenOrderedHierarchy(curH.mainCategories, updatedMap).map((c, idx) => ({
        ...c,
        sortOrder: idx + 1,
      }));
      categoriesRef.current = flattened;
      setCategories(flattened);
    };

    const finishDrag = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
      dragCleanupRef.current = null;
      setDraggingCatId(null);

      const finalOrder = categoriesRef.current.map((c) => c.id).join(',');
      if (finalOrder !== initialOrder) {
        void persistCategoryOrder(categoriesRef.current);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  };

  const startItemDrag = (e: ReactPointerEvent<HTMLButtonElement>, itemId: string) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    dragCleanupRef.current?.();

    const scrollParent = (e.currentTarget as HTMLElement).closest('.overflow-y-auto') as HTMLElement | null;
    const initialOrder = itemsRef.current.map((it) => it.id).join(',');
    setDraggingItemId(itemId);
    setOrderError(null);

    const scrollIfNearEdge = (clientY: number) => {
      if (scrollParent) {
        const rect = scrollParent.getBoundingClientRect();
        if (clientY < rect.top + 64) scrollParent.scrollTop -= 16;
        else if (clientY > rect.bottom - 64) scrollParent.scrollTop += 16;
      } else {
        if (clientY < 72) window.scrollBy({ top: -16, behavior: 'auto' });
        else if (clientY > window.innerHeight - 72) window.scrollBy({ top: 16, behavior: 'auto' });
      }
    };

    const handlePointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      scrollIfNearEdge(ev.clientY);
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const card = el?.closest('[data-item-card-id]') as HTMLElement | null;
      const targetId = card?.getAttribute('data-item-card-id');
      if (!targetId || targetId === itemId) return;

      const list = [...itemsRef.current];
      const fromIdx = list.findIndex((it) => it.id === itemId);
      const toIdx = list.findIndex((it) => it.id === targetId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      itemsRef.current = list;
      setItems(list);
    };

    const finishDrag = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
      dragCleanupRef.current = null;
      setDraggingItemId(null);

      const finalOrder = itemsRef.current.map((it) => it.id).join(',');
      if (finalOrder !== initialOrder) {
        void persistItemOrder(itemsRef.current);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  };

  const openNewMainCategory = () => {
    setEditingCat(null);
    setCatIsSub(false);
    setCatParentId('');
    setCatName('');
    setCatNameEn('');
    setCatError(null);
    setCatImageUrl(CURATED_FOOD_IMAGES[0].url);
    setCatSortOrder(categories.length + 1);
    setCatModalOpen(true);
  };

  const openNewSubCategory = (parentId?: string) => {
    const defaultParent = parentId || hierarchy.mainCategories[0]?.id || '';
    setEditingCat(null);
    setCatIsSub(Boolean(defaultParent));
    setCatParentId(defaultParent);
    setCatName('');
    setCatNameEn('');
    setCatError(null);
    setCatImageUrl(CURATED_FOOD_IMAGES[1].url);
    setCatSortOrder(categories.length + 1);
    setCatModalOpen(true);
  };

  const openEditCategory = (cat: Category) => {
    const hasParent = Boolean(cat.parentId && hierarchy.categoryById.has(cat.parentId));
    setEditingCat(cat);
    setCatIsSub(hasParent);
    setCatParentId(hasParent ? cat.parentId || '' : hierarchy.mainCategories.find((m) => m.id !== cat.id)?.id || '');
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
    if (catIsSub && !catParentId) {
      setCatError(isEn ? 'Please choose a parent main category.' : 'يرجى اختيار القائمة الرئيسية التابع لها.');
      return;
    }
    setSavingCat(true);
    setCatError(null);
    try {
      await saveCategory(restaurant.id, restaurant.ownerId, {
        id: editingCat?.id,
        parentId: catIsSub ? catParentId : '',
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

  const openNewItem = (preferredCatId?: string) => {
    const firstSub = hierarchy.mainCategories
      .flatMap((m) => hierarchy.subCategoriesByParent.get(m.id) || [])
      .at(0);
    const defaultCat =
      preferredCatId ||
      (activeSubFilter !== 'all'
        ? activeSubFilter
        : activeMainFilter !== 'all'
          ? hierarchy.subCategoriesByParent.get(activeMainFilter)?.[0]?.id || activeMainFilter
          : firstSub?.id || categories[0]?.id || '');

    setEditingItem(null);
    setItemName('');
    setItemNameEn('');
    setItemCatId(defaultCat);
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

  const activeFilterSubs = useMemo(() => {
    if (activeMainFilter === 'all') return [];
    return hierarchy.subCategoriesByParent.get(activeMainFilter) || [];
  }, [activeMainFilter, hierarchy]);

  const visibleItems = useMemo(
    () =>
      items.filter((item) =>
        doesItemMatchHierarchy(item, activeMainFilter, activeSubFilter, hierarchy)
      ),
    [items, activeMainFilter, activeSubFilter, hierarchy]
  );

  const editingCatHasChildren = Boolean(
    editingCat && (hierarchy.subCategoriesByParent.get(editingCat.id)?.length || 0) > 0
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-zinc-950">{t.admin.menu.title}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isEn
              ? 'Organize your menu into Main Categories (e.g. Kitchen, Bar) → Subcategories (e.g. Salads, Grills, Coffee) → Dishes.'
              : 'نظّم منيو مطعمك باحترافية: قوائم رئيسية (مثل: المطبخ، البار) ← أقسام فرعية (سلطات، مشويات، قهوة) ← أصناف.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {categories.length === 0 && (
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedStarter}
              className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs font-bold hover:bg-amber-100 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              <span>{seeding ? t.admin.menu.seedingBtn : t.admin.menu.seedBtn}</span>
            </button>
          )}
          <button
            type="button"
            onClick={openNewMainCategory}
            className="px-3.5 py-2 rounded-xl border border-zinc-300 text-zinc-800 text-xs font-bold hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <FolderTree className="w-4 h-4" />
            <span>{isEn ? 'Add Main Category' : 'إضافة قائمة رئيسية'}</span>
          </button>
          <button
            type="button"
            disabled={hierarchy.mainCategories.length === 0}
            onClick={() =>
              openNewSubCategory(
                activeMainFilter !== 'all' ? activeMainFilter : hierarchy.mainCategories[0]?.id
              )
            }
            className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50/70 text-amber-950 text-xs font-bold hover:bg-amber-100 flex items-center gap-1.5 cursor-pointer disabled:opacity-40 whitespace-nowrap"
          >
            <Layers className="w-4 h-4" />
            <span>{isEn ? 'Add Subcategory' : 'إضافة قسم فرعي'}</span>
          </button>
          <button
            type="button"
            disabled={categories.length === 0}
            onClick={() => openNewItem()}
            className="px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-40 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{t.admin.menu.addItemBtn}</span>
          </button>
        </div>
      </div>

      {/* Hierarchical Categories (Main Categories -> Subcategories) with Drag & Drop Reordering */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">
              {isEn
                ? `Menu Structure (${hierarchy.mainCategories.length} Main · ${categories.length - hierarchy.mainCategories.length} Sub)`
                : `هيكل القوائم (${hierarchy.mainCategories.length} رئيسية · ${categories.length - hierarchy.mainCategories.length} فرعية)`}
            </h3>
            {categories.length > 1 && (
              <p className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1">
                <GripVertical className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>
                  {isEn
                    ? 'Drag any Main Category or Subcategory from the grip handle to reorder instantly on the live menu.'
                    : 'اسحب أي قائمة رئيسية أو قسم فرعي من أيقونة المقبض لتحديث الترتيب فوراً في المنيو العام.'}
                </span>
              </p>
            )}
          </div>

          {orderSyncStatus === 'saving' && (
            <span className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700 text-[11px] font-bold flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{isEn ? 'Saving order...' : 'جاري حفظ الترتيب...'}</span>
            </span>
          )}
          {orderSyncStatus === 'saved' && (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>{isEn ? 'Order saved to menu' : 'تم حفظ الترتيب في المنيو'}</span>
            </span>
          )}
        </div>

        {orderError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
            {orderError}
          </div>
        )}

        {hierarchy.mainCategories.length === 0 ? (
          <p className="text-xs text-zinc-500">{t.admin.menu.emptyCategories}</p>
        ) : (
          <div className="space-y-4">
            {hierarchy.mainCategories.map((main, mainIdx) => {
              const subs = hierarchy.subCategoriesByParent.get(main.id) || [];
              const isMainDragging = draggingCatId === main.id;
              const subIds = subs.map((s) => s.id);
              const totalDishesInMain = items.filter(
                (i) => i.categoryId === main.id || subIds.includes(i.categoryId)
              ).length;

              return (
                <div
                  key={main.id}
                  data-main-cat-id={main.id}
                  className={`rounded-2xl border overflow-hidden transition-all select-none ${
                    isMainDragging
                      ? 'border-zinc-950 bg-amber-50/40 ring-2 ring-zinc-950 shadow-lg relative z-10'
                      : 'border-zinc-200 bg-zinc-50/40'
                  }`}
                >
                  {/* Main Category Header Row */}
                  <div className="p-3.5 bg-white border-b border-zinc-200/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onPointerDown={(e) => startMainCategoryDrag(e, main.id)}
                        aria-label={isEn ? 'Drag main category' : 'اسحب لترتيب القائمة الرئيسية'}
                        title={isEn ? 'Drag to reorder' : 'اسحب للترتيب'}
                        className="p-1.5 -ms-1 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
                      >
                        <GripVertical className="w-4 h-4" />
                      </button>
                      <SafeImage
                        src={main.imageUrl}
                        alt={loc(main.name, main.name_en)}
                        className="w-11 h-11 rounded-xl object-cover shrink-0 border border-zinc-200 pointer-events-none"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-zinc-950 text-white text-[10px] font-bold">
                            {isEn ? 'MAIN' : 'رئيسي'}
                          </span>
                          <p className="text-sm font-extrabold text-zinc-950 truncate">
                            {loc(main.name, main.name_en)}
                          </p>
                        </div>
                        <p className="text-[11px] text-zinc-500 font-mono-num truncate mt-0.5">
                          #{mainIdx + 1} · {subs.length} {isEn ? 'subcategories' : 'فرعي'} ·{' '}
                          {totalDishesInMain} {isEn ? 'dishes' : 'أصناف'}
                          {main.name_en ? ` · ${main.name} / ${main.name_en}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openNewSubCategory(main.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-[11px] font-bold hover:bg-amber-100 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Subcategory' : 'قسم فرعي'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openNewItem(main.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 text-[11px] font-bold hover:bg-zinc-50 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Dish' : 'صنف'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={mainIdx === 0}
                        onClick={() => moveMainCategory(mainIdx, -1)}
                        aria-label="Move Main Up"
                        className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={mainIdx === hierarchy.mainCategories.length - 1}
                        onClick={() => moveMainCategory(mainIdx, 1)}
                        aria-label="Move Main Down"
                        className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditCategory(main)}
                        aria-label="Edit Main Category"
                        className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCategory(main.id, subs)}
                        aria-label="Delete Main Category"
                        className="p-1.5 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Nested Subcategories Inside Main Category */}
                  <div className="p-3.5">
                    {subs.length === 0 ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-dashed border-zinc-300 bg-white/70 text-[11px] text-zinc-500">
                        <span>
                          {isEn
                            ? 'No subcategories yet (e.g. Salads, Grills). You can add subcategories or add dishes directly under this Main Category.'
                            : 'لا توجد أقسام فرعية تحت هذه القائمة بعد (مثل: سلطات، مشويات، قهوة). يمكنك إضافة قسم فرعي أو إضافة أصناف مباشرة.'}
                        </span>
                        <button
                          type="button"
                          onClick={() => openNewSubCategory(main.id)}
                          className="font-bold text-amber-800 hover:underline cursor-pointer whitespace-nowrap"
                        >
                          {isEn ? '+ Add first subcategory' : '+ أضف أول قسم فرعي'}
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {subs.map((sub, subIdx) => {
                          const isSubDragging = draggingCatId === sub.id;
                          const subItemsCount = items.filter((i) => i.categoryId === sub.id).length;
                          return (
                            <div
                              key={sub.id}
                              data-sub-cat-id={sub.id}
                              data-parent-id={main.id}
                              className={`p-2.5 rounded-xl border bg-white flex items-center justify-between gap-2 transition-all ${
                                isSubDragging
                                  ? 'border-zinc-950 ring-2 ring-zinc-950 shadow-md scale-[1.01] z-10 relative'
                                  : 'border-zinc-200 hover:border-zinc-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <button
                                  type="button"
                                  onPointerDown={(e) => startSubCategoryDrag(e, sub.id, main.id)}
                                  aria-label={isEn ? 'Drag subcategory' : 'اسحب لترتيب القسم الفرعي'}
                                  className="p-1 -ms-0.5 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </button>
                                <SafeImage
                                  src={sub.imageUrl}
                                  alt={loc(sub.name, sub.name_en)}
                                  className="w-10 h-10 rounded-lg object-cover shrink-0 pointer-events-none"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-zinc-900 truncate">
                                    {loc(sub.name, sub.name_en)}
                                  </p>
                                  <p className="text-[11px] text-zinc-500 font-mono-num truncate">
                                    #{subIdx + 1} · {subItemsCount} {isEn ? 'items' : 'صنف'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openNewItem(sub.id)}
                                  title={isEn ? 'Add dish to this subcategory' : 'إضافة صنف هنا'}
                                  className="p-1.5 rounded-lg text-amber-800 hover:bg-amber-50 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={subIdx === 0}
                                  onClick={() => moveSubCategory(main.id, subIdx, -1)}
                                  aria-label="Move Sub Up"
                                  className="p-1 rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={subIdx === subs.length - 1}
                                  onClick={() => moveSubCategory(main.id, subIdx, 1)}
                                  aria-label="Move Sub Down"
                                  className="p-1 rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditCategory(sub)}
                                  aria-label="Edit Subcategory"
                                  className="p-1 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeCategory(sub.id)}
                                  aria-label="Delete Subcategory"
                                  className="p-1 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Menu Items Grid with 2-Level Hierarchical Filter & Drag Reordering */}
      <div className="space-y-4">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  setActiveMainFilter('all');
                  setActiveSubFilter('all');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                  activeMainFilter === 'all'
                    ? 'bg-zinc-950 text-white'
                    : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {t.admin.menu.allCategories} ({items.length})
              </button>
              {hierarchy.mainCategories.map((main) => (
                <button
                  key={main.id}
                  type="button"
                  onClick={() => {
                    setActiveMainFilter(main.id);
                    setActiveSubFilter('all');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                    activeMainFilter === main.id
                      ? 'bg-zinc-950 text-white'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {loc(main.name, main.name_en)}
                </button>
              ))}
            </div>

            {visibleItems.length > 1 && (
              <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                <GripVertical className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>
                  {isEn
                    ? 'Drag dishes via handle to reorder'
                    : 'اسحب الأطباق من أيقونة المقبض لتغيير ترتيبها'}
                </span>
              </p>
            )}
          </div>

          {/* Row 2: Subcategory Filter Bar when a Main Category has Subcategories */}
          {activeMainFilter !== 'all' && activeFilterSubs.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar ps-1">
              <button
                type="button"
                onClick={() => setActiveSubFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                  activeSubFilter === 'all'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100'
                }`}
              >
                {isEn ? 'All Subcategories' : 'كل الأقسام الفرعية'}
              </button>
              {activeFilterSubs.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setActiveSubFilter(sub.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                    activeSubFilter === sub.id
                      ? 'bg-amber-600 text-white'
                      : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {loc(sub.name, sub.name_en)}
                </button>
              ))}
            </div>
          )}
        </div>

        {visibleItems.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center text-sm text-zinc-500">
            {t.admin.menu.emptyItemsTitle}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleItems.map((item, idx) => {
              const catObj = hierarchy.categoryById.get(item.categoryId);
              const parentObj = catObj?.parentId
                ? hierarchy.categoryById.get(catObj.parentId)
                : undefined;
              const catName = catObj
                ? parentObj
                  ? `${loc(parentObj.name, parentObj.name_en)} › ${loc(catObj.name, catObj.name_en)}`
                  : loc(catObj.name, catObj.name_en)
                : isEn
                  ? 'Category'
                  : 'قسم';
              const isDragging = draggingItemId === item.id;
              return (
                <article
                  key={item.id}
                  data-item-card-id={item.id}
                  className={`bg-white border rounded-2xl overflow-hidden flex flex-col transition-all ${
                    isDragging
                      ? 'border-zinc-950 ring-2 ring-zinc-950 shadow-xl scale-[1.02] z-10 relative bg-amber-50/30'
                      : 'border-zinc-200'
                  }`}
                >
                  <div className="aspect-[4/3] bg-zinc-100 relative">
                    <SafeImage
                      src={item.imageUrl}
                      alt={loc(item.name, item.name_en)}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    <button
                      type="button"
                      onPointerDown={(e) => startItemDrag(e, item.id)}
                      aria-label={isEn ? 'Drag to reorder dish' : 'اسحب لإعادة ترتيب الطبق'}
                      title={isEn ? 'Drag to reorder' : 'اسحب للترتيب'}
                      className="absolute top-2.5 start-2.5 px-2 py-1.5 rounded-xl bg-white/95 backdrop-blur-sm border border-zinc-200/80 shadow-sm text-zinc-700 hover:text-zinc-950 hover:bg-white cursor-grab active:cursor-grabbing touch-none select-none flex items-center gap-1"
                    >
                      <GripVertical className="w-4 h-4" />
                      <span className="text-[11px] font-mono-num font-extrabold">#{idx + 1}</span>
                    </button>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 gap-2">
                        <span className="truncate font-semibold text-zinc-600">{catName}</span>
                        <span className="font-mono-num shrink-0">
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

      {/* Category Modal (Main Category or Subcategory + Bilingual AR/EN) */}
      {catModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setCatModalOpen(false)}
        >
          <form
            dir={dir}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveCategory}
            className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                {editingCat
                  ? t.admin.menu.editCategoryTitle
                  : catIsSub
                    ? isEn
                      ? 'Add Subcategory'
                      : 'إضافة قسم فرعي'
                    : isEn
                      ? 'Add Main Category'
                      : 'إضافة قائمة رئيسية'}
              </h3>
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category Level Toggle (Main vs Subcategory) */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-100">
                <button
                  type="button"
                  onClick={() => {
                    setCatIsSub(false);
                    setCatParentId('');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    !catIsSub ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-600'
                  }`}
                >
                  {isEn ? 'Main Category' : 'قائمة رئيسية'}
                </button>
                <button
                  type="button"
                  disabled={editingCatHasChildren || hierarchy.mainCategories.length === 0}
                  onClick={() => {
                    setCatIsSub(true);
                    if (!catParentId) {
                      const fallbackParent = hierarchy.mainCategories.find(
                        (m) => m.id !== editingCat?.id
                      )?.id;
                      if (fallbackParent) setCatParentId(fallbackParent);
                    }
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-40 ${
                    catIsSub ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-600'
                  }`}
                >
                  {isEn ? 'Subcategory' : 'قسم فرعي'}
                </button>
              </div>

              {editingCatHasChildren && (
                <p className="text-[11px] text-amber-700">
                  {isEn
                    ? 'This main category has subcategories underneath and stays a main category.'
                    : 'هذه القائمة الرئيسية تحتوي على أقسام فرعية ولا يمكن تحويلها لقسم فرعي.'}
                </p>
              )}

              {catIsSub && (
                <div>
                  <label className="block text-xs font-bold mb-1">
                    {isEn ? 'Parent Main Category *' : 'يتبع القائمة الرئيسية *'}
                  </label>
                  <select
                    required={catIsSub}
                    value={catParentId}
                    onChange={(e) => setCatParentId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white"
                  >
                    <option value="">
                      {isEn ? '— Select Main Category —' : '— اختر القائمة الرئيسية —'}
                    </option>
                    {hierarchy.mainCategories
                      .filter((m) => m.id !== editingCat?.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {m.name_en ? ` / ${m.name_en}` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              )}
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
              <label className="block text-xs font-bold mb-1">
                {isEn ? 'Category (Main or Subcategory) *' : 'القائمة الرئيسية أو القسم الفرعي *'}
              </label>
              <select
                required
                value={itemCatId}
                onChange={(e) => setItemCatId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white"
              >
                {hierarchy.mainCategories.map((main) => {
                  const subs = hierarchy.subCategoriesByParent.get(main.id) || [];
                  const mainLabel = `${main.name}${main.name_en ? ` / ${main.name_en}` : ''}`;
                  return (
                    <optgroup key={main.id} label={mainLabel}>
                      <option value={main.id}>
                        {mainLabel}{' '}
                        {subs.length > 0
                          ? isEn
                            ? '(Direct under main)'
                            : '(مباشرة تحت الرئيسي)'
                          : ''}
                      </option>
                      {subs.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          ↳ {sub.name}
                          {sub.name_en ? ` / ${sub.name_en}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
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
