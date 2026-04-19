# Route Ownership — Current State (Final Sweep)

## Backend route truth sources
1. `server/index.ts` initializes middleware and mounts primary routers.
2. `server/routes.ts` registers a large inline + modular API surface.
3. `server/api/*` and `server/routes/*` provide module-level endpoint families.

## Frontend route truth sources
1. `client/src/router/RouteRegistry.ts` = canonical route constants.
2. `client/src/App.tsx` = concrete React Router path/component wiring and redirect behavior.

## Protected ownership zones
- Bob read: `server/routes/bobRead.ts` mounted at `/api/bob/read`.
- Agent governed read: `server/routes/agentRead.ts` + `server/middleware/agentAuth.ts` mounted under `/api/agent/read`.
- AI/Ops control: `server/routes/aiOpsControl.ts` mounted at `/api/ops/ai` and `/api/ai-ops`.
- Forms source surfaces include `server/api/forms.ts`, `server/forms/dailySalesV2.ts`, and mounted `/api/forms` handlers.

## Known ownership ambiguity zones
- Shopping list family modules and inline handlers.
- Analysis family modules plus inline `/api/analysis/*` handlers.
- Product/menu/order multi-generation routes.
- Finance/expenses v1/v2 and import route overlap.
