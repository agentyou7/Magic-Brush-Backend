import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { buildOptionsResponse, withCors } from '../../../lib/cors';
import { firestoreDb } from '../../../lib/firebase';

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

export async function OPTIONS(request: NextRequest) {
  return buildOptionsResponse(request.headers.get('origin'));
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateServicePayload(serviceData: IncomingService) {
  const title = normalizeText(serviceData.title);
  const shortHeading = normalizeText(serviceData.shortHeading);
  const description = normalizeText(serviceData.description);
  const fullDetails = normalizeText(serviceData.fullDetails);
  const iconName = normalizeText(serviceData.iconName);
  const imageUrl = normalizeText(serviceData.imageUrl);

  if (!title || !shortHeading || !description || !fullDetails || !iconName || !imageUrl) {
    return { error: 'Please fill in all required service fields.' };
  }

  if (!Array.isArray(serviceData.features) || serviceData.features.length < 2) {
    return { error: 'At least 2 features are required.' };
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

    if ('error' in validation) {
      return withCors(
        NextResponse.json({ success: false, error: validation.error }, { status: 400 }),
        request.headers.get('origin')
      );
    }

    const serviceRef = firestoreDb.collection('services').doc();
    const now = new Date().toISOString();

    await serviceRef.set({
      id: serviceRef.id,
      ...validation.data,
      createdAt: now,
      updatedAt: now,
    });

    return withCors(
      NextResponse.json({
        success: true,
        data: {
          id: serviceRef.id,
          message: 'Service created successfully',
        },
      }),
      request.headers.get('origin')
    );
  } catch (error) {
    console.error('Service creation failed:', error);

    return withCors(
      NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create service',
        },
        { status: 500 }
      ),
      request.headers.get('origin')
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('ðŸ”¥ Fetching all services from Firebase...');

    // Check if Firebase is initialized
    if (!firestoreDb) {
      console.error('âŒ Firestore not initialized');
      return withCors(
        NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
        ),
        request.headers.get("origin")
      );
    }

    // Fetch all services (both active and inactive)
    const servicesCollection = firestoreDb.collection('services');
    const servicesSnapshot = await servicesCollection.get();

    const services = servicesSnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data()
    }));

    // Count active vs inactive
    const activeCount = services.filter((service: any) => service.isActive !== false).length;
    const inactiveCount = services.filter((service: any) => service.isActive === false).length;
    console.log(`âœ… Found ${services.length} total services (Active: ${activeCount}, Inactive: ${inactiveCount})`);

    return withCors(
      NextResponse.json({
        success: true,
        data: {
          services: services,
          total: services.length
        }
      }),
      request.headers.get("origin")
    );

  } catch (error) {
    console.error('ðŸ’¥ Error fetching services:', error);
    console.error('ðŸ’¥ Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
    });
    
    return withCors(
      NextResponse.json(
        { error: 'Failed to fetch services: ' + (error as Error).message },
        { status: 500 }
      ),
      request.headers.get("origin")
    );
  }
}
