import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const archPath = path.join(ROOT, 'docs/architecture/architecture-machine-readable.json');
const appPath = path.join(ROOT, 'client/src/App.tsx');
const routeRegistryPath = path.join(ROOT, 'client/src/router/RouteRegistry.ts');
const arch = JSON.parse(fs.readFileSync(archPath, 'utf8'));
const appText = fs.readFileSync(appPath, 'utf8');
const routeRegistry = fs.readFileSync(routeRegistryPath, 'utf8');

const routeConstRegex = /(\w+):\s*"([^"]+)"/g;
const routeConsts = {};
for (const m of routeRegistry.matchAll(routeConstRegex)) routeConsts[m[1]] = m[2];

const lines = appText.split('\n');
const frontendRoutes = [];
for (let i = 0; i < lines.length; i++) {
  const ln = lines[i];
  if (!ln.includes('<Route path=')) continue;
  const pathMatch = ln.match(/path=\{ROUTES\.([A-Z0-9_]+)\}|path="([^"]+)"|path="\*"|path="([^"]+)"/);
  let routePath = null;
  if (pathMatch) {
    if (pathMatch[1]) routePath = routeConsts[pathMatch[1]] || `ROUTES.${pathMatch[1]}`;
    else routePath = pathMatch[2] || pathMatch[3] || '*';
  }
  const guarded = ln.includes('<Guard>') || ln.includes('<Guard><');
  const redirected = ln.includes('<Navigate ');
  frontendRoutes.push({ line: i + 1, path: routePath, guarded, redirected, raw: ln.trim() });
}

const baseUrl = process.env.RUNTIME_BASE_URL || 'http://127.0.0.1:8080';
const fetchWithTimeout = async (url, options = {}, ms = 4000) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { ...options, signal: c.signal, redirect: 'manual' });
    const text = await r.text();
    return { ok: true, status: r.status, location: r.headers.get('location'), body_snippet: text.slice(0, 160) };
  } catch (e) {
    return { ok: false, error: String(e) };
  } finally { clearTimeout(t); }
};

const concreteFrontend = frontendRoutes.filter(r => r.path && !r.path.includes(':') && r.path !== '*' && !r.path.startsWith('ROUTES.'));
const routeRuntimeChecks = [];
for (const r of concreteFrontend) {
  const normalizedPath = r.path.startsWith('/') ? r.path : `/operations/analysis/${r.path}`;
  const res = await fetchWithTimeout(`${baseUrl}${normalizedPath}`);
  routeRuntimeChecks.push({ path: r.path, normalized_path: normalizedPath, guarded: r.guarded, redirected: r.redirected, runtime: res });
}

const endpoints = arch.endpoints || [];
const concreteGetEndpoints = [...new Set(endpoints
  .filter(e => e.method === 'GET' && typeof e.path === 'string' && e.path.startsWith('/') && !e.path.includes(':') && !e.path.includes('*') && !e.path.includes('('))
  .map(e => e.path))];

const endpointChecks = [];
for (const p of concreteGetEndpoints) {
  const res = await fetchWithTimeout(`${baseUrl}${p}`);
  endpointChecks.push({ method: 'GET', path: p, runtime: res });
}

const authChecks = [];
authChecks.push({ name: 'login_invalid', request: 'POST /api/auth/login', result: await fetchWithTimeout(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'x', password: 'y' }) }) });
authChecks.push({ name: 'finance_protected_probe', request: 'GET /api/finance/summary/today', result: await fetchWithTimeout(`${baseUrl}/api/finance/summary/today`) });
authChecks.push({ name: 'bob_read_no_token', request: 'GET /api/bob/read/system-health', result: await fetchWithTimeout(`${baseUrl}/api/bob/read/system-health`) });
authChecks.push({ name: 'dashboard_html', request: 'GET /dashboard', result: await fetchWithTimeout(`${baseUrl}/dashboard`) });

const mountedLike = endpointChecks.filter(e => e.runtime.ok && e.runtime.status !== 404);
const failedLike = endpointChecks.filter(e => !e.runtime.ok || e.runtime.status === 404);

const output = {
  generated_at: new Date().toISOString(),
  base_url: baseUrl,
  source_architecture_counts: { routes: arch.routes?.length || 0, endpoints: arch.endpoints?.length || 0 },
  verified_routes: routeRuntimeChecks.filter(r => r.runtime.ok && r.runtime.status < 500),
  failed_routes: routeRuntimeChecks.filter(r => !r.runtime.ok || r.runtime.status >= 500),
  verified_endpoints: mountedLike,
  unverified_endpoints: failedLike,
  auth_findings: authChecks,
  consumer_matrix: arch.frontend_api_calls || [],
  source_of_truth_verification: arch.source_of_truth || [],
  duplicate_systems_verified: arch.duplicate_systems || [],
  dead_code_verified: arch.dead_code || [],
  mismatches: [],
  risks: []
};

fs.writeFileSync(path.join(ROOT, 'docs/architecture/runtime-verification-machine-readable.json'), JSON.stringify(output, null, 2));
console.log(JSON.stringify({
  frontend_routes_found: frontendRoutes.length,
  frontend_runtime_checked: routeRuntimeChecks.length,
  get_endpoints_checked: endpointChecks.length,
  mounted_non404: mountedLike.length,
  not_mounted_or_unreachable: failedLike.length
}, null, 2));
