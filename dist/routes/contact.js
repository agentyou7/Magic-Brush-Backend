"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const resend_1 = require("resend");
const firebase_1 = require("../lib/firebase");
const env_1 = require("../lib/env");
const resend = new resend_1.Resend(env_1.env.RESEND_API_KEY);
const phoneRegex = /^[+]?[\d\s\-()]{8,20}$/;
const contactBodySchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .trim()
        .min(2, "Name must be at least 2 characters")
        .max(80, "Name must be at most 80 characters"),
    phone: zod_1.z
        .string()
        .trim()
        .regex(phoneRegex, "Phone number format is invalid"),
    service: zod_1.z
        .string()
        .trim()
        .min(2, "Service is required")
        .max(100, "Service name is too long"),
    message: zod_1.z
        .string()
        .trim()
        .min(10, "Message must be at least 10 characters")
        .max(2000, "Message is too long"),
});
exports.contactRouter = (0, express_1.Router)();
exports.contactRouter.post("/", async (req, res) => {
    const parsedBody = contactBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid request payload",
            errors: parsedBody.error.flatten().fieldErrors,
        });
    }
    const { name, phone, service, message } = parsedBody.data;
    try {
        const inquiryRef = await firebase_1.firestoreDb.collection("inquiries").add({
            name,
            phone,
            service,
            message,
            status: "new",
            createdAt: new Date().toISOString(),
            source: "website",
        });
        await resend.emails.send({
            from: env_1.env.CONTACT_FROM_EMAIL,
            to: [env_1.env.CONTACT_NOTIFICATION_EMAIL],
            replyTo: env_1.env.CONTACT_REPLY_TO_EMAIL,
            subject: `New Quote Request: ${service}`,
            html: `
        <h2>New Quote Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Service:</strong> ${service}</p>
        <p><strong>Message:</strong> ${message}</p>
        <p><strong>Inquiry ID:</strong> ${inquiryRef.id}</p>
      `,
        });
        return res.status(201).json({
            success: true,
            message: "Your quote request has been submitted successfully",
            data: {
                inquiryId: inquiryRef.id,
            },
        });
    }
    catch (error) {
        console.error("Contact API error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to submit contact request",
        });
    }
});
