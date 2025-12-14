import express from 'express';
import User from '../models/User.js'; // User model
import bcrypt from 'bcryptjs'; // For password hashing
import jwt from 'jsonwebtoken'; // For generating JWT
import admin from 'firebase-admin';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

// POST /auth/register (User Registration)
// Supports both Firebase idToken-based registration and direct email/password registration
router.post('/register', async (req, res) => {
  const { idToken, name, email, password, photoURL, role } = req.body;

  try {
    let verifiedEmail = email;
    let verifiedName = name;
    let verifiedPhotoURL = photoURL;
    let hashedPassword = null;

    // If idToken is provided, verify Firebase authentication
    if (idToken) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        verifiedEmail = decodedToken.email || email;
        verifiedName = decodedToken.name || name || verifiedEmail.split('@')[0];
        verifiedPhotoURL = decodedToken.picture || photoURL || '';
        
        // For Firebase-based registration, we don't need to store password
        // as Firebase handles authentication
      } catch (firebaseError) {
        return res.status(401).json({ 
          message: 'Invalid Firebase token', 
          error: firebaseError.message 
        });
      }
    } else if (email && password) {
      // Direct email/password registration (without Firebase)
      verifiedEmail = email;
      verifiedName = name || email.split('@')[0];
      verifiedPhotoURL = photoURL || '';
      hashedPassword = await bcrypt.hash(password, 10);
    } else {
      return res.status(400).json({ 
        message: 'Either idToken or email+password required' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: verifiedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Basic role validation
    const allowedRoles = ['Student', 'Moderator', 'Admin'];
    let assignedRole = 'Student';
    if (role && allowedRoles.includes(role)) assignedRole = role;

    // Prevent public assignment of Admin role except when DB has no Admin yet
    if (assignedRole === 'Admin') {
      // If there are no Admin users in the DB, allow creating the first Admin.
      // This enables initial bootstrapping. Otherwise require an Admin token.
      const adminCount = await User.countDocuments({ role: 'Admin' });
      if (adminCount === 0) {
        // allow creating the first Admin without an existing admin token
      } else {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];
        if (!token) {
          return res.status(403).json({
            message: 'Cannot assign Admin role without admin authorization',
          });
        }
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const requestingUser = await User.findById(decoded.userId);
          if (!requestingUser || requestingUser.role !== 'Admin') {
            return res
              .status(403)
              .json({ message: 'Only admins can create Admin users' });
          }
        } catch (err) {
          return res
            .status(403)
            .json({ message: 'Invalid authorization token' });
        }
      }
    }

    // Create new user
    const newUser = new User({
      name: verifiedName,
      email: verifiedEmail,
      password: hashedPassword, // null for Firebase-based users
      photoURL: verifiedPhotoURL,
      role: assignedRole,
    });

    // Save user to database
    await newUser.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        photoURL: newUser.photoURL,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    // Duplicate key (email) error
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    // Mongoose validation error
    if (error.name === 'ValidationError') {
      return res
        .status(400)
        .json({ message: 'Invalid user data', error: error.message });
    }
    res
      .status(500)
      .json({ message: 'Registration failed', error: error.message });
  }
});

export default router;

// POST /auth/login (Firebase ID token based login)
router.post('/login', async (req, res) => {
  try {
    const { idToken, email, password } = req.body;

    // 1) Firebase ID token based login (existing flow)
    if (idToken) {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const { email: fbEmail, name, picture } = decodedToken;

      let user = await User.findOne({ email: fbEmail });
      if (!user) {
        user = new User({
          name: name || fbEmail.split('@')[0],
          email: fbEmail,
          photoURL: picture || '',
          role: 'Student',
        });
        await user.save();
      } else {
        // update photoURL if changed
        if (picture && picture !== user.photoURL) {
          user.photoURL = picture;
          await user.save();
        }
      }

      const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Login successful',
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          photoURL: user.photoURL,
          role: user.role,
        },
      });
    }

    // 2) Email + Password based login (new flow)
    if (email && password) {
      const user = await User.findOne({ email });
      if (!user || !user.password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Login successful',
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          photoURL: user.photoURL,
          role: user.role,
        },
      });
    }

    // If neither idToken nor email+password provided
    return res
      .status(400)
      .json({ message: 'idToken or email+password required' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ message: 'Login failed', error: error.message });
  }
});

// GET /auth/me - return current user (requires JWT)
router.get('/me', verifyToken, async (req, res) => {
  try {
    res.json({
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        photoURL: req.user.photoURL,
        role: req.user.role,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching user', error: error.message });
  }
});
