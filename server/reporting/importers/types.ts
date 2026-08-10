export type ReportingSourceSystem =
  | "loyverse"
  | "square"
  | "toast"
  | "lightspeed"
  | "clover"
  | "shopify_pos"
  | "generic_csv"
  | string;

export type CanonicalPayment = {
  sourcePaymentId?: string;
  paymentMethod: string;
  amount: number;
  paidAt?: string;
  sourcePayload?: unknown;
};

export type CanonicalModifier = {
  sourceModifierId?: string;
  group?: string;
  name: string;
  quantity: number;
  priceDelta: number;
  revenue: number;
  sourcePayload?: unknown;
};

export type CanonicalLineItem = {
  sourceLineId: string;
  sourceItemId?: string;
  itemName: string;
  sku?: string;
  category?: string;
  quantity: number;
  unitPrice?: number;
  grossSales: number;
  discountTotal: number;
  refundTotal: number;
  netSales: number;
  taxTotal: number;
  costOfGoods?: number | null;
  grossProfit?: number | null;
  isSetComponent?: boolean;
  modifiers?: CanonicalModifier[];
  sourcePayload?: unknown;
};

export type CanonicalTransaction = {
  venueKey: string;
  sourceSystem: ReportingSourceSystem;
  sourceTransactionId: string;
  sourceReceiptNumber?: string;
  occurredAt: string;
  businessTimezone: string;
  channel?: string;
  orderMode?: string;
  paymentStatus?: string;
  subtotal: number;
  discountTotal: number;
  refundTotal: number;
  taxTotal: number;
  netSales: number;
  total: number;
  currency: string;
  staffName?: string;
  items: CanonicalLineItem[];
  payments: CanonicalPayment[];
  sourcePayload?: unknown;
};

export type SourceFileDescriptor = {
  filename: string;
  sha256: string;
  mimeType?: string;
  contents: Buffer | string;
};

export type ImportContext = {
  venueKey: string;
  timezone: string;
  cutoverAt?: string;
  currency?: string;
};

export type ImportValidation = {
  ok: boolean;
  warnings: string[];
  errors: string[];
  sourceRowCount?: number;
  transactionCount?: number;
  grossSales?: number;
  discounts?: number;
  refunds?: number;
  netSales?: number;
};

export interface ReportingSourceAdapter {
  readonly id: ReportingSourceSystem;
  readonly displayName: string;
  detect(files: SourceFileDescriptor[]): Promise<number> | number;
  validate(files: SourceFileDescriptor[], context: ImportContext): Promise<ImportValidation>;
  parse(files: SourceFileDescriptor[], context: ImportContext): AsyncIterable<CanonicalTransaction>;
}
