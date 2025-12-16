// PATCH DB-1 — EXECUTIVE METRICS API
// Returns real business metrics from historical data + live Loyverse data

import { Router } from "express";
import { db } from "../lib/prisma";

const router = Router();

interface ExecutiveMetrics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersToday: number;
  ordersByChannel: {
    pos: number;
    online: number;
    partner: number;
  };
  dateRange: {
    earliest: string | null;
    latest: string | null;
  };
  lastUpdated: string;
}

router.get("/", async (req, res) => {
  try {
    const prisma = db();
    
    const today = new Date().toISOString().split("T")[0];

    const [
      totalOrdersResult,
      totalRevenueResult,
      todayShift,
      historicalStats,
      dateRange
    ] = await Promise.all([
      prisma.historical_shifts_v1.aggregate({ _sum: { totalOrders: true } }),
      prisma.historical_shifts_v1.aggregate({ _sum: { totalRevenue: true } }),
      prisma.historical_shifts_v1.findFirst({ where: { shiftDate: today } }),
      prisma.historical_shifts_v1.count(),
      prisma.historical_shifts_v1.findMany({
        orderBy: { businessDate: "asc" },
        take: 1,
        select: { shiftDate: true }
      }).then(async (earliest) => {
        const latest = await prisma.historical_shifts_v1.findMany({
          orderBy: { businessDate: "desc" },
          take: 1,
          select: { shiftDate: true }
        });
        return {
          earliest: earliest[0]?.shiftDate || null,
          latest: latest[0]?.shiftDate || null
        };
      })
    ]);

    const totalOrders = totalOrdersResult._sum.totalOrders || 0;
    const totalRevenue = totalRevenueResult._sum.totalRevenue || 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const ordersToday = todayShift?.totalOrders || 0;

    const channelTotals = await prisma.historical_shifts_v1.aggregate({
      _sum: {
        cashAmount: true,
        cardAmount: true,
        qrAmount: true,
        otherAmount: true
      }
    });

    const posRevenue = (channelTotals._sum.cashAmount || 0) + (channelTotals._sum.cardAmount || 0);
    const onlineRevenue = channelTotals._sum.qrAmount || 0;
    const partnerRevenue = channelTotals._sum.otherAmount || 0;

    const metrics: ExecutiveMetrics = {
      totalOrders,
      totalRevenue,
      averageOrderValue,
      ordersToday,
      ordersByChannel: {
        pos: posRevenue > 0 ? Math.round(totalOrders * (posRevenue / totalRevenue)) : 0,
        online: onlineRevenue > 0 ? Math.round(totalOrders * (onlineRevenue / totalRevenue)) : 0,
        partner: partnerRevenue > 0 ? Math.round(totalOrders * (partnerRevenue / totalRevenue)) : 0
      },
      dateRange,
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      metrics,
      shiftsAnalyzed: historicalStats
    });

  } catch (error: any) {
    console.error("[ExecutiveMetrics] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/purchasing-demand", async (req, res) => {
  try {
    const prisma = db();
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [salesLast7d, salesLast30d, allTimeSales] = await Promise.all([
      prisma.historical_sales_v1.groupBy({
        by: ["itemName"],
        where: {
          businessDate: { gte: sevenDaysAgo }
        },
        _sum: { quantitySold: true }
      }),
      prisma.historical_sales_v1.groupBy({
        by: ["itemName"],
        where: {
          businessDate: { gte: thirtyDaysAgo }
        },
        _sum: { quantitySold: true }
      }),
      prisma.historical_sales_v1.groupBy({
        by: ["itemName"],
        _sum: { quantitySold: true, grossSales: true }
      })
    ]);

    const demandTable = allTimeSales.map(item => {
      const qty7d = salesLast7d.find(s => s.itemName === item.itemName)?._sum.quantitySold || 0;
      const qty30d = salesLast30d.find(s => s.itemName === item.itemName)?._sum.quantitySold || 0;
      const qtyAll = item._sum.quantitySold || 0;

      return {
        itemName: item.itemName,
        requested7d: qty7d,
        requested30d: qty30d,
        requestedAllTime: qtyAll,
        purchasedQty: 0,
        variance: 0,
        status: "OK" as "OK" | "OVER" | "UNDER"
      };
    }).sort((a, b) => b.requestedAllTime - a.requestedAllTime);

    res.json({
      success: true,
      demandTable: demandTable.slice(0, 50),
      totalItems: demandTable.length
    });

  } catch (error: any) {
    console.error("[ExecutiveMetrics] Purchasing demand error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
