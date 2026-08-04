import { randomUUID } from "crypto";
import { constants as fsConstants, promises as fs } from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";

const router = Router();
const menuUploadDir = path.resolve(process.cwd(), "uploads/menu-items");
const avatarUploadDir = path.resolve(process.cwd(), "uploads/staff-avatars");
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
 * Every managed menu image is normalised to an exact 600x600 WebP canvas.
 * `contain` preserves the complete product image without cropping; transparent
 * padding keeps PNG-style menu artwork consistent across POS, kiosk and web.
 */
router.post("/upload/menu-item-image", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image file provided" });

  const id = randomUUID();
  const filename = `${id}.webp`;
  const temporaryPath = path.join(menuUploadDir, `.${id}.tmp`);
  const finalPath = path.join(menuUploadDir, filename);

  try {
    await fs.mkdir(menuUploadDir, { recursive: true });
    await fs.access(menuUploadDir, fsConstants.W_OK);

    const info = await sharp(req.file.buffer, {
      failOn: "error",
      limitInputPixels: 40_000_000,
      sequentialRead: true,
    })
      .rotate()
      .resize({
        width: 600,
        height: 600,
        fit: "contain",
        position: "centre",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 90, alphaQuality: 100, effort: 4 })
      .toFile(temporaryPath);

    await fs.rename(temporaryPath, finalPath);
    const stored = await fs.stat(finalPath);
    if (!stored.isFile() || stored.size < 1) throw new Error("Stored image verification failed");
    if (info.width !== 600 || info.height !== 600) throw new Error("Menu image was not normalised to 600x600");

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

/**
 * POST /api/upload/staff-avatar
 * Staff profile photos are cropped to a consistent square portrait and stored
 * as WebP. The caller saves the returned imageUrl into internal_users.avatar_url.
 */
router.post("/upload/staff-avatar", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image file provided" });

  const id = randomUUID();
  const filename = `${id}.webp`;
  const temporaryPath = path.join(avatarUploadDir, `.${id}.tmp`);
  const finalPath = path.join(avatarUploadDir, filename);

  try {
    await fs.mkdir(avatarUploadDir, { recursive: true });
    await fs.access(avatarUploadDir, fsConstants.W_OK);

    const info = await sharp(req.file.buffer, {
      failOn: "error",
      limitInputPixels: 40_000_000,
      sequentialRead: true,
    })
      .rotate()
      .resize({
        width: 512,
        height: 512,
        fit: "cover",
        position: "attention",
      })
      .webp({ quality: 88, effort: 4 })
      .toFile(temporaryPath);

    await fs.rename(temporaryPath, finalPath);
    const stored = await fs.stat(finalPath);
    if (!stored.isFile() || stored.size < 1) throw new Error("Stored avatar verification failed");
    if (info.width !== 512 || info.height !== 512) throw new Error("Staff avatar was not normalised to 512x512");

    return res.json({
      success: true,
      imageUrl: `/uploads/staff-avatars/${filename}`,
      filename,
      size: stored.size,
      width: info.width,
      height: info.height,
      format: "webp",
    });
  } catch (error: any) {
    await Promise.allSettled([fs.unlink(temporaryPath), fs.unlink(finalPath)]);
    console.error("Error uploading staff avatar:", error);
    const unsupported = /unsupported image format|bad seek|heif|heic/i.test(String(error?.message || ""));
    return res.status(400).json({
      error: unsupported
        ? "This photo could not be decoded. Export it as JPG or PNG and try again."
        : error?.message || "Failed to upload staff photo",
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

    await fs.unlink(path.join(menuUploadDir, filename)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    return res.json({ success: true, message: "Image deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting menu item image:", error);
    return res.status(500).json({ error: error?.message || "Failed to delete image" });
  }
});

router.delete("/upload/staff-avatar", async (req, res) => {
  try {
    const imageUrl = String(req.body?.imageUrl || "");
    if (!imageUrl.startsWith("/uploads/staff-avatars/")) {
      return res.status(400).json({ error: "Invalid avatar URL" });
    }

    const filename = path.basename(imageUrl);
    if (!/^[0-9a-f-]+\.webp$/i.test(filename)) {
      return res.status(400).json({ error: "Only managed staff avatars can be deleted" });
    }

    await fs.unlink(path.join(avatarUploadDir, filename)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    return res.json({ success: true, message: "Staff photo deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting staff avatar:", error);
    return res.status(500).json({ error: error?.message || "Failed to delete staff photo" });
  }
});

router.use((error: any, _req: any, res: any, _next: any) => {
  const message = error?.code === "LIMIT_FILE_SIZE"
    ? "Image is larger than the 30MB upload limit"
    : error?.message || "Image upload failed";
  res.status(400).json({ error: message });
});

export default router;
