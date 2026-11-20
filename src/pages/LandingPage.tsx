import { ReactNode, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  BellRing,
  Cake,
  Calculator,
  Check,
  CheckCircle2,
  Code2,
  Eye,
  Gift,
  Heart,
  Layers,
  MessageCircle,
  PackageCheck,
  QrCode,
  Receipt,
  ShieldCheck,
  Sliders,
  Sparkles,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { LanguageToggleButton } from '../components/LanguageToggleButton';
import { PWAInstallButton } from '../components/PWAInstallButton';
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
  normalizeLandingSections,
} from '../lib/firestoreService';
import { applySeoMetadata, getPlatformShareMetadata } from '../lib/seoHead';
import { CustomTheme, LandingSectionId, PlatformLandingSettings } from '../types/menu';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

const FEATURE_ICONS = [BellRing, Layers, Sliders, QrCode];
const FEATURE_ICON_COLORS = ['text-amber-600', 'text-emerald-700', 'text-rose-600', 'text-blue-700'];

const OPERATION_ICONS = [QrCode, Users, UtensilsCrossed, BellRing];
const OPERATION_LABELS_AR = [
  'تقسيم الصالات ومولد QR جماعي',
  'الترابيزة الجماعية وفصل الحساب',
  'شاشات المطبخ المقسمة (KDS)',
  'شاشة الكابتن ونداء الطاولات',
];
const OPERATION_LABELS_EN = [
  'Multi-Hall Bulk QR Generator',
  'Group Table & Separate Check',
  'Multi-Station KDS Routing',
  'Captain & Waiter Console',
];

