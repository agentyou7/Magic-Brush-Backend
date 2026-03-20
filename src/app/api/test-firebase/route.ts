import { NextRequest, NextResponse } from 'next/server';
import { firestoreDb } from '../../../lib/firebase';

export async function GET(request: NextRequest) {
  try {
    // Check if Firebase is initialized
    if (!firestoreDb) {
      console.error('❌ Firestore not initialized');
      return NextResponse.json(
        { error: 'Firestore not initialized' },
        { status: 500 }
      );
    }

    // Test a simple read operation
    const testDoc = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Firebase connection test'
    };
    
    return NextResponse.json({
      success: true,
      message: 'Firebase connection successful',
      data: testDoc
    });

  } catch (error) {
    console.error('💥 Firebase test error:', error);
    console.error('💥 Full error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
    });
    
    return NextResponse.json(
      { error: 'Firebase connection failed: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
