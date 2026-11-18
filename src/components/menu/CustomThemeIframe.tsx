import { useEffect, useMemo, useRef, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { buildCustomThemeSrcDoc } from '../../lib/customThemeEngine';
import { CartItem, Category, CustomTheme, MenuItem, Restaurant } from '../../types/menu';
import { LanguageToggleButton } from '../LanguageToggleButton';

interface CustomThemeIframeProps {
  customTheme: CustomTheme;
  restaurant: Restaurant;
  categories: Category[];
  items: MenuItem[];
  cartCount: number;
  cartTotal: number;
  onSelectItem: (item: MenuItem) => void;
  onAddToCart: (cartItem: CartItem) => void;
  onOpenCart: () => void;
}

export function CustomThemeIframe({
  customTheme,
  restaurant,
  categories,
  items,
  cartCount,
  cartTotal,
  onSelectItem,
  onAddToCart,
  onOpenCart,
}: CustomThemeIframeProps) {
  const { lang, dir, t, loc, formatCurrency } = useLanguage();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const srcDoc = useMemo(
    () =>
      buildCustomThemeSrcDoc({
        htmlCode: customTheme.htmlCode,
        cssCode: customTheme.cssCode,
        jsCode: customTheme.jsCode,
        restaurant,
        categories,
        items,
        currentLang: lang,
      }),
    [customTheme, restaurant, categories, items, lang]
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
        return;
      }
      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== 'object') return;

      const type = String(data.type || '');
      const rawId =
        (typeof data.itemId === 'string' && data.itemId) ||
        (typeof data.menuItemId === 'string' && data.menuItemId) ||
        (typeof data.id === 'string' && data.id) ||
        (typeof (data.item as { id?: string } | undefined)?.id === 'string' &&
          (data.item as { id: string }).id) ||
        '';

      if (type === 'OPEN_CART') {
        onOpenCart();
        return;
      }

      if (type === 'OPEN_ITEM_MODAL') {
        const found = items.find((i) => i.id === rawId);
        if (found) {
          onSelectItem(found);
        }
        return;
      }

      if (type === 'ADD_TO_CART') {
        const found = items.find((i) => i.id === rawId);
        if (!found) return;

        const qty = Math.max(1, Math.min(50, Math.round(Number(data.quantity) || 1)));
        const requestedSizeName = typeof data.sizeName === 'string' ? data.sizeName : '';
        const selectedSize = requestedSizeName
          ? found.sizes?.find((s) => s.name === requestedSizeName) || found.sizes?.[0]
          : found.sizes && found.sizes.length > 0
            ? found.sizes[0]
            : undefined;

        const requestedAddonNames = Array.isArray(data.addonNames)
          ? data.addonNames.filter((n): n is string => typeof n === 'string')
          : [];
        const selectedAddons = (found.addons || []).filter((a) =>
          requestedAddonNames.includes(a.name)
        );

        const baseOrSizePrice = selectedSize ? selectedSize.price : found.basePrice;
        const addonsTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
        const unitPrice = baseOrSizePrice + addonsTotal;

        const addonKey = selectedAddons
          .map((a) => a.name)
          .sort()
          .join(',');
        const notes = typeof data.notes === 'string' ? data.notes.trim().slice(0, 200) : '';
        const cartKey = `${found.id}__${selectedSize?.name || 'std'}__${addonKey}__${notes}`;

        onAddToCart({
          cartKey,
          menuItem: found,
          selectedSize,
          selectedAddons,
          quantity: qty,
          notes: notes || undefined,
          unitPrice,
        });

        setToastMsg(`${t.menu.addedToCart}: ${loc(found.name, found.name_en)}`);
        setTimeout(() => setToastMsg(null), 2200);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [items, onSelectItem, onAddToCart, onOpenCart, t.menu.addedToCart, loc]);

  const accent = restaurant.primaryColor || '#A61C1C';
  const currencyLabel = formatCurrency(restaurant.currency);
  const formattedTotal = `${cartTotal.toFixed(2).replace(/\.00$/, '')} ${currencyLabel}`;

  return (
    <div dir={dir} className="relative w-full min-h-screen bg-zinc-950">
      <div className="fixed top-3 end-3 z-40">
        <LanguageToggleButton variant="glass" />
      </div>

      <iframe
        key={`${customTheme.id}_${lang}`}
        ref={iframeRef}
        title={loc(customTheme.name, customTheme.name_en)}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        className="w-full min-h-screen border-0 block bg-white"
      />

      {toastMsg && (
        <div
          dir={dir}
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-zinc-950/95 text-white text-xs font-bold shadow-xl border border-white/15"
        >
          {toastMsg}
        </div>
      )}

      {cartCount > 0 && (
        <div dir={dir} className="fixed bottom-4 inset-x-0 z-40 px-4 pointer-events-none">
          <div className="max-w-lg mx-auto pointer-events-auto">
            <button
              type="button"
              onClick={onOpenCart}
              style={{ backgroundColor: accent }}
              className="w-full h-14 px-5 rounded-2xl text-white shadow-xl flex items-center justify-between font-bold text-sm hover:opacity-95 transition-opacity cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5" />
                <span>{t.menu.viewCart}</span>
                <span className="font-mono-num text-xs bg-black/25 px-2 py-0.5 rounded-md">
                  {cartCount}
                </span>
              </span>
              <span className="font-mono-num text-base">{formattedTotal}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
