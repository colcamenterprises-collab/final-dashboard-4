# AI Ops Manual Test Checklist

| Step | Action | Expected Result |
|---|---|---|
| 1 | Create a chat thread in AI Ops Control. | New thread appears in thread list immediately. |
| 2 | Send a user message to Bob in the thread. | User message persists; Bob assistant response persists in same thread. |
| 3 | Refresh page and reopen thread. | Full message history loads from database. |
| 4 | Create a new issue in Issues Register. | Issue appears in list with initial status (`draft` or selected). |
| 5 | Generate and save a plan on the issue (`/plan`). | Issue transitions to `plan_pending` or `approval_requested` and activity entry is logged. |
| 6 | Request signoff by including approval note in plan flow. | Issue moves to `approval_requested` and approval request audit record exists. |
| 7 | Approve issue (`/approve`). | Only `approval_requested` issues can approve; status becomes `approved`; audit log records approver. |
| 8 | Assign issue (`/assign`). | Only approved issues can assign; status becomes `in_progress`; assignee stored. |
| 9 | Complete issue (`/complete`). | Only in-progress issues can complete; status becomes `needs_review`; completed fields set. |
| 10 | Verify and close issue (`/close`). | Only review-ready issues can close; status becomes `closed`; close actor and timestamp stored. |
| 11 | Create a new idea and convert to issue. | Idea status becomes `converted`; new issue created; both idea+issue activity logs reference conversion. |
| 12 | Check agent cards before heartbeat update. | Each agent status displays `offline` by default with offline indicator. |
