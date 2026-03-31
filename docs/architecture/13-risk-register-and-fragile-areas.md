# Risk Register and Fragile Areas

| Severity | Area | Evidence |
|---|---|---|
| High | Endpoint sprawl/duplication | 665 endpoint declarations; duplicate method+path signatures exist. |
| High | Auth enforcement inconsistency | Frontend Guard is path-allowlist only; auth middleware not globally applied. |
| High | Multi-authority domain overlap | Menu/products/expenses/analysis have multiple overlapping route groups. |
| Medium | Legacy page accumulation | 69 page files not imported by primary route tree. |
| Medium | Scheduler complexity | Many startup cron/timer jobs in `server/index.ts` deferred block. |
