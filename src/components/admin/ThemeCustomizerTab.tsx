import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Code2,
  Columns,
  ExternalLink,
  Eye,
  Loader2,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Sun,
  Upload,
  Wand2,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { DEMO_RESTAURANTS } from '../../data/demoRestaurants';
import { COLOR_PRESETS, getThemeMeta, isCustomThemeId, MENU_THEMES } from '../../data/themes';
import { autoSuggestEnglish } from '../../data/translations';
import { CONTRAST_TYPOGRAPHY_PRESETS } from '../../lib/contrastUtils';
import {
  fetchActiveCustomThemes,
  isSlugAvailable,
  sanitizeSlug,
  subscribeCategories,
  subscribeMenuItems,
  updateRestaurantSettings,
  updateRestaurantThemeAndTaxes,
} from '../../lib/firestoreService';
import { CURATED_FOOD_IMAGES, uploadRestaurantAsset } from '../../lib/imageUtils';
import {
  ActiveTheme,
  CartItem,
  Category,
  CustomTheme,
  MenuColorMode,
  MenuItem,
  Restaurant,
} from '../../types/menu';
import { SafeImage } from '../SafeImage';
import { SharePreviewCard } from '../SharePreviewCard';
import { CartDrawer } from '../menu/CartDrawer';
import { ItemModal } from '../menu/ItemModal';
import { ThemeRenderer } from '../menu/ThemeRenderer';
import {
  resolveRestaurantShareDescription,
  resolveRestaurantShareTitle,
} from '../../lib/seoHead';

interface ThemeCustomizerTabProps {
  restaurant: Restaurant;
  onRestaurantUpdated: (updated: Restaurant) => void;
  onOpenPublicMenu: (path: string) => void;
}

