import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Request, Response } from 'express';
import type { ViteDevServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 3000);

/**
 * Official Sufra Platform Icon (used ONLY for / platform root, favicon & PWA).
 */
const OFFICIAL_PLATFORM_LOGO_REL = '/assets/aistudio/suofra_logo_icon_f1015078.png';

/**
 * Generic food dish fallback (used ONLY for restaurants without an uploaded logoUrl).
 * NEVER mix with Sufra platform icon!
 */
const DEFAULT_RESTAURANT_FOOD_FALLBACK =
  '/src/assets/images/burger_smash_signature_1794967836686.jpg';

interface FirebaseConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
}

interface ResolvedRestaurantMeta {
  slug: string;
  name: string;
  name_en?: string;
  tagline?: string;
  tagline_en?: string;
  logoUrl?: string;
  shareTitle?: string;
  shareTitle_en?: string;
  shareDescription?: string;
  shareDescription_en?: string;
}

interface ResolvedPlatformMeta {
  heroSubtitle: string;
  heroSubtitle_en?: string;
  platformLogoUrl?: string;
  shareTitle?: string;
  shareTitle_en?: string;
  shareDescription?: string;
  shareDescription_en?: string;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 25000;
const restaurantCache = new Map<string, CacheEntry<ResolvedRestaurantMeta | null>>();
let platformCache: CacheEntry<ResolvedPlatformMeta> | null = null;

const DEMO_META_MAP: Record<string, ResolvedRestaurantMeta> = {
  'buns-lab': {
    slug: 'buns-lab',
    name: 'مختبر البرجر | Buns Lab',
    name_en: 'Buns Lab Burger Bar',
    tagline: 'برجر سماش محضر يومياً من لحم الواغيو الطازج مع خبز البريوش المحمص وصوصاتنا الخاصة.',
    tagline_en: 'Daily fresh smashed Wagyu burgers served on toasted brioche buns with house sauces.',
    logoUrl: '/src/assets/images/burger_smash_signature_1794967836686.jpg',
  },
  'saffron-lounge': {
    slug: 'saffron-lounge',
    name: 'سافرون لاونج | Saffron Lounge',
    name_en: 'Saffron Fine Lounge',
    tagline: 'تجربة عشاء فاخرة تجمع بين شرائح اللحوم المعتقة والأطباق الإيطالية المعاصرة.',
    tagline_en: 'An elevated evening dining experience blending dry-aged cuts with modern Italian gastronomy.',
    logoUrl: '/src/assets/images/steak_wagyu_luxury_1794967837741.jpg',
  },
  'velvet-roast': {
    slug: 'velvet-roast',
    name: 'محمصة ومخبز فيلفيت | Velvet Roast',
    name_en: 'Velvet Roast & Bakery',
    tagline: 'قهوة مختصة محمصة محلياً ومخبوزات فرنسية تُخبز كل صباح بالزبدة الطبيعية.',
    tagline_en: 'Small-batch specialty coffee roasted locally alongside butter-laminated French pastries baked every morning.',
    logoUrl: '/src/assets/images/coffee_latte_croissant_1794967837713.jpg',
  },
};

const DEFAULT_PLATFORM_META: ResolvedPlatformMeta = {
  heroSubtitle:
    'أنشئ رابطاً خاصاً لمطعمك في دقائق، خصّص مظهر القائمة بين 9 ثيمات تريند احترافية، أضف الأحجام والإضافات، واستقبل الطلبات مباشرة في لوحة التحكم مع تنبيه صوتي أو عبر واتساب المطعم.',
  heroSubtitle_en:
    'Launch your branded restaurant link in minutes, switch seamlessly across designer themes, and receive live kitchen orders.',
  platformLogoUrl: OFFICIAL_PLATFORM_LOGO_REL,
  shareTitle: 'سُفرة QR ترحب بكم — منصة المنيو الإلكتروني الذكي',
  shareTitle_en: 'Sufra QR Welcomes You — Smart Digital Restaurant Menu',
  shareDescription:
    'أنشئ منيو مطعمك التفاعلي في دقائق بـ 10 ثيمات احترافية واستقبل طلبات الطاولات والواتساب مباشرة بضغطة واحدة.',
  shareDescription_en:
    'Launch your bilingual interactive QR menu in minutes with 10 designer themes and receive live kitchen & WhatsApp orders.',
};

function isPlatformIconUrl(url?: string): boolean {
  const clean = (url || '').trim();
  return (
    clean.includes('suofra_logo_icon_f1015078') ||
    clean.includes('sufra_platform_logo_1795015927934')
  );
}

function shortCacheHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < Math.min(input.length, 300); i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function loadFirebaseConfig(): FirebaseConfig | null {
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8');
    const parsed = JSON.parse(raw) as Partial<FirebaseConfig>;
    if (!parsed.projectId || !parsed.apiKey) return null;
    return {
      projectId: parsed.projectId,
      apiKey: parsed.apiKey,
      firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)',
    };
  } catch {
    return null;
  }
}

