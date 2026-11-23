import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  FileCode2,
  Loader2,
  Monitor,
  Palette,
  Play,
  Plus,
  Save,
  Smartphone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { DEMO_RESTAURANTS } from '../../data/demoRestaurants';
import {
  buildCustomThemeSrcDoc,
  STARTER_CUSTOM_CSS,
  STARTER_CUSTOM_HTML,
  STARTER_CUSTOM_JS,
  TEMPLATE_VARIABLE_DOCS,
} from '../../lib/customThemeEngine';
import {
  deleteCustomTheme,
  fetchAllCustomThemes,
  saveCustomTheme,
  toggleCustomThemeActive,
} from '../../lib/firestoreService';
import { CURATED_FOOD_IMAGES } from '../../lib/imageUtils';
import { CustomTheme } from '../../types/menu';
import { SafeImage } from '../SafeImage';

type CodeLangTab = 'html' | 'css' | 'js';
type PreviewDevice = 'mobile' | 'desktop';

export function ThemeInjectorTab() {
  const { t, lang, dir, loc } = useLanguage();
  const isEn = lang === 'en';
  const [themes, setThemes] = useState<CustomTheme[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('ثيم نيون داكن مخصص');
  const [nameEn, setNameEn] = useState('Custom Dark Neon Theme');
  const [description, setDescription] = useState(
    'تصميم عصري قابل للتخصيص بالكامل عبر HTML و CSS و JavaScript.'
  );
  const [descriptionEn, setDescriptionEn] = useState(
    'Modern customizable theme built with injected HTML, CSS, and JavaScript.'
  );
  const [previewImage, setPreviewImage] = useState(CURATED_FOOD_IMAGES[0].url);
  const [isActive, setIsActive] = useState(true);
  const [htmlCode, setHtmlCode] = useState(STARTER_CUSTOM_HTML);
  const [cssCode, setCssCode] = useState(STARTER_CUSTOM_CSS);
  const [jsCode, setJsCode] = useState(STARTER_CUSTOM_JS);

  const [codeTab, setCodeTab] = useState<CodeLangTab>('html');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('mobile');
  const [previewNonce, setPreviewNonce] = useState(1);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [lastSandboxEvent, setLastSandboxEvent] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomTheme | null>(null);

  const sandboxIframeRef = useRef<HTMLIFrameElement | null>(null);
  const demoBundle = DEMO_RESTAURANTS['buns-lab'];

  const loadThemes = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const list = await fetchAllCustomThemes();
      setThemes(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.errGeneric);
    } finally {
      setLoadingList(false);
    }
  }, [t.auth.errGeneric]);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!sandboxIframeRef.current || event.source !== sandboxIframeRef.current.contentWindow) {
        return;
      }
      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== 'object' || !data.type) return;
      const type = String(data.type);
      const itemId = typeof data.itemId === 'string' ? data.itemId : '';
      setLastSandboxEvent(
        itemId
          ? isEn
            ? `Event ${type} (${itemId})`
            : `حدث ${type} (${itemId})`
          : isEn
            ? `Event ${type}`
            : `حدث ${type}`
      );
      setTimeout(() => setLastSandboxEvent(null), 3500);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isEn]);

  const sandboxSrcDoc = useMemo(
    () =>
      buildCustomThemeSrcDoc({
        htmlCode,
        cssCode,
        jsCode,
        restaurant: demoBundle.restaurant,
        categories: demoBundle.categories,
        items: demoBundle.items,
        currentLang: lang,
      }),
    [htmlCode, cssCode, jsCode, demoBundle, lang]
  );

  const startNewTheme = () => {
    setEditingId(undefined);
    setName('ثيم مخصص جديد');
    setNameEn('New Custom Theme');
    setDescription('ثيم مخصص مبني بحقن الأكواد مع ربط كامل بالسلة الذكية.');
    setDescriptionEn('Custom code-injected menu theme connected to the smart cart.');
    setPreviewImage(CURATED_FOOD_IMAGES[0].url);
    setIsActive(true);
    setHtmlCode(STARTER_CUSTOM_HTML);
    setCssCode(STARTER_CUSTOM_CSS);
    setJsCode(STARTER_CUSTOM_JS);
    setSaveNotice(null);
    setPreviewNonce((n) => n + 1);
  };

  const loadThemeIntoEditor = (theme: CustomTheme) => {
    setEditingId(theme.id);
    setName(theme.name);
    setNameEn(theme.name_en || '');
    setDescription(theme.description || '');
    setDescriptionEn(theme.description_en || '');
    setPreviewImage(theme.previewImage || CURATED_FOOD_IMAGES[0].url);
    setIsActive(theme.isActive);
    setHtmlCode(theme.htmlCode);
    setCssCode(theme.cssCode);
    setJsCode(theme.jsCode);
    setSaveNotice(null);
    setPreviewNonce((n) => n + 1);
  };

  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 1800);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleSaveTheme = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    setSaveNotice(null);
    try {
      const saved = await saveCustomTheme({
        id: editingId,
        name,
        name_en: nameEn,
        description,
        description_en: descriptionEn,
        previewImage,
        htmlCode,
        cssCode,
        jsCode,
        isActive,
      });
      setEditingId(saved.id);
      setThemes((prev) => {
        const exists = prev.some((t) => t.id === saved.id);
        if (exists) return prev.map((t) => (t.id === saved.id ? saved : t));
        return [saved, ...prev];
      });
      setSaveNotice(`${loc(saved.name, saved.name_en)} (${saved.id})`);
      setTimeout(() => setSaveNotice(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.errGeneric);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (theme: CustomTheme) => {
    setBusyId(theme.id);
    try {
      await toggleCustomThemeActive(theme.id, !theme.isActive);
      setThemes((prev) =>
        prev.map((t) => (t.id === theme.id ? { ...t, isActive: !theme.isActive } : t))
      );
      if (editingId === theme.id) setIsActive(!theme.isActive);
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteCustomTheme(deleteTarget.id);
      setThemes((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      if (editingId === deleteTarget.id) {
        startNewTheme();
      }
      setDeleteTarget(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div dir={dir} className="space-y-6">
      {/* Saved Custom Themes Library */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-zinc-950">
              {t.superAdmin.injector.savedThemesTitle} ({themes.length})
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">{t.superAdmin.injector.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={startNewTheme}
            className="px-4 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>{t.superAdmin.injector.newThemeBtn}</span>
          </button>
        </div>

        {loadingList ? (
          <div className="py-6 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t.admin.loadingWorkspace}</span>
          </div>
        ) : themes.length === 0 ? (
          <div className="p-6 rounded-xl bg-zinc-50 border border-dashed border-zinc-300 text-center text-xs text-zinc-500">
            {t.superAdmin.injector.noThemes}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {themes.map((ct) => {
              const isSelected = editingId === ct.id;
              return (
                <div
                  key={ct.id}
                  className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition-colors ${
                    isSelected
                      ? 'border-zinc-950 bg-zinc-50 ring-1 ring-zinc-950'
                      : 'border-zinc-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <SafeImage
                      src={ct.previewImage}
                      alt={loc(ct.name, ct.name_en)}
                      className="w-16 h-16 rounded-xl object-cover border border-zinc-200 shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-extrabold text-zinc-950 truncate">
                          {loc(ct.name, ct.name_en)}
                        </h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                            ct.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                          }`}
                        >
                          {ct.isActive
                            ? t.superAdmin.injector.activeLabel
                            : t.superAdmin.injector.inactiveLabel}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono-num text-zinc-400 truncate" dir="ltr">
                        {ct.id}
                      </p>
                      {(ct.description || ct.description_en) && (
                        <p className="text-xs text-zinc-500 line-clamp-2">
                          {loc(ct.description, ct.description_en)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-zinc-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => loadThemeIntoEditor(ct)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{lang === 'en' ? 'Edit' : 'تعديل'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === ct.id}
                        onClick={() => handleToggleActive(ct)}
                        className="px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1 cursor-pointer"
                      >
                        {ct.isActive ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>{lang === 'en' ? 'Hide' : 'إخفاء'}</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>{lang === 'en' ? 'Activate' : 'تفعيل'}</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(ct)}
                        aria-label={t.superAdmin.injector.deleteThemeBtn}
                        className="p-1.5 rounded-lg border border-zinc-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
          {error}
        </div>
      )}

      {/* Code Injector Form + Live Preview Sandbox */}
      <form onSubmit={handleSaveTheme} className="space-y-6">
        {/* Theme Metadata Card */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-extrabold text-zinc-950">
                {editingId ? `${t.superAdmin.injector.title} (${editingId})` : t.superAdmin.injector.title}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {saveNotice && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                  {saveNotice}
                </span>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>
                  {saving ? t.superAdmin.injector.savingBtn : t.superAdmin.injector.saveThemeBtn}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-800 mb-1">
                {t.superAdmin.injector.nameArLabel}
              </label>
              <input
                type="text"
                dir="rtl"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-800 mb-1">
                {t.superAdmin.injector.nameEnLabel}
              </label>
              <input
                type="text"
                dir="ltr"
                maxLength={100}
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold cursor-pointer bg-zinc-50">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-zinc-950"
                />
                <span>{t.superAdmin.injector.isActiveToggle}</span>
              </label>
            </div>

            <div className="lg:col-span-1">
              <label className="block text-xs font-bold text-zinc-800 mb-1">
                {t.superAdmin.injector.descArLabel}
              </label>
              <input
                type="text"
                dir="rtl"
                maxLength={400}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-zinc-800 mb-1">
                {t.superAdmin.injector.descEnLabel}
              </label>
              <input
                type="text"
                dir="ltr"
                maxLength={400}
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <SafeImage
              src={previewImage}
              alt={name}
              className="w-12 h-12 rounded-xl object-cover border border-zinc-200 shrink-0"
            />
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                {t.superAdmin.injector.previewImgLabel}
              </label>
              <input
                type="text"
                dir="ltr"
                value={previewImage}
                onChange={(e) => setPreviewImage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-xs font-mono-num"
              />
            </div>
            <div className="flex items-center gap-1.5 pt-4">
              {CURATED_FOOD_IMAGES.slice(0, 4).map((img) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => setPreviewImage(img.url)}
                  className={`w-9 h-9 rounded-lg overflow-hidden border-2 cursor-pointer ${
                    previewImage === img.url ? 'border-zinc-950' : 'border-transparent opacity-70'
                  }`}
                >
                  <SafeImage src={img.url} alt={img.label} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Data Variables Helper Box */}
        <div className="bg-zinc-950 text-zinc-100 rounded-2xl p-5 space-y-3 border border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-extrabold">{t.superAdmin.injector.variablesGuideTitle}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {TEMPLATE_VARIABLE_DOCS.map((item) => {
              const isCopied = copiedToken === item.token;
              return (
                <div
                  key={item.token}
                  className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-300">
                      {loc(item.label, item.label_en)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyToken(item.token)}
                      className="px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-[11px] font-bold text-zinc-200 flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {isCopied ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>
                        {isCopied ? t.superAdmin.injector.copiedVar : t.superAdmin.injector.copyVarBtn}
                      </span>
                    </button>
                  </div>
                  <code
                    dir="ltr"
                    className="text-[11px] font-mono-num text-emerald-300 bg-black/50 px-2 py-1.5 rounded-lg overflow-x-auto whitespace-nowrap block"
                  >
                    {item.token}
                  </code>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {loc(item.hint, item.hint_en)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Split Workbench: Code Editor + Live Preview Sandbox */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
          {/* Code Editor Pane */}
          <div className="xl:col-span-7 bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col">
            <div className="bg-zinc-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'html', label: isEn ? 'HTML Template' : 'قالب HTML', icon: FileCode2 },
                    { id: 'css', label: isEn ? 'Custom CSS' : 'تنسيقات CSS', icon: Palette },
                    { id: 'js', label: isEn ? 'Custom JavaScript' : 'برمجة JS', icon: Code2 },
                  ] as { id: CodeLangTab; label: string; icon: typeof Code2 }[]
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = codeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCodeTab(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        active
                          ? 'bg-amber-500 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-300 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  setHtmlCode(STARTER_CUSTOM_HTML);
                  setCssCode(STARTER_CUSTOM_CSS);
                  setJsCode(STARTER_CUSTOM_JS);
                  setPreviewNonce((n) => n + 1);
                }}
                className="text-[11px] font-bold text-zinc-300 hover:text-white underline underline-offset-4 cursor-pointer"
              >
                {t.superAdmin.injector.loadBoilerplateBtn}
              </button>
            </div>

            <div className="flex-1 bg-[#0D1117] p-3">
              {codeTab === 'html' && (
                <textarea
                  dir="ltr"
                  spellCheck={false}
                  value={htmlCode}
                  onChange={(e) => setHtmlCode(e.target.value)}
                  className="w-full h-[520px] bg-transparent text-zinc-100 font-mono text-xs leading-6 focus:outline-none resize-y"
                  placeholder="<div>...</div>"
                />
              )}
              {codeTab === 'css' && (
                <textarea
                  dir="ltr"
                  spellCheck={false}
                  value={cssCode}
                  onChange={(e) => setCssCode(e.target.value)}
                  className="w-full h-[520px] bg-transparent text-sky-200 font-mono text-xs leading-6 focus:outline-none resize-y"
                  placeholder="body { ... }"
                />
              )}
              {codeTab === 'js' && (
                <textarea
                  dir="ltr"
                  spellCheck={false}
                  value={jsCode}
                  onChange={(e) => setJsCode(e.target.value)}
                  className="w-full h-[520px] bg-transparent text-amber-200 font-mono text-xs leading-6 focus:outline-none resize-y"
                  placeholder="const restaurant = {{RESTAURANT_JSON}};"
                />
              )}
            </div>
          </div>

          {/* Live Preview Sandbox Pane */}
          <div className="xl:col-span-5 bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-extrabold text-zinc-950">
                  {t.superAdmin.injector.livePreviewTitle}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {loc(demoBundle.restaurant.name, demoBundle.restaurant.name_en)}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  title={lang === 'en' ? 'Mobile' : 'جوال'}
                  className={`p-1.5 rounded-lg border cursor-pointer ${
                    previewDevice === 'mobile'
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-white text-zinc-600 border-zinc-200'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  title={lang === 'en' ? 'Desktop' : 'سطح المكتب'}
                  className={`p-1.5 rounded-lg border cursor-pointer ${
                    previewDevice === 'desktop'
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-white text-zinc-600 border-zinc-200'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewNonce((n) => n + 1)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-950 text-white text-[11px] font-bold hover:bg-zinc-800 flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  <span>{t.superAdmin.injector.refreshPreviewBtn}</span>
                </button>
              </div>
            </div>

            {lastSandboxEvent && (
              <div className="px-3 py-1.5 bg-emerald-50 border-b border-emerald-200 text-[11px] font-bold text-emerald-800">
                {lastSandboxEvent}
              </div>
            )}

            <div className="flex-1 bg-zinc-100 p-3 flex items-start justify-center overflow-auto">
              <div
                className={`bg-white border border-zinc-300 rounded-xl overflow-hidden shadow-inner transition-all ${
                  previewDevice === 'mobile' ? 'w-[375px] max-w-full' : 'w-full'
                }`}
              >
                <iframe
                  key={`${previewNonce}_${lang}`}
                  ref={sandboxIframeRef}
                  title={t.superAdmin.injector.livePreviewTitle}
                  sandbox="allow-scripts"
                  srcDoc={sandboxSrcDoc}
                  className="w-full h-[520px] border-0 block"
                />
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Delete Theme Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-2xl p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-extrabold text-zinc-950">
              {t.superAdmin.injector.deleteThemeBtn}
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              <span className="font-bold">"{loc(deleteTarget.name, deleteTarget.name_en)}"</span> —{' '}
              {t.superAdmin.tenants.confirmDeleteDesc}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-bold cursor-pointer"
              >
                {t.superAdmin.tenants.cancelBtn}
              </button>
              <button
                type="button"
                disabled={busyId === deleteTarget.id}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
              >
                {t.superAdmin.injector.deleteThemeBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
