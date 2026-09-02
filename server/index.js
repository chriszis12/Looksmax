// Looksmax Academy — minimal backend
//
// This is what actually makes the "not visible via inspect element" part true:
// the admin code and the Stripe secret key live only here, in server memory /
// environment variables, never shipped to the browser. Deploy this somewhere
// that runs Node (Render, Railway, Fly.io, a VPS, etc.) — NOT GitHub Pages,
// which only serves static files.
//
// Swap the in-memory Maps below for a real database (Postgres, SQLite, etc.)
// before relying on this in production — memory resets on every restart/deploy.

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Stripe = require('stripe');

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PORT = process.env.PORT || 4000;
const SITE_URL = process.env.SITE_URL || 'http://localhost:5500'; // your GitHub Pages URL in production
const ADMIN_CODE = process.env.ADMIN_CODE; // set this in your host's env vars, never commit it
const PRICE_CENTS = 3000; // $30.00

// unlocked tokens -> true. Swap for a real DB table in production.
const unlockedTokens = new Map();
// stripe checkout session id -> token, set once webhook confirms payment
const sessionTokens = new Map();

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Stripe webhook needs the raw body, so this route is registered before express.json()
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature check failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const token = makeToken();
    unlockedTokens.set(token, true);
    sessionTokens.set(session.id, token);
    // Optional: also grant a Discord role or generate an invite here.
    // See grantDiscordAccess() stub below.
  }

  res.json({ received: true });
});

app.use(cors({ origin: SITE_URL }));
app.use(express.json());

// Serve the frontend (index.html + any assets) from the repo root, one
// folder up from this server/ directory. Same service, same URL, no
// separate static site needed.
app.use(express.static(path.join(__dirname, '..')));

// Creates a Stripe Checkout Session for the $30 course
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Looksmax Academy — Full Course' },
          unit_amount: PRICE_CENTS,
        },
        quantity: 1,
      }],
      success_url: `${SITE_URL}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create checkout session' });
  }
});

// Frontend polls this after redirect back from Stripe
app.get('/api/verify-session', (req, res) => {
  const { session_id } = req.query;
  const token = sessionTokens.get(session_id);
  if (token) return res.json({ unlocked: true, token });
  res.json({ unlocked: false });
});

// Admin / manual access code — checked server-side only
app.post('/api/redeem-code', (req, res) => {
  const { code } = req.body || {};
  if (ADMIN_CODE && code === ADMIN_CODE) {
    const token = makeToken();
    unlockedTokens.set(token, true);
    return res.json({ unlocked: true, token });
  }
  res.json({ unlocked: false });
});

// Any route that should require paid access checks a token like this
app.get('/api/check-access', (req, res) => {
  const token = req.headers['x-access-token'];
  res.json({ unlocked: !!token && unlockedTokens.has(token) });
});

// Optional: assign a Discord role or create a private invite once paid.
// Requires a Discord bot token with the guilds/members scope.
async function grantDiscordAccess(discordUserId) {
  const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const GUILD_ID = process.env.DISCORD_GUILD_ID;
  const ROLE_ID = process.env.DISCORD_COURSE_ROLE_ID;
  if (!BOT_TOKEN || !GUILD_ID || !ROLE_ID) return;

  await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordUserId}/roles/${ROLE_ID}`, {
    method: 'PUT',
    headers: { Authorization: `Bot ${BOT_TOKEN}` },
  });
}

app.listen(PORT, () => console.log(`Looksmax Academy API listening on :${PORT}`));
