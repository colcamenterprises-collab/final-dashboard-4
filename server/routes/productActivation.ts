import { Router } from "express";
import { validateAndActivateProduct } from "../services/productActivation.service";

const router = Router();

router.post("/:productId/activate", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId)) {
      return res.status(400).json({ ok: false, reasons: ["Invalid product ID"] });
    }
    const result = await validateAndActivateProduct(productId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, reasons: [error.message || "Activation failed"] });
  }
});

export default router;
