import { type Request, Router } from "express";
import { type Query } from "firebase-admin/firestore";
import { z } from "zod";
import { firestoreDb, firebaseAuth } from "../lib/firebase";
import { createUser, updateUser, deleteUser, getAllUsers } from "../lib/user-creation";
import { createService, updateService, deleteService, getAllServices } from "../lib/service-management";
import {
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  getAllPortfolioItems,
} from "../lib/portfolio-management";

const adminRouter = Router();

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

const updateInquiryStatusParamsSchema = z.object({
  id: z.string().trim().min(1, "Inquiry id is required"),
});

const inquiryFiltersSchema = z.object({
  status: z.string().trim().min(1).optional(),
  service: z.string().trim().min(1).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

const ALLOWED_TRANSITIONS: Record<InquiryStatus, InquiryStatus[]> = {
  new: ["called"],
  called: ["quoted", "closed"],
  quoted: ["won", "closed"],
  won: ["closed"],
  closed: [],
};

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

function readQueryValue(
  queryValue: string | string[] | undefined
): string | undefined {
  if (typeof queryValue === "string") {
    return queryValue;
  }

  if (Array.isArray(queryValue) && queryValue[0]) {
    return queryValue[0];
  }

  return undefined;
}

async function getAdminPayload(req: Request): Promise<{
  authPayload?: { sub: string; email: string; role: string };
  error?: { status: number; body: { success: false; message: string } };
}> {
  const token = getRequestToken(req);
  if (!token) {
    return {
      error: {
        status: 401,
        body: { success: false, message: "Unauthorized" },
      },
    };
  }

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(token);
    const userRecord = await firebaseAuth.getUser(decodedToken.uid);
    const authPayload = {
      sub: decodedToken.uid,
      email: userRecord.email ?? decodedToken.email ?? "",
      role:
        typeof decodedToken.role === "string"
          ? decodedToken.role
          : "admin",
    };

    if (authPayload.role !== "admin") {
      return {
        error: {
          status: 403,
          body: { success: false, message: "Forbidden" },
        },
      };
    }

    return { authPayload };
  } catch {
    return {
      error: {
        status: 401,
        body: { success: false, message: "Invalid token" },
      },
    };
  }
}

adminRouter.get("/inquiries", async (req, res) => {
  try {
    const authCheck = await getAdminPayload(req);
    if (authCheck.error) {
      return res.status(authCheck.error.status).json(authCheck.error.body);
    }

    const parsedFilters = inquiryFiltersSchema.safeParse({
      status: readQueryValue(req.query.status as string | string[] | undefined),
      service: readQueryValue(
        req.query.service as string | string[] | undefined
      ),
      dateFrom: readQueryValue(
        req.query.dateFrom as string | string[] | undefined
      ),
      dateTo: readQueryValue(req.query.dateTo as string | string[] | undefined),
      limit: readQueryValue(req.query.limit as string | string[] | undefined),
    });

    if (!parsedFilters.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters",
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

    return res.status(200).json({
      success: true,
      data: {
        inquiries,
        count: inquiries.length,
      },
    });
  } catch (error) {
    console.error("Admin inquiries error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch inquiries",
    });
  }
});

adminRouter.patch("/inquiries/:id/status", async (req, res) => {
  try {
    const authCheck = await getAdminPayload(req);
    if (authCheck.error || !authCheck.authPayload) {
      const fallback = authCheck.error ?? {
        status: 401,
        body: { success: false as const, message: "Unauthorized" },
      };
      return res.status(fallback.status).json(fallback.body);
    }

    const parsedParams = updateInquiryStatusParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid route parameters",
        errors: parsedParams.error.flatten().fieldErrors,
      });
    }

    const parsedBody = updateInquiryStatusSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request payload",
        errors: parsedBody.error.flatten().fieldErrors,
      });
    }

    const { id } = parsedParams.data;
    const { status: nextStatus } = parsedBody.data;
    const inquiryRef = firestoreDb.collection("inquiries").doc(id);
    const inquirySnapshot = await inquiryRef.get();

    if (!inquirySnapshot.exists) {
      return res.status(404).json({
        success: false,
        message: "Inquiry not found",
      });
    }

    const inquiryData = inquirySnapshot.data();
    const currentStatus = inquiryStatusSchema.safeParse(inquiryData?.status)
      .success
      ? (inquiryData?.status as InquiryStatus)
      : "new";

    const allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus];
    if (!allowedNextStatuses.includes(nextStatus)) {
      return res.status(409).json({
        success: false,
        message: "Invalid workflow status transition",
        data: {
          currentStatus,
          attemptedStatus: nextStatus,
          allowedStatuses: allowedNextStatuses,
        },
      });
    }

    const updatedAt = new Date().toISOString();
    const updatedBy = {
      id: authCheck.authPayload.sub,
      email: authCheck.authPayload.email,
    };

    await inquiryRef.update({
      status: nextStatus,
      updatedAt,
      updatedBy,
    });

    return res.status(200).json({
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
  } catch (error) {
    console.error("Update inquiry status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update inquiry status",
    });
  }
});

// User Management Routes
const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.string().optional().default("user"),
  isActive: z.boolean().optional().default(true),
});

adminRouter.post("/users", async (req, res) => {
  try {
    const authCheck = await getAdminPayload(req);
    if (authCheck.error) {
      return res.status(authCheck.error.status).json(authCheck.error.body);
    }

    const parsedBody = createUserSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request payload",
        errors: parsedBody.error.flatten().fieldErrors,
      });
    }

    const user = await createUser(parsedBody.data);
    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create user",
    });
  }
});

