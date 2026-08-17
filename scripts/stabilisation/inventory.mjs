#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname } from "node:path";
import { gzipSync } from "node:zlib";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

const trackedFiles = git("ls-files").split("\n").filter(Boolean);
const productionRoots = ["client/src/", "server/", "shared/", "lib/"];
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);
const imageExtensions = new Set([".avif", ".gif", ".ico", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const archivePrefixes = ["archive/", "extracted_dashboard/", "focused-export/", "loyverse-ai-package/", "loyverse-ai-updated-package/"];

const count = (predicate) => trackedFiles.filter(predicate).length;
const isProductionSource = (file) =>
  productionRoots.some((root) => file.startsWith(root)) && sourceExtensions.has(extname(file));

const trackedText = (file) => readFileSync(file, "utf8");
const productionServerFiles = trackedFiles.filter(
  (file) => file.startsWith("server/") && sourceExtensions.has(extname(file)),
);

let routeRegistrations = 0;
for (const file of productionServerFiles) {
  const contents = trackedText(file);
  routeRegistrations += (contents.match(/\b(?:app|router)\s*\.\s*(?:get|post|put|patch|delete|options|head|all)\s*\(/g) ?? []).length;
}

const prismaSchema = existsSync("schema.prisma") ? trackedText("schema.prisma") : "";
const drizzleSchemaFiles = trackedFiles.filter((file) =>
  ["schema.ts", "shared/schema.ts", "server/schema.ts"].includes(file),
);
let drizzleTables = 0;
for (const file of drizzleSchemaFiles) {
  drizzleTables += (trackedText(file).match(/\b(?:pgTable|mysqlTable|sqliteTable)\s*\(/g) ?? []).length;
}

const packageJson = JSON.parse(trackedText("package.json"));
const testFiles = trackedFiles.filter((file) =>
  /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file),
);
const appSource = existsSync("client/src/App.tsx") ? trackedText("client/src/App.tsx") : "";
const migrationDirectories = new Set(
  trackedFiles
    .filter((file) => /^(?:migrations|prisma\/migrations)\/.+\.sql$/.test(file))
    .map((file) => dirname(file)),
);

const bytes = (file) => (existsSync(file) && statSync(file).isFile() ? statSync(file).size : null);
const distAssets = existsSync("dist/public/assets")
  ? readdirSync("dist/public/assets", { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const relativeParent = entry.parentPath?.replace(/^dist\/public\/assets\/?/, "").replace(/^\/$/, "");
        return `dist/public/assets/${relativeParent ? `${relativeParent}/` : ""}${entry.name}`;
      })
  : [];
const builtJs = distAssets.filter((file) => file.endsWith(".js"));
const builtCss = distAssets.filter((file) => file.endsWith(".css"));
const largestBuiltJs = builtJs.sort((left, right) => (bytes(right) ?? 0) - (bytes(left) ?? 0))[0];

const result = {
  generated_at: new Date().toISOString(),
  repository_sha: git("rev-parse", "HEAD"),
  repository: {
    tracked_files: trackedFiles.length,
    production_source_files: count(isProductionSource),
    source_files_all_tracked: count((file) => sourceExtensions.has(extname(file))),
    archived_or_reference_files: count((file) => archivePrefixes.some((prefix) => file.startsWith(prefix))),
    image_assets: count((file) => imageExtensions.has(extname(file).toLowerCase())),
    sql_files: count((file) => extname(file).toLowerCase() === ".sql"),
    package_manifests: count((file) => /(?:^|\/)package\.json$/.test(file)),
  },
  dependencies: {
    direct: Object.keys(packageJson.dependencies ?? {}).length,
    development: Object.keys(packageJson.devDependencies ?? {}).length,
  },
  application_structure: {
    route_registrations_static_count: routeRegistrations,
    prisma_models: (prismaSchema.match(/^model\s+\w+\s*\{/gm) ?? []).length,
    drizzle_tables_static_count: drizzleTables,
    drizzle_schema_files_scanned: drizzleSchemaFiles,
    test_files_static_count: testFiles.length,
    main_app_static_imports: (appSource.match(/^import\s.+from\s+["'][^"']+["'];?$/gm) ?? []).length,
    main_app_lazy_imports: (appSource.match(/\b(?:lazy|import)\s*\(/g) ?? []).length,
    raw_migration_directories: migrationDirectories.size,
  },
  build_artifacts: {
    server_bundle_bytes: bytes("dist/index.js"),
    frontend_javascript_bytes: builtJs.reduce((total, file) => total + (bytes(file) ?? 0), 0) || null,
    largest_frontend_javascript: largestBuiltJs
      ? {
          path: largestBuiltJs,
          bytes: bytes(largestBuiltJs),
          gzip_bytes: gzipSync(readFileSync(largestBuiltJs)).length,
        }
      : null,
    frontend_css_bytes: builtCss.reduce((total, file) => total + (bytes(file) ?? 0), 0) || null,
    note: "Build values are null when npm run build has not produced dist artifacts.",
  },
  counting_notes: {
    production_roots: productionRoots,
    archive_prefixes: archivePrefixes,
    route_count: "Static app/router HTTP method registrations in tracked server source; generated and dynamically registered routes may require separate review.",
    test_count: "Tracked files in test directories or named *.test.* / *.spec.*; this is not a count of executed test cases.",
  },
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
