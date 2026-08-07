// Loyverse outbound order push is retired.
// Kept as a compatibility module so legacy imports continue to compile.

export async function buildLoyversePayload(_order: any) {
  throw new Error('Loyverse outbound order push is retired; use SBB POS ordering');
}

export async function sendToLoyverse(_order: any) {
  throw new Error('Loyverse outbound order push is retired; use SBB POS ordering');
}
