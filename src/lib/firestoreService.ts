import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getActiveLang } from '../data/translations';
import { DEFAULT_LANDING_SECTIONS, DEFAULT_PLATFORM_LANDING } from '../data/defaultLandingSettings';
import { getStarterSeedData } from '../data/demoRestaurants';
import {
  ActiveTheme,
  Category,
  CustomerProfile,
  CustomTheme,
  GuestCheckSummary,
  Hall,
  ItemAddon,
  ItemBadge,
  ItemPrepState,
  ItemProgressActorEntry,
  ItemSize,
  LandingSectionConfig,
  LandingSectionId,
  LoyaltyConfig,
  MenuColorMode,
  MenuItem,
  MenuOffer,
  Order,
  OrderItemPayload,
  OrderStatus,
  OrderType,
  PlatformLandingSettings,
  PlatformPromoCode,
  PlatformPromoDiscountType,
  PrepStation,
  PromoCode,
  Restaurant,
  ServiceCall,
  ServiceCallStatus,
  ServiceCallType,
  StaffActorInfo,
  StaffAuditEventType,
  TableSession,
  TableSessionItem,
  UserProfile,
} from '../types/menu';
import {
  buildLastOrderSnapshot,
  DEFAULT_LOYALTY_CONFIG,
  mergeFavoriteItems,
  normalizeCustomerPhone,
  parseIsoBirthday,
} from './customerLoyaltyUtils';
import { db, handleFirestoreError, OperationType } from './firebase';
import { incrementActiveShiftMetric } from './shiftsService';
import { ItemProgressStationEntry } from '../types/menu';
import { cleanStationId, cleanStationIdList } from './stationUtils';

export function cleanStation(val?: string): PrepStation {
  const c = cleanStationId(val);
  return c || 'kitchen';
}

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

