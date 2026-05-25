# Stripe Integration Complete Guide

## 🎯 Overview

This guide integrates **Stripe payments** into NourBridge, allowing users to:
- ✅ Pay with credit/debit cards
- ✅ Receive USDC tokens automatically
- ✅ Secure webhook verification
- ✅ Real-time payment tracking

---

## 📋 What Was Added

### Backend Components
```
backend/server-with-stripe.js    # Express server with Stripe integration
backend/STRIPE_SETUP.md          # Stripe configuration guide
```

### Frontend Components
```
frontend/src/components/StripePayment.jsx     # Payment component
frontend/src/components/StripePayment.css     # Payment styling
```

### Documentation
```
STRIPE_ENV_SETUP.md              # Environment setup guide
.env.example                     # Complete env template
```

---

## 🚀 Quick Setup

### 1. Get Stripe Keys
```
Visit: https://dashboard.stripe.com/apikeys
Copy:
- Secret Key (sk_live_...)
- Publishable Key (pk_live_...)
- Webhook Secret (whsec_...)
```

### 2. Update .env
```bash
STRIPE_SECRET_KEY=sk_live_YOUR_KEY
STRIPE_PUBLIC_KEY=pk_live_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_live_YOUR_KEY
STRIPE_MERCHANT_ID=your_merchant_id
STRIPE_KEYINFO=keyinfo_live_...
```

### 3. Install Stripe Dependencies
```bash
npm install stripe @stripe/js @stripe/react-stripe-js
```

### 4. Replace Backend Server
```bash
# Use the new server with Stripe integration
mv backend/server.js backend/server-original.js
mv backend/server-with-stripe.js backend/server.js
```

### 5. Update Frontend
```javascript
// In frontend/src/App.jsx
import StripePayment from "./components/StripePayment";

// Add to dashboard
<StripePayment />
```

---

## 🔄 Payment Flow

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  User enters amount & email                     │
│         ↓                                        │
│  Connect MetaMask wallet                        │
│         ↓                                        │
│  Click "Pay Now"                                │
│         ↓                                        │
│  Backend creates Stripe PaymentIntent           │
│         ↓                                        │
│  Frontend shows card form                       │
│         ↓                                        │
│  User enters card details                       │
│         ↓                                        │
│  Stripe processes payment                       │
│         ↓                                        │
│  Backend receives webhook                       │
│         ↓                                        │
│  Execute meta-transaction deposit               │
│         ↓                                        │
│  User receives USDC tokens ✅                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🔐 API Endpoints

### Create Payment Intent
```bash
POST /api/stripe/create-payment-intent

Request:
{
  "amount": 100.00,
  "currency": "usd",
  "customerEmail": "user@example.com",
  "walletAddress": "0x..."
}

Response:
{
  "clientSecret": "pi_..._secret_...",
  "paymentIntentId": "pi_...",
  "amount": 100,
  "currency": "usd"
}
```

### Confirm Payment
```bash
POST /api/stripe/confirm-payment

Request:
{
  "paymentIntentId": "pi_...",
  "walletAddress": "0x...",
  "amount": 100,
  "tokenAddress": "0x..."
}

Response:
{
  "success": true,
  "message": "Payment confirmed. Tokens deposited."
}
```

### Get Payment Status
```bash
GET /api/stripe/payment-status/:paymentIntentId

Response:
{
  "paymentIntentId": "pi_...",
  "stripeStatus": "succeeded",
  "amount": 100,
  "currency": "USD",
  "walletAddress": "0x..."
}
```

### Get Stripe Config
```bash
GET /api/stripe/config

Response:
{
  "publishableKey": "pk_live_...",
  "merchantId": "your_merchant_id"
}
```

---

## 📊 Security Features

### ✅ Implemented
- [x] Webhook signature verification
- [x] Payment intent validation
- [x] Wallet address verification
- [x] Amount validation
- [x] Error handling
- [x] Logging for all events
- [x] Idempotency keys (automatic with Stripe)
- [x] Environment variable protection

### 🔒 Best Practices
- Secret key never exposed to frontend
- Webhook verification with signing secret
- Secure error messages (no sensitive data)
- Rate limiting (implement as needed)
- HTTPS required for production

---

## 🧪 Testing

### Test Cards
```
Success:       4242 4242 4242 4242
Decline:       4000 0000 0000 0002
3D Secure:     4000 0025 0000 3155
```

Any future date + any 3-digit CVC

### Test Flow
```bash
1. npm run start:backend
2. npm run start:frontend
3. Connect wallet in UI
4. Enter test amount ($10)
5. Use test card 4242 4242 4242 4242
6. Complete payment
7. Check backend logs for success
```

### Verify Webhook
```bash
# Using Stripe CLI
stripe listen --forward-to localhost:3001/api/stripe/webhook

# In another terminal
stripe trigger payment_intent.succeeded
```

---

## ⚠️ Important Notes

### Before Production
- [ ] Use LIVE keys (not test)
- [ ] Setup proper HTTPS
- [ ] Configure webhook endpoint
- [ ] Test all payment scenarios
- [ ] Setup error alerts
- [ ] Monitor transaction volume
- [ ] Test refund process
- [ ] Implement rate limiting

### Security Checklist
- [ ] STRIPE_SECRET_KEY in .env only
- [ ] Never log secret keys
- [ ] Verify webhook signatures
- [ ] Validate wallet addresses
- [ ] Implement CSRF protection
- [ ] Use secure headers (Helmet.js)
- [ ] Enable CORS properly
- [ ] Rotate keys periodically

---

## 🔧 Troubleshooting

### "Payment intent not created"
- Check STRIPE_SECRET_KEY is set
- Verify amount is positive
- Ensure wallet address is valid

### "Webhook not received"
- Verify webhook URL is correct
- Check webhook secret matches
- Test with Stripe CLI
- Monitor Stripe dashboard

### "Card declined"
- Use test card numbers
- Check card details
- Verify 3D Secure if required
- Check account limits

---

## 📞 Support

- Stripe Dashboard: https://dashboard.stripe.com
- Stripe Docs: https://stripe.com/docs
- API Reference: https://stripe.com/docs/api
- Testing Guide: https://stripe.com/docs/testing

---

## 🎉 You're Ready!

Everything is set up for Stripe integration!

**Next Steps:**
1. ✅ Get Stripe keys
2. ✅ Update .env
3. ✅ Install dependencies
4. ✅ Start backend
5. ✅ Start frontend
6. ✅ Test payment flow
7. ✅ Deploy to production

---

**Questions?** Check `STRIPE_SETUP.md` for detailed configuration guide.
