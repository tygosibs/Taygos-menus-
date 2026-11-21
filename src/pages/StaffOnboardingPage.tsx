import { FormEvent, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { fetchRestaurantHalls } from '../lib/firestoreService';
import {
  getScreenMetaDynamic,
  normalizeStaffPhone,
  saveStaffScreen,
  STAFF_ROLE_META,
  validateStaffPassword,
} from '../lib/staffAuthUtils';
import {
  completeStaffOnboarding,
  fetchRestaurantBySlugForStaff,
  fetchStaffInvitePreview,
} from '../lib/staffService';
import { subscribeRestaurantStations } from '../lib/stationsService';
import { buildEffectiveStations } from '../lib/stationUtils';
import { Hall, Restaurant, RestaurantStation, StaffInvite, StaffMember } from '../types/menu';

interface StaffOnboardingPageProps {
  slug: string;
  onNavigate: (path: string) => void;
}

export function StaffOnboardingPage({ slug, onNavigate }: StaffOnboardingPageProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [dynamicStations, setDynamicStations] = useState<RestaurantStation[]>([]);
  const [inviteStatus, setInviteStatus] = useState<
    'loading' | 'valid' | 'expired' | 'used' | 'revoked' | 'not_found'
  >('loading');
  const [invite, setInvite] = useState<StaffInvite | null>(null);
  const [rawToken, setRawToken] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [hallId, setHallId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activatedStaff, setActivatedStaff] = useState<StaffMember | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = (params.get('invite') || '').trim();
    setRawToken(token);

    let mounted = true;
    (async () => {
      try {
        const rest = await fetchRestaurantBySlugForStaff(slug);
        if (!mounted) return;
        setRestaurant(rest);
        if (!rest) {
          document.title = 'دعوة غير موجودة — سُفرة QR';
          setInviteStatus('not_found');
          return;
        }
        document.title = `${rest.name} — دخول الكادر`;

        const [preview, restHalls] = await Promise.all([
          fetchStaffInvitePreview(rest.id, token),
          fetchRestaurantHalls(rest.id),
        ]);
        if (!mounted) return;
        setHalls(restHalls);
        setInviteStatus(preview.status);
        if (preview.invite) {
          setInvite(preview.invite);
          setName(preview.invite.staffName || '');
          setPhone(preview.invite.staffPhone || '');
          setEmail(preview.invite.staffEmail || '');
          setJobTitle(preview.invite.staffJobTitle || '');
          setHallId(preview.invite.staffHallId || '');
        }
      } catch {
        if (mounted) setInviteStatus('not_found');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!restaurant?.id) return;
    return subscribeRestaurantStations(restaurant.id, setDynamicStations, () => {});
  }, [restaurant?.id]);

  const effectiveStations = buildEffectiveStations(dynamicStations);

  const passwordCheck = newPassword
    ? validateStaffPassword(newPassword, confirmPassword || undefined)
    : null;

  const formatOnboardingError = (err: unknown): string => {
    if (!(err instanceof Error)) {
      return 'تعذر تفعيل الحساب. حاول مجدداً.';
    }
    const raw = err.message || '';
    try {
      const parsed = JSON.parse(raw) as {
        error?: string;
        errorCode?: string | null;
        path?: string | null;
        appCheck?: { configured?: boolean; active?: boolean };
      };
      if (parsed?.error) {
        const lower = parsed.error.toLowerCase();
        const diagParts = [
          parsed.errorCode ? `code: ${parsed.errorCode}` : null,
          parsed.path ? `path: ${parsed.path}` : null,
          parsed.appCheck !== undefined
            ? `appCheck: ${parsed.appCheck.configured ? (parsed.appCheck.active ? 'active' : 'failed-init') : 'off'}`
            : null,
        ].filter(Boolean);
        const diagText = diagParts.length > 0 ? ` (${diagParts.join(' | ')})` : '';
        if (lower.includes('permission') || lower.includes('insufficient')) {
          return `تم رفض الحفظ بسبب صلاحيات Firestore أو التحقق الأمني (App Check). تأكد من نشر قواعد الأمان وإعدادات النطاق، أو اطلب من صاحب المطعم إصدار دعوة QR جديدة.${diagText}`;
        }
        return `تعذر حفظ التفعيل: ${parsed.error}${diagText}`;
      }
    } catch {
      // plain error message
    }
    if (raw.includes('permission-denied') || raw.includes('Missing or insufficient permissions')) {
      return `تم رفض الحفظ بسبب صلاحيات Firestore أو التحقق الأمني (App Check). (${raw})`;
    }
    return raw || 'تعذر تفعيل الحساب. حاول مجدداً.';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!restaurant || !invite || !rawToken) return;
    setSubmitError(null);

    if (name.trim().length < 2) {
      setSubmitError('يرجى إدخال الاسم الكامل (حرفين على الأقل).');
      return;
    }
    if (normalizeStaffPhone(phone).length < 6) {
      setSubmitError('يرجى إدخال رقم هاتف صحيح (6 أرقام على الأقل).');
      return;
    }

    const check = validateStaffPassword(newPassword, confirmPassword);
    if (!check.valid) {
      setSubmitError(check.error || 'يرجى اختيار كلمة مرور قوية ومتطابقة.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedHall = halls.find((h) => h.id === hallId);
      const staff = await completeStaffOnboarding({
        restaurant,
        rawInviteToken: rawToken,
        invite,
        newPassword,
        confirmPassword,
        name,
        phone,
        email,
        jobTitle,
        hallId,
        hallName: selectedHall ? selectedHall.name : invite.staffHallName || '',
      });
      saveStaffScreen(restaurant.id, staff.uid, staff.defaultScreen);
      setActivatedStaff(staff);
    } catch (err) {
      setSubmitError(formatOnboardingError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (inviteStatus === 'loading') {
    return (
      <div dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-900 mx-auto" />
          <p className="text-sm font-bold text-zinc-700">جاري التحقق من رابط دعوة الكادر...</p>
        </div>
      </div>
    );
  }

  if (activatedStaff && restaurant) {
    const defaultMeta = getScreenMetaDynamic(activatedStaff.defaultScreen, effectiveStations);
    return (
      <div dir="rtl" className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-extrabold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>تم تفعيل حسابك وحفظ كلمة المرور بنجاح</span>
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-950">
              أهلاً بك، {activatedStaff.name}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
              حسابك في <strong>{restaurant.name}</strong> أصبح جاهزاً ({STAFF_ROLE_META[activatedStaff.role]?.labelAr}). يمكنك الآن تثبيت التطبيق على جهازك أو البدء مباشرة.
            </p>
          </div>

          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-start space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">اسم المستخدم للدخول لاحقاً:</span>
              <strong className="font-mono-num text-zinc-950" dir="ltr">@{activatedStaff.username}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">رقم الهاتف المسجل:</span>
              <strong className="font-mono-num text-zinc-950" dir="ltr">{activatedStaff.phone}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">الشاشة الافتراضية:</span>
              <strong className="text-indigo-700">{defaultMeta?.labelAr || activatedStaff.defaultScreen}</strong>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <PWAInstallButton variant="primary" className="w-full min-h-[46px]" />

            <button
              type="button"
              onClick={() => onNavigate(`/staff/${restaurant.slug}`)}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>بدء العمل وفتح {defaultMeta?.shortAr || 'الشاشة'}</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (inviteStatus !== 'valid' || !invite || !restaurant) {
    const errorTitle =
      inviteStatus === 'used'
        ? 'تم استخدام رابط الدعوة هذا مسبقاً'
        : inviteStatus === 'expired'
          ? 'انتهت صلاحية رابط الدعوة (24 ساعة)'
          : inviteStatus === 'revoked'
            ? 'تم إلغاء رابط الدعوة من قِبل الإدارة'
            : 'رابط الدعوة غير صالح أو غير موجود';
    const errorDesc =
      inviteStatus === 'used'
        ? 'هذا الرابط صالح للاستخدام مرة واحدة فقط وقد تم تفعيله بالفعل. يمكنك تسجيل الدخول مباشرة بكلمة المرور التي قمت بتعيينها.'
        : 'لأسباب أمنية، تواصل مع مدير المطعم أو المالك لإصدار بطاقة دعوة QR جديدة.';

    return (
      <div dir="rtl" className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 shadow-lg text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-extrabold text-zinc-950">{errorTitle}</h1>
            <p className="text-xs text-zinc-600 leading-relaxed">{errorDesc}</p>
          </div>
          {restaurant && (
            <button
              type="button"
              onClick={() => onNavigate(`/staff/${restaurant.slug}`)}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold cursor-pointer"
            >
              الانتقال إلى صفحة دخول الكادر (/staff/{restaurant.slug})
            </button>
          )}
        </div>
      </div>
    );
  }

  const roleMeta = STAFF_ROLE_META[invite.staffRole] || STAFF_ROLE_META.cashier;

  return (
    <div dir="rtl" className="min-h-screen bg-[#F5F6F8] py-6 px-4 flex flex-col items-center justify-center">
      <div className="max-w-xl w-full space-y-4">
        <div className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-extrabold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>تفعيل حساب كادر لمرة واحدة</span>
              </span>
              <h1 className="text-lg sm:text-xl font-extrabold text-zinc-950 pt-1">
                {restaurant.name}
              </h1>
            </div>
            <PWAInstallButton variant="compact" />
          </div>

          {/* Assigned Role & Screens Preview */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-zinc-500">الوظيفة المخصّصة:</span>
              <span className={`px-2.5 py-0.5 rounded-md border font-extrabold ${roleMeta.badgeClass}`}>
                {roleMeta.labelAr}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-zinc-500">اسم المستخدم:</span>
              <strong className="font-mono-num text-zinc-950" dir="ltr">@{invite.staffUsername}</strong>
            </div>
            <div className="space-y-1 pt-1">
              <span className="font-bold text-zinc-500 block">الشاشات المصرح بها:</span>
              <div className="flex flex-wrap gap-1.5">
                {invite.allowedScreens.map((scr) => (
                  <span
                    key={scr}
                    className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${
                      scr === invite.defaultScreen
                        ? 'bg-zinc-950 text-white border-zinc-950'
                        : 'bg-white text-zinc-700 border-zinc-200'
                    }`}
                  >
                    {getScreenMetaDynamic(scr, effectiveStations).shortAr}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {submitError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password setup (Mandatory 2x) */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs sm:text-sm font-extrabold text-zinc-950 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-amber-700" />
                  <span>تعيين كلمة المرور الخاصة بك *</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="text-[11px] font-bold text-zinc-600 hover:text-zinc-950 inline-flex items-center gap-1 cursor-pointer"
                >
                  {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPw ? 'إخفاء' : 'إظهار'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1 text-xs font-bold text-zinc-800">
                  <span>كلمة المرور الجديدة *</span>
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    dir="ltr"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="8+ أحرف وأرقام"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </label>

                <label className="space-y-1 text-xs font-bold text-zinc-800">
                  <span>تأكيد كلمة المرور *</span>
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    dir="ltr"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد كتابة كلمة المرور"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </label>
              </div>

              {passwordCheck && !passwordCheck.valid && (
                <p className="text-[11px] font-bold text-rose-700">{passwordCheck.error}</p>
              )}
              {passwordCheck && passwordCheck.valid && confirmPassword && (
                <p className="text-[11px] font-bold text-emerald-700">
                  ✓ كلمة المرور قوية ومتطابقة وجاهزة للحفظ.
                </p>
              )}
            </div>

            {/* Profile Completion Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-xs font-bold text-zinc-800">
                <span>الاسم الكامل *</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </label>

              <label className="space-y-1 text-xs font-bold text-zinc-800">
                <span>رقم الهاتف *</span>
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </label>

              <label className="space-y-1 text-xs font-bold text-zinc-800">
                <span>البريد الإلكتروني (اختياري للاستعادة)</span>
                <input
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </label>

              <label className="space-y-1 text-xs font-bold text-zinc-800">
                <span>المسمى الوظيفي</span>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="مثال: كاشير شيفت صباحي"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </label>

              {halls.length > 0 && (
                <label className="space-y-1 text-xs font-bold text-zinc-800 sm:col-span-2">
                  <span>الصالة المسندة</span>
                  <select
                    value={hallId}
                    onChange={(e) => setHallId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <option value="">كل الصالات / غير محدد</option>
                    {halls.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري تفعيل الحساب...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>حفظ وبدء العمل</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
