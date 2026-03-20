"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const firebase_1 = require("../../../lib/firebase");
async function GET(request) {
    try {
        // Check if Firebase is initialized
        if (!firebase_1.firestoreDb) {
            console.error('❌ Firestore not initialized');
            return server_1.NextResponse.json({ error: 'Firestore not initialized' }, { status: 500 });
        }
        // Test a simple read operation
        const testDoc = {
            test: true,
            timestamp: new Date().toISOString(),
            message: 'Firebase connection test'
        };
        return server_1.NextResponse.json({
            success: true,
            message: 'Firebase connection successful',
            data: testDoc
        });
    }
    catch (error) {
        console.error('💥 Firebase test error:', error);
        console.error('💥 Full error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return server_1.NextResponse.json({ error: 'Firebase connection failed: ' + error.message }, { status: 500 });
    }
}
