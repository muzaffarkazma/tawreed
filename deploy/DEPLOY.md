# Deploying Tawreed

Tawreed is a Node.js 22 app with a PostgreSQL 16 database. It needs a server that can keep a Node process running.
Pick one of the three options below. Option A is the simplest.

> **Data residency (PDPL):** buyer and supplier data is personal and commercial data. Host the server and the database in a Saudi region
> (for example Google Cloud Dammam, Oracle Cloud Jeddah or Riyadh, or a Saudi provider such as STC Cloud), and confirm with your legal adviser.

Minimum server: 2 vCPU, 4 GB RAM, 40 GB SSD, Ubuntu 24.04. (The build needs about 2 GB of memory.)

---

## Option A: Cloud VPS with Docker (recommended)

1. Point your domain's DNS (A record) to the server's IP, e.g. `tawreed.example.com`.
2. On the server:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo apt install -y nginx certbot python3-certbot-nginx unzip
   mkdir -p ~/tawreed && cd ~/tawreed && unzip ~/Tawreed_Release2_3.zip
   cp .env.example .env && nano .env
   ```
   In `.env` set at least:
   ```
   APP_URL=https://tawreed.example.com
   SESSION_SECRET=<run: openssl rand -hex 32>
   POSTGRES_PASSWORD=<strong password>
   POSTGRES_ADMIN_PASSWORD=<another strong password>
   SEED_DEMO=false
   SEED_ADMIN_EMAIL=you@yourcompany.sa
   SEED_ADMIN_PASSWORD=<strong password>
   PAYMENT_MODE=sandbox              # live once Moyasar approves your account
   MOYASAR_PUBLISHABLE_KEY=...  MOYASAR_SECRET_KEY=...
   OPENAI_API_KEY=...  or  ANTHROPIC_API_KEY=...
   ```
3. Start everything (database, migrations, app):
   ```bash
   docker compose up -d --build
   docker compose logs -f app          # wait for "Ready"
   ```
4. HTTPS with Nginx:
   ```bash
   sudo cp deploy/nginx-tawreed.conf /etc/nginx/sites-available/tawreed
   sudo sed -i 's/tawreed.example.com/YOUR-DOMAIN/' /etc/nginx/sites-available/tawreed
   sudo ln -s /etc/nginx/sites-available/tawreed /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d YOUR-DOMAIN
   ```
5. Open `https://YOUR-DOMAIN/login` and sign in with `SEED_ADMIN_EMAIL`. Set up AI under **Platform admin → AI settings**.

**Update to a new release:** unzip it over the folder (keeps `.env`), then `docker compose up -d --build`.
**Backup:** `docker compose exec db pg_dump -U postgres tawreed | gzip > backup.sql.gz` (as superuser, so every company's rows are included).

---

## Option B: Cloud VPS without Docker (Node + PM2)

```bash
# Node 22, PostgreSQL 16, Nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs postgresql nginx certbot python3-certbot-nginx unzip
sudo npm i -g pm2

# database and a NON-superuser app role (superusers skip row-level security)
sudo -u postgres psql -c "CREATE ROLE tawreed LOGIN PASSWORD 'STRONG-PASSWORD' NOSUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE tawreed OWNER tawreed;"

# app
mkdir -p ~/tawreed && cd ~/tawreed && unzip ~/Tawreed_Release2_3.zip
cp .env.example .env && nano .env      # DATABASE_URL=postgres://tawreed:STRONG-PASSWORD@localhost:5432/tawreed + the values listed in Option A
npm ci && npm run build
npm run db:migrate && npm run db:seed
pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup   # run the command pm2 prints
```
Then do step 4 of Option A (Nginx + certbot).

- **Update:** `bash deploy/update.sh ~/Tawreed_ReleaseX.zip` (backs up the database, unpacks, builds, migrates, restarts).
- **Daily backup:** `crontab -e` → `30 2 * * * cd ~/tawreed && bash deploy/backup.sh >> logs/backup.log 2>&1`
- **Restore:** `gunzip -c backups/db-XXXX.sql.gz | PGOPTIONS="-c app.bypass=on" psql "$DATABASE_URL"` into an empty database.
- **Logs:** `pm2 logs tawreed`

---

## Option C: Shared hosting (cPanel)

Only works if your plan has **all** of these. Most shared plans are missing at least one, so check with the host first:

| Needed | Where to check in cPanel |
| --- | --- |
| "Setup Node.js App" with **Node 20 or 22** | Software → Setup Node.js App |
| **PostgreSQL** (not only MySQL) | Databases → PostgreSQL Databases |
| SSH / Terminal access | Advanced → Terminal |
| ~2 GB memory to build, or build on your Mac and upload | — |

If yes:
1. Build on your Mac (the build needs more memory than shared plans allow):
   `npm ci && npm run build`, then zip the project **including `.next`** but without `node_modules`:
   `zip -r tawreed-upload.zip . -x "node_modules/*" ".env" "qa/*"`
2. cPanel → File Manager: upload and extract it into `~/tawreed`.
3. cPanel → PostgreSQL Databases: create a database and a user, add the user to the database (cPanel users are not superusers, which row-level security needs).
4. cPanel → Setup Node.js App → Create: Node 22, application root `tawreed`, application URL your domain, startup file `.next/standalone/server.js`.
   Add the `.env` values (`DATABASE_URL`, `APP_URL`, `SESSION_SECRET`, `SEED_DEMO=false`, AI and Moyasar keys) as environment variables, then click **Run NPM install**.
5. cPanel → Terminal: copy the "enter the virtual environment" command shown at the top of the Node.js App page, run it, then:
   `cd ~/tawreed && npm run db:migrate && npm run db:seed`. Back in Setup Node.js App, click **Restart**.
6. cPanel → SSL/TLS Status → run AutoSSL for the domain.

For each new release, repeat steps 1, 2 and 5 (your environment variables stay in cPanel).

If the host has no Node.js app support or no PostgreSQL, use a small VPS instead (Option A).

---

## After going live: checklist
- `SEED_DEMO=false` before the first seed (no demo companies on production).
- Strong `SESSION_SECRET` and database passwords; never commit `.env`.
- Ports 5432 and 3000 are **not** open to the internet (Docker binds them to 127.0.0.1; on a VPS run `sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable`).
- `APP_URL` starts with `https://` (session cookies then become Secure).
- Moyasar: switch `PAYMENT_MODE=live` with live keys only after a successful sandbox payment on the live domain; set the callback URL in the Moyasar dashboard to your domain.
- Daily backups running, and one restore tested.
