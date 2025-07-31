import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChefHat } from "lucide-react";

export default function RecipeManagement() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <ChefHat className="w-8 h-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Recipe Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recipe System</CardTitle>
          <CardDescription>
            Manage restaurant recipes and ingredient costs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <ChefHat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Recipe management system will be implemented here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}