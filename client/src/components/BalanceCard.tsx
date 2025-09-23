interface Props {
  date: string;
  expected: number;
  actual: number;
  difference: number;
  status: string;
}

export default function BalanceCard({ date, expected, actual, difference, status }: Props) {
  const isBalanced = status === "Balanced";
  return (
    <div 
      className={`p-4 rounded-xl shadow-md mb-2 ${isBalanced ? "bg-green-100 border-green-200" : "bg-red-100 border-red-200"} border`}
      data-testid={`balance-card-${date}`}
    >
      <p className="font-semibold text-gray-800 mb-2">{new Date(date).toLocaleDateString()}</p>
      <div className="space-y-1 text-sm">
        <p>Expected: <span className="font-medium">฿{expected.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></p>
        <p>Actual: <span className="font-medium">฿{actual.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></p>
        <p>
          Difference: <span className={`font-bold ${isBalanced ? "text-green-600" : "text-red-600"}`}>
            {difference >= 0 ? "+" : ""}
            ฿{difference.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </span>
        </p>
        <p className={`font-bold text-xs ${isBalanced ? "text-green-700" : "text-red-700"}`}>{status}</p>
      </div>
    </div>
  );
}