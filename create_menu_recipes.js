// Script to create comprehensive recipes for all menu items
import { apiRequest } from './client/src/lib/queryClient.ts';

const menuItems = [
  // GRAB AND FOODPANDA PROMOTIONS
  {
    handle: "mix-and-match-meal-deal",
    sku: "10069",
    name: "Mix and Match Meal Deal",
    category: "GRAB AND FOODPANDA PROMOTIONS",
    meatQuantity: 3,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Customizable meal deal with choice of burger, sides, and drink",
    preparationTime: 15,
    servingSize: 1
  },
  {
    handle: "promo-burger-triple-decker-super-bacon-and-cheese",
    sku: "10008",
    name: "PROMO Triple Decker Super Bacon and Cheese",
    category: "GRAB AND FOODPANDA PROMOTIONS",
    meatQuantity: 3,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Premium promotional triple-layer burger with bacon and cheese",
    preparationTime: 20,
    servingSize: 1
  },
  
  // Kids Will Love This
  {
    handle: "kids-double-cheeseburger",
    sku: "10017",
    name: "Kids Double Cheeseburger",
    category: "Kids Will Love This",
    meatQuantity: 2,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Kid-friendly double cheeseburger with smaller portions",
    preparationTime: 10,
    servingSize: 1
  },
  {
    handle: "kids-single-cheeseburger",
    sku: "10015",
    name: "Kids Single Cheeseburger",
    category: "Kids Will Love This",
    meatQuantity: 1,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Kid-friendly single cheeseburger with smaller portions",
    preparationTime: 8,
    servingSize: 1
  },
  {
    handle: "kids-meal-set-burger-fries-drink",
    sku: "10003",
    name: "Kids Single Meal Set (Burger Fries Drink)",
    category: "Kids Will Love This",
    meatQuantity: 1,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Complete kids meal with burger, fries, and drink",
    preparationTime: 12,
    servingSize: 1
  },
  
  // Smash Burger Sets (Meal Deals)
  {
    handle: "double-set-meal-deal",
    sku: "10032",
    name: "Double Set (Meal Deal)",
    category: "Smash Burger Sets (Meal Deals)",
    meatQuantity: 2,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Double burger meal deal with fries and drink",
    preparationTime: 15,
    servingSize: 1
  },
  {
    handle: "single-meal-set-meal-deal",
    sku: "10033",
    name: "Single Meal Set (Meal Deal)",
    category: "Smash Burger Sets (Meal Deals)",
    meatQuantity: 1,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Single burger meal deal with fries and drink",
    preparationTime: 12,
    servingSize: 1
  },
  {
    handle: "super-double-bacon-cheese-set-meal-deal",
    sku: "10036",
    name: "Super Double Bacon & Cheese Set (Meal Deal)",
    category: "Smash Burger Sets (Meal Deals)",
    meatQuantity: 2,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Premium double burger meal deal with bacon and cheese",
    preparationTime: 18,
    servingSize: 1
  },
  {
    handle: "triple-smash-set-meal-deal",
    sku: "10034",
    name: "Triple Smash Set (Meal Deal)",
    category: "Smash Burger Sets (Meal Deals)",
    meatQuantity: 3,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Triple burger meal deal with fries and drink",
    preparationTime: 20,
    servingSize: 1
  },
  
  // Smash Burgers - Beef
  {
    handle: "single-smash-burger",
    sku: "10004",
    name: "Single Smash Burger (ซิงเกิ้ล)",
    category: "Smash Burgers",
    meatQuantity: 1,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Classic single smash burger with caramelized edges",
    preparationTime: 8,
    servingSize: 1
  },
  {
    handle: "super-double-bacon-and-cheese",
    sku: "10019",
    name: "Super Double Bacon and Cheese (ซูเปอร์ดับเบิ้ลเบคอน)",
    category: "Smash Burgers",
    meatQuantity: 2,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Premium double burger with bacon and cheese",
    preparationTime: 15,
    servingSize: 1
  },
  {
    handle: "super-single-bacon-cheese",
    sku: "10038",
    name: "Super Single Bacon & Cheese",
    category: "Smash Burgers",
    meatQuantity: 1,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Premium single burger with bacon and cheese",
    preparationTime: 12,
    servingSize: 1
  },
  {
    handle: "triple-smash-burger",
    sku: "10009",
    name: "Triple Smash Burger (สาม)",
    category: "Smash Burgers",
    meatQuantity: 3,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Triple-stacked smash burger for serious appetites",
    preparationTime: 18,
    servingSize: 1
  },
  {
    handle: "ultimate-double",
    sku: "10006",
    name: "Ultimate Double (คู่)",
    category: "Smash Burgers",
    meatQuantity: 2,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Ultimate double burger with premium toppings",
    preparationTime: 15,
    servingSize: 1
  },
  
  // Smash Burgers - Chicken
  {
    handle: "chicken-fillet-burger",
    sku: "10066",
    name: "Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)",
    category: "Smash Burgers",
    meatQuantity: 3,
    meatType: "Chicken",
    bunQuantity: 1,
    description: "Crispy chicken fillet burger with fresh vegetables",
    preparationTime: 15,
    servingSize: 1
  },
  {
    handle: "big-rooster-sriracha-chicken",
    sku: "10068",
    name: "Big Rooster Sriracha Chicken ไก่ศรีราชาตัวใหญ่",
    category: "Smash Burgers",
    meatQuantity: 3,
    meatType: "Chicken",
    bunQuantity: 1,
    description: "Spicy sriracha chicken burger with Thai flavors",
    preparationTime: 18,
    servingSize: 1
  },
  {
    handle: "chipotle-chicken-burger",
    sku: "10037",
    name: "El Smasho Grande Chicken Burger (แกรนด์ชิกเก้น)",
    category: "Smash Burgers",
    meatQuantity: 3,
    meatType: "Chicken",
    bunQuantity: 1,
    description: "Chipotle-seasoned chicken burger with Mexican-inspired flavors",
    preparationTime: 18,
    servingSize: 1
  }
];

