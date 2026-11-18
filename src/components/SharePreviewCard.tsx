import { useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle } from 'lucide-react';
import { SafeImage } from './SafeImage';

interface SharePreviewCardProps {
  title: string;
  description: string;
  imageUrl?: string;
  shareUrl: string;
  isEn: boolean;
  onResetAuto?: () => void;
  showResetAuto?: boolean;
}

export function SharePreviewCard({
  title,
  description,
  imageUrl,
  shareUrl,
  isEn,
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

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-zinc-50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-zinc-950">
              {isEn
                ? 'Live WhatsApp & Social Link Card Preview'
                : 'معاينة شكل الرابط عند الإرسال في واتساب والسوشيال'}
            </p>
            <p className="text-[11px] text-zinc-500">
              {isEn
                ? 'This image, welcome title, and 2-line greeting appear automatically when anyone sends the link.'
                : 'تظهر هذه الصورة وهذا العنوان والترحيب تلقائياً لأي عميل عند مشاركة الرابط.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showResetAuto && onResetAuto && (
            <button
              type="button"
              onClick={onResetAuto}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-[11px] font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              {isEn ? 'Use Default' : 'الوضع التلقائي'}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>
              {copied
                ? isEn
                  ? 'Link Copied'
                  : 'تم نسخ الرابط'
                : isEn
                  ? 'Copy Link'
                  : 'نسخ الرابط للمشاركة'}
            </span>
          </button>
        </div>
      </div>

      {/* Realistic WhatsApp Bubble + Rich Link Card */}
      <div className="max-w-md mx-auto sm:mx-0 bg-[#E7FFDB] border border-emerald-200 rounded-2xl p-2.5 shadow-xs space-y-1.5">
        <div className="bg-white/95 rounded-xl overflow-hidden border border-black/5 flex flex-col sm:flex-row">
          <div className="sm:w-28 h-36 sm:h-auto bg-zinc-100 shrink-0 relative overflow-hidden">
            <SafeImage
              src={imageUrl || '/src/assets/images/sufra_platform_logo_1795015927934.jpg'}
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
