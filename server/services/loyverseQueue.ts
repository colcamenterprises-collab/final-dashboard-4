// Loyverse outbound queue intentionally disabled.
// SBB POS is the live source of truth and no production order is pushed to Loyverse.

export async function processLoyverseQueue() {
  return { disabled: true, source: "sbb_pos_core" };
}
