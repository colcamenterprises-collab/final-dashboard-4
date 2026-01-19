import { Router } from "express";
import { activateProduct, deactivateProduct } from "../services/productActivation.service";

const router = Router();

router.post("/:productId/activate", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const result = await activateProduct(productId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:productId/deactivate", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const result = await deactivateProduct(productId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
