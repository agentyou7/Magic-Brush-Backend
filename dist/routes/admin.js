"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const firebase_1 = require("../lib/firebase");
const auth_1 = require("../lib/auth");
const adminRouter = (0, express_1.Router)();
exports.adminRouter = adminRouter;
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
function getAdminPayload(req) {
    const token = getRequestToken(req);
    if (!token) {
        return {
            error: {
                status: 401,
                body: { success: false, message: "Unauthorized" },
            },
        };
    }
    let authPayload;
    try {
        authPayload = (0, auth_1.verifyAccessToken)(token);
    }
    catch {
        return {
            error: {
                status: 401,
                body: { success: false, message: "Invalid token" },
            },
        };
    }
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
adminRouter.get("/inquiries", async (req, res) => {
    try {
        const authCheck = getAdminPayload(req);
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
        const authCheck = getAdminPayload(req);
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
