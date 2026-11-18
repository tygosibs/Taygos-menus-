import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ExternalLink,
  Languages,
  Loader2,
  Mail,
  PauseCircle,
  Phone,
  PlayCircle,
  RefreshCw,
  Save,
  Search,
  Store,
  Trash2,
  User as UserIcon,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getThemeMeta } from '../../data/themes';
import {
  deleteRestaurantAccountCompletely,
  fetchAllTenantsForSuperAdmin,
  toggleRestaurantSuspension,
  updateRestaurantBilingualInfoForSuperAdmin,
} from '../../lib/firestoreService';
import { Restaurant, UserProfile } from '../../types/menu';
import { MenuBuilderTab } from '../admin/MenuBuilderTab';

interface TenantsManagerTabProps {
  onOpenPublicMenu: (path: string) => void;
}

type StatusFilter = 'all' | 'active' | 'suspended';

export function TenantsManagerTab({ onOpenPublicMenu }: TenantsManagerTabProps) {
  const { t, dir, lang, loc } = useLanguage();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [usersByUid, setUsersByUid] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [conciergeRestaurant, setConciergeRestaurant] = useState<Restaurant | null>(null);
  const [bilingualOpen, setBilingualOpen] = useState(false);
  const [editRestName, setEditRestName] = useState('');
  const [editRestNameEn, setEditRestNameEn] = useState('');
  const [editRestTagline, setEditRestTagline] = useState('');
  const [editRestTaglineEn, setEditRestTaglineEn] = useState('');
  const [savingBilingual, setSavingBilingual] = useState(false);
  const [bilingualSaved, setBilingualSaved] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Restaurant | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAllTenantsForSuperAdmin();
      setRestaurants(res.restaurants);
      setUsersByUid(res.usersByUid);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.errGeneric);
    } finally {
      setLoading(false);
    }
  }, [t.auth.errGeneric]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const stats = useMemo(() => {
    const total = restaurants.length;
    const suspended = restaurants.filter((r) => Boolean(r.isSuspended)).length;
    const active = total - suspended;
    return { total, active, suspended };
  }, [restaurants]);

  const filteredRestaurants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return restaurants.filter((rest) => {
      const isSusp = Boolean(rest.isSuspended);
      if (statusFilter === 'active' && isSusp) return false;
      if (statusFilter === 'suspended' && !isSusp) return false;
      if (!q) return true;

      const owner = usersByUid[rest.ownerId];
      const haystack = [
        rest.name,
        rest.name_en || '',
        rest.slug,
        rest.whatsappNumber,
        owner?.displayName || '',
        owner?.email || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [restaurants, usersByUid, searchQuery, statusFilter]);

  const handleToggleSuspend = async (rest: Restaurant) => {
    const nextSuspended = !Boolean(rest.isSuspended);
    setBusyId(rest.id);
    setError(null);
    try {
      await toggleRestaurantSuspension(rest.id, nextSuspended);
      setRestaurants((prev) =>
        prev.map((item) =>
          item.id === rest.id ? { ...item, isSuspended: nextSuspended } : item
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.errGeneric);
    } finally {
      setBusyId(null);
    }
  };

  const openConcierge = (rest: Restaurant) => {
    setConciergeRestaurant(rest);
    setEditRestName(rest.name);
    setEditRestNameEn(rest.name_en || '');
    setEditRestTagline(rest.tagline || '');
    setEditRestTaglineEn(rest.tagline_en || '');
    setBilingualOpen(false);
    setBilingualSaved(false);
  };

  const handleSaveBilingualRestInfo = async (e: FormEvent) => {
    e.preventDefault();
    if (!conciergeRestaurant || editRestName.trim().length < 2) return;
    setSavingBilingual(true);
    setError(null);
    setBilingualSaved(false);
    try {
      const saved = await updateRestaurantBilingualInfoForSuperAdmin(conciergeRestaurant.id, {
        name: editRestName,
        name_en: editRestNameEn,
        tagline: editRestTagline,
        tagline_en: editRestTaglineEn,
      });
      const updatedRest = { ...conciergeRestaurant, ...saved };
      setConciergeRestaurant(updatedRest);
      setRestaurants((prev) => prev.map((r) => (r.id === updatedRest.id ? updatedRest : r)));
      setBilingualSaved(true);
      setTimeout(() => setBilingualSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.errGeneric);
    } finally {
      setSavingBilingual(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteRestaurantAccountCompletely(deleteTarget);
      setRestaurants((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      if (conciergeRestaurant?.id === deleteTarget.id) {
        setConciergeRestaurant(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.errGeneric);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-500">
              {t.superAdmin.tenants.totalRestaurants}
            </p>
            <p className="text-2xl font-extrabold text-zinc-950 font-mono-num mt-1">
              {stats.total}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-500">
              {t.superAdmin.tenants.activeAccounts}
            </p>
            <p className="text-2xl font-extrabold text-emerald-700 font-mono-num mt-1">
              {stats.active}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-500">
              {t.superAdmin.tenants.suspendedAccounts}
            </p>
            <p className="text-2xl font-extrabold text-rose-700 font-mono-num mt-1">
              {stats.suspended}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
            <PauseCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.superAdmin.tenants.searchPlaceholder}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:border-zinc-900"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-100 p-1 rounded-xl">
            {(
              [
                { id: 'all', label: t.superAdmin.tenants.filterAll },
                { id: 'active', label: t.superAdmin.tenants.filterActive },
                { id: 'suspended', label: t.superAdmin.tenants.filterSuspended },
              ] as { id: StatusFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadTenants}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t.superAdmin.tenants.refreshBtn}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
          {error}
        </div>
      )}

      {/* Tenants List */}
      {loading ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center space-y-2">
          <Loader2 className="w-7 h-7 animate-spin text-zinc-700 mx-auto" />
          <p className="text-xs font-semibold text-zinc-500">{t.admin.loadingWorkspace}</p>
        </div>
      ) : filteredRestaurants.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center space-y-2">
          <Store className="w-8 h-8 text-zinc-300 mx-auto" />
          <p className="text-sm font-bold text-zinc-800">{t.menu.noResults}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRestaurants.map((rest) => {
            const owner = usersByUid[rest.ownerId];
            const themeMeta = getThemeMeta(rest.activeTheme);
            const isSuspended = Boolean(rest.isSuspended);
            const isBusy = busyId === rest.id;
            const displayRestName = loc(rest.name, rest.name_en);

            return (
              <article
                key={rest.id}
                className={`bg-white border rounded-2xl p-5 flex flex-col justify-between gap-4 transition-colors ${
                  isSuspended ? 'border-rose-200 bg-rose-50/20' : 'border-zinc-200'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: rest.primaryColor || '#A61C1C' }}
                        />
                        <h3 className="text-base font-extrabold text-zinc-950 truncate">
                          {displayRestName}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenPublicMenu(`/menu/${rest.slug}`)}
                        className="mt-1 text-xs font-mono-num text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                        dir="ltr"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span>/menu/{rest.slug}</span>
                      </button>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 border ${
                        isSuspended
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {isSuspended
                        ? t.superAdmin.tenants.statusSuspended
                        : t.superAdmin.tenants.statusActive}
                    </span>
                  </div>

                  {/* Owner & Theme Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-100 text-xs">
                    <div className="flex items-center gap-2 text-zinc-700 min-w-0">
                      <UserIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate font-semibold">
                        {owner?.displayName || t.superAdmin.tenants.ownerLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-zinc-700 min-w-0">
                      <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate font-mono-num" dir="ltr">
                        {owner?.email || '—'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-zinc-700 min-w-0">
                      <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate font-mono-num" dir="ltr">
                        {rest.whatsappNumber}
                      </span>
                    </div>

                    <div className="text-zinc-600 truncate font-mono-num">
                      {t.superAdmin.tenants.themeLabel}{' '}
                      <span className="font-bold text-zinc-900">
                        {themeMeta.number}.{' '}
                        {lang === 'en' ? themeMeta.englishName : themeMeta.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Account Controls */}
                <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openConcierge(rest)}
                    className="px-3.5 py-2 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer"
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5" />
                    <span>{t.superAdmin.tenants.conciergeBtn}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleToggleSuspend(rest)}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                        isSuspended
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                      }`}
                    >
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isSuspended ? (
                        <PlayCircle className="w-3.5 h-3.5" />
                      ) : (
                        <PauseCircle className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isSuspended
                          ? t.superAdmin.tenants.activateBtn
                          : t.superAdmin.tenants.suspendBtn}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(rest)}
                      aria-label={t.superAdmin.tenants.deleteBtn}
                      className="p-2 rounded-xl border border-zinc-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Concierge Menu Editor Drawer */}
      {conciergeRestaurant && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex justify-end"
          onClick={() => setConciergeRestaurant(null)}
        >
          <div
            dir={dir}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl bg-[#F5F6F8] h-full overflow-y-auto shadow-2xl flex flex-col"
          >
            <div className="sticky top-0 z-20 bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-amber-700">
                  {t.superAdmin.tenants.conciergeTitle}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <h3 className="text-lg font-extrabold text-zinc-950 truncate">
                    {loc(conciergeRestaurant.name, conciergeRestaurant.name_en)}
                  </h3>
                  <span className="text-xs text-zinc-500 font-mono-num" dir="ltr">
                    /menu/{conciergeRestaurant.slug}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setBilingualOpen((o) => !o)}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                    bilingualOpen
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'border-zinc-200 text-zinc-800 hover:bg-zinc-50'
                  }`}
                >
                  <Languages className="w-3.5 h-3.5" />
                  <span>{lang === 'en' ? 'Store AR / EN' : 'بيانات المطعم AR / EN'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPublicMenu(`/menu/${conciergeRestaurant.slug}`)}
                  className="px-3.5 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-800 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t.superAdmin.tenants.openMenuBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConciergeRestaurant(null)}
                  className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 cursor-pointer"
                  aria-label={t.superAdmin.tenants.closeConcierge}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {bilingualOpen && (
                <form
                  onSubmit={handleSaveBilingualRestInfo}
                  className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-extrabold text-zinc-950">
                      {lang === 'en'
                        ? 'Bilingual Restaurant Identity (AR / EN)'
                        : 'بيانات المطعم باللغتين (عربي / إنجليزي)'}
                    </h4>
                    {bilingualSaved && (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>{t.admin.themes.savedToast}</span>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold mb-1">
                        {t.admin.themes.nameArLabel}
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        required
                        minLength={2}
                        maxLength={120}
                        value={editRestName}
                        onChange={(e) => setEditRestName(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">
                        {t.admin.themes.nameEnLabel}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        maxLength={120}
                        value={editRestNameEn}
                        onChange={(e) => setEditRestNameEn(e.target.value)}
                        placeholder="e.g. Buns Lab"
                        className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-sm text-left"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">
                        {t.admin.themes.taglineArLabel}
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        maxLength={500}
                        value={editRestTagline}
                        onChange={(e) => setEditRestTagline(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">
                        {t.admin.themes.taglineEnLabel}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        maxLength={500}
                        value={editRestTaglineEn}
                        onChange={(e) => setEditRestTaglineEn(e.target.value)}
                        placeholder="e.g. Daily fresh smashed burgers..."
                        className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-sm text-left"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingBilingual}
                      className="px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {savingBilingual ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>{t.admin.themes.saveSettingsBtn}</span>
                    </button>
                  </div>
                </form>
              )}

              <MenuBuilderTab restaurant={conciergeRestaurant} />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            dir={dir}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-zinc-950">
                  {t.superAdmin.tenants.confirmDeleteTitle}
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  <span className="font-bold text-zinc-950">
                    "{loc(deleteTarget.name, deleteTarget.name_en)}"
                  </span>{' '}
                  (<span className="font-mono-num" dir="ltr">/menu/{deleteTarget.slug}</span>) —{' '}
                  {t.superAdmin.tenants.confirmDeleteDesc}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
              >
                {t.superAdmin.tenants.cancelBtn}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {deleting
                    ? t.superAdmin.cms.savingBtn
                    : t.superAdmin.tenants.confirmDeleteBtn}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
