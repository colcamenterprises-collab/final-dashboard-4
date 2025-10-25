import type { Express } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function registerOnlineMenuRoutes(app: Express) {
  // GET /api/menu - Public menu endpoint for ordering page
  app.get("/api/menu", async (req, res) => {
    try {
      const categories = await prisma.menuCategory.findMany({
        orderBy: { position: "asc" },
        include: {
          items: {
            where: { available: true },
            orderBy: { position: "asc" },
            include: {
              groups: {
                orderBy: { position: "asc" },
                include: {
                  options: {
                    orderBy: { position: "asc" },
                  },
                },
              },
            },
          },
        },
      });

      res.json({ categories });
    } catch (error) {
      console.error("Error fetching menu:", error);
      res.status(500).json({ error: "Failed to fetch menu" });
    }
  });
}
