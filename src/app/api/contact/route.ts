import { NextRequest, NextResponse } from "next/server";
import { firestoreDb } from "../../../lib/firebase";
import { buildOptionsResponse, withCors } from "../../../lib/cors";
import { contactBodySchema, jsonError, sendContactEmail } from "../../../lib/next-route-helpers";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  return buildOptionsResponse(request.headers.get("origin"));
}

export async function POST(request: NextRequest) {
  const parsedBody = contactBodySchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return withCors(
      jsonError("Invalid request payload", 400, {
        errors: parsedBody.error.flatten().fieldErrors,
      }),
      request.headers.get("origin")
    );
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

    return withCors(
      NextResponse.json(
        {
          success: true,
          message: "Your quote request has been submitted successfully",
          data: {
            inquiryId: inquiryRef.id,
          },
        },
        { status: 201 }
      ),
      request.headers.get("origin")
    );
  } catch (error) {
    console.error("Contact API error:", error);
    return withCors(
      jsonError("Failed to submit contact request", 500),
      request.headers.get("origin")
    );
  }
}
