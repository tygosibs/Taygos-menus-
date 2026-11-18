export type AppLang = 'ar' | 'en';

export function loc(ar?: string | null, en?: string | null, lang: AppLang = 'ar'): string {
  const cleanEn = (en || '').trim();
  const cleanAr = (ar || '').trim();
  if (lang === 'en') {
    return cleanEn || cleanAr;
  }
  return cleanAr || cleanEn;
}

const CURRENCY_MAP_EN: Record<string, string> = {
  'ج.م': 'EGP',
  'ر.س': 'SAR',
  'د.إ': 'AED',
  'د.ك': 'KWD',
  'د.ب': 'BHD',
  'ر.ع': 'OMR',
  'ر.ق': 'QAR',
  'د.أ': 'JOD',
  '$': '$',
  '€': '€',
};

export function formatCurrency(currency: string | undefined, lang: AppLang): string {
  const c = (currency || 'ج.م').trim();
  if (lang === 'en') {
    return CURRENCY_MAP_EN[c] || c;
  }
  return c;
}

const COMMON_PHRASE_DICT: Array<[RegExp, string]> = [
  [/برجر سماش|سماش برجر/gi, 'Smash Burger'],
  [/دبل سماش ترافل برجر/gi, 'Double Smash Truffle Burger'],
  [/دبل سماش/gi, 'Double Smash'],
  [/برجر اللحم|برجر لحم/gi, 'Beef Burger'],
  [/برجر دجاج/gi, 'Chicken Burger'],
  [/برجر/gi, 'Burger'],
  [/بيتزا مارغريتا/gi, 'Margherita Pizza'],
  [/بيتزا بيبروني/gi, 'Pepperoni Pizza'],
  [/بيتزا/gi, 'Pizza'],
  [/باستا ألفريدو|باستا الفريدو/gi, 'Alfredo Pasta'],
  [/باستا/gi, 'Pasta'],
  [/تالياتيلي/gi, 'Tagliatelle'],
  [/ستيك ريب آي|ريب آي/gi, 'Ribeye Steak'],
  [/ستيك/gi, 'Steak'],
  [/واغيو/gi, 'Wagyu'],
  [/ترافل|كمأة/gi, 'Truffle'],
  [/سبانش لاتيه/gi, 'Spanish Latte'],
  [/آيس|مثلج|بارد/gi, 'Iced'],
  [/لاتيه/gi, 'Latte'],
  [/كابتشينو/gi, 'Cappuccino'],
  [/إسبريسو/gi, 'Espresso'],
  [/كروسان/gi, 'Croissant'],
  [/قهوة مختصة/gi, 'Specialty Coffee'],
  [/قهوة/gi, 'Coffee'],
  [/المشروبات والقهوة|المشروبات/gi, 'Beverages'],
  [/الأطباق الرئيسية/gi, 'Main Courses'],
  [/المقبلات/gi, 'Appetizers'],
  [/السلطات/gi, 'Salads'],
  [/سلطة سيزر/gi, 'Caesar Salad'],
  [/سلطة/gi, 'Salad'],
  [/الشوربة|شوربة/gi, 'Soup'],
  [/المشويات/gi, 'Grills'],
  [/مشوي/gi, 'Grilled'],
  [/الحلويات/gi, 'Desserts'],
  [/المخبوزات/gi, 'Bakery'],
  [/بطاطس مقلية/gi, 'French Fries'],
  [/بطاطس/gi, 'Fries'],
  [/دجاج مشوي|صدور دجاج/gi, 'Grilled Chicken'],
  [/دجاج مقرمش/gi, 'Crispy Chicken'],
  [/دجاج/gi, 'Chicken'],
  [/لحم/gi, 'Beef'],
  [/ساندوتش/gi, 'Sandwich'],
  [/راب/gi, 'Wrap'],
  [/جبنة إضافية|شيدر/gi, 'Extra Cheddar Cheese'],
  [/جبنة/gi, 'Cheese'],
  [/هالبينو/gi, 'Jalapeno'],
  [/حار/gi, 'Spicy'],
  [/سنجل/gi, 'Single'],
  [/دبل/gi, 'Double'],
  [/تريبل/gi, 'Triple'],
  [/صغير/gi, 'Small'],
  [/وسط/gi, 'Medium'],
  [/عائلي/gi, 'Family'],
  [/كبير/gi, 'Large'],
  [/عادي/gi, 'Regular'],
  [/فردي/gi, 'Single Portion'],
  [/للمشاركة/gi, 'Sharing'],
  [/وجبة/gi, 'Combo Meal'],
  [/صوص/gi, 'Sauce'],
  [/عصير طازج|عصير/gi, 'Fresh Juice'],
  [/موهيتو/gi, 'Mojito'],
  [/شاي/gi, 'Tea'],
  [/حليب شوفان/gi, 'Oat Milk'],
  [/حليب لوز/gi, 'Almond Milk'],
];

