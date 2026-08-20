# Installing ShelfSense

Three ways to run it, roughly in order of effort: prebuilt Docker Compose (fastest), Docker Compose built from source, and manual/bare-metal.

## a. Docker Compose, prebuilt images (recommended)

**Prerequisites:** Docker and Docker Compose.

Grab the compose file:

```bash
curl -O https://raw.githubusercontent.com/adilson0888/shelf-sense/main/docker-compose.registry.yml
```

By default it uses frictionless local credentials (`shelfsense` / `shelf` / `shelf`). To override them, create a `.env` file next to it — Compose reads it automatically:

```bash
# .env
POSTGRES_DB=shelfsense
POSTGRES_USER=shelf
POSTGRES_PASSWORD=change-me
```

Then start it:

```bash
docker compose -f docker-compose.registry.yml up -d
```

This starts three services: `db` (Postgres 16), `api` (port 3001), and `web` (port 8080, proxies `/api/` to `api`). Database migrations run automatically the moment `api` boots — there's nothing else to run.

Open **http://localhost:8080**. That's the whole install.

**Updating** to a newer image:

```bash
docker compose -f docker-compose.registry.yml pull
docker compose -f docker-compose.registry.yml up -d
```

**Backing up your data**: everything lives in the named `db-data` volume. Confirm its full (Compose-project-prefixed) name first:

```bash
docker volume ls | grep db-data
docker run --rm -v <full-volume-name>:/data -v "$(pwd)":/backup alpine \
  tar czf /backup/db-data-backup.tar.gz -C / data
```

Or, with the stack running, a plain `pg_dump` against the `db` container works just as well:

```bash
docker compose -f docker-compose.registry.yml exec db pg_dump -U shelf shelfsense > backup.sql
```

## b. Docker Compose, building from source

For anyone who's forked or modified the app. Clone the repo, then from its root:

```bash
docker compose up --build
```

Same shape as above — `api` on `http://localhost:3001/health`, `web` on `http://localhost:8080` — just built from your working tree instead of pulled from GHCR. See `docker-compose.yml`'s own header comment for details.

## c. Manual / bare-metal install

**Prerequisites:** Node 24+ (`.nvmrc` pins this — `nvm use` if you have nvm) and PostgreSQL 16 with a database and user created.

```bash
git clone https://github.com/adilson0888/shelf-sense.git
cd shelf-sense
npm install                       # installs every workspace from the root
npm run build:ds
npm run build:i18n
npm run build -w shelf-sense-web  # order matters — web depends on ds + i18n
npm run build -w shelf-sense-api
```

Configure the API:

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` — either the four discrete variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) or a single `DATABASE_URL` (which takes precedence if set). Optionally add `AI_API_BASE_URL` / `AI_API_KEY` / `AI_MODEL` / `TAVILY_API_KEY` to pre-configure barcode-lookup AI extraction and price comparison — both are optional, and each has its own per-user override in Settings if you'd rather not put credentials in `.env`.

Run the API:

```bash
node apps/api/dist/index.js
```

**Migrations run automatically on startup** — there's no separate migrate command to run, on any install path. If the API can't apply a migration cleanly it exits non-zero rather than serve traffic against a half-migrated schema, so check its logs if it doesn't come up.

For anything beyond a quick test, keep it running with `systemd`:

```ini
# /etc/systemd/system/shelf-api.service
[Unit]
Description=ShelfSense API
After=network.target postgresql.service

[Service]
ExecStart=/usr/bin/node /opt/shelf-sense/apps/api/dist/index.js
EnvironmentFile=/opt/shelf-sense/apps/api/.env
Restart=always
User=shelfsense

[Install]
WantedBy=multi-user.target
```

Serve the web build. `apps/web/dist` is a static SPA — the simplest option for casual use is `npm run preview -w shelf-sense-web`; for anything longer-lived, point nginx (or any static file server) at `apps/web/dist` and reverse-proxy `/api/` to wherever the API is listening. `apps/web/nginx.conf` (the same config the Docker image uses) is a complete worked example:

```nginx
location /api/ {
    proxy_pass http://localhost:3001/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

One thing to know before building: `VITE_API_URL` is baked into the web bundle at build time (default `/api`, meaning "same origin, reverse-proxied"). If you're serving `web` from a different origin than your reverse proxy, set `VITE_API_URL` to the API's full URL before running `npm run build -w shelf-sense-web`.

## d. HTTPS via a reverse proxy

ShelfSense is a PWA — installing it to a home screen and camera-based barcode scanning both commonly require a secure context, so it's worth putting behind HTTPS even on a home LAN.

Simplest option, [Caddy](https://caddyserver.com) — this is genuinely its whole config, automatic certificate included:

```
shelfsense.example.com {
    reverse_proxy localhost:8080
}
```

If you already run nginx for other services, a plain reverse-proxy block works too (point `ssl_certificate`/`ssl_certificate_key` at your own cert, e.g. from certbot):

```nginx
server {
    listen 443 ssl;
    server_name shelfsense.example.com;
    ssl_certificate     /etc/letsencrypt/live/shelfsense.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shelfsense.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Traefik works well too, especially if your other services already route through it via Docker labels — not covered here in detail, but it's a solid choice if that's your existing setup.

## e. Troubleshooting

**Camera scanning doesn't do anything.** It needs a secure context (HTTPS, or `localhost`) and a Chromium-based browser (Chrome/Edge on desktop and Android) — the underlying `BarcodeDetector` API isn't universally supported, notably not on iOS Safari as of writing. See §d if you're running over plain HTTP on a LAN.

**AI/Tavily-powered features aren't doing anything.** They're entirely optional. Without credentials configured (in Settings, or via env vars), barcode lookups still work through Open Food Facts alone, and price comparison simply doesn't run — that's expected, not a bug.

**Migrations failed on startup.** Check `docker logs <api-container>` (or the API's stdout on bare metal). The API deliberately exits rather than serve traffic against a half-migrated schema.

**I want to reset everything.** Stop the stack, drop the `db-data` volume (`docker volume rm <name>`) or the Postgres database on bare metal, then start again — migrations rebuild the schema from scratch.
