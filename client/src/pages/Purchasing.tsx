import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

const quickLodgeSchema = z.object({
  burgerBuns: z.coerce.number().min(0).optional().default(0),
  meat: z.coerce.number().min(0).optional().default(0),
  drinks: z.coerce.number().min(0).optional().default(0)
});

type QuickLodgeData = z.infer<typeof quickLodgeSchema>;

const Purchasing = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<QuickLodgeData>({
    resolver: zodResolver(quickLodgeSchema),
    defaultValues: {
      burgerBuns: 0,
      meat: 0,
      drinks: 0
    }
  });

  const lodgeMutation = useMutation({
    mutationFn: (data: QuickLodgeData) => apiRequest('/api/lodge-stock', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Stock lodged successfully!",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/stock'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to lodge stock. Please try again.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: QuickLodgeData) => {
    lodgeMutation.mutate(data);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Purchasing</h1>
        <p className="text-gray-600 mt-2">Manage procurement and inventory purchases</p>
      </div>

      {/* Section 1 - Shopping */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">Shopping</h2>
        </CardHeader>
        <CardContent>
          {/* Empty styled container - no placeholder data */}
          <div className="min-h-[200px] border-2 border-dashed border-gray-200 rounded-lg p-6 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p className="text-sm">Shopping management functionality</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2 - Quick Lodge */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">Quick Lodge</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">
                      Item
                    </th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">
                      Quantity Purchased
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-4 py-3 font-medium text-gray-900">
                      Burger Buns
                    </td>
                    <td className="border border-gray-200 px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        {...form.register("burgerBuns")}
                        className="w-full"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-4 py-3 font-medium text-gray-900">
                      Meat (kg)
                    </td>
                    <td className="border border-gray-200 px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        {...form.register("meat")}
                        className="w-full"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-4 py-3 font-medium text-gray-900">
                      Drinks
                    </td>
                    <td className="border border-gray-200 px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        {...form.register("drinks")}
                        className="w-full"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-end pt-4">
              <Button 
                type="submit" 
                className="bg-black text-white px-6 py-2"
                disabled={lodgeMutation.isPending}
              >
                {lodgeMutation.isPending ? 'Lodging...' : 'Lodge Stock'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Purchasing;