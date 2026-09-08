# MySQL backup and restore

Production should create at least one logical MySQL backup daily and copy it to storage outside the VPS. A backup left only on the same server is not disaster recovery.

## Backup

From `server/` with the normal DB environment loaded:

```bash
BACKUP_DIR=/var/backups/getsocs/mysql BACKUP_RETENTION_DAYS=14 npm run db:backup
```

The script uses a transaction-consistent `mysqldump`, gzip integrity validation, SHA-256 checksums, restrictive permissions, and local retention. Copy completed `.sql.gz` and `.sha256` files to encrypted off-server storage.

## Restore drill

Always restore into staging/a temporary database first. To restore intentionally:

```bash
CONFIRM_RESTORE=getsocs_db npm run db:restore -- /path/to/getsocs_db_YYYYMMDDTHHMMSSZ.sql.gz
npm run db:verify
```

A production restore should be followed by application smoke tests and a comparison of critical row counts. Schedule a restore drill periodically; a backup is not verified until it has been restored successfully.
