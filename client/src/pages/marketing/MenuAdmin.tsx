import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ModifierOption = {
  id?: string;
  name: string;
  priceDelta: number;
  position?: number;
};

type ModifierGroup = {
  id?: string;
  name: string;
  type: "single" | "multi";
  required: boolean;
  maxSel?: number;
  options: ModifierOption[];
  position?: number;
};

type MenuItem = {
  id?: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  sku?: string;
  position?: number;
  available?: boolean;
  groups?: ModifierGroup[];
};

type Category = {
  id?: string;
  name: string;
  slug: string;
  position?: number;
  items?: MenuItem[];
};

export default function MenuAdmin() {
  const { toast } = useToast();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const { data, isLoading } = useQuery<{ categories: Category[] }>({
    queryKey: ["/api/admin/menu"],
  });

  const createCategoryMutation = useMutation({
    mutationFn: (category: Category) =>
      apiRequest("/api/admin/menu/category", {
        method: "POST",
        body: JSON.stringify(category),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/menu"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      toast({ title: "Category created successfully" });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, ...category }: Category & { id: string }) =>
      apiRequest(`/api/admin/menu/category/${id}`, {
        method: "PUT",
        body: JSON.stringify(category),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/menu"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      toast({ title: "Category updated successfully" });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/menu/category/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/menu"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      toast({ title: "Category deleted successfully" });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: (item: MenuItem) =>
      apiRequest("/api/admin/menu/item", {
        method: "POST",
        body: JSON.stringify(item),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/menu"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      toast({ title: "Menu item created successfully" });
      setItemDialogOpen(false);
      setEditingItem(null);
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, ...item }: MenuItem & { id: string }) =>
      apiRequest(`/api/admin/menu/item/${id}`, {
        method: "PUT",
        body: JSON.stringify(item),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/menu"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      toast({ title: "Menu item updated successfully" });
      setItemDialogOpen(false);
      setEditingItem(null);
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/menu/item/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/menu"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
      toast({ title: "Menu item deleted successfully" });
    },
  });

  const toggleCategory = (id: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCategories(newExpanded);
  };

  const handleSaveCategory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const category: Category = {
      name: formData.get("name") as string,
      slug: formData.get("slug") as string,
      position: parseInt(formData.get("position") as string) || 0,
    };

    if (editingCategory?.id) {
      updateCategoryMutation.mutate({ ...category, id: editingCategory.id });
    } else {
      createCategoryMutation.mutate(category);
    }
  };

  const handleSaveItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const item: MenuItem = {
      categoryId: selectedCategoryId,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      price: parseInt(formData.get("price") as string),
      sku: formData.get("sku") as string || undefined,
      position: parseInt(formData.get("position") as string) || 0,
      available: formData.get("available") === "on",
      groups: editingItem?.groups || [],
    };

    if (editingItem?.id) {
      updateItemMutation.mutate({ ...item, id: editingItem.id });
    } else {
      createItemMutation.mutate(item);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading menu...</div>;
  }

  const categories = data?.categories || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Online Menu Admin</h1>
        <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => setEditingCategory(null)}
              data-testid="button-add-category"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Edit Category" : "Add Category"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <Label htmlFor="cat-name">Name</Label>
                <Input
                  id="cat-name"
                  name="name"
                  defaultValue={editingCategory?.name}
                  required
                  data-testid="input-category-name"
                />
              </div>
              <div>
                <Label htmlFor="cat-slug">Slug (URL friendly)</Label>
                <Input
                  id="cat-slug"
                  name="slug"
                  defaultValue={editingCategory?.slug}
                  required
                  data-testid="input-category-slug"
                />
              </div>
              <div>
                <Label htmlFor="cat-position">Position</Label>
                <Input
                  id="cat-position"
                  name="position"
                  type="number"
                  defaultValue={editingCategory?.position || 0}
                  data-testid="input-category-position"
                />
              </div>
              <Button type="submit" data-testid="button-save-category">
                Save Category
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {categories.map((category) => (
          <Card key={category.id} data-testid={`card-category-${category.id}`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCategory(category.id!)}
                    className="p-1"
                    data-testid={`button-toggle-${category.id}`}
                  >
                    {expandedCategories.has(category.id!) ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>
                  <CardTitle>{category.name}</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    ({category.items?.length || 0} items)
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedCategoryId(category.id!);
                      setEditingItem(null);
                      setItemDialogOpen(true);
                    }}
                    data-testid={`button-add-item-${category.id}`}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Item
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingCategory(category);
                      setCategoryDialogOpen(true);
                    }}
                    data-testid={`button-edit-category-${category.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm("Delete this category and all its items?")) {
                        deleteCategoryMutation.mutate(category.id!);
                      }
                    }}
                    data-testid={`button-delete-category-${category.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {expandedCategories.has(category.id!) && (
              <CardContent>
                <div className="space-y-2">
                  {category.items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center p-3 border rounded"
                      data-testid={`item-${item.id}`}
                    >
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-muted-foreground">
                          ฿{item.price}
                          {item.description && ` - ${item.description}`}
                        </div>
                        {item.groups && item.groups.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {item.groups.length} modifier group(s)
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCategoryId(category.id!);
                            setEditingItem(item);
                            setItemDialogOpen(true);
                          }}
                          data-testid={`button-edit-item-${item.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm("Delete this menu item?")) {
                              deleteItemMutation.mutate(item.id!);
                            }
                          }}
                          data-testid={`button-delete-item-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!category.items || category.items.length === 0) && (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      No items yet. Click "Add Item" to create one.
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Menu Item" : "Add Menu Item"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveItem} className="space-y-4">
            <div>
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                name="name"
                defaultValue={editingItem?.name}
                required
                data-testid="input-item-name"
              />
            </div>
            <div>
              <Label htmlFor="item-description">Description</Label>
              <Textarea
                id="item-description"
                name="description"
                defaultValue={editingItem?.description}
                data-testid="input-item-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="item-price">Price (฿)</Label>
                <Input
                  id="item-price"
                  name="price"
                  type="number"
                  defaultValue={editingItem?.price}
                  required
                  data-testid="input-item-price"
                />
              </div>
              <div>
                <Label htmlFor="item-sku">SKU</Label>
                <Input
                  id="item-sku"
                  name="sku"
                  defaultValue={editingItem?.sku}
                  data-testid="input-item-sku"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="item-position">Position</Label>
                <Input
                  id="item-position"
                  name="position"
                  type="number"
                  defaultValue={editingItem?.position || 0}
                  data-testid="input-item-position"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="item-available"
                  name="available"
                  defaultChecked={editingItem?.available ?? true}
                  data-testid="checkbox-item-available"
                />
                <Label htmlFor="item-available">Available</Label>
              </div>
            </div>
            <Button type="submit" data-testid="button-save-item">
              Save Menu Item
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
