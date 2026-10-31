-- ============================================================
-- 003_user_default_role.sql
-- App users are "users" first, students second.
--
-- Change the DEFAULT of users.role from 'student' to 'user'.
-- ALTER ONLY: existing rows are NOT touched. An account keeps its
-- current role until it is linked to a stud2022 record.
--
-- Role semantics (enforced in code, not derived from legacy data):
-- - Signup creates role 'user' with stud2022_id NULL.
-- - Role becomes 'student' only inside the "Check result"
--   (POST /api/me/link-student) and "Register for a course"
--   (POST /api/me/registrations) features, when the account gets
--   linked to or creates a stud2022 record.
-- - Never derive admin status from stud2022.adminlevel.
-- ============================================================

ALTER TABLE `users`
  MODIFY COLUMN `role` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user';
