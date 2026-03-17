import { type Request, Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { getUserByEmail } from "../lib/db";
import { signAccessToken, verifyAccessToken, verifyPassword } from "../lib/auth";

const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Try again later." },
});

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
    const user = await getUserByEmail(email);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role ?? "user",
    });

    res.cookie("access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        tokenType: "Bearer",
        user: {
          id: user.id,
          email: user.email,
          role: user.role ?? "user",
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

authRouter.get("/me", (req, res) => {
  try {
    const token = getRequestToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const payload = verifyAccessToken(token);
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        },
      },
    });
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("access_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});
