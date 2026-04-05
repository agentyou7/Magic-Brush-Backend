import { Router } from "express";
import { firestoreDb } from "../lib/firebase";
import { contactBodySchema, sendContactEmails } from "../lib/next-route-helpers";

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

  const { name, phone, email, service, message } = parsedBody.data;

  try {
    const inquiryRef = await firestoreDb.collection("inquiries").add({
      name,
      phone,
      email,
      service,
      message,
      status: "new",
      createdAt: new Date().toISOString(),
      source: "website",
    });

    try {
      await sendContactEmails({
        name,
        phone,
        email,
        service,
        message,
        inquiryId: inquiryRef.id,
      });
    } catch (emailError) {
      console.error("Contact email delivery error:", emailError);
    }

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
