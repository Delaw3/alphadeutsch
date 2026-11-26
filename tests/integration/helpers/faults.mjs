// Fault injection over the real test pool.
//
// The wrapped pool and connection execute every non-failing statement against
// MySQL, so a simulated failure still exercises real InnoDB transactions and a
// real `ROLLBACK`. Error messages never contain SQL parameters or credentials.
//
// `when: "before"` (default) throws instead of executing the statement — use it
// for "the database never saw this write". `when: "after"` executes the
// statement and then throws, which is what a rollback test needs: the writes
// that already ran inside the transaction must genuinely be undone.

export class FaultInjector {
  #match = null;
  #remaining = 0;
  #message = "simulated database failure";
  #when = "before";

  failOn(match, { times = Infinity, message, when = "before" } = {}) {
    if (when !== "before" && when !== "after") {
      throw new Error('FaultInjector.failOn accepts when: "before" | "after".');
    }
    this.#match = match;
    this.#remaining = times;
    this.#when = when;
    if (typeof message === "string") this.#message = message;
    return this;
  }

  clear() {
    this.#match = null;
    this.#remaining = 0;
    this.#when = "before";
    return this;
  }

  matches(sql) {
    if (this.#match === null || this.#remaining <= 0) return false;
    const text = typeof sql === "string" ? sql : "";
    if (typeof this.#match === "string") return text.includes(this.#match);
    if (this.#match instanceof RegExp) {
      this.#match.lastIndex = 0;
      const matched = this.#match.test(text);
      this.#match.lastIndex = 0;
      return matched;
    }
    return false;
  }

  /**
   * Consumes one failure slot for a matching statement. `failsBefore` means the
   * statement must not be sent; `failsAfter` means it runs and then throws.
   */
  plan(sql) {
    const message = this.#message;
    if (!this.matches(sql)) return { failsBefore: false, failsAfter: false, message };
    if (this.#remaining !== Infinity) this.#remaining -= 1;
    return { failsBefore: this.#when === "before", failsAfter: this.#when === "after", message };
  }

  shouldFail(sql) {
    return this.plan(sql).failsBefore;
  }

  maybeThrow(sql) {
    const plan = this.plan(sql);
    if (plan.failsBefore) throw new Error(plan.message);
  }
}

function hasParams(params) {
  return params !== undefined && params !== null;
}

export class FaultConnection {
  constructor(base, injector) {
    this.base = base;
    this.injector = injector;
  }

  async beginTransaction() {
    return this.base.beginTransaction();
  }

  async commit() {
    return this.base.commit();
  }

  async rollback() {
    return this.base.rollback();
  }

  release() {
    return this.base.release();
  }

  async query(sql, params) {
    const plan = this.injector.plan(sql);
    if (plan.failsBefore) throw new Error(plan.message);
    const result = hasParams(params) ? await this.base.query(sql, params) : await this.base.query(sql);
    if (plan.failsAfter) throw new Error(plan.message);
    return result;
  }
}

export class FaultPool {
  constructor(base, injector = new FaultInjector()) {
    this.base = base;
    this.injector = injector;
    this.failGetConnection = false;
  }

  async query(sql, params) {
    const plan = this.injector.plan(sql);
    if (plan.failsBefore) throw new Error(plan.message);
    const result = hasParams(params) ? await this.base.query(sql, params) : await this.base.query(sql);
    if (plan.failsAfter) throw new Error(plan.message);
    return result;
  }

  async getConnection() {
    if (this.failGetConnection) throw new Error("simulated pool acquisition failure");
    const connection = await this.base.getConnection();
    return new FaultConnection(connection, this.injector);
  }

  async end() {
    if (typeof this.base.end === "function") return this.base.end();
    return undefined;
  }
}
