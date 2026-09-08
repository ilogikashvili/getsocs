#!/usr/bin/env bash
set -euo pipefail

# Consistent logical MySQL backup for Getsocs. Credentials are read from the
# environment; MYSQL_PWD avoids exposing the password in the process argument list.
: "${DB_HOST:=127.0.0.1}"
: "${DB_PORT:=3306}"
: "${DB_NAME:=getsocs_db}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASS:?DB_PASS is required}"
: "${BACKUP_DIR:=./backups/mysql}"
: "${BACKUP_RETENTION_DAYS:=14}"

command -v mysqldump >/dev/null || { echo 'mysqldump is required' >&2; exit 1; }
command -v gzip >/dev/null || { echo 'gzip is required' >&2; exit 1; }
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
base="$BACKUP_DIR/${DB_NAME}_${timestamp}.sql.gz"
tmp="${base}.tmp"
trap 'rm -f "$tmp"' EXIT

export MYSQL_PWD="$DB_PASS"
mysqldump \
  --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
  --single-transaction --quick --routines --triggers --events \
  --set-gtid-purged=OFF --default-character-set=utf8mb4 \
  "$DB_NAME" | gzip -9 > "$tmp"

# Refuse to publish an empty/truncated backup.
gzip -t "$tmp"
[[ -s "$tmp" ]] || { echo 'Backup is empty' >&2; exit 1; }
mv "$tmp" "$base"
chmod 600 "$base"
sha256sum "$base" > "${base}.sha256"
chmod 600 "${base}.sha256"

find "$BACKUP_DIR" -type f \( -name '*.sql.gz' -o -name '*.sql.gz.sha256' \) -mtime "+$BACKUP_RETENTION_DAYS" -delete
printf '%s\n' "$base"
