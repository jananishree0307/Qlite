import { getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

const VAPID_KEY = (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined) || '';

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export async function registerQueueNotificationWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .catch(() => null);
  }
  return swRegistrationPromise;
}

export async function initFcmAndGetToken(): Promise<{
  supported: boolean;
  token: string | null;
  vapidConfigured: boolean;
}> {
  const reg = await registerQueueNotificationWorker();
  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return { supported: false, token: null, vapidConfigured: Boolean(VAPID_KEY) };
  }

  if (!VAPID_KEY) {
    return { supported: true, token: null, vapidConfigured: false };
  }

  try {
    const messaging = getMessaging(getApp());
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg || undefined,
    });
    return { supported: true, token: token || null, vapidConfigured: true };
  } catch {
    return { supported: true, token: null, vapidConfigured: true };
  }
}

export async function subscribeForegroundFcm(
  onPayload: (title: string, body: string) => void
): Promise<() => void> {
  const supported = await isSupported().catch(() => false);
  if (!supported) return () => {};
  try {
    const messaging = getMessaging(getApp());
    return onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || 'QLite Queue Alert';
      const body = payload.notification?.body || payload.data?.body || 'Queue status updated.';
      onPayload(title, body);
    });
  } catch {
    return () => {};
  }
}
