#!/usr/bin/env bash

# -------------------------
# One-click Stripe Dev Setup
# -------------------------

ENV_FILE=".env"
WEBHOOK_PATH="/api/payment/webhook"
BACKEND_PORT=5000

echo "🚀 Starting Stripe auto-setup..."

# 1. Ensure .env exists
if [ ! -f "$ENV_FILE" ]; then
  echo "⚠️  No .env file found. Creating one from .env.example..."
  cp .env.example .env
fi

# 2. Start backend server
echo "▶️ Starting backend server on port $BACKEND_PORT..."
npm run dev &   # যদি yarn ব্যবহার করেন, তাহলে পরিবর্তন করুন: yarn dev
BACKEND_PID=$!

sleep 3

# 3. Start Stripe webhook listener (prints secret)
echo "▶️ Starting Stripe listener..."
STRIPE_SECRET=$(stripe listen --forward-to localhost:$BACKEND_PORT$WEBHOOK_PATH --print-secret | tail -n 1)

# 4. Update .env with webhook secret
echo "🔐 Writing STRIPE_WEBHOOK_SECRET to .env..."
if command -v sed >/dev/null 2>&1; then
  # Try portable removal of existing key (works on GNU sed / mac sed)
  sed -i.bak '/STRIPE_WEBHOOK_SECRET=/d' .env 2>/dev/null || sed -i '/STRIPE_WEBHOOK_SECRET=/d' .env
  rm -f .env.bak 2>/dev/null || true
fi
echo "STRIPE_WEBHOOK_SECRET=$STRIPE_SECRET" >> .env

echo "✅ STRIPE_WEBHOOK_SECRET saved: $STRIPE_SECRET"

# 5. Trigger test event
echo "🧪 Triggering checkout.session.completed test event..."
stripe trigger checkout.session.completed

echo ""
echo "🎉 ALL DONE!"
echo "➡️ Webhooks are forwarding to: localhost:$BACKEND_PORT$WEBHOOK_PATH"
echo "➡️ Your backend is running (PID: $BACKEND_PID)"
echo ""
echo "✨ You can now test Stripe Checkout end-to-end."
