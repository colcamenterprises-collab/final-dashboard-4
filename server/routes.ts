import express, { Request, Response } from "express";
import { createServer } from "http";
import type { Server } from "http";

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

  // Create and return the HTTP server instance
  const httpServer = createServer(app);
  return httpServer;
}
