# Backup and assistant backend release — 2026-10-14

The reviewed assistant reference validation and per-device Web Push failure isolation are deployed independently of the backup service. The release manifest includes the subscription access policy imported by pushService; preflight resolves relative module dependencies before publishing.

The backup release includes `database/db.js`, `services/backupService.js`, `routes/backupRoutes.js`, and the reviewed dependency manifest/lock. No frontend changes are part of these backend releases. The existing runtime is preserved for assistant/push changes; backup dependencies are installed in a separate runtime before replacement. Code and atomic SQLite rollback snapshots are retained for each release.

Production readiness checks include:

- 15 assistant regressions, 14 notification regressions, and 69 authorization checks.
- 10 backup/restore checks, including a failed recovery-copy creation after a stale rollback file was left by an earlier attempt. Current data cannot be replaced by that stale file.
- A private on-server copy of production SQLite and attachments. Database contents and attachment hashes match after an offline round trip. Existing foreign-key state is preserved, rather than silently repairing or deleting copied business records. Production is never the restore target. API restrictions for multiple offices and invalid snapshots remain enforced.
- Local/public health, anonymous 401 checks, an authenticated synthetic Gemini response with evidence, protected law PDF, protected case PDF after the dependency update, and 403 for the multi-office backup API.

Use `deploy/deploy_remaining_fixes.py <assistant|backups> preflight`, then `deploy` only after preflight completes successfully. Private-copy validation uses `deploy/stage_backup_validation.py`; production verification uses `deploy/verify_remaining_fixes.py`. Connection credentials stay in Windows Credential Manager, with pinned SSH host identity. Run metadata is stored under ignored `artifacts/remaining-release/`; it contains aggregate verification results, not office contents or credentials. Private validation copies are removed after checks.

Full office recovery still requires controlled maintenance. A safe archive must satisfy the schema and relational integrity checks. Existing historical records with missing parent links require a separate reviewed repair; this release does not delete or alter them.

## Separate historical cleanup

After the user approved repair or deletion, `deploy/repair_orphan_records.py` audited
the missing references and performed a fingerprinted one-off transaction. Optional
expense links to deleted cases were cleared while preserving all expense contents
and amounts. Unreferenced child records belonging to deleted parents were removed.
The plan was proven against an in-memory copy before applying it, with an atomic
SQLite backup, checks that unrelated tables remained unchanged, and post-startup
integrity/foreign-key verification. Uploaded files were not removed. Runtime audit
plans and receipts remain under Git-ignored `artifacts/orphan-repair/`.
