import { useQuery } from '@tanstack/react-query';
import { CheckCircle, AlertCircle, AlertTriangle, TrendingUp } from 'lucide-react';

interface FinancialControlData {
  ok: boolean;
  shiftDate: string;
  posAvailable: boolean;
  formAvailable: boolean;
  receiptCounts: {
    staff: { cash: number | null; qr: number | null; grab: number | null; total: number | null };
    pos:   { cash: number; qr: number; grab: number; other: number; total: number };
    variances: { cash: number | null; qr: number | null; grab: number | null; total: number | null };
  };
  salesSummary: {
    grossSales: number | null;
    discounts: number | null;
    netSales: number | null;
    cashSales: number;
    qrSales: number;
    grabSales: number;
    otherSales: number;
    receiptCount: number | null;
    source: string;
  };
  cashPosition: {
    startingCash: number;
    posCashSales: number;
    posPayIns: number;
    posPayOuts: number | null;
    refundAmount: number;
    cashBanked: number;
    expectedClosingCash: number | null;
    staffClosingCash: number | null;
    variance: number | null;
  };
  bankingPosition: {
    expectedCashToBank: number | null;
    staffCashBanked: number | null;
    cashVariance: number | null;
    expectedQR: number;
    staffQRBanked: number | null;
    qrVariance: number | null;
  };
  payInPayOut: {
    posPayIns: number;
    posPayOuts: number | null;
    staffExpenses: number;
    difference: number | null;
    posSource: string | null;
  };
  warnings: string[];
}

const thb = (v: number | null | undefined) =>
  v == null ? '—' : `฿${v.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

const num = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('en-US');

function VarianceBadge({ variance }: { variance: number | null }) {
  if (variance == null) return <span className="text-gray-400 text-xs">—</span>;
  if (variance === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
        <CheckCircle className="w-3 h-3" /> Match
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5">
      <AlertCircle className="w-3 h-3" /> {variance > 0 ? '+' : ''}{variance}
    </span>
  );
}

function CurrencyVarianceBadge({ variance }: { variance: number | null }) {
  if (variance == null) return <span className="text-gray-400 text-xs">—</span>;
  if (variance === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
        <CheckCircle className="w-3 h-3" /> Match
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5">
      <AlertCircle className="w-3 h-3" /> {variance > 0 ? '+' : ''}฿{variance.toLocaleString()}
    </span>
  );
}

function Card({ title, icon, children, accent = 'gray' }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accent?: 'gray' | 'blue' | 'amber';
}) {
  const headerBg = {
    gray:  'bg-gray-100 border-gray-200',
    blue:  'bg-blue-50 border-blue-200',
    amber: 'bg-amber-50 border-amber-200',
  }[accent];

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${headerBg}`}>
        <span className="text-gray-600">{icon}</span>
        <span className="text-sm font-semibold text-gray-800">{title}</span>
      </div>
      <div className="p-4 bg-white space-y-0">{children}</div>
    </div>
  );
}

function Row({ label, value, sub, bold = false, className = '' }: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline justify-between py-1.5 border-b border-gray-50 last:border-0 ${className}`}>
      <span className={`text-xs text-gray-600 ${bold ? 'font-semibold text-gray-800' : ''}`}>
        {label}
        {sub && <span className="text-gray-400 ml-1 font-normal">({sub})</span>}
      </span>
      <span className={`text-xs tabular-nums text-right ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-gray-200 my-1" />;
}

function MissingCard({ label }: { label: string }) {
  return (
    <div className="border border-amber-200 bg-amber-50 rounded-lg px-4 py-3 flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <span className="text-xs font-medium text-amber-800">{label}</span>
    </div>
  );
}

