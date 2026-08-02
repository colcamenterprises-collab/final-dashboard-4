import { randomUUID } from "crypto";
import { constants as fsConstants, promises as fs } from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";

const router = Router();
const uploadDir = path.resolve(process.cwd(), "uploads/menu-items");
const acceptedExtensions = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".heic", ".heif", ".tif", ".tiff",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const imageMime = /^image\//i.test(file.mimetype || "");
    const genericMime = file.mimetype === "application/octet-stream";
    if (imageMime || (genericMime && acceptedExtensions.has(extension))) return cb(null, true);
    cb(new Error("Choose a JPG, PNG, WebP, GIF, AVIF, HEIC or TIFF image"));
  },
  limits: { fileSize: 30 * 1024 * 1024, files: 1 },
});

/**
 * POST /api/upload/menu-item-image
 * Normalises phone and design-export image formats into one browser-safe WebP.
 * The write is atomic, and a successful response is returned only after the stored
 * file has been read back from disk.
 */
router.post("/upload/menu-item-image", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image file provided" });

  const id = randomUUID();
  const filename = `${id}.webp`;
  const temporaryPath = path.join(uploadDir, `.${id}.tmp`);
  const finalPath = path.join(uploadDir, filename);

  try {
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.access(uploadDir, fsConstants.W_OK);

    const info = await sharp(req.file.buffer, {
      failOn: "error",
      limitInputPixels: 40_000_000,
      sequentialRead: true,
    })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90, alphaQuality: 100, effort: 4 })
      .toFile(temporaryPath);

    await fs.rename(temporaryPath, finalPath);
    const stored = await fs.stat(finalPath);
    if (!stored.isFile() || stored.size < 1) throw new Error("Stored image verification failed");

    return res.json({
      success: true,
      imageUrl: `/uploads/menu-items/${filename}`,
      filename,
      size: stored.size,
      width: info.width,
      height: info.height,
      format: "webp",
    });
  } catch (error: any) {
    await Promise.allSettled([fs.unlink(temporaryPath), fs.unlink(finalPath)]);
    console.error("Error uploading menu item image:", error);
    const unsupported = /unsupported image format|bad seek|heif|heic/i.test(String(error?.message || ""));
    return res.status(400).json({
      error: unsupported
        ? "This image could not be decoded. Export it as JPG or PNG and try again."
        : error?.message || "Failed to upload image",
    });
  }
});

router.delete("/upload/menu-item-image", async (req, res) => {
  try {
    const imageUrl = String(req.body?.imageUrl || "");
    if (!imageUrl.startsWith("/uploads/menu-items/")) {
      return res.status(400).json({ error: "Invalid image URL" });
    }

    const filename = path.basename(imageUrl);
    if (!/^[0-9a-f-]+\.webp$/i.test(filename)) {
      return res.status(400).json({ error: "Only managed menu item images can be deleted" });
    }

    await fs.unlink(path.join(uploadDir, filename)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    return res.json({ success: true, message: "Image deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting menu item image:", error);
    return res.status(500).json({ error: error?.message || "Failed to delete image" });
  }
});

router.use((error: any, _req: any, res: any, _next: any) => {
  const message = error?.code === "LIMIT_FILE_SIZE"
    ? "Image is larger than the 30MB upload limit"
    : error?.message || "Image upload failed";
  res.status(400).json({ error: message });
});

export default router;
