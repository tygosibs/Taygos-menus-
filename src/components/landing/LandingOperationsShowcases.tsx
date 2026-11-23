import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Cake,
  Calendar,
  Check,
  Crown,
  Gift,
  Lock,
  MessageCircle,
  PauseCircle,
  Phone,
  Printer,
  QrCode,
  Receipt,
  Search,
  ShieldAlert,
  Sliders,
  Tag,
  UserCheck,
  Vault,
  Wallet,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface LandingOperationsShowcasesProps {
  onScrollToContact: () => void;
}

const MANAGER_PERMISSION_ITEMS = [
  { key: 'canEditMenu', ar: 'تعديل المنيو والأسعار', en: 'Edit menu & prices' },
  { key: 'canPauseItems', ar: 'إيقاف الأصناف مؤقتاً', en: 'Pause or unpause items' },
  { key: 'canEditOpenOrders', ar: 'تعديل الطلبات المفتوحة', en: 'Edit Open orders' },
  { key: 'canCancelOpenOrders', ar: 'إلغاء الطلبات بسبب إلزامي', en: 'Cancel orders with reason' },
  { key: 'canApplyInstantDiscount', ar: 'تطبيق خصم فوري', en: 'Apply Instant Discount' },
  { key: 'canViewShiftReports', ar: 'عرض تقارير الورديات', en: 'View Shift reports' },
  { key: 'canManageStaff', ar: 'إدارة حسابات الكادر', en: 'Manage staff accounts' },
  { key: 'canManageHalls', ar: 'إدارة الصالات وكروت الطاولات', en: 'Manage halls & Table QR Code' },
  { key: 'canConfigureOperations', ar: 'إعدادات الورديات والتشغيل', en: 'Shift & operations setup' },
  { key: 'canToggleScreenPrices', ar: 'إظهار وإخفاء الأسعار بالشاشات', en: 'Toggle prices on screens' },
] as const;

type MatrixCheckCategory = 'dine_in' | 'pickup' | 'delivery';
type HandoverTargetKey = 'next_cashier' | 'manager' | 'owner_vault';

const MATRIX_DAYS_EXAMPLE: Array<{
  key: string;
  dayAr: string;
  dayEn: string;
  dateAr: string;
  dateEn: string;
  cashierAr: string;
  cashierEn: string;
  net: string;
  checks: Array<{
    id: string;
    category: MatrixCheckCategory;
    typeAr: string;
    typeEn: string;
    methodAr: string;
    methodEn: string;
    total: string;
    byAr: string;
    byEn: string;
  }>;
}> = [
  {
    key: 'thu',
    dayAr: 'الخميس',
    dayEn: 'Thursday',
    dateAr: '19 نوفمبر',
    dateEn: 'Nov 19',
    cashierAr: 'كريم عادل',
    cashierEn: 'Karim Adel',
    net: '6,150',
    checks: [
      {
        id: '#401',
        category: 'dine_in',
        typeAr: 'صالة · طاولة 3',
        typeEn: 'Dine-in · Table 3',
        methodAr: 'فيزا',
        methodEn: 'Card',
        total: '460',
        byAr: 'كريم عادل',
        byEn: 'Karim Adel',
      },
      {
        id: '#402',
        category: 'pickup',
        typeAr: 'تيك أواي',
        typeEn: 'Takeaway',
        methodAr: 'كاش',
        methodEn: 'Cash',
        total: '195',
        byAr: 'كريم عادل',
        byEn: 'Karim Adel',
      },
    ],
  },
  {
    key: 'fri',
    dayAr: 'الجمعة',
    dayEn: 'Friday',
    dateAr: '20 نوفمبر',
    dateEn: 'Nov 20',
    cashierAr: 'سيف الدين',
    cashierEn: 'Seif El-Din',
    net: '9,000',
    checks: [
      {
        id: '#512',
        category: 'dine_in',
        typeAr: 'صالة · طاولة 8',
        typeEn: 'Dine-in · Table 8',
        methodAr: 'مختلط',
        methodEn: 'Split',
        total: '740',
        byAr: 'سيف الدين',
        byEn: 'Seif El-Din',
      },
      {
        id: '#513',
        category: 'delivery',
        typeAr: 'دليفري',
        typeEn: 'Delivery',
        methodAr: 'فيزا',
        methodEn: 'Card',
        total: '380',
        byAr: 'سيف الدين',
        byEn: 'Seif El-Din',
      },
    ],
  },
  {
    key: 'sat',
    dayAr: 'السبت',
    dayEn: 'Saturday',
    dateAr: '21 نوفمبر',
    dateEn: 'Nov 21',
    cashierAr: 'كريم عادل',
    cashierEn: 'Karim Adel',
    net: '7,470',
    checks: [
      {
        id: '#604',
        category: 'dine_in',
        typeAr: 'صالة · طاولة 1',
        typeEn: 'Dine-in · Table 1',
        methodAr: 'كاش',
        methodEn: 'Cash',
        total: '510',
        byAr: 'كريم عادل',
        byEn: 'Karim Adel',
      },
      {
        id: '#605',
        category: 'pickup',
        typeAr: 'تيك أواي',
        typeEn: 'Takeaway',
        methodAr: 'كاش',
        methodEn: 'Cash',
        total: '240',
        byAr: 'كريم عادل',
        byEn: 'Karim Adel',
      },
    ],
  },
];

