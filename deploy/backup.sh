#!/usr/bin/env bash
# Full database backup (all companies). Row-level security hides other companies' rows even from the
# table owner, so the dump runs in the app's "system" mode (app.bypass=on) to include every row.
# Daily at 02:30 (crontab -e):  30 2 * * * cd /path/to/tawreed && bash deploy/backup.sh >> logs/backup.log 2>&1
set -euo pipefail
mkdir -p backups
DB=$(node --env-file=.env -e 'process.stdout.write(process.env.DATABASE_URL)')
OUT="backups/db-$(date +%Y%m%d-%H%M).sql.gz"
PGOPTIONS="-c app.bypass=on" pg_dump --enable-row-security --no-owner "$DB" | gzip > "$OUT"
find backups -name 'db-*.sql.gz' -mtime +14 -delete   # keep 14 days
echo "Backup written: $OUT ($(du -h "$OUT" | cut -f1))"
