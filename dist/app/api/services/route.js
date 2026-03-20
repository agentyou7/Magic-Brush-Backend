"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.GET = GET;
const server_1 = require("next/server");
const firebase_1 = require("../../../lib/firebase");
function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}
function validateServicePayload(serviceData) {
    const title = normalizeText(serviceData.title);
    const shortHeading = normalizeText(serviceData.shortHeading);
    const description = normalizeText(serviceData.description);
    const fullDetails = normalizeText(serviceData.fullDetails);
    const iconName = normalizeText(serviceData.iconName);
    const imageUrl = normalizeText(serviceData.imageUrl);
    if (!title || !shortHeading || !description || !fullDetails || !iconName || !imageUrl) {
        return { error: "Please fill in all required service fields." };
    }
    if (!Array.isArray(serviceData.features) || serviceData.features.length < 2) {
        return { error: "At least 2 features are required." };
    }
    const features = serviceData.features.map((feature, index) => {
        const heading = normalizeText(feature.heading);
        const featureDescription = normalizeText(feature.description);
        const featureIconName = normalizeText(feature.iconName);
        if (!heading || !featureDescription || !featureIconName) {
            throw new Error(`Feature ${index + 1} is missing required fields.`);
        }
        return {
            id: `feature_${index + 1}`,
            iconName: featureIconName,
            heading,
            description: featureDescription,
        };
    });
    return {
        data: {
            title,
            shortHeading,
            description,
            fullDetails,
            iconName,
            imageUrl,
            imagePublicId: normalizeText(serviceData.imagePublicId),
            features,
            isActive: serviceData.isActive ?? true,
        },
    };
}
async function POST(request) {
    try {
        const serviceData = (await request.json());
        const validation = validateServicePayload(serviceData);
        if ("error" in validation) {
            return server_1.NextResponse.json({ success: false, error: validation.error }, { status: 400 });
        }
        const serviceRef = firebase_1.firestoreDb.collection("services").doc();
        const now = new Date().toISOString();
        await serviceRef.set({
            id: serviceRef.id,
            ...validation.data,
            createdAt: now,
            updatedAt: now,
        });
        return server_1.NextResponse.json({
            success: true,
            data: {
                id: serviceRef.id,
                message: "Service created successfully",
            },
        });
    }
    catch (error) {
        console.error("Service creation failed:", error);
        return server_1.NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to create service",
        }, { status: 500 });
    }
}
async function GET() {
    try {
        const snapshot = await firebase_1.firestoreDb.collection("services").get();
        const services = snapshot.docs.map((serviceDoc) => {
            const data = serviceDoc.data();
            return {
                ...data,
                id: data.id || serviceDoc.id,
            };
        });
        return server_1.NextResponse.json({
            success: true,
            data: { services },
        });
    }
    catch (error) {
        console.error("Service fetch failed:", error);
        return server_1.NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch services",
        }, { status: 500 });
    }
}
