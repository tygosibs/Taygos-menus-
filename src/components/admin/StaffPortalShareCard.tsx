import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Building2,
  Check,
  Copy,
  Download,
  ExternalLink,
  MessageCircle,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { Restaurant } from '../../types/menu';
import { useLanguage } from '../../contexts/LanguageContext';
import { getFacilityActivityMeta } from '../../lib/facilityCodeUtils';

interface StaffPortalShareCardProps {
  restaurant: Restaurant;
  managersCount: number;
}

export function StaffPortalShareCard({ restaurant, managersCount }: StaffPortalShareCardProps) {
  const { lang, dir, loc } = useLanguage();
  const isEn = lang === 'en';
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const staffPortalPath = `/staff/${restaurant.slug}`;
  const staffPortalUrl = `${origin}${staffPortalPath}`;
  const restDisplayName = loc(restaurant.name, restaurant.name_en);
  const facilityCode = (restaurant.facilityCode || '').trim();
  const activityMeta = getFacilityActivityMeta(restaurant.businessType || restaurant.facilityPrefix);

  useEffect(() => {
    if (!canvasRef.current || !staffPortalUrl) return;
    QRCode.toCanvas(
      canvasRef.current,
      staffPortalUrl,
      {
        width: 148,
        margin: 2,
        color: { dark: '#09090B', light: '#FFFFFF' },
      },
      () => {}
    );
  }, [staffPortalUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(staffPortalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const handleCopyFacilityCode = async () => {
    if (!facilityCode) return;
    try {
      await navigator.clipboard.writeText(facilityCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const handleDownloadQr = () => {
    if (!canvasRef.current) return;
    const pngUrl = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `staff-portal-${restaurant.slug}.png`;
    a.click();
  };

  const codeLineEn = facilityCode ? `\nFacility Code: ${facilityCode}` : '';
  const codeLineAr = facilityCode ? `\nكود المنشأة للدخول الموحد: ${facilityCode}` : '';
  const waMessage = encodeURIComponent(
    isEn
      ? `Hello, here is the Staff Portal link for "${restDisplayName}":\n${staffPortalUrl}${codeLineEn}\nYou can sign in using your username, phone number, or email and password.`
      : `مرحباً، رابط بوابة دخول الكادر لمطعم "${restDisplayName}":\n${staffPortalUrl}${codeLineAr}\nيمكنكم تسجيل الدخول باستخدام اسم المستخدم أو رقم الهاتف أو البريد الإلكتروني وكلمة المرور.`
  );
  const waHref = `https://wa.me/?text=${waMessage}`;

  return (
    <section
      dir={dir}
      className="bg-white border-2 border-indigo-200 rounded-2xl p-4 sm:p-5 shadow-2xs"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-2.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-extrabold">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{isEn ? 'Dedicated Staff Portal' : 'صفحة الكادر المخصّصة'}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-bold">
              <Building2 className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
              <span>{isEn ? activityMeta.labelEn : activityMeta.labelAr}</span>
            </span>
            <span className="text-xs font-bold text-emerald-700 font-mono-num">
              {isEn ? `${managersCount} Active Managers` : `${managersCount} مدير مفعّل`}
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-extrabold text-zinc-950">
            {isEn
              ? `Team Access Portal & Link (${restDisplayName})`
              : `رابط وبوابة دخول فريق العمل (${restDisplayName})`}
          </h3>
          <p className="text-xs text-zinc-600 leading-relaxed max-w-2xl">
            {isEn
              ? 'Managers, cashiers, chefs, baristas, pastry staff, and captains use either the direct portal link or the Facility Code from the main login screen.'
              : 'يستخدم فريق العمل هذا الرابط المباشر أو كود المنشأة من شاشة الدخول الموحدة لفتح شاشاتهم المصرّح بها فقط دون الوصول لإعدادات المالك.'}
          </p>

          {facilityCode && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-300">
              <div className="space-y-0.5 min-w-0">
                <p className="text-[11px] font-bold text-amber-900">
                  {isEn ? 'Unified Facility Login Code' : 'كود المنشأة للدخول الموحد (من الصفحة الرئيسية)'}
                </p>
                <p
                  dir="ltr"
                  className="text-base sm:text-lg font-black font-mono-num tracking-wider text-zinc-950 select-all"
                >
                  {facilityCode}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyFacilityCode}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>
                  {copiedCode
                    ? isEn
                      ? 'Code Copied'
                      : 'تم نسخ الكود'
                    : isEn
                      ? 'Copy Code'
                      : 'نسخ الكود'}
                </span>
              </button>
            </div>
          )}

          <div
            dir="ltr"
            className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono-num text-zinc-900"
          >
            <span className="truncate select-all">{staffPortalUrl}</span>
            <span className="text-[11px] text-zinc-500 font-bold shrink-0">{staffPortalPath}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>
                {copied
                  ? isEn
                    ? 'Copied'
                    : 'تم النسخ'
                  : isEn
                    ? 'Copy Staff Link'
                    : 'نسخ رابط الكادر'}
              </span>
            </button>

            <a
              href={staffPortalPath}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[38px] px-3.5 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{isEn ? 'Open Portal' : 'فتح الصفحة'}</span>
            </a>

            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{isEn ? 'Share via WhatsApp' : 'مشاركة عبر واتساب'}</span>
            </a>

            <button
              type="button"
              onClick={handleDownloadQr}
              className="min-h-[38px] px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isEn ? 'Download QR' : 'تحميل رمز الدخول'}</span>
            </button>
          </div>
        </div>

        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3 flex flex-col items-center gap-1.5 shrink-0 self-center md:self-auto">
          <canvas ref={canvasRef} className="rounded-lg bg-white" />
          <span className="text-[11px] font-bold text-zinc-600 inline-flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5 text-indigo-600" />
            <span>{isEn ? 'Staff Portal QR' : 'رمز بوابة الكادر'}</span>
          </span>
        </div>
      </div>
    </section>
  );
}
