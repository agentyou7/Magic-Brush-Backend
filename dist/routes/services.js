"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.servicesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const firebase_1 = require("../lib/firebase");
const serviceDocSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1),
    title: zod_1.z.string().trim().min(1),
    description: zod_1.z.string().trim().min(1),
    iconName: zod_1.z.string().trim().min(1).optional().default("fa-tools"),
    fullDetails: zod_1.z.string().trim().optional().default(""),
    imageUrl: zod_1.z.string().trim().optional().default(""),
    isActive: zod_1.z.boolean().optional().default(true),
    sortOrder: zod_1.z.number().int().optional().default(0),
});
exports.servicesRouter = (0, express_1.Router)();
exports.servicesRouter.get("/", async (_req, res) => {
    try {
        const snapshot = await firebase_1.firestoreDb.collection("services").get();
        const services = snapshot.docs
            .map((doc) => {
            const data = doc.data();
            const parsed = serviceDocSchema.safeParse({
                ...data,
                id: data.id ?? doc.id,
                sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
                isActive: typeof data.isActive === "boolean" ? data.isActive : true,
            });
            if (!parsed.success) {
                return null;
            }
            const service = parsed.data;
            return {
                id: service.id,
                title: service.title,
                description: service.description,
                iconName: service.iconName,
                fullDetails: service.fullDetails,
                imageUrl: service.imageUrl,
                isActive: service.isActive,
                sortOrder: service.sortOrder,
            };
        })
            .filter((service) => Boolean(service));
        const activeServices = services
            .filter((service) => service.isActive)
            .sort((firstService, secondService) => firstService.sortOrder - secondService.sortOrder);
        return res.status(200).json({
            success: true,
            data: {
                services: activeServices,
                count: activeServices.length,
            },
        });
    }
    catch (error) {
        console.error("Services API error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch services",
        });
    }
});
