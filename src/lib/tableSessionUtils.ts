import {
  CartItem,
  GuestCheckSummary,
  MenuItem,
  Restaurant,
  TableSessionItem,
} from '../types/menu';

const GUEST_ID_STORAGE_KEY = 'sufra_guest_id_v1';
const GUEST_NAME_STORAGE_KEY = 'sufra_guest_name_v1';

export function normalizeHallName(raw?: string | null): string {
  if (!raw) return '';
  return raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export function normalizeTableNumber(raw?: string | null): string {
  if (!raw) return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, 20);
}

function fnv1aHex(input: string, seed = 0x811c9dc5): string {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function buildTableSessionId(hallName: string, tableNumber: string): string {
  const cleanHall = normalizeHallName(hallName).toLowerCase();
  const cleanTable = normalizeTableNumber(tableNumber).toLowerCase();
  if (!cleanTable) return '';
  const canonical = `${cleanHall}::${cleanTable}`;
  const h1 = fnv1aHex(canonical, 0x811c9dc5);
  const h2 = fnv1aHex(`${cleanTable}|${cleanHall}`, 0x9e3779b9);
  const safeTablePart = cleanTable
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 16);
  return safeTablePart ? `tbl_${safeTablePart}_${h1}${h2}` : `tbl_${h1}${h2}`;
}

export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return 'guest_ssr';
  try {
    const existing = window.localStorage.getItem(GUEST_ID_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{6,64}$/.test(existing)) {
      return existing;
    }
    const created = `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(GUEST_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return `g_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getSavedGuestName(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (window.localStorage.getItem(GUEST_NAME_STORAGE_KEY) || '').trim().slice(0, 60);
  } catch {
    return '';
  }
}

