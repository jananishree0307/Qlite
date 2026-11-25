import { FirebaseError, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function formatFirebaseAuthError(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : (error as { code?: string })?.code;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  switch (code) {
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups for this site (or open the app in a new tab) and try again.';
    case 'auth/popup-closed-by-user':
      return 'The Google Sign-In popup was closed before completing sign-in. Please try again.';
    case 'auth/cancelled-popup-request':
      return 'Another sign-in request was already open. Please click "Continue with Google" again.';
    case 'auth/unauthorized-domain':
      return `Domain "${host}" is not in Firebase Auth Authorized Domains. Add "${host}" under Firebase Console → Authentication → Settings → Authorized domains.`;
    case 'auth/operation-not-allowed':
      return 'Google Sign-In is currently disabled in Firebase Authentication settings.';
    case 'auth/operation-not-supported-in-this-environment':
      return 'Google Sign-In popup is restricted in this embedded browser context. Open the app URL directly in a new tab and try again.';
    case 'auth/network-request-failed':
      return 'Network error while signing in with Google. Check your internet connection and retry.';
    case 'auth/user-disabled':
      return 'This Google account has been disabled in Firebase Authentication.';
    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return 'Unable to complete Google Sign-In. Please try again.';
  }
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

let connectionTested = false;

export async function testConnection(): Promise<boolean> {
  if (connectionTested) return true;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

testConnection();
