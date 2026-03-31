# File and Folder Responsibility Map

- `client/src`: active React application runtime.
- `server`: active Express runtime, middleware, routes, services, jobs.
- `shared`: Drizzle schema/shared types.
- `prisma`: Prisma schema and migrations.
- `docs/architecture`: generated architecture package.
- `online-ordering`: separate ordering client/server package; served from `/online-ordering` when built.
- `archive`, `backups`, `extracted_dashboard`, `focused-export`, `loyverse-ai-package`, `loyverse-ai-updated-package`: legacy/auxiliary trees; not entrypoint targets in `package.json` runtime scripts.
