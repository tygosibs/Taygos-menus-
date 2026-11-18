import { PlatformLandingSettings, Restaurant } from '../types/menu';

export interface ShareCardMetadata {
  title: string;
  description: string;
  imageUrl: string;
  ogImageUrl: string;
  url: string;
  siteName: string;
  lang: 'ar' | 'en';
  schemaJsonLd?: Record<string, unknown>;
}

const DEFAULT_PLATFORM_LOGO_PATH = '/src/assets/images/sufra_platform_logo_1795015927934.jpg';

export function resolveRestaurantShareTitle(
  restaurant: Pick<Restaurant, 'name' | 'name_en' | 'shareTitle' | 'shareTitle_en'>,
  lang: 'ar' | 'en'
): string {
  if (lang === 'en') {
    const customEn = restaurant.shareTitle_en?.trim();
    if (customEn) return customEn;
    const enName = restaurant.name_en?.trim() || restaurant.name.trim();
    return `${enName} Welcomes You`;
  }
  const customAr = restaurant.shareTitle?.trim();
  if (customAr) return customAr;
  const arName = restaurant.name.trim();
  if (!arName) return 'مطعمنا يرحب بكم';
  return arName.startsWith('مطعم') ? `${arName} يرحب بكم` : `مطعم ${arName} يرحب بكم`;
}

export function resolveRestaurantShareDescription(
  restaurant: Pick<Restaurant, 'tagline' | 'tagline_en' | 'shareDescription' | 'shareDescription_en'>,
  lang: 'ar' | 'en'
): string {
  if (lang === 'en') {
    return (
      restaurant.shareDescription_en?.trim() ||
      restaurant.tagline_en?.trim() ||
      'Browse our interactive digital menu, explore dishes & add-ons, and place your order directly in seconds.'
    );
  }
  return (
    restaurant.shareDescription?.trim() ||
    restaurant.tagline?.trim() ||
    'تصفح المنيو الإلكتروني التفاعلي، اختر وجبتك المفضلة مع الإضافات، واطلب مباشرة بضغطة واحدة.'
  );
}

export function resolvePlatformShareTitle(
  cms: Pick<PlatformLandingSettings, 'shareTitle' | 'shareTitle_en'>,
  lang: 'ar' | 'en'
): string {
  if (lang === 'en') {
    return (
      cms.shareTitle_en?.trim() ||
      'Sufra QR Welcomes You — Smart Digital Restaurant Menu'
    );
  }
  return (
    cms.shareTitle?.trim() ||
    'سُفرة QR ترحب بكم — منصة المنيو الإلكتروني الذكي'
  );
}

export function resolvePlatformShareDescription(
  cms: Pick<PlatformLandingSettings, 'shareDescription' | 'shareDescription_en' | 'heroSubtitle' | 'heroSubtitle_en'>,
  lang: 'ar' | 'en'
): string {
  if (lang === 'en') {
    return (
      cms.shareDescription_en?.trim() ||
      cms.heroSubtitle_en?.trim() ||
      'Launch your bilingual interactive QR menu in minutes with designer themes and receive live kitchen & WhatsApp orders.'
    );
  }
  return (
    cms.shareDescription?.trim() ||
    cms.heroSubtitle?.trim() ||
    'أنشئ منيو مطعمك التفاعلي في دقائق واستقبل طلبات الطاولات والواتساب مباشرة بضغطة واحدة.'
  );
}

export function getRestaurantShareMetadata(
  restaurant: Restaurant,
  lang: 'ar' | 'en',
  origin: string
): ShareCardMetadata {
  const title = resolveRestaurantShareTitle(restaurant, lang);
  const description = resolveRestaurantShareDescription(restaurant, lang);
  const displayLogo = restaurant.logoUrl?.trim() || DEFAULT_PLATFORM_LOGO_PATH;
  const ogImageUrl = `${origin}/api/og-image/${encodeURIComponent(restaurant.slug)}`;
  const url = `${origin}/menu/${encodeURIComponent(restaurant.slug)}`;
  const siteName = lang === 'en' ? restaurant.name_en?.trim() || restaurant.name : restaurant.name;

  return {
    title,
    description,
    imageUrl: displayLogo,
    ogImageUrl,
    url,
    siteName,
    lang,
    schemaJsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: siteName,
      description,
      image: ogImageUrl,
      url,
      servesCuisine: 'Digital QR Menu',
      hasMenu: url,
    },
  };
}

export function getPlatformShareMetadata(
  cms: PlatformLandingSettings,
  lang: 'ar' | 'en',
  origin: string
): ShareCardMetadata {
  const title = resolvePlatformShareTitle(cms, lang);
  const description = resolvePlatformShareDescription(cms, lang);
  const displayLogo = cms.platformLogoUrl?.trim() || DEFAULT_PLATFORM_LOGO_PATH;
  const ogImageUrl = `${origin}/api/og-image/platform`;
  const siteName = lang === 'en' ? 'Sufra QR' : 'سُفرة QR';

  return {
    title,
    description,
    imageUrl: displayLogo,
    ogImageUrl,
    url: `${origin}/`,
    siteName,
    lang,
    schemaJsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: siteName,
      description,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      image: ogImageUrl,
      url: `${origin}/`,
    },
  };
}

function upsertMetaTag(
  attrName: 'name' | 'property',
  attrValue: string,
  content: string
): void {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(url: string): void {
  if (typeof document === 'undefined') return;
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

function upsertJsonLd(schema?: Record<string, unknown>): void {
  if (typeof document === 'undefined') return;
  const id = 'sufra-jsonld';
  let script = document.getElementById(id) as HTMLScriptElement | null;
  if (!schema) {
    if (script) script.remove();
    return;
  }
  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(schema);
}

export function applySeoMetadata(meta: ShareCardMetadata): void {
  if (typeof document === 'undefined') return;
  document.title = meta.title;
  upsertMetaTag('name', 'description', meta.description);
  upsertMetaTag('property', 'og:title', meta.title);
  upsertMetaTag('property', 'og:description', meta.description);
  upsertMetaTag('property', 'og:image', meta.ogImageUrl);
  upsertMetaTag('property', 'og:image:alt', meta.title);
  upsertMetaTag('property', 'og:url', meta.url);
  upsertMetaTag('property', 'og:site_name', meta.siteName);
  upsertMetaTag('property', 'og:type', 'website');
  upsertMetaTag('property', 'og:locale', meta.lang === 'en' ? 'en_US' : 'ar_EG');
  upsertMetaTag('name', 'twitter:card', 'summary_large_image');
  upsertMetaTag('name', 'twitter:title', meta.title);
  upsertMetaTag('name', 'twitter:description', meta.description);
  upsertMetaTag('name', 'twitter:image', meta.ogImageUrl);
  upsertCanonical(meta.url);
  upsertJsonLd(meta.schemaJsonLd);
}
