export const ORDERING_CHANNELS = ["online", "qr_table", "tablet_counter", "kiosk", "ai_voice"] as const;
export const ORDERING_PHASE1_CHANNELS = ["online", "qr_table", "tablet_counter"] as const;
export const ORDERING_PAYMENT_METHODS = ["pay_at_counter", "cash", "manual_qr_transfer"] as const;
export const ORDERING_ORDER_STATUSES = [
  "draft",
  "submitted",
  "payment_pending",
  "paid",
  "pay_at_counter",
  "accepted",
  "in_kitchen",
  "ready",
  "completed",
  "cancelled",
  "refunded",
] as const;
export const ORDERING_SYNC_STATUSES = ["pending", "synced", "failed", "manual_required"] as const;

export type OrderingChannel = (typeof ORDERING_CHANNELS)[number];
export type OrderingPhase1Channel = (typeof ORDERING_PHASE1_CHANNELS)[number];
export type OrderingPaymentMethod = (typeof ORDERING_PAYMENT_METHODS)[number];
export type OrderingOrderStatus = (typeof ORDERING_ORDER_STATUSES)[number];
export type OrderingSyncStatus = (typeof ORDERING_SYNC_STATUSES)[number];

export type OrderingBlocker = {
  code: string;
  message: string;
  where: string;
  canonical_source: string;
  auto_build_attempted: false;
};

export type OrderingMenuCategory = {
  id: string;
  name_en: string;
  name_th: string | null;
  description_en: string | null;
  description_th: string | null;
  sort_order: number;
  is_active: boolean;
};

export type OrderingMenuItem = {
  id: string;
  category_id: string;
  name_en: string;
  name_th: string | null;
  description_en: string | null;
  description_th: string | null;
  price: string;
  is_active: boolean;
  is_sold_out: boolean;
  sort_order: number;
  modifier_groups?: OrderingModifierGroup[];
};

export type OrderingModifierGroup = {
  id: string;
  menu_item_id: string;
  name_en: string;
  name_th: string | null;
  min_select: number;
  max_select: number;
  is_required: boolean;
  sort_order: number;
  modifiers?: OrderingItemModifier[];
};

export type OrderingItemModifier = {
  id: string;
  modifier_group_id: string;
  name_en: string;
  name_th: string | null;
  price_delta: string;
  is_active: boolean;
  sort_order: number;
};

export type OrderingCartItemInput = {
  menu_item_id: string;
  quantity: number;
  notes?: string | null;
  modifiers?: { item_modifier_id: string; quantity?: number }[];
};

export type OrderingCreateOrderInput = {
  channel: OrderingPhase1Channel;
  table_code?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  order_notes?: string | null;
  payment_method: OrderingPaymentMethod;
  items: OrderingCartItemInput[];
};
