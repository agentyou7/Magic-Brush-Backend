import { NextRequest, NextResponse } from 'next/server';
import { firestoreDb } from '@/lib/firebase';
import * as admin from 'firebase-admin';

interface PortfolioItem {
  id: string;
  [key: string]: any;
}

export async function GET(request: NextRequest) {
  try {
    console.log('📁 Fetching portfolio items from Firebase...');

    // Check if Firebase is initialized
    if (!firestoreDb) {
      console.error('❌ Firestore not initialized');
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Try different collection names that might exist
    const possibleCollections = ['portfolio', 'portfolios', 'portfolioItems'];
    let portfolioItems: any[] = [];
    let foundCollection = '';

    for (const collectionName of possibleCollections) {
      try {
        console.log(`🔍 Trying collection: ${collectionName}`);
        const portfolioCollection = firestoreDb.collection(collectionName);
        const portfolioSnapshot = await portfolioCollection.get();
        
        if (!portfolioSnapshot.empty) {
          portfolioItems = portfolioSnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({
            id: doc.id,
            ...doc.data()
          }));
          foundCollection = collectionName;
          console.log(`✅ Found ${portfolioItems.length} total items in '${collectionName}' collection`);
          
          // Count active vs inactive
          const activeCount = portfolioItems.filter((item: any) => item.isActive !== false).length;
          const inactiveCount = portfolioItems.filter((item: any) => item.isActive === false).length;
          console.log(`📊 Active: ${activeCount}, Inactive: ${inactiveCount}`);
          break;
        } else {
          console.log(`📭 Collection '${collectionName}' is empty`);
        }
      } catch (collectionError) {
        console.log(`❌ Error accessing '${collectionName}':`, collectionError);
      }
    }

    if (portfolioItems.length === 0) {
      console.log('⚠️ No portfolio items found in any collection');
    }

    return NextResponse.json({
      success: true,
      data: {
        portfolio: portfolioItems,
        total: portfolioItems.length,
        foundCollection: foundCollection
      }
    });

  } catch (error) {
    console.error('💥 Error fetching portfolio items:', error);
    console.error('💥 Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
    });
    
    return NextResponse.json(
      { error: 'Failed to fetch portfolio items: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
