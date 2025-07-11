import express, { Request, Response } from "express";
import { createServer } from "http";
import type { Server } from "http";
import { storage } from "./storage";

export function registerRoutes(app: express.Application): Server {
  // Stock discrepancy endpoint for dashboard
  app.get("/api/dashboard/stock-discrepancies", async (req: Request, res: Response) => {
    try {
      // Mock data for now - this matches the expected format for the DiscrepancyCard component
      const discrepancies = [
        {
          item: "Burger Buns",
          expected: 50,
          actual: 45,
          difference: -5,
          threshold: 10,
          isOutOfBounds: false,
          alert: null
        },
        {
          item: "Chicken Wings",
          expected: 100,
          actual: 85,
          difference: -15,
          threshold: 10,
          isOutOfBounds: true,
          alert: "Stock level below threshold"
        },
        {
          item: "Fries",
          expected: 30,
          actual: 35,
          difference: 5,
          threshold: 10,
          isOutOfBounds: false,
          alert: null
        }
      ];

      res.json({ discrepancies });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch stock discrepancies" });
    }
  });

  // Daily Stock Sales endpoints
  app.get("/api/daily-stock-sales/search", async (req: Request, res: Response) => {
    try {
      const { query } = req.query;
      let results;
      
      if (query && typeof query === 'string') {
        results = await storage.searchDailyStockSales(query);
      } else {
        results = await storage.getAllDailyStockSales();
      }
      
      res.json(results);
    } catch (err) {
      console.error("Error searching daily stock sales:", err);
      res.status(500).json({ error: "Failed to search daily stock sales" });
    }
  });

  app.post("/api/daily-stock-sales", async (req: Request, res: Response) => {
    try {
      const data = req.body;
      console.log("Received daily stock sales data:", data);
      
      // Save to storage
      const result = await storage.createDailyStockSales(data);
      
      res.json(result);
    } catch (err) {
      console.error("Error creating daily stock sales:", err);
      res.status(500).json({ error: "Failed to create daily stock sales" });
    }
  });

  app.get("/api/daily-stock-sales/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await storage.getDailyStockSalesById(parseInt(id));
      
      if (!result) {
        return res.status(404).json({ error: "Daily stock sales not found" });
      }
      
      res.json(result);
    } catch (err) {
      console.error("Error fetching daily stock sales:", err);
      res.status(500).json({ error: "Failed to fetch daily stock sales" });
    }
  });

  // Create and return the HTTP server instance
  const httpServer = createServer(app);
  return httpServer;
}
