// Simple Firebase Admin user creation
const admin = require('firebase-admin');

// Firebase service account configuration
const serviceAccount = {
  "projectId": "magic-brush-uk",
  "clientEmail": "firebase-adminsdk-fbsvc@magic-brush-uk.iam.gserviceaccount.com",
  "privateKey": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCcHFipXdS22y5w\nsAF+nrQM+bOttHf2ZF6gYwA+Cg9w1IuAmwU5ae/cxXr4+Ttwxj41ccMLe6J689R5\ndjLQP01AUMytiTRHhfSuYo3jTd2WbjhodgSnZj0wc0q9bKd4cHV7bQVmOC0FVi5v\nuAO7aDyvPihl5QsUm9zBqzn6mPrpvrV8B5yD930S64d8+OoH4neKix6h+xYq23nf\nowhSCyss7vSCPqWs4rwwo6IRLowIE1L8WdakK0ubMKPQIlPX0lhmqNu52vp53FxY\n9Ih5Ed12pk/+w0Iwqj9iTZwP3w+k2t/rt5R6rtcLRBh+nmyOVFKuOxQpRa9rKn3+\ni4BarBvXAgMBAAECggEAPU0oR8Gv0Oo6z0deHuGlJF89fl2aqed5/RNDOhlrPMxJ\nx4OYRpZh+ViW1IPSIpPGQ+hbRfwTrqJm8hdHFt10sWfJJ+/z1o40qfHLc9HUzMiV\nX/fQFgggyRDM7ZtoG/RVPdVuxFgU3b6c14Pz+ziQc+Q9qt2JP1uBEY/yYYSHKxf6\nQWoU2kiWHG84hc4uaR0nmQV2c/nfSAQb57l/arQrr7LXeQBFJKSNihHoDJ0rLWtw\n0lOZqYSz5XeQDNSnkF7NoC9TOTuNoCdljPPV+7Hm1ZMIqyYTBN03gYr04IFX8hMP\naXCc1HCpODL1zQgvNKIXmqA2ysqQuKVzypRz9seieQKBgQDPeoj0cs8bUMCh1YN2\nHvNJ5ESRkHymRCvZmIkjynwrVuXyl0dHcVbRZABMmKDFoGyhMMIsmLR+PKdxE4kc\nWtJ9Kp5yGoNrX/J+f0PpKaW4ieFLi+pXCFVlOv2EU/W/aFQi+ydAE33AVYhVWngk\nRR+gRdPgWnUnv1x2ksqRLQ1GmwKBgQDAnnvHbZDoHqWFV35S5qke4rdchRxmyk/P\n6IGGWBzoOM8ccIZIcsdAoWlZNL0/LBG1MJDUlEyAS0XeOnpGpej3lcw/D7EZJWwx\nOihILKgsIdI3ISkiRwmEB7cBfJpgDIJtCTvDUVJ53k7EXWXVuNB2jmeQ92/Qmrkf\n9g/VMWJ1dQKBgDsYsOfHx9wE7UlrUo2TlUKHxUwc9pQ5OLA69Vz/cMy7bLXjhwb/\nbnYn4Lnwg2KnJinnhHdFa6vFRQA9S0GLUQcb25Oun5427xA+2a4REcX1Z/mnubDe\ni8xQuCM38vh5E/X+yZhDtP7SngmJwky6b56sJQRzX4lZxVF00EP3rB9fAoGABhA3\nF0UErbnhPfxOFq/6HOXIHdp21WmC76mDAkadylWXd263W2p5iThLh6pYVre9avW3\naWmtqtAzx9YRaU3psnl9r3KAAami6T3KbNMzDAiYhHG/yLtxuj0/7oUMmv9pz6Ld\nxb02mm18D0RdY0fpEAJVkkOnumpUb4QgZXajgc0CgYEAuqQm0c1gtu3rUHFdphUX\nmePMc/eH0nLWIbIWKfmh0+VyAbZRnEFxR77i/XElhuLD5SsY8rR8Es2JDKyydaHW\nAm8D6Br70s8UJvj8HHBox/VKyms0SIb8Z/7M+qM8JhhJ5yMhGhT7FyOHfbFgPhUF\n7IXPXuDcKtX7RdpuAVl/UIw=\n-----END PRIVATE KEY-----\n"
};

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();

async function createAdminUser() {
  try {
    console.log('🔧 Creating Firebase user...');
    
    const userRecord = await auth.createUser({
      email: 'onkar.fcs@gmail.com',
      password: '@Onkar7717254667',
      displayName: 'Onkar Admin',
      emailVerified: false,
    });

    console.log('✅ Successfully created user!');
    console.log('📧 Email:', userRecord.email);
    console.log('👤 User ID:', userRecord.uid);
    console.log('📅 Created:', userRecord.metadata.creationTime);
    
    // Set admin custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      email: userRecord.email
    });
    
    console.log('🔐 Admin role assigned successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.code === 'auth/email-already-exists') {
      console.log('ℹ️ User already exists, updating admin role...');
      try {
        const existingUser = await auth.getUserByEmail('onkar.fcs@gmail.com');
        await auth.setCustomUserClaims(existingUser.uid, {
          role: 'admin',
          email: existingUser.email
        });
        console.log('✅ Admin role updated for existing user!');
      } catch (updateError) {
        console.error('❌ Update failed:', updateError.message);
      }
    }
  }
}

createAdminUser()
  .then(() => {
    console.log('🚀 Process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