const LOYALTY_ICONS = [Gift, Award, Heart, Cake];
const LOYALTY_LABELS_AR = [
  'تسجيل بضغطة واحدة وخصم ترحيبي',
  'بطاقة أختام الولاء الرقمية',
  'الترشيح الذكي وإعادة الطلب',
  'رادار أعياد الميلاد وإدارة عملائي',
];
const LOYALTY_LABELS_EN = [
  '1-Tap Registration & Welcome Offer',
  'Digital Loyalty Punch Card',
  'Smart Picks & 1-Tap Reorder',
  '3-Day Birthday Radar & CRM',
];

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    applySeoMetadata(getPlatformShareMetadata(cms, lang, window.location.origin));
  }, [cms, lang]);

  const cleanWhatsappDigits = (cms.supportWhatsapp || '').replace(/[^\d]/g, '');
  const totalThemesCount = MENU_THEMES.length + customThemes.length;

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
  const orderedSections = normalizeLandingSections(cms.sections).filter((s) => s.isVisible !== false);

  const visibleFeatures = (cms.features || []).filter((f) => f.isVisible !== false);
  const visiblePlans = (cms.pricingPlans || []).filter((p) => p.isVisible !== false);

  const operationBullets =
    lang === 'en'
      ? cms.operationsBullets_en && cms.operationsBullets_en.length > 0
        ? cms.operationsBullets_en
        : DEFAULT_PLATFORM_LANDING.operationsBullets_en || []
      : cms.operationsBullets && cms.operationsBullets.length > 0
      ? cms.operationsBullets
      : DEFAULT_PLATFORM_LANDING.operationsBullets || [];

  const loyaltyBullets =
    lang === 'en'
      ? cms.loyaltyBullets_en && cms.loyaltyBullets_en.length > 0
        ? cms.loyaltyBullets_en
        : DEFAULT_PLATFORM_LANDING.loyaltyBullets_en || []
      : cms.loyaltyBullets && cms.loyaltyBullets.length > 0
      ? cms.loyaltyBullets
      : DEFAULT_PLATFORM_LANDING.loyaltyBullets || [];

  const tygosWhatsappHref = cleanWhatsappDigits
    ? `https://wa.me/${cleanWhatsappDigits}?text=${encodeURIComponent(
        lang === 'en'
          ? 'Hello Sufra team, I would like to request a Tygos Cloud ERP integration demo.'
          : 'أهلاً فريق سُفرة، أرغب في حجز عرض توضيحي لربط منظومة تايجوس السحابية (Tygos Cloud ERP) مع مطعمي.'
      )}`
    : undefined;

  const renderCmsSection = (sectionId: LandingSectionId): ReactNode => {
    switch (sectionId) {
      case 'hero':
        return (
          <section
            key="hero"
            className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-7 sm:gap-10 items-stretch w-full"
          >
            <div className="lg:col-span-6 min-w-0 flex flex-col justify-center space-y-5 sm:space-y-6">
              <p className="text-xs font-semibold text-amber-700 tracking-wide">
                {loc(
                  cms.heroBadge || DEFAULT_PLATFORM_LANDING.heroBadge,
                  cms.heroBadge_en || DEFAULT_PLATFORM_LANDING.heroBadge_en
                )}
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
                  className="px-6 py-3.5 rounded-xl bg-zinc-950 text-white text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
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
                  className="px-6 py-3.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-sm font-bold hover:bg-zinc-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {loc(
                    cms.heroSecondaryBtnText || DEFAULT_PLATFORM_LANDING.heroSecondaryBtnText,
                    cms.heroSecondaryBtnText_en || DEFAULT_PLATFORM_LANDING.heroSecondaryBtnText_en
                  )}
                </button>
                {cleanWhatsappDigits && (
                  <a
                    href={`https://wa.me/${cleanWhatsappDigits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{t.landing.contactWhatsapp}</span>
                  </a>
                )}
                <PWAInstallButton variant="hero" />
              </div>
            </div>

            {/* Flagship Hero Visual Card */}
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
                        <span>
                          {lang === 'en'
                            ? 'Flagship 3D Flipbook Menu'
                            : 'تجربة الكتاب الفاخرة ثلاثية الأبعاد'}
                        </span>
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
                    {lang === 'en'
                      ? `Browse All ${totalThemesCount} Themes`
                      : `استعرض الـ ${totalThemesCount} ثيماً`}
                  </a>
                </div>
              </article>
            </div>
          </section>
        );

      case 'themes':
        return (
          <section key="themes" id="themes" className="border-t border-zinc-200 bg-white py-14">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-1.5 max-w-2xl">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 [text-wrap:balance]">
                    {loc(
                      cms.themesTitle || DEFAULT_PLATFORM_LANDING.themesTitle,
                      cms.themesTitle_en || DEFAULT_PLATFORM_LANDING.themesTitle_en
                    )}
                  </h2>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    {loc(
                      cms.themesSubtitle || DEFAULT_PLATFORM_LANDING.themesSubtitle,
                      cms.themesSubtitle_en || DEFAULT_PLATFORM_LANDING.themesSubtitle_en
                    )}
                  </p>
                </div>
                <span className="font-mono-num text-xs font-bold text-zinc-500 shrink-0 tabular-nums">
                  {totalThemesCount} {lang === 'en' ? 'Interactive Themes' : 'تصميمات تفاعلية'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-5">
                {MENU_THEMES.map((themeItem) => {
                  const themeName = loc(themeItem.name, themeItem.englishName);
                  const secondaryName = lang === 'en' ? themeItem.name : themeItem.englishName;
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
                        <div className="absolute top-2.5 start-2.5 px-2 py-0.5 rounded-md bg-black/65 backdrop-blur-xs text-white text-[11px] font-mono-num font-bold tabular-nums">
                          {String(themeItem.number).padStart(2, '0')}
                        </div>
                        {themeItem.badge ? (
                          <div
                            className={`absolute top-2.5 end-2.5 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-extrabold shadow-md flex items-center gap-1 ${
                              themeItem.badge.includes('VIP')
                                ? 'bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-zinc-950 border border-amber-200'
                                : 'bg-gradient-to-r from-orange-500 to-rose-600 text-white'
                            }`}
                          >
                            <span>{loc(themeItem.badge, themeItem.badge_en)}</span>
                          </div>
                        ) : (
                          themeItem.isFlagship && (
                            <div className="absolute top-2.5 end-2.5 px-2 py-0.5 rounded-md bg-amber-400 text-zinc-950 text-[10px] font-extrabold flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              <span className="hidden sm:inline">
                                {lang === 'en' ? 'Flagship' : 'الأكثر تميزاً'}
                              </span>
                            </div>
                          )
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
                          <span
                            className="text-[11px] font-mono-num text-zinc-400 truncate"
                            dir="ltr"
                          >
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
        );

      case 'features':
        if (visibleFeatures.length === 0) return null;
        return (
          <section key="features" id="capabilities" className="border-t border-zinc-200 bg-white py-14">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
              <div className="max-w-2xl space-y-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 [text-wrap:balance]">
                  {loc(
                    cms.featuresTitle || DEFAULT_PLATFORM_LANDING.featuresTitle,
                    cms.featuresTitle_en || DEFAULT_PLATFORM_LANDING.featuresTitle_en
                  )}
                </h2>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  {loc(
                    cms.featuresSubtitle || DEFAULT_PLATFORM_LANDING.featuresSubtitle,
                    cms.featuresSubtitle_en || DEFAULT_PLATFORM_LANDING.featuresSubtitle_en
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {visibleFeatures.map((feat, idx) => {
                  const Icon = FEATURE_ICONS[idx % FEATURE_ICONS.length];
                  const colorClass = FEATURE_ICON_COLORS[idx % FEATURE_ICON_COLORS.length];
                  return (
                    <div
                      key={`${feat.title}_${idx}`}
                      className="p-5 rounded-2xl border border-zinc-200 bg-[#FAFAFA] flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Icon className={`w-5 h-5 ${colorClass}`} />
                          <span className="font-mono-num text-xs font-bold text-zinc-400 tabular-nums">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold text-zinc-950">
                          {loc(feat.title, feat.title_en)}
                        </h3>
                        <p className="text-xs text-zinc-600 leading-relaxed">
                          {loc(feat.description, feat.description_en)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );

      case 'operations':
        return (
          <section key="operations" id="operations" className="border-t border-zinc-200 bg-[#FAFAFA] py-14">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
              <div className="lg:col-span-5 space-y-5">
                <p className="text-xs font-bold text-amber-700">
                  {loc(
                    cms.operationsBadge || DEFAULT_PLATFORM_LANDING.operationsBadge,
                    cms.operationsBadge_en || DEFAULT_PLATFORM_LANDING.operationsBadge_en
                  )}
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 leading-tight [text-wrap:balance]">
                  {loc(
                    cms.operationsTitle || DEFAULT_PLATFORM_LANDING.operationsTitle,
                    cms.operationsTitle_en || DEFAULT_PLATFORM_LANDING.operationsTitle_en
                  )}
                </h2>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  {loc(
                    cms.operationsSubtitle || DEFAULT_PLATFORM_LANDING.operationsSubtitle,
                    cms.operationsSubtitle_en || DEFAULT_PLATFORM_LANDING.operationsSubtitle_en
                  )}
                </p>

                <div className="pt-1 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('/menu/buns-lab?hall=الصالة_الرئيسية&table=1')}
                    className="px-5 py-3 rounded-xl bg-zinc-950 text-white text-xs sm:text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <span>
                      {lang === 'en'
                        ? 'Try Group Table Ordering'
                        : 'جرّب طلب الترابيزة الجماعية'}
                    </span>
                    <DirArrow className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/admin')}
                    className="px-4 py-3 rounded-xl border border-zinc-300 bg-white text-zinc-900 text-xs sm:text-sm font-bold hover:bg-zinc-100 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {lang === 'en' ? 'Open Floor & KDS Admin' : 'لوحة الصالات والمطبخ'}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {operationBullets.map((bullet, idx) => {
                  const OpIcon = OPERATION_ICONS[idx % OPERATION_ICONS.length];
                  const heading =
                    lang === 'en'
                      ? OPERATION_LABELS_EN[idx] || `Workflow ${idx + 1}`
                      : OPERATION_LABELS_AR[idx] || `محور التشغيل ${idx + 1}`;
                  return (
                    <article
                      key={`op_${idx}`}
                      className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <OpIcon className="w-5 h-5 text-zinc-900" />
                        <span className="font-mono-num text-xs font-bold text-zinc-400 tabular-nums">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <h3 className="text-sm font-extrabold text-zinc-950">{heading}</h3>
                      <p className="text-xs text-zinc-600 leading-relaxed">{bullet}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        );

      case 'loyalty':
        return (
          <section key="loyalty" id="loyalty" className="border-t border-zinc-200 bg-white py-14">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
                <div className="max-w-2xl space-y-2">
                  <p className="text-xs font-bold text-rose-700">
                    {loc(
                      cms.loyaltyBadge || DEFAULT_PLATFORM_LANDING.loyaltyBadge,
                      cms.loyaltyBadge_en || DEFAULT_PLATFORM_LANDING.loyaltyBadge_en
                    )}
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 [text-wrap:balance]">
                    {loc(
                      cms.loyaltyTitle || DEFAULT_PLATFORM_LANDING.loyaltyTitle,
                      cms.loyaltyTitle_en || DEFAULT_PLATFORM_LANDING.loyaltyTitle_en
                    )}
                  </h2>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    {loc(
                      cms.loyaltySubtitle || DEFAULT_PLATFORM_LANDING.loyaltySubtitle,
                      cms.loyaltySubtitle_en || DEFAULT_PLATFORM_LANDING.loyaltySubtitle_en
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('/admin')}
                  className="px-5 py-3 rounded-xl bg-zinc-950 text-white text-xs sm:text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2 cursor-pointer self-start lg:self-auto whitespace-nowrap"
                >
                  <span>
                    {lang === 'en' ? 'Launch Smart Customer CRM' : 'افتح منظومة الولاء وعملائي CRM'}
                  </span>
                  <DirArrow className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {loyaltyBullets.map((bullet, idx) => {
                  const LIcon = LOYALTY_ICONS[idx % LOYALTY_ICONS.length];
                  const heading =
                    lang === 'en'
                      ? LOYALTY_LABELS_EN[idx] || `Loyalty Pillar ${idx + 1}`
                      : LOYALTY_LABELS_AR[idx] || `ميزة الولاء ${idx + 1}`;
                  return (
                    <article
                      key={`loy_${idx}`}
                      className="rounded-2xl border border-zinc-200 bg-[#FAFAFA] p-6 flex items-start gap-4"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center shrink-0">
                        <LIcon className="w-5 h-5 text-rose-600" />
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono-num tabular-nums">
                          <span>{String(idx + 1).padStart(2, '0')}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {lang === 'en' ? 'Automated Retention' : 'حفظ وعودة تلقائية'}
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold text-zinc-950">{heading}</h3>
                        <p className="text-xs text-zinc-600 leading-relaxed">{bullet}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        );

      case 'pricing':
        if (visiblePlans.length === 0) return null;
        return (
          <section key="pricing" id="pricing" className="border-t border-zinc-200 bg-[#FAFAFA] py-14">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="max-w-2xl space-y-1.5">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 [text-wrap:balance]">
                    {loc(
                      cms.pricingTitle || DEFAULT_PLATFORM_LANDING.pricingTitle,
                      cms.pricingTitle_en || DEFAULT_PLATFORM_LANDING.pricingTitle_en
                    )}
                  </h2>
                  <p className="text-sm text-zinc-600">
                    {loc(
                      cms.pricingSubtitle || DEFAULT_PLATFORM_LANDING.pricingSubtitle,
                      cms.pricingSubtitle_en || DEFAULT_PLATFORM_LANDING.pricingSubtitle_en
                    )}
                  </p>
                </div>
                {cleanWhatsappDigits && (
                  <a
                    href={`https://wa.me/${cleanWhatsappDigits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1.5 shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{t.landing.contactWhatsapp}</span>
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {visiblePlans.map((plan) => {
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
                          <span className="text-3xl font-extrabold font-mono-num tabular-nums">
                            {plan.price}
                          </span>
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
                        className={`w-full py-3 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                          plan.highlighted
                            ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
                            : 'bg-zinc-950 text-white hover:bg-zinc-800'
                        }`}
                      >
                        {loc(
                          cms.pricingCtaText || DEFAULT_PLATFORM_LANDING.pricingCtaText,
                          cms.pricingCtaText_en || DEFAULT_PLATFORM_LANDING.pricingCtaText_en
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        );

      case 'tygos_promo': {
        const erpModules = [
          {
            icon: PackageCheck,
            title: lang === 'en' ? 'Raw Inventory & Waste' : 'جرد المخازن والهدر اللحظي',
            desc:
              lang === 'en'
                ? 'Deduct recipe ingredients automatically on every confirmed table order.'
                : 'خصم أوتوماتيكي لخامات الريسبي مع كل طبق يُطلب في الصالة أو التيك أواي.',
          },
          {
            icon: Calculator,
            title: lang === 'en' ? 'Recipe Food Costing' : 'حساب تكلفة الأطباق (Food Cost)',
            desc:
              lang === 'en'
                ? 'Track exact dish profit margins and supplier price fluctuations.'
                : 'معرفة تكلفة كل وجبة بدقة وهامش الربح الحقيقي قبل أي تسعير جديد.',
          },
          {
            icon: Receipt,
            title: lang === 'en' ? 'Cloud POS & Shifts' : 'نقاط البيع والورديات (Cloud POS)',
            desc:
              lang === 'en'
                ? 'Unified cashier closing reports synced directly with Sufra QR tables.'
                : 'إغلاق الورديات، الضرائب، والفواتير الإلكترونية مترابطة مع ترابيزات سُفرة.',
          },
          {
            icon: CheckCircle2,
            title: lang === 'en' ? 'General Ledger & Branches' : 'الحسابات العامة والفروع',
            desc:
              lang === 'en'
                ? 'Consolidated P&L statements and supplier balances across all branches.'
                : 'ميزان مراجعة وحسابات موردين وأرباح موحدة لإدارة سلسلة مطاعمك بالكامل.',
          },
        ];

        return (
          <section key="tygos_promo" id="tygos-erp" className="border-t border-zinc-200 bg-white py-14">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="rounded-3xl bg-zinc-950 text-white border border-zinc-800 p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-6 space-y-5">
                  <p className="text-xs font-bold text-amber-400">
                    {loc(
                      cms.tygosBadge || DEFAULT_PLATFORM_LANDING.tygosBadge,
                      cms.tygosBadge_en || DEFAULT_PLATFORM_LANDING.tygosBadge_en
                    )}
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight [text-wrap:balance]">
                    {loc(
                      cms.tygosTitle || DEFAULT_PLATFORM_LANDING.tygosTitle,
                      cms.tygosTitle_en || DEFAULT_PLATFORM_LANDING.tygosTitle_en
                    )}
                  </h2>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {loc(
                      cms.tygosSubtitle || DEFAULT_PLATFORM_LANDING.tygosSubtitle,
                      cms.tygosSubtitle_en || DEFAULT_PLATFORM_LANDING.tygosSubtitle_en
                    )}
                  </p>

                  <div className="pt-1 flex flex-wrap items-center gap-3">
                    {tygosWhatsappHref ? (
                      <a
                        href={tygosWhatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3.5 rounded-xl bg-amber-400 text-zinc-950 text-sm font-extrabold hover:bg-amber-300 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>
                          {loc(
                            cms.tygosCtaText || DEFAULT_PLATFORM_LANDING.tygosCtaText,
                            cms.tygosCtaText_en || DEFAULT_PLATFORM_LANDING.tygosCtaText_en
                          )}
                        </span>
                        <ArrowUpRight className="w-4 h-4" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onNavigate('/admin')}
                        className="px-6 py-3.5 rounded-xl bg-amber-400 text-zinc-950 text-sm font-extrabold hover:bg-amber-300 transition-colors inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                      >
                        <span>
                          {loc(
                            cms.tygosCtaText || DEFAULT_PLATFORM_LANDING.tygosTitle,
                            cms.tygosCtaText_en || DEFAULT_PLATFORM_LANDING.tygosCtaText_en
                          )}
                        </span>
                        <DirArrow className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {erpModules.map((mod, idx) => {
                    const ModIcon = mod.icon;
                    return (
                      <div
                        key={`erp_${idx}`}
                        className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-2"
                      >
                        <ModIcon className="w-5 h-5 text-amber-400" />
                        <h3 className="text-sm font-extrabold text-white">{mod.title}</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">{mod.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div
      dir={dir}
      className="min-h-screen bg-[#FAFAFA] text-zinc-900 flex flex-col overflow-x-clip max-w-full"
    >
      {/* 3-Zone Top Bar Contract */}
      <header className="border-b border-zinc-200 bg-white/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-8">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="flex items-center gap-2 text-lg sm:text-xl font-extrabold tracking-tight text-zinc-950 whitespace-nowrap shrink-0"
          >
            <SafeImage
              src={cms.platformLogoUrl || DEFAULT_PLATFORM_LANDING.platformLogoUrl}
              alt={t.brandName}
              className="w-8 h-8 rounded-xl object-cover border border-zinc-200 shadow-xs shrink-0"
            />
            <span>{t.brandName}</span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-600">
            <a
              href="#themes"
              className="hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0"
            >
              {t.nav.themes}
            </a>
            <a
              href="#operations"
              className="hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0"
            >
              {lang === 'en' ? 'Operations' : 'تشغيل الصالة'}
            </a>
            <a
              href="#loyalty"
              className="hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0"
            >
              {lang === 'en' ? 'Loyalty CRM' : 'الولاء والعملاء'}
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
                {currentUser
                  ? lang === 'en'
                    ? 'Dashboard'
                    : 'لوحة التحكم'
                  : lang === 'en'
                  ? 'Start Free'
                  : 'ابدأ مجاناً'}
              </span>
              <span className="hidden sm:inline">
                {currentUser ? t.nav.ownerDashboard : t.nav.createMenuFree}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Dynamic CMS Ordered & Visibility-Managed Sections */}
      {orderedSections.map((sec) => renderCmsSection(sec.id))}

      {/* Live Demo Restaurants Directory */}
      <section
        id="demos"
        className="border-t border-zinc-200 bg-[#FAFAFA] py-14 w-full"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
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
                      <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">
                        {rTagline}
                      </p>
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
        </div>
      </section>

      {/* Owner Login / Sign-up Portal Section */}
      <section id="owner-login" className="border-t border-zinc-200 bg-white py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-4">
            <p className="text-xs font-semibold text-amber-700">
              {loc(
                cms.heroBadge || DEFAULT_PLATFORM_LANDING.heroBadge,
                cms.heroBadge_en || DEFAULT_PLATFORM_LANDING.heroBadge_en
              )}
            </p>
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
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-5">
            <PWAInstallButton variant="compact" />
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
