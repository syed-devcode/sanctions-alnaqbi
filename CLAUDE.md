# Sanctions Screening Tool — Al Naqbi & Partners

## Project
Sanctions Screening Tool for Al Naqbi & Partners Law Firm
Live URL: https://sanctions-frontend-production.up.railway.app

## Tech Stack
- **Frontend:** React + Vite + Tailwind CSS (`/frontend`)
- **Backend:** Node.js + Express (`/backend`)
- **Database:** Supabase PostgreSQL

## Folder Structure
```
/
├── frontend/          React Vite app (port 5173 dev, 4173 production)
│   ├── src/
│   │   ├── components/   AdminPanel, AuditLog, LoginForm, Navbar, etc.
│   │   ├── context/      AuthContext.jsx (JWT state)
│   │   ├── pages/        Login, Search, Admin
│   │   ├── services/     api.js (axios, uses VITE_API_URL)
│   │   └── assets/       alnaqbi_logo.png
│   ├── railway.toml
│   └── package.json      "start": "serve -s dist -l $PORT"
├── backend/           Node.js Express API (port 8080)
│   ├── src/
│   │   ├── routes/    auth, search, audit, report, sync, users
│   │   ├── parsers/   unParser.js, uaeParser.js
│   │   ├── services/  syncService.js (URL fetch + cron)
│   │   ├── middleware/ auth.js (JWT)
│   │   └── db.js      pg Pool (DATABASE_URL)
│   └── .env           credentials (never commit)
├── data/              local copies of source files (not used by app)
└── schema.sql         full database schema (run once in Supabase SQL Editor)
```

## Database
- **Host:** Supabase PostgreSQL
- **Project URL:** https://nmwzgyhgtezyevkahjgr.supabase.co
- **Connection:** Transaction Pooler (port 6543) — do NOT use direct connection (port 5432), it fails on Railway
- **Credentials:** `/backend/.env` locally, Railway env vars in production
- **Extensions:** `pg_trgm`, `uuid-ossp`, `pgcrypto`

### Tables
| Table | Purpose |
|---|---|
| `users` | Staff/admin accounts (pgcrypto passwords, is_active flag) |
| `sanctions_entries` | One row per sanctioned person/entity (source: UN or UAE) |
| `aliases` | Every name variant per entry — primary search surface |
| `audit_logs` | Every search: user, timestamp, query, risk level, result snapshot |
| `sync_logs` | Import history for manual and scheduled syncs |

## Password Notes
- Supabase DB password: stored in `DATABASE_URL`
- App admin password: `Bionics7`
- Passwords stored and verified using **pgcrypto** `crypt()` in SQL — do NOT use bcrypt

## Running Locally

### Backend
```bash
cd backend
npm install
npm run dev     # port 8080
```

### Frontend
```bash
cd frontend
npm install
npm run dev     # port 5173
```

## Deployed on Railway

### Backend service: `sanctions-alnaqbi`
- URL: https://sanctions-alnaqbi-production.up.railway.app
- Port: 8080

### Frontend service: `sanctions-frontend`
- URL: https://sanctions-frontend-production.up.railway.app
- Port: dynamic (`$PORT`), served with `serve -s dist`
- Config: `frontend/railway.toml`

## Railway Environment Variables

### Backend
| Variable | Value |
|---|---|
| `DATABASE_URL` | PostgreSQL Transaction Pooler connection string |
| `SUPABASE_URL` | https://nmwzgyhgtezyevkahjgr.supabase.co |
| `SUPABASE_ANON_KEY` | stored in Railway |
| `SUPABASE_SERVICE_ROLE_KEY` | stored in Railway |
| `JWT_SECRET` | stored in Railway |
| `FRONTEND_URL` | https://sanctions-frontend-production.up.railway.app |
| `NODE_ENV` | production |
| `PORT` | 8080 |

### Frontend
| Variable | Value |
|---|---|
| `VITE_API_URL` | https://sanctions-alnaqbi-production.up.railway.app |

> `VITE_*` variables are baked in at **build time**. After changing them you must redeploy the frontend.

## Search Architecture
Search uses PostgreSQL full-text search for exact whole-word filtering combined with `word_similarity` (pg_trgm) for scoring:

```sql
WHERE to_tsvector('simple', alias_name) @@ plainto_tsquery('simple', query_text)
ORDER BY word_similarity(query_text, alias_name) DESC
```

- `'simple'` dictionary: no stemming, no stop words, exact word tokens
- Searches primary name AND all aliases (individuals and entities)
- Searches UN list and UAE list simultaneously
- Risk levels: `similarity >= 0.9` → Confirmed Match, `>= 0.4` → Possible Match

## Data Sources (Auto Sync)
- **UN List:** https://scsanctions.un.org/resources/xml/en/consolidated.xml
- **UAE List:** https://data.opensanctions.org/datasets/latest/ae_local_terrorists/targets.nested.json
- Auto sync every **Sunday at midnight** (`node-cron`)
- Manual sync available in admin panel (UN / UAE / Both)
- Sync deletes all existing records for the source, then inserts fresh data

## Backend Config Notes
- `app.set('trust proxy', 1)` enabled — required for `express-rate-limit` on Railway
- CORS configured for Railway frontend URL + localhost dev ports
- Password verification uses pgcrypto SQL: `crypt($2, password_hash)`
- JWT expiry: 8 hours

## Admin User
- **Email:** syed.faisal@alnaqbipartners.com
- **Password:** Bionics7
- **Role:** admin

## Features
- JWT login for staff (8h expiry), deactivatable accounts
- Whole-word name search across primary names and all aliases
- Risk levels: Clear / Possible Match / Confirmed Match
- Match details modal with all entry fields
- Search audit log (staff see own, admin sees all)
- PDF screening report export (per match or full results)
- User management (admin only): add users, set role, reset password, deactivate/activate
- Admin panel: data source status cards (last sync time, record counts, records added)
- Manual + weekly auto sync from official URLs
- Footer: © 2026 Al Naqbi & Partners. All rights reserved. / Developed by Syed Faisal Naseem
- Logo: `frontend/src/assets/alnaqbi_logo.png` (mix-blend-mode: screen on dark backgrounds)

## GitHub
https://github.com/syed-devcode/sanctions-alnaqbi

## Important Notes
- Do **not** commit `/backend/.env`
- Always use Transaction Pooler URL for `DATABASE_URL` — direct connection (port 5432) fails on Railway
- `VITE_*` env vars are build-time only — redeploy frontend after any change
- `schema.sql` seeds the default admin user with a pgcrypto hash
