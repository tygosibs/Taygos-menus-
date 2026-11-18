import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  ArrowLeft,
  BellRing,
  Check,
  Layers,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { OwnerAuthCard } from '../components/auth/OwnerAuthCard';
import { SafeImage } from '../components/SafeImage';
import { DEFAULT_PLATFORM_LANDING } from '../data/defaultLandingSettings';
import { DEMO_RESTAURANTS } from '../data/demoRestaurants';
import { MENU_THEMES } from '../data/themes';
import { auth, isSuperAdminEmail } from '../lib/firebase';
import { fetchPlatformLandingSettings } from '../lib/firestoreService';
import { ActiveTheme, PlatformLandingSettings } from '../types/menu';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

const FEATURE_ICONS = [BellRing, Layers, Sliders, QrCode];
const FEATURE_ICON_COLORS = ['text-amber-600', 'text-emerald-700', 'text-rose-600', 'text-blue-700'];

export function LandingPage({ onNavigate }: LandingPageProps) {
  const [selectedTheme, setSelectedTheme] = useState<ActiveTheme>('theme-1');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cms, setCms] = useState<PlatformLandingSettings>(DEFAULT_PLATFORM_LANDING);

  const activeTheme = MENU_THEMES.find((t) => t.id === selectedTheme) || MENU_THEMES[0];
  const isSuperAdmin = isSuperAdminEmail(currentUser?.email);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    fetchPlatformLandingSettings().then(setCms);
    return () => unsub();
  }, []);

  const cleanWhatsappDigits = (cms.supportWhatsapp || '').replace(/[^\d]/g, '');

  const demoList = [
    {
      slug: 'buns-lab',
      label: 'ثيم 1 · كتاب المنيو ثلاثي الأبعاد (3D Flipbook)',
      data: DEMO_RESTAURANTS['buns-lab'],
      cover: '/src/assets/images/burger_smash_signature_1794967836686.jpg',
    },
    {
      slug: 'saffron-lounge',
      label: 'ثيم 5 · اللاونج الفاخر الذهبي',
      data: DEMO_RESTAURANTS['saffron-lounge'],
      cover: '/src/assets/images/steak_wagyu_luxury_1794967837741.jpg',
    },
    {
      slug: 'velvet-roast',
      label: 'ثيم 7 · الكافيهات والمخبوزات الدافئ',
      data: DEMO_RESTAURANTS['velvet-roast'],
      cover: '/src/assets/images/coffee_latte_croissant_1794967837713.jpg',
    },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-[#FAFAFA] text-zinc-900 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="border-b border-zinc-200 bg-white/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="text-xl font-extrabold tracking-tight text-zinc-950 whitespace-nowrap shrink-0"
          >
            سُفرة QR
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600">
            <a
              href="#themes"
              className="hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0"
            >
              الثيمات التسعة
            </a>
            <a
              href="#capabilities"
              className="hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0"
            >
              النظام الإداري
            </a>
            <a
              href="#pricing"
              className="hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0"
            >
              الباقات
            </a>
            <a
              href="#demos"
              className="hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0"
            >
              نماذج حية
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('/super-admin')}
                className="px-3.5 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs sm:text-sm font-extrabold hover:bg-amber-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>لوحة الإدارة العليا</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="px-4 py-2 rounded-lg bg-zinc-950 text-white text-xs sm:text-sm font-bold hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {currentUser ? 'لوحة التحكم' : 'دخول لوحة المطعم'}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Split */}
      <section className="max-w-7xl mx-auto px-6 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
          <p className="text-xs font-semibold text-amber-700 tracking-wide">
            منصة Multi-Tenant QR Menu SaaS متكاملة للمطاعم والكافيهات
          </p>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-zinc-950 leading-[1.2] [text-wrap:balance]">
            {cms.heroTitle}
          </h1>
          <p className="text-base text-zinc-600 leading-relaxed max-w-xl">
            {cms.heroSubtitle}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="px-6 py-3.5 rounded-xl bg-zinc-950 text-white text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <span>{currentUser ? 'الانتقال للوحة التحكم' : cms.ctaButtonText}</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/menu/buns-lab')}
              className="px-6 py-3.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-bold hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              تجربة المنيو العام
            </button>
            {cleanWhatsappDigits && (
              <a
                href={`https://wa.me/${cleanWhatsappDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>تواصل واتساب</span>
              </a>
            )}
          </div>
        </div>

        {/* Interactive Theme Preview Stage */}
        <div
          id="themes"
          className="lg:col-span-6 bg-white border border-zinc-200 rounded-2xl p-6 flex flex-col justify-between gap-6"
        >
          <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-zinc-950">محرك عرض الثيمات (9 ثيمات تريند)</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                اختر أي ثيم لمعاينة هويته اللونية وتجربته مباشرة في المنيو العام
              </p>
            </div>
            <span className="font-mono-num text-xs font-bold text-zinc-500">
              {activeTheme.number} / 9
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {MENU_THEMES.map((t) => {
              const active = selectedTheme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTheme(t.id)}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                    active
                      ? 'border-zinc-950 bg-zinc-50'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono-num text-xs font-bold text-zinc-400">
                      0{t.number}
                    </span>
                    <span
                      className="w-4 h-4 rounded-full border border-black/10"
                      style={{ backgroundColor: t.recommendedColor }}
                    />
                  </div>
                  <p className="text-xs font-bold text-zinc-900 line-clamp-1">{t.name}</p>
                  <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{t.englishName}</p>
                </button>
              );
            })}
          </div>

          {/* Active Theme Visual Card */}
          <div
            style={{
              backgroundColor: activeTheme.bgPreview,
              color: activeTheme.textPreview,
            }}
            className="rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors border border-black/10"
          >
            <div className="space-y-1.5 max-w-md">
              <p className="text-xs opacity-75 font-mono-num">{activeTheme.englishName}</p>
              <h3 className="text-lg font-extrabold">{activeTheme.name}</h3>
              <p className="text-xs opacity-85 leading-relaxed">{activeTheme.description}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(`/menu/buns-lab?theme=${selectedTheme}`)}
              style={{ backgroundColor: activeTheme.recommendedColor }}
              className="px-4 py-2.5 rounded-xl text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer shadow-md hover:opacity-95"
            >
              معاينة حية
            </button>
          </div>
        </div>
      </section>

      {/* Core Platform Capabilities (Dynamic CMS) */}
      <section id="capabilities" className="border-t border-zinc-200 bg-white py-14">
        <div className="max-w-7xl mx-auto px-6 space-y-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950">
              بنية متكاملة لعزل بيانات كل مطعم وتشغيل الطلبات الفورية
            </h2>
            <p className="text-sm text-zinc-600 mt-2 leading-relaxed">
              كل مطعم يحصل على مساحة مستقلة محمية بتسجيل الدخول ورابط مخصص للزوار بدون أي تسجيل.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {cms.features.map((feat, idx) => {
              const Icon = FEATURE_ICONS[idx % FEATURE_ICONS.length];
              const colorClass = FEATURE_ICON_COLORS[idx % FEATURE_ICON_COLORS.length];
              return (
                <div
                  key={`${feat.title}_${idx}`}
                  className="p-5 rounded-2xl border border-zinc-200 bg-[#FAFAFA] space-y-2.5"
                >
                  <Icon className={`w-5 h-5 ${colorClass}`} />
                  <h3 className="text-base font-bold">{feat.title}</h3>
                  <p className="text-xs text-zinc-600 leading-relaxed">{feat.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Plans Section (Dynamic CMS) */}
      {cms.pricingPlans.length > 0 && (
        <section id="pricing" className="border-t border-zinc-200 bg-[#FAFAFA] py-14">
          <div className="max-w-7xl mx-auto px-6 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950">
                  باقات الاشتراك والتجهيز
                </h2>
                <p className="text-sm text-zinc-600 mt-1">
                  اختر الباقة المناسبة لحجم مطعمك وابدأ استقبال الطلبات الرقمية اليوم
                </p>
              </div>
              {cleanWhatsappDigits && (
                <a
                  href={`https://wa.me/${cleanWhatsappDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>استفسر عبر واتساب المبيعات</span>
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {cms.pricingPlans.map((plan) => (
                <article
                  key={plan.id}
                  className={`rounded-2xl p-6 flex flex-col justify-between gap-6 border ${
                    plan.highlighted
                      ? 'bg-zinc-950 text-white border-zinc-950 shadow-xl'
                      : 'bg-white text-zinc-900 border-zinc-200'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-extrabold">{plan.name}</h3>
                      {plan.highlighted && (
                        <span className="text-[11px] font-bold text-amber-400">الأكثر طلباً</span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold font-mono-num">{plan.price}</span>
                      <span
                        className={`text-xs ${
                          plan.highlighted ? 'text-zinc-400' : 'text-zinc-500'
                        }`}
                      >
                        {plan.period}
                      </span>
                    </div>

                    {plan.description && (
                      <p
                        className={`text-xs leading-relaxed ${
                          plan.highlighted ? 'text-zinc-300' : 'text-zinc-600'
                        }`}
                      >
                        {plan.description}
                      </p>
                    )}

                    <ul className="space-y-2 pt-2 border-t border-current/10">
                      {plan.features.map((f, i) => (
                        <li key={i} className="text-xs flex items-start gap-2">
                          <Check
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              plan.highlighted ? 'text-amber-400' : 'text-emerald-600'
                            }`}
                          />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate('/admin')}
                    className={`w-full py-3 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      plan.highlighted
                        ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
                        : 'bg-zinc-950 text-white hover:bg-zinc-800'
                    }`}
                  >
                    ابدأ بهذه الباقة
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Live Demo Restaurants Directory */}
      <section id="demos" className="max-w-7xl mx-auto px-6 py-14 space-y-8 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950">
              استعرض قوائم مطاعم حية الآن
            </h2>
            <p className="text-sm text-zinc-600 mt-1">
              افتح أي رابط عام لتجربة نافذة تفاصيل الصنف، السلة الذكية، وحساب الضريبة والفاتورة.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/admin')}
            className="text-sm font-bold text-zinc-950 underline underline-offset-4 cursor-pointer self-start sm:self-auto"
          >
            أنشئ رابطك المخصص الآن
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {demoList.map((demo) => (
            <article
              key={demo.slug}
              onClick={() => onNavigate(`/menu/${demo.slug}`)}
              className="bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer flex flex-col"
            >
              <div className="aspect-[4/3] bg-zinc-100 overflow-hidden">
                <SafeImage
                  src={demo.cover}
                  alt={demo.data.restaurant.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs text-zinc-500 font-mono-num">{demo.label}</p>
                  <h3 className="text-lg font-bold text-zinc-950">{demo.data.restaurant.name}</h3>
                  <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">
                    {demo.data.restaurant.tagline}
                  </p>
                </div>
                <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs font-bold">
                  <span className="font-mono-num text-zinc-500">/menu/{demo.slug}</span>
                  <span className="text-zinc-950 flex items-center gap-1">
                    <span>فتح المنيو</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Owner Login / Sign-up Portal Section */}
      <section id="owner-login" className="border-t border-zinc-200 bg-white py-14">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-4">
            <p className="text-xs font-semibold text-amber-700">ابدأ إدارة مطعمك فوراً</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 leading-tight">
              لوحة تحكم مستقلة لكل مطعم مع رابط QR جاهز للطباعة
            </h2>
            <p className="text-sm text-zinc-600 leading-relaxed">
              سجّل الدخول بحسابك أو أنشئ حساباً جديداً لإعداد اسم المطعم، الرابط المميز، اللوجو، ونسب الضريبة والخدمة في خطوة واحدة.
            </p>
            <ul className="space-y-2 text-xs text-zinc-700 pt-1">
              <li>1. استقبال تنبيهات الطلبات الحية لحظياً بالصوت</li>
              <li>2. إدارة الأقسام والوجبات والأحجام والإضافات</li>
              <li>3. تخصيص الألوان والثيم وتحميل رمز QR بصيغة PNG</li>
            </ul>
          </div>

          <div className="lg:col-span-6">
            {currentUser ? (
              <div className="bg-[#FAFAFA] border border-zinc-200 rounded-2xl p-7 space-y-4">
                <p className="text-xs font-bold text-emerald-700">أنت مسجّل الدخول حالياً</p>
                <h3 className="text-xl font-extrabold text-zinc-950">
                  أهلاً بك، {currentUser.displayName || currentUser.email}
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  يمكنك الانتقال مباشرة إلى لوحة التحكم لإدارة طلباتك أو تحديث قائمة الطعام وإعدادات المظهر.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={() => onNavigate('/admin')}
                    className="flex-1 py-3 px-4 rounded-xl bg-zinc-950 text-white text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>الانتقال إلى لوحة التحكم</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => onNavigate('/super-admin')}
                      className="py-3 px-4 rounded-xl bg-amber-500 text-zinc-950 text-sm font-extrabold hover:bg-amber-400 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>لوحة الإدارة العليا</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <OwnerAuthCard compact onSuccess={() => onNavigate('/admin')} />
            )}
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="mt-auto border-t border-zinc-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <span>{cms.footerText}</span>
          <div className="flex items-center gap-5">
            {cleanWhatsappDigits && (
              <a
                href={`https://wa.me/${cleanWhatsappDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-900"
              >
                واتساب الدعم
              </a>
            )}
            <a
              href="/menu/buns-lab"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/menu/buns-lab');
              }}
              className="hover:text-zinc-900"
            >
              نموذج المنيو العام
            </a>
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/admin');
              }}
              className="hover:text-zinc-900"
            >
              لوحة تحكم المطاعم
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
