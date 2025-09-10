# AfriPrime Backend Starter

Express backend with:
- ✅ Telegram WebApp login validation (`/auth/telegram/validate`)
- ✅ Stripe Checkout stub + webhook (`/payments/checkout/stripe`, `/webhooks/stripe`)
- ✅ Paystack initialize + webhook (`/payments/checkout/paystack`, `/webhooks/paystack`)
- ✅ Profile save/get placeholder (in-memory)

## Run

```bash
npm install
cp .env.example .env
# edit .env (BOT_TOKEN, Stripe/Paystack keys, URLs)
npm run dev
```

## Telegram WebApp Login Validation
Send `initData` (the raw `tg.initData`) as JSON to:
```
POST /auth/telegram/validate
{ "initData": "<window.Telegram.WebApp.initData>" }
```
The server recomputes the HMAC according to Telegram docs and returns `{ ok: true, user }` if valid.

## Stripe
- Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL` in `.env`.
- Create a Session: `POST /payments/checkout/stripe` → `{ id, url }`
- Webhook endpoint: `/webhooks/stripe` (set this in your Stripe Dashboard).

## Paystack
- Set `PAYSTACK_SECRET_KEY`, `PAYSTACK_CALLBACK_URL` in `.env`.
- Initialize: `POST /payments/checkout/paystack` with `{ email, amountNaira }` → `{ authorization_url }`
- Webhook endpoint: `/webhooks/paystack` (configure on Paystack dashboard).

## CORS
`ORIGIN` controls allowed front-end origin (your Mini App URL).

## Notes
- The profile endpoints are placeholders; wire to Postgres/Supabase later.
- For webhooks, deploy publicly and use your live URL in Paystack/Stripe settings.
