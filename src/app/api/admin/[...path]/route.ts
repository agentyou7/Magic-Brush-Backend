import { NextRequest, NextResponse } from "next/server";
import { type Query } from "firebase-admin/firestore";
import { z } from "zod";
import {
  createPortfolioItem,
  deletePortfolioItem,
  getAllPortfolioItems,
  updatePortfolioItem,
} from "../../../../lib/portfolio-management";
import {
  createService,
  deleteService,
  getAllServices,
  updateService,
} from "../../../../lib/service-management";
import { createUser, deleteUser, getAllUsers, updateUser } from "../../../../lib/user-creation";
import { firestoreDb } from "../../../../lib/firebase";
import { getAdminPayload, jsonError } from "../../../../lib/next-route-helpers";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const serviceFeatureSchema = z.object({
  iconName: z.string().trim().min(1),
  heading: z.string().trim().min(1),
  description: z.string().trim().min(1),
});

const createPortfolioSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  metaText: z.string().trim().min(1),
  imageUrl: z.string().trim().min(1),
  imagePublicId: z.string().trim().optional().default(""),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

const updatePortfolioSchema = z.object({
  title: z.string().trim().min(1).optional(),
  metaText: z.string().trim().min(1).optional(),
  imageUrl: z.string().trim().min(1).optional(),
  imagePublicId: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const inquiryStatusSchema = z.enum(["new", "called", "quoted", "won", "closed"]);
type InquiryStatus = z.infer<typeof inquiryStatusSchema>;

const updateInquiryStatusSchema = z.object({
  status: inquiryStatusSchema,
});

const inquiryFiltersSchema = z.object({
  status: z.string().trim().min(1).optional(),
  service: z.string().trim().min(1).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.string().optional().default("user"),
  isActive: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email is required").optional(),
  role: z.string().optional(),
  isActive: z.boolean().optional(),
});

const createServiceSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  shortHeading: z.string().trim().min(1),
  description: z.string().trim().min(1),
  iconName: z.string().trim().min(1),
  fullDetails: z.string().trim().min(1),
  imageUrl: z.string().trim().min(1),
  imagePublicId: z.string().trim().optional().default(""),
  features: z.array(serviceFeatureSchema).min(2).max(3),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

const updateServiceSchema = z.object({
  title: z.string().trim().min(1).optional(),
  shortHeading: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  iconName: z.string().trim().min(1).optional(),
  fullDetails: z.string().trim().min(1).optional(),
  imageUrl: z.string().trim().min(1).optional(),
  imagePublicId: z.string().trim().optional(),
  features: z.array(serviceFeatureSchema).min(2).max(3).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const ALLOWED_TRANSITIONS: Record<InquiryStatus, InquiryStatus[]> = {
  new: ["called"],
  called: ["quoted", "closed"],
  quoted: ["won", "closed"],
  won: ["closed"],
  closed: [],
};

function readQueryValue(queryValue: string | null) {
  return typeof queryValue === "string" && queryValue.length > 0 ? queryValue : undefined;
}

async function requireAdmin(request: NextRequest) {
  const authCheck = await getAdminPayload(request);
  if (authCheck.error) {
    return authCheck.error;
  }

  return authCheck.authPayload!;
}

async function getInquiries(request: NextRequest) {
  const parsedFilters = inquiryFiltersSchema.safeParse({
    status: readQueryValue(request.nextUrl.searchParams.get("status")),
    service: readQueryValue(request.nextUrl.searchParams.get("service")),
    dateFrom: readQueryValue(request.nextUrl.searchParams.get("dateFrom")),
    dateTo: readQueryValue(request.nextUrl.searchParams.get("dateTo")),
    limit: readQueryValue(request.nextUrl.searchParams.get("limit")),
  });

  if (!parsedFilters.success) {
    return jsonError("Invalid query parameters", 400, {
      errors: parsedFilters.error.flatten().fieldErrors,
    });
  }

  const { status, service, dateFrom, dateTo, limit } = parsedFilters.data;
  let query: Query = firestoreDb.collection("inquiries");

  if (status) {
    query = query.where("status", "==", status);
  }

  if (service) {
    query = query.where("service", "==", service);
  }

  if (dateFrom) {
    query = query.where("createdAt", ">=", dateFrom);
  }

  if (dateTo) {
    query = query.where("createdAt", "<=", dateTo);
  }

  query = query.orderBy("createdAt", "desc").limit(limit);
  const snapshot = await query.get();
  const inquiries = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      phone: data.phone,
      service: data.service,
      message: data.message,
      status: data.status,
      source: data.source,
      createdAt: data.createdAt,
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      inquiries,
      count: inquiries.length,
    },
  });
}

async function patchInquiryStatus(request: NextRequest, id: string, authPayload: { sub: string; email: string }) {
  const parsedBody = updateInquiryStatusSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return jsonError("Invalid request payload", 400, {
      errors: parsedBody.error.flatten().fieldErrors,
    });
  }

  const { status: nextStatus } = parsedBody.data;
  const inquiryRef = firestoreDb.collection("inquiries").doc(id);
  const inquirySnapshot = await inquiryRef.get();

  if (!inquirySnapshot.exists) {
    return jsonError("Inquiry not found", 404);
  }

  const inquiryData = inquirySnapshot.data();
  const currentStatus = inquiryStatusSchema.safeParse(inquiryData?.status).success
    ? (inquiryData?.status as InquiryStatus)
    : "new";
  const allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus];

  if (!allowedNextStatuses.includes(nextStatus)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid workflow status transition",
        data: {
          currentStatus,
          attemptedStatus: nextStatus,
          allowedStatuses: allowedNextStatuses,
        },
      },
      { status: 409 }
    );
  }

  const updatedAt = new Date().toISOString();
  const updatedBy = {
    id: authPayload.sub,
    email: authPayload.email,
  };

  await inquiryRef.update({
    status: nextStatus,
    updatedAt,
    updatedBy,
  });

  return NextResponse.json({
    success: true,
    message: "Inquiry status updated successfully",
    data: {
      id,
      status: nextStatus,
      previousStatus: currentStatus,
      updatedAt,
      updatedBy,
    },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) {
    return admin;
  }

  const { path } = await context.params;
  const route = path.join("/");

  try {
    if (route === "inquiries") {
      return await getInquiries(request);
    }

    if (route === "users") {
      const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10) || 50;
      const users = await getAllUsers(limit);
      return NextResponse.json({
        success: true,
        data: { users, count: users.length },
      });
    }

    if (route === "services/all") {
      const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";
      const services = await getAllServices(includeInactive);
      return NextResponse.json({
        success: true,
        data: { services, count: services.length },
      });
    }

    if (route === "portfolio/all") {
      const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";
      const portfolio = await getAllPortfolioItems(includeInactive);
      return NextResponse.json({
        success: true,
        data: { portfolio, count: portfolio.length },
      });
    }

    return jsonError("Not found", 404);
  } catch (error) {
    console.error("Admin GET error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to process admin request",
      500
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) {
    return admin;
  }

  const { path } = await context.params;
  const route = path.join("/");

  try {
    if (route === "users") {
      const parsedBody = createUserSchema.safeParse(await request.json());
      if (!parsedBody.success) {
        return jsonError("Invalid request payload", 400, {
          errors: parsedBody.error.flatten().fieldErrors,
        });
      }

      const user = await createUser(parsedBody.data);
      return NextResponse.json(
        {
          success: true,
          message: "User created successfully",
          data: user,
        },
        { status: 201 }
      );
    }

    if (route === "services") {
      const parsedBody = createServiceSchema.safeParse(await request.json());
      if (!parsedBody.success) {
        return jsonError("Invalid request payload", 400, {
          errors: parsedBody.error.flatten().fieldErrors,
        });
      }

      const service = await createService(parsedBody.data);
      return NextResponse.json(
        {
          success: true,
          message: "Service created successfully",
          data: service,
        },
        { status: 201 }
      );
    }

    if (route === "portfolio") {
      const parsedBody = createPortfolioSchema.safeParse(await request.json());
      if (!parsedBody.success) {
        return jsonError("Invalid request payload", 400, {
          errors: parsedBody.error.flatten().fieldErrors,
        });
      }

      const portfolioItem = await createPortfolioItem(parsedBody.data);
      return NextResponse.json(
        {
          success: true,
          message: "Portfolio item created successfully",
          data: portfolioItem,
        },
        { status: 201 }
      );
    }

    return jsonError("Not found", 404);
  } catch (error) {
    console.error("Admin POST error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to process admin request",
      500
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) {
    return admin;
  }

  const { path } = await context.params;

  try {
    if (path.length === 3 && path[0] === "inquiries" && path[2] === "status") {
      return await patchInquiryStatus(request, path[1], admin);
    }

    if (path.length === 2 && path[0] === "users") {
      const parsedBody = updateUserSchema.safeParse(await request.json());
      if (!parsedBody.success) {
        return jsonError("Invalid request payload", 400, {
          errors: parsedBody.error.flatten().fieldErrors,
        });
      }

      await updateUser(path[1], parsedBody.data);
      return NextResponse.json({
        success: true,
        message: "User updated successfully",
      });
    }

    if (path.length === 2 && path[0] === "services") {
      const parsedBody = updateServiceSchema.safeParse(await request.json());
      if (!parsedBody.success) {
        return jsonError("Invalid request payload", 400, {
          errors: parsedBody.error.flatten().fieldErrors,
        });
      }

      await updateService(path[1], parsedBody.data);
      return NextResponse.json({
        success: true,
        message: "Service updated successfully",
      });
    }

    if (path.length === 2 && path[0] === "portfolio") {
      const parsedBody = updatePortfolioSchema.safeParse(await request.json());
      if (!parsedBody.success) {
        return jsonError("Invalid request payload", 400, {
          errors: parsedBody.error.flatten().fieldErrors,
        });
      }

      await updatePortfolioItem(path[1], parsedBody.data);
      return NextResponse.json({
        success: true,
        message: "Portfolio item updated successfully",
      });
    }

    return jsonError("Not found", 404);
  } catch (error) {
    console.error("Admin PATCH error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to process admin request",
      500
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) {
    return admin;
  }

  const { path } = await context.params;

  try {
    if (path.length === 2 && path[0] === "users") {
      await deleteUser(path[1]);
      return NextResponse.json({
        success: true,
        message: "User deleted successfully",
      });
    }

    if (path.length === 2 && path[0] === "services") {
      await deleteService(path[1]);
      return NextResponse.json({
        success: true,
        message: "Service deleted successfully",
      });
    }

    if (path.length === 2 && path[0] === "portfolio") {
      await deletePortfolioItem(path[1]);
      return NextResponse.json({
        success: true,
        message: "Portfolio item deleted successfully",
      });
    }

    return jsonError("Not found", 404);
  } catch (error) {
    console.error("Admin DELETE error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to process admin request",
      500
    );
  }
}
