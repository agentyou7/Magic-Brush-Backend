import { Router } from "express";
import { firebaseAuth } from "../lib/firebase";

export const createUserRouter = Router();

createUserRouter.post("/admin-user", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Create user in Firebase Auth
    const userRecord = await firebaseAuth.createUser({
      email: email,
      password: password,
      displayName: displayName || 'Admin User',
      emailVerified: false,
    });

    // Set admin custom claims
    await firebaseAuth.setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      email: userRecord.email,
    });

    res.status(200).json({
      success: true,
      message: "Admin user created successfully",
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        createdAt: userRecord.metadata.creationTime,
      },
    });

  } catch (error: any) {
    console.error("Error creating user:", error);
    
    if (error.code === 'auth/email-already-exists') {
      // User already exists, just update custom claims
      try {
        const existingUser = await firebaseAuth.getUserByEmail(email);
        await firebaseAuth.setCustomUserClaims(existingUser.uid, {
          role: 'admin',
          email: existingUser.email,
        });

        res.status(200).json({
          success: true,
          message: "Admin role updated for existing user",
          data: {
            uid: existingUser.uid,
            email: existingUser.email,
            displayName: existingUser.displayName,
          },
        });
      } catch (updateError) {
        res.status(500).json({
          success: false,
          message: "Failed to update existing user",
        });
      }
    } else {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create user",
      });
    }
  }
});
