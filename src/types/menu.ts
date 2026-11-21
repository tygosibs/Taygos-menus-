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
export type PrepStation = string;
export type ItemPrepState = 'pending' | 'preparing' | 'ready' | 'served';

export type StationIconName =
  | 'chef-hat'
  | 'flame'
  | 'wine'
  | 'croissant'
  | 'coffee'
  | 'fish'
  | 'pizza'
  | 'salad'
  | 'cup-soda'
  | 'wind'
  | 'utensils'
  | 'sparkles';

export interface RestaurantStation {
  id: string;
  stationId: string;
  restaurantId: string;
  ownerId: string;
  name: string;
  nameEn?: string;
  color: string;
  icon: StationIconName;
  isActive: boolean;
  sortOrder: number;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

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

export interface LoyaltyConfig {
  enabled: boolean;
  firstOrderEnabled?: boolean;
  promoBannerText?: string;
  promoBannerText_en?: string;
  firstOrderDiscountPercent: number;
  punchCardEnabled?: boolean;
  punchCardTarget: number;
  punchCardDiscountPercent?: number;
  punchCardRewardText?: string;
  punchCardRewardText_en?: string;
  birthdayOfferText?: string;
  birthdayOfferText_en?: string;
  birthdayDiscountPercent: number;
  birthdayWhatsappMessage?: string;
}

export interface CustomerFavoriteItem {
  menuItemId: string;
  name: string;
  name_en?: string;
  count: number;
  lastOrderedAt?: number;
}

export interface CustomerLastOrderItem {
  menuItemId: string;
  name: string;
  name_en?: string;
  sizeName?: string;
  addonNames?: string[];
  quantity: number;
  unitPrice: number;
}

export interface CustomerProfile {
  id: string;
  restaurantId: string;
  ownerId: string;
  fullName: string;
  phone: string;
  birthDay: number;
  birthMonth: number;
  birthYear: number;
  preferredOrderType: OrderType;
  address?: string;
  totalOrders: number;
  loyaltyCycleOrders: number;
  firstOrderDiscountUsed: boolean;
  lastVisitAt?: unknown;
  favoriteItems: CustomerFavoriteItem[];
  lastOrderItems: CustomerLastOrderItem[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ShiftSlotConfig {
  id: string;
  name: string;
  nameEn?: string;
  startTime: string;
  endTime: string;
}

export interface TableGridColors {
  empty: string;
  occupied: string;
  billRequested: string;
  overdue: string;
}

export interface ManagerPermissions {
  canEditMenu: boolean;
  canPauseItems: boolean;
  canEditOpenOrders: boolean;
  canCancelOpenOrders: boolean;
  canEditClosedChecks: boolean;
  canApplyInstantDiscount: boolean;
  canViewShiftReports: boolean;
  canEditDrawerFloat: boolean;
  canManageStaff: boolean;
  canConfigureOperations: boolean;
  canToggleScreenPrices: boolean;
}

export interface ShowPricesByRole {
  cashier: boolean;
  manager: boolean;
  kitchen: boolean;
  bar: boolean;
  pastry: boolean;
  captain: boolean;
}

export interface OperationsConfig {
  shiftSlots: ShiftSlotConfig[];
  defaultCashierFloat: number;
  tableOverdueMinutes: number;
  tableColors: TableGridColors;
  managerPermissions: ManagerPermissions;
  showPricesByRole: ShowPricesByRole;
}

export interface TreasuryState {
  managerCustodyBalance: number;
  ownerVaultCashBalance: number;
  ownerVaultVisaTotal: number;
  lastUpdatedByUid?: string;
  lastUpdatedByName?: string;
  updatedAt?: number;
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
  ownerBirthday?: string;
  appliedPlatformPromoCode?: string;
  appliedPlatformPromoSummary?: string;
  appliedPlatformPromoSummary_en?: string;
  offers?: MenuOffer[];
  promoCodes?: PromoCode[];
  loyaltyConfig?: LoyaltyConfig;
  operationsConfig?: OperationsConfig;
  treasuryState?: TreasuryState;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type PlatformPromoDiscountType = 'percent' | 'fixed' | 'free_month';

export interface PlatformPromoCode {
  id: string;
  code: string;
  discountType: PlatformPromoDiscountType;
  discountValue: number;
  description?: string;
  description_en?: string;
  isActive: boolean;
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
  stationId?: string;
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
  stationId?: string;
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
  stationId?: string;
  stationName?: string;
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

export type StaffRole = 'manager' | 'cashier' | 'kitchen' | 'bar' | 'pastry' | 'captain' | 'station_staff' | 'custom';

export type StaffScreen =
  | 'staff_management'
  | 'cashier'
  | 'kitchen'
  | 'bar'
  | 'pastry'
  | 'captain'
  | 'halls'
  | `station:${string}`;

export interface StaffActorInfo {
  uid: string;
  name: string;
  role: 'owner' | 'superadmin' | StaffRole;
}

export interface ItemProgressActorEntry {
  state: ItemPrepState;
  updatedByUid: string;
  updatedByName: string;
  updatedByRole?: string;
  station?: PrepStation;
  stationId?: string;
  updatedAt: number;
}

export type OrderPaymentMethod = 'cash' | 'visa' | 'split';

export interface OrderAdjustmentEntry {
  at: number;
  actorUid: string;
  actorName: string;
  actorRole: string;
  action: 'items_modified' | 'discount_applied' | 'notes_updated' | 'order_cancelled' | 'superadmin_unlocked';
  reason: string;
  details?: string;
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
  tableNotes?: string;
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
  status: OrderStatus;
  shiftId?: string;
  paymentMethod?: OrderPaymentMethod;
  cashPaidAmount?: number;
  visaPaidAmount?: number;
  customerCashTendered?: number;
  changeReturned?: number;
  drawerVariance?: number;
  cancelReason?: string;
  adjustmentHistory?: OrderAdjustmentEntry[];
  closedAt?: unknown;
  superAdminUnlocked?: boolean;
  superAdminUnlockedBy?: string;
  itemProgress?: Record<string, ItemPrepState>;
  itemProgressBy?: Record<string, ItemProgressActorEntry>;
  createdByUid?: string;
  createdByName?: string;
  createdByRole?: string;
  lastUpdatedByUid?: string;
  lastUpdatedByName?: string;
  lastUpdatedByRole?: string;
  closedByUid?: string;
  closedByName?: string;
  closedByRole?: string;
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
  handledByUid?: string;
  handledByName?: string;
  handledByRole?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type SuspensionType = 'timed' | 'indefinite' | '';

export interface StaffMember {
  uid: string;
  restaurantId: string;
  ownerId: string;
  name: string;
  username: string;
  phone: string;
  email: string;
  authEmail: string;
  jobTitle?: string;
  role: StaffRole;
  allowedScreens: StaffScreen[];
  allowedStations?: string[];
  defaultScreen: StaffScreen;
  defaultStationId?: string;
  hallId?: string;
  hallName?: string;
  isActive: boolean;
  mustChangePassword: boolean;
  suspendedType?: SuspensionType;
  suspendedUntil?: unknown;
  suspendedReason?: string;
  suspendedByRole?: 'owner' | 'manager' | '';
  suspendedByName?: string;
  activeInviteHash?: string;
  createdBy: string;
  lastLoginAt?: unknown;
  passwordChangedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StaffInvite {
  id: string;
  staffId: string;
  restaurantId: string;
  ownerId: string;
  restaurantSlug: string;
  restaurantName: string;
  restaurantName_en?: string;
  tokenHash: string;
  authEmail: string;
  staffName: string;
  staffUsername: string;
  staffPhone: string;
  staffEmail?: string;
  staffRole: StaffRole;
  staffJobTitle?: string;
  staffHallId?: string;
  staffHallName?: string;
  allowedScreens: StaffScreen[];
  allowedStations?: string[];
  defaultScreen: StaffScreen;
  defaultStationId?: string;
  expiresAt: unknown;
  usedAt?: unknown;
  usedByUid?: string;
  revokedAt?: unknown;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StaffAccess {
  uid: string;
  restaurantId: string;
  ownerId: string;
  role: StaffRole;
  allowedScreens: StaffScreen[];
  allowedStations?: string[];
  defaultScreen: StaffScreen;
  defaultStationId?: string;
  hallId?: string;
  isActive: boolean;
  mustChangePassword: boolean;
  suspendedType?: SuspensionType;
  suspendedUntil?: unknown;
  updatedAt?: unknown;
}

export interface StaffDevice {
  id: string;
  restaurantId: string;
  ownerId: string;
  staffId: string;
  staffName: string;
  fcmToken: string;
  deviceName: string;
  platform: string;
  activeStations: string[];
  topics: string[];
  isActive: boolean;
  lastSeenAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type StaffShiftStatus = 'active' | 'completed';
export type HandoverStatus =
  | 'none'
  | 'handed_to_cashier'
  | 'handed_to_manager'
  | 'handed_to_owner'
  | 'self_continued';

export interface StaffShift {
  id: string;
  restaurantId: string;
  ownerId: string;
  staffId: string;
  staffName: string;
  stationId: string;
  stationName: string;
  hallId?: string;
  shiftSlotId?: string;
  shiftSlotName?: string;
  status: StaffShiftStatus;
  ordersHandled: number;
  itemsMarkedReady: number;
  serviceCallsHandled: number;
  openingFloat?: number;
  carriedOverCash?: number;
  carriedFromShiftId?: string;
  cashSales?: number;
  visaSales?: number;
  drawerExpensesTotal?: number;
  drawerVarianceTotal?: number;
  expectedCashHandover?: number;
  handedOverToUid?: string;
  handedOverToName?: string;
  handedOverToRole?: 'cashier' | 'manager' | 'owner' | '';
  handoverNote?: string;
  handoverOpenTables?: string[];
  handoverStatus?: HandoverStatus;
  extendedHours?: number;
  superAdminUnlocked?: boolean;
  startedAt?: unknown;
  endedAt?: unknown;
  updatedAt?: unknown;
}

export interface DrawerExpense {
  id: string;
  restaurantId: string;
  ownerId: string;
  shiftId: string;
  cashierUid: string;
  cashierName: string;
  amount: number;
  description: string;
  note?: string;
  createdAt?: unknown;
}

export interface TreasuryTransfer {
  id: string;
  restaurantId: string;
  ownerId: string;
  fromType: 'cashier_shift' | 'manager_custody' | 'owner_adjustment';
  toType: 'cashier_shift' | 'manager_custody' | 'owner_vault';
  fromUid: string;
  fromName: string;
  toUid?: string;
  toName: string;
  shiftId?: string;
  amountCash: number;
  amountVisa?: number;
  note?: string;
  createdAt?: unknown;
}

export type StaffAuditEventType =
  | 'staff_created'
  | 'staff_updated'
  | 'staff_deleted'
  | 'staff_suspended'
  | 'staff_unsuspended'
  | 'staff_promoted'
  | 'invite_created'
  | 'invite_used'
  | 'password_changed'
  | 'staff_login'
  | 'order_created'
  | 'order_status_updated'
  | 'order_modified'
  | 'order_cancelled'
  | 'instant_discount_applied'
  | 'kds_item_updated'
  | 'menu_item_paused'
  | 'table_closed'
  | 'service_call_handled'
  | 'station_created'
  | 'station_updated'
  | 'station_deleted'
  | 'shift_started'
  | 'shift_ended'
  | 'drawer_expense_added'
  | 'cash_handover_recorded'
  | 'treasury_transferred'
  | 'float_adjusted'
  | 'superadmin_shift_unlocked'
  | 'station_uncovered_alert'
  | 'domain_verified';

export interface StaffAuditLog {
  id: string;
  restaurantId: string;
  ownerId: string;
  eventType: StaffAuditEventType;
  actorUid: string;
  actorName: string;
  actorRole: string;
  targetUid?: string;
  targetName?: string;
  screen?: string;
  details?: string;
  inviteHash?: string;
  createdAt?: unknown;
}

export interface Hall {
  id: string;
  restaurantId: string;
  ownerId: string;
  name: string;
  name_en?: string;
  hallType?: string;
  tableCount: number;
  tableNumbers?: string[];
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

export type LandingSectionId =
  | 'hero'
  | 'themes'
  | 'features'
  | 'operations'
  | 'loyalty'
  | 'pricing'
  | 'tygos_promo';

export interface LandingSectionConfig {
  id: LandingSectionId;
  isVisible: boolean;
}

export interface LandingFeature {
  title: string;
  title_en?: string;
  description: string;
  description_en?: string;
  isVisible?: boolean;
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
  isVisible?: boolean;
}

export interface PlatformLandingSettings {
  sections?: LandingSectionConfig[];
  heroBadge?: string;
  heroBadge_en?: string;
  heroTitle: string;
  heroTitle_en?: string;
  heroSubtitle: string;
  heroSubtitle_en?: string;
  ctaButtonText: string;
  ctaButtonText_en?: string;
  heroSecondaryBtnText?: string;
  heroSecondaryBtnText_en?: string;
  themesTitle?: string;
  themesTitle_en?: string;
  themesSubtitle?: string;
  themesSubtitle_en?: string;
  featuresTitle?: string;
  featuresTitle_en?: string;
  featuresSubtitle?: string;
  featuresSubtitle_en?: string;
  features: LandingFeature[];
  operationsBadge?: string;
  operationsBadge_en?: string;
  operationsTitle?: string;
  operationsTitle_en?: string;
  operationsSubtitle?: string;
  operationsSubtitle_en?: string;
  operationsBullets?: string[];
  operationsBullets_en?: string[];
  loyaltyBadge?: string;
  loyaltyBadge_en?: string;
  loyaltyTitle?: string;
  loyaltyTitle_en?: string;
  loyaltySubtitle?: string;
  loyaltySubtitle_en?: string;
  loyaltyBullets?: string[];
  loyaltyBullets_en?: string[];
  pricingTitle?: string;
  pricingTitle_en?: string;
  pricingSubtitle?: string;
  pricingSubtitle_en?: string;
  pricingCtaText?: string;
  pricingCtaText_en?: string;
  pricingPlans: LandingPricingPlan[];
  tygosBadge?: string;
  tygosBadge_en?: string;
  tygosTitle?: string;
  tygosTitle_en?: string;
  tygosSubtitle?: string;
  tygosSubtitle_en?: string;
  tygosCtaText?: string;
  tygosCtaText_en?: string;
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
