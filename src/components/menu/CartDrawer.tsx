import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Info,
  MessageCircle,
  Minus,
  Plus,
  Send,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { submitPublicOrder } from '../../lib/firestoreService';
import { CartItem, OrderItemPayload, OrderType, Restaurant } from '../../types/menu';
import { SafeImage } from '../SafeImage';

interface CartDrawerProps {
  open: boolean;
  restaurant: Restaurant;
  cart: CartItem[];
  isDemoMode: boolean;
  onClose: () => void;
  onUpdateQty: (cartKey: string, delta: number) => void;
  onRemoveItem: (cartKey: string) => void;
  onClearCart: () => void;
}

function normalizeWhatsappNumber(raw: string): string {
  let digits = (raw || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  // Local Egyptian mobile (010/011/012/015...) -> prefix 20
  if (digits.length === 11 && digits.startsWith('01')) {
    digits = `2${digits}`;
  }
  // Local Saudi mobile (05xxxxxxxx) -> prefix 966
  else if (digits.length === 10 && digits.startsWith('05')) {
    digits = `966${digits.slice(1)}`;
  }
  return digits;
}

export function CartDrawer({
  open,
  restaurant,
  cart,
  isDemoMode,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
}: CartDrawerProps) {
  const { lang, dir, isRtl, t, loc, formatCurrency } = useLanguage();
  const initialTable =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('table') || ''
      : '';
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('dine_in');
  const [tableNumber, setTableNumber] = useState(initialTable);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');

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

  const serviceCharge = useMemo(
    () => (subtotal * (restaurant.serviceCharge || 0)) / 100,
    [subtotal, restaurant.serviceCharge]
  );

  const taxAmount = useMemo(
    () => ((subtotal + serviceCharge) * (restaurant.taxRate || 0)) / 100,
    [subtotal, serviceCharge, restaurant.taxRate]
  );

  const total = subtotal + serviceCharge + taxAmount;
  const displayCurrency = formatCurrency(restaurant.currency);

  const formatPrice = (val: number) => `${val.toFixed(2).replace(/\.00$/, '')} ${displayCurrency}`;

  const buildOrderItems = (): OrderItemPayload[] =>
    cart.map((c) => {
      const payload: OrderItemPayload = {
        menuItemId: c.menuItem.id,
        name: loc(c.menuItem.name, c.menuItem.name_en),
        addonNames: c.selectedAddons.map((a) => loc(a.name, a.name_en)),
        quantity: c.quantity,
        unitPrice: Number(c.unitPrice.toFixed(2)),
        lineTotal: Number((c.unitPrice * c.quantity).toFixed(2)),
      };
      if (c.selectedSize?.name) {
        payload.sizeName = loc(c.selectedSize.name, c.selectedSize.name_en);
      }
      if (c.notes) payload.notes = c.notes;
      return payload;
    });

  const buildWhatsappInvoice = (orderNumber: string): string => {
    const restName = loc(restaurant.name, restaurant.name_en);
    const safeName = customerName.trim() || (lang === 'en' ? 'Guest' : 'ضيف');
    const safePhone = customerPhone.trim() || '-';

    if (lang === 'en') {
      const typeLabel =
        orderType === 'dine_in'
          ? `Dine-In${tableNumber.trim() ? ` (Table: ${tableNumber.trim()})` : ''}`
          : orderType === 'delivery'
            ? `Delivery (${deliveryAddress.trim() || 'N/A'})`
            : 'Pickup';

      const lines = [
        `*New Order from ${restName}*`,
        `Order #: ${orderNumber}`,
        `Order Type: ${typeLabel}`,
        `Customer: ${safeName}`,
        `Phone: ${safePhone}`,
        `----------------`,
        ...cart.map((c, idx) => {
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
        }),
        `----------------`,
        `Subtotal: ${formatPrice(subtotal)}`,
      ];

      if (serviceCharge > 0) {
        lines.push(`Service Charge (${restaurant.serviceCharge}%): ${formatPrice(serviceCharge)}`);
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
        ? `صالة${tableNumber.trim() ? ` (طاولة: ${tableNumber.trim()})` : ''}`
        : orderType === 'delivery'
          ? `توصيل (${deliveryAddress.trim() || 'غير محدد'})`
          : 'استلام من الفرع';

    const lines = [
      `*طلب جديد من ${restName}*`,
      `رقم الطلب: ${orderNumber}`,
      `نوع الطلب: ${typeLabel}`,
      `العميل: ${safeName}`,
      `الجوال: ${safePhone}`,
      `----------------`,
      ...cart.map((c, idx) => {
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
      }),
      `----------------`,
      `المجموع الفرعي: ${formatPrice(subtotal)}`,
    ];

    if (serviceCharge > 0) {
      lines.push(`رسوم الخدمة (${restaurant.serviceCharge}%): ${formatPrice(serviceCharge)}`);
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
    if (!customerName.trim()) {
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
    if (customerPhone.trim().length < 5) {
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

    setSubmitting(true);
    setErrorMsg(null);
    try {
      let orderNumber = `DEMO-${Math.floor(1000 + Math.random() * 9000)}`;
      if (!isDemoMode) {
        const res = await submitPublicOrder({
          restaurantId: restaurant.id,
          ownerId: restaurant.ownerId,
          customerName,
          customerPhone,
          orderType,
          tableNumber:
            orderType === 'dine_in' && tableNumber.trim() ? tableNumber.trim() : undefined,
          deliveryAddress:
            orderType === 'delivery' && deliveryAddress.trim()
              ? deliveryAddress.trim()
              : undefined,
          notes: notes.trim() || undefined,
          items: buildOrderItems(),
          subtotal,
          serviceCharge,
          taxAmount,
          total,
        });
        orderNumber = res.orderNumber;
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
      onClearCart();
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
        className="w-full max-w-md bg-white text-stone-900 h-full flex flex-col shadow-2xl"
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
          <button
            type="button"
            onClick={handleCloseDrawer}
            aria-label={lang === 'en' ? 'Close cart' : 'إغلاق السلة'}
            className="w-11 h-11 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {isDemoMode && !confirmedOrder && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
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
                      {t.menu.customerPhone}
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

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-sm">
                <div className="flex items-center justify-between text-stone-600">
                  <span>{t.menu.subtotal}</span>
                  <span className="font-mono-num">{formatPrice(subtotal)}</span>
                </div>
                {restaurant.serviceCharge > 0 && (
                  <div className="flex items-center justify-between text-stone-600">
                    <span>
                      {t.menu.serviceCharge} ({restaurant.serviceCharge}%)
                    </span>
                    <span className="font-mono-num">{formatPrice(serviceCharge)}</span>
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
                  <span>{t.menu.grandTotal}</span>
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
