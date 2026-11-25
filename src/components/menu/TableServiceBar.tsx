import { useState } from 'react';
import {
  Banknote,
  BellRing,
  CheckCircle2,
  CreditCard,
  Edit3,
  MapPin,
  Receipt,
  Users,
  Utensils,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Restaurant, ServiceCallType } from '../../types/menu';

interface TableServiceBarProps {
  restaurant: Restaurant;
  hallName: string;
  tableNumber: string;
  guestName: string;
  activeGuests: string[];
  isDarkSurface: boolean;
  isDemoMode: boolean;
  onEditGuestOrTable: () => void;
  onSendServiceCall: (callType: ServiceCallType) => Promise<void>;
}

export function TableServiceBar({
  restaurant,
  hallName,
  tableNumber,
  guestName,
  activeGuests,
  isDarkSurface,
  onEditGuestOrTable,
  onSendServiceCall,
}: TableServiceBarProps) {
  const { lang, dir } = useLanguage();
  const isEn = lang === 'en';

  const [billMenuOpen, setBillMenuOpen] = useState(false);
  const [sendingType, setSendingType] = useState<ServiceCallType | null>(null);
  const [confirmationMsg, setConfirmationMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const labelForType = (type: ServiceCallType) => {
    if (isEn) {
      if (type === 'call_waiter') return 'Call Captain';
      if (type === 'request_bill_cash') return 'Bill Request (Cash)';
      if (type === 'request_bill_card') return 'Bill Request (Visa / Card)';
      return 'Cutlery & Water';
    }
    if (type === 'call_waiter') return 'نداء الكابتن';
    if (type === 'request_bill_cash') return 'طلب الفاتورة (كاش)';
    if (type === 'request_bill_card') return 'طلب الفاتورة (فيزا)';
    return 'أدوات طعام / مياه';
  };

  const triggerCall = async (callType: ServiceCallType) => {
    if (!tableNumber) {
      onEditGuestOrTable();
      return;
    }
    setSendingType(callType);
    setBillMenuOpen(false);
    setErrorMsg(null);
    try {
      await onSendServiceCall(callType);
      const label = labelForType(callType);
      setConfirmationMsg(
        isEn
          ? `Sent "${label}" for Table ${tableNumber}. Staff notified!`
          : `تم إرسال "${label}" لترابيزة ${tableNumber} بنجاح — سيصلك الكابتن فوراً!`
      );
      setTimeout(() => {
        setConfirmationMsg((prev) => (prev && prev.includes(label) ? null : prev));
      }, 4500);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not send request.'
            : 'تعذر إرسال النداء حالياً.'
      );
    } finally {
      setSendingType(null);
    }
  };

  if (!tableNumber) {
    return (
      <div
        dir={dir}
        className={`border-b px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2 ${
          isDarkSurface
            ? 'bg-zinc-900/95 border-zinc-800 text-zinc-200'
            : 'bg-amber-50/70 border-amber-200/80 text-stone-800'
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-bold min-w-0">
          <Users className="w-4 h-4 shrink-0" style={{ color: restaurant.primaryColor }} />
          <span className="truncate">
            {isEn
              ? 'Dining inside? Set your hall & table for group cart & captain service.'
              : 'تجلس داخل الصالة؟ حدّد الترابيزة والاسم للطلب الجماعي وخدمة الكابتن.'}
          </span>
        </div>
        <button
          type="button"
          onClick={onEditGuestOrTable}
          style={{ backgroundColor: restaurant.primaryColor }}
          className="px-3 py-1.5 rounded-lg text-white text-xs font-extrabold hover:opacity-95 shrink-0 cursor-pointer"
        >
          {isEn ? 'Select Table' : 'تحديد الترابيزة'}
        </button>
      </div>
    );
  }

  return (
    <div
      dir={dir}
      className={`border-b px-3 sm:px-5 py-2.5 space-y-2 ${
        isDarkSurface
          ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
          : 'bg-stone-50 border-stone-200 text-stone-900'
      }`}
    >
      {/* Table + Hall + Guest Identity Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
              isDarkSurface
                ? 'bg-zinc-800 border-zinc-700 text-amber-300'
                : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: restaurant.primaryColor }} />
            <span className="truncate">
              {hallName ? `${hallName} · ` : ''}
              {isEn ? `Table ${tableNumber}` : `ترابيزة ${tableNumber}`}
            </span>
          </span>

          <button
            type="button"
            onClick={onEditGuestOrTable}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              isDarkSurface
                ? 'bg-zinc-800/80 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
            }`}
          >
            <span>
              {isEn ? 'Guest:' : 'اسمك:'}{' '}
              <strong className={isDarkSurface ? 'text-white' : 'text-stone-950'}>
                {guestName || (isEn ? 'Set Name' : 'اكتب اسمك')}
              </strong>
            </span>
            <Edit3 className="w-3 h-3 opacity-70" />
          </button>
        </div>

        {activeGuests.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] opacity-85 overflow-x-auto no-scrollbar max-w-full">
            <Users className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
            <span className="whitespace-nowrap font-semibold">
              {isEn ? 'At table:' : 'على الترابيزة:'} {activeGuests.join(isEn ? ', ' : '، ')}
            </span>
          </div>
        )}
      </div>

      {/* Quick Service Action Bar */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={sendingType !== null}
          onClick={() => triggerCall('call_waiter')}
          className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 ${
            isDarkSurface
              ? 'bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700'
              : 'bg-white border-stone-200 text-stone-900 hover:border-stone-400 shadow-2xs'
          }`}
        >
          <BellRing className="w-3.5 h-3.5 shrink-0 text-amber-500" />
          <span className="truncate">
            {isEn ? 'Call Captain' : 'نادي الكابتن'}
          </span>
        </button>

        <div className="relative">
          <button
            type="button"
            disabled={sendingType !== null}
            onClick={() => setBillMenuOpen((v) => !v)}
            className={`w-full min-h-[40px] px-2.5 py-2 rounded-xl border text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 ${
              billMenuOpen
                ? 'border-emerald-500 bg-emerald-600 text-white'
                : isDarkSurface
                  ? 'bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700'
                  : 'bg-white border-stone-200 text-stone-900 hover:border-stone-400 shadow-2xs'
            }`}
          >
            <Receipt className={`w-3.5 h-3.5 shrink-0 ${billMenuOpen ? 'text-white' : 'text-emerald-600'}`} />
            <span className="truncate">
              {isEn ? 'Request Bill' : 'اطلب الفاتورة'}
            </span>
          </button>

          {billMenuOpen && (
            <div
              className={`absolute top-full mt-1.5 inset-x-0 z-40 rounded-xl border p-1.5 shadow-xl grid grid-cols-1 gap-1 ${
                isDarkSurface
                  ? 'bg-zinc-900 border-zinc-700 text-white'
                  : 'bg-white border-stone-200 text-stone-900'
              }`}
            >
              <button
                type="button"
                onClick={() => triggerCall('request_bill_cash')}
                className={`w-full px-2.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                  isDarkSurface ? 'hover:bg-zinc-800' : 'hover:bg-emerald-50 text-emerald-800'
                }`}
              >
                <Banknote className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{isEn ? 'Cash' : 'دفع كاش'}</span>
              </button>
              <button
                type="button"
                onClick={() => triggerCall('request_bill_card')}
                className={`w-full px-2.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                  isDarkSurface ? 'hover:bg-zinc-800' : 'hover:bg-blue-50 text-blue-800'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>{isEn ? 'Visa / Card' : 'دفع فيزا'}</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={sendingType !== null}
          onClick={() => triggerCall('cutlery_water')}
          className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 ${
            isDarkSurface
              ? 'bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700'
              : 'bg-white border-stone-200 text-stone-900 hover:border-stone-400 shadow-2xs'
          }`}
        >
          <Utensils className="w-3.5 h-3.5 shrink-0 text-sky-500" />
          <span className="truncate">
            {isEn ? 'Cutlery / Water' : 'أدوات / مياه'}
          </span>
        </button>
      </div>

      {confirmationMsg && (
        <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-600 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{confirmationMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/35 text-red-500 text-xs font-bold">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
