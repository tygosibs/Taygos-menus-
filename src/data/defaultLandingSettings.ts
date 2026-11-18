import { PlatformLandingSettings } from '../types/menu';

export const DEFAULT_PLATFORM_LANDING: PlatformLandingSettings = {
  heroTitle: 'منيو إلكتروني تفاعلي يرفع مبيعات مطعمك ويربط طاولاتك بالمطبخ لحظياً',
  heroTitle_en: 'An Interactive Digital QR Menu That Boosts Sales & Connects Tables to Your Kitchen',
  heroSubtitle:
    'أنشئ رابطاً خاصاً لمطعمك في دقائق، خصّص مظهر القائمة بين 9 ثيمات تريند احترافية، أضف الأحجام والإضافات، واستقبل الطلبات مباشرة في لوحة التحكم مع تنبيه صوتي أو عبر واتساب المطعم.',
  heroSubtitle_en:
    'Launch your branded restaurant link in minutes, switch seamlessly across 9 trending themes, customize sizes & add-ons, and receive live kitchen orders with audio alerts or formatted WhatsApp receipts.',
  ctaButtonText: 'أنشئ منيو مطعمك الآن',
  ctaButtonText_en: 'Launch Your Menu Now',
  features: [
    {
      title: 'الطلبات الحية وتنبيه الصوت',
      title_en: 'Live Kitchen Orders & Audio Alerts',
      description:
        'استقبال الطلبات لحظياً في شاشة المطبخ مع رنين تنبيهي فوري وتغيير حالة الطلب بضغطة واحدة.',
      description_en:
        'Receive table and delivery orders in real time on your kitchen board with instant audio chimes and one-tap status updates.',
    },
    {
      title: 'منيو ذكي بالأحجام والإضافات',
      title_en: 'Smart Bilingual Sizes & Add-ons',
      description:
        'إدارة كاملة للأقسام والوجبات والسعرات الحرارية والأحجام والإضافات مع حساب السعر فوراً.',
      description_en:
        'Manage categories, dishes, calories, portion sizes, and optional toppings in Arabic & English with live price calculation.',
    },
    {
      title: 'مخصص المظهر والضرائب',
      title_en: '9 Trending Themes & Tax Engine',
      description:
        'التبديل بين 9 ثيمات تريند احترافية وتخصيص اللون الأساسي ونسبة الضريبة ورسوم الخدمة.',
      description_en:
        'Switch between 9 designer themes anytime, set your brand color, and configure VAT and service charges effortlessly.',
    },
    {
      title: 'مولد QR ودفع واتساب المزدوج',
      title_en: 'Print-Ready QR & Dual Checkout',
      description:
        'توليد كود QR جاهز للتحميل والطباعة مع خيار إرسال الطلب مباشرة للمطعم أو كفاتورة واتساب منسقة.',
      description_en:
        'Download high-res printable QR table cards and let guests order directly to your dashboard or via formatted WhatsApp messages.',
    },
  ],
  pricingPlans: [
    {
      id: 'starter',
      name: 'الباقة الأساسية',
      name_en: 'Starter Plan',
      price: '299',
      period: 'ج.م / شهرياً',
      period_en: 'EGP / month',
      description: 'مثالية للكافيهات والمطاعم الناشئة لبداية رقمية سريعة.',
      description_en: 'Ideal for boutique cafes and emerging restaurants launching digitally.',
      features: [
        'منيو QR غير محدود الأصناف',
        'الوصول إلى جميع الثيمات التفاعلية',
        'استقبال طلبات واتساب منسقة',
        'مولد QR جاهز للطباعة PNG',
      ],
      features_en: [
        'Unlimited categories & menu items',
        'Access to all built-in interactive themes',
        'Formatted bilingual WhatsApp orders',
        'Print-ready PNG QR code generator',
      ],
      highlighted: false,
    },
    {
      id: 'pro',
      name: 'الباقة الاحترافية',
      name_en: 'Pro Growth Plan',
      price: '599',
      period: 'ج.م / شهرياً',
      period_en: 'EGP / month',
      description: 'للمطاعم النشطة التي تحتاج استقبال طلبات الطاولات لحظياً.',
      description_en: 'Built for busy dining rooms needing live kitchen order boards.',
      features: [
        'شاشة طلبات حية وتنبيه صوتي فوري',
        'ثيم كتاب المنيو ثلاثي الأبعاد 3D Flipbook',
        'إدارة الأحجام والإضافات والسعرات',
        'حساب تلقائي للضريبة ورسوم الخدمة',
      ],
      features_en: [
        'Real-time order board with chime alerts',
        'Flagship 3D Flipbook interactive theme',
        'Bilingual sizes, add-ons & calorie tags',
        'Automated VAT & service charge billing',
      ],
      highlighted: true,
    },
    {
      id: 'vip',
      name: 'خدمة التجهيز المتكامل (Concierge)',
      name_en: 'VIP Concierge Setup',
      price: '1200',
      period: 'ج.م / تجهيز كامل',
      period_en: 'EGP / full setup',
      description: 'فريقنا يرفع قائمة مطعمك بالكامل مع الصور والأحجام نيابة عنك.',
      description_en: 'Our team uploads your entire bilingual menu, photos, and sizes for you.',
      features: [
        'إدخال المنيو الكامل بواسطة فريق سُفرة QR',
        'تخصيص الهوية البصرية والألوان',
        'تجهيز ملفات QR للطاولات',
        'دعم فني مباشر عبر واتساب',
      ],
      features_en: [
        'Full AR/EN menu setup by our onboarding team',
        'Custom brand palette & theme styling',
        'Ready-to-print table QR tent cards',
        'Direct priority WhatsApp support',
      ],
      highlighted: false,
    },
  ],
  supportWhatsapp: '201000000000',
  footerText: 'منصة سُفرة QR · نظام إدارة القوائم الرقمية والطلبات الحية',
  footerText_en: 'Sufra QR Platform · Bilingual Digital Menu & Live Kitchen Ordering SaaS',
  platformLogoUrl: '/src/assets/images/sufra_platform_logo_1795015927934.jpg',
  shareTitle: 'سُفرة QR ترحب بكم — منصة المنيو الإلكتروني الذكي',
  shareTitle_en: 'Sufra QR Welcomes You — Smart Digital Restaurant Menu',
  shareDescription:
    'أنشئ منيو مطعمك التفاعلي في دقائق بـ 10 ثيمات احترافية واستقبل طلبات الطاولات والواتساب مباشرة بضغطة واحدة.',
  shareDescription_en:
    'Launch your bilingual interactive QR menu in minutes with 10 designer themes and receive live kitchen & WhatsApp orders.',
};
