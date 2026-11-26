-- ============================================================
-- 004_verification_challenges.sql
-- Migration: persistent storage for email OTP challenges.
--
-- Proposed only; this file must be reviewed before execution.
--
-- Application-enforced policy:
-- - 6-digit OTP, stored only as an HMAC-SHA256 hexadecimal digest.
-- - 10-minute expiry.
-- - 60-second resend cooldown.
-- - maximum 5 incorrect attempts.
--
-- The table is intentionally independent of the legacy `magic_links`
-- table, which was removed by 002_drop_magic_links.sql. The future
-- `claim` and `reset` purposes can reuse this table without DDL changes.
-- ============================================================

CREATE TABLE IF NOT EXISTS `verification_challenges` (
  `id`            BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`       INT          NOT NULL,
  `purpose`       VARCHAR(20)  COLLATE utf8mb4_unicode_ci NOT NULL,
  `code_hash`     CHAR(64)     COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at`    DATETIME     NOT NULL,
  `used_at`       DATETIME     NULL,
  `attempts`      INT          NOT NULL DEFAULT 0,
  `created_at`    DATETIME     NOT NULL,
  `last_sent_at`  DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vc_user_purpose_created` (`user_id`, `purpose`, `created_at`),
  KEY `idx_vc_expires` (`expires_at`),
  CONSTRAINT `fk_vc_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
