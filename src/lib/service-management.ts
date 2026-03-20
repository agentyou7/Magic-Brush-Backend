import { firestoreDb } from "./firebase";

export type CreateServiceInput = {
  id: string;
  title: string;
  shortHeading: string;
  description: string;
  iconName: string;
  fullDetails: string;
  imageUrl: string;
  imagePublicId?: string;
  features: Array<{
    iconName: string;
    heading: string;
    description: string;
  }>;
  isActive?: boolean;
  sortOrder?: number;
};

export type UpdateServiceInput = Partial<{
  title: string;
  shortHeading: string;
  description: string;
  iconName: string;
  fullDetails: string;
  imageUrl: string;
  imagePublicId: string;
  features: Array<{
    iconName: string;
    heading: string;
    description: string;
  }>;
  isActive: boolean;
  sortOrder: number;
}>;

export async function createService(input: CreateServiceInput): Promise<{ id: string }> {
  const {
    id,
    title,
    shortHeading,
    description,
    iconName,
    fullDetails,
    imageUrl,
    imagePublicId = "",
    features,
    isActive = true,
    sortOrder = 0,
  } = input;
  
  // Check if service ID already exists
  const existingService = await firestoreDb.collection("services").doc(id).get();
  if (existingService.exists) {
    throw new Error("Service with this ID already exists");
  }

  const sanitizedFeatures = features.map((feature, index) => ({
    id: `feature_${index + 1}`,
    iconName: feature.iconName.trim(),
    heading: feature.heading.trim(),
    description: feature.description.trim(),
  }));
  
  await firestoreDb.collection("services").doc(id).set({
    id,
    title: title.trim(),
    shortHeading: shortHeading.trim(),
    description: description.trim(),
    iconName: iconName.trim(),
    fullDetails: fullDetails.trim(),
    imageUrl: imageUrl.trim(),
    imagePublicId: imagePublicId.trim(),
    features: sanitizedFeatures,
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
  if (updates.shortHeading) updateData.shortHeading = updates.shortHeading.trim();
  if (updates.description) updateData.description = updates.description.trim();
  if (updates.iconName) updateData.iconName = updates.iconName.trim();
  if (updates.fullDetails) updateData.fullDetails = updates.fullDetails.trim();
  if (updates.imageUrl) updateData.imageUrl = updates.imageUrl.trim();
  if (updates.imagePublicId) updateData.imagePublicId = updates.imagePublicId.trim();
  if (updates.features) {
    updateData.features = updates.features.map((feature, index) => ({
      id: `feature_${index + 1}`,
      iconName: feature.iconName.trim(),
      heading: feature.heading.trim(),
      description: feature.description.trim(),
    }));
  }
  
  await serviceRef.update(updateData);
}

export async function deleteService(serviceId: string): Promise<void> {
  const serviceRef = firestoreDb.collection("services").doc(serviceId);
  await serviceRef.delete();
}

export async function getAllServices(includeInactive = false): Promise<Array<{
  id: string;
  title: string;
  shortHeading: string;
  description: string;
  iconName: string;
  fullDetails: string;
  imageUrl: string;
  imagePublicId: string;
  features: Array<{
    id: string;
    iconName: string;
    heading: string;
    description: string;
  }>;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}>> {
  const snapshot = await firestoreDb.collection("services").get();

  const services = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: data.id || doc.id,
      title: data.title,
      shortHeading: data.shortHeading || "",
      description: data.description,
      iconName: data.iconName || "fa-tools",
      fullDetails: data.fullDetails || "",
      imageUrl: data.imageUrl || "",
      imagePublicId: data.imagePublicId || "",
      features: Array.isArray(data.features) ? data.features : [],
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });

  return services
    .filter((service) => includeInactive || service.isActive)
    .sort((firstService, secondService) => firstService.sortOrder - secondService.sortOrder);
}
