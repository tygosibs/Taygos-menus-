import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  Check,
  Code2,
  Eye,
  Layers,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { LanguageToggleButton } from '../components/LanguageToggleButton';
import { OwnerAuthCard } from '../components/auth/OwnerAuthCard';
import { SafeImage } from '../components/SafeImage';
import { useLanguage } from '../contexts/LanguageContext';
import { DEFAULT_PLATFORM_LANDING } from '../data/defaultLandingSettings';
import { DEMO_RESTAURANTS } from '../data/demoRestaurants';
import { MENU_THEMES } from '../data/themes';
import { auth, isSuperAdminEmail } from '../lib/firebase';
import {
  fetchActiveCustomThemes,
  fetchPlatformLandingSettings,
} from '../lib/firestoreService';
import { CustomTheme, PlatformLandingSettings } from '../types/menu';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

const FEATURE_ICONS = [BellRing, Layers, Sliders, QrCode];
const FEATURE_ICON_COLORS = ['text-amber-600', 'text-emerald-700', 'text-rose-600', 'text-blue-700'];

export function LandingPage({ onNavigate }: LandingPageProps) {
  const { t, dir, lang, isRtl, loc } = useLanguage();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cms, setCms] = useState<PlatformLandingSettings>(DEFAULT_PLATFORM_LANDING);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);

  const isSuperAdmin = isSuperAdminEmail(currentUser?.email);
  const DirArrow = isRtl ? ArrowLeft : ArrowRight;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    fetchPlatformLandingSettings().then(setCms);
    fetchActiveCustomThemes().then(setCustomThemes);
    return () => unsub();
  }, []);

  const cleanWhatsappDigits = (cms.supportWhatsapp || '').replace(/[^\d]/g, '');

  const demoList = [
    {
      slug: 'buns-lab',
      label: t.landing.demoTagline1,
      data: DEMO_RESTAURANTS['buns-lab'],
      cover: '/src/assets/images/burger_smash_signature_1794967836686.jpg',
    },
    {
      slug: 'saffron-lounge',
      label: t.landing.demoTagline2,
      data: DEMO_RESTAURANTS['saffron-lounge'],
      cover: '/src/assets/images/steak_wagyu_luxury_1794967837741.jpg',
    },
    {
      slug: 'velvet-roast',
      label: t.landing.demoTagline3,
      data: DEMO_RESTAURANTS['velvet-roast'],
      cover: '/src/assets/images/coffee_latte_croissant_1794967837713.jpg',
    },
  ];

  const flagshipTheme = MENU_THEMES[0];

  return (
    <div dir={dir} className="min-h-screen bg-[#FAFAFA] text-zinc-900 flex flex-col overflow-x-clip max-w-full">
      {/* 3-Zone Top Bar Contract */}
      <header className="border-b border-zinc-200 bg-white/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-8">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="text-lg sm:text-xl font-extrabold tracking-tight text-zinc-950 whitespace-nowrap shrink-0"
          >
            {t.brandName}
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600">
            <a
              href="#themes"
              className="hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0"
            >
              {t.nav.themes}
            </a>
            <a
              href="#capabilities"
              className="hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0"
            >
              {t.nav.features}
            </a>
            <a
              href="#pricing"
              className="hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0"
            >
              {t.nav.pricing}
            </a>
            <a
              href="#demos"
              className="hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0"
            >
              {t.landing.viewLiveDemos}
            </a>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <LanguageToggleButton compact />
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('/super-admin')}
                className="px-2.5 sm:px-3.5 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs sm:text-sm font-extrabold hover:bg-amber-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden sm:inline">{t.nav.superAdmin}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="px-3 sm:px-4 py-2 rounded-lg bg-zinc-950 text-white text-xs sm:text-sm font-bold hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="sm:hidden">
                {currentUser ? (lang === 'en' ? 'Dashboard' : 'لوحة التحكم') : lang === 'en' ? 'Start Free' : 'ابدأ مجاناً'}
              </span>
              <span className="hidden sm:inline">
                {currentUser ? t.nav.ownerDashboard : t.nav.createMenuFree}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Split */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-7 sm:gap-10 items-stretch w-full">
        <div className="lg:col-span-6 min-w-0 flex flex-col justify-center space-y-5 sm:space-y-6">
          <p className="text-xs font-semibold text-amber-700 tracking-wide">
            {t.landing.badge}
          </p>
          <h1 className="text-2xl sm:text-5xl font-extrabold text-zinc-950 leading-[1.2] [text-wrap:balance]">
            {loc(cms.heroTitle, cms.heroTitle_en)}
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 leading-relaxed max-w-xl">
            {loc(cms.heroSubtitle, cms.heroSubtitle_en)}
          </p>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="px-6 py-3.5 rounded-xl bg-zinc-950 text-white text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <span>
                {currentUser
                  ? t.nav.ownerDashboard
                  : loc(cms.ctaButtonText, cms.ctaButtonText_en)}
              </span>
              <DirArrow className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/menu/buns-lab')}
              className="px-6 py-3.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-bold hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              {t.landing.openDemoMenu}
            </button>
            {cleanWhatsappDigits && (
              <a
                href={`https://wa.me/${cleanWhatsappDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{t.landing.contactWhatsapp}</span>
              </a>
            )}
          </div>
        </div>

        {/* Flagship Hero Visual Card (Buns Lab Luxury Style) */}
        <div className="lg:col-span-6">
          <article
            onClick={() => onNavigate(`/menu/buns-lab?theme=${flagshipTheme.id}`)}
            className="h-full bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all cursor-pointer flex flex-col group"
          >
            <div className="aspect-[16/10] lg:flex-1 bg-zinc-100 overflow-hidden relative">
              <SafeImage
                src={flagshipTheme.coverImage}
                alt={loc(flagshipTheme.name, flagshipTheme.englishName)}
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              <div className="absolute bottom-4 inset-x-5 flex items-end justify-between gap-3 text-white">
                <div className="space-y-1">
                  <p className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{lang === 'en' ? 'Flagship 3D Experience' : 'التجربة الأبرز ثلاثية الأبعاد'}</span>
                  </p>
                  <h2 className="text-xl font-extrabold">
                    {loc(flagshipTheme.name, flagshipTheme.englishName)}
                  </h2>
                </div>
                <span className="px-3 py-1.5 rounded-lg bg-white text-zinc-950 text-xs font-extrabold whitespace-nowrap shrink-0">
                  {t.landing.tryTheme}
                </span>
              </div>
            </div>
            <div className="p-5 flex items-center justify-between gap-4 border-t border-zinc-100">
              <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">
                {loc(flagshipTheme.description, flagshipTheme.description_en)}
              </p>
              <a
                href="#themes"
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-extrabold text-zinc-950 whitespace-nowrap shrink-0 underline underline-offset-4"
              >
                {lang === 'en' ? 'Browse All 9 Themes' : 'استعرض الـ 9 ثيمات'}
              </a>
            </div>
          </article>
        </div>
      </section>

      {/* Luxury 2-Column Themes Showcase Grid (All 9 + Custom Injected) */}
      <section id="themes" className="border-t border-zinc-200 bg-white py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950">
                {t.landing.themesTitle}
              </h2>
              <p className="text-sm text-zinc-600">{t.landing.themesDesc}</p>
            </div>
            <span className="font-mono-num text-xs font-bold text-zinc-500 shrink-0">
              {MENU_THEMES.length + customThemes.length}{' '}
              {lang === 'en' ? 'Interactive Themes' : 'تصميمات تفاعلية'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-5">
            {MENU_THEMES.map((themeItem) => {
              const themeName = loc(themeItem.name, themeItem.englishName);
              const secondaryName =
                lang === 'en' ? themeItem.name : themeItem.englishName;
              const themeDesc = loc(themeItem.description, themeItem.description_en);

              return (
                <article
                  key={themeItem.id}
                  onClick={() => onNavigate(`/menu/buns-lab?theme=${themeItem.id}`)}
                  className="bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer flex flex-col group"
                >
                  <div className="aspect-[4/3] bg-zinc-100 overflow-hidden relative">
                    <SafeImage
                      src={themeItem.coverImage}
                      alt={themeName}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/15" />
                    <div className="absolute top-2.5 start-2.5 px-2 py-0.5 rounded-md bg-black/65 backdrop-blur-xs text-white text-[11px] font-mono-num font-bold">
                      {String(themeItem.number).padStart(2, '0')}
                    </div>
                    {themeItem.isFlagship && (
                      <div className="absolute top-2.5 end-2.5 px-2 py-0.5 rounded-md bg-amber-400 text-zinc-950 text-[10px] font-extrabold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span className="hidden sm:inline">
                          {lang === 'en' ? 'Flagship' : 'الأكثر تميزاً'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 sm:p-5 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] text-zinc-500 truncate">{secondaryName}</p>
                      <h3 className="text-sm sm:text-lg font-extrabold text-zinc-950 line-clamp-1">
                        {themeName}
                      </h3>
                      <p className="hidden sm:line-clamp-2 text-xs text-zinc-600 leading-relaxed pt-0.5">
                        {themeDesc}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-zinc-100 flex items-center justify-between gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: themeItem.recommendedColor }}
                      />
                      <span
                        style={{ backgroundColor: themeItem.recommendedColor }}
                        className="px-2.5 sm:px-3.5 py-1.5 rounded-lg text-white text-[11px] sm:text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{lang === 'en' ? 'Live Preview' : 'معاينة حية'}</span>
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}

            {customThemes.map((ct) => {
              const ctName = loc(ct.name, ct.name_en);
              const ctDesc = loc(ct.description, ct.description_en);
              return (
                <article
                  key={ct.id}
                  onClick={() => onNavigate(`/menu/buns-lab?theme=${ct.id}`)}
                  className="bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer flex flex-col group"
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
                    <div className="absolute top-2.5 start-2.5 px-2 py-0.5 rounded-md bg-amber-400 text-zinc-950 text-[10px] font-extrabold flex items-center gap-1">
                      <Code2 className="w-3 h-3" />
                      <span>{lang === 'en' ? 'Custom' : 'مخصص'}</span>
                    </div>
                  </div>

                  <div className="p-3 sm:p-5 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] text-amber-700 font-bold truncate">
                        {t.admin.themes.customThemesBadge}
                      </p>
                      <h3 className="text-sm sm:text-lg font-extrabold text-zinc-950 line-clamp-1">
                        {ctName}
                      </h3>
                      {ctDesc && (
                        <p className="hidden sm:line-clamp-2 text-xs text-zinc-600 leading-relaxed pt-0.5">
                          {ctDesc}
                        </p>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-zinc-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono-num text-zinc-400 truncate" dir="ltr">
                        {ct.id}
                      </span>
                      <span className="px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-zinc-950 text-white text-[11px] sm:text-xs font-bold flex items-center gap-1.5 whitespace-nowrap">
                        <Eye className="w-3.5 h-3.5" />
                        <span>{lang === 'en' ? 'Live Preview' : 'معاينة حية'}</span>
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Core Platform Capabilities (Dynamic CMS) */}
      <section id="capabilities" className="border-t border-zinc-200 bg-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950">
              {t.landing.featuresTitle}
            </h2>
            <p className="text-sm text-zinc-600 mt-2 leading-relaxed">
              {t.landing.featuresDesc}
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
                  <h3 className="text-base font-bold">{loc(feat.title, feat.title_en)}</h3>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    {loc(feat.description, feat.description_en)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Plans Section (Dynamic CMS) */}
      {cms.pricingPlans.length > 0 && (
        <section id="pricing" className="border-t border-zinc-200 bg-[#FAFAFA] py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950">
                  {t.landing.pricingTitle}
                </h2>
                <p className="text-sm text-zinc-600 mt-1">{t.landing.pricingDesc}</p>
              </div>
              {cleanWhatsappDigits && (
                <a
                  href={`https://wa.me/${cleanWhatsappDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{t.landing.contactWhatsapp}</span>
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {cms.pricingPlans.map((plan) => {
                const planFeatures =
                  lang === 'en' && plan.features_en && plan.features_en.length > 0
                    ? plan.features_en
                    : plan.features;
                return (
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
                        <h3 className="text-lg font-extrabold">
                          {loc(plan.name, plan.name_en)}
                        </h3>
                        {plan.highlighted && (
                          <span className="text-[11px] font-bold text-amber-400">
                            {t.landing.mostPopular}
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold font-mono-num">{plan.price}</span>
                        <span
                          className={`text-xs ${
                            plan.highlighted ? 'text-zinc-400' : 'text-zinc-500'
                          }`}
                        >
                          {loc(plan.period, plan.period_en)}
                        </span>
                      </div>

                      {(plan.description || plan.description_en) && (
                        <p
                          className={`text-xs leading-relaxed ${
                            plan.highlighted ? 'text-zinc-300' : 'text-zinc-600'
                          }`}
                        >
                          {loc(plan.description, plan.description_en)}
                        </p>
                      )}

                      <ul className="space-y-2 pt-2 border-t border-current/10">
                        {planFeatures.map((f, i) => (
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
                      {t.landing.subscribeNow}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Live Demo Restaurants Directory */}
      <section id="demos" className="max-w-7xl mx-auto px-4 sm:px-6 py-14 space-y-8 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950">
              {t.landing.interactiveDemosTitle}
            </h2>
            <p className="text-sm text-zinc-600 mt-1">{t.landing.interactiveDemosDesc}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/admin')}
            className="text-sm font-bold text-zinc-950 underline underline-offset-4 cursor-pointer self-start sm:self-auto"
          >
            {t.nav.createMenuFree}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {demoList.map((demo) => {
            const rest = demo.data.restaurant;
            const rName = loc(rest.name, rest.name_en);
            const rTagline = loc(rest.tagline, rest.tagline_en);
            return (
              <article
                key={demo.slug}
                onClick={() => onNavigate(`/menu/${demo.slug}`)}
                className="bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer flex flex-col"
              >
                <div className="aspect-[4/3] bg-zinc-100 overflow-hidden">
                  <SafeImage
                    src={demo.cover}
                    alt={rName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <p className="text-xs text-zinc-500 font-mono-num">{demo.label}</p>
                    <h3 className="text-lg font-bold text-zinc-950">{rName}</h3>
                    <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">{rTagline}</p>
                  </div>
                  <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs font-bold">
                    <span className="font-mono-num text-zinc-500" dir="ltr">
                      /menu/{demo.slug}
                    </span>
                    <span className="text-zinc-950 flex items-center gap-1">
                      <span>{t.landing.openDemoMenu}</span>
                      <DirArrow className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Owner Login / Sign-up Portal Section */}
      <section id="owner-login" className="border-t border-zinc-200 bg-white py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-4">
            <p className="text-xs font-semibold text-amber-700">{t.landing.badge}</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 leading-tight">
              {t.landing.authTitle}
            </h2>
            <p className="text-sm text-zinc-600 leading-relaxed">{t.landing.authSubtitle}</p>
            <ul className="space-y-2 text-xs text-zinc-700 pt-1">
              <li>1. {t.admin.orders.title}</li>
              <li>2. {t.admin.menu.title}</li>
              <li>3. {t.admin.qr.title}</li>
            </ul>
          </div>

          <div className="lg:col-span-6">
            {currentUser ? (
              <div className="bg-[#FAFAFA] border border-zinc-200 rounded-2xl p-7 space-y-4">
                <h3 className="text-xl font-extrabold text-zinc-950">
                  {currentUser.displayName || currentUser.email}
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  {t.landing.authSubtitle}
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={() => onNavigate('/admin')}
                    className="flex-1 py-3 px-4 rounded-xl bg-zinc-950 text-white text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{t.nav.ownerDashboard}</span>
                    <DirArrow className="w-4 h-4" />
                  </button>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => onNavigate('/super-admin')}
                      className="py-3 px-4 rounded-xl bg-amber-500 text-zinc-950 text-sm font-extrabold hover:bg-amber-400 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{t.nav.superAdmin}</span>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <span>{loc(cms.footerText, cms.footerText_en)}</span>
          <div className="flex items-center gap-5">
            {cleanWhatsappDigits && (
              <a
                href={`https://wa.me/${cleanWhatsappDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-900"
              >
                {t.landing.footerSupport}
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
              {t.landing.openDemoMenu}
            </a>
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/admin');
              }}
              className="hover:text-zinc-900"
            >
              {t.nav.ownerDashboard}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
