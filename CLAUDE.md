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
├── frontend/          React Vite app (port 5173 dev, $PORT production)
│   ├── src/
│   │   ├── components/   AdminPanel, AuditLog, LoginForm, Navbar,
│   │   │                 SearchBar, ResultsTable, MatchModal,
│   │   │                 UserManagement, Footer
│   │   ├── context/      AuthContext.jsx (JWT + demo state)
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
├── data/              unused — app fetches directly from URLs
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
| `users` | Staff/admin/demo accounts (pgcrypto passwords, is_active, demo counters) |
| `sanctions_entries` | One row per sanctioned person/entity (source: UN or UAE) |
| `aliases` | Separate table — every name variant per entry, joined via `entry_id` |
| `audit_logs` | Every search: user, timestamp, query, risk level, result snapshot |
| `sync_logs` | Import history for manual and scheduled syncs |

### Key column names
- `sanctions_entries.primary_name` — the main display name (not `full_name`)
- `aliases.entry_id` — FK to `sanctions_entries.id` (ON DELETE CASCADE)
- `aliases.alias_name` — the searchable name string
- `users.demo_searches_used` — integer, default 0; tracks searches consumed
- `users.demo_search_limit` — integer, default 10; per-user configurable limit
- `users.demo_expires_at` — nullable timestamptz
- `users.role` — CHECK constraint: `admin`, `staff`, `demo`

## Password Notes
- Supabase DB password: stored in `DATABASE_URL`
- App admin password: `Bionics7`
- Passwords stored and verified using **pgcrypto** `crypt()` in SQL — do NOT use bcrypt
- Login SQL: `WHERE email = $1 AND password_hash = crypt($2, password_hash) AND is_active = true`

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
- Port: dynamic (`$PORT`), served with `serve -s dist -l $PORT`
- `serve` is in `dependencies` (not devDependencies) so it's available at runtime

## Railway Environment Variables

### Backend
| Variable | Value |
|---|---|
| `DATABASE_URL` | PostgreSQL Transaction Pooler connection string (port 6543) |
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

## Backend Config Notes
- `app.set('trust proxy', 1)` — must be first, before rate limiter; required on Railway
- CORS: function-based origin allowlist, `credentials: true`, explicit `OPTIONS` preflight handler
- Password verification: pgcrypto SQL `crypt($2, password_hash)` — bcrypt is not used anywhere
- JWT expiry: 8 hours; token contains `{ id, email, role }`

## Search Architecture
Search runs a direct SQL query (not the stored function) so all matching aliases are captured:

```sql
SELECT ... FROM aliases a
JOIN sanctions_entries se ON a.entry_id = se.id
WHERE to_tsvector('simple', a.alias_name) @@ plainto_tsquery('simple', $1)
  AND word_similarity($1, a.alias_name) >= $2
ORDER BY word_similarity($1, a.alias_name) DESC
```

- No `DISTINCT ON` — returns one row per **matching alias**, grouped in Node.js by `entry_id`
- Each result includes `matched_aliases[]` (aliases that hit the query) and `all_aliases[]` (every stored alias for the entry)
- Results table shows all matched aliases stacked; modal shows all known aliases with matched ones highlighted
- Risk levels: `similarity >= 0.9` → Confirmed Match, `>= 0.4` → Possible Match
- Second query fetches all aliases for matched entries: `WHERE entry_id = ANY($1::uuid[])`

## Data Sources (Auto Sync)
- **UN List:** https://scsanctions.un.org/resources/xml/en/consolidated.xml
- **UAE List:** https://data.opensanctions.org/datasets/latest/ae_local_terrorists/targets.nested.json
- Auto sync every **Sunday at midnight** (`node-cron`, `'0 0 * * 0'`)
- Manual sync available in admin panel (UN / UAE / Both)
- Sync: DELETE all rows for source (aliases cascade) → INSERT fresh data
- Parsers accept content as string parameter (no local file dependency)

## PDF Report
- Generated with PDFKit in `backend/src/routes/report.js`
- **Header:** company logo (if found) + "SANCTIONS SCREENING REPORT" + divider line
- **Columns:** Risk | Primary Name | Matched Alias | All Aliases | Src | Nationality | DOB
- Column widths sum to exactly 495pt (A4 content width)
- Row heights calculated with `doc.heightOfString()` — no text overflow
- Alternating row backgrounds + vertical grid lines
- **Footer** (every page, absolute position): disclaimer + © 2026 Al Naqbi & Partners + page number
- Logo loaded from `backend/assets/alnaqbi_logo.png` (production) or `frontend/src/assets/alnaqbi_logo.png` (local dev)
- All text sanitised through `cleanText()` — strips non-Latin-1 characters (Arabic script aliases render as garbage in Helvetica)
- Aliases joined with `, ` separator (not newlines)
- Demo users cannot export PDF

## Demo User Feature
- Role `demo` is valid in the `users` table (`CHECK (role IN ('admin', 'staff', 'demo'))`)
- `demo_searches_used` column tracks total searches consumed (integer, default 0)
- `demo_search_limit` column is the per-user configurable cap (integer, default 10)
- `demo_expires_at` column for optional expiry (nullable timestamptz)
- **Limit:** checked live from DB before each search (not from JWT, which is stale)
- **Backend block:** returns `{ error: '...', limitReached: true }` with HTTP 403 when `demo_searches_used >= demo_search_limit`
- **Increment:** `UPDATE users SET demo_searches_used = demo_searches_used + 1 RETURNING demo_searches_used, demo_search_limit`
- **Response:** includes `remainingSearches = demo_search_limit - demo_searches_used` on every search response
- **Login response:** includes both `demo_searches_used` and `demo_search_limit` so banner is correct on first page load
- **Frontend:** uses `user.demo_search_limit ?? 10` (never hardcoded 10) for all banner/progress bar calculations
- **Frontend banner:** amber "Demo Account — X of Y searches remaining" with progress bar
- **At limit:** red banner with contact email; search input and button disabled
- **Export PDF:** hidden for demo users
- **Admin panel:** not accessible to demo users
- **Navbar:** shows orange "Demo" badge instead of role text

