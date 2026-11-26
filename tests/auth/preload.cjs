// Test-only loader: stub `server-only` (Next.js guard) for plain-node tests.
// This is a dummy fixture, not a production secret. Production must supply
// AUTH_CODE_PEPPER through the hosting environment.
process.env.AUTH_CODE_PEPPER ??= "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const { Module } = require("node:module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function patched(request, ...args) {
  if (request === "server-only") return require.resolve("./server-only-stub.cjs");
  if (request === "bcryptjs" || request.endsWith("/bcryptjs")) {
    try {
      return origResolve.call(this, request, ...args);
    } catch {
      return require.resolve("bcryptjs");
    }
  }
  return origResolve.call(this, request, ...args);
};