export function normalizeIsoBirthday(raw?: string): string {
  const clean = (raw || '').trim();
  if (!clean) return '';
  return parseIsoBirthday(clean) ? clean : '';
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
        displayName: (displayName || (getActiveLang() === 'en' ? 'Restaurant Owner' : 'صاحب مطعم')).slice(0, 120),
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
  name_en?: string;
  slug: string;
  tagline?: string;
  tagline_en?: string;
  whatsappNumber: string;
  ownerBirthday?: string;
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
  const validColor = /^#[0-9a-fA-F]{6}$/.test((input.primaryColor || '').trim())
    ? input.primaryColor.trim()
    : '#A61C1C';
  const safeTaxRate = Math.max(0, Math.min(100, Number(input.taxRate) || 0));
  const safeServiceCharge = Math.max(0, Math.min(100, Number(input.serviceCharge) || 0));
  const cleanOwnerBirthday = normalizeIsoBirthday(input.ownerBirthday);

  try {
    const batch = writeBatch(db);
    const restPayload: Record<string, unknown> = {
      id: restId,
      ownerId: input.ownerId,
      slug: cleanSlug,
      name: input.name.trim().slice(0, 120),
      whatsappNumber: input.whatsappNumber.trim().slice(0, 24),
      activeTheme: input.activeTheme || 'theme-1',
      primaryColor: validColor,
      taxRate: safeTaxRate,
      serviceCharge: safeServiceCharge,
      deliveryFee: 0,
      colorMode: 'auto',
      menuColumns: 2,
      currency: input.currency.trim().slice(0, 16) || (getActiveLang() === 'en' ? 'EGP' : 'ج.م'),
      isOpen: input.isOpen ?? true,
      offers: [],
      promoCodes: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (input.name_en?.trim()) {
      restPayload.name_en = input.name_en.trim().slice(0, 120);
    }
    if (input.tagline?.trim()) {
      restPayload.tagline = input.tagline.trim().slice(0, 500);
    }
    if (input.tagline_en?.trim()) {
      restPayload.tagline_en = input.tagline_en.trim().slice(0, 500);
    }
    if (input.logoUrl?.trim()) {
      restPayload.logoUrl = input.logoUrl.trim().slice(0, 300000);
    }
    if (cleanOwnerBirthday) {
      restPayload.ownerBirthday = cleanOwnerBirthday;
    }

    batch.set(doc(db, 'restaurants', restId), restPayload);
    batch.set(doc(db, 'slugs', cleanSlug), {
      slug: cleanSlug,
      restaurantId: restId,
      ownerId: input.ownerId,
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    if (input.seedStarterMenu) {
      await seedStarterMenuForRestaurant(restId, input.ownerId);
    }

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
    colorMode?: MenuColorMode;
    headingColor?: string;
    descriptionColor?: string;
    priceColor?: string;
    menuColumns?: 1 | 2 | 3;
  }
): Promise<void> {
  const path = `restaurants/${restaurantId}`;
  const cleanHex = (val?: string) =>
    val && /^#[0-9a-fA-F]{6}$/.test(val.trim()) ? val.trim() : '';
  const payload: Record<string, unknown> = {
    activeTheme: updates.activeTheme,
    primaryColor: updates.primaryColor,
    taxRate: Number(updates.taxRate) || 0,
    serviceCharge: Number(updates.serviceCharge) || 0,
    updatedAt: serverTimestamp(),
  };
  if (updates.colorMode !== undefined) {
    payload.colorMode = updates.colorMode;
  }
  if (updates.headingColor !== undefined) {
    payload.headingColor = cleanHex(updates.headingColor);
  }
  if (updates.descriptionColor !== undefined) {
    payload.descriptionColor = cleanHex(updates.descriptionColor);
  }
  if (updates.priceColor !== undefined) {
    payload.priceColor = cleanHex(updates.priceColor);
  }
  if (updates.menuColumns !== undefined) {
    payload.menuColumns = [1, 2, 3].includes(updates.menuColumns) ? updates.menuColumns : 2;
  }
  try {
    await updateDoc(doc(db, 'restaurants', restaurantId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

function sanitizeLoyaltyConfig(loyaltyConfig: LoyaltyConfig): LoyaltyConfig {
  return {
    enabled: Boolean(loyaltyConfig.enabled),
    firstOrderEnabled: loyaltyConfig.firstOrderEnabled ?? true,
    promoBannerText: (loyaltyConfig.promoBannerText ?? DEFAULT_LOYALTY_CONFIG.promoBannerText)
      .trim()
      .slice(0, 200),
    promoBannerText_en: (
      loyaltyConfig.promoBannerText_en ?? DEFAULT_LOYALTY_CONFIG.promoBannerText_en
    )
      .trim()
      .slice(0, 200),
    firstOrderDiscountPercent: Math.max(
      0,
      Math.min(50, Math.round(Number(loyaltyConfig.firstOrderDiscountPercent) || 0))
    ),
    punchCardEnabled: loyaltyConfig.punchCardEnabled ?? true,
    punchCardTarget: Math.max(
      2,
      Math.min(20, Math.round(Number(loyaltyConfig.punchCardTarget) || 5))
    ),
    punchCardDiscountPercent: Math.max(
      0,
      Math.min(50, Math.round(Number(loyaltyConfig.punchCardDiscountPercent) || 0))
    ),
    punchCardRewardText: (
      loyaltyConfig.punchCardRewardText ?? DEFAULT_LOYALTY_CONFIG.punchCardRewardText
    )
      .trim()
      .slice(0, 140),
    punchCardRewardText_en: (
      loyaltyConfig.punchCardRewardText_en ?? DEFAULT_LOYALTY_CONFIG.punchCardRewardText_en
    )
      .trim()
      .slice(0, 140),
    birthdayOfferText: (loyaltyConfig.birthdayOfferText ?? DEFAULT_LOYALTY_CONFIG.birthdayOfferText)
      .trim()
      .slice(0, 220),
    birthdayOfferText_en: (
      loyaltyConfig.birthdayOfferText_en ?? DEFAULT_LOYALTY_CONFIG.birthdayOfferText_en
    )
      .trim()
      .slice(0, 220),
    birthdayDiscountPercent: Math.max(
      0,
      Math.min(50, Math.round(Number(loyaltyConfig.birthdayDiscountPercent) || 0))
    ),
    birthdayWhatsappMessage: (
      loyaltyConfig.birthdayWhatsappMessage ?? DEFAULT_LOYALTY_CONFIG.birthdayWhatsappMessage
    )
      .trim()
      .slice(0, 400),
  };
}

export async function updateRestaurantLoyaltyConfig(
  restaurantId: string,
  loyaltyConfig: LoyaltyConfig
): Promise<LoyaltyConfig> {
  const path = `restaurants/${restaurantId}`;
  const cleanLoyalty = sanitizeLoyaltyConfig(loyaltyConfig);
  try {
    await updateDoc(doc(db, 'restaurants', restaurantId), {
      loyaltyConfig: cleanLoyalty,
      updatedAt: serverTimestamp(),
    });
    return cleanLoyalty;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateRestaurantOffersAndPromos(
  restaurantId: string,
  offers: MenuOffer[],
  promoCodes: PromoCode[],
  loyaltyConfig?: LoyaltyConfig
): Promise<{ offers: MenuOffer[]; promoCodes: PromoCode[]; loyaltyConfig?: LoyaltyConfig }> {
  const path = `restaurants/${restaurantId}`;
  const cleanOffers: MenuOffer[] = (offers || []).slice(0, 12).map((o, idx) => {
    const clean: MenuOffer = {
      id: (o.id || makeId('offer')).slice(0, 64),
      title: (o.title || '').trim().slice(0, 120),
      title_en: (o.title_en || '').trim().slice(0, 120),
      subtitle: (o.subtitle || '').trim().slice(0, 200),
      subtitle_en: (o.subtitle_en || '').trim().slice(0, 200),
      badgeText: (o.badgeText || '').trim().slice(0, 40),
      badgeText_en: (o.badgeText_en || '').trim().slice(0, 40),
      isBogo: Boolean(o.isBogo),
      promoCode: (o.promoCode || '').trim().toUpperCase().slice(0, 24),
      placement: (['top', 'above_grid', 'below_grid', 'floating'].includes(o.placement)
        ? o.placement
        : 'above_grid') as MenuOffer['placement'],
      animation: (['static', 'marquee', 'orbit', 'bounce', 'fade'].includes(o.animation)
        ? o.animation
        : 'static') as MenuOffer['animation'],
      bgColor: o.bgColor && /^#[0-9a-fA-F]{6}$/.test(o.bgColor.trim()) ? o.bgColor.trim() : '',
      textColor: o.textColor && /^#[0-9a-fA-F]{6}$/.test(o.textColor.trim()) ? o.textColor.trim() : '',
      isActive: Boolean(o.isActive),
      sortOrder: idx + 1,
    };
    return clean;
  });

  const cleanPromos: PromoCode[] = (promoCodes || [])
    .slice(0, 20)
    .map((p) => ({
      id: (p.id || makeId('promo')).slice(0, 64),
      code: (p.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24),
      type: (['percent', 'fixed', 'free_delivery', 'waive_service'].includes(p.type)
        ? p.type
        : 'percent') as PromoCode['type'],
      value: Math.max(0, Math.min(100000, Number(p.value) || 0)),
      minOrder: Math.max(0, Math.min(100000, Number(p.minOrder) || 0)),
      description: (p.description || '').trim().slice(0, 120),
      description_en: (p.description_en || '').trim().slice(0, 120),
      isActive: Boolean(p.isActive),
    }))
    .filter((p) => p.code.length >= 2);

  const cleanLoyalty = loyaltyConfig ? sanitizeLoyaltyConfig(loyaltyConfig) : undefined;

  try {
    const updatePayload: Record<string, unknown> = {
      offers: cleanOffers,
      promoCodes: cleanPromos,
      updatedAt: serverTimestamp(),
    };
    if (cleanLoyalty) {
      updatePayload.loyaltyConfig = cleanLoyalty;
    }
    await updateDoc(doc(db, 'restaurants', restaurantId), updatePayload);
    return { offers: cleanOffers, promoCodes: cleanPromos, loyaltyConfig: cleanLoyalty };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateRestaurantSettings(
  restaurant: Restaurant,
  updates: {
    name: string;
    name_en?: string;
    slug: string;
    tagline: string;
    tagline_en?: string;
    whatsappNumber: string;
    ownerBirthday?: string;
    logoUrl: string;
    shareTitle?: string;
    shareTitle_en?: string;
    shareDescription?: string;
    shareDescription_en?: string;
    currency: string;
    isOpen: boolean;
    taxRate: number;
    serviceCharge: number;
    deliveryFee?: number;
    primaryColor: string;
    colorMode?: MenuColorMode;
    headingColor?: string;
    descriptionColor?: string;
    priceColor?: string;
    menuColumns?: 1 | 2 | 3;
  }
): Promise<Restaurant> {
  const cleanSlug = sanitizeSlug(updates.slug);
  const path = `restaurants/${restaurant.id}`;
  const cleanHex = (val?: string) =>
    val && /^#[0-9a-fA-F]{6}$/.test(val.trim()) ? val.trim() : '';
  const safeDeliveryFee = Math.max(0, Math.min(100000, Number(updates.deliveryFee ?? restaurant.deliveryFee ?? 0) || 0));
  const safeColorMode: MenuColorMode = updates.colorMode || restaurant.colorMode || 'auto';
  const safeMenuColumns: 1 | 2 | 3 =
    updates.menuColumns && [1, 2, 3].includes(updates.menuColumns)
      ? updates.menuColumns
      : restaurant.menuColumns && [1, 2, 3].includes(restaurant.menuColumns)
        ? restaurant.menuColumns
        : 2;
  const safeHeadingColor =
    updates.headingColor !== undefined ? cleanHex(updates.headingColor) : cleanHex(restaurant.headingColor);
  const safeDescColor =
    updates.descriptionColor !== undefined
      ? cleanHex(updates.descriptionColor)
      : cleanHex(restaurant.descriptionColor);
  const safePriceColor =
    updates.priceColor !== undefined ? cleanHex(updates.priceColor) : cleanHex(restaurant.priceColor);
  const cleanOwnerBirthday =
    updates.ownerBirthday !== undefined
      ? normalizeIsoBirthday(updates.ownerBirthday)
      : normalizeIsoBirthday(restaurant.ownerBirthday);

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

    const cleanNameEn = (updates.name_en || '').trim().slice(0, 120);
    const cleanTaglineEn = (updates.tagline_en || '').trim().slice(0, 500);
    const cleanShareTitle = (updates.shareTitle ?? restaurant.shareTitle ?? '').trim().slice(0, 140);
    const cleanShareTitleEn = (updates.shareTitle_en ?? restaurant.shareTitle_en ?? '').trim().slice(0, 140);
    const cleanShareDesc = (updates.shareDescription ?? restaurant.shareDescription ?? '').trim().slice(0, 300);
    const cleanShareDescEn = (updates.shareDescription_en ?? restaurant.shareDescription_en ?? '').trim().slice(0, 300);

    batch.update(doc(db, 'restaurants', restaurant.id), {
      name: updates.name.trim().slice(0, 120),
      name_en: cleanNameEn,
      slug: cleanSlug,
      tagline: updates.tagline.trim().slice(0, 500),
      tagline_en: cleanTaglineEn,
      whatsappNumber: updates.whatsappNumber.trim().slice(0, 24),
      ownerBirthday: cleanOwnerBirthday,
      logoUrl: updates.logoUrl.trim().slice(0, 300000),
      shareTitle: cleanShareTitle,
      shareTitle_en: cleanShareTitleEn,
      shareDescription: cleanShareDesc,
      shareDescription_en: cleanShareDescEn,
      currency: updates.currency.trim().slice(0, 16) || (getActiveLang() === 'en' ? 'EGP' : 'ج.م'),
      isOpen: Boolean(updates.isOpen),
      taxRate: Number(updates.taxRate) || 0,
      serviceCharge: Number(updates.serviceCharge) || 0,
      deliveryFee: safeDeliveryFee,
      primaryColor: updates.primaryColor,
      colorMode: safeColorMode,
      headingColor: safeHeadingColor,
      descriptionColor: safeDescColor,
      priceColor: safePriceColor,
      menuColumns: safeMenuColumns,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return {
      ...restaurant,
      ...updates,
      ownerBirthday: cleanOwnerBirthday,
      name_en: cleanNameEn,
      tagline_en: cleanTaglineEn,
      shareTitle: cleanShareTitle,
      shareTitle_en: cleanShareTitleEn,
      shareDescription: cleanShareDesc,
      shareDescription_en: cleanShareDescEn,
      slug: cleanSlug,
      deliveryFee: safeDeliveryFee,
      colorMode: safeColorMode,
      headingColor: safeHeadingColor,
      descriptionColor: safeDescColor,
      priceColor: safePriceColor,
      menuColumns: safeMenuColumns,
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
  data: {
    id?: string;
    parentId?: string;
    name: string;
    name_en?: string;
    imageUrl?: string;
    station?: PrepStation;
    stationId?: string;
    stationIds?: string[];
    sortOrder: number;
    propagateStationToCategoryIds?: string[];
  }
): Promise<void> {
  const isNew = !data.id;
  const catId = data.id || makeId('cat');
  const path = `categories/${catId}`;
  const cleanNameEn = (data.name_en || '').trim().slice(0, 80);
  const cleanParentId = (data.parentId || '').trim().slice(0, 128);
  const explicitList = cleanStationIdList(data.stationIds);
  const safeStation = explicitList[0] || cleanStation(data.stationId || data.station);
  const safeStationIds = explicitList.length > 0 ? explicitList : [safeStation];
  try {
    if (isNew) {
      const payload: Record<string, unknown> = {
        id: catId,
        restaurantId,
        ownerId,
        name: data.name.trim().slice(0, 80),
        station: safeStation,
        stationId: safeStation,
        stationIds: safeStationIds,
        sortOrder: Number(data.sortOrder) || 0,
        createdAt: serverTimestamp(),
      };
      if (cleanParentId && cleanParentId !== catId) {
        payload.parentId = cleanParentId;
      }
      if (cleanNameEn) {
        payload.name_en = cleanNameEn;
      }
      if (data.imageUrl?.trim()) {
        payload.imageUrl = data.imageUrl.trim().slice(0, 300000);
      }
      await setDoc(doc(db, 'categories', catId), payload);
    } else {
      await updateDoc(doc(db, 'categories', catId), {
        parentId: cleanParentId && cleanParentId !== catId ? cleanParentId : '',
        name: data.name.trim().slice(0, 80),
        name_en: cleanNameEn,
        imageUrl: (data.imageUrl || '').trim().slice(0, 300000),
        station: safeStation,
        stationId: safeStation,
        stationIds: safeStationIds,
        sortOrder: Number(data.sortOrder) || 0,
      });

      const targetIds = new Set<string>([
        catId,
        ...(data.propagateStationToCategoryIds || []).filter(Boolean),
      ]);
      const itemsSnap = await getDocs(
        query(collection(db, 'menu_items'), where('restaurantId', '==', restaurantId))
      );
      const matchingItems = itemsSnap.docs.filter((d) =>
        targetIds.has(String(d.data()?.categoryId || ''))
      );
      const CHUNK_SIZE = 450;
      for (let i = 0; i < matchingItems.length; i += CHUNK_SIZE) {
        const chunk = matchingItems.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((d) => {
          batch.update(d.ref, {
            station: safeStation,
            stationId: safeStation,
            stationIds: safeStationIds,
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
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
    const CHUNK_SIZE = 450;
    for (let i = 0; i < orderedCategories.length; i += CHUNK_SIZE) {
      const chunk = orderedCategories.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((cat, idx) => {
        batch.update(doc(db, 'categories', cat.id), { sortOrder: i + idx + 1 });
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function reorderMenuItems(
  orderedItems: MenuItem[]
): Promise<void> {
  const path = 'menu_items';
  try {
    const CHUNK_SIZE = 450;
    for (let i = 0; i < orderedItems.length; i += CHUNK_SIZE) {
      const chunk = orderedItems.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((item, idx) => {
        batch.update(doc(db, 'menu_items', item.id), {
          sortOrder: i + idx + 1,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeCategory(
  categoryId: string,
  childCategories: Category[] = []
): Promise<void> {
  const path = `categories/${categoryId}`;
  try {
    if (childCategories.length > 0) {
      const batch = writeBatch(db);
      childCategories.forEach((child) => {
        batch.update(doc(db, 'categories', child.id), { parentId: '' });
      });
      batch.delete(doc(db, 'categories', categoryId));
      await batch.commit();
    } else {
      await deleteDoc(doc(db, 'categories', categoryId));
    }
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
    name_en?: string;
    description?: string;
    description_en?: string;
    basePrice: number;
    calories?: number;
    imageUrl?: string;
    isSpicy: boolean;
    isAvailable: boolean;
    ordersCount?: number;
    sizes: ItemSize[];
    addons: ItemAddon[];
    badge?: ItemBadge;
    isBogo?: boolean;
    suggestedItemIds?: string[];
    station?: PrepStation;
    stationId?: string;
    stationIds?: string[];
    sortOrder: number;
  }
): Promise<void> {
  const isNew = !data.id;
  const itemId = data.id || makeId('item');
  const path = `menu_items/${itemId}`;
  const explicitList = cleanStationIdList(data.stationIds);
  const safeStation = explicitList[0] || cleanStation(data.stationId || data.station);
  const safeStationIds = explicitList.length > 0 ? explicitList : [safeStation];

  const cleanSizes = data.sizes.slice(0, 10).map((s) => ({
    name: s.name.trim().slice(0, 40),
    ...(s.name_en?.trim() ? { name_en: s.name_en.trim().slice(0, 40) } : {}),
    price: Math.max(0, Number(s.price) || 0),
  }));
  const cleanAddons = data.addons.slice(0, 20).map((a) => ({
    name: a.name.trim().slice(0, 60),
    ...(a.name_en?.trim() ? { name_en: a.name_en.trim().slice(0, 60) } : {}),
    price: Math.max(0, Number(a.price) || 0),
  }));
  const cleanNameEn = (data.name_en || '').trim().slice(0, 120);
  const cleanDescEn = (data.description_en || '').trim().slice(0, 500);
  const cleanBadge: ItemBadge =
    data.badge &&
    ['none', 'best_seller', 'trending_week', 'chef_choice', 'bogo', 'new'].includes(data.badge)
      ? data.badge
      : 'none';
  const cleanIsBogo = Boolean(data.isBogo);
  const cleanSuggestedIds = (data.suggestedItemIds || [])
    .filter((id) => typeof id === 'string' && id.trim().length > 0 && id !== itemId)
    .slice(0, 8);

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
        badge: cleanBadge,
        isBogo: cleanIsBogo,
        suggestedItemIds: cleanSuggestedIds,
        station: safeStation,
        stationId: safeStation,
        stationIds: safeStationIds,
        sortOrder: Number(data.sortOrder) || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (cleanNameEn) {
        payload.name_en = cleanNameEn;
      }
      if (data.description?.trim()) {
        payload.description = data.description.trim().slice(0, 500);
      }
      if (cleanDescEn) {
        payload.description_en = cleanDescEn;
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
        name_en: cleanNameEn,
        description: (data.description || '').trim().slice(0, 500),
        description_en: cleanDescEn,
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
        badge: cleanBadge,
        isBogo: cleanIsBogo,
        suggestedItemIds: cleanSuggestedIds,
        station: safeStation,
        stationId: safeStation,
        stationIds: safeStationIds,
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

export async function writeStaffAuditLog(input: {
  restaurantId: string;
  ownerId: string;
  eventType: StaffAuditEventType;
  actor: StaffActorInfo;
  targetUid?: string;
  targetName?: string;
  screen?: string;
  details?: string;
}): Promise<void> {
  try {
    const logId = makeId('slog');
    const payload: Record<string, unknown> = {
      id: logId,
      restaurantId: input.restaurantId,
      ownerId: input.ownerId,
      eventType: input.eventType,
      actorUid: input.actor.uid,
      actorName: (input.actor.name || (getActiveLang() === 'en' ? 'Staff' : 'كادر')).trim().slice(0, 100),
      actorRole: input.actor.role,
      createdAt: serverTimestamp(),
    };
    if (input.targetUid) payload.targetUid = input.targetUid.slice(0, 128);
    if (input.targetName) payload.targetName = input.targetName.slice(0, 100);
    if (input.screen) payload.screen = input.screen.slice(0, 48);
    if (input.details) payload.details = input.details.slice(0, 260);
    await setDoc(doc(db, 'restaurants', input.restaurantId, 'staff_audit_logs', logId), payload);
  } catch {
    // Non-fatal audit logging
  }
}

export interface SubmitOrderInput {
  restaurantId: string;
  ownerId: string;
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  hallName?: string;
  tableNumber?: string;
  sessionId?: string;
  isGroupOrder?: boolean;
  guestChecks?: GuestCheckSummary[];
  deliveryAddress?: string;
  notes?: string;
  items: OrderItemPayload[];
  subtotal: number;
  serviceCharge: number;
  deliveryFee?: number;
  discountAmount?: number;
  manualDiscountAmount?: number;
  manualDiscountPercent?: number;
  manualDiscountReason?: string;
  promoCode?: string;
  taxAmount: number;
  total: number;
  actor?: StaffActorInfo;
}

export async function submitPublicOrder(input: SubmitOrderInput): Promise<{ id: string; orderNumber: string }> {
  const orderId = makeId('ord');
  const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
  const path = `orders/${orderId}`;

  const cleanItems = input.items.slice(0, 80).map((it) => {
    const cleanList = cleanStationIdList(it.stationIds);
    const safeStation = cleanList[0] || cleanStation(it.stationId || it.station);
    const safeStationIds = cleanList.length > 0 ? cleanList : [safeStation];
    const cleaned: OrderItemPayload = {
      menuItemId: it.menuItemId,
      name: it.name.slice(0, 120),
      addonNames: (it.addonNames || []).slice(0, 20),
      quantity: Math.max(1, Math.round(it.quantity)),
      unitPrice: Number(it.unitPrice.toFixed(2)),
      lineTotal: Number(it.lineTotal.toFixed(2)),
      station: safeStation,
      stationId: safeStation,
      stationIds: safeStationIds,
    };
    if (it.stationName?.trim()) cleaned.stationName = it.stationName.trim().slice(0, 80);
    if (it.sizeName) cleaned.sizeName = it.sizeName.slice(0, 40);
    if (it.notes) cleaned.notes = it.notes.slice(0, 200);
    if (it.guestName) cleaned.guestName = it.guestName.slice(0, 60);
    return cleaned;
  });

  const payload: Record<string, unknown> = {
    id: orderId,
    restaurantId: input.restaurantId,
    ownerId: input.ownerId,
    orderNumber,
    customerName: input.customerName.trim().slice(0, 100) || (getActiveLang() === 'en' ? 'Guest' : 'ضيف'),
    customerPhone: input.customerPhone.trim().slice(0, 24),
    orderType: input.orderType,
    items: cleanItems,
    subtotal: Number(input.subtotal.toFixed(2)),
    serviceCharge: Number(input.serviceCharge.toFixed(2)),
    taxAmount: Number(input.taxAmount.toFixed(2)),
    total: Number(input.total.toFixed(2)),
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (typeof input.deliveryFee === 'number' && input.deliveryFee > 0) {
    payload.deliveryFee = Number(input.deliveryFee.toFixed(2));
  }
  if (typeof input.discountAmount === 'number' && input.discountAmount > 0) {
    payload.discountAmount = Number(input.discountAmount.toFixed(2));
  }
  if (typeof input.manualDiscountAmount === 'number' && input.manualDiscountAmount > 0) {
    payload.manualDiscountAmount = Number(input.manualDiscountAmount.toFixed(2));
  }
  if (typeof input.manualDiscountPercent === 'number' && input.manualDiscountPercent > 0) {
    payload.manualDiscountPercent = Number(input.manualDiscountPercent.toFixed(2));
  }
  if (input.manualDiscountReason?.trim()) {
    payload.manualDiscountReason = input.manualDiscountReason.trim().slice(0, 300);
  }
  if (input.promoCode?.trim()) {
    payload.promoCode = input.promoCode.trim().toUpperCase().slice(0, 32);
  }
  if (input.hallName?.trim()) {
    payload.hallName = input.hallName.trim().slice(0, 60);
  }
  if (input.tableNumber?.trim()) {
    payload.tableNumber = input.tableNumber.trim().slice(0, 20);
  }
  if (input.sessionId?.trim()) {
    payload.sessionId = input.sessionId.trim().slice(0, 128);
  }
  if (input.isGroupOrder !== undefined) {
    payload.isGroupOrder = Boolean(input.isGroupOrder);
  }
  if (Array.isArray(input.guestChecks) && input.guestChecks.length > 0) {
    payload.guestChecks = input.guestChecks.slice(0, 30).map((gc) => ({
      guestName: gc.guestName.trim().slice(0, 60),
      ...(gc.guestId ? { guestId: gc.guestId.slice(0, 64) } : {}),
      itemsCount: Math.max(1, Math.round(gc.itemsCount)),
      subtotal: Number(gc.subtotal.toFixed(2)),
      serviceCharge: Number(gc.serviceCharge.toFixed(2)),
      taxAmount: Number(gc.taxAmount.toFixed(2)),
      total: Number(gc.total.toFixed(2)),
    }));
  }
  if (input.deliveryAddress?.trim()) {
    payload.deliveryAddress = input.deliveryAddress.trim().slice(0, 300);
  }
  if (input.notes?.trim()) {
    payload.notes = input.notes.trim().slice(0, 400);
  }
  if (input.actor) {
    payload.createdByUid = input.actor.uid;
    payload.createdByName = input.actor.name.trim().slice(0, 100);
    payload.createdByRole = input.actor.role;
  }

  try {
    await setDoc(doc(db, 'orders', orderId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  if (input.actor) {
    await writeStaffAuditLog({
      restaurantId: input.restaurantId,
      ownerId: input.ownerId,
      eventType: 'order_created',
      actor: input.actor,
      targetUid: orderId,
      targetName: orderNumber,
      screen: 'cashier',
      details:
        getActiveLang() === 'en'
          ? `Created order ${orderNumber}`
          : `إنشاء طلب ${orderNumber}`,
    });
  }

  // Best-effort popularity counter update; never fail or roll back the customer's order if an item was edited/removed
  try {
    const qtyByItem = new Map<string, number>();
    input.items.forEach((item) => {
      if (item.menuItemId) {
        const prev = qtyByItem.get(item.menuItemId) || 0;
        qtyByItem.set(item.menuItemId, Math.min(50, prev + Math.max(1, Math.round(item.quantity))));
      }
    });

    if (qtyByItem.size > 0) {
      const statsBatch = writeBatch(db);
      qtyByItem.forEach((qty, menuItemId) => {
        statsBatch.update(doc(db, 'menu_items', menuItemId), {
          ordersCount: increment(qty),
          updatedAt: serverTimestamp(),
        });
      });
      await statsBatch.commit();
    }
  } catch {
    // Non-fatal counter sync failure
  }

  return { id: orderId, orderNumber };
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
  onData: (orders: Order[]) => void,
  onError?: (err: Error) => void,
  options?: { staffMode?: boolean }
): () => void {
  const path = 'orders';
  const q = options?.staffMode
    ? query(collection(db, 'orders'), where('restaurantId', '==', restaurantId))
    : query(
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
    (error) => {
      if (onError) {
        onError(
          error instanceof Error
            ? error
            : new Error(getActiveLang() === 'en' ? 'Failed to load orders' : 'تعذر تحميل الطلبات')
        );
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  );
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  meta?: {
    restaurantId?: string;
    ownerId?: string;
    orderNumber?: string;
    actor?: StaffActorInfo;
  }
): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    const payload: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (meta?.actor) {
      payload.lastUpdatedByUid = meta.actor.uid;
      payload.lastUpdatedByName = meta.actor.name.trim().slice(0, 100);
      payload.lastUpdatedByRole = meta.actor.role;
      if (status === 'completed') {
        payload.closedByUid = meta.actor.uid;
        payload.closedByName = meta.actor.name.trim().slice(0, 100);
        payload.closedByRole = meta.actor.role;
      }
    }
    await updateDoc(doc(db, 'orders', orderId), payload);

    if (meta?.actor && meta.restaurantId && meta.ownerId) {
      await writeStaffAuditLog({
        restaurantId: meta.restaurantId,
        ownerId: meta.ownerId,
        eventType: 'order_status_updated',
        actor: meta.actor,
        targetUid: orderId,
        targetName: meta.orderNumber || orderId,
        screen: 'cashier',
        details:
          getActiveLang() === 'en'
            ? `Updated order ${meta.orderNumber || ''} status to ${status}`
            : `تحديث حالة الطلب ${meta.orderNumber || ''} إلى ${status}`,
      });
      if (meta.actor.role !== 'owner' && status === 'completed') {
        void incrementActiveShiftMetric({
          restaurantId: meta.restaurantId,
          staffUid: meta.actor.uid,
          stationId: 'cashier',
          field: 'ordersHandled',
          delta: 1,
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateOrderItemProgress(
  orderId: string,
  itemUpdates: Record<string, ItemPrepState>,
  nextOrderStatus?: OrderStatus,
  meta?: {
    restaurantId?: string;
    ownerId?: string;
    orderNumber?: string;
    station?: PrepStation;
    targetStationsMap?: Record<string, string[]>;
    actor?: StaffActorInfo;
  }
): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'orders', orderId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const current = snap.data() as Order;
      if (current.status === 'completed' || current.status === 'cancelled') return;

      const mergedProgress: Record<string, ItemPrepState> = {
        ...(current.itemProgress || {}),
      };
      const mergedBy: Record<string, ItemProgressActorEntry> = {
        ...(current.itemProgressBy || {}),
      };

      const nowMs = Date.now();
      const actingStation = meta?.station ? cleanStation(meta.station) : undefined;
      const actorUid = meta?.actor?.uid || 'system';
      const actorName = (meta?.actor?.name || 'System').trim().slice(0, 100);
      const actorRole = meta?.actor?.role || 'staff';

      Object.entries(itemUpdates).forEach(([idxKey, st]) => {
        const idxNum = Number(idxKey);
        const orderItem = Number.isInteger(idxNum) ? current.items?.[idxNum] : undefined;
        const explicitTargets = cleanStationIdList(
          orderItem?.stationIds || meta?.targetStationsMap?.[idxKey]
        );
        const singleFallback = cleanStation(
          orderItem?.stationId || orderItem?.station || actingStation
        );
        const targetStations =
          explicitTargets.length > 0 ? explicitTargets : [singleFallback];

        const prevEntry = mergedBy[idxKey];
        const prevByStation: Record<string, ItemProgressStationEntry> = {
          ...(prevEntry?.byStation || {}),
        };

        let effectiveOverallState: ItemPrepState = st;

        if (actingStation && st !== 'served') {
          prevByStation[actingStation] = {
            state: st,
            updatedByUid: actorUid,
            updatedByName: actorName,
            updatedByRole: actorRole,
            station: actingStation,
            stationId: actingStation,
            updatedAt: nowMs,
          };

          if (targetStations.length > 1) {
            const states = targetStations.map((sId) => prevByStation[sId]?.state || 'pending');
            if (states.every((s) => s === 'ready' || s === 'served')) {
              effectiveOverallState = 'ready';
            } else if (states.some((s) => s === 'preparing' || s === 'ready' || s === 'served')) {
              effectiveOverallState = 'preparing';
            } else {
              effectiveOverallState = 'pending';
            }
          }
        }

        mergedProgress[idxKey] = effectiveOverallState;

        if (meta?.actor || actingStation) {
          mergedBy[idxKey] = {
            state: effectiveOverallState,
            updatedByUid: actorUid,
            updatedByName: actorName,
            updatedByRole: actorRole,
            ...(actingStation ? { station: actingStation } : prevEntry?.station ? { station: prevEntry.station } : {}),
            ...(Object.keys(prevByStation).length > 0 ? { byStation: prevByStation } : {}),
            updatedAt: nowMs,
          };
        }
      });

      const updatePayload: Record<string, unknown> = {
        itemProgress: mergedProgress,
        updatedAt: serverTimestamp(),
      };

      if (meta?.actor || Object.keys(mergedBy).length > 0) {
        updatePayload.itemProgressBy = mergedBy;
      }

      if (meta?.actor) {
        updatePayload.lastUpdatedByUid = meta.actor.uid;
        updatePayload.lastUpdatedByName = meta.actor.name.trim().slice(0, 100);
        updatePayload.lastUpdatedByRole = meta.actor.role;
      }

      if (nextOrderStatus && nextOrderStatus !== current.status) {
        updatePayload.status = nextOrderStatus;
      }
      tx.update(ref, updatePayload);
    });

    if (meta?.actor && meta.restaurantId && meta.ownerId) {
      await writeStaffAuditLog({
        restaurantId: meta.restaurantId,
        ownerId: meta.ownerId,
        eventType: 'kds_item_updated',
        actor: meta.actor,
        targetUid: orderId,
        targetName: meta.orderNumber || orderId,
        screen: meta.station || 'kitchen',
        details:
          getActiveLang() === 'en'
            ? `Updated item prep status in order ${meta.orderNumber || ''}`
            : `تحديث حالة تجهيز أصناف في الطلب ${meta.orderNumber || ''}`,
      });
      if (meta.actor.role !== 'owner') {
        const readyCount = Object.values(itemUpdates).filter((st) => st === 'ready').length;
        if (readyCount > 0) {
          void incrementActiveShiftMetric({
            restaurantId: meta.restaurantId,
            staffUid: meta.actor.uid,
            stationId: meta.station,
            field: 'itemsMarkedReady',
            delta: readyCount,
          });
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function closeTableOrdersAndSession(params: {
  restaurantId: string;
  ownerId?: string;
  hallName?: string;
  tableNumber?: string;
  orderIds: string[];
  sessionId?: string;
  actor?: StaffActorInfo;
}): Promise<void> {
  const path = 'orders';
  try {
    const batch = writeBatch(db);
    params.orderIds.forEach((orderId) => {
      if (orderId) {
        const updateData: Record<string, unknown> = {
          status: 'completed',
          updatedAt: serverTimestamp(),
        };
        if (params.actor) {
          updateData.lastUpdatedByUid = params.actor.uid;
          updateData.lastUpdatedByName = params.actor.name.trim().slice(0, 100);
          updateData.lastUpdatedByRole = params.actor.role;
          updateData.closedByUid = params.actor.uid;
          updateData.closedByName = params.actor.name.trim().slice(0, 100);
          updateData.closedByRole = params.actor.role;
        }
        batch.update(doc(db, 'orders', orderId), updateData);
      }
    });
    if (params.sessionId?.trim()) {
      batch.delete(
        doc(db, 'restaurants', params.restaurantId, 'table_sessions', params.sessionId.trim())
      );
    }
    await batch.commit();

    if (params.actor && params.ownerId) {
      await writeStaffAuditLog({
        restaurantId: params.restaurantId,
        ownerId: params.ownerId,
        eventType: 'table_closed',
        actor: params.actor,
        targetUid: params.sessionId || '',
        targetName: params.tableNumber
          ? getActiveLang() === 'en'
            ? `Table ${params.tableNumber}`
            : `طاولة ${params.tableNumber}`
          : getActiveLang() === 'en'
            ? 'Table'
            : 'طاولة',
        screen: 'cashier',
        details:
          getActiveLang() === 'en'
            ? `Closed bill for ${params.hallName ? `${params.hallName} - ` : ''}Table ${params.tableNumber || ''}`
            : `إقفال حساب ${params.hallName ? `${params.hallName} - ` : ''}طاولة ${params.tableNumber || ''}`,
      });
    }
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
    seed.mainCategories.forEach((mainCat) => {
      const mainCatId = makeId('cat');
      batch.set(doc(db, 'categories', mainCatId), {
        id: mainCatId,
        restaurantId,
        ownerId,
        name: mainCat.name,
        name_en: mainCat.name_en,
        imageUrl: mainCat.imageUrl,
        sortOrder: mainCat.sortOrder,
        createdAt: serverTimestamp(),
      });

      mainCat.subcategories.forEach((subCat) => {
        const subCatId = makeId('cat');
        batch.set(doc(db, 'categories', subCatId), {
          id: subCatId,
          restaurantId,
          ownerId,
          parentId: mainCatId,
          name: subCat.name,
          name_en: subCat.name_en,
          imageUrl: subCat.imageUrl,
          sortOrder: subCat.sortOrder,
          createdAt: serverTimestamp(),
        });

        subCat.items.forEach((item) => {
          const itemId = makeId('item');
          batch.set(doc(db, 'menu_items', itemId), {
            id: itemId,
            restaurantId,
            ownerId,
            categoryId: subCatId,
            name: item.name,
            name_en: item.name_en,
            description: item.description,
            description_en: item.description_en,
            basePrice: item.basePrice,
            imageUrl: item.imageUrl,
            calories: item.calories,
            isSpicy: item.isSpicy,
            isAvailable: true,
            ordersCount: item.ordersCount,
            sizes: item.sizes,
            addons: item.addons,
            badge: item.badge || 'none',
            isBogo: Boolean(item.isBogo),
            suggestedItemIds: [],
            sortOrder: item.sortOrder,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
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

export async function updateRestaurantBilingualInfoForSuperAdmin(
  restaurantId: string,
  updates: {
    name: string;
    name_en?: string;
    tagline?: string;
    tagline_en?: string;
  }
): Promise<{ name: string; name_en: string; tagline: string; tagline_en: string }> {
  const path = `restaurants/${restaurantId}`;
  const cleanName = updates.name.trim().slice(0, 120);
  const cleanNameEn = (updates.name_en || '').trim().slice(0, 120);
  const cleanTagline = (updates.tagline || '').trim().slice(0, 500);
  const cleanTaglineEn = (updates.tagline_en || '').trim().slice(0, 500);
  try {
    await updateDoc(doc(db, 'restaurants', restaurantId), {
      name: cleanName,
      name_en: cleanNameEn,
      tagline: cleanTagline,
      tagline_en: cleanTaglineEn,
      updatedAt: serverTimestamp(),
    });
    return {
      name: cleanName,
      name_en: cleanNameEn,
      tagline: cleanTagline,
      tagline_en: cleanTaglineEn,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteRestaurantAccountCompletely(
  restaurant: Restaurant
): Promise<void> {
  const path = `restaurants/${restaurant.id}`;
  try {
    const [
      catSnap,
      itemSnap,
      orderSnap,
      callsSnap,
      hallsSnap,
      sessionsSnap,
      customersSnap,
      stationsSnap,
      staffSnap,
      invitesSnap,
      loginIndexSnap,
      auditLogsSnap,
      staffShiftsSnap,
      staffDevicesSnap,
      staffAccessSnap,
    ] = await Promise.all([
      getDocs(query(collection(db, 'categories'), where('restaurantId', '==', restaurant.id))),
      getDocs(query(collection(db, 'menu_items'), where('restaurantId', '==', restaurant.id))),
      getDocs(query(collection(db, 'orders'), where('restaurantId', '==', restaurant.id))),
      getDocs(query(collection(db, 'service_calls'), where('restaurantId', '==', restaurant.id))),
      getDocs(query(collection(db, 'halls'), where('restaurantId', '==', restaurant.id))),
      getDocs(collection(db, 'restaurants', restaurant.id, 'table_sessions')),
      getDocs(collection(db, 'restaurants', restaurant.id, 'customers')),
      getDocs(collection(db, 'restaurants', restaurant.id, 'stations')),
      getDocs(collection(db, 'restaurants', restaurant.id, 'staff')),
      getDocs(collection(db, 'restaurants', restaurant.id, 'staff_invites')),
      getDocs(collection(db, 'restaurants', restaurant.id, 'staff_login_index')),
      getDocs(collection(db, 'restaurants', restaurant.id, 'staff_audit_logs')),
      getDocs(collection(db, 'restaurants', restaurant.id, 'staff_shifts')),
      getDocs(collection(db, 'restaurants', restaurant.id, 'staff_devices')),
      getDocs(query(collection(db, 'staff_access'), where('restaurantId', '==', restaurant.id))),
    ]);

    const refsToDelete = [
      ...catSnap.docs.map((d) => d.ref),
      ...itemSnap.docs.map((d) => d.ref),
      ...orderSnap.docs.map((d) => d.ref),
      ...callsSnap.docs.map((d) => d.ref),
      ...hallsSnap.docs.map((d) => d.ref),
      ...sessionsSnap.docs.map((d) => d.ref),
      ...customersSnap.docs.map((d) => d.ref),
      ...stationsSnap.docs.map((d) => d.ref),
      ...staffSnap.docs.map((d) => d.ref),
      ...invitesSnap.docs.map((d) => d.ref),
      ...loginIndexSnap.docs.map((d) => d.ref),
      ...auditLogsSnap.docs.map((d) => d.ref),
      ...staffShiftsSnap.docs.map((d) => d.ref),
      ...staffDevicesSnap.docs.map((d) => d.ref),
      ...staffAccessSnap.docs.map((d) => d.ref),
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

const VALID_LANDING_SECTION_IDS = new Set<LandingSectionId>([
  'hero',
  'themes',
  'features',
  'operations',
  'loyalty',
  'pricing',
  'tygos_promo',
]);

export function normalizeLandingSections(
  incoming?: LandingSectionConfig[]
): LandingSectionConfig[] {
  const seen = new Set<LandingSectionId>();
  const result: LandingSectionConfig[] = [];

  if (Array.isArray(incoming)) {
    for (const sec of incoming) {
      if (sec && VALID_LANDING_SECTION_IDS.has(sec.id) && !seen.has(sec.id)) {
        seen.add(sec.id);
        result.push({ id: sec.id, isVisible: sec.isVisible !== false });
      }
    }
  }

  for (const def of DEFAULT_LANDING_SECTIONS) {
    if (!seen.has(def.id)) {
      seen.add(def.id);
      result.push({ ...def });
    }
  }

  return result.slice(0, 10);
}

export async function fetchPlatformLandingSettings(): Promise<PlatformLandingSettings> {
  try {
    const snap = await getDoc(doc(db, 'platform_settings', 'landing'));
    if (!snap.exists()) {
      return DEFAULT_PLATFORM_LANDING;
    }
    const data = snap.data() as Partial<PlatformLandingSettings>;
    const rawFeatures =
      Array.isArray(data.features) && data.features.length > 0
        ? data.features
        : DEFAULT_PLATFORM_LANDING.features;
    const rawPlans =
      Array.isArray(data.pricingPlans) && data.pricingPlans.length > 0
        ? data.pricingPlans
        : DEFAULT_PLATFORM_LANDING.pricingPlans;

    return {
      sections: normalizeLandingSections(data.sections),
      heroBadge: data.heroBadge || DEFAULT_PLATFORM_LANDING.heroBadge,
      heroBadge_en: data.heroBadge_en || DEFAULT_PLATFORM_LANDING.heroBadge_en,
      heroTitle: data.heroTitle || DEFAULT_PLATFORM_LANDING.heroTitle,
      heroTitle_en: data.heroTitle_en || DEFAULT_PLATFORM_LANDING.heroTitle_en,
      heroSubtitle: data.heroSubtitle || DEFAULT_PLATFORM_LANDING.heroSubtitle,
      heroSubtitle_en: data.heroSubtitle_en || DEFAULT_PLATFORM_LANDING.heroSubtitle_en,
      ctaButtonText: data.ctaButtonText || DEFAULT_PLATFORM_LANDING.ctaButtonText,
      ctaButtonText_en: data.ctaButtonText_en || DEFAULT_PLATFORM_LANDING.ctaButtonText_en,
      heroSecondaryBtnText:
        data.heroSecondaryBtnText || DEFAULT_PLATFORM_LANDING.heroSecondaryBtnText,
      heroSecondaryBtnText_en:
        data.heroSecondaryBtnText_en || DEFAULT_PLATFORM_LANDING.heroSecondaryBtnText_en,
      themesTitle: data.themesTitle || DEFAULT_PLATFORM_LANDING.themesTitle,
      themesTitle_en: data.themesTitle_en || DEFAULT_PLATFORM_LANDING.themesTitle_en,
      themesSubtitle: data.themesSubtitle || DEFAULT_PLATFORM_LANDING.themesSubtitle,
      themesSubtitle_en: data.themesSubtitle_en || DEFAULT_PLATFORM_LANDING.themesSubtitle_en,
      featuresTitle: data.featuresTitle || DEFAULT_PLATFORM_LANDING.featuresTitle,
      featuresTitle_en: data.featuresTitle_en || DEFAULT_PLATFORM_LANDING.featuresTitle_en,
      featuresSubtitle: data.featuresSubtitle || DEFAULT_PLATFORM_LANDING.featuresSubtitle,
      featuresSubtitle_en:
        data.featuresSubtitle_en || DEFAULT_PLATFORM_LANDING.featuresSubtitle_en,
      features: rawFeatures.map((f) => ({ ...f, isVisible: f.isVisible !== false })),
      operationsBadge: data.operationsBadge || DEFAULT_PLATFORM_LANDING.operationsBadge,
      operationsBadge_en:
        data.operationsBadge_en || DEFAULT_PLATFORM_LANDING.operationsBadge_en,
      operationsTitle: data.operationsTitle || DEFAULT_PLATFORM_LANDING.operationsTitle,
      operationsTitle_en:
        data.operationsTitle_en || DEFAULT_PLATFORM_LANDING.operationsTitle_en,
      operationsSubtitle:
        data.operationsSubtitle || DEFAULT_PLATFORM_LANDING.operationsSubtitle,
      operationsSubtitle_en:
        data.operationsSubtitle_en || DEFAULT_PLATFORM_LANDING.operationsSubtitle_en,
      operationsBullets:
        Array.isArray(data.operationsBullets) && data.operationsBullets.length > 0
          ? data.operationsBullets
          : DEFAULT_PLATFORM_LANDING.operationsBullets,
      operationsBullets_en:
        Array.isArray(data.operationsBullets_en) && data.operationsBullets_en.length > 0
          ? data.operationsBullets_en
          : DEFAULT_PLATFORM_LANDING.operationsBullets_en,
      loyaltyBadge: data.loyaltyBadge || DEFAULT_PLATFORM_LANDING.loyaltyBadge,
      loyaltyBadge_en: data.loyaltyBadge_en || DEFAULT_PLATFORM_LANDING.loyaltyBadge_en,
      loyaltyTitle: data.loyaltyTitle || DEFAULT_PLATFORM_LANDING.loyaltyTitle,
      loyaltyTitle_en: data.loyaltyTitle_en || DEFAULT_PLATFORM_LANDING.loyaltyTitle_en,
      loyaltySubtitle: data.loyaltySubtitle || DEFAULT_PLATFORM_LANDING.loyaltySubtitle,
      loyaltySubtitle_en:
        data.loyaltySubtitle_en || DEFAULT_PLATFORM_LANDING.loyaltySubtitle_en,
      loyaltyBullets:
        Array.isArray(data.loyaltyBullets) && data.loyaltyBullets.length > 0
          ? data.loyaltyBullets
          : DEFAULT_PLATFORM_LANDING.loyaltyBullets,
      loyaltyBullets_en:
        Array.isArray(data.loyaltyBullets_en) && data.loyaltyBullets_en.length > 0
          ? data.loyaltyBullets_en
          : DEFAULT_PLATFORM_LANDING.loyaltyBullets_en,
      pricingTitle: data.pricingTitle || DEFAULT_PLATFORM_LANDING.pricingTitle,
      pricingTitle_en: data.pricingTitle_en || DEFAULT_PLATFORM_LANDING.pricingTitle_en,
      pricingSubtitle: data.pricingSubtitle || DEFAULT_PLATFORM_LANDING.pricingSubtitle,
      pricingSubtitle_en:
        data.pricingSubtitle_en || DEFAULT_PLATFORM_LANDING.pricingSubtitle_en,
      pricingCtaText: data.pricingCtaText || DEFAULT_PLATFORM_LANDING.pricingCtaText,
      pricingCtaText_en: data.pricingCtaText_en || DEFAULT_PLATFORM_LANDING.pricingCtaText_en,
      pricingPlans: rawPlans.map((p) => ({ ...p, isVisible: p.isVisible !== false })),
      tygosBadge: data.tygosBadge || DEFAULT_PLATFORM_LANDING.tygosBadge,
      tygosBadge_en: data.tygosBadge_en || DEFAULT_PLATFORM_LANDING.tygosBadge_en,
      tygosTitle: data.tygosTitle || DEFAULT_PLATFORM_LANDING.tygosTitle,
      tygosTitle_en: data.tygosTitle_en || DEFAULT_PLATFORM_LANDING.tygosTitle_en,
      tygosSubtitle: data.tygosSubtitle || DEFAULT_PLATFORM_LANDING.tygosSubtitle,
      tygosSubtitle_en: data.tygosSubtitle_en || DEFAULT_PLATFORM_LANDING.tygosSubtitle_en,
      tygosCtaText: data.tygosCtaText || DEFAULT_PLATFORM_LANDING.tygosCtaText,
      tygosCtaText_en: data.tygosCtaText_en || DEFAULT_PLATFORM_LANDING.tygosCtaText_en,
      supportWhatsapp: data.supportWhatsapp ?? DEFAULT_PLATFORM_LANDING.supportWhatsapp,
      footerText: data.footerText || DEFAULT_PLATFORM_LANDING.footerText,
      footerText_en: data.footerText_en || DEFAULT_PLATFORM_LANDING.footerText_en,
      platformLogoUrl:
        !data.platformLogoUrl ||
        data.platformLogoUrl.includes('sufra_platform_logo_1795015927934')
          ? DEFAULT_PLATFORM_LANDING.platformLogoUrl
          : data.platformLogoUrl,
      shareTitle: data.shareTitle || DEFAULT_PLATFORM_LANDING.shareTitle,
      shareTitle_en: data.shareTitle_en || DEFAULT_PLATFORM_LANDING.shareTitle_en,
      shareDescription: data.shareDescription || DEFAULT_PLATFORM_LANDING.shareDescription,
      shareDescription_en: data.shareDescription_en || DEFAULT_PLATFORM_LANDING.shareDescription_en,
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
        title_en: (f.title_en || '').trim().slice(0, 120),
        description: (f.description || '').trim().slice(0, 300),
        description_en: (f.description_en || '').trim().slice(0, 300),
        isVisible: f.isVisible !== false,
      }))
      .filter((f) => f.title.length > 0);

    const cleanPlans = settings.pricingPlans
      .slice(0, 6)
      .map((p, idx) => ({
        id: (p.id || `plan_${idx + 1}`).trim().slice(0, 40),
        name: (p.name || '').trim().slice(0, 80),
        name_en: (p.name_en || '').trim().slice(0, 80),
        price: (p.price || '0').trim().slice(0, 32),
        period: (p.period || '').trim().slice(0, 48),
        period_en: (p.period_en || '').trim().slice(0, 48),
        description: (p.description || '').trim().slice(0, 240),
        description_en: (p.description_en || '').trim().slice(0, 240),
        features: (p.features || [])
          .map((item) => item.trim().slice(0, 120))
          .filter(Boolean)
          .slice(0, 10),
        features_en: (p.features_en || [])
          .map((item) => item.trim().slice(0, 120))
          .filter(Boolean)
          .slice(0, 10),
        highlighted: Boolean(p.highlighted),
        isVisible: p.isVisible !== false,
      }))
      .filter((p) => p.name.length > 0);

    const cleanBullets = (arr?: string[]) =>
      (arr || [])
        .map((line) => String(line || '').trim().slice(0, 240))
        .filter(Boolean)
        .slice(0, 8);

    await setDoc(doc(db, 'platform_settings', 'landing'), {
      sections: normalizeLandingSections(settings.sections),
      heroBadge: (settings.heroBadge || '').trim().slice(0, 120),
      heroBadge_en: (settings.heroBadge_en || '').trim().slice(0, 120),
      heroTitle:
        settings.heroTitle.trim().slice(0, 200) || DEFAULT_PLATFORM_LANDING.heroTitle,
      heroTitle_en: (settings.heroTitle_en || '').trim().slice(0, 200),
      heroSubtitle:
        settings.heroSubtitle.trim().slice(0, 600) || DEFAULT_PLATFORM_LANDING.heroSubtitle,
      heroSubtitle_en: (settings.heroSubtitle_en || '').trim().slice(0, 600),
      ctaButtonText:
        settings.ctaButtonText.trim().slice(0, 80) || DEFAULT_PLATFORM_LANDING.ctaButtonText,
      ctaButtonText_en: (settings.ctaButtonText_en || '').trim().slice(0, 80),
      heroSecondaryBtnText: (settings.heroSecondaryBtnText || '').trim().slice(0, 80),
      heroSecondaryBtnText_en: (settings.heroSecondaryBtnText_en || '').trim().slice(0, 80),
      themesTitle: (settings.themesTitle || '').trim().slice(0, 160),
      themesTitle_en: (settings.themesTitle_en || '').trim().slice(0, 160),
      themesSubtitle: (settings.themesSubtitle || '').trim().slice(0, 400),
      themesSubtitle_en: (settings.themesSubtitle_en || '').trim().slice(0, 400),
      featuresTitle: (settings.featuresTitle || '').trim().slice(0, 160),
      featuresTitle_en: (settings.featuresTitle_en || '').trim().slice(0, 160),
      featuresSubtitle: (settings.featuresSubtitle || '').trim().slice(0, 400),
      featuresSubtitle_en: (settings.featuresSubtitle_en || '').trim().slice(0, 400),
      features: cleanFeatures,
      operationsBadge: (settings.operationsBadge || '').trim().slice(0, 120),
      operationsBadge_en: (settings.operationsBadge_en || '').trim().slice(0, 120),
      operationsTitle: (settings.operationsTitle || '').trim().slice(0, 200),
      operationsTitle_en: (settings.operationsTitle_en || '').trim().slice(0, 200),
      operationsSubtitle: (settings.operationsSubtitle || '').trim().slice(0, 500),
      operationsSubtitle_en: (settings.operationsSubtitle_en || '').trim().slice(0, 500),
      operationsBullets: cleanBullets(settings.operationsBullets),
      operationsBullets_en: cleanBullets(settings.operationsBullets_en),
      loyaltyBadge: (settings.loyaltyBadge || '').trim().slice(0, 120),
      loyaltyBadge_en: (settings.loyaltyBadge_en || '').trim().slice(0, 120),
      loyaltyTitle: (settings.loyaltyTitle || '').trim().slice(0, 200),
      loyaltyTitle_en: (settings.loyaltyTitle_en || '').trim().slice(0, 200),
      loyaltySubtitle: (settings.loyaltySubtitle || '').trim().slice(0, 500),
      loyaltySubtitle_en: (settings.loyaltySubtitle_en || '').trim().slice(0, 500),
      loyaltyBullets: cleanBullets(settings.loyaltyBullets),
      loyaltyBullets_en: cleanBullets(settings.loyaltyBullets_en),
      pricingTitle: (settings.pricingTitle || '').trim().slice(0, 160),
      pricingTitle_en: (settings.pricingTitle_en || '').trim().slice(0, 160),
      pricingSubtitle: (settings.pricingSubtitle || '').trim().slice(0, 400),
      pricingSubtitle_en: (settings.pricingSubtitle_en || '').trim().slice(0, 400),
      pricingCtaText: (settings.pricingCtaText || '').trim().slice(0, 80),
      pricingCtaText_en: (settings.pricingCtaText_en || '').trim().slice(0, 80),
      pricingPlans: cleanPlans,
      tygosBadge: (settings.tygosBadge || '').trim().slice(0, 120),
      tygosBadge_en: (settings.tygosBadge_en || '').trim().slice(0, 120),
      tygosTitle: (settings.tygosTitle || '').trim().slice(0, 200),
      tygosTitle_en: (settings.tygosTitle_en || '').trim().slice(0, 200),
      tygosSubtitle: (settings.tygosSubtitle || '').trim().slice(0, 500),
      tygosSubtitle_en: (settings.tygosSubtitle_en || '').trim().slice(0, 500),
      tygosCtaText: (settings.tygosCtaText || '').trim().slice(0, 80),
      tygosCtaText_en: (settings.tygosCtaText_en || '').trim().slice(0, 80),
      supportWhatsapp: settings.supportWhatsapp.trim().slice(0, 32),
      footerText:
        settings.footerText.trim().slice(0, 200) || DEFAULT_PLATFORM_LANDING.footerText,
      footerText_en: (settings.footerText_en || '').trim().slice(0, 200),
      platformLogoUrl: (settings.platformLogoUrl || '').trim().slice(0, 300000),
      shareTitle: (settings.shareTitle || '').trim().slice(0, 140),
      shareTitle_en: (settings.shareTitle_en || '').trim().slice(0, 140),
      shareDescription: (settings.shareDescription || '').trim().slice(0, 300),
      shareDescription_en: (settings.shareDescription_en || '').trim().slice(0, 300),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ============================================================
// Platform SaaS Promo Codes (Super Admin CRUD + Owner Redemption)
// ============================================================

export function sanitizePlatformPromoCode(raw: string): string {
  return (raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);
}

export function formatPlatformPromoSummary(
  promo: Pick<PlatformPromoCode, 'discountType' | 'discountValue' | 'description' | 'description_en'>
): { summary: string; summary_en: string } {
  const val = Math.max(0, Number(promo.discountValue) || 0);
  const defaultAr =
    promo.discountType === 'percent'
      ? `خصم ${val}% على اشتراك المنصة`
      : promo.discountType === 'fixed'
        ? `خصم ${val} ج.م على باقة الاشتراك`
        : val > 1
          ? `${val} شهور اشتراك مجانية هدية`
          : 'شهر اشتراك مجاني هدية من المنصة';
  const defaultEn =
    promo.discountType === 'percent'
      ? `${val}% off platform subscription`
      : promo.discountType === 'fixed'
        ? `${val} EGP off subscription`
        : val > 1
          ? `${val} free subscription months gift`
          : '1 free subscription month gift';

  return {
    summary: (promo.description?.trim() || defaultAr).slice(0, 160),
    summary_en: (promo.description_en?.trim() || defaultEn).slice(0, 160),
  };
}

export async function fetchPlatformPromoCodes(): Promise<PlatformPromoCode[]> {
  const path = 'platform_promo_codes';
  try {
    const snap = await getDocs(collection(db, 'platform_promo_codes'));
    return snap.docs
      .map((d) => ({ ...(d.data() as PlatformPromoCode), id: d.id }))
      .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function savePlatformPromoCode(input: {
  isEditing?: boolean;
  code: string;
  discountType: PlatformPromoDiscountType;
  discountValue: number;
  description?: string;
  description_en?: string;
  isActive: boolean;
}): Promise<PlatformPromoCode> {
  const cleanCode = sanitizePlatformPromoCode(input.code);
  if (cleanCode.length < 2) {
    throw new Error(
      getActiveLang() === 'en'
        ? 'Promo code must be at least 2 English letters or numbers (e.g., BDAY50).'
        : 'يجب أن يتكون كود الخصم من حرفين أو أرقام إنجليزية على الأقل (مثال: BDAY50).'
    );
  }
  const safeType: PlatformPromoDiscountType =
    input.discountType === 'fixed' || input.discountType === 'free_month'
      ? input.discountType
      : 'percent';
  const maxVal = safeType === 'percent' ? 100 : safeType === 'free_month' ? 24 : 100000;
  const safeVal = Math.max(
    0,
    Math.min(maxVal, safeType === 'free_month' ? Math.max(1, Math.round(Number(input.discountValue) || 1)) : Number(input.discountValue) || 0)
  );
  const cleanDesc = (input.description || '').trim().slice(0, 200);
  const cleanDescEn = (input.description_en || '').trim().slice(0, 200);
  const path = `platform_promo_codes/${cleanCode}`;

  try {
    const docRef = doc(db, 'platform_promo_codes', cleanCode);
    const existingSnap = await getDoc(docRef);

    if (!existingSnap.exists()) {
      await setDoc(docRef, {
        id: cleanCode,
        code: cleanCode,
        discountType: safeType,
        discountValue: safeVal,
        description: cleanDesc,
        description_en: cleanDescEn,
        isActive: Boolean(input.isActive),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        discountType: safeType,
        discountValue: safeVal,
        description: cleanDesc,
        description_en: cleanDescEn,
        isActive: Boolean(input.isActive),
        updatedAt: serverTimestamp(),
      });
    }

    const freshSnap = await getDoc(docRef);
    return { ...(freshSnap.data() as PlatformPromoCode), id: cleanCode };
  } catch (error) {
    handleFirestoreError(error, input.isEditing ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function togglePlatformPromoCodeStatus(
  promoId: string,
  isActive: boolean
): Promise<void> {
  const cleanCode = sanitizePlatformPromoCode(promoId);
  if (cleanCode.length < 2) return;
  const path = `platform_promo_codes/${cleanCode}`;
  try {
    await updateDoc(doc(db, 'platform_promo_codes', cleanCode), {
      isActive: Boolean(isActive),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePlatformPromoCode(promoId: string): Promise<void> {
  const cleanCode = sanitizePlatformPromoCode(promoId);
  if (cleanCode.length < 2) return;
  const path = `platform_promo_codes/${cleanCode}`;
  try {
    await deleteDoc(doc(db, 'platform_promo_codes', cleanCode));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function redeemPlatformPromoCodeForOwner(
  restaurantId: string,
  rawCode: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<{ code: string; summary: string; summary_en: string }> {
  const cleanCode = sanitizePlatformPromoCode(rawCode);
  if (cleanCode.length < 2) {
    throw new Error(
      lang === 'en'
        ? 'Please enter a valid promo code (e.g. BDAY50).'
        : 'يرجى إدخال كود خصم صحيح باللغة الإنجليزية (مثال: BDAY50).'
    );
  }

  const promoSnap = await getDoc(doc(db, 'platform_promo_codes', cleanCode));
  if (!promoSnap.exists()) {
    throw new Error(
      lang === 'en'
        ? 'This promo code does not exist.'
        : 'كود الخصم هذا غير موجود. تأكد من كتابته بشكل صحيح.'
    );
  }
  const promo = promoSnap.data() as PlatformPromoCode;
  if (!promo.isActive) {
    throw new Error(
      lang === 'en'
        ? 'This promo code is currently inactive or expired.'
        : 'عذراً، هذا الكود متوقف حالياً أو منتهي الصلاحية.'
    );
  }

  const { summary, summary_en } = formatPlatformPromoSummary(promo);
  const restPath = `restaurants/${restaurantId}`;
  try {
    await updateDoc(doc(db, 'restaurants', restaurantId), {
      appliedPlatformPromoCode: cleanCode,
      appliedPlatformPromoSummary: summary,
      appliedPlatformPromoSummary_en: summary_en,
      updatedAt: serverTimestamp(),
    });
    return { code: cleanCode, summary, summary_en };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, restPath);
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
  name_en?: string;
  description?: string;
  description_en?: string;
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
  const cleanNameEn = (data.name_en || '').trim().slice(0, 100);
  const cleanDesc = (data.description || '').trim().slice(0, 400);
  const cleanDescEn = (data.description_en || '').trim().slice(0, 400);
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
      if (cleanNameEn) payload.name_en = cleanNameEn;
      if (cleanDesc) payload.description = cleanDesc;
      if (cleanDescEn) payload.description_en = cleanDescEn;
      if (cleanPreview) payload.previewImage = cleanPreview;
      await setDoc(doc(db, 'custom_themes', themeId), payload);
    } else {
      await updateDoc(doc(db, 'custom_themes', themeId), {
        name: cleanName,
        name_en: cleanNameEn,
        description: cleanDesc,
        description_en: cleanDescEn,
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

// ============================================================
// Group Table Sessions (Live Collaborative Cart & Separate Check)
// ============================================================

export function subscribeTableSession(
  restaurantId: string,
  sessionId: string,
  onData: (session: TableSession | null) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `restaurants/${restaurantId}/table_sessions/${sessionId}`;
  return onSnapshot(
    doc(db, 'restaurants', restaurantId, 'table_sessions', sessionId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData({ ...(snap.data() as TableSession), id: snap.id });
    },
    (error) => {
      if (onError) {
        onError(
          error instanceof Error
            ? error
            : new Error(
                getActiveLang() === 'en' ? 'Table session sync error' : 'تعذر مزامنة جلسة الطاولة'
              )
        );
      } else {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }
  );
}

export async function registerGuestInTableSession(params: {
  restaurantId: string;
  ownerId: string;
  sessionId: string;
  hallName: string;
  tableNumber: string;
  guestName: string;
}): Promise<void> {
  const path = `restaurants/${params.restaurantId}/table_sessions/${params.sessionId}`;
  const cleanGuest = params.guestName.trim().slice(0, 60);
  const cleanHall = params.hallName.trim().slice(0, 60);
  const cleanTable = params.tableNumber.trim().slice(0, 20);
  if (!cleanTable || !cleanGuest) return;

  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'restaurants', params.restaurantId, 'table_sessions', params.sessionId);
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, {
          id: params.sessionId,
          restaurantId: params.restaurantId,
          ownerId: params.ownerId,
          hallName: cleanHall,
          tableNumber: cleanTable,
          status: 'active',
          guests: [cleanGuest],
          items: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const data = snap.data() as TableSession;
        const existingGuests = Array.isArray(data.guests) ? data.guests : [];
        const hasGuest = existingGuests.some(
          (g) => g.trim().toLowerCase() === cleanGuest.toLowerCase()
        );
        const nextGuests = hasGuest
          ? existingGuests.slice(0, 30)
          : [...existingGuests, cleanGuest].slice(0, 30);
        tx.update(ref, {
          hallName: cleanHall || data.hallName || '',
          tableNumber: cleanTable || data.tableNumber,
          guests: nextGuests,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function mutateTableSessionCart(params: {
  restaurantId: string;
  ownerId: string;
  sessionId: string;
  hallName: string;
  tableNumber: string;
  guestName: string;
  mutator: (currentItems: TableSessionItem[]) => TableSessionItem[];
}): Promise<void> {
  const path = `restaurants/${params.restaurantId}/table_sessions/${params.sessionId}`;
  const cleanGuest = params.guestName.trim().slice(0, 60) || (getActiveLang() === 'en' ? 'Guest' : 'ضيف');
  const cleanHall = params.hallName.trim().slice(0, 60);
  const cleanTable = params.tableNumber.trim().slice(0, 20);
  if (!cleanTable) return;

  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'restaurants', params.restaurantId, 'table_sessions', params.sessionId);
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        const nextItems = params.mutator([]).slice(0, 80);
        tx.set(ref, {
          id: params.sessionId,
          restaurantId: params.restaurantId,
          ownerId: params.ownerId,
          hallName: cleanHall,
          tableNumber: cleanTable,
          status: 'active',
          guests: [cleanGuest],
          items: nextItems,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const data = snap.data() as TableSession;
        const currentItems = Array.isArray(data.items) ? data.items : [];
        const nextItems = params.mutator(currentItems).slice(0, 80);
        const existingGuests = Array.isArray(data.guests) ? data.guests : [];
        const hasGuest = existingGuests.some(
          (g) => g.trim().toLowerCase() === cleanGuest.toLowerCase()
        );
        const nextGuests = hasGuest
          ? existingGuests.slice(0, 30)
          : [...existingGuests, cleanGuest].slice(0, 30);

        tx.update(ref, {
          hallName: cleanHall || data.hallName || '',
          tableNumber: cleanTable || data.tableNumber,
          guests: nextGuests,
          items: nextItems,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function clearTableSessionAfterOrder(
  restaurantId: string,
  sessionId: string,
  orderNumber?: string
): Promise<void> {
  const path = `restaurants/${restaurantId}/table_sessions/${sessionId}`;
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'restaurants', restaurantId, 'table_sessions', sessionId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const updatePayload: Record<string, unknown> = {
        items: [],
        updatedAt: serverTimestamp(),
      };
      if (orderNumber?.trim()) {
        updatePayload.lastOrderNumber = orderNumber.trim().slice(0, 32);
      }
      tx.update(ref, updatePayload);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================
// Service Calls (Captain / Waiter / Bill / Cutlery & Water)
// ============================================================

export async function sendServiceCall(input: {
  restaurantId: string;
  ownerId: string;
  hallName: string;
  tableNumber: string;
  sessionId?: string;
  guestName: string;
  callType: ServiceCallType;
}): Promise<ServiceCall> {
  const callId = makeId('call');
  const path = `service_calls/${callId}`;
  const cleanGuest = input.guestName.trim().slice(0, 60) || (getActiveLang() === 'en' ? 'Guest' : 'ضيف');
  const cleanHall = input.hallName.trim().slice(0, 60);
  const cleanTable = input.tableNumber.trim().slice(0, 20);

  const payload: Record<string, unknown> = {
    id: callId,
    restaurantId: input.restaurantId,
    ownerId: input.ownerId,
    hallName: cleanHall,
    tableNumber: cleanTable,
    guestName: cleanGuest,
    callType: input.callType,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.sessionId?.trim()) {
    payload.sessionId = input.sessionId.trim().slice(0, 128);
  }

  try {
    await setDoc(doc(db, 'service_calls', callId), payload);
    return {
      id: callId,
      restaurantId: input.restaurantId,
      ownerId: input.ownerId,
      hallName: cleanHall,
      tableNumber: cleanTable,
      sessionId: input.sessionId,
      guestName: cleanGuest,
      callType: input.callType,
      status: 'pending',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeOwnerServiceCalls(
  restaurantId: string,
  ownerId: string,
  onData: (calls: ServiceCall[]) => void,
  onError?: (err: Error) => void,
  options?: { staffMode?: boolean }
): () => void {
  const path = 'service_calls';
  const q = options?.staffMode
    ? query(collection(db, 'service_calls'), where('restaurantId', '==', restaurantId))
    : query(
        collection(db, 'service_calls'),
        where('restaurantId', '==', restaurantId),
        where('ownerId', '==', ownerId)
      );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as ServiceCall), id: d.id }))
        .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
      onData(list);
    },
    (error) => {
      if (onError) {
        onError(
          error instanceof Error
            ? error
            : new Error(
                getActiveLang() === 'en' ? 'Failed to load service calls' : 'تعذر تحميل نداءات الخدمة'
              )
        );
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  );
}

export async function updateServiceCallStatus(
  callId: string,
  status: ServiceCallStatus,
  meta?: {
    restaurantId?: string;
    ownerId?: string;
    tableLabel?: string;
    actor?: StaffActorInfo;
  }
): Promise<void> {
  const path = `service_calls/${callId}`;
  try {
    const payload: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (meta?.actor) {
      payload.handledByUid = meta.actor.uid;
      payload.handledByName = meta.actor.name.trim().slice(0, 100);
      payload.handledByRole = meta.actor.role;
    }
    await updateDoc(doc(db, 'service_calls', callId), payload);

    if (meta?.actor && meta.restaurantId && meta.ownerId) {
      await writeStaffAuditLog({
        restaurantId: meta.restaurantId,
        ownerId: meta.ownerId,
        eventType: 'service_call_handled',
        actor: meta.actor,
        targetUid: callId,
        targetName: meta.tableLabel || (getActiveLang() === 'en' ? 'Table' : 'طاولة'),
        screen: 'captain',
        details:
          getActiveLang() === 'en'
            ? `Service call (${status}) — ${meta.tableLabel || ''}`
            : `استجابة لطلب خدمة (${status}) — ${meta.tableLabel || ''}`,
      });
      if (meta.actor.role !== 'owner' && (status === 'acknowledged' || status === 'resolved')) {
        void incrementActiveShiftMetric({
          restaurantId: meta.restaurantId,
          staffUid: meta.actor.uid,
          stationId: 'captain',
          field: 'serviceCallsHandled',
          delta: 1,
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================
// Halls / Floor Zones Management (Bulk Table QR & Operations)
// ============================================================

export function subscribeHalls(
  restaurantId: string,
  onData: (halls: Hall[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'halls';
  const q = query(collection(db, 'halls'), where('restaurantId', '==', restaurantId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as Hall), id: d.id }))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      onData(list);
    },
    (error) => {
      if (onError) {
        onError(
          error instanceof Error
            ? error
            : new Error(getActiveLang() === 'en' ? 'Failed to load halls' : 'تعذر تحميل الصالات')
        );
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  );
}

export async function fetchRestaurantHalls(restaurantId: string): Promise<Hall[]> {
  try {
    const snap = await getDocs(query(collection(db, 'halls'), where('restaurantId', '==', restaurantId)));
    return snap.docs
      .map((d) => ({ ...(d.data() as Hall), id: d.id }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  } catch {
    return [];
  }
}

export function getHallTableNumbers(
  hall: Pick<Hall, 'tableCount' | 'tableNumbers'>
): string[] {
  if (Array.isArray(hall.tableNumbers) && hall.tableNumbers.length > 0) {
    const cleaned = hall.tableNumbers
      .map((t) => String(t).trim())
      .filter((t) => t.length > 0);
    if (cleaned.length > 0) return cleaned;
  }
  const count = Math.max(1, Math.min(200, Math.round(Number(hall.tableCount) || 1)));
  return Array.from({ length: count }, (_, idx) => String(idx + 1));
}

export async function saveHall(
  restaurantId: string,
  ownerId: string,
  data: {
    id?: string;
    name: string;
    name_en?: string;
    hallType?: string;
    tableCount: number;
    tableNumbers?: string[];
    sortOrder: number;
  }
): Promise<void> {
  const isNew = !data.id;
  const hallId = data.id || makeId('hall');
  const path = `halls/${hallId}`;
  const cleanName = data.name.trim().slice(0, 80);
  const cleanNameEn = (data.name_en || '').trim().slice(0, 80);
  const cleanHallType = (data.hallType || '').trim().slice(0, 60);
  const cleanTableNumbers = Array.isArray(data.tableNumbers)
    ? Array.from(
        new Set(
          data.tableNumbers
            .map((t) => String(t).trim().slice(0, 20))
            .filter((t) => t.length > 0)
        )
      ).slice(0, 200)
    : undefined;
  const safeTableCount = cleanTableNumbers && cleanTableNumbers.length > 0
    ? cleanTableNumbers.length
    : Math.max(1, Math.min(200, Math.round(Number(data.tableCount) || 1)));
  const safeSort = Math.max(0, Math.min(10000, Math.round(Number(data.sortOrder) || 0)));

  try {
    if (isNew) {
      const payload: Record<string, unknown> = {
        id: hallId,
        restaurantId,
        ownerId,
        name: cleanName,
        tableCount: safeTableCount,
        sortOrder: safeSort,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (cleanNameEn) payload.name_en = cleanNameEn;
      if (cleanHallType) payload.hallType = cleanHallType;
      if (cleanTableNumbers && cleanTableNumbers.length > 0) {
        payload.tableNumbers = cleanTableNumbers;
      }
      await setDoc(doc(db, 'halls', hallId), payload);
    } else {
      const updateData: Record<string, unknown> = {
        name: cleanName,
        name_en: cleanNameEn,
        hallType: cleanHallType,
        tableCount: safeTableCount,
        sortOrder: safeSort,
        updatedAt: serverTimestamp(),
      };
      if (cleanTableNumbers && cleanTableNumbers.length > 0) {
        updateData.tableNumbers = cleanTableNumbers;
      }
      await updateDoc(doc(db, 'halls', hallId), updateData);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteHall(hallId: string): Promise<void> {
  const path = `halls/${hallId}`;
  try {
    await deleteDoc(doc(db, 'halls', hallId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================
// Customer Loyalty, Birthdays & Personalization Subcollection
// ============================================================

export async function fetchCustomerProfile(
  restaurantId: string,
  rawPhone: string
): Promise<CustomerProfile | null> {
  const cleanPhone = normalizeCustomerPhone(rawPhone);
  if (cleanPhone.length < 6 || cleanPhone.length > 24) return null;
  const path = `restaurants/${restaurantId}/customers/${cleanPhone}`;
  try {
    const snap = await getDoc(doc(db, 'restaurants', restaurantId, 'customers', cleanPhone));
    if (!snap.exists()) return null;
    return { ...(snap.data() as CustomerProfile), id: snap.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function registerOrUpdateCustomerProfile(input: {
  restaurantId: string;
  ownerId: string;
  fullName: string;
  phone: string;
  birthDay: number;
  birthMonth: number;
  birthYear: number;
  preferredOrderType: OrderType;
  address?: string;
}): Promise<CustomerProfile> {
  const isEn = getActiveLang() === 'en';
  const cleanPhone = normalizeCustomerPhone(input.phone);
  if (cleanPhone.length < 6 || cleanPhone.length > 24) {
    throw new Error(
      isEn ? 'Please enter a valid phone number (6 to 24 digits).' : 'يرجى إدخال رقم هاتف صحيح (6 إلى 24 رقم)'
    );
  }
  const cleanName = input.fullName.trim().slice(0, 100);
  if (!cleanName) {
    throw new Error(isEn ? 'Please enter your full name.' : 'يرجى إدخال الاسم الكامل');
  }
  const safeDay = Math.max(1, Math.min(31, Math.round(Number(input.birthDay) || 1)));
  const safeMonth = Math.max(1, Math.min(12, Math.round(Number(input.birthMonth) || 1)));
  const safeYear = Math.max(1920, Math.min(2020, Math.round(Number(input.birthYear) || 1995)));
  const safeOrderType: OrderType =
    input.preferredOrderType === 'delivery' || input.preferredOrderType === 'pickup'
      ? input.preferredOrderType
      : 'dine_in';
  const cleanAddress = (input.address || '').trim().slice(0, 300);
  const path = `restaurants/${input.restaurantId}/customers/${cleanPhone}`;

  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'restaurants', input.restaurantId, 'customers', cleanPhone);
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        const createPayload: Record<string, unknown> = {
          id: cleanPhone,
          restaurantId: input.restaurantId,
          ownerId: input.ownerId,
          fullName: cleanName,
          phone: cleanPhone,
          birthDay: safeDay,
          birthMonth: safeMonth,
          birthYear: safeYear,
          preferredOrderType: safeOrderType,
          totalOrders: 0,
          loyaltyCycleOrders: 0,
          firstOrderDiscountUsed: false,
          favoriteItems: [],
          lastOrderItems: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (cleanAddress) {
          createPayload.address = cleanAddress;
        }
        tx.set(ref, createPayload);
      } else {
        tx.update(ref, {
          fullName: cleanName,
          birthDay: safeDay,
          birthMonth: safeMonth,
          birthYear: safeYear,
          preferredOrderType: safeOrderType,
          address: cleanAddress,
          updatedAt: serverTimestamp(),
        });
      }
    });

    const freshSnap = await getDoc(doc(db, 'restaurants', input.restaurantId, 'customers', cleanPhone));
    if (freshSnap.exists()) {
      return { ...(freshSnap.data() as CustomerProfile), id: freshSnap.id };
    }

    return {
      id: cleanPhone,
      restaurantId: input.restaurantId,
      ownerId: input.ownerId,
      fullName: cleanName,
      phone: cleanPhone,
      birthDay: safeDay,
      birthMonth: safeMonth,
      birthYear: safeYear,
      preferredOrderType: safeOrderType,
      ...(cleanAddress ? { address: cleanAddress } : {}),
      totalOrders: 0,
      loyaltyCycleOrders: 0,
      firstOrderDiscountUsed: false,
      favoriteItems: [],
      lastOrderItems: [],
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function recordCustomerOrderLoyalty(input: {
  restaurantId: string;
  phone: string;
  fullName?: string;
  preferredOrderType: OrderType;
  address?: string;
  orderedItems: OrderItemPayload[];
  itemMap?: Map<string, MenuItem>;
  punchCardTarget: number;
}): Promise<CustomerProfile | null> {
  const cleanPhone = normalizeCustomerPhone(input.phone);
  if (cleanPhone.length < 6 || cleanPhone.length > 24) return null;
  const path = `restaurants/${input.restaurantId}/customers/${cleanPhone}`;
  const safeTarget = Math.max(2, Math.min(20, Math.round(Number(input.punchCardTarget) || 5)));

  try {
    const updated = await runTransaction(db, async (tx) => {
      const ref = doc(db, 'restaurants', input.restaurantId, 'customers', cleanPhone);
      const snap = await tx.get(ref);
      if (!snap.exists()) return null;

      const existing = snap.data() as CustomerProfile;
      const nextTotalOrders = Math.min(100000, (Number(existing.totalOrders) || 0) + 1);
      const currentCycle = Math.max(0, Math.min(100, Number(existing.loyaltyCycleOrders) || 0));
      const nextCycleOrders = currentCycle >= safeTarget ? 1 : currentCycle + 1;
      const nextFavorites = mergeFavoriteItems(existing.favoriteItems || [], input.orderedItems);
      const nextLastOrder = buildLastOrderSnapshot(input.orderedItems, input.itemMap);

      const cleanName = input.fullName?.trim().slice(0, 100) || existing.fullName;
      const safeOrderType: OrderType =
        input.preferredOrderType === 'delivery' || input.preferredOrderType === 'pickup'
          ? input.preferredOrderType
          : 'dine_in';
      const cleanAddress =
        input.address !== undefined
          ? input.address.trim().slice(0, 300)
          : (existing.address || '').slice(0, 300);

      const updateFields: Record<string, unknown> = {
        fullName: cleanName,
        preferredOrderType: safeOrderType,
        address: cleanAddress,
        totalOrders: nextTotalOrders,
        loyaltyCycleOrders: nextCycleOrders,
        firstOrderDiscountUsed: true,
        lastVisitAt: serverTimestamp(),
        favoriteItems: nextFavorites,
        lastOrderItems: nextLastOrder,
        updatedAt: serverTimestamp(),
      };

      tx.update(ref, updateFields);

      return {
        ...existing,
        id: snap.id,
        fullName: cleanName,
        preferredOrderType: safeOrderType,
        address: cleanAddress,
        totalOrders: nextTotalOrders,
        loyaltyCycleOrders: nextCycleOrders,
        firstOrderDiscountUsed: true,
        lastVisitAt: Date.now(),
        favoriteItems: nextFavorites,
        lastOrderItems: nextLastOrder,
      } as CustomerProfile;
    });

    if (!updated) return null;
    try {
      const fresh = await getDoc(doc(db, 'restaurants', input.restaurantId, 'customers', cleanPhone));
      if (fresh.exists()) {
        return { ...(fresh.data() as CustomerProfile), id: fresh.id };
      }
    } catch {
      // Return optimistic snapshot computed in transaction
    }
    return updated;
  } catch (error) {
    console.warn('Customer loyalty sync warning:', error);
    return null;
  }
}

export function subscribeRestaurantCustomers(
  restaurantId: string,
  ownerId: string,
  onData: (customers: CustomerProfile[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `restaurants/${restaurantId}/customers`;
  const q = query(
    collection(db, 'restaurants', restaurantId, 'customers'),
    where('ownerId', '==', ownerId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as CustomerProfile), id: d.id }))
        .sort(
          (a, b) =>
            (getMillis(b.lastVisitAt) || getMillis(b.updatedAt)) -
            (getMillis(a.lastVisitAt) || getMillis(a.updatedAt))
        );
      onData(list);
    },
    (error) => {
      if (onError) {
        onError(
          error instanceof Error
            ? error
            : new Error(getActiveLang() === 'en' ? 'Failed to load customers' : 'تعذر تحميل بيانات العملاء')
        );
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  );
}



