export function assertProductionWriteAllowed(area: string) {
  if (process.env.PRODUCTION_LOCK === '1') {
    throw new Error(
      `🚫 WRITE BLOCKED: ${area} is locked in production mode`,
    );
  }
}
