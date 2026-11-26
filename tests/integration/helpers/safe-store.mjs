// Challenge store for the integration tests.
//
// `issueChallenge()` in src/lib/auth/verification.ts always calls
// `store.deleteExpired(now, CHALLENGE_CLEANUP_BATCH_SIZE)` after a successful
// issue. The MySQL implementation of that sweep is a global
// `DELETE FROM verification_challenges WHERE expires_at <= ... LIMIT 100` with
// no user predicate, which would remove expired rows that belong to real
// accounts in the developer's local database.
//
// Two independent barriers keep it away from foreign rows:
//   1. this subclass, which answers every sweep with 0 and counts the attempts;
//   2. the pool-level statement guard (helpers/statement-guard.mjs), which
//      rejects any unscoped DELETE on verification_challenges before it is sent.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../preload.cjs");

const { MySqlChallengeStore } = require("../../build/auth/mysql-challenges.js");

export class SweepBlockedChallengeStore extends MySqlChallengeStore {
  /** Production sweeps refused across this process. */
  static blockedSweeps = 0;

  /** Production sweeps refused by this store instance. */
  blockedSweeps = 0;

  async deleteExpired() {
    SweepBlockedChallengeStore.blockedSweeps += 1;
    this.blockedSweeps += 1;
    return 0;
  }
}

export function createSweepBlockedChallengeStore(pool) {
  return new SweepBlockedChallengeStore(pool);
}