const fbConfig = loadFirebaseConfig();

function decodeFirestoreValue(val: Record<string, unknown> | undefined): unknown {
  if (!val) return undefined;
  if ('stringValue' in val) return String(val.stringValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('nullValue' in val) return null;
  return undefined;
}

function getFieldString(
  fields: Record<string, Record<string, unknown>> | undefined,
  key: string
): string | undefined {
  if (!fields || !(key in fields)) return undefined;
  const decoded = decodeFirestoreValue(fields[key]);
  return typeof decoded === 'string' ? decoded : undefined;
}

async function fetchFirestoreDocument(
  collectionPath: string,
  docId: string
): Promise<Record<string, Record<string, unknown>> | null> {
  if (!fbConfig) return null;
  try {
    const url =
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(fbConfig.projectId)}` +
      `/databases/${encodeURIComponent(fbConfig.firestoreDatabaseId)}` +
      `/documents/${collectionPath}/${encodeURIComponent(docId)}?key=${encodeURIComponent(fbConfig.apiKey)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
    return json.fields || null;
  } catch {
    return null;
  }
}

async function getPlatformMeta(): Promise<ResolvedPlatformMeta> {
  const now = Date.now();
  if (platformCache && platformCache.expiresAt > now) {
    return platformCache.value;
  }

  const fields = await fetchFirestoreDocument('platform_settings', 'landing');
  if (!fields) {
    platformCache = { value: DEFAULT_PLATFORM_META, expiresAt: now + CACHE_TTL_MS };
    return DEFAULT_PLATFORM_META;
  }

  const rawPlatLogo = getFieldString(fields, 'platformLogoUrl');
  const resolvedPlatLogo =
    !rawPlatLogo || rawPlatLogo.includes('sufra_platform_logo_1795015927934')
      ? OFFICIAL_PLATFORM_LOGO_REL
      : rawPlatLogo;

  const resolved: ResolvedPlatformMeta = {
    heroSubtitle: getFieldString(fields, 'heroSubtitle') || DEFAULT_PLATFORM_META.heroSubtitle,
    heroSubtitle_en: getFieldString(fields, 'heroSubtitle_en') || DEFAULT_PLATFORM_META.heroSubtitle_en,
    platformLogoUrl: resolvedPlatLogo,
    shareTitle: getFieldString(fields, 'shareTitle') || DEFAULT_PLATFORM_META.shareTitle,
    shareTitle_en: getFieldString(fields, 'shareTitle_en') || DEFAULT_PLATFORM_META.shareTitle_en,
    shareDescription:
      getFieldString(fields, 'shareDescription') ||
      getFieldString(fields, 'heroSubtitle') ||
      DEFAULT_PLATFORM_META.shareDescription,
    shareDescription_en:
      getFieldString(fields, 'shareDescription_en') ||
      getFieldString(fields, 'heroSubtitle_en') ||
      DEFAULT_PLATFORM_META.shareDescription_en,
  };

  platformCache = { value: resolved, expiresAt: now + CACHE_TTL_MS };
  return resolved;
}

function sanitizeSlugParam(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64);
}

