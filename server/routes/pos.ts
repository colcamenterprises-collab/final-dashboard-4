import { Router } from "express";
import grabOrdersRouter from "./posGrabOrders";
import provisioningRouter, { deviceCredentialBridge } from "./posProvisioning";
import legacyPosRouter from "../../legacy/server/routes/posLegacy";

/**
 * POS route composition after the dedicated device split.
 *
 * Provisioning is handled first so new devices can claim a unique server-issued
 * credential. The compatibility bridge then translates validated per-device
 * credentials into the legacy shared backend token while checkout/shift routes
 * are migrated incrementally without breaking production.
 */
const router = Router();
router.use(provisioningRouter);
router.use(deviceCredentialBridge);
router.use(grabOrdersRouter);
router.use(legacyPosRouter);

export default router;
