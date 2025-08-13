#!/bin/bash
# Comprehensive audit report

echo "🔍 COMPREHENSIVE SYSTEM AUDIT"
echo "=============================="
echo "Generated: $(date)"
echo ""

echo "📋 1. ROUTES & PAGES INVENTORY"
echo "------------------------------"
tsx scripts/audit/list-routes.ts
echo ""

echo "🚨 2. UNSAFE OPERATIONS SCAN"
echo "----------------------------"
tsx scripts/audit/find-unsafe.ts
echo ""

echo "📦 3. LARGE FILES ANALYSIS"
echo "-------------------------"
tsx scripts/audit/find-large-files.ts
echo ""

echo "✅ AUDIT COMPLETE"
echo "================="
echo "Review findings above and address any issues."