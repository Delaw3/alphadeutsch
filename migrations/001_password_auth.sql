-- ============================================================
-- 001_password_auth.sql
-- Migration: Add password authentication, email verification,
-- account lockout, and legacy student identity link to users table.
-- ============================================================

ALTER TABLE `users`
  ADD COLUMN `password_hash` VARCHAR(255) NULL COMMENT 'bcrypt hash; NULL when unset, verifyPassword rejects empty hashes',
  ADD COLUMN `email_verified_at` DATETIME NULL,
  ADD COLUMN `failed_logins` INT NOT NULL DEFAULT 0,
  ADD COLUMN `locked_until` DATETIME NULL,
  ADD COLUMN `stud2022_id` INT NULL,
  ADD UNIQUE KEY `uq_users_stud2022` (`stud2022_id`);