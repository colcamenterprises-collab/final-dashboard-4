import { useParams } from 'wouter';
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

interface FormData {
  id?: number;
  completedBy: string;
  shiftType: string;
  shiftDate: string;
  startingCash: number;
  grabSales: number;
  aroiDeeSales: number;
  qrScanSales: number;
  cashSales: number;
  totalSales: number;
  wages: Array<{ staffName: string; amount: number; type: string; }>;
  shopping: Array<{ item: string; amount: number; shopName: string; }>;
  gasExpense: number;
  totalExpenses: number;
  endCash: number;
  bankedAmount: number;
  burgerBunsStock: number;
  meatWeight: number;
  drinkStockCount: number;
  isDraft: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const FormView = () => {
  const params = useParams();
  const id = params.id;
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetch(`/api/daily-stock-sales/${id}`)
        .then(r => r.json())
        .then(data => {
          setFormData(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error loading form:', err);
          setLoading(false);
        });
    }
  }, [id]);

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading form data...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">Form not found</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const wages = typeof formData.wages === 'string' ? JSON.parse(formData.wages) : formData.wages || [];
  const shopping = typeof formData.shopping === 'string' ? JSON.parse(formData.shopping) : formData.shopping || [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/ops-sales/form-library">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Form Library
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold">
            Full Form View - ID {formData.id}
            {formData.isDraft && <span className="ml-2 text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">DRAFT</span>}
          </h1>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Completed By</Label>
              <Input disabled value={formData.completedBy} />
            </div>
            <div>
              <Label>Shift Type</Label>
              <Input disabled value={formData.shiftType} />
            </div>
            <div>
              <Label>Shift Date</Label>
              <Input disabled value={new Date(formData.shiftDate).toLocaleDateString()} />
            </div>
          </div>

          {/* Sales */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Sales</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Starting Cash (฿)</Label>
                <Input disabled value={Number(formData.startingCash || 0).toFixed(2)} />
              </div>
              <div>
                <Label>Grab Sales (฿)</Label>
                <Input disabled value={Number(formData.grabSales || 0).toFixed(2)} />
              </div>
              <div>
                <Label>Aroi Dee Sales (฿)</Label>
                <Input disabled value={Number(formData.aroiDeeSales || 0).toFixed(2)} />
              </div>
              <div>
                <Label>QR Scan Sales (฿)</Label>
                <Input disabled value={Number(formData.qrScanSales || 0).toFixed(2)} />
              </div>
              <div>
                <Label>Cash Sales (฿)</Label>
                <Input disabled value={Number(formData.cashSales || 0).toFixed(2)} />
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <Label>Total Sales (฿)</Label>
                <Input disabled value={Number(formData.totalSales || 0).toFixed(2)} className="font-semibold" />
              </div>
            </div>
          </div>

          {/* Wages */}
          {wages.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Wages</h3>
              <div className="space-y-2">
                {wages.map((wage: any, index: number) => (
                  <div key={index} className="grid grid-cols-3 gap-4 p-3 border rounded">
                    <div>
                      <Label>Staff Name</Label>
                      <Input disabled value={wage.staffName} />
                    </div>
                    <div>
                      <Label>Amount (฿)</Label>
                      <Input disabled value={Number(wage.amount || 0).toFixed(2)} />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Input disabled value={wage.type} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shopping */}
          {shopping.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Shopping</h3>
              <div className="space-y-2">
                {shopping.map((shop: any, index: number) => (
                  <div key={index} className="grid grid-cols-3 gap-4 p-3 border rounded">
                    <div>
                      <Label>Item Purchased</Label>
                      <Input disabled value={shop.item} />
                    </div>
                    <div>
                      <Label>Amount (฿)</Label>
                      <Input disabled value={Number(shop.amount || 0).toFixed(2)} />
                    </div>
                    <div>
                      <Label>Shop Name</Label>
                      <Input disabled value={shop.shopName} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expenses Summary */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Expenses</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Gas Expense (฿)</Label>
                <Input disabled value={formData.gasExpense} />
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <Label>Total Expenses (฿)</Label>
                <Input disabled value={formData.totalExpenses} className="font-semibold" />
              </div>
            </div>
          </div>

          {/* Cash Management */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Cash Management</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>End Cash (฿)</Label>
                <Input disabled value={formData.endCash} />
              </div>
              <div>
                <Label>Banked Amount (฿)</Label>
                <Input disabled value={formData.bankedAmount} />
              </div>
            </div>
          </div>

          {/* Stock Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Stock Information</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Burger Buns Stock</Label>
                <Input disabled value={formData.burgerBunsStock} />
              </div>
              <div>
                <Label>Meat Weight (kg)</Label>
                <Input disabled value={formData.meatWeight} />
              </div>
              <div>
                <Label>Drink Stock Count</Label>
                <Input disabled value={formData.drinkStockCount} />
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4">Form Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <Label>Created At</Label>
                <div>{formData.createdAt ? new Date(formData.createdAt).toLocaleString() : 'N/A'}</div>
              </div>
              <div>
                <Label>Last Updated</Label>
                <div>{formData.updatedAt ? new Date(formData.updatedAt).toLocaleString() : 'N/A'}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FormView;