import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { Request, Response } from "express";
import { requireCommercialAdmin } from "./orderingCommercial";

function responseHarness() {
  const state = { statusCode: 200, body: undefined as any };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(body: any) {
      state.body = body;
      return this;
    },
  } as unknown as Response;
  return { state, res };
}

test("commercial admin accepts the existing internal dashboard owner cookie", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousPassword = process.env.INTERNAL_APP_PASSWORD;
  process.env.NODE_ENV = "production";
  process.env.INTERNAL_APP_PASSWORD = "test-owner-password";

  try {
    const cookie = createHmac("sha256", process.env.INTERNAL_APP_PASSWORD)
      .update("sbb_ui_auth_v1")
      .digest("hex");
    const req = { headers: { cookie: `sbb_ui_session=${cookie}` } } as unknown as Request;
    const { state, res } = responseHarness();
    let nextCalled = false;

    requireCommercialAdmin(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(state.statusCode, 200);
    assert.equal((req as any).user?.role, "owner");
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    process.env.INTERNAL_APP_PASSWORD = previousPassword;
  }
});

test("commercial admin rejects an unauthenticated production request", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  try {
    const req = { headers: {} } as unknown as Request;
    const { state, res } = responseHarness();
    let nextCalled = false;

    requireCommercialAdmin(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(state.statusCode, 401);
    assert.deepEqual(state.body, { error: "AUTHENTICATION_REQUIRED" });
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
});
