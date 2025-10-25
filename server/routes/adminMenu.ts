import type { Express } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

export function registerAdminMenuRoutes(app: Express) {
  // GET /api/admin/menu - Get all categories with items
  app.get("/api/admin/menu", async (req, res) => {
    try {
      const categories = await prisma.menuCategory.findMany({
        orderBy: { position: "asc" },
        include: {
          items: {
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
      console.error("Error fetching admin menu:", error);
      res.status(500).json({ error: "Failed to fetch menu" });
    }
  });

  // POST /api/admin/menu/category - Create category
  app.post("/api/admin/menu/category", async (req, res) => {
    try {
      const { name, slug, position } = req.body;
      
      const category = await prisma.menuCategory.create({
        data: {
          id: generateId(),
          name,
          slug,
          position: position ?? 0,
        },
      });

      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  // PUT /api/admin/menu/category/:id - Update category
  app.put("/api/admin/menu/category/:id", async (req, res) => {
    try {
      const { name, slug, position } = req.body;
      
      const category = await prisma.menuCategory.update({
        where: { id: req.params.id },
        data: { name, slug, position },
      });

      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  // DELETE /api/admin/menu/category/:id - Delete category
  app.delete("/api/admin/menu/category/:id", async (req, res) => {
    try {
      await prisma.menuCategory.delete({
        where: { id: req.params.id },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // POST /api/admin/menu/item - Create menu item
  app.post("/api/admin/menu/item", async (req, res) => {
    try {
      const { categoryId, name, description, price, sku, position, available, groups } = req.body;
      
      const item = await prisma.menuItem_Online.create({
        data: {
          id: generateId(),
          categoryId,
          name,
          description,
          price,
          sku,
          position: position ?? 0,
          available: available ?? true,
          groups: groups ? {
            create: groups.map((g: any, gIdx: number) => ({
              id: generateId(),
              name: g.name,
              type: g.type,
              required: g.required ?? false,
              maxSel: g.maxSel,
              position: gIdx,
              options: {
                create: (g.options || []).map((o: any, oIdx: number) => ({
                  id: generateId(),
                  name: o.name,
                  priceDelta: o.priceDelta,
                  position: oIdx,
                })),
              },
            })),
          } : undefined,
        },
        include: {
          groups: {
            include: {
              options: true,
            },
          },
        },
      });

      res.json(item);
    } catch (error) {
      console.error("Error creating item:", error);
      res.status(500).json({ error: "Failed to create item" });
    }
  });

  // PUT /api/admin/menu/item/:id - Update menu item
  app.put("/api/admin/menu/item/:id", async (req, res) => {
    try {
      const { name, description, price, sku, position, available, groups } = req.body;
      
      // Delete existing groups
      await prisma.modifierGroup_Online.deleteMany({
        where: { itemId: req.params.id },
      });

      // Update item with new groups
      const item = await prisma.menuItem_Online.update({
        where: { id: req.params.id },
        data: {
          name,
          description,
          price,
          sku,
          position,
          available,
          groups: groups ? {
            create: groups.map((g: any, gIdx: number) => ({
              id: generateId(),
              name: g.name,
              type: g.type,
              required: g.required ?? false,
              maxSel: g.maxSel,
              position: gIdx,
              options: {
                create: (g.options || []).map((o: any, oIdx: number) => ({
                  id: generateId(),
                  name: o.name,
                  priceDelta: o.priceDelta,
                  position: oIdx,
                })),
              },
            })),
          } : undefined,
        },
        include: {
          groups: {
            include: {
              options: true,
            },
          },
        },
      });

      res.json(item);
    } catch (error) {
      console.error("Error updating item:", error);
      res.status(500).json({ error: "Failed to update item" });
    }
  });

  // DELETE /api/admin/menu/item/:id - Delete menu item
  app.delete("/api/admin/menu/item/:id", async (req, res) => {
    try {
      await prisma.menuItem_Online.delete({
        where: { id: req.params.id },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting item:", error);
      res.status(500).json({ error: "Failed to delete item" });
    }
  });
}
