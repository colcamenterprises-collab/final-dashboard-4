import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StockLodgmentModal } from '@/components/operations/StockLodgmentModal';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/format';
import { Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function StockPurchaseTables() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [editingStock, setEditingStock] = useState<any | null>(null);
  const [showStockModal, setShowStockModal] = useState(false);

  const monthParam = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const { data: purchaseTallyData } = useQuery({
    queryKey: ['/api/purchase-tally', selectedMonth, selectedYear],
    queryFn: () => axios.get(`/api/purchase-tally?month=${monthParam}`).then(res => res.data),
    staleTime: 5 * 60 * 1000,
  });

  const rolls = (purchaseTallyData?.entries && Array.isArray(purchaseTallyData.entries))
    ? purchaseTallyData.entries.filter((item: any) => item.rollsPcs != null && item.rollsPcs > 0)
    : [];
  const meat = (purchaseTallyData?.entries && Array.isArray(purchaseTallyData.entries))
    ? purchaseTallyData.entries.filter((item: any) => item.meatGrams != null && item.meatGrams > 0)
    : [];
  const drinks = (purchaseTallyData?.entries && Array.isArray(purchaseTallyData.entries))
    ? purchaseTallyData.entries.filter((item: any) => {
        if (Array.isArray(item.drinks) && item.drinks.length > 0) return true;
        try {
          const notes = typeof item.notes === 'string' ? JSON.parse(item.notes) : item.notes;
          return notes?.type === 'drinks';
        } catch (e) {
          return false;
        }
      })
    : [];

  const deleteStockMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/purchase-tally/${id}`),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Stock item deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-tally'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.response?.data?.error || 'Failed to delete stock item',
        variant: 'destructive',
      });
    },
  });

  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-6 mt-6">
      {/* Month selector */}
      <div className="bg-white rounded shadow p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <h2 className="text-xs font-semibold">Stock Purchases — Month:</h2>
          <div className="flex gap-3">
            <Select value={selectedMonth.toString()} onValueChange={v => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Edit Stock Modal */}
      {showStockModal && (
        <StockLodgmentModal
          isOpen={showStockModal}
          onOpenChange={(open) => {
            setShowStockModal(open);
            if (!open) setEditingStock(null);
          }}
          initialData={editingStock}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/purchase-tally'] });
            setShowStockModal(false);
            setEditingStock(null);
          }}
        />
      )}

      {/* Rolls Table */}
      <div className="bg-white rounded shadow p-4" data-testid="section-rolls-purchases">
        <h2 className="text-sm font-semibold mb-2">Rolls Purchases</h2>
        <table className="w-full border text-xs" data-testid="table-rolls-purchases">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-1 border text-left text-xs">Date</th>
              <th className="p-1 border text-left text-xs">Staff</th>
              <th className="p-1 border text-left text-xs">Quantity</th>
              <th className="p-1 border text-left text-xs">Paid</th>
              <th className="p-1 border text-right text-xs">Amount</th>
              <th className="p-1 border text-center text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rolls.map((r: any, i: number) => {
              const quantity = r.rollsPcs || 0;
              const amount = r.amountTHB || 0;
              const paid = amount > 0 ? 'Yes' : 'No';
              return (
                <tr key={i} className="hover:bg-gray-50" data-testid={`row-roll-${r.id}`}>
                  <td className="border p-1">
                    <div>{formatDateDDMMYYYY(r.date)}</div>
                    {r.createdAt && <div className="text-[10px] text-slate-400">{formatDateTimeDDMMYYYY(r.createdAt)}</div>}
                  </td>
                  <td className="border p-1">{r.staff || '-'}</td>
                  <td className="border p-1">{quantity}</td>
                  <td className="border p-1">{paid}</td>
                  <td className="border p-1 text-right">฿{amount.toLocaleString()}</td>
                  <td className="border p-1 text-center">
                    <div className="flex justify-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingStock({
                            type: 'rolls',
                            id: r.id,
                            date: r.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                            quantity: r.rollsPcs || 0,
                            cost: r.amountTHB || 0,
                            paid: false,
                          });
                          setShowStockModal(true);
                        }}
                        className="h-7 w-7 p-0"
                        data-testid={`button-edit-roll-${r.id}`}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                            disabled={deleteStockMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Roll Purchase</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this roll purchase? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteStockMutation.mutate(r.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rolls.length === 0 && (
              <tr>
                <td colSpan={6} className="border p-4 text-center text-gray-500">No rolls purchases this month</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Meat Table */}
      <div className="bg-white rounded shadow p-4" data-testid="section-meat-purchases">
        <h2 className="text-sm font-semibold mb-2">Meat Purchases</h2>
        <table className="w-full border text-xs" data-testid="table-meat-purchases">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-1 border text-left text-xs">Date</th>
              <th className="p-1 border text-left text-xs">Staff</th>
              <th className="p-1 border text-left text-xs">Type</th>
              <th className="p-1 border text-left text-xs">Weight</th>
              <th className="p-1 border text-left text-xs">Supplier</th>
              <th className="p-1 border text-center text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {meat.map((m: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50" data-testid={`row-meat-${m.id}`}>
                <td className="border p-1">
                  <div>{formatDateDDMMYYYY(m.date)}</div>
                  {m.createdAt && <div className="text-[10px] text-slate-400">{formatDateTimeDDMMYYYY(m.createdAt)}</div>}
                </td>
                <td className="border p-1">{m.staff || '-'}</td>
                <td className="border p-1">{m.notes || m.meatType}</td>
                <td className="border p-1">{m.meatGrams ? (m.meatGrams / 1000).toFixed(2) + ' kg' : 'N/A'}</td>
                <td className="border p-1">{m.supplier || 'Meat Supplier'}</td>
                <td className="border p-1 text-center">
                  <div className="flex justify-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingStock({
                          type: 'meat',
                          id: m.id,
                          date: m.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                          meatType: m.notes || m.meatType || '',
                          weightKg: m.meatGrams ? m.meatGrams / 1000 : 0,
                        });
                        setShowStockModal(true);
                      }}
                      className="h-7 w-7 p-0"
                      data-testid={`button-edit-meat-${m.id}`}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                          disabled={deleteStockMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Meat Purchase</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this meat purchase ({m.notes || m.meatType})? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteStockMutation.mutate(m.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            ))}
            {meat.length === 0 && (
              <tr>
                <td colSpan={6} className="border p-4 text-center text-gray-500">No meat purchases this month</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drinks Table */}
      <div className="bg-white rounded shadow p-4" data-testid="section-drinks-purchases">
        <h2 className="text-sm font-semibold mb-2">Drinks Purchases</h2>
        <table className="w-full border text-xs" data-testid="table-drinks-purchases">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-1 border text-left text-xs">Date</th>
              <th className="p-1 border text-left text-xs">Staff</th>
              <th className="p-1 border text-left text-xs">Type</th>
              <th className="p-1 border text-left text-xs">Quantity</th>
              <th className="p-1 border text-center text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {drinks.map((d: any, i: number) => {
              const drinkItems = Array.isArray(d.drinks) ? d.drinks : [];

              if (drinkItems.length > 0) {
                return drinkItems.map((drink: any, di: number) => (
                  <tr key={`${d.id}-${di}`} className="hover:bg-gray-50" data-testid={`row-drink-${d.id}-${di}`}>
                    {di === 0 && (
                      <>
                        <td className="border p-1" rowSpan={drinkItems.length}>
                          <div>{formatDateDDMMYYYY(d.date || d.createdAt)}</div>
                          {d.createdAt && <div className="text-[10px] text-slate-400">{formatDateTimeDDMMYYYY(d.createdAt)}</div>}
                        </td>
                        <td className="border p-1" rowSpan={drinkItems.length}>{d.staff || '-'}</td>
                      </>
                    )}
                    <td className="border p-1">{drink.itemName || drink.item_name || '-'}</td>
                    <td className="border p-1">{drink.qty || 0}</td>
                    {di === 0 && (
                      <td className="border p-1 text-center" rowSpan={drinkItems.length}>
                        <div className="flex justify-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingStock({
                                type: 'drinks',
                                id: d.id,
                                date: d.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                                items: drinkItems.map((item: any) => ({
                                  type: item.itemName || item.item_name,
                                  quantity: item.qty,
                                })),
                              });
                              setShowStockModal(true);
                            }}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                                disabled={deleteStockMutation.isPending}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Drink Purchase</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this drinks lodgement? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteStockMutation.mutate(d.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    )}
                  </tr>
                ));
              }

              let drinkType = 'N/A';
              let quantity: string | number = 'N/A';
              try {
                const meta = typeof d.notes === 'string' ? JSON.parse(d.notes) : d.notes;
                drinkType = meta.drinkType || 'N/A';
                quantity = meta.qty || meta.quantity || 'N/A';
              } catch (e) {
                drinkType = d.notes || 'N/A';
              }

              return (
                <tr key={i} className="hover:bg-gray-50" data-testid={`row-drink-${d.id}`}>
                  <td className="border p-1">
                    <div>{formatDateDDMMYYYY(d.date || d.createdAt)}</div>
                    {d.createdAt && <div className="text-[10px] text-slate-400">{formatDateTimeDDMMYYYY(d.createdAt)}</div>}
                  </td>
                  <td className="border p-1">{d.staff || '-'}</td>
                  <td className="border p-1">{drinkType}</td>
                  <td className="border p-1">{quantity}</td>
                  <td className="border p-1 text-center">
                    <div className="flex justify-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => console.log('Edit drink:', d)}
                        className="h-7 w-7 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                            disabled={deleteStockMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Drink Purchase</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this drink purchase ({drinkType})? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteStockMutation.mutate(d.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              );
            })}
            {drinks.length === 0 && (
              <tr>
                <td colSpan={5} className="border p-4 text-center text-gray-500">No drinks purchases this month</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
