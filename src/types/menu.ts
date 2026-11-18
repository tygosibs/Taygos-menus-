export type BuiltinTheme =
  | 'theme-1'
  | 'theme-2'
  | 'theme-3'
  | 'theme-4'
  | 'theme-5'
  | 'theme-6'
  | 'theme-7'
  | 'theme-8'
  | 'theme-9';

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
  activeTheme: ActiveTheme;
  primaryColor: string;
  taxRate: number;
  serviceCharge: number;
  currency: string;
  isOpen: boolean;
  isSuspended?: boolean;
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
  name: string;
  name_en?: string;
  imageUrl?: string;
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
}

export interface Order {
  id: string;
  restaurantId: string;
  ownerId: string;
  orderNumber: string;
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
  status: OrderStatus;
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
  updatedAt?: unknown;
}
