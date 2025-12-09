// PATCH O6 — SCB DYNAMIC QR SERVICE (BACKEND ONLY, SAFE MODE)
import axios from "axios";
import { SCB_MODE, SCB_CONFIG } from "../config/scbConfig";
import { requestSCBToken } from "./scbClient";

export async function generateDynamicQR(amount: number, orderRef: string) {
  // DRY MODE — no bank calls, safe dummy QR
  if (SCB_MODE === "dry") {
    return {
      qrImage: "FAKE_QR_IMAGE_DATA_URL",
      qrRaw: "000201FAKEQR" + orderRef,
      ref: orderRef,
      expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
      mode: "dry",
    };
  }

  const token = await requestSCBToken();

  if (SCB_MODE === "sandbox") {
    // Sandbox QR endpoint (realistic but safe)
    const res = await axios.post(
      "https://api-sandbox.partners.scb/partners/sandbox/v1/payment/qrcode/create",
      {
        qrType: "PP",
        ppType: "BILLERID",
        ppId: SCB_CONFIG.billerId,
        amount: String(amount),
        ref1: orderRef,
        ref2: "",
        ref3: "",
      },
      {
        headers: {
          Authorization: `Bearer ${token?.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return { ...res.data, mode: "sandbox" };
  }

  if (SCB_MODE === "live") {
    // NOT ENABLED — requires explicit approval
    throw new Error("LIVE MODE IS DISABLED. Explicit approval required.");
  }
}
