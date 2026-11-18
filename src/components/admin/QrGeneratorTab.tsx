import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Printer } from 'lucide-react';
import { Restaurant } from '../../types/menu';
import { SafeImage } from '../SafeImage';

interface QrGeneratorTabProps {
  restaurant: Restaurant;
}

export function QrGeneratorTab({ restaurant }: QrGeneratorTabProps) {
  const [tableLabel, setTableLabel] = useState('');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const targetUrl = tableLabel.trim()
    ? `${origin}/menu/${restaurant.slug}?table=${encodeURIComponent(tableLabel.trim())}`
    : `${origin}/menu/${restaurant.slug}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, targetUrl, {
      width: 260,
      margin: 2,
      color: {
        dark: '#09090B',
        light: '#FFFFFF',
      },
    }).catch((err) => console.error('QR generation failed:', err));
  }, [targetUrl]);

  const handleDownloadPng = async () => {
    const dataUrl = await QRCode.toDataURL(targetUrl, {
      width: 900,
      margin: 2,
      color: { dark: '#09090B', light: '#FFFFFF' },
    });
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `qr-${restaurant.slug}${tableLabel ? `-table-${tableLabel}` : ''}.png`;
    link.click();
  };

  const handleDownloadSvg = async () => {
    const svg = await QRCode.toString(targetUrl, {
      type: 'svg',
      margin: 2,
      color: { dark: '#09090B', light: '#FFFFFF' },
    });
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-${restaurant.slug}${tableLabel ? `-table-${tableLabel}` : ''}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <h2 className="text-lg font-extrabold text-zinc-950">مولد الكيو آر (QR Code Generator)</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          ولّد رمز QR عالي الدقة لرابط المنيو العام جاهز للتحميل أو الطباعة على الطاولات
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">رابط المنيو العام</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                dir="ltr"
                value={targetUrl}
                className="flex-1 px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono-num text-zinc-700"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-3 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold hover:bg-zinc-50 flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1.5">
              تخصيص رقم الطاولة على البطاقة (اختياري)
            </label>
            <input
              type="text"
              value={tableLabel}
              onChange={(e) => setTableLabel(e.target.value)}
              placeholder="مثال: طاولة 5 (اتركه فارغاً للكود العام)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              className="w-full py-3 px-4 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تحميل الكيو آر PNG</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSvg}
              className="w-full py-3 px-4 rounded-xl border border-zinc-300 text-zinc-800 text-xs font-bold hover:bg-zinc-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تحميل ملف SVG للطباعة</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              style={{ backgroundColor: restaurant.primaryColor }}
              className="w-full py-3 px-4 rounded-xl text-white text-xs font-bold hover:opacity-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة بطاقة الطاولة</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 flex justify-center">
          <div className="qr-print-area bg-white border border-zinc-200 rounded-3xl p-8 w-full max-w-sm text-center space-y-5 shadow-sm">
            <div className="space-y-2">
              {restaurant.logoUrl && (
                <SafeImage
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="w-16 h-16 rounded-2xl object-cover mx-auto border border-zinc-200"
                />
              )}
              <h3 className="text-xl font-extrabold text-zinc-950">{restaurant.name}</h3>
              {tableLabel.trim() && (
                <p
                  className="text-sm font-bold font-mono-num"
                  style={{ color: restaurant.primaryColor }}
                >
                  {tableLabel.trim()}
                </p>
              )}
            </div>

            <div className="p-4 rounded-2xl border-2 border-dashed border-zinc-200 inline-block bg-white">
              <canvas ref={canvasRef} className="mx-auto block" />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-bold text-zinc-900">امسح الكود بكاميرا الجوال</p>
              <p className="text-xs text-zinc-500">لتصفح المنيو الإلكتروني وتقديم طلبك مباشرة</p>
              <p className="text-[11px] font-mono-num text-zinc-400 pt-1" dir="ltr">
                /menu/{restaurant.slug}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