async function getRestaurantMetaBySlug(rawSlug: string): Promise<ResolvedRestaurantMeta | null> {
  const slug = sanitizeSlugParam(rawSlug);
  if (!slug) return null;

  if (DEMO_META_MAP[slug]) {
    return DEMO_META_MAP[slug];
  }

  const now = Date.now();
  const cached = restaurantCache.get(slug);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const slugFields = await fetchFirestoreDocument('slugs', slug);
  const restaurantId = getFieldString(slugFields || undefined, 'restaurantId');
  if (!restaurantId) {
    restaurantCache.set(slug, { value: null, expiresAt: now + 8000 });
    return null;
  }

  const restFields = await fetchFirestoreDocument('restaurants', restaurantId);
  if (!restFields) {
    restaurantCache.set(slug, { value: null, expiresAt: now + 8000 });
    return null;
  }

  const rawRestLogo = getFieldString(restFields, 'logoUrl');

  const resolved: ResolvedRestaurantMeta = {
    slug,
    name: getFieldString(restFields, 'name') || slug,
    name_en: getFieldString(restFields, 'name_en'),
    tagline: getFieldString(restFields, 'tagline'),
    tagline_en: getFieldString(restFields, 'tagline_en'),
    logoUrl: isPlatformIconUrl(rawRestLogo) ? DEFAULT_RESTAURANT_FOOD_FALLBACK : rawRestLogo,
    shareTitle: getFieldString(restFields, 'shareTitle'),
    shareTitle_en: getFieldString(restFields, 'shareTitle_en'),
    shareDescription: getFieldString(restFields, 'shareDescription'),
    shareDescription_en: getFieldString(restFields, 'shareDescription_en'),
  };

  restaurantCache.set(slug, { value: resolved, expiresAt: now + CACHE_TTL_MS });
  return resolved;
}

function getRequestOrigin(req: Request): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
  const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim();
  const proto = forwardedProto || req.protocol || 'http';
  const host = forwardedHost || req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function resolveLocalAssetPath(relativeUrl: string): string | null {
  const cleanRel = relativeUrl.split('?')[0].replace(/^\/+/, '');

  if (cleanRel.startsWith('src/assets/')) {
    const candidates = isProduction
      ? [path.resolve(__dirname, 'dist', cleanRel), path.resolve(__dirname, cleanRel)]
      : [path.resolve(__dirname, cleanRel)];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
  }

  if (cleanRel.startsWith('assets/')) {
    const candidates = isProduction
      ? [path.resolve(__dirname, 'dist', cleanRel), path.resolve(__dirname, 'public', cleanRel)]
      : [path.resolve(__dirname, 'public', cleanRel)];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
  }

  return null;
}

function getMimeFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/jpeg';
}

async function sendResolvedLogoImage(
  res: Response,
  logoUrl: string | undefined,
  context: 'platform' | 'restaurant'
): Promise<void> {
  const fallbackAsset =
    context === 'platform' ? OFFICIAL_PLATFORM_LOGO_REL : DEFAULT_RESTAURANT_FOOD_FALLBACK;

  const sendFallbackLogo = () => {
    const fallbackPath = resolveLocalAssetPath(fallbackAsset);
    if (fallbackPath) {
      res.setHeader('Content-Type', getMimeFromExt(fallbackPath));
      res.setHeader('Cache-Control', 'public, max-age=120, must-revalidate');
      res.sendFile(fallbackPath);
      return;
    }
    res.status(404).end();
  };

  let trimmed = (logoUrl || '').trim();
  // Enforce strict identity separation: NEVER allow Sufra icon on restaurant OG cards
  if (context === 'restaurant' && isPlatformIconUrl(trimmed)) {
    trimmed = '';
  }

  if (!trimmed) {
    sendFallbackLogo();
    return;
  }

  // Case 1: Base64 Data URL stored in Firestore
  if (trimmed.startsWith('data:image/')) {
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(trimmed);
    if (match) {
      try {
        const mime = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'public, max-age=120, must-revalidate');
        res.send(buffer);
        return;
      } catch {
        sendFallbackLogo();
        return;
      }
    }
  }

  // Case 2: Local bundled or public asset like /assets/... or /src/assets/...
  if (trimmed.startsWith('/assets/') || trimmed.startsWith('/src/assets/')) {
    const localPath = resolveLocalAssetPath(trimmed);
    if (localPath) {
      res.setHeader('Content-Type', getMimeFromExt(localPath));
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
      res.sendFile(localPath);
      return;
    }
  }

  // Case 3: Remote HTTPS URL (e.g. Firebase Storage download URL)
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const upstream = await fetch(trimmed, { signal: controller.signal });
      clearTimeout(timer);
      if (upstream.ok) {
        const contentType = upstream.headers.get('content-type') || 'image/jpeg';
        const arrayBuf = await upstream.arrayBuffer();
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=120, must-revalidate');
        res.send(Buffer.from(arrayBuf));
        return;
      }
    } catch {
      // Fallback below
    }
  }

  sendFallbackLogo();
}

