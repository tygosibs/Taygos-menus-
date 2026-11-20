import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __sufraDeferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => (typeof window !== 'undefined' ? window.__sufraDeferredPrompt ?? null : null)
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isStandaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches;
    const isIosStandalone = Boolean((window.navigator as { standalone?: boolean }).standalone);
    return Boolean(isStandaloneMedia || isIosStandalone);
  });
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = window.navigator.userAgent || '';
    const iosDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setIsIOS(iosDevice);

    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches;
      const isIosStandalone = Boolean((window.navigator as { standalone?: boolean }).standalone);
      if (isStandaloneMedia || isIosStandalone) {
        setIsInstalled(true);
      }
    };
    checkStandalone();

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const promptEvt = e as BeforeInstallPromptEvent;
      window.__sufraDeferredPrompt = promptEvt;
      setDeferredPrompt(promptEvt);
    };

    const handleAppInstalled = () => {
      window.__sufraDeferredPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'ios' | 'unavailable'> => {
    if (isInstalled) return 'accepted';
    const promptEvt = deferredPrompt || window.__sufraDeferredPrompt;
    if (promptEvt) {
      await promptEvt.prompt();
      const { outcome } = await promptEvt.userChoice;
      window.__sufraDeferredPrompt = null;
      setDeferredPrompt(null);
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      return outcome;
    }
    if (isIOS) return 'ios';
    return 'unavailable';
  }, [deferredPrompt, isIOS, isInstalled]);

  return {
    isInstalled,
    isIOS,
    hasNativePrompt: Boolean(deferredPrompt || (typeof window !== 'undefined' && window.__sufraDeferredPrompt)),
    canShowInstall: !isInstalled,
    promptInstall,
  };
}
