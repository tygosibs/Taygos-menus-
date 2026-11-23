import React, { useEffect, useState } from 'react';
import {
  Bluetooth,
  CheckCircle2,
  Loader2,
  Printer,
  RefreshCw,
  Trash2,
  Usb,
  X,
  Zap,
} from 'lucide-react';
import { Restaurant } from '../../types/menu';
import {
  clearSavedPrinterProfile,
  getActivePrinterConnection,
  getPrinterHardwareCapabilities,
  getSavedPrinterProfile,
  pairBluetoothPrinter,
  pairSerialPrinter,
  pairUsbPrinter,
  printThermalJobsSequentially,
  SavedPrinterProfile,
  savePrinterProfile,
  ThermalPaperWidth,
  tryAutoReconnectSavedPrinter,
} from '../../lib/thermalPrinterService';
import { useLanguage } from '../../contexts/LanguageContext';

interface ThermalPrinterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: Restaurant;
  onProfileChanged?: (profile: SavedPrinterProfile | null) => void;
}

export const ThermalPrinterSettingsModal: React.FC<ThermalPrinterSettingsModalProps> = ({
  isOpen,
  onClose,
  restaurant,
  onProfileChanged,
}) => {
  const { lang, dir, loc, formatCurrency } = useLanguage();
  const isEn = lang === 'en';
  const [savedProfile, setSavedProfile] = useState<SavedPrinterProfile | null>(null);
  const [paperWidth, setPaperWidth] = useState<ThermalPaperWidth>(80);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const caps = getPrinterHardwareCapabilities();
  const activeConn = getActivePrinterConnection();

  useEffect(() => {
    if (!isOpen) return;
    const p = getSavedPrinterProfile();
    setSavedProfile(p);
    if (p?.paperWidth) setPaperWidth(p.paperWidth);
    setStatusMsg('');
    setErrorMsg('');
  }, [isOpen]);

  if (!isOpen) return null;

  const updatePaperWidth = (w: ThermalPaperWidth) => {
    setPaperWidth(w);
    if (savedProfile) {
      const next = { ...savedProfile, paperWidth: w, updatedAt: Date.now() };
      savePrinterProfile(next);
      setSavedProfile(next);
      onProfileChanged?.(next);
    }
  };

  const handlePair = async (kind: 'bluetooth' | 'serial' | 'usb' | 'browser') => {
    setBusy(true);
    setErrorMsg('');
    setStatusMsg('');
    try {
      let profile: SavedPrinterProfile;
      if (kind === 'bluetooth') {
        profile = await pairBluetoothPrinter(paperWidth);
      } else if (kind === 'serial') {
        profile = await pairSerialPrinter(paperWidth);
      } else if (kind === 'usb') {
        profile = await pairUsbPrinter(paperWidth);
      } else {
        profile = {
          transport: 'browser',
          name: isEn ? `Browser Print (${paperWidth}mm)` : `طباعة المتصفح (${paperWidth}mm)`,
          paperWidth,
          updatedAt: Date.now(),
        };
        savePrinterProfile(profile);
      }
      setSavedProfile(profile);
      onProfileChanged?.(profile);
      setStatusMsg(
        isEn
          ? `Printer paired and saved: ${profile.name}`
          : `تم ربط وحفظ الطابعة: ${profile.name}`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Unable to connect to printer.'
            : 'تعذر الاتصال بالطابعة.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleReconnect = async () => {
    setBusy(true);
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await tryAutoReconnectSavedPrinter();
      if (res.reconnected) {
        setStatusMsg(
          isEn
            ? `Reconnected to saved printer: ${res.profile?.name || ''}`
            : `تمت إعادة الاتصال بالطابعة المحفوظة: ${res.profile?.name || ''}`
        );
      } else {
        setErrorMsg(
          isEn
            ? 'Auto-reconnect failed. Ensure the printer is powered on and pair again.'
            : 'تعذر إعادة الاتصال التلقائي. تأكد من تشغيل الطابعة ثم اضغط إعادة الربط.'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleTestPrint = async () => {
    setBusy(true);
    setErrorMsg('');
    setStatusMsg('');
    const restDisplayName = loc(restaurant.name, restaurant.name_en);
    const currText = formatCurrency(restaurant.currency);
    try {
      const res = await printThermalJobsSequentially(
        [
          {
            jobTitle: isEn ? 'Thermal Print Test' : 'اختبار الطباعة الحرارية',
            headerBadge: isEn ? '*** PRINTER TEST ***' : '*** اختبار الطابعة ***',
            sections: [
              { type: 'title', text: restDisplayName },
              {
                type: 'subtitle',
                text: isEn ? 'Sufra QR Thermal Print Engine' : 'نظام سُفرة QR للطباعة الحرارية',
              },
              { type: 'divider', text: '' },
              {
                type: 'meta',
                text: isEn ? `Paper Width: ${paperWidth}mm` : `مقاس الورق: ${paperWidth}mm`,
                bold: true,
              },
              {
                type: 'meta',
                text: isEn
                  ? `Connection: ${activeConn.connected ? activeConn.name : 'Browser Print Dialog'}`
                  : `الاتصال: ${activeConn.connected ? activeConn.name : 'عبر نافذة الطباعة'}`,
              },
              { type: 'divider', text: '' },
              {
                type: 'item',
                text: isEn ? '2x Extra Arabic Shawarma' : '2× شاورما عربي إكسترا',
                rightText: `180 ${currText}`,
              },
              {
                type: 'item',
                text: isEn ? '1x Fresh Mango Juice' : '1× عصير مانجو فريش',
                rightText: `45 ${currText}`,
              },
              { type: 'divider', text: '' },
              {
                type: 'total',
                text: isEn ? 'Print Status:' : 'حالة الطباعة:',
                rightText: isEn ? 'Ready 100%' : 'جاهزة 100%',
              },
            ],
            cutAfter: true,
          },
        ],
        { paperWidth }
      );
      setStatusMsg(
        res.mode === 'hardware'
          ? isEn
            ? 'Test ticket sent directly to the thermal printer!'
            : 'تم إرسال تذكرة الاختبار إلى الطابعة الحرارية مباشرة!'
          : isEn
            ? 'Opened browser thermal print dialog (58mm/80mm).'
            : 'تم فتح نافذة طباعة المتصفح الحرارية (58mm/80mm).'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Error occurred during test print.'
            : 'حدث خطأ أثناء الطباعة التجريبية.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleClear = () => {
    clearSavedPrinterProfile();
    setSavedProfile(null);
    onProfileChanged?.(null);
    setStatusMsg(
      isEn
        ? 'Unlinked saved printer from this device.'
        : 'تم إلغاء ربط الطابعة المحفوظة من هذا الجهاز.'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" dir={dir}>
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-zinc-900" />
            <h4 className="text-base font-extrabold text-zinc-900">
              {isEn
                ? 'Direct Thermal Printer Settings (ESC/POS)'
                : 'إعدادات الطابعة الحرارية المباشرة (ESC/POS)'}
            </h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? 'Close' : 'إغلاق'}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Active connection banner */}
          <div
            className={`rounded-xl border p-3 text-xs ${
              activeConn.connected
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : savedProfile
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-extrabold">
                {activeConn.connected
                  ? isEn
                    ? `Connected: ${activeConn.name}`
                    : `متصل الآن: ${activeConn.name}`
                  : savedProfile
                    ? isEn
                      ? `Saved: ${savedProfile.name}`
                      : `محفوظة: ${savedProfile.name}`
                    : isEn
                      ? 'No hardware printer paired — browser printing will be used'
                      : 'لا توجد طابعة مربوطة حالياً — سيتم استخدام طباعة المتصفح'}
              </div>
              {savedProfile && savedProfile.transport !== 'browser' && !activeConn.connected && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleReconnect}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-amber-900 shadow-xs hover:bg-amber-100 cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  {isEn ? 'Reconnect' : 'إعادة الاتصال'}
                </button>
              )}
            </div>
          </div>

          {/* Paper width */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-zinc-700">
              {isEn ? 'Printer Paper Width' : 'عرض ورق الطابعة'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([80, 58] as ThermalPaperWidth[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => updatePaperWidth(w)}
                  className={`rounded-xl border px-3 py-2 text-xs font-extrabold transition cursor-pointer ${
                    paperWidth === w
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white'
                  }`}
                >
                  {isEn ? `${w}mm Thermal Paper` : `ورق حراري ${w}mm`}
                </button>
              ))}
            </div>
          </div>

          {/* Pairing options */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-zinc-700">
              {isEn ? 'Select Printer Connection Method' : 'اختر طريقة الاتصال بالطابعة'}
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => handlePair('bluetooth')}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-start transition hover:border-blue-400 hover:bg-blue-50/40 disabled:opacity-50 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Bluetooth className="h-4 w-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold text-zinc-900">
                      {isEn ? 'Direct Bluetooth (BLE)' : 'بلوتوث مباشر'}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {caps.bluetooth
                        ? isEn
                          ? 'Supported in this browser'
                          : 'مدعوم في هذا المتصفح'
                        : isEn
                          ? 'Not supported in this browser'
                          : 'غير مدعوم على هذا المتصفح'}
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => handlePair('serial')}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-start transition hover:border-emerald-400 hover:bg-emerald-50/40 disabled:opacity-50 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold text-zinc-900">
                      {isEn ? 'Serial / USB COM Port' : 'منفذ Serial / USB COM'}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {caps.serial
                        ? isEn
                          ? 'Supported in this browser'
                          : 'مدعوم في هذا المتصفح'
                        : isEn
                          ? 'Not supported in this browser'
                          : 'غير مدعوم على هذا المتصفح'}
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => handlePair('usb')}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-start transition hover:border-purple-400 hover:bg-purple-50/40 disabled:opacity-50 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Usb className="h-4 w-4 text-purple-600 shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold text-zinc-900">
                      {isEn ? 'Direct USB (WebUSB)' : 'منفذ USB مباشر'}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {caps.usb
                        ? isEn
                          ? 'Supported in this browser'
                          : 'مدعوم في هذا المتصفح'
                        : isEn
                          ? 'Not supported in this browser'
                          : 'غير مدعوم على هذا المتصفح'}
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => handlePair('browser')}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-start transition hover:border-zinc-500 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4 text-zinc-700 shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold text-zinc-900">
                      {isEn ? 'Browser Thermal Print' : 'طباعة المتصفح الحرارية'}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {isEn ? 'Compatible with all printers' : 'متوافقة مع جميع الطابعات'}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {statusMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
            {savedProfile ? (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isEn ? 'Remove Printer' : 'حذف الطابعة'}
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleTestPrint}
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                {isEn ? 'Print Test Ticket' : 'طباعة تذكرة تجريبية'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
