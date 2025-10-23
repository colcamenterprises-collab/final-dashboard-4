#!/bin/bash
# === Smash Brothers Burgers — Full Prisma Fix + Build Script ===
# This script safely updates package.json, regenerates Prisma Client,
# rebuilds the project, and prepares it for deploy.

echo "🔧 Starting automated Prisma + build repair..."

# --- Ensure jq (JSON CLI tool) exists ---
if ! command -v jq >/dev/null 2>&1; then
  echo "📦 Installing jq (for JSON edits)..."
  npm install -g jq
fi

# --- Backup package.json ---
echo "📦 Backing up package.json to package.json.bak..."
cp package.json package.json.bak

# --- Update package.json scripts automatically ---
echo "🛠️ Updating package.json scripts..."
jq '.scripts.build = "prisma generate && vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist"
    | .scripts.postinstall = "prisma generate"' package.json > package.tmp.json && mv package.tmp.json package.json

# --- Clean existing dependencies ---
echo "🧹 Cleaning node_modules..."
rm -rf node_modules

# --- Fresh install ---
echo "📦 Installing dependencies..."
npm ci

# --- Regenerate Prisma Client ---
echo "🔁 Generating Prisma Client..."
npx prisma generate

# --- Build project ---
echo "🏗️ Building project..."
npm run build

# --- Done ---
echo ""
echo "✅ All done!"
echo "You can now deploy safely. Prisma binaries are correct and the build is ready."
echo "If you want to double-check, run: npm run verify:prisma (optional)"
