import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "./env";

const firebasePrivateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

const firebaseApp =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: firebasePrivateKey,
    }),
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
  });

export const firestoreDb = getFirestore(firebaseApp);
