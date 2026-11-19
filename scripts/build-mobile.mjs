#!/usr/bin/env node
/* global console, process */
/**
 * Mobile (Capacitor/Android) build: produces a static `out/` bundle.
 *
 * Isolation strategy: this script only *drives* the existing build through the
 * BUILD_TARGET=mobile gate in next.config.ts. It never copies, moves or edits
 * source files, so the web/Vercel build path is untouched.
 *
 * NEXT_PUBLIC_API_BASE_URL is mandatory — there is no same-origin API inside a
 * packaged app, so no localhost fallback is ever assumed.
 *
 * Usage:  NEXT_PUBLIC_API_BASE_URL=https://api.example npm run build:mobile
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();

function fail(message) {
  console.error(`\n\u2716 ${message}\n`);
  process.exit(1);
}

if (!apiBase) {
  fail(
    "NEXT_PUBLIC_API_BASE_URL is required for mobile builds.\n" +
      "  Example: NEXT_PUBLIC_API_BASE_URL=https://your-api-host npm run build:mobile",
  );
}
if (!/^https?:\/\/[^/]+/i.test(apiBase)) {
  fail(`NEXT_PUBLIC_API_BASE_URL must be an absolute http(s) URL; got "${apiBase}".`);
}
if (apiBase.startsWith("http://")) {
  console.warn(
    "\u26a0  http:// API base: Android blocks cleartext traffic by default. Use https:// for release builds.",
  );
}

const outDir = join(root, "out");
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });

const env = {
  ...process.env,
  BUILD_TARGET: "mobile",
  NEXT_PUBLIC_BUILD_TARGET: "android",
  NEXT_PUBLIC_API_BASE_URL: apiBase,
};

const nextBin = require.resolve("next/dist/bin/next");
const result = spawnSync(process.execPath, [nextBin, "build"], { cwd: root, env, stdio: "inherit" });
if (result.status !== 0) fail(`next build failed (exit code ${result.status}).`);

// ---------------------------------------------------------------- verification
if (!existsSync(outDir)) fail("next build finished but out/ does not exist.");
if (existsSync(join(outDir, "api"))) fail("out/api exists: route handlers leaked into the export.");

function walk(dir, visit) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, visit);
    else visit(path);
  }
}

let htmlFiles = 0;
const serverCodeHits = [];
walk(outDir, (path) => {
  if (path.endsWith(".html")) htmlFiles += 1;
  if (path.endsWith(".js")) {
    const text = readFileSync(path, "utf8");
    if (text.includes("mysql2")) serverCodeHits.push(path.replace(outDir, ""));
  }
});

const coursesDir = join(outDir, "courses");
const courseRoutes = existsSync(coursesDir)
  ? readdirSync(coursesDir, { withFileTypes: true }).filter(
      (entry) => entry.isDirectory() && existsSync(join(coursesDir, entry.name, "index.html")),
    ).length
  : 0;

console.log("\n\u2714 mobile export verified");
console.log(`  api base            : ${apiBase}`);
console.log(`  output              : ${outDir}`);
console.log(`  html files          : ${htmlFiles}`);
console.log(`  course detail routes: ${courseRoutes}`);
console.log(`  out/api             : absent`);
console.log(`  mysql2 references   : ${serverCodeHits.length}`);

if (serverCodeHits.length) fail(`server-only code found in the bundle: ${serverCodeHits.slice(0, 5).join(", ")}`);
if (courseRoutes !== 24) console.warn(`\u26a0  expected 24 course detail routes, found ${courseRoutes}.`);
