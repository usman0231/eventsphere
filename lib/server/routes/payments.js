const express = require('express');
const router = express.Router();
const Expo = require('../models/Expo');
const { protect } = require('../middleware/auth');

// Stripe is only wired up when a secret key is present. Without it the
// front-end falls back to the mock checkout, so the app still runs locally
// without any Stripe config.
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? require('stripe')(stripeKey) : null;

// POST /api/payments/create-intent — start a card payment for a ticket.
// The amount is derived/clamped server-side from the expo's real entry fee so
// a client can't pay less than they should (or fake a $0 charge).
router.post('/create-intent', protect, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ success: false, message: 'Stripe is not configured on the server' });
    }

    const { expoId, amountPaid } = req.body;
    if (!expoId) return res.status(400).json({ success: false, message: 'expoId required' });

    const expo = await Expo.findById(expoId).select('title entryFee status');
    if (!expo) return res.status(404).json({ success: false, message: 'Expo not found' });
    if (expo.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'This expo has been cancelled' });
    }

    const fee = Math.max(0, Number(expo.entryFee) || 0);
    if (fee <= 0) {
      return res.status(400).json({ success: false, message: 'This event is free — no payment needed' });
    }

    // Pay the full fee by default; a deposit is any amount in [min, fee].
    const amt = Math.min(fee, Math.max(0, Number(amountPaid)) || fee);
    const cents = Math.round(amt * 100);
    if (cents < 50) {
      return res.status(400).json({ success: false, message: 'Minimum card payment is $0.50' });
    }

    const intent = await stripe.paymentIntents.create({
      amount: cents,
      currency: 'usd',
      metadata: {
        expoId: String(expoId),
        userId: String(req.user._id),
        expoTitle: expo.title || '',
        entryFee: String(fee),
      },
      // Card-only, no redirect-based methods — we confirm inline in the modal.
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    });

    res.json({ success: true, clientSecret: intent.client_secret, amount: amt });
  } catch (err) {
    res.fail(err);
  }
});

module.exports = router;
