# Smash Brothers Burgers Public Website

This folder is the standalone public customer website for `www.smashbrosburgers.com`.
It is intentionally separate from the staff/admin dashboard in `client/`, which remains the app for `app.smashbrosburgers.com`.

## Separation confirmation

| Check | Expected result |
| --- | --- |
| `website/` frontend | Contains only the public customer website source, assets, and Vite config. |
| `client/` frontend | Remains the staff/admin dashboard. Public marketing routes are not imported into the admin router. |
| Staff login | Public website Staff Login links to `https://app.smashbrosburgers.com`. |
| Admin root `/` | The staff/admin app root is protected by the PIN/session gate and redirects authenticated users to `/dashboard`. |

## Build commands

From the repository root:

```bash
npm run build
```

Builds the existing staff/admin app and server bundle.

```bash
npm run build:website
```

Builds only the public website app under `website/`.

## Local preview commands

From the repository root, build and preview the public website:

```bash
npm run build:website
npm run preview:website
```

Then open:

```text
http://localhost:4173
```

For active development with hot reload:

```bash
npm run dev:website
```

Then open:

```text
http://localhost:5174
```

## Staging preview command

On a staging host or Replit shell, run:

```bash
npm run build:website
npm run preview:website
```

Expose or map port `4173` through the staging environment and visually review the public website at that environment's preview URL.

## Deployment boundary

- Deploy `website/dist` to `www.smashbrosburgers.com`.
- Deploy the existing admin build output for `client/` and `server/` to `app.smashbrosburgers.com`.
- Do not copy `website/` pages into `client/`.
- Do not copy staff/admin pages, finance pages, operations pages, purchasing pages, admin settings, or internal reporting pages into `website/`.
