# Runtime Blind Spots

- Auth and token enforcement cannot be proven for every route by static scan alone; runtime integration tests required.
- Some dynamic imports are conditional and feature-flagged; static extraction may over-report potential surfaces.
- Websocket/event-stream behavior in AI-Ops routes requires live environment verification for full path coverage.
- Archive and attached assets intentionally excluded from runtime-critical inventories to reduce false positives.