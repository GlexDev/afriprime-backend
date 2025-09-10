import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import crypto from 'crypto'
import axios from 'axios'
import Stripe from 'stripe'

const app = express()
const PORT = process.env.PORT || 8080
const ORIGIN = process.env.ORIGIN || '*'
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

// raw body needed for webhook signature verification
app.use((req, res, next) => {
  if (req.originalUrl?.startsWith('/webhooks/stripe') || req.originalUrl?.startsWith('/webhooks/paystack')) {
    next()
  } else {
    express.json({ limit: '1mb' })(req, res, next)
  }
})

app.use(cors({ origin: ORIGIN, credentials: true }))
app.use(helmet())
app.use(morgan('dev'))

// Health
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }))

// --- Telegram WebApp login validation ---
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
function validateTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return false
  // initData is a URLSearchParams string (e.g., query from tg.initData)
  const url = new URLSearchParams(initData)
  const hash = url.get('hash')
  url.delete('hash')
  const data = []
  url.sort() // ensure sorted
  for (const [key, value] of url.entries()) {
    data.push(`${key}=${value}`)
  }
  const dataCheckString = data.join('\n')
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const calcHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  return calcHash === hash
}

app.post('/auth/telegram/validate', express.json(), (req, res) => {
  try {
    const { initData } = req.body || {}
    const ok = validateTelegramInitData(initData, process.env.BOT_TOKEN)
    if (!ok) return res.status(401).json({ ok: false, error: 'invalid_init_data' })
    // Optionally parse user
    const params = new URLSearchParams(initData)
    const userRaw = params.get('user')
    const user = userRaw ? JSON.parse(userRaw) : null
    return res.json({ ok: true, user })
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message })
  }
})

// --- Stripe Checkout (optional, requires keys) ---
app.post('/payments/checkout/stripe', express.json(), async (req, res) => {
  try {
    if (!stripe) return res.status(400).json({ ok: false, error: 'stripe_not_configured' })
    const { customer_email, metadata } = req.body || {}
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: process.env.STRIPE_SUCCESS_URL,
      cancel_url: process.env.STRIPE_CANCEL_URL,
      customer_email,
      metadata
    })
    return res.json({ ok: true, id: session.id, url: session.url })
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message })
  }
})

// --- Stripe Webhook ---
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const sig = req.headers['stripe-signature']
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    let event
    if (!secret) {
      // Fallback: trust body in dev ONLY
      event = JSON.parse(req.body)
    } else {
      event = stripe.webhooks.constructEvent(req.body, sig, secret)
    }
    // Handle events
    switch (event.type) {
      case 'checkout.session.completed':
        // TODO: mark user as paid, store event.id
        break
      default:
        break
    }
    res.json({ received: true })
  } catch (err) {
    console.error('Stripe webhook error:', err.message)
    res.status(400).send(`Webhook Error: ${err.message}`)
  }
})

// --- Paystack Initialize (returns authorization_url to redirect) ---
app.post('/payments/checkout/paystack', express.json(), async (req, res) => {
  try {
    const { email, amountNaira, metadata } = req.body || {}
    const secret = process.env.PAYSTACK_SECRET_KEY
    if (!secret) return res.status(400).json({ ok: false, error: 'paystack_not_configured' })
    // Amount in kobo
    const amount = Math.round(Number(amountNaira) * 100)
    const resp = await axios.post('https://api.paystack.co/transaction/initialize', {
      email,
      amount,
      callback_url: process.env.PAYSTACK_CALLBACK_URL,
      metadata
    }, { headers: { Authorization: `Bearer ${secret}` } })
    return res.json({ ok: true, data: resp.data.data })
  } catch (e) {
    const msg = e.response?.data || e.message
    return res.status(500).json({ ok: false, error: msg })
  }
})

// --- Paystack Webhook ---
app.post('/webhooks/paystack', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY
    const signature = req.headers['x-paystack-signature']
    const computed = crypto.createHmac('sha512', secret).update(req.body).digest('hex')
    if (signature !== computed) return res.status(401).send('Invalid signature')
    const event = JSON.parse(req.body.toString('utf8'))
    // Handle event
    if (event.event === 'charge.success') {
      // TODO: mark user as paid
    }
    res.json({ received: true })
  } catch (e) {
    console.error('Paystack webhook error:', e.message)
    res.status(400).send('Webhook Error')
  }
})

// --- Simple in-memory store (placeholder) ---
const users = new Map()
app.post('/profile/save', express.json(), (req, res) => {
  const { user_id, profile } = req.body || {}
  if (!user_id) return res.status(400).json({ ok: false, error: 'missing_user_id' })
  users.set(user_id, profile)
  res.json({ ok: true })
})
app.get('/profile/get/:id', (req, res) => {
  const p = users.get(req.params.id) || null
  res.json({ ok: true, profile: p })
})

app.listen(PORT, () => {
  console.log(`✅ AfriPrime backend listening on :${PORT}`)
  console.log('   ORIGIN:', ORIGIN)
})
