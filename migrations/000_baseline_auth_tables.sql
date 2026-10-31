-- ============================================================
-- 000_baseline_auth_tables.sql
-- Baseline: creates users and sessions exactly as they exist
-- in the current production/local database.
-- Idempotent (CREATE TABLE IF NOT EXISTS).
-- Run this on a fresh DB before 001_password_auth.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS `users` (
  `id`         int            NOT NULL AUTO_INCREMENT,
  `email`      varchar(320)   COLLATE utf8mb4_unicode_ci NOT NULL,
  `name`       varchar(120)   COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role`       varchar(20)    COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'student',
  `created_at` timestamp      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `id`           bigint         NOT NULL AUTO_INCREMENT,
  `user_id`      int            NOT NULL,
  `token_hash`   char(64)       COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at`   datetime       NOT NULL,
  `created_at`   timestamp      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` timestamp      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `request_ip`   varchar(64)    COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent`   varchar(255)   COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `idx_sessions_user` (`user_id`),
  KEY `idx_sessions_expiry` (`expires_at`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
