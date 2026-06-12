import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '../utils/api';

const money = (n) => `$${(Math.round(Number(n) * 100) / 100).toFixed(2)}`;

// Real Stripe is used when a publishable key is configured; otherwise we fall
// back to a mock checkout so the app still runs without Stripe set up.
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

const CARD_STYLE = {
  style: {
    base: {
      color: '#f0f0ff',
      fontFamily: '"DM Sans", sans-serif',
      fontSize: '15px',
      '::placeholder': { color: 'rgba(240,240,255,0.25)' },
    },
    invalid: { color: '#ff7aa8' },
  },
};

// ── Real Stripe card form (charges a test/live card) ───────────────────────
function StripeCard({ expoId, payNow, displayAmount, beforePay, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const guard = beforePay();
    if (guard) { setError(guard); return; }
    if (!stripe || !elements) return;

    setError('');
    setProcessing(true);
    try {
      // 1) Ask our server to create a PaymentIntent for the chosen amount.
      const { data } = await api.post('/api/payments/create-intent', { expoId, amountPaid: payNow });
      // 2) Confirm the card payment in the browser with Stripe.
      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card: elements.getElement(CardElement) },
      });
      if (result.error) {
        setError(result.error.message || 'Payment failed');
        setProcessing(false);
        return;
      }
      if (result.paymentIntent?.status === 'succeeded') {
        onPaid(data.amount ?? payNow);
        return; // parent closes the modal
      }
      setError('Payment did not complete — please try again.');
      setProcessing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start payment');
      setProcessing(false);
    }
  };

  return (
    <form className="pay-card-section" onSubmit={handleSubmit}>
      {error && <div className="pay-error">{error}</div>}
      <label className="pay-label">Card details</label>
      <div className="pay-stripe-input"><CardElement options={CARD_STYLE} /></div>
      <button className="pay-submit" type="submit" disabled={processing || !stripe}>
        {processing ? <span className="pay-spinner" /> : `Pay ${displayAmount}`}
      </button>
      <p className="pay-note">🔒 Secured by Stripe · Test card 4242 4242 4242 4242</p>
    </form>
  );
}

// ── Mock card form (no Stripe configured) ──────────────────────────────────
function MockCard({ payNow, displayAmount, beforePay, onPaid }) {
  const [card, setCard] = useState('');
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const onCardChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
    setCard(digits.replace(/(.{4})/g, '$1 ').trim());
  };
  const onExpiryChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
  };
  const onCvcChange = (e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4));

  const validateCard = () => {
    if (!name.trim()) return 'Enter the name on the card';
    if (card.replace(/\s/g, '').length !== 16) return 'Card number must be 16 digits';
    const m = expiry.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return 'Expiry must be MM/YY';
    const month = Number(m[1]);
    if (month < 1 || month > 12) return 'Invalid expiry month';
    const exp = new Date(2000 + Number(m[2]), month, 0, 23, 59, 59);
    if (exp < new Date()) return 'Card has expired';
    if (cvc.length < 3) return 'CVC must be 3–4 digits';
    return '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const msg = beforePay() || validateCard();
    if (msg) { setError(msg); return; }
    setError('');
    setProcessing(true);
    setTimeout(() => onPaid(payNow), 1300); // simulate processing
  };

  return (
    <form className="pay-card-section" onSubmit={handleSubmit} autoComplete="off">
      {error && <div className="pay-error">{error}</div>}
      <label className="pay-label">Name on card</label>
      <input className="pay-input" type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} disabled={processing} />
      <label className="pay-label">Card number</label>
      <input className="pay-input" type="text" inputMode="numeric" placeholder="1234 5678 9012 3456" value={card} onChange={onCardChange} disabled={processing} />
      <div className="pay-row">
        <div style={{ flex: 1 }}>
          <label className="pay-label">Expiry</label>
          <input className="pay-input" type="text" inputMode="numeric" placeholder="MM/YY" value={expiry} onChange={onExpiryChange} disabled={processing} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="pay-label">CVC</label>
          <input className="pay-input" type="text" inputMode="numeric" placeholder="123" value={cvc} onChange={onCvcChange} disabled={processing} />
        </div>
      </div>
      <button className="pay-submit" type="submit" disabled={processing}>
        {processing ? <span className="pay-spinner" /> : `Pay ${displayAmount}`}
      </button>
      <p className="pay-note">🔒 Demo checkout — no real card is charged.</p>
    </form>
  );
}

