import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  PauseCircle,
  Phone,
  PlayCircle,
  RefreshCw,
  Search,
  Store,
  Trash2,
  User as UserIcon,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { getThemeMeta } from '../../data/themes';
import {
  deleteRestaurantAccountCompletely,
  fetchAllTenantsForSuperAdmin,
  toggleRestaurantSuspension,
} from '../../lib/firestoreService';
import { Restaurant, UserProfile } from '../../types/menu';
import { MenuBuilderTab } from '../admin/MenuBuilderTab';

interface TenantsManagerTabProps {
  onOpenPublicMenu: (path: string) => void;
}

type StatusFilter = 'all' | 'active' | 'suspended';

export function TenantsManagerTab({ onOpenPublicMenu }: TenantsManagerTabProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [usersByUid, setUsersByUid] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [conciergeRestaurant, setConciergeRestaurant] = useState<Restaurant | null>(null);
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
      setError(err instanceof Error ? err.message : 'تعذر تحميل قائمة المطاعم');
    } finally {
      setLoading(false);
    }
  }, []);

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
      setError(err instanceof Error ? err.message : 'تعذر تحديث حالة الحساب');
    } finally {
      setBusyId(null);
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
      setError(err instanceof Error ? err.message : 'تعذر حذف حساب المطعم');
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
            <p className="text-xs font-semibold text-zinc-500">إجمالي المطاعم المسجلة</p>
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
            <p className="text-xs font-semibold text-zinc-500">الاشتراكات النشطة</p>
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
            <p className="text-xs font-semibold text-zinc-500">الحسابات الموقوفة مؤقتاً</p>
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
          <Search className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم المطعم، المالك، البريد الإلكتروني، الهاتف، أو الرابط..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:border-zinc-900"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-100 p-1 rounded-xl">
            {(
              [
                { id: 'all', label: 'الكل' },
                { id: 'active', label: 'نشط' },
                { id: 'suspended', label: 'موقوف' },
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
            <span>تحديث</span>
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
          <p className="text-xs font-semibold text-zinc-500">جاري جلب بيانات المطاعم والمشتركين...</p>
        </div>
      ) : filteredRestaurants.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center space-y-2">
          <Store className="w-8 h-8 text-zinc-300 mx-auto" />
          <p className="text-sm font-bold text-zinc-800">لا توجد مطاعم مطابقة للبحث</p>
          <p className="text-xs text-zinc-500">
            عند تسجيل أي مطعم جديد عبر المنصة سيظهر هنا بكامل بياناته وإدارته.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRestaurants.map((rest) => {
            const owner = usersByUid[rest.ownerId];
            const themeMeta = getThemeMeta(rest.activeTheme);
            const isSuspended = Boolean(rest.isSuspended);
            const isBusy = busyId === rest.id;

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
                          {rest.name}
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
                      {isSuspended ? 'موقوف مؤقتاً' : 'نشط'}
                    </span>
                  </div>

                  {/* Owner & Theme Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-100 text-xs">
                    <div className="flex items-center gap-2 text-zinc-700 min-w-0">
                      <UserIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate font-semibold">
                        {owner?.displayName || 'صاحب مطعم'}
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
                      الثيم: <span className="font-bold text-zinc-900">{themeMeta.number}. {themeMeta.name}</span>
                    </div>
                  </div>
                </div>

                {/* Account Controls */}
                <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setConciergeRestaurant(rest)}
                    className="px-3.5 py-2 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer"
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5" />
                    <span>تعديل المنيو بالنيابة</span>
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
                      <span>{isSuspended ? 'تفعيل الحساب' : 'إيقاف مؤقت'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(rest)}
                      aria-label="حذف حساب المطعم"
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
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl bg-[#F5F6F8] h-full overflow-y-auto shadow-2xl flex flex-col"
          >
            <div className="sticky top-0 z-20 bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-amber-700">
                  وضع التعديل بالنيابة (Concierge Menu Editor)
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <h3 className="text-lg font-extrabold text-zinc-950 truncate">
                    {conciergeRestaurant.name}
                  </h3>
                  <span className="text-xs text-zinc-500 font-mono-num" dir="ltr">
                    /menu/{conciergeRestaurant.slug}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenPublicMenu(`/menu/${conciergeRestaurant.slug}`)}
                  className="px-3.5 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-800 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>معاينة المنيو</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConciergeRestaurant(null)}
                  className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 cursor-pointer"
                  aria-label="إغلاق المحرر"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6">
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
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-zinc-950">
                  تأكيد حذف حساب المطعم نهائياً
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  هل أنت متأكد من حذف مطعم{' '}
                  <span className="font-bold text-zinc-950">"{deleteTarget.name}"</span>؟ سيتم حذف
                  بيانات المطعم والرابط (<span className="font-mono-num">/menu/{deleteTarget.slug}</span>)
                  وجميع الأقسام والوجبات والطلبات المرتبطة به ولا يمكن التراجع عن هذا الإجراء.
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
                إلغاء
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deleting ? 'جاري الحذف...' : 'حذف الحساب نهائياً'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
