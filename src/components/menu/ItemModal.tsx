import { useEffect, useMemo, useState } from 'react';
import { Check, Flame, Minus, Plus, X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { CartItem, ItemAddon, ItemSize, MenuItem } from '../../types/menu';
import { SafeImage } from '../SafeImage';

interface ItemModalProps {
  item: MenuItem | null;
  currency: string;
  primaryColor: string;
  taxRate: number;
  serviceCharge: number;
  isDarkSurface: boolean;
  onClose: () => void;
  onAddToCart: (cartItem: CartItem) => void;
}

export function ItemModal({
  item,
  currency,
  primaryColor,
  taxRate,
  serviceCharge,
  isDarkSurface,
  onClose,
  onAddToCart,
}: ItemModalProps) {
  const { lang, dir, t, loc, formatCurrency } = useLanguage();
  const [selectedSize, setSelectedSize] = useState<ItemSize | undefined>(undefined);
  const [selectedAddons, setSelectedAddons] = useState<ItemAddon[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (item) {
      setSelectedSize(item.sizes && item.sizes.length > 0 ? item.sizes[0] : undefined);
      setSelectedAddons([]);
      setQuantity(1);
      setNotes('');
    }
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);

  const unitPrice = useMemo(() => {
    if (!item) return 0;
    const baseForSize = selectedSize ? selectedSize.price : item.basePrice;
    const addonsSum = selectedAddons.reduce((sum, a) => sum + a.price, 0);
    return Math.max(0, baseForSize + addonsSum);
  }, [item, selectedSize, selectedAddons]);

  if (!item) return null;

  const toggleAddon = (addon: ItemAddon) => {
    setSelectedAddons((prev) =>
      prev.some((a) => a.name === addon.name)
        ? prev.filter((a) => a.name !== addon.name)
        : [...prev, addon]
    );
  };

  const handleConfirm = () => {
    const addonNames = selectedAddons
      .map((a) => a.name)
      .sort()
      .join(',');
    const cartKey = `${item.id}__${selectedSize?.name || 'std'}__${addonNames}__${notes.trim()}`;

    onAddToCart({
      cartKey,
      menuItem: item,
      selectedSize,
      selectedAddons,
      quantity,
      notes: notes.trim() || undefined,
      unitPrice,
    });
    onClose();
  };

  const displayCurrency = formatCurrency(currency);
  const itemName = loc(item.name, item.name_en);
  const itemDesc = loc(item.description, item.description_en);
  const totalPrice = unitPrice * quantity;
  const hasCharges = taxRate > 0 || serviceCharge > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-modal-title"
    >
      <div
        dir={dir}
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl border max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-4 duration-200 ${
          isDarkSurface
            ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
            : 'bg-white border-stone-200 text-stone-900'
        }`}
      >
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div
            className={`w-10 h-1.5 rounded-full ${
              isDarkSurface ? 'bg-zinc-700' : 'bg-stone-300'
            }`}
          />
        </div>

        <div className="relative h-56 sm:h-64 shrink-0 overflow-hidden bg-zinc-800">
          <SafeImage src={item.imageUrl} alt={itemName} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'en' ? 'Close' : 'إغلاق'}
            className="absolute top-3 end-3 w-11 h-11 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/75 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 start-4 end-4 text-white">
            <h2
              id="item-modal-title"
              className="text-xl font-extrabold leading-snug flex items-center gap-2"
            >
              <span>{itemName}</span>
              {item.isSpicy && <Flame className="w-4 h-4 text-red-400 shrink-0" />}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-white/85">
              <span className="font-mono-num font-bold">
                {item.basePrice} {displayCurrency}
              </span>
              {typeof item.calories === 'number' && item.calories > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">
                    {item.calories} {t.menu.caloriesUnit}
                  </span>
                </>
              )}
              {item.ordersCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num text-amber-300 font-semibold">
                    {lang === 'en'
                      ? `+${item.ordersCount} ${t.menu.ordersCountLabel}`
                      : `طُلب +${item.ordersCount} مرة`}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {itemDesc && (
            <p
              className={`text-sm leading-relaxed ${
                isDarkSurface ? 'text-zinc-300' : 'text-stone-600'
              }`}
            >
              {itemDesc}
            </p>
          )}

          {item.sizes && item.sizes.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{t.menu.chooseSize}</span>
                <span className={`text-xs ${isDarkSurface ? 'text-zinc-400' : 'text-stone-500'}`}>
                  {lang === 'en' ? 'Required' : 'مطلوب'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {item.sizes.map((sz) => {
                  const active = selectedSize?.name === sz.name;
                  return (
                    <button
                      key={sz.name}
                      type="button"
                      onClick={() => setSelectedSize(sz)}
                      style={active ? { borderColor: primaryColor } : undefined}
                      className={`flex items-center justify-between px-3.5 py-3 rounded-xl border text-sm transition-colors cursor-pointer min-h-[44px] ${
                        active
                          ? isDarkSurface
                            ? 'bg-zinc-800 text-white'
                            : 'bg-stone-50 text-stone-900'
                          : isDarkSurface
                            ? 'border-zinc-800 text-zinc-300 hover:border-zinc-700'
                            : 'border-stone-200 text-stone-700 hover:border-stone-300'
                      }`}
                    >
                      <span className="font-medium">{loc(sz.name, sz.name_en)}</span>
                      <span className="font-mono-num text-xs font-semibold">
                        {sz.price} {displayCurrency}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {item.addons && item.addons.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{t.menu.chooseAddons}</span>
                <span className={`text-xs ${isDarkSurface ? 'text-zinc-400' : 'text-stone-500'}`}>
                  {t.menu.optionalAddons}
                </span>
              </div>
              <div className="space-y-2">
                {item.addons.map((addon) => {
                  const checked = selectedAddons.some((a) => a.name === addon.name);
                  return (
                    <button
                      key={addon.name}
                      type="button"
                      onClick={() => toggleAddon(addon)}
                      style={checked ? { borderColor: primaryColor } : undefined}
                      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl border text-sm transition-colors cursor-pointer min-h-[44px] ${
                        checked
                          ? isDarkSurface
                            ? 'bg-zinc-800 text-white'
                            : 'bg-stone-50 text-stone-900'
                          : isDarkSurface
                            ? 'border-zinc-800 text-zinc-300 hover:border-zinc-700'
                            : 'border-stone-200 text-stone-700 hover:border-stone-300'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          style={
                            checked
                              ? { backgroundColor: primaryColor, borderColor: primaryColor }
                              : undefined
                          }
                          className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                            checked
                              ? 'text-white'
                              : isDarkSurface
                                ? 'border-zinc-600'
                                : 'border-stone-300'
                          }`}
                        >
                          {checked && <Check className="w-3.5 h-3.5" />}
                        </span>
                        <span>{loc(addon.name, addon.name_en)}</span>
                      </span>
                      <span className="font-mono-num text-xs font-semibold">
                        +{addon.price} {displayCurrency}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="item-notes" className="block text-sm font-bold">
              {t.menu.specialNotes}
            </label>
            <input
              id="item-notes"
              type="text"
              maxLength={140}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.menu.notesPlaceholder}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none ${
                isDarkSurface
                  ? 'bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500'
                  : 'bg-stone-50 border-stone-200 text-stone-900 placeholder:text-stone-400'
              }`}
            />
          </div>

          {hasCharges && (
            <p
              className={`text-[11px] font-mono-num ${
                isDarkSurface ? 'text-zinc-400' : 'text-stone-500'
              }`}
            >
              {lang === 'en' ? 'Applied at checkout: ' : 'تُضاف عند الدفع: '}
              {serviceCharge > 0 ? `${serviceCharge}% ${t.menu.serviceNoticePrefix}` : ''}
              {serviceCharge > 0 && taxRate > 0 ? ' · ' : ''}
              {taxRate > 0 ? `${taxRate}% ${t.menu.taxNoticePrefix}` : ''}
            </p>
          )}
        </div>

        <div
          className={`p-4 border-t flex items-center justify-between gap-4 shrink-0 ${
            isDarkSurface ? 'border-zinc-800 bg-zinc-900' : 'border-stone-200 bg-white'
          }`}
        >
          <div
            className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
              isDarkSurface ? 'border-zinc-700 bg-zinc-950' : 'border-stone-200 bg-stone-50'
            }`}
          >
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label={lang === 'en' ? 'Decrease quantity' : 'تقليل الكمية'}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-black/10 transition-colors cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-6 text-center font-mono-num font-bold text-sm">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(25, q + 1))}
              aria-label={lang === 'en' ? 'Increase quantity' : 'زيادة الكمية'}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-black/10 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            style={{ backgroundColor: primaryColor }}
            className="flex-1 min-h-[48px] py-3 px-5 rounded-xl text-white font-bold text-sm flex items-center justify-between shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
          >
            <span>{t.menu.addWithTotal}</span>
            <span className="font-mono-num">
              {totalPrice.toFixed(2).replace(/\.00$/, '')} {displayCurrency}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
