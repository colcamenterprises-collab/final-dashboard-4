import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Webhook, 
  RefreshCw, 
  Clock, 
  Zap, 
  CheckCircle, 
  XCircle, 
  ArrowRight,
  Bell,
  Database
} from "lucide-react";

export default function WebhookManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing webhooks
  const { data: webhooks = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/webhooks/list'],
    queryFn: async () => {
      const response = await fetch('/api/webhooks/list');
      if (!response.ok) throw new Error('Failed to fetch webhooks');
      return response.json();
    }
  });

  // Register webhooks mutation
  const registerMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/webhooks/register'),
    onSuccess: () => {
      toast({
        title: "Webhooks Registered",
        description: "Real-time webhooks have been set up successfully",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register webhooks",
        variant: "destructive",
      });
    }
  });

  return (
    <div className="container mx-auto p-2 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 max-w-7xl">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <Webhook className="h-5 w-5 sm:h-6 sm:w-6" />
        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold">Webhook Management</h1>
      </div>

      {/* Benefits Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Why Use Webhooks Instead of Polling?
          </CardTitle>
          <CardDescription>
            Real-time data updates vs scheduled polling comparison
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current Polling System */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <h3 className="font-semibold text-orange-700">Current: Scheduled Polling</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>4am daily sync only</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>Delayed data updates</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>Missing shift closures</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>Manual sync required</span>
                </div>
              </div>
            </div>

            {/* Webhook System */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-green-500" />
                <h3 className="font-semibold text-green-700">Webhooks: Real-time Updates</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Instant receipt notifications</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Automatic shift closures</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Real-time dashboard updates</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Zero manual intervention</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Webhook Events We Handle:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-3 w-3 text-blue-600" />
                <span><code>receipt.created</code> - New sale transactions</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="h-3 w-3 text-blue-600" />
                <span><code>receipt.updated</code> - Modified transactions</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="h-3 w-3 text-blue-600" />
                <span><code>shift.closed</code> - End of shift reports</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="h-3 w-3 text-blue-600" />
                <span><code>shift.opened</code> - Start of shift tracking</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Webhook Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Webhook Status
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="ml-auto"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading webhooks...</span>
            </div>
          ) : webhooks.length === 0 ? (
            <Alert>
              <Bell className="h-4 w-4" />
              <AlertDescription>
                No webhooks are currently registered. Register webhooks below to enable real-time data updates.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {webhooks.map((webhook: any) => (
                <div key={webhook.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={webhook.active ? "default" : "secondary"}>
                        {webhook.active ? "Active" : "Inactive"}
                      </Badge>
                      <span className="font-mono text-sm">{webhook.id}</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <strong>URL:</strong> {webhook.url}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {webhook.events?.map((event: string) => (
                      <Badge key={event} variant="outline" className="text-xs">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Registration */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Real-time Webhooks</CardTitle>
          <CardDescription>
            Register webhooks to receive instant notifications when receipts are created or shifts are closed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-semibold text-yellow-900 mb-2">Prerequisites:</h4>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• Valid Loyverse access token must be configured</li>
                <li>• Application must be deployed to a public URL</li>
                <li>• Webhook endpoint will be: <code>/api/webhooks/loyverse</code></li>
              </ul>
            </div>

            <Button
              onClick={() => registerMutation.mutate()}
              disabled={registerMutation.isPending}
              className="w-full sm:w-auto"
            >
              {registerMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Registering Webhooks...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-2" />
                  Register Webhooks
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle>Technical Implementation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-2">
            <p><strong>Webhook Endpoint:</strong> <code>/api/webhooks/loyverse</code></p>
            <p><strong>Authentication:</strong> HMAC SHA-256 signature validation</p>
            <p><strong>Retry Policy:</strong> Loyverse automatically retries failed webhooks</p>
            <p><strong>Timeout:</strong> 30 seconds maximum response time</p>
          </div>
          
          <Separator />
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Data Flow:</h4>
            <div className="text-sm space-y-1">
              <div>1. POS transaction occurs at restaurant</div>
              <div>2. Loyverse sends webhook notification instantly</div>
              <div>3. Our system processes and stores the data</div>
              <div>4. Dashboard updates in real-time</div>
              <div>5. Shift reports auto-generated when shift closes</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}