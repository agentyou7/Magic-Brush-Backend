"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseAuth = exports.firestoreDb = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const env_1 = require("./env");
const firebasePrivateKey = env_1.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
const firebaseApp = (0, app_1.getApps)()[0] ??
    (0, app_1.initializeApp)({
        credential: (0, app_1.cert)({
            projectId: env_1.env.FIREBASE_PROJECT_ID,
            clientEmail: env_1.env.FIREBASE_CLIENT_EMAIL,
            privateKey: firebasePrivateKey,
        }),
        storageBucket: env_1.env.FIREBASE_STORAGE_BUCKET,
    });
exports.firestoreDb = (0, firestore_1.getFirestore)(firebaseApp);
exports.firebaseAuth = (0, auth_1.getAuth)(firebaseApp);
