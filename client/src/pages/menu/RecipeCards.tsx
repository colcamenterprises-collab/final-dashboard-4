import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  FileText, 
  Search, 
  Image as ImageIcon, 
  DollarSign,
  Clock,
  Utensils,
  QrCode
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
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
  suggested_price: string;
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

  const { data: recipesData, isLoading } = useQuery({
    queryKey: ["/api/recipes/cards"],
    select: (data: any) => data.recipes as Recipe[]
  });

  const recipes = recipesData || [];
  const categories = ["all", ...Array.from(new Set(recipes.map(r => r.category)))];

  // Filter recipes based on search and category
  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         recipe.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Generate A4 PDF card for a single recipe
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
      
      // Header with restaurant branding
      pdf.setFillColor(...primaryColor);
      pdf.rect(0, 0, pageWidth, 25, 'F');
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(255, 255, 255);
      pdf.text('SMASH BROTHERS BURGERS', 15, 17);
      
      // Recipe title
      pdf.setTextColor(...textColor);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text(recipe.name, 15, 40);
      
      // Version badge
      pdf.setFillColor(...lightGray);
      pdf.roundedRect(15, 45, 25, 8, 2, 2, 'F');
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`v${recipe.version}`, 17, 50);
      
      // Category
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Category: ${recipe.category}`, 50, 50);
      
      // Description
      if (recipe.description) {
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'italic');
        const descLines = pdf.splitTextToSize(recipe.description, 180);
        pdf.text(descLines, 15, 65);
      }
      
      // Cost information section
      let yPos = recipe.description ? 80 : 65;
      pdf.setFillColor(...primaryColor);
      pdf.rect(15, yPos, 180, 6, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('COST BREAKDOWN', 17, yPos + 4);
      
      yPos += 12;
      pdf.setTextColor(...textColor);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      
      const totalCost = parseFloat(recipe.total_cost);
      const costPerServing = parseFloat(recipe.cost_per_serving);
      const suggestedPrice = parseFloat(recipe.suggested_price);
      const margin = suggestedPrice - costPerServing;
      const marginPercent = suggestedPrice > 0 ? ((margin / suggestedPrice) * 100).toFixed(1) : '0';
      
      pdf.text(`Total Cost: ฿${totalCost.toFixed(2)}`, 17, yPos);
      pdf.text(`Cost Per Serving: ฿${costPerServing.toFixed(2)}`, 17, yPos + 6);
      pdf.text(`Suggested Price: ฿${suggestedPrice.toFixed(2)}`, 17, yPos + 12);
      pdf.text(`Profit Margin: ฿${margin.toFixed(2)} (${marginPercent}%)`, 17, yPos + 18);
      
      // Ingredients section
      yPos += 30;
      pdf.setFillColor(...primaryColor);
      pdf.rect(15, yPos, 180, 6, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('INGREDIENTS', 17, yPos + 4);
      
      yPos += 12;
      pdf.setTextColor(...textColor);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        recipe.ingredients.forEach((ingredient, index) => {
          if (yPos > 250) { // Start new page if needed
            pdf.addPage();
            yPos = 20;
          }
          
          const line = `${ingredient.qty}${ingredient.unit} ${ingredient.name} - ฿${ingredient.costTHB.toFixed(2)} (${ingredient.supplier})`;
          pdf.text(line, 17, yPos);
          yPos += 5;
        });
      } else {
        pdf.text('No ingredients specified', 17, yPos);
        yPos += 5;
      }
      
      // Instructions section
      if (recipe.instructions) {
        yPos += 10;
        if (yPos > 240) {
          pdf.addPage();
          yPos = 20;
        }
        
        pdf.setFillColor(...primaryColor);
        pdf.rect(15, yPos, 180, 6, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('INSTRUCTIONS', 17, yPos + 4);
        
        yPos += 12;
        pdf.setTextColor(...textColor);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        
        const instructionLines = pdf.splitTextToSize(recipe.instructions, 180);
        instructionLines.forEach((line: string) => {
          if (yPos > 280) {
            pdf.addPage();
            yPos = 20;
          }
          pdf.text(line, 17, yPos);
          yPos += 5;
        });
      }
      
      // Notes section
      if (recipe.notes) {
        yPos += 10;
        if (yPos > 240) {
          pdf.addPage();
          yPos = 20;
        }
        
        pdf.setFillColor(...lightGray);
        pdf.rect(15, yPos, 180, 6, 'F');
        pdf.setTextColor(...textColor);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('NOTES', 17, yPos + 4);
        
        yPos += 12;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        
        const noteLines = pdf.splitTextToSize(recipe.notes, 180);
        noteLines.forEach((line: string) => {
          if (yPos > 280) {
            pdf.addPage();
            yPos = 20;
          }
          pdf.text(line, 17, yPos);
          yPos += 5;
        });
      }
      
      // QR code for digital access (bottom right)
      try {
        const qrCodeUrl = `${window.location.origin}/menu/recipes/${recipe.id}`;
        const qrDataURL = await QRCode.toDataURL(qrCodeUrl, { width: 256 });
        pdf.addImage(qrDataURL, 'PNG', 160, 260, 30, 30);
        
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Scan for digital recipe', 160, 275);
      } catch (error) {
        console.warn('Could not generate QR code:', error);
      }
      
      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Generated: ${new Date().toLocaleDateString()} | Recipe ID: ${recipe.id}`, 15, 290);
      
      // Save the PDF
      pdf.save(`${recipe.name.replace(/[^a-zA-Z0-9]/g, '_')}_Recipe_Card.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsGenerating(false);
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
        const totalCost = parseFloat(recipe.total_cost);
        const costPerServing = parseFloat(recipe.cost_per_serving);
        
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recipe Cards</h1>
          <p className="text-gray-600 mt-1">
            Generate professional A4 recipe cards with cost breakdowns and QR codes
          </p>
        </div>
        
        {selectedRecipes.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1">
              {selectedRecipes.size} selected
            </Badge>
            <Button 
              onClick={generateBulkPDF}
              disabled={isGenerating}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-bulk-download"
            >
              <Download className="w-4 h-4 mr-2" />
              {isGenerating ? 'Generating...' : 'Bulk Download'}
            </Button>
          </div>
        )}
      </div>

      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search recipes by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-recipes"
              />
            </div>
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
          <Card>
            <CardContent className="p-4 flex items-center">
              <Utensils className="w-8 h-8 text-emerald-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Recipes</p>
                <p className="text-2xl font-bold" data-testid="text-total-recipes">{recipes.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center">
              <FileText className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Filtered Results</p>
                <p className="text-2xl font-bold" data-testid="text-filtered-count">{filteredRecipes.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center">
              <Download className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Selected</p>
                <p className="text-2xl font-bold" data-testid="text-selected-count">{selectedRecipes.size}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recipe Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecipes.map((recipe) => (
          <Card key={recipe.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg line-clamp-2" data-testid={`text-recipe-name-${recipe.id}`}>
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
                <p className="text-sm text-gray-600 line-clamp-2" data-testid={`text-description-${recipe.id}`}>
                  {recipe.description}
                </p>
              )}
              
              {/* Cost Information */}
              <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total Cost:</span>
                  <span className="font-medium" data-testid={`text-cost-${recipe.id}`}>
                    ฿{parseFloat(recipe.total_cost).toFixed(2)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Per Serving:</span>
                  <span className="font-medium">
                    ฿{parseFloat(recipe.cost_per_serving).toFixed(2)}
                  </span>
                </div>
                
                {parseFloat(recipe.suggested_price) > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Suggested Price:</span>
                    <span className="font-medium text-emerald-600">
                      ฿{parseFloat(recipe.suggested_price).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Ingredients Count */}
              <div className="flex items-center text-sm text-gray-600">
                <Utensils className="w-4 h-4 mr-1" />
                <span data-testid={`text-ingredients-count-${recipe.id}`}>
                  {recipe.ingredients?.length || 0} ingredients
                </span>
              </div>
              
              {/* Generate Card Button */}
              <Button
                onClick={() => generatePDFCard(recipe)}
                disabled={isGenerating}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">No recipes found</h3>
            <p className="text-gray-600">
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">No recipes available</h3>
            <p className="text-gray-600 mb-4">
              Create your first recipe to start generating professional recipe cards.
            </p>
            <Button
              onClick={() => window.location.href = '/menu/recipes'}
              className="bg-emerald-600 hover:bg-emerald-700"
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