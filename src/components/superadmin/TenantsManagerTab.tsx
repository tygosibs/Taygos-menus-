import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Cake,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSpreadsheet,
  Gift,
  Languages,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  Palette,
  PauseCircle,
  Phone,
  PhoneCall,
  PlayCircle,
  RefreshCw,
  Save,
  Search,
  Store,
  Tag,
  Trash2,
  Unlock,
  User as UserIcon,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getThemeMeta } from '../../data/themes';
import {
  buildOwnerGiftWhatsappUrl,
  formatWhatsappInternationalPhone,
  getDaysUntilIsoBirthday,
} from '../../lib/customerLoyaltyUtils';
import { auth } from '../../lib/firebase';
import {
  deleteRestaurantAccountCompletely,
  fetchAllTenantsForSuperAdmin,
  fetchPlatformPromoCodes,
  formatPlatformPromoSummary,
  toggleRestaurantSuspension,
  updateRestaurantBilingualInfoForSuperAdmin,
} from '../../lib/firestoreService';
import {
  subscribeAllRestaurantShifts,
  superAdminUnlockShiftAndOrders,
} from '../../lib/operationsService';
import { PlatformPromoCode, Restaurant, StaffShift, UserProfile } from '../../types/menu';
import { MenuBuilderTab } from '../admin/MenuBuilderTab';
import { OffersPromosTab } from '../admin/OffersPromosTab';
import { ThemeCustomizerTab } from '../admin/ThemeCustomizerTab';

interface TenantsManagerTabProps {
  onOpenPublicMenu: (path: string) => void;
}

type StatusFilter = 'all' | 'active' | 'suspended';

