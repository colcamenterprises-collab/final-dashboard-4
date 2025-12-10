import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function TenantSwitcher() {
  const [tenant, setTenant] = useState(
    localStorage.getItem("restaurantId") || "sbb-master-001"
  );
  const { toast } = useToast();

  const handleSwitch = () => {
    localStorage.setItem("restaurantId", tenant);
    toast({ title: "Success", description: `Switched to restaurant: ${tenant}` });
    window.location.reload();
  };

  return (
    <div className="p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Restaurant Switcher</CardTitle>
          <p className="text-sm text-slate-500">Switch between restaurant tenants (SaaS mode)</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenant">Restaurant ID</Label>
            <Input
              id="tenant"
              value={tenant}
              onChange={(e) => setTenant(e.target.value)}
              placeholder="sbb-master-001"
              data-testid="input-tenant-id"
            />
          </div>
          <Button 
            onClick={handleSwitch}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            data-testid="button-switch-tenant"
          >
            Switch Restaurant
          </Button>
          <p className="text-xs text-slate-400">
            Current: {localStorage.getItem("restaurantId") || "sbb-master-001"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
