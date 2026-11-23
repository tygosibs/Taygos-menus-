import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Gift,
  Info,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Send,
  ShoppingBag,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  buildLastOrderSnapshot,
  getCustomerLoyaltyDiscount,
  getResolvedLoyaltyConfig,
  mergeFavoriteItems,
  normalizeCustomerPhone,
  saveCustomerPhone,
  saveDemoCustomerProfile,
} from '../../lib/customerLoyaltyUtils';
import { recordCustomerOrderLoyalty, submitPublicOrder } from '../../lib/firestoreService';
import { getDefaultFallbackStationId, resolveMenuItemStations, StationMeta } from '../../lib/stationUtils';
import { computeSeparateChecks } from '../../lib/tableSessionUtils';
import {
  CartItem,
  Category,
  CustomerProfile,
  LoyaltyConfig,
  MenuItem,
  OrderItemPayload,
  OrderType,
  PromoCode,
  Restaurant,
} from '../../types/menu';
import { SafeImage } from '../SafeImage';

interface CartDrawerProps {
  open: boolean;
  restaurant: Restaurant;
  cart: CartItem[];
  categories?: Category[];
  stations?: StationMeta[];
  allItems?: MenuItem[];
  isDemoMode: boolean;
  prefillPromoCode?: string | null;
  customerProfile?: CustomerProfile | null;
  loyaltyConfig?: Required<LoyaltyConfig>;
  onCustomerUpdated?: (customer: CustomerProfile) => void;
  onOpenLoyaltyModal?: () => void;
  hallName?: string;
  tableNumber?: string;
  sessionId?: string;
  guestName?: string;
  activeGuests?: string[];
  onRequestGuestOrTable?: () => void;
  onTableOrderSubmitted?: (orderNumber: string) => Promise<void> | void;
  onClose: () => void;
  onUpdateQty: (cartKey: string, delta: number) => void;
  onRemoveItem: (cartKey: string) => void;
  onClearCart: () => void;
  onQuickAddItem?: (item: MenuItem) => void;
}

interface CartDraftState {
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  tableNumber: string;
  deliveryAddress: string;
  notes: string;
  appliedPromoCode: string;
}

function normalizeWhatsappNumber(raw: string): string {
  let digits = (raw || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('01')) {
    digits = `2${digits}`;
  } else if (digits.length === 10 && digits.startsWith('05')) {
    digits = `966${digits.slice(1)}`;
  }
  return digits;
}

