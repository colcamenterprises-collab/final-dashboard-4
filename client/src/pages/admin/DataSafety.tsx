import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Database, Download, AlertCircle, CheckCircle, History, RefreshCw, Clock } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function DataSafety() {
  const [importRunning, setImportRunning] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);

  const { data: backupStatus, isLoading: backupLoading } = useQuery({
    queryKey: ["/api/admin/backup/status"],
    refetchInterval: 30000
  });

  const { data: historicalStatus, isLoading: historicalLoading } = useQuery({
    queryKey: ["/api/admin/historical/status"],
    refetchInterval: 30000
  });

  const runBackupMutation = useMutation({
    mutationFn: async () => {
      setBackupRunning(true);
      const response = await apiRequest("/api/admin/backup/run", { method: "POST" });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backup/status"] });
      setBackupRunning(false);
    },
    onError: () => {
      setBackupRunning(false);
    }
  });

  const runImportMutation = useMutation({
    mutationFn: async () => {
      setImportRunning(true);
      const response = await apiRequest("/api/admin/historical/import", {
        method: "POST",
        body: JSON.stringify({ startDate: "2025-07-01" })
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/historical/status"] });
      setImportRunning(false);
    },
    onError: () => {
      setImportRunning(false);
    }
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-data-safety">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-emerald-600" />
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Data Safety & Historical Import</h1>
          <p className="text-sm text-slate-500">Backup system and Loyverse historical data management</p>
        </div>
      </div>

      <Tabs defaultValue="backup" className="space-y-6">
        <TabsList>
          <TabsTrigger value="backup" data-testid="tab-backup">
            <Database className="w-4 h-4 mr-2" />
            Backup System
          </TabsTrigger>
          <TabsTrigger value="historical" data-testid="tab-historical">
            <History className="w-4 h-4 mr-2" />
            Historical Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backup" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Last Successful Backup
                </CardTitle>
              </CardHeader>
              <CardContent>
                {backupLoading ? (
                  <div className="text-slate-400">Loading...</div>
                ) : backupStatus?.status?.lastBackup ? (
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-slate-800" data-testid="last-backup-date">
                      {formatDate(backupStatus.status.lastBackup.createdAt)}
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {backupStatus.status.lastBackup.type}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {formatBytes(backupStatus.status.lastBackup.sizeBytes)}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="text-amber-600 font-medium" data-testid="no-backup">No backups found</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  Backup Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {backupLoading ? (
                  <div className="text-slate-400">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2" data-testid="backup-status">
                      {backupStatus?.status?.isHealthy ? (
                        <>
                          <CheckCircle className="w-6 h-6 text-emerald-600" />
                          <Badge className="bg-emerald-100 text-emerald-700">OK</Badge>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-6 h-6 text-amber-500" />
                          <Badge className="bg-amber-100 text-amber-700">WARNING</Badge>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {backupStatus?.status?.healthMessage}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Run Backup Now</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => runBackupMutation.mutate()}
                disabled={backupRunning || runBackupMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
                data-testid="btn-run-backup"
              >
                {backupRunning || runBackupMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Running Backup...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Run Backup Now
                  </>
                )}
              </Button>
              {runBackupMutation.isSuccess && (
                <p className="mt-2 text-sm text-emerald-600">Backup completed successfully!</p>
              )}
              {runBackupMutation.isError && (
                <p className="mt-2 text-sm text-red-600">Backup failed. Check logs.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Recent Backups</CardTitle>
            </CardHeader>
            <CardContent>
              {backupStatus?.status?.recentBackups?.length > 0 ? (
                <div className="space-y-2">
                  {backupStatus.status.recentBackups.map((backup: any) => (
                    <div key={backup.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={backup.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}
                        >
                          {backup.status}
                        </Badge>
                        <span className="text-xs text-slate-500">{backup.type}</span>
                      </div>
                      <span className="text-xs text-slate-400">{formatDate(backup.createdAt)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No backup history</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historical" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Shifts Imported</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-800" data-testid="shifts-imported">
                  {historicalLoading ? "..." : (historicalStatus?.stats?.shiftsImported || 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600" data-testid="total-revenue">
                  {historicalLoading ? "..." : formatCurrency(historicalStatus?.stats?.totalRevenue || 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-800" data-testid="total-orders">
                  {historicalLoading ? "..." : (historicalStatus?.stats?.totalOrders || 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Date Range</CardTitle>
            </CardHeader>
            <CardContent>
              {historicalStatus?.stats?.dateRange?.earliest ? (
                <div className="text-sm text-slate-600">
                  <span className="font-medium">From:</span> {historicalStatus.stats.dateRange.earliest}
                  <span className="mx-2">→</span>
                  <span className="font-medium">To:</span> {historicalStatus.stats.dateRange.latest}
                </div>
              ) : (
                <div className="text-sm text-slate-400">No historical data imported yet</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Import Historical Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-slate-500">
                  Import all Loyverse sales data from July 1, 2025 to today. This is a read-only operation - no existing data will be modified.
                </p>
                <Button
                  onClick={() => runImportMutation.mutate()}
                  disabled={importRunning || runImportMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  data-testid="btn-run-import"
                >
                  {importRunning || runImportMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <History className="w-4 h-4 mr-2" />
                      Import Historical Data
                    </>
                  )}
                </Button>
                {runImportMutation.isSuccess && (
                  <p className="text-sm text-emerald-600">Import completed successfully!</p>
                )}
                {runImportMutation.isError && (
                  <p className="text-sm text-red-600">Import failed. Check logs.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
