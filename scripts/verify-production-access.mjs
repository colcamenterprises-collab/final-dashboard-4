const baseUrl = (process.env.DASHBOARD_BASE_URL || "http://127.0.0.1:8081").replace(/\/$/, "");
const username = process.env.DASHBOARD_OWNER_USERNAME;
const password = process.env.DASHBOARD_OWNER_PASSWORD;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(response) {
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { throw new Error(`${response.status} returned non-JSON: ${text.slice(0, 120)}`); }
}

assert(username, "DASHBOARD_OWNER_USERNAME is required");
assert(password, "DASHBOARD_OWNER_PASSWORD is required");

const statusResponse = await fetch(`${baseUrl}/api/pin-auth/status`);
const status = await json(statusResponse);
assert(statusResponse.ok && status.ok && status.activeOwners >= 1, "Staff access readiness check failed");

const unauthenticatedReport = await fetch(`${baseUrl}/api/reports/historical-loyverse?report=payment-types`);
assert(unauthenticatedReport.status === 401, `Protected reporting endpoint returned ${unauthenticatedReport.status} without login`);

const loginResponse = await fetch(`${baseUrl}/api/pin-auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, pin: password }),
});
const login = await json(loginResponse);
assert(loginResponse.ok && login.authenticated && login.user?.role === "owner", "Owner login failed");

const setCookie = loginResponse.headers.get("set-cookie") || "";
const cookie = setCookie.split(";")[0];
assert(cookie.startsWith("sbb_pin_session="), "Login did not issue the signed staff session cookie");
const authenticatedHeaders = { Cookie: cookie };

const meResponse = await fetch(`${baseUrl}/api/pin-auth/me`, { headers: authenticatedHeaders });
const me = await json(meResponse);
assert(meResponse.ok && me.authenticated && me.user?.role === "owner", "Signed owner session was not accepted");

const staffResponse = await fetch(`${baseUrl}/api/pin-auth/staff`, { headers: authenticatedHeaders });
const staff = await json(staffResponse);
assert(staffResponse.ok && Array.isArray(staff.users), "Owner could not load Staff Access");

const reportResponse = await fetch(`${baseUrl}/api/reports/historical-loyverse?report=payment-types`, { headers: authenticatedHeaders });
assert(reportResponse.ok, `Owner reporting request returned ${reportResponse.status}`);

const logoutResponse = await fetch(`${baseUrl}/api/pin-auth/logout`, { method: "POST", headers: authenticatedHeaders });
assert(logoutResponse.ok, "Logout failed");

console.log("PASS: owner login, signed session, Staff Access, protected reports, unauthenticated rejection, and logout");
