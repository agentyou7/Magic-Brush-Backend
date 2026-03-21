import { Router } from "express";
import { z } from "zod";
import { firestoreDb } from "../lib/firebase";

const portfolioDocSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  metaText: z.string().trim().min(1),
  imageUrl: z.string().trim().min(1),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

export const portfolioRouter = Router();

portfolioRouter.get("/", async (_req, res) => {
  try {
    const snapshot = await firestoreDb.collection("portfolio").get();

    const portfolioItems = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const parsed = portfolioDocSchema.safeParse({
          ...data,
          id: data.id ?? doc.id,
          sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
          isActive: typeof data.isActive === "boolean" ? data.isActive : true,
        });

        if (!parsed.success) {
          return null;
        }

        const item = parsed.data;
        return {
          id: item.id,
          title: item.title,
          metaText: item.metaText,
          imageUrl: item.imageUrl,
          isActive: item.isActive,
          sortOrder: item.sortOrder,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const activePortfolioItems = portfolioItems
      .filter((item) => item.isActive)
      .sort((firstItem, secondItem) => firstItem.sortOrder - secondItem.sortOrder);

    return res.status(200).json({
      success: true,
      data: {
        portfolio: activePortfolioItems,
        count: activePortfolioItems.length,
      },
    });
  } catch (error) {
    console.error("Portfolio API error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch portfolio items",
    });
  }
});
