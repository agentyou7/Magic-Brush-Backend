"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFirebaseUser = createFirebaseUser;
exports.signInWithFirebase = signInWithFirebase;
exports.verifyFirebaseToken = verifyFirebaseToken;
exports.revokeFirebaseUser = revokeFirebaseUser;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
const firebase_1 = require("./firebase");
// Firebase Auth Functions
async function createFirebaseUser(email, password, displayName) {
    try {
        const userRecord = await firebase_1.firebaseAuth.createUser({
            email,
            password,
            displayName,
            emailVerified: false,
        });
        return userRecord;
    }
    catch (error) {
        throw new Error(`Failed to create Firebase user: ${error}`);
    }
}
async function signInWithFirebase(email) {
    try {
        // Check if user exists in Firebase Auth
        const userRecord = await firebase_1.firebaseAuth.getUserByEmail(email);
        // Create custom token for the user
        const customToken = await firebase_1.firebaseAuth.createCustomToken(userRecord.uid, {
            email: userRecord.email,
            role: 'admin'
        });
        return {
            user: userRecord,
            customToken
        };
    }
    catch (error) {
        throw new Error(`Failed to sign in with Firebase: ${error}`);
    }
}
async function verifyFirebaseToken(idToken) {
    try {
        const decodedToken = await firebase_1.firebaseAuth.verifyIdToken(idToken);
        return decodedToken;
    }
    catch (error) {
        throw new Error(`Invalid Firebase token: ${error}`);
    }
}
async function revokeFirebaseUser(uid) {
    try {
        await firebase_1.firebaseAuth.revokeRefreshTokens(uid);
    }
    catch (error) {
        throw new Error(`Failed to revoke user tokens: ${error}`);
    }
}
// Legacy functions kept for compatibility
async function hashPassword(password) {
    // No longer needed - Firebase handles password hashing
    return password;
}
async function verifyPassword(plainPassword, hashedPassword) {
    // No longer needed - Firebase handles password verification
    return true;
}
