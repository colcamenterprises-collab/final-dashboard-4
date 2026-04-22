import { classifyLedgerIssue, deriveIssueOutcome } from "../services/stockLodgementRefresh.js";

function runProof() {
  const beforeRolls = {
    status: "PENDING",
    rolls_purchased: 0,
    actual_rolls_end: 122,
    estimated_rolls_end: 106,
    variance: 16,
  };

  const afterRolls = {
    status: "OK",
    rolls_purchased: 24,
    actual_rolls_end: 122,
    estimated_rolls_end: 122,
    variance: 0,
  };

  const beforeIssue = classifyLedgerIssue("rolls", beforeRolls);
  const afterIssue = classifyLedgerIssue("rolls", afterRolls);
  const outcome = deriveIssueOutcome(beforeIssue.code, afterIssue.code);

  console.log(JSON.stringify({
    ok: true,
    scenario: "manual-rolls-lodgement-correction",
    before: {
      ledger: beforeRolls,
      issue: beforeIssue,
    },
    after: {
      ledger: afterRolls,
      issue: afterIssue,
    },
    outcome,
  }, null, 2));
}

runProof();
