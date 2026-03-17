import { Router } from "express";
import { z } from "zod";
import { firestoreDb } from "../lib/firebase";

const serviceDocSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  iconName: z.string().trim().min(1),
  fullDetails: z.string().trim().min(1),
  imageUrl: z.string().trim().min(1),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

export const servicesRouter = Router();

servicesRouter.get("/", async (_req, res) => {
  try {
    const snapshot = await firestoreDb
      .collection("services")
      .where("isActive", "==", true)
      .orderBy("sortOrder", "asc")
      .get();

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
          sortOrder: service.sortOrder,
        };
      })
      .filter((service): service is NonNullable<typeof service> => Boolean(service));

    return res.status(200).json({
      success: true,
      data: {
        services,
        count: services.length,
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
