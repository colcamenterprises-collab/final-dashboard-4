import { Router, type NextFunction, type Request, type Response } from "express";
import { pool } from "../db";
import { attachSessionUser } from "../middleware/sessionAuth";
import { getPinSessionUser } from "./pinAuth";
import posTestRouter from "./posTest";

const router = Router();
const fail = (res: Response, message: string, status = 400) => res.status(status).json({ ok: false, source: "sbb_pos_shifts", error: message });
const db = () => {
  if (!pool) throw new Error("POS database is unavailable");
  return pool;
};
const numberValue = (input: unknown) => {
  const value = Number(input);
  return Number.isFinite(value) ? value : 0;
};
const textValue = (input: unknown, max = 240) => typeof input === "string" ? input.trim().slice(0, max) : "";

function staffDevice(req: Request, res: Response, next: NextFunction) {
  if (process.env.EMERGENCY_STAFF_ACCESS === "true") return next();
  if (process.env.NODE_ENV !== "production") return next();
  if (attachSessionUser(req)) return next();
  const pinUser = getPinSessionUser(req);
  if (pinUser && (["owner", "manager", "cashier"].includes(pinUser.role) || pinUser.permissions?.["pos.view"] === true)) {
    (req as any).user = pinUser;
    return next();
  }
  if (
    process.env.POS_DEVICE_TOKEN &&
    req.header("x-pos-device-token") === process.env.POS_DEVICE_TOKEN
  ) {
    return next();
  }
  return fail(res, "Registered POS device required", 401);
}

router.use("/test", staffDevice, posTestRouter);

async function currentShift() {
  const result = await db().query(`SELECT * FROM public.pos_shifts WHERE status='open' ORDER BY opened_at DESC LIMIT 1`);
  return result.rows[0] || null;
}

async function cashSalesForShift(shiftId: string) {
  const result = await db().query(
    `SELECT COALESCE(SUM(p.amount),0) AS total
       FROM public.ordering_payments p
       JOIN public.ordering_orders o ON o.id=p.order_id
      WHERE o.pos_shift_id=$1
        AND o.channel IN ('pos_direct','grab')
        AND p.method='cash'
        AND p.status='confirmed'
        AND o.status <> 'cancelled'`,
    [shiftId],
  );
  return numberValue(result.rows[0]?.total);
}

router.get("/current", staffDevice, async (_req, res) => {
  try {
    const shift = await currentShift();
    const movements = shift ? (await db().query(`SELECT * FROM public.pos_shift_movements WHERE shift_id=$1 ORDER BY created_at DESC`, [shift.id])).rows : [];
    const history = (await db().query(`SELECT * FROM public.pos_shifts ORDER BY opened_at DESC LIMIT 20`)).rows;
    const cashSales = shift ? await cashSalesForShift(shift.id) : 0;
    res.json({ ok: true, source: "sbb_pos_shifts", data: { shift, movements, history, cashSales } });
  } catch (error: any) {
    fail(res, error.message, 500);
  }
});

router.post("/open", staffDevice, async (req, res) => {
  try {
    if (await currentShift()) return fail(res, "A shift is already open", 409);
    const staffName = textValue(req.body?.staff_name, 120);
    const startingFloat = numberValue(req.body?.starting_float);
    if (!staffName || startingFloat < 0) return fail(res, "Cashier name and valid starting float are required");
    const actor = (req as any).user?.username || (req as any).user?.id || staffName;
    const result = await db().query(`INSERT INTO public.pos_shifts(staff_name,starting_float,opened_by) VALUES($1,$2,$3) RETURNING *`, [staffName, startingFloat, actor]);
    res.status(201).json({ ok: true, source: "sbb_pos_shifts", data: result.rows[0] });
  } catch (error: any) {
    if (error.code === "23505") return fail(res, "A shift is already open", 409);
    fail(res, error.message, 500);
  }
});

router.post("/:id/movements", staffDevice, async (req, res) => {
  try {
    const movementType = req.body?.movement_type;
    const amount = numberValue(req.body?.amount);
    const reason = textValue(req.body?.reason);
    if (!["cash_in", "cash_out"].includes(movementType) || amount <= 0 || !reason) return fail(res, "Movement type, amount and reason are required");
    const open = await db().query(`SELECT id FROM public.pos_shifts WHERE id=$1 AND status='open'`, [req.params.id]);
    if (!open.rowCount) return fail(res, "Shift is not open", 409);
    const actor = (req as any).user?.username || (req as any).user?.id || null;
    const result = await db().query(`INSERT INTO public.pos_shift_movements(shift_id,movement_type,amount,reason,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *`, [req.params.id, movementType, amount, reason, actor]);
    res.status(201).json({ ok: true, source: "sbb_pos_shifts", data: result.rows[0] });
  } catch (error: any) {
    fail(res, error.message, 500);
  }
});

router.post("/:id/close", staffDevice, async (req, res) => {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const current = (await client.query(`SELECT * FROM public.pos_shifts WHERE id=$1 AND status='open' FOR UPDATE`, [req.params.id])).rows[0];
    if (!current) {
      await client.query("ROLLBACK");
      return fail(res, "Shift is not open", 409);
    }
    const closingCash = numberValue(req.body?.closing_cash);
    const cashBanked = numberValue(req.body?.cash_banked);
    if (closingCash < 0 || cashBanked < 0) {
      await client.query("ROLLBACK");
      return fail(res, "Closing cash and cash banked must be valid");
    }
    const movements = (await client.query(`SELECT COALESCE(SUM(CASE WHEN movement_type='cash_in' THEN amount ELSE -amount END),0) total FROM public.pos_shift_movements WHERE shift_id=$1`, [req.params.id])).rows[0];
    const cashSales = await cashSalesForShift(current.id);
    const expected = numberValue(current.starting_float) + cashSales + numberValue(movements.total) - cashBanked;
    const variance = closingCash - expected;
    const actor = (req as any).user?.username || (req as any).user?.id || null;
    const closed = (await client.query(`UPDATE public.pos_shifts SET status='closed',closed_at=NOW(),closing_cash=$2,cash_banked=$3,expected_cash=$4,variance=$5,closed_by=$6,updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id, closingCash, cashBanked, expected, variance, actor])).rows[0];
    await client.query("COMMIT");
    res.json({ ok: true, source: "sbb_pos_shifts", data: { ...closed, cash_sales: cashSales } });
  } catch (error: any) {
    await client.query("ROLLBACK");
    fail(res, error.message, 500);
  } finally {
    client.release();
  }
});

export default router;
