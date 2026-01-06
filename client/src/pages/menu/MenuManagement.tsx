import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Image, Upload, Globe, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ModifierEditor from "@/components/menu/ModifierEditor";

type Recipe = { id: number; name: string; totalCost: number };
type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: string;
  isActive: boolean;
  isOnlineEnabled: boolean;
  imageUrl: string | null;
  description: string | null;
  recipes: { id: number; name: string }[];
};

const CATEGORIES = ["burgers", "sides", "drinks", "deals"];

export default function MenuManagement() {
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);
  
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<number[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: menuData, isLoading } = useQuery<{ ok: boolean; items: MenuItem[] }>({
    queryKey: ["/api/menu-management"],
  });

  const { data: recipesData } = useQuery<{ recipes: Recipe[] }>({
    queryKey: ["/api/recipe-authority"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/menu-management", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-management"] });
      toast({ title: "Menu item created" });
      resetForm();
      setShowAddModal(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/menu-management/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-management"] });
      toast({ title: "Menu item updated" });
      resetForm();
      setEditingItem(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/menu-management/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-management"] });
      toast({ title: "Menu item deleted" });
    },
  });

  const toggleOnlineMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await apiRequest("POST", `/api/menu-management/${id}/toggle-online`, { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-management"] });
    },
  });

  const resetForm = () => {
    setName("");
    setCategory("");
    setPrice("");
    setDescription("");
    setSelectedRecipeIds([]);
    setImageUrl("");
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setPrice(item.price);
    setDescription(item.description || "");
    setSelectedRecipeIds(item.recipes.map(r => r.id));
    setImageUrl(item.imageUrl || "");
  };

  const handleSave = () => {
    if (!name || !category || !price) {
      toast({ title: "Error", description: "Name, category, and price are required", variant: "destructive" });
      return;
    }
    
    const data = {
      name,
      category,
      price: parseFloat(price),
      description: description || null,
      recipeIds: selectedRecipeIds,
      imageUrl: imageUrl || null,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      
      const res = await fetch("/api/menu-management/upload-image", {
        method: "POST",
        body: formData,
      });
      
      const result = await res.json();
      if (result.ok) {
        setImageUrl(result.imageUrl);
        toast({ title: "Image uploaded" });
      } else {
        toast({ title: "Upload failed", description: result.error, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Upload error", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const items = menuData?.items || [];
  const recipes = recipesData?.recipes || [];

  const groupedItems = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = items.filter(i => i.category === cat);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">Menu Management</h1>
            <p className="text-sm text-slate-500">Manage menu items, link recipes, set prices, and control online availability</p>
          </div>
          <Button onClick={() => setShowAddModal(true)} className="rounded-[4px]" data-testid="button-add-menu-item">
            <Plus className="h-4 w-4 mr-2" />
            Add Menu Item
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-slate-500">Loading menu items...</div>
        ) : (
          <div className="space-y-6">
            {CATEGORIES.map(cat => (
              <Card key={cat} className="rounded-[4px]">
                <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                  <CardTitle className="text-sm font-semibold capitalize">{cat} ({groupedItems[cat]?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {groupedItems[cat]?.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm">No items in this category</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-white">
                          <th className="text-left py-2 px-4 font-medium w-16">Image</th>
                          <th className="text-left py-2 px-4 font-medium">Name</th>
                          <th className="text-left py-2 px-4 font-medium">Price</th>
                          <th className="text-left py-2 px-4 font-medium">Recipes</th>
                          <th className="text-center py-2 px-4 font-medium w-24">Online</th>
                          <th className="text-right py-2 px-4 font-medium w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedItems[cat]?.map(item => (
                          <tr key={item.id} className="border-b hover:bg-slate-50" data-testid={`row-menu-item-${item.id}`}>
                            <td className="py-2 px-4">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.name} className="h-10 w-10 object-cover rounded" />
                              ) : (
                                <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center">
                                  <Image className="h-4 w-4 text-slate-400" />
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-4 font-medium">{item.name}</td>
                            <td className="py-2 px-4">฿{parseFloat(item.price).toFixed(0)}</td>
                            <td className="py-2 px-4">
                              {item.recipes.length === 0 ? (
                                <span className="text-slate-400">No recipes linked</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {item.recipes.map(r => (
                                    <Badge key={r.id} variant="secondary" className="text-xs">{r.name}</Badge>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-4 text-center">
                              <Switch
                                checked={item.isOnlineEnabled}
                                onCheckedChange={(checked) => toggleOnlineMutation.mutate({ id: item.id, enabled: checked })}
                                data-testid={`switch-online-${item.id}`}
                              />
                            </td>
                            <td className="py-2 px-4 text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditModal(item)} className="h-8 w-8 p-0" data-testid={`button-edit-${item.id}`}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setModifierItem(item)} className="h-8 w-8 p-0 text-emerald-600" data-testid={`button-modifiers-${item.id}`} title="Modifiers">
                                  <Settings2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(item.id)} className="h-8 w-8 p-0 text-red-500" data-testid={`button-delete-${item.id}`}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={showAddModal || editingItem !== null} onOpenChange={(open) => {
          if (!open) {
            setShowAddModal(false);
            setEditingItem(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Smash Burger"
                    className="text-sm h-9 rounded-[4px]"
                    data-testid="input-menu-name"
                  />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-9 text-sm rounded-[4px]" data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label className="text-xs">Price (฿)</Label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 159"
                  className="text-sm h-9 rounded-[4px] w-32"
                  data-testid="input-price"
                />
              </div>
              
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="text-sm rounded-[4px]"
                  rows={2}
                  data-testid="input-description"
                />
              </div>
              
              <div>
                <Label className="text-xs">Link Recipes (for costing)</Label>
                <div className="border rounded-[4px] p-2 max-h-32 overflow-y-auto bg-white">
                  {recipes.length === 0 ? (
                    <div className="text-sm text-slate-400">No recipes available</div>
                  ) : (
                    recipes.map(recipe => (
                      <label key={recipe.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-slate-50 px-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedRecipeIds.includes(recipe.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRecipeIds([...selectedRecipeIds, recipe.id]);
                            } else {
                              setSelectedRecipeIds(selectedRecipeIds.filter(id => id !== recipe.id));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{recipe.name}</span>
                        <span className="text-xs text-slate-400 ml-auto">฿{recipe.totalCost?.toFixed(2) || "0.00"}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              
              <div>
                <Label className="text-xs">Image</Label>
                <div className="flex items-center gap-3 mt-1">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Preview" className="h-16 w-16 object-cover rounded border" />
                  ) : (
                    <div className="h-16 w-16 bg-slate-100 rounded border flex items-center justify-center">
                      <Image className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                  <div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                      <Button type="button" variant="outline" size="sm" className="rounded-[4px]" disabled={uploading} asChild>
                        <span>
                          <Upload className="h-3 w-3 mr-1" />
                          {uploading ? "Uploading..." : "Upload Image"}
                        </span>
                      </Button>
                    </label>
                    {imageUrl && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl("")} className="ml-2 text-xs text-red-500">
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingItem(null); resetForm(); }} className="rounded-[4px]">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="rounded-[4px]" data-testid="button-save-menu-item">
                {editingItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modifiers Dialog */}
        <Dialog open={!!modifierItem} onOpenChange={() => setModifierItem(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Modifiers</DialogTitle>
            </DialogHeader>
            {modifierItem && (
              <ModifierEditor 
                menuItemId={modifierItem.id} 
                menuItemName={modifierItem.name} 
              />
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setModifierItem(null)} className="rounded-[4px]">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
