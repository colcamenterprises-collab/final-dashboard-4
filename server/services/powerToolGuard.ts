export interface GuardResult {
  allowed: boolean;
  reason?: string;
}

export function checkPowerToolAccess(confirm?: boolean): GuardResult {
  const enabled = process.env.ENABLE_DANGEROUS_TOOLS === "true";

  if (!enabled) {
    console.warn("[PowerToolGuard] Blocked: ENABLE_DANGEROUS_TOOLS not set");
    return {
      allowed: false,
      reason: "Dangerous tools disabled. Set ENABLE_DANGEROUS_TOOLS=true to enable.",
    };
  }

  if (!confirm) {
    console.warn("[PowerToolGuard] Blocked: Missing explicit confirmation");
    return {
      allowed: false,
      reason: "Explicit confirmation required. Pass confirm=true parameter.",
    };
  }

  return { allowed: true };
}

export function logPowerToolAttempt(tool: string, allowed: boolean, user?: string) {
  const timestamp = new Date().toISOString();
  const status = allowed ? "ALLOWED" : "BLOCKED";
  console.log(`[PowerToolGuard] ${timestamp} | ${tool} | ${status} | user=${user || "system"}`);
}

export const powerToolGuard = {
  checkPowerToolAccess,
  logPowerToolAttempt,
};
