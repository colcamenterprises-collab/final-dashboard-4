import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Save, CheckCircle, AlertCircle } from 'lucide-react';

interface RecipeMapping {
  channel: string;
  channelSku: string;
  recipeId: number | null;
  recipeName: string | null;
  mapped: boolean;
  salesCount: number;
}

interface Recipe {
  id: number;
  name: string;
}

interface MappingResponse {
  mappings: RecipeMapping[];
  recipes: Recipe[];
  stats: {
    totalSkus: number;
    mappedSkus: number;
    unmappedSkus: number;
  };
}

export default function RecipeMappingPage() {
  const { toast } = useToast();
  const [editedMappings, setEditedMappings] = useState<Record<string, number>>({});
  
  const { data, isLoading, refetch } = useQuery<MappingResponse>({
    queryKey: ['/api/recipe-mapping'],
  });
  
  const saveMutation = useMutation({
    mutationFn: async ({ channel, channelSku, recipeId }: { channel: string; channelSku: string; recipeId: number }) => {
      return apiRequest('/api/recipe-mapping', {
        method: 'POST',
        body: JSON.stringify({ channel, channelSku, recipeId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipe-mapping'] });
      toast({ title: 'Mapping saved', description: 'Recipe mapping updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
  
  const rebuildMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/rebuild-usage', { method: 'POST' });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: 'Rebuild Complete', 
        description: `Completed in ${data.durationMs}ms`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/recipe-mapping'] });
    },
    onError: (error: any) => {
      toast({ title: 'Rebuild Error', description: error.message, variant: 'destructive' });
    },
  });
  
  const handleRecipeChange = (key: string, recipeId: number) => {
    setEditedMappings(prev => ({ ...prev, [key]: recipeId }));
  };
  
  const handleSave = (mapping: RecipeMapping) => {
    const key = `${mapping.channel}:${mapping.channelSku}`;
    const recipeId = editedMappings[key];
    if (recipeId) {
      saveMutation.mutate({
        channel: mapping.channel,
        channelSku: mapping.channelSku,
        recipeId,
      });
      setEditedMappings(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };
  
  const handleSaveAll = () => {
    Object.entries(editedMappings).forEach(([key, recipeId]) => {
      const [channel, channelSku] = key.split(':');
      saveMutation.mutate({ channel, channelSku, recipeId });
    });
    setEditedMappings({});
  };
  
  if (isLoading) {
    return (
      <div className="p-6" data-testid="recipe-mapping-loading">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }
  
  const mappings = data?.mappings || [];
  const recipes = data?.recipes || [];
  const stats = data?.stats || { totalSkus: 0, mappedSkus: 0, unmappedSkus: 0 };
  
  return (
    <div className="p-6 space-y-6" data-testid="recipe-mapping-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Recipe Mapping</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Map external POS SKUs to internal recipes for cost tracking
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          
          {Object.keys(editedMappings).length > 0 && (
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={saveMutation.isPending}
              data-testid="button-save-all"
            >
              <Save className="w-4 h-4 mr-1" />
              Save All ({Object.keys(editedMappings).length})
            </Button>
          )}
          
          <Button
            size="sm"
            variant="default"
            onClick={() => rebuildMutation.mutate()}
            disabled={rebuildMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
            data-testid="button-rebuild-usage"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${rebuildMutation.isPending ? 'animate-spin' : ''}`} />
            {rebuildMutation.isPending ? 'Rebuilding...' : 'Rebuild Usage'}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalSkus}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">Total SKUs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-emerald-600">{stats.mappedSkus}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">Mapped</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">{stats.unmappedSkus}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">Unmapped</div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">SKU to Recipe Mappings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Channel</TableHead>
                <TableHead className="text-xs">SKU</TableHead>
                <TableHead className="text-xs">Recipe</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
                <TableHead className="text-xs text-right">Sales</TableHead>
                <TableHead className="text-xs text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((mapping) => {
                const key = `${mapping.channel}:${mapping.channelSku}`;
                const hasEdit = key in editedMappings;
                const currentRecipeId = hasEdit ? editedMappings[key] : mapping.recipeId;
                
                return (
                  <TableRow key={key} data-testid={`row-mapping-${mapping.channelSku}`}>
                    <TableCell className="text-xs font-mono">{mapping.channel}</TableCell>
                    <TableCell className="text-xs font-mono">{mapping.channelSku}</TableCell>
                    <TableCell>
                      <Select
                        value={currentRecipeId?.toString() || ''}
                        onValueChange={(value) => handleRecipeChange(key, parseInt(value, 10))}
                      >
                        <SelectTrigger className="h-8 text-xs w-[200px]" data-testid={`select-recipe-${mapping.channelSku}`}>
                          <SelectValue placeholder="Select recipe..." />
                        </SelectTrigger>
                        <SelectContent>
                          {recipes.map((recipe) => (
                            <SelectItem key={recipe.id} value={recipe.id.toString()}>
                              {recipe.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      {mapping.mapped ? (
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Mapped
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Unmapped
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">{mapping.salesCount}</TableCell>
                    <TableCell className="text-right">
                      {hasEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSave(mapping)}
                          disabled={saveMutation.isPending}
                          className="h-7 text-xs"
                          data-testid={`button-save-${mapping.channelSku}`}
                        >
                          Save
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
