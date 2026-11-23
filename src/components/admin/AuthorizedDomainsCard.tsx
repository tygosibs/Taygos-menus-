import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Restaurant, StaffActorInfo, StaffAuditLog } from '../../types/menu';
import { writeStaffAuditLog } from '../../lib/firestoreService';
import { useLanguage } from '../../contexts/LanguageContext';

interface AuthorizedDomainsCardProps {
  restaurant: Restaurant;
  actor: StaffActorInfo;
  auditLogs?: StaffAuditLog[];
}

const KNOWN_PRODUCTION_DOMAINS = ['suofra.vercel.app'];

export const AuthorizedDomainsCard: React.FC<AuthorizedDomainsCardProps> = ({
  restaurant,
  actor,
  auditLogs = [],
}) => {
  const { lang, dir } = useLanguage();
  const isEn = lang === 'en';
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const currentHost =
    typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const isDevLocal =
    currentHost === 'localhost' ||
    currentHost === '127.0.0.1' ||
    currentHost.endsWith('.local');
  const isVercelProd = currentHost === 'suofra.vercel.app';
  const isRunApp = currentHost.endsWith('.run.app');

  const domainsToVerify = useMemo(() => {
    const list = new Set<string>(KNOWN_PRODUCTION_DOMAINS);
    if (currentHost && !isDevLocal) {
      list.add(currentHost);
    }
    return Array.from(list);
  }, [currentHost, isDevLocal]);

  const lastDomainLog = useMemo(
    () => auditLogs.find((l) => l.eventType === 'domain_verified') || null,
    [auditLogs]
  );

  // Strictly Owner-only component — never visible to guests or staff members
  if (actor.role !== 'owner') {
    return null;
  }

  const handleCopy = async (domain: string) => {
    try {
      await navigator.clipboard.writeText(domain);
      setCopiedDomain(domain);
      window.setTimeout(() => setCopiedDomain(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleVerifyAndAuditDomain = async () => {
    if (!currentHost) return;
    setVerifying(true);
    setStatusMessage('');
    try {
      await writeStaffAuditLog({
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        eventType: 'domain_verified',
        actor,
        screen: 'staff_management',
        details: `تم فحص وتوثيق الدومين النشط: ${currentHost} (${
          isDevLocal ? 'بيئة تطوير محلية فقط' : 'نطاق تشغيل معتمد'
        })`,
      });
      setStatusMessage(
        isEn
          ? `Domain "${currentHost}" recorded in the audit log.`
          : `تم توثيق النطاق "${currentHost}" في سجل المراجعة بنجاح.`
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      className="rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50/60 via-white to-white p-5 shadow-xs"
      dir={dir}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-600" />
            <h4 className="text-sm font-extrabold text-zinc-900">
              {isEn
                ? 'Authorized Domains for Firebase Authentication (Owner Only)'
                : 'النطاقات المعتمدة لتسجيل الدخول (للمالك فقط)'}
            </h4>
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
              {isEn ? 'Free Spark Plan (No Billing)' : 'الخطة المجانية بدون فوتره'}
            </span>
          </div>
          <p className="max-w-3xl text-xs leading-relaxed text-zinc-600">
            {isEn ? (
              <>
                To ensure smooth staff and owner sign-in, your deployment domain (
                <span className="font-mono font-bold text-zinc-900">suofra.vercel.app</span> and any
                active preview domain) must be listed under{' '}
                <span className="font-bold">Authorized domains</span> in Firebase Console.
              </>
            ) : (
              <>
                لضمان تسجيل دخول الموظفين والمالك بسلاسة دون رفض الطلبات، يجب أن يكون نطاق النشر (
                <span className="font-mono font-bold text-zinc-900" dir="ltr">
                  suofra.vercel.app
                </span>{' '}
                وأي نطاق معاينة نشط) مدرجاً داخل النطاقات المعتمدة في إعدادات المصادقة.
              </>
            )}
          </p>
        </div>

        <a
          href="https://console.firebase.google.com/project/gen-lang-client-0179420211/authentication/settings"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-white px-3.5 py-2 text-xs font-extrabold text-indigo-700 hover:bg-indigo-50"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {isEn ? 'Open Firebase Auth Settings' : 'فتح إعدادات المصادقة'}
        </a>
      </div>

      {/* Domain List & Audit */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {domainsToVerify.map((dom) => {
          const isCurrent = dom === currentHost;
          return (
            <div
              key={dom}
              className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="truncate font-mono text-xs font-extrabold text-zinc-900" dir="ltr">
                    {dom}
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] font-bold text-zinc-500">
                  {dom === 'suofra.vercel.app'
                    ? isEn
                      ? 'Primary Production Domain'
                      : 'النطاق الرئيسي للإنتاج'
                    : isRunApp
                      ? isEn
                        ? 'Auto Preview Domain'
                        : 'نطاق المعاينة التلقائي'
                      : isCurrent
                        ? isEn
                          ? 'Currently Active Domain'
                          : 'النطاق المفتوح حالياً'
                        : isEn
                          ? 'Added Domain'
                          : 'نطاق مضاف'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(dom)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
              >
                {copiedDomain === dom ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    {isEn ? 'Copied' : 'تم النسخ'}
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    {isEn ? 'Copy' : 'نسخ'}
                  </>
                )}
              </button>
            </div>
          );
        })}

        {isDevLocal && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5">
            <div>
              <div className="font-mono text-xs font-extrabold text-amber-900" dir="ltr">
                {currentHost}
              </div>
              <div className="text-[10px] font-bold text-amber-800">
                {isEn
                  ? 'Local development mode only — not for public production'
                  : 'وضع التطوير المحلي فقط — لا يُعتمد كبيئة إنتاج عامة'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Verification Action & Spark Free-Tier explanation */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-indigo-100 pt-3">
        <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-600">
          <Sparkles className="h-4 w-4 shrink-0 text-indigo-500" />
          <span>
            {isEn
              ? 'Cost-saving note: Automated Cloud IAM domain provisioning is disabled to keep your account on the free tier. Copy the domain above and add it once via the link.'
              : 'ملاحظة التوفير: إضافة النطاق آلياً محجوبة لحماية الحساب على الباقة المجانية دون فوتره؛ يكتفي المالك بنسخ النطاق أعلاه وإضافته مرة واحدة فقط من الرابط.'}
          </span>
        </div>

        <button
          type="button"
          disabled={verifying}
          onClick={handleVerifyAndAuditDomain}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
        >
          <ShieldCheck className="h-4 w-4" />
          {isVercelProd
            ? isEn
              ? 'Verify Primary Domain Now'
              : 'توثيق النطاق الرئيسي الآن'
            : isEn
              ? 'Check & Verify Current Domain'
              : 'فحص وتوثيق النطاق الحالي'}
        </button>
      </div>

      {statusMessage && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
          {statusMessage}
        </div>
      )}

      {lastDomainLog && !statusMessage && (
        <div className="mt-2 text-[11px] font-bold text-zinc-500">
          {isEn ? 'Last recorded check:' : 'آخر توثيق مسجل:'} {lastDomainLog.details}
        </div>
      )}
    </div>
  );
};
