import { Router } from "express";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";

const router = Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = path.resolve(process.cwd(), "uploads/menu-items");
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (_req, file, cb) => {
    // Generate unique filename: timestamp-originalname
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, basename + "-" + uniqueSuffix + ext);
  },
});

// File filter - only allow images
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

/**
 * POST /api/upload/menu-item-image
 * Upload a menu item image
 * Returns the URL path to access the uploaded image
 */
router.post("/upload/menu-item-image", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    // Return the URL path to access the image
    const imageUrl = `/uploads/menu-items/${req.file.filename}`;
    
    res.json({
      success: true,
      imageUrl,
      filename: req.file.filename,
      size: req.file.size,
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

/**
 * DELETE /api/upload/menu-item-image
 * Delete a menu item image
 * Body: { imageUrl: string }
 */
router.delete("/upload/menu-item-image", async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl || !imageUrl.startsWith("/uploads/menu-items/")) {
      return res.status(400).json({ error: "Invalid image URL" });
    }

    const filename = path.basename(imageUrl);
    const filePath = path.resolve(process.cwd(), "uploads/menu-items", filename);

    try {
      await fs.unlink(filePath);
      res.json({ success: true, message: "Image deleted successfully" });
    } catch (error) {
      // File might not exist, which is fine
      res.json({ success: true, message: "Image already deleted or not found" });
    }
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

export default router;
