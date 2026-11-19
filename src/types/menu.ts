export type BuiltinTheme =
  | 'theme-1'
  | 'theme-2'
  | 'theme-3'
  | 'theme-4'
  | 'theme-5'
  | 'theme-6'
  | 'theme-7'
  | 'theme-8'
  | 'theme-9'
  | 'theme-11';

export type ActiveTheme = BuiltinTheme | `custom_${string}`;

export interface CustomTheme {
  id: string;
  name: string;
  name_en?: string;
  description?: string;
  description_en?: string;
  previewImage?: string;
  htmlCode: string;
  cssCode: string;
  jsCode: string;
  isActive: boolean;
  createdAt?: unknown;
}

export interface ItemSize {
  name: string;
  name_en?: string;
  price: number;
}

export interface ItemAddon {
  name: string;
  name_en?: string;
  price: number;
}

export type MenuColorMode = 'auto' | 'light' | 'dark';
export type OfferAnimation = 'static' | 'marquee' | 'orbit' | 'bounce' | 'fade';
export type OfferPlacement = 'top' | 'above_grid' | 'below_grid' | 'floating';
export type PromoType = 'percent' | 'fixed' | 'free_delivery' | 'waive_service';
export type ItemBadge =
  | 'none'
  | 'best_seller'
  | 'trending_week'
  | 'chef_choice'
  | 'bogo'
  | 'new';
export type MenuSortMode = 'default' | 'best_selling' | 'chef_quality' | 'lowest_price';
export type PrepStation = 'kitchen' | 'bar' | 'pastry';
export type ItemPrepState = 'pending' | 'preparing' | 'ready' | 'served';

export interface MenuOffer {
  id: string;
  title: string;
  title_en?: string;
  subtitle?: string;
  subtitle_en?: string;
  badgeText?: string;
  badgeText_en?: string;
  isBogo?: boolean;
  promoCode?: string;
  placement: OfferPlacement;
  animation: OfferAnimation;
  bgColor?: string;
  textColor?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface PromoCode {
  id: string;
  code: string;
  type: PromoType;
  value: number;
  minOrder?: number;
  description?: string;
  description_en?: string;
  isActive: boolean;
}

export interface Restaurant {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  name_en?: string;
  tagline?: string;
  tagline_en?: string;
  whatsappNumber: string;
  logoUrl?: string;
  shareTitle?: string;
  shareTitle_en?: string;
  shareDescription?: string;
  shareDescription_en?: string;
  activeTheme: ActiveTheme;
  primaryColor: string;
  colorMode?: MenuColorMode;
  headingColor?: string;
  descriptionColor?: string;
  priceColor?: string;
  menuColumns?: 1 | 2 | 3;
  taxRate: number;
  serviceCharge: number;
  deliveryFee?: number;
  currency: string;
  isOpen: boolean;
  isSuspended?: boolean;
  offers?: MenuOffer[];
  promoCodes?: PromoCode[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt?: unknown;
}

export interface Category {
  id: string;
  restaurantId: string;
  ownerId: string;
  parentId?: string;
  name: string;
  name_en?: string;
  imageUrl?: string;
  station?: PrepStation;
  sortOrder: number;
  createdAt?: unknown;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  ownerId: string;
  categoryId: string;
  name: string;
  name_en?: string;
  description?: string;
  description_en?: string;
  basePrice: number;
  imageUrl?: string;
  calories?: number;
  isSpicy: boolean;
  isAvailable: boolean;
  ordersCount: number;
  sizes: ItemSize[];
  addons: ItemAddon[];
  badge?: ItemBadge;
  isBogo?: boolean;
  suggestedItemIds?: string[];
  station?: PrepStation;
  sortOrder: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CartItem {
  cartKey: string;
  menuItem: MenuItem;
  selectedSize?: ItemSize;
  selectedAddons: ItemAddon[];
  quantity: number;
  notes?: string;
  unitPrice: number;
  guestId?: string;
  guestName?: string;
  entryId?: string;
}

export type OrderType = 'dine_in' | 'delivery' | 'pickup';
export type OrderStatus = 'pending' | 'preparing' | 'completed' | 'cancelled';

export interface OrderItemPayload {
  menuItemId: string;
  name: string;
  sizeName?: string;
  addonNames: string[];
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string;
  guestName?: string;
  station?: PrepStation;
}

export interface GuestCheckSummary {
  guestName: string;
  guestId?: string;
  itemsCount: number;
  subtotal: number;
  serviceCharge: number;
  taxAmount: number;
  total: number;
}

export interface Order {
  id: string;
  restaurantId: string;
  ownerId: string;
  orderNumber: string;
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
  promoCode?: string;
  taxAmount: number;
  total: number;
  status: OrderStatus;
  itemProgress?: Record<string, ItemPrepState>;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TableSessionItem {
  entryId: string;
  guestId: string;
  guestName: string;
  cartKey: string;
  menuItemId: string;
  name: string;
  name_en?: string;
  selectedSizeName?: string;
  selectedSizeName_en?: string;
  selectedAddonNames: string[];
  selectedAddonNames_en?: string[];
  quantity: number;
  unitPrice: number;
  notes?: string;
  addedAt: number;
}

export interface TableSession {
  id: string;
  restaurantId: string;
  ownerId: string;
  hallName: string;
  tableNumber: string;
  status: 'active' | 'closed';
  guests: string[];
  items: TableSessionItem[];
  lastOrderNumber?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ServiceCallType =
  | 'call_waiter'
  | 'request_bill_cash'
  | 'request_bill_card'
  | 'cutlery_water';

export type ServiceCallStatus = 'pending' | 'acknowledged' | 'resolved';

export interface ServiceCall {
  id: string;
  restaurantId: string;
  ownerId: string;
  hallName: string;
  tableNumber: string;
  sessionId?: string;
  guestName: string;
  callType: ServiceCallType;
  status: ServiceCallStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Hall {
  id: string;
  restaurantId: string;
  ownerId: string;
  name: string;
  name_en?: string;
  tableCount: number;
  sortOrder: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ThemeMeta {
  id: ActiveTheme;
  number: number;
  name: string;
  shortName?: string;
  englishName: string;
  shortName_en?: string;
  description: string;
  description_en?: string;
  coverImage?: string;
  recommendedColor: string;
  bgPreview: string;
  cardPreview: string;
  textPreview: string;
  isDark: boolean;
  isFlagship?: boolean;
  badge?: string;
  badge_en?: string;
}

export interface LandingFeature {
  title: string;
  title_en?: string;
  description: string;
  description_en?: string;
}

export interface LandingPricingPlan {
  id: string;
  name: string;
  name_en?: string;
  price: string;
  period: string;
  period_en?: string;
  description: string;
  description_en?: string;
  features: string[];
  features_en?: string[];
  highlighted: boolean;
}

export interface PlatformLandingSettings {
  heroTitle: string;
  heroTitle_en?: string;
  heroSubtitle: string;
  heroSubtitle_en?: string;
  ctaButtonText: string;
  ctaButtonText_en?: string;
  features: LandingFeature[];
  pricingPlans: LandingPricingPlan[];
  supportWhatsapp: string;
  footerText: string;
  footerText_en?: string;
  platformLogoUrl?: string;
  shareTitle?: string;
  shareTitle_en?: string;
  shareDescription?: string;
  shareDescription_en?: string;
  updatedAt?: unknown;
}
