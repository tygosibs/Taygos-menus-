import { FormEvent, useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Hash,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { AppLang } from '../../data/translations';
import {
  FACILITY_ACTIVITY_OPTIONS,
  FacilityPrefix,
  normalizeFacilityPrefix,
  normalizeFacilitySerial,
  parseFacilityCode,
} from '../../lib/facilityCodeUtils';
import { auth, formatFirestoreErrorMessage, googleAuthProvider } from '../../lib/firebase';
import { ensureUserProfile, resolveRestaurantByFacilityCode } from '../../lib/firestoreService';
import { loginStaffMember } from '../../lib/staffService';
import { FacilityCodeRecord, Restaurant } from '../../types/menu';
import { SafeImage } from '../SafeImage';

interface OwnerAuthCardProps {
  onSuccess?: (user?: User) => void;
  onStaffNavigate?: (slug: string) => void;
  compact?: boolean;
  defaultPortal?: 'owner' | 'staff';
  initialFacilityCode?: string;
}

type AuthPortalTab = 'owner' | 'staff';
type AuthMode = 'login' | 'register';

function mapFirebaseAuthError(
  err: unknown,
  lang: AppLang
): { message: string; isProviderDisabled?: boolean; isDomainError?: boolean; diagnosticHint?: string } {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
  const rawMsg = err instanceof Error ? err.message : String(err || '');
  const isEn = lang === 'en';
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'suofra.vercel.app';

  if (
    code.toLowerCase().includes('api-key-expired') ||
    rawMsg.toLowerCase().includes('api-key-expired') ||
    rawMsg.toLowerCase().includes('api key expired')
  ) {
    return {
      diagnosticHint:
        'Google Cloud Console → Project gen-lang-client-0179420211 → APIs & Services → Credentials → Renew/Create Browser API Key',
      message: isEn
        ? 'The Firebase Web API Key for project gen-lang-client-0179420211 has expired. Renew or recreate the Browser API Key in Google Cloud Console Credentials.'
        : 'انتهت صلاحية مفتاح Firebase API الخاص بالمشروع (gen-lang-client-0179420211). يرجى تجديده أو إنشاء مفتاح جديد من Google Cloud Console ← APIs & Services ← Credentials.',
    };
  }

  switch (code) {
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return {
        isProviderDisabled: true,
        diagnosticHint:
          'Firebase Console → Project gen-lang-client-0179420211 → Authentication → Sign-in method → Enable Email/Password & Google',
        message: isEn
          ? 'Sign-in provider is not configured or enabled in Firebase Authentication Console yet. Enable Email/Password and Google under Authentication → Sign-in method.'
          : 'مزوّد تسجيل الدخول غير مفعّل حالياً في Firebase Authentication Console. يرجى فتح Authentication ← Sign-in method وتفعيل Email/Password و Google.',
      };
    case 'auth/admin-restricted-operation':
      return {
        isProviderDisabled: true,
        diagnosticHint:
          'Firebase Console → Authentication → Settings → User actions → Enable Create (sign-up)',
        message: isEn
          ? 'New account creation is currently restricted in Firebase Authentication Settings.'
          : 'إنشاء الحسابات الجديدة مقيد حالياً من إعدادات Firebase Authentication Console.',
      };
    case 'auth/invalid-api-key':
      return {
        diagnosticHint: 'Check firebase-applet-config.json API key & Google Cloud API Key restrictions',
        message: isEn
          ? 'Firebase API Key was rejected or restricted in Google Cloud Console.'
          : 'مفتاح Firebase API مرفوض أو مقيّد في إعدادات Google Cloud Console.',
      };
    case 'auth/unauthorized-domain':
      return {
        isDomainError: true,
        message: isEn
          ? `Domain "${currentHost}" is not yet added to Firebase Authorized Domains. Copy it below and add it in Firebase Console → Authentication → Settings → Authorized domains.`
          : `النطاق "${currentHost}" غير مضاف بعد إلى النطاقات المصرح بها في Firebase. انسخ النطاق وأضفه في Firebase Console ← Authentication ← Settings ← Authorized domains.`,
      };
    case 'auth/account-exists-with-different-credential':
      return {
        message: isEn
          ? 'An account already exists with this email using another sign-in method (e.g., Google vs Email/Password).'
          : 'يوجد حساب بالفعل بنفس البريد الإلكتروني بطريقة دخول أخرى (جرب الدخول عبر Google أو البريد وكلمة المرور).',
      };
    case 'auth/user-disabled':
      return {
        message: isEn
          ? 'This user account has been disabled in Firebase Authentication.'
          : 'تم تعطيل هذا الحساب مؤقتاً من لوحة Firebase Authentication.',
      };
    case 'auth/popup-blocked':
      return {
        message: isEn
          ? 'Your browser blocked the Google sign-in popup. Allow popups for this site or use Email & Password.'
          : 'قام المتصفح بحظر نافذة تسجيل الدخول عبر Google. يرجى السماح بالنوافذ المنبثقة أو استخدام البريد وكلمة المرور.',
      };
    case 'auth/cancelled-popup-request':
    case 'auth/popup-closed-by-user':
      return {
        message: isEn
          ? 'Sign-in window was closed before completing. Please try again.'
          : 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية. يمكنك المحاولة مرة أخرى.',
      };
    case 'auth/email-already-in-use':
      return {
        message: isEn
          ? 'This email is already registered. Try signing in instead.'
          : 'هذا البريد الإلكتروني مسجّل بالفعل. جرّب تسجيل الدخول بدلاً من ذلك.',
      };
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return {
        message: isEn
          ? 'Incorrect email or password.'
          : 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      };
    case 'auth/weak-password':
      return {
        message: isEn
          ? 'Password must be at least 6 characters.'
          : 'كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.',
      };
    case 'auth/invalid-email':
      return {
        message: isEn ? 'Invalid email address format.' : 'صيغة البريد الإلكتروني غير صحيحة.',
      };
    case 'auth/too-many-requests':
      return {
        message: isEn
          ? 'Too many attempts. Please wait a moment and try again.'
          : 'تم إجراء محاولات متكررة. انتظر قليلاً ثم أعد المحاولة.',
      };
    case 'auth/network-request-failed':
      return {
        message: isEn
          ? 'Network error while connecting to Firebase Auth. Check your internet connection or VPN/firewall and retry.'
          : 'تعذر الاتصال بخادم المصادقة Firebase. تأكد من الاتصال بالإنترنت وأعد المحاولة.',
      };
    case 'auth/internal-error':
      return {
        diagnosticHint: 'Check Firebase App Check / Identity Toolkit API / Authorized Domains',
        message: isEn
          ? 'Firebase Auth returned an internal error. Verify Authorized Domains and App Check enforcement in Firebase Console.'
          : 'حدث خطأ داخلي في مصادقة Firebase. تحقق من تفعيل مزودي الدخول والنطاقات المصرح بها أو App Check في Firebase Console.',
      };
    default:
      return {
        message: formatFirestoreErrorMessage(err, isEn),
      };
  }
}

export function OwnerAuthCard({
  onSuccess,
  onStaffNavigate,
  compact = false,
  defaultPortal = 'owner',
  initialFacilityCode = '',
}: OwnerAuthCardProps) {
  const { lang, dir, t, loc } = useLanguage();
  const isEn = lang === 'en';

  const parsedInitial = parseFacilityCode(initialFacilityCode);

  const [portalTab, setPortalTab] = useState<AuthPortalTab>(defaultPortal);
  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{
    message: string;
    isProviderDisabled?: boolean;
    isDomainError?: boolean;
    diagnosticHint?: string;
  } | null>(null);

  // Staff Facility Code Login State
  const [facilityPrefix, setFacilityPrefix] = useState<FacilityPrefix>(
    parsedInitial.prefix || 'RE'
  );
  const [facilitySerial, setFacilitySerial] = useState<string>(parsedInitial.serial || '');
  const [lookingUpFacility, setLookingUpFacility] = useState(false);
  const [matchedFacility, setMatchedFacility] = useState<{
    restaurant: Restaurant;
    record: FacilityCodeRecord;
  } | null>(null);
  const [staffIdentifier, setStaffIdentifier] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffSubmitting, setStaffSubmitting] = useState(false);

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'suofra.vercel.app';

  useEffect(() => {
    if (!initialFacilityCode.trim()) return;
    const p = parseFacilityCode(initialFacilityCode);
    if (p.prefix) setFacilityPrefix(p.prefix);
    if (p.serial) setFacilitySerial(p.serial);
  }, [initialFacilityCode]);

  const handleCopyCurrentHost = async () => {
    try {
      await navigator.clipboard.writeText(currentHost);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorInfo(null);
    setResetMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorInfo({
        message: isEn
          ? 'Please enter your email and password.'
          : 'يرجى إدخال البريد الإلكتروني وكلمة المرور.',
      });
      return;
    }

    if (mode === 'register' && password.length < 6) {
      setErrorInfo({ message: t.auth.errWeakPass });
      return;
    }

    setLoading(true);
    try {
      let signedInUser: User;
      if (mode === 'register') {
        const displayName =
          fullName.trim() || cleanEmail.split('@')[0] || (isEn ? 'Restaurant Owner' : 'صاحب مطعم');
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(cred.user, { displayName }).catch((err) =>
          console.warn('Profile displayName update skipped:', err)
        );
        // Non-blocking profile sync so Firestore hiccup never blocks signed-in workspace navigation
        await ensureUserProfile(cred.user.uid, cleanEmail, displayName).catch((err) =>
          console.warn('Non-blocking ensureUserProfile warning:', err)
        );
        signedInUser = cred.user;
      } else {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        await ensureUserProfile(
          cred.user.uid,
          cred.user.email || cleanEmail,
          cred.user.displayName || (isEn ? 'Restaurant Owner' : 'صاحب مطعم')
        ).catch((err) => console.warn('Non-blocking ensureUserProfile warning:', err));
        signedInUser = cred.user;
      }
      onSuccess?.(signedInUser);
    } catch (err) {
      setErrorInfo(mapFirebaseAuthError(err, lang));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorInfo(null);
    setResetMessage(null);
    setGoogleLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      await ensureUserProfile(
        cred.user.uid,
        cred.user.email || '',
        cred.user.displayName || (isEn ? 'Restaurant Owner' : 'صاحب مطعم')
      ).catch((err) => console.warn('Non-blocking ensureUserProfile warning:', err));
      onSuccess?.(cred.user);
    } catch (err) {
      setErrorInfo(mapFirebaseAuthError(err, lang));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorInfo(null);
    setResetMessage(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorInfo({ message: t.auth.enterEmailFirst });
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setResetMessage(t.auth.resetSent);
    } catch (err) {
      setErrorInfo(mapFirebaseAuthError(err, lang));
    } finally {
      setResetLoading(false);
    }
  };

  const handleFacilitySerialChange = (rawVal: string) => {
    setErrorInfo(null);
    const parsed = parseFacilityCode(rawVal);
    if (parsed.prefix && parsed.serial) {
      setFacilityPrefix(parsed.prefix);
      setFacilitySerial(parsed.serial);
      setMatchedFacility(null);
      return;
    }
    setFacilitySerial(normalizeFacilitySerial(rawVal));
    setMatchedFacility(null);
  };

  const handleLookupFacility = async (): Promise<{
    restaurant: Restaurant;
    record: FacilityCodeRecord;
  } | null> => {
    setErrorInfo(null);
    setLookingUpFacility(true);
    try {
      const res = await resolveRestaurantByFacilityCode(facilityPrefix, facilitySerial);
      setMatchedFacility(res);
      return res;
    } catch (err) {
      setMatchedFacility(null);
      setErrorInfo({ message: formatFirestoreErrorMessage(err, isEn) });
      return null;
    } finally {
      setLookingUpFacility(false);
    }
  };

  const handleStaffLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorInfo(null);
    setResetMessage(null);

    if (!staffIdentifier.trim() || !staffPassword) {
      setErrorInfo({
        message: isEn
          ? 'Please enter your username/phone/email and password.'
          : 'يرجى إدخال اسم المستخدم أو رقم الهاتف أو البريد وكلمة المرور.',
      });
      return;
    }

    setStaffSubmitting(true);
    try {
      let target = matchedFacility;
      if (!target) {
        target = await handleLookupFacility();
      }
      if (!target) {
        return;
      }

      await loginStaffMember({
        restaurant: target.restaurant,
        rawIdentifier: staffIdentifier,
        password: staffPassword,
      });

      if (onStaffNavigate) {
        onStaffNavigate(target.restaurant.slug);
      } else if (typeof window !== 'undefined') {
        window.location.assign(`/staff/${target.restaurant.slug}`);
      }
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code.startsWith('auth/')) {
        setErrorInfo(mapFirebaseAuthError(err, lang));
      } else {
        setErrorInfo({ message: formatFirestoreErrorMessage(err, isEn) });
      }
    } finally {
      setStaffSubmitting(false);
    }
  };

  const matchedDisplayName = matchedFacility
    ? loc(matchedFacility.restaurant.name, matchedFacility.restaurant.name_en)
    : '';

  return (
    <div
      dir={dir}
      className={`bg-white border border-zinc-200 rounded-2xl shadow-sm ${
        compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8'
      } space-y-5`}
    >
      {/* Dual Portal Switcher: Owner/Management vs Staff Facility Code */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-zinc-100 border border-zinc-200">
        <button
          type="button"
          onClick={() => {
            setPortalTab('owner');
            setErrorInfo(null);
            setResetMessage(null);
          }}
          className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            portalTab === 'owner'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span className="truncate">{isEn ? 'Owners & Admins' : 'الملاك والإدارة'}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setPortalTab('staff');
            setErrorInfo(null);
            setResetMessage(null);
          }}
          className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            portalTab === 'staff'
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span className="truncate">{isEn ? 'Staff Portal Code' : 'دخول الموظفين بالكود'}</span>
        </button>
      </div>

      {resetMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <p className="font-medium leading-relaxed">{resetMessage}</p>
        </div>
      )}

      {errorInfo && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <p className="leading-relaxed font-medium">{errorInfo.message}</p>
          </div>
          {errorInfo.isProviderDisabled && (
            <p className="text-[11px] text-red-700 font-mono-num ps-6 break-all" dir="ltr">
              {errorInfo.diagnosticHint ||
                'Project: gen-lang-client-0179420211 → Authentication → Sign-in method → Email/Password & Google'}
            </p>
          )}
          {!errorInfo.isProviderDisabled && errorInfo.diagnosticHint && (
            <p className="text-[11px] text-red-700 font-mono-num ps-6 break-all" dir="ltr">
              {errorInfo.diagnosticHint}
            </p>
          )}
          {errorInfo.isDomainError && (
            <div className="ps-6 flex flex-wrap items-center gap-2" dir="ltr">
              <code className="px-2 py-1 rounded-md bg-white border border-red-200 text-[11px] font-mono-num text-red-900">
                {currentHost}
              </code>
              <button
                type="button"
                onClick={handleCopyCurrentHost}
                className="px-2.5 py-1 rounded-lg bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedDomain ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedDomain ? (isEn ? 'Copied' : 'تم النسخ') : isEn ? 'Copy Domain' : 'نسخ النطاق'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {portalTab === 'owner' ? (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="inline-flex p-1 rounded-xl bg-zinc-100 border border-zinc-200">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorInfo(null);
                    setResetMessage(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white text-zinc-950 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {t.auth.loginTab}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorInfo(null);
                    setResetMessage(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white text-zinc-950 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {t.auth.registerTab}
                </button>
              </div>
            </div>

            <h2 className="text-xl font-extrabold text-zinc-950 pt-1">
              {mode === 'login' ? t.auth.ownerLoginHeading : t.auth.ownerRegisterHeading}
            </h2>
            <p className="text-xs text-zinc-600 leading-relaxed">{t.auth.ownerHeadingDesc}</p>
            <p className="text-[11px] font-semibold text-emerald-700 pt-0.5">
              {isEn
                ? 'Open for all restaurant & hospitality owners — register and launch your workspace in 2 steps.'
                : 'التسجيل متاح لجميع أصحاب المطاعم والمنشآت — أنشئ منشأتك واختر الثيم في خطوتين.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  {t.auth.fullNameLabel}
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t.auth.fullNamePlaceholder}
                    className="w-full ps-10 pe-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-zinc-950"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                {t.auth.emailLabel}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  dir="ltr"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@restaurant.com"
                  className="w-full ps-10 pe-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm font-mono-num text-left focus:outline-none focus:border-zinc-950"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-bold text-zinc-700">{t.auth.passwordLabel}</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    disabled={resetLoading}
                    onClick={handleForgotPassword}
                    className="text-[11px] font-bold text-zinc-600 hover:text-zinc-950 hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {resetLoading ? '...' : t.auth.forgotPassword}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  dir="ltr"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full ps-10 pe-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm font-mono-num text-left focus:outline-none focus:border-zinc-950"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3 px-4 rounded-xl bg-zinc-950 text-white text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {mode === 'login'
                      ? isEn
                        ? 'Signing in...'
                        : 'جاري تسجيل الدخول...'
                      : isEn
                        ? 'Creating account...'
                        : 'جاري إنشاء الحساب...'}
                  </span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>{mode === 'login' ? t.auth.loginBtn : t.auth.registerBtn}</span>
                </>
              )}
            </button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-1 border-t border-zinc-200" />
            <span className="px-3 text-[11px] font-semibold text-zinc-400">{isEn ? 'OR' : 'أو'}</span>
            <div className="flex-1 border-t border-zinc-200" />
          </div>

          <button
            type="button"
            disabled={loading || googleLoading}
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 px-4 rounded-xl border border-zinc-300 bg-white text-zinc-800 text-xs font-bold hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {googleLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isEn ? 'Connecting to Google...' : 'جاري الاتصال بحساب Google...'}</span>
              </>
            ) : (
              <span>{isEn ? 'Continue with Google' : 'المتابعة بحساب Google'}</span>
            )}
          </button>
        </>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-700 text-white flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-zinc-950">
                  {isEn ? 'Staff Sign-In by Facility Code' : 'دخول فريق العمل بكود المنشأة'}
                </h2>
                <p className="text-xs text-zinc-600">
                  {isEn
                    ? 'Select activity prefix and enter the 4-digit facility code provided by your manager.'
                    : 'اختر رمز النشاط وأدخل رقم كود المنشأة المكون من 4 أرقام أو الصقه كاملاً (مثل RE-1042).'}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleStaffLoginSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                {isEn ? '1. Facility Activity & Code' : '١. نوع النشاط وكود المنشأة'}
              </label>
              <div className="grid grid-cols-12 gap-2">
                <select
                  value={facilityPrefix}
                  onChange={(e) => {
                    setFacilityPrefix(normalizeFacilityPrefix(e.target.value));
                    setMatchedFacility(null);
                  }}
                  aria-label={isEn ? 'Facility Activity Prefix' : 'رمز نوع النشاط'}
                  className="col-span-6 px-2.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-xs font-bold text-zinc-900 focus:outline-none focus:border-indigo-600"
                >
                  {FACILITY_ACTIVITY_OPTIONS.map((opt) => (
                    <option key={opt.prefix} value={opt.prefix}>
                      {opt.prefix} — {isEn ? opt.labelEn : opt.labelAr}
                    </option>
                  ))}
                </select>
                <div className="col-span-6 flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Hash className="w-3.5 h-3.5 text-zinc-400 absolute start-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      dir="ltr"
                      inputMode="numeric"
                      value={facilitySerial}
                      onChange={(e) => handleFacilitySerialChange(e.target.value)}
                      placeholder="1042"
                      className="w-full ps-8 pe-2.5 py-2.5 rounded-xl border border-zinc-300 text-sm font-mono-num font-bold text-left focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={lookingUpFacility || facilitySerial.length < 4}
                    onClick={() => void handleLookupFacility()}
                    className="min-h-[42px] px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-xs font-extrabold shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {lookingUpFacility ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isEn ? (
                      'Verify'
                    ) : (
                      'تحقق'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {matchedFacility && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                {matchedFacility.restaurant.logoUrl ? (
                  <SafeImage
                    src={matchedFacility.restaurant.logoUrl}
                    alt={matchedDisplayName}
                    className="w-10 h-10 rounded-xl object-cover border border-emerald-300 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-emerald-700 font-mono-num" dir="ltr">
                    {matchedFacility.record.code} ✓
                  </p>
                  <p className="text-sm font-extrabold text-zinc-950 truncate">{matchedDisplayName}</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                {isEn ? '2. Username, Phone, or Email' : '٢. اسم المستخدم أو الهاتف أو البريد'}
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={staffIdentifier}
                  onChange={(e) => setStaffIdentifier(e.target.value)}
                  placeholder={isEn ? 'ahmed_cashier / 01012345678' : 'ahmed_cashier أو رقم الهاتف'}
                  className="w-full ps-10 pe-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm font-mono-num text-left focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                {t.auth.passwordLabel}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  dir="ltr"
                  required
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full ps-10 pe-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm font-mono-num text-left focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={staffSubmitting || lookingUpFacility}
              className="w-full py-3 px-4 rounded-xl bg-indigo-700 text-white text-sm font-extrabold hover:bg-indigo-800 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {staffSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isEn ? 'Opening Staff Portal...' : 'جاري فتح بوابة الموظف...'}</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>{isEn ? 'Sign In & Open My Screen' : 'دخول وفتح شاشتي'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
        {portalTab === 'staff'
          ? isEn
            ? 'Direct restaurant links (/staff/slug) also remain active alongside Facility Code login.'
            : 'روابط الدخول المباشرة (/staff/slug) لا تزال تعمل بالكامل بجانب الدخول بكود المنشأة.'
          : isEn
            ? 'Each restaurant workspace is strictly isolated and protected by Firestore security rules.'
            : 'بيانات كل مطعم معزولة بالكامل ومرتبطة بحساب مالكه عبر قواعد أمان Firestore.'}
      </p>
    </div>
  );
}
