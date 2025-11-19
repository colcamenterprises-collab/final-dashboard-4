import React, { useEffect, useState } from "react";
import { formatDateDDMMYYYY } from "@/lib/format";
import { Pencil, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type RollsRow = {
  shift_date: string;
  rolls_start: number;
  rolls_purchased: number;
  burgers_sold: number;
  estimated_rolls_end: number;
  actual_rolls_end: number | null;
  variance: number;
  status: 'PENDING' | 'OK' | 'ALERT';
  rolls_purchased_manual: number | null;
  actual_rolls_end_manual: number | null;
  notes: string | null;
};

type EditState = {
  shiftDate: string;
  rollsPurchasedManual: string;
  actualRollsEndManual: string;
  notes: string;
};

export default function RollsLedger() {
  const [rows, setRows] = useState<RollsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/analysis/rolls-ledger/history')
      .then(r => r.json())
      .then(json => setRows(json?.rows ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleRebuildAll() {
    if (!confirm('Rebuild all 14 days of rolls ledger?')) return;
    setLoading(true);
    await fetch('/api/analysis/rolls-ledger/backfill-14', { method: 'POST' });
    const resp = await fetch('/api/analysis/rolls-ledger/history').then(r=>r.json());
    setRows(resp?.rows ?? []);
    setLoading(false);
  }

  function handleEditRow(row: RollsRow) {
    setEditingRow(row.shift_date);
    setEditState({
      shiftDate: row.shift_date,
      rollsPurchasedManual: row.rolls_purchased_manual?.toString() ?? row.rolls_purchased.toString(),
      actualRollsEndManual: row.actual_rolls_end_manual?.toString() ?? row.actual_rolls_end?.toString() ?? '',
      notes: row.notes ?? '',
    });
  }

  function handleCancelEdit() {
    setEditingRow(null);
    setEditState(null);
  }

  async function handleSaveEdit() {
    if (!editState) return;

    try {
      const response = await fetch('/api/analysis/rolls-ledger/update-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftDate: editState.shiftDate,
          rollsPurchasedManual: editState.rollsPurchasedManual ? Number(editState.rollsPurchasedManual) : null,
          actualRollsEndManual: editState.actualRollsEndManual ? Number(editState.actualRollsEndManual) : null,
          notes: editState.notes || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      toast({
        title: "Saved",
        description: "Manual amendments saved successfully",
      });

      // Refresh data
      const resp = await fetch('/api/analysis/rolls-ledger/history').then(r=>r.json());
      setRows(resp?.rows ?? []);
      setEditingRow(null);
      setEditState(null);
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to save amendments",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Rolls Ledger</h1>
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Rolls Ledger</h1>
        <button
          onClick={handleRebuildAll}
          className="px-4 py-2 rounded-[4px] bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 min-h-[44px] active:scale-95 transition-transform"
          data-testid="button-rebuild-all"
        >
          Rebuild All (14 Days)
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs bg-white rounded-[4px] border border-slate-200">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 text-left font-medium text-slate-700">Date</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">Start</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">Purchased</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">Burgers Sold</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">Est. End</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">Actual End</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">Variance</th>
              <th className="px-3 py-2 text-center font-medium text-slate-700">Status</th>
              <th className="px-3 py-2 text-center font-medium text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isEditing = editingRow === row.shift_date;
              const hasManualOverrides = row.rolls_purchased_manual !== null || row.actual_rolls_end_manual !== null;
              
              return (
                <React.Fragment key={row.shift_date}>
                  <tr className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-900">
                      {formatDateDDMMYYYY(row.shift_date)}
                      {hasManualOverrides && (
                        <span className="ml-1 text-amber-600" title="Has manual amendments">*</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.rolls_start}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editState?.rollsPurchasedManual ?? ''}
                          onChange={(e) => setEditState(prev => prev ? {...prev, rollsPurchasedManual: e.target.value} : null)}
                          className="w-20 px-2 py-1 text-right border border-slate-300 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          data-testid="input-rolls-purchased"
                        />
                      ) : (
                        <span className={hasManualOverrides && row.rolls_purchased_manual !== null ? 'font-medium text-amber-700' : ''}>
                          {row.rolls_purchased}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.burgers_sold}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.estimated_rolls_end}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editState?.actualRollsEndManual ?? ''}
                          onChange={(e) => setEditState(prev => prev ? {...prev, actualRollsEndManual: e.target.value} : null)}
                          className="w-20 px-2 py-1 text-right border border-slate-300 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          data-testid="input-actual-end"
                        />
                      ) : (
                        <span className={hasManualOverrides && row.actual_rolls_end_manual !== null ? 'font-medium text-amber-700' : ''}>
                          {row.actual_rolls_end ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">
                      {row.actual_rolls_end !== null ? (
                        <span className={row.variance >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                          {row.variance >= 0 ? '+' : ''}{row.variance}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-2 py-1 rounded-[4px] text-xs font-medium ${
                        row.status === 'OK' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : row.status === 'ALERT' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-[4px] transition-colors"
                            title="Save"
                            data-testid="button-save-edit"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 text-slate-600 hover:bg-slate-100 rounded-[4px] transition-colors"
                            title="Cancel"
                            data-testid="button-cancel-edit"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditRow(row)}
                          className="p-1 text-slate-600 hover:bg-slate-100 rounded-[4px] transition-colors"
                          title="Edit"
                          data-testid={`button-edit-${row.shift_date}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <td colSpan={9} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <label className="text-slate-700 font-medium">Notes:</label>
                          <input
                            type="text"
                            value={editState?.notes ?? ''}
                            onChange={(e) => setEditState(prev => prev ? {...prev, notes: e.target.value} : null)}
                            placeholder="Optional notes for this amendment..."
                            className="flex-1 px-3 py-1 border border-slate-300 rounded-[4px] text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            data-testid="input-notes"
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                  {!isEditing && row.notes && (
                    <tr className="border-b border-slate-200 bg-amber-50">
                      <td colSpan={9} className="px-3 py-1 text-xs text-amber-800">
                        <span className="font-medium">Note:</span> {row.notes}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="text-center py-8 text-slate-600">
          No rolls ledger data found. Click "Rebuild All (14 Days)" to populate.
        </div>
      )}
    </div>
  );
}
