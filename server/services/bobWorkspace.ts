import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const WORKSPACE_ROOT = path.resolve(process.cwd());
const LOG_FILE = path.join(WORKSPACE_ROOT, "logs", "bob-actions.log");
const MAX_FILE_READ_CHARS = 20000;
const MAX_SCRIPT_OUTPUT_CHARS = 6000;
const MAX_DIR_ENTRIES = 200;

// ── Blocked path patterns (read & write) ─────────────────────────────────────
const BLOCKED_READ_PATTERNS = [
  /\.env($|\.)/i,
  /\.env\./i,
  /secrets?$/i,
  /\.secrets/i,
  /node_modules\//,
  /\.git\//,
];

// Locked Fort Knox files — no modifications allowed
const LOCKED_FILES = [
  "daily_sales_form_locked.html",
  "daily_sales_schema.py",
  "daily_sales_validation.py",
  "server/data/foodCostings.ts",
  "shared/schema.ts",
  "server/vite.ts",
  "vite.config.ts",
  "package.json",
  "drizzle.config.ts",
];

// Write allowed only within these prefix dirs (relative to root)
const WRITE_ALLOWED_PREFIXES = [
  "bob-workspace/",
  "scripts/",
  "client/src/",
  "server/routes/",
  "server/services/",
  "server/",
  "shared/",
];

// Script execution only allowed from these dirs
const RUN_ALLOWED_DIRS = ["scripts/", "bob-workspace/"];

// Blocked run patterns
const BLOCKED_CMD_PATTERNS = [
  /deploy/i,
  /publish/i,
  /replit\s+publish/i,
  /process\.env/i,
  /printenv/i,
  /env\b/,
  /rm\s+-rf\s+\//i,
  /DROP\s+TABLE/i,
  /TRUNCATE/i,
  /DELETE\s+FROM\s+\w+\s*;/i,
  /ALTER\s+TABLE.*DROP/i,
  /npm\s+run\s+db:push/i,
  /drizzle-kit/i,
  /\.git\//,
];

