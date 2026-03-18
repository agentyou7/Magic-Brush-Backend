const admin = require('firebase-admin');
const fs = require('fs');

// Read environment variables from .env file
const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

// Initialize Firebase Admin
const serviceAccount = {
  projectId: envVars.FIREBASE_PROJECT_ID,
  clientEmail: envVars.FIREBASE_CLIENT_EMAIL,
  privateKey: envVars.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();

async function createUser() {
  try {
    const userRecord = await auth.createUser({
      email: 'onkar.fcs@gmail.com',
      password: '@Onkar7717254667',
      displayName: 'Onkar Admin',
      emailVerified: false,
    });

    console.log('✅ Successfully created user:', userRecord.uid);
    console.log('📧 Email:', userRecord.email);
    console.log('👤 Display Name:', userRecord.displayName);
    console.log('📅 Created At:', userRecord.metadata.creationTime);
    
    // Set custom claims for admin role
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      email: userRecord.email
    });
    
    console.log('🔐 Admin role assigned to user');
    
  } catch (error) {
    console.error('❌ Error creating user:', error.message);
    
    if (error.code === 'auth/email-already-exists') {
      console.log('ℹ️ User already exists. Updating custom claims...');
      try {
        // Get existing user
        const userRecord = await auth.getUserByEmail('onkar.fcs@gmail.com');
        
        // Update custom claims
        await auth.setCustomUserClaims(userRecord.uid, {
          role: 'admin',
          email: userRecord.email
        });
        
        console.log('✅ Admin role updated for existing user');
        console.log('👤 User ID:', userRecord.uid);
      } catch (updateError) {
        console.error('❌ Error updating user:', updateError.message);
      }
    }
  }
}

createUser().then(() => {
  console.log('🚀 User creation process completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Process failed:', error);
  process.exit(1);
});
