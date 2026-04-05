import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { Resend } from "resend";
import { z } from "zod";
import { firebaseAuth, firestoreDb } from "./firebase";
import { verifyFirebaseToken, revokeFirebaseUser } from "./auth";
import { buildOtpAuthUrl, generateTotpSecret, verifyTotpCode } from "./totp";
import { env } from "./env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const TWO_FACTOR_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const phoneRegex = /^[+]?[\d\s\-()]{8,20}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const brandWebsiteUrl = env.CONTACT_WEBSITE_URL ?? "https://www.magicbrushltd.co.uk";
const brandLogoUrl = env.CONTACT_LOGO_URL ?? `${brandWebsiteUrl.replace(/\/+$/, "")}/images/logo.png`;

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
  email: z.string().trim().toLowerCase().regex(emailRegex, "Valid email is required"),
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

type ContactInquiryEmailPayload = {
  name: string;
  phone: string;
  email: string;
  service: string;
  message: string;
  inquiryId: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildDetailRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding: 0 0 14px; vertical-align: top; width: 132px;">
        <p style="margin: 0; font-size: 12px; line-height: 18px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #f97316;">
          ${escapeHtml(label)}
        </p>
      </td>
      <td style="padding: 0 0 14px; vertical-align: top;">
        <p style="margin: 0; font-size: 15px; line-height: 24px; color: #0f172a; font-weight: 600;">
          ${escapeHtml(value)}
        </p>
      </td>
    </tr>
  `;
}

function buildEmailShell({
  eyebrow,
  title,
  intro,
  detailsHeading,
  detailsRows,
  footerNote,
  ctaLabel,
  ctaHref,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  detailsHeading: string;
  detailsRows: string;
  footerNote: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return `
    <!doctype html>
    <html lang="en">
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: Arial, Helvetica, sans-serif; color: #0f172a;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(180deg, #fff7ed 0%, #f8fafc 100%); margin: 0; padding: 32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 28px; overflow: hidden; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.10);">
                <tr>
                  <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 34px 36px 30px; text-align: center;">
                    <a href="${escapeHtml(brandWebsiteUrl)}" style="text-decoration: none; display: inline-block;">
                      <img src="${escapeHtml(brandLogoUrl)}" alt="Magic Brush Ltd" width="132" style="display: block; margin: 0 auto 18px; width: 132px; max-width: 100%; height: auto;" />
                    </a>
                    <p style="margin: 0 0 10px; font-size: 11px; line-height: 18px; letter-spacing: 0.28em; text-transform: uppercase; font-weight: 800; color: rgba(255,255,255,0.82);">
                      ${escapeHtml(eyebrow)}
                    </p>
                    <h1 style="margin: 0; font-size: 34px; line-height: 42px; font-weight: 800; color: #ffffff;">
                      ${escapeHtml(title)}
                    </h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 34px 36px 12px;">
                    <p style="margin: 0; font-size: 16px; line-height: 28px; color: #334155;">
                      ${intro}
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 10px 36px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 24px; padding: 24px;">
                      <tr>
                        <td>
                          <h2 style="margin: 0 0 18px; font-size: 20px; line-height: 28px; font-weight: 800; color: #0f172a;">
                            ${escapeHtml(detailsHeading)}
                          </h2>
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                            ${detailsRows}
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 28px 36px 10px; text-align: center;">
                    <a href="${escapeHtml(ctaHref)}" style="display: inline-block; padding: 15px 28px; border-radius: 999px; background-color: #f97316; color: #ffffff; text-decoration: none; font-size: 15px; line-height: 20px; font-weight: 800;">
                      ${escapeHtml(ctaLabel)}
                    </a>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 12px 36px 34px; text-align: center;">
                    <p style="margin: 0; font-size: 14px; line-height: 24px; color: #64748b;">
                      ${footerNote}
                    </p>
                    <p style="margin: 16px 0 0; font-size: 12px; line-height: 20px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 800; color: #94a3b8;">
                      Magic Brush Ltd
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function buildAdminInquiryHtml({
  name,
  phone,
  email,
  service,
  message,
  inquiryId,
}: ContactInquiryEmailPayload) {
  return buildEmailShell({
    eyebrow: "New Website Inquiry",
    title: "New inquiry received",
    intro:
      "A new customer inquiry has been registered on your website. Review the details below and follow up as soon as possible.",
    detailsHeading: "Inquiry details",
    detailsRows: [
      buildDetailRow("Inquiry ID", inquiryId),
      buildDetailRow("Customer Name", name),
      buildDetailRow("Phone", phone),
      buildDetailRow("Email", email),
      buildDetailRow("Service", service),
      buildDetailRow("Message", message),
    ].join(""),
    footerNote:
      "You can reply directly to this email to contact the customer using the email address they submitted.",
    ctaLabel: "Open Website",
    ctaHref: brandWebsiteUrl,
  });
}

function buildCustomerConfirmationHtml({
  name,
  phone,
  email,
  service,
  message,
  inquiryId,
}: ContactInquiryEmailPayload) {
  return buildEmailShell({
    eyebrow: "Inquiry Confirmation",
    title: "We have received your inquiry",
    intro: `Hi ${escapeHtml(name)},<br /><br />Thank you for contacting Magic Brush Ltd. We will respond to you as soon as possible by WhatsApp, phone, or email. Here is a copy of the details you submitted.`,
    detailsHeading: "Your submitted details",
    detailsRows: [
      buildDetailRow("Inquiry ID", inquiryId),
      buildDetailRow("Name", name),
      buildDetailRow("Phone", phone),
      buildDetailRow("Email", email),
      buildDetailRow("Service", service),
      buildDetailRow("Message", message),
    ].join(""),
    footerNote:
      "If you need to add anything else, simply reply to this email and our team will review it with your inquiry.",
    ctaLabel: "Visit Magic Brush Ltd",
    ctaHref: brandWebsiteUrl,
  });
}

async function sendMail({
  to,
  replyTo,
  subject,
  html,
}: {
  to: string[];
  replyTo?: string;
  subject: string;
  html: string;
}) {
  const hasSmtpConfig =
    Boolean(env.SMTP_HOST) &&
    Boolean(env.SMTP_PORT) &&
    Boolean(env.SMTP_USER) &&
    Boolean(env.SMTP_PASS);

  if (hasSmtpConfig) {
    const primaryTransportOptions: SMTPTransport.Options = {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      authMethod: "LOGIN",
    };

    try {
      const transporter = nodemailer.createTransport(primaryTransportOptions);
      await transporter.sendMail({
        from: env.CONTACT_FROM_EMAIL,
        to,
        replyTo,
        subject,
        html,
      });
    } catch (error) {
      const shouldRetryWithStartTls =
        error instanceof Error &&
        "code" in error &&
        error.code === "EAUTH" &&
        env.SMTP_HOST === "smtp.hostinger.com" &&
        env.SMTP_PORT === 465;

      if (!shouldRetryWithStartTls) {
        throw error;
      }

      const fallbackTransporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
        authMethod: "LOGIN",
      });

      await fallbackTransporter.sendMail({
        from: env.CONTACT_FROM_EMAIL,
        to,
        replyTo,
        subject,
        html,
      });
    }

    return;
  }

  if (!resend) {
    throw new Error("No email provider configured");
  }

  await resend.emails.send({
    from: env.CONTACT_FROM_EMAIL,
    to,
    replyTo,
    subject,
    html,
  });
}

