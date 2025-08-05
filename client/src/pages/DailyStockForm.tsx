import React, { useEffect, useState } from 'react'
import BackButton from '../components/BackButton'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { DailyStockSchema, type DailyStockFormData } from '../schemas/dailySalesSchema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import type { FoodCostingItem } from '../data/foodCostingItems'

export default function DailyStockForm() {
  const [foodCostingItems, setFoodCostingItems] = useState<FoodCostingItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  
  const form = useForm<DailyStockFormData>({
    resolver: zodResolver(DailyStockSchema),
    defaultValues: {
      shift_time: '',
      completed_by: '',
      grab_sales: 0,
      aroi_dee_sales: 0,
      qr_scan_sales: 0,
      cash_sales: 0,
      total_sales: 0,
      starting_cash: 0,
      ending_cash: 0,
      burger_buns_stock: 0,
      meat_weight: 0,
      buns_ordered: 0,
      total_expenses: 0
    }
  })

  // Load food costing items from CSV via API
  useEffect(() => {
    const loadFoodCostings = async () => {
      try {
        const response = await fetch('/api/food-costings')
        if (response.ok) {
          const data = await response.json()
          setFoodCostingItems(data)
        } else {
          console.warn('Could not load food costing data from CSV')
        }
      } catch (error) {
        console.error('Error loading food costings:', error)
      }
    }
    
    loadFoodCostings()
  }, [])

  const onSubmit = async (data: DailyStockFormData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/daily-stock-sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (response.ok) {
        toast({
          title: "Form Submitted Successfully",
          description: "Daily sales and stock data has been saved and email notification sent."
        })
        form.reset()
      } else {
        throw new Error('Failed to submit form')
      }
    } catch (error) {
      console.error('Submission error:', error)
      toast({
        title: "Submission Failed",
        description: "Please check your data and try again.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <BackButton />
      
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 font-['Poppins']">Daily Sales & Stock</h1>
        <p className="text-gray-600 mt-2">Fort Knox Locked Form System</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
        {/* Section 1: Shift Information */}
        <Card>
          <CardHeader>
            <CardTitle>1. Shift Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shift_time">Shift Time</Label>
              <Input
                id="shift_time"
                type="text"
                placeholder="e.g., Evening (5PM-3AM)"
                {...form.register('shift_time')}
              />
            </div>
            <div>
              <Label htmlFor="completed_by">Completed By</Label>
              <Input
                id="completed_by"
                type="text"
                placeholder="Staff member name"
                {...form.register('completed_by')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Sales Information */}
        <Card>
          <CardHeader>
            <CardTitle>2. Sales Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="grab_sales">Grab Sales (THB)</Label>
              <Input
                id="grab_sales"
                type="number"
                step="0.01"
                {...form.register('grab_sales', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="aroi_dee_sales">Aroi Dee Sales (THB)</Label>
              <Input
                id="aroi_dee_sales"
                type="number"
                step="0.01"
                {...form.register('aroi_dee_sales', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="qr_scan_sales">QR Scan Sales (THB)</Label>
              <Input
                id="qr_scan_sales"
                type="number"
                step="0.01"
                {...form.register('qr_scan_sales', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="cash_sales">Cash Sales (THB)</Label>
              <Input
                id="cash_sales"
                type="number"
                step="0.01"
                {...form.register('cash_sales', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="total_sales">Total Sales (THB)</Label>
              <Input
                id="total_sales"
                type="number"
                step="0.01"
                {...form.register('total_sales', { valueAsNumber: true })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Cash Management (includes Burger Buns & Meat Count) */}
        <Card>
          <CardHeader>
            <CardTitle>5. Cash Management</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="starting_cash">Starting Cash (THB)</Label>
              <Input
                id="starting_cash"
                type="number"
                step="0.01"
                {...form.register('starting_cash', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="ending_cash">Ending Cash (THB)</Label>
              <Input
                id="ending_cash"
                type="number"
                step="0.01"
                {...form.register('ending_cash', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="burger_buns_stock">Burger Buns Stock</Label>
              <Input
                id="burger_buns_stock"
                type="number"
                {...form.register('burger_buns_stock', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="meat_weight">Meat Weight (kg)</Label>
              <Input
                id="meat_weight"
                type="number"
                step="0.1"
                {...form.register('meat_weight', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="buns_ordered">Buns Ordered</Label>
              <Input
                id="buns_ordered"
                type="number"
                {...form.register('buns_ordered', { valueAsNumber: true })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Stock Sections from CSV */}
        {foodCostingItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Stock Items (From CSV Source)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {foodCostingItems.map((item) => (
                <div key={item.key}>
                  <Label htmlFor={item.key}>
                    {item.name} ({item.unit})
                  </Label>
                  <Input
                    id={item.key}
                    type="number"
                    placeholder="0"
                    min="0"
                    {...form.register(`fresh_food_stock.${item.key}` as any, { valueAsNumber: true })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Supplier: {item.supplier} | Cost: ฿{item.cost}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Section 13: Total Summary */}
        <Card>
          <CardHeader>
            <CardTitle>13. Total Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="total_expenses">Total Expenses (THB)</Label>
              <Input
                id="total_expenses"
                type="number"
                step="0.01"
                {...form.register('total_expenses', { valueAsNumber: true })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button 
            type="submit" 
            size="lg"
            disabled={isSubmitting}
            className="min-w-[200px]"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Form'}
          </Button>
        </div>
      </form>
    </div>
  )
}