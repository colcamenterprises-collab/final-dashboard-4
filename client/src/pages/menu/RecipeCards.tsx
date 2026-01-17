import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  FileText, 
  Search, 
  Image as ImageIcon, 
  Upload,
  Utensils
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { saveAs } from "file-saver";

interface Recipe {
  id: string;
  name: string;
  description: string;
  category: string;
  version: number;
  parent_id: string | null;
  image_url: string | null;
  total_cost: string;
  cost_per_serving: string;
  instructions: string | null;
  notes: string;
  ingredients: Array<{
    qty: number;
    name: string;
    unit: string;
    costTHB: number;
    supplier: string;
    unitCostTHB: number;
    ingredientId: string;
  }>;
  created_at: string;
  updated_at: string;
}

export default function RecipeCards() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedRecipes, setSelectedRecipes] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<Set<string>>(new Set());

  const { data: recipesData, isLoading } = useQuery({
    queryKey: ["/api/recipes/cards"],
    select: (data: any) => (Array.isArray(data) ? data : data.recipes) as Recipe[]
  });

  // Image upload mutation
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/recipes/upload-image', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      const data = await response.json();
      return data.imageUrl;
    },
    onSuccess: (imageUrl, file, context) => {
      console.log('Image uploaded successfully:', imageUrl);
      // Refresh the recipes data to get updated image URLs
      queryClient.invalidateQueries({ queryKey: ["/api/recipes/cards"] });
    },
    onError: (error) => {
      console.error('Image upload failed:', error);
    }
  });

  const recipes = recipesData || [];
  const categories = ["all", ...Array.from(new Set(recipes.map(r => r.category)))];

  // Filter recipes based on search and category
  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (recipe.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Generate A4 PDF card for a single recipe (OPTIMIZED FOR SINGLE PAGE)
  const generatePDFCard = async (recipe: Recipe) => {
    try {
      setIsGenerating(true);
      
      // Create PDF in A4 format (210mm x 297mm)
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      
      // Colors matching restaurant theme
      const primaryColor: [number, number, number] = [16, 185, 129]; // emerald-500
      const textColor: [number, number, number] = [31, 41, 55]; // gray-800
      const lightGray: [number, number, number] = [243, 244, 246]; // gray-100
      
      // Header with restaurant branding (COMPACT: 15mm)
      pdf.setFillColor(...primaryColor);
      pdf.rect(0, 0, pageWidth, 15, 'F');
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text('SMASH BROTHERS BURGERS', 15, 10);
      
      // Recipe title (COMPACT)
      pdf.setTextColor(...textColor);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(recipe.name, 15, 25);
      
      // Version & Category on same line (COMPACT)
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`v${recipe.version} | ${recipe.category}`, 15, 31);
      
      // Description (COMPACT: max 2 lines, small font)
      let yPos = 38;
      if (recipe.description) {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'italic');
        const descLines = pdf.splitTextToSize(recipe.description, 180).slice(0, 2); // Max 2 lines
        pdf.text(descLines, 15, yPos);
        yPos += descLines.length * 4;
      }
      
      // Recipe Image (COMPACT: 50mm x 35mm max)
      if (recipe.image_url) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = recipe.image_url;
          });
          
          const maxWidth = 50;
          const maxHeight = 35;
          const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
          const imgWidth = img.width * scale;
          const imgHeight = img.height * scale;
          const imgX = (pageWidth - imgWidth) / 2;
          
          pdf.addImage(img, 'JPEG', imgX, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 4;
        } catch (error) {
          console.warn('Could not load recipe image for PDF:', error);
        }
      }
      
      // Cost information section (COMPACT: single line per item)
      pdf.setFillColor(...primaryColor);
      pdf.rect(15, yPos, 180, 5, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('COST BREAKDOWN', 17, yPos + 3.5);
      
      yPos += 8;
      pdf.setTextColor(...textColor);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      
      const totalCost = Number(recipe.total_cost ?? 0) || 0;
      const costPerServing = Number(recipe.cost_per_serving ?? 0) || 0;
      
      pdf.text(`Total: ฿${totalCost.toFixed(2)} | Per Serving: ฿${costPerServing.toFixed(2)}`, 17, yPos);
      
      // Ingredients section (COMPACT: 3mm spacing)
      yPos += 7;
      pdf.setFillColor(...primaryColor);
      pdf.rect(15, yPos, 180, 5, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('INGREDIENTS', 17, yPos + 3.5);
      
      yPos += 8;
      pdf.setTextColor(...textColor);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        recipe.ingredients.forEach((ingredient) => {
          const qty = Number(ingredient.qty ?? 0) || 0;
          const costTHB = Number(ingredient.costTHB ?? 0) || 0;
          const line = `${qty}${ingredient.unit || ''} ${ingredient.name || ''} - ฿${costTHB.toFixed(2)}`;
          pdf.text(line, 17, yPos);
          yPos += 3;
        });
      } else {
        pdf.text('No ingredients specified', 17, yPos);
        yPos += 3;
      }
      
      // Instructions section (COMPACT: if exists, truncate to fit)
      if (recipe.instructions && yPos < 260) {
        yPos += 4;
        pdf.setFillColor(...primaryColor);
        pdf.rect(15, yPos, 180, 5, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('INSTRUCTIONS', 17, yPos + 3.5);
        
        yPos += 8;
        pdf.setTextColor(...textColor);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        
        const instructionLines = pdf.splitTextToSize(recipe.instructions, 180);
        const maxLines = Math.floor((270 - yPos) / 3); // Calculate remaining space
        instructionLines.slice(0, maxLines).forEach((line: string) => {
          pdf.text(line, 17, yPos);
          yPos += 3;
        });
      }
      
      // Notes section (COMPACT: only if space available)
      if (recipe.notes && yPos < 260) {
        yPos += 4;
        pdf.setFillColor(...lightGray);
        pdf.rect(15, yPos, 180, 5, 'F');
        pdf.setTextColor(...textColor);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('NOTES', 17, yPos + 3.5);
        
        yPos += 8;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        
        const noteLines = pdf.splitTextToSize(recipe.notes, 180);
        const maxLines = Math.floor((270 - yPos) / 3);
        noteLines.slice(0, maxLines).forEach((line: string) => {
          pdf.text(line, 17, yPos);
          yPos += 3;
        });
      }
      
      // QR code for digital access (bottom right, COMPACT: 25x25mm)
      try {
        const qrCodeUrl = `${window.location.origin}/menu/recipes/${recipe.id}`;
        const qrDataURL = await QRCode.toDataURL(qrCodeUrl, { width: 200 });
        pdf.addImage(qrDataURL, 'PNG', 165, 265, 25, 25);
        
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(128, 128, 128);
        pdf.text('Scan for', 165, 292);
        pdf.text('digital recipe', 165, 295);
      } catch (error) {
        console.warn('Could not generate QR code:', error);
      }
      
      // Footer (COMPACT)
      pdf.setFontSize(7);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Generated: ${new Date().toLocaleDateString()} | ID: ${recipe.id}`, 15, 292);
      
      // Save the PDF
      pdf.save(`${recipe.name.replace(/[^a-zA-Z0-9]/g, '_')}_Recipe_Card.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle image upload for a recipe
  const handleImageUpload = async (recipeId: string, file: File) => {
    try {
      setUploadingImages(prev => new Set(prev).add(recipeId));
      const imageUrl = await uploadImageMutation.mutateAsync(file);
      
      // Update the recipe with the new image URL
      await apiRequest(`/api/recipes/${recipeId}`, {
        method: 'PUT',
        body: JSON.stringify({ image_url: imageUrl }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Refresh recipes to show updated image
      queryClient.invalidateQueries({ queryKey: ["/api/recipes/cards"] });
    } catch (error) {
      console.error('Failed to upload and assign image:', error);
    } finally {
      setUploadingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(recipeId);
        return newSet;
      });
    }
  };

  // Toggle recipe selection for bulk operations
  const toggleRecipeSelection = (recipeId: string) => {
    const newSelection = new Set(selectedRecipes);
    if (newSelection.has(recipeId)) {
      newSelection.delete(recipeId);
    } else {
      newSelection.add(recipeId);
    }
    setSelectedRecipes(newSelection);
  };

  // Generate bulk PDF with all selected recipes
  const generateBulkPDF = async () => {
    if (selectedRecipes.size === 0) {
      alert('Please select at least one recipe to generate bulk PDF.');
      return;
    }

    try {
      setIsGenerating(true);
      const selectedRecipeData = recipes.filter(r => selectedRecipes.has(r.id));
      
      // Create bulk PDF
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      
      for (let i = 0; i < selectedRecipeData.length; i++) {
        const recipe = selectedRecipeData[i];
        
        if (i > 0) {
          pdf.addPage(); // Add new page for each recipe after the first
        }
        
        // Reuse the same PDF generation logic but without the save
        // [Similar logic to generatePDFCard but without pdf.save()]
        const pageWidth = 210;
        const primaryColor: [number, number, number] = [16, 185, 129];
        const textColor: [number, number, number] = [31, 41, 55];
        const lightGray: [number, number, number] = [243, 244, 246];
        
        // Header
        pdf.setFillColor(...primaryColor);
        pdf.rect(0, 0, pageWidth, 25, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.setTextColor(255, 255, 255);
        pdf.text('SMASH BROTHERS BURGERS', 15, 17);
        
        // Recipe content (simplified for bulk)
        pdf.setTextColor(...textColor);
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.text(recipe.name, 15, 40);
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Category: ${recipe.category} | Version: ${recipe.version}`, 15, 50);
        
        if (recipe.description) {
          pdf.setFontSize(11);
          const descLines = pdf.splitTextToSize(recipe.description, 180);
          pdf.text(descLines, 15, 60);
        }
        
        // Cost info
        let yPos = 75;
        const totalCost = Number(recipe.total_cost ?? 0) || 0;
        const costPerServing = Number(recipe.cost_per_serving ?? 0) || 0;
        
        pdf.text(`Total Cost: ฿${totalCost.toFixed(2)} | Per Serving: ฿${costPerServing.toFixed(2)}`, 15, yPos);
        
        // Page number
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(`Page ${i + 1} of ${selectedRecipeData.length}`, 170, 290);
      }
      
      pdf.save(`Recipe_Cards_Bulk_${selectedRecipeData.length}_recipes.pdf`);
      
    } catch (error) {
      console.error('Error generating bulk PDF:', error);
      alert('Error generating bulk PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading recipe cards...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" style={{ fontFamily: "Poppins, sans-serif" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Recipe Cards</h1>
          <p className="text-xs text-slate-600 mt-1">
            Generate professional A4 recipe cards with cost breakdowns and QR codes
          </p>
        </div>
        
        {selectedRecipes.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1 text-xs rounded-[4px]">
              {selectedRecipes.size} selected
            </Badge>
            <Button 
              onClick={generateBulkPDF}
              disabled={isGenerating}
              className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-[4px]"
              data-testid="button-bulk-download"
            >
              <Download className="w-4 h-4 mr-2" />
              {isGenerating ? 'Generating...' : 'Bulk Download'}
            </Button>
          </div>
        )}
      </div>

      {/* Search and Filter Controls */}
      <Card className="border-slate-200" style={{ borderRadius: '4px' }}>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search recipes by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-xs rounded-[4px] border-slate-200"
                data-testid="input-search-recipes"
              />
            </div>
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-[4px] text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              data-testid="select-category-filter"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {recipes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-slate-200" style={{ borderRadius: '4px' }}>
            <CardContent className="p-4 flex items-center">
              <Utensils className="w-8 h-8 text-emerald-600 mr-3" />
              <div>
                <p className="text-xs text-slate-600">Total Recipes</p>
                <p className="text-2xl font-bold text-slate-900" data-testid="text-total-recipes">{recipes.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-slate-200" style={{ borderRadius: '4px' }}>
            <CardContent className="p-4 flex items-center">
              <FileText className="w-8 h-8 text-emerald-600 mr-3" />
              <div>
                <p className="text-xs text-slate-600">Filtered Results</p>
                <p className="text-2xl font-bold text-slate-900" data-testid="text-filtered-count">{filteredRecipes.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-slate-200" style={{ borderRadius: '4px' }}>
            <CardContent className="p-4 flex items-center">
              <Download className="w-8 h-8 text-emerald-600 mr-3" />
              <div>
                <p className="text-xs text-slate-600">Selected</p>
                <p className="text-2xl font-bold text-slate-900" data-testid="text-selected-count">{selectedRecipes.size}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recipe Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecipes.map((recipe) => (
          <Card key={recipe.id} className="overflow-hidden hover:shadow-lg transition-shadow border-slate-200" style={{ borderRadius: '4px' }}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-sm font-medium line-clamp-2" data-testid={`text-recipe-name-${recipe.id}`}>
                    {recipe.name}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {recipe.category}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      v{recipe.version}
                    </Badge>
                  </div>
                </div>
                
                <input
                  type="checkbox"
                  checked={selectedRecipes.has(recipe.id)}
                  onChange={() => toggleRecipeSelection(recipe.id)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  data-testid={`checkbox-select-${recipe.id}`}
                />
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {recipe.description && (
                <p className="text-xs text-slate-600 line-clamp-2" data-testid={`text-description-${recipe.id}`}>
                  {recipe.description}
                </p>
              )}
              
              {/* Recipe Image */}
              <div className="space-y-2">
                {recipe.image_url ? (
                  <div className="relative">
                    <img
                      src={recipe.image_url}
                      alt={recipe.name}
                      className="w-full h-32 object-cover rounded-[4px]"
                      data-testid={`image-recipe-${recipe.id}`}
                    />
                    <div className="absolute top-2 right-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 w-8 p-0 rounded-[4px]"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) handleImageUpload(recipe.id, file);
                          };
                          input.click();
                        }}
                        disabled={uploadingImages.has(recipe.id)}
                        data-testid={`button-change-image-${recipe.id}`}
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 rounded-[4px] p-4 text-center">
                    <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 mb-2">No image uploaded</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) handleImageUpload(recipe.id, file);
                        };
                        input.click();
                      }}
                      disabled={uploadingImages.has(recipe.id)}
                      className="text-xs rounded-[4px] border-slate-200"
                      data-testid={`button-upload-image-${recipe.id}`}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      {uploadingImages.has(recipe.id) ? 'Uploading...' : 'Upload Image'}
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Cost Information */}
              <div className="bg-slate-50 p-3 rounded-[4px] space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Total Cost:</span>
                  <span className="font-medium" data-testid={`text-cost-${recipe.id}`}>
                    ฿{(Number(recipe.total_cost ?? 0) || 0).toFixed(2)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Per Serving:</span>
                  <span className="font-medium">
                    ฿{(Number(recipe.cost_per_serving ?? 0) || 0).toFixed(2)}
                  </span>
                </div>
                
              </div>
              
              {/* Ingredients Count */}
              <div className="flex items-center text-xs text-slate-600">
                <Utensils className="w-4 h-4 mr-1" />
                <span data-testid={`text-ingredients-count-${recipe.id}`}>
                  {recipe.ingredients?.length || 0} ingredients
                </span>
              </div>
              
              {/* Generate Card Button */}
              <Button
                onClick={() => generatePDFCard(recipe)}
                disabled={isGenerating}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-xs rounded-[4px]"
                data-testid={`button-generate-card-${recipe.id}`}
              >
                <FileText className="w-4 h-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Generate A4 Card'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredRecipes.length === 0 && recipes.length > 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-sm font-medium text-gray-900 mb-2">No recipes found</h3>
            <p className="text-xs text-slate-600">
              Try adjusting your search terms or category filter to find recipes.
            </p>
          </CardContent>
        </Card>
      )}

      {/* No Recipes State */}
      {recipes.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Utensils className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-sm font-medium text-gray-900 mb-2">No recipes available</h3>
            <p className="text-xs text-slate-600 mb-4">
              Create your first recipe to start generating professional recipe cards.
            </p>
            <Button
              onClick={() => window.location.href = '/menu/recipes'}
              className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-[4px]"
              data-testid="button-create-first-recipe"
            >
              <Utensils className="w-4 h-4 mr-2" />
              Create Recipe
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
