// PATCH O6 — SCB CLIENT (SAFE MODE)
// This file NEVER performs real network calls in DRY mode.

import axios from "axios";
import { SCB_MODE, SCB_CONFIG } from "../config/scbConfig";

export async function requestSCBToken() {
  if (SCB_MODE === "dry") {
    return { access_token: "dry-token", expires_in: 3600 };
  }

  if (SCB_MODE === "sandbox") {
    // sandbox endpoint
    const res = await axios.post(
      "https://api-sandbox.partners.scb/partners/sandbox/v1/oauth/token",
      {
        applicationKey: SCB_CONFIG.clientId,
        applicationSecret: SCB_CONFIG.clientSecret,
      }
    );

    return res.data;
  }

  if (SCB_MODE === "live") {
    // live endpoint - NOT ENABLED WITHOUT YOUR APPROVAL
    const res = await axios.post(
      "https://api.partners.scb/partners/v1/oauth/token",
      {
        applicationKey: SCB_CONFIG.clientId,
        applicationSecret: SCB_CONFIG.clientSecret,
      }
    );

    return res.data;
  }
}
