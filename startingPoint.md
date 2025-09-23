# BSDL 2026 — Starting Point

A quick runbook for the Bloor Street Dart League site and APIs.

## Overview
- Frontend lives in `Site1/2026/` and is static HTML/CSS/JS.
- Backend uses PHP + MySQL for two things:
  - Public JSON endpoints for the site (players and team standings).
  - A protected CSV importer to load weekly player stats from Google Apps Script.

## What’s in this folder
- `index.html` — Main site (loads team standings and player stats).
- `styles.css` — Main stylesheet.
- `matchDetails.js` — Frontend logic (tables, charts, requests).
- `server.php` — Players API. Tries the new schema `players_stats` first, falls back to legacy `players`.
- `api/standings.php` — Team standings API (consumed by the homepage).
- `import_players_api.php` — Protected CSV importer for weekly player stats.
- `db.php` — Local DB credentials (DO NOT commit). Consider adding `db.sample.php` with placeholders for GitHub.

Optional/utility
- `db_probe.php` — Local DB connectivity probe (don’t commit; for debugging only).
- `apps_script/` — Optional source for Apps Script importers (kept for documentation/versioning).

## Prerequisites
- PHP 8.0+
- MySQL 5.7+ or MariaDB 10.3+
- Web server (Apache/Nginx) or PHP’s built-in server for local testing

## Configuration
- Database credentials are read from `db.php` in this directory:
  ```php
  <?php
  $DB_HOST = 'localhost';
  $DB_NAME = 'your_db_name';
  $DB_USER = 'your_db_user';
  $DB_PASS = 'your_db_password';
  ```
- For open-source safety, create a `db.sample.php` (same shape, with placeholders) and commit that instead of `db.php`.
- Suggested `.gitignore` entries:
  ```gitignore
  db.php
  .env
  db_probe.php
  *-BU-*.php
  *-BU*.php
  *-bu*.css
  *-BU*.html
  *fucked*.*
  Thumbs.db
  .DS_Store
  ```

## Running locally
- Option A (Apache/Nginx): Place `Site1/2026/` under your docroot so URLs look like `http://localhost/2026/`.
- Option B (PHP built-in server): From the `Site1/2026/` directory, run
  ```sh
  php -S localhost:8080
  ```
  Then open `http://localhost:8080/index.html`.

Smoke tests (adjust host/port):
- Players API: `http://localhost:8080/server.php`
- Standings API: `http://localhost:8080/api/standings.php`

## API endpoints
- `GET /server.php`
  - Query params (optional): `team`, `player` (partial match via SQL LIKE)
  - JSON array of player rows. Prefers `players_stats`; falls back to `players`.

- `GET /api/standings.php`
  - Returns team standings JSON consumed by the homepage.

- `POST /import_players_api.php?token=<TOKEN>&mode=<replace|append>`
  - Body: raw CSV text with exact header columns:
    `Pos,Team,Player,WP,GP,GW,DBL IN,GF,Win %,Finish %,Skunk Win,B. Open,B. Fin.,High Start,High Finish,High Score,4 Fin.,5 Fin.,Busts,Fewest Darts,LFT FIN`
  - On first run, creates the legacy `players` table if missing.
  - `mode=replace` clears table before insert; `mode=append` adds rows.

Example import via curl (local CSV file stats.csv):
```sh
curl -X POST \
  "http://localhost:8080/import_players_api.php?token=YOUR_TOKEN&mode=replace" \
  --data-binary @stats.csv \
  -H "Content-Type: text/plain; charset=utf-8"
```

## Frontend data sources
- In `index.html`, the default endpoints are:
  - Team standings: `/api/standings.php`
  - Player stats: `/server.php`
- You can override at runtime via localStorage (useful for testing):
  - `localStorage.setItem('bulletin_json_url', 'https://example.com/api/standings.php')`
  - `localStorage.setItem('players_url', 'https://example.com/server.php')`

## CORS
- `server.php` and `import_players_api.php` set permissive CORS headers for simple GET/POST usage.
- If hosting frontend and backend on different domains, ensure HTTPS and appropriate `Access-Control-Allow-*` headers. Add `OPTIONS` handling if you use custom headers.

## Security notes
- Do not commit `db.php` or `db_probe.php`.
- Use HTTPS for all endpoints, especially the importer.
- Prefer `Authorization: Bearer <token>` header for importer auth if you later change the interface.
- Consider moving secrets to environment variables or a private include file not tracked by Git.

## Deployment checklist
- [ ] Upload `index.html`, `styles.css`, `matchDetails.js`, and any referenced assets (images, icons).
- [ ] Upload `server.php` and `api/standings.php`.
- [ ] Upload `import_players_api.php` (back-office).
- [ ] Place a real `db.php` on the server with correct credentials (not in Git).
- [ ] Verify DB connectivity (optionally with `db_probe.php`, but remove after testing).
- [ ] Hit `/server.php` and `/api/standings.php` to verify JSON.
- [ ] Visit `index.html` and confirm tables/charts render.

## Troubleshooting
- DB errors on `/server.php` will return a JSON error object in debug.
- Use `db_probe.php` locally to verify host/user/password and list tables.
- If `server.php` shows empty results, verify that either `players_stats` or `players` has data.

---

If you want, I can also create `db.sample.php`, `.gitignore`, and a tailored `README.md` in this folder.
