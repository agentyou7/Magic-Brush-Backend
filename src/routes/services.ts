import { Router } from "express";
import { z } from "zod";
import { firestoreDb } from "../lib/firebase";

const serviceDocSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  iconName: z.string().trim().min(1).optional().default("fa-tools"),
  fullDetails: z.string().trim().optional().default(""),
  imageUrl: z.string().trim().optional().default(""),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

export const servicesRouter = Router();

servicesRouter.get("/", async (_req, res) => {
  try {
    const snapshot = await firestoreDb.collection("services").get();

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
      .filter((service): service is NonNullable<typeof service> => Boolean(service));

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
  } catch (error) {
    console.error("Services API error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch services",
    });
  }
});
