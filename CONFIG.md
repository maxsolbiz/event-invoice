# Event Invoice System — Configuration Guide

> Single reference for all production configurations, deployment procedures, and operational commands.

---

## 1. Project Overview

| Item | Detail |
|------|--------|
| **Domain** | `https://event.maxsolbiz.com` |
| **Git repo** | `git@github.com:maxsolbiz/event-invoice.git` (branch: `main`) |
| **Backend** | Express 4 + better-sqlite3 + bcrypt + express-session |
| **Frontend** | Next.js 16 (standalone) + React 19 + Tailwind 4 |
| **VPS IP** | `178.105.109.19` |
| **SSH Key** | `C:\Users\Max\.ssh\meezan_vps` (user: `root`) |
| **Process Manager** | PM2 |
| **Web Server** | Apache2 (reverse proxy + SSL termination) |
| **SSL** | Let's Encrypt via Certbot |
| **DNS** | Cloudflare (zone ID: `49072fa24b016fdfe93fa0a5230004bf`) |

**Roles:**
- `admin` — full access (Settings, Users, Logs, Invoices, Clients)
- `user` — invoices + clients only

---

## 2. Ports & Services

| Service | Local Dev | Production (VPS) |
|---------|-----------|-------------------|
| Backend (Express) | `3000` | `3001` |
| Frontend (Next.js) | `3001` | `3002` |
| Apache (HTTP) | — | `80` → redirects to `443` |
| Apache (HTTPS) | — | `443` → proxies to `:3001`/`:3002` |

**Request flow:**
```
Browser → Cloudflare (HTTPS) → Apache :443
  ├─ /api/*  → http://127.0.0.1:3001  (backend)
  └─ /*      → http://127.0.0.1:3002  (frontend)
```

---

## 3. Environment Variables

### Backend (`/root/event-invoice/backend/.env`)

| Variable | Value | Description |
|----------|-------|-------------|
| `SESSION_SECRET` | (random 64-char string) | Required. Server exits if missing. |
| `PORT` | `3001` | Backend listen port |
| `FRONTEND_URL` | `https://event.maxsolbiz.com` | CORS origin |
| `NODE_ENV` | `production` | Enables secure cookies + trust proxy |

### Frontend (`.env.production`, gitignored)

| Variable | Value | Description |
|----------|-------|-------------|
| `API_URL` | `http://localhost:3001` | Next.js rewrite target (used in dev only; Apache handles it in prod) |

---

## 4. Database

**Engine:** SQLite via better-sqlite3  
**Path:** `backend/data/invoice.db`  
**Sessions:** `backend/data/sessions.db`  
**Pragmas:** `journal_mode = WAL`, `foreign_keys = ON`

### Tables

| Table | Purpose |
|-------|---------|
| `users` | id, username (UNIQUE), password_hash, role (admin/user), is_active, password_changed_at, created_at |
| `settings` | id, company_name, company_subtitle, invoice_prefix, default_currency, default_vat, default_payment_terms, default_notes, company_logo (base64), company_stamp (base64) |
| `clients` | id, name, contact, address, created_at |
| `invoices` | id, pi_no, invoice_date, currency, client_name, client_contact, venue, event_date, event_type, event_note, client_address, vat, payment_terms, notes, subtotal, total, client_id (FK), created_by (FK), created_at |
| `invoice_services` | id, invoice_id (FK CASCADE), sort_order, description, qty, unit_price, amount |
| `login_events` | id, user_id (FK), username_attempted, success, failure_reason, ip_address, user_agent, created_at |
| `activity_log` | id, user_id (FK), username_snapshot, action, entity_type, entity_id, description, created_at |

**Default admin seed (production only):** username `admin`, password `admin123`, role `admin` — only created when no users exist.

---

## 5. Security Configuration

| Setting | Value |
|---------|-------|
| Password hashing | bcrypt, cost factor 12 |
| Min password length | 6 characters |
| Session store | connect-sqlite3 (`sessions.db`) |
| Cookie httpOnly | `true` |
| Cookie secure | `true` in production (via `NODE_ENV`) |
| Cookie sameSite | `lax` |
| Cookie maxAge | 24 hours |
| Trust proxy | `1` (production — Apache) |
| JSON body limit | `1mb` (supports base64 logo/stamp) |
| Login rate limit | 10 requests per 15-minute window |
| Rate limit key | `req.ip` |