const CRM_CUSTOMERS_EXAMPLE = [
  {
    id: 'c1',
    nameAr: 'أ. كريم منصور (مثال)',
    nameEn: 'Karim Mansour (Example)',
    phone: '01012345678',
    orderType: 'delivery' as const,
    orderTypeAr: 'دليفري',
    orderTypeEn: 'Delivery',
    visits: 8,
    birthdayAr: '15 نوفمبر',
    birthdayEn: 'Nov 15',
    lastOrderAr: '2× سماش برجر + موهيتو',
    lastOrderEn: '2x Smash Burger + Mojito',
    favoritesAr: 'ترافل برجر · بطاطس ترافل',
    favoritesEn: 'Truffle Burger · Truffle Fries',
  },
  {
    id: 'c2',
    nameAr: 'أ. منى محمود (مثال)',
    nameEn: 'Mona Mahmoud (Example)',
    phone: '01198765432',
    orderType: 'dine_in' as const,
    orderTypeAr: 'صالة',
    orderTypeEn: 'Dine-in',
    visits: 12,
    birthdayAr: '24 نوفمبر (بعد يومين)',
    birthdayEn: 'Nov 24 (In 2 days)',
    lastOrderAr: 'قهوة لاتيه + مولتن كيك',
    lastOrderEn: 'Cafe Latte + Molten Cake',
    favoritesAr: 'لاتيه كراميل · مولتن كيك',
    favoritesEn: 'Caramel Latte · Molten Cake',
  },
  {
    id: 'c3',
    nameAr: 'م. طارق حسن (مثال)',
    nameEn: 'Tarek Hassan (Example)',
    phone: '01244556677',
    orderType: 'pickup' as const,
    orderTypeAr: 'تيك أواي',
    orderTypeEn: 'Takeaway',
    visits: 5,
    birthdayAr: '3 مارس',
    birthdayEn: 'Mar 3',
    lastOrderAr: 'شيش طاووق + عصير ليمون',
    lastOrderEn: 'Shish Tawook + Fresh Lemon',
    favoritesAr: 'شيش طاووق مشوي',
    favoritesEn: 'Chargrilled Shish Tawook',
  },
];

