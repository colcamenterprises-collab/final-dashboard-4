// PATCH O4 — QR CODE GENERATION API
// PATCH O5 — EMBED ORDER REFERENCE FOR SCB MATCHING
import { Router } from "express";
import QRCode from "qrcode";

const router = Router();

// Generate PromptPay QR
router.get("/generate", async (req, res) => {
  const { amount, ref } = req.query;
  const orderRef = ref || "";

  const qrText = `00020101021129370016A0000006770101110213${process.env.PROMPTPAY_ID}5303764540${amount}5802TH6207${orderRef}6304`;

  const qrImage = await QRCode.toDataURL(qrText);
  res.json({ qrImage });
});

export default router;
