// Test-only loader: stub `server-only` (Next.js guard) for plain-node tests.
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
