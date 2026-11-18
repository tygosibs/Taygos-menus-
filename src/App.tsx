import { useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { testConnection } from './lib/firebase';
import { AdminPortal } from './pages/AdminPortal';
import { LandingPage } from './pages/LandingPage';
import { PublicMenuPage } from './pages/PublicMenuPage';
import { SuperAdminPortal } from './pages/SuperAdminPortal';

function getCurrentPath(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
}

export default function App() {
  const [pathname, setPathname] = useState<string>(() => getCurrentPath());

  useEffect(() => {
    testConnection();
    const handlePop = () => {
      setPathname(getCurrentPath());
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = useCallback((nextPath: string) => {
    const [cleanPath] = nextPath.split('?');
    if (window.location.pathname + window.location.search !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setPathname(cleanPath || '/');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const renderRoute = () => {
    if (pathname === '/super-admin' || pathname.startsWith('/super-admin/')) {
      return <SuperAdminPortal onNavigate={navigate} />;
    }

    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return <AdminPortal onNavigate={navigate} />;
    }

    if (pathname.startsWith('/menu/')) {
      const slug = decodeURIComponent(pathname.replace(/^\/menu\//, '').split('/')[0]);
      return <PublicMenuPage slug={slug} onNavigate={navigate} />;
    }

    return <LandingPage onNavigate={navigate} />;
  };

  return <ErrorBoundary>{renderRoute()}</ErrorBoundary>;
}
