import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  ArrowRight,
  Building2,
  Code2,
  LayoutTemplate,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { OwnerAuthCard } from '../components/auth/OwnerAuthCard';
import { LandingCmsTab } from '../components/superadmin/LandingCmsTab';
import { TenantsManagerTab } from '../components/superadmin/TenantsManagerTab';
import { ThemeInjectorTab } from '../components/superadmin/ThemeInjectorTab';
import { auth, isSuperAdminEmail } from '../lib/firebase';

interface SuperAdminPortalProps {
  onNavigate: (path: string) => void;
}

type SuperAdminTab = 'tenants' | 'themes' | 'landing';

export function SuperAdminPortal({ onNavigate }: SuperAdminPortalProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('tenants');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  if (!authReady) {
    return (
      <div dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-zinc-600">جاري التحقق من صلاحيات الإدارة العليا...</p>
        </div>
      </div>
    );
  }

  // Gate 1: Require login
  if (!user) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between p-6">
        <header className="max-w-5xl w-full mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-xl font-extrabold text-zinc-950 cursor-pointer flex items-center gap-2"
          >
            <span>سُفرة QR</span>
            <span className="text-xs font-bold text-amber-700">· الإدارة العليا</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-xs font-bold text-zinc-600 hover:text-zinc-950 flex items-center gap-1 cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>العودة للرئيسية</span>
          </button>
        </header>

        <main className="max-w-md w-full mx-auto my-8 space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>يرجى تسجيل الدخول بحساب المشرف العام للوصول إلى لوحة الإدارة العليا.</span>
          </div>
          <OwnerAuthCard />
        </main>

        <footer className="text-center text-xs text-zinc-400">
          منصة سُفرة QR · بوابة الإدارة العليا المحمية
        </footer>
      </div>
    );
  }

  // Gate 2: Strictly enforce tygosibs@gmail.com
  if (!isSuperAdminEmail(user.email)) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-zinc-950">غير مصرح بالدخول</h1>
          <p className="text-xs text-zinc-600 leading-relaxed">
            هذه اللوحة مخصصة لمدير المنصة فقط. الحساب المسجل حالياً (
            <span className="font-mono-num font-bold text-zinc-900" dir="ltr">
              {user.email}
            </span>
            ) لا يملك صلاحية الوصول إلى الإدارة العليا.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="px-4 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 cursor-pointer"
            >
              لوحة تحكم مطعمي
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              الصفحة الرئيسية
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="px-4 py-2.5 rounded-xl border border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-50 cursor-pointer"
            >
              تبديل الحساب
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems: { id: SuperAdminTab; label: string; icon: typeof Building2 }[] = [
    { id: 'tenants', label: 'إدارة المطاعم والمشتركين', icon: Building2 },
    { id: 'themes', label: 'إضافة وحقن ثيمات جديدة', icon: Code2 },
    { id: 'landing', label: 'التحكم في صفحة الهبوط', icon: LayoutTemplate },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-[#F5F6F8] text-zinc-900 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-68 bg-zinc-950 text-white shrink-0 flex flex-col justify-between">
        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-lg font-extrabold text-white cursor-pointer flex items-center gap-2"
            >
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <span>الإدارة العليا</span>
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              aria-label="تسجيل الخروج"
              className="lg:hidden p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
            <p className="text-[11px] font-bold text-amber-400">Super Admin</p>
            <p className="text-xs font-mono-num text-zinc-200 truncate" dir="ltr">
              {user.email}
            </p>
          </div>

          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-zinc-950'
                      : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:block p-5 border-t border-zinc-800 space-y-2">
          <button
            type="button"
            onClick={() => onNavigate('/admin')}
            className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-200 hover:bg-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Store className="w-3.5 h-3.5" />
            <span>لوحة تحكم مطعمي</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>عرض صفحة الهبوط</span>
          </button>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-zinc-400 hover:text-rose-400 hover:bg-zinc-900 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-zinc-200 px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="text-xs text-zinc-500 flex items-center gap-2">
            <span>سُفرة QR</span>
            <span>/</span>
            <span>لوحة الإدارة العليا</span>
            <span>/</span>
            <span className="font-bold text-zinc-900">
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="px-3.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-800 hover:bg-zinc-50 cursor-pointer"
          >
            صفحة الهبوط
          </button>
        </header>

        <main className="p-4 sm:p-6 max-w-6xl w-full mx-auto">
          {activeTab === 'tenants' && (
            <TenantsManagerTab onOpenPublicMenu={(path) => onNavigate(path)} />
          )}
          {activeTab === 'themes' && <ThemeInjectorTab />}
          {activeTab === 'landing' && <LandingCmsTab />}
        </main>
      </div>
    </div>
  );
}
