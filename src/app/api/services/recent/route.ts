import { NextRequest, NextResponse } from 'next/server';
import { firestoreDb } from '../../../../lib/firebase';
import { buildOptionsResponse, withCors } from '../../../../lib/cors';
import * as admin from 'firebase-admin';

export async function OPTIONS(request: NextRequest) {
  return buildOptionsResponse(request.headers.get("origin"));
}

export async function GET(request: NextRequest) {
  try {
    console.log('ðŸ”¥ Fetching recent services from Firebase...');

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

    // Fetch only active services, then randomly select 5
    const servicesCollection = firestoreDb.collection('services');
    const servicesSnapshot = await servicesCollection
      .where('isActive', '==', true)
      .get();

    const allServices = servicesSnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data()
    }));

    // Randomly select 5 services (or all if less than 5)
    const shuffled = allServices.sort(() => 0.5 - Math.random());
    const services = shuffled.slice(0, 5);

    console.log(`âœ… Found ${services.length} recent active services`);

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
    console.error('ðŸ’¥ Error fetching recent services:', error);
    console.error('ðŸ’¥ Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
    });
    
    return withCors(
      NextResponse.json(
        { error: 'Failed to fetch recent services: ' + (error as Error).message },
        { status: 500 }
      ),
      request.headers.get("origin")
    );
  }
}