export function saveGuestName(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = name.trim().slice(0, 60);
    if (clean) {
      window.localStorage.setItem(GUEST_NAME_STORAGE_KEY, clean);
    } else {
      window.localStorage.removeItem(GUEST_NAME_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function cartItemToTableSessionItem(
  item: CartItem,
  guestId: string,
  guestName: string
): TableSessionItem {
  const safeGuestName = guestName.trim().slice(0, 60) || 'ضيف';
  const entryId =
    item.entryId || `${guestId}__${item.cartKey}`.replace(/[^a-zA-Z0-9_\-:.|]/g, '_').slice(0, 180);
  const payload: TableSessionItem = {
    entryId,
    guestId,
    guestName: safeGuestName,
    cartKey: item.cartKey,
    menuItemId: item.menuItem.id,
    name: item.menuItem.name.slice(0, 120),
    selectedAddonNames: item.selectedAddons.map((a) => a.name.slice(0, 60)),
    quantity: Math.max(1, Math.round(item.quantity)),
    unitPrice: Number(item.unitPrice.toFixed(2)),
    addedAt: Date.now(),
  };
  if (item.menuItem.name_en) {
    payload.name_en = item.menuItem.name_en.slice(0, 120);
  }
  if (item.selectedSize?.name) {
    payload.selectedSizeName = item.selectedSize.name.slice(0, 40);
  }
  if (item.selectedSize?.name_en) {
    payload.selectedSizeName_en = item.selectedSize.name_en.slice(0, 40);
  }
  if (item.selectedAddons.some((a) => a.name_en)) {
    payload.selectedAddonNames_en = item.selectedAddons.map((a) =>
      (a.name_en || a.name).slice(0, 60)
    );
  }
  if (item.notes?.trim()) {
    payload.notes = item.notes.trim().slice(0, 200);
  }
  return payload;
}

export function tableSessionItemsToCartItems(
  sessionItems: TableSessionItem[],
  allMenuItems: MenuItem[]
): CartItem[] {
  const byId = new Map<string, MenuItem>();
  allMenuItems.forEach((m) => byId.set(m.id, m));

  return (sessionItems || [])
    .filter((si) => si && si.quantity > 0)
    .map((si) => {
      const matched = byId.get(si.menuItemId);
      const fallbackMenuItem: MenuItem = matched || {
        id: si.menuItemId,
        restaurantId: '',
        ownerId: '',
        categoryId: '',
        name: si.name,
        name_en: si.name_en,
        basePrice: si.unitPrice,
        isSpicy: false,
        isAvailable: true,
        ordersCount: 0,
        sizes: [],
        addons: [],
        sortOrder: 0,
      };
      const selectedAddons = (si.selectedAddonNames || []).map((name, idx) => ({
        name,
        name_en: si.selectedAddonNames_en?.[idx],
        price: 0,
      }));
      return {
        cartKey: si.entryId || `${si.guestId}__${si.cartKey}`,
        entryId: si.entryId,
        menuItem: fallbackMenuItem,
        selectedSize: si.selectedSizeName
          ? {
              name: si.selectedSizeName,
              name_en: si.selectedSizeName_en,
              price: si.unitPrice,
            }
          : undefined,
        selectedAddons,
        quantity: si.quantity,
        notes: si.notes,
        unitPrice: si.unitPrice,
        guestId: si.guestId,
        guestName: si.guestName,
      };
    });
}

export interface GuestCheckGroup {
  summary: GuestCheckSummary;
  items: CartItem[];
}

export function computeSeparateChecks(
  cart: CartItem[],
  restaurant: Restaurant,
  fallbackGuestName: string,
  options?: { waiveService?: boolean; totalDiscount?: number }
): {
  groups: GuestCheckGroup[];
  combinedSubtotal: number;
  combinedServiceCharge: number;
  combinedTaxAmount: number;
  combinedTotal: number;
} {
  const groupedMap = new Map<string, { guestName: string; guestId?: string; items: CartItem[] }>();
  const defaultName = fallbackGuestName.trim() || 'ضيف';

  cart.forEach((item) => {
    const gName = (item.guestName || defaultName).trim();
    const key = gName.toLowerCase();
    const bucket = groupedMap.get(key);
    if (bucket) {
      bucket.items.push(item);
    } else {
      groupedMap.set(key, {
        guestName: gName,
        guestId: item.guestId,
        items: [item],
      });
    }
  });

  const combinedSubtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const servicePct = options?.waiveService ? 0 : restaurant.serviceCharge || 0;
  const taxPct = restaurant.taxRate || 0;
  const discountTotal = Math.max(0, options?.totalDiscount || 0);

  const groups: GuestCheckGroup[] = Array.from(groupedMap.values()).map((bucket) => {
    const sub = bucket.items.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
    const shareRatio = combinedSubtotal > 0 ? sub / combinedSubtotal : 0;
    const allocatedDiscount = discountTotal * shareRatio;
    const discountedSub = Math.max(0, sub - allocatedDiscount);
    const svc = (sub * servicePct) / 100;
    const tax = ((discountedSub + svc) * taxPct) / 100;
    const total = discountedSub + svc + tax;

    return {
      summary: {
        guestName: bucket.guestName,
        guestId: bucket.guestId,
        itemsCount: bucket.items.reduce((s, c) => s + c.quantity, 0),
        subtotal: Number(sub.toFixed(2)),
        serviceCharge: Number(svc.toFixed(2)),
        taxAmount: Number(tax.toFixed(2)),
        total: Number(total.toFixed(2)),
      },
      items: bucket.items,
    };
  });

  const combinedServiceCharge = groups.reduce((s, g) => s + g.summary.serviceCharge, 0);
  const combinedTaxAmount = groups.reduce((s, g) => s + g.summary.taxAmount, 0);
  const combinedTotal = groups.reduce((s, g) => s + g.summary.total, 0);

  return {
    groups,
    combinedSubtotal: Number(combinedSubtotal.toFixed(2)),
    combinedServiceCharge: Number(combinedServiceCharge.toFixed(2)),
    combinedTaxAmount: Number(combinedTaxAmount.toFixed(2)),
    combinedTotal: Number(combinedTotal.toFixed(2)),
  };
}
