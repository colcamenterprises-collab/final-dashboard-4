import { Calendar, DollarSign } from "lucide-react";

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
      className="bg-slate-800 rounded-lg p-4 mb-3 shadow-sm"
      data-testid={`balance-card-${date}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-blue-400">
          <Calendar className="h-4 w-4" />
          <span className="text-sm font-medium">{new Date(date).toLocaleDateString()}</span>
        </div>
        <span className={`px-2 py-1 rounded-md text-xs font-medium ${
          isBalanced ? "bg-green-500 text-white" : "bg-red-500 text-white"
        }`}>
          {isBalanced ? "Balanced" : "Unbalanced"}
        </span>
      </div>
      <div className="flex items-center gap-2 text-green-400">
        <DollarSign className="h-4 w-4" />
        <span className="text-sm font-medium">Balance</span>
        <span className="text-sm font-medium ml-auto">
          {difference >= 0 ? "+" : ""}฿{difference.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </span>
      </div>
    </div>
  );
}