import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported, onMessage, type MessagePayload } from 'firebase/messaging';
import { db } from './firebase';
import { getStationTopicName } from './stationUtils';

const DEVICE_ID_STORAGE_KEY = 'sufra_staff_device_id_v1';
const NOTIFICATION_ASKED_KEY = 'sufra_staff_notif_prompted_v1';
const FCM_SW_URL = '/firebase-messaging-sw.js';
const FCM_SW_SCOPE = '/firebase-cloud-messaging-push-scope';

let cachedSwRegistration: ServiceWorkerRegistration | null = null;
let foregroundListenerBound = false;

export function getOrCreateStaffDeviceId(): string {
  if (typeof window === 'undefined') return 'server_device';
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,80}$/.test(existing)) {
      return existing;
    }
    const generated = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `dev_${Date.now().toString(36)}`;
  }
}

export function detectDeviceMetadata(): { deviceName: string; platform: string } {
  if (typeof navigator === 'undefined') {
    return { deviceName: 'Web Browser', platform: 'web' };
  }
  const ua = navigator.userAgent || '';
  let platform = 'web';
  if (/Android/i.test(ua)) platform = 'android_pwa';
  else if (/iPhone|iPad|iPod/i.test(ua)) platform = 'ios_pwa';
  else if (/Windows/i.test(ua)) platform = 'windows_web';
  else if (/Mac/i.test(ua)) platform = 'mac_web';
  else if (/Linux/i.test(ua)) platform = 'linux_web';

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      Boolean((window.navigator as { standalone?: boolean }).standalone));

  const shortBrowser = /Edg/i.test(ua)
    ? 'Edge'
    : /Chrome/i.test(ua)
      ? 'Chrome'
      : /Safari/i.test(ua)
        ? 'Safari'
        : /Firefox/i.test(ua)
          ? 'Firefox'
          : 'Browser';

  return {
    deviceName: `${shortBrowser}${isStandalone ? ' (PWA)' : ''}`,
    platform,
  };
}

export function hasPromptedNotificationOnce(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(NOTIFICATION_ASKED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markNotificationPrompted(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NOTIFICATION_ASKED_KEY, '1');
  } catch {
    // ignore
  }
}

export async function ensureFcmServiceWorkerRegistered(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  if (cachedSwRegistration) return cachedSwRegistration;
  try {
    const reg = await navigator.serviceWorker.register(FCM_SW_URL, {
      scope: FCM_SW_SCOPE,
    });
    cachedSwRegistration = reg;
    return reg;
  } catch (err) {
    console.warn('FCM service worker registration failed:', err);
    return null;
  }
}

export interface DeviceRegistrationResult {
  deviceId: string;
  permission: NotificationPermission | 'unsupported';
  fcmToken: string;
  pushMode: 'fcm_live' | 'sw_background_local' | 'blocked';
}

export async function registerStaffDeviceAndFcm(params: {
  restaurantId: string;
  ownerId: string;
  staffId: string;
  staffName: string;
  activeStations: string[];
  requestPermissionNow?: boolean;
}): Promise<DeviceRegistrationResult> {
  const {
    restaurantId,
    ownerId,
    staffId,
    staffName,
    activeStations,
    requestPermissionNow = false,
  } = params;
  const deviceId = getOrCreateStaffDeviceId();
  const { deviceName, platform } = detectDeviceMetadata();
  const topics = activeStations.map((stId) => getStationTopicName(restaurantId, stId));

  let permission: NotificationPermission | 'unsupported' =
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported';

  if (permission === 'default' && requestPermissionNow) {
    markNotificationPrompted();
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = 'denied';
    }
  }

  let fcmToken = '';
  const swReg = await ensureFcmServiceWorkerRegistered();
  const vapidKey = (import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();

  if (permission === 'granted' && vapidKey && swReg) {
    try {
      const supported = await isSupported();
      if (supported) {
        const messaging = getMessaging();
        fcmToken = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: swReg,
        });
        if (!foregroundListenerBound) {
          foregroundListenerBound = true;
          onMessage(messaging, (payload: MessagePayload) => {
            const title = payload.notification?.title || payload.data?.title || 'سُفرة QR';
            const body = payload.notification?.body || payload.data?.body || '';
            const url = payload.data?.url || '/';
            void showOperationalNotification({ title, body, url, tag: payload.data?.tag });
          });
        }
      }
    } catch (err) {
      console.warn('FCM getToken fallback to SW notifications:', err);
    }
  }

  const effectiveToken = fcmToken || `sw_local_${deviceId}`;

  try {
    const deviceRef = doc(db, 'restaurants', restaurantId, 'staff_devices', deviceId);
    const existingSnap = await getDoc(deviceRef);
    const mutableFields = {
      id: deviceId,
      restaurantId,
      ownerId,
      staffId,
      staffName: staffName.slice(0, 100),
      fcmToken: effectiveToken.slice(0, 500),
      deviceName,
      platform,
      activeStations: activeStations.slice(0, 30),
      topics: topics.slice(0, 30),
      isActive: true,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (existingSnap.exists()) {
      await updateDoc(deviceRef, mutableFields);
    } else {
      await setDoc(deviceRef, {
        ...mutableFields,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn('Could not persist staff_devices entry:', err);
  }

  return {
    deviceId,
    permission,
    fcmToken,
    pushMode:
      permission === 'denied' || permission === 'unsupported'
        ? 'blocked'
        : fcmToken
          ? 'fcm_live'
          : 'sw_background_local',
  };
}

export async function syncDeviceShiftTopics(params: {
  restaurantId: string;
  activeStations: string[];
}): Promise<void> {
  const { restaurantId, activeStations } = params;
  if (!restaurantId) return;
  const deviceId = getOrCreateStaffDeviceId();
  const cleanStations = Array.from(new Set(activeStations)).slice(0, 30);
  const topics = cleanStations.map((stId) => getStationTopicName(restaurantId, stId));

  try {
    await updateDoc(doc(db, 'restaurants', restaurantId, 'staff_devices', deviceId), {
      activeStations: cleanStations,
      topics,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Device document might not exist yet if notifications weren't registered
  }
}

export async function deactivateStaffDevice(restaurantId: string): Promise<void> {
  if (!restaurantId) return;
  const deviceId = getOrCreateStaffDeviceId();
  try {
    await updateDoc(doc(db, 'restaurants', restaurantId, 'staff_devices', deviceId), {
      activeStations: [],
      topics: [],
      isActive: false,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal
  }
}

export async function showOperationalNotification(params: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const { title, body, url = '/', tag = 'sufra-ops-alert' } = params;
  const reg = await ensureFcmServiceWorkerRegistered();
  if (reg) {
    try {
      await reg.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/favicon-32x32.png',
        dir: 'rtl',
        lang: 'ar',
        tag,
        data: { url },
      });
      return;
    } catch {
      // fallback to window Notification
    }
  }

  try {
    const n = new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'ar',
      tag,
    });
    n.onclick = () => {
      window.focus();
      if (url && window.location.pathname + window.location.search !== url) {
        window.location.href = url;
      }
      n.close();
    };
  } catch {
    // ignore browser restrictions
  }
}