// ── Logging ───────────────────────────────────────────────────────────────────
function logAction(action: string, detail: string, outcome: "ok" | "blocked" | "error", extra?: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [BOB] [${outcome.toUpperCase()}] ${action} | ${detail}${extra ? ` | ${extra}` : ""}\n`;
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line, "utf8");
  } catch {
    // ignore logging failures
  }
}

// ── Path helpers ──────────────────────────────────────────────────────────────
function resolveSafe(relPath: string): string | null {
  const clean = relPath.replace(/^\/+/, "").replace(/\.\.\//g, "").trim();
  const abs = path.resolve(WORKSPACE_ROOT, clean);
  if (!abs.startsWith(WORKSPACE_ROOT)) return null;
  return abs;
}

function isBlockedRead(relPath: string): boolean {
  return BLOCKED_READ_PATTERNS.some(p => p.test(relPath));
}

function isLockedFile(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  return LOCKED_FILES.some(lf => norm === lf || norm.endsWith("/" + lf));
}

function isWriteAllowed(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (isLockedFile(norm)) return false;
  if (isBlockedRead(norm)) return false;
  return WRITE_ALLOWED_PREFIXES.some(prefix => norm.startsWith(prefix));
}

function isRunAllowed(cmd: string): boolean {
  if (BLOCKED_CMD_PATTERNS.some(p => p.test(cmd))) return false;
  const parts = cmd.trim().split(/\s+/);
  const scriptArg = parts.find(p =>
    p.endsWith(".js") || p.endsWith(".mjs") || p.endsWith(".ts") || p.endsWith(".sh")
  );
  if (!scriptArg) return false;
  const rel = scriptArg.replace(/^\/+/, "");
  return RUN_ALLOWED_DIRS.some(d => rel.startsWith(d));
}

// ── Tool implementations ───────────────────────────────────────────────────────

export async function bobReadFile(relPath: string): Promise<string> {
  if (isBlockedRead(relPath)) {
    logAction("read_file", relPath, "blocked", "matched blocked pattern");
    return `[BLOCKED] Cannot read ${relPath} — security policy.`;
  }
  const abs = resolveSafe(relPath);
  if (!abs) {
    logAction("read_file", relPath, "blocked", "path traversal attempt");
    return `[BLOCKED] Invalid path: ${relPath}`;
  }
  try {
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      logAction("read_file", relPath, "error", "is a directory — use read_dir");
      return `[ERROR] ${relPath} is a directory — use read_dir instead.`;
    }
    let content = fs.readFileSync(abs, "utf8");
    if (content.length > MAX_FILE_READ_CHARS) {
      content = content.slice(0, MAX_FILE_READ_CHARS) + `\n... [truncated at ${MAX_FILE_READ_CHARS} chars]`;
    }
    logAction("read_file", relPath, "ok", `${stat.size} bytes`);
    return content;
  } catch (err: any) {
    logAction("read_file", relPath, "error", err.message);
    return `[ERROR] Could not read ${relPath}: ${err.message}`;
  }
}

export async function bobReadDir(relPath: string, depth: number = 1): Promise<string> {
  if (isBlockedRead(relPath)) {
    logAction("read_dir", relPath, "blocked");
    return `[BLOCKED] Cannot read directory ${relPath}.`;
  }
  const abs = resolveSafe(relPath);
  if (!abs) {
    logAction("read_dir", relPath, "blocked", "path traversal");
    return `[BLOCKED] Invalid path: ${relPath}`;
  }
  try {
    const lines: string[] = [];
    function walk(dir: string, rel: string, d: number) {
      if (lines.length >= MAX_DIR_ENTRIES) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (lines.length >= MAX_DIR_ENTRIES) break;
        const childRel = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          lines.push(`${childRel}/`);
          if (d > 1) walk(path.join(dir, e.name), childRel, d - 1);
        } else {
          lines.push(childRel);
        }
      }
    }
    walk(abs, relPath.replace(/^\/+/, "").replace(/\/$/, ""), Math.min(depth, 4));
    if (lines.length >= MAX_DIR_ENTRIES) lines.push(`... [truncated at ${MAX_DIR_ENTRIES} entries]`);
    logAction("read_dir", relPath, "ok", `${lines.length} entries`);
    return lines.join("\n") || "(empty directory)";
  } catch (err: any) {
    logAction("read_dir", relPath, "error", err.message);
    return `[ERROR] Cannot list ${relPath}: ${err.message}`;
  }
}

export async function bobWriteFile(relPath: string, content: string): Promise<string> {
  if (!isWriteAllowed(relPath)) {
    logAction("write_file", relPath, "blocked", "not in allowed write prefixes or is locked file");
    return `[BLOCKED] Cannot write to ${relPath} — outside allowed directories or locked file. Allowed: bob-workspace/, scripts/, client/src/, server/routes/, server/services/, server/, shared/`;
  }
  const abs = resolveSafe(relPath);
  if (!abs) {
    logAction("write_file", relPath, "blocked", "path traversal");
    return `[BLOCKED] Invalid path: ${relPath}`;
  }
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
    logAction("write_file", relPath, "ok", `${content.length} chars written`);
    return `[OK] Written ${content.length} chars to ${relPath}`;
  } catch (err: any) {
    logAction("write_file", relPath, "error", err.message);
    return `[ERROR] Failed to write ${relPath}: ${err.message}`;
  }
}

export async function bobRunScript(cmd: string): Promise<string> {
  if (!isRunAllowed(cmd)) {
    logAction("run_script", cmd, "blocked", "blocked command pattern or script not in allowed dir");
    return `[BLOCKED] Cannot run: ${cmd}\nAllowed: scripts/*.js|ts|sh or bob-workspace/*.js|ts|sh. Blocked: deploy, env access, destructive DB ops, rm -rf /.`;
  }
  logAction("run_script", cmd, "ok", "executing");
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: WORKSPACE_ROOT,
      timeout: 15000,
      env: { PATH: process.env.PATH || "/usr/bin:/bin:/usr/local/bin" },
    });
    let out = (stdout + (stderr ? `\n[STDERR]\n${stderr}` : "")).trim();
    if (out.length > MAX_SCRIPT_OUTPUT_CHARS) {
      out = out.slice(0, MAX_SCRIPT_OUTPUT_CHARS) + `\n... [truncated at ${MAX_SCRIPT_OUTPUT_CHARS} chars]`;
    }
    logAction("run_script", cmd, "ok", `exit 0, ${out.length} chars output`);
    return out || "(no output)";
  } catch (err: any) {
    const msg = (err.stdout || "") + (err.stderr ? `\n[STDERR] ${err.stderr}` : "") || err.message;
    logAction("run_script", cmd, "error", msg.slice(0, 200));
    return `[ERROR] Script failed: ${msg.slice(0, MAX_SCRIPT_OUTPUT_CHARS)}`;
  }
}

export async function bobReadLog(lines: number = 100): Promise<string> {
  const logFiles = [
    "logs/bob-actions.log",
    "logs/ai-analysis.log",
    "logs/gpt.log",
    "logs/loyverse-api.log",
  ];
  const results: string[] = [];
  for (const lf of logFiles) {
    const abs = path.join(WORKSPACE_ROOT, lf);
    try {
      const content = fs.readFileSync(abs, "utf8");
      const tail = content.split("\n").slice(-lines).join("\n");
      results.push(`=== ${lf} (last ${lines} lines) ===\n${tail}`);
    } catch {
      // file doesn't exist — skip
    }
  }
  logAction("read_log", `last ${lines} lines`, "ok");
  return results.join("\n\n") || "(no log files found)";
}

// ── Tool call parser ──────────────────────────────────────────────────────────
// Parses <workspace_tool ...>...</workspace_tool> tags from Bob's reply.
// Returns array of parsed tool calls.

export interface WorkspaceTool {
  name: "read_file" | "read_dir" | "write_file" | "run_script" | "read_log";
  path?: string;
  depth?: number;
  cmd?: string;
  content?: string;
  lines?: number;
}

export function parseWorkspaceTools(text: string): WorkspaceTool[] {
  const tools: WorkspaceTool[] = [];

  // Block tags first (contain content between open/close tags).
  // Negative lookbehind (?<!\/) ensures we don't match self-closing />
  const blockRe = /<workspace_tool\s+([^>]*?)(?<!\/)>([\s\S]*?)<\/workspace_tool>/g;
  let m: RegExpExecArray | null;
  const blockRanges: Array<[number, number]> = [];
  while ((m = blockRe.exec(text)) !== null) {
    blockRanges.push([m.index, m.index + m[0].length]);
    const attrs = parseAttrs(m[1]);
    const name = attrs.name as WorkspaceTool["name"];
    if (name) tools.push({ name, path: attrs.path, content: m[2], cmd: attrs.cmd });
  }

  // Self-closing tags — skip positions already matched as block tags
  const selfClosingRe = /<workspace_tool\s+([^>]*?)\/>/g;
  while ((m = selfClosingRe.exec(text)) !== null) {
    const pos = m.index;
    const inBlock = blockRanges.some(([s, e]) => pos >= s && pos < e);
    if (inBlock) continue;
    const attrs = parseAttrs(m[1]);
    const name = attrs.name as WorkspaceTool["name"];
    if (name) tools.push({
      name,
      path: attrs.path,
      depth: attrs.depth ? parseInt(attrs.depth) : undefined,
      cmd: attrs.cmd,
      lines: attrs.lines ? parseInt(attrs.lines) : undefined,
    });
  }

  return tools;
}

function parseAttrs(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr)) !== null) attrs[m[1]] = m[2];
  return attrs;
}

export async function executeWorkspaceTools(tools: WorkspaceTool[]): Promise<string> {
  const results: string[] = [];
  for (const tool of tools) {
    let result: string;
    switch (tool.name) {
      case "read_file":
        result = await bobReadFile(tool.path ?? "");
        results.push(`[TOOL: read_file path="${tool.path}"]\n${result}`);
        break;
      case "read_dir":
        result = await bobReadDir(tool.path ?? "", tool.depth ?? 1);
        results.push(`[TOOL: read_dir path="${tool.path}" depth="${tool.depth ?? 1}"]\n${result}`);
        break;
      case "write_file":
        result = await bobWriteFile(tool.path ?? "", tool.content ?? "");
        results.push(`[TOOL: write_file path="${tool.path}"]\n${result}`);
        break;
      case "run_script":
        result = await bobRunScript(tool.cmd ?? "");
        results.push(`[TOOL: run_script cmd="${tool.cmd}"]\n${result}`);
        break;
      case "read_log":
        result = await bobReadLog(tool.lines ?? 100);
        results.push(`[TOOL: read_log lines="${tool.lines ?? 100}"]\n${result.slice(0, 8000)}`);
        break;
      default:
        results.push(`[TOOL: unknown name="${(tool as any).name}"] ignored`);
    }
  }
  return results.join("\n\n---\n\n");
}

// ── Workspace system prompt block injected into every Bob message ─────────────
export const WORKSPACE_TOOLS_BLOCK = `
[BOB WORKSPACE ACCESS]
You have controlled, sandboxed access to the Replit project filesystem.
Use XML tool tags in your response to interact. The server executes them and returns results in the next message.

AVAILABLE TOOLS:
  Read a file:    <workspace_tool name="read_file" path="server/routes/aiOpsControl.ts"/>
  List directory: <workspace_tool name="read_dir" path="client/src" depth="2"/>
  Write a file:   <workspace_tool name="write_file" path="bob-workspace/analysis.md">your content here</workspace_tool>
  Create script:  <workspace_tool name="write_file" path="scripts/bob-check.mjs">import fs from 'fs'; console.log(fs.readdirSync('server/routes'));</workspace_tool>
  Run script:     <workspace_tool name="run_script" cmd="node scripts/bob-check.mjs"/>
  Read logs:      <workspace_tool name="read_log" lines="50"/>

IMPORTANT — SCRIPT SYNTAX:
  This project uses ESM ("type":"module" in package.json).
  Scripts MUST use: import fs from 'fs'; import path from 'path'; (NOT require())
  Use .mjs extension for scripts you create to guarantee ESM mode.
  Example correct script:
    import fs from 'fs';
    const routes = fs.readdirSync('server/routes');
    console.log(routes.join('\\n'));

RULES (strictly enforced server-side):
  WRITE allowed: bob-workspace/, scripts/, client/src/, server/routes/, server/services/, server/, shared/
  WRITE blocked: .env files, node_modules/, .git/, package.json, drizzle.config.ts, server/vite.ts, vite.config.ts, daily_sales_schema.py, foodCostings.ts
  RUN allowed:   .mjs / .js / .ts / .sh scripts under scripts/ or bob-workspace/ only
  RUN blocked:   deploy, publish, printenv, process.env, rm -rf /, DROP TABLE, TRUNCATE, ALTER TABLE DROP
  ENV VARS:      You do NOT have access to environment variables or secrets — never ask for them
  DEPLOY:        Deployment remains manual — you cannot trigger it

All your actions are logged to logs/bob-actions.log.
[END WORKSPACE ACCESS]`;
