# Looksmax Academy

## What goes where

- **`site/`** — the static frontend. Push this to a GitHub repo and turn on
  GitHub Pages (Settings → Pages → deploy from branch). This is all GitHub
  Pages can host: static HTML/CSS/JS, no server code, no secrets.
- **`server/`** — a small Node/Express API. Deploy this separately on a host
  that runs Node processes: Render, Railway, Fly.io, or your own VPS all work
  with free tiers. GitHub Pages **cannot** run this part.

## Why the split

Anything shipped to the browser — HTML, CSS, JS, cookies, localStorage — is
readable by anyone via view-source or devtools, no matter how it's obfuscated.
That includes the old version of this site, which had the admin code and the
"buy" link sitting in plain JS.

Real gating means the thing that decides "is this person allowed in" runs on
a server the visitor never gets code from. That's what `server/index.js`
does:
- The `$30` price and the Stripe secret key live only in the server's
  environment variables.
- Stripe's webhook confirms a real payment happened before an access token is
  ever created — the frontend can't fake this by editing a cookie.
- The admin code (`ADMIN_CODE` in `.env`) is compared on the server; it's
  never sent to the browser.

## Setup

1. **Frontend**: edit `site/index.html`, set `API_BASE` near the bottom of
   the `<script>` to your deployed server's URL, then push `site/` to GitHub
   Pages.
2. **Backend**:
   ```
   cd server
   cp .env.example .env   # fill in real values, never commit .env
   npm install
   npm start
   ```
   Add a Stripe webhook endpoint pointing at
   `https://your-backend-url/api/stripe-webhook`, listening for
   `checkout.session.completed`.
3. Pick your own `ADMIN_CODE` in `.env` — treat it like a password, not
   something to reuse elsewhere.

## Credits

- Course writing, including the Gut Health module: **@orthodonticsv**
- Site: **@itschriszis**

## Note

This is a scaffold, not a finished production system — swap the in-memory
`Map()`s in `server/index.js` for a real database before you rely on it for
paying customers, and put the server behind HTTPS.
