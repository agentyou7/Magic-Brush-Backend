import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { firebaseAuth, firestoreDb } from "./firebase";
import { verifyFirebaseToken, revokeFirebaseUser } from "./auth";
import { buildOtpAuthUrl, generateTotpSecret, verifyTotpCode } from "./totp";
import { env } from "./env";

const resend = new Resend(env.RESEND_API_KEY);
const TWO_FACTOR_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const phoneRegex = /^[+]?[\d\s\-()]{8,20}$/;

export const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const updatePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(6, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirm password must match",
    path: ["confirmPassword"],
  });

export const verifyTwoFactorSetupSchema = z.object({
  code: z.string().trim().min(6, "Authenticator code is required"),
});

export const toggleTwoFactorSchema = z.object({
  enabled: z.boolean(),
});

export const verifyLoginTwoFactorSchema = z.object({
  challengeToken: z.string().min(1, "Challenge token is required"),
  code: z.string().trim().min(6, "Authenticator code is required"),
});

export const contactBodySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  phone: z.string().trim().regex(phoneRegex, "Phone number format is invalid"),
  service: z.string().trim().min(2, "Service is required").max(100),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000),
});

export function getRequestToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return request.cookies.get("access_token")?.value ?? null;
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...extra,
    },
    { status }
  );
}

export function buildUserPayload(userRecord: Awaited<ReturnType<typeof firebaseAuth.getUser>>) {
  return {
    id: userRecord.uid,
    email: userRecord.email ?? null,
    role: "admin",
    isActive: true,
    createdAt: userRecord.metadata.creationTime,
  };
}

export function applyLoginCookies(
  response: NextResponse,
  idToken: string,
  user: ReturnType<typeof buildUserPayload>
) {
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set("access_token", idToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    maxAge: 24 * 60 * 60,
    path: "/",
  });

  response.cookies.set("user_data", JSON.stringify(user), {
    httpOnly: true,
    secure,
    sameSite: "strict",
    maxAge: 24 * 60 * 60,
    path: "/",
  });
}

export function clearLoginCookies(response: NextResponse) {
  response.cookies.delete("access_token");
  response.cookies.delete("user_data");
}

export async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs = 15000) {
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

export async function resolveAuthenticatedUser(request: NextRequest): Promise<{
  id: string;
  email: string;
}> {
  const token = getRequestToken(request);

  if (!token) {
    throw new Error("Authentication required");
  }

  const decodedToken = await verifyFirebaseToken(token);
  const userRecord = await firebaseAuth.getUser(decodedToken.uid);

  if (!userRecord.email) {
    throw new Error("Authentication required");
  }

  return {
    id: userRecord.uid,
    email: userRecord.email,
  };
}

export async function getAdminPayload(request: NextRequest): Promise<{
  authPayload?: { sub: string; email: string; role: string };
  error?: NextResponse;
}> {
  const token = getRequestToken(request);

  if (!token) {
    return { error: jsonError("Unauthorized", 401) };
  }

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(token);
    const userRecord = await firebaseAuth.getUser(decodedToken.uid);
    const authPayload = {
      sub: decodedToken.uid,
      email: userRecord.email ?? decodedToken.email ?? "",
      role: typeof decodedToken.role === "string" ? decodedToken.role : "admin",
    };

    if (authPayload.role !== "admin") {
      return { error: jsonError("Forbidden", 403) };
    }

    return { authPayload };
  } catch {
    return { error: jsonError("Invalid token", 401) };
  }
}

export async function createTwoFactorChallenge(uid: string, idToken: string) {
  const challengeToken = randomUUID();

  await firestoreDb.collection("auth_challenges").doc(challengeToken).set({
    uid,
    idToken,
    expiresAt: Date.now() + TWO_FACTOR_CHALLENGE_TTL_MS,
    createdAt: new Date().toISOString(),
  });

  return challengeToken;
}

export async function verifyTwoFactorChallenge(challengeToken: string) {
  const challengeRef = firestoreDb.collection("auth_challenges").doc(challengeToken);
  const challengeSnapshot = await challengeRef.get();

  if (!challengeSnapshot.exists) {
    throw new Error("2FA challenge not found or expired");
  }

  const data = challengeSnapshot.data();
  const expiresAt = typeof data?.expiresAt === "number" ? data.expiresAt : 0;

  if (expiresAt < Date.now()) {
    await challengeRef.delete();
    throw new Error("2FA challenge expired. Please log in again.");
  }

  return {
    ref: challengeRef,
    uid: String(data?.uid ?? ""),
    idToken: String(data?.idToken ?? ""),
  };
}