export function LandingOperationsShowcases({
  onScrollToContact,
}: LandingOperationsShowcasesProps) {
  const { lang, dir } = useLanguage();
  const isAr = lang === 'ar';
  const DirectionalArrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const currencyLabel = isAr ? 'ج.م' : 'EGP';

  // 1) Supervision interactive state
  const [moltenPaused, setMoltenPaused] = useState(true);
  const [supervisionStep, setSupervisionStep] = useState<'covered' | 'action'>('covered');

  // 2) Manager Permissions & Staff Invite/Suspend state
  const [permState, setPermState] = useState<Record<string, boolean>>({
    canEditMenu: true,
    canPauseItems: true,
    canEditOpenOrders: true,
    canCancelOpenOrders: true,
    canApplyInstantDiscount: true,
    canViewShiftReports: true,
    canManageStaff: true,
    canManageHalls: false,
    canConfigureOperations: true,
    canToggleScreenPrices: true,
  });
  const [staffSuspendedDemo, setStaffSuspendedDemo] = useState(false);

  // 3) Treasury & Shifts animated step state
  const [treasuryStep, setTreasuryStep] = useState<0 | 1 | 2>(2);
  const [handoverTarget, setHandoverTarget] = useState<HandoverTargetKey>('owner_vault');

  // 4) Reports & Audit interactive state
  const [selectedDayIdx, setSelectedDayIdx] = useState(1);
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'dine_in' | 'delivery'>('all');

  // 5) CRM Fast Phone Search state
  const [crmPhoneQuery, setCrmPhoneQuery] = useState('0101');
  const [crmTypeFilter, setCrmTypeFilter] = useState<'all' | 'dine_in' | 'pickup' | 'delivery'>('all');

  // 6) Loyalty & Marketing interactive state
  const [stampsFilled, setStampsFilled] = useState(4);
  const [bdaySent, setBdaySent] = useState(false);

  // Gentle auto-progression for animated example cards (respects prefers-reduced-motion)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const timer = window.setInterval(() => {
      setSupervisionStep((prev) => (prev === 'covered' ? 'action' : 'covered'));
      setTreasuryStep((prev) => (((prev + 1) % 3) as 0 | 1 | 2));
    }, 4500);
    return () => window.clearInterval(timer);
  }, []);

  const activeDay = MATRIX_DAYS_EXAMPLE[selectedDayIdx] || MATRIX_DAYS_EXAMPLE[0];

  const matchedCrmCustomers = CRM_CUSTOMERS_EXAMPLE.filter((c) => {
    if (crmTypeFilter !== 'all' && c.orderType !== crmTypeFilter) return false;
    const q = crmPhoneQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.phone.includes(q) ||
      c.nameAr.toLowerCase().includes(q) ||
      c.nameEn.toLowerCase().includes(q)
    );
  });

  const filteredChecks = activeDay.checks.filter((ch) => {
    if (archiveFilter === 'dine_in') return ch.category === 'dine_in';
    if (archiveFilter === 'delivery') return ch.category === 'delivery';
    return true;
  });

  const handoverTargetLabel = (key: HandoverTargetKey) => {
    if (key === 'next_cashier') return isAr ? 'كاشير تالٍ' : 'Next Cashier';
    if (key === 'manager') return isAr ? 'المدير الإشرافي' : 'Supervisory Manager';
    return isAr ? 'خزنة المالك' : "Owner's Safe";
  };

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 1) Supervisory Manager                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="showcase-supervision"
        className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#F3EBDD]"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="space-y-2.5 max-w-2xl">
            <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
              {isAr
                ? '1. المدير الإشرافي والرقابة الكاملة على الشاشات والطلبات'
                : '1. Supervisory Manager & Full Floor Oversight'}
            </h2>
            <p className="text-sm sm:text-base text-[#0E1B3D]/85">
              {isAr
                ? 'يتابع المدير كل كادر باسم الموظف المناوب، ويعدّل أو يلغي أو يخصم بسبب إلزامي ويدير عهدته والأصناف الموقوفة.'
                : 'Supervises each screen by the on-duty employee, applies reason-locked edits or Instant Discounts, manages Float, and controls any Paused Item.'}
            </p>
          </div>

          {/* Animated Example Card */}
          <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-5 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-3 py-1 rounded-xl bg-[#F3EBDD] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                {isAr
                  ? 'مثال · شاشة إشراف المدير وعهدته'
                  : 'Example · Manager Supervision & Float'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSupervisionStep('covered')}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors motion-reduce:transition-none ${
                    supervisionStep === 'covered'
                      ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                      : 'bg-[#F3EBDD] border-[#E6D9C3] text-[#14285A]'
                  }`}
                >
                  {isAr ? 'حالة الكوادر' : 'Staff Coverage'}
                </button>
                <button
                  type="button"
                  onClick={() => setSupervisionStep('action')}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors motion-reduce:transition-none ${
                    supervisionStep === 'action'
                      ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                      : 'bg-[#F3EBDD] border-[#E6D9C3] text-[#14285A]'
                  }`}
                >
                  {isAr ? 'تعديل بسبب وخصم' : 'Reason Edit & Discount'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left: Supervisory staff screens + Custody */}
              <div className="lg:col-span-6 space-y-3">
                <div
                  className={`rounded-2xl border p-4 space-y-2 transition-colors motion-reduce:transition-none ${
                    supervisionStep === 'covered'
                      ? 'bg-[#F3EBDD] border-[#14285A]'
                      : 'bg-[#F3EBDD]/70 border-[#E6D9C3]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                    <span className="flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-[#E8833A]" />
                      <span>
                        {isAr
                          ? 'شاشة الكاشير · المناوب: كريم عادل (مثال)'
                          : 'Cashier Screen · On Duty: Karim Adel (Example)'}
                      </span>
                    </span>
                    <span className="text-[#2F8F5B]">
                      {isAr ? 'دخول إشرافي' : 'Supervisory Mode'}
                    </span>
                  </div>
                  <p className="text-xs text-[#0E1B3D]/80">
                    {isAr
                      ? 'يفتح المدير الشاشة للمراجعة باسم الموظف المناوب، أو يبدأ وردية مؤقتة عند غياب الكادر.'
                      : 'Opens the screen for review under the active staff member, or starts a relief shift only when uncovered.'}
                  </p>
                </div>

                <div className="bg-[#14285A] text-[#FBF7EF] rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-[#FBF7EF]/75 font-bold">
                      {isAr ? 'عهدة المدير الحالية (مثال)' : 'Current Manager Float (Example)'}
                    </p>
                    <p className="landing-cairo-heading text-xl font-mono-num">
                      1,200 {currencyLabel}
                    </p>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-[#E8833A] text-[#0E1B3D] text-xs font-bold">
                    {isAr ? 'جاهز للترحيل لخزنة المالك' : "Ready for Owner's Safe"}
                  </span>
                </div>
              </div>

              {/* Right: Reason-locked edit/discount + Paused Items Panel */}
              <div className="lg:col-span-6 space-y-3">
                <div
                  className={`rounded-2xl border p-4 space-y-2 transition-colors motion-reduce:transition-none ${
                    supervisionStep === 'action'
                      ? 'bg-[#F3EBDD] border-[#E8833A]'
                      : 'bg-[#F3EBDD]/70 border-[#E6D9C3]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-[#E8833A]" />
                      <span>
                        {isAr ? 'تعديل وإلغاء وخصم فوري (مثال)' : 'Edit, Cancel & Instant Discount (Example)'}
                      </span>
                    </span>
                    <span className="text-[#E8833A]">
                      {isAr ? 'السبب إلزامي' : 'Reason Mandatory'}
                    </span>
                  </div>
                  <p className="text-xs text-[#0E1B3D]/85">
                    {isAr
                      ? 'طاولة 5 (#108): خصم فوري 10% / حذف صنف · السبب المسجل: «تبديل بناءً على طلب الضيف».'
                      : 'Table 5 (#108): 10% Instant Discount / item removed · Logged reason: "Swapped per guest request."'}
                  </p>
                </div>

                <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#14285A] flex items-center gap-1.5">
                      <PauseCircle className="w-4 h-4 text-[#E8833A] shrink-0" />
                      <span>
                        {isAr ? 'لوحة الأصناف الموقوفة مؤقتاً (مثال)' : 'Paused Items Panel (Example)'}
                      </span>
                    </p>
                    <p className="text-xs text-[#0E1B3D]/75 mt-0.5 truncate">
                      {isAr
                        ? `مولتن كيك شوكولاتة — ${moltenPaused ? 'صنف موقوف مؤقتاً من المنيو' : 'متاح للطلب الآن'}`
                        : `Chocolate Molten Cake — ${moltenPaused ? 'Paused Item on Digital Menu' : 'Available to order now'}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMoltenPaused((p) => !p)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer shrink-0 ${
                      moltenPaused
                        ? 'bg-[#2F8F5B] text-[#FBF7EF]'
                        : 'bg-[#E8833A] text-[#0E1B3D]'
                    }`}
                  >
                    {moltenPaused
                      ? isAr
                        ? 'إعادة التفعيل'
                        : 'Resume Item'
                      : isAr
                        ? 'إيقاف مؤقت'
                        : 'Pause Item'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Strict 3 Bullets Max */}
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'دخول بوضع الإشراف باسم الموظف المناوب، وبدء مناوبة عند غياب الكادر فقط.'
                  : 'Supervises live screens by the on-duty employee and fills shifts only when unassigned.'}
              </span>
            </li>
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'تعديل وإلغاء الطلبات وتطبيق الخصومات الفورية بكتابة سبب إلزامي بسجل الرقابة.'
                  : 'Edits, cancels orders, or applies an Instant Discount with mandatory Audit Log reasons.'}
              </span>
            </li>
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'لوحة لإيقاف أو تفعيل الأصناف مؤقتاً مع متابعة عهدة المدير النقدية.'
                  : 'Instant Paused Item controls alongside live tracking of Manager Float cash.'}
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 2) Roles & Accounts                                                     */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="showcase-roles-access"
        className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="space-y-2.5 max-w-2xl">
            <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
              {isAr
                ? '2. الأدوار والحسابات ومفاتيح صلاحيات المدير'
                : '2. Roles, Staff Accounts & Manager Permissions'}
            </h2>
            <p className="text-sm sm:text-base text-[#0E1B3D]/85">
              {isAr
                ? 'يتحكم المالك بدقة في صلاحيات المدير وحسابات الموظفين، مع تفعيل برابط أو كود دعوة وإيقاف مؤقت بالسبب.'
                : 'Owners toggle granular Permissions for managers, onboard staff via link or QR invite, and suspend accounts with documented reasons.'}
            </p>
          </div>

          {/* Animated / Interactive Example Card */}
          <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-5 sm:p-8 space-y-5">
            <span className="inline-block px-3 py-1 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
              {isAr
                ? 'مثال · مفاتيح تشغيل وإيقاف لصلاحيات المدير وحسابات الكادر'
                : 'Example · Manager Permissions Toggles & Staff Access'}
            </span>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Interactive Manager Permissions Toggles */}
              <div className="lg:col-span-7 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-[#E8833A]" />
                    <span>
                      {isAr
                        ? 'مفاتيح صلاحيات المدير (اضغط للتبديل · مثال)'
                        : 'Manager Permissions (Tap to toggle · Example)'}
                    </span>
                  </span>
                  <span className="text-[#2F8F5B] font-mono-num">
                    {Object.values(permState).filter(Boolean).length} / {MANAGER_PERMISSION_ITEMS.length}{' '}
                    {isAr ? 'مفعّلة' : 'Enabled'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MANAGER_PERMISSION_ITEMS.map((item) => {
                    const enabled = Boolean(permState[item.key]);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() =>
                          setPermState((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                        }
                        className="px-3 py-2 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] flex items-center justify-between gap-2 text-xs cursor-pointer text-start"
                      >
                        <span className="font-semibold text-[#0E1B3D] truncate">
                          {isAr ? item.ar : item.en}
                        </span>
                        <span
                          dir="ltr"
                          className={`w-10 h-5 rounded-full p-0.5 flex items-center transition-colors motion-reduce:transition-none shrink-0 ${
                            enabled ? 'bg-[#2F8F5B] justify-end' : 'bg-[#0E1B3D]/25 justify-start'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-[#FBF7EF] shadow-2xs" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Staff Invite QR + Temporary Suspension Card */}
              <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
                <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#14285A] flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-[#E8833A]" />
                      <span>
                        {isAr ? 'دعوة تفعيل موظف جديد (مثال)' : 'New Staff Activation Invite (Example)'}
                      </span>
                    </span>
                    <span className="text-[11px] font-bold text-[#2F8F5B]">
                      {isAr ? 'رابط + كود دعوة' : 'Link + QR'}
                    </span>
                  </div>
                  <p className="text-xs text-[#0E1B3D]/80 leading-relaxed">
                    {isAr
                      ? 'ينشئ المالك أو المدير رابط دعوة أو كود مسح لمرة واحدة يفعّل به الموظف كلمة مروره لدخول شاشته فقط.'
                      : 'The owner or manager generates a one-time invite link or QR so the employee activates credentials strictly for their role.'}
                  </p>
                </div>

                <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#14285A]">
                      {isAr
                        ? 'حساب كابتن صالة · أحمد علي (مثال)'
                        : 'Captain / Waiter · Ahmed Ali (Example)'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md ${
                        staffSuspendedDemo
                          ? 'bg-[#E8833A]/15 text-[#E8833A]'
                          : 'bg-[#2F8F5B]/15 text-[#2F8F5B]'
                      }`}
                    >
                      {staffSuspendedDemo
                        ? isAr
                          ? 'موقوف مؤقتاً'
                          : 'Suspended'
                        : isAr
                          ? 'حساب نشط'
                          : 'Active'}
                    </span>
                  </div>
                  {staffSuspendedDemo && (
                    <p className="text-[11px] text-[#0E1B3D]/80 bg-[#F3EBDD] border border-[#E6D9C3] rounded-lg px-2.5 py-1.5">
                      {isAr
                        ? 'السبب المسجل: إجازة 24 ساعة (يُمنع تسجيل الدخول حتى انتهاء المدة).'
                        : 'Logged Reason: 24-hour leave (login blocked until expiry).'}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setStaffSuspendedDemo((s) => !s)}
                    className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                      staffSuspendedDemo
                        ? 'bg-[#2F8F5B] text-[#FBF7EF]'
                        : 'bg-[#14285A] text-[#FBF7EF]'
                    }`}
                  >
                    {staffSuspendedDemo
                      ? isAr
                        ? 'إلغاء الإيقاف المؤقت (مثال)'
                        : 'Lift Temporary Suspension (Example)'
                      : isAr
                        ? 'تجربة إيقاف موظف مؤقتاً بسبب'
                        : 'Test Temporary Suspension with Reason'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'مفاتيح صلاحيات دقيقة للمدير يحددها المالك مثل تعديل المنيو، الإلغاء، التقارير، الصالات، وإظهار الأسعار.'
                  : 'Granular Permissions per manager for menu edits, cancellations, reports, Table QR Code setup, and price visibility.'}
              </span>
            </li>
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'بوابة كادر خاصة بحساب مستقل لكل موظف وتفعيل فوري برابط أو كود دعوة لمرة واحدة.'
                  : 'Dedicated Staff Portal with individual accounts activated immediately via one-time QR or link.'}
              </span>
            </li>
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'إمكانية إيقاف أي موظف مؤقتاً أو دائماً مع إلزامية توثيق سبب الإيقاف في السجل.'
                  : 'Temporarily or permanently suspend any staff account with a mandatory reason recorded in the Audit Log.'}
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 3) Treasury & Shifts (Flagship Highlight)                               */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="showcase-treasury-shifts"
        className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#F3EBDD]"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-2.5 max-w-2xl">
              <p className="text-xs font-bold text-[#14285A] flex items-center gap-2">
                <Vault className="w-4 h-4 text-[#E8833A]" />
                <span>
                  {isAr ? 'الرقابة المالية الأساسية للمطعم' : 'Core Financial & Cash Control'}
                </span>
              </p>
              <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
                {isAr
                  ? '3. الخزنة والورديات من العهدة حتى خزنة المالك'
                  : "3. Treasury & Shifts: From Float to Owner's Safe"}
              </h2>
              <p className="text-sm sm:text-base text-[#0E1B3D]/85">
                {isAr
                  ? 'اربط فتح وردية الكاشير والدرج ومصروفاته بالتسليم وخزنة المالك الرئيسية مع حماية الورديات المغلقة من أي تعديل.'
                  : "Connect Cashier / POS shift opening, Cash Drawer expenses, and Shift Handover directly to the Owner's Safe with locked closed shifts."}
              </p>
            </div>
            <span className="px-4 py-2 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs font-bold self-start lg:self-auto flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#E8833A]" />
              <span>
                {isAr ? 'الوردية المغلقة محمية من التعديل' : 'Closed shifts are tamper-locked'}
              </span>
            </span>
          </div>

          {/* Prominent Animated Treasury Flow Card */}
          <div className="bg-[#14285A] text-[#FBF7EF] rounded-3xl p-5 sm:p-8 space-y-6 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#FBF7EF]/15">
              <span className="px-3 py-1 rounded-xl bg-[#FBF7EF]/10 border border-[#FBF7EF]/20 text-xs font-bold">
                {isAr
                  ? 'مثال · دورة تجميع الوردية وإقفالها وظهورها عند المالك'
                  : "Example · Full Shift Settlement Cycle to Owner's Safe"}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {[
                  { idx: 0 as const, ar: '1. فتح الوردية', en: '1. Open Shift' },
                  { idx: 1 as const, ar: '2. حساب الدرج', en: '2. Cash Drawer' },
                  { idx: 2 as const, ar: '3. التسليم وخزنة المالك', en: "3. Handover & Owner's Safe" },
                ].map((step) => (
                  <button
                    key={step.idx}
                    type="button"
                    onClick={() => setTreasuryStep(step.idx)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors motion-reduce:transition-none ${
                      treasuryStep === step.idx
                        ? 'bg-[#E8833A] text-[#0E1B3D]'
                        : 'bg-[#FBF7EF]/10 text-[#FBF7EF] hover:bg-[#FBF7EF]/20'
                    }`}
                  >
                    {isAr ? step.ar : step.en}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Stage 1: Shift Opening + End-of-Shift Alert Banner */}
              <div
                className={`lg:col-span-4 rounded-2xl border p-5 space-y-3.5 transition-colors motion-reduce:transition-none ${
                  treasuryStep === 0
                    ? 'bg-[#FBF7EF] text-[#0E1B3D] border-[#E8833A]'
                    : 'bg-[#FBF7EF]/10 text-[#FBF7EF] border-[#FBF7EF]/20'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-[#E8833A]" />
                    <span>{isAr ? '1. فتح الوردية بالعهدة' : '1. Open Shift with Float'}</span>
                  </span>
                  <span className="opacity-75">{isAr ? 'الصباحية' : 'Morning Shift'}</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">
                      {isAr ? 'الرصيد الافتتاحي' : 'Opening Float'}
                    </span>
                    <span className="font-mono-num font-bold">1,000 {currencyLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">
                      {isAr ? 'الرصيد المرحّل (من سابقة/عهدة)' : 'Carried-over Balance'}
                    </span>
                    <span className="font-mono-num font-bold">+ 500 {currencyLabel}</span>
                  </div>
                </div>

                <div
                  className={`rounded-xl px-3 py-2 text-[11px] font-bold flex items-start gap-2 border ${
                    treasuryStep === 0
                      ? 'bg-[#E8833A]/15 border-[#E8833A] text-[#0E1B3D]'
                      : 'bg-[#E8833A]/20 border-[#E8833A]/50 text-[#FBF7EF]'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-[#E8833A] shrink-0 mt-0.5" />
                  <span>
                    {isAr
                      ? 'شريط تنبيه عند موعد نهاية الوردية للتمديد أو التسليم.'
                      : 'Alert banner triggers at scheduled shift end to extend or hand over.'}
                  </span>
                </div>
              </div>

              {/* Stage 2: Live Cashier Drawer Ledger */}
              <div
                className={`lg:col-span-4 rounded-2xl border p-5 space-y-2.5 transition-colors motion-reduce:transition-none ${
                  treasuryStep === 1
                    ? 'bg-[#FBF7EF] text-[#0E1B3D] border-[#E8833A]'
                    : 'bg-[#FBF7EF]/10 text-[#FBF7EF] border-[#FBF7EF]/20'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold pb-1.5 border-b border-current/15">
                  <span className="flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-[#E8833A]" />
                    <span>{isAr ? '2. مجاميع الدرج (مثال)' : '2. Cash Drawer Ledger (Example)'}</span>
                  </span>
                  <span>{isAr ? 'قيد العمل' : 'Active'}</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">
                      {isAr ? 'افتتاحي + مرحّل' : 'Opening + Carried Over'}
                    </span>
                    <span className="font-mono-num font-bold">1,500 {currencyLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">{isAr ? 'مبيعات الكاش' : 'Cash Sales'}</span>
                    <span className="font-mono-num font-bold text-[#2F8F5B]">
                      + 3,200 {currencyLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">{isAr ? 'مبيعات الفيزا' : 'Card Sales'}</span>
                    <span className="font-mono-num font-bold">1,800 {currencyLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">{isAr ? 'مصروفات الدرج' : 'Drawer Expenses'}</span>
                    <span className="font-mono-num font-bold text-[#E8833A]">
                      - 250 {currencyLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">{isAr ? 'فرق الدرج' : 'Drawer Variance'}</span>
                    <span className="font-mono-num font-bold">+ 5 {currencyLabel}</span>
                  </div>
                  <div className="pt-2 border-t border-current/15 flex items-center justify-between font-extrabold text-sm">
                    <span>{isAr ? 'صافي الكاش المتوقع' : 'Expected Net Cash'}</span>
                    <span className="font-mono-num">4,455 {currencyLabel}</span>
                  </div>
                </div>
              </div>

              {/* Stage 3: Handover + Owner Vault + Shift Lock */}
              <div
                className={`lg:col-span-4 rounded-2xl border p-5 space-y-3.5 transition-colors motion-reduce:transition-none ${
                  treasuryStep === 2
                    ? 'bg-[#FBF7EF] text-[#0E1B3D] border-[#2F8F5B]'
                    : 'bg-[#FBF7EF]/10 text-[#FBF7EF] border-[#FBF7EF]/20'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-[#2F8F5B]" />
                    <span>{isAr ? '3. تسليم وإقفال الوردية' : '3. Shift Handover & Lock'}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#2F8F5B]/15 text-[#2F8F5B]">
                    {isAr ? 'محمية من التعديل' : 'Locked'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold opacity-80">
                    {isAr ? 'جهة التسليم (اضغط للمعاينة):' : 'Handover Target (Tap to preview):'}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold">
                    {(['next_cashier', 'manager', 'owner_vault'] as const).map((target) => (
                      <button
                        key={target}
                        type="button"
                        onClick={() => setHandoverTarget(target)}
                        className={`py-1.5 px-2 rounded-lg border cursor-pointer ${
                          handoverTarget === target
                            ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                            : 'border-current/25 opacity-80'
                        }`}
                      >
                        {handoverTargetLabel(target)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl p-3 bg-[#2F8F5B]/12 border border-[#2F8F5B]/30 space-y-1 text-xs">
                  <p className="font-bold">
                    {isAr ? 'خزنة المالك الرئيسية (مثال)' : "Owner's Safe Summary (Example)"}
                  </p>
                  <p className="font-mono-num font-extrabold">
                    {isAr
                      ? `نقدي محصّل: 4,455 ${currencyLabel} · فيزا: 1,800 ${currencyLabel}`
                      : `Cash: 4,455 ${currencyLabel} · Card: 1,800 ${currencyLabel}`}
                  </p>
                  <p className="text-[11px] opacity-80">
                    {isAr
                      ? `المُرحّل إلى: ${handoverTargetLabel(handoverTarget)}`
                      : `Transferred to: ${handoverTargetLabel(handoverTarget)}`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'فتح وردية الكاشير بالعهدة الافتتاحية والرصيد المرحّل مع شريط تنبيه عند موعد انتهائها.'
                  : 'Open shifts with a verified Float and carried-over balance plus automatic shift-end alert bars.'}
              </span>
            </li>
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'حساب فوري للدرج: مبيعات الكاش والفيزا، المصروفات، صافي الكاش المتوقع، وفرق الدرج.'
                  : 'Live Cash Drawer tally of cash/card sales, expenses, expected cash, and Drawer Variance.'}
              </span>
            </li>
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'تسليم الوردية لكاشير تالٍ أو للمدير أو خزنة المالك الرئيسية مع قفل الورديات المغلقة من التعديل.'
                  : "Flexible Shift Handover to the next cashier, Manager Float, or Owner's Safe with locked audit history."}
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 4) Daily Reports & Audit Archive                                        */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="showcase-reports-audit"
        className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="space-y-2.5 max-w-2xl">
            <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
              {isAr
                ? '4. التقارير اليومية ومصفوفة الورديات وأرشيف الشيكات'
                : '4. Daily Reports, Multi-Day Shifts & Check Archive'}
            </h2>
            <p className="text-sm sm:text-base text-[#0E1B3D]/85">
              {isAr
                ? 'الشيك المقفول يختفي من شاشات التشغيل لمنع الازدحام، ويُحفظ كاملاً في أرشيف المالك وسجل الرقابة.'
                : 'Paid checks clear immediately from operational POS queues and remain archived for owner inspection and the Audit Log.'}
            </p>
          </div>

          <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-5 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-3 py-1 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                {isAr
                  ? 'مثال · اضغط على أي يوم في المصفوفة لفتح شيكاته وسجل الرقابة'
                  : 'Example · Click any day in the matrix to inspect checks & Audit Log'}
              </span>
              <span className="text-xs font-bold text-[#2F8F5B] inline-flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>
                  {isAr
                    ? 'الشيكات المقفولة محفوظة بالأرشيف ومخفية عن التشغيل'
                    : 'Paid checks archived & cleared from floor'}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Multi-Day Matrix Table */}
              <div className="lg:col-span-6 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#14285A]">
                  <Calendar className="w-4 h-4 text-[#E8833A]" />
                  <span>
                    {isAr
                      ? 'مصفوفة الورديات لعدة أيام (مثال)'
                      : 'Multi-Day Shift Matrix (Example)'}
                  </span>
                </div>

                <div className="space-y-2">
                  {MATRIX_DAYS_EXAMPLE.map((day, idx) => {
                    const selected = idx === selectedDayIdx;
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => setSelectedDayIdx(idx)}
                        className={`w-full p-3 rounded-xl border text-start flex items-center justify-between gap-2 cursor-pointer transition-colors motion-reduce:transition-none ${
                          selected
                            ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                            : 'bg-[#F3EBDD] border-[#E6D9C3] text-[#14285A]'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold flex items-center gap-1.5">
                            <span>
                              {isAr ? `${day.dayAr} · ${day.dateAr}` : `${day.dayEn} · ${day.dateEn}`}
                            </span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-[#E8833A]" />
                          </p>
                          <p className="text-[11px] opacity-80">
                            {isAr ? `الكاشير: ${day.cashierAr}` : `Cashier: ${day.cashierEn}`}
                          </p>
                        </div>
                        <div className="text-end font-mono-num text-xs font-extrabold">
                          {day.net} {currencyLabel}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: Searchable/Filterable Printable Archive + Audit Log */}
              <div className="lg:col-span-6 space-y-3">
                <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#14285A] flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-[#E8833A]" />
                      <span>
                        {isAr
                          ? `أرشيف شيكات ${activeDay.dayAr} (مثال)`
                          : `${activeDay.dayEn} Check Archive (Example)`}
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                      {(
                        [
                          { id: 'all', ar: 'الكل', en: 'All' },
                          { id: 'dine_in', ar: 'صالة', en: 'Dine-in' },
                          { id: 'delivery', ar: 'دليفري', en: 'Delivery' },
                        ] as const
                      ).map((flt) => (
                        <button
                          key={flt.id}
                          type="button"
                          onClick={() => setArchiveFilter(flt.id)}
                          className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                            archiveFilter === flt.id
                              ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                              : 'bg-[#F3EBDD] border-[#E6D9C3] text-[#14285A]'
                          }`}
                        >
                          {isAr ? flt.ar : flt.en}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {filteredChecks.length === 0 ? (
                      <p className="text-xs text-[#0E1B3D]/65 py-2 text-center">
                        {isAr
                          ? `لا توجد شيكات بهذا الفلتر في ${activeDay.dayAr} (مثال).`
                          : `No checks match this filter on ${activeDay.dayEn} (Example).`}
                      </p>
                    ) : (
                      filteredChecks.map((chk) => (
                        <div
                          key={chk.id}
                          className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-[#14285A]">
                              {chk.id} · {isAr ? chk.typeAr : chk.typeEn}
                            </span>
                            <span className="block text-[11px] text-[#0E1B3D]/70">
                              {isAr
                                ? `${chk.methodAr} · أغلقه: ${chk.byAr}`
                                : `${chk.methodEn} · Closed by: ${chk.byEn}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono-num font-bold text-[#14285A]">
                              {chk.total} {currencyLabel}
                            </span>
                            <Printer className="w-3.5 h-3.5 text-[#E8833A]" aria-hidden="true" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Audit Log Entry */}
                <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-[#E8833A]" />
                      <span>{isAr ? 'سجل الرقابة اليومي (مثال)' : 'Daily Audit Log (Example)'}</span>
                    </span>
                    <span className="text-[#E8833A]">
                      {isAr ? 'موثّق بالتاريخ والساعة' : 'Timestamped'}
                    </span>
                  </div>
                  <p className="text-xs text-[#0E1B3D]/85">
                    {isAr
                      ? '«محمد صلاح (مدير) طبّق خصماً فورياً 10% على شيك #401 — السبب: تأخر تجهيز الطلب».'
                      : '"Mohamed Salah (Manager) applied a 10% Instant Discount on check #401 — Reason: Kitchen prep delay."'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'تقرير يومي ومصفوفة ورديات لعدة أيام؛ الضغط على أي يوم يفتح كل شيكاته فوراً.'
                  : 'Daily sales summary & multi-day shift matrix; click any day to open every check immediately.'}
              </span>
            </li>
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'أرشيف شيكات بالبحث والفلترة والطباعة، بينما يختفي الشيك المقفول من شاشات التشغيل.'
                  : 'Searchable, filterable & printable check archive while Paid checks remain cleared from POS screens.'}
              </span>
            </li>
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'سجل رقابة يوضح من عدّل أو ألغى أو خصم ولماذا لضبط الرقابة المالية والإدارية.'
                  : 'Complete Audit Log detailing every edit, cancellation, and discount with actor & reason.'}
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 5) Customer CRM & Quick POS Phone Lookup                                */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="showcase-crm"
        className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#F3EBDD]"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="space-y-2.5 max-w-2xl">
            <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
              {isAr
                ? '5. إدارة العملاء والبحث السريع برقم الهاتف من الكاشير'
                : '5. Customer CRM & Quick POS Phone Lookup'}
            </h2>
            <p className="text-sm sm:text-base text-[#0E1B3D]/85">
              {isAr
                ? 'ملف كامل لكل ضيف يتضمن طلباته المفضلة وتاريخ ميلاده مع بحث فوري برقم الهاتف من شاشة الكاشير.'
                : 'Full guest profiles with favorite dishes, visit history, and birthdays—plus instant phone lookup inside Cashier / POS.'}
            </p>
          </div>

          <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-5 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="px-3 py-1 rounded-xl bg-[#F3EBDD] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                {isAr
                  ? 'مثال · البحث بالهاتف في الكاشير وملف العميل'
                  : 'Example · Cashier Phone Lookup & Customer Profile'}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                {(
                  [
                    { id: 'all', ar: 'الكل', en: 'All' },
                    { id: 'dine_in', ar: 'صالة', en: 'Dine-in' },
                    { id: 'pickup', ar: 'تيك أواي', en: 'Takeaway' },
                    { id: 'delivery', ar: 'دليفري', en: 'Delivery' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCrmTypeFilter(tab.id)}
                    className={`min-h-[36px] px-3 py-1 rounded-xl border cursor-pointer ${
                      crmTypeFilter === tab.id
                        ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                        : 'bg-[#F3EBDD] border-[#E6D9C3] text-[#14285A]'
                    }`}
                  >
                    {isAr ? tab.ar : tab.en}
                  </button>
                ))}
              </div>
            </div>

            {/* Cashier Quick Phone Lookup Demo */}
            <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#14285A] shrink-0">
                <Search className="w-4 h-4 text-[#E8833A]" />
                <span>
                  {isAr
                    ? 'بحث سريع بالهاتف (الكاشير · مثال):'
                    : 'Quick Phone Lookup (Cashier / POS · Example):'}
                </span>
              </div>
              <input
                type="text"
                dir="ltr"
                value={crmPhoneQuery}
                onChange={(e) => setCrmPhoneQuery(e.target.value)}
                placeholder="0101..."
                aria-label={isAr ? 'بحث سريع برقم الهاتف في الكاشير مثال' : 'Quick phone lookup example'}
                className="flex-1 px-3 py-2 rounded-xl border border-[#E6D9C3] bg-[#FBF7EF] text-xs font-mono-num text-[#14285A] text-left"
              />
              <button
                type="button"
                onClick={() => setCrmPhoneQuery('')}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs font-bold cursor-pointer shrink-0"
              >
                {isAr ? 'عرض كل الأمثلة' : 'Show All Examples'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {matchedCrmCustomers.length === 0 ? (
                <div className="md:col-span-3 bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-6 text-center text-xs font-semibold text-[#0E1B3D]/70">
                  {isAr
                    ? 'لا يوجد عميل مطابق للبحث في المثال الحالي — اضغط «عرض كل الأمثلة».'
                    : 'No matching guest in this example — click "Show All Examples".'}
                </div>
              ) : (
                matchedCrmCustomers.map((cust) => (
                  <div
                    key={cust.id}
                    className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 space-y-2.5 flex flex-col justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="landing-cairo-heading text-sm text-[#14285A]">
                          {isAr ? cust.nameAr : cust.nameEn}
                        </span>
                        <span className="text-[11px] font-bold text-[#E8833A]">
                          {isAr ? cust.orderTypeAr : cust.orderTypeEn}
                        </span>
                      </div>
                      <p className="text-xs font-mono-num text-[#0E1B3D]/80 flex items-center gap-1.5" dir="ltr">
                        <Phone className="w-3.5 h-3.5 text-[#14285A]" />
                        <span>{cust.phone}</span>
                      </p>
                    </div>

                    <div className="space-y-1 text-xs border-t border-[#E6D9C3] pt-2.5 text-[#0E1B3D]/85">
                      <p>
                        <strong className="text-[#14285A]">
                          {isAr ? 'آخر طلب:' : 'Last Order:'}
                        </strong>{' '}
                        {isAr ? cust.lastOrderAr : cust.lastOrderEn}
                      </p>
                      <p>
                        <strong className="text-[#14285A]">
                          {isAr ? 'المفضلات:' : 'Favorites:'}
                        </strong>{' '}
                        {isAr ? cust.favoritesAr : cust.favoritesEn}
                      </p>
                      <p className="flex items-center justify-between pt-1 text-[11px] font-bold">
                        <span>
                          {isAr ? `الميلاد: ${cust.birthdayAr}` : `Birthday: ${cust.birthdayEn}`}
                        </span>
                        <span className="text-[#2F8F5B] font-mono-num">
                          {isAr ? `${cust.visits} زيارات` : `${cust.visits} visits`}
                        </span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'ملف متكامل لكل عميل يشمل اسمه وهاتفه وآخر طلب ومفضلاته وتاريخ ميلاده.'
                  : 'Complete Customer CRM card showing phone, last order, favorite dishes, and birthday.'}
              </span>
            </li>
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'تصنيف طلبات العميل بين الصالة والتيك أواي والدليفري مع احتساب عدد زياراته.'
                  : 'Segment guests across Dine-in, Takeaway, and Delivery with automatic visit counting.'}
              </span>
            </li>
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'بحث سريع برقم الهاتف مباشرة من شاشة الكاشير لتسريع طلبات التيك أواي والدليفري.'
                  : 'Instant phone lookup right from Cashier / POS to speed up Takeaway and Delivery orders.'}
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 6) Loyalty, Marketing & Birthday Radar                                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="showcase-loyalty-marketing"
        className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="space-y-2.5 max-w-2xl">
            <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
              {isAr
                ? '6. الولاء والتسويق ورادار أعياد الميلاد'
                : '6. Loyalty, Marketing & Birthday Radar'}
            </h2>
            <p className="text-sm sm:text-base text-[#0E1B3D]/85">
              {isAr
                ? 'حفّز الضيوف على العودة بخصم أول طلب وبطاقة الأختام وتنبيهات أعياد الميلاد وعروض المنيو وأكواد الخصم.'
                : 'Drive repeat visits with first-order perks, Punch Card rewards, birthday WhatsApp outreach, banners, and promo codes.'}
            </p>
          </div>

          <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-5 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-3 py-1 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                {isAr
                  ? 'مثال · أدوات الولاء والتسويق الفعليّة'
                  : 'Example · Active Loyalty & Promo Tools'}
              </span>
              <span className="text-xs font-bold text-[#2F8F5B]">
                {isAr ? 'خصم أول طلب مفعّل (5% مثال)' : 'First-Order Discount Active (5% Example)'}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              {/* Stamp Card + First Order */}
              <div className="lg:col-span-4 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                  <span className="flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-[#E8833A]" />
                    <span>{isAr ? 'بطاقة الأختام (مثال)' : 'Punch Card (Example)'}</span>
                  </span>
                  <span className="font-mono-num">{stampsFilled} / 5</span>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const active = n <= stampsFilled;
                    return (
                      <div
                        key={n}
                        className={`h-10 rounded-xl border flex items-center justify-center ${
                          active
                            ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                            : 'bg-[#F3EBDD] border-[#E6D9C3] text-[#E8833A]'
                        }`}
                      >
                        {active ? <Check className="w-4 h-4" /> : <Gift className="w-4 h-4" />}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setStampsFilled((c) => (c >= 5 ? 1 : c + 1))}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs font-bold cursor-pointer"
                >
                  {stampsFilled >= 5
                    ? isAr
                      ? 'اكتملت المكافأة (إعادة مثال)'
                      : 'Reward Unlocked (Reset Example)'
                    : isAr
                      ? 'تسجيل ختم زيارة'
                      : 'Stamp Next Visit'}
                </button>
              </div>

              {/* Birthday Radar (3 Days Before) + WhatsApp Button */}
              <div className="lg:col-span-4 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-[#14285A]">
                      <Cake className="w-4 h-4 text-[#E8833A]" />
                      <span>{isAr ? 'رادار أعياد الميلاد' : 'Birthday Radar'}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#E8833A]/15 text-[#E8833A]">
                      {isAr ? 'تنبيه قبلها بـ 3 أيام' : '3-Day Alert'}
                    </span>
                  </div>
                  <p className="landing-cairo-heading text-sm text-[#14285A]">
                    {isAr ? 'أ. منى محمود · باقي يومان (مثال)' : 'Mona Mahmoud · In 2 Days (Example)'}
                  </p>
                  <p className="text-xs text-[#0E1B3D]/75">
                    {isAr
                      ? 'هدية عيد ميلاد جاهزة: خصم 15% على الزيارة القادمة.'
                      : 'Birthday gift ready: 15% off on next dine-in visit.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setBdaySent((v) => !v)}
                  className={`w-full min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    bdaySent
                      ? 'bg-[#2F8F5B] text-[#FBF7EF]'
                      : 'bg-[#14285A] text-[#FBF7EF]'
                  }`}
                >
                  <MessageCircle className="w-4 h-4 text-[#E8833A]" />
                  <span>
                    {bdaySent
                      ? isAr
                        ? 'تم تجهيز رسالة واتساب'
                        : 'WhatsApp Greeting Ready'
                      : isAr
                        ? 'تهنئة عبر واتساب'
                        : 'Send WhatsApp Greeting'}
                  </span>
                </button>
              </div>

              {/* Animated Menu Offers & Promo Codes */}
              <div className="lg:col-span-4 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-[#E8833A]" />
                      <span>{isAr ? 'عروض المنيو وأكواد الخصم' : 'Offers & Promo Codes'}</span>
                    </span>
                  </div>
                  <div className="bg-[#14285A] text-[#FBF7EF] rounded-xl px-3 py-2 text-xs font-bold overflow-hidden">
                    <span className="inline-block offer-anim-marquee">
                      {isAr
                        ? 'عرض خاص: خصم 15% باستخدام كود SUFRA15 (مثال)'
                        : 'Special Offer: 15% Off with code SUFRA15 (Example)'}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-[#0E1B3D]/75">
                  {isAr
                    ? 'أكواد مرنة: نسبة مئوية، مبلغ ثابت، توصيل مجاني، أو إعفاء من رسوم الخدمة.'
                    : 'Flexible promo codes: percentage, fixed amount, free delivery, or waived service fee.'}
                </p>
              </div>
            </div>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'خصم تلقائي لأول طلب للعميل المسجل وبطاقة أختام تكافئ الزيارات المتكررة.'
                  : 'Automatic first-order welcome perk plus a digital Punch Card rewarding repeat visits.'}
              </span>
            </li>
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'رادار أعياد الميلاد ينبّه الإدارة قبل الموعد بـ 3 أيام مع زر تهنئة مباشر عبر واتساب.'
                  : 'Birthday radar flags upcoming guest birthdays 3 days ahead with 1-click WhatsApp wishes.'}
              </span>
            </li>
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>
                {isAr
                  ? 'شرائط عروض متحركة داخل المنيو وأكواد خصم (نسبة، مبلغ ثابت، توصيل مجاني، أو إعفاء خدمة).'
                  : 'Animated menu offer banners and promo codes (% off, fixed value, free delivery, or service waiver).'}
              </span>
            </li>
          </ul>

          <div>
            <button
              type="button"
              onClick={onScrollToContact}
              className="min-h-[44px] px-6 py-3 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
            >
              <span>
                {isAr
                  ? 'تواصل لتجهيز منظومة مطعمك الكاملة'
                  : 'Contact Us to Launch Your Full Restaurant Suite'}
              </span>
              <DirectionalArrow className="w-4 h-4 text-[#E8833A]" />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
