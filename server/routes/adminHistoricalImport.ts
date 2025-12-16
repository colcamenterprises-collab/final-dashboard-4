// PATCH LY-1 — ADMIN HISTORICAL IMPORT ROUTES
// POST /api/admin/historical/import - Run historical import
// GET /api/admin/historical/status - Get import status

import { Router } from "express";
import { loyverseHistoricalService } from "../services/loyverseHistoricalImport";

const router = Router();

router.post("/import", async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    console.log("[AdminHistorical] Starting historical import...");
    
    const result = await loyverseHistoricalService.importHistoricalData(
      startDate || "2025-07-01",
      endDate
    );
    
    res.json({
      success: result.success,
      message: result.success ? "Historical import completed" : "Import completed with errors",
      result: {
        shiftsImported: result.shiftsImported,
        salesImported: result.salesImported,
        dateRange: {
          start: result.startDate,
          end: result.endDate
        },
        errors: result.errors
      }
    });
    
  } catch (error: any) {
    console.error("[AdminHistorical] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/status", async (req, res) => {
  try {
    const stats = await loyverseHistoricalService.getHistoricalStats();
    
    res.json({
      success: true,
      stats: {
        shiftsImported: stats.shiftsImported,
        salesRecords: stats.salesRecords,
        totalRevenue: stats.totalRevenue,
        totalOrders: stats.totalOrders,
        totalReceipts: stats.totalReceipts,
        dateRange: stats.dateRange,
        isPopulated: stats.shiftsImported > 0
      }
    });
    
  } catch (error: any) {
    console.error("[AdminHistorical] Status error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
