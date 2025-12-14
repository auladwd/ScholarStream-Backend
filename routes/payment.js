// ---------------------------------------------
// 🔹 Load Environment Variables FIRST
// ---------------------------------------------
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import Stripe from 'stripe';
import Application from '../models/Application.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

// ---------------------------------------------
// 🔹 Initialize Stripe safely
// ---------------------------------------------
let stripe = null;

try {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('⚠️ STRIPE_SECRET_KEY is missing. Payments will not work.');
  } else {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized successfully');
  }
} catch (error) {
  console.error('❌ Error initializing Stripe:', error.message);
}

// Utility Response when Stripe is not loaded
const stripeMissingError = res =>
  res.status(500).json({
    message:
      'Stripe is not configured. Please set STRIPE_SECRET_KEY in your .env file.',
  });

// ---------------------------------------------
// 🔹 Create Payment Intent
// ---------------------------------------------
router.post('/create-payment-intent', verifyToken, async (req, res) => {
  if (!stripe) return stripeMissingError(res);

  try {
    const { applicationId } = req.body;

    const application = await Application.findById(applicationId).populate(
      'scholarshipId'
    );

    if (!application)
      return res.status(404).json({ message: 'Application not found' });

    // Verify user ownership
    if (application.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const totalAmount =
      (application.applicationFees + application.serviceCharge) * 100;

    if (totalAmount < 50)
      return res.status(400).json({
        message: 'Payment amount must be at least $0.50',
      });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      metadata: {
        applicationId: applicationId.toString(),
        userId: req.user._id.toString(),
      },
    });

    return res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    return res.status(500).json({
      message: 'Error creating payment intent',
      error: error.message,
    });
  }
});

// ---------------------------------------------
// 🔹 Payment Success Verification
// ---------------------------------------------
router.post('/success', verifyToken, async (req, res) => {
  if (!stripe) return stripeMissingError(res);

  try {
    const { applicationId, paymentIntentId } = req.body;

    if (!paymentIntentId)
      return res.status(400).json({ message: 'paymentIntentId is required' });

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (!intent)
      return res.status(404).json({ message: 'Payment intent not found' });

    if (intent.status !== 'succeeded')
      return res
        .status(400)
        .json({ message: 'Payment not successful', intent });

    // Metadata match check
    if (
      intent.metadata?.applicationId &&
      intent.metadata.applicationId !== applicationId.toString()
    ) {
      return res
        .status(400)
        .json({ message: 'Payment does not match the application' });
    }

    const application = await Application.findById(applicationId);
    if (!application)
      return res.status(404).json({ message: 'Application not found' });

    if (application.userId.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Access denied' });

    application.paymentStatus = 'paid';
    await application.save();

    return res.json({ message: 'Payment successful', application });
  } catch (error) {
    return res.status(500).json({
      message: 'Error processing payment',
      error: error.message,
    });
  }
});

// ---------------------------------------------
// 🔹 Hosted Checkout Session
// ---------------------------------------------
router.post('/create-checkout-session', verifyToken, async (req, res) => {
  if (!stripe) return stripeMissingError(res);

  try {
    const { applicationId } = req.body;

    const application = await Application.findById(applicationId).populate(
      'scholarshipId'
    );

    if (!application)
      return res.status(404).json({ message: 'Application not found' });

    if (application.userId.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Access denied' });

    const totalAmountCents = Math.round(
      (application.applicationFees + application.serviceCharge) * 100
    );

    if (totalAmountCents < 50)
      return res
        .status(400)
        .json({ message: 'Payment amount must be at least $0.50' });

    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name:
                application.scholarshipId?.scholarshipName ||
                'Scholarship Application Fee',
            },
            unit_amount: totalAmountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        applicationId: applicationId.toString(),
        userId: req.user._id.toString(),
      },
      success_url: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/payment/failed`,
    });

    return res.json({ url: session.url, id: session.id });
  } catch (error) {
    return res.status(500).json({
      message: 'Error creating checkout session',
      error: error.message,
    });
  }
});

// ---------------------------------------------
// 🔹 Verify Checkout Session
// ---------------------------------------------
router.get('/verify', verifyToken, async (req, res) => {
  if (!stripe) return stripeMissingError(res);

  try {
    const { session_id } = req.query;

    if (!session_id)
      return res
        .status(400)
        .json({ message: 'session_id query parameter required' });

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['payment_intent'],
    });

    if (!session)
      return res.status(404).json({ message: 'Checkout session not found' });

    const applicationId = session.metadata?.applicationId;
    if (!applicationId)
      return res
        .status(400)
        .json({ message: 'No applicationId in session metadata' });

    const paymentIntent = session.payment_intent;

    if (!paymentIntent || paymentIntent.status !== 'succeeded')
      return res.status(400).json({ message: 'Payment incomplete', session });

    const application = await Application.findById(applicationId);
    if (!application)
      return res.status(404).json({ message: 'Application not found' });

    if (application.userId.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Access denied' });

    application.paymentStatus = 'paid';
    await application.save();

    return res.json({
      success: true,
      message: 'Payment verified',
      application,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Error verifying checkout session',
      error: error.message,
    });
  }
});

export default router;
