import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function asObject(val: unknown): Record<string, unknown> | null {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : null;
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
  const [iframeHeight, setIframeHeight] = useState<number | null>(null);

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
    setIframeHeight(null);
  }, [customTheme.id, lang]);

  const resolveMenuItemFromMessage = useCallback(
    (data: Record<string, unknown>): MenuItem | null => {
      const payloadObj = asObject(data.payload);
      const itemObj = asObject(data.item);
      const nestedDataObj = asObject(data.data);
      const nestedPayloadItem = payloadObj ? asObject(payloadObj.item) : null;

      const candidateObj =
        nestedPayloadItem || payloadObj || itemObj || nestedDataObj || null;

      const idCandidates = [
        data.itemId,
        data.menuItemId,
        data.id,
        payloadObj?.id,
        payloadObj?.itemId,
        payloadObj?.menuItemId,
        nestedPayloadItem?.id,
        itemObj?.id,
        nestedDataObj?.id,
      ]
        .filter((v): v is string | number => typeof v === 'string' || typeof v === 'number')
        .map((v) => String(v).trim())
        .filter(Boolean);

      for (const cid of idCandidates) {
        const exact = items.find((i) => i.id === cid);
        if (exact) return exact;
        const ci = items.find((i) => i.id.toLowerCase() === cid.toLowerCase());
        if (ci) return ci;
      }

      const nameCandidates = [
        data.itemName,
        data.name,
        data.title,
        payloadObj?.name,
        payloadObj?.name_en,
        payloadObj?.title,
        nestedPayloadItem?.name,
        nestedPayloadItem?.name_en,
        itemObj?.name,
        itemObj?.name_en,
        nestedDataObj?.name,
      ]
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);

      for (const cname of nameCandidates) {
        const byName = items.find(
          (i) =>
            i.name.trim().toLowerCase() === cname ||
            (i.name_en || '').trim().toLowerCase() === cname
        );
        if (byName) return byName;
      }

      // If the custom theme sent a complete dish payload not directly matched by ID, normalize it safely
      if (
        candidateObj &&
        (typeof candidateObj.name === 'string' || typeof candidateObj.title === 'string')
      ) {
        const rawPrice = Number(candidateObj.basePrice ?? candidateObj.price ?? 0);
        return {
          id: String(candidateObj.id || idCandidates[0] || `custom_item_${Date.now()}`),
          restaurantId: restaurant.id,
          ownerId: restaurant.ownerId,
          categoryId: String(candidateObj.categoryId || categories[0]?.id || 'default'),
          name: String(candidateObj.name || candidateObj.title || ''),
          name_en:
            typeof candidateObj.name_en === 'string' ? candidateObj.name_en : undefined,
          description:
            typeof candidateObj.description === 'string' ? candidateObj.description : undefined,
          description_en:
            typeof candidateObj.description_en === 'string'
              ? candidateObj.description_en
              : undefined,
          basePrice: Number.isFinite(rawPrice) ? rawPrice : 0,
          imageUrl: typeof candidateObj.imageUrl === 'string' ? candidateObj.imageUrl : undefined,
          calories:
            typeof candidateObj.calories === 'number' ? candidateObj.calories : undefined,
          isSpicy: Boolean(candidateObj.isSpicy),
          isAvailable: candidateObj.isAvailable !== false,
          ordersCount: Number(candidateObj.ordersCount || 0),
          sizes: Array.isArray(candidateObj.sizes) ? (candidateObj.sizes as MenuItem['sizes']) : [],
          addons: Array.isArray(candidateObj.addons)
            ? (candidateObj.addons as MenuItem['addons'])
            : [],
          sortOrder: Number(candidateObj.sortOrder || 0),
        };
      }

      return null;
    },
    [items, restaurant.id, restaurant.ownerId, categories]
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
        return;
      }

      let data: Record<string, unknown> | null = null;
      if (typeof event.data === 'string') {
        try {
          const parsed = JSON.parse(event.data);
          data = asObject(parsed);
        } catch {
          return;
        }
      } else {
        data = asObject(event.data);
      }

      if (!data) return;

      const type = String(data.type || data.action || '')
        .trim()
        .toUpperCase();

      if (type === 'RESIZE_IFRAME' || type === 'IFRAME_HEIGHT') {
        const nextH = Number(data.height);
        if (Number.isFinite(nextH) && nextH >= 320 && nextH <= 16000) {
          setIframeHeight(Math.ceil(nextH));
        }
        return;
      }

      if (type === 'OPEN_CART' || type === 'VIEW_CART') {
        onOpenCart();
        return;
      }

      if (
        type === 'OPEN_ITEM_MODAL' ||
        type === 'OPEN_ITEM' ||
        type === 'SELECT_ITEM' ||
        type === 'VIEW_ITEM' ||
        type === 'SHOW_ITEM_DETAILS'
      ) {
        const found = resolveMenuItemFromMessage(data);
        if (found) {
          onSelectItem(found);
        }
        return;
      }

      if (type === 'ADD_TO_CART' || type === 'QUICK_ADD' || type === 'ADD_ITEM') {
        const found = resolveMenuItemFromMessage(data);
        if (!found) return;

        const payloadObj = asObject(data.payload);
        const qtyRaw = data.quantity ?? payloadObj?.quantity ?? 1;
        const qty = Math.max(1, Math.min(50, Math.round(Number(qtyRaw) || 1)));
        const requestedSizeName =
          typeof data.sizeName === 'string'
            ? data.sizeName
            : typeof payloadObj?.sizeName === 'string'
              ? payloadObj.sizeName
              : '';
        const selectedSize = requestedSizeName
          ? found.sizes?.find((s) => s.name === requestedSizeName) || found.sizes?.[0]
          : found.sizes && found.sizes.length > 0
            ? found.sizes[0]
            : undefined;

        const rawAddonNames = Array.isArray(data.addonNames)
          ? data.addonNames
          : Array.isArray(payloadObj?.addonNames)
            ? payloadObj.addonNames
            : [];
        const requestedAddonNames = rawAddonNames.filter(
          (n): n is string => typeof n === 'string'
        );
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
        const notesRaw =
          typeof data.notes === 'string'
            ? data.notes
            : typeof payloadObj?.notes === 'string'
              ? payloadObj.notes
              : '';
        const notes = notesRaw.trim().slice(0, 200);
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
  }, [resolveMenuItemFromMessage, onSelectItem, onAddToCart, onOpenCart, t.menu.addedToCart, loc]);

  const accent = restaurant.primaryColor || '#A61C1C';
  const currencyLabel = formatCurrency(restaurant.currency);
  const formattedTotal = `${cartTotal.toFixed(2).replace(/\.00$/, '')} ${currencyLabel}`;

  return (
    <div dir={dir} className="relative w-full min-h-screen bg-zinc-950 overflow-x-clip max-w-full">
      <div className="fixed top-3 end-3 z-40">
        <LanguageToggleButton variant="glass" compact />
      </div>

      <iframe
        key={`${customTheme.id}_${lang}`}
        ref={iframeRef}
        title={loc(customTheme.name, customTheme.name_en)}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        style={iframeHeight ? { height: `${iframeHeight}px`, minHeight: '100vh' } : undefined}
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
