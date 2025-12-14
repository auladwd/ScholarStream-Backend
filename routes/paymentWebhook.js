import express from 'express';
import Stripe from 'stripe';
import Application from '../models/Application.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe webhook endpoint. This route expects the raw request body, so
// it should be mounted before express.json() middleware in server.js.
router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return res
        .status(400)
        .json({ message: 'Stripe webhook secret not configured' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event types you care about
    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object;
          const applicationId = paymentIntent.metadata?.applicationId;
          if (applicationId) {
            const application = await Application.findById(applicationId);
            if (application) {
              application.paymentStatus = 'paid';
              await application.save();
            }
          }
          break;
        }
        // Add more event types as needed
        default:
          break;
      }

      res.json({ received: true });
    } catch (err) {
      console.error('Webhook handling error:', err);
      res.status(500).json({ message: 'Webhook handler error' });
    }
  }
);

export default router;
