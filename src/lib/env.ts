import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  RESEND_API_KEY: z.string().min(1).optional(),
  CONTACT_FROM_EMAIL: z.string().min(1),
  CONTACT_NOTIFICATION_EMAIL: z.string().email(),
  CONTACT_REPLY_TO_EMAIL: z.string().email(),
  CONTACT_WEBSITE_URL: z.string().url().optional(),
  CONTACT_LOGO_URL: z.string().url().optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  FIREBASE_API_KEY: z.string().optional(),
  FIREBASE_AUTH_DOMAIN: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  FIREBASE_APP_ID: z.string().optional(),
  FIREBASE_MEASUREMENT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const messages = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${messages}`);
}

export const env = parsedEnv.data;
