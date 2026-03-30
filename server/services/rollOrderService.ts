import { pool } from "../db";

export type RollOrderStatus = "CALCULATED" | "APPROVED" | "OVERRIDDEN" | "SENT" | "FAILED";

export function computeRecommendedOrder(targetRolls: number, closingRolls: number, increment: number): number {
  const base = Math.max(0, Number(targetRolls || 0) - Number(closingRolls || 0));
  const inc = Number(increment || 0);
  if (!Number.isFinite(inc) || inc <= 1) return base;
  return Math.ceil(base / inc) * inc;
}

export function resolveRollOrderConfig() {
  return {
    targetRolls: Number(process.env.ROLL_ORDER_TARGET_NEXT_SHIFT ?? 140),
    increment: Number(process.env.ROLL_ORDER_BAKERY_INCREMENT ?? 1),
    lineTargetId: (process.env.LINE_BAKERY_TARGET_ID || "").trim(),
    lineChannelAccessToken: (process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim(),
  };
}

export async function ensureRollOrderTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roll_order (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shift_date DATE NOT NULL,
      closing_rolls INTEGER NOT NULL,
      target_rolls INTEGER NOT NULL,
      recommended_qty INTEGER NOT NULL,
      approved_qty INTEGER NOT NULL,
      was_overridden BOOLEAN NOT NULL DEFAULT FALSE,
      override_reason TEXT,
      status TEXT NOT NULL CHECK (status IN ('CALCULATED','APPROVED','OVERRIDDEN','SENT','FAILED')),
      recipient_id TEXT,
      line_target_id TEXT,
      line_message_payload JSONB,
      line_send_response JSONB,
      line_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_roll_order_shift_date ON roll_order (shift_date);
  `);
}

export async function sendLineBakeryOrder(args: {
  shiftDate: string;
  closingRolls: number;
  targetRolls: number;
  recommendedQty: number;
  approvedQty: number;
  wasOverridden: boolean;
  overrideReason: string | null;
}) {
  const cfg = resolveRollOrderConfig();
  if (!cfg.lineTargetId || !cfg.lineChannelAccessToken) {
    return {
      ok: false,
      error: "LINE not configured: LINE_BAKERY_TARGET_ID and/or LINE_CHANNEL_ACCESS_TOKEN missing",
      payload: null,
      response: null,
      targetId: cfg.lineTargetId || null,
    };
  }

  const lines = [
    `Bakery Roll Order - ${args.shiftDate}`,
    `Closing rolls: ${args.closingRolls}`,
    `Target next shift: ${args.targetRolls}`,
    `Recommended qty: ${args.recommendedQty}`,
    `Approved qty: ${args.approvedQty}`,
    `Override: ${args.wasOverridden ? "YES" : "NO"}`,
    args.wasOverridden ? `Override reason: ${args.overrideReason || "(none)"}` : null,
  ].filter(Boolean) as string[];

  const payload = {
    to: cfg.lineTargetId,
    messages: [{ type: "text", text: lines.join("\n") }],
  };

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.lineChannelAccessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }

    if (!response.ok) {
      return {
        ok: false,
        error: `LINE push failed (${response.status})`,
        payload,
        response: { status: response.status, body: json },
        targetId: cfg.lineTargetId,
      };
    }

    return {
      ok: true,
      error: null,
      payload,
      response: { status: response.status, body: json },
      targetId: cfg.lineTargetId,
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || "LINE push request failed",
      payload,
      response: null,
      targetId: cfg.lineTargetId,
    };
  }
}
