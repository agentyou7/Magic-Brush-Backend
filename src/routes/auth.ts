import { randomUUID } from "crypto";
import { type Request, type Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { firebaseAuth, firestoreDb } from "../lib/firebase";
import { verifyFirebaseToken, revokeFirebaseUser } from "../lib/auth";
import { buildOtpAuthUrl, generateTotpSecret, verifyTotpCode } from "../lib/totp";

const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const updatePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(6, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirm password must match",
    path: ["confirmPassword"],
  });

const verifyTwoFactorSetupSchema = z.object({
  code: z.string().trim().min(6, "Authenticator code is required"),
});

const toggleTwoFactorSchema = z.object({
  enabled: z.boolean(),
});

const verifyLoginTwoFactorSchema = z.object({
  challengeToken: z.string().min(1, "Challenge token is required"),
  code: z.string().trim().min(6, "Authenticator code is required"),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Try again later." },
});

type TwoFactorChallenge = {
  uid: string;
  idToken: string;
  expiresAt: number;
};

const TWO_FACTOR_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const loginChallengeStore = new Map<string, TwoFactorChallenge>();

export const authRouter = Router();

function getRequestToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  const cookieToken = req.cookies?.access_token;
  return typeof cookieToken === "string" && cookieToken.length > 0
    ? cookieToken
    : null;
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 15000
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const data = await response.json();
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveAuthenticatedUser(req: Request): Promise<{
  id: string;
  email: string;
}> {
  const token = getRequestToken(req);

  if (!token) {
    throw new Error("Authentication required");
  }

  const decodedToken = await verifyFirebaseToken(token);
  const userRecord = await firebaseAuth.getUser(decodedToken.uid);

  if (userRecord.email) {
    return {
      id: userRecord.uid,
      email: userRecord.email,
    };
  }

  throw new Error("Authentication required");
}

function issueTwoFactorChallenge(uid: string, idToken: string): string {
  const challengeToken = randomUUID();

  loginChallengeStore.set(challengeToken, {
    uid,
    idToken,
    expiresAt: Date.now() + TWO_FACTOR_CHALLENGE_TTL_MS,
  });

  return challengeToken;
}

function verifyTwoFactorChallenge(token: string): TwoFactorChallenge {
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

function clearTwoFactorChallenge(token: string) {
  loginChallengeStore.delete(token);
}

function buildUserPayload(userRecord: Awaited<ReturnType<typeof firebaseAuth.getUser>>) {
  return {
    id: userRecord.uid,
    email: userRecord.email ?? null,
    role: "admin",
    isActive: true,
    createdAt: userRecord.metadata.creationTime,
  };
}

function applyLoginCookies(
  res: Response,
  idToken: string,
  user: {
    id: string;
    email: string | null;
    role: string;
    isActive: boolean;
    createdAt: string | undefined;
  }
) {
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

authRouter.post("/login", loginLimiter, async (req, res) => {
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

    const userRecord = await firebaseAuth.getUser(firebaseData.localId);
    const user = buildUserPayload(userRecord);
    const securityDoc = await firestoreDb.collection("user_security").doc(userRecord.uid).get();
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
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Login failed. Please try again.",
    });
  }
});

authRouter.post("/verify-2fa-login", async (req, res) => {
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
    const securityDoc = await firestoreDb.collection("user_security").doc(challenge.uid).get();
    const securityData = securityDoc.data();

    if (!securityData?.totpSecret || !securityData?.twoFactorEnabled) {
      clearTwoFactorChallenge(parsedBody.data.challengeToken);
      return res.status(400).json({
        success: false,
        message: "2FA is not enabled for this account",
      });
    }

    const isValid = verifyTotpCode(securityData.totpSecret, parsedBody.data.code);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid authenticator code",
      });
    }

    const userRecord = await firebaseAuth.getUser(challenge.uid);
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
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : "2FA verification failed",
    });
  }
});

authRouter.post("/logout", async (req, res) => {
  try {
    const token = getRequestToken(req);

    if (token) {
      try {
        const decodedToken = await verifyFirebaseToken(token);
        await revokeFirebaseUser(decodedToken.uid);
      } catch (error) {
        console.error("Error revoking Firebase tokens:", error);
      }
    }

    res.clearCookie("access_token");
    res.clearCookie("user_data");

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Logout failed. Please try again.",
    });
  }
});

