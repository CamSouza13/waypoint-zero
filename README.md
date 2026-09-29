# Waypoint Zero site

This folder holds the static site plus two serverless functions for Stripe Checkout. It deploys to Vercel as is.

## What's here

| Path | Purpose |
|---|---|
| `index.html`, `img/` | The site, store, product pages, checkout page and confirmation page |
| `api/checkout.js` | `POST /api/checkout`. Takes the cart and returns a Stripe Checkout link |
| `api/session.js` | `GET /api/session?id=`. Returns the order summary for the confirmation page |
| `lib/checkout.js` | Cart checks, shipping rules and Stripe session settings |
| `lib/catalog.js` | Server-side price list, generated from the store catalog |

The browser only sends part numbers and quantities. Prices always come from `lib/catalog.js`, so nobody can change a price in their browser and pay less.

## How to deploy

1. Create a Stripe account at dashboard.stripe.com and finish business verification.
2. In Stripe, go to Developers, then API keys, and copy the **test** secret key (`sk_test_...`).
3. Put this folder in a GitHub repo and import it into Vercel, or run `npx vercel` from this folder. Set the framework preset to **Other**.
4. In Vercel, go to Project Settings, then Environment Variables, and add:
   - `STRIPE_SECRET_KEY`: your `sk_test_...` key
   - `SITE_URL`: your domain, for example `https://waypointzero.com` (optional; the request host is used if you leave it out)
5. Redeploy. Place a test order with card `4242 4242 4242 4242`, any future expiry date and any CVC.
6. When the test order works, change `STRIPE_SECRET_KEY` to your live key (`sk_live_...`) and redeploy.

Selling needs Vercel Pro, because Hobby plans are for non-commercial use only.

## Settings to review before going live

- **Shipping:** `SHIP` in `lib/checkout.js`. The default is $14 ground shipping, free over $200, plus free pickup or install in San Diego. If you change it, update `SHIP` in `index.html` too so the checkout page shows the same numbers.
- **Sales tax:** turn on Stripe Tax in the Dashboard, add your California registration, then set `STRIPE_AUTOMATIC_TAX=true`.
- **Receipts and order alerts:** in Stripe, go to Settings, then Customer emails, and turn on successful payment receipts. Turn on your own email alerts for new payments too.
- **Policies:** the checkout page links to the returns and warranty section. Confirm those terms before you take live orders.
- **Prices:** set in the store catalog. Run the build to regenerate `lib/catalog.js` and `index.html` together.

## Stripe Connect

This setup doesn't use Stripe Connect. Connect is for platforms that route payments to other sellers. Waypoint Zero is the only seller here, so a standard Stripe account and Checkout is the right fit. If you later pay fabricators or installers through the site, Connect can be added then.
