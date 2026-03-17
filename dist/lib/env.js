"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().int().positive().default(4000),
    CORS_ORIGIN: zod_1.z.string().default("http://localhost:3000"),
    RESEND_API_KEY: zod_1.z.string().min(1),
    CONTACT_FROM_EMAIL: zod_1.z.string().min(1),
    CONTACT_NOTIFICATION_EMAIL: zod_1.z.string().email(),
    CONTACT_REPLY_TO_EMAIL: zod_1.z.string().email(),
    FIREBASE_API_KEY: zod_1.z.string().optional(),
    FIREBASE_AUTH_DOMAIN: zod_1.z.string().optional(),
    FIREBASE_PROJECT_ID: zod_1.z.string().min(1),
    FIREBASE_MESSAGING_SENDER_ID: zod_1.z.string().optional(),
    FIREBASE_APP_ID: zod_1.z.string().optional(),
    FIREBASE_MEASUREMENT_ID: zod_1.z.string().optional(),
    FIREBASE_CLIENT_EMAIL: zod_1.z.string().email(),
    FIREBASE_PRIVATE_KEY: zod_1.z.string().min(1),
    FIREBASE_STORAGE_BUCKET: zod_1.z.string().optional(),
    JWT_SECRET: zod_1.z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_EXPIRES_IN: zod_1.z.string().default("1d"),
});
const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
    const messages = parsedEnv.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
    throw new Error(`Invalid environment configuration: ${messages}`);
}
exports.env = parsedEnv.data;
