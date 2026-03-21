import { firestoreDb } from "./firebase";

export type CreatePortfolioItemInput = {
  id: string;
  title: string;
  metaText: string;
  imageUrl: string;
  imagePublicId?: string;
  isActive?: boolean;
  sortOrder?: number;
};

export type UpdatePortfolioItemInput = Partial<{
  title: string;
  metaText: string;
  imageUrl: string;
  imagePublicId: string;
  isActive: boolean;
  sortOrder: number;
}>;

export async function createPortfolioItem(
  input: CreatePortfolioItemInput
): Promise<{ id: string }> {
  const {
    id,
    title,
    metaText,
    imageUrl,
    imagePublicId = "",
    isActive = true,
    sortOrder = 0,
  } = input;

  const existingItem = await firestoreDb.collection("portfolio").doc(id).get();
  if (existingItem.exists) {
    throw new Error("Portfolio item with this ID already exists");
  }

  await firestoreDb.collection("portfolio").doc(id).set({
    id,
    title: title.trim(),
    metaText: metaText.trim(),
    imageUrl: imageUrl.trim(),
    imagePublicId: imagePublicId.trim(),
    isActive,
    sortOrder,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return { id };
}

export async function updatePortfolioItem(
  portfolioId: string,
  updates: UpdatePortfolioItemInput
): Promise<void> {
  const portfolioRef = firestoreDb.collection("portfolio").doc(portfolioId);
  const portfolioDoc = await portfolioRef.get();

  if (!portfolioDoc.exists) {
    throw new Error("Portfolio item not found");
  }

  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (updates.title) updateData.title = updates.title.trim();
  if (updates.metaText) updateData.metaText = updates.metaText.trim();
  if (updates.imageUrl) updateData.imageUrl = updates.imageUrl.trim();
  if (updates.imagePublicId) updateData.imagePublicId = updates.imagePublicId.trim();

  await portfolioRef.update(updateData);
}

export async function deletePortfolioItem(portfolioId: string): Promise<void> {
  await firestoreDb.collection("portfolio").doc(portfolioId).delete();
}

export async function getAllPortfolioItems(includeInactive = false): Promise<
  Array<{
    id: string;
    title: string;
    metaText: string;
    imageUrl: string;
    imagePublicId: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
  }>
> {
  const snapshot = await firestoreDb.collection("portfolio").get();

  const items = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: data.id || doc.id,
      title: data.title || "",
      metaText: data.metaText || "",
      imageUrl: data.imageUrl || "",
      imagePublicId: data.imagePublicId || "",
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      createdAt: data.createdAt || "",
      updatedAt: data.updatedAt || "",
    };
  });

  return items
    .filter((item) => includeInactive || item.isActive)
    .sort((firstItem, secondItem) => firstItem.sortOrder - secondItem.sortOrder);
}
