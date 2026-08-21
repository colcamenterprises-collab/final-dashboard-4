import { Router, type NextFunction, type Request, type Response } from "express";
import { attachOwnerSessionUser, requireSessionAuth } from "../middleware/sessionAuth";
import {
  createOrFindMember,
  createPartnerVenue,
  getPartnerVenueQr,
  listMembers,
  listPartnerVenues,
  lookupMember,
  resolveMemberQr,
  resolvePartnerQr,
  updatePartnerVenue,
} from "../services/ordering/commercialService";
import {
  commercialOverview,
  detailedPartnerVenueReport,
  getMemberProfile,
  listCustomerDirectory,
} from "../services/ordering/commercialReportingService";

const router = Router();

export function requireCommercialAdmin(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "production") return next();

  // Prefer any current owner credential (UI owner cookie, owner PIN, owner JWT)
  // so a stale non-owner JWT cannot override a newer owner login.
  if (attachOwnerSessionUser(req)) return next();

  // Distinguish a real non-owner login (403) from no valid login at all (401).
  return requireSessionAuth(req, res, () => {
    return res.status(403).json({ ok: false, error: "OWNER_ACCESS_REQUIRED" });
  });
}

function baseUrl(req: Request) {
  const configured = String(process.env.PUBLIC_APP_URL || "").trim();
  if (configured) return configured;
  return `${req.protocol}://${req.get("host")}`;
}

function fail(res: Response, error: any, status = 400) {
  return res.status(status).json({ ok: false, error: error?.message || String(error) });
}

router.get("/qr/partner/:token", async (req, res) => {
  try {
    const data = await resolvePartnerQr(req.params.token, {
      session_key: typeof req.query.session === "string" ? req.query.session : undefined,
      user_agent: req.get("user-agent") || undefined,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return fail(res, error, 404);
  }
});

router.get("/qr/member/:token", async (req, res) => {
  try {
    const data = await resolveMemberQr(req.params.token);
    if (!data) return res.status(404).json({ ok: false, error: "Member QR not found" });
    return res.json({ ok: true, data });
  } catch (error) {
    return fail(res, error, 404);
  }
});

router.post("/members", async (req, res) => {
  try {
    const data = await createOrFindMember(req.body, baseUrl(req));
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return fail(res, error);
  }
});

router.get("/members/lookup", async (req, res) => {
  try {
    const phone = String(req.query.phone || "").trim();
    if (!phone) return res.status(400).json({ ok: false, error: "phone is required" });
    const data = await lookupMember(phone, String(req.query.tenant || "sbb"), baseUrl(req));
    if (!data) return res.status(404).json({ ok: false, error: "Member not found" });
    return res.json({ ok: true, data });
  } catch (error) {
    return fail(res, error);
  }
});

router.get("/admin/overview", requireCommercialAdmin, async (req, res) => {
  try {
    return res.json({ ok: true, data: await commercialOverview(String(req.query.tenant || "sbb")) });
  } catch (error) {
    return fail(res, error);
  }
});

router.get("/admin/venues", requireCommercialAdmin, async (req, res) => {
  try {
    return res.json({ ok: true, data: await listPartnerVenues(String(req.query.tenant || "sbb")) });
  } catch (error) {
    return fail(res, error);
  }
});

router.post("/admin/venues", requireCommercialAdmin, async (req, res) => {
  try {
    return res.status(201).json({ ok: true, data: await createPartnerVenue(req.body) });
  } catch (error) {
    return fail(res, error);
  }
});

router.patch("/admin/venues/:id", requireCommercialAdmin, async (req, res) => {
  try {
    return res.json({ ok: true, data: await updatePartnerVenue(req.params.id, req.body) });
  } catch (error) {
    return fail(res, error);
  }
});

router.get("/admin/venues/:id/qr", requireCommercialAdmin, async (req, res) => {
  try {
    return res.json({ ok: true, data: await getPartnerVenueQr(req.params.id, baseUrl(req)) });
  } catch (error) {
    return fail(res, error, 404);
  }
});

router.get("/admin/venues/:id/report", requireCommercialAdmin, async (req, res) => {
  try {
    return res.json({ ok: true, data: await detailedPartnerVenueReport(req.params.id) });
  } catch (error) {
    return fail(res, error, 404);
  }
});

router.get("/admin/members", requireCommercialAdmin, async (req, res) => {
  try {
    return res.json({ ok: true, data: await listMembers(String(req.query.tenant || "sbb")) });
  } catch (error) {
    return fail(res, error);
  }
});

router.get("/admin/members/:id", requireCommercialAdmin, async (req, res) => {
  try {
    return res.json({ ok: true, data: await getMemberProfile(req.params.id) });
  } catch (error: any) {
    return fail(res, error, error?.message === "Member not found" ? 404 : 400);
  }
});

router.get("/admin/customers", requireCommercialAdmin, async (req, res) => {
  try {
    return res.json({ ok: true, data: await listCustomerDirectory(String(req.query.tenant || "sbb")) });
  } catch (error) {
    return fail(res, error);
  }
});

export default router;
