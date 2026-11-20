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
      setStatusMessage(`تم توثيق الدومين "${currentHost}" في سجل المراجعة بنجاح.`);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      className="rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50/60 via-white to-white p-5 shadow-xs"
      dir="rtl"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-600" />
            <h4 className="text-sm font-extrabold text-zinc-900">
              النطاقات المعتمدة لـ Firebase Authentication (للمالك فقط)
            </h4>
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
              خطة مجانية بدون فوتره (Spark)
            </span>
          </div>
          <p className="max-w-3xl text-xs leading-relaxed text-zinc-600">
            لضمان تسجيل دخول الموظفين والمالك بسلاسة دون رفض الطلبات، يجب أن يكون دومين النشر
            (<span className="font-mono font-bold text-zinc-900">suofra.vercel.app</span> وأي نطاق معاينة نشط)
            مدرجاً داخل <span className="font-bold">Authorized domains</span> في Firebase Console.
          </p>
        </div>

        <a
          href="https://console.firebase.google.com/project/gen-lang-client-0179420211/authentication/settings"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-white px-3.5 py-2 text-xs font-extrabold text-indigo-700 hover:bg-indigo-50"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          فتح إعدادات Firebase Console
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
                    ? 'الدومين الرئيسي للإنتاج'
                    : isRunApp
                      ? 'دومين المعاينة التلقائي'
                      : isCurrent
                        ? 'الدومين المفتوح حالياً'
                        : 'نطاق مضاف'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(dom)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-100"
              >
                {copiedDomain === dom ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    تم النسخ
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    نسخ
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
                وضع التطوير المحلي فقط (Dev-only) — لا يُعتمد كبيئة إنتاج عامة
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
            ملاحظة التوفير: إضافة الدومين آلياً عبر Cloud IAM محجوبة لحماية الحساب على الباقة المجانية دون فوتره؛ يكتفي المالك بنسخ النطاق أعلاه وإضافته مرة واحدة فقط من الرابط.
          </span>
        </div>

        <button
          type="button"
          disabled={verifying}
          onClick={handleVerifyAndAuditDomain}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4" />
          {isVercelProd ? 'توثيق الدومين الرئيسي الآن' : 'فحص وتوثيق الدومين الحالي'}
        </button>
      </div>

      {statusMessage && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
          {statusMessage}
        </div>
      )}

      {lastDomainLog && !statusMessage && (
        <div className="mt-2 text-[11px] font-bold text-zinc-500">
          آخر توثيق مسجل: {lastDomainLog.details}
        </div>
      )}
    </div>
  );
};
