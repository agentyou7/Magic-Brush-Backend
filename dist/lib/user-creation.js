"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
exports.getAllUsers = getAllUsers;
const firebase_1 = require("./firebase");
const auth_1 = require("./auth");
async function createUser(input) {
    const { email, password, role = "user", isActive = true } = input;
    // Check if user already exists
    const existingUser = await firebase_1.firestoreDb
        .collection("users")
        .where("emailLower", "==", email.trim().toLowerCase())
        .limit(1)
        .get();
    if (!existingUser.empty) {
        throw new Error("User with this email already exists");
    }
    // Hash password and create user
    const passwordHash = await (0, auth_1.hashPassword)(password);
    const normalizedEmail = email.trim().toLowerCase();
    const userRef = await firebase_1.firestoreDb.collection("users").add({
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
async function updateUser(userId, updates) {
    const userRef = firebase_1.firestoreDb.collection("users").doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        throw new Error("User not found");
    }
    const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    if (updates.email) {
        updateData.email = updates.email.trim();
        updateData.emailLower = updates.email.trim().toLowerCase();
    }
    await userRef.update(updateData);
}
async function deleteUser(userId) {
    const userRef = firebase_1.firestoreDb.collection("users").doc(userId);
    await userRef.delete();
}
async function getAllUsers(limit = 50) {
    const snapshot = await firebase_1.firestoreDb
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
