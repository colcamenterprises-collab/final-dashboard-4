import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function TestEmailPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const testSendFormSummary = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      const testFormData = {
        shiftDate: "2025-08-04",
        shiftType: "Evening",
        completedBy: "Test User",
        totalSales: "1500.50",
        grabSales: "800.25",
        cashSales: "700.25",
        startingCash: "500.00",
        endingCash: "600.75"
      };

      const response = await fetch('/api/send-form-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ formData: testFormData })
      });
      
      const data = await response.json();
      setResult(data);
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Form summary email sent successfully!",
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to send email",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setResult({ error: errorMessage });
      toast({
        title: "Error",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testSendLastFormSummary = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/send-last-form-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      setResult(data);
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Latest form summary email sent successfully!",
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to send email",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setResult({ error: errorMessage });
      toast({
        title: "Error",
        description: "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Functionality Test</CardTitle>
          <CardDescription>
            Test the email endpoints for form summaries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={testSendFormSummary}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Sending...' : 'Test Send Form Summary Email'}
          </Button>

          <Button 
            onClick={testSendLastFormSummary}
            disabled={isLoading}
            className="w-full"
            variant="outline"
          >
            {isLoading ? 'Sending...' : 'Test Send Latest Form Summary Email'}
          </Button>
          
          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">API Response</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}