function getAdminNotificationRecipients() {
  return Array.from(
    new Set(
      [env.CONTACT_NOTIFICATION_EMAIL, env.SMTP_USER, env.CONTACT_REPLY_TO_EMAIL]
        .filter((value): value is string => Boolean(value && value.trim()))
        .map((value) => value.trim().toLowerCase())
    )
  );
}

export async function sendContactEmails({
  name,
  phone,
  email,
  service,
  message,
  inquiryId,
}: {
  name: string;
  phone: string;
  email: string;
  service: string;
  message: string;
  inquiryId: string;
}) {
  const adminRecipients = getAdminNotificationRecipients();

  await sendMail({
    to: adminRecipients,
    replyTo: email,
    subject: `New Inquiry Received: ${service}`,
    html: buildAdminInquiryHtml({
      name,
      phone,
      email,
      service,
      message,
      inquiryId,
    }),
  });

  await sendMail({
    to: [email],
    replyTo: env.CONTACT_REPLY_TO_EMAIL,
    subject: "Thank you for contacting us | Magic Brush Ltd",
    html: buildCustomerConfirmationHtml({
      name,
      phone,
      email,
      service,
      message,
      inquiryId,
    }),
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
      const response = jsonError("No authentication token provided", 401);
      clearLoginCookies(response);
      return response;
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
    const response = jsonError("Invalid authentication token", 401);
    clearLoginCookies(response);
    return response;
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