export function autoSuggestEnglish(arText: string): string {
  const clean = (arText || '').trim();
  if (!clean) return '';
  let result = clean;
  for (const [pattern, replacement] of COMMON_PHRASE_DICT) {
    result = result.replace(pattern, replacement);
  }
  if (/[\u0600-\u06FF]/.test(result)) {
    const latinWords = result
      .replace(/[\u0600-\u06FF،؛؟]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return latinWords;
  }
  return result.replace(/\s+/g, ' ').trim();
}

export interface TranslationStrings {
  brandName: string;
  brandSubtitle: string;
  nav: {
    features: string;
    themes: string;
    pricing: string;
    superAdmin: string;
    ownerDashboard: string;
    createMenuFree: string;
    home: string;
  };
  landing: {
    badge: string;
    viewLiveDemos: string;
    interactiveDemosTitle: string;
    interactiveDemosDesc: string;
    openDemoMenu: string;
    featuresTitle: string;
    featuresDesc: string;
    themesTitle: string;
    themesDesc: string;
    flagshipBadge: string;
    pricingTitle: string;
    pricingDesc: string;
    mostPopular: string;
    subscribeNow: string;
    contactWhatsapp: string;
    footerSupport: string;
    authTitle: string;
    authSubtitle: string;
    demoTagline1: string;
    demoTagline2: string;
    demoTagline3: string;
    tryTheme: string;
  };
  auth: {
    loginTab: string;
    registerTab: string;
    ownerLoginHeading: string;
    ownerRegisterHeading: string;
    ownerHeadingDesc: string;
    fullNameLabel: string;
    fullNamePlaceholder: string;
    emailLabel: string;
    passwordLabel: string;
    loginBtn: string;
    registerBtn: string;
    forgotPassword: string;
    resetSent: string;
    enterEmailFirst: string;
    errInvalidCred: string;
    errEmailInUse: string;
    errWeakPass: string;
    errGeneric: string;
  };
  onboarding: {
    badge: string;
    title: string;
    subtitle: string;
    nameArLabel: string;
    nameArPlaceholder: string;
    nameEnLabel: string;
    nameEnPlaceholder: string;
    slugLabel: string;
    slugChecking: string;
    slugAvailable: string;
    slugTaken: string;
    slugHint: string;
    whatsappLabel: string;
    currencyLabel: string;
    taglineArLabel: string;
    taglineArPlaceholder: string;
    taglineEnLabel: string;
    taglineEnPlaceholder: string;
    logoLabel: string;
    logoUploaded: string;
    logoPlaceholder: string;
    logoUploading: string;
    seedCheckboxTitle: string;
    seedCheckboxDesc: string;
    submitBtn: string;
    autoFillEn: string;
    errRequired: string;
    errSlugInvalid: string;
    errSlugTaken: string;
  };
  admin: {
    workspaceTitle: string;
    superAdminBtn: string;
    viewPublicMenu: string;
    signOut: string;
    loadingWorkspace: string;
    tabs: {
      orders: string;
      menu: string;
      offers: string;
      themes: string;
      qr: string;
    };
    orders: {
      title: string;
      subtitle: string;
      soundOn: string;
      soundOff: string;
      testSound: string;
      statsPending: string;
      statsPreparing: string;
      statsCompleted: string;
      statsTodaySales: string;
      filterAll: string;
      statusPending: string;
      statusPreparing: string;
      statusCompleted: string;
      statusCancelled: string;
      emptyTitle: string;
      emptyDesc: string;
      typeDineIn: string;
      typeDelivery: string;
      typePickup: string;
      tablePrefix: string;
      subtotal: string;
      service: string;
      tax: string;
      total: string;
      notesLabel: string;
      btnStartPreparing: string;
      btnComplete: string;
      btnCancel: string;
      justNow: string;
    };
    menu: {
      title: string;
      subtitle: string;
      seedBtn: string;
      seedingBtn: string;
      categoriesHeading: string;
      addCategoryPlaceholderAr: string;
      addCategoryPlaceholderEn: string;
      addCategoryBtn: string;
      allCategories: string;
      dishesCount: string;
      emptyCategories: string;
      emptyItemsTitle: string;
      emptyItemsDesc: string;
      addItemBtn: string;
      editItemTitle: string;
      newItemTitle: string;
      nameArLabel: string;
      nameEnLabel: string;
      autoFillEn: string;
      categoryLabel: string;
      descArLabel: string;
      descEnLabel: string;
      basePriceLabel: string;
      caloriesLabel: string;
      spicyToggle: string;
      availableToggle: string;
      imageLabel: string;
      uploadImage: string;
      sizesHeading: string;
      addSizeBtn: string;
      sizeArPlaceholder: string;
      sizeEnPlaceholder: string;
      addonsHeading: string;
      addAddonBtn: string;
      addonArPlaceholder: string;
      addonEnPlaceholder: string;
      saveItemBtn: string;
      cancelBtn: string;
      availableBadge: string;
      unavailableBadge: string;
      spicyBadge: string;
      caloriesUnit: string;
      editCategoryTitle: string;
      saveCategoryBtn: string;
      badgeLabel: string;
      bogoToggle: string;
      suggestedItemsHeading: string;
      quickAddonsLabel: string;
    };
    offers: {
      title: string;
      subtitle: string;
      bannersHeading: string;
      addBannerBtn: string;
      bannerTitleAr: string;
      bannerTitleEn: string;
      bannerSubAr: string;
      bannerSubEn: string;
      badgeAr: string;
      badgeEn: string;
      bogoToggle: string;
      promoLinkLabel: string;
      placementLabel: string;
      animationLabel: string;
      bgColorLabel: string;
      textColorLabel: string;
      saveOffersBtn: string;
      savedToast: string;
      promosHeading: string;
      addPromoBtn: string;
      codeLabel: string;
      promoTypeLabel: string;
      promoValueLabel: string;
      minOrderLabel: string;
      typePercent: string;
      typeFixed: string;
      typeFreeDelivery: string;
      typeWaiveService: string;
    };
    themes: {
      title: string;
      subtitle: string;
      customThemesTitle: string;
      customThemesBadge: string;
      builtinThemesTitle: string;
      activeBadge: string;
      selectThemeBtn: string;
      settingsTitle: string;
      settingsSubtitle: string;
      nameArLabel: string;
      nameEnLabel: string;
      taglineArLabel: string;
      taglineEnLabel: string;
      slugLabel: string;
      whatsappLabel: string;
      currencyLabel: string;
      taxRateLabel: string;
      serviceChargeLabel: string;
      deliveryFeeLabel: string;
      primaryColorLabel: string;
      columnsLabel: string;
      colorModeLabel: string;
      colorModeAuto: string;
      colorModeLight: string;
      colorModeDark: string;
      customTypographyTitle: string;
      headingColorLabel: string;
      descColorLabel: string;
      priceColorLabel: string;
      resetColorsBtn: string;
      isOpenLabel: string;
      isOpenYes: string;
      isOpenNo: string;
      logoLabel: string;
      saveSettingsBtn: string;
      savingBtn: string;
      savedToast: string;
      previewLink: string;
    };
    qr: {
      title: string;
      subtitle: string;
      menuUrlLabel: string;
      copyUrlBtn: string;
      copiedToast: string;
      downloadPngBtn: string;
      printCardBtn: string;
      cardScanPrompt: string;
      cardFooter: string;
      tipsTitle: string;
      tip1: string;
      tip2: string;
      tip3: string;
    };
  };
  signOutConfirm: {
    title: string;
    desc: string;
    confirmBtn: string;
    cancelBtn: string;
  };
  superAdmin: {
    title: string;
    subtitle: string;
    backToOwner: string;
    backToHome: string;
    accessDeniedTitle: string;
    accessDeniedDesc: string;
    loginRequiredDesc: string;
    tabs: {
      tenants: string;
      themeInjector: string;
      cms: string;
    };
    tenants: {
      title: string;
      subtitle: string;
      refreshBtn: string;
      searchPlaceholder: string;
      filterAll: string;
      filterActive: string;
      filterSuspended: string;
      totalRestaurants: string;
      activeAccounts: string;
      suspendedAccounts: string;
      ownerLabel: string;
      whatsappLabel: string;
      themeLabel: string;
      statusActive: string;
      statusSuspended: string;
      openMenuBtn: string;
      conciergeBtn: string;
      suspendBtn: string;
      activateBtn: string;
      deleteBtn: string;
      confirmDeleteTitle: string;
      confirmDeleteDesc: string;
      confirmDeleteBtn: string;
      cancelBtn: string;
      conciergeTitle: string;
      conciergeSubtitle: string;
      closeConcierge: string;
    };
    cms: {
      title: string;
      subtitle: string;
      heroTitleAr: string;
      heroTitleEn: string;
      heroSubtitleAr: string;
      heroSubtitleEn: string;
      ctaAr: string;
      ctaEn: string;
      whatsappLabel: string;
      footerAr: string;
      footerEn: string;
      featuresHeading: string;
      addFeatureBtn: string;
      featureTitleAr: string;
      featureTitleEn: string;
      featureDescAr: string;
      featureDescEn: string;
      plansHeading: string;
      planNameAr: string;
      planNameEn: string;
      planPrice: string;
      planPeriodAr: string;
      planPeriodEn: string;
      planDescAr: string;
      planDescEn: string;
      planFeaturesAr: string;
      planFeaturesEn: string;
      planHighlighted: string;
      saveBtn: string;
      savingBtn: string;
      savedToast: string;
    };
    injector: {
      title: string;
      subtitle: string;
      newThemeBtn: string;
      savedThemesTitle: string;
      noThemes: string;
      activeLabel: string;
      inactiveLabel: string;
      nameArLabel: string;
      nameEnLabel: string;
      descArLabel: string;
      descEnLabel: string;
      previewImgLabel: string;
      isActiveToggle: string;
      variablesGuideTitle: string;
      copyVarBtn: string;
      copiedVar: string;
      loadBoilerplateBtn: string;
      livePreviewTitle: string;
      refreshPreviewBtn: string;
      saveThemeBtn: string;
      savingBtn: string;
      deleteThemeBtn: string;
    };
  };
  menu: {
    loadingMenu: string;
    notFoundTitle: string;
    notFoundDesc: string;
    backHome: string;
    suspendedTitle: string;
    suspendedDesc: string;
    closedBanner: string;
    openNow: string;
    closedNow: string;
    searchPlaceholder: string;
    allCategories: string;
    noResults: string;
    unavailable: string;
    spicy: string;
    popularBadge: string;
    ordersCountLabel: string;
    caloriesUnit: string;
    addToCart: string;
    addedToCart: string;
    customizeOrder: string;
    chooseSize: string;
    chooseAddons: string;
    optionalAddons: string;
    specialNotes: string;
    notesPlaceholder: string;
    quantity: string;
    addWithTotal: string;
    cartTitle: string;
    cartEmptyTitle: string;
    cartEmptyDesc: string;
    browseMenu: string;
    itemsCountLabel: string;
    orderTypeLabel: string;
    dineIn: string;
    delivery: string;
    pickup: string;
    customerName: string;
    customerNamePlaceholder: string;
    customerPhone: string;
    customerPhonePlaceholder: string;
    tableNumber: string;
    tableNumberPlaceholder: string;
    deliveryAddress: string;
    deliveryAddressPlaceholder: string;
    orderNotes: string;
    orderNotesPlaceholder: string;
    subtotal: string;
    serviceCharge: string;
    tax: string;
    grandTotal: string;
    sendDirectBtn: string;
    sendWhatsappBtn: string;
    sendingBtn: string;
    orderSuccessTitle: string;
    orderSuccessDesc: string;
    orderNumberLabel: string;
    openWhatsappAgain: string;
    newOrderBtn: string;
    errMissingCustomer: string;
    errMissingTable: string;
    errMissingAddress: string;
    errOrderFailed: string;
    demoPreviewBanner: string;
    flipbookInstruction: string;
    pageLabel: string;
    prevPage: string;
    nextPage: string;
    coverBadge: string;
    startReading: string;
    dishCountSuffix: string;
    storyPrev: string;
    storyNext: string;
    quickAdd: string;
    viewCart: string;
    currencyLabel: string;
    taxNoticePrefix: string;
    serviceNoticePrefix: string;
    sortLabel: string;
    sortDefault: string;
    sortBestSelling: string;
    sortChefChoice: string;
    sortLowestPrice: string;
    bogoBadge: string;
    bogoIncluded: string;
    promoPlaceholder: string;
    applyPromo: string;
    removePromo: string;
    discountLabel: string;
    deliveryFeeLabel: string;
    clearCart: string;
    pairingsHeading: string;
  };
}

export const TRANSLATIONS: Record<AppLang, TranslationStrings> = {
  ar: {
    brandName: 'سُفرة QR',
    brandSubtitle: 'منصة المنيو الإلكتروني متعددة المطاعم',
    nav: {
      features: 'المميزات',
      themes: 'الثيمات التفاعلية',
      pricing: 'الباقات',
      superAdmin: 'لوحة الإدارة العليا',
      ownerDashboard: 'لوحة تحكم المطعم',
      createMenuFree: 'أنشئ منيو مجاناً',
      home: 'الرئيسية',
    },
    landing: {
      badge: 'منصة SaaS متكاملة للمطاعم والكافيهات',
      viewLiveDemos: 'استعراض نماذج حية',
      interactiveDemosTitle: 'جرّب القوائم الحية فوراً',
      interactiveDemosDesc: 'تصفح 3 نماذج مطاعم جاهزة بتصاميم مختلفة قبل إنشاء حساب مطعمك.',
      openDemoMenu: 'معاينة المنيو الحي',
      featuresTitle: 'كل ما يحتاجه مطعمك في منصة واحدة',
      featuresDesc: 'بنية سحابية فورية تعزل بيانات كل مطعم وتمنحك تحكماً كاملاً بالمنيو والطلبات.',
      themesTitle: '9 ثيمات تريند + حقن ثيمات مخصصة',
      themesDesc: 'بدّل تصميم المنيو في أي لحظة بضغطة زر دون تغيير رابط الـ QR المطبوع على الطاولات.',
      flagshipBadge: 'الأكثر طلباً · 3D',
      pricingTitle: 'باقات مرنة تناسب حجم مطعمك',
      pricingDesc: 'ابدأ مجاناً أو اختر الباقة المناسبة مع دعم فني مباشر.',
      mostPopular: 'الأكثر اختياراً',
      subscribeNow: 'ابدأ الآن',
      contactWhatsapp: 'تواصل عبر واتساب',
      footerSupport: 'الدعم الفني السريع',
      authTitle: 'بوابة أصحاب المطاعم',
      authSubtitle: 'سجّل الدخول أو أنشئ حساباً جديداً لإدارة منيو مطعمك واستقبال الطلبات الحية.',
      demoTagline1: 'ثيم الكتاب ثلاثي الأبعاد 3D',
      demoTagline2: 'ثيم اللاونج الفاخر الذهبي',
      demoTagline3: 'ثيم الكافيهات والمخبوزات الدافئ',
      tryTheme: 'معاينة الثيم',
    },
    auth: {
      loginTab: 'تسجيل الدخول',
      registerTab: 'إنشاء حساب مطعم',
      ownerLoginHeading: 'دخول صاحب المطعم',
      ownerRegisterHeading: 'حساب مطعم جديد',
      ownerHeadingDesc: 'إدارة المنيو، الأسعار، الثيمات، والطلبات الحية لحظة بلحظة.',
      fullNameLabel: 'الاسم الكامل لصاحب المطعم',
      fullNamePlaceholder: 'مثال: أحمد محمد',
      emailLabel: 'البريد الإلكتروني',
      passwordLabel: 'كلمة المرور',
      loginBtn: 'دخول إلى لوحة التحكم',
      registerBtn: 'إنشاء الحساب والبدء',
      forgotPassword: 'نسيت كلمة المرور؟',
      resetSent: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.',
      enterEmailFirst: 'يرجى كتابة بريدك الإلكتروني أولاً.',
      errInvalidCred: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      errEmailInUse: 'هذا البريد الإلكتروني مسجل مسبقاً.',
      errWeakPass: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.',
      errGeneric: 'تعذر إتمام العملية، يرجى المحاولة مرة أخرى.',
    },
    onboarding: {
      badge: 'الإعداد الأولي للمطعم',
      title: 'أطلق منيو مطعمك الرقمي خلال دقيقة',
      subtitle: 'أدخل بيانات مطعمك الأساسية بالعربية والإنجليزية ليظهر المنيو لعملائك باللغتين.',
      nameArLabel: 'اسم المطعم (بالعربية) *',
      nameArPlaceholder: 'مثال: برجر لاب',
      nameEnLabel: 'اسم المطعم (بالإنجليزية)',
      nameEnPlaceholder: 'e.g. Buns Lab',
      slugLabel: 'الرابط المميز للمنيو (Slug) *',
      slugChecking: 'جاري التحقق من توفر الرابط...',
      slugAvailable: 'الرابط متاح للاستخدام',
      slugTaken: 'هذا الرابط مستخدم بالفعل، اختر اسماً آخر',
      slugHint: 'حروف إنجليزية صغيرة وأرقام وشرطة (-) فقط',
      whatsappLabel: 'رقم الواتساب لاستقبال الطلبات *',
      currencyLabel: 'العملة',
      taglineArLabel: 'وصف مختصر للمطعم (بالعربية)',
      taglineArPlaceholder: 'أشهى وجبات البرجر المحضرة يومياً...',
      taglineEnLabel: 'وصف مختصر للمطعم (بالإنجليزية)',
      taglineEnPlaceholder: 'Daily fresh smashed wagyu burgers...',
      logoLabel: 'شعار المطعم (Logo)',
      logoUploaded: 'تم رفع الشعار بنجاح',
      logoPlaceholder: 'اضغط لرفع صورة الشعار',
      logoUploading: 'جاري رفع الشعار...',
      seedCheckboxTitle: 'تعبئة منيو تجريبي جاهز (أقسام ووجبات ثنائية اللغة)',
      seedCheckboxDesc: 'موصى به لتجربة المنيو فوراً وتعديل الأصناف لاحقاً بسهولة.',
      submitBtn: 'حفظ وإنشاء لوحة التحكم',
      autoFillEn: 'ترجمة تلقائية للإنجليزية',
      errRequired: 'يرجى إدخال اسم المطعم والرابط ورقم الواتساب.',
      errSlugInvalid: 'الرابط المميز يجب أن يحتوي على حرفين إنجليزيين على الأقل.',
      errSlugTaken: 'هذا الرابط محجوز مسبقاً، يرجى اختيار رابط آخر.',
    },
    admin: {
      workspaceTitle: 'لوحة تحكم المطعم',
      superAdminBtn: 'لوحة الإدارة العليا',
      viewPublicMenu: 'عرض المنيو العام',
      signOut: 'تسجيل الخروج',
      loadingWorkspace: 'جاري تحميل بيانات مطعمك...',
      tabs: {
        orders: 'الطلبات الحية',
        menu: 'إدارة المنيو',
        offers: 'العروض والخصومات',
        themes: 'المظهر والإعدادات',
        qr: 'كود QR والطباعة',
      },
      orders: {
        title: 'استقبال الطلبات الحية',
        subtitle: 'تحديث تلقائي فوري عند وصول أي طلب جديد من طاولات المطعم أو الدليفري.',
        soundOn: 'التنبيه الصوتي مُفعّل',
        soundOff: 'التنبيه الصوتي صامت',
        testSound: 'تجربة الصوت',
        statsPending: 'قيد الانتظار',
        statsPreparing: 'جاري التحضير',
        statsCompleted: 'مكتمل اليوم',
        statsTodaySales: 'إجمالي المبيعات',
        filterAll: 'الكل',
        statusPending: 'طلب جديد',
        statusPreparing: 'جاري التجهيز',
        statusCompleted: 'مكتمل',
        statusCancelled: 'ملغي',
        emptyTitle: 'لا توجد طلبات مطابقة حالياً',
        emptyDesc: 'ستظهر الطلبات الجديدة هنا فور إرسالها من المنيو مع رنين تنبيهي.',
        typeDineIn: 'صالة',
        typeDelivery: 'دليفري',
        typePickup: 'استلام من الفرع',
        tablePrefix: 'طاولة',
        subtotal: 'المجموع الفرعي',
        service: 'الخدمة',
        tax: 'الضريبة',
        total: 'الإجمالي',
        notesLabel: 'ملاحظات العميل:',
        btnStartPreparing: 'بدء التحضير',
        btnComplete: 'تم التسليم',
        btnCancel: 'إلغاء الطلب',
        justNow: 'الآن',
      },
      menu: {
        title: 'إدارة الأقسام والوجبات',
        subtitle: 'أضف الأصناف باللغتين العربية والإنجليزية مع الأحجام والإضافات والسعرات.',
        seedBtn: 'تعبئة أصناف تجريبية',
        seedingBtn: 'جاري التعبئة...',
        categoriesHeading: 'أقسام المنيو',
        addCategoryPlaceholderAr: 'اسم القسم بالعربية (مثال: البرجر)',
        addCategoryPlaceholderEn: 'Category in English (e.g. Burgers)',
        addCategoryBtn: 'إضافة قسم',
        allCategories: 'كل الأقسام',
        dishesCount: 'صنف',
        emptyCategories: 'أضف أول قسم للبدء في بناء المنيو.',
        emptyItemsTitle: 'لا توجد وجبات في هذا القسم بعد',
        emptyItemsDesc: 'أضف وجبتك الأولى أو استخدم زر تعبئة الأصناف التجريبية.',
        addItemBtn: 'إضافة وجبة جديدة',
        editItemTitle: 'تعديل الوجبة',
        newItemTitle: 'إضافة وجبة جديدة',
        nameArLabel: 'اسم الوجبة (بالعربية) *',
        nameEnLabel: 'اسم الوجبة (بالإنجليزية)',
        autoFillEn: 'تعبئة تلقائية EN',
        categoryLabel: 'القسم *',
        descArLabel: 'الوصف والمكونات (بالعربية)',
        descEnLabel: 'الوصف والمكونات (بالإنجليزية)',
        basePriceLabel: 'السعر الأساسي *',
        caloriesLabel: 'السعرات الحرارية (اختياري)',
        spicyToggle: 'صنف حار 🌶️',
        availableToggle: 'متاح للطلب حالياً',
        imageLabel: 'صورة الوجبة',
        uploadImage: 'رفع صورة الوجبة',
        sizesHeading: 'الأحجام المتاحة (اختياري)',
        addSizeBtn: '+ إضافة حجم',
        sizeArPlaceholder: 'الحجم عربي (وسط)',
        sizeEnPlaceholder: 'Size EN (Medium)',
        addonsHeading: 'الإضافات الاختيارية',
        addAddonBtn: '+ إضافة خيار',
        addonArPlaceholder: 'الإضافة عربي (جبنة)',
        addonEnPlaceholder: 'Addon EN (Extra Cheese)',
        saveItemBtn: 'حفظ الوجبة',
        cancelBtn: 'إلغاء',
        availableBadge: 'متاح',
        unavailableBadge: 'غير متاح',
        spicyBadge: 'حار',
        caloriesUnit: 'سعرة',
        editCategoryTitle: 'تعديل القسم',
        saveCategoryBtn: 'حفظ القسم',
        badgeLabel: 'شارة التميز والترويج',
        bogoToggle: 'عرض اشترِ 1 واحصل على 1 مجاناً (1+1)',
        suggestedItemsHeading: 'مقترحات مصاحبة (تظهر مع الصنف وفي السلة)',
        quickAddonsLabel: 'إضافات سريعة بضغطة واحدة:',
      },
      offers: {
        title: 'العروض والبانرات وأكواد الخصم',
        subtitle: 'أنشئ عروض 1+1 مجاناً، حدد مكان وحركة البانر في المنيو، وأنشئ كوبونات خصم أو إلغاء الخدمة والتوصيل.',
        bannersHeading: 'البانرات الترويجية وعروض 1+1',
        addBannerBtn: '+ إضافة بانر عرض',
        bannerTitleAr: 'عنوان العرض (عربي) *',
        bannerTitleEn: 'عنوان العرض (إنجليزي)',
        bannerSubAr: 'تفاصيل العرض (عربي)',
        bannerSubEn: 'تفاصيل العرض (إنجليزي)',
        badgeAr: 'شارة صغيرة (مثال: عرض اليوم)',
        badgeEn: 'Badge EN (e.g. 1+1 FREE)',
        bogoToggle: 'عرض اشترِ 1 واحصل على 1 مجاناً (1+1)',
        promoLinkLabel: 'ربط بكوبون خصم (اختياري)',
        placementLabel: 'مكان ظهور العرض في المنيو',
        animationLabel: 'طريقة حركة البانر',
        bgColorLabel: 'لون الخلفية',
        textColorLabel: 'لون النص',
        saveOffersBtn: 'حفظ العروض والكوبونات',
        savedToast: 'تم حفظ العروض والأكواد وتحديث المنيو فوراً!',
        promosHeading: 'أكواد الخصم والكوبونات',
        addPromoBtn: '+ إضافة كود خصم',
        codeLabel: 'الكود (بالإنجليزية)',
        promoTypeLabel: 'نوع الخصم',
        promoValueLabel: 'القيمة',
        minOrderLabel: 'الحد الأدنى للطلب',
        typePercent: 'نسبة مئوية (%)',
        typeFixed: 'مبلغ ثابت',
        typeFreeDelivery: 'توصيل مجاني',
        typeWaiveService: 'إعفاء من رسوم الخدمة',
      },
      themes: {
        title: 'مظهر المنيو وإعدادات المطعم',
        subtitle: 'اختر من بين الثيمات الاحترافية أو الثيمات المخصصة وعدّل إعدادات الضريبة واللوجو.',
        customThemesTitle: 'ثيمات مخصصة من إدارة المنصة',
        customThemesBadge: 'ثيم مخصص',
        builtinThemesTitle: 'الثيمات الأساسية المتاحة',
        activeBadge: 'مُفعّل حالياً',
        selectThemeBtn: 'تفعيل هذا الثيم',
        settingsTitle: 'إعدادات المطعم والضرائب واللغة',
        settingsSubtitle: 'حدّث اسم المطعم والوصف باللغتين ونسب الضريبة والخدمة.',
        nameArLabel: 'اسم المطعم (عربي) *',
        nameEnLabel: 'اسم المطعم (إنجليزي)',
        taglineArLabel: 'الوصف المختصر (عربي)',
        taglineEnLabel: 'الوصف المختصر (إنجليزي)',
        slugLabel: 'الرابط المميز (Slug)',
        whatsappLabel: 'رقم الواتساب',
        currencyLabel: 'العملة',
        taxRateLabel: 'ضريبة القيمة المضافة (%)',
        serviceChargeLabel: 'رسوم الخدمة (%)',
        deliveryFeeLabel: 'رسوم التوصيل الثابتة',
        primaryColorLabel: 'اللون الأساسي للعلامة',
        columnsLabel: 'تخطيط عرض الأصناف (عدد الأعمدة)',
        colorModeLabel: 'وضع ألوان المنيو',
        colorModeAuto: 'تلقائي حسب الثيم',
        colorModeLight: 'نهاري فاتح (تباين عالٍ)',
        colorModeDark: 'ليلي داكن (تباين عالٍ)',
        customTypographyTitle: 'ألوان النصوص المخصصة (تباين ذكي)',
        headingColorLabel: 'لون عناوين الأطباق',
        descColorLabel: 'لون الوصف',
        priceColorLabel: 'لون الأسعار',
        resetColorsBtn: 'استعادة التباين التلقائي',
        isOpenLabel: 'حالة استقبال الطلبات',
        isOpenYes: 'مفتوح ويستقبل الطلبات',
        isOpenNo: 'مغلق مؤقتاً',
        logoLabel: 'تحديث الشعار',
        saveSettingsBtn: 'حفظ الإعدادات',
        savingBtn: 'جاري الحفظ...',
        savedToast: 'تم حفظ إعدادات المطعم بنجاح',
        previewLink: 'فتح المنيو للمعاينة',
      },
      qr: {
        title: 'مولد كود QR جاهز للطباعة',
        subtitle: 'اطبع هذا الكود وضعه على الطاولات ليتمكن العملاء من فتح المنيو وطلب الطعام مباشرة.',
        menuUrlLabel: 'الرابط المباشر للمنيو',
        copyUrlBtn: 'نسخ الرابط',
        copiedToast: 'تم نسخ الرابط!',
        downloadPngBtn: 'تحميل صورة QR عالية الدقة',
        printCardBtn: 'طباعة بطاقة الطاولة',
        cardScanPrompt: 'امسح الكود لتصفح المنيو والطلب من طاولتك',
        cardFooter: 'يدعم العربية والإنجليزية · طلب فوري',
        tipsTitle: 'نصائح لطباعة مثالية',
        tip1: 'استخدم ورق مقوى أو ستاند أكريليك بقياس A6 أو A5 على كل طاولة.',
        tip2: 'يمكنك تغيير الثيم أو الأسعار في أي وقت دون الحاجة لإعادة طباعة الكود.',
        tip3: 'جرب مسح الكود بكاميرا هاتفك للتأكد من سرعة التحميل قبل الطباعة.',
      },
    },
    signOutConfirm: {
      title: 'تأكيد تسجيل الخروج',
      desc: 'هل تريد حقاً تسجيل الخروج من لوحة التحكم الآن؟ يمكنك العودة في أي وقت بتسجيل الدخول مجدداً.',
      confirmBtn: 'نعم، تسجيل الخروج',
      cancelBtn: 'البقاء في اللوحة',
    },
    superAdmin: {
      title: 'لوحة الإدارة العليا (Super Admin)',
      subtitle: 'التحكم الكامل في المطاعم المشتركة، محقن الثيمات المخصصة، ومحتوى الصفحة الرئيسية.',
      backToOwner: 'العودة للوحة المطعم',
      backToHome: 'الصفحة الرئيسية',
      accessDeniedTitle: 'صلاحية غير مصرح بها',
      accessDeniedDesc: 'هذه اللوحة مخصصة لمدير المنصة فقط.',
      loginRequiredDesc: 'يرجى تسجيل الدخول بحساب مدير المنصة للوصول.',
      tabs: {
        tenants: 'المطاعم والمشتركين',
        themeInjector: 'حقن ثيمات مخصصة',
        cms: 'إدارة واجهة المنصة (CMS)',
      },
      tenants: {
        title: 'إدارة المطاعم والمشتركين',
        subtitle: 'استعراض كافة المطاعم، تفعيل أو إيقاف المنيو، أو تعديل القائمة نيابة عن العميل (Concierge).',
        refreshBtn: 'تحديث القائمة',
        searchPlaceholder: 'ابحث باسم المطعم أو المالك أو البريد أو الواتساب...',
        filterAll: 'الكل',
        filterActive: 'النشطة',
        filterSuspended: 'الموقوفة',
        totalRestaurants: 'إجمالي المطاعم',
        activeAccounts: 'حسابات نشطة',
        suspendedAccounts: 'حسابات موقوفة',
        ownerLabel: 'المالك:',
        whatsappLabel: 'واتساب:',
        themeLabel: 'الثيم:',
        statusActive: 'نشط',
        statusSuspended: 'موقوف',
        openMenuBtn: 'فتح المنيو',
        conciergeBtn: 'تجهيز المنيو (Concierge)',
        suspendBtn: 'إيقاف الحساب',
        activateBtn: 'تفعيل الحساب',
        deleteBtn: 'حذف نهائي',
        confirmDeleteTitle: 'تأكيد حذف المطعم بالكامل',
        confirmDeleteDesc: 'سيتم حذف المطعم وجميع أقسامه ووجباته وطلباته نهائياً. هل أنت متأكد؟',
        confirmDeleteBtn: 'نعم، احذف الحساب',
        cancelBtn: 'تراجع',
        conciergeTitle: 'محرر التجهيز السريع (Concierge)',
        conciergeSubtitle: 'أضف الأقسام والوجبات باللغتين مباشرة في حساب هذا المطعم.',
        closeConcierge: 'إغلاق المحرر',
      },
      cms: {
        title: 'محرر محتوى الصفحة الرئيسية (CMS)',
        subtitle: 'عدّل نصوص الواجهة والباقات والمميزات بالعربية والإنجليزية لتنعكس فوراً للزوار.',
        heroTitleAr: 'العنوان الرئيسي Hero (عربي)',
        heroTitleEn: 'Hero Title (English)',
        heroSubtitleAr: 'النص الفرعي Hero (عربي)',
        heroSubtitleEn: 'Hero Subtitle (English)',
        ctaAr: 'نص زر الدعوة للإجراء CTA (عربي)',
        ctaEn: 'CTA Button Text (English)',
        whatsappLabel: 'رقم واتساب الدعم والمبيعات',
        footerAr: 'نص التذييل Footer (عربي)',
        footerEn: 'Footer Text (English)',
        featuresHeading: 'مميزات المنصة',
        addFeatureBtn: '+ إضافة ميزة',
        featureTitleAr: 'عنوان الميزة (عربي)',
        featureTitleEn: 'Feature Title (English)',
        featureDescAr: 'وصف الميزة (عربي)',
        featureDescEn: 'Feature Description (English)',
        plansHeading: 'باقات الأسعار',
        planNameAr: 'اسم الباقة (عربي)',
        planNameEn: 'Plan Name (English)',
        planPrice: 'السعر',
        planPeriodAr: 'الفترة (عربي)',
        planPeriodEn: 'Period (English)',
        planDescAr: 'وصف الباقة (عربي)',
        planDescEn: 'Plan Description (English)',
        planFeaturesAr: 'مميزات الباقة (عربي - سطر لكل ميزة)',
        planFeaturesEn: 'Plan Features (English - one per line)',
        planHighlighted: 'تمييز كـ "الأكثر اختياراً"',
        saveBtn: 'حفظ ونشر التعديلات',
        savingBtn: 'جاري النشر...',
        savedToast: 'تم تحديث محتوى الصفحة الرئيسية بنجاح',
      },
      injector: {
        title: 'منشئ وحقن الثيمات المخصصة (HTML / CSS / JS)',
        subtitle: 'اكتب كود ثيم جديد بالكامل، اختبره في المعاينة الحية، واجعله متاحاً لجميع المطاعم.',
        newThemeBtn: '+ ثيم جديد',
        savedThemesTitle: 'الثيمات المحقونة',
        noThemes: 'لا توجد ثيمات مخصصة بعد.',
        activeLabel: 'مفعل للمطاعم',
        inactiveLabel: 'مسودة مخفية',
        nameArLabel: 'اسم الثيم (عربي) *',
        nameEnLabel: 'اسم الثيم (إنجليزي)',
        descArLabel: 'وصف الثيم (عربي)',
        descEnLabel: 'وصف الثيم (إنجليزي)',
        previewImgLabel: 'رابط صورة المعاينة (اختياري)',
        isActiveToggle: 'متاح لاختيار أصحاب المطاعم',
        variablesGuideTitle: 'دليل المتغيرات المتاحة (Data Variables)',
        copyVarBtn: 'نسخ',
        copiedVar: 'تم النسخ',
        loadBoilerplateBtn: 'تحميل قالب تفاعلي جاهز',
        livePreviewTitle: 'معاينة حية (Sandbox)',
        refreshPreviewBtn: 'تحديث المعاينة',
        saveThemeBtn: 'حفظ ونشر الثيم',
        savingBtn: 'جاري الحفظ...',
        deleteThemeBtn: 'حذف الثيم',
      },
    },
    menu: {
      loadingMenu: 'جاري تجهيز المنيو...',
      notFoundTitle: 'عذراً، هذا المنيو غير موجود',
      notFoundDesc: 'تأكد من صحة رابط المطعم أو امسح كود QR من جديد.',
      backHome: 'العودة للصفحة الرئيسية',
      suspendedTitle: 'عذراً، هذا المنيو متوقف مؤقتاً',
      suspendedDesc: 'يرجى التواصل مع إدارة المطعم لمزيد من التفاصيل.',
      closedBanner: 'المطعم مغلق حالياً ولا يستقبل طلبات جديدة',
      openNow: 'مفتوح الآن',
      closedNow: 'مغلق حالياً',
      searchPlaceholder: 'ابحث عن وجبة أو مشروب...',
      allCategories: 'الكل',
      noResults: 'لا توجد أصناف مطابقة لبحثك.',
      unavailable: 'غير متوفر حالياً',
      spicy: 'حار',
      popularBadge: 'الأكثر طلباً',
      ordersCountLabel: 'طلب',
      caloriesUnit: 'سعرة',
      addToCart: 'إضافة للسلة',
      addedToCart: 'تمت الإضافة إلى السلة',
      customizeOrder: 'تخصيص الطلب',
      chooseSize: 'اختر الحجم',
      chooseAddons: 'إضافات اختيارية',
      optionalAddons: 'اختر ما يناسبك من الإضافات',
      specialNotes: 'ملاحظات خاصة على الطبق',
      notesPlaceholder: 'مثال: بدون بصل، صوص جانبي...',
      quantity: 'الكمية',
      addWithTotal: 'أضف للسلة',
      cartTitle: 'سلة الطلبات',
      cartEmptyTitle: 'سلتك فارغة حالياً',
      cartEmptyDesc: 'اختر أطباقك المفضلة من المنيو وأضفها للسلة.',
      browseMenu: 'تصفح المنيو',
      itemsCountLabel: 'صنف',
      orderTypeLabel: 'نوع الطلب',
      dineIn: 'داخل الصالة',
      delivery: 'توصيل (دليفري)',
      pickup: 'استلام من الفرع',
      customerName: 'الاسم *',
      customerNamePlaceholder: 'اكتب اسمك',
      customerPhone: 'رقم الجوال / واتساب *',
      customerPhonePlaceholder: '01xxxxxxxxx',
      tableNumber: 'رقم الطاولة *',
      tableNumberPlaceholder: 'مثال: 7',
      deliveryAddress: 'عنوان التوصيل بالتفصيل *',
      deliveryAddressPlaceholder: 'المنطقة، الشارع، رقم العمارة والدور',
      orderNotes: 'ملاحظات إضافية للطلب',
      orderNotesPlaceholder: 'أي تفاصيل أخرى تود إبلاغ المطعم بها...',
      subtotal: 'المجموع الفرعي',
      serviceCharge: 'رسوم الخدمة',
      tax: 'الضريبة',
      grandTotal: 'الإجمالي النهائي',
      sendDirectBtn: 'تأكيد وإرسال الطلب للمطبخ',
      sendWhatsappBtn: 'إرسال الطلب عبر واتساب',
      sendingBtn: 'جاري إرسال الطلب...',
      orderSuccessTitle: 'تم استلام طلبك بنجاح!',
      orderSuccessDesc: 'وصل طلبك إلى شاشة المطبخ وسيتم تجهيزه فوراً.',
      orderNumberLabel: 'رقم الطلب',
      openWhatsappAgain: 'إرسال نسخة عبر واتساب',
      newOrderBtn: 'بدء طلب جديد',
      errMissingCustomer: 'يرجى إدخال الاسم ورقم الجوال.',
      errMissingTable: 'يرجى إدخال رقم الطاولة لطلبات الصالة.',
      errMissingAddress: 'يرجى إدخال عنوان التوصيل.',
      errOrderFailed: 'حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مجدداً.',
      demoPreviewBanner: 'وضع المعاينة الحية — الطلبات هنا تجريبية',
      flipbookInstruction: 'اسحب أو انقر الأسهم لتقليب الصفحات · انقر على أي طبق للتخصيص',
      pageLabel: 'صفحة',
      prevPage: 'السابق',
      nextPage: 'التالي',
      coverBadge: 'القائمة التفاعلية الفاخرة',
      startReading: 'تصفح الكتاب',
      dishCountSuffix: 'أطباق',
      storyPrev: 'الطبق السابق',
      storyNext: 'الطبق التالي',
      quickAdd: 'إضافة سريعة',
      viewCart: 'عرض السلة',
      currencyLabel: 'ج.م',
      taxNoticePrefix: 'ضريبة',
      serviceNoticePrefix: 'خدمة',
      sortLabel: 'ترتيب:',
      sortDefault: 'الافتراضي',
      sortBestSelling: 'الأكثر طلباً هذا الأسبوع',
      sortChefChoice: 'الأعلى جودة (اختيار الشيف)',
      sortLowestPrice: 'الأقل سعراً',
      bogoBadge: '1+1 مجاناً',
      bogoIncluded: 'يشمل قطعة مجانية (1+1)',
      promoPlaceholder: 'أدخل كود الخصم...',
      applyPromo: 'تطبيق',
      removePromo: 'إزالة',
      discountLabel: 'الخصم',
      deliveryFeeLabel: 'رسوم التوصيل',
      clearCart: 'إفراغ السلة',
      pairingsHeading: 'أضف مع طلبك (مقترحات الشيف)',
    },
  },
  en: {
    brandName: 'Sufra QR',
    brandSubtitle: 'Multi-Tenant Smart QR Menu SaaS',
    nav: {
      features: 'Features',
      themes: 'Themes',
      pricing: 'Pricing',
      superAdmin: 'Super Admin',
      ownerDashboard: 'Owner Dashboard',
      createMenuFree: 'Create Free Menu',
      home: 'Home',
    },
    landing: {
      badge: 'All-in-One SaaS Platform for Restaurants & Cafes',
      viewLiveDemos: 'Explore Live Demos',
      interactiveDemosTitle: 'Try Live Interactive Menus Now',
      interactiveDemosDesc: 'Browse 3 pre-built restaurant menus with distinct themes before creating your account.',
      openDemoMenu: 'Preview Live Menu',
      featuresTitle: 'Everything Your Restaurant Needs in One Place',
      featuresDesc: 'Instant cloud architecture isolating every restaurant with full control over menus and live kitchen orders.',
      themesTitle: 'Interactive Themes + WhatsApp Chat & Custom Code',
      themesDesc: 'Switch your menu design anytime with one click without reprinting your table QR codes.',
      flagshipBadge: 'MOST POPULAR · 3D',
      pricingTitle: 'Flexible Plans for Every Venue Size',
      pricingDesc: 'Start free or upgrade anytime with dedicated onboarding support.',
      mostPopular: 'Best Value',
      subscribeNow: 'Get Started',
      contactWhatsapp: 'Chat on WhatsApp',
      footerSupport: 'Priority Support',
      authTitle: 'Restaurant Owner Portal',
      authSubtitle: 'Sign in or create an account to manage your digital menu and receive live orders.',
      demoTagline1: '3D Flipbook & Floating Dish Theme',
      demoTagline2: 'Luxury Gold Lounge Theme',
      demoTagline3: 'Warm Cafe & Bakery Theme',
      tryTheme: 'Preview Theme',
    },
    auth: {
      loginTab: 'Sign In',
      registerTab: 'Create Restaurant Account',
      ownerLoginHeading: 'Restaurant Owner Sign In',
      ownerRegisterHeading: 'New Restaurant Account',
      ownerHeadingDesc: 'Manage dishes, prices, themes, and live table orders in real time.',
      fullNameLabel: 'Owner Full Name',
      fullNamePlaceholder: 'e.g. John Doe',
      emailLabel: 'Email Address',
      passwordLabel: 'Password',
      loginBtn: 'Enter Dashboard',
      registerBtn: 'Create Account & Start',
      forgotPassword: 'Forgot password?',
      resetSent: 'Password reset link has been sent to your email.',
      enterEmailFirst: 'Please enter your email address first.',
      errInvalidCred: 'Incorrect email or password.',
      errEmailInUse: 'This email is already registered.',
      errWeakPass: 'Password must be at least 6 characters.',
      errGeneric: 'Unable to complete request, please try again.',
    },
    onboarding: {
      badge: 'Restaurant Onboarding',
      title: 'Launch Your Digital Menu in 1 Minute',
      subtitle: 'Enter your restaurant details in Arabic & English so guests can switch languages seamlessly.',
      nameArLabel: 'Restaurant Name (Arabic) *',
      nameArPlaceholder: 'e.g. برجر لاب',
      nameEnLabel: 'Restaurant Name (English)',
      nameEnPlaceholder: 'e.g. Buns Lab',
      slugLabel: 'Unique Menu URL (Slug) *',
      slugChecking: 'Checking URL availability...',
      slugAvailable: 'URL is available!',
      slugTaken: 'This URL is already taken, try another.',
      slugHint: 'Lowercase English letters, numbers, and hyphens (-) only',
      whatsappLabel: 'WhatsApp Number for Orders *',
      currencyLabel: 'Currency',
      taglineArLabel: 'Short Description (Arabic)',
      taglineArPlaceholder: 'أشهى وجبات البرجر المحضرة يومياً...',
      taglineEnLabel: 'Short Description (English)',
      taglineEnPlaceholder: 'Daily fresh smashed wagyu burgers...',
      logoLabel: 'Restaurant Logo',
      logoUploaded: 'Logo uploaded successfully',
      logoPlaceholder: 'Click to upload logo image',
      logoUploading: 'Uploading logo...',
      seedCheckboxTitle: 'Pre-fill bilingual starter menu (categories & dishes)',
      seedCheckboxDesc: 'Recommended to preview immediately and customize items later.',
      submitBtn: 'Save & Open Dashboard',
      autoFillEn: 'Auto-Fill EN',
      errRequired: 'Please enter restaurant name, URL slug, and WhatsApp number.',
      errSlugInvalid: 'Slug must be at least 2 valid lowercase characters.',
      errSlugTaken: 'This slug is already reserved, please choose another.',
    },
    admin: {
      workspaceTitle: 'Owner Dashboard',
      superAdminBtn: 'Super Admin',
      viewPublicMenu: 'View Public Menu',
      signOut: 'Sign Out',
      loadingWorkspace: 'Loading your restaurant workspace...',
      tabs: {
        orders: 'Live Orders',
        menu: 'Menu Builder',
        offers: 'Offers & Promos',
        themes: 'Themes & Settings',
        qr: 'QR Code & Print',
      },
      orders: {
        title: 'Live Incoming Orders',
        subtitle: 'Instant real-time sync whenever a table or delivery order is placed.',
        soundOn: 'Sound Alert ON',
        soundOff: 'Sound Muted',
        testSound: 'Test Chime',
        statsPending: 'Pending',
        statsPreparing: 'Preparing',
        statsCompleted: 'Completed',
        statsTodaySales: 'Total Revenue',
        filterAll: 'All',
        statusPending: 'New Order',
        statusPreparing: 'Preparing',
        statusCompleted: 'Completed',
        statusCancelled: 'Cancelled',
        emptyTitle: 'No matching orders yet',
        emptyDesc: 'Incoming customer orders will appear here instantly with an audio chime.',
        typeDineIn: 'Dine-In',
        typeDelivery: 'Delivery',
        typePickup: 'Pickup',
        tablePrefix: 'Table',
        subtotal: 'Subtotal',
        service: 'Service',
        tax: 'Tax',
        total: 'Total',
        notesLabel: 'Customer Notes:',
        btnStartPreparing: 'Start Preparing',
        btnComplete: 'Mark Completed',
        btnCancel: 'Cancel Order',
        justNow: 'Just now',
      },
      menu: {
        title: 'Categories & Dishes Manager',
        subtitle: 'Manage bilingual AR/EN items, prices, calories, sizes, and add-ons.',
        seedBtn: 'Seed Sample Menu',
        seedingBtn: 'Seeding...',
        categoriesHeading: 'Menu Categories',
        addCategoryPlaceholderAr: 'Arabic Name (e.g. البرجر)',
        addCategoryPlaceholderEn: 'English Name (e.g. Burgers)',
        addCategoryBtn: 'Add Category',
        allCategories: 'All Categories',
        dishesCount: 'items',
        emptyCategories: 'Create your first category to start building your menu.',
        emptyItemsTitle: 'No dishes in this category yet',
        emptyItemsDesc: 'Add your first dish or click Seed Sample Menu.',
        addItemBtn: 'Add New Dish',
        editItemTitle: 'Edit Dish',
        newItemTitle: 'Add New Dish',
        nameArLabel: 'Dish Name (Arabic) *',
        nameEnLabel: 'Dish Name (English)',
        autoFillEn: 'Auto-Fill EN',
        categoryLabel: 'Category *',
        descArLabel: 'Description (Arabic)',
        descEnLabel: 'Description (English)',
        basePriceLabel: 'Base Price *',
        caloriesLabel: 'Calories (Optional)',
        spicyToggle: 'Spicy Dish 🌶️',
        availableToggle: 'Available to Order',
        imageLabel: 'Dish Image',
        uploadImage: 'Upload Dish Photo',
        sizesHeading: 'Sizes (Optional)',
        addSizeBtn: '+ Add Size',
        sizeArPlaceholder: 'Size AR (وسط)',
        sizeEnPlaceholder: 'Size EN (Medium)',
        addonsHeading: 'Optional Add-ons',
        addAddonBtn: '+ Add Option',
        addonArPlaceholder: 'Addon AR (جبنة)',
        addonEnPlaceholder: 'Addon EN (Extra Cheese)',
        saveItemBtn: 'Save Dish',
        cancelBtn: 'Cancel',
        availableBadge: 'Available',
        unavailableBadge: 'Sold Out',
        spicyBadge: 'Spicy',
        caloriesUnit: 'kcal',
        editCategoryTitle: 'Edit Category',
        saveCategoryBtn: 'Save Category',
        badgeLabel: 'Highlight Badge',
        bogoToggle: 'Buy 1 Get 1 Free (1+1 Deal)',
        suggestedItemsHeading: 'Suggested Pairings (Upsell Items)',
        quickAddonsLabel: '1-Click Quick Add-ons:',
      },
      offers: {
        title: 'Offers, Banners & Promo Codes',
        subtitle: 'Create 1+1 BOGO banners, control menu placement & motion style, and configure discount/fee-waiver promo codes.',
        bannersHeading: 'Promotional Banners & BOGO Deals',
        addBannerBtn: '+ Add Offer Banner',
        bannerTitleAr: 'Offer Title (Arabic) *',
        bannerTitleEn: 'Offer Title (English)',
        bannerSubAr: 'Details (Arabic)',
        bannerSubEn: 'Details (English)',
        badgeAr: 'Tag Label (Arabic)',
        badgeEn: 'Tag Label (English)',
        bogoToggle: 'Buy 1 Get 1 Free (1+1)',
        promoLinkLabel: 'Link Promo Code (Optional)',
        placementLabel: 'Banner Placement in Menu',
        animationLabel: 'Animation Style',
        bgColorLabel: 'Background Color',
        textColorLabel: 'Text Color',
        saveOffersBtn: 'Save Offers & Promos',
        savedToast: 'Offers & promo codes saved live!',
        promosHeading: 'Promo & Discount Codes',
        addPromoBtn: '+ Add Promo Code',
        codeLabel: 'Promo Code',
        promoTypeLabel: 'Discount Type',
        promoValueLabel: 'Value',
        minOrderLabel: 'Minimum Order',
        typePercent: 'Percentage (%)',
        typeFixed: 'Fixed Amount',
        typeFreeDelivery: 'Free Delivery',
        typeWaiveService: 'Waive Service Charge',
      },
      themes: {
        title: 'Menu Themes & Store Settings',
        subtitle: 'Switch between all built-in themes or custom themes and configure taxes & branding.',
        customThemesTitle: 'Custom Platform Themes',
        customThemesBadge: 'Custom Theme',
        builtinThemesTitle: 'Built-in Interactive Themes',
        activeBadge: 'Active Theme',
        selectThemeBtn: 'Activate Theme',
        settingsTitle: 'Restaurant, Bilingual & Tax Settings',
        settingsSubtitle: 'Update AR/EN branding, currency, tax rate, and service charge.',
        nameArLabel: 'Restaurant Name (Arabic) *',
        nameEnLabel: 'Restaurant Name (English)',
        taglineArLabel: 'Tagline (Arabic)',
        taglineEnLabel: 'Tagline (English)',
        slugLabel: 'Unique URL (Slug)',
        whatsappLabel: 'WhatsApp Number',
        currencyLabel: 'Currency',
        taxRateLabel: 'VAT / Tax Rate (%)',
        serviceChargeLabel: 'Service Charge (%)',
        deliveryFeeLabel: 'Delivery Fee',
        primaryColorLabel: 'Brand Primary Color',
        columnsLabel: 'Dish Grid Columns',
        colorModeLabel: 'Menu Color Mode',
        colorModeAuto: 'Theme Default (Auto)',
        colorModeLight: 'Light High-Contrast',
        colorModeDark: 'Dark High-Contrast',
        customTypographyTitle: 'Custom Typography Colors',
        headingColorLabel: 'Dish Title Color',
        descColorLabel: 'Description Color',
        priceColorLabel: 'Price Color',
        resetColorsBtn: 'Reset to Auto Contrast',
        isOpenLabel: 'Store Status',
        isOpenYes: 'Open & Accepting Orders',
        isOpenNo: 'Temporarily Closed',
        logoLabel: 'Update Logo',
        saveSettingsBtn: 'Save Settings',
        savingBtn: 'Saving...',
        savedToast: 'Restaurant settings saved!',
        previewLink: 'Open Live Menu',
      },
      qr: {
        title: 'Printable QR Code Generator',
        subtitle: 'Print and place on every table so customers can scan, switch languages, and order.',
        menuUrlLabel: 'Direct Menu Link',
        copyUrlBtn: 'Copy Link',
        copiedToast: 'Link copied!',
        downloadPngBtn: 'Download High-Res QR PNG',
        printCardBtn: 'Print Table Tent Card',
        cardScanPrompt: 'Scan to browse the menu & order from your table',
        cardFooter: 'Arabic & English Ready · Instant Order',
        tipsTitle: 'Printing Best Practices',
        tip1: 'Print on A6 or A5 cardstock or place inside acrylic table stands.',
        tip2: 'You can change themes, prices, and dishes anytime without reprinting QR codes.',
        tip3: 'Always test scanning with your phone camera before bulk printing.',
      },
    },
    signOutConfirm: {
      title: 'Confirm Sign Out',
      desc: 'Are you sure you want to sign out of your dashboard? You can sign back in anytime.',
      confirmBtn: 'Yes, Sign Out',
      cancelBtn: 'Stay Signed In',
    },
    superAdmin: {
      title: 'Super Admin Control Center',
      subtitle: 'Manage all subscribed restaurants, custom theme injection, and landing page CMS.',
      backToOwner: 'Owner Dashboard',
      backToHome: 'Landing Page',
      accessDeniedTitle: 'Access Restricted',
      accessDeniedDesc: 'This console is strictly restricted to the platform Super Admin.',
      loginRequiredDesc: 'Please sign in with the Super Admin account to continue.',
      tabs: {
        tenants: 'Restaurants & Tenants',
        themeInjector: 'Custom Theme Injector',
        cms: 'Landing Page CMS',
      },
      tenants: {
        title: 'Tenants & Restaurants Management',
        subtitle: 'Monitor all registered venues, suspend/activate menus, or use Concierge Mode to build menus.',
        refreshBtn: 'Refresh List',
        searchPlaceholder: 'Search by restaurant, owner, email, or WhatsApp...',
        filterAll: 'All',
        filterActive: 'Active',
        filterSuspended: 'Suspended',
        totalRestaurants: 'Total Venues',
        activeAccounts: 'Active Accounts',
        suspendedAccounts: 'Suspended',
        ownerLabel: 'Owner:',
        whatsappLabel: 'WhatsApp:',
        themeLabel: 'Theme:',
        statusActive: 'Active',
        statusSuspended: 'Suspended',
        openMenuBtn: 'Open Menu',
        conciergeBtn: 'Concierge Editor',
        suspendBtn: 'Suspend Account',
        activateBtn: 'Activate Account',
        deleteBtn: 'Delete Account',
        confirmDeleteTitle: 'Confirm Permanent Deletion',
        confirmDeleteDesc: 'This will permanently delete the restaurant, categories, dishes, and orders. Continue?',
        confirmDeleteBtn: 'Yes, Delete Permanently',
        cancelBtn: 'Cancel',
        conciergeTitle: 'Concierge Menu Editor',
        conciergeSubtitle: 'Build bilingual categories and dishes directly inside this restaurant account.',
        closeConcierge: 'Close Editor',
      },
      cms: {
        title: 'Landing Page Content Manager (CMS)',
        subtitle: 'Edit Hero text, features, and pricing plans in both Arabic and English.',
        heroTitleAr: 'Hero Title (Arabic)',
        heroTitleEn: 'Hero Title (English)',
        heroSubtitleAr: 'Hero Subtitle (Arabic)',
        heroSubtitleEn: 'Hero Subtitle (English)',
        ctaAr: 'CTA Button Text (Arabic)',
        ctaEn: 'CTA Button Text (English)',
        whatsappLabel: 'Support & Sales WhatsApp',
        footerAr: 'Footer Text (Arabic)',
        footerEn: 'Footer Text (English)',
        featuresHeading: 'Platform Features',
        addFeatureBtn: '+ Add Feature',
        featureTitleAr: 'Feature Title (Arabic)',
        featureTitleEn: 'Feature Title (English)',
        featureDescAr: 'Feature Description (Arabic)',
        featureDescEn: 'Feature Description (English)',
        plansHeading: 'Pricing Plans',
        planNameAr: 'Plan Name (Arabic)',
        planNameEn: 'Plan Name (English)',
        planPrice: 'Price',
        planPeriodAr: 'Billing Period (Arabic)',
        planPeriodEn: 'Billing Period (English)',
        planDescAr: 'Description (Arabic)',
        planDescEn: 'Description (English)',
        planFeaturesAr: 'Plan Features (Arabic - one per line)',
        planFeaturesEn: 'Plan Features (English - one per line)',
        planHighlighted: 'Highlight as "Best Value"',
        saveBtn: 'Save & Publish CMS',
        savingBtn: 'Publishing...',
        savedToast: 'Landing page content updated!',
      },
      injector: {
        title: 'Custom Theme Code Injector (HTML / CSS / JS)',
        subtitle: 'Author bespoke HTML/CSS/JS themes, preview in sandbox, and publish to all restaurants.',
        newThemeBtn: '+ New Custom Theme',
        savedThemesTitle: 'Injected Themes',
        noThemes: 'No custom themes created yet.',
        activeLabel: 'Published to Owners',
        inactiveLabel: 'Hidden Draft',
        nameArLabel: 'Theme Name (Arabic) *',
        nameEnLabel: 'Theme Name (English)',
        descArLabel: 'Description (Arabic)',
        descEnLabel: 'Description (English)',
        previewImgLabel: 'Preview Image URL (Optional)',
        isActiveToggle: 'Available for Restaurant Owners',
        variablesGuideTitle: 'Available Data Variables',
        copyVarBtn: 'Copy',
        copiedVar: 'Copied',
        loadBoilerplateBtn: 'Load Interactive Starter Template',
        livePreviewTitle: 'Live Sandbox Preview',
        refreshPreviewBtn: 'Refresh Preview',
        saveThemeBtn: 'Save & Publish Theme',
        savingBtn: 'Saving...',
        deleteThemeBtn: 'Delete Theme',
      },
    },
    menu: {
      loadingMenu: 'Preparing your menu...',
      notFoundTitle: 'Sorry, this menu could not be found',
      notFoundDesc: 'Please verify the restaurant link or scan the QR code again.',
      backHome: 'Back to Home',
      suspendedTitle: 'Sorry, this menu is temporarily unavailable',
      suspendedDesc: 'Please contact the restaurant management for more information.',
      closedBanner: 'Restaurant is currently closed and not accepting new orders',
      openNow: 'Open Now',
      closedNow: 'Closed',
      searchPlaceholder: 'Search dishes or drinks...',
      allCategories: 'All',
      noResults: 'No dishes match your search.',
      unavailable: 'Sold Out',
      spicy: 'Spicy',
      popularBadge: 'Popular',
      ordersCountLabel: 'orders',
      caloriesUnit: 'kcal',
      addToCart: 'Add to Cart',
      addedToCart: 'Added to your cart',
      customizeOrder: 'Customize Dish',
      chooseSize: 'Choose Size',
      chooseAddons: 'Optional Add-ons',
      optionalAddons: 'Customize with extra toppings or sides',
      specialNotes: 'Special Instructions',
      notesPlaceholder: 'e.g. No onions, sauce on the side...',
      quantity: 'Quantity',
      addWithTotal: 'Add to Cart',
      cartTitle: 'Your Order Cart',
      cartEmptyTitle: 'Your cart is empty',
      cartEmptyDesc: 'Pick your favorite dishes from the menu to start your order.',
      browseMenu: 'Browse Menu',
      itemsCountLabel: 'items',
      orderTypeLabel: 'Order Type',
      dineIn: 'Dine-In',
      delivery: 'Delivery',
      pickup: 'Pickup',
      customerName: 'Your Name *',
      customerNamePlaceholder: 'Enter your name',
      customerPhone: 'Phone / WhatsApp *',
      customerPhonePlaceholder: '+20 1xxxxxxxxx',
      tableNumber: 'Table Number *',
      tableNumberPlaceholder: 'e.g. 7',
      deliveryAddress: 'Full Delivery Address *',
      deliveryAddressPlaceholder: 'Area, street, building, floor...',
      orderNotes: 'Additional Order Notes',
      orderNotesPlaceholder: 'Any extra requests for the kitchen...',
      subtotal: 'Subtotal',
      serviceCharge: 'Service Charge',
      tax: 'VAT / Tax',
      grandTotal: 'Grand Total',
      sendDirectBtn: 'Place Order Directly to Kitchen',
      sendWhatsappBtn: 'Order via WhatsApp',
      sendingBtn: 'Sending Order...',
      orderSuccessTitle: 'Order Received Successfully!',
      orderSuccessDesc: 'Your order is now on the kitchen screen and being prepared.',
      orderNumberLabel: 'Order Number',
      openWhatsappAgain: 'Send Copy via WhatsApp',
      newOrderBtn: 'Start New Order',
      errMissingCustomer: 'Please enter your name and phone number.',
      errMissingTable: 'Please enter your table number for dine-in orders.',
      errMissingAddress: 'Please enter your delivery address.',
      errOrderFailed: 'Failed to submit order, please try again.',
      demoPreviewBanner: 'Live Preview Mode — Orders here are simulated',
      flipbookInstruction: 'Swipe or tap arrows to flip pages · Tap any dish to customize',
      pageLabel: 'Page',
      prevPage: 'Prev',
      nextPage: 'Next',
      coverBadge: 'Luxury Interactive Menu',
      startReading: 'Open Menu Book',
      dishCountSuffix: 'dishes',
      storyPrev: 'Previous Dish',
      storyNext: 'Next Dish',
      quickAdd: 'Quick Add',
      viewCart: 'View Cart',
      currencyLabel: 'EGP',
      taxNoticePrefix: 'VAT',
      serviceNoticePrefix: 'Service',
      sortLabel: 'Sort:',
      sortDefault: 'Default',
      sortBestSelling: 'Most Ordered This Week',
      sortChefChoice: 'Highest Quality / Chef Picks',
      sortLowestPrice: 'Lowest Price',
      bogoBadge: '1+1 FREE',
      bogoIncluded: 'Includes 1 Free (BOGO)',
      promoPlaceholder: 'Enter promo code...',
      applyPromo: 'Apply',
      removePromo: 'Remove',
      discountLabel: 'Discount',
      deliveryFeeLabel: 'Delivery Fee',
      clearCart: 'Clear Cart',
      pairingsHeading: 'Frequently Paired With',
    },
  },
};
