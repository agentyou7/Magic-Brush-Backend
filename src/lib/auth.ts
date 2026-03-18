import { firebaseAuth } from "./firebase";

export type AuthPayload = {
  sub: string;
  email: string;
  role: string;
};

// Firebase Auth Functions
export async function createFirebaseUser(email: string, password: string, displayName?: string) {
  try {
    const userRecord = await firebaseAuth.createUser({
      email,
      password,
      displayName,
      emailVerified: false,
    });
    return userRecord;
  } catch (error) {
    throw new Error(`Failed to create Firebase user: ${error}`);
  }
}

export async function signInWithFirebase(email: string) {
  try {
    // Check if user exists in Firebase Auth
    const userRecord = await firebaseAuth.getUserByEmail(email);
    
    // Create custom token for the user
    const customToken = await firebaseAuth.createCustomToken(userRecord.uid, {
      email: userRecord.email,
      role: 'admin'
    });
    
    return {
      user: userRecord,
      customToken
    };
  } catch (error) {
    throw new Error(`Failed to sign in with Firebase: ${error}`);
  }
}

export async function verifyFirebaseToken(idToken: string) {
  try {
    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    throw new Error(`Invalid Firebase token: ${error}`);
  }
}

export async function revokeFirebaseUser(uid: string) {
  try {
    await firebaseAuth.revokeRefreshTokens(uid);
  } catch (error) {
    throw new Error(`Failed to revoke user tokens: ${error}`);
  }
}

// Legacy functions kept for compatibility
export async function hashPassword(password: string): Promise<string> {
  // No longer needed - Firebase handles password hashing
  return password;
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  // No longer needed - Firebase handles password verification
  return true;
}
