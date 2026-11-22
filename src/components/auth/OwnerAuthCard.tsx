import { FormEvent, useState } from 'react';
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
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { AppLang } from '../../data/translations';
import { auth, googleAuthProvider } from '../../lib/firebase';
import { ensureUserProfile } from '../../lib/firestoreService';

interface OwnerAuthCardProps {
  onSuccess?: (user?: User) => void;
  compact?: boolean;
}

type AuthMode = 'login' | 'register';

function mapFirebaseAuthError(
  err: unknown,
  lang: AppLang
): { message: string; isProviderDisabled?: boolean; isDomainError?: boolean } {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
  const isEn = lang === 'en';
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'suofra.vercel.app';

  switch (code) {
    case 'auth/operation-not-allowed':
      return {
        isProviderDisabled: true,
        message: isEn
          ? 'Email/Password sign-in is not currently enabled in Firebase Console. Enable it under Authentication → Sign-in method, or use Continue with Google below.'
          : 'تسجيل الدخول بالبريد الإلكتروني وكلمة المرور غير مفعّل حالياً في مشروع Firebase. يرجى تفعيله من Firebase Console ← Authentication ← Sign-in method ← Email/Password، أو استخدام زر الدخول عبر Google أدناه.',
      };
    case 'auth/unauthorized-domain':
      return {
        isDomainError: true,
        message: isEn
          ? `Domain "${currentHost}" is not yet added to Firebase Authorized Domains. Add it in Firebase Console → Authentication → Settings → Authorized domains.`
          : `النطاق "${currentHost}" غير مضاف بعد إلى النطاقات المصرح بها في Firebase. يرجى إضافته من Firebase Console ← Authentication ← Settings ← Authorized domains.`,
      };
    case 'auth/popup-blocked':
      return {
        message: isEn
          ? 'Your browser blocked the Google sign-in popup. Please allow popups for this site or sign in with email & password.'
          : 'قام المتصفح بحظر نافذة تسجيل الدخول عبر Google. يرجى السماح بالنوافذ المنبثقة لهذا الموقع أو تسجيل الدخول بالبريد الإلكتروني.',
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
    default:
      return {
        message:
          err instanceof Error && err.message
            ? err.message
            : isEn
              ? 'Authentication error occurred. Please check your connection and try again.'
              : 'حدث خطأ أثناء المصادقة. تأكد من الاتصال بالإنترنت وحاول مجدداً.',
      };
  }
}

export function OwnerAuthCard({ onSuccess, compact = false }: OwnerAuthCardProps) {
  const { lang, dir, t } = useLanguage();
  const isEn = lang === 'en';
  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<{
    message: string;
    isProviderDisabled?: boolean;
    isDomainError?: boolean;
  } | null>(null);

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
        await updateProfile(cred.user, { displayName });
        await ensureUserProfile(cred.user.uid, cleanEmail, displayName);
        signedInUser = cred.user;
      } else {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        await ensureUserProfile(
          cred.user.uid,
          cred.user.email || cleanEmail,
          cred.user.displayName || (isEn ? 'Restaurant Owner' : 'صاحب مطعم')
        );
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
      );
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

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'suofra.vercel.app';

  return (
    <div
      dir={dir}
      className={`bg-white border border-zinc-200 rounded-2xl shadow-sm ${
        compact ? 'p-6' : 'p-7 sm:p-8'
      } space-y-5`}
    >
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

        <h2 className="text-xl font-extrabold text-zinc-950 pt-2">
          {mode === 'login' ? t.auth.ownerLoginHeading : t.auth.ownerRegisterHeading}
        </h2>
        <p className="text-xs text-zinc-600 leading-relaxed">{t.auth.ownerHeadingDesc}</p>
        <p className="text-[11px] font-semibold text-emerald-700 pt-0.5">
          {isEn
            ? 'Open for all restaurant & cafe owners — register and build your menu in 2 steps.'
            : 'التسجيل متاح لجميع أصحاب المطاعم والكافيهات — أنشئ مطعمك واختر الثيم في خطوتين.'}
        </p>
      </div>

      {resetMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <p className="font-medium leading-relaxed">{resetMessage}</p>
        </div>
      )}

      {errorInfo && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-1.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <p className="leading-relaxed font-medium">{errorInfo.message}</p>
          </div>
          {errorInfo.isProviderDisabled && (
            <p className="text-[11px] text-red-700 font-mono-num ps-6" dir="ltr">
              Project: gen-lang-client-0179420211 → Authentication → Sign-in method → Email/Password
            </p>
          )}
          {errorInfo.isDomainError && (
            <p className="text-[11px] text-red-700 font-mono-num ps-6" dir="ltr">
              Authorized domains: add "{currentHost}" &amp; "suofra.vercel.app"
            </p>
          )}
        </div>
      )}

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

      <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
        {isEn
          ? 'Each restaurant workspace is strictly isolated and protected by Firestore security rules.'
          : 'بيانات كل مطعم معزولة بالكامل ومرتبطة بحساب مالكه عبر قواعد أمان Firestore.'}
      </p>
    </div>
  );
}
