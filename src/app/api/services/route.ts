import { NextRequest, NextResponse } from "next/server";
import { firestoreDb } from "../../../lib/firebase";

type IncomingFeature = {
  iconName?: string;
  heading?: string;
  description?: string;
};

type IncomingService = {
  title?: string;
  shortHeading?: string;
  description?: string;
  fullDetails?: string;
  iconName?: string;
  imageUrl?: string;
  imagePublicId?: string;
  features?: IncomingFeature[];
  isActive?: boolean;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validateServicePayload(serviceData: IncomingService) {
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

export async function POST(request: NextRequest) {
  try {
    const serviceData = (await request.json()) as IncomingService;
    const validation = validateServicePayload(serviceData);

    if ("error" in validation) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const serviceRef = firestoreDb.collection("services").doc();
    const now = new Date().toISOString();

    await serviceRef.set({
      id: serviceRef.id,
      ...validation.data,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: serviceRef.id,
        message: "Service created successfully",
      },
    });
  } catch (error) {
    console.error("Service creation failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create service",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const snapshot = await firestoreDb.collection("services").get();

    const services = snapshot.docs.map((serviceDoc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = serviceDoc.data();

      return {
        ...data,
        id: data.id || serviceDoc.id,
      };
    });

    return NextResponse.json({
      success: true,
      data: { services },
    });
  } catch (error) {
    console.error("Service fetch failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch services",
      },
      { status: 500 }
    );
  }
}