// Checkout shown before a ticket is issued. Attendees can pay the full entry
// fee now, or pay a deposit to reserve their spot and settle the balance in
// person at the venue. onSuccess receives the payment split.
export default function PaymentModal({ expo, amount = 0, onClose, onSuccess }) {
  const fee = Math.max(0, Number(amount) || 0);
  const isFree = fee <= 0;
  const minDeposit = Math.min(fee, Math.max(1, Math.round(fee * 0.2 * 100) / 100));

  const [mode, setMode] = useState('full');     // 'full' | 'deposit'
  const [payNow, setPayNow] = useState(fee);
  const [freeProcessing, setFreeProcessing] = useState(false);

  const balanceDue = Math.max(0, Math.round((fee - payNow) * 100) / 100);

  const chooseMode = (m) => {
    setMode(m);
    if (m === 'full') setPayNow(fee);
    else setPayNow(Math.round(fee * 0.5 * 100) / 100);
  };
  const setPercent = (pct) => setPayNow(Math.round(fee * pct * 100) / 100);

  const emitSuccess = (amountPaid) => {
    onSuccess({
      amountPaid,
      balanceDue: Math.max(0, Math.round((fee - amountPaid) * 100) / 100),
      paidInFull: amountPaid >= fee,
    });
  };

  // Runs before charging — blocks an out-of-range deposit. '' means OK.
  const beforePay = () => {
    const amt = Math.round(Number(payNow) * 100) / 100;
    if (mode === 'deposit') {
      if (!(amt >= minDeposit)) return `Deposit must be at least ${money(minDeposit)}`;
      if (amt >= fee) return 'Deposit must be less than the full price — choose "Pay in full" instead';
    }
    return '';
  };

  // Free expos: nothing to charge — confirm and issue the ticket.
  if (isFree) {
    return (
      <div className="pay-overlay" onClick={freeProcessing ? undefined : onClose}>
        <div className="pay-modal" onClick={e => e.stopPropagation()}>
          <div className="pay-header">
            <h3>🎟️ Free Ticket</h3>
            <button className="pay-close" onClick={onClose} disabled={freeProcessing}>✕</button>
          </div>
          <div className="pay-summary">
            <span className="pay-summary-event">{expo?.title || 'Event Ticket'}</span>
            <div className="pay-summary-row"><span>Ticket price</span><span className="pay-summary-amount">Free</span></div>
          </div>
          <div className="pay-form">
            <button className="pay-submit" onClick={() => { setFreeProcessing(true); emitSuccess(0); }} disabled={freeProcessing}>
              {freeProcessing ? <span className="pay-spinner" /> : 'Get My Ticket'}
            </button>
            <p className="pay-note">This event has no entry fee.</p>
          </div>
        </div>
      </div>
    );
  }

  const cardProps = {
    expoId: expo?._id,
    payNow: Math.round(Number(payNow) * 100) / 100,
    displayAmount: money(payNow),
    beforePay,
    onPaid: emitSuccess,
  };

  return (
    <div className="pay-overlay" onClick={onClose}>
      <div className="pay-modal" onClick={e => e.stopPropagation()}>
        <div className="pay-header">
          <h3>💳 Checkout</h3>
          <button className="pay-close" onClick={onClose}>✕</button>
        </div>

        <div className="pay-summary">
          <span className="pay-summary-event">{expo?.title || 'Event Ticket'}</span>
          <div className="pay-summary-row">
            <span>Ticket price</span>
            <span className="pay-summary-amount">{money(fee)}</span>
          </div>
        </div>

        <div className="pay-form">
          {/* Full vs deposit choice */}
          <div className="pay-options">
            <button type="button" className={`pay-option ${mode === 'full' ? 'active' : ''}`} onClick={() => chooseMode('full')}>
              <span className="pay-option-title">Pay in full</span>
              <span className="pay-option-sub">{money(fee)} now</span>
            </button>
            <button type="button" className={`pay-option ${mode === 'deposit' ? 'active' : ''}`} onClick={() => chooseMode('deposit')}>
              <span className="pay-option-title">Pay a deposit</span>
              <span className="pay-option-sub">Rest at the venue</span>
            </button>
          </div>

          {mode === 'deposit' && (
            <div className="pay-deposit">
              <label className="pay-label">Amount to pay now</label>
              <input className="pay-input" type="number" min={minDeposit} max={fee} step="0.01" value={payNow} onChange={e => setPayNow(e.target.value)} />
              <div className="pay-quick">
                {[0.2, 0.5, 0.75].map(p => (
                  <button type="button" key={p} className="pay-quick-btn" onClick={() => setPercent(p)}>{Math.round(p * 100)}%</button>
                ))}
              </div>
              <div className="pay-balance">
                <span>💵 Due at the venue</span>
                <span className="pay-balance-amount">{money(balanceDue)}</span>
              </div>
              <p className="pay-note" style={{ marginTop: 4 }}>
                Pay a deposit to reserve your spot — settle {money(balanceDue)} in person on the day.
              </p>
            </div>
          )}

          {stripePromise
            ? <Elements stripe={stripePromise}><StripeCard {...cardProps} /></Elements>
            : <MockCard {...cardProps} />}
        </div>
      </div>
    </div>
  );
}
