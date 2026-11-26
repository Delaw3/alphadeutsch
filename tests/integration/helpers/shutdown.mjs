// Signal-driven cleanup for the integration test files.
//
// `node --test` does not run `after()` hooks when a file process is interrupted,
// so a Ctrl-C in the middle of a write would otherwise leave test rows behind.
// Each file registers its own cleanup through this helper; the runner forwards
// SIGINT/SIGTERM to the child and waits for it instead of dying immediately.

const SIGNAL_EXIT_CODES = Object.freeze({ SIGINT: 130, SIGTERM: 143 });

const SIGNALS = Object.freeze(Object.keys(SIGNAL_EXIT_CODES));

/**
 * Runs `cleanup` once when SIGINT/SIGTERM arrives, then exits with the usual
 * shell code. Returns a remover to call from `after()` so a normal run never
 * leaves listeners behind.
 */
export function installSignalCleanup(cleanup, { graceMs = 20_000 } = {}) {
  let running = false;

  const handler = (signal) => {
    if (running) return;
    running = true;
    const exitCode = SIGNAL_EXIT_CODES[signal] ?? 1;

    // Never hang on a wedged pool: cleanup gets a bounded window.
    const timer = setTimeout(() => process.exit(exitCode), graceMs);
    if (typeof timer.unref === "function") timer.unref();

    Promise.resolve()
      .then(() => cleanup())
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timer);
        process.exit(exitCode);
      });
  };

  for (const signal of SIGNALS) process.on(signal, handler);

  return function removeSignalCleanup() {
    for (const signal of SIGNALS) process.removeListener(signal, handler);
  };
}
