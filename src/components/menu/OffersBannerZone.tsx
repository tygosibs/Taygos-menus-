import { useMemo, useState } from 'react';
import { Copy, Check, Gift, Sparkles, Tag, X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getContrastOnAccent, isValidHexColor } from '../../lib/contrastUtils';
import { MenuOffer, OfferAnimation, OfferPlacement } from '../../types/menu';

interface OffersBannerZoneProps {
  offers?: MenuOffer[];
  placement: OfferPlacement;
  accentColor: string;
  isDarkSurface: boolean;
  onApplyPromoCode?: (code: string) => void;
}

const ANIMATION_CLASS: Record<OfferAnimation, string> = {
  static: '',
  marquee: 'offer-anim-marquee',
  orbit: 'offer-anim-orbit',
  bounce: 'offer-anim-bounce',
  fade: 'offer-anim-fade',
};

export function OffersBannerZone({
  offers,
  placement,
  accentColor,
  isDarkSurface,
  onApplyPromoCode,
}: OffersBannerZoneProps) {
  const { lang, loc } = useLanguage();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const visibleOffers = useMemo(() => {
    if (!offers || offers.length === 0) return [];
    return [...offers]
      .filter((o) => o.isActive && o.placement === placement && !dismissedIds.includes(o.id))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [offers, placement, dismissedIds]);

  if (visibleOffers.length === 0) return null;

  const handlePromoAction = (offer: MenuOffer) => {
    const code = (offer.promoCode || '').trim().toUpperCase();
    if (!code) return;
    try {
      navigator.clipboard?.writeText(code);
    } catch {
      // Ignore clipboard failures
    }
    setCopiedId(offer.id);
    setTimeout(() => setCopiedId((prev) => (prev === offer.id ? null : prev)), 2000);
    onApplyPromoCode?.(code);
  };

  if (placement === 'floating') {
    const offer = visibleOffers[0];
    const bg = isValidHexColor(offer.bgColor) ? offer.bgColor! : accentColor;
    const fg = isValidHexColor(offer.textColor)
      ? offer.textColor!
      : getContrastOnAccent(bg);
    const title = loc(offer.title, offer.title_en);
    const subtitle = loc(offer.subtitle, offer.subtitle_en);
    const animClass = ANIMATION_CLASS[offer.animation || 'bounce'];

    return (
      <div className="fixed bottom-20 start-3 end-3 sm:start-auto sm:end-5 sm:max-w-sm z-35 pointer-events-none">
        <div
          style={{ backgroundColor: bg, color: fg }}
          className={`pointer-events-auto rounded-2xl px-4 py-3 shadow-2xl border border-white/20 flex items-center justify-between gap-3 ${animClass}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-black/15 flex items-center justify-center shrink-0">
              {offer.isBogo ? <Gift className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold truncate">{title}</p>
              {subtitle && <p className="text-[11px] opacity-90 truncate">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {offer.promoCode && (
              <button
                type="button"
                onClick={() => handlePromoAction(offer)}
                className="px-2.5 py-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-[11px] font-mono-num font-extrabold cursor-pointer whitespace-nowrap"
              >
                {copiedId === offer.id
                  ? lang === 'en'
                    ? 'Applied!'
                    : 'تم التطبيق'
                  : offer.promoCode.toUpperCase()}
              </button>
            )}
            <button
              type="button"
              onClick={() => setDismissedIds((prev) => [...prev, offer.id])}
              aria-label={lang === 'en' ? 'Dismiss' : 'إغلاق'}
              className="w-8 h-8 rounded-lg bg-black/15 hover:bg-black/25 flex items-center justify-center cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full max-w-6xl mx-auto px-3 sm:px-4 ${
        placement === 'top' ? 'pt-3 pb-1' : 'my-3'
      } space-y-2.5`}
    >
      {visibleOffers.map((offer) => {
        const bg = isValidHexColor(offer.bgColor)
          ? offer.bgColor!
          : isDarkSurface
            ? '#172033'
            : accentColor;
        const fg = isValidHexColor(offer.textColor)
          ? offer.textColor!
          : getContrastOnAccent(bg);
        const title = loc(offer.title, offer.title_en);
        const subtitle = loc(offer.subtitle, offer.subtitle_en);
        const badge =
          loc(offer.badgeText, offer.badgeText_en) ||
          (offer.isBogo ? (lang === 'en' ? '1+1 FREE' : 'اشترِ 1 واحصل على 1 مجاناً') : '');
        const animClass = ANIMATION_CLASS[offer.animation || 'static'];

        return (
          <div
            key={offer.id}
            style={{ backgroundColor: bg, color: fg }}
            className={`rounded-2xl px-4 py-3 shadow-sm border border-black/10 flex flex-wrap items-center justify-between gap-2.5 overflow-hidden ${animClass}`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-black/15 flex items-center justify-center shrink-0">
                {offer.isBogo ? <Gift className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {badge && (
                    <span className="px-2 py-0.5 rounded-md bg-black/20 text-[10px] font-extrabold whitespace-nowrap">
                      {badge}
                    </span>
                  )}
                  <p className="text-xs sm:text-sm font-extrabold truncate">{title}</p>
                </div>
                {subtitle && (
                  <p className="text-[11px] sm:text-xs opacity-90 line-clamp-1 mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {offer.promoCode && (
              <button
                type="button"
                onClick={() => handlePromoAction(offer)}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-black/20 hover:bg-black/30 text-xs font-mono-num font-extrabold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
              >
                {copiedId === offer.id ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{offer.promoCode.toUpperCase()}</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
