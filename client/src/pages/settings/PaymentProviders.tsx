// PATCH O14 Chunk 5 — Payment Provider Settings UI
import { useState, useEffect } from "react";
import axios from "../../utils/axiosInstance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, QrCode, Banknote, Settings2 } from "lucide-react";

interface PaymentProvider {
  id: string;
  provider: string;
  status: boolean;
  credentials: any;
  createdAt: string;
}

const PROVIDER_CONFIG = {
  stripe: {
    label: "Stripe",
    icon: CreditCard,
    description: "Credit/Debit Cards, Apple Pay, Google Pay",
    color: "bg-purple-100 text-purple-700"
  },
  scb: {
    label: "SCB",
    icon: QrCode,
    description: "Thai QR Payment, PromptPay",
    color: "bg-blue-100 text-blue-700"
  },
  cash: {
    label: "Cash",
    icon: Banknote,
    description: "Cash on Delivery / In-Store",
    color: "bg-green-100 text-green-700"
  },
  custom1: {
    label: "Custom 1",
    icon: Settings2,
    description: "Custom Payment Provider",
    color: "bg-slate-100 text-slate-700"
  },
  custom2: {
    label: "Custom 2",
    icon: Settings2,
    description: "Custom Payment Provider",
    color: "bg-slate-100 text-slate-700"
  }
};

export default function PaymentProviders() {
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await axios.get("/api/payment-providers/list");
      setProviders(res.data.providers || []);
    } catch (error) {
      console.error("Error fetching providers:", error);
    } finally {
      setLoading(false);
    }
  };

  const getProviderData = (providerKey: string): PaymentProvider | undefined => {
    return providers.find(p => p.provider === providerKey);
  };

  const updateProvider = async (
    providerKey: string,
    status: boolean,
    credentials: any
  ) => {
    setSaving(providerKey);
    try {
      await axios.post("/api/payment-providers/save", {
        provider: providerKey,
        status,
        credentials
      });
      toast({
        title: "Saved",
        description: `${PROVIDER_CONFIG[providerKey as keyof typeof PROVIDER_CONFIG]?.label || providerKey} settings updated`
      });
      await fetchProviders();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save",
        variant: "destructive"
      });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900" data-testid="page-title">
          Payment Providers
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Configure payment gateways for your restaurant
        </p>
      </div>

      <div className="grid gap-4">
        {Object.entries(PROVIDER_CONFIG).map(([key, config]) => {
          const providerData = getProviderData(key);
          const Icon = config.icon;
          const isEnabled = providerData?.status || false;
          const credentials = providerData?.credentials || {};

          return (
            <Card key={key} data-testid={`provider-card-${key}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{config.label}</CardTitle>
                      <p className="text-xs text-slate-500">{config.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={isEnabled ? "default" : "secondary"}>
                      {isEnabled ? "Active" : "Inactive"}
                    </Badge>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) =>
                        updateProvider(key, checked, credentials)
                      }
                      disabled={saving === key}
                      data-testid={`toggle-${key}`}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <label className="text-xs font-medium text-slate-600">
                    Credentials (JSON)
                  </label>
                  <Textarea
                    placeholder='{"apiKey": "...", "secretKey": "..."}'
                    defaultValue={
                      Object.keys(credentials).length > 0
                        ? JSON.stringify(credentials, null, 2)
                        : ""
                    }
                    className="font-mono text-xs min-h-[80px]"
                    data-testid={`credentials-${key}`}
                    onBlur={(e) => {
                      try {
                        const parsed = e.target.value
                          ? JSON.parse(e.target.value)
                          : {};
                        if (JSON.stringify(parsed) !== JSON.stringify(credentials)) {
                          updateProvider(key, isEnabled, parsed);
                        }
                      } catch {
                        toast({
                          title: "Invalid JSON",
                          description: "Please enter valid JSON for credentials",
                          variant: "destructive"
                        });
                      }
                    }}
                  />
                  {saving === key && (
                    <p className="text-xs text-slate-500">Saving...</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
