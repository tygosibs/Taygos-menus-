import { useEffect, useRef, useState } from 'react';
import { MapPin, Sparkles, UserCheck, Users, X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { normalizeHallName, normalizeTableNumber } from '../../lib/tableSessionUtils';
import { Hall, Restaurant } from '../../types/menu';
import { SafeImage } from '../SafeImage';

interface GuestNameModalProps {
  open: boolean;
  restaurant: Restaurant;
  halls?: Hall[];
  initialGuestName: string;
  initialHallName: string;
  initialTableNumber: string;
  allowTableEdit?: boolean;
  isDarkSurface?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    guestName: string;
    hallName: string;
    tableNumber: string;
  }) => void;
}

export function GuestNameModal({
  open,
  restaurant,
  halls = [],
  initialGuestName,
  initialHallName,
  initialTableNumber,
  allowTableEdit = false,
  isDarkSurface = false,
  onClose,
  onConfirm,
}: GuestNameModalProps) {
  const { lang, dir, loc } = useLanguage();
  const isEn = lang === 'en';

  const [guestName, setGuestName] = useState(initialGuestName);
  const [hallName, setHallName] = useState(initialHallName);
  const [tableNumber, setTableNumber] = useState(initialTableNumber);
  const [showTableFields, setShowTableFields] = useState(allowTableEdit || !initialTableNumber);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setGuestName(initialGuestName);
    setHallName(initialHallName);
    setTableNumber(initialTableNumber);
    setShowTableFields(allowTableEdit || !initialTableNumber);
    setErrorMsg(null);
    const timer = setTimeout(() => {
      nameRef.current?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, [open, initialGuestName, initialHallName, initialTableNumber, allowTableEdit]);

  if (!open) return null;

  const restName = loc(restaurant.name, restaurant.name_en);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = guestName.trim().slice(0, 60);
    const cleanTable = normalizeTableNumber(tableNumber);
    const cleanHall = normalizeHallName(hallName);

    if (!cleanName) {
      setErrorMsg(
        isEn ? 'Please enter your first name so your items are labeled.' : 'من فضلك اكتب اسمك الأول لتمييز طلباتك على الترابيزة.'
      );
      nameRef.current?.focus();
      return;
    }
    if (!cleanTable) {
      setErrorMsg(
        isEn ? 'Please enter your table number.' : 'من فضلك اكتب رقم الترابيزة.'
      );
      return;
    }

    onConfirm({
      guestName: cleanName,
      hallName: cleanHall,
      tableNumber: cleanTable,
    });
  };

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Join Table Session' : 'انضم لجلسة الترابيزة'}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border space-y-4 ${
          isDarkSurface
            ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
            : 'bg-white border-stone-200 text-stone-900'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {restaurant.logoUrl && (
              <SafeImage
                src={restaurant.logoUrl}
                alt={restName}
                className="w-11 h-11 rounded-2xl object-cover border border-black/10 shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>{isEn ? 'Group Table Ordering' : 'نظام الترابيزة الجماعية'}</span>
              </p>
              <h2 className="text-base sm:text-lg font-extrabold truncate">{restName}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? 'Close' : 'إغلاق'}
            className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer shrink-0 ${
              isDarkSurface
                ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!showTableFields && initialTableNumber && (
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
              isDarkSurface
                ? 'bg-zinc-800/70 border-zinc-700'
                : 'bg-amber-50/70 border-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold min-w-0">
              <MapPin className="w-4 h-4 shrink-0" style={{ color: restaurant.primaryColor }} />
              <span className="truncate">
                {hallName ? `${hallName} · ` : ''}
                {isEn ? `Table ${tableNumber}` : `ترابيزة ${tableNumber}`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowTableFields(true)}
              className="text-[11px] font-bold underline opacity-80 hover:opacity-100 shrink-0 cursor-pointer"
            >
              {isEn ? 'Change' : 'تغيير'}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {showTableFields && (
            <div className="space-y-3">
              {halls.length > 0 && (
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold opacity-80">
                    {isEn ? 'Choose Dining Hall / Zone:' : 'اختر الصالة / القسم:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {halls.map((h) => {
                      const active = hallName.trim() === h.name.trim();
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => setHallName(h.name)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                            active
                              ? 'bg-amber-500 text-zinc-950 border-amber-500'
                              : isDarkSurface
                                ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                                : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {loc(h.name, h.name_en)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1.5 opacity-85">
                    {isEn ? 'Hall / Zone (optional)' : 'اسم الصالة (اختياري)'}
                  </label>
                  <input
                    type="text"
                    value={hallName}
                    onChange={(e) => setHallName(e.target.value)}
                    placeholder={isEn ? 'e.g. Main Hall' : 'مثال: الصالة الرئيسية'}
                    maxLength={60}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none ${
                      isDarkSurface
                        ? 'bg-zinc-800 border-zinc-700 text-white focus:border-amber-400'
                        : 'bg-stone-50 border-stone-200 text-stone-900 focus:border-stone-400'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 opacity-85">
                    {isEn ? 'Table Number *' : 'رقم الترابيزة *'}
                  </label>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => {
                      setTableNumber(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder={isEn ? 'e.g. 5' : 'مثال: 5'}
                    maxLength={20}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono-num focus:outline-none ${
                      isDarkSurface
                        ? 'bg-zinc-800 border-zinc-700 text-white focus:border-amber-400'
                        : 'bg-stone-50 border-stone-200 text-stone-900 focus:border-stone-400'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold mb-1.5 opacity-90">
              {isEn ? 'Your First Name *' : 'اكتب اسمك الأول للانضمام للترابيزة *'}
            </label>
            <input
              ref={nameRef}
              type="text"
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                setErrorMsg(null);
              }}
              placeholder={isEn ? 'e.g. Ahmed' : 'مثال: أحمد'}
              maxLength={60}
              className={`w-full px-4 py-3 rounded-xl border text-base font-bold focus:outline-none ${
                isDarkSurface
                  ? 'bg-zinc-800 border-zinc-700 text-white focus:border-amber-400'
                  : 'bg-stone-50 border-stone-200 text-stone-900 focus:border-stone-400'
              }`}
            />
            <p className="text-[11px] mt-1.5 opacity-70 leading-relaxed flex items-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
              <span>
                {isEn
                  ? 'Your name tags every dish you add so the shared table cart splits the bill automatically by person.'
                  : 'سيتم ربط أصنافك باسمك في السلة المشتركة لتقسيم الفاتورة تلقائياً حسب اسم كل شخص على الترابيزة.'}
              </span>
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-500 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            style={{ backgroundColor: restaurant.primaryColor }}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>
              {isEn ? 'Start Ordering on This Table' : 'تأكيد الاسم والانضمام للترابيزة'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