function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function replaceOrInjectTag(
  html: string,
  pattern: RegExp,
  replacementTag: string
): string {
  if (pattern.test(html)) {
    return html.replace(pattern, replacementTag);
  }
  return html.replace('</head>', `  ${replacementTag}\n  </head>`);
}

function injectOpenGraphHead(
  html: string,
  opts: {
    title: string;
    description: string;
    imageUrl: string;
    pageUrl: string;
    siteName: string;
    schemaJsonLd: Record<string, unknown>;
  }
): string {
  const safeTitle = escapeHtmlAttr(opts.title);
  const safeDesc = escapeHtmlAttr(opts.description);
  const safeImage = escapeHtmlAttr(opts.imageUrl);
  const safeUrl = escapeHtmlAttr(opts.pageUrl);
  const safeSiteName = escapeHtmlAttr(opts.siteName);

  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
  out = replaceOrInjectTag(
    out,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${safeDesc}" />`
  );
  out = replaceOrInjectTag(
    out,
    /<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:site_name" content="${safeSiteName}" />`
  );
  out = replaceOrInjectTag(
    out,
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${safeTitle}" />`
  );
  out = replaceOrInjectTag(
    out,
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${safeDesc}" />`
  );
  out = replaceOrInjectTag(
    out,
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:image" content="${safeImage}" />`
  );
  out = replaceOrInjectTag(
    out,
    /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:image:alt" content="${safeTitle}" />`
  );
  out = replaceOrInjectTag(
    out,
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${safeUrl}" />`
  );
  out = replaceOrInjectTag(
    out,
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${safeTitle}" />`
  );
  out = replaceOrInjectTag(
    out,
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${safeDesc}" />`
  );
  out = replaceOrInjectTag(
    out,
    /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:image" content="${safeImage}" />`
  );

  const jsonLdScript = `<script id="sufra-jsonld" type="application/ld+json">${JSON.stringify(opts.schemaJsonLd)}</script>`;
  out = replaceOrInjectTag(
    out,
    /<script[^>]*id="sufra-jsonld"[^>]*>[\s\S]*?<\/script>/i,
    jsonLdScript
  );

  return out;
}

function buildRestaurantTitle(meta: ResolvedRestaurantMeta): string {
  if (meta.shareTitle?.trim()) return meta.shareTitle.trim();
  const arName = meta.name.trim();
  if (!arName) return 'مطعمنا يرحب بكم';
  return arName.startsWith('مطعم') ? `${arName} يرحب بكم` : `مطعم ${arName} يرحب بكم`;
}

