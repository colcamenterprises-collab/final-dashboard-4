import { Router } from "express";
import { db } from "../db";
import { menuItemV3, menuItemRecipe, recipe } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";

export const menuManagementRouter = Router();

// Configure multer for image uploads
const uploadDir = path.join(process.cwd(), "public/menu");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed"));
    }
  }
});

// GET /api/menu-management - List all menu items with linked recipes
menuManagementRouter.get("/", async (_req, res) => {
  try {
    const items = await db.select().from(menuItemV3).orderBy(desc(menuItemV3.createdAt));
    
    // Get recipe links for each item
    const itemsWithRecipes = await Promise.all(
      items.map(async (item) => {
        const links = await db
          .select({ recipeId: menuItemRecipe.recipeId })
          .from(menuItemRecipe)
          .where(eq(menuItemRecipe.menuItemId, item.id));
        
        const recipeIds = links.map(l => l.recipeId);
        
        // Get recipe names
        let recipes: { id: number; name: string }[] = [];
        if (recipeIds.length > 0) {
          const recipeData = await db
            .select({ id: recipe.id, name: recipe.name })
            .from(recipe);
          recipes = recipeData.filter(r => recipeIds.includes(r.id));
        }
        
        return { ...item, recipes };
      })
    );
    
    res.json({ ok: true, items: itemsWithRecipes });
  } catch (error: any) {
    console.error("Error listing menu items:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/menu-management - Create a new menu item
menuManagementRouter.post("/", async (req, res) => {
  try {
    const { name, category, price, description, recipeIds, imageUrl } = req.body;
    
    if (!name || !category || price == null) {
      return res.status(400).json({ ok: false, error: "name, category, and price are required" });
    }
    
    const [item] = await db
      .insert(menuItemV3)
      .values({
        name,
        category,
        price: String(price),
        description: description || null,
        imageUrl: imageUrl || null,
      })
      .returning();
    
    // Link recipes if provided
    if (recipeIds && Array.isArray(recipeIds)) {
      for (const recipeId of recipeIds) {
        await db.insert(menuItemRecipe).values({
          menuItemId: item.id,
          recipeId: Number(recipeId),
        });
      }
    }
    
    res.json({ ok: true, item });
  } catch (error: any) {
    console.error("Error creating menu item:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// PUT /api/menu-management/:id - Update a menu item
menuManagementRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, description, isActive, isOnlineEnabled, recipeIds, imageUrl } = req.body;
    
    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (price !== undefined) updates.price = String(price);
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;
    if (isOnlineEnabled !== undefined) updates.isOnlineEnabled = isOnlineEnabled;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    
    const [updated] = await db
      .update(menuItemV3)
      .set(updates)
      .where(eq(menuItemV3.id, id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ ok: false, error: "Menu item not found" });
    }
    
    // Update recipe links if provided
    if (recipeIds && Array.isArray(recipeIds)) {
      // Remove old links
      await db.delete(menuItemRecipe).where(eq(menuItemRecipe.menuItemId, id));
      
      // Add new links
      for (const recipeId of recipeIds) {
        await db.insert(menuItemRecipe).values({
          menuItemId: id,
          recipeId: Number(recipeId),
        });
      }
    }
    
    res.json({ ok: true, item: updated });
  } catch (error: any) {
    console.error("Error updating menu item:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// DELETE /api/menu-management/:id - Delete a menu item
menuManagementRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const [deleted] = await db
      .delete(menuItemV3)
      .where(eq(menuItemV3.id, id))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "Menu item not found" });
    }
    
    res.json({ ok: true });
  } catch (error: any) {
    console.error("Error deleting menu item:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/menu-management/:id/toggle-online - Toggle online availability
menuManagementRouter.post("/:id/toggle-online", async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    
    const [updated] = await db
      .update(menuItemV3)
      .set({ isOnlineEnabled: enabled, updatedAt: new Date() })
      .where(eq(menuItemV3.id, id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ ok: false, error: "Menu item not found" });
    }
    
    res.json({ ok: true, item: updated });
  } catch (error: any) {
    console.error("Error toggling online status:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/menu-management/upload-image - Upload menu item image
menuManagementRouter.post("/upload-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No image file provided" });
    }
    
    const imageUrl = `/menu/${req.file.filename}`;
    res.json({ ok: true, imageUrl });
  } catch (error: any) {
    console.error("Error uploading image:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});
