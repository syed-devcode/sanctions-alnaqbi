# Sanctions Screening Tool — Al Naqbi & Partners

## Project Overview
Law firm sanctions screening tool that searches the UN Consolidated List and the UAE Local Terrorists List. Built for internal compliance staff with role-based access, full audit logging, and PDF report export.

## Tech Stack
- **Frontend:** React 18 + Vite + Tailwind CSS (in `/frontend`)
- **Backend:** Node.js + Express (in `/backend`)
- **Database:** Supabase PostgreSQL

## Folder Structure
```
/
├── frontend/          React Vite app (port 5173)
├── backend/           Node.js Express API (port 3001)
│   ├── src/
│   │   ├── routes/    auth, search, audit, report, sync, users
│   │   ├── parsers/   unParser.js, uaeParser.js
│   │   ├── services/  syncService.js (import + cron)
│   │   ├── middleware/ auth.js (JWT)
│   │   └── db.js      pg Pool connection
│   └── .env           Supabase credentials (never commit)
├── data/
│   ├── consolidatedLegacyByNAME.xml   UN Consolidated List
│   └── targets.nested.json            UAE Local Terrorists (NDJSON)
└── schema.sql         Full database schema (run once in Supabase SQL Editor)
```

## Database
- **Host:** Supabase PostgreSQL (session pooler, port 5432)
- **Credentials:** `/backend/.env`
- **Extensions:** `pg_trgm`, `uuid-ossp`

### Tables
| Table | Purpose |
|---|---|
| `users` | Staff/admin accounts (bcrypt passwords, is_active flag) |
| `sanctions_entries` | One row per sanctioned person/entity (source: UN or UAE) |
| `aliases` | Every name variant per entry — primary search surface |
| `audit_logs` | Every search: user, timestamp, query, risk level, result snapshot |
| `sync_logs` | Import history for manual and scheduled syncs |

## Running the Project

### Backend
```bash
cd backend
npm install
npm run dev     # port 3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev     # port 5173, proxies /api to localhost:3001
```

## Search Architecture
Search uses PostgreSQL **full-text search** for exact whole-word filtering combined with **`word_similarity`** (pg_trgm) for scoring:

```sql
WHERE to_tsvector('simple', alias_name) @@ plainto_tsquery('simple', query_text)
ORDER BY word_similarity(query_text, alias_name) DESC
```

- `'simple'` dictionary: no stemming, no stop words, exact word tokens
- Filters on ALL aliases for an entry (primary name + every known alias)
- Risk levels: `similarity >= 0.9` → Confirmed Match, `>= 0.4` → Possible Match

## Admin User
- **Email:** syed.faisal@alnaqbipartners.com
- **Role:** Administrator

## Key Features
- JWT authentication (8h expiry), deactivatable accounts
- Whole-word name search across primary names and all aliases
- Risk levels: Clear / Possible Match / Confirmed Match
- Match details modal with all entry fields
- Search audit log (staff see own, admin sees all)
- PDF screening report export (per match or full results)
- User management (admin only): add, role change, password reset, deactivate
- Manual sync button in admin panel (UN / UAE / Both)
- Weekly auto-sync (Sundays 02:00, `node-cron`)

## Data Sources
- **UN List** (`unParser.js`): XML, parses `INDIVIDUAL` and `ENTITY` nodes. Combines `FIRST_NAME + SECOND_NAME + THIRD_NAME + FOURTH_NAME` into primary name. Extracts all `INDIVIDUAL_ALIAS` / `ENTITY_ALIAS` entries.
- **UAE List** (`uaeParser.js`): NDJSON (one JSON object per line). Imports `target: true` records only. Skips `Vessel` schema. Maps `Person` → individual, `Organization` → entity. Arabic name variants stored as aliases.

## Important Notes
- Logo: `frontend/src/assets/alnaqbi_logo.png` — displayed with `mix-blend-mode: screen` to remove black background on dark navbar/login page
- Footer on all pages: © 2026 Al Naqbi & Partners. All rights reserved. / Developed by Syed Faisal Naseem
- Do **not** commit `/backend/.env`
- The `schema.sql` seed inserts the default admin user — password is bcrypt-hashed, change after any fresh deployment
