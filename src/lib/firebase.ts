import { deleteApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  setPersistence,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

// Firebase App Check setup (activates automatically when VITE_FIREBASE_APP_CHECK_SITE_KEY is configured)
const APP_CHECK_SITE_KEY = (import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY || '').trim();
let appCheckInstance: AppCheck | null = null;

if (typeof window !== 'undefined' && APP_CHECK_SITE_KEY) {
  try {
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('App Check initialization skipped:', err);
  }
}

export function getAppCheckStatus(): { configured: boolean; active: boolean } {
  return {
    configured: Boolean(APP_CHECK_SITE_KEY),
    active: Boolean(appCheckInstance),
  };
}

/**
 * Provisions a new Firebase Authentication account for a Manager or Staff Member
 * using an isolated ephemeral secondary FirebaseApp so the active Owner/Manager
 * session is NEVER interrupted or signed out.
 */
export async function createStaffSecondaryUser(params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ uid: string; email: string }> {
  const secondaryName = `sufra_staff_prov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const existingApp = getApps().find((a) => a.name === secondaryName);
  const secondaryApp: FirebaseApp = existingApp || initializeApp(firebaseConfig, secondaryName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    await setPersistence(secondaryAuth, inMemoryPersistence);
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      params.email.trim(),
      params.password
    );
    if (params.displayName.trim()) {
      await updateProfile(cred.user, {
        displayName: params.displayName.trim().slice(0, 120),
      });
    }
    const uid = cred.user.uid;
    const email = cred.user.email || params.email.trim();
    await signOut(secondaryAuth).catch(() => {});
    return { uid, email };
  } finally {
    await deleteApp(secondaryApp).catch(() => {});
  }
}

export const SUPER_ADMIN_EMAILS = ['tygosibs@gmail.com'];

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
