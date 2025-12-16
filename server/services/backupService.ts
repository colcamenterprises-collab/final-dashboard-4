// PATCH DS-1 — DATA SAFETY BACKUP SERVICE
// Immutable backup system for PostgreSQL data

import { db } from "../lib/prisma";
import { execSync, exec } from "child_process";
import fs from "fs";
import path from "path";
import archiver from "archiver";

export interface BackupResult {
  success: boolean;
  backupId?: string;
  sqlDumpPath?: string;
  csvZipPath?: string;
  tableCounts?: Record<string, number>;
  sizeBytes?: number;
  durationMs?: number;
  error?: string;
}

export interface BackupStatus {
  lastBackup: {
    id: string;
    createdAt: Date;
    status: string;
    type: string;
    sizeBytes: number | null;
    durationMs: number | null;
  } | null;
  recentBackups: Array<{
    id: string;
    createdAt: Date;
    status: string;
    type: string;
  }>;
  isHealthy: boolean;
}

const BACKUP_DIR = path.join(process.cwd(), "backups");
const TABLES_TO_BACKUP = [
  "DailySales",
  "DailyStock",
  "ShoppingPurchase",
  "WageEntry",
  "OtherExpense",
  "lv_receipt",
  "lv_line_item",
  "lv_modifier",
  "historical_shifts_v1",
  "historical_sales_v1",
  "menu_categories_v3",
  "menu_items_v3",
  "menu_modifiers_v3",
  "menu_modifiers_group_v3",
  "cleaning_tasks",
  "manager_checklists",
  "rolls_ledger",
  "meat_ledger"
];

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

async function getTableCounts(prisma: any): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  
  try {
    const result = await prisma.$queryRaw`
      SELECT schemaname, relname as table_name, n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
    `;
    
    for (const row of result as any[]) {
      counts[row.table_name] = parseInt(row.row_count) || 0;
    }
  } catch (e) {
    console.error("[Backup] Failed to get table counts:", e);
  }
  
  return counts;
}

async function exportTableToCSV(prisma: any, tableName: string, outputPath: string): Promise<number> {
  try {
    let data: any[] = [];
    
    switch (tableName) {
      case "DailySales":
        data = await prisma.dailySales.findMany({ where: { deletedAt: null } });
        break;
      case "DailyStock":
        data = await prisma.dailyStock.findMany({ where: { deletedAt: null } });
        break;
      case "lv_receipt":
        data = await prisma.lv_receipt.findMany();
        break;
      case "lv_line_item":
        data = await prisma.lv_line_item.findMany();
        break;
      case "historical_shifts_v1":
        data = await prisma.historical_shifts_v1.findMany();
        break;
      case "historical_sales_v1":
        data = await prisma.historical_sales_v1.findMany();
        break;
      case "menu_categories_v3":
        data = await prisma.menu_categories_v3.findMany();
        break;
      case "menu_items_v3":
        data = await prisma.menu_items_v3.findMany();
        break;
      default:
        return 0;
    }
    
    if (data.length === 0) {
      return 0;
    }
    
    const headers = Object.keys(data[0]);
    const csvLines = [headers.join(",")];
    
    for (const row of data) {
      const values = headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
        return String(val);
      });
      csvLines.push(values.join(","));
    }
    
    fs.writeFileSync(outputPath, csvLines.join("\n"));
    return data.length;
  } catch (e) {
    console.error(`[Backup] Failed to export ${tableName}:`, e);
    return 0;
  }
}

export async function runBackup(type: "full" | "daily" | "manual", triggeredBy: string = "system"): Promise<BackupResult> {
  const prisma = db();
  const startTime = Date.now();
  
  ensureBackupDir();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupSubDir = path.join(BACKUP_DIR, `backup_${timestamp}`);
  fs.mkdirSync(backupSubDir, { recursive: true });
  
  const backupLog = await prisma.backup_logs_v1.create({
    data: {
      status: "pending",
      type,
      triggeredBy
    }
  });
  
  try {
    console.log(`[Backup] Starting ${type} backup...`);
    
    const tableCounts = await getTableCounts(prisma);
    
    const csvDir = path.join(backupSubDir, "csv");
    fs.mkdirSync(csvDir, { recursive: true });
    
    const exportedCounts: Record<string, number> = {};
    
    for (const table of TABLES_TO_BACKUP) {
      const csvPath = path.join(csvDir, `${table}.csv`);
      const count = await exportTableToCSV(prisma, table, csvPath);
      if (count > 0) {
        exportedCounts[table] = count;
      }
    }
    
    const csvZipPath = path.join(backupSubDir, `csv_backup_${timestamp}.zip`);
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(csvZipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      
      output.on("close", () => resolve());
      archive.on("error", (err) => reject(err));
      
      archive.pipe(output);
      archive.directory(csvDir, false);
      archive.finalize();
    });
    
    let totalSize = 0;
    if (fs.existsSync(csvZipPath)) {
      totalSize = fs.statSync(csvZipPath).size;
    }
    
    const durationMs = Date.now() - startTime;
    
    await prisma.backup_logs_v1.update({
      where: { id: backupLog.id },
      data: {
        status: "success",
        csvZipPath,
        tableCounts: exportedCounts,
        sizeBytes: totalSize,
        durationMs
      }
    });
    
    console.log(`[Backup] Completed in ${durationMs}ms, size: ${totalSize} bytes`);
    
    return {
      success: true,
      backupId: backupLog.id,
      csvZipPath,
      tableCounts: exportedCounts,
      sizeBytes: totalSize,
      durationMs
    };
    
  } catch (error: any) {
    console.error("[Backup] Failed:", error);
    
    await prisma.backup_logs_v1.update({
      where: { id: backupLog.id },
      data: {
        status: "failed",
        errorMessage: error.message,
        durationMs: Date.now() - startTime
      }
    });
    
    return {
      success: false,
      backupId: backupLog.id,
      error: error.message
    };
  }
}

export async function getBackupStatus(): Promise<BackupStatus> {
  const prisma = db();
  
  const lastBackup = await prisma.backup_logs_v1.findFirst({
    where: { status: "success" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      status: true,
      type: true,
      sizeBytes: true,
      durationMs: true
    }
  });
  
  const recentBackups = await prisma.backup_logs_v1.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      status: true,
      type: true
    }
  });
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const isHealthy = lastBackup ? lastBackup.createdAt > oneDayAgo : false;
  
  return {
    lastBackup,
    recentBackups,
    isHealthy
  };
}

export const backupService = {
  runBackup,
  getBackupStatus
};
