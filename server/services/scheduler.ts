// Live Loyverse ingestion is intentionally disabled.
// Historical Loyverse tables/import utilities remain in the repository for archive loading.
// SBB POS is the live source of truth for receipts, shifts and reporting.

export class SchedulerService {
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;
    console.log('[Scheduler] Live Loyverse ingestion disabled — SBB POS is source of truth');
  }

  stop() {
    this.started = false;
  }

  // Compatibility no-ops retained for any legacy admin callers.
  // They deliberately do not contact Loyverse.
  async startupCatchup() {
    return { disabled: true, source: 'sbb_pos_core' };
  }

  async triggerReceiptSync() {
    return { disabled: true, source: 'sbb_pos_core' };
  }

  async triggerShiftSync() {
    return { disabled: true, source: 'sbb_pos_core' };
  }

  async triggerAnalytics() {
    return null;
  }

  async triggerJussiSummary() {
    return null;
  }
}

export const schedulerService = new SchedulerService();
