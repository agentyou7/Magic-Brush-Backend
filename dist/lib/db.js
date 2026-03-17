"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserByEmail = getUserByEmail;
const firebase_1 = require("./firebase");
async function getUserByEmail(email) {
    const normalizedEmail = email.trim().toLowerCase();
    const snapshot = await firebase_1.firestoreDb
        .collection("users")
        .where("emailLower", "==", normalizedEmail)
        .limit(1)
        .get();
    if (snapshot.empty) {
        return null;
    }
    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
        id: doc.id,
        email: data.email,
        passwordHash: data.passwordHash,
        isActive: data.isActive ?? true,
        role: data.role ?? "user",
    };
}