function readDraft(slug: string, initialTable: string): CartDraftState {
  const fallback: CartDraftState = {
    customerName: '',
    customerPhone: '',
    orderType: 'dine_in',
    tableNumber: initialTable,
    deliveryAddress: '',
    notes: '',
    appliedPromoCode: '',
  };
  if (typeof window === 'undefined' || !slug) return fallback;
  try {
    const raw = window.localStorage.getItem(`sufra_draft_v1_${slug}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<CartDraftState>;
    return {
      customerName: typeof parsed.customerName === 'string' ? parsed.customerName : '',
      customerPhone: typeof parsed.customerPhone === 'string' ? parsed.customerPhone : '',
      orderType:
        parsed.orderType === 'delivery' || parsed.orderType === 'pickup'
          ? parsed.orderType
          : 'dine_in',
      tableNumber:
        initialTable || (typeof parsed.tableNumber === 'string' ? parsed.tableNumber : ''),
      deliveryAddress: typeof parsed.deliveryAddress === 'string' ? parsed.deliveryAddress : '',
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      appliedPromoCode:
        typeof parsed.appliedPromoCode === 'string' ? parsed.appliedPromoCode : '',
    };
  } catch {
    return fallback;
  }
}

export function CartDrawer({
  open,
  restaurant,
  cart,
  categories,
  allItems,
  stations = [],
  isDemoMode,
  prefillPromoCode,
  customerProfile = null,
  loyaltyConfig,
  onCustomerUpdated,
  onOpenLoyaltyModal,
  hallName = '',
  tableNumber: activeTableNumber = '',
  sessionId = '',
  guestName = '',
  activeGuests = [],
  onRequestGuestOrTable,
  onTableOrderSubmitted,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onQuickAddItem,
}: CartDrawerProps) {
  const { lang, dir, isRtl, t, loc, formatCurrency } = useLanguage();
  const initialTable =
    activeTableNumber ||
    (typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('table') || ''
      : '');

  const draft = useMemo(
    () => readDraft(restaurant.slug, initialTable),
    [restaurant.slug, initialTable]
  );

  const [customerName, setCustomerName] = useState(draft.customerName);
  const [customerPhone, setCustomerPhone] = useState(draft.customerPhone);
  const [orderType, setOrderType] = useState<OrderType>(draft.orderType);
  const [tableNumber, setTableNumber] = useState(draft.tableNumber);
  const [deliveryAddress, setDeliveryAddress] = useState(draft.deliveryAddress);
  const [notes, setNotes] = useState(draft.notes);

  const [promoInput, setPromoInput] = useState(draft.appliedPromoCode);
  const [appliedPromoCode, setAppliedPromoCode] = useState(draft.appliedPromoCode);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [addedSugId, setAddedSugId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<'name' | 'phone' | 'address' | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<{
    orderNumber: string;
    whatsappMessage: string;
    whatsappLaunched: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const addressInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCustomerName(draft.customerName || customerProfile?.fullName || guestName || '');
    setCustomerPhone(draft.customerPhone || customerProfile?.phone || '');
    setOrderType(
      activeTableNumber
        ? 'dine_in'
        : draft.customerName
          ? draft.orderType
          : customerProfile?.preferredOrderType || draft.orderType
    );
    setTableNumber(activeTableNumber || draft.tableNumber);
    setDeliveryAddress(draft.deliveryAddress || customerProfile?.address || '');
    setNotes(draft.notes);
    setAppliedPromoCode(draft.appliedPromoCode);
    setPromoInput(draft.appliedPromoCode);
  }, [draft, activeTableNumber, guestName, customerProfile]);

  useEffect(() => {
    if (typeof window === 'undefined' || !restaurant.slug) return;
    try {
      const payload: CartDraftState = {
        customerName,
        customerPhone,
        orderType,
        tableNumber,
        deliveryAddress,
        notes,
        appliedPromoCode,
      };
      window.localStorage.setItem(`sufra_draft_v1_${restaurant.slug}`, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    restaurant.slug,
    customerName,
    customerPhone,
    orderType,
    tableNumber,
    deliveryAddress,
    notes,
    appliedPromoCode,
  ]);

  useEffect(() => {
    if (!prefillPromoCode) return;
    const clean = prefillPromoCode.trim().toUpperCase();
    if (!clean) return;
    setPromoInput(clean);
    const match = (restaurant.promoCodes || []).find(
      (p) => p.isActive && p.code.toUpperCase() === clean
    );
    if (match) {
      setAppliedPromoCode(match.code.toUpperCase());
      setPromoError(null);
    }
  }, [prefillPromoCode, restaurant.promoCodes]);

  useEffect(() => {
    if (cart.length > 0 && confirmedOrder) {
      setConfirmedOrder(null);
    }
  }, [cart.length, confirmedOrder]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirmedOrder(null);
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart]
  );

  const activePromoList = useMemo(
    () => (restaurant.promoCodes || []).filter((p) => p.isActive),
    [restaurant.promoCodes]
  );

  const matchedPromo: PromoCode | null = useMemo(() => {
    if (!appliedPromoCode) return null;
    const clean = appliedPromoCode.trim().toUpperCase();
    return activePromoList.find((p) => p.code.toUpperCase() === clean) || null;
  }, [activePromoList, appliedPromoCode]);

  const promoEligible = useMemo(() => {
    if (!matchedPromo) return false;
    if (matchedPromo.minOrder && subtotal < matchedPromo.minOrder) return false;
    return true;
  }, [matchedPromo, subtotal]);

  const resolvedLoyaltyConfig = useMemo(
    () => loyaltyConfig || getResolvedLoyaltyConfig(restaurant),
    [loyaltyConfig, restaurant]
  );

  const loyaltyDiscount = useMemo(
    () => getCustomerLoyaltyDiscount(customerProfile, resolvedLoyaltyConfig),
    [customerProfile, resolvedLoyaltyConfig]
  );

  const promoDiscountAmount = useMemo(() => {
    if (!matchedPromo || !promoEligible) return 0;
    if (matchedPromo.type === 'percent') {
      return Math.min(subtotal, (subtotal * (matchedPromo.value || 0)) / 100);
    }
    if (matchedPromo.type === 'fixed') {
      return Math.min(subtotal, Math.max(0, matchedPromo.value || 0));
    }
    return 0;
  }, [matchedPromo, promoEligible, subtotal]);

  const loyaltyDiscountAmount = useMemo(() => {
    if (loyaltyDiscount.percent <= 0) return 0;
    const remaining = Math.max(0, subtotal - promoDiscountAmount);
    return Math.min(remaining, (subtotal * loyaltyDiscount.percent) / 100);
  }, [loyaltyDiscount.percent, subtotal, promoDiscountAmount]);

  const discountAmount = Math.min(subtotal, promoDiscountAmount + loyaltyDiscountAmount);

  const serviceCharge = useMemo(() => {
    if (matchedPromo && promoEligible && matchedPromo.type === 'waive_service') {
      return 0;
    }
    return (subtotal * (restaurant.serviceCharge || 0)) / 100;
  }, [matchedPromo, promoEligible, subtotal, restaurant.serviceCharge]);

  const rawDeliveryFee = orderType === 'delivery' ? Math.max(0, restaurant.deliveryFee || 0) : 0;
  const deliveryFee =
    matchedPromo && promoEligible && matchedPromo.type === 'free_delivery' ? 0 : rawDeliveryFee;

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  const taxAmount = useMemo(
    () => ((discountedSubtotal + serviceCharge) * (restaurant.taxRate || 0)) / 100,
    [discountedSubtotal, serviceCharge, restaurant.taxRate]
  );

  const total = discountedSubtotal + serviceCharge + taxAmount + deliveryFee;
  const displayCurrency = formatCurrency(restaurant.currency);

  const isGroupTableMode = Boolean(
    orderType === 'dine_in' && (activeTableNumber || sessionId)
  );

  const separateChecks = useMemo(
    () =>
      computeSeparateChecks(cart, restaurant, guestName || customerName || (lang === 'en' ? 'Guest' : 'ضيف'), {
        waiveService: Boolean(matchedPromo && promoEligible && matchedPromo.type === 'waive_service'),
        totalDiscount: discountAmount,
      }),
    [cart, restaurant, guestName, customerName, lang, matchedPromo, promoEligible, discountAmount]
  );

  const formatPrice = (val: number) => `${val.toFixed(2).replace(/\.00$/, '')} ${displayCurrency}`;

  const suggestedInCart = useMemo(() => {
    if (!allItems || allItems.length === 0 || cart.length === 0) return [];
    const inCartIds = new Set(cart.map((c) => c.menuItem.id));
    const wantedIds: string[] = [];
    cart.forEach((c) => {
      (c.menuItem.suggestedItemIds || []).forEach((id) => {
        if (!inCartIds.has(id) && !wantedIds.includes(id)) {
          wantedIds.push(id);
        }
      });
    });
    const matched = wantedIds
      .map((id) => allItems.find((i) => i.isAvailable && i.id === id))
      .filter((x): x is MenuItem => Boolean(x));
    return matched.slice(0, 4);
  }, [allItems, cart]);

  const handleApplyPromo = (codeOverride?: string) => {
    const clean = (codeOverride ?? promoInput).trim().toUpperCase();
    if (!clean) {
      setPromoError(lang === 'en' ? 'Enter a promo code first.' : 'اكتب كود الخصم أولاً.');
      return;
    }
    const found = activePromoList.find((p) => p.code.toUpperCase() === clean);
    if (!found) {
      setPromoError(
        lang === 'en' ? 'Invalid or expired promo code.' : 'كود الخصم غير صحيح أو منتهي.'
      );
      return;
    }
    setPromoInput(found.code.toUpperCase());
    setAppliedPromoCode(found.code.toUpperCase());
    if (found.minOrder && subtotal < found.minOrder) {
      setPromoError(
        lang === 'en'
          ? `Requires minimum order of ${formatPrice(found.minOrder)}`
          : `يتطلب حد أدنى للطلب ${formatPrice(found.minOrder)}`
      );
    } else {
      setPromoError(null);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromoCode('');
    setPromoInput('');
    setPromoError(null);
  };

  const handleClearWithDraftReset = () => {
    onClearCart();
    setAppliedPromoCode('');
    setPromoInput('');
    setPromoError(null);
    if (typeof window !== 'undefined' && restaurant.slug) {
      try {
        window.localStorage.removeItem(`sufra_cart_v1_${restaurant.slug}`);
      } catch {
        // ignore
      }
    }
  };

  const categoryMap = useMemo(
    () => new Map((categories || []).map((c) => [c.id, c])),
    [categories]
  );

  const stationMap = useMemo(
    () => new Map((stations || []).map((s) => [s.stationId, s])),
    [stations]
  );

  const fallbackStationId = useMemo(
    () => getDefaultFallbackStationId(stations),
    [stations]
  );

  const buildOrderItems = (): OrderItemPayload[] =>
    cart.map((c) => {
      const stationIds = resolveMenuItemStations(c.menuItem, categoryMap, fallbackStationId);
      const resolvedStation = stationIds[0] || fallbackStationId;
      const stMeta = stationMap.get(resolvedStation);
      const stationNames = stationIds
        .map((id) => stationMap.get(id)?.shortLabel)
        .filter((s): s is string => Boolean(s));
      const payload: OrderItemPayload = {
        menuItemId: c.menuItem.id,
        name: loc(c.menuItem.name, c.menuItem.name_en),
        addonNames: c.selectedAddons.map((a) => loc(a.name, a.name_en)),
        quantity: c.quantity,
        unitPrice: Number(c.unitPrice.toFixed(2)),
        lineTotal: Number((c.unitPrice * c.quantity).toFixed(2)),
        station: resolvedStation,
        stationId: resolvedStation,
        stationIds,
        ...(stationNames.length > 0
          ? { stationName: stationNames.join(' + ') }
          : stMeta?.shortLabel
            ? { stationName: stMeta.shortLabel }
            : {}),
      };
      if (c.selectedSize?.name) {
        payload.sizeName = loc(c.selectedSize.name, c.selectedSize.name_en);
      }
      if (c.notes) payload.notes = c.notes;
      if (c.guestName || guestName) {
        payload.guestName = (c.guestName || guestName).trim().slice(0, 60);
      }
      return payload;
    });

  const buildWhatsappInvoice = (orderNumber: string): string => {
    const restName = loc(restaurant.name, restaurant.name_en);
    const effectiveCustomerName =
      customerName.trim() ||
      guestName.trim() ||
      (activeGuests.length > 0 ? activeGuests.join(lang === 'en' ? ', ' : '، ') : '') ||
      (lang === 'en' ? 'Guest' : 'ضيف');
    const safePhone = customerPhone.trim() || '-';

    if (lang === 'en') {
      const typeLabel =
        orderType === 'dine_in'
          ? `Dine-In${hallName ? ` (${hallName})` : ''}${tableNumber.trim() ? ` (Table: ${tableNumber.trim()})` : ''}`
          : orderType === 'delivery'
            ? `Delivery (${deliveryAddress.trim() || 'N/A'})`
            : 'Pickup';

      const itemLines = isGroupTableMode
        ? separateChecks.groups.flatMap((group) => [
            `*${group.summary.guestName}'s Check (${formatPrice(group.summary.total)}):*`,
            ...group.items.map((c, idx) => {
              const sizeTxt = c.selectedSize
                ? ` (${loc(c.selectedSize.name, c.selectedSize.name_en)})`
                : '';
              const addonTxt =
                c.selectedAddons.length > 0
                  ? `\n   + Add-ons: ${c.selectedAddons.map((a) => loc(a.name, a.name_en)).join(', ')}`
                  : '';
              const noteTxt = c.notes ? `\n   * Note: ${c.notes}` : '';
              return `  ${idx + 1}. ${loc(c.menuItem.name, c.menuItem.name_en)}${sizeTxt} × ${
                c.quantity
              } = ${formatPrice(c.unitPrice * c.quantity)}${addonTxt}${noteTxt}`;
            }),
          ])
        : cart.map((c, idx) => {
            const sizeTxt = c.selectedSize
              ? ` (${loc(c.selectedSize.name, c.selectedSize.name_en)})`
              : '';
            const addonTxt =
              c.selectedAddons.length > 0
                ? `\n   + Add-ons: ${c.selectedAddons.map((a) => loc(a.name, a.name_en)).join(', ')}`
                : '';
            const noteTxt = c.notes ? `\n   * Note: ${c.notes}` : '';
            return `${idx + 1}. ${loc(c.menuItem.name, c.menuItem.name_en)}${sizeTxt} × ${
              c.quantity
            } = ${formatPrice(c.unitPrice * c.quantity)}${addonTxt}${noteTxt}`;
          });

      const lines = [
        `*New Order from ${restName}*`,
        `Order #: ${orderNumber}`,
        `Order Type: ${typeLabel}`,
        `Customer: ${effectiveCustomerName}`,
        ...(safePhone !== '-' ? [`Phone: ${safePhone}`] : []),
        `----------------`,
        ...itemLines,
        `----------------`,
        `Subtotal: ${formatPrice(subtotal)}`,
      ];

      if (promoDiscountAmount > 0 && matchedPromo) {
        lines.push(`Promo (${matchedPromo.code}): -${formatPrice(promoDiscountAmount)}`);
      }
      if (loyaltyDiscountAmount > 0) {
        const loyaltyLabelEn =
          loyaltyDiscount.reason === 'birthday'
            ? `Birthday Treat (${loyaltyDiscount.percent}%)`
            : loyaltyDiscount.reason === 'punch_card'
              ? `Loyalty Punch Reward (${loyaltyDiscount.percent}%)`
              : `1st Order Welcome (${loyaltyDiscount.percent}%)`;
        lines.push(`${loyaltyLabelEn}: -${formatPrice(loyaltyDiscountAmount)}`);
      }
      if (serviceCharge > 0) {
        lines.push(`Service Charge (${restaurant.serviceCharge}%): ${formatPrice(serviceCharge)}`);
      }
      if (orderType === 'delivery' && rawDeliveryFee > 0) {
        lines.push(
          deliveryFee === 0
            ? `Delivery Fee: FREE (${matchedPromo?.code})`
            : `Delivery Fee: ${formatPrice(deliveryFee)}`
        );
      }
      if (taxAmount > 0) {
        lines.push(`Tax (${restaurant.taxRate}%): ${formatPrice(taxAmount)}`);
      }
      lines.push(`*Grand Total: ${formatPrice(total)}*`);
      if (notes.trim()) {
        lines.push(`Order Notes: ${notes.trim()}`);
      }
      return lines.join('\n');
    }

    const typeLabel =
      orderType === 'dine_in'
        ? `صالة${hallName ? ` (${hallName})` : ''}${tableNumber.trim() ? ` (طاولة: ${tableNumber.trim()})` : ''}`
        : orderType === 'delivery'
          ? `توصيل (${deliveryAddress.trim() || 'غير محدد'})`
          : 'استلام من الفرع';

    const itemLines = isGroupTableMode
      ? separateChecks.groups.flatMap((group) => [
          `*حساب ${group.summary.guestName} (${formatPrice(group.summary.total)}):*`,
          ...group.items.map((c, idx) => {
            const sizeTxt = c.selectedSize
              ? ` (${loc(c.selectedSize.name, c.selectedSize.name_en)})`
              : '';
            const addonTxt =
              c.selectedAddons.length > 0
                ? `\n   + إضافات: ${c.selectedAddons.map((a) => loc(a.name, a.name_en)).join('، ')}`
                : '';
            const noteTxt = c.notes ? `\n   * ملاحظة: ${c.notes}` : '';
            return `  ${idx + 1}. ${loc(c.menuItem.name, c.menuItem.name_en)}${sizeTxt} × ${
              c.quantity
            } = ${formatPrice(c.unitPrice * c.quantity)}${addonTxt}${noteTxt}`;
          }),
        ])
      : cart.map((c, idx) => {
          const sizeTxt = c.selectedSize
            ? ` (${loc(c.selectedSize.name, c.selectedSize.name_en)})`
            : '';
          const addonTxt =
            c.selectedAddons.length > 0
              ? `\n   + إضافات: ${c.selectedAddons.map((a) => loc(a.name, a.name_en)).join('، ')}`
              : '';
          const noteTxt = c.notes ? `\n   * ملاحظة: ${c.notes}` : '';
          return `${idx + 1}. ${loc(c.menuItem.name, c.menuItem.name_en)}${sizeTxt} × ${
            c.quantity
          } = ${formatPrice(c.unitPrice * c.quantity)}${addonTxt}${noteTxt}`;
        });

    const lines = [
      `*طلب جديد من ${restName}*`,
      `رقم الطلب: ${orderNumber}`,
      `نوع الطلب: ${typeLabel}`,
      `العميل: ${effectiveCustomerName}`,
      ...(safePhone !== '-' ? [`الجوال: ${safePhone}`] : []),
      `----------------`,
      ...itemLines,
      `----------------`,
      `المجموع الفرعي: ${formatPrice(subtotal)}`,
    ];

    if (promoDiscountAmount > 0 && matchedPromo) {
      lines.push(`خصم (${matchedPromo.code}): -${formatPrice(promoDiscountAmount)}`);
    }
    if (loyaltyDiscountAmount > 0) {
      const loyaltyLabelAr =
        loyaltyDiscount.reason === 'birthday'
          ? `خصم عيد الميلاد (${loyaltyDiscount.percent}%)`
          : loyaltyDiscount.reason === 'punch_card'
            ? `مكافأة بطاقة الولاء (${loyaltyDiscount.percent}%)`
            : `خصم أول طلب (${loyaltyDiscount.percent}%)`;
      lines.push(`${loyaltyLabelAr}: -${formatPrice(loyaltyDiscountAmount)}`);
    }
    if (serviceCharge > 0) {
      lines.push(`رسوم الخدمة (${restaurant.serviceCharge}%): ${formatPrice(serviceCharge)}`);
    }
    if (orderType === 'delivery' && rawDeliveryFee > 0) {
      lines.push(
        deliveryFee === 0
          ? `رسوم التوصيل: مجاناً (${matchedPromo?.code})`
          : `رسوم التوصيل: ${formatPrice(deliveryFee)}`
      );
    }
    if (taxAmount > 0) {
      lines.push(`الضريبة (${restaurant.taxRate}%): ${formatPrice(taxAmount)}`);
    }
    lines.push(`*الإجمالي النهائي: ${formatPrice(total)}*`);
    if (notes.trim()) {
      lines.push(`ملاحظات عامة: ${notes.trim()}`);
    }
    return lines.join('\n');
  };

  const validateForm = (): boolean => {
    setInvalidField(null);
    if (!restaurant.isOpen) {
      setErrorMsg(t.menu.closedBanner);
      return false;
    }
    const resolvedName = customerName.trim() || guestName.trim();
    if (!resolvedName) {
      setInvalidField('name');
      setErrorMsg(
        lang === 'en'
          ? 'Please enter your name above before sending the order.'
          : 'يرجى كتابة اسمك في الحقل أعلاه قبل إرسال الطلب.'
      );
      nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      nameInputRef.current?.focus();
      return false;
    }
    if (orderType !== 'dine_in' && customerPhone.trim().length < 5) {
      setInvalidField('phone');
      setErrorMsg(
        lang === 'en'
          ? 'Please enter a valid mobile number (at least 5 digits).'
          : 'يرجى كتابة رقم جوال صحيح (5 أرقام على الأقل) قبل الإرسال.'
      );
      phoneInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      phoneInputRef.current?.focus();
      return false;
    }
    if (orderType === 'delivery' && !deliveryAddress.trim()) {
      setInvalidField('address');
      setErrorMsg(t.menu.errMissingAddress);
      addressInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      addressInputRef.current?.focus();
      return false;
    }
    setErrorMsg(null);
    return true;
  };

  const submitAndPrepareOrder = async (launchWhatsapp: boolean) => {
    if (cart.length === 0 || submitting) return;
    if (!validateForm()) return;

    const resolvedName =
      isGroupTableMode && separateChecks.groups.length > 1
        ? separateChecks.groups.map((g) => g.summary.guestName).join(lang === 'en' ? ', ' : '، ')
        : customerName.trim() || guestName.trim() || (lang === 'en' ? 'Guest' : 'ضيف');

    setSubmitting(true);
    setErrorMsg(null);
    try {
      let orderNumber = `DEMO-${Math.floor(1000 + Math.random() * 9000)}`;
      const orderedItems = buildOrderItems();
      const promoLabel =
        matchedPromo && promoEligible
          ? matchedPromo.code
          : loyaltyDiscountAmount > 0
            ? loyaltyDiscount.reason === 'birthday'
              ? 'BIRTHDAY'
              : loyaltyDiscount.reason === 'punch_card'
                ? 'LOYALTY'
                : 'WELCOME'
            : undefined;

      if (!isDemoMode) {
        const res = await submitPublicOrder({
          restaurantId: restaurant.id,
          ownerId: restaurant.ownerId,
          customerName: resolvedName,
          customerPhone: customerPhone.trim(),
          orderType,
          hallName: orderType === 'dine_in' && hallName.trim() ? hallName.trim() : undefined,
          tableNumber:
            orderType === 'dine_in' && tableNumber.trim() ? tableNumber.trim() : undefined,
          sessionId: isGroupTableMode && sessionId ? sessionId : undefined,
          isGroupOrder: isGroupTableMode,
          guestChecks: isGroupTableMode ? separateChecks.groups.map((g) => g.summary) : undefined,
          deliveryAddress:
            orderType === 'delivery' && deliveryAddress.trim()
              ? deliveryAddress.trim()
              : undefined,
          notes: notes.trim() || undefined,
          items: orderedItems,
          subtotal,
          serviceCharge,
          deliveryFee: deliveryFee > 0 ? deliveryFee : undefined,
          discountAmount: discountAmount > 0 ? discountAmount : undefined,
          promoCode: promoLabel,
          taxAmount,
          total,
        });
        orderNumber = res.orderNumber;
      }

      // Sync customer loyalty stats (visits, punch card, favorites, last order) if registered
      const syncPhone = normalizeCustomerPhone(customerPhone) || customerProfile?.phone || '';
      if (syncPhone.length >= 6) {
        const itemMap = new Map((allItems || []).map((i) => [i.id, i]));
        if (!isDemoMode) {
          const synced = await recordCustomerOrderLoyalty({
            restaurantId: restaurant.id,
            phone: syncPhone,
            fullName: customerName.trim() || customerProfile?.fullName,
            preferredOrderType: orderType,
            address: orderType === 'delivery' ? deliveryAddress.trim() : undefined,
            orderedItems,
            itemMap,
            punchCardTarget: resolvedLoyaltyConfig.punchCardTarget,
          });
          if (synced) {
            saveCustomerPhone(restaurant.slug, synced.phone);
            onCustomerUpdated?.(synced);
          }
        } else if (customerProfile && syncPhone === customerProfile.phone) {
          const currentCycle = Math.max(0, customerProfile.loyaltyCycleOrders || 0);
          const nextCycle =
            currentCycle >= resolvedLoyaltyConfig.punchCardTarget ? 1 : currentCycle + 1;
          const updatedDemo: CustomerProfile = {
            ...customerProfile,
            fullName: customerName.trim() || customerProfile.fullName,
            preferredOrderType: orderType,
            address:
              orderType === 'delivery' && deliveryAddress.trim()
                ? deliveryAddress.trim()
                : customerProfile.address,
            totalOrders: (customerProfile.totalOrders || 0) + 1,
            loyaltyCycleOrders: nextCycle,
            firstOrderDiscountUsed: true,
            lastVisitAt: Date.now(),
            favoriteItems: mergeFavoriteItems(customerProfile.favoriteItems || [], orderedItems),
            lastOrderItems: buildLastOrderSnapshot(orderedItems, itemMap),
            updatedAt: Date.now(),
          };
          saveDemoCustomerProfile(restaurant.slug, updatedDemo);
          saveCustomerPhone(restaurant.slug, updatedDemo.phone);
          onCustomerUpdated?.(updatedDemo);
        }
      }

      const whatsappMessage = buildWhatsappInvoice(orderNumber);
      const targetPhone = normalizeWhatsappNumber(restaurant.whatsappNumber);

      if (launchWhatsapp && targetPhone) {
        const url = `https://wa.me/${targetPhone}?text=${encodeURIComponent(whatsappMessage)}`;
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setConfirmedOrder({
        orderNumber,
        whatsappMessage,
        whatsappLaunched: launchWhatsapp,
      });
      setAppliedPromoCode('');
      setPromoInput('');
      setNotes('');
      if (isGroupTableMode && onTableOrderSubmitted) {
        await onTableOrderSubmitted(orderNumber);
      } else {
        onClearCart();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.menu.errOrderFailed);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const cleanWhatsapp = normalizeWhatsappNumber(restaurant.whatsappNumber);
  const activeMessage =
    confirmedOrder?.whatsappMessage || buildWhatsappInvoice(lang === 'en' ? 'DRAFT' : 'مسودة');
  const whatsappHref = cleanWhatsapp
    ? `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(activeMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(activeMessage)}`;

  const handleCopyInvoice = async () => {
    try {
      await navigator.clipboard.writeText(activeMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleCloseDrawer = () => {
    if (confirmedOrder) {
      setConfirmedOrder(null);
    }
    setErrorMsg(null);
    setInvalidField(null);
    onClose();
  };

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={handleCloseDrawer}
      role="dialog"
      aria-modal="true"
      aria-label={t.menu.cartTitle}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white text-stone-900 h-full flex flex-col shadow-2xl overflow-x-clip"
      >
        <div className="px-4 sm:px-5 py-3.5 border-b border-stone-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={handleCloseDrawer}
              aria-label={lang === 'en' ? 'Back to menu' : 'رجوع للمنيو'}
              className="w-10 h-10 rounded-xl hover:bg-stone-100 flex items-center justify-center text-stone-600 cursor-pointer shrink-0 sm:hidden"
            >
              {isRtl ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </button>
            <ShoppingBag className="w-5 h-5 shrink-0" style={{ color: restaurant.primaryColor }} />
            <h2 className="text-base sm:text-lg font-bold truncate">{t.menu.cartTitle}</h2>
            {cart.length > 0 && (
              <span className="text-xs text-stone-500 font-mono-num shrink-0">
                ({cart.reduce((s, c) => s + c.quantity, 0)} {t.menu.itemsCountLabel})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {cart.length > 0 && !confirmedOrder && (
              <button
                type="button"
                onClick={handleClearWithDraftReset}
                title={t.menu.clearCart}
                className="px-2.5 h-9 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.menu.clearCart}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCloseDrawer}
              aria-label={lang === 'en' ? 'Close cart' : 'إغلاق السلة'}
              className="w-11 h-11 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-clip p-4 sm:p-5 space-y-5">
          {isDemoMode && !confirmedOrder && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <p className="font-bold">
                  {lang === 'en' ? 'Demo Preview Mode' : 'وضع المعاينة التجريبي'}
                </p>
                <p className="text-amber-800 leading-relaxed">
                  {lang === 'en'
                    ? 'Orders placed here simulate the experience. To receive real orders in your Kitchen Dashboard, open your own restaurant link (/menu/your-slug).'
                    : 'الطلبات هنا للمعاينة فقط. لاستقبال الطلبات في لوحة مطبخ مطعمك فعلياً، اطلب من رابط منيو مطعمك الخاص.'}
                </p>
              </div>
            </div>
          )}

          {confirmedOrder ? (
            <div className="space-y-5 py-2">
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-base">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{t.menu.orderSuccessTitle}</span>
                </div>
                <p className="text-sm text-emerald-800">
                  {t.menu.orderNumberLabel}:{' '}
                  <span className="font-mono-num font-bold">{confirmedOrder.orderNumber}</span>
                  {isDemoMode && (lang === 'en' ? ' (Demo Preview)' : ' (وضع المعاينة التجريبي)')}
                </p>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  {isDemoMode
                    ? lang === 'en'
                      ? 'In live restaurant menus, this order arrives instantly with an audio chime inside the Owner Kitchen Dashboard.'
                      : 'في منيو مطعمك الفعلي، يظهر هذا الطلب فوراً مع تنبيه صوتي في لوحة تحكم المطبخ.'
                    : t.menu.orderSuccessDesc}
                </p>
              </div>

              <div className="space-y-2.5">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>
                    {confirmedOrder.whatsappLaunched
                      ? lang === 'en'
                        ? 'Open WhatsApp Chat Now'
                        : 'فتح محادثة الواتساب لإرسال الفاتورة الآن'
                      : t.menu.openWhatsappAgain}
                  </span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyInvoice}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-stone-300 text-stone-700 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>
                    {copied
                      ? lang === 'en'
                        ? 'Invoice copied'
                        : 'تم نسخ نص الفاتورة'
                      : lang === 'en'
                        ? 'Copy invoice text'
                        : 'نسخ نص الفاتورة'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-stone-900 text-white font-bold text-xs hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  {t.menu.newOrderBtn}
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold text-stone-800">
                  {lang === 'en' ? 'Formatted Order Summary:' : 'ملخص الفاتورة المنسقة:'}
                </p>
                <pre className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-700 whitespace-pre-wrap leading-relaxed font-sans">
                  {confirmedOrder.whatsappMessage}
                </pre>
              </div>
            </div>
          ) : cart.length === 0 ? (
            <div className="py-16 text-center space-y-4 text-stone-500">
              <ShoppingBag className="w-10 h-10 mx-auto opacity-30" />
              <div className="space-y-1">
                <p className="text-base font-semibold text-stone-700">{t.menu.cartEmptyTitle}</p>
                <p className="text-sm">{t.menu.cartEmptyDesc}</p>
              </div>
              <button
                type="button"
                onClick={handleCloseDrawer}
                className="px-5 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 cursor-pointer"
              >
                {lang === 'en' ? 'Back to Menu' : 'العودة للمنيو'}
              </button>
            </div>
          ) : (
            <>
              {isGroupTableMode && (
                <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-amber-950 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span className="truncate">
                        {lang === 'en' ? 'Live Group Table' : 'سلة جماعية حية'} ·{' '}
                        {hallName ? `${hallName} · ` : ''}
                        {lang === 'en' ? `Table ${activeTableNumber}` : `ترابيزة ${activeTableNumber}`}
                      </span>
                    </div>
                    {onRequestGuestOrTable && (
                      <button
                        type="button"
                        onClick={onRequestGuestOrTable}
                        className="px-2 py-1 rounded-lg bg-white border border-amber-200 text-[11px] font-bold text-amber-900 hover:bg-amber-100 flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{guestName || (lang === 'en' ? 'Set Name' : 'تغيير الاسم')}</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-800">
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {lang === 'en'
                        ? `Separate Check active (${separateChecks.groups.length} ${separateChecks.groups.length === 1 ? 'person' : 'people'})`
                        : `تقسيم الحساب بالاسم مفعّل (${separateChecks.groups.length} ${separateChecks.groups.length === 1 ? 'فرد' : 'أفراد'})`}
                    </span>
                  </div>
                </div>
              )}

              {isGroupTableMode ? (
                <div className="space-y-4">
                  {separateChecks.groups.map((group) => {
                    const isCurrentGuest =
                      guestName &&
                      group.summary.guestName.trim().toLowerCase() === guestName.trim().toLowerCase();
                    return (
                      <div
                        key={group.summary.guestName}
                        className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-2xs"
                      >
                        <div className="px-3.5 py-2.5 bg-stone-100/90 border-b border-stone-200 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              style={{ backgroundColor: restaurant.primaryColor }}
                              className="w-6 h-6 rounded-full text-white text-xs font-extrabold flex items-center justify-center shrink-0"
                            >
                              {group.summary.guestName.charAt(0)}
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-stone-950 truncate">
                              {group.summary.guestName}
                            </span>
                            {isCurrentGuest && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold shrink-0">
                                {lang === 'en' ? 'You' : 'أنت'}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-extrabold font-mono-num text-stone-900 shrink-0">
                            {lang === 'en'
                              ? `${group.summary.guestName}: ${formatPrice(group.summary.total)}`
                              : `حساب ${group.summary.guestName}: ${formatPrice(group.summary.total)}`}
                          </span>
                        </div>

                        <div className="p-3 space-y-2.5">
                          {group.items.map((c) => {
                            const itemName = loc(c.menuItem.name, c.menuItem.name_en);
                            const sizeLabel = c.selectedSize
                              ? loc(c.selectedSize.name, c.selectedSize.name_en)
                              : '';
                            const addonsLabel = c.selectedAddons
                              .map((a) => loc(a.name, a.name_en))
                              .join(lang === 'en' ? ', ' : '، ');
                            return (
                              <div
                                key={c.cartKey}
                                className="p-2.5 rounded-xl border border-stone-100 bg-stone-50/70 flex gap-2.5"
                              >
                                <SafeImage
                                  src={c.menuItem.imageUrl}
                                  alt={itemName}
                                  className="w-14 h-14 rounded-lg object-cover shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <h3 className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                                      {itemName}
                                    </h3>
                                    <button
                                      type="button"
                                      onClick={() => onRemoveItem(c.cartKey)}
                                      aria-label={lang === 'en' ? 'Remove item' : 'حذف الصنف'}
                                      className="p-1 text-stone-400 hover:text-red-600 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  {(sizeLabel || addonsLabel) && (
                                    <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-2">
                                      {sizeLabel}
                                      {sizeLabel && addonsLabel ? ' · ' : ''}
                                      {addonsLabel}
                                    </p>
                                  )}
                                  {c.notes && (
                                    <p className="text-[11px] text-amber-700 mt-0.5">
                                      {lang === 'en' ? `Note: ${c.notes}` : `ملاحظة: ${c.notes}`}
                                    </p>
                                  )}
                                  <div className="mt-2 flex items-center justify-between">
                                    <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg px-1 py-0.5">
                                      <button
                                        type="button"
                                        onClick={() => onUpdateQty(c.cartKey, -1)}
                                        aria-label={lang === 'en' ? 'Decrease' : 'تقليل'}
                                        className="w-6 h-6 flex items-center justify-center text-stone-700 hover:bg-stone-100 rounded cursor-pointer"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </button>
                                      <span className="w-5 text-center font-mono-num text-xs font-bold">
                                        {c.quantity}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => onUpdateQty(c.cartKey, 1)}
                                        aria-label={lang === 'en' ? 'Increase' : 'زيادة'}
                                        className="w-6 h-6 flex items-center justify-center text-stone-700 hover:bg-stone-100 rounded cursor-pointer"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <span className="font-mono-num text-xs sm:text-sm font-bold text-stone-900">
                                      {formatPrice(c.unitPrice * c.quantity)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {(group.summary.serviceCharge > 0 || group.summary.taxAmount > 0) && (
                            <div className="pt-1.5 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
                              <span>
                                {lang === 'en' ? 'Items:' : 'الأصناف:'}{' '}
                                <span className="font-mono-num">{formatPrice(group.summary.subtotal)}</span>
                                {group.summary.serviceCharge > 0 &&
                                  ` + ${lang === 'en' ? 'Svc' : 'خدمة'} ${formatPrice(group.summary.serviceCharge)}`}
                                {group.summary.taxAmount > 0 &&
                                  ` + ${lang === 'en' ? 'Tax' : 'ضريبة'} ${formatPrice(group.summary.taxAmount)}`}
                              </span>
                              <span className="font-bold text-stone-900 font-mono-num">
                                {formatPrice(group.summary.total)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((c) => {
                    const itemName = loc(c.menuItem.name, c.menuItem.name_en);
                    const sizeLabel = c.selectedSize
                      ? loc(c.selectedSize.name, c.selectedSize.name_en)
                      : '';
                    const addonsLabel = c.selectedAddons
                      .map((a) => loc(a.name, a.name_en))
                      .join(lang === 'en' ? ', ' : '، ');
                    return (
                      <div
                        key={c.cartKey}
                        className="p-3 rounded-xl border border-stone-200 bg-stone-50/60 flex gap-3"
                      >
                        <SafeImage
                          src={c.menuItem.imageUrl}
                          alt={itemName}
                          className="w-16 h-16 rounded-lg object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold text-stone-900 truncate">{itemName}</h3>
                            <button
                              type="button"
                              onClick={() => onRemoveItem(c.cartKey)}
                              aria-label={lang === 'en' ? 'Remove item' : 'حذف الصنف'}
                              className="p-1 text-stone-400 hover:text-red-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {(sizeLabel || addonsLabel) && (
                            <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                              {sizeLabel}
                              {sizeLabel && addonsLabel ? ' · ' : ''}
                              {addonsLabel}
                            </p>
                          )}
                          {c.notes && (
                            <p className="text-[11px] text-amber-700 mt-0.5">
                              {lang === 'en' ? `Note: ${c.notes}` : `ملاحظة: ${c.notes}`}
                            </p>
                          )}
                          <div className="mt-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg px-1.5 py-0.5">
                              <button
                                type="button"
                                onClick={() => onUpdateQty(c.cartKey, -1)}
                                aria-label={lang === 'en' ? 'Decrease' : 'تقليل'}
                                className="w-7 h-7 flex items-center justify-center text-stone-700 hover:bg-stone-100 rounded cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-5 text-center font-mono-num text-xs font-bold">
                                {c.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateQty(c.cartKey, 1)}
                                aria-label={lang === 'en' ? 'Increase' : 'زيادة'}
                                className="w-7 h-7 flex items-center justify-center text-stone-700 hover:bg-stone-100 rounded cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="font-mono-num text-sm font-bold text-stone-900">
                              {formatPrice(c.unitPrice * c.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {suggestedInCart.length > 0 && onQuickAddItem && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-extrabold text-stone-800">{t.menu.pairingsHeading}</p>
                  <div className="flex items-stretch gap-2 overflow-x-auto no-scrollbar pb-1">
                    {suggestedInCart.map((sug) => {
                      const sugName = loc(sug.name, sug.name_en);
                      const justAdded = addedSugId === sug.id;
                      return (
                        <div
                          key={sug.id}
                          className="w-40 shrink-0 rounded-xl border border-stone-200 bg-stone-50 p-2 flex items-center gap-2"
                        >
                          <SafeImage
                            src={sug.imageUrl}
                            alt={sugName}
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-stone-900 truncate">
                              {sugName}
                            </p>
                            <p className="text-[11px] font-mono-num text-stone-600">
                              {formatPrice(sug.basePrice)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onQuickAddItem(sug);
                              setAddedSugId(sug.id);
                              setTimeout(
                                () => setAddedSugId((p) => (p === sug.id ? null : p)),
                                1200
                              );
                            }}
                            style={!justAdded ? { backgroundColor: restaurant.primaryColor } : undefined}
                            aria-label={sugName}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 cursor-pointer ${
                              justAdded ? 'bg-emerald-600' : 'hover:opacity-90'
                            }`}
                          >
                            {justAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                <label className="block text-sm font-bold">{t.menu.orderTypeLabel}</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-stone-100">
                  {[
                    { id: 'dine_in' as OrderType, label: t.menu.dineIn },
                    { id: 'delivery' as OrderType, label: t.menu.delivery },
                    { id: 'pickup' as OrderType, label: t.menu.pickup },
                  ].map((opt) => {
                    const active = orderType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setOrderType(opt.id);
                          setErrorMsg(null);
                          setInvalidField(null);
                        }}
                        style={active ? { backgroundColor: restaurant.primaryColor } : undefined}
                        className={`min-h-[40px] py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          active ? 'text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                {orderType === 'dine_in' && !activeTableNumber && onRequestGuestOrTable && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-amber-950">
                      {lang === 'en'
                        ? 'Activate Group Table Cart & Separate Check?'
                        : 'تفعيل السلة الجماعية وتقسيم الحساب بالاسم؟'}
                    </span>
                    <button
                      type="button"
                      onClick={onRequestGuestOrTable}
                      style={{ backgroundColor: restaurant.primaryColor }}
                      className="px-2.5 py-1.5 rounded-lg text-white font-bold shrink-0 cursor-pointer"
                    >
                      {lang === 'en' ? 'Set Table & Name' : 'تحديد الترابيزة'}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      {t.menu.customerName}
                    </label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (invalidField === 'name') {
                          setInvalidField(null);
                          setErrorMsg(null);
                        }
                      }}
                      placeholder={t.menu.customerNamePlaceholder}
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none ${
                        invalidField === 'name'
                          ? 'border-red-500 ring-2 ring-red-100'
                          : 'border-stone-200 focus:border-stone-400'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      {orderType === 'dine_in'
                        ? lang === 'en'
                          ? 'Phone (optional)'
                          : 'رقم الجوال (اختياري للصالة)'
                        : t.menu.customerPhone}
                    </label>
                    <input
                      ref={phoneInputRef}
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(e.target.value);
                        if (invalidField === 'phone') {
                          setInvalidField(null);
                          setErrorMsg(null);
                        }
                      }}
                      placeholder={t.menu.customerPhonePlaceholder}
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm font-mono-num focus:outline-none ${
                        invalidField === 'phone'
                          ? 'border-red-500 ring-2 ring-red-100'
                          : 'border-stone-200 focus:border-stone-400'
                      }`}
                    />
                  </div>
                </div>

                {orderType === 'dine_in' && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      {lang === 'en' ? 'Table Number (optional)' : 'رقم الطاولة (اختياري)'}
                    </label>
                    <input
                      type="text"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder={lang === 'en' ? 'e.g. 7' : 'مثال: 7'}
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-400"
                    />
                  </div>
                )}

                {orderType === 'delivery' && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      {t.menu.deliveryAddress}
                    </label>
                    <input
                      ref={addressInputRef}
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => {
                        setDeliveryAddress(e.target.value);
                        if (invalidField === 'address') {
                          setInvalidField(null);
                          setErrorMsg(null);
                        }
                      }}
                      placeholder={t.menu.deliveryAddressPlaceholder}
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none ${
                        invalidField === 'address'
                          ? 'border-red-500 ring-2 ring-red-100'
                          : 'border-stone-200 focus:border-stone-400'
                      }`}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    {t.menu.orderNotes}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t.menu.orderNotesPlaceholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-400"
                  />
                </div>
              </div>

              {/* Promo Code Box */}
              {activePromoList.length > 0 && (
                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/70 space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <input
                      type="text"
                      dir="ltr"
                      value={promoInput}
                      onChange={(e) => {
                        setPromoInput(e.target.value.toUpperCase());
                        setPromoError(null);
                      }}
                      placeholder={t.menu.promoPlaceholder}
                      className="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-white border border-stone-200 text-xs font-mono-num font-bold uppercase focus:outline-none focus:border-stone-400"
                    />
                    {matchedPromo ? (
                      <button
                        type="button"
                        onClick={handleRemovePromo}
                        className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-bold cursor-pointer shrink-0"
                      >
                        {t.menu.removePromo}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleApplyPromo()}
                        className="px-3.5 py-2 rounded-lg bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 cursor-pointer shrink-0"
                      >
                        {t.menu.applyPromo}
                      </button>
                    )}
                  </div>

                  {!matchedPromo && (
                    <div className="flex flex-wrap gap-1.5">
                      {activePromoList.slice(0, 3).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleApplyPromo(p.code)}
                          className="px-2 py-1 rounded-md bg-white border border-stone-200 text-[11px] font-mono-num font-bold text-stone-700 hover:border-stone-400 cursor-pointer"
                        >
                          {p.code}
                        </button>
                      ))}
                    </div>
                  )}

                  {matchedPromo && promoEligible && (
                    <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {loc(matchedPromo.description, matchedPromo.description_en) ||
                          (lang === 'en'
                            ? `Code ${matchedPromo.code} applied!`
                            : `تم تفعيل كود ${matchedPromo.code}`)}
                      </span>
                    </p>
                  )}

                  {matchedPromo && !promoEligible && matchedPromo.minOrder && (
                    <p className="text-[11px] font-bold text-amber-700">
                      {lang === 'en'
                        ? `Add ${formatPrice(matchedPromo.minOrder - subtotal)} more to use ${matchedPromo.code}`
                        : `أضف ${formatPrice(matchedPromo.minOrder - subtotal)} لتفعيل كود ${matchedPromo.code}`}
                    </p>
                  )}

                  {promoError && <p className="text-[11px] font-bold text-red-600">{promoError}</p>}
                </div>
              )}

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-sm">
                {isGroupTableMode && separateChecks.groups.length > 0 && (
                  <div className="pb-2.5 mb-2 border-b border-stone-200 space-y-1.5">
                    <p className="text-xs font-extrabold text-stone-800">
                      {lang === 'en' ? 'Separate Check Breakdown' : 'تقسيم الفاتورة بالاسم'}
                    </p>
                    {separateChecks.groups.map((g) => (
                      <div
                        key={`sum_${g.summary.guestName}`}
                        className="flex items-center justify-between text-xs text-stone-700"
                      >
                        <span className="font-bold">
                          {lang === 'en'
                            ? `${g.summary.guestName} (${g.summary.itemsCount})`
                            : `حساب ${g.summary.guestName} (${g.summary.itemsCount})`}
                        </span>
                        <span className="font-mono-num font-extrabold text-stone-900">
                          {formatPrice(g.summary.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-stone-600">
                  <span>{t.menu.subtotal}</span>
                  <span className="font-mono-num">{formatPrice(subtotal)}</span>
                </div>
                {promoDiscountAmount > 0 && (
                  <div className="flex items-center justify-between text-emerald-700 font-bold">
                    <span>
                      {t.menu.discountLabel} ({matchedPromo?.code})
                    </span>
                    <span className="font-mono-num">-{formatPrice(promoDiscountAmount)}</span>
                  </div>
                )}
                {loyaltyDiscountAmount > 0 && (
                  <div className="flex items-center justify-between text-emerald-700 font-bold">
                    <span>
                      {loyaltyDiscount.reason === 'birthday'
                        ? lang === 'en'
                          ? `Birthday Discount (${loyaltyDiscount.percent}%)`
                          : `خصم عيد الميلاد (${loyaltyDiscount.percent}%)`
                        : loyaltyDiscount.reason === 'punch_card'
                          ? lang === 'en'
                            ? `Loyalty Punch Reward (${loyaltyDiscount.percent}%)`
                            : `مكافأة بطاقة الولاء (${loyaltyDiscount.percent}%)`
                          : lang === 'en'
                            ? `First Order Welcome (${loyaltyDiscount.percent}%)`
                            : `خصم العضوية الترحيبي (${loyaltyDiscount.percent}%)`}
                    </span>
                    <span className="font-mono-num">-{formatPrice(loyaltyDiscountAmount)}</span>
                  </div>
                )}
                {resolvedLoyaltyConfig.enabled &&
                  !customerProfile &&
                  resolvedLoyaltyConfig.firstOrderEnabled &&
                  resolvedLoyaltyConfig.firstOrderDiscountPercent > 0 &&
                  onOpenLoyaltyModal && (
                    <button
                      type="button"
                      onClick={onOpenLoyaltyModal}
                      className="w-full py-2 px-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 text-xs font-bold flex items-center justify-between gap-2 hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5 text-start">
                        <Gift className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>
                          {lang === 'en'
                            ? `Register now for ${resolvedLoyaltyConfig.firstOrderDiscountPercent}% off!`
                            : `سجّل رقمك واحصل على خصم ${resolvedLoyaltyConfig.firstOrderDiscountPercent}% الآن`}
                        </span>
                      </span>
                      <span className="underline shrink-0">
                        {lang === 'en' ? 'Join' : 'سجّل'}
                      </span>
                    </button>
                  )}
                {restaurant.serviceCharge > 0 && (
                  <div className="flex items-center justify-between text-stone-600">
                    <span>
                      {t.menu.serviceCharge} ({restaurant.serviceCharge}%)
                    </span>
                    <span className="font-mono-num">
                      {serviceCharge === 0 && matchedPromo?.type === 'waive_service'
                        ? lang === 'en'
                          ? 'FREE'
                          : 'مجاناً'
                        : formatPrice(serviceCharge)}
                    </span>
                  </div>
                )}
                {orderType === 'delivery' && rawDeliveryFee > 0 && (
                  <div className="flex items-center justify-between text-stone-600">
                    <span>{t.menu.deliveryFeeLabel}</span>
                    <span className="font-mono-num">
                      {deliveryFee === 0 ? (lang === 'en' ? 'FREE' : 'مجاناً') : formatPrice(deliveryFee)}
                    </span>
                  </div>
                )}
                {restaurant.taxRate > 0 && (
                  <div className="flex items-center justify-between text-stone-600">
                    <span>
                      {t.menu.tax} ({restaurant.taxRate}%)
                    </span>
                    <span className="font-mono-num">{formatPrice(taxAmount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-stone-200 flex items-center justify-between font-bold text-base text-stone-900">
                  <span>
                    {isGroupTableMode
                      ? lang === 'en'
                        ? 'Combined Table Total'
                        : 'الإجمالي المجمع للترابيزة'
                      : t.menu.grandTotal}
                  </span>
                  <span className="font-mono-num">{formatPrice(total)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {!confirmedOrder && cart.length > 0 && (
          <div className="p-4 border-t border-stone-200 bg-white space-y-2.5 shrink-0">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-bold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={() => submitAndPrepareOrder(false)}
              style={{ backgroundColor: restaurant.primaryColor }}
              className="w-full min-h-[48px] py-3 px-4 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-60 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                {submitting ? t.menu.sendingBtn : `${t.menu.sendDirectBtn} (${formatPrice(total)})`}
              </span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => submitAndPrepareOrder(true)}
              className="w-full min-h-[46px] py-3 px-4 rounded-xl border border-emerald-600 text-emerald-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{t.menu.sendWhatsappBtn}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
