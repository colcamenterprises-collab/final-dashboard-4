import { Router } from "express";
import { deactivateProduct, validateAndActivateProduct } from "../services/productActivation.service";

const router = Router();

router.post("/:productId/activate", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const result = await validateAndActivateProduct(productId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:productId/deactivate", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    await deactivateProduct(productId);
    res.json({ success: true, productId });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
