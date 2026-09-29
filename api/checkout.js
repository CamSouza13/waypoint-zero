// POST /api/checkout  { items: [{ id, qty }], delivery: 'standard' | 'pickup', note }
// Returns { url } for the hosted Stripe Checkout page.
import Stripe from 'stripe';
import { validateCart, buildSessionParams, siteOrigin, CartError } from '../lib/checkout.js';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (!stripe) return res.status(503).json({ error: 'Checkout is not configured yet.' });

  let cart;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    cart = validateCart(body);
  } catch (e) {
    return res.status(400).json({ error: e instanceof CartError ? e.message : 'Bad request.' });
  }

  try {
    const params = buildSessionParams(cart, siteOrigin(req), {
      automaticTax: process.env.STRIPE_AUTOMATIC_TAX === 'true',
    });
    const session = await stripe.checkout.sessions.create(params);
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('stripe checkout error', e?.type, e?.message);
    return res.status(502).json({ error: 'Could not start checkout. Please try again.' });
  }
}
