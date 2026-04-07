# Runtime Blind Spots

- Dynamic imports in services and route bootstrap are not fully represented by static import graphs.
- Scheduler/cron execution depends on process bootstrap and environment state.
- express.static-served pages may be used via direct URL without frontend link references.
- Background task side effects require runtime logs/DB evidence for full validation.