export function TenantsManagerTab({ onOpenPublicMenu }: TenantsManagerTabProps) {
  const { t, dir, lang, loc } = useLanguage();
  const isEn = lang === 'en';
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [usersByUid, setUsersByUid] = useState<Record<string, UserProfile>>({});
  const [platformPromos, setPlatformPromos] = useState<PlatformPromoCode[]>([]);
  const [selectedGiftPromoCode, setSelectedGiftPromoCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [conciergeRestaurant, setConciergeRestaurant] = useState<Restaurant | null>(null);
  const [conciergeTab, setConciergeTab] = useState<'menu' | 'offers' | 'theme'>('menu');
  const [bilingualOpen, setBilingualOpen] = useState(false);
  const [editRestName, setEditRestName] = useState('');
  const [editRestNameEn, setEditRestNameEn] = useState('');
  const [editRestTagline, setEditRestTagline] = useState('');
  const [editRestTaglineEn, setEditRestTaglineEn] = useState('');
  const [savingBilingual, setSavingBilingual] = useState(false);
  const [bilingualSaved, setBilingualSaved] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Restaurant | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Shifts Audit & Super Admin Unlock Drawer state
  const [shiftsAuditRestaurant, setShiftsAuditRestaurant] = useState<Restaurant | null>(null);
  const [auditShifts, setAuditShifts] = useState<StaffShift[]>([]);
  const [unlockingShiftId, setUnlockingShiftId] = useState<string | null>(null);
  const [auditFeedback, setAuditFeedback] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, promos] = await Promise.all([
        fetchAllTenantsForSuperAdmin(),
        fetchPlatformPromoCodes().catch(() => [] as PlatformPromoCode[]),
      ]);
      setRestaurants(res.restaurants);
      setUsersByUid(res.usersByUid);
      setPlatformPromos(promos);
      const firstActive = promos.find((p) => p.isActive);
      setSelectedGiftPromoCode((prev) => prev || firstActive?.code || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.errGeneric);
    } finally {
      setLoading(false);
    }
  }, [t.auth.errGeneric]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    if (!shiftsAuditRestaurant) {
      setAuditShifts([]);
      return;
    }
    const unsub = subscribeAllRestaurantShifts(
      shiftsAuditRestaurant.id,
      setAuditShifts,
      (err) => setAuditFeedback(err.message)
    );
    return () => unsub();
  }, [shiftsAuditRestaurant]);

  useEffect(() => {
    if (!conciergeRestaurant && !deleteTarget && !shiftsAuditRestaurant) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteTarget && !deleting) {
          setDeleteTarget(null);
        } else if (shiftsAuditRestaurant) {
          setShiftsAuditRestaurant(null);
        } else if (conciergeRestaurant) {
          setConciergeRestaurant(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [conciergeRestaurant, deleteTarget, deleting, shiftsAuditRestaurant]);

  const stats = useMemo(() => {
    const total = restaurants.length;
    const suspended = restaurants.filter((r) => Boolean(r.isSuspended)).length;
    const active = total - suspended;
    return { total, active, suspended };
  }, [restaurants]);

  const activePlatformPromos = useMemo(
    () => platformPromos.filter((p) => p.isActive),
    [platformPromos]
  );

  const selectedGiftPromoObj = useMemo(
    () => activePlatformPromos.find((p) => p.code === selectedGiftPromoCode) || null,
    [activePlatformPromos, selectedGiftPromoCode]
  );

  const selectedPromoSummary = useMemo(() => {
    if (!selectedGiftPromoObj) return '';
    const { summary, summary_en } = formatPlatformPromoSummary(selectedGiftPromoObj);
    return isEn ? summary_en : summary;
  }, [selectedGiftPromoObj, isEn]);

  const upcomingOwnerBirthdays = useMemo(() => {
    return restaurants
      .flatMap((rest) => {
        const daysUntil = getDaysUntilIsoBirthday(rest.ownerBirthday);
        if (daysUntil === null) return [];
        const owner: UserProfile | undefined = usersByUid[rest.ownerId];
        return [{ restaurant: rest, owner, daysUntil }];
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [restaurants, usersByUid]);

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
    setConciergeTab('menu');
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

  const handleUnlockClosedShift = async (shift: StaffShift) => {
    if (!shiftsAuditRestaurant) return;
    setUnlockingShiftId(shift.id);
    setAuditFeedback(null);
    try {
      await superAdminUnlockShiftAndOrders({
        restaurantId: shiftsAuditRestaurant.id,
        shift,
        superAdminActor: {
          uid: auth.currentUser?.uid || 'superadmin',
          name: auth.currentUser?.displayName || auth.currentUser?.email || 'Super Admin',
          role: 'superadmin',
        },
      });
      setAuditFeedback(
        isEn
          ? `Unlocked shift (${shift.stationName} - ${shift.staffName}) for emergency audit edit.`
          : `تم فك قفل الوردية (${shift.stationName} · ${shift.staffName}) بنجاح وإتاحة التعديل عليها.`
      );
    } catch (err) {
      setAuditFeedback(err instanceof Error ? err.message : t.auth.errGeneric);
    } finally {
      setUnlockingShiftId(null);
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

      {/* Proactive 3-Day Restaurant Owner Birthday Radar */}
      {!loading && (
        <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/40 p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Cake className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-zinc-950">
                  {isEn
                    ? `🎂 Upcoming Restaurant Owner Birthdays (Next 3 Days · ${upcomingOwnerBirthdays.length})`
                    : `🎂 أعياد ميلاد أصحاب المطاعم خلال الـ 3 أيام القادمة (${upcomingOwnerBirthdays.length})`}
                </h2>
                <p className="text-xs text-zinc-600 mt-0.5">
                  {isEn
                    ? 'Celebrate partner birthdays with 1-click WhatsApp gift promo codes or a direct appreciation call.'
                    : 'أرسل تهنئة وكود خصم هدية عبر واتساب أو تواصل هاتفياً مباشرة مع شركائك أصحاب المطاعم.'}
                </p>
              </div>
            </div>

            {activePlatformPromos.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-[11px] font-bold text-amber-950 whitespace-nowrap">
                  {isEn ? 'Gift Code:' : 'كود الهدية المرفق:'}
                </label>
                <select
                  value={selectedGiftPromoCode}
                  onChange={(e) => setSelectedGiftPromoCode(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-mono-num font-bold text-zinc-900 focus:outline-none"
                >
                  <option value="">{isEn ? 'None (Greeting Only)' : 'بدون كود (تهنئة فقط)'}</option>
                  {activePlatformPromos.map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.code}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {upcomingOwnerBirthdays.length === 0 ? (
            <p className="text-xs text-zinc-600 bg-white/80 border border-amber-100 rounded-xl p-3.5">
              {isEn
                ? 'No restaurant owner birthdays fall within the next 3 days.'
                : 'لا توجد أعياد ميلاد مسجلة لأصحاب المطاعم خلال الـ 3 أيام القادمة حالياً.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {upcomingOwnerBirthdays.map(({ restaurant: bRest, owner: bOwner, daysUntil }) => {
                const ownerDisplay = bOwner?.displayName || (isEn ? 'Partner' : 'شريك النجاح');
                const restDisplay = loc(bRest.name, bRest.name_en);
                const intlPhone = formatWhatsappInternationalPhone(bRest.whatsappNumber);
                const telHref = intlPhone ? `tel:+${intlPhone}` : `tel:${bRest.whatsappNumber}`;
                const waGiftHref = buildOwnerGiftWhatsappUrl({
                  rawPhone: bRest.whatsappNumber,
                  ownerName: ownerDisplay,
                  restaurantName: restDisplay,
                  daysUntil,
                  promoCode: selectedGiftPromoCode,
                  promoSummary: selectedPromoSummary,
                  lang,
                });
                const countdownBadge = isEn
                  ? daysUntil === 0
                    ? 'Today 🎂'
                    : daysUntil === 1
                      ? 'Tomorrow'
                      : `In ${daysUntil} days`
                  : daysUntil === 0
                    ? 'اليوم عيد ميلاده! 🎂'
                    : daysUntil === 1
                      ? 'باقي يوم واحد 🎈'
                      : daysUntil === 2
                        ? 'باقي يومين 🎈'
                        : `باقي ${daysUntil} أيام 🎈`;

                return (
                  <div
                    key={bRest.id}
                    className="bg-white border border-amber-200 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-zinc-950 truncate">
                          {ownerDisplay} · <span className="text-amber-800">{restDisplay}</span>
                        </p>
                        <p className="text-[11px] font-mono-num text-zinc-500 mt-0.5" dir="ltr">
                          {bRest.ownerBirthday} · {bRest.whatsappNumber}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-[11px] font-extrabold shrink-0">
                        {countdownBadge}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100">
                      <a
                        href={waGiftHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-h-[38px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Gift className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {selectedGiftPromoCode
                            ? isEn
                              ? `Send Birthday + ${selectedGiftPromoCode}`
                              : `أرسل تهنئة وكود ${selectedGiftPromoCode} 🎁`
                            : isEn
                              ? 'Send Birthday Greeting'
                              : 'أرسل تهنئة عيد الميلاد 💬'}
                        </span>
                      </a>
                      <a
                        href={telHref}
                        className="min-h-[38px] px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-900 text-xs font-bold flex items-center gap-1.5"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-zinc-700" />
                        <span>{isEn ? 'Call' : 'اتصال'}</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

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

                    <div className="flex items-center gap-2 text-zinc-700 min-w-0">
                      <Cake className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate font-mono-num" dir="ltr">
                        {rest.ownerBirthday || (isEn ? 'No birthday' : 'غير مسجل')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-zinc-700 min-w-0">
                      <Gift className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">
                        {rest.appliedPlatformPromoCode ? (
                          <span className="font-mono-num font-bold text-emerald-700" dir="ltr">
                            {rest.appliedPlatformPromoCode}
                          </span>
                        ) : (
                          <span className="text-zinc-400">
                            {isEn ? 'No SaaS promo' : 'بدون كود خصم منصة'}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Direct Contact & Gift WhatsApp Shortcuts */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {(() => {
                      const intlDigits = formatWhatsappInternationalPhone(rest.whatsappNumber);
                      const telHref = intlDigits ? `tel:+${intlDigits}` : `tel:${rest.whatsappNumber}`;
                      const waDirectHref = buildOwnerGiftWhatsappUrl({
                        rawPhone: rest.whatsappNumber,
                        ownerName: owner?.displayName || (isEn ? 'Partner' : 'شريكنا العزيز'),
                        restaurantName: displayRestName,
                        daysUntil: getDaysUntilIsoBirthday(rest.ownerBirthday),
                        promoCode: selectedGiftPromoCode,
                        promoSummary: selectedPromoSummary,
                        lang,
                      });
                      return (
                        <>
                          <a
                            href={telHref}
                            className="px-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 text-[11px] font-bold flex items-center gap-1.5"
                          >
                            <PhoneCall className="w-3.5 h-3.5 text-zinc-700" />
                            <span>{isEn ? 'Direct Call' : 'اتصال مباشر'}</span>
                          </a>
                          <a
                            href={waDirectHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-extrabold flex items-center gap-1.5"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                            <span>
                              {selectedGiftPromoCode
                                ? isEn
                                  ? `WhatsApp Gift (${selectedGiftPromoCode})`
                                  : `واتساب هدية (${selectedGiftPromoCode})`
                                : isEn
                                  ? 'WhatsApp Discounts & Offers'
                                  : 'واتساب الهدايا والخصومات 🎁'}
                            </span>
                          </a>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Account Controls */}
                <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openConcierge(rest)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer"
                    >
                      <UtensilsCrossed className="w-3.5 h-3.5" />
                      <span>{t.superAdmin.tenants.conciergeBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAuditFeedback(null);
                        setShiftsAuditRestaurant(rest);
                      }}
                      className="px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Shifts Audit' : 'تدقيق الورديات المغلقة'}</span>
                    </button>
                  </div>

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
            <div className="sticky top-0 z-20 bg-white border-b border-zinc-200 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-amber-700">
                    {t.superAdmin.tenants.conciergeTitle}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <h3 className="text-base sm:text-lg font-extrabold text-zinc-950 truncate">
                      {loc(conciergeRestaurant.name, conciergeRestaurant.name_en)}
                    </h3>
                    <span className="text-xs text-zinc-500 font-mono-num" dir="ltr">
                      /menu/{conciergeRestaurant.slug}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConciergeRestaurant(null)}
                  className="sm:hidden w-11 h-11 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 flex items-center justify-center cursor-pointer shrink-0"
                  aria-label={t.superAdmin.tenants.closeConcierge}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                  className="hidden sm:flex w-11 h-11 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 items-center justify-center cursor-pointer"
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

              {/* Concierge Inner Mode Tabs */}
              <div className="flex flex-wrap items-center gap-2 bg-white border border-zinc-200 rounded-2xl p-1.5 w-full sm:w-fit">
                <button
                  type="button"
                  onClick={() => setConciergeTab('menu')}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    conciergeTab === 'menu'
                      ? 'bg-zinc-950 text-white'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <UtensilsCrossed className="w-3.5 h-3.5" />
                  <span>{lang === 'en' ? 'Menu & Categories' : 'الأقسام والأصناف'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConciergeTab('offers')}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    conciergeTab === 'offers'
                      ? 'bg-zinc-950 text-white'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>{t.admin.tabs.offers}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConciergeTab('theme')}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    conciergeTab === 'theme'
                      ? 'bg-zinc-950 text-white'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>{lang === 'en' ? 'Themes & Store Settings' : 'الثيم وإعدادات المطعم'}</span>
                </button>
              </div>

              {conciergeTab === 'menu' ? (
                <MenuBuilderTab restaurant={conciergeRestaurant} />
              ) : conciergeTab === 'offers' ? (
                <OffersPromosTab
                  restaurant={conciergeRestaurant}
                  onRestaurantUpdated={(updated) => {
                    setConciergeRestaurant(updated);
                    setRestaurants((prev) =>
                      prev.map((r) => (r.id === updated.id ? updated : r))
                    );
                  }}
                />
              ) : (
                <ThemeCustomizerTab
                  restaurant={conciergeRestaurant}
                  onRestaurantUpdated={(updated) => {
                    setConciergeRestaurant(updated);
                    setRestaurants((prev) =>
                      prev.map((r) => (r.id === updated.id ? updated : r))
                    );
                  }}
                  onOpenPublicMenu={onOpenPublicMenu}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Closed Shifts Audit & Unlock Drawer */}
      {shiftsAuditRestaurant && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex justify-end"
          onClick={() => setShiftsAuditRestaurant(null)}
        >
          <div
            dir={dir}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-[#F5F6F8] h-full overflow-y-auto shadow-2xl flex flex-col"
          >
            <div className="sticky top-0 z-20 bg-white border-b border-zinc-200 px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-indigo-700">
                  {isEn ? 'Super Admin Financial Audit' : 'التدقيق المالي وفك قفل الورديات المغلقة'}
                </p>
                <h3 className="text-base font-extrabold text-zinc-950">
                  {loc(shiftsAuditRestaurant.name, shiftsAuditRestaurant.name_en)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShiftsAuditRestaurant(null)}
                className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {auditFeedback && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900">
                  {auditFeedback}
                </div>
              )}

              {auditShifts.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center space-y-2">
                  <Clock className="w-8 h-8 text-zinc-300 mx-auto" />
                  <p className="text-xs font-bold text-zinc-600">
                    {isEn ? 'No recorded shifts yet.' : 'لا توجد ورديات مسجلة لهذا المطعم حتى الآن.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditShifts.map((sh) => {
                    const isCompleted = sh.status === 'completed';
                    return (
                      <div
                        key={sh.id}
                        className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-extrabold text-zinc-950">
                                {sh.staffName}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 text-[11px] font-bold">
                                {sh.stationName}
                              </span>
                              {sh.shiftSlotName && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold">
                                  {sh.shiftSlotName}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-1">
                              {sh.handedOverToName
                                ? `تم التسليم إلى: ${sh.handedOverToName}`
                                : 'الوردية مفتوحة أو بدون تسليم مسجل'}
                            </p>
                          </div>

                          <span
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold flex items-center gap-1 ${
                              isCompleted
                                ? 'bg-zinc-100 border-zinc-300 text-zinc-800'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            }`}
                          >
                            {isCompleted ? (
                              <>
                                <Lock className="w-3 h-3" />
                                <span>مغلقة 🔒</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3 h-3" />
                                <span>{sh.superAdminUnlocked ? 'مفتوحة استثنائياً 🔓' : 'نشطة'}</span>
                              </>
                            )}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                          <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-200">
                            <span className="text-[10px] text-zinc-500 block">مبيعات الكاش</span>
                            <strong className="font-mono-num text-emerald-800">
                              {(sh.cashSales || 0).toFixed(2)}
                            </strong>
                          </div>
                          <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-200">
                            <span className="text-[10px] text-zinc-500 block">مبيعات الفيزا</span>
                            <strong className="font-mono-num text-blue-800">
                              {(sh.visaSales || 0).toFixed(2)}
                            </strong>
                          </div>
                          <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-200">
                            <span className="text-[10px] text-zinc-500 block">مصروفات الدرج</span>
                            <strong className="font-mono-num text-rose-700">
                              -{(sh.drawerExpensesTotal || 0).toFixed(2)}
                            </strong>
                          </div>
                          <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-200">
                            <span className="text-[10px] text-zinc-500 block">فرق الدرج</span>
                            <strong className="font-mono-num">
                              {(sh.drawerVarianceTotal || 0).toFixed(2)}
                            </strong>
                          </div>
                          <div className="p-2 rounded-xl bg-zinc-950 text-white">
                            <span className="text-[10px] text-zinc-400 block">صافي التسليم</span>
                            <strong className="font-mono-num text-amber-400">
                              {(sh.expectedCashHandover || 0).toFixed(2)}
                            </strong>
                          </div>
                        </div>

                        {isCompleted && (
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              disabled={unlockingShiftId === sh.id}
                              onClick={() => handleUnlockClosedShift(sh)}
                              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {unlockingShiftId === sh.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                              <span>فك قفل الوردية للتعديل 🔓</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
