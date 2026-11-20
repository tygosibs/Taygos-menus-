import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Cake,
  Check,
  Code2,
  Eye,
  Loader2,
  Monitor,
  Palette,
  Smartphone,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { DEMO_RESTAURANTS } from '../../data/demoRestaurants';
import { COLOR_PRESETS, getThemeMeta, isCustomThemeId, MENU_THEMES } from '../../data/themes';
import { autoSuggestEnglish } from '../../data/translations';
import {
  createRestaurant,
  fetchActiveCustomThemes,
  isSlugAvailable,
  sanitizeSlug,
} from '../../lib/firestoreService';
import { CURATED_FOOD_IMAGES, uploadRestaurantAsset } from '../../lib/imageUtils';
import { ActiveTheme, CartItem, CustomTheme, MenuItem, Restaurant } from '../../types/menu';
import { SafeImage } from '../SafeImage';
import { CartDrawer } from '../menu/CartDrawer';
import { ItemModal } from '../menu/ItemModal';
import { ThemeRenderer } from '../menu/ThemeRenderer';

interface OnboardingFormProps {
  ownerId: string;
  ownerDisplayName: string;
  onCreated: (restaurant: Restaurant) => void;
}

export function OnboardingForm({ ownerId, ownerDisplayName, onCreated }: OnboardingFormProps) {
  const { lang, dir, isRtl, t, loc } = useLanguage();
  const isEn = lang === 'en';
  const previewFrameRef = useRef<HTMLDivElement | null>(null);

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Restaurant Core Details
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [taglineEn, setTaglineEn] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [ownerBirthday, setOwnerBirthday] = useState('');
  const [currency, setCurrency] = useState('ج.م');
  const [taxRate, setTaxRate] = useState(14);
  const [serviceCharge, setServiceCharge] = useState(12);
  const [logoUrl, setLogoUrl] = useState(CURATED_FOOD_IMAGES[0].url);
  const [seedStarterMenu, setSeedStarterMenu] = useState(true);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [validatingStep1, setValidatingStep1] = useState(false);

  // Step 2: Open Theme Selection & Interactive Preview
  const [activeTheme, setActiveTheme] = useState<ActiveTheme>('theme-1');
  const [primaryColor, setPrimaryColor] = useState('#A61C1C');
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [previewViewport, setPreviewViewport] = useState<'mobile' | 'desktop'>('mobile');
  const [previewSelectedItem, setPreviewSelectedItem] = useState<MenuItem | null>(null);
  const [previewCart, setPreviewCart] = useState<CartItem[]>([]);
  const [previewCartOpen, setPreviewCartOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveCustomThemes().then(setCustomThemes);
  }, []);

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
    setErrorMsg(null);
    try {
      const url = await uploadRestaurantAsset(file, ownerId, 'logo');
      setLogoUrl(url);
    } catch {
      setErrorMsg(
        isEn
          ? 'Failed to upload logo. You can choose a preset image or try again.'
          : 'تعذر رفع اللوجو. يمكنك اختيار صورة جاهزة أو المحاولة مجدداً.'
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleAutoFillEn = () => {
    if (name.trim() && !nameEn.trim()) {
      setNameEn(autoSuggestEnglish(name));
    }
    if (tagline.trim() && !taglineEn.trim()) {
      setTaglineEn(autoSuggestEnglish(tagline));
    }
  };

  const handleNextStep = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (name.trim().length < 2) {
      setErrorMsg(t.onboarding.errRequired);
      return;
    }
    const cleanSlug = sanitizeSlug(slug);
    if (cleanSlug.length < 2) {
      setErrorMsg(t.onboarding.errSlugInvalid);
      return;
    }
    if (whatsappNumber.trim().length < 7) {
      setErrorMsg(t.onboarding.errRequired);
      return;
    }

    setValidatingStep1(true);
    try {
      const available = await isSlugAvailable(cleanSlug);
      if (!available) {
        setSlugStatus('taken');
        setErrorMsg(t.onboarding.errSlugTaken);
        return;
      }
      setSlug(cleanSlug);
      setSlugStatus('available');
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : isEn ? 'Could not verify URL slug' : 'تعذر التحقق من الرابط'
      );
    } finally {
      setValidatingStep1(false);
    }
  };

  const handleCreateRestaurant = async () => {
    setErrorMsg(null);
    const cleanSlug = sanitizeSlug(slug);
    if (name.trim().length < 2 || cleanSlug.length < 2 || whatsappNumber.trim().length < 7) {
      setStep(1);
      setErrorMsg(t.onboarding.errRequired);
      return;
    }

    setSubmitting(true);
    try {
      const available = await isSlugAvailable(cleanSlug);
      if (!available) {
        setStep(1);
        setSlugStatus('taken');
        setErrorMsg(t.onboarding.errSlugTaken);
        return;
      }

      const created = await createRestaurant({
        ownerId,
        name,
        name_en: nameEn,
        slug: cleanSlug,
        tagline,
        tagline_en: taglineEn,
        whatsappNumber,
        ownerBirthday,
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
      setErrorMsg(
        err instanceof Error ? err.message : isEn ? 'Failed to create restaurant' : 'تعذر إنشاء المطعم'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Virtual Preview Bundle for Step 2
  const demoBundle = DEMO_RESTAURANTS['buns-lab'];
  const virtualRestaurant = useMemo<Restaurant>(
    () => ({
      id: 'onboarding_preview',
      ownerId,
      slug: sanitizeSlug(slug) || 'my-restaurant',
      name: name.trim() || (isEn ? 'My Restaurant' : 'مطعمي الجديد'),
      name_en: nameEn.trim() || name.trim() || 'My Restaurant',
      tagline: tagline.trim() || (isEn ? 'Freshly crafted dishes' : 'أشهى الأطباق والمشروبات الطازجة'),
      tagline_en: taglineEn.trim() || 'Freshly crafted dishes & drinks',
      whatsappNumber: whatsappNumber.trim() || '201012345678',
      logoUrl,
      activeTheme,
      primaryColor,
      taxRate,
      serviceCharge,
      currency,
      isOpen: true,
      createdAt: null,
      updatedAt: null,
    }),
    [
      ownerId,
      slug,
      name,
      nameEn,
      tagline,
      taglineEn,
      whatsappNumber,
      logoUrl,
      activeTheme,
      primaryColor,
      taxRate,
      serviceCharge,
      currency,
      isEn,
    ]
  );

  const selectedCustomTheme = useMemo(
    () =>
      isCustomThemeId(activeTheme)
        ? customThemes.find((ct) => ct.id === activeTheme) || null
        : null,
    [activeTheme, customThemes]
  );

  const selectedThemeMeta = useMemo(() => getThemeMeta(activeTheme), [activeTheme]);

  const selectedThemeTitle = selectedCustomTheme
    ? loc(selectedCustomTheme.name, selectedCustomTheme.name_en)
    : loc(selectedThemeMeta.name, selectedThemeMeta.englishName);

  const selectedThemeDesc = selectedCustomTheme
    ? loc(selectedCustomTheme.description, selectedCustomTheme.description_en) ||
      loc(selectedThemeMeta.description, selectedThemeMeta.description_en)
    : loc(selectedThemeMeta.description, selectedThemeMeta.description_en);

  const handleSelectTheme = (nextTheme: ActiveTheme, recommendedColor?: string) => {
    setActiveTheme(nextTheme);
    if (recommendedColor) {
      setPrimaryColor(recommendedColor);
    }
    setPreviewSelectedItem(null);
    previewFrameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handlePreviewAddToCart = (incoming: CartItem) => {
    setPreviewCart((prev) => {
      const idx = prev.findIndex((c) => c.cartKey === incoming.cartKey);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + incoming.quantity };
        return next;
      }
      return [...prev, incoming];
    });
  };

  const handlePreviewQuickStep = (item: MenuItem, delta: number) => {
    const defaultSize = item.sizes && item.sizes.length > 0 ? item.sizes[0] : undefined;
    const unitPrice = defaultSize ? defaultSize.price : item.basePrice;
    const quickKey = `${item.id}__${defaultSize?.name || 'std'}____`;
    setPreviewCart((prev) => {
      const idx = prev.findIndex((c) => c.cartKey === quickKey);
      if (idx >= 0) {
        const nextQty = prev[idx].quantity + delta;
        if (nextQty <= 0) return prev.filter((_, i) => i !== idx);
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: nextQty };
        return next;
      }
      if (delta > 0) {
        return [
          ...prev,
          {
            cartKey: quickKey,
            menuItem: item,
            selectedSize: defaultSize,
            selectedAddons: [],
            quantity: delta,
            unitPrice,
          },
        ];
      }
      return prev;
    });
  };

  const previewCartCount = useMemo(
    () => previewCart.reduce((s, c) => s + c.quantity, 0),
    [previewCart]
  );

  const previewCartTotal = useMemo(() => {
    const sub = previewCart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
    const svc = (sub * (serviceCharge || 0)) / 100;
    const tax = ((sub + svc) * (taxRate || 0)) / 100;
    return sub + svc + tax;
  }, [previewCart, serviceCharge, taxRate]);

  return (
    <div dir={dir} className={`${step === 2 ? 'max-w-5xl' : 'max-w-3xl'} mx-auto py-4 sm:py-8 px-3 sm:px-4 transition-all overflow-x-clip max-w-full`}>
      {/* 2-Step Progress Stepper (Responsive Grid — zero horizontal overflow on 360px phones) */}
      <div className="mb-5 sm:mb-6 bg-white border border-zinc-200 rounded-2xl p-2 sm:p-3.5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          className={`min-w-0 w-full flex items-center gap-2 sm:gap-3 px-2.5 py-2 sm:p-2.5 rounded-xl text-start transition-colors cursor-pointer ${
            step === 1 ? 'bg-zinc-950 text-white' : 'bg-emerald-50 text-emerald-900'
          }`}
        >
          <span
            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-mono-num text-[11px] sm:text-xs font-extrabold shrink-0 ${
              step === 1 ? 'bg-white text-zinc-950' : 'bg-emerald-600 text-white'
            }`}
          >
            {step > 1 ? <Check className="w-3.5 h-3.5" /> : '1'}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-extrabold truncate">
              <span className="sm:hidden">{isEn ? '1. Details' : '١. البيانات'}</span>
              <span className="hidden sm:inline">
                {isEn ? 'Step 1: Basic Info' : 'الخطوة ١: بيانات المطعم'}
              </span>
            </p>
            <p className={`hidden sm:block text-[11px] truncate ${step === 1 ? 'text-zinc-300' : 'text-emerald-700'}`}>
              {isEn ? 'Name, URL & contact' : 'الاسم والرابط والواتساب'}
            </p>
          </div>
        </button>

        <div className="text-zinc-300 shrink-0 px-0.5">
          {isRtl ? <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
        </div>

        <button
          type="button"
          disabled={step === 1}
          onClick={() => step === 2 && setStep(2)}
          className={`min-w-0 w-full flex items-center gap-2 sm:gap-3 px-2.5 py-2 sm:p-2.5 rounded-xl text-start transition-colors ${
            step === 2
              ? 'bg-zinc-950 text-white'
              : 'bg-zinc-50 text-zinc-400 cursor-not-allowed'
          }`}
        >
          <span
            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-mono-num text-[11px] sm:text-xs font-extrabold shrink-0 ${
              step === 2 ? 'bg-white text-zinc-950' : 'bg-zinc-200 text-zinc-500'
            }`}
          >
            2
          </span>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-extrabold truncate">
              <span className="sm:hidden">{isEn ? '2. Theme' : '٢. الثيم'}</span>
              <span className="hidden sm:inline">
                {isEn ? 'Step 2: Preview & Pick Theme' : 'الخطوة ٢: المعاينة واختيار الثيم'}
              </span>
            </p>
            <p className={`hidden sm:block text-[11px] truncate ${step === 2 ? 'text-zinc-300' : 'text-zinc-400'}`}>
              {isEn ? 'All themes unlocked to preview' : 'جميع الثيمات متاحة للمعاينة الحية'}
            </p>
          </div>
        </button>
      </div>

      {/* STEP 1: RESTAURANT DETAILS */}
      {step === 1 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-8 space-y-6 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 pb-5">
            <div className="space-y-1.5 min-w-0">
              <p className="text-xs font-semibold text-[#A61C1C] truncate">
                {isEn ? `Welcome, ${ownerDisplayName}` : `مرحباً، ${ownerDisplayName}`}
              </p>
              <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-950">{t.onboarding.title}</h1>
              <p className="text-xs sm:text-sm text-zinc-600">{t.onboarding.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={handleAutoFillEn}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-600" />
              <span>{t.onboarding.autoFillEn}</span>
            </button>
          </div>

          <form onSubmit={handleNextStep} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  {t.onboarding.nameArLabel}
                </label>
                <input
                  type="text"
                  dir="rtl"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.onboarding.nameArPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  {t.onboarding.nameEnLabel}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder={t.onboarding.nameEnPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm text-left focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  {t.onboarding.slugLabel}
                </label>
                <div className="flex items-center rounded-xl border border-zinc-200 overflow-hidden focus-within:border-zinc-500 min-w-0">
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="dar-kitchen"
                    className="min-w-0 flex-1 px-3.5 py-2.5 text-sm font-mono-num text-left focus:outline-none"
                  />
                  <span className="px-3 py-2.5 bg-zinc-50 text-zinc-500 text-xs font-mono-num border-s border-zinc-200 shrink-0">
                    /menu/
                  </span>
                </div>
                {slugStatus === 'checking' && (
                  <p className="text-[11px] text-zinc-500 mt-1">{t.onboarding.slugChecking}</p>
                )}
                {slugStatus === 'available' && (
                  <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                    {t.onboarding.slugAvailable}
                  </p>
                )}
                {slugStatus === 'taken' && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium">{t.onboarding.slugTaken}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  {t.onboarding.whatsappLabel}
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  required
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="201012345678"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num text-left focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-extrabold text-amber-950">
                <Cake className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {isEn
                    ? 'Your Birthday (for exclusive platform gifts & discounts 🎂)'
                    : 'تاريخ ميلادك (للحصول على هدايا وخصومات حصرية من المنصة 🎂)'}
                </span>
              </label>
              <input
                type="date"
                dir="ltr"
                value={ownerBirthday}
                onChange={(e) => setOwnerBirthday(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full sm:w-64 px-3.5 py-2 rounded-xl border border-amber-200 bg-white text-sm font-mono-num focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  {t.onboarding.currencyLabel}
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white focus:outline-none"
                >
                  <option value="ج.م">{isEn ? 'Egyptian Pound (EGP)' : 'جنيه مصري (ج.م)'}</option>
                  <option value="ر.س">{isEn ? 'Saudi Riyal (SAR)' : 'ريال سعودي (ر.س)'}</option>
                  <option value="د.إ">{isEn ? 'UAE Dirham (AED)' : 'درهم إماراتي (د.إ)'}</option>
                  <option value="د.ك">{isEn ? 'Kuwaiti Dinar (KWD)' : 'دينار كويتي (د.ك)'}</option>
                  <option value="$">{isEn ? 'US Dollar ($)' : 'دولار ($)'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  {t.admin.themes.taxRateLabel}
                </label>
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
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  {t.admin.themes.serviceChargeLabel}
                </label>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  {t.onboarding.taglineArLabel}
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder={t.onboarding.taglineArPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  {t.onboarding.taglineEnLabel}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={taglineEn}
                  onChange={(e) => setTaglineEn(e.target.value)}
                  placeholder={t.onboarding.taglineEnPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm text-left focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-zinc-700">{t.onboarding.logoLabel}</label>
              <div className="flex flex-wrap items-center gap-4">
                <SafeImage
                  src={logoUrl}
                  alt="Restaurant Logo"
                  className="w-16 h-16 rounded-2xl object-cover border border-zinc-200"
                />
                <label className="px-4 py-2.5 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer flex items-center gap-2">
                  {uploadingLogo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>
                    {uploadingLogo ? t.onboarding.logoUploading : t.onboarding.logoPlaceholder}
                  </span>
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
                  <span>{t.onboarding.seedCheckboxTitle}</span>
                </p>
                <p className="text-amber-800 mt-0.5">{t.onboarding.seedCheckboxDesc}</p>
              </div>
            </label>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={validatingStep1}
              className="w-full py-3.5 rounded-xl bg-zinc-950 text-white font-bold text-sm hover:bg-zinc-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {validatingStep1 ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>
                    {isEn ? 'Next: Preview & Pick Your Theme' : 'التالي: معاينة واختيار ثيم المنيو'}
                  </span>
                  {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* STEP 2: OPEN THEME GALLERY & LIVE INTERACTIVE PREVIEW */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Open Gallery Header */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-zinc-950">
                {isEn
                  ? 'All Themes Unlocked — Preview & Pick Yours'
                  : 'اختر تصميم منيو مطعمك مع المعاينة الحية'}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-600 mt-1">
                {isEn
                  ? 'Browse every built-in and custom theme, test them live with your restaurant name and logo, and approve the one you love.'
                  : 'استعرض جميع الثيمات الاحترافية والثيمات المخصصة، جرّب التصفح والطلب مباشرة، ثم اعتمد الثيم المناسب لإنشاء لوحة التحكم.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              <span>{isEn ? 'Back to Details' : 'تعديل البيانات'}</span>
            </button>
          </div>

          {/* 2-Column Photo Cards Grid */}
          <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {MENU_THEMES.map((themeItem) => {
                const isSelected = activeTheme === themeItem.id;
                const themeName = loc(themeItem.name, themeItem.englishName);
                const secondaryName = isEn ? themeItem.name : themeItem.englishName;
                return (
                  <article
                    key={themeItem.id}
                    onClick={() => handleSelectTheme(themeItem.id, themeItem.recommendedColor)}
                    className={`group rounded-2xl overflow-hidden border bg-white text-start transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-zinc-950 ring-2 ring-zinc-950 shadow-md'
                        : 'border-zinc-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-zinc-300'
                    }`}
                  >
                    <div className="aspect-[4/3] bg-zinc-100 overflow-hidden relative">
                      <SafeImage
                        src={themeItem.coverImage}
                        alt={themeName}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/15" />
                      <span className="absolute top-2.5 start-2.5 px-2 py-0.5 rounded-md bg-black/65 backdrop-blur-xs text-white text-[11px] font-mono-num font-bold">
                        {String(themeItem.number).padStart(2, '0')}
                      </span>
                      {isSelected && (
                        <span className="absolute top-2.5 end-2.5 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1 shadow-sm">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>{isEn ? 'Selected' : 'مختار'}</span>
                        </span>
                      )}
                      {themeItem.badge ? (
                        <span
                          className={`absolute ${
                            isSelected ? 'bottom-2.5 start-2.5' : 'top-2.5 end-2.5'
                          } px-2.5 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-extrabold shadow-md ${
                            themeItem.badge.includes('VIP')
                              ? 'bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-zinc-950 border border-amber-200'
                              : 'bg-gradient-to-r from-orange-500 to-rose-600 text-white'
                          }`}
                        >
                          {loc(themeItem.badge, themeItem.badge_en)}
                        </span>
                      ) : (
                        !isSelected &&
                        themeItem.isFlagship && (
                          <span className="absolute top-2.5 end-2.5 px-2 py-0.5 rounded-md bg-amber-400 text-zinc-950 text-[10px] font-extrabold flex items-center gap-1 shadow-sm">
                            <Sparkles className="w-3 h-3" />
                            <span className="hidden sm:inline">
                              {isEn ? 'Flagship' : 'الأكثر تميزاً'}
                            </span>
                          </span>
                        )
                      )}
                    </div>

                    <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between gap-2.5">
                      <div className="space-y-0.5">
                        <p className="text-[11px] text-zinc-500 truncate">{secondaryName}</p>
                        <h4 className="text-xs sm:text-base font-extrabold text-zinc-950 line-clamp-1">
                          {themeName}
                        </h4>
                      </div>
                      <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                          style={{
                            backgroundColor: isSelected ? primaryColor : themeItem.recommendedColor,
                          }}
                        />
                        <span
                          className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 whitespace-nowrap ${
                            isSelected
                              ? 'bg-zinc-950 text-white'
                              : 'bg-zinc-100 text-zinc-800 group-hover:bg-zinc-950 group-hover:text-white transition-colors'
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>
                            {isSelected
                              ? isEn
                                ? 'Previewing'
                                : 'قيد المعاينة'
                              : isEn
                                ? 'Preview'
                                : 'معاينة'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}

              {customThemes.map((ct) => {
                const customId = ct.id as ActiveTheme;
                const isSelected = activeTheme === customId;
                const ctName = loc(ct.name, ct.name_en);
                return (
                  <article
                    key={ct.id}
                    onClick={() => handleSelectTheme(customId)}
                    className={`group rounded-2xl overflow-hidden border bg-white text-start transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-zinc-950 ring-2 ring-zinc-950 shadow-md'
                        : 'border-zinc-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-zinc-300'
                    }`}
                  >
                    <div className="aspect-[4/3] bg-zinc-900 overflow-hidden relative">
                      <SafeImage
                        src={
                          ct.previewImage ||
                          '/src/assets/images/theme_flipbook_3d_1794974837314.jpg'
                        }
                        alt={ctName}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/15" />
                      <span className="absolute top-2.5 start-2.5 px-2 py-0.5 rounded-md bg-amber-400 text-zinc-950 text-[10px] font-extrabold flex items-center gap-1">
                        <Code2 className="w-3 h-3" />
                        <span>{isEn ? 'Custom' : 'مخصص'}</span>
                      </span>
                      {isSelected && (
                        <span className="absolute top-2.5 end-2.5 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1 shadow-sm">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>{isEn ? 'Selected' : 'مختار'}</span>
                        </span>
                      )}
                    </div>

                    <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between gap-2.5">
                      <div className="space-y-0.5">
                        <p className="text-[11px] text-amber-700 font-bold truncate">
                          {t.admin.themes.customThemesBadge}
                        </p>
                        <h4 className="text-xs sm:text-base font-extrabold text-zinc-950 line-clamp-1">
                          {ctName}
                        </h4>
                      </div>
                      <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                        <span className="font-mono-num text-[10px] text-zinc-400 truncate" dir="ltr">
                          {ct.id}
                        </span>
                        <span
                          className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 whitespace-nowrap ${
                            isSelected
                              ? 'bg-zinc-950 text-white'
                              : 'bg-zinc-100 text-zinc-800 group-hover:bg-zinc-950 group-hover:text-white transition-colors'
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>{isSelected ? (isEn ? 'Previewing' : 'قيد المعاينة') : (isEn ? 'Preview' : 'معاينة')}</span>
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Live Interactive Preview Frame & Final Approval CTA */}
          <section
            ref={previewFrameRef}
            className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs"
          >
            <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/70 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-extrabold text-zinc-950">
                  {isEn ? 'Live Preview with Your Brand' : 'معاينة حية باسم وشعار مطعمك'}
                </span>
                <span className="text-xs text-zinc-400" aria-hidden="true">
                  ·
                </span>
                <span className="text-xs font-bold text-zinc-700">{selectedThemeTitle}</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-zinc-500 me-0.5" />
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setPrimaryColor(c.hex)}
                      title={loc(c.name, c.name_en)}
                      style={{ backgroundColor: c.hex }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer border-2 transition-transform ${
                        primaryColor.toLowerCase() === c.hex.toLowerCase()
                          ? 'border-zinc-950 scale-110'
                          : 'border-white shadow-xs hover:scale-105'
                      }`}
                    >
                      {primaryColor.toLowerCase() === c.hex.toLowerCase() && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </button>
                  ))}
                  <label className="flex items-center gap-1 px-2 py-1 rounded-lg border border-zinc-200 bg-white text-[11px] cursor-pointer">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-4 h-4 border-0 bg-transparent cursor-pointer"
                    />
                    <span className="font-mono-num font-semibold text-zinc-700" dir="ltr">
                      {primaryColor}
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-200/70">
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('mobile')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      previewViewport === 'mobile'
                        ? 'bg-white text-zinc-950 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Mobile' : 'جوال'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('desktop')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      previewViewport === 'desktop'
                        ? 'bg-white text-zinc-950 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Wide' : 'شاشة كاملة'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-6 bg-zinc-100/80 border-b border-zinc-200">
              <div
                style={{ transform: 'translateZ(0)' }}
                className={`relative overflow-hidden transition-all duration-200 bg-white ${
                  previewViewport === 'mobile'
                    ? 'max-w-[395px] mx-auto h-[460px] sm:h-[560px] rounded-[24px] sm:rounded-[28px] border-[4px] sm:border-[6px] border-zinc-900 shadow-2xl'
                    : 'w-full h-[460px] sm:h-[560px] rounded-2xl border border-zinc-300 shadow-md'
                }`}
              >
                <div className="w-full h-full overflow-y-auto overflow-x-clip">
                  <ThemeRenderer
                    key={`${activeTheme}_${primaryColor}`}
                    restaurant={virtualRestaurant}
                    categories={demoBundle.categories}
                    items={demoBundle.items}
                    activeTheme={activeTheme}
                    customTheme={selectedCustomTheme}
                    cart={previewCart}
                    cartCount={previewCartCount}
                    cartTotal={previewCartTotal}
                    onSelectItem={(item) => setPreviewSelectedItem(item)}
                    onAddToCart={handlePreviewAddToCart}
                    onQuickStepItem={handlePreviewQuickStep}
                    onOpenCart={() => setPreviewCartOpen(true)}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
              <div className="space-y-1.5 min-w-0">
                <h3 className="text-base sm:text-lg font-extrabold text-zinc-950">{selectedThemeTitle}</h3>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-2xl">
                  {selectedThemeDesc}
                </p>
                {errorMsg && (
                  <p className="text-xs font-bold text-red-600 pt-1">{errorMsg}</p>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={submitting}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
                >
                  {isEn ? 'Edit Details' : 'تعديل البيانات'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleCreateRestaurant}
                  style={{ backgroundColor: primaryColor }}
                  className="min-h-[48px] px-5 sm:px-6 py-3 rounded-xl text-white font-extrabold text-sm hover:opacity-95 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {isEn ? 'Creating your workspace...' : 'جاري إنشاء لوحة تحكم مطعمك...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        {isEn
                          ? 'Approve Theme & Launch Dashboard'
                          : 'اعتماد الثيم وإنشاء لوحة التحكم'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Preview Sandbox Modals */}
          <ItemModal
            item={previewSelectedItem}
            allItems={demoBundle.items}
            currency={virtualRestaurant.currency}
            primaryColor={primaryColor}
            taxRate={taxRate}
            serviceCharge={serviceCharge}
            isDarkSurface={selectedThemeMeta.isDark}
            onClose={() => setPreviewSelectedItem(null)}
            onAddToCart={handlePreviewAddToCart}
            onQuickAddSuggested={(sug) => handlePreviewQuickStep(sug, 1)}
          />

          <CartDrawer
            open={previewCartOpen}
            restaurant={virtualRestaurant}
            cart={previewCart}
            allItems={demoBundle.items}
            isDemoMode={true}
            onClose={() => setPreviewCartOpen(false)}
            onUpdateQty={(cartKey, delta) => {
              setPreviewCart((prev) =>
                prev
                  .map((c) => (c.cartKey === cartKey ? { ...c, quantity: c.quantity + delta } : c))
                  .filter((c) => c.quantity > 0)
              );
            }}
            onRemoveItem={(cartKey) => {
              setPreviewCart((prev) => prev.filter((c) => c.cartKey !== cartKey));
            }}
            onQuickAddItem={(sug) => handlePreviewQuickStep(sug, 1)}
            onClearCart={() => setPreviewCart([])}
          />
        </div>
      )}
    </div>
  );
}
