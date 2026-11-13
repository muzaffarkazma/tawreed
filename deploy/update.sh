#!/usr/bin/env bash
# Install a new release on a VPS (no Docker). Usage, from the project folder:
#   bash deploy/update.sh ~/Tawreed_ReleaseX.zip
set -euo pipefail
ZIP="${1:?give the path to the release zip}"
mkdir -p logs
echo "1/5 Database backup"
bash deploy/backup.sh
echo "2/5 Unpack release (your .env is kept)"
unzip -oq "$ZIP" -d .
echo "3/5 Install and build"
npm ci --no-audit --no-fund
npm run build
echo "4/5 Database changes"
npm run db:migrate
npm run db:seed
echo "5/5 Restart"
pm2 reload tawreed --update-env || pm2 start deploy/ecosystem.config.cjs
pm2 save
echo "Done. Check: pm2 logs tawreed --lines 50"
