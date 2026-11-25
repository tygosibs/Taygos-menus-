import { LandingSectionConfig, PlatformLandingSettings } from '../types/menu';

export const DEFAULT_LANDING_SECTIONS: LandingSectionConfig[] = [
  { id: 'hero', isVisible: true },
  { id: 'themes', isVisible: true },
  { id: 'features', isVisible: true },
  { id: 'operations', isVisible: true },
  { id: 'loyalty', isVisible: true },
  { id: 'pricing', isVisible: true },
  { id: 'tygos_promo', isVisible: true },
];

export const DEFAULT_PLATFORM_LANDING: PlatformLandingSettings = {
  sections: DEFAULT_LANDING_SECTIONS,
  heroBadge: 'منظومة الضيافة الرقمية الأحدث في مصر والوطن العربي',
  heroBadge_en: 'Next-Generation Restaurant Hospitality SaaS',
  heroTitle: 'منيو مطعمك الإلكتروني.. أذكى، أسرع، وبيبيع عنك في كل ترابيزة',
  heroTitle_en: 'A Smarter Digital Menu That Sells Better on Every Table',
  heroSubtitle:
    'ارتقِ بتجربة ضيوفك بـ 10 ثيمات احترافية منها كتاب المنيو ثلاثي الأبعاد وشات واتساب التفاعلي، مع إدارة كاملة للصالات والترابيزات وتقسيم الشيك بالاسم، وشاشات المطبخ والكابتن اللحظية، ومنظومة ولاء العملاء وأعياد الميلاد.',
  heroSubtitle_en:
    'Elevate every guest visit with 10 built-in interactive themes including our 3D Flipbook and WhatsApp Ordering Chat, collaborative group tables with Split Check billing, multi-station KDS & Captain screens, and automated Loyalty & Birthday CRM.',
  ctaButtonText: 'ابدأ الآن وأطلق منيو مطعمك',
  ctaButtonText_en: 'Launch Your Digital Menu',
  heroSecondaryBtnText: 'جرّب المنيو التفاعلي مباشرة',
  heroSecondaryBtnText_en: 'Explore Live Demo Menu',
  themesTitle: '10 ثيمات عالمية تليق بهوية مطعمك وتجذب العميل للطلب',
  themesTitle_en: '10 Built-in Interactive Themes Crafted for Every Dining Concept',
  themesSubtitle:
    'من كتاب المنيو الفاخر ثلاثي الأبعاد (الأكثر طلباً 🔥) إلى تجربة شات واتساب التفاعلي — بدّل تصميم المنيو بالكامل بضغطة زر مع ثبات نفس كود الطاولة المطبوع.',
  themesSubtitle_en:
    'From our flagship 3D Flipbook (Most Popular 🔥) to conversational WhatsApp Ordering Chat — switch your look anytime without reprinting a single Table QR Code.',
  featuresTitle: 'كل ما تحتاجه لإدارة منيو ذكي يرفع متوسط الفاتورة',
  featuresTitle_en: 'Everything Needed to Turn Every Scan Into Higher Sales',
  featuresSubtitle:
    'أدوات احترافية مصممة لقطاع المطاعم والكافيهات لزيادة المبيعات وتقليل أخطاء الطلبات باللغتين العربية والإنجليزية.',
  featuresSubtitle_en:
    'Purpose-built hospitality tools that boost average ticket size and eliminate manual ordering errors in Arabic & English.',
  features: [
    {
      title: '10 ثيمات تفاعلية + حقن ثيمات مخصصة',
      title_en: '10 Interactive Themes & Custom Styles',
      description:
        'استعرض قائمة طعامك في كتاب ثلاثي الأبعاد، أو عرض قصصي، أو شات واتساب التفاعلي مع تحكم كامل في الألوان والوضع الليلي والنهاري.',
      description_en:
        'Showcase dishes as a 3D Flipbook, interactive Reels story, or WhatsApp Chat with custom brand colors and light/dark contrast modes.',
      isVisible: true,
    },
    {
      title: 'أحجام، إضافات، ومقترحات زيادة البيع',
      title_en: 'Sizes, Add-ons & Smart Upsell Pairings',
      description:
        'سعرات حرارية، أحجام متعددة، إضافات مدفوعة، وعروض 1+1 مجاناً، مع اقتراح الأصناف المكملة داخل السلة لزيادة قيمة كل طلب.',
      description_en:
        'Manage calories, multiple sizes, paid add-ons, 1+1 BOGO promos, and automated cart pairings that naturally increase order value.',
      isVisible: true,
    },
    {
      title: 'استلام مزدوج: شاشات المطبخ أو واتساب',
      title_en: 'Dual Checkout: Kitchen Board & WhatsApp',
      description:
        'يختار الضيف بين إرسال الطلب مباشرة لشاشة المطبخ والكاشير بالرنين التنبيهي، أو كفاتورة أنيقة ومفصّلة عبر واتساب المطعم.',
      description_en:
        'Guests send orders directly to your live Kitchen Display System (KDS) with instant chimes or as formatted bilingual WhatsApp orders.',
      isVisible: true,
    },
    {
      title: 'أكواد خصم وعروض متحركة بالمنيو',
      title_en: 'Animated Promo Banners & Coupons',
      description:
        'أطلق بانرات العروض المتحركة وكوبونات الخصم وإلغاء رسوم التوصيل أو الخدمة فوراً مع معاينة فورية لشكل مشاركة الرابط.',
      description_en:
        'Launch animated in-menu offer banners, percentage or fixed promo codes, and rich restaurant WhatsApp link preview cards.',
      isVisible: true,
    },
  ],
  operationsBadge: 'تشغيل الصالة والمطبخ بدون أخطاء',
  operationsBadge_en: 'Unified Dining Floor & Kitchen Operations',
  operationsTitle: 'من الترابيزة للمطبخ والكابتن.. في أقل من ثانية',
  operationsTitle_en: 'Seamless Table-to-Kitchen & Captain Synchronization',
  operationsSubtitle:
    'نظام صالة متكامل يمنح ضيوفك حرية الطلب الجماعي وتقسيم الشيك، ويمنح فريقك شاشات تشغيل واضحة لكل محطة تحضير.',
  operationsSubtitle_en:
    'Empower groups to collaborate on one live table cart with Split Check billing while routing items cleanly to Kitchen, Bar, and Pastry screens.',
  operationsBullets: [
    'تقسيم المطعم لصالات ومناطق متعددة وتوليد أكواد الطاولات بضغطة واحدة (من 1 إلى 200 طاولة).',
    'الطلب الجماعي على الطاولة وتقسيم الشيك بالاسم: كل ضيف يطلب من هاتفه ويراجع حسابه الخاص أو الإجمالي.',
    'شاشات التحضير المقسمة: فصل تلقائي لأصناف المطبخ الساخن والبار والمشروبات والباستري مع متابعة لحظية.',
    'شاشة الكابتن الفورية: استقبال نداء الكابتن وطلبات الفاتورة (كاش أو فيزا) وطلبات المياه والأدوات بتنبيه صوتي واضح.',
  ],
  operationsBullets_en: [
    'Multi-hall zoning with 1-click Bulk Table QR Code generation for any table count (1 to 200 tables per hall).',
    'Collaborative Group Table Cart & Split Check billing by guest name right from each phone.',
    'Kitchen Display System (KDS) screens routing dishes automatically to Kitchen, Bar, and Pastry prep stations.',
    'Instant Captain console for table calls, Cash/Card check requests, and water/cutlery alerts.',
  ],
  loyaltyBadge: 'ولاء ذكي يضاعف عودة العملاء',
  loyaltyBadge_en: 'Smart Retention, Loyalty & Birthday Radar',
  loyaltyTitle: 'حوّل ضيف أول مرة إلى عميل دائم في مطعمك',
  loyaltyTitle_en: 'Turn First-Time Visitors Into Loyal Regulars',
  loyaltySubtitle:
    'منظومة ولاء متكاملة تبني لك قاعدة بيانات عملاء حقيقية برقم الموبايل وتذكّرك بمناسباتهم قبلها بـ 3 أيام.',
  loyaltySubtitle_en:
    'Capture customer preferences in one tap, reward repeat visits with digital Punch Cards, and trigger proactive WhatsApp birthday offers.',
  loyaltyBullets: [
    'تسجيل سريع بضغطة واحدة برقم الهاتف والاسم وتاريخ الميلاد مع خصم ترحيبي فوري على أول طلب.',
    'بطاقة الأختام الرقمية تحفّز العميل على إكمال زياراته للحصول على مكافأته الخاصة.',
    'الترشيح الذكي: إعادة طلب آخر وجبة بضغطة واحدة مع إبراز أطباقه المفضلة تلقائياً فور دخوله للمنيو.',
    'رادار أعياد الميلاد الاستباقي (3 أيام) + لوحة إدارة العملاء لإرسال معايدات وهدايا واتساب مخصصة وتصدير البيانات.',
  ],
  loyaltyBullets_en: [
    '1-tap phone registration with automatic first-order welcome discount.',
    'Digital Loyalty Punch Card that rewards repeat visits automatically.',
    'Personalized dish highlights and 1-tap reorder of each guest’s favorite meals.',
    'Proactive 3-day Birthday Radar & Customer CRM dashboard with 1-click WhatsApp gift messaging and CSV export.',
  ],
  pricingTitle: 'باقات اشتراك مرنة تناسب طموح مطعمك',
  pricingTitle_en: 'Flexible Plans Built for Every Stage of Growth',
  pricingSubtitle:
    'اختر الباقة المناسبة لحجم صالتك وطلباتك مع دعم فني مباشر وتحديثات مستمرة.',
  pricingSubtitle_en:
    'Pick the plan that matches your dining room volume with direct onboarding support and continuous updates.',
  pricingCtaText: 'اشترك وابدأ الآن',
  pricingCtaText_en: 'Get Started Now',
  pricingPlans: [
    {
      id: 'starter',
      name: 'الباقة الأساسية',
      name_en: 'Starter Plan',
      price: '299',
      period: 'ج.م / شهرياً',
      period_en: 'EGP / month',
      description: 'مثالية للكافيهات والمطاعم الناشئة لانطلاقة رقمية سريعة وراقية.',
      description_en: 'Ideal for boutique cafes and emerging restaurants launching digitally.',
      features: [
        'منيو رقمي غير محدود الأقسام والأصناف',
        'الوصول إلى الـ 10 ثيمات التفاعلية',
        'استقبال طلبات واتساب منسقة ومفصلة',
        'تقسيم الصالات ومولد أكواد الطاولات للطباعة',
      ],
      features_en: [
        'Unlimited categories & Digital Menu items',
        'Access to all 10 built-in interactive themes',
        'Formatted bilingual WhatsApp orders',
        'Halls & Bulk printable Table QR Code generator',
      ],
      highlighted: false,
      isVisible: true,
    },
    {
      id: 'pro',
      name: 'الباقة الاحترافية (الأكثر اختياراً)',
      name_en: 'Pro Operations Plan',
      price: '599',
      period: 'ج.م / شهرياً',
      period_en: 'EGP / month',
      description: 'الحل المتكامل للمطاعم النشطة لتشغيل الصالة والمطبخ وولاء العملاء.',
      description_en: 'Full dining room operations, KDS, Captain console, and Customer CRM.',
      features: [
        'شاشات الكاشير والمطبخ المقسمة + شاشة الكابتن',
        'الطلب الجماعي وتقسيم الشيك بالاسم',
        'منظومة ولاء العملاء + بطاقة الأختام + رادار أعياد الميلاد',
        'ثيم كتاب ثلاثي الأبعاد وشات واتساب التفاعلي',
      ],
      features_en: [
        'Cashier / POS, Multi-Station KDS & Captain screens',
        'Group Table Cart & Split Check billing',
        'Customer CRM, Punch Cards & 3-Day Birthday Radar',
        'Flagship 3D Flipbook & WhatsApp Chat themes',
      ],
      highlighted: true,
      isVisible: true,
    },
    {
      id: 'vip',
      name: 'التجهيز الفندقي المتكامل',
      name_en: 'VIP Concierge Setup',
      price: '1200',
      period: 'ج.م / تجهيز كامل',
      period_en: 'EGP / full setup',
      description: 'فريقنا يجهز مطعمك بالكامل من إدخال المنيو والصور وحتى أكواد الطاولات.',
      description_en: 'Our onboarding specialists upload your entire bilingual menu, photos, and floor QRs.',
      features: [
        'إدخال المنيو والأحجام والإضافات بالكامل بالعربية والإنجليزية',
        'ضبط الهوية البصرية وبطاقة المشاركة على واتساب',
        'تجهيز ملفات أكواد الطاولات جاهزة للطباعة لكل الصالات',
        'دعم فني وتدريب مباشر لفريق الصالة والمطبخ',
      ],
      features_en: [
        'Full AR/EN menu & photo setup by Sufra QR specialists',
        'Custom brand palette & WhatsApp link preview styling',
        'Ready-to-print Table QR Code files for every hall & table',
        'Dedicated onboarding & staff training support',
      ],
      highlighted: false,
      isVisible: true,
    },
  ],
  tygosBadge: 'مسار الترقية للمطاعم الكبرى والسلاسل',
  tygosBadge_en: 'Enterprise Upgrade Path',
  tygosTitle: 'مستعد لإدارة المخازن والتكاليف والحسابات؟ اربط سُفرة بمنظومة تايجوس السحابية (Tygos)',
  tygosTitle_en: 'Ready for Full Inventory, Recipe Costing & Accounting? Connect Tygos Cloud ERP',
  tygosSubtitle:
    'عندما ينمو مطعمك وتحتاج لربط طلبات الطاولات والمنيو مباشرة بالمخازن، وخصم خامات الوصفات، ونقاط البيع المتكاملة، وقوائم الأرباح والحسابات العامة — تنتقل بسلاسة تامة إلى منظومة Tygos السحابية.',
  tygosSubtitle_en:
    'Seamlessly connect your Sufra QR table orders and KDS with automated ingredient deduction, food-cost analytics, full cloud POS shifts, supplier ledgers, and multi-branch financial reporting inside Tygos Cloud ERP.',
  tygosCtaText: 'اطلب عرضاً لربط منظومة Tygos',
  tygosCtaText_en: 'Request Tygos Cloud ERP Demo',
  supportWhatsapp: '201000000000',
  footerText: 'منصة سُفرة QR · شريك النجاح الرقمي للمطاعم والكافيهات',
  footerText_en: 'Sufra QR Platform · Smart Digital Menu, Table Operations & Loyalty SaaS',
  platformLogoUrl: '/assets/aistudio/suofra_logo_icon_f1015078.png',
  shareTitle: 'سُفرة QR ترحب بكم — منصة المنيو الإلكتروني وتشغيل المطاعم الذكي',
  shareTitle_en: 'Sufra QR Welcomes You — Smart Digital Menu & Table Operations SaaS',
  shareDescription:
    '10 ثيمات عالمية، إدارة الصالات وتقسيم الشيك، شاشات المطبخ والكابتن، ومنظومة ولاء وأعياد ميلاد العملاء في منصة واحدة.',
  shareDescription_en:
    '10 interactive themes, group table Split Check billing, KDS, Captain console, and smart Customer CRM.',
};