## Demo Search Limit Control (Admin Panel)
Admin has full per-user control over demo search allowances from the User Management table:

- **Usage display:** Role column shows `X / Y searches used` below the role dropdown for demo users
- **Reset Counter:** sets `demo_searches_used = 0` (restores all remaining searches within current limit)
- **Add Searches:** opens popup → enter a number → adds that amount to `demo_search_limit`
  - Example: user at 8/10, admin adds 5 → now 8/15 (limit raised, not counter reset)
- **Change Limit:** opens popup → enter new total → sets `demo_search_limit` to that value
  - Example: change from 10 to 20 total

### Backend routes (`backend/src/routes/users.js`)
| Route | Action |
|---|---|
| `PUT /users/:id/demo-reset` | Sets `demo_searches_used = 0` |
| `PUT /users/:id/demo-add` | Adds `{ amount }` to `demo_search_limit` |
| `PUT /users/:id/demo-limit` | Sets `demo_search_limit` to `{ limit }` |

All three routes require admin auth, verify `role = 'demo'`, and return updated `{ demo_searches_used, demo_search_limit }`.

### Frontend API calls (`frontend/src/services/api.js`)
```js
usersAPI.resetDemoCounter(id)
usersAPI.addDemoSearches(id, amount)
usersAPI.setDemoLimit(id, limit)
```

### Migration SQL (run once in Supabase if upgrading an existing DB)
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_search_limit int NOT NULL DEFAULT 10;
```

## Sync Architecture & Known Issues

### How Sync Works
- Admin triggers manual sync (or auto-sync fires every Sunday midnight)
- Backend downloads fresh data from the official source URL
- Records are **upserted** (not delete-all-then-insert) — old data stays intact during the process
- Stale records (in DB but not in the new data) are deleted only **after** all batches complete successfully
- If sync fails at any point, existing records in the database are unaffected
- The 50MB XML download happens only during sync — NOT during user searches (searches hit Supabase only)

### Sync Process: Batched Bulk Inserts
- Records are processed in batches of **50** with a 1-second pause between batches
- Each batch uses 3 bulk SQL queries (`unnest()`) instead of individual row inserts:
  1. Bulk UPSERT all 50 entries in one query
  2. Bulk DELETE old aliases for those entries
  3. Bulk INSERT all new aliases in one query
- This reduces ~350 individual queries per batch down to 3 — sync completes in under 2 minutes
- Hard timeout: **10 minutes** — if exceeded, `sync_logs` is marked `failed` automatically

### Stuck Sync Fix (SQL)
If the admin panel shows "Syncing…" indefinitely (e.g. after a Railway restart mid-sync), run this in Supabase to reset stuck logs:
```sql
UPDATE sync_logs SET status = 'failed', error_message = 'Manually reset', completed_at = now()
WHERE status = 'started';
```

### Railway Free Tier Notes
- UN XML is ~50MB — download takes 30–60 seconds on Railway's network
- The admin panel polls every 5 seconds while sync is running (normal — not a bug)
- Auto-sync attempts every Sunday midnight regardless; if it times out, existing data is preserved
- UAE list syncs reliably (smaller JSON file, faster parse)

### Current Database State
| Source | Records | Origin |
|---|---|---|
| UN | ~1,009 | Initial local file load |
| UAE | varies | Last sync from OpenSanctions |

All records are searchable. New syncs will update the UN count to the current live total.

## Admin User
- **Email:** syed.faisal@alnaqbipartners.com
- **Password:** Bionics7
- **Role:** admin

## Features
- JWT login for staff/admin/demo (8h expiry), deactivatable accounts
- Whole-word name search across ALL aliases (primary name + every known alias)
- All matching aliases shown per result — not just the best one
- Risk levels: Clear / Possible Match / Confirmed Match
- Match details modal: Matched Aliases section + All Known Aliases section (matched ones highlighted)
- Search audit log (staff see own, admin sees all; demo cannot access)
- PDF screening report export with professional layout and per-page footer
- User management (admin only): add users (staff/admin/demo), role change, password reset, deactivate/activate, demo search controls (reset counter, add searches, change limit)
- Admin panel: data source status cards (last sync time, total records, records added per sync)
- Manual + weekly auto sync from official URLs (no local file dependency)
- Footer on all pages: © 2026 Al Naqbi & Partners. All rights reserved. / Developed by Syed Faisal Naseem
- Logo: `frontend/src/assets/alnaqbi_logo.png` (`mix-blend-mode: screen` on dark backgrounds)

## GitHub
https://github.com/syed-devcode/sanctions-alnaqbi

## Deployment Workflow
1. `git add .` → `git commit` → `git push`
2. Railway auto-deploys backend and frontend on push
3. After **schema changes**: run the ALTER TABLE SQL in Supabase SQL Editor first
4. After **`VITE_*` variable changes**: must redeploy frontend (variables are build-time only)
5. After **demo counter reset**: done via admin panel or direct SQL in Supabase

## Important Notes
- Do **not** commit `/backend/.env`
- Always use Transaction Pooler URL (port 6543) for `DATABASE_URL` — direct connection fails on Railway
- `bcrypt` / `bcryptjs` is **not used** — pgcrypto only
- The `aliases` table is separate from `sanctions_entries`, joined via `entry_id` FK
- PDF text encoding: Helvetica only supports Latin-1; Arabic aliases are stripped by `cleanText()` before rendering
