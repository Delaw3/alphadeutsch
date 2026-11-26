# Cleaning up after an interrupted integration-test run

The MySQL integration suite (`npm run test:auth:integration -- --allow-local-db`)
deletes its own rows in `after()` hooks and in a SIGINT/SIGTERM hook. A run that
is **hard-killed** — SIGKILL, OOM, a closed terminal, an IDE "stop", a power
loss — cannot run those hooks, so `otp-it+…@example.invalid` users may survive.

This document is the only supported manual recovery procedure. It is written for
a **local** MySQL instance that you control.

## 0. Preconditions — do not skip any of them

1. The server is local: `SELECT @@server_uuid;` must equal the
   `INTEGRATION_EXPECTED_SERVER_UUID` value in your `.env.local`.
2. You are the person who started the interrupted run, and you know its prefix.
3. The suite is not running (no `run-auth-integration` process, no terminal in
   the middle of a test file).
4. You delete **one verified row at a time**. There is no bulk statement in this
   procedure, on purpose.

If any precondition fails, stop.

## 1. Identify leftovers (read-only)

```sql
SELECT u.id, u.email, u.created_at
FROM users u
WHERE u.email LIKE 'otp-it+%@example.invalid'
ORDER BY u.id;
```

Every test mailbox has the shape

```
otp-it+<pid36>-<time36>-<hex8>-<sequence>-<label>@example.invalid
```

`<pid36>-<time36>-<hex8>-` is the run id (generated once per test-file process);
the run prefix is everything up to and including that trailing `-`. Rows with a
different prefix belong to a different run and are **not yours to delete**.

This query only reads. Do not delete from its output directly.

## 2. Verify ownership of one candidate row (read-only)

```sql
SELECT u.id, u.email, u.created_at,
       (SELECT COUNT(*) FROM verification_challenges c WHERE c.user_id = u.id) AS challenges,
       (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) AS sessions
FROM users u
WHERE u.id = <id> AND u.email = '<exact address from step 1>';
```

Delete the row only when **all** of these hold:

- the address matches `^otp-it\+[a-z0-9-]+@example\.invalid$`;
- the address starts with the run prefix you are cleaning;
- `created_at` falls inside the window of that run;
- the id/email pair returned exactly one row (a mismatch means the id now belongs
  to something else — abandon that row);
- the child counts are plausible for a test account (a handful at most).

## 3. Delete that one verified row

```sql
START TRANSACTION;

DELETE FROM verification_challenges WHERE user_id = <id>;
DELETE FROM sessions              WHERE user_id = <id>;
DELETE FROM users                 WHERE id = <id> AND email = '<exact address>';

-- The users delete must report exactly 1 affected row.
-- If it reports 0 (or anything else), run ROLLBACK instead of COMMIT.

COMMIT;
```

The child deletes are explicit so the affected counts are visible; both
`verification_challenges.user_id` and `sessions.user_id` are foreign keys with
`ON DELETE CASCADE`, so the `users` delete alone removes them as well.

## 4. Verify, then repeat for the next row

Re-run the step 1 query: it must return **no rows with that prefix**.

```sql
SELECT COUNT(*) FROM verification_challenges WHERE user_id = <id>;
SELECT COUNT(*) FROM sessions              WHERE user_id = <id>;
```

Both must be `0`. Then go back to step 2 for the next candidate.

## 5. Forbidden

- `DELETE FROM users WHERE email LIKE 'otp-it+%';` — not ownership-verified and
  it can delete a concurrently running suite's rows.
- Any `DELETE` without `WHERE id = … AND email = …` equality.
- `TRUNCATE`, `DROP`, `ALTER`, or any statement without `WHERE`.
- Deleting rows whose prefix you did not create, or whose `created_at` predates
  your run.
- Running any of this on a server whose `@@server_uuid` you have not matched, or
  while the suite is active.

## 6. Prevention

Prefer letting a run finish. When a run must be stopped, send SIGINT (Ctrl-C)
once and let the runner finish its cleanup window; it forwards the signal,
allows the hooks to run, and prints the path of this document if that fails.
