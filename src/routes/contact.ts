import { Router } from "express";
import { z } from "zod";
import { Resend } from "resend";
import { firestoreDb } from "../lib/firebase";
import { env } from "../lib/env";

const resend = new Resend(env.RESEND_API_KEY);

const phoneRegex = /^[+]?[\d\s\-()]{8,20}$/;

const contactBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be at most 80 characters"),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, "Phone number format is invalid"),
  service: z
    .string()
    .trim()
    .min(2, "Service is required")
    .max(100, "Service name is too long"),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message is too long"),
});

export const contactRouter = Router();

contactRouter.post("/", async (req, res) => {
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
    const inquiryRef = await firestoreDb.collection("inquiries").add({
      name,
      phone,
      service,
      message,
      status: "new",
      createdAt: new Date().toISOString(),
      source: "website",
    });

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
  } catch (error) {
    console.error("Contact API error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit contact request",
    });
  }
});
