"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
exports.authenticate = authenticate;
const crypto_1 = require("crypto");
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const zod_1 = require("zod");
const firebase_1 = require("../lib/firebase");
const auth_1 = require("../lib/auth");
const totp_1 = require("../lib/totp");
const loginBodySchema = zod_1.z.object({
    email: zod_1.z.string().trim().toLowerCase().email("Valid email is required"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
});
const updatePasswordBodySchema = zod_1.z
    .object({
    currentPassword: zod_1.z.string().min(6, "Current password is required"),
    newPassword: zod_1.z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: zod_1.z.string().min(6, "Confirm password is required"),
})
    .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirm password must match",
    path: ["confirmPassword"],
});
const verifyTwoFactorSetupSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(6, "Authenticator code is required"),
});
const toggleTwoFactorSchema = zod_1.z.object({
    enabled: zod_1.z.boolean(),
});
const verifyLoginTwoFactorSchema = zod_1.z.object({
    challengeToken: zod_1.z.string().min(1, "Challenge token is required"),
    code: zod_1.z.string().trim().min(6, "Authenticator code is required"),
});
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many login attempts. Try again later." },
});
const TWO_FACTOR_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const loginChallengeStore = new Map();
exports.authRouter = (0, express_1.Router)();
function getRequestToken(req) {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        return authHeader.slice(7).trim();
    }
    const cookieToken = req.cookies?.access_token;
    return typeof cookieToken === "string" && cookieToken.length > 0
        ? cookieToken
        : null;
}
async function fetchJsonWithTimeout(url, init, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...init,
            signal: controller.signal,
        });
        const data = await response.json();
        return { response, data };
    }
    finally {
        clearTimeout(timeout);
    }
}
async function resolveAuthenticatedUser(req) {
    const token = getRequestToken(req);
    if (token) {
        try {
            const decodedToken = await (0, auth_1.verifyFirebaseToken)(token);
            const userRecord = await firebase_1.firebaseAuth.getUser(decodedToken.uid);
            if (userRecord.email) {
                return {
                    id: userRecord.uid,
                    email: userRecord.email,
                };
            }
        }
        catch {
            // Fall back to user_data cookie below.
        }
    }
    const userData = req.cookies?.user_data;
    if (typeof userData === "string") {
        const parsedUser = JSON.parse(userData);
        if (parsedUser?.id && parsedUser?.email) {
            return {
                id: String(parsedUser.id),
                email: String(parsedUser.email),
            };
        }
    }
    throw new Error("Authentication required");
}
function issueTwoFactorChallenge(uid, idToken) {
    const challengeToken = (0, crypto_1.randomUUID)();
    loginChallengeStore.set(challengeToken, {
        uid,
        idToken,
        expiresAt: Date.now() + TWO_FACTOR_CHALLENGE_TTL_MS,
    });
    return challengeToken;
}
function verifyTwoFactorChallenge(token) {
    const challenge = loginChallengeStore.get(token);
    if (!challenge) {
        throw new Error("2FA challenge not found or expired");
    }
    if (challenge.expiresAt < Date.now()) {
        loginChallengeStore.delete(token);
        throw new Error("2FA challenge expired. Please log in again.");
    }
    return challenge;
}
function clearTwoFactorChallenge(token) {
    loginChallengeStore.delete(token);
}
function buildUserPayload(userRecord) {
    return {
        id: userRecord.uid,
        email: userRecord.email ?? null,
        role: "admin",
        isActive: true,
        createdAt: userRecord.metadata.creationTime,
    };
}
function applyLoginCookies(res, idToken, user) {
    res.cookie("access_token", idToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
    });
    res.cookie("user_data", JSON.stringify(user), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
    });
}
exports.authRouter.post("/login", loginLimiter, async (req, res) => {
    const parsedBody = loginBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid request payload",
            errors: parsedBody.error.flatten().fieldErrors,
        });
    }
    const { email, password } = parsedBody.data;
    try {
        const firebaseApiKey = process.env.FIREBASE_API_KEY;
        if (!firebaseApiKey) {
            throw new Error("Firebase API key not configured");
        }
        const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`;
        const firebaseResponse = await fetch(authUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email,
                password,
                returnSecureToken: true,
            }),
        });
        const firebaseData = await firebaseResponse.json();
        if (!firebaseResponse.ok) {
            return res.status(401).json({
                success: false,
                message: firebaseData.error?.message || "Invalid email or password",
            });
        }
        const userRecord = await firebase_1.firebaseAuth.getUser(firebaseData.localId);
        const user = buildUserPayload(userRecord);
        const securityDoc = await firebase_1.firestoreDb.collection("user_security").doc(userRecord.uid).get();
        const securityData = securityDoc.data();
        if (securityData?.totpSecret && securityData?.twoFactorEnabled) {
            const challengeToken = issueTwoFactorChallenge(userRecord.uid, firebaseData.idToken);
            return res.status(200).json({
                success: true,
                message: "2FA verification required",
                data: {
                    requiresTwoFactor: true,
                    challengeToken,
                    email: user.email,
                },
            });
        }
        applyLoginCookies(res, firebaseData.idToken, user);
        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                user,
            },
        });
    }
    catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Login failed. Please try again.",
        });
    }
});
exports.authRouter.post("/verify-2fa-login", async (req, res) => {
    const parsedBody = verifyLoginTwoFactorSchema.safeParse(req.body);
    if (!parsedBody.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid request payload",
            errors: parsedBody.error.flatten().fieldErrors,
        });
    }
    try {
        const challenge = verifyTwoFactorChallenge(parsedBody.data.challengeToken);
        const securityDoc = await firebase_1.firestoreDb.collection("user_security").doc(challenge.uid).get();
        const securityData = securityDoc.data();
        if (!securityData?.totpSecret || !securityData?.twoFactorEnabled) {
            clearTwoFactorChallenge(parsedBody.data.challengeToken);
            return res.status(400).json({
                success: false,
                message: "2FA is not enabled for this account",
            });
        }
        const isValid = (0, totp_1.verifyTotpCode)(securityData.totpSecret, parsedBody.data.code);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid authenticator code",
            });
        }
        const userRecord = await firebase_1.firebaseAuth.getUser(challenge.uid);
        const user = buildUserPayload(userRecord);
        applyLoginCookies(res, challenge.idToken, user);
        clearTwoFactorChallenge(parsedBody.data.challengeToken);
        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                user,
            },
        });
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            message: error instanceof Error ? error.message : "2FA verification failed",
        });
    }
});
exports.authRouter.post("/logout", async (req, res) => {
    try {
        const token = getRequestToken(req);
        if (token) {
            try {
                const decodedToken = await (0, auth_1.verifyFirebaseToken)(token);
                await (0, auth_1.revokeFirebaseUser)(decodedToken.uid);
            }
            catch (error) {
                console.error("Error revoking Firebase tokens:", error);
            }
        }
        res.clearCookie("access_token");
        res.clearCookie("user_data");
        return res.status(200).json({
            success: true,
            message: "Logout successful",
        });
    }
    catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({
            success: false,
            message: "Logout failed. Please try again.",
        });
    }
});
exports.authRouter.get("/me", async (req, res) => {
    try {
        const token = getRequestToken(req);
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "No authentication token provided",
            });
        }
        try {
            const decodedToken = await (0, auth_1.verifyFirebaseToken)(token);
            const userRecord = await firebase_1.firebaseAuth.getUser(decodedToken.uid);
            return res.status(200).json({
                success: true,
                data: {
                    user: {
                        id: userRecord.uid,
                        email: userRecord.email,
                        role: decodedToken.role || "admin",
                        isActive: true,
                        createdAt: userRecord.metadata.creationTime,
                    },
                },
            });
        }
        catch (tokenError) {
            const userData = req.cookies?.user_data;
            if (userData) {
                try {
                    const parsedUser = JSON.parse(userData);
                    return res.status(200).json({
                        success: true,
                        data: {
                            user: parsedUser,
                        },
                    });
                }
                catch {
                    throw new Error("Invalid user data");
                }
            }
            throw tokenError;
        }
    }
    catch (error) {
        console.error("Auth verification error:", error);
        return res.status(401).json({
            success: false,
            message: "Invalid authentication token",
        });
    }
});
exports.authRouter.post("/update-password", async (req, res) => {
    const parsedBody = updatePasswordBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid request payload",
            errors: parsedBody.error.flatten().fieldErrors,
        });
    }
    try {
        const userData = req.cookies?.user_data;
        const parsedUser = typeof userData === "string" ? JSON.parse(userData) : null;
        const email = parsedUser && typeof parsedUser.email === "string" ? parsedUser.email : null;
        const firebaseApiKey = process.env.FIREBASE_API_KEY;
        if (!email || !firebaseApiKey) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }
        const { currentPassword, newPassword } = parsedBody.data;
        const { response: verifyResponse, data: verifyData } = await fetchJsonWithTimeout(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email,
                password: currentPassword,
                returnSecureToken: true,
            }),
        });
        if (!verifyResponse.ok) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect",
            });
        }
        const { response: updateResponse, data: updateData } = await fetchJsonWithTimeout(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${firebaseApiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                idToken: verifyData.idToken,
                password: newPassword,
                returnSecureToken: true,
            }),
        });
        if (!updateResponse.ok || !updateData.idToken) {
            return res.status(400).json({
                success: false,
                message: updateData?.error?.message || "Failed to update password",
            });
        }
        res.cookie("access_token", updateData.idToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000,
        });
        return res.status(200).json({
            success: true,
            message: "Password updated successfully",
            data: {
                email,
                verifiedAt: verifyData.registered ? new Date().toISOString() : null,
            },
        });
    }
    catch (error) {
        console.error("Update password error:", error);
        return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Failed to update password",
        });
    }
});
exports.authRouter.get("/2fa/status", async (req, res) => {
    try {
        const user = await resolveAuthenticatedUser(req);
        const securityDoc = await firebase_1.firestoreDb.collection("user_security").doc(user.id).get();
        const data = securityDoc.data();
        return res.status(200).json({
            success: true,
            data: {
                isSetup: Boolean(data?.totpSecret),
                enabled: Boolean(data?.twoFactorEnabled),
                email: user.email,
            },
        });
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            message: error instanceof Error ? error.message : "Authentication required",
        });
    }
});
exports.authRouter.post("/2fa/setup", async (req, res) => {
    try {
        const user = await resolveAuthenticatedUser(req);
        const secret = (0, totp_1.generateTotpSecret)();
        const otpauthUrl = (0, totp_1.buildOtpAuthUrl)({
            issuer: "Magic Brush Ltd",
            accountName: user.email,
            secret,
        });
        await firebase_1.firestoreDb.collection("user_security").doc(user.id).set({
            uid: user.id,
            email: user.email,
            emailLower: user.email.toLowerCase(),
            totpSecret: secret,
            twoFactorEnabled: false,
            twoFactorPending: true,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
        }, { merge: true });
        return res.status(200).json({
            success: true,
            data: {
                secret,
                otpauthUrl,
                qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpauthUrl)}`,
            },
        });
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            message: error instanceof Error ? error.message : "Authentication required",
        });
    }
});
exports.authRouter.post("/2fa/verify-setup", async (req, res) => {
    const parsedBody = verifyTwoFactorSetupSchema.safeParse(req.body);
    if (!parsedBody.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid request payload",
            errors: parsedBody.error.flatten().fieldErrors,
        });
    }
    try {
        const user = await resolveAuthenticatedUser(req);
        const securityRef = firebase_1.firestoreDb.collection("user_security").doc(user.id);
        const securityDoc = await securityRef.get();
        const data = securityDoc.data();
        if (!data?.totpSecret) {
            return res.status(404).json({
                success: false,
                message: "2FA setup not started",
            });
        }
        const isValid = (0, totp_1.verifyTotpCode)(data.totpSecret, parsedBody.data.code);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid authenticator code",
            });
        }
        await securityRef.set({
            twoFactorEnabled: true,
            twoFactorPending: false,
            confirmedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }, { merge: true });
        return res.status(200).json({
            success: true,
            message: "2FA enabled successfully",
        });
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            message: error instanceof Error ? error.message : "Authentication required",
        });
    }
});
exports.authRouter.post("/2fa/toggle", async (req, res) => {
    const parsedBody = toggleTwoFactorSchema.safeParse(req.body);
    if (!parsedBody.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid request payload",
            errors: parsedBody.error.flatten().fieldErrors,
        });
    }
    try {
        const user = await resolveAuthenticatedUser(req);
        const securityRef = firebase_1.firestoreDb.collection("user_security").doc(user.id);
        const securityDoc = await securityRef.get();
        const data = securityDoc.data();
        if (!data?.totpSecret) {
            return res.status(404).json({
                success: false,
                message: "2FA setup not found",
            });
        }
        await securityRef.set({
            twoFactorEnabled: parsedBody.data.enabled,
            twoFactorPending: false,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
        return res.status(200).json({
            success: true,
            message: parsedBody.data.enabled ? "2FA turned on" : "2FA turned off",
        });
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            message: error instanceof Error ? error.message : "Authentication required",
        });
    }
});
async function authenticate(req) {
    const token = getRequestToken(req);
    if (!token) {
        return null;
    }
    try {
        const decodedToken = await (0, auth_1.verifyFirebaseToken)(token);
        const userRecord = await firebase_1.firebaseAuth.getUser(decodedToken.uid);
        return {
            id: userRecord.uid,
            email: userRecord.email,
            role: decodedToken.role || "admin",
            isActive: true,
            createdAt: userRecord.metadata.creationTime,
        };
    }
    catch (error) {
        console.error("Authentication error:", error);
        return null;
    }
}