export default function FinancialControlCards({ date }: { date: string }) {
  const { data, isLoading, isError } = useQuery<FinancialControlData>({
    queryKey: ['/api/analysis/financial-control', date],
    queryFn: async () => {
      const r = await fetch(`/api/analysis/financial-control?date=${date}`);
      if (!r.ok) throw new Error('Failed to load financial control data');
      return r.json();
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border border-gray-200 rounded-lg h-40 bg-gray-50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-red-600" />
        <span className="text-xs text-red-800">Financial control data could not be loaded</span>
      </div>
    );
  }

  const { receiptCounts, salesSummary, cashPosition, bankingPosition, payInPayOut, warnings } = data;

  return (
    <div className="space-y-4">

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Card 1: Receipt Count Check */}
        {!data.formAvailable && !data.posAvailable ? (
          <MissingCard label="Receipt Count Check — No data available" />
        ) : (
          <Card title="Receipt Count Check" icon={<TrendingUp className="w-4 h-4" />} accent="blue">
            {/* Header row */}
            <div className="grid grid-cols-4 gap-1 pb-1.5 mb-1 border-b border-gray-100">
              <span className="text-xs text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 text-center">Staff</span>
              <span className="text-xs font-semibold text-gray-500 text-center">POS</span>
              <span className="text-xs font-semibold text-gray-500 text-center">Var</span>
            </div>
            {[
              { label: 'Cash',  s: receiptCounts.staff.cash,  p: receiptCounts.pos.cash,  v: receiptCounts.variances.cash  },
              { label: 'QR',    s: receiptCounts.staff.qr,    p: receiptCounts.pos.qr,    v: receiptCounts.variances.qr    },
              { label: 'Grab',  s: receiptCounts.staff.grab,  p: receiptCounts.pos.grab,  v: receiptCounts.variances.grab  },
              { label: 'Total', s: receiptCounts.staff.total, p: receiptCounts.pos.total, v: receiptCounts.variances.total, bold: true },
            ].map(({ label, s, p, v, bold }) => (
              <div key={label} className={`grid grid-cols-4 gap-1 py-1.5 border-b border-gray-50 last:border-0 items-center ${bold ? 'border-t border-gray-200 mt-1 pt-2' : ''}`}>
                <span className={`text-xs ${bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{label}</span>
                <span className={`text-xs tabular-nums text-center ${bold ? 'font-semibold' : ''} ${s == null ? 'text-gray-400' : 'text-gray-700'}`}>{s ?? '—'}</span>
                <span className={`text-xs tabular-nums text-center ${bold ? 'font-semibold' : ''} text-gray-700`}>{p}</span>
                <div className="flex justify-center">
                  <VarianceBadge variance={v} />
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* Card 2: Register Cash Position */}
        {!data.formAvailable ? (
          <MissingCard label="Register Cash Position — Staff form missing" />
        ) : !data.posAvailable ? (
          <MissingCard label="Register Cash Position — POS data missing" />
        ) : (
          <Card title="Register Cash Position" icon={<CheckCircle className="w-4 h-4" />}>
            <Row label="Starting Cash" value={thb(cashPosition.startingCash)} />
            <Row label="POS Cash Sales" value={thb(cashPosition.posCashSales)} />
            {cashPosition.posPayIns > 0 && (
              <Row label="Pay Ins" value={thb(cashPosition.posPayIns)} />
            )}
            <Row label="Pay Outs (POS)" value={cashPosition.posPayOuts != null ? `−${thb(cashPosition.posPayOuts)}` : '—'} />
            {cashPosition.refundAmount > 0 && (
              <Row label="Cash Refunds" value={`−${thb(cashPosition.refundAmount)}`} />
            )}
            <Divider />
            <Row label="Expected Closing Cash" value={thb(cashPosition.expectedClosingCash)} bold />
            <Row label="Staff Closing Cash" value={thb(cashPosition.staffClosingCash)} bold sub="before banking" />
            <div className="flex items-center justify-between pt-2 mt-1">
              <span className="text-xs font-semibold text-gray-800">Variance</span>
              <CurrencyVarianceBadge variance={cashPosition.variance} />
            </div>
          </Card>
        )}

        {/* Card 3: Banking Position */}
        {!data.formAvailable ? (
          <MissingCard label="Banking Position — Staff form missing" />
        ) : (
          <Card title="Banking Position" icon={<CheckCircle className="w-4 h-4" />} accent="blue">
            <div className="space-y-0">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-1 mb-1">Cash</div>
              <Row
                label="Expected to Bank"
                value={bankingPosition.expectedCashToBank != null ? thb(bankingPosition.expectedCashToBank) : '—'}
                sub={!data.posAvailable ? 'est.' : undefined}
              />
              <Row label="Staff Banked" value={thb(bankingPosition.staffCashBanked)} />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-gray-600">Variance</span>
                <CurrencyVarianceBadge variance={bankingPosition.cashVariance} />
              </div>

              <Divider />
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-1 mt-2">QR / Bank Transfer</div>
              <Row label="POS QR Sales" value={thb(bankingPosition.expectedQR)} />
              <Row label="Staff QR Banked" value={thb(bankingPosition.staffQRBanked)} />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-gray-600">Variance</span>
                <CurrencyVarianceBadge variance={bankingPosition.qrVariance} />
              </div>
            </div>
          </Card>
        )}

        {/* Card 4: Pay In / Pay Out Control */}
        {!data.posAvailable ? (
          <MissingCard label="Pay In / Pay Out Control — POS shift report missing" />
        ) : (
          <Card title="Pay In / Pay Out Control" icon={<AlertTriangle className="w-4 h-4" />} accent="amber">
            {payInPayOut.posPayIns > 0 && (
              <Row label="POS Pay Ins" value={thb(payInPayOut.posPayIns)} />
            )}
            <Row label="POS Pay Outs" value={thb(payInPayOut.posPayOuts)} />
            <Row label="Staff Expenses Total" value={thb(payInPayOut.staffExpenses)} />
            <Divider />
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-gray-800">Difference</span>
              <CurrencyVarianceBadge variance={payInPayOut.difference} />
            </div>
            {!payInPayOut.posSource && (
              <p className="text-xs text-amber-700 mt-2">POS pay-out detail not available — comparing staff totals only</p>
            )}
          </Card>
        )}

        {/* Card 5: Loyverse Sales Summary */}
        <Card title="Loyverse Sales Summary" icon={<TrendingUp className="w-4 h-4" />} accent="blue">
          {!data.posAvailable && (
            <div className="flex items-center gap-1.5 mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              POS shift report missing — showing receipt aggregates
            </div>
          )}
          {salesSummary.grossSales != null && (
            <Row label="Gross Sales" value={thb(salesSummary.grossSales)} />
          )}
          {salesSummary.discounts != null && salesSummary.discounts !== 0 && (
            <Row label="Discounts" value={`−${thb(salesSummary.discounts)}`} />
          )}
          {salesSummary.netSales != null && (
            <Row label="Net Sales" value={thb(salesSummary.netSales)} bold />
          )}
          {salesSummary.grossSales != null && <Divider />}
          <Row label="Cash Sales" value={thb(salesSummary.cashSales)} />
          <Row label="QR Sales" value={thb(salesSummary.qrSales)} />
          <Row label="Grab / Delivery" value={thb(salesSummary.grabSales)} />
          {salesSummary.otherSales > 0 && (
            <Row label="Other" value={thb(salesSummary.otherSales)} />
          )}
          <Divider />
          <Row label="Receipt Count" value={num(salesSummary.receiptCount)} bold />
          <p className="text-xs text-gray-400 mt-2">
            Source: {salesSummary.source === 'pos_shift_report' ? 'Loyverse POS Shift Report' : 'POS Receipt Aggregation'}
          </p>
        </Card>

      </div>
    </div>
  );
}
