import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './db/connection.js';
import authRoutes from './routes/auth.js';
import scholarshipRoutes from './routes/scholarships.js';
import applicationRoutes from './routes/applications.js';
import reviewRoutes from './routes/reviews.js';
import userRoutes from './routes/users.js';
import analyticsRoutes from './routes/analytics.js';
import paymentRoutes from './routes/payment.js';
import paymentWebhook from './routes/paymentWebhook.js';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// console.log('Loaded STRIPE_SECRET_KEY =', process.env.STRIPE_SECRET_KEY);

// Basic Stripe configuration check
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn(
    '⚠️ STRIPE_SECRET_KEY is not set. Payments will not work until configured.'
  );
}

const app = express();
const PORT = process.env.PORT || 5000;

/* ------------------------------------------
   🟦 Firebase Initialization
------------------------------------------- */
if (!admin.apps.length) {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const serviceAccountPath = path.resolve(
      __dirname,
      'firebase',
      'firebase-service-account.json'
    );

    let serviceAccount = {};

    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(
        fs.readFileSync(serviceAccountPath, { encoding: 'utf8' })
      );
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      throw new Error(
        'Firebase service account JSON not found. Provide backend/firebase/firebase-service-account.json or set FIREBASE_SERVICE_ACCOUNT env var.'
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || 'scholarstream-861d7',
    });

    console.log('Firebase Admin SDK Initialized');
  } catch (error) {
    console.log('Firebase Admin initialization error:', error.message);
  }
}

/* ------------------------------------------
   🟦 CORS Middleware
------------------------------------------- */
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:5173', // Vite
  // Add production frontend URLs here if needed
];

// Support multiple frontend URLs from environment
if (process.env.FRONTEND_URLS) {
  const additionalUrls = process.env.FRONTEND_URLS.split(',').map(url =>
    url.trim()
  );
  allowedOrigins.push(...additionalUrls);
}

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check if origin is in allowed list
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        // In development, allow all origins
        if (process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          // In production, only allow specific origins
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

/* ------------------------------------------
   🟦 Stripe Webhook Route (RAW Body Required)
------------------------------------------- */
// MUST be before express.json()
app.post(
  '/api/payment/webhook',
  express.raw({ type: 'application/json' }),
  paymentWebhook
);

/* ------------------------------------------
   🟦 Normal JSON Middleware
------------------------------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ------------------------------------------
   🟦 MongoDB Connection
------------------------------------------- */
connectDB().catch(err => console.error('❌ MongoDB Connection Error:', err));

/* ------------------------------------------
   🟦 API Routes
------------------------------------------- */
app.use('/api/auth', authRoutes);
app.use('/api/scholarships', scholarshipRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/payment', paymentRoutes);

/* ------------------------------------------
   🟦 Health Check
------------------------------------------- */
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'ScholarStream API is running' });
});

/* ------------------------------------------
   🟦 Payment Status Check
------------------------------------------- */
app.get('/api/payment/status', (req, res) => {
  res.json({
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
  });
});

/* ------------------------------------------
   🟦 Global Error Handler
------------------------------------------- */
app.use((err, req, res, next) => {
  console.error('🔥 ERROR:', err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: err.message,
  });
});

/* ------------------------------------------
   🟦 Start Server (only if not in Vercel)
------------------------------------------- */
// Export app for Vercel serverless functions
export default app;

// Only start server if not in Vercel environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}
