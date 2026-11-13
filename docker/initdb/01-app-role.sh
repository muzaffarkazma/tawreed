#!/bin/sh
# Runs once, when the database volume is first created.
# The app connects as a normal (non-superuser) role so PostgreSQL row-level security
# actually isolates companies. Superusers skip RLS, so the app must never use one.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<SQL
CREATE ROLE tawreed LOGIN PASSWORD '${APP_DB_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE DATABASE tawreed OWNER tawreed;
SQL
