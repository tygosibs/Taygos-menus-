import { FormEvent, useState } from 'react';
import { Check, Loader2, Sparkles, Upload } from 'lucide-react';
import { COLOR_PRESETS, MENU_THEMES } from '../../data/themes';
import { createRestaurant, isSlugAvailable, sanitizeSlug } from '../../lib/firestoreService';
import { CURATED_FOOD_IMAGES, uploadRestaurantAsset } from '../../lib/imageUtils';
import { ActiveTheme, Restaurant } from '../../types/menu';
import { SafeImage } from '../SafeImage';

interface OnboardingFormProps {
  ownerId: string;
  ownerDisplayName: string;
  onCreated: (restaurant: Restaurant) => void;
}

export function OnboardingForm({ ownerId, ownerDisplayName, onCreated }: OnboardingFormProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [currency, setCurrency] = useState('ج.م');
  const [taxRate, setTaxRate] = useState(14);
  const [serviceCharge, setServiceCharge] = useState(12);
  const [activeTheme, setActiveTheme] = useState<ActiveTheme>('theme-1');
  const [primaryColor, setPrimaryColor] = useState('#A61C1C');
  const [logoUrl, setLogoUrl] = useState(CURATED_FOOD_IMAGES[0].url);
  const [seedStarterMenu, setSeedStarterMenu] = useState(true);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSlugChange = async (val: string) => {
    const clean = sanitizeSlug(val);
    setSlug(clean);
    if (clean.length < 2) {
      setSlugStatus('idle');
      return;
    }
    setSlugStatus('checking');
    const available = await isSlugAvailable(clean);
    setSlugStatus(available ? 'available' : 'taken');
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const url = await uploadRestaurantAsset(file, ownerId, 'logo');
      setLogoUrl(url);
    } catch {
      setErrorMsg('تعذر رفع اللوجو. يمكنك اختيار صورة جاهزة أو المحاولة مجدداً.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (name.trim().length < 2) {
      setErrorMsg('يرجى إدخال اسم المطعم (حرفين على الأقل).');
      return;
    }
    const cleanSlug = sanitizeSlug(slug);
    if (cleanSlug.length < 2) {
      setErrorMsg('يرجى إدخال رابط مميز بالإنجليزية (مثال: my-restaurant).');
      return;
    }
    const available = await isSlugAvailable(cleanSlug);
    if (!available) {
      setSlugStatus('taken');
      setErrorMsg('هذا الرابط مستخدم بالفعل، يرجى اختيار رابط آخر.');
      return;
    }
    if (whatsappNumber.trim().length < 7) {
      setErrorMsg('يرجى إدخال رقم واتساب صحيح لاستقبال الطلبات.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createRestaurant({
        ownerId,
        name,
        slug: cleanSlug,
        tagline,
        whatsappNumber,
        logoUrl,
        activeTheme,
        primaryColor,
        taxRate,
        serviceCharge,
        currency,
        isOpen: true,
        seedStarterMenu,
      });
      onCreated(created);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إنشاء المطعم');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="max-w-3xl mx-auto py-8 px-4">
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="space-y-1.5 border-b border-zinc-100 pb-5">
          <p className="text-xs font-semibold text-[#A61C1C]">مرحباً، {ownerDisplayName}</p>
          <h1 className="text-2xl font-extrabold text-zinc-950">معالج الإعداد الأولي للمطعم</h1>
          <p className="text-sm text-zinc-600">
            أدخل بيانات مطعمك الأساسية لإنشاء رابط المنيو العام والانتقال مباشرة إلى لوحة التحكم.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                اسم المطعم أو الكافيه *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: مطعم دار الذواقة"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                الرابط المميز (Slug بالإنجليزية) *
              </label>
              <div className="flex items-center rounded-xl border border-zinc-200 overflow-hidden focus-within:border-zinc-500">
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="dar-kitchen"
                  className="flex-1 px-3.5 py-2.5 text-sm font-mono-num focus:outline-none"
                />
                <span className="px-3 py-2.5 bg-zinc-50 text-zinc-500 text-xs font-mono-num border-r border-zinc-200">
                  /menu/
                </span>
              </div>
              {slugStatus === 'checking' && (
                <p className="text-[11px] text-zinc-500 mt-1">جاري التحقق من توفر الرابط...</p>
              )}
              {slugStatus === 'available' && (
                <p className="text-[11px] text-emerald-700 mt-1 font-medium">الرابط متاح للاستخدام</p>
              )}
              {slugStatus === 'taken' && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">هذا الرابط محجوز مسبقاً</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                رقم الواتساب (مع رمز الدولة) *
              </label>
              <input
                type="tel"
                dir="ltr"
                required
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="201012345678"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">العملة</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white focus:outline-none"
              >
                <option value="ج.م">جنيه مصري (ج.م)</option>
                <option value="ر.س">ريال سعودي (ر.س)</option>
                <option value="د.إ">درهم إماراتي (د.إ)</option>
                <option value="د.ك">دينار كويتي (د.ك)</option>
                <option value="$">دولار ($)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">الضريبة %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">الخدمة %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={serviceCharge}
                  onChange={(e) => setServiceCharge(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5">
              الشعار النصي / الوصف المختصر (Tagline)
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="مثال: برجر ومشويات محضرة يومياً من أجود المكونات الطازجة..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-zinc-700">شعار المطعم (اللوجو)</label>
            <div className="flex flex-wrap items-center gap-4">
              <SafeImage
                src={logoUrl}
                alt="شعار المطعم"
                className="w-16 h-16 rounded-2xl object-cover border border-zinc-200"
              />
              <label className="px-4 py-2.5 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer flex items-center gap-2">
                {uploadingLogo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>{uploadingLogo ? 'جاري الرفع...' : 'رفع صورة الشعار'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(f);
                  }}
                />
              </label>
              <div className="flex items-center gap-1.5">
                {CURATED_FOOD_IMAGES.slice(0, 4).map((img) => (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => setLogoUrl(img.url)}
                    className={`w-10 h-10 rounded-lg overflow-hidden border-2 cursor-pointer ${
                      logoUrl === img.url ? 'border-zinc-950' : 'border-transparent opacity-70'
                    }`}
                  >
                    <SafeImage src={img.url} alt={img.label} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-zinc-700">اختر ثيم المنيو المبدئي</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {MENU_THEMES.map((t) => {
                const active = activeTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTheme(t.id)}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      active
                        ? 'border-zinc-950 bg-zinc-50 ring-1 ring-zinc-950'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono-num text-[11px] text-zinc-400">0{t.number}</span>
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: t.recommendedColor }}
                      />
                    </div>
                    <p className="text-xs font-bold text-zinc-900">{t.name}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-zinc-500 ml-2">اللون الأساسي:</span>
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setPrimaryColor(c.hex)}
                  title={c.name}
                  style={{ backgroundColor: c.hex }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer border-2 ${
                    primaryColor.toLowerCase() === c.hex.toLowerCase()
                      ? 'border-zinc-950 scale-110'
                      : 'border-white'
                  }`}
                >
                  {primaryColor.toLowerCase() === c.hex.toLowerCase() && (
                    <Check className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 p-4 rounded-xl bg-amber-50/70 border border-amber-200 cursor-pointer">
            <input
              type="checkbox"
              checked={seedStarterMenu}
              onChange={(e) => setSeedStarterMenu(e.target.checked)}
              className="w-4 h-4 accent-amber-600"
            />
            <div className="text-xs">
              <p className="font-bold text-amber-950 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>تعبئة أقسام ووجبات تجريبية جاهزة مع المطعم</span>
              </p>
              <p className="text-amber-800 mt-0.5">
                يضيف 3 أقسام و5 وجبات مع أحجام وإضافات لتجربة المنيو والطلبات فوراً.
              </p>
            </div>
          </label>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-zinc-950 text-white font-bold text-sm hover:bg-zinc-800 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'جاري إنشاء مساحة المطعم...' : 'حفظ البيانات والدخول للوحة التحكم'}
          </button>
        </form>
      </div>
    </div>
  );
}
