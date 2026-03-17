import { firestoreDb } from "./firebase";

export type CreateServiceInput = {
  id: string;
  title: string;
  description: string;
  iconName: string;
  fullDetails: string;
  imageUrl: string;
  isActive?: boolean;
  sortOrder?: number;
};

export type UpdateServiceInput = Partial<{
  title: string;
  description: string;
  iconName: string;
  fullDetails: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
}>;

export async function createService(input: CreateServiceInput): Promise<{ id: string }> {
  const { id, title, description, iconName, fullDetails, imageUrl, isActive = true, sortOrder = 0 } = input;
  
  // Check if service ID already exists
  const existingService = await firestoreDb.collection("services").doc(id).get();
  if (existingService.exists) {
    throw new Error("Service with this ID already exists");
  }
  
  await firestoreDb.collection("services").doc(id).set({
    id,
    title: title.trim(),
    description: description.trim(),
    iconName: iconName.trim(),
    fullDetails: fullDetails.trim(),
    imageUrl: imageUrl.trim(),
    isActive,
    sortOrder,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  
  return { id };
}

export async function updateService(serviceId: string, updates: UpdateServiceInput): Promise<void> {
  const serviceRef = firestoreDb.collection("services").doc(serviceId);
  const serviceDoc = await serviceRef.get();
  
  if (!serviceDoc.exists) {
    throw new Error("Service not found");
  }
  
  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  // Trim string fields
  if (updates.title) updateData.title = updates.title.trim();
  if (updates.description) updateData.description = updates.description.trim();
  if (updates.iconName) updateData.iconName = updates.iconName.trim();
  if (updates.fullDetails) updateData.fullDetails = updates.fullDetails.trim();
  if (updates.imageUrl) updateData.imageUrl = updates.imageUrl.trim();
  
  await serviceRef.update(updateData);
}

export async function deleteService(serviceId: string): Promise<void> {
  const serviceRef = firestoreDb.collection("services").doc(serviceId);
  await serviceRef.delete();
}

export async function getAllServices(includeInactive = false): Promise<Array<{
  id: string;
  title: string;
  description: string;
  iconName: string;
  fullDetails: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}>> {
  let query = firestoreDb.collection("services").orderBy("sortOrder", "asc");
  
  if (!includeInactive) {
    query = query.where("isActive", "==", true);
  }
  
  const snapshot = await query.get();
  
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: data.id || doc.id,
      title: data.title,
      description: data.description,
      iconName: data.iconName,
      fullDetails: data.fullDetails,
      imageUrl: data.imageUrl,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });
}
