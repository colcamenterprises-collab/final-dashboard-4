#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const PRODUCTION_PREFIXES = ["client/src/", "server/", "shared/"];
const DIAGNOSTIC_RE = /^(.+?)\((\d+),(\d+)\): error TS(\d+): (.+)$/gm;

function slash(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^\.\//, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDiagnosticMessage(message, repositoryRoot) {
  let normalized = slash(message).replace(/\s+/g, " ").trim();
  if (!repositoryRoot) return normalized;

  // TypeScript diagnostics can embed absolute paths (especially TS7016 messages
  // that point into node_modules). Base and head are intentionally compiled from
  // different worktrees, so those environment-specific roots must not become part
  // of the debt signature. Only the repository root itself is canonicalized; the
  // remainder of the path stays intact so genuinely different modules still differ.
  const normalizedRoot = slash(path.resolve(repositoryRoot)).replace(/\/$/, "");
  normalized = normalized.replace(new RegExp(escapeRegExp(normalizedRoot), "g"), "<repo>");
  return normalized;
}

function isProductionFile(file) {
  const normalized = slash(file);
  return PRODUCTION_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function parseDiagnostics(output, repositoryRoot) {
  const diagnostics = [];
  for (const match of String(output || "").matchAll(DIAGNOSTIC_RE)) {
    let file = slash(match[1]);
    if (repositoryRoot) {
      const normalizedRoot = slash(path.resolve(repositoryRoot)).replace(/\/$/, "");
      if (file.startsWith(`${normalizedRoot}/`)) file = file.slice(normalizedRoot.length + 1);
    }
    if (!isProductionFile(file)) continue;
    diagnostics.push({
      file,
      line: Number(match[2]),
      column: Number(match[3]),
      code: `TS${match[4]}`,
      message: normalizeDiagnosticMessage(match[5], repositoryRoot),
    });
  }
  return diagnostics;
}

function signature(diagnostic) {
  // Line and column are deliberately excluded so harmless line movement does not
  // look like new debt. Counts are compared, so duplicate errors are still caught.
  return `${diagnostic.file}\u0000${diagnostic.code}\u0000${diagnostic.message}`;
}

export function countDiagnostics(diagnostics) {
  const counts = new Map();
  for (const diagnostic of diagnostics) {
    const key = signature(diagnostic);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

export function findRegressions(baseDiagnostics, headDiagnostics) {
  const base = countDiagnostics(baseDiagnostics);
  const head = countDiagnostics(headDiagnostics);
  const regressions = [];

  for (const [key, headCount] of head) {
    const baseCount = base.get(key) || 0;
    if (headCount <= baseCount) continue;
    const [file, code, message] = key.split("\u0000");
    regressions.push({ file, code, message, baseCount, headCount, added: headCount - baseCount });
  }

  return regressions.sort((a, b) =>
    a.file.localeCompare(b.file) || a.code.localeCompare(b.code) || a.message.localeCompare(b.message),
  );
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env || process.env,
    stdio: options.stdio || ["ignore", "pipe", "pipe"],
  });
}

function runTsc(cwd) {
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--no-install", "tsc", "--pretty", "false", "--incremental", "false"],
    { cwd, encoding: "utf8", env: process.env },
  );

  const output = `${result.stdout || ""}${result.stderr || ""}`;
  const diagnostics = parseDiagnostics(output, cwd);

  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 2) {
    throw new Error(`TypeScript process failed unexpectedly with exit ${result.status}:\n${output}`);
  }
  if (result.status === 2 && diagnostics.length === 0) {
    throw new Error(`TypeScript failed but no production diagnostics could be parsed:\n${output}`);
  }

  return { status: result.status, output, diagnostics };
}

function changedTypeScriptInputs(baseSha) {
  const output = run("git", [
    "diff",
    "--diff-filter=ACMR",
    "--name-only",
    `${baseSha}...HEAD`,
  ]);
  return output
    .split(/\r?\n/)
    .map(slash)
    .filter(Boolean)
    .filter((file) =>
      isProductionFile(file) ||
      /(^|\/)tsconfig[^/]*\.json$/.test(file) ||
      file === "package.json" ||
      file === "package-lock.json" ||
      file === "schema.prisma" ||
      file === "scripts/stabilisation/typescript-ratchet.mjs" ||
      file === ".github/workflows/pr-governance.yml",
    );
}

function annotate(regression) {
  const message = `${regression.code}: ${regression.message} (baseline ${regression.baseCount}, head ${regression.headCount})`;
  const escaped = message.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
  console.error(`::error file=${regression.file}::${escaped}`);
}

