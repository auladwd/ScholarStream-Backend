# ScholarStream Backend

Express.js API server with MongoDB and Firebase Admin.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Production

```bash
npm start
```

## Environment Variables

Create a `.env` file:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
FRONTEND_URL=http://localhost:3000
```

Additional Stripe variables (recommended):

```env
STRIPE_WEBHOOK_SECRET=whsec_...   # webhook signing secret from Stripe
```

When using Stripe webhooks, the webhook endpoint is mounted at
`/api/payment/webhook` and expects the raw request body for signature
verification. Ensure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set in
your environment.

## Firebase Admin Setup

For production, download the service account key from Firebase Console and save
it as `serviceAccountKey.json` in the backend directory.

Update `routes/auth.js` to use the service account key:

```javascript
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
```



fdjfkdjdk

