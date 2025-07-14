import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Save, Send } from 'lucide-react';

export default function SimpleStockForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    completedBy: '',
    shiftType: 'Night Shift',
    shiftDate: new Date().toISOString().split('T')[0],
    startingCash: '',
    endingCash: '',
    totalSales: '',
    notes: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveDraft = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/simple-stock-form/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          isDraft: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      toast({
        title: "Draft Saved Successfully",
        description: `Draft saved with ID: ${result.id}`,
        className: "bg-green-50 border-green-200 text-green-800"
      });
    } catch (error) {
      console.error('Draft save error:', error);
      toast({
        title: "Error",
        description: "Failed to save draft. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const submitForm = async () => {
    // Basic validation
    if (!formData.completedBy.trim()) {
      toast({
        title: "Required Field",
        description: "Please enter your name.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/simple-stock-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          isDraft: false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      toast({
        title: "Form Submitted Successfully",
        description: `Form submitted with ID: ${result.id}`,
        className: "bg-green-50 border-green-200 text-green-800"
      });

      // Reset form
      setFormData({
        completedBy: '',
        shiftType: 'Night Shift',
        shiftDate: new Date().toISOString().split('T')[0],
        startingCash: '',
        endingCash: '',
        totalSales: '',
        notes: ''
      });
    } catch (error) {
      console.error('Form submission error:', error);
      toast({
        title: "Error",
        description: "Failed to submit form. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Simple Stock & Sales Form</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="completedBy">Staff Name *</Label>
              <Input
                id="completedBy"
                value={formData.completedBy}
                onChange={(e) => handleInputChange('completedBy', e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>

            <div>
              <Label htmlFor="shiftType">Shift Type</Label>
              <Select value={formData.shiftType} onValueChange={(value) => handleInputChange('shiftType', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Night Shift">Night Shift</SelectItem>
                  <SelectItem value="Day Shift">Day Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="shiftDate">Shift Date</Label>
              <Input
                id="shiftDate"
                type="date"
                value={formData.shiftDate}
                onChange={(e) => handleInputChange('shiftDate', e.target.value)}
              />
            </div>
          </div>

          {/* Cash Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="startingCash">Starting Cash (฿)</Label>
              <Input
                id="startingCash"
                type="number"
                step="0.01"
                value={formData.startingCash}
                onChange={(e) => handleInputChange('startingCash', e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="endingCash">Ending Cash (฿)</Label>
              <Input
                id="endingCash"
                type="number"
                step="0.01"
                value={formData.endingCash}
                onChange={(e) => handleInputChange('endingCash', e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="totalSales">Total Sales (฿)</Label>
              <Input
                id="totalSales"
                type="number"
                step="0.01"
                value={formData.totalSales}
                onChange={(e) => handleInputChange('totalSales', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              type="button"
              onClick={saveDraft}
              disabled={loading}
              className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : "Save as Draft"}
            </Button>
            
            <Button 
              type="button"
              onClick={submitForm}
              disabled={loading}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            >
              <Send className="h-4 w-4 mr-2" />
              {loading ? "Submitting..." : "Submit Form"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}