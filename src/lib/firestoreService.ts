import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { DEFAULT_PLATFORM_LANDING } from '../data/defaultLandingSettings';
import { getStarterSeedData } from '../data/demoRestaurants';
import {
  ActiveTheme,
  Category,
  CustomTheme,
  ItemAddon,
  ItemSize,
  MenuItem,
  Order,
  OrderItemPayload,
  OrderStatus,
  OrderType,
  PlatformLandingSettings,
  Restaurant,
  UserProfile,
} from '../types/menu';
import { db, handleFirestoreError, OperationType } from './firebase';

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

export function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64);
}

export async function ensureUserProfile(
  uid: string,
  email: string,
  displayName: string
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        email: (email || 'owner@sufra.app').slice(0, 254),
        displayName: (displayName || 'صاحب مطعم').slice(0, 120),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function isSlugAvailable(slug: string, currentRestaurantId?: string): Promise<boolean> {
  const clean = sanitizeSlug(slug);
  if (clean.length < 2) return false;
  if (clean === 'buns-lab' || clean === 'saffron-lounge' || clean === 'velvet-roast') {
    return false;
  }
  const path = `slugs/${clean}`;
  try {
    const snap = await getDoc(doc(db, 'slugs', clean));
    if (!snap.exists()) return true;
    return Boolean(currentRestaurantId && snap.data()?.restaurantId === currentRestaurantId);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchOwnerRestaurant(ownerId: string): Promise<Restaurant | null> {
  const path = 'restaurants';
  try {
    const q = query(collection(db, 'restaurants'), where('ownerId', '==', ownerId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { ...(d.data() as Restaurant), id: d.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export interface CreateRestaurantInput {
  ownerId: string;
  name: string;
  slug: string;
  tagline?: string;
  whatsappNumber: string;
  logoUrl?: string;
  activeTheme: ActiveTheme;
  primaryColor: string;
  taxRate: number;
  serviceCharge: number;
  currency: string;
  isOpen?: boolean;
  seedStarterMenu?: boolean;
}

export async function createRestaurant(input: CreateRestaurantInput): Promise<Restaurant> {
  const cleanSlug = sanitizeSlug(input.slug);
  const restId = makeId('rest');
  const path = `restaurants/${restId}`;

  try {
    const batch = writeBatch(db);
    const restPayload: Record<string, unknown> = {
      id: restId,
      ownerId: input.ownerId,
      slug: cleanSlug,
      name: input.name.trim().slice(0, 120),
      whatsappNumber: input.whatsappNumber.trim().slice(0, 24),
      activeTheme: input.activeTheme || 'theme-1',
      primaryColor: input.primaryColor || '#A61C1C',
      taxRate: Number(input.taxRate ?? 14),
      serviceCharge: Number(input.serviceCharge ?? 12),
      currency: input.currency.trim().slice(0, 16) || 'ج.م',
      isOpen: input.isOpen ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (input.tagline?.trim()) {
      restPayload.tagline = input.tagline.trim().slice(0, 500);
    }
    if (input.logoUrl?.trim()) {
      restPayload.logoUrl = input.logoUrl.trim().slice(0, 300000);
    }

    batch.set(doc(db, 'restaurants', restId), restPayload);
    batch.set(doc(db, 'slugs', cleanSlug), {
      slug: cleanSlug,
      restaurantId: restId,
      ownerId: input.ownerId,
      createdAt: serverTimestamp(),
    });

    if (input.seedStarterMenu) {
      const seed = getStarterSeedData();
      seed.categories.forEach((cat, catIdx) => {
        const catId = makeId('cat');
        batch.set(doc(db, 'categories', catId), {
          id: catId,
          restaurantId: restId,
          ownerId: input.ownerId,
          name: cat.name,
          imageUrl: cat.imageUrl,
          sortOrder: cat.sortOrder,
          createdAt: serverTimestamp(),
        });

        const catItems = seed.itemsByCategoryIndex[catIdx] || [];
        catItems.forEach((item) => {
          const itemId = makeId('item');
          batch.set(doc(db, 'menu_items', itemId), {
            id: itemId,
            restaurantId: restId,
            ownerId: input.ownerId,
            categoryId: catId,
            name: item.name,
            description: item.description,
            basePrice: item.basePrice,
            imageUrl: item.imageUrl,
            calories: item.calories,
            isSpicy: item.isSpicy,
            isAvailable: true,
            ordersCount: item.ordersCount,
            sizes: item.sizes,
            addons: item.addons,
            sortOrder: item.sortOrder,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      });
    }

    await batch.commit();
    const createdSnap = await getDoc(doc(db, 'restaurants', restId));
    return { ...(createdSnap.data() as Restaurant), id: restId };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateRestaurantActiveTheme(
  restaurantId: string,
  activeTheme: ActiveTheme
): Promise<void> {
  const path = `restaurants/${restaurantId}`;
  try {
    await updateDoc(doc(db, 'restaurants', restaurantId), {
      activeTheme,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateRestaurantThemeAndTaxes(
  restaurantId: string,
  updates: {
    activeTheme: ActiveTheme;
    primaryColor: string;
    taxRate: number;
    serviceCharge: number;
  }
): Promise<void> {
  const path = `restaurants/${restaurantId}`;
  try {
    await updateDoc(doc(db, 'restaurants', restaurantId), {
      activeTheme: updates.activeTheme,
      primaryColor: updates.primaryColor,
      taxRate: Number(updates.taxRate) || 0,
      serviceCharge: Number(updates.serviceCharge) || 0,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateRestaurantSettings(
  restaurant: Restaurant,
  updates: {
    name: string;
    slug: string;
    tagline: string;
    whatsappNumber: string;
    logoUrl: string;
    currency: string;
    isOpen: boolean;
    taxRate: number;
    serviceCharge: number;
    primaryColor: string;
  }
): Promise<Restaurant> {
  const cleanSlug = sanitizeSlug(updates.slug);
  const path = `restaurants/${restaurant.id}`;
  try {
    const batch = writeBatch(db);
    if (cleanSlug !== restaurant.slug) {
      batch.set(doc(db, 'slugs', cleanSlug), {
        slug: cleanSlug,
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        createdAt: serverTimestamp(),
      });
      batch.delete(doc(db, 'slugs', restaurant.slug));
    }

    batch.update(doc(db, 'restaurants', restaurant.id), {
      name: updates.name.trim().slice(0, 120),
      slug: cleanSlug,
      tagline: updates.tagline.trim().slice(0, 500),
      whatsappNumber: updates.whatsappNumber.trim().slice(0, 24),
      logoUrl: updates.logoUrl.trim().slice(0, 300000),
      currency: updates.currency.trim().slice(0, 16) || 'ج.م',
      isOpen: Boolean(updates.isOpen),
      taxRate: Number(updates.taxRate) || 0,
      serviceCharge: Number(updates.serviceCharge) || 0,
      primaryColor: updates.primaryColor,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return {
      ...restaurant,
      ...updates,
      slug: cleanSlug,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchRestaurantBySlug(slug: string): Promise<{
  restaurant: Restaurant;
  categories: Category[];
  items: MenuItem[];
} | null> {
  const clean = sanitizeSlug(slug);
  if (!clean) return null;
  const slugPath = `slugs/${clean}`;
  try {
    const slugSnap = await getDoc(doc(db, 'slugs', clean));
    if (!slugSnap.exists()) return null;
    const { restaurantId } = slugSnap.data() as { restaurantId: string };

    const restSnap = await getDoc(doc(db, 'restaurants', restaurantId));
    if (!restSnap.exists()) return null;
    const restaurant = { ...(restSnap.data() as Restaurant), id: restSnap.id };

    const [catSnap, itemSnap] = await Promise.all([
      getDocs(query(collection(db, 'categories'), where('restaurantId', '==', restaurantId))),
      getDocs(query(collection(db, 'menu_items'), where('restaurantId', '==', restaurantId))),
    ]);

    const categories = catSnap.docs
      .map((d) => ({ ...(d.data() as Category), id: d.id }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const items = itemSnap.docs
      .map((d) => ({ ...(d.data() as MenuItem), id: d.id }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    return { restaurant, categories, items };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, slugPath);
  }
}

export function subscribeCategories(
  restaurantId: string,
  onData: (cats: Category[]) => void
): () => void {
  const path = 'categories';
  const q = query(collection(db, 'categories'), where('restaurantId', '==', restaurantId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as Category), id: d.id }))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeMenuItems(
  restaurantId: string,
  onData: (items: MenuItem[]) => void
): () => void {
  const path = 'menu_items';
  const q = query(collection(db, 'menu_items'), where('restaurantId', '==', restaurantId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as MenuItem), id: d.id }))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function saveCategory(
  restaurantId: string,
  ownerId: string,
  data: { id?: string; name: string; imageUrl?: string; sortOrder: number }
): Promise<void> {
  const isNew = !data.id;
  const catId = data.id || makeId('cat');
  const path = `categories/${catId}`;
  try {
    if (isNew) {
      const payload: Record<string, unknown> = {
        id: catId,
        restaurantId,
        ownerId,
        name: data.name.trim().slice(0, 80),
        sortOrder: Number(data.sortOrder) || 0,
        createdAt: serverTimestamp(),
      };
      if (data.imageUrl?.trim()) {
        payload.imageUrl = data.imageUrl.trim().slice(0, 300000);
      }
      await setDoc(doc(db, 'categories', catId), payload);
    } else {
      await updateDoc(doc(db, 'categories', catId), {
        name: data.name.trim().slice(0, 80),
        imageUrl: (data.imageUrl || '').trim().slice(0, 300000),
        sortOrder: Number(data.sortOrder) || 0,
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function reorderCategories(
  orderedCategories: Category[]
): Promise<void> {
  const path = 'categories';
  try {
    const batch = writeBatch(db);
    orderedCategories.forEach((cat, idx) => {
      batch.update(doc(db, 'categories', cat.id), { sortOrder: idx + 1 });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeCategory(categoryId: string): Promise<void> {
  const path = `categories/${categoryId}`;
  try {
    await deleteDoc(doc(db, 'categories', categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveMenuItem(
  restaurantId: string,
  ownerId: string,
  data: {
    id?: string;
    categoryId: string;
    name: string;
    description?: string;
    basePrice: number;
    calories?: number;
    imageUrl?: string;
    isSpicy: boolean;
    isAvailable: boolean;
    ordersCount?: number;
    sizes: ItemSize[];
    addons: ItemAddon[];
    sortOrder: number;
  }
): Promise<void> {
  const isNew = !data.id;
  const itemId = data.id || makeId('item');
  const path = `menu_items/${itemId}`;

  const cleanSizes = data.sizes.slice(0, 10).map((s) => ({
    name: s.name.trim().slice(0, 40),
    price: Math.max(0, Number(s.price) || 0),
  }));
  const cleanAddons = data.addons.slice(0, 20).map((a) => ({
    name: a.name.trim().slice(0, 60),
    price: Math.max(0, Number(a.price) || 0),
  }));

  try {
    if (isNew) {
      const payload: Record<string, unknown> = {
        id: itemId,
        restaurantId,
        ownerId,
        categoryId: data.categoryId,
        name: data.name.trim().slice(0, 120),
        basePrice: Math.max(0, Number(data.basePrice) || 0),
        isSpicy: Boolean(data.isSpicy),
        isAvailable: Boolean(data.isAvailable),
        ordersCount: Math.max(0, Math.round(Number(data.ordersCount ?? 25))),
        sizes: cleanSizes,
        addons: cleanAddons,
        sortOrder: Number(data.sortOrder) || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (data.description?.trim()) {
        payload.description = data.description.trim().slice(0, 500);
      }
      if (typeof data.calories === 'number' && !Number.isNaN(data.calories) && data.calories >= 0) {
        payload.calories = Math.min(10000, Math.round(data.calories));
      }
      if (data.imageUrl?.trim()) {
        payload.imageUrl = data.imageUrl.trim().slice(0, 300000);
      }
      await setDoc(doc(db, 'menu_items', itemId), payload);
    } else {
      await updateDoc(doc(db, 'menu_items', itemId), {
        categoryId: data.categoryId,
        name: data.name.trim().slice(0, 120),
        description: (data.description || '').trim().slice(0, 500),
        basePrice: Math.max(0, Number(data.basePrice) || 0),
        calories:
          typeof data.calories === 'number' && !Number.isNaN(data.calories) && data.calories >= 0
            ? Math.min(10000, Math.round(data.calories))
            : 0,
        imageUrl: (data.imageUrl || '').trim().slice(0, 300000),
        isSpicy: Boolean(data.isSpicy),
        isAvailable: Boolean(data.isAvailable),
        ordersCount: Math.max(0, Math.round(Number(data.ordersCount ?? 25))),
        sizes: cleanSizes,
        addons: cleanAddons,
        sortOrder: Number(data.sortOrder) || 0,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function toggleMenuItemAvailability(
  itemId: string,
  isAvailable: boolean
): Promise<void> {
  const path = `menu_items/${itemId}`;
  try {
    await updateDoc(doc(db, 'menu_items', itemId), {
      isAvailable,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeMenuItem(itemId: string): Promise<void> {
  const path = `menu_items/${itemId}`;
  try {
    await deleteDoc(doc(db, 'menu_items', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface SubmitOrderInput {
  restaurantId: string;
  ownerId: string;
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  tableNumber?: string;
  deliveryAddress?: string;
  notes?: string;
  items: OrderItemPayload[];
  subtotal: number;
  serviceCharge: number;
  taxAmount: number;
  total: number;
}

export async function submitPublicOrder(input: SubmitOrderInput): Promise<{ id: string; orderNumber: string }> {
  const orderId = makeId('ord');
  const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
  const path = `orders/${orderId}`;

  const payload: Record<string, unknown> = {
    id: orderId,
    restaurantId: input.restaurantId,
    ownerId: input.ownerId,
    orderNumber,
    customerName: input.customerName.trim().slice(0, 100),
    customerPhone: input.customerPhone.trim().slice(0, 24),
    orderType: input.orderType,
    items: input.items.slice(0, 50),
    subtotal: Number(input.subtotal.toFixed(2)),
    serviceCharge: Number(input.serviceCharge.toFixed(2)),
    taxAmount: Number(input.taxAmount.toFixed(2)),
    total: Number(input.total.toFixed(2)),
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (input.tableNumber?.trim()) {
    payload.tableNumber = input.tableNumber.trim().slice(0, 20);
  }
  if (input.deliveryAddress?.trim()) {
    payload.deliveryAddress = input.deliveryAddress.trim().slice(0, 300);
  }
  if (input.notes?.trim()) {
    payload.notes = input.notes.trim().slice(0, 400);
  }

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'orders', orderId), payload);

    const qtyByItem = new Map<string, number>();
    input.items.forEach((item) => {
      if (item.menuItemId) {
        const prev = qtyByItem.get(item.menuItemId) || 0;
        qtyByItem.set(item.menuItemId, Math.min(50, prev + Math.max(1, Math.round(item.quantity))));
      }
    });

    qtyByItem.forEach((qty, menuItemId) => {
      batch.update(doc(db, 'menu_items', menuItemId), {
        ordersCount: increment(qty),
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    return { id: orderId, orderNumber };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

function getMillis(ts: unknown): number {
  if (!ts) return 0;
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === 'object' && 'seconds' in ts && typeof (ts as { seconds: number }).seconds === 'number') {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return 0;
}

export function subscribeOwnerOrders(
  restaurantId: string,
  ownerId: string,
  onData: (orders: Order[]) => void
): () => void {
  const path = 'orders';
  const q = query(
    collection(db, 'orders'),
    where('restaurantId', '==', restaurantId),
    where('ownerId', '==', ownerId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as Order), id: d.id }))
        .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function seedStarterMenuForRestaurant(
  restaurantId: string,
  ownerId: string
): Promise<void> {
  const path = 'categories';
  try {
    const batch = writeBatch(db);
    const seed = getStarterSeedData();
    seed.categories.forEach((cat, catIdx) => {
      const catId = makeId('cat');
      batch.set(doc(db, 'categories', catId), {
        id: catId,
        restaurantId,
        ownerId,
        name: cat.name,
        imageUrl: cat.imageUrl,
        sortOrder: cat.sortOrder,
        createdAt: serverTimestamp(),
      });
      const catItems = seed.itemsByCategoryIndex[catIdx] || [];
      catItems.forEach((item) => {
        const itemId = makeId('item');
        batch.set(doc(db, 'menu_items', itemId), {
          id: itemId,
          restaurantId,
          ownerId,
          categoryId: catId,
          name: item.name,
          description: item.description,
          basePrice: item.basePrice,
          imageUrl: item.imageUrl,
          calories: item.calories,
          isSpicy: item.isSpicy,
          isAvailable: true,
          ordersCount: item.ordersCount,
          sizes: item.sizes,
          addons: item.addons,
          sortOrder: item.sortOrder,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchAllTenantsForSuperAdmin(): Promise<{
  restaurants: Restaurant[];
  usersByUid: Record<string, UserProfile>;
}> {
  const path = 'restaurants';
  try {
    const [restSnap, userSnap] = await Promise.all([
      getDocs(collection(db, 'restaurants')),
      getDocs(collection(db, 'users')),
    ]);

    const usersByUid: Record<string, UserProfile> = {};
    userSnap.docs.forEach((d) => {
      const profile = d.data() as UserProfile;
      usersByUid[d.id] = { ...profile, uid: d.id };
    });

    const restaurants = restSnap.docs
      .map((d) => ({ ...(d.data() as Restaurant), id: d.id }))
      .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));

    return { restaurants, usersByUid };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function toggleRestaurantSuspension(
  restaurantId: string,
  isSuspended: boolean
): Promise<void> {
  const path = `restaurants/${restaurantId}`;
  try {
    await updateDoc(doc(db, 'restaurants', restaurantId), {
      isSuspended: Boolean(isSuspended),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteRestaurantAccountCompletely(
  restaurant: Restaurant
): Promise<void> {
  const path = `restaurants/${restaurant.id}`;
  try {
    const [catSnap, itemSnap, orderSnap] = await Promise.all([
      getDocs(query(collection(db, 'categories'), where('restaurantId', '==', restaurant.id))),
      getDocs(query(collection(db, 'menu_items'), where('restaurantId', '==', restaurant.id))),
      getDocs(query(collection(db, 'orders'), where('restaurantId', '==', restaurant.id))),
    ]);

    const refsToDelete = [
      ...catSnap.docs.map((d) => d.ref),
      ...itemSnap.docs.map((d) => d.ref),
      ...orderSnap.docs.map((d) => d.ref),
      doc(db, 'restaurants', restaurant.id),
    ];

    if (restaurant.slug) {
      refsToDelete.push(doc(db, 'slugs', restaurant.slug));
    }

    const CHUNK_SIZE = 450;
    for (let i = 0; i < refsToDelete.length; i += CHUNK_SIZE) {
      const chunk = refsToDelete.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchPlatformLandingSettings(): Promise<PlatformLandingSettings> {
  const path = 'platform_settings/landing';
  try {
    const snap = await getDoc(doc(db, 'platform_settings', 'landing'));
    if (!snap.exists()) {
      return DEFAULT_PLATFORM_LANDING;
    }
    const data = snap.data() as Partial<PlatformLandingSettings>;
    return {
      heroTitle: data.heroTitle || DEFAULT_PLATFORM_LANDING.heroTitle,
      heroSubtitle: data.heroSubtitle || DEFAULT_PLATFORM_LANDING.heroSubtitle,
      ctaButtonText: data.ctaButtonText || DEFAULT_PLATFORM_LANDING.ctaButtonText,
      features:
        Array.isArray(data.features) && data.features.length > 0
          ? data.features
          : DEFAULT_PLATFORM_LANDING.features,
      pricingPlans:
        Array.isArray(data.pricingPlans) && data.pricingPlans.length > 0
          ? data.pricingPlans
          : DEFAULT_PLATFORM_LANDING.pricingPlans,
      supportWhatsapp: data.supportWhatsapp ?? DEFAULT_PLATFORM_LANDING.supportWhatsapp,
      footerText: data.footerText || DEFAULT_PLATFORM_LANDING.footerText,
      updatedAt: data.updatedAt,
    };
  } catch {
    return DEFAULT_PLATFORM_LANDING;
  }
}

export async function savePlatformLandingSettings(
  settings: PlatformLandingSettings
): Promise<void> {
  const path = 'platform_settings/landing';
  try {
    const cleanFeatures = settings.features
      .slice(0, 12)
      .map((f) => ({
        title: (f.title || '').trim().slice(0, 120),
        description: (f.description || '').trim().slice(0, 300),
      }))
      .filter((f) => f.title.length > 0);

    const cleanPlans = settings.pricingPlans
      .slice(0, 6)
      .map((p, idx) => ({
        id: (p.id || `plan_${idx + 1}`).trim().slice(0, 40),
        name: (p.name || '').trim().slice(0, 80),
        price: (p.price || '0').trim().slice(0, 32),
        period: (p.period || '').trim().slice(0, 48),
        description: (p.description || '').trim().slice(0, 240),
        features: (p.features || [])
          .map((item) => item.trim().slice(0, 120))
          .filter(Boolean)
          .slice(0, 10),
        highlighted: Boolean(p.highlighted),
      }))
      .filter((p) => p.name.length > 0);

    await setDoc(doc(db, 'platform_settings', 'landing'), {
      heroTitle:
        settings.heroTitle.trim().slice(0, 200) || DEFAULT_PLATFORM_LANDING.heroTitle,
      heroSubtitle:
        settings.heroSubtitle.trim().slice(0, 600) || DEFAULT_PLATFORM_LANDING.heroSubtitle,
      ctaButtonText:
        settings.ctaButtonText.trim().slice(0, 80) || DEFAULT_PLATFORM_LANDING.ctaButtonText,
      features: cleanFeatures,
      pricingPlans: cleanPlans,
      supportWhatsapp: settings.supportWhatsapp.trim().slice(0, 32),
      footerText:
        settings.footerText.trim().slice(0, 200) || DEFAULT_PLATFORM_LANDING.footerText,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Custom Injected Themes (Super Admin & Public/Owner access)
export async function fetchAllCustomThemes(): Promise<CustomTheme[]> {
  const path = 'custom_themes';
  try {
    const snap = await getDocs(collection(db, 'custom_themes'));
    return snap.docs
      .map((d) => ({ ...(d.data() as CustomTheme), id: d.id }))
      .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchActiveCustomThemes(): Promise<CustomTheme[]> {
  const path = 'custom_themes';
  try {
    const q = query(collection(db, 'custom_themes'), where('isActive', '==', true));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ ...(d.data() as CustomTheme), id: d.id }))
      .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
  } catch {
    return [];
  }
}

export async function fetchCustomThemeById(themeId: string): Promise<CustomTheme | null> {
  if (!themeId || !themeId.startsWith('custom_')) return null;
  const path = `custom_themes/${themeId}`;
  try {
    const snap = await getDoc(doc(db, 'custom_themes', themeId));
    if (!snap.exists()) return null;
    return { ...(snap.data() as CustomTheme), id: snap.id };
  } catch {
    return null;
  }
}

export async function saveCustomTheme(data: {
  id?: string;
  name: string;
  description?: string;
  previewImage?: string;
  htmlCode: string;
  cssCode: string;
  jsCode: string;
  isActive: boolean;
}): Promise<CustomTheme> {
  const isNew = !data.id;
  const themeId = data.id && data.id.startsWith('custom_') ? data.id : makeId('custom');
  const path = `custom_themes/${themeId}`;

  const cleanName = data.name.trim().slice(0, 100);
  const cleanDesc = (data.description || '').trim().slice(0, 400);
  const cleanPreview = (data.previewImage || '').trim().slice(0, 300000);
  const cleanHtml = (data.htmlCode || '').slice(0, 150000);
  const cleanCss = (data.cssCode || '').slice(0, 100000);
  const cleanJs = (data.jsCode || '').slice(0, 100000);

  try {
    if (isNew) {
      const payload: Record<string, unknown> = {
        id: themeId,
        name: cleanName,
        htmlCode: cleanHtml,
        cssCode: cleanCss,
        jsCode: cleanJs,
        isActive: Boolean(data.isActive),
        createdAt: serverTimestamp(),
      };
      if (cleanDesc) payload.description = cleanDesc;
      if (cleanPreview) payload.previewImage = cleanPreview;
      await setDoc(doc(db, 'custom_themes', themeId), payload);
    } else {
      await updateDoc(doc(db, 'custom_themes', themeId), {
        name: cleanName,
        description: cleanDesc,
        previewImage: cleanPreview,
        htmlCode: cleanHtml,
        cssCode: cleanCss,
        jsCode: cleanJs,
        isActive: Boolean(data.isActive),
      });
    }
    const snap = await getDoc(doc(db, 'custom_themes', themeId));
    return { ...(snap.data() as CustomTheme), id: themeId };
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function toggleCustomThemeActive(
  themeId: string,
  isActive: boolean
): Promise<void> {
  const path = `custom_themes/${themeId}`;
  try {
    await updateDoc(doc(db, 'custom_themes', themeId), {
      isActive: Boolean(isActive),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCustomTheme(themeId: string): Promise<void> {
  const path = `custom_themes/${themeId}`;
  try {
    await deleteDoc(doc(db, 'custom_themes', themeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
