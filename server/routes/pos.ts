import { Router } from "express";
import grabOrdersRouter from "./posGrabOrders";
import legacyPosRouter from "../../legacy/server/routes/posLegacy";

/**
 * POS route composition after the dedicated device split.
 *
 * Grab checkout is handled first so its privacy and exact-promotion contract is
 * authoritative. Every other POS endpoint, including direct counter checkout,
 * continues through the previously proven POS router unchanged.
 */
const router = Router();
router.use(grabOrdersRouter);
router.use(legacyPosRouter);

export default router;
