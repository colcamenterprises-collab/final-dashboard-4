// PATCH O14 Chunk 5 — Payment Provider Management Routes
import express from "express";
import { authGuard } from "../../middleware/authGuard";
import { roleGuard } from "../../middleware/roleGuard";
import { PaymentProviderService } from "../../services/payments/providerService";
import type { PaymentGateway } from "@prisma/client";

const router = express.Router();

// GET /api/payment-providers/list
router.get("/list", authGuard, roleGuard("settings"), async (req, res) => {
  try {
    const tenantId = (req as any).tenantId || "1";
    const providers = await PaymentProviderService.getProviders(tenantId);
    res.json({ success: true, providers });
  } catch (error: any) {
    console.error("[PaymentProviders] Error fetching providers:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/payment-providers/save
router.post("/save", authGuard, roleGuard("settings"), async (req, res) => {
  try {
    const tenantId = (req as any).tenantId || "1";
    const { provider, status, credentials } = req.body;

    if (!provider) {
      return res.status(400).json({ success: false, error: "Provider required" });
    }

    const saved = await PaymentProviderService.saveProvider(
      tenantId,
      provider as PaymentGateway,
      status ?? false,
      credentials
    );

    res.json({ success: true, provider: saved });
  } catch (error: any) {
    console.error("[PaymentProviders] Error saving provider:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
