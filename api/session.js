// GET /api/session?id=cs_...  Order summary for the confirmation page.
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const ID_RE = /^cs_(test|live)_[A-Za-z0-9]{10,}$/;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (!stripe) return res.status(503).json({ error: 'Checkout is not configured yet.' });
  const id = String(req.query?.id || '');
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'Invalid session.' });

  try {
    const s = await stripe.checkout.sessions.retrieve(id, { expand: ['line_items'] });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      paid: s.payment_status === 'paid',
      order: s.id.slice(-8).toUpperCase(),
      firstName: (s.customer_details?.name || '').split(' ')[0],
      email: s.customer_details?.email || '',
      delivery: s.metadata?.delivery || 'standard',
      total: s.amount_total,
      currency: s.currency,
      items: (s.line_items?.data || []).map((l) => ({ name: l.description, qty: l.quantity, amount: l.amount_total })),
    });
  } catch (e) {
    console.error('stripe session error', e?.type, e?.message);
    return res.status(404).json({ error: 'Order not found.' });
  }
}
