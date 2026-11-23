import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function formatFirebaseAuthError(error: unknown): {
  code: string;
  message: string;
  isDismissed: boolean;
} {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return {
        code,
        isDismissed: true,
        message:
          'Google sign-in popup was closed before completing authentication. You can continue using Open Campus Mode or click Campus SSO Sync to try again.',
      };
    case 'auth/popup-blocked':
      return {
        code,
        isDismissed: false,
        message:
          'Sign-in popup was blocked by your browser. Allow popups for this site and click Campus SSO Sync again, or continue in Open Campus Mode.',
      };
    case 'auth/network-request-failed':
      return {
        code,
        isDismissed: false,
        message:
          'Network error while contacting Google authentication. Check your connection and retry.',
      };
    case 'auth/unauthorized-domain':
      return {
        code,
        isDismissed: false,
        message:
          'This domain is not yet authorized in Firebase Authentication settings. Continuing in Open Campus Mode.',
      };
    default:
      return {
        code,
        isDismissed: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to complete Google sign-in. Continuing in Open Campus Mode.',
      };
  }
}

export const BOOTSTRAP_ADMIN_EMAIL = 'johanlibert949@gmail.com';

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
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
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

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