**Last-admin protection:** Cannot deactivate or demote the last active admin.  
**Password change:** Forces re-login (session invalidation via `password_changed_at` check).

---

## 6. API Routes

| Route | Methods | Auth | Role |
|-------|---------|------|------|
| `/api/auth/login` | POST | No | — |
| `/api/auth/logout` | POST | Yes | any |
| `/api/auth/me` | GET | Yes | any |
| `/api/invoices` | GET, POST | Yes | any |
| `/api/invoices/:id` | GET, PUT, DELETE | Yes | any |
| `/api/clients` | GET, POST | Yes | any |
| `/api/clients/:id` | GET, DELETE | Yes | any |
| `/api/settings` | GET, PUT | Yes | any |
| `/api/users` | GET, POST | Yes | admin |
| `/api/users/:id` | PUT | Yes | admin |
| `/api/users/:id/password` | PUT | Yes | admin |
| `/api/logs/login-events` | GET | Yes | admin |
| `/api/logs/activity` | GET | Yes | admin |
| `/api/health` | GET | No | — |

---

## 7. VPS Directory Structure

```
/root/event-invoice/              ← git clone
  backend/
    .env                          ← symlink → /root/event-invoice-env/backend.env
    src/                          ← source code (from git)
    data/                         ← symlink → /root/event-invoice-env/data/
      invoice.db                  ← production database
      sessions.db                 ← session store
    node_modules/                 ← npm install --production
  frontend/
    .env.production               ← gitignored, copied from backup
    .next/standalone/             ← production build
      server.js                   ← standalone entry point
      .next/static/               ← copied from build output
    node_modules/                 ← npm install
  start.sh                        ← backend startup script
  start-frontend.sh               ← frontend startup script
  deploy.sh                       ← deployment script

/root/event-invoice-env/          ← secrets (outside git)
  backend.env                     ← SESSION_SECRET, PORT, FRONTEND_URL, NODE_ENV
  data/                           ← SQLite database files
  frontend.env.production         ← API_URL for frontend
```

---

## 8. Apache Configuration

### HTTP (`event.maxsolbiz.com.conf`)
- Redirects all traffic to HTTPS (301 permanent)

### HTTPS (`event.maxsolbiz.com-le-ssl.conf`)
```apache
ProxyPreserveHost On
RequestHeader set X-Forwarded-Proto "https"
ProxyPass /api/ http://127.0.0.1:3001/api/
ProxyPassReverse /api/ http://127.0.0.1:3001/api/
ProxyPass / http://127.0.0.1:3002/
ProxyPassReverse / http://127.0.0.1:3002/
```

**SSL cert:** `/etc/letsencrypt/live/event.maxsolbiz.com/fullchain.pem`  
**SSL key:** `/etc/letsencrypt/live/event.maxsolbiz.com/privkey.pem`  
**HSTS:** `max-age=31536000; includeSubDomains; preload`  
**Auto-renewal:** Certbot cron job (verify with `certbot certificates`)

---

## 9. Deployment

### Standard workflow
```bash
# Local machine
git push origin main

# VPS
ssh root@178.105.109.19 "/root/event-invoice/deploy.sh"
```

### What deploy.sh does
1. `git pull origin main`
2. `cd backend && npm install --production`
3. `cd frontend && npm install && npm run build`
4. Copy `.next/static` → `.next/standalone/.next/static`
5. `pm2 restart event-invoice-backend`
6. `pm2 restart event-invoice-frontend`
7. `pm2 save`

