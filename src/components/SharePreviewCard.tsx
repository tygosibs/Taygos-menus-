import { useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, Share2 } from 'lucide-react';
import { SafeImage } from './SafeImage';
import {
  DEFAULT_RESTAURANT_FOOD_FALLBACK,
  OFFICIAL_PLATFORM_LOGO_PATH,
} from '../lib/seoHead';

interface SharePreviewCardProps {
  title: string;
  description: string;
  imageUrl?: string;
  shareUrl: string;
  isEn: boolean;
  mode?: 'restaurant' | 'platform';
  onResetAuto?: () => void;
  showResetAuto?: boolean;
}

export function SharePreviewCard({
  title,
  description,
  imageUrl,
  shareUrl,
  isEn,
  mode = 'restaurant',
  onResetAuto,
  showResetAuto,
}: SharePreviewCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  let displayDomain = 'sufra-qr';
  try {
    displayDomain = new URL(shareUrl).host;
  } catch {
    displayDomain = shareUrl;
  }

  const effectiveFallback =
    mode === 'platform' ? OFFICIAL_PLATFORM_LOGO_PATH : DEFAULT_RESTAURANT_FOOD_FALLBACK;

  // Strict separation: never render Sufra platform logo inside a restaurant share card preview
  const cleanedSrc =
    mode === 'restaurant' &&
    imageUrl &&
    (imageUrl.includes('suofra_logo_icon_f1015078') ||
      imageUrl.includes('sufra_platform_logo_1795015927934'))
      ? effectiveFallback
      : imageUrl || effectiveFallback;

  const whatsappShareHref = `https://wa.me/?text=${encodeURIComponent(
    `${title}\n${description}\n${shareUrl}`
  )}`;

  const whatsappBtnLabel =
    mode === 'platform'
      ? isEn
        ? 'Share Sufra Card on WhatsApp'
        : 'مشاركة بطاقة سُفرة على واتساب'
      : isEn
        ? 'Share Menu Card on WhatsApp'
        : 'مشاركة بطاقة المنيو على واتساب';

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-zinc-50 p-4 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-extrabold text-zinc-950">
              {isEn
                ? 'Live WhatsApp & Social Link Card Preview'
                : 'معاينة بطاقة الرابط عند المشاركة في واتساب والسوشيال'}
            </p>
            <p className="text-[11px] text-zinc-500">
              {mode === 'platform'
                ? isEn
                  ? 'Shows Sufra official emblem, welcome title, and 2-line greeting.'
                  : 'تعرض أيقونة سُفرة الرسمية مع العنوان والترحيب عند مشاركة رابط المنصة.'
                : isEn
                  ? 'Shows your own restaurant logo, name, and greeting automatically on WhatsApp & Facebook.'
                  : 'تعرض لوجو مطعمك واسمه وترحيبه الخاص تلقائياً كبطاقة مصورة عند إرسال الرابط.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {showResetAuto && onResetAuto && (
            <button
              type="button"
              onClick={onResetAuto}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-[11px] font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              {isEn ? 'Use Default' : 'الوضع التلقائي'}
            </button>
          )}

          <a
            href={whatsappShareHref}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-zinc-950 text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{whatsappBtnLabel}</span>
          </a>

          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[38px] px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>
              {copied
                ? isEn
                  ? 'Link Copied'
                  : 'تم النسخ'
                : isEn
                  ? 'Copy Link'
                  : 'نسخ الرابط'}
            </span>
          </button>
        </div>
      </div>

      {/* Realistic WhatsApp Bubble + Rich Link Card */}
      <div className="max-w-md mx-auto sm:mx-0 bg-[#E7FFDB] border border-emerald-200 rounded-2xl p-2.5 shadow-xs space-y-1.5">
        <div className="bg-white/95 rounded-xl overflow-hidden border border-black/5 flex flex-col sm:flex-row">
          <div className="sm:w-28 h-36 sm:h-auto bg-zinc-100 shrink-0 relative overflow-hidden">
            <SafeImage
              src={cleanedSrc}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-3 min-w-0 flex-1 space-y-1">
            <p className="text-[10px] font-mono-num text-emerald-700 uppercase tracking-wide truncate" dir="ltr">
              {displayDomain}
            </p>
            <h4 className="text-sm font-extrabold text-zinc-950 leading-snug line-clamp-1">
              {title}
            </h4>
            <p className="text-xs text-zinc-600 leading-relaxed line-clamp-2">
              {description}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-1 pt-0.5 text-[11px] text-emerald-900 font-mono-num">
          <span className="truncate underline" dir="ltr">
            {shareUrl}
          </span>
          <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
        </div>
      </div>
    </div>
  );
}
