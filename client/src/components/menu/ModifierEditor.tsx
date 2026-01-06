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
import { Plus, Trash2, ChevronDown, ChevronRight, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ModifierIngredient = {
  id: string;
  modifierId: string;
  purchasingItemId: string;
  deltaQty: string;
  deltaUnit: string;
};

type Modifier = {
  id: string;
  modifierGroupId: string;
  name: string;
  priceDelta: string;
  displayOrder: number;
  ingredients: ModifierIngredient[];
};

type ModifierGroup = {
  id: string;
  name: string;
  menuItemId: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  displayOrder: number;
  modifiers: Modifier[];
};

type PurchasingItem = {
  id: string;
  name: string;
  unit: string;
};

interface ModifierEditorProps {
  menuItemId: string;
  menuItemName: string;
}

export default function ModifierEditor({ menuItemId, menuItemName }: ModifierEditorProps) {
  const { toast } = useToast();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showAddModifierModal, setShowAddModifierModal] = useState<string | null>(null);
  const [showAddIngredientModal, setShowAddIngredientModal] = useState<string | null>(null);
  
  const [groupName, setGroupName] = useState("");
  const [groupIsRequired, setGroupIsRequired] = useState(false);
  const [groupMinSelect, setGroupMinSelect] = useState(0);
  const [groupMaxSelect, setGroupMaxSelect] = useState(1);
  
  const [modifierName, setModifierName] = useState("");
  const [modifierPriceDelta, setModifierPriceDelta] = useState("");
  
  const [selectedPurchasingItem, setSelectedPurchasingItem] = useState("");
  const [deltaQty, setDeltaQty] = useState("");
  const [deltaUnit, setDeltaUnit] = useState("grams");

  const { data: groupsData, isLoading } = useQuery<{ ok: boolean; groups: ModifierGroup[] }>({
    queryKey: [`/api/modifiers/menu-item/${menuItemId}`],
  });

  const { data: purchasingData } = useQuery<{ ok: boolean; items: PurchasingItem[] }>({
    queryKey: ["/api/purchasing-items"],
  });

  const createGroupMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/modifiers/groups", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/modifiers/menu-item/${menuItemId}`] });
      toast({ title: "Modifier group created" });
      setShowAddGroupModal(false);
      resetGroupForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/modifiers/groups/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/modifiers/menu-item/${menuItemId}`] });
      toast({ title: "Modifier group deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createModifierMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/modifiers/modifiers", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/modifiers/menu-item/${menuItemId}`] });
      toast({ title: "Modifier created" });
      setShowAddModifierModal(null);
      resetModifierForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteModifierMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/modifiers/modifiers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/modifiers/menu-item/${menuItemId}`] });
      toast({ title: "Modifier deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addIngredientMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/modifiers/ingredients", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/modifiers/menu-item/${menuItemId}`] });
      toast({ title: "Ingredient delta added" });
      setShowAddIngredientModal(null);
      resetIngredientForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteIngredientMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/modifiers/ingredients/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/modifiers/menu-item/${menuItemId}`] });
      toast({ title: "Ingredient delta removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetGroupForm = () => {
    setGroupName("");
    setGroupIsRequired(false);
    setGroupMinSelect(0);
    setGroupMaxSelect(1);
  };

  const resetModifierForm = () => {
    setModifierName("");
    setModifierPriceDelta("");
  };

  const resetIngredientForm = () => {
    setSelectedPurchasingItem("");
    setDeltaQty("");
    setDeltaUnit("grams");
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleCreateGroup = () => {
    if (!groupName.trim()) {
      toast({ title: "Group name is required", variant: "destructive" });
      return;
    }
    createGroupMutation.mutate({
      menuItemId,
      name: groupName.trim(),
      isRequired: groupIsRequired,
      minSelect: groupMinSelect,
      maxSelect: groupMaxSelect,
    });
  };

  const handleCreateModifier = () => {
    if (!modifierName.trim() || !showAddModifierModal) {
      toast({ title: "Modifier name is required", variant: "destructive" });
      return;
    }
    createModifierMutation.mutate({
      modifierGroupId: showAddModifierModal,
      name: modifierName.trim(),
      priceDelta: parseFloat(modifierPriceDelta) || 0,
    });
  };

  const handleAddIngredient = () => {
    if (!selectedPurchasingItem || !deltaQty || !showAddIngredientModal) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    const qty = parseFloat(deltaQty);
    if (qty <= 0) {
      toast({ title: "Delta quantity must be greater than 0", variant: "destructive" });
      return;
    }
    addIngredientMutation.mutate({
      modifierId: showAddIngredientModal,
      purchasingItemId: selectedPurchasingItem,
      deltaQty: qty,
      deltaUnit,
    });
  };

  const groups = groupsData?.groups || [];
  const purchasingItems = purchasingData?.items || [];

  const getPurchasingItemName = (id: string) => {
    const item = purchasingItems.find(i => i.id === id);
    return item?.name || id;
  };

  if (isLoading) {
    return <div className="text-center py-4 text-slate-500">Loading modifiers...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-slate-900">Modifiers for {menuItemName}</h3>
          <p className="text-xs text-slate-500">
            Modifiers add or remove ingredients from the base recipe.
          </p>
        </div>
        <Button 
          size="sm" 
          onClick={() => setShowAddGroupModal(true)} 
          className="rounded-[4px]"
          data-testid="button-add-modifier-group"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm border rounded-[4px] bg-white">
          No modifier groups yet. Add a group to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <Card key={group.id} className="rounded-[4px]">
              <CardHeader 
                className="py-2 px-3 cursor-pointer hover:bg-slate-50 flex flex-row items-center justify-between"
                onClick={() => toggleGroup(group.id)}
              >
                <div className="flex items-center gap-2">
                  {expandedGroups.has(group.id) ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  <CardTitle className="text-sm font-medium">
                    {group.name}
                    <span className="ml-2 text-xs text-slate-400 font-normal">
                      ({group.modifiers.length} options)
                      {group.isRequired && " • Required"}
                    </span>
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this modifier group?")) {
                      deleteGroupMutation.mutate(group.id);
                    }
                  }}
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardHeader>
              
              {expandedGroups.has(group.id) && (
                <CardContent className="pt-0 pb-3 px-3">
                  <div className="text-xs text-slate-400 mb-2">
                    Selection: min {group.minSelect}, max {group.maxSelect}
                  </div>
                  
                  {group.modifiers.length === 0 ? (
                    <div className="text-xs text-slate-400 py-2">No modifiers in this group</div>
                  ) : (
                    <div className="space-y-2">
                      {group.modifiers.map(mod => (
                        <div key={mod.id} className="border rounded-[4px] p-2 bg-white">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium">{mod.name}</span>
                            <div className="flex items-center gap-2">
                              {parseFloat(mod.priceDelta) !== 0 && (
                                <span className="text-xs text-emerald-600">
                                  +฿{parseFloat(mod.priceDelta).toFixed(0)}
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm("Delete this modifier?")) {
                                    deleteModifierMutation.mutate(mod.id);
                                  }
                                }}
                                className="h-6 w-6 p-0 text-red-500"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="pl-2 border-l-2 border-slate-200">
                            {mod.ingredients.length === 0 ? (
                              <div className="text-xs text-slate-400">No ingredient deltas</div>
                            ) : (
                              <div className="space-y-1">
                                {mod.ingredients.map(ing => (
                                  <div key={ing.id} className="flex justify-between items-center text-xs">
                                    <span className="flex items-center gap-1">
                                      <Package className="h-3 w-3 text-slate-400" />
                                      {getPurchasingItemName(ing.purchasingItemId)}
                                      <span className="text-slate-500">
                                        +{ing.deltaQty} {ing.deltaUnit}
                                      </span>
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteIngredientMutation.mutate(ing.id)}
                                      className="h-5 w-5 p-0 text-red-400"
                                    >
                                      <Trash2 className="h-2 w-2" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowAddIngredientModal(mod.id)}
                              className="h-6 px-2 text-xs text-emerald-600 mt-1"
                            >
                              <Plus className="h-2 w-2 mr-1" />
                              Add Ingredient Delta
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModifierModal(group.id)}
                    className="mt-2 rounded-[4px] text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Modifier
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add Group Modal */}
      <Dialog open={showAddGroupModal} onOpenChange={setShowAddGroupModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Modifier Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Group Name</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Burger Extras"
                className="rounded-[4px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={groupIsRequired}
                onCheckedChange={setGroupIsRequired}
              />
              <Label>Required selection</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min Select</Label>
                <Input
                  type="number"
                  min="0"
                  value={groupMinSelect}
                  onChange={(e) => setGroupMinSelect(parseInt(e.target.value) || 0)}
                  className="rounded-[4px]"
                />
              </div>
              <div>
                <Label>Max Select</Label>
                <Input
                  type="number"
                  min="1"
                  value={groupMaxSelect}
                  onChange={(e) => setGroupMaxSelect(parseInt(e.target.value) || 1)}
                  className="rounded-[4px]"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddGroupModal(false); resetGroupForm(); }} className="rounded-[4px]">
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={createGroupMutation.isPending} className="rounded-[4px]">
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Modifier Modal */}
      <Dialog open={!!showAddModifierModal} onOpenChange={() => setShowAddModifierModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Modifier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Modifier Name</Label>
              <Input
                value={modifierName}
                onChange={(e) => setModifierName(e.target.value)}
                placeholder="e.g. Extra Cheese"
                className="rounded-[4px]"
              />
            </div>
            <div>
              <Label>Price Delta (฿)</Label>
              <Input
                type="number"
                step="1"
                value={modifierPriceDelta}
                onChange={(e) => setModifierPriceDelta(e.target.value)}
                placeholder="0"
                className="rounded-[4px]"
              />
              <p className="text-xs text-slate-400 mt-1">Additional cost for this modifier</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddModifierModal(null); resetModifierForm(); }} className="rounded-[4px]">
              Cancel
            </Button>
            <Button onClick={handleCreateModifier} disabled={createModifierMutation.isPending} className="rounded-[4px]">
              Create Modifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Ingredient Delta Modal */}
      <Dialog open={!!showAddIngredientModal} onOpenChange={() => setShowAddIngredientModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Ingredient Delta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Purchasing Item</Label>
              <Select value={selectedPurchasingItem} onValueChange={setSelectedPurchasingItem}>
                <SelectTrigger className="rounded-[4px]">
                  <SelectValue placeholder="Select ingredient" />
                </SelectTrigger>
                <SelectContent>
                  {purchasingItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Delta Quantity</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={deltaQty}
                  onChange={(e) => setDeltaQty(e.target.value)}
                  placeholder="e.g. 30"
                  className="rounded-[4px]"
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={deltaUnit} onValueChange={setDeltaUnit}>
                  <SelectTrigger className="rounded-[4px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grams">grams</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="each">each</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              This adds the specified quantity to the base recipe when this modifier is selected.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddIngredientModal(null); resetIngredientForm(); }} className="rounded-[4px]">
              Cancel
            </Button>
            <Button onClick={handleAddIngredient} disabled={addIngredientMutation.isPending} className="rounded-[4px]">
              Add Delta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