function selfTest() {
  const fixture = [
    "server/a.ts(10,2): error TS2322: Type 'string' is not assignable to type 'number'.",
    "server/a.ts(20,4): error TS2322: Type 'string' is not assignable to type 'number'.",
    "client/src/b.tsx(1,1): error TS2304: Cannot find name 'missing'.",
    "archive/ignored.ts(1,1): error TS9999: ignored",
  ].join("\n");
  const parsed = parseDiagnostics(fixture);
  assert.equal(parsed.length, 3);

  const lineMoved = parseDiagnostics("server/a.ts(999,99): error TS2322: Type 'string' is not assignable to type 'number'.");
  assert.equal(findRegressions([parsed[0]], lineMoved).length, 0);

  const duplicateIncrease = findRegressions([parsed[0]], [parsed[0], parsed[1]]);
  assert.equal(duplicateIncrease.length, 1);
  assert.equal(duplicateIncrease[0].added, 1);

  const improvement = findRegressions([parsed[0], parsed[1]], [parsed[0]]);
  assert.equal(improvement.length, 0);

  const newError = findRegressions([], [parsed[2]]);
  assert.equal(newError.length, 1);
  assert.equal(newError[0].file, "client/src/b.tsx");

  const baseRoot = "/tmp/sbb-ts-ratchet-base-example";
  const headRoot = "/home/runner/work/final-dashboard-4/final-dashboard-4";
  const basePathDiagnostic = parseDiagnostics(
    `server/path.ts(1,1): error TS7016: Could not find a declaration file for module 'example'. '${baseRoot}/node_modules/example/index.js' implicitly has an 'any' type.`,
    baseRoot,
  );
  const headPathDiagnostic = parseDiagnostics(
    `server/path.ts(99,8): error TS7016: Could not find a declaration file for module 'example'. '${headRoot}/node_modules/example/index.js' implicitly has an 'any' type.`,
    headRoot,
  );
  assert.equal(findRegressions(basePathDiagnostic, headPathDiagnostic).length, 0);
  assert.match(basePathDiagnostic[0].message, /<repo>\/node_modules\/example\/index\.js/);

  console.log("PASS: TypeScript ratchet self-test");
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }

  const baseRef = argument("--base") || process.env.TSC_RATCHET_BASE;
  if (!baseRef) {
    throw new Error("A base ref is required. Use --base <ref> or TSC_RATCHET_BASE.");
  }

  const repoRoot = run("git", ["rev-parse", "--show-toplevel"]).trim();
  const baseSha = run("git", ["merge-base", "HEAD", baseRef], { cwd: repoRoot }).trim();
  const changedInputs = changedTypeScriptInputs(baseSha);

  console.log(`TypeScript ratchet base: ${baseSha}`);
  console.log(`TypeScript ratchet head: ${run("git", ["rev-parse", "HEAD"], { cwd: repoRoot }).trim()}`);

  if (changedInputs.length === 0) {
    console.log("PASS: no TypeScript-impacting production inputs changed.");
    return;
  }

  console.log("TypeScript-impacting changes:");
  for (const file of changedInputs) console.log(`  - ${file}`);

  const worktree = mkdtempSync(path.join(tmpdir(), "sbb-ts-ratchet-"));
  let worktreeAdded = false;

  try {
    run("git", ["worktree", "add", "--detach", worktree, baseSha], { cwd: repoRoot });
    worktreeAdded = true;

    console.log("Installing lockfile-authoritative dependencies for base revision...");
    execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["ci", "--no-audit", "--no-fund"], {
      cwd: worktree,
      env: process.env,
      stdio: "inherit",
    });

    console.log("Measuring base TypeScript diagnostics...");
    const base = runTsc(worktree);
    console.log(`Base production diagnostics parsed: ${base.diagnostics.length}`);

    console.log("Measuring head TypeScript diagnostics...");
    const head = runTsc(repoRoot);
    console.log(`Head production diagnostics parsed: ${head.diagnostics.length}`);

    const regressions = findRegressions(base.diagnostics, head.diagnostics);
    const delta = head.diagnostics.length - base.diagnostics.length;

    if (regressions.length > 0) {
      console.error(`FAIL: ${regressions.length} new/increased TypeScript diagnostic signature(s) detected.`);
      for (const regression of regressions) annotate(regression);
      process.exitCode = 1;
      return;
    }

    const direction = delta < 0 ? ` (${Math.abs(delta)} fewer)` : delta > 0 ? ` (${delta} more, but no new production signature)` : "";
    console.log(`PASS: no new TypeScript debt introduced${direction}.`);
    console.log("Existing diagnostics may remain; this ratchet blocks only regressions relative to the PR base.");
  } finally {
    if (worktreeAdded) {
      try {
        run("git", ["worktree", "remove", "--force", worktree], { cwd: repoRoot });
      } catch (error) {
        console.warn(`Warning: temporary worktree cleanup failed: ${error.message}`);
      }
    }
    rmSync(worktree, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`TypeScript ratchet failed: ${error.stack || error.message || error}`);
  process.exit(1);
});
