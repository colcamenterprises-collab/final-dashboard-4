import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const READINESS_ROOT = '/data/.openclaw/workspace/artifacts/readiness';
const ISSUES_ROOT = '/data/.openclaw/workspace/artifacts/issues';
const LOOKBACK_DAYS = 7;
const TZ = 'Asia/Bangkok';

const baseUrl = (process.env.BOB_BASE_URL || process.env.APP_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const bobToken = process.env.BOB_READONLY_TOKEN || '';

const defaultResult = {
  date: null,
  go: false,
  artifacts: {
    forms: null,
    receipts: null,
    usage: null,
    summary: null,
  },
  checksums: {
    forms: null,
    receipts: null,
    usage: null,
    summary: null,
  },
  issues: [],
  latestCalendarIssue: null,
};

function bkkDateOnly(input = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(input);
}

function shiftDateDaysAgo(daysAgo) {
  const now = new Date();
  const bkkNowText = now.toLocaleString('en-US', { timeZone: TZ });
  const bkkNow = new Date(bkkNowText);
  bkkNow.setDate(bkkNow.getDate() - daysAgo);
  return bkkDateOnly(bkkNow);
}

function isoStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function toJsonText(payload) {
  return JSON.stringify(payload, null, 2);
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function writeJsonFile(targetPath, payload) {
  const jsonText = toJsonText(payload);
  await fs.writeFile(targetPath, jsonText, 'utf8');
  return { path: targetPath, checksum: sha256(jsonText) };
}

async function writeIssueArtifact(issueId, payload) {
  await ensureDir(ISSUES_ROOT);
  const issuePath = path.join(ISSUES_ROOT, `${issueId}.json`);
  await fs.writeFile(issuePath, toJsonText(payload), 'utf8');
  return issuePath;
}

function endpoint(pathname, params) {
  const qs = new URLSearchParams(params).toString();
  return `${baseUrl}${pathname}${qs ? `?${qs}` : ''}`;
}

async function safeFetchJson(url) {
  const responseMeta = {
    ok: false,
    status: null,
    statusText: null,
    payload: null,
    error: null,
    url,
  };

  try {
    const headers = bobToken ? { Authorization: `Bearer ${bobToken}` } : {};
    const res = await fetch(url, { method: 'GET', headers });
    responseMeta.status = res.status;
    responseMeta.statusText = res.statusText;

    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch (e) {
      responseMeta.error = `JSON_PARSE_ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }

    responseMeta.payload = parsed;
    responseMeta.ok = res.ok;

    if (!res.ok && !responseMeta.error) {
      responseMeta.error = `HTTP_${res.status}`;
    }
  } catch (e) {
    responseMeta.error = e instanceof Error ? e.message : String(e);
  }

  return responseMeta;
}

function extractCount(payload, primaryPath) {
  let current = payload;
  for (const key of primaryPath) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      current = undefined;
      break;
    }
  }
  if (typeof current === 'number') return current;
  if (Array.isArray(current)) return current.length;
  return 0;
}

function receiptsCount(payload) {
  const checks = [
    ['data', 'summary', 'rows'],
    ['data', 'rows'],
    ['data', 'count'],
    ['count'],
  ];
  for (const p of checks) {
    const v = extractCount(payload, p);
    if (v > 0) return v;
  }

  const lines = payload?.data?.lines ?? payload?.data?.items ?? payload?.lines;
  if (Array.isArray(lines)) return lines.length;

  return 0;
}

function formsCount(payload) {
  const checks = [
    ['data', 'count'],
    ['data', 'rows'],
    ['count'],
    ['rows'],
  ];
  for (const p of checks) {
    const v = extractCount(payload, p);
    if (v > 0) return v;
  }
  return 0;
}

function usageBuilt(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload?.data?.not_built === true) return false;
  if (Array.isArray(payload?.blockers) && payload.blockers.length > 0) return false;
  if (Array.isArray(payload?.data?.rows) && payload.data.rows.length > 0) return true;
  if (typeof payload?.data?.summary === 'object' && payload.data.summary) return true;
  if (payload?.status === 'ok') return true;
  return false;
}

function issue(code, message, extra = {}) {
  return {
    code,
    message,
    where: extra.where || 'daily_readiness_check',
    canonical_source: extra.canonical_source || 'api/bob/read',
    auto_build_attempted: false,
    ...extra,
  };
}

async function main() {
  const result = { ...defaultResult, artifacts: { ...defaultResult.artifacts }, checksums: { ...defaultResult.checksums }, issues: [] };
  const stamp = isoStamp();

  try {
    await ensureDir(READINESS_ROOT);
    await ensureDir(ISSUES_ROOT);
  } catch (e) {
    result.issues.push(issue('ARTIFACT_ROOT_UNAVAILABLE', 'Unable to create artifact root directories', { detail: String(e) }));
  }

  const latestCalendarDate = shiftDateDaysAgo(1);
  let latestFormsPayload = null;
  let latestUsagePayload = null;

  try {
    const latestFormsRes = await safeFetchJson(endpoint('/api/bob/read/forms/daily-stock', { date: latestCalendarDate }));
    latestFormsPayload = latestFormsRes.payload;
    const latestUsageRes = await safeFetchJson(endpoint('/api/bob/read/analysis/stock-usage', { date: latestCalendarDate }));
    latestUsagePayload = latestUsageRes.payload;

    const hasLatestForms = latestFormsRes.ok && formsCount(latestFormsPayload) > 0;
    const hasLatestUsage = latestUsageRes.ok && usageBuilt(latestUsagePayload);

    if (!hasLatestForms || !hasLatestUsage) {
      const latestIssue = {
        issue_id: `latest-calendar-${latestCalendarDate}`,
        created_at: new Date().toISOString(),
        scope_date: latestCalendarDate,
        summary: 'Latest calendar shift missing required readiness inputs',
        missing: {
          forms: !hasLatestForms,
          usage: !hasLatestUsage,
        },
        diagnostics: {
          forms_status: latestFormsRes.status,
          usage_status: latestUsageRes.status,
          forms_error: latestFormsRes.error,
          usage_error: latestUsageRes.error,
        },
      };

      const issuePath = await writeIssueArtifact(latestIssue.issue_id, latestIssue);
      result.latestCalendarIssue = issuePath;
      result.issues.push(issue('LATEST_CALENDAR_BLOCKED', latestIssue.summary, {
        where: `date:${latestCalendarDate}`,
        canonical_source: 'daily_stock_v2 + receipt_truth_daily_usage',
        issue_id: latestIssue.issue_id,
        issue_path: issuePath,
      }));
    }
  } catch (e) {
    result.issues.push(issue('LATEST_CALENDAR_CHECK_FAILED', 'Latest calendar readiness check failed', { detail: String(e) }));
  }

  let chosenDate = null;
  let chosenFormsPayload = null;
  let chosenReceiptsPayload = null;
  let chosenUsagePayload = null;
  let chosenFormsCount = 0;
  let chosenReceiptsCount = 0;
  let chosenUsageBuilt = false;

  for (let day = 1; day <= LOOKBACK_DAYS; day += 1) {
    const date = shiftDateDaysAgo(day);

    const formsRes = await safeFetchJson(endpoint('/api/bob/read/forms/daily-stock', { date }));

    const receiptsResFromTo = await safeFetchJson(endpoint('/api/bob/read/receipts/truth', { from: date, to: date }));
    const receiptsRes = receiptsResFromTo.ok
      ? receiptsResFromTo
      : await safeFetchJson(endpoint('/api/bob/read/receipts/truth', { date }));

    const usageRes = await safeFetchJson(endpoint('/api/bob/read/analysis/stock-usage', { date }));

    const fCount = formsRes.ok ? formsCount(formsRes.payload) : 0;
    const rCount = receiptsRes.ok ? receiptsCount(receiptsRes.payload) : 0;

    if (formsRes.error) {
      result.issues.push(issue('FORMS_FETCH_FAILED', `forms/daily-stock fetch failed for ${date}`, {
        where: `date:${date}`,
        detail: formsRes.error,
      }));
    }

    if (receiptsRes.error) {
      result.issues.push(issue('RECEIPTS_FETCH_FAILED', `receipts/truth fetch failed for ${date}`, {
        where: `date:${date}`,
        detail: receiptsRes.error,
      }));
    }

    if (usageRes.error) {
      result.issues.push(issue('USAGE_FETCH_FAILED', `analysis/stock-usage fetch failed for ${date}`, {
        where: `date:${date}`,
        detail: usageRes.error,
      }));
    }

    if (fCount > 0 && rCount > 0) {
      chosenDate = date;
      chosenFormsPayload = formsRes.payload;
      chosenReceiptsPayload = receiptsRes.payload;
      chosenUsagePayload = usageRes.payload;
      chosenFormsCount = fCount;
      chosenReceiptsCount = rCount;
      chosenUsageBuilt = usageRes.ok && usageBuilt(usageRes.payload);
      break;
    }
  }

  result.date = chosenDate;

  if (!chosenDate) {
    const issueId = `latest-completed-shift-not-found-${bkkDateOnly()}`;
    const blocker = {
      issue_id: issueId,
      created_at: new Date().toISOString(),
      summary: 'No completed shift found in last 7 days with forms and receipts present',
      lookback_days: LOOKBACK_DAYS,
      criteria: {
        forms_daily_stock_count_gt_0: true,
        receipts_truth_count_gt_0: true,
      },
    };

    try {
      const issuePath = await writeIssueArtifact(issueId, blocker);
      result.latestCalendarIssue = result.latestCalendarIssue || issuePath;
      result.issues.push(issue('LATEST_COMPLETED_SHIFT_NOT_FOUND', blocker.summary, {
        where: `lookback:${LOOKBACK_DAYS}d`,
        canonical_source: 'daily_stock_v2 + receipt_truth_line',
        issue_id: issueId,
        issue_path: issuePath,
      }));
    } catch (e) {
      result.issues.push(issue('ISSUE_ARTIFACT_WRITE_FAILED', 'Failed to write latest completed shift issue artifact', { detail: String(e) }));
    }

    console.log(toJsonText(result));
    return;
  }

  const runDir = path.join(READINESS_ROOT, `${chosenDate}-${stamp}`);
  try {
    await ensureDir(runDir);

    const formsWrite = await writeJsonFile(path.join(runDir, 'forms-daily-stock.json'), chosenFormsPayload ?? { note: 'payload unavailable' });
    result.artifacts.forms = formsWrite.path;
    result.checksums.forms = formsWrite.checksum;

    const receiptsWrite = await writeJsonFile(path.join(runDir, 'receipts-truth.json'), chosenReceiptsPayload ?? { note: 'payload unavailable' });
    result.artifacts.receipts = receiptsWrite.path;
    result.checksums.receipts = receiptsWrite.checksum;

    const usageWrite = await writeJsonFile(path.join(runDir, 'analysis-stock-usage.json'), chosenUsagePayload ?? { note: 'payload unavailable' });
    result.artifacts.usage = usageWrite.path;
    result.checksums.usage = usageWrite.checksum;

    const summaryPayload = {
      chosenShiftDate: chosenDate,
      go: chosenFormsCount > 0 && chosenReceiptsCount > 0 && chosenUsageBuilt,
      formsCount: chosenFormsCount,
      receiptsCount: chosenReceiptsCount,
      usageBuilt: chosenUsageBuilt,
      artifacts: result.artifacts,
      issues: result.issues.map((x) => ({ code: x.code, summary: x.message, issue_id: x.issue_id ?? null })),
      generatedAt: new Date().toISOString(),
      runner: 'server/scripts/daily_readiness_check.js',
      readOnly: true,
    };

    const summaryWrite = await writeJsonFile(path.join(runDir, 'summary.json'), summaryPayload);
    result.artifacts.summary = summaryWrite.path;
    result.checksums.summary = summaryWrite.checksum;
    result.go = summaryPayload.go;
  } catch (e) {
    result.issues.push(issue('READINESS_ARTIFACT_WRITE_FAILED', 'Failed writing readiness artifact files', { detail: String(e), where: runDir }));
    result.go = false;
  }

  console.log(toJsonText(result));
}

main().catch((error) => {
  const fallback = {
    ...defaultResult,
    issues: [
      issue('UNHANDLED_ERROR', 'Unhandled exception in daily readiness check', { detail: error instanceof Error ? error.message : String(error) }),
    ],
  };
  console.log(toJsonText(fallback));
  process.exitCode = 1;
});
