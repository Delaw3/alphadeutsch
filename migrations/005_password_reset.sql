-- 005_password_reset.sql
-- Single-use ticket handed out after a verified password-reset e-mail code.
-- Only the SHA-256 hash of the ticket is stored; the raw value lives in the
-- student's browser for the duration of the reset flow (15 minutes).
ALTER TABLE `users`
  ADD COLUMN `reset_token_hash` char(64) NULL DEFAULT NULL AFTER `locked_until`,
  ADD COLUMN `reset_token_expires_at` datetime NULL DEFAULT NULL AFTER `reset_token_hash`;
