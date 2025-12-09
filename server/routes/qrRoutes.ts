// PATCH O4 — QR CODE GENERATION API
import { Router } from "express";
import QRCode from "qrcode";

const router = Router();

// Generate PromptPay QR
router.get("/generate", async (req, res) => {
  const { amount } = req.query;

  const qrText = `00020101021129370016A0000006770101110213${process.env.PROMPTPAY_ID}5303764540${amount}5802TH6304`;

  const qrImage = await QRCode.toDataURL(qrText);
  res.json({ qrImage });
});

export default router;
