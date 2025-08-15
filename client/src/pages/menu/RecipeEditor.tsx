import { useState } from "react";
import { uploadImage } from "@/lib/uploader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, X } from "lucide-react";

interface RecipeEditorProps {
  initial?: {
    name?: string;
    description?: string;
    photoUrl?: string;
    components?: any[];
  };
  onSave: (recipe: any) => void;
  onCancel?: () => void;
}

export function RecipeEditor({ initial, onSave, onCancel }: RecipeEditorProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? "");
  const [uploading, setUploading] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadImage(file);
      setPhotoUrl(url);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Image upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleSave() {
    if (!name.trim()) {
      alert("Recipe name is required");
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      photoUrl,
      components: initial?.components || []
    });
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Recipe Editor</h2>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Photo Upload */}
        <div className="space-y-3">
          <Label>Recipe Photo</Label>
          <div className="space-y-3">
            <div className="w-full h-48 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300">
              {photoUrl ? (
                <div className="relative w-full h-full">
                  <img 
                    src={photoUrl} 
                    alt="Recipe" 
                    className="w-full h-full object-cover" 
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                    onClick={() => setPhotoUrl("")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <Upload className="w-8 h-8 mx-auto mb-2" />
                  <span className="text-sm">No image</span>
                </div>
              )}
            </div>
            
            <Label 
              htmlFor="image-upload" 
              className="inline-flex items-center justify-center w-full px-4 py-2 rounded-lg bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700 transition-colors"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Uploading..." : "Upload Photo"}
            </Label>
            <Input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={uploading}
            />
          </div>
        </div>

        {/* Recipe Details */}
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipe-name">Recipe Name *</Label>
            <Input
              id="recipe-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Ultimate Double Burger"
              className="text-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipe-description">Description</Label>
            <Textarea
              id="recipe-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your recipe..."
              rows={6}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button 
          onClick={handleSave}
          className="bg-emerald-600 hover:bg-emerald-700"
          disabled={uploading || !name.trim()}
        >
          Save Recipe
        </Button>
      </div>
    </Card>
  );
}