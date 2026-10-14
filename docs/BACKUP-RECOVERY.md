# Backup and recovery

Full backups contain an atomic SQLite snapshot (`database.db`) plus the complete `uploads/` tree, including nested office/case folders. SQLite WAL is included through the SQLite backup API, not by copying the live database file. ZIP creation fails on missing attachment files and unsupported links; it never reports a partial archive as successful.

## Supported recovery

The single-office administrator API accepts existing ZIP/DB snapshots or a multipart `backup_file` upload. Uploaded files use the original filename extension; the temporary multer filename has no extension. A ZIP replaces the attachment tree exactly, removing files absent from the snapshot. A legacy `.db` restores only the database and preserves attachments. Snapshots must contain every table in the application schema and the core tenant, user, client, case and document columns; pre-SaaS databases need a separate migration before recovery.

Before mutation, recovery validates ZIP paths/types/limits, SQLite integrity, foreign keys and required schema. ZIP entries outside `database.db` and `uploads/` are rejected, including traversal, links, Windows reserved filenames and collisions. Maximum extracted content is 2 GiB / 100,000 entries. Recovery creates a full `pre_restore_safety_*.zip` containing both database and attachments. Safety snapshots are retained until an operator explicitly removes them; the rolling 30-copy limit applies only to ordinary `backup_*` files.

Attachments are staged beside their destination before replacement. SQLite is checkpointed, closed and reopened synchronously with WAL and foreign keys enabled. Existing statement wrappers reprepare against the new connection. Copy/open failures restore the old database and attachment tree. An external SQLite reader blocking the checkpoint rejects recovery without replacing the database. Successful recovery returns `safetyBackup`; synchronous rollback failures also retain this recovery point.

## Maintenance procedure

1. Arrange a maintenance window and prevent new office writes/uploads. Stop other processes that hold the same SQLite file. Keep the API process available only to the administrator performing recovery, or use an isolated maintenance process.
2. Create and download a full backup. Preserve an independent copy of the database, uploads, configuration and encryption key through your existing secure procedure. Archive ZIPs do not contain configuration or encryption secrets.
3. Restore the chosen compatible snapshot through the single-office administrator API. Record the returned `safetyBackup` name.
4. Verify login, a known case, a nested attachment and PDF export before allowing normal traffic.
5. If the selected snapshot is incorrect, restore the recorded safety ZIP during the same maintenance window.

The SQLite snapshot is atomic; database-plus-attachments is not a coordinated transaction during normal concurrent writes. Files can change during ZIP creation, so a maintenance window is necessary for a consistent full recovery point. A sudden machine/process failure during filesystem replacement is outside the tested synchronous error rollback; retain independent copies and the safety ZIP for offline recovery. Close all SQLite processes before offline restore; restore the database and attachment tree together and remove stale WAL/SHM files only while all connections are closed. Restart the service, then verify application health and sample records.

Multi-office backup/recovery remains a server operation. The API rejects environments with more than one office and rejects multi-office snapshots. Do not use these single-office endpoints to overwrite a multi-office server.

After deploying changed service code, restart the service once to load the new modules. A successful recovery inside this running version reopens its database connection and needs no additional restart. Persistent in-memory integrations (for example cached Web Push VAPID keys) should be refreshed by restarting before resuming ordinary traffic if the snapshot changes their configuration.

## Reproducible isolated verification

Run `npm --prefix server run test:backup-restore`. The test uses only generated temporary SQLite databases and synthetic attachments, and removes them after closing connections. It never imports the live database or reads live uploads. Coverage includes complete nested restoration, same-process and fresh-connection reads, statement refresh, safety restoration, legacy DB behavior, invalid/traversal/link archives, injected replacement failure rollback, multipart upload, authorization, an intact but structurally incomplete database rejection, and an external-reader checkpoint refusal.