export async function authenticate(request: NextRequest) {
  const token = getRequestToken(request);

  if (!token) {
    return null;
  }

  try {
    const decodedToken = await verifyFirebaseToken(token);
    const userRecord = await firebaseAuth.getUser(decodedToken.uid);

    return {
      id: userRecord.uid,
      email: userRecord.email,
      role: typeof decodedToken.role === "string" ? decodedToken.role : "admin",
      isActive: true,
      createdAt: userRecord.metadata.creationTime,
    };
  } catch (error) {
    console.error("Authentication error:", error);
    return null;
  }
}

export async function sendContactEmail({
  name,
  phone,
  service,
  message,
  inquiryId,
}: {
  name: string;
  phone: string;
  service: string;
  message: string;
  inquiryId: string;
}) {
  await resend.emails.send({
    from: env.CONTACT_FROM_EMAIL,
    to: [env.CONTACT_NOTIFICATION_EMAIL],
    replyTo: env.CONTACT_REPLY_TO_EMAIL,
    subject: `New Quote Request: ${service}`,
    html: `
      <h2>New Quote Request</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Service:</strong> ${service}</p>
      <p><strong>Message:</strong> ${message}</p>
      <p><strong>Inquiry ID:</strong> ${inquiryId}</p>
    `,
  });
}

export async function handleLogin(request: NextRequest) {
  const parsedBody = loginBodySchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return jsonError("Invalid request payload", 400, {
      errors: parsedBody.error.flatten().fieldErrors,
    });
  }

  try {
    const firebaseApiKey = process.env.FIREBASE_API_KEY;

    if (!firebaseApiKey) {
      throw new Error("Firebase API key not configured");
    }

    const firebaseResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...parsedBody.data,
          returnSecureToken: true,
        }),
      }
    );

    const firebaseData = await firebaseResponse.json();

    if (!firebaseResponse.ok) {
      return jsonError(firebaseData.error?.message || "Invalid email or password", 401);
    }

    const userRecord = await firebaseAuth.getUser(firebaseData.localId);
    const user = buildUserPayload(userRecord);
    const securityDoc = await firestoreDb.collection("user_security").doc(userRecord.uid).get();
    const securityData = securityDoc.data();

    if (securityData?.totpSecret && securityData?.twoFactorEnabled) {
      const challengeToken = await createTwoFactorChallenge(userRecord.uid, firebaseData.idToken);

      return NextResponse.json({
        success: true,
        message: "2FA verification required",
        data: {
          requiresTwoFactor: true,
          challengeToken,
          email: user.email,
        },
      });
    }

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      data: {
        user,
      },
    });

    applyLoginCookies(response, firebaseData.idToken, user);
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Login failed. Please try again.",
      500
    );
  }
}

export async function handleVerifyTwoFactorLogin(request: NextRequest) {
  const parsedBody = verifyLoginTwoFactorSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return jsonError("Invalid request payload", 400, {
      errors: parsedBody.error.flatten().fieldErrors,
    });
  }

  try {
    const challenge = await verifyTwoFactorChallenge(parsedBody.data.challengeToken);
    const securityDoc = await firestoreDb.collection("user_security").doc(challenge.uid).get();
    const securityData = securityDoc.data();

    if (!securityData?.totpSecret || !securityData?.twoFactorEnabled) {
      await challenge.ref.delete();
      return jsonError("2FA is not enabled for this account", 400);
    }

    const isValid = verifyTotpCode(securityData.totpSecret, parsedBody.data.code);

    if (!isValid) {
      return jsonError("Invalid authenticator code", 400);
    }

    const userRecord = await firebaseAuth.getUser(challenge.uid);
    const user = buildUserPayload(userRecord);
    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      data: {
        user,
      },
    });

    applyLoginCookies(response, challenge.idToken, user);
    await challenge.ref.delete();
    return response;
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "2FA verification failed",
      401
    );
  }
}

