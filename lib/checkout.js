// Builds Stripe Checkout Session params from a cart.
// Prices always come from the server-side catalog, never from the browser.
import CATALOG from './catalog.js';

// Shipping rules. Keep these in sync with SHIP in index.html.
export const SHIP = {
  standard: { label: 'Standard ground shipping', amount: 14, freeOver: 200, minDays: 3, maxDays: 7 },
  pickup: { label: 'Pickup or install in San Diego', amount: 0 },
};

const MAX_LINES = 50;
const MAX_QTY = 50;
const ID_RE = /^WZ-\d{4}$/;

export class CartError extends Error {}

export function validateCart(body) {
  const items = Array.isArray(body?.items) ? body.items : null;
  if (!items || items.length === 0) throw new CartError('Your order is empty.');
  if (items.length > MAX_LINES) throw new CartError('Too many line items.');
  const seen = new Map();
  for (const it of items) {
    const id = String(it?.id ?? '');
    const qty = Number(it?.qty);
    if (!ID_RE.test(id) || !CATALOG[id]) throw new CartError(`Unknown part: ${id || 'blank'}.`);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new CartError(`Invalid quantity for ${id}.`);
    seen.set(id, (seen.get(id) || 0) + qty);
  }
  const delivery = body?.delivery === 'pickup' ? 'pickup' : 'standard';
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 480) : '';
  return { lines: [...seen].map(([id, qty]) => ({ id, qty, part: CATALOG[id] })), delivery, note };
}

export function subtotalDollars(lines) {
  return lines.reduce((a, l) => a + l.part.price * l.qty, 0);
}

export function buildSessionParams(cart, origin, { automaticTax = false } = {}) {
  const { lines, delivery, note } = cart;
  const sub = subtotalDollars(lines);
  const ship = SHIP[delivery];
  const shipCents = delivery === 'standard' && sub >= ship.freeOver ? 0 : ship.amount * 100;

  const rate = {
    shipping_rate_data: {
      type: 'fixed_amount',
      display_name: delivery === 'standard' && shipCents === 0 ? `${ship.label} (free over $${ship.freeOver})` : ship.label,
      fixed_amount: { amount: shipCents, currency: 'usd' },
      tax_behavior: 'exclusive',
      tax_code: 'txcd_92010001',
      ...(delivery === 'standard' && {
        delivery_estimate: {
          minimum: { unit: 'business_day', value: ship.minDays },
          maximum: { unit: 'business_day', value: ship.maxDays },
        },
      }),
    },
  };

  const params = {
    mode: 'payment',
    line_items: lines.map(({ id, qty, part }) => ({
      quantity: qty,
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(part.price * 100),
        tax_behavior: 'exclusive',
        product_data: {
          name: part.name,
          description: `${id} · ${part.material} · Made to order, ${part.leadTime}`.slice(0, 500),
          ...(part.image && { images: [`${origin}/${part.image}`] }),
          metadata: { sku: id },
        },
      },
    })),
    shipping_options: [rate],
    phone_number_collection: { enabled: true },
    custom_fields: [
      {
        key: 'boat',
        label: { type: 'custom', custom: 'Boat make, model, and year' },
        type: 'text',
        optional: false,
      },
    ],
    allow_promotion_codes: true,
    metadata: { delivery, note, skus: lines.map((l) => `${l.id}x${l.qty}`).join(',').slice(0, 500) },
    payment_intent_data: { metadata: { delivery } },
    success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}#order-complete`,
    cancel_url: `${origin}/#checkout`,
  };
  if (delivery === 'standard') params.shipping_address_collection = { allowed_countries: ['US'] };
  if (automaticTax) params.automatic_tax = { enabled: true };
  return params;
}

export function siteOrigin(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}