function buildRestaurantDescription(meta: ResolvedRestaurantMeta): string {
  return (
    meta.shareDescription?.trim() ||
    meta.tagline?.trim() ||
    'تصفح المنيو الإلكتروني التفاعلي، اختر وجبتك المفضلة مع الإضافات، واطلب مباشرة بضغطة واحدة.'
  );
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', true);

  // Dynamic OG Image endpoint exclusively for Sufra Platform Root Link
  app.get('/api/og-image/platform', async (_req: Request, res: Response) => {
    const meta = await getPlatformMeta();
    await sendResolvedLogoImage(res, meta.platformLogoUrl, 'platform');
  });

  // Dynamic OG Image endpoint per Restaurant Slug (strictly restaurant.logoUrl or dish fallback, NEVER Sufra icon)
  app.get('/api/og-image/:slug', async (req: Request, res: Response) => {
    const rawSlug = String(req.params.slug || '');
    const restMeta = await getRestaurantMetaBySlug(rawSlug);
    await sendResolvedLogoImage(res, restMeta?.logoUrl, 'restaurant');
  });

  const httpServer = http.createServer(app);
  let vite: ViteDevServer | null = null;
  const distDir = path.resolve(__dirname, 'dist');

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir, { index: false }));
  }

  // Catch-all SSR Meta + SPA Shell route
  app.use('*', async (req: Request, res: Response) => {
    try {
      const origin = getRequestOrigin(req);
      const reqPath = (req.originalUrl || '/').split('?')[0];

      const templatePath = isProduction
        ? path.resolve(distDir, 'index.html')
        : path.resolve(__dirname, 'index.html');
      let html = fs.readFileSync(templatePath, 'utf8');

      const menuMatch = /^\/menu\/([^/]+)\/?$/i.exec(reqPath);
      const staffMatch = /^\/staff\/([^/]+)(?:\/(onboarding))?\/?$/i.exec(reqPath);
      if (menuMatch) {
        const slug = decodeURIComponent(menuMatch[1]);
        const restMeta = await getRestaurantMetaBySlug(slug);
        if (restMeta) {
          const title = buildRestaurantTitle(restMeta);
          const description = buildRestaurantDescription(restMeta);
          const ver = shortCacheHash(restMeta.logoUrl || DEFAULT_RESTAURANT_FOOD_FALLBACK);
          const imageUrl = `${origin}/api/og-image/${encodeURIComponent(restMeta.slug)}?v=${ver}`;
          const pageUrl = `${origin}/menu/${encodeURIComponent(restMeta.slug)}`;
          html = injectOpenGraphHead(html, {
            title,
            description,
            imageUrl,
            pageUrl,
            siteName: restMeta.name,
            schemaJsonLd: {
              '@context': 'https://schema.org',
              '@type': 'Restaurant',
              name: restMeta.name,
              description,
              image: imageUrl,
              url: pageUrl,
              hasMenu: pageUrl,
            },
          });
        }
      } else if (staffMatch) {
        const slug = decodeURIComponent(staffMatch[1]);
        const isOnboarding = Boolean(staffMatch[2]);
        const restMeta = await getRestaurantMetaBySlug(slug);
        const restName = restMeta?.name || slug;
        const title = isOnboarding
          ? `${restName} — تفعيل حساب الكادر`
          : `${restName} — دخول الكادر`;
        const description = isOnboarding
          ? `بوابة تفعيل حساب عضو الكادر وتعيين كلمة المرور لمطعم ${restName}.`
          : `بوابة تشغيل الكادر والشاشات المعتمدة لمطعم ${restName} عبر سُفرة QR.`;
        const ver = shortCacheHash(restMeta?.logoUrl || DEFAULT_RESTAURANT_FOOD_FALLBACK);
        const imageUrl = restMeta
          ? `${origin}/api/og-image/${encodeURIComponent(restMeta.slug)}?v=${ver}`
          : `${origin}/api/og-image/platform`;
        const pageUrl = `${origin}${reqPath}`;
        html = injectOpenGraphHead(html, {
          title,
          description,
          imageUrl,
          pageUrl,
          siteName: restName,
          schemaJsonLd: {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: title,
            description,
            url: pageUrl,
          },
        });
      } else {
        const platMeta = await getPlatformMeta();
        const title = platMeta.shareTitle || DEFAULT_PLATFORM_META.shareTitle!;
        const description = platMeta.shareDescription || DEFAULT_PLATFORM_META.shareDescription!;
        const ver = shortCacheHash(platMeta.platformLogoUrl || OFFICIAL_PLATFORM_LOGO_REL);
        const imageUrl = `${origin}/api/og-image/platform?v=${ver}`;
        const pageUrl = `${origin}${reqPath === '/' ? '/' : reqPath}`;
        html = injectOpenGraphHead(html, {
          title,
          description,
          imageUrl,
          pageUrl,
          siteName: 'سُفرة QR',
          schemaJsonLd: {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'سُفرة QR',
            description,
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            image: imageUrl,
            url: `${origin}/`,
          },
        });
      }

      if (!isProduction && vite) {
        html = await vite.transformIndexHtml(req.originalUrl, html);
      }

      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
    } catch (err) {
      if (vite && err instanceof Error) {
        vite.ssrFixStacktrace(err);
      }
      res.status(500).send('Internal Server Error');
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Sufra QR server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
