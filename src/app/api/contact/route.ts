import { NextRequest, NextResponse } from "next/server";
import { firestoreDb } from "../../../lib/firebase";
import { contactBodySchema, jsonError, sendContactEmail } from "../../../lib/next-route-helpers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsedBody = contactBodySchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return jsonError("Invalid request payload", 400, {
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

    await sendContactEmail({
      name,
      phone,
      service,
      message,
      inquiryId: inquiryRef.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Your quote request has been submitted successfully",
        data: {
          inquiryId: inquiryRef.id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Contact API error:", error);
    return jsonError("Failed to submit contact request", 500);
  }
}
