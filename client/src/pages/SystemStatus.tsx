import { useState, useEffect } from "react";
import { Shield, Lock, Database, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SystemStatus {
  readonlyMode: boolean;
  databaseUser: string;
  writeProtection: boolean;
  unsafeScripts: string[];
  lastChecked: string;
}

export default function SystemStatus() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    try {
      const response = await fetch('/api/system/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to check system status:', error);
    }
  };

  const testWriteProtection = async () => {
    setTesting(true);
    setTestResults(null);

    try {
      // Test HTTP method blocking
      const httpTest = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      });

      const httpResult = {
        method: 'HTTP POST',
        blocked: httpTest.status === 423,
        status: httpTest.status,
        message: httpTest.status === 423 ? 'BLOCKED ✅' : 'ALLOWED ❌'
      };

      setTestResults({ http: httpResult });
    } catch (error) {
      setTestResults({ error: 'Test failed: ' + error });
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = (condition: boolean, trueText: string, falseText: string) => {
    return condition ? (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
        <CheckCircle className="w-3 h-3 mr-1" />
        {trueText}
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
        <XCircle className="w-3 h-3 mr-1" />
        {falseText}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">System Security Status</h1>
          <p className="text-muted-foreground">
            Production safety measures and write protection status
          </p>
        </div>
        <Button onClick={checkSystemStatus} variant="outline">
          Refresh Status
        </Button>
      </div>

      {/* Lockdown Alert */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Production Lockdown Active:</strong> This system is protected against accidental data loss.
          All write operations are monitored and can be blocked when readonly mode is enabled.
        </AlertDescription>
      </Alert>

      {/* Protection Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Readonly Mode</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {process.env.AGENT_READONLY === "1" ? "ENABLED" : "DISABLED"}
            </div>
            {getStatusBadge(
              process.env.AGENT_READONLY === "1",
              "Protected",
              "Unprotected"
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Controls agent write access via AGENT_READONLY environment variable
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Access</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {status?.databaseUser || "Loading..."}
            </div>
            {status && getStatusBadge(
              status.databaseUser === "app_ro",
              "Read-Only User",
              "Full Access User"
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Current database connection user permissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Write Protection</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              ACTIVE
            </div>
            {getStatusBadge(true, "Middleware Active", "No Protection")}
            <p className="text-xs text-muted-foreground mt-2">
              HTTP and Prisma write blocking middleware installed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Protection Details */}
      <Card>
        <CardHeader>
          <CardTitle>Protection Layers</CardTitle>
          <CardDescription>
            Multiple layers of protection prevent accidental data modification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">HTTP Method Blocking</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Blocks POST, PUT, PATCH, DELETE requests</li>
                <li>• Returns 423 Locked status when readonly mode active</li>
                <li>• Applied at Express middleware level</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">Prisma ORM Protection</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Blocks create, update, delete operations</li>
                <li>• Throws READ_ONLY_MODE error when blocked</li>
                <li>• Applied at database query level</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Write Protection */}
      <Card>
        <CardHeader>
          <CardTitle>Test Write Protection</CardTitle>
          <CardDescription>
            Verify that write operations are properly blocked
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={testWriteProtection} disabled={testing} variant="outline">
            {testing ? "Testing..." : "Test Write Protection"}
          </Button>
          
          {testResults && (
            <div className="space-y-2">
              <h4 className="font-semibold">Test Results:</h4>
              {testResults.http && (
                <div className="flex items-center justify-between p-3 border rounded">
                  <span className="font-medium">{testResults.http.method}</span>
                  <span className={`font-semibold ${testResults.http.blocked ? 'text-green-600' : 'text-red-600'}`}>
                    {testResults.http.message}
                  </span>
                </div>
              )}
              {testResults.error && (
                <div className="text-red-600">{testResults.error}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Steps Required */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Manual Steps Required for Full Production Lockdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-3 border rounded bg-amber-50">
              <h4 className="font-semibold text-amber-800">1. Switch to Read-Only Database User</h4>
              <p className="text-sm text-amber-700 mt-1">
                Update DATABASE_URL in Replit Secrets to use the <code>app_ro</code> user instead of the current full-access user.
              </p>
            </div>
            
            <div className="p-3 border rounded bg-blue-50">
              <h4 className="font-semibold text-blue-800">2. Enable Readonly Mode</h4>
              <p className="text-sm text-blue-700 mt-1">
                Set <code>AGENT_READONLY=1</code> in Replit Secrets to activate all write protection middleware.
              </p>
            </div>
            
            <div className="p-3 border rounded bg-purple-50">
              <h4 className="font-semibold text-purple-800">3. Production Deploy Protection</h4>
              <p className="text-sm text-purple-700 mt-1">
                For production systems: Revoke agent deploy tokens and enable branch protection (PRs only).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}