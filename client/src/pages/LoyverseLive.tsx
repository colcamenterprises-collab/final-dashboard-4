import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  RefreshCw, 
  Database, 
  Users, 
  ShoppingBag, 
  Store, 
  Receipt,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  Download
} from 'lucide-react';

interface LoyverseStatus {
  connected: boolean;
  message: string;
}

interface SyncResponse {
  success: boolean;
  message: string;
  receiptsCount?: number;
  itemsCount?: number;
  customersCount?: number;
}

interface LoyverseStore {
  id: string;
  name: string;
  description?: string;
  timezone: string;
  address?: string;
  city?: string;
  contact_email?: string;
}

export default function LoyverseLive() {
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Connection status query
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<LoyverseStatus>({
    queryKey: ['/api/loyverse/live/status'],
    refetchInterval: 30000 // Check status every 30 seconds
  });

  // Stores query
  const { data: storesData, isLoading: storesLoading } = useQuery<{stores: LoyverseStore[]}>({
    queryKey: ['/api/loyverse/live/stores'],
    enabled: status?.connected === true
  });

  // Sync mutations
  const syncReceiptsMutation = useMutation({
    mutationFn: () => fetch('/api/loyverse/live/sync-receipts', { method: 'POST' }).then(res => res.json()),
    onSuccess: (data: SyncResponse) => {
      if (data.success) {
        toast({
          title: "Receipts Synced",
          description: data.message,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      } else {
        toast({
          title: "Sync Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Sync Error",
        description: "Failed to sync receipts from Loyverse",
        variant: "destructive",
      });
    }
  });

  const syncItemsMutation = useMutation({
    mutationFn: () => fetch('/api/loyverse/live/sync-items', { method: 'POST' }).then(res => res.json()),
    onSuccess: (data: SyncResponse) => {
      if (data.success) {
        toast({
          title: "Menu Items Synced",
          description: data.message,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/menu'] });
      } else {
        toast({
          title: "Sync Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Sync Error",
        description: "Failed to sync menu items from Loyverse",
        variant: "destructive",
      });
    }
  });

  const syncCustomersMutation = useMutation({
    mutationFn: () => fetch('/api/loyverse/live/sync-customers', { method: 'POST' }).then(res => res.json()),
    onSuccess: (data: SyncResponse) => {
      if (data.success) {
        toast({
          title: "Customers Synced",
          description: data.message,
        });
      } else {
        toast({
          title: "Sync Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Sync Error",
        description: "Failed to sync customers from Loyverse",
        variant: "destructive",
      });
    }
  });

  const startRealtimeMutation = useMutation({
    mutationFn: (intervalMinutes: number) => 
      fetch('/api/loyverse/live/start-realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMinutes })
      }).then(res => res.json()),
    onSuccess: (data: SyncResponse) => {
      if (data.success) {
        setRealtimeEnabled(true);
        toast({
          title: "Real-time Sync Started",
          description: data.message,
        });
      } else {
        toast({
          title: "Failed to Start Real-time Sync",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start real-time sync",
        variant: "destructive",
      });
    }
  });

  const getStatusIcon = () => {
    if (statusLoading) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (status?.connected) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getStatusBadge = () => {
    if (statusLoading) return <Badge variant="secondary">Checking...</Badge>;
    if (status?.connected) return <Badge variant="default" className="bg-green-600">Connected</Badge>;
    return <Badge variant="destructive">Disconnected</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Loyverse Integration</h1>
          <p className="text-muted-foreground">
            Real-time synchronization with your Loyverse POS system
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetchStatus()}
          disabled={statusLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${statusLoading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Connection Status
          </CardTitle>
          <CardDescription>
            Current status of Loyverse API connection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                {getStatusBadge()}
              </div>
              <p className="text-sm text-muted-foreground">
                {status?.message || 'Checking connection...'}
              </p>
            </div>
            {!status?.connected && (
              <AlertCircle className="h-8 w-8 text-amber-500" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Store Information */}
      {status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Connected Stores
            </CardTitle>
            <CardDescription>
              Your Loyverse store information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {storesLoading ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Loading stores...</span>
              </div>
            ) : storesData?.stores?.length ? (
              <div className="space-y-4">
                {storesData.stores.map((store) => (
                  <div key={store.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{store.name}</h3>
                        {store.description && (
                          <p className="text-sm text-muted-foreground">{store.description}</p>
                        )}
                        <div className="mt-2 space-y-1 text-sm">
                          {store.address && <p>📍 {store.address}</p>}
                          {store.city && <p>🏙️ {store.city}</p>}
                          {store.contact_email && <p>📧 {store.contact_email}</p>}
                          <p>🕒 Timezone: {store.timezone}</p>
                        </div>
                      </div>
                      <Badge variant="outline">ID: {store.id}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No stores found</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual Sync Controls */}
      {status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Manual Data Sync
            </CardTitle>
            <CardDescription>
              Manually synchronize data from Loyverse POS
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                onClick={() => syncReceiptsMutation.mutate()}
                disabled={syncReceiptsMutation.isPending}
                className="flex items-center gap-2"
              >
                {syncReceiptsMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Receipt className="h-4 w-4" />
                )}
                Sync Today's Receipts
              </Button>

              <Button
                variant="outline"
                onClick={() => syncItemsMutation.mutate()}
                disabled={syncItemsMutation.isPending}
                className="flex items-center gap-2"
              >
                {syncItemsMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingBag className="h-4 w-4" />
                )}
                Sync Menu Items
              </Button>

              <Button
                variant="outline"
                onClick={() => syncCustomersMutation.mutate()}
                disabled={syncCustomersMutation.isPending}
                className="flex items-center gap-2"
              >
                {syncCustomersMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                Sync Customers
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Sync */}
      {status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Real-time Synchronization
            </CardTitle>
            <CardDescription>
              Automatically sync receipts and transactions in real-time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-sync Status</p>
                  <p className="text-sm text-muted-foreground">
                    {realtimeEnabled ? 'Active - syncing every 5 minutes' : 'Inactive'}
                  </p>
                </div>
                <Badge variant={realtimeEnabled ? "default" : "secondary"}>
                  {realtimeEnabled ? 'Running' : 'Stopped'}
                </Badge>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">Sync Intervals</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    variant={realtimeEnabled ? "secondary" : "default"}
                    size="sm"
                    onClick={() => startRealtimeMutation.mutate(1)}
                    disabled={startRealtimeMutation.isPending}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    1 min
                  </Button>
                  <Button
                    variant={realtimeEnabled ? "secondary" : "default"}
                    size="sm"
                    onClick={() => startRealtimeMutation.mutate(5)}
                    disabled={startRealtimeMutation.isPending}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    5 min
                  </Button>
                  <Button
                    variant={realtimeEnabled ? "secondary" : "default"}
                    size="sm"
                    onClick={() => startRealtimeMutation.mutate(15)}
                    disabled={startRealtimeMutation.isPending}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    15 min
                  </Button>
                  <Button
                    variant={realtimeEnabled ? "secondary" : "default"}
                    size="sm"
                    onClick={() => startRealtimeMutation.mutate(30)}
                    disabled={startRealtimeMutation.isPending}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    30 min
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection Help */}
      {!status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Connection Setup
            </CardTitle>
            <CardDescription>
              How to connect your Loyverse POS system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                  Setup Required
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-amber-700 dark:text-amber-300">
                  <li>Login to your Loyverse Back Office</li>
                  <li>Go to Settings → Integrations → Access Tokens</li>
                  <li>Click "+ Add access token"</li>
                  <li>Enter name: "Restaurant Dashboard API"</li>
                  <li>Set expiration (optional)</li>
                  <li>Click "Save" and copy the token</li>
                  <li>Contact support to configure the token</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}