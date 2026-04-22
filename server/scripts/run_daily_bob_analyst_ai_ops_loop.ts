import { runDailyBobAnalystAiOpsLoop } from "../services/dailyBobAnalystAiOpsLoop";

async function main() {
  const shiftDate = process.argv[2];
  if (!shiftDate || !/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) {
    console.error("Usage: tsx server/scripts/run_daily_bob_analyst_ai_ops_loop.ts YYYY-MM-DD");
    process.exit(1);
  }

  const result = await runDailyBobAnalystAiOpsLoop(shiftDate);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("daily_bob_analyst_ai_ops_loop_failed", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
