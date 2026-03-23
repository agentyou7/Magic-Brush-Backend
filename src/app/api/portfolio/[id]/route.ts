import { NextRequest, NextResponse } from 'next/server';
import { firestoreDb } from '../../../../lib/firebase';
import * as admin from 'firebase-admin';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`🗑️ Deleting portfolio item: ${id}`);

    // Check if Firebase is initialized
    if (!firestoreDb) {
      console.error('❌ Firestore not initialized');
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Delete from all possible collections
    const possibleCollections = ['portfolio', 'portfolios', 'portfolioItems'];
    let deleted = false;

    for (const collectionName of possibleCollections) {
      try {
        console.log(`🔍 Trying to delete from collection: ${collectionName}`);
        const portfolioCollection = firestoreDb.collection(collectionName);
        const docRef = portfolioCollection.doc(id);
        const docSnapshot = await docRef.get();
        
        if (docSnapshot.exists) {
          await docRef.delete();
          deleted = true;
          console.log(`✅ Successfully deleted from '${collectionName}' collection`);
          break;
        }
      } catch (collectionError) {
        console.log(`❌ Error accessing '${collectionName}':`, collectionError);
      }
    }

    if (!deleted) {
      return NextResponse.json(
        { error: 'Portfolio item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Portfolio item deleted successfully'
    });

  } catch (error) {
    console.error('💥 Error deleting portfolio item:', error);
    console.error('💥 Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
    });
    
    return NextResponse.json(
      { error: 'Failed to delete portfolio item: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