### Manual full setup (from scratch)
```bash
ssh root@178.105.109.19

# Clone
git clone git@github.com:maxsolbiz/event-invoice.git /root/event-invoice

# Secrets
mkdir -p /root/event-invoice-env/data
# Create /root/event-invoice-env/backend.env with:
#   SESSION_SECRET=<random-string>
#   PORT=3001
#   FRONTEND_URL=https://event.maxsolbiz.com
#   NODE_ENV=production

# Symlinks
ln -sf /root/event-invoice-env/backend.env /root/event-invoice/backend/.env
ln -sf /root/event-invoice-env/data /root/event-invoice/backend/data
cp /root/event-invoice-env/frontend.env.production /root/event-invoice/frontend/.env.production

# Install
cd /root/event-invoice/backend && npm install --production
cd /root/event-invoice/frontend && npm install && npm run build
cp -r .next/static .next/standalone/.next/static

# PM2
pm2 start /root/event-invoice/start.sh --name event-invoice-backend
pm2 start /root/event-invoice/start-frontend.sh --name event-invoice-frontend
pm2 save
```

---

## 10. Key Commands Reference

### PM2
```bash
pm2 list                          # List all processes
pm2 logs event-invoice-backend    # Tail backend logs
pm2 logs event-invoice-frontend   # Tail frontend logs
pm2 restart event-invoice-backend # Restart backend
pm2 restart event-invoice-frontend# Restart frontend
pm2 save                          # Save process list (auto-restart on reboot)
```

### Backend
```bash
cd /root/event-invoice/backend
node src/index.js                  # Start manually
node --watch src/index.js          # Dev mode with auto-restart
npm test                           # Run all 113 tests
```

### Frontend
```bash
cd /root/event-invoice/frontend
npm run build                      # Production build
PORT=3002 node .next/standalone/server.js  # Run standalone
```

### Database
```bash
# Check users
node -e "const db=require('better-sqlite3')('/root/event-invoice-env/data/invoice.db');console.log(db.prepare('SELECT * FROM users').all())"

# Reset admin password
node -e "const db=require('better-sqlite3')('/root/event-invoice-env/data/invoice.db');const bcrypt=require('bcrypt');bcrypt.hash('admin123',12).then(h=>{db.prepare('UPDATE users SET password_hash=? WHERE username=?').run(h,'admin');console.log('done')})"

# Backup
cp /root/event-invoice-env/data/invoice.db /root/event-invoice-env/data/invoice.db.bak
```

### Apache
```bash
apache2ctl configtest              # Verify config
systemctl reload apache2           # Reload after config changes
certbot certificates               # Check SSL cert status
certbot renew --dry-run            # Test auto-renewal
```

---

## 11. Predefined Services (Quick-Add)

These are available in the invoice creation form:

1. Sound System (Basic)
2. Sound System (Premium)
3. Lighting Setup
4. LED Wall Rental
5. Stage Setup
6. Backdrop Design
7. Photography
8. Videography
9. Live Streaming
10. Event Coordination

---

## 12. Default Settings (Seeded)

| Setting | Default |
|---------|---------|
| Company Name | MOMENT ORGANIZER EVENTS MANAGING |
| Company Subtitle | Event Management & Event Decoration |
| Invoice Prefix | MOE-PI- |
| Default Currency | AED |
| Default VAT | 0 |
| Default Payment Terms | As agreed with the client. |
| Default Notes | This Proforma Invoice is issued for the above-mentioned event service. |

---

## 13. Cloudflare

| Item | Value |
|------|-------|
| Zone (maxsolbiz.com) | `49072fa24b016fdfe93fa0a5230004bf` |
| API Token | In `D:\Meezan\infra.env` as `CF_TOKEN` |
| DNS record | A `event.maxsolbiz.com` → `178.105.109.19` (proxied) |
| SSL mode | Full (strict) |
| HSTS | Enabled |

---

## 14. Troubleshooting

| Problem | Solution |
|---------|----------|
| Backend exits with "SESSION_SECRET" error | Check `.env` file exists and has `SESSION_SECRET` set |
| Cookie not persisting in browser | Verify `trust proxy` is set, `X-Forwarded-Proto` header is present, `secure: true` only with HTTPS |
| Login returns "Invalid credentials" | Check password hash in DB matches; reset via command in section 10 |
| Frontend shows 503 | Check PM2 status: `pm2 list` — restart if errored |
| Static assets 404 after deploy | Ensure `cp -r .next/static .next/standalone/.next/static` ran during build |
| "source .env" doesn't work | Use `set -a` before `source` to auto-export variables |
| Cannot deactivate last admin | System prevents it — create a second admin first |

---

*Last updated: 25 August 2026*
