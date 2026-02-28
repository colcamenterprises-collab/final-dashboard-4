# System Architecture (Bob Context)

- Canonical sources are immutable and never overwritten.
- AI Ops adds orchestration metadata (tasks, messages, reviews, activity, agent state) without altering canonical ingestion.
- All workflow writes are audit-logged to support deterministic reconstruction of operational decisions.