export function ThemeCustomizerTab({
  restaurant,
  onRestaurantUpdated,
  onOpenPublicMenu,
}: ThemeCustomizerTabProps) {
  const { lang, dir, t, loc } = useLanguage();
  const isEn = lang === 'en';
  const previewCardRef = useRef<HTMLDivElement | null>(null);

  // Selected theme currently being previewed in the Live Theme Preview Card
  const [selectedPreviewTheme, setSelectedPreviewTheme] = useState<ActiveTheme>(
    restaurant.activeTheme
  );
  const [primaryColor, setPrimaryColor] = useState(restaurant.primaryColor);
  const [colorMode, setColorMode] = useState<MenuColorMode>(restaurant.colorMode || 'auto');
  const [headingColor, setHeadingColor] = useState(restaurant.headingColor || '');
  const [descriptionColor, setDescriptionColor] = useState(restaurant.descriptionColor || '');
  const [priceColor, setPriceColor] = useState(restaurant.priceColor || '');
  const [menuColumns, setMenuColumns] = useState<1 | 2 | 3>(restaurant.menuColumns || 2);
  const [taxRate, setTaxRate] = useState(restaurant.taxRate);
  const [serviceCharge, setServiceCharge] = useState(restaurant.serviceCharge);
  const [deliveryFee, setDeliveryFee] = useState(restaurant.deliveryFee ?? 0);

  const [activatingTheme, setActivatingTheme] = useState(false);
  const [themeSavedMsg, setThemeSavedMsg] = useState<string | null>(null);
  const [themeErrorMsg, setThemeErrorMsg] = useState<string | null>(null);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);

  // Live restaurant menu data for the interactive preview frame
  const [ownerCategories, setOwnerCategories] = useState<Category[]>([]);
  const [ownerItems, setOwnerItems] = useState<MenuItem[]>([]);
  const [previewViewport, setPreviewViewport] = useState<'mobile' | 'desktop'>('mobile');
  const [previewSelectedItem, setPreviewSelectedItem] = useState<MenuItem | null>(null);
  const [previewCart, setPreviewCart] = useState<CartItem[]>([]);
  const [previewCartOpen, setPreviewCartOpen] = useState(false);

  // Store settings
  const [name, setName] = useState(restaurant.name);
  const [nameEn, setNameEn] = useState(restaurant.name_en || '');
  const [slug, setSlug] = useState(restaurant.slug);
  const [tagline, setTagline] = useState(restaurant.tagline || '');
  const [taglineEn, setTaglineEn] = useState(restaurant.tagline_en || '');
  const [whatsappNumber, setWhatsappNumber] = useState(restaurant.whatsappNumber);
  const [currency, setCurrency] = useState(restaurant.currency);
  const [logoUrl, setLogoUrl] = useState(restaurant.logoUrl || '');
  const [shareTitle, setShareTitle] = useState(restaurant.shareTitle || '');
  const [shareTitleEn, setShareTitleEn] = useState(restaurant.shareTitle_en || '');
  const [shareDescription, setShareDescription] = useState(restaurant.shareDescription || '');
  const [shareDescriptionEn, setShareDescriptionEn] = useState(
    restaurant.shareDescription_en || ''
  );
  const [isOpen, setIsOpen] = useState(restaurant.isOpen);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveCustomThemes().then(setCustomThemes);
  }, []);

  useEffect(() => {
    const unsubCats = subscribeCategories(restaurant.id, setOwnerCategories);
    const unsubItems = subscribeMenuItems(restaurant.id, setOwnerItems);
    return () => {
      unsubCats();
      unsubItems();
    };
  }, [restaurant.id]);

  // Keep local state aligned if parent restaurant updates or Concierge switches tenants
  useEffect(() => {
    setSelectedPreviewTheme(restaurant.activeTheme);
    setPrimaryColor(restaurant.primaryColor);
    setColorMode(restaurant.colorMode || 'auto');
    setHeadingColor(restaurant.headingColor || '');
    setDescriptionColor(restaurant.descriptionColor || '');
    setPriceColor(restaurant.priceColor || '');
    setMenuColumns(restaurant.menuColumns || 2);
    setTaxRate(restaurant.taxRate);
    setServiceCharge(restaurant.serviceCharge);
    setDeliveryFee(restaurant.deliveryFee ?? 0);
    setName(restaurant.name);
    setNameEn(restaurant.name_en || '');
    setSlug(restaurant.slug);
    setTagline(restaurant.tagline || '');
    setTaglineEn(restaurant.tagline_en || '');
    setWhatsappNumber(restaurant.whatsappNumber);
    setCurrency(restaurant.currency);
    setLogoUrl(restaurant.logoUrl || '');
    setShareTitle(restaurant.shareTitle || '');
    setShareTitleEn(restaurant.shareTitle_en || '');
    setShareDescription(restaurant.shareDescription || '');
    setShareDescriptionEn(restaurant.shareDescription_en || '');
    setIsOpen(restaurant.isOpen);
    setThemeSavedMsg(null);
    setThemeErrorMsg(null);
    setSettingsMsg(null);
    setSettingsError(null);
  }, [
    restaurant.id,
    restaurant.activeTheme,
    restaurant.primaryColor,
    restaurant.colorMode,
    restaurant.headingColor,
    restaurant.descriptionColor,
    restaurant.priceColor,
    restaurant.menuColumns,
    restaurant.taxRate,
    restaurant.serviceCharge,
    restaurant.deliveryFee,
    restaurant.name,
    restaurant.name_en,
    restaurant.slug,
    restaurant.tagline,
    restaurant.tagline_en,
    restaurant.whatsappNumber,
    restaurant.currency,
    restaurant.logoUrl,
    restaurant.shareTitle,
    restaurant.shareTitle_en,
    restaurant.shareDescription,
    restaurant.shareDescription_en,
    restaurant.isOpen,
  ]);

  const demoBundle = DEMO_RESTAURANTS['buns-lab'];
  const hasRealDishes = useMemo(
    () => ownerCategories.length > 0 && ownerItems.some((item) => item.isAvailable),
    [ownerCategories, ownerItems]
  );

  const previewCategories = hasRealDishes ? ownerCategories : demoBundle.categories;
  const previewItems = hasRealDishes ? ownerItems : demoBundle.items;

  const previewRestaurant = useMemo<Restaurant>(
    () => ({
      ...restaurant,
      name: name || restaurant.name,
      name_en: nameEn || restaurant.name_en,
      tagline: tagline || restaurant.tagline,
      tagline_en: taglineEn || restaurant.tagline_en,
      logoUrl: logoUrl || restaurant.logoUrl,
      currency: currency || restaurant.currency,
      isOpen,
      taxRate,
      serviceCharge,
      deliveryFee,
      activeTheme: selectedPreviewTheme,
      primaryColor,
      colorMode,
      headingColor,
      descriptionColor,
      priceColor,
      menuColumns,
    }),
    [
      restaurant,
      name,
      nameEn,
      tagline,
      taglineEn,
      logoUrl,
      currency,
      isOpen,
      taxRate,
      serviceCharge,
      deliveryFee,
      selectedPreviewTheme,
      primaryColor,
      colorMode,
      headingColor,
      descriptionColor,
      priceColor,
      menuColumns,
    ]
  );

  const selectedCustomTheme = useMemo(
    () =>
      isCustomThemeId(selectedPreviewTheme)
        ? customThemes.find((ct) => ct.id === selectedPreviewTheme) || null
        : null,
    [selectedPreviewTheme, customThemes]
  );

  const selectedThemeMeta = useMemo(
    () => getThemeMeta(selectedPreviewTheme),
    [selectedPreviewTheme]
  );

  const selectedThemeFullName = selectedCustomTheme
    ? loc(selectedCustomTheme.name, selectedCustomTheme.name_en)
    : loc(selectedThemeMeta.name, selectedThemeMeta.englishName);

  const selectedThemeDescription = selectedCustomTheme
    ? loc(selectedCustomTheme.description, selectedCustomTheme.description_en) ||
      loc(selectedThemeMeta.description, selectedThemeMeta.description_en)
    : loc(selectedThemeMeta.description, selectedThemeMeta.description_en);

  const isSelectedAlreadyActive =
    restaurant.activeTheme === selectedPreviewTheme &&
    restaurant.primaryColor.toLowerCase() === primaryColor.toLowerCase() &&
    (restaurant.colorMode || 'auto') === colorMode &&
    (restaurant.menuColumns || 2) === menuColumns &&
    (restaurant.headingColor || '').toLowerCase() === headingColor.toLowerCase() &&
    (restaurant.descriptionColor || '').toLowerCase() === descriptionColor.toLowerCase() &&
    (restaurant.priceColor || '').toLowerCase() === priceColor.toLowerCase();

  const handleSelectIconForPreview = (nextThemeId: ActiveTheme) => {
    setSelectedPreviewTheme(nextThemeId);
    setThemeSavedMsg(null);
    setThemeErrorMsg(null);
    setPreviewSelectedItem(null);
    // Smoothly scroll preview card into view only if partially off-screen
    previewCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleActivateSelectedTheme = async () => {
    setActivatingTheme(true);
    setThemeSavedMsg(null);
    setThemeErrorMsg(null);
    try {
      await updateRestaurantThemeAndTaxes(restaurant.id, {
        activeTheme: selectedPreviewTheme,
        primaryColor,
        taxRate,
        serviceCharge,
        colorMode,
        headingColor,
        descriptionColor,
        priceColor,
        menuColumns,
      });
      onRestaurantUpdated({
        ...restaurant,
        activeTheme: selectedPreviewTheme,
        primaryColor,
        taxRate,
        serviceCharge,
        colorMode,
        headingColor,
        descriptionColor,
        priceColor,
        menuColumns,
      });
      setThemeSavedMsg(
        isEn
          ? `"${selectedThemeFullName}" is now live on your customer menu!`
          : `تم تفعيل ثيم "${selectedThemeFullName}" وحفظ الألوان وتخطيط العرض بنجاح.`
      );
      setTimeout(() => setThemeSavedMsg(null), 4000);
    } catch (err) {
      setThemeErrorMsg(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not activate theme. Please try again.'
            : 'تعذر حفظ وتفعيل الثيم، يرجى المحاولة مرة أخرى.'
      );
    } finally {
      setActivatingTheme(false);
    }
  };

  // Preview Cart Handlers (sandboxed in memory)
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

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const url = await uploadRestaurantAsset(file, restaurant.ownerId, 'logo');
      setLogoUrl(url);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleAutoFillEn = () => {
    if (name.trim() && !nameEn.trim()) setNameEn(autoSuggestEnglish(name));
    if (tagline.trim() && !taglineEn.trim()) setTaglineEn(autoSuggestEnglish(tagline));
    if (shareTitle.trim() && !shareTitleEn.trim()) setShareTitleEn(autoSuggestEnglish(shareTitle));
    if (shareDescription.trim() && !shareDescriptionEn.trim()) {
      setShareDescriptionEn(autoSuggestEnglish(shareDescription));
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    setSettingsMsg(null);

    const cleanSlug = sanitizeSlug(slug);
    if (cleanSlug.length < 2) {
      setSettingsError(t.onboarding.errSlugInvalid);
      return;
    }
    if (cleanSlug !== restaurant.slug) {
      const avail = await isSlugAvailable(cleanSlug, restaurant.id);
      if (!avail) {
        setSettingsError(t.onboarding.errSlugTaken);
        return;
      }
    }

    setSavingSettings(true);
    try {
      const updated = await updateRestaurantSettings(restaurant, {
        name,
        name_en: nameEn,
        slug: cleanSlug,
        tagline,
        tagline_en: taglineEn,
        whatsappNumber,
        logoUrl,
        shareTitle,
        shareTitle_en: shareTitleEn,
        shareDescription,
        shareDescription_en: shareDescriptionEn,
        currency,
        isOpen,
        taxRate,
        serviceCharge,
        deliveryFee,
        primaryColor,
        colorMode,
        headingColor,
        descriptionColor,
        priceColor,
        menuColumns,
      });
      onRestaurantUpdated(updated);
      setSlug(updated.slug);
      setSettingsMsg(t.admin.themes.savedToast);
      setTimeout(() => setSettingsMsg(null), 3500);
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : isEn ? 'Failed to save settings' : 'تعذر حفظ الإعدادات'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div dir={dir} className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-zinc-950">{t.admin.themes.title}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{t.admin.themes.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenPublicMenu(`/menu/${restaurant.slug}?preview=1`)}
          className="px-4 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer"
        >
          <ExternalLink className="w-4 h-4" />
          <span>{t.admin.themes.previewLink}</span>
        </button>
      </div>

      {/* 1. Luxury 2-Column Photo Cards Grid */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-950">
              1. {isEn ? 'Choose a Theme Design to Preview' : 'اختر تصميم المنيو لمعاينته وتفعيله'}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isEn
                ? 'Tap any theme card below to inspect an interactive live preview with your restaurant menu.'
                : 'اضغط على أي بطاقة لاستعراض الثيم تفاعلياً ببيانات مطعمك في شاشة المعاينة بالأسفل.'}
            </p>
          </div>
          {themeSavedMsg && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
              {themeSavedMsg}
            </span>
          )}
        </div>

        {/* 2-Column Full-Photo Cards Grid (9 Built-In + Custom Injected) */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {MENU_THEMES.map((themeItem) => {
            const isSelected = selectedPreviewTheme === themeItem.id;
            const isLive = restaurant.activeTheme === themeItem.id;
            const themeName = loc(themeItem.name, themeItem.englishName);
            const secondaryName = isEn ? themeItem.name : themeItem.englishName;

            return (
              <article
                key={themeItem.id}
                onClick={() => handleSelectIconForPreview(themeItem.id)}
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

                  {isLive && (
                    <span className="absolute top-2.5 end-2.5 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1 shadow-sm">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>{isEn ? 'Active' : 'مُفعّل'}</span>
                    </span>
                  )}

                  {themeItem.badge ? (
                    <span
                      className={`absolute ${
                        isLive ? 'bottom-2.5 start-2.5' : 'top-2.5 end-2.5'
                      } px-2.5 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-extrabold shadow-md ${
                        themeItem.badge.includes('VIP')
                          ? 'bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-zinc-950 border border-amber-200'
                          : 'bg-gradient-to-r from-orange-500 to-rose-600 text-white'
                      }`}
                    >
                      {loc(themeItem.badge, themeItem.badge_en)}
                    </span>
                  ) : (
                    !isLive &&
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
                          : isLive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
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
            const isSelected = selectedPreviewTheme === customId;
            const isLive = restaurant.activeTheme === customId;
            const ctName = loc(ct.name, ct.name_en);

            return (
              <article
                key={ct.id}
                onClick={() => handleSelectIconForPreview(customId)}
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
                  {isLive && (
                    <span className="absolute top-2.5 end-2.5 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1 shadow-sm">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>{isEn ? 'Active' : 'مُفعّل'}</span>
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
                          : isLive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
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
        </div>
      </section>

      {/* 2. Embedded Live Theme Preview Card (Directly Below the Icons Grid) */}
      <section
        ref={previewCardRef}
        className="bg-white border border-zinc-200 rounded-2xl overflow-hidden"
      >
        {/* Preview Controls Header */}
        <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-extrabold text-zinc-950">
              {isEn ? 'Live Interactive Preview' : 'شاشة المعاينة الحية التفاعلية'}
            </span>
            <span className="text-xs text-zinc-400" aria-hidden="true">
              ·
            </span>
            <span className="text-xs text-zinc-600">
              {hasRealDishes
                ? isEn
                  ? 'Using your live restaurant menu'
                  : 'تعرض أصناف مطعمك الفعلية'
                : isEn
                  ? 'Sample dishes shown (add items in Menu Builder)'
                  : 'تعرض أطباقاً تجريبية لحين إضافة وجباتك'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Brand Color Bar */}
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

            {/* Viewport Switcher (Mobile vs Desktop) */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-200/70">
              <button
                type="button"
                onClick={() => setPreviewViewport('mobile')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
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
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
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

        {/* Appearance Studio Controls: Columns, Light/Dark Contrast Mode & Typography Colors */}
        <div className="px-4 sm:px-5 py-4 border-b border-zinc-200 bg-white space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Grid Columns Switcher */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-zinc-900 flex items-center gap-1.5">
                <Columns className="w-3.5 h-3.5 text-zinc-500" />
                <span>{t.admin.themes.columnsLabel}</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([1, 2, 3] as const).map((cols) => (
                  <button
                    key={cols}
                    type="button"
                    onClick={() => setMenuColumns(cols)}
                    className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                      menuColumns === cols
                        ? 'bg-zinc-950 text-white border-zinc-950'
                        : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    {cols === 1
                      ? isEn
                        ? '1 Col'
                        : 'عمود 1'
                      : cols === 2
                        ? isEn
                          ? '2 Cols'
                          : 'عمودان 2'
                        : isEn
                          ? '3 Cols'
                          : '3 أعمدة'}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Mode (Auto / High-Contrast Light / High-Contrast Dark) */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-zinc-900 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-600" />
                <span>{t.admin.themes.colorModeLabel}</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'auto', label: t.admin.themes.colorModeAuto, icon: Sparkles },
                    { id: 'light', label: isEn ? 'Light' : 'نهاري', icon: Sun },
                    { id: 'dark', label: isEn ? 'Dark' : 'ليلي', icon: Moon },
                  ] as const
                ).map((m) => {
                  const ModeIcon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setColorMode(m.id)}
                      className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                        colorMode === m.id
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <ModeIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Curated Contrast Typography Presets + Custom Color Pickers */}
          <div className="pt-3 border-t border-zinc-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-zinc-900">
                {t.admin.themes.customTypographyTitle}
              </span>
              {(headingColor || descriptionColor || priceColor) && (
                <button
                  type="button"
                  onClick={() => {
                    setHeadingColor('');
                    setDescriptionColor('');
                    setPriceColor('');
                  }}
                  className="text-[11px] font-bold text-zinc-600 hover:text-zinc-950 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t.admin.themes.resetColorsBtn}</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {CONTRAST_TYPOGRAPHY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setColorMode(preset.mode);
                    setHeadingColor(preset.headingColor);
                    setDescriptionColor(preset.descriptionColor);
                    setPriceColor(preset.priceColor);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-[11px] font-bold flex items-center gap-2 cursor-pointer"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/15"
                    style={{
                      backgroundColor: preset.mode === 'dark' ? '#090D16' : '#FAF9F6',
                    }}
                  />
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/15 -ms-3"
                    style={{ backgroundColor: preset.priceColor }}
                  />
                  <span>{isEn ? preset.labelEn : preset.labelAr}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50/70 text-xs font-bold cursor-pointer">
                <span className="truncate">{t.admin.themes.headingColorLabel}</span>
                <input
                  type="color"
                  value={headingColor || '#0B132B'}
                  onChange={(e) => setHeadingColor(e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent shrink-0"
                />
              </label>
              <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50/70 text-xs font-bold cursor-pointer">
                <span className="truncate">{t.admin.themes.descColorLabel}</span>
                <input
                  type="color"
                  value={descriptionColor || '#334155'}
                  onChange={(e) => setDescriptionColor(e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent shrink-0"
                />
              </label>
              <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50/70 text-xs font-bold cursor-pointer">
                <span className="truncate">{t.admin.themes.priceColorLabel}</span>
                <input
                  type="color"
                  value={priceColor || primaryColor}
                  onChange={(e) => setPriceColor(e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent shrink-0"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Live Interactive Preview Viewport */}
        <div className="p-4 sm:p-6 bg-zinc-100/80 border-b border-zinc-200">
          <div
            style={{ transform: 'translateZ(0)' }}
            className={`relative overflow-hidden transition-all duration-200 bg-white ${
              previewViewport === 'mobile'
                ? 'max-w-[395px] mx-auto h-[460px] sm:h-[580px] rounded-[28px] border-[6px] border-zinc-900 shadow-2xl'
                : 'w-full h-[460px] sm:h-[580px] rounded-2xl border border-zinc-300 shadow-md'
            }`}
          >
            <div className="w-full h-full overflow-y-auto overflow-x-clip">
              <ThemeRenderer
                key={`${selectedPreviewTheme}_${primaryColor}_${colorMode}_${menuColumns}`}
                restaurant={previewRestaurant}
                categories={previewCategories}
                items={previewItems}
                activeTheme={selectedPreviewTheme}
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

        {/* Theme Signature Showcase + Full Name/Description + Activate CTA */}
        <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white">
          <div className="flex items-start gap-4 min-w-0">
            {/* Signature Visual Cover Image of Selected Theme */}
            <div className="w-28 h-24 sm:w-36 sm:h-28 rounded-2xl overflow-hidden border border-zinc-200 shrink-0 shadow-xs bg-zinc-100">
              <SafeImage
                src={
                  selectedCustomTheme?.previewImage ||
                  selectedThemeMeta.coverImage ||
                  '/src/assets/images/theme_flipbook_3d_1794974837314.jpg'
                }
                alt={selectedThemeFullName}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Full Theme Name, Metadata & Full Description */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="font-mono-num font-bold text-zinc-700">
                  {selectedCustomTheme
                    ? isEn
                      ? 'Custom Theme'
                      : 'ثيم مخصص'
                    : `${isEn ? 'Theme' : 'ثيم'} ${String(selectedThemeMeta.number).padStart(2, '0')}`}
                </span>
                {!selectedCustomTheme && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{selectedThemeMeta.englishName}</span>
                  </>
                )}
                {selectedThemeMeta.badge ? (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                      selectedThemeMeta.badge.includes('VIP')
                        ? 'bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-zinc-950'
                        : 'bg-gradient-to-r from-orange-500 to-rose-600 text-white'
                    }`}
                  >
                    {loc(selectedThemeMeta.badge, selectedThemeMeta.badge_en)}
                  </span>
                ) : (
                  selectedThemeMeta.isFlagship && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Flagship' : 'الأكثر تميزاً'}</span>
                      </span>
                    </>
                  )
                )}
                {restaurant.activeTheme === selectedPreviewTheme && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-emerald-700">
                      {isEn ? 'Active on Public Menu' : 'مُفعّل حالياً في المنيو'}
                    </span>
                  </>
                )}
              </div>

              <h4 className="text-lg sm:text-xl font-extrabold text-zinc-950">
                {selectedThemeFullName}
              </h4>

              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-2xl">
                {selectedThemeDescription}
              </p>

              {themeErrorMsg && (
                <p className="text-xs font-bold text-red-600 pt-1">{themeErrorMsg}</p>
              )}
              {themeSavedMsg && (
                <p className="text-xs font-bold text-emerald-700 pt-1">{themeSavedMsg}</p>
              )}
            </div>
          </div>

          {/* Primary Activation CTA */}
          <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-2.5 shrink-0">
            <button
              type="button"
              disabled={activatingTheme}
              onClick={handleActivateSelectedTheme}
              style={!isSelectedAlreadyActive ? { backgroundColor: primaryColor } : undefined}
              className={`min-h-[46px] px-6 py-3 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 whitespace-nowrap transition-all cursor-pointer disabled:opacity-60 shadow-sm ${
                isSelectedAlreadyActive
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'text-white hover:opacity-95'
              }`}
            >
              {activatingTheme ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>
                {activatingTheme
                  ? t.admin.themes.savingBtn
                  : isSelectedAlreadyActive
                    ? isEn
                      ? 'Active on My Restaurant'
                      : 'هذا الثيم مُفعّل لمطعمك'
                    : isEn
                      ? 'Activate This Theme for My Restaurant'
                      : 'تفعيل هذا الثيم لمطعمي'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onOpenPublicMenu(`/menu/${restaurant.slug}?theme=${selectedPreviewTheme}`)
              }
              className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{isEn ? 'Open Fullscreen Preview' : 'معاينة بملء الشاشة'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. Bilingual Store Settings Form */}
      <form
        onSubmit={handleSaveSettings}
        className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-950">
              2. {t.admin.themes.settingsTitle}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">{t.admin.themes.settingsSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={handleAutoFillEn}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-600" />
            <span>{t.admin.menu.autoFillEn}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1">{t.admin.themes.nameArLabel}</label>
            <input
              type="text"
              dir="rtl"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">{t.admin.themes.nameEnLabel}</label>
            <input
              type="text"
              dir="ltr"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="e.g. Buns Lab"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm text-left"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1">{t.admin.themes.taglineArLabel}</label>
            <input
              type="text"
              dir="rtl"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">{t.admin.themes.taglineEnLabel}</label>
            <input
              type="text"
              dir="ltr"
              value={taglineEn}
              onChange={(e) => setTaglineEn(e.target.value)}
              placeholder="e.g. Daily fresh smash burgers..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm text-left"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold mb-1">{t.admin.themes.slugLabel} *</label>
            <div className="flex items-center rounded-xl border border-zinc-200 overflow-hidden">
              <input
                type="text"
                dir="ltr"
                required
                value={slug}
                onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
                className="flex-1 min-w-0 px-3.5 py-2.5 text-sm font-mono-num text-left focus:outline-none"
              />
              <span className="px-3 py-2.5 bg-zinc-50 text-zinc-500 text-xs font-mono-num border-s border-zinc-200 shrink-0">
                /menu/
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">{t.admin.themes.whatsappLabel} *</label>
            <input
              type="tel"
              dir="ltr"
              required
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num text-left"
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">{t.admin.themes.currencyLabel}</label>
            <input
              type="text"
              required
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            <div>
              <label className="block text-[11px] font-bold mb-1">
                {isEn ? 'Tax %' : 'الضريبة %'}
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-full px-2.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1">
                {isEn ? 'Svc %' : 'الخدمة %'}
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(Number(e.target.value))}
                className="w-full px-2.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1 truncate">
                {t.admin.themes.deliveryFeeLabel}
              </label>
              <input
                type="number"
                min={0}
                step="1"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(Number(e.target.value))}
                className="w-full px-2.5 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono-num"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <SafeImage
            src={logoUrl}
            alt={loc(name, nameEn)}
            className="w-14 h-14 rounded-xl object-cover border border-zinc-200"
          />
          <label className="px-3.5 py-2 rounded-xl border border-zinc-300 text-xs font-bold cursor-pointer hover:bg-zinc-50 flex items-center gap-1.5">
            {uploadingLogo ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>{t.admin.themes.logoLabel}</span>
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
                className={`w-9 h-9 rounded-lg overflow-hidden border-2 cursor-pointer ${
                  logoUrl === img.url ? 'border-zinc-950' : 'border-transparent opacity-70'
                }`}
              >
                <SafeImage src={img.url} alt={img.label} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Social & WhatsApp Share Link Card Customization */}
        <div className="pt-4 border-t border-zinc-200 space-y-4">
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-zinc-950">
              {isEn
                ? 'WhatsApp & Social Link Preview Card'
                : 'بطاقة مشاركة الرابط (واتساب ومنصات التواصل)'}
            </h4>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {isEn
                ? 'Customize the welcome title and 2-line greeting shown with your restaurant logo whenever you share your menu link. Leave blank for automatic defaults.'
                : 'تحكم في العنوان الترحيبي والسطرين الظاهرين مع لوجو مطعمك عند إرسال رابط المنيو على واتساب. اتركهما فارغين للاستخدام التلقائي (مطعمك يرحب بكم).'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1">
                {isEn ? 'Share Card Title (Arabic)' : 'عنوان الترحيب عند المشاركة (عربي)'}
              </label>
              <input
                type="text"
                dir="rtl"
                maxLength={140}
                value={shareTitle}
                onChange={(e) => setShareTitle(e.target.value)}
                placeholder={
                  name.trim()
                    ? name.trim().startsWith('مطعم')
                      ? `${name.trim()} يرحب بكم`
                      : `مطعم ${name.trim()} يرحب بكم`
                    : 'مثال: مطعم حورس يرحب بكم'
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">
                {isEn ? 'Share Card Title (English)' : 'عنوان الترحيب عند المشاركة (إنجليزي)'}
              </label>
              <input
                type="text"
                dir="ltr"
                maxLength={140}
                value={shareTitleEn}
                onChange={(e) => setShareTitleEn(e.target.value)}
                placeholder={`${nameEn.trim() || name.trim() || 'Restaurant'} Welcomes You`}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-sm text-left"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1">
                {isEn ? '2-Line Greeting (Arabic)' : 'سطران ترحيبيان أسفل العنوان (عربي)'}
              </label>
              <textarea
                rows={2}
                dir="rtl"
                maxLength={300}
                value={shareDescription}
                onChange={(e) => setShareDescription(e.target.value)}
                placeholder="تصفح المنيو الإلكتروني التفاعلي، اختر وجبتك المفضلة مع الإضافات، واطلب مباشرة بضغطة واحدة."
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">
                {isEn ? '2-Line Greeting (English)' : 'سطران ترحيبيان أسفل العنوان (إنجليزي)'}
              </label>
              <textarea
                rows={2}
                dir="ltr"
                maxLength={300}
                value={shareDescriptionEn}
                onChange={(e) => setShareDescriptionEn(e.target.value)}
                placeholder="Browse our interactive digital menu, customize sizes & add-ons, and place your order in seconds."
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-sm text-left"
              />
            </div>
          </div>

          <SharePreviewCard
            title={resolveRestaurantShareTitle(
              {
                name: name || restaurant.name,
                name_en: nameEn || restaurant.name_en,
                shareTitle,
                shareTitle_en: shareTitleEn,
              },
              lang
            )}
            description={resolveRestaurantShareDescription(
              {
                tagline,
                tagline_en: taglineEn,
                shareDescription,
                shareDescription_en: shareDescriptionEn,
              },
              lang
            )}
            imageUrl={logoUrl || restaurant.logoUrl}
            shareUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/menu/${sanitizeSlug(slug) || restaurant.slug}`}
            isEn={isEn}
            showResetAuto={Boolean(shareTitle || shareTitleEn || shareDescription || shareDescriptionEn)}
            onResetAuto={() => {
              setShareTitle('');
              setShareTitleEn('');
              setShareDescription('');
              setShareDescriptionEn('');
            }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-100">
          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={isOpen}
              onChange={(e) => setIsOpen(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
            <span>{t.admin.themes.isOpenYes}</span>
          </label>

          <button
            type="submit"
            disabled={savingSettings}
            className="px-6 py-2.5 rounded-xl bg-zinc-950 text-white text-sm font-bold hover:bg-zinc-800 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingSettings ? t.admin.themes.savingBtn : t.admin.themes.saveSettingsBtn}</span>
          </button>
        </div>

        {settingsMsg && <p className="text-xs font-bold text-emerald-700">{settingsMsg}</p>}
        {settingsError && <p className="text-xs font-bold text-red-600">{settingsError}</p>}
      </form>

      {/* Interactive Preview Modals (sandboxed, never write real orders) */}
      <ItemModal
        item={previewSelectedItem}
        allItems={previewItems}
        currency={previewRestaurant.currency}
        primaryColor={primaryColor}
        taxRate={taxRate}
        serviceCharge={serviceCharge}
        isDarkSurface={
          colorMode === 'dark' ? true : colorMode === 'light' ? false : selectedThemeMeta.isDark
        }
        onClose={() => setPreviewSelectedItem(null)}
        onAddToCart={handlePreviewAddToCart}
        onQuickAddSuggested={(sug) => handlePreviewQuickStep(sug, 1)}
      />

      <CartDrawer
        open={previewCartOpen}
        restaurant={previewRestaurant}
        cart={previewCart}
        allItems={previewItems}
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
  );
}
