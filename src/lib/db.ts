import { firestoreDb } from "./firebase";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  role: string | null;
};

type FirestoreUserDoc = {
  email: string;
  emailLower?: string;
  passwordHash: string;
  isActive?: boolean;
  role?: string;
};

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const normalizedEmail = email.trim().toLowerCase();

  const snapshot = await firestoreDb
    .collection("users")
    .where("emailLower", "==", normalizedEmail)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data() as FirestoreUserDoc;

  return {
    id: doc.id,
    email: data.email,
    passwordHash: data.passwordHash,
    isActive: data.isActive ?? true,
    role: data.role ?? "user",
  };
}
