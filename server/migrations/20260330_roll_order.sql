-- Additive table for Form 2 bakery roll ordering (read-model + send audit)
CREATE TABLE IF NOT EXISTS roll_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_date DATE NOT NULL,
  closing_rolls INTEGER NOT NULL,
  target_rolls INTEGER NOT NULL,
  recommended_qty INTEGER NOT NULL,
  approved_qty INTEGER NOT NULL,
  was_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('CALCULATED','APPROVED','OVERRIDDEN','SENT','FAILED')),
  recipient_id TEXT,
  line_target_id TEXT,
  line_message_payload JSONB,
  line_send_response JSONB,
  line_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_roll_order_shift_date ON roll_order (shift_date);
CREATE INDEX IF NOT EXISTS ix_roll_order_status ON roll_order (status);
CREATE INDEX IF NOT EXISTS ix_roll_order_sent_at ON roll_order (sent_at DESC);
