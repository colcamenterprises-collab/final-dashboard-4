// PATCH DS-1 — ADMIN BACKUP ROUTES
// POST /api/admin/backup/run - Run manual backup
// GET /api/admin/backup/status - Get backup status

import { Router } from "express";
import { backupService } from "../services/backupService";

const router = Router();

router.post("/run", async (req, res) => {
  try {
    console.log("[AdminBackup] Manual backup triggered");
    
    const result = await backupService.runBackup("manual", "admin_ui");
    
    if (result.success) {
      res.json({
        success: true,
        message: "Backup completed successfully",
        backup: {
          id: result.backupId,
          csvZipPath: result.csvZipPath,
          tableCounts: result.tableCounts,
          sizeBytes: result.sizeBytes,
          durationMs: result.durationMs
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Backup failed",
        error: result.error
      });
    }
  } catch (error: any) {
    console.error("[AdminBackup] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/status", async (req, res) => {
  try {
    const status = await backupService.getBackupStatus();
    
    res.json({
      success: true,
      status: {
        lastBackup: status.lastBackup ? {
          id: status.lastBackup.id,
          createdAt: status.lastBackup.createdAt,
          status: status.lastBackup.status,
          type: status.lastBackup.type,
          sizeBytes: status.lastBackup.sizeBytes,
          durationMs: status.lastBackup.durationMs
        } : null,
        recentBackups: status.recentBackups,
        isHealthy: status.isHealthy,
        healthMessage: status.isHealthy 
          ? "Backup system healthy - last backup within 24 hours"
          : "WARNING: No successful backup in last 24 hours"
      }
    });
  } catch (error: any) {
    console.error("[AdminBackup] Status error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
