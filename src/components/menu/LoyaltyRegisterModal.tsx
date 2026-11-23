import { FormEvent, useEffect, useState } from 'react';
import { Cake, Check, Gift, Loader2, LogOut, MapPin, Phone, User, X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getContrastOnAccent } from '../../lib/contrastUtils';
import {
  clearCustomerPhone,
  getDemoCustomerProfile,
  normalizeCustomerPhone,
  saveCustomerPhone,
  saveDemoCustomerProfile,
} from '../../lib/customerLoyaltyUtils';
import {
  fetchCustomerProfile,
  registerOrUpdateCustomerProfile,
} from '../../lib/firestoreService';
import { CustomerProfile, LoyaltyConfig, OrderType, Restaurant } from '../../types/menu';

interface LoyaltyRegisterModalProps {
  open: boolean;
  restaurant: Restaurant;
  loyaltyConfig: Required<LoyaltyConfig>;
  existingCustomer: CustomerProfile | null;
  isDemoMode: boolean;
  isDarkSurface: boolean;
  onClose: () => void;
  onSuccess: (customer: CustomerProfile) => void;
  onSignedOut: () => void;
}

const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 85 }, (_, i) => CURRENT_YEAR - 10 - i);

export function LoyaltyRegisterModal({
  open,
  restaurant,
  loyaltyConfig,
  existingCustomer,
  isDemoMode,
  isDarkSurface,
  onClose,
  onSuccess,
  onSignedOut,
}: LoyaltyRegisterModalProps) {
  const { lang, dir } = useLanguage();
  const isEn = lang === 'en';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDay, setBirthDay] = useState(1);
  const [birthMonth, setBirthMonth] = useState(1);
  const [birthYear, setBirthYear] = useState(1995);
  const [preferredOrderType, setPreferredOrderType] = useState<OrderType>('dine_in');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFullName(existingCustomer?.fullName || '');
    setPhone(existingCustomer?.phone || '');
    setBirthDay(existingCustomer?.birthDay || 1);
    setBirthMonth(existingCustomer?.birthMonth || 1);
    setBirthYear(existingCustomer?.birthYear || 1995);
    setPreferredOrderType(existingCustomer?.preferredOrderType || 'dine_in');
    setAddress(existingCustomer?.address || '');
    setError(null);
  }, [open, existingCustomer]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const accent = restaurant.primaryColor || '#A61C1C';
  const accentText = getContrastOnAccent(accent);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = fullName.trim();
    const cleanPhone = normalizeCustomerPhone(phone);

    if (!cleanName) {
      setError(isEn ? 'Please enter your full name.' : 'يرجى كتابة الاسم الكامل.');
      return;
    }
    if (cleanPhone.length < 6) {
      setError(
        isEn
          ? 'Please enter a valid mobile number (at least 6 digits).'
          : 'يرجى كتابة رقم هاتف صحيح (6 أرقام على الأقل).'
      );
      return;
    }
    if (preferredOrderType === 'delivery' && !address.trim()) {
      setError(
        isEn
          ? 'Please enter your delivery address.'
          : 'يرجى كتابة عنوان التوصيل بما أن طلبك المفضل دليفري.'
      );
      return;
    }

    setSaving(true);
    try {
      let savedProfile: CustomerProfile;

      if (isDemoMode) {
        const existingDemo = getDemoCustomerProfile(restaurant.slug, cleanPhone);
        const nowMs = Date.now();
        savedProfile = existingDemo
          ? {
              ...existingDemo,
              fullName: cleanName,
              birthDay,
              birthMonth,
              birthYear,
              preferredOrderType,
              address: address.trim(),
              updatedAt: nowMs,
            }
          : {
              id: cleanPhone,
              restaurantId: restaurant.id,
              ownerId: restaurant.ownerId,
              fullName: cleanName,
              phone: cleanPhone,
              birthDay,
              birthMonth,
              birthYear,
              preferredOrderType,
              ...(address.trim() ? { address: address.trim() } : {}),
              totalOrders: 0,
              loyaltyCycleOrders: 0,
              firstOrderDiscountUsed: false,
              favoriteItems: [],
              lastOrderItems: [],
              createdAt: nowMs,
              updatedAt: nowMs,
            };
        saveDemoCustomerProfile(restaurant.slug, savedProfile);
      } else {
        savedProfile = await registerOrUpdateCustomerProfile({
          restaurantId: restaurant.id,
          ownerId: restaurant.ownerId,
          fullName: cleanName,
          phone: cleanPhone,
          birthDay,
          birthMonth,
          birthYear,
          preferredOrderType,
          address: address.trim(),
        });
      }

      saveCustomerPhone(restaurant.slug, savedProfile.phone);
      onSuccess(savedProfile);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not save your profile. Please try again.'
            : 'تعذر حفظ البيانات، يرجى المحاولة مرة أخرى.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleQuickLookup = async () => {
    const cleanPhone = normalizeCustomerPhone(phone);
    if (cleanPhone.length < 6) {
      setError(
        isEn ? 'Enter your registered mobile number first.' : 'اكتب رقم هاتفك المسجل أولاً.'
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const found = isDemoMode
        ? getDemoCustomerProfile(restaurant.slug, cleanPhone)
        : await fetchCustomerProfile(restaurant.id, cleanPhone);
      if (!found) {
        setError(
          isEn
            ? 'No profile found for this number yet — fill your name and birth date below to join!'
            : 'هذا الرقم غير مسجل بعد — أكمل اسمك وتاريخ ميلادك بالأسفل للتسجيل!'
        );
        return;
      }
      saveCustomerPhone(restaurant.slug, found.phone);
      onSuccess(found);
      onClose();
    } catch {
      setError(isEn ? 'Lookup failed, please fill the form below.' : 'تعذر البحث، أكمل البيانات بالأسفل.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    clearCustomerPhone(restaurant.slug);
    onSignedOut();
    onClose();
  };

  const surfaceClass = isDarkSurface
    ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
    : 'bg-white border-stone-200 text-stone-900';

  const inputClass = isDarkSurface
    ? 'bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500'
    : 'bg-stone-50 border-stone-200 text-stone-900 placeholder:text-stone-400 focus:border-stone-400';

  const mutedText = isDarkSurface ? 'text-zinc-400' : 'text-stone-500';

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Loyalty Registration' : 'التسجيل في برنامج الولاء'}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden max-h-[92vh] flex flex-col ${surfaceClass}`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between gap-3 shrink-0 ${
            isDarkSurface ? 'border-zinc-800' : 'border-stone-100'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              style={{ backgroundColor: accent, color: accentText }}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            >
              <Gift className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold truncate">
                {existingCustomer
                  ? isEn
                    ? 'Your Loyalty Profile'
                    : 'تحديث بياناتك ومكافآتك'
                  : isEn
                    ? 'Quick Rewards Sign-Up'
                    : 'سجّل برقمك في ثوانٍ'}
              </h2>
              <p className={`text-[11px] truncate ${mutedText}`}>
                {loyaltyConfig.firstOrderEnabled && loyaltyConfig.firstOrderDiscountPercent > 0
                  ? isEn
                    ? `${loyaltyConfig.firstOrderDiscountPercent}% first-order discount + birthday surprise`
                    : `خصم ${loyaltyConfig.firstOrderDiscountPercent}% على أول طلب + هدية عيد ميلادك`
                  : isEn
                    ? 'Loyalty rewards + special birthday surprise'
                    : 'مكافآت الولاء + هدية خاصة في عيد ميلادك'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? 'Close' : 'إغلاق'}
            className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer shrink-0 ${
              isDarkSurface
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold leading-relaxed">
              {error}
            </div>
          )}

          {/* Phone */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-bold flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 opacity-70" />
                <span>{isEn ? 'Mobile Number' : 'رقم الهاتف'}</span>
              </label>
              {!existingCustomer && (
                <button
                  type="button"
                  onClick={handleQuickLookup}
                  className="text-[11px] font-bold underline underline-offset-2 cursor-pointer opacity-85 hover:opacity-100"
                  style={{ color: isDarkSurface ? '#fbbf24' : accent }}
                >
                  {isEn ? 'Already registered? Restore' : 'مسجل من قبل؟ استرجع نقاطك'}
                </button>
              )}
            </div>
            <input
              type="tel"
              dir="ltr"
              value={phone}
              disabled={Boolean(existingCustomer)}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01012345678"
              className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm font-mono-num focus:outline-none disabled:opacity-60 ${inputClass}`}
              required
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="text-xs font-bold flex items-center gap-1.5 mb-1.5">
              <User className="w-3.5 h-3.5 opacity-70" />
              <span>{isEn ? 'Full Name' : 'الاسم الكامل'}</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={isEn ? 'e.g. Ahmed Mohamed' : 'مثال: أحمد محمد'}
              className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none ${inputClass}`}
              required
            />
          </div>

          {/* Birth Date */}
          <div>
            <label className="text-xs font-bold flex items-center gap-1.5 mb-1.5">
              <Cake className="w-3.5 h-3.5 opacity-70" />
              <span>{isEn ? 'Birth Date' : 'تاريخ الميلاد'}</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={birthDay}
                onChange={(e) => setBirthDay(Number(e.target.value))}
                aria-label={isEn ? 'Birth Day' : 'اليوم'}
                className={`min-h-[44px] px-2.5 py-2 rounded-xl border text-xs font-bold font-mono-num focus:outline-none ${inputClass}`}
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={birthMonth}
                onChange={(e) => setBirthMonth(Number(e.target.value))}
                aria-label={isEn ? 'Birth Month' : 'الشهر'}
                className={`min-h-[44px] px-2 py-2 rounded-xl border text-xs font-bold focus:outline-none ${inputClass}`}
              >
                {(isEn ? MONTHS_EN : MONTHS_AR).map((label, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={birthYear}
                onChange={(e) => setBirthYear(Number(e.target.value))}
                aria-label={isEn ? 'Birth Year' : 'السنة'}
                className={`min-h-[44px] px-2.5 py-2 rounded-xl border text-xs font-bold font-mono-num focus:outline-none ${inputClass}`}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <p className={`text-[11px] mt-1.5 leading-relaxed ${mutedText}`}>
              {isEn
                ? 'To receive a special discount or birthday treat on your birthday'
                : 'للحصول على خصم أو هدية خاصة في عيد ميلادك'}
            </p>
          </div>

          {/* Preferred Order Type */}
          <div>
            <label className="block text-xs font-bold mb-1.5">
              {isEn ? 'Preferred Order Type' : 'نوع الطلب المفضل'}
            </label>
            <div
              className={`grid grid-cols-3 gap-1.5 p-1 rounded-xl ${
                isDarkSurface ? 'bg-zinc-950 border border-zinc-800' : 'bg-stone-100'
              }`}
            >
              {(
                [
                  { id: 'dine_in', label: isEn ? 'Dine-In' : 'صالة' },
                  { id: 'pickup', label: isEn ? 'Takeaway' : 'تيك أواي' },
                  { id: 'delivery', label: isEn ? 'Delivery' : 'دليفري' },
                ] as { id: OrderType; label: string }[]
              ).map((opt) => {
                const active = preferredOrderType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPreferredOrderType(opt.id)}
                    style={active ? { backgroundColor: accent, color: accentText } : undefined}
                    className={`min-h-[44px] rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                      active
                        ? 'shadow-sm'
                        : isDarkSurface
                          ? 'text-zinc-400 hover:text-white'
                          : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="text-xs font-bold flex items-center gap-1.5 mb-1.5">
              <MapPin className="w-3.5 h-3.5 opacity-70" />
              <span>
                {preferredOrderType === 'delivery'
                  ? isEn
                    ? 'Delivery Address'
                    : 'عنوان التوصيل'
                  : isEn
                    ? 'Address (Optional)'
                    : 'العنوان (اختياري)'}
              </span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required={preferredOrderType === 'delivery'}
              placeholder={
                isEn
                  ? 'Street, building, floor, apartment...'
                  : 'الشارع، رقم العمارة، الدور، الشقة...'
              }
              className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none ${inputClass}`}
            />
          </div>

          <div className="pt-1 flex flex-col gap-2">
            <button
              type="submit"
              disabled={saving}
              style={{ backgroundColor: accent, color: accentText }}
              className="w-full min-h-[48px] py-3 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>
                {existingCustomer
                  ? isEn
                    ? 'Save Profile Updates'
                    : 'حفظ التعديلات'
                  : isEn
                    ? 'Join & Claim Reward'
                    : 'سجّل واحصل على المكافأة'}
              </span>
            </button>

            {existingCustomer && (
              <button
                type="button"
                onClick={handleSignOut}
                className={`w-full min-h-[44px] py-2 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                  isDarkSurface
                    ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                    : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isEn ? 'Switch Phone Number' : 'تسجيل الخروج / تغيير الرقم'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