async function createRecipes() {
  console.log('Creating recipes for all menu items...');
  
  for (const item of menuItems) {
    try {
      // Create the recipe
      const recipeData = {
        name: item.name,
        category: item.category,
        description: item.description,
        servingSize: item.servingSize,
        preparationTime: item.preparationTime,
        totalCost: "0.00",
        profitMargin: "40",
        sellingPrice: "",
        isActive: true,
        instructions: generateInstructions(item)
      };
      
      console.log(`Creating recipe for: ${item.name}`);
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recipeData)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create recipe for ${item.name}`);
      }
      
      const recipe = await response.json();
      console.log(`✓ Created recipe: ${recipe.name} (ID: ${recipe.id})`);
      
      // Add ingredients to the recipe
      await addIngredientsToRecipe(recipe.id, item);
      
    } catch (error) {
      console.error(`Error creating recipe for ${item.name}:`, error);
    }
  }
  
  console.log('All recipes created successfully!');
}

function generateInstructions(item) {
  const baseInstructions = [
    "1. Preheat grill or griddle to medium-high heat",
    "2. Season meat patties with salt and pepper",
    "3. Toast bun halves until golden brown",
    "4. Cook patties using smash technique - press down firmly",
    "5. Add cheese during last minute of cooking",
    "6. Assemble burger with fresh toppings",
    "7. Serve immediately while hot"
  ];
  
  if (item.meatType === "Chicken") {
    return [
      "1. Preheat oil to 350°F (175°C) for frying",
      "2. Bread chicken fillets with seasoned flour",
      "3. Fry chicken until golden brown and cooked through",
      "4. Toast bun halves until golden brown",
      "5. Prepare sauces and fresh vegetables",
      "6. Assemble burger with crispy chicken and toppings",
      "7. Serve immediately while hot"
    ].join("\n");
  }
  
  if (item.category.includes("Kids")) {
    return [
      "1. Use smaller portions suitable for children",
      "2. Preheat grill to medium heat",
      "3. Cook patties thoroughly (well-done for kids)",
      "4. Toast bun lightly",
      "5. Add mild cheese and simple toppings",
      "6. Cut burger in half for easier eating",
      "7. Serve with kid-friendly sides"
    ].join("\n");
  }
  
  return baseInstructions.join("\n");
}

async function addIngredientsToRecipe(recipeId, item) {
  const ingredients = getIngredientsForItem(item);
  
  for (const ingredient of ingredients) {
    try {
      const response = await fetch('/api/recipe-ingredients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipeId: recipeId,
          ingredientId: ingredient.id,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          cost: ingredient.cost
        })
      });
      
      if (!response.ok) {
        console.error(`Failed to add ingredient ${ingredient.name} to recipe ${recipeId}`);
      }
    } catch (error) {
      console.error(`Error adding ingredient to recipe:`, error);
    }
  }
}

function getIngredientsForItem(item) {
  const baseIngredients = [
    { id: "1", name: "Burger Bun", quantity: item.bunQuantity, unit: "piece", cost: "5.00" },
    { id: "2", name: "Lettuce", quantity: "20", unit: "grams", cost: "2.00" },
    { id: "3", name: "Tomato", quantity: "30", unit: "grams", cost: "3.00" },
    { id: "4", name: "Onion", quantity: "15", unit: "grams", cost: "1.50" },
    { id: "5", name: "Pickle", quantity: "2", unit: "slices", cost: "1.00" }
  ];
  
  // Add meat based on type and quantity
  if (item.meatType === "Beef") {
    baseIngredients.push({
      id: "6",
      name: "Beef Patty",
      quantity: (item.meatQuantity * 80).toString(), // 80g per patty
      unit: "grams",
      cost: (item.meatQuantity * 25).toString() // 25 baht per patty
    });
  } else if (item.meatType === "Chicken") {
    baseIngredients.push({
      id: "7",
      name: "Chicken Fillet",
      quantity: (item.meatQuantity * 100).toString(), // 100g per fillet
      unit: "grams",
      cost: (item.meatQuantity * 30).toString() // 30 baht per fillet
    });
  }
  
  // Add cheese for cheese burgers
  if (item.name.toLowerCase().includes("cheese")) {
    baseIngredients.push({
      id: "8",
      name: "Cheese Slice",
      quantity: item.meatQuantity.toString(),
      unit: "slices",
      cost: (item.meatQuantity * 8).toString() // 8 baht per slice
    });
  }
  
  // Add bacon for bacon burgers
  if (item.name.toLowerCase().includes("bacon")) {
    baseIngredients.push({
      id: "9",
      name: "Bacon",
      quantity: (item.meatQuantity * 2).toString(), // 2 strips per patty
      unit: "strips",
      cost: (item.meatQuantity * 12).toString() // 12 baht per 2 strips
    });
  }
  
  // Add special ingredients for specific items
  if (item.name.toLowerCase().includes("sriracha")) {
    baseIngredients.push({
      id: "10",
      name: "Sriracha Sauce",
      quantity: "10",
      unit: "ml",
      cost: "2.00"
    });
  }
  
  if (item.name.toLowerCase().includes("chipotle")) {
    baseIngredients.push({
      id: "11",
      name: "Chipotle Sauce",
      quantity: "15",
      unit: "ml",
      cost: "3.00"
    });
  }
  
  // Add meal set components
  if (item.name.toLowerCase().includes("meal") || item.name.toLowerCase().includes("set")) {
    baseIngredients.push(
      { id: "12", name: "French Fries", quantity: "150", unit: "grams", cost: "15.00" },
      { id: "13", name: "Soft Drink", quantity: "1", unit: "cup", cost: "12.00" }
    );
  }
  
  return baseIngredients;
}

// Execute the script
createRecipes().catch(console.error);