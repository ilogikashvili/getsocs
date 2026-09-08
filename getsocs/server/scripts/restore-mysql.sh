#!/usr/bin/env bash
set -euo pipefail

: "${DB_HOST:=127.0.0.1}"
: "${DB_PORT:=3306}"
: "${DB_NAME:=getsocs_db}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASS:?DB_PASS is required}"

file="${1:-}"
[[ -n "$file" && -f "$file" ]] || { echo 'Usage: restore-mysql.sh /path/to/backup.sql.gz' >&2; exit 2; }
command -v mysql >/dev/null || { echo 'mysql client is required' >&2; exit 1; }
command -v gzip >/dev/null || { echo 'gzip is required' >&2; exit 1; }
gzip -t "$file"
if [[ -f "${file}.sha256" ]]; then sha256sum -c "${file}.sha256"; fi

if [[ "${CONFIRM_RESTORE:-}" != "${DB_NAME}" ]]; then
  echo "Refusing destructive restore. Set CONFIRM_RESTORE=${DB_NAME} after taking a fresh backup." >&2
  exit 3
fi

export MYSQL_PWD="$DB_PASS"
gzip -dc "$file" | mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$DB_NAME"
echo "Restore completed. Run: npm run db:verify"
