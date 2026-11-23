import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
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
  ShieldCheck,
  Sliders,
  Tag,
  UserCheck,
  Users,
  Vault,
  Wallet,
} from 'lucide-react';

interface LandingOperationsShowcasesProps {
  onScrollToContact: () => void;
}

const MANAGER_PERMISSION_ITEMS = [
  { key: 'canEditMenu', label: 'تعديل المنيو والأسعار' },
  { key: 'canPauseItems', label: 'إيقاف الأصناف مؤقتاً' },
  { key: 'canEditOpenOrders', label: 'تعديل الطلبات المفتوحة' },
  { key: 'canCancelOpenOrders', label: 'إلغاء الطلبات بسبب إلزامي' },
  { key: 'canApplyInstantDiscount', label: 'تطبيق خصم فوري' },
  { key: 'canViewShiftReports', label: 'عرض تقارير الورديات' },
  { key: 'canManageStaff', label: 'إدارة حسابات الكادر' },
  { key: 'canManageHalls', label: 'إدارة الصالات وكروت QR' },
  { key: 'canConfigureOperations', label: 'إعدادات الورديات والتشغيل' },
  { key: 'canToggleScreenPrices', label: 'إظهار وإخفاء الأسعار بالشاشات' },
] as const;

const MATRIX_DAYS_EXAMPLE = [
  {
    key: 'thu',
    dayName: 'الخميس',
    date: '١٩ نوفمبر',
    cashier: 'كريم عادل',
    cash: '٤,٢٠٠',
    visa: '٢,١٠٠',
    expenses: '١٥٠',
    net: '٦,١٥٠',
    checks: [
      { id: '#٤٠١', type: 'صالة · طاولة ٣', method: 'فيزا', total: '٤٦٠ ج.م', by: 'كريم عادل' },
      { id: '#٤٠٢', type: 'تيك أواي', method: 'كاش', total: '١٩٥ ج.م', by: 'كريم عادل' },
    ],
  },
  {
    key: 'fri',
    dayName: 'الجمعة',
    date: '٢٠ نوفمبر',
    cashier: 'سيف الدين',
    cash: '٥,٨٥٠',
    visa: '٣,٤٠٠',
    expenses: '٢٥٠',
    net: '٩,٠٠٠',
    checks: [
      { id: '#٥١٢', type: 'صالة · طاولة ٨', method: 'مختلط', total: '٧٤٠ ج.م', by: 'سيف الدين' },
      { id: '#٥١٣', type: 'دليفري', method: 'فيزا', total: '٣٨٠ ج.م', by: 'سيف الدين' },
    ],
  },
  {
    key: 'sat',
    dayName: 'السبت',
    date: '٢١ نوفمبر',
    cashier: 'كريم عادل',
    cash: '٤,٩٠٠',
    visa: '٢,٧٥٠',
    expenses: '١٨٠',
    net: '٧,٤٧٠',
    checks: [
      { id: '#٦٠٤', type: 'صالة · طاولة ١', method: 'كاش', total: '٥١٠ ج.م', by: 'كريم عادل' },
      { id: '#٦٠٥', type: 'تيك أواي', method: 'كاش', total: '٢٤٠ ج.م', by: 'كريم عادل' },
    ],
  },
];

const CRM_CUSTOMERS_EXAMPLE = [
  {
    id: 'c1',
    name: 'أ. كريم منصور (مثال)',
    phone: '01012345678',
    orderType: 'delivery' as const,
    orderTypeLabel: 'دليفري',
    visits: 8,
    birthday: '١٥ نوفمبر',
    lastOrder: '٢× سماش برجر + موهيتو',
    favorites: 'ترافل برجر · بطاطس ترافل',
  },
  {
    id: 'c2',
    name: 'أ. منى محمود (مثال)',
    phone: '01198765432',
    orderType: 'dine_in' as const,
    orderTypeLabel: 'صالة',
    visits: 12,
    birthday: '٢٤ نوفمبر (بعد يومين)',
    lastOrder: 'قهوة لاتيه + مولتن كيك',
    favorites: 'لاتيه كراميل · مولتن كيك',
  },
  {
    id: 'c3',
    name: 'م. طارق حسن (مثال)',
    phone: '01244556677',
    orderType: 'pickup' as const,
    orderTypeLabel: 'تيك أواي',
    visits: 5,
    birthday: '٣ مارس',
    lastOrder: 'شيش طاووق + عصير ليمون',
    favorites: 'شيش طاووق مشوي',
  },
];

