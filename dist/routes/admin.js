"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const firebase_1 = require("../lib/firebase");
const user_creation_1 = require("../lib/user-creation");
const service_management_1 = require("../lib/service-management");
const adminRouter = (0, express_1.Router)();
exports.adminRouter = adminRouter;
const serviceFeatureSchema = zod_1.z.object({
    iconName: zod_1.z.string().trim().min(1),
    heading: zod_1.z.string().trim().min(1),
    description: zod_1.z.string().trim().min(1),
});
const inquiryStatusSchema = zod_1.z.enum(["new", "called", "quoted", "won", "closed"]);
const updateInquiryStatusSchema = zod_1.z.object({
    status: inquiryStatusSchema,
});
const updateInquiryStatusParamsSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Inquiry id is required"),
});
const inquiryFiltersSchema = zod_1.z.object({
    status: zod_1.z.string().trim().min(1).optional(),
    service: zod_1.z.string().trim().min(1).optional(),
    dateFrom: zod_1.z.string().datetime().optional(),
    dateTo: zod_1.z.string().datetime().optional(),
    limit: zod_1.z.coerce.number().int().positive().max(200).default(50),
});
const ALLOWED_TRANSITIONS = {
    new: ["called"],
    called: ["quoted", "closed"],
    quoted: ["won", "closed"],
    won: ["closed"],
    closed: [],
};
function getRequestToken(req) {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        return authHeader.slice(7).trim();
    }
    const cookieToken = req.cookies?.access_token;
    return typeof cookieToken === "string" && cookieToken.length > 0
        ? cookieToken
        : null;
}
function readQueryValue(queryValue) {
    if (typeof queryValue === "string") {
        return queryValue;
    }
    if (Array.isArray(queryValue) && queryValue[0]) {
        return queryValue[0];
    }
    return undefined;
}
async function getAdminPayload(req) {
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
        const decodedToken = await firebase_1.firebaseAuth.verifyIdToken(token);
        const userRecord = await firebase_1.firebaseAuth.getUser(decodedToken.uid);
        const authPayload = {
            sub: decodedToken.uid,
            email: userRecord.email ?? decodedToken.email ?? "",
            role: typeof decodedToken.role === "string"
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
    }
    catch {
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
            status: readQueryValue(req.query.status),
            service: readQueryValue(req.query.service),
            dateFrom: readQueryValue(req.query.dateFrom),
            dateTo: readQueryValue(req.query.dateTo),
            limit: readQueryValue(req.query.limit),
        });
        if (!parsedFilters.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid query parameters",
                errors: parsedFilters.error.flatten().fieldErrors,
            });
        }
        const { status, service, dateFrom, dateTo, limit } = parsedFilters.data;
        let query = firebase_1.firestoreDb.collection("inquiries");
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
    }
    catch (error) {
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
                body: { success: false, message: "Unauthorized" },
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
        const inquiryRef = firebase_1.firestoreDb.collection("inquiries").doc(id);
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
            ? inquiryData?.status
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
    }
    catch (error) {
        console.error("Update inquiry status error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update inquiry status",
        });
    }
});
// User Management Routes
const createUserSchema = zod_1.z.object({
    email: zod_1.z.string().trim().toLowerCase().email("Valid email is required"),
    password: zod_1.z.string().min(8, "Password must be at least 8 characters"),
    role: zod_1.z.string().optional().default("user"),
    isActive: zod_1.z.boolean().optional().default(true),
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
        const user = await (0, user_creation_1.createUser)(parsedBody.data);
        return res.status(201).json({
            success: true,
            message: "User created successfully",
            data: user,
        });
    }
    catch (error) {
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
        const limit = parseInt(req.query.limit) || 50;
        const users = await (0, user_creation_1.getAllUsers)(limit);
        return res.status(200).json({
            success: true,
            data: { users, count: users.length },
        });
    }
    catch (error) {
        console.error("Get users error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch users",
        });
    }
});
const updateUserSchema = zod_1.z.object({
    email: zod_1.z.string().trim().toLowerCase().email("Valid email is required").optional(),
    role: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
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
        await (0, user_creation_1.updateUser)(userId, parsedBody.data);
        return res.status(200).json({
            success: true,
            message: "User updated successfully",
        });
    }
    catch (error) {
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
        await (0, user_creation_1.deleteUser)(userId);
        return res.status(200).json({
            success: true,
            message: "User deleted successfully",
        });
    }
    catch (error) {
        console.error("Delete user error:", error);
        return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Failed to delete user",
        });
    }
});
// Service Management Routes
const createServiceSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1),
    title: zod_1.z.string().trim().min(1),
    shortHeading: zod_1.z.string().trim().min(1),
    description: zod_1.z.string().trim().min(1),
    iconName: zod_1.z.string().trim().min(1),
    fullDetails: zod_1.z.string().trim().min(1),
    imageUrl: zod_1.z.string().trim().min(1),
    imagePublicId: zod_1.z.string().trim().optional().default(""),
    features: zod_1.z.array(serviceFeatureSchema).min(2).max(3),
    isActive: zod_1.z.boolean().optional().default(true),
    sortOrder: zod_1.z.number().int().optional().default(0),
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
        const service = await (0, service_management_1.createService)(parsedBody.data);
        return res.status(201).json({
            success: true,
            message: "Service created successfully",
            data: service,
        });
    }
    catch (error) {
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
        const services = await (0, service_management_1.getAllServices)(includeInactive);
        return res.status(200).json({
            success: true,
            data: { services, count: services.length },
        });
    }
    catch (error) {
        console.error("Get services error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch services",
        });
    }
});
const updateServiceSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).optional(),
    shortHeading: zod_1.z.string().trim().min(1).optional(),
    description: zod_1.z.string().trim().min(1).optional(),
    iconName: zod_1.z.string().trim().min(1).optional(),
    fullDetails: zod_1.z.string().trim().min(1).optional(),
    imageUrl: zod_1.z.string().trim().min(1).optional(),
    imagePublicId: zod_1.z.string().trim().optional(),
    features: zod_1.z.array(serviceFeatureSchema).min(2).max(3).optional(),
    isActive: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().optional(),
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
        await (0, service_management_1.updateService)(serviceId, parsedBody.data);
        return res.status(200).json({
            success: true,
            message: "Service updated successfully",
        });
    }
    catch (error) {
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
        await (0, service_management_1.deleteService)(serviceId);
        return res.status(200).json({
            success: true,
            message: "Service deleted successfully",
        });
    }
    catch (error) {
        console.error("Delete service error:", error);
        return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Failed to delete service",
        });
    }
});