export async function handleLogout(request: NextRequest) {
  try {
    const token = getRequestToken(request);

    if (token) {
      try {
        const decodedToken = await verifyFirebaseToken(token);
        await revokeFirebaseUser(decodedToken.uid);
      } catch (error) {
        console.error("Error revoking Firebase tokens:", error);
      }
    }

    const response = NextResponse.json({
      success: true,
      message: "Logout successful",
    });
    clearLoginCookies(response);
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return jsonError("Logout failed. Please try again.", 500);
  }
}

export async function handleMe(request: NextRequest) {
  try {
    const token = getRequestToken(request);

    if (!token) {
      return jsonError("No authentication token provided", 401);
    }

    try {
      const decodedToken = await verifyFirebaseToken(token);
      const userRecord = await firebaseAuth.getUser(decodedToken.uid);

      return NextResponse.json({
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
      const response = jsonError("Invalid authentication token", 401);
      clearLoginCookies(response);
      throw tokenError;
    }
  } catch (error) {
    console.error("Auth verification error:", error);
    return jsonError("Invalid authentication token", 401);
  }
}

export async function handleUpdatePassword(request: NextRequest) {
  const parsedBody = updatePasswordBodySchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return jsonError("Invalid request payload", 400, {
      errors: parsedBody.error.flatten().fieldErrors,
    });
  }

  try {
    const userData = request.cookies.get("user_data")?.value;
    const parsedUser = typeof userData === "string" ? JSON.parse(userData) : null;
    const email = parsedUser && typeof parsedUser.email === "string" ? parsedUser.email : null;
    const firebaseApiKey = process.env.FIREBASE_API_KEY;

    if (!email || !firebaseApiKey) {
      return jsonError("Authentication required", 401);
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
      return jsonError("Current password is incorrect", 400);
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
      return jsonError(updateData?.error?.message || "Failed to update password", 400);
    }

    const response = NextResponse.json({
      success: true,
      message: "Password updated successfully",
      data: {
        email,
        verifiedAt: verifyData.registered ? new Date().toISOString() : null,
      },
    });

    response.cookies.set("access_token", updateData.idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Update password error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to update password",
      500
    );
  }
}

export async function handleTwoFactorStatus(request: NextRequest) {
  try {
    const user = await resolveAuthenticatedUser(request);
    const securityDoc = await firestoreDb.collection("user_security").doc(user.id).get();
    const data = securityDoc.data();

    return NextResponse.json({
      success: true,
      data: {
        isSetup: Boolean(data?.totpSecret),
        enabled: Boolean(data?.twoFactorEnabled),
        email: user.email,
      },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Authentication required",
      401
    );
  }
}

export async function handleTwoFactorSetup(request: NextRequest) {
  try {
    const user = await resolveAuthenticatedUser(request);
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

    return NextResponse.json({
      success: true,
      data: {
        secret,
        otpauthUrl,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpauthUrl)}`,
      },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Authentication required",
      401
    );
  }
}

export async function handleVerifyTwoFactorSetup(request: NextRequest) {
  const parsedBody = verifyTwoFactorSetupSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return jsonError("Invalid request payload", 400, {
      errors: parsedBody.error.flatten().fieldErrors,
    });
  }

  try {
    const user = await resolveAuthenticatedUser(request);
    const securityRef = firestoreDb.collection("user_security").doc(user.id);
    const securityDoc = await securityRef.get();
    const data = securityDoc.data();

    if (!data?.totpSecret) {
      return jsonError("2FA setup not started", 404);
    }

    const isValid = verifyTotpCode(data.totpSecret, parsedBody.data.code);

    if (!isValid) {
      return jsonError("Invalid authenticator code", 400);
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

    return NextResponse.json({
      success: true,
      message: "2FA enabled successfully",
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Authentication required",
      401
    );
  }
}

export async function handleToggleTwoFactor(request: NextRequest) {
  const parsedBody = toggleTwoFactorSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return jsonError("Invalid request payload", 400, {
      errors: parsedBody.error.flatten().fieldErrors,
    });
  }

  try {
    const user = await resolveAuthenticatedUser(request);
    const securityRef = firestoreDb.collection("user_security").doc(user.id);
    const securityDoc = await securityRef.get();
    const data = securityDoc.data();

    if (!data?.totpSecret) {
      return jsonError("2FA setup not found", 404);
    }

    await securityRef.set(
      {
        twoFactorEnabled: parsedBody.data.enabled,
        twoFactorPending: false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: parsedBody.data.enabled ? "2FA turned on" : "2FA turned off",
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Authentication required",
      401
    );
  }
}