export function LandingOperationsShowcases({
  onScrollToContact,
}: LandingOperationsShowcasesProps) {
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
  const [handoverTarget, setHandoverTarget] = useState<'كاشير تالٍ' | 'المدير' | 'خزنة المالك'>(
    'خزنة المالك'
  );

  // 4) Reports & Audit interactive state
  const [selectedDayIdx, setSelectedDayIdx] = useState(1);
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'dine_in' | 'delivery'>('all');

  // 5) CRM Fast Phone Search state
  const [crmPhoneQuery, setCrmPhoneQuery] = useState('0101');
  const [crmTypeFilter, setCrmTypeFilter] = useState<'all' | 'dine_in' | 'pickup' | 'delivery'>('all');

  // 6) Loyalty & Marketing interactive state
  const [stampsFilled, setStampsFilled] = useState(4);
  const [bdaySent, setBdaySent] = useState(false);

  // Gentle auto-progression for animated "مثال" cards (strictly honors prefers-reduced-motion)
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
    const q = crmPhoneQuery.trim();
    if (!q) return true;
    return c.phone.includes(q) || c.name.includes(q);
  });

  const filteredChecks = activeDay.checks.filter((ch) => {
    if (archiveFilter === 'dine_in') return ch.type.includes('صالة');
    if (archiveFilter === 'delivery') return ch.type.includes('دليفري');
    return true;
  });

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 1) المدير والإشراف                                                      */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="showcase-supervision"
        className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#F3EBDD]"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="space-y-2.5 max-w-2xl">
            <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
              ١. المدير والإشراف الكامل على الشاشات والطلبات
            </h2>
            <p className="text-sm sm:text-base text-[#0E1B3D]/85">
              يتابع المدير كل كادر باسم الموظف المناوب، ويعدّل أو يلغي أو يخصم بسبب إلزامي ويدير عهدته والأصناف الموقوفة.
            </p>
          </div>

          {/* Animated Example Card */}
          <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-5 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-3 py-1 rounded-xl bg-[#F3EBDD] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                مثال · شاشة إشراف المدير وعهدته
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
                  حالة الكوادر
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
                  تعديل بسبب وخصم
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
                      <span>شاشة الكاشير · المناوب: كريم عادل (مثال)</span>
                    </span>
                    <span className="text-[#2F8F5B]">دخول إشرافي</span>
                  </div>
                  <p className="text-xs text-[#0E1B3D]/80">
                    يفتح المدير الشاشة للمراجعة باسم الموظف المناوب، أو يبدأ وردية مؤقتة عند غياب الكادر.
                  </p>
                </div>

                <div className="bg-[#14285A] text-[#FBF7EF] rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-[#FBF7EF]/75 font-bold">عهدة المدير الحالية (مثال)</p>
                    <p className="landing-cairo-heading text-xl font-mono-num">١,٢٠٠ ج.م</p>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-[#E8833A] text-[#0E1B3D] text-xs font-bold">
                    جاهز للترحيل لخزنة المالك
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
                      <span>تعديل وإلغاء وخصم فوري (مثال)</span>
                    </span>
                    <span className="text-[#E8833A]">السبب إلزامي</span>
                  </div>
                  <p className="text-xs text-[#0E1B3D]/85">
                    طاولة ٥ (#١٠٨): خصم فوري ١٠٪ / حذف صنف · السبب المسجل: «تبديل بناءً على طلب الضيف».
                  </p>
                </div>

                <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#14285A] flex items-center gap-1.5">
                      <PauseCircle className="w-4 h-4 text-[#E8833A] shrink-0" />
                      <span>لوحة الأصناف الموقوفة مؤقتاً (مثال)</span>
                    </p>
                    <p className="text-xs text-[#0E1B3D]/75 mt-0.5 truncate">
                      مولتن كيك شوكولاتة — {moltenPaused ? 'موقوف مؤقتاً من المنيو' : 'متاح للطلب الآن'}
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
                    {moltenPaused ? 'إعادة التفعيل' : 'إيقاف مؤقت'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Strict 3 Bullets Max */}
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>دخول بوضع الإشراف باسم الموظف المناوب، وبدء مناوبة عند غياب الكادر فقط.</span>
            </li>
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>تعديل وإلغاء الطلبات وتطبيق الخصومات الفورية بكتابة سبب إلزامي بسجل الرقابة.</span>
            </li>
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>لوحة لإيقاف أو تفعيل الأصناف مؤقتاً مع متابعة عهدة المدير النقدية.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 2) الأدوار والحسابات                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="showcase-roles-access"
        className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="space-y-2.5 max-w-2xl">
            <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
              ٢. الأدوار والحسابات ومفاتيح صلاحيات المدير
            </h2>
            <p className="text-sm sm:text-base text-[#0E1B3D]/85">
              يتحكم المالك بدقة في صلاحيات المدير وحسابات الموظفين، مع تفعيل برابط أو كود QR وإيقاف مؤقت بالسبب.
            </p>
          </div>

          {/* Animated / Interactive Example Card */}
          <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-5 sm:p-8 space-y-5">
            <span className="inline-block px-3 py-1 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
              مثال · مفاتيح تشغيل وإيقاف لصلاحيات المدير وحسابات الكادر
            </span>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Interactive Manager Permissions Toggles */}
              <div className="lg:col-span-7 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-[#E8833A]" />
                    <span>مفاتيح صلاحيات المدير (اضغط للتبديل · مثال)</span>
                  </span>
                  <span className="text-[#2F8F5B]">
                    {Object.values(permState).filter(Boolean).length} / {MANAGER_PERMISSION_ITEMS.length} مفعّلة
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
                        className="px-3 py-2 rounded-xl border border-[#E6D9C3] bg-[#F3EBDD] flex items-center justify-between gap-2 text-xs cursor-pointer text-right"
                      >
                        <span className="font-semibold text-[#0E1B3D] truncate">{item.label}</span>
                        <span
                          className={`w-10 h-5 rounded-full p-0.5 flex items-center transition-colors motion-reduce:transition-none shrink-0 ${
                            enabled ? 'bg-[#2F8F5B] justify-start' : 'bg-[#0E1B3D]/25 justify-end'
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
                      <span>دعوة تفعيل موظف جديد (مثال)</span>
                    </span>
                    <span className="text-[11px] font-bold text-[#2F8F5B]">رابط + QR</span>
                  </div>
                  <p className="text-xs text-[#0E1B3D]/80 leading-relaxed">
                    ينشئ المالك أو المدير رابط دعوة أو كود QR لمرة واحدة يفعّل به الموظف كلمة مروره لدخول شاشته فقط.
                  </p>
                </div>

                <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#14285A]">حساب كابتن صالة · أحمد علي (مثال)</span>
                    <span
                      className={`px-2 py-0.5 rounded-md ${
                        staffSuspendedDemo
                          ? 'bg-[#E8833A]/15 text-[#E8833A]'
                          : 'bg-[#2F8F5B]/15 text-[#2F8F5B]'
                      }`}
                    >
                      {staffSuspendedDemo ? 'موقوف مؤقتاً' : 'حساب نشط'}
                    </span>
                  </div>
                  {staffSuspendedDemo && (
                    <p className="text-[11px] text-[#0E1B3D]/80 bg-[#F3EBDD] border border-[#E6D9C3] rounded-lg px-2.5 py-1.5">
                      السبب المسجل: إجازة ٢٤ ساعة (يُمنع تسجيل الدخول حتى انتهاء المدة).
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
                    {staffSuspendedDemo ? 'إلغاء الإيقاف المؤقت (مثال)' : 'تجربة إيقاف موظف مؤقتاً بسبب'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>مفاتيح صلاحيات دقيقة للمدير يحددها المالك مثل تعديل المنيو، الإلغاء، التقارير، الصالات وQR، وإظهار الأسعار.</span>
            </li>
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>بوابة كادر خاصة بحساب مستقل لكل موظف وتفعيل فوري برابط أو كود QR دعوة لمرة واحدة.</span>
            </li>
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>إمكانية إيقاف أي موظف مؤقتاً أو دائماً مع إلزامية توثيق سبب الإيقاف في السجل.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 3) الخزنة والورديات (مهم، أبرزه)                                         */}
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
                <span>الرقابة المالية الأساسية للمطعم</span>
              </p>
              <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
                ٣. الخزنة والورديات من العهدة حتى خزنة المالك
              </h2>
              <p className="text-sm sm:text-base text-[#0E1B3D]/85">
                اربط فتح وردية الكاشير والدرج ومصروفاته بالتسليم وخزنة المالك الرئيسية مع حماية الورديات المغلقة من أي تعديل.
              </p>
            </div>
            <span className="px-4 py-2 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs font-bold self-start lg:self-auto flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#E8833A]" />
              <span>الوردية المغلقة محمية من التعديل</span>
            </span>
          </div>

          {/* Prominent Animated Treasury Flow Card */}
          <div className="bg-[#14285A] text-[#FBF7EF] rounded-3xl p-5 sm:p-8 space-y-6 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#FBF7EF]/15">
              <span className="px-3 py-1 rounded-xl bg-[#FBF7EF]/10 border border-[#FBF7EF]/20 text-xs font-bold">
                مثال · دورة تجميع الوردية وإقفالها وظهورها عند المالك
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {[
                  { idx: 0 as const, label: '١. فتح الوردية' },
                  { idx: 1 as const, label: '٢. حساب الدرج' },
                  { idx: 2 as const, label: '٣. التسليم وخزنة المالك' },
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
                    {step.label}
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
                    <span>١. فتح الوردية بالعهدة</span>
                  </span>
                  <span className="opacity-75">الصباحية</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">الرصيد الافتتاحي</span>
                    <span className="font-mono-num font-bold">١,٠٠٠ ج.م</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">الرصيد المرحّل (من سابقة/عهدة)</span>
                    <span className="font-mono-num font-bold">+ ٥٠٠ ج.م</span>
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
                  <span>شريط تنبيه عند موعد نهاية الوردية للتمديد أو التسليم.</span>
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
                    <span>٢. مجاميع الدرج (مثال)</span>
                  </span>
                  <span>قيد العمل</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">افتتاحي + مرحّل</span>
                    <span className="font-mono-num font-bold">١,٥٠٠ ج.م</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">مبيعات الكاش</span>
                    <span className="font-mono-num font-bold text-[#2F8F5B]">+ ٣,٢٠٠ ج.م</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">مبيعات الفيزا</span>
                    <span className="font-mono-num font-bold">١,٨٠٠ ج.م</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">مصروفات الدرج</span>
                    <span className="font-mono-num font-bold text-[#E8833A]">− ٢٥٠ ج.م</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="opacity-80">فرق الدرج</span>
                    <span className="font-mono-num font-bold">+ ٥ ج.م</span>
                  </div>
                  <div className="pt-2 border-t border-current/15 flex items-center justify-between font-extrabold text-sm">
                    <span>صافي الكاش المتوقع</span>
                    <span className="font-mono-num">٤,٤٥٥ ج.م</span>
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
                    <span>٣. تسليم وإقفال الوردية</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#2F8F5B]/15 text-[#2F8F5B]">
                    محمية من التعديل
                  </span>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold opacity-80">جهة التسليم (اضغط للمعاينة):</p>
                  <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold">
                    {(['كاشير تالٍ', 'المدير', 'خزنة المالك'] as const).map((target) => (
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
                        {target}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl p-3 bg-[#2F8F5B]/12 border border-[#2F8F5B]/30 space-y-1 text-xs">
                  <p className="font-bold">خزنة المالك الرئيسية (مثال)</p>
                  <p className="font-mono-num font-extrabold">
                    نقدي محصّل: ٤,٤٥٥ ج.م · فيزا: ١,٨٠٠ ج.م
                  </p>
                  <p className="text-[11px] opacity-80">المُرحّل إلى: {handoverTarget}</p>
                </div>
              </div>
            </div>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>فتح وردية الكاشير بالعهدة الافتتاحية والرصيد المرحّل مع شريط تنبيه عند موعد انتهائها.</span>
            </li>
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>حساب فوري للدرج: مبيعات الكاش والفيزا، المصروفات، صافي الكاش المتوقع، وفرق الدرج.</span>
            </li>
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>تسليم الوردية لكاشير تالٍ أو للمدير أو خزنة المالك الرئيسية مع قفل الورديات المغلقة من التعديل.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 4) التقارير والتدقيق                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="showcase-reports-audit"
        className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="space-y-2.5 max-w-2xl">
            <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
              ٤. التقارير اليومية ومصفوفة الورديات وأرشيف الشيكات
            </h2>
            <p className="text-sm sm:text-base text-[#0E1B3D]/85">
              الشيك المقفول يختفي من شاشات التشغيل لمنع الازدحام، ويُحفظ كاملاً في أرشيف المالك وسجل الرقابة.
            </p>
          </div>

          <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-5 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-3 py-1 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                مثال · اضغط على أي يوم في المصفوفة لفتح شيكاته وسجل الرقابة
              </span>
              <span className="text-xs font-bold text-[#2F8F5B]">
                الشيكات المقفولة محفوظة بالأرشيف ومخفية عن التشغيل ✓
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Multi-Day Matrix Table */}
              <div className="lg:col-span-6 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#14285A]">
                  <Calendar className="w-4 h-4 text-[#E8833A]" />
                  <span>مصفوفة الورديات لعدة أيام (مثال)</span>
                </div>

                <div className="space-y-2">
                  {MATRIX_DAYS_EXAMPLE.map((day, idx) => {
                    const selected = idx === selectedDayIdx;
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => setSelectedDayIdx(idx)}
                        className={`w-full p-3 rounded-xl border text-right flex items-center justify-between gap-2 cursor-pointer transition-colors motion-reduce:transition-none ${
                          selected
                            ? 'bg-[#14285A] border-[#14285A] text-[#FBF7EF]'
                            : 'bg-[#F3EBDD] border-[#E6D9C3] text-[#14285A]'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold flex items-center gap-1.5">
                            <span>
                              {day.dayName} · {day.date}
                            </span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-[#E8833A]" />
                          </p>
                          <p className="text-[11px] opacity-80">الكاشير: {day.cashier}</p>
                        </div>
                        <div className="text-left font-mono-num text-xs font-extrabold">
                          {day.net} ج.م
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
                      <span>أرشيف شيكات {activeDay.dayName} (مثال)</span>
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                      {(
                        [
                          { id: 'all', label: 'الكل' },
                          { id: 'dine_in', label: 'صالة' },
                          { id: 'delivery', label: 'دليفري' },
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
                          {flt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {filteredChecks.length === 0 ? (
                      <p className="text-xs text-[#0E1B3D]/65 py-2 text-center">
                        لا توجد شيكات بهذا الفلتر في {activeDay.dayName} (مثال).
                      </p>
                    ) : (
                      filteredChecks.map((chk) => (
                        <div
                          key={chk.id}
                          className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-[#14285A]">
                              {chk.id} · {chk.type}
                            </span>
                            <span className="block text-[11px] text-[#0E1B3D]/70">
                              {chk.method} · أغلقه: {chk.by}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono-num font-bold text-[#14285A]">
                              {chk.total}
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
                      <span>سجل الرقابة اليومي (مثال)</span>
                    </span>
                    <span className="text-[#E8833A]">موثّق بالتاريخ والساعة</span>
                  </div>
                  <p className="text-xs text-[#0E1B3D]/85">
                    «محمد صلاح (مدير) طبّق خصماً فورياً ١٠٪ على شيك #٤٠١ — السبب: تأخر تجهيز الطلب».
                  </p>
                </div>
              </div>
            </div>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>تقرير يومي ومصفوفة ورديات لعدة أيام؛ الضغط على أي يوم يفتح كل شيكاته فوراً.</span>
            </li>
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>أرشيف شيكات بالبحث والفلترة والطباعة، بينما يختفي الشيك المقفول من شاشات التشغيل.</span>
            </li>
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>سجل رقابة يوضح من عدّل أو ألغى أو خصم ولماذا لضبط الرقابة المالية والإدارية.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 5) إدارة العملاء (CRM)                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="showcase-crm"
        className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#F3EBDD]"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="space-y-2.5 max-w-2xl">
            <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
              ٥. إدارة العملاء (CRM) والبحث السريع من الكاشير
            </h2>
            <p className="text-sm sm:text-base text-[#0E1B3D]/85">
              ملف كامل لكل ضيف يتضمن طلباته المفضلة وتاريخ ميلاده مع بحث فوري برقم الهاتف من شاشة الكاشير.
            </p>
          </div>

          <div className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-3xl p-5 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="px-3 py-1 rounded-xl bg-[#F3EBDD] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                مثال · البحث بالهاتف في الكاشير وملف العميل
              </span>
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                {(
                  [
                    { id: 'all', label: 'الكل' },
                    { id: 'dine_in', label: 'صالة' },
                    { id: 'pickup', label: 'تيك أواي' },
                    { id: 'delivery', label: 'دليفري' },
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
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cashier Quick Phone Lookup Demo */}
            <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#14285A] shrink-0">
                <Search className="w-4 h-4 text-[#E8833A]" />
                <span>بحث سريع بالهاتف (الكاشير · مثال):</span>
              </div>
              <input
                type="text"
                dir="ltr"
                value={crmPhoneQuery}
                onChange={(e) => setCrmPhoneQuery(e.target.value)}
                placeholder="0101..."
                aria-label="بحث سريع برقم الهاتف في الكاشير مثال"
                className="flex-1 px-3 py-2 rounded-xl border border-[#E6D9C3] bg-[#FBF7EF] text-xs font-mono-num text-[#14285A] text-left"
              />
              <button
                type="button"
                onClick={() => setCrmPhoneQuery('')}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#14285A] text-[#FBF7EF] text-xs font-bold cursor-pointer shrink-0"
              >
                عرض كل الأمثلة
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {matchedCrmCustomers.length === 0 ? (
                <div className="md:col-span-3 bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-6 text-center text-xs font-semibold text-[#0E1B3D]/70">
                  لا يوجد عميل مطابق للبحث في المثال الحالي — اضغط «عرض كل الأمثلة».
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
                          {cust.name}
                        </span>
                        <span className="text-[11px] font-bold text-[#E8833A]">
                          {cust.orderTypeLabel}
                        </span>
                      </div>
                      <p className="text-xs font-mono-num text-[#0E1B3D]/80 flex items-center gap-1.5" dir="ltr">
                        <Phone className="w-3.5 h-3.5 text-[#14285A]" />
                        <span>{cust.phone}</span>
                      </p>
                    </div>

                    <div className="space-y-1 text-xs border-t border-[#E6D9C3] pt-2.5 text-[#0E1B3D]/85">
                      <p>
                        <strong className="text-[#14285A]">آخر طلب:</strong> {cust.lastOrder}
                      </p>
                      <p>
                        <strong className="text-[#14285A]">المفضلات:</strong> {cust.favorites}
                      </p>
                      <p className="flex items-center justify-between pt-1 text-[11px] font-bold">
                        <span>الميلاد: {cust.birthday}</span>
                        <span className="text-[#2F8F5B] font-mono-num">{cust.visits} زيارات</span>
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
              <span>ملف متكامل لكل عميل يشمل اسمه وهاتفه وآخر طلب ومفضلاته وتاريخ ميلاده.</span>
            </li>
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>تصنيف طلبات العميل بين الصالة والتيك أواي والدليفري مع احتساب عدد زياراته.</span>
            </li>
            <li className="bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>بحث سريع برقم الهاتف مباشرة من شاشة الكاشير لتسريع طلبات التيك أواي والدليفري.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 6) الولاء والتسويق                                                      */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="showcase-loyalty-marketing"
        className="scroll-mt-20 py-16 sm:py-24 border-t border-[#E6D9C3] bg-[#FBF7EF]"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="space-y-2.5 max-w-2xl">
            <h2 className="landing-cairo-heading text-2xl sm:text-4xl text-[#14285A] text-balance">
              ٦. الولاء والتسويق ورادار أعياد الميلاد
            </h2>
            <p className="text-sm sm:text-base text-[#0E1B3D]/85">
              حفّز الضيوف على العودة بخصم أول طلب وبطاقة الأختام وتنبيهات أعياد الميلاد وعروض المنيو وأكواد الخصم.
            </p>
          </div>

          <div className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-3xl p-5 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-3 py-1 rounded-xl bg-[#FBF7EF] border border-[#E6D9C3] text-xs font-bold text-[#14285A]">
                مثال · أدوات الولاء والتسويق الفعليّة
              </span>
              <span className="text-xs font-bold text-[#2F8F5B]">
                خصم أول طلب مفعّل (٥٪ مثال)
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              {/* Stamp Card + First Order */}
              <div className="lg:col-span-4 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                  <span className="flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-[#E8833A]" />
                    <span>بطاقة الأختام (مثال)</span>
                  </span>
                  <span className="font-mono-num">{stampsFilled} / ٥</span>
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
                  {stampsFilled >= 5 ? 'اكتملت المكافأة (إعادة مثال)' : 'تسجيل ختم زيارة'}
                </button>
              </div>

              {/* Birthday Radar (3 Days Before) + WhatsApp Button */}
              <div className="lg:col-span-4 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-[#14285A]">
                      <Cake className="w-4 h-4 text-[#E8833A]" />
                      <span>رادار أعياد الميلاد</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#E8833A]/15 text-[#E8833A]">
                      تنبيه قبلها بـ ٣ أيام
                    </span>
                  </div>
                  <p className="landing-cairo-heading text-sm text-[#14285A]">
                    أ. منى محمود · باقي يومان (مثال)
                  </p>
                  <p className="text-xs text-[#0E1B3D]/75">
                    هدية عيد ميلاد جاهزة: خصم ١٥٪ على الزيارة القادمة.
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
                  <span>{bdaySent ? 'تم تجهيز رسالة واتساب ✓' : 'تهنئة عبر واتساب'}</span>
                </button>
              </div>

              {/* Animated Menu Offers & Promo Codes */}
              <div className="lg:col-span-4 bg-[#FBF7EF] border border-[#E6D9C3] rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-[#14285A]">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-[#E8833A]" />
                      <span>عروض المنيو وأكواد الخصم</span>
                    </span>
                  </div>
                  <div className="bg-[#14285A] text-[#FBF7EF] rounded-xl px-3 py-2 text-xs font-bold overflow-hidden">
                    <span className="inline-block offer-anim-marquee">
                      عرض خاص: خصم ١٥٪ باستخدام كود SUFRA15 (مثال)
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-[#0E1B3D]/75">
                  أكواد مرنة: نسبة مئوية، مبلغ ثابت، توصيل مجاني، أو إعفاء من رسوم الخدمة.
                </p>
              </div>
            </div>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-[#0E1B3D]">
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>خصم تلقائي لأول طلب للعميل المسجل وبطاقة أختام تكافئ الزيارات المتكررة.</span>
            </li>
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>رادار أعياد الميلاد ينبّه الإدارة قبل الموعد بـ ٣ أيام مع زر تهنئة مباشر عبر واتساب.</span>
            </li>
            <li className="bg-[#F3EBDD] border border-[#E6D9C3] rounded-2xl p-4 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#E8833A] mt-2 shrink-0" />
              <span>شرائط عروض متحركة داخل المنيو وأكواد خصم (نسبة، مبلغ ثابت، توصيل مجاني، أو إعفاء خدمة).</span>
            </li>
          </ul>

          <div>
            <button
              type="button"
              onClick={onScrollToContact}
              className="min-h-[44px] px-6 py-3 rounded-2xl bg-[#14285A] text-[#FBF7EF] text-sm font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-2 cursor-pointer"
            >
              <span>تواصل لتجهيز منظومة مطعمك الكاملة</span>
              <ArrowLeft className="w-4 h-4 text-[#E8833A]" />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