adminRouter.get("/users", async (req, res) => {
  try {
    const authCheck = await getAdminPayload(req);
    if (authCheck.error) {
      return res.status(authCheck.error.status).json(authCheck.error.body);
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const users = await getAllUsers(limit);
    
    return res.status(200).json({
      success: true,
      data: { users, count: users.length },
    });
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
});

const updateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email is required").optional(),
  role: z.string().optional(),
  isActive: z.boolean().optional(),
});

adminRouter.patch("/users/:id", async (req, res) => {
  try {
    const authCheck = await getAdminPayload(req);
    if (authCheck.error) {
      return res.status(authCheck.error.status).json(authCheck.error.body);
    }

    const userId = req.params.id;
    const parsedBody = updateUserSchema.safeParse(req.body);
    
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request payload",
        errors: parsedBody.error.flatten().fieldErrors,
      });
    }

    await updateUser(userId, parsedBody.data);
    return res.status(200).json({
      success: true,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update user",
    });
  }
});

adminRouter.delete("/users/:id", async (req, res) => {
  try {
    const authCheck = await getAdminPayload(req);
    if (authCheck.error) {
      return res.status(authCheck.error.status).json(authCheck.error.body);
    }

    const userId = req.params.id;
    await deleteUser(userId);
    
    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete user",
    });
  }
});

// Service Management Routes
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

adminRouter.post("/services", async (req, res) => {
  try {
    const authCheck = await getAdminPayload(req);
    if (authCheck.error) {
      return res.status(authCheck.error.status).json(authCheck.error.body);
    }

    const parsedBody = createServiceSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request payload",
        errors: parsedBody.error.flatten().fieldErrors,
      });
    }

    const service = await createService(parsedBody.data);
    return res.status(201).json({
      success: true,
      message: "Service created successfully",
      data: service,
    });
  } catch (error) {
    console.error("Create service error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create service",
    });
  }
});

adminRouter.get("/services/all", async (req, res) => {
  try {
    const authCheck = await getAdminPayload(req);
    if (authCheck.error) {
      return res.status(authCheck.error.status).json(authCheck.error.body);
    }

    const includeInactive = req.query.includeInactive === "true";
    const services = await getAllServices(includeInactive);
    
    return res.status(200).json({
      success: true,
      data: { services, count: services.length },
    });
  } catch (error) {
    console.error("Get services error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch services",
    });
  }
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

adminRouter.patch("/services/:id", async (req, res) => {
  try {
    const authCheck = await getAdminPayload(req);
    if (authCheck.error) {
      return res.status(authCheck.error.status).json(authCheck.error.body);
    }

    const serviceId = req.params.id;
    const parsedBody = updateServiceSchema.safeParse(req.body);
    
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request payload",
        errors: parsedBody.error.flatten().fieldErrors,
      });
    }

    await updateService(serviceId, parsedBody.data);
    return res.status(200).json({
      success: true,
      message: "Service updated successfully",
    });
  } catch (error) {
    console.error("Update service error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update service",
    });
  }
});

adminRouter.delete("/services/:id", async (req, res) => {
  try {
    const authCheck = await getAdminPayload(req);
    if (authCheck.error) {
      return res.status(authCheck.error.status).json(authCheck.error.body);
    }

    const serviceId = req.params.id;
    await deleteService(serviceId);
    
    return res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    console.error("Delete service error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete service",
    });
  }
});

adminRouter.post("/portfolio", async (req, res) => {
  try {
    const authCheck = await getAdminPayload(req);
    if (authCheck.error) {
      return res.status(authCheck.error.status).json(authCheck.error.body);
    }

    const parsedBody = createPortfolioSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request payload",
        errors: parsedBody.error.flatten().fieldErrors,
      });
    }

    const portfolioItem = await createPortfolioItem(parsedBody.data);
    return res.status(201).json({
      success: true,
      message: "Portfolio item created successfully",
      data: portfolioItem,
    });
  } catch (error) {
    console.error("Create portfolio item error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create portfolio item",
    });
  }
});

adminRouter.get("/portfolio/all", async (req, res) => {
  try {
    const authCheck = await getAdminPayload(req);
    if (authCheck.error) {
      return res.status(authCheck.error.status).json(authCheck.error.body);
    }

    const includeInactive = req.query.includeInactive === "true";
    const portfolio = await getAllPortfolioItems(includeInactive);

    return res.status(200).json({
      success: true,
      data: { portfolio, count: portfolio.length },
    });
  } catch (error) {
    console.error("Get portfolio items error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch portfolio items",
    });
  }
});

adminRouter.patch("/portfolio/:id", async (req, res) => {
  try {
    const authCheck = await getAdminPayload(req);
    if (authCheck.error) {
      return res.status(authCheck.error.status).json(authCheck.error.body);
    }

    const portfolioId = req.params.id;
    const parsedBody = updatePortfolioSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request payload",
        errors: parsedBody.error.flatten().fieldErrors,
      });
    }

    await updatePortfolioItem(portfolioId, parsedBody.data);
    return res.status(200).json({
      success: true,
      message: "Portfolio item updated successfully",
    });
  } catch (error) {
    console.error("Update portfolio item error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update portfolio item",
    });
  }
});

adminRouter.delete("/portfolio/:id", async (req, res) => {
  try {
    const authCheck = await getAdminPayload(req);
    if (authCheck.error) {
      return res.status(authCheck.error.status).json(authCheck.error.body);
    }

    const portfolioId = req.params.id;
    await deletePortfolioItem(portfolioId);

    return res.status(200).json({
      success: true,
      message: "Portfolio item deleted successfully",
    });
  } catch (error) {
    console.error("Delete portfolio item error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete portfolio item",
    });
  }
});

export { adminRouter };
