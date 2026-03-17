import { firestoreDb } from "./firebase";
import { hashPassword } from "./auth";

export type CreateUserInput = {
  email: string;
  password: string;
  role?: string;
  isActive?: boolean;
};

export async function createUser(input: CreateUserInput): Promise<{ id: string; email: string; role: string }> {
  const { email, password, role = "user", isActive = true } = input;
  
  // Check if user already exists
  const existingUser = await firestoreDb
    .collection("users")
    .where("emailLower", "==", email.trim().toLowerCase())
    .limit(1)
    .get();
  
  if (!existingUser.empty) {
    throw new Error("User with this email already exists");
  }
  
  // Hash password and create user
  const passwordHash = await hashPassword(password);
  const normalizedEmail = email.trim().toLowerCase();
  
  const userRef = await firestoreDb.collection("users").add({
    email: email.trim(),
    emailLower: normalizedEmail,
    passwordHash,
    role,
    isActive,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  
  return {
    id: userRef.id,
    email: email.trim(),
    role,
  };
}

export async function updateUser(userId: string, updates: Partial<{
  email: string;
  role: string;
  isActive: boolean;
}>): Promise<void> {
  const userRef = firestoreDb.collection("users").doc(userId);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    throw new Error("User not found");
  }
  
  const updateData: any = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  if (updates.email) {
    updateData.email = updates.email.trim();
    updateData.emailLower = updates.email.trim().toLowerCase();
  }
  
  await userRef.update(updateData);
}

export async function deleteUser(userId: string): Promise<void> {
  const userRef = firestoreDb.collection("users").doc(userId);
  await userRef.delete();
}

export async function getAllUsers(limit = 50): Promise<Array<{
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}>> {
  const snapshot = await firestoreDb
    .collection("users")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    email: doc.data().email,
    role: doc.data().role || "user",
    isActive: doc.data().isActive ?? true,
    createdAt: doc.data().createdAt,
    updatedAt: doc.data().updatedAt,
  }));
}
