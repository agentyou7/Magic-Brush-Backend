import { NextRequest, NextResponse } from 'next/server';
import { firestoreDb } from '../../../../lib/firebase';
import * as admin from 'firebase-admin';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`🗑️ Deleting service item: ${id}`);

    // Check if Firebase is initialized
    if (!firestoreDb) {
      console.error('❌ Firestore not initialized');
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Delete from services collection
    const servicesCollection = firestoreDb.collection('services');
    const docRef = servicesCollection.doc(id);
    const docSnapshot = await docRef.get();
    
    if (!docSnapshot.exists) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    await docRef.delete();
    console.log(`✅ Successfully deleted service with ID: ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Service deleted successfully'
    });

  } catch (error) {
    console.error('💥 Error deleting service item:', error);
    console.error('💥 Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
    });
    
    return NextResponse.json(
      { error: 'Failed to delete service item: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