authRouter.get("/me", async (req, res) => {
  try {
    const token = getRequestToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No authentication token provided",
      });
    }

    try {
      const decodedToken = await verifyFirebaseToken(token);
      const userRecord = await firebaseAuth.getUser(decodedToken.uid);

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
    } catch (tokenError) {
      res.clearCookie("access_token");
      res.clearCookie("user_data");
      throw tokenError;
    }
  } catch (error) {
    console.error("Auth verification error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token",
    });
  }
});

authRouter.post("/update-password", async (req, res) => {
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
    const email =
      parsedUser && typeof parsedUser.email === "string" ? parsedUser.email : null;
    const firebaseApiKey = process.env.FIREBASE_API_KEY;

    if (!email || !firebaseApiKey) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { currentPassword, newPassword } = parsedBody.data;

    const { response: verifyResponse, data: verifyData } = await fetchJsonWithTimeout(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password: currentPassword,
          returnSecureToken: true,
        }),
      }
    );

    if (!verifyResponse.ok) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const { response: updateResponse, data: updateData } = await fetchJsonWithTimeout(
      `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${firebaseApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idToken: verifyData.idToken,
          password: newPassword,
          returnSecureToken: true,
        }),
      }
    );

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
  } catch (error) {
    console.error("Update password error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update password",
    });
  }
});

authRouter.get("/2fa/status", async (req, res) => {
  try {
    const user = await resolveAuthenticatedUser(req);
    const securityDoc = await firestoreDb.collection("user_security").doc(user.id).get();
    const data = securityDoc.data();

    return res.status(200).json({
      success: true,
      data: {
        isSetup: Boolean(data?.totpSecret),
        enabled: Boolean(data?.twoFactorEnabled),
        email: user.email,
      },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : "Authentication required",
    });
  }
});

authRouter.post("/2fa/setup", async (req, res) => {
  try {
    const user = await resolveAuthenticatedUser(req);
    const secret = generateTotpSecret();
    const otpauthUrl = buildOtpAuthUrl({
      issuer: "Magic Brush Ltd",
      accountName: user.email,
      secret,
    });

    await firestoreDb.collection("user_security").doc(user.id).set(
      {
        uid: user.id,
        email: user.email,
        emailLower: user.email.toLowerCase(),
        totpSecret: secret,
        twoFactorEnabled: false,
        twoFactorPending: true,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return res.status(200).json({
      success: true,
      data: {
        secret,
        otpauthUrl,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpauthUrl)}`,
      },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : "Authentication required",
    });
  }
});

authRouter.post("/2fa/verify-setup", async (req, res) => {
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
    const securityRef = firestoreDb.collection("user_security").doc(user.id);
    const securityDoc = await securityRef.get();
    const data = securityDoc.data();

    if (!data?.totpSecret) {
      return res.status(404).json({
        success: false,
        message: "2FA setup not started",
      });
    }

    const isValid = verifyTotpCode(data.totpSecret, parsedBody.data.code);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid authenticator code",
      });
    }

    await securityRef.set(
      {
        twoFactorEnabled: true,
        twoFactorPending: false,
        confirmedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return res.status(200).json({
      success: true,
      message: "2FA enabled successfully",
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : "Authentication required",
    });
  }
});

authRouter.post("/2fa/toggle", async (req, res) => {
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
    const securityRef = firestoreDb.collection("user_security").doc(user.id);
    const securityDoc = await securityRef.get();
    const data = securityDoc.data();

    if (!data?.totpSecret) {
      return res.status(404).json({
        success: false,
        message: "2FA setup not found",
      });
    }

    await securityRef.set(
      {
        twoFactorEnabled: parsedBody.data.enabled,
        twoFactorPending: false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return res.status(200).json({
      success: true,
      message: parsedBody.data.enabled ? "2FA turned on" : "2FA turned off",
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : "Authentication required",
    });
  }
});

export async function authenticate(req: Request) {
  const token = getRequestToken(req);

  if (!token) {
    return null;
  }

  try {
    const decodedToken = await verifyFirebaseToken(token);
    const userRecord = await firebaseAuth.getUser(decodedToken.uid);

    return {
      id: userRecord.uid,
      email: userRecord.email,
      role: decodedToken.role || "admin",
      isActive: true,
      createdAt: userRecord.metadata.creationTime,
    };
  } catch (error) {
    console.error("Authentication error:", error);
    return null;
  }
}
