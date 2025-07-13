// Simple script to create recipes via API calls
const fetch = require('node-fetch');

const menuItems = [
  // GRAB AND FOODPANDA PROMOTIONS
  {
    name: "Mix and Match Meal Deal",
    category: "GRAB AND FOODPANDA PROMOTIONS",
    meatQuantity: 3,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Customizable meal deal with choice of burger, sides, and drink",
    preparationTime: 15,
    servingSize: 1,
    sku: "10069"
  },
  {
    name: "PROMO Triple Decker Super Bacon and Cheese",
    category: "GRAB AND FOODPANDA PROMOTIONS",
    meatQuantity: 3,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Premium promotional triple-layer burger with bacon and cheese",
    preparationTime: 20,
    servingSize: 1,
    sku: "10008"
  },
  
  // Kids Will Love This
  {
    name: "Kids Double Cheeseburger",
    category: "Kids Will Love This",
    meatQuantity: 2,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Kid-friendly double cheeseburger with smaller portions",
    preparationTime: 10,
    servingSize: 1,
    sku: "10017"
  },
  {
    name: "Kids Single Cheeseburger",
    category: "Kids Will Love This",
    meatQuantity: 1,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Kid-friendly single cheeseburger with smaller portions",
    preparationTime: 8,
    servingSize: 1,
    sku: "10015"
  },
  {
    name: "Kids Single Meal Set (Burger Fries Drink)",
    category: "Kids Will Love This",
    meatQuantity: 1,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Complete kids meal with burger, fries, and drink",
    preparationTime: 12,
    servingSize: 1,
    sku: "10003"
  },
  
  // Smash Burger Sets (Meal Deals)
  {
    name: "Double Set (Meal Deal)",
    category: "Smash Burger Sets (Meal Deals)",
    meatQuantity: 2,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Double burger meal deal with fries and drink",
    preparationTime: 15,
    servingSize: 1,
    sku: "10032"
  },
  {
    name: "Single Meal Set (Meal Deal)",
    category: "Smash Burger Sets (Meal Deals)",
    meatQuantity: 1,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Single burger meal deal with fries and drink",
    preparationTime: 12,
    servingSize: 1,
    sku: "10033"
  },
  {
    name: "Super Double Bacon & Cheese Set (Meal Deal)",
    category: "Smash Burger Sets (Meal Deals)",
    meatQuantity: 2,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Premium double burger meal deal with bacon and cheese",
    preparationTime: 18,
    servingSize: 1,
    sku: "10036"
  },
  {
    name: "Triple Smash Set (Meal Deal)",
    category: "Smash Burger Sets (Meal Deals)",
    meatQuantity: 3,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Triple burger meal deal with fries and drink",
    preparationTime: 20,
    servingSize: 1,
    sku: "10034"
  },
  
  // Smash Burgers - Beef
  {
    name: "Single Smash Burger (ซิงเกิ้ล)",
    category: "Smash Burgers",
    meatQuantity: 1,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Classic single smash burger with caramelized edges",
    preparationTime: 8,
    servingSize: 1,
    sku: "10004"
  },
  {
    name: "Super Double Bacon and Cheese (ซูเปอร์ดับเบิ้ลเบคอน)",
    category: "Smash Burgers",
    meatQuantity: 2,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Premium double burger with bacon and cheese",
    preparationTime: 15,
    servingSize: 1,
    sku: "10019"
  },
  {
    name: "Super Single Bacon & Cheese",
    category: "Smash Burgers",
    meatQuantity: 1,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Premium single burger with bacon and cheese",
    preparationTime: 12,
    servingSize: 1,
    sku: "10038"
  },
  {
    name: "Triple Smash Burger (สาม)",
    category: "Smash Burgers",
    meatQuantity: 3,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Triple-stacked smash burger for serious appetites",
    preparationTime: 18,
    servingSize: 1,
    sku: "10009"
  },
  {
    name: "Ultimate Double (คู่)",
    category: "Smash Burgers",
    meatQuantity: 2,
    meatType: "Beef",
    bunQuantity: 1,
    description: "Ultimate double burger with premium toppings",
    preparationTime: 15,
    servingSize: 1,
    sku: "10006"
  },
  
  // Smash Burgers - Chicken
  {
    name: "Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)",
    category: "Smash Burgers",
    meatQuantity: 3,
    meatType: "Chicken",
    bunQuantity: 1,
    description: "Crispy chicken fillet burger with fresh vegetables",
    preparationTime: 15,
    servingSize: 1,
    sku: "10066"
  },
  {
    name: "Big Rooster Sriracha Chicken ไก่ศรีราชาตัวใหญ่",
    category: "Smash Burgers",
    meatQuantity: 3,
    meatType: "Chicken",
    bunQuantity: 1,
    description: "Spicy sriracha chicken burger with Thai flavors",
    preparationTime: 18,
    servingSize: 1,
    sku: "10068"
  },
  {
    name: "El Smasho Grande Chicken Burger (แกรนด์ชิกเก้น)",
    category: "Smash Burgers",
    meatQuantity: 3,
    meatType: "Chicken",
    bunQuantity: 1,
    description: "Chipotle-seasoned chicken burger with Mexican-inspired flavors",
    preparationTime: 18,
    servingSize: 1,
    sku: "10037"
  }
];

function generateInstructions(item) {
  if (item.meatType === "Chicken") {
    return `1. Preheat oil to 350°F (175°C) for frying
2. Bread chicken fillets with seasoned flour
3. Fry chicken until golden brown and cooked through
4. Toast bun halves until golden brown
5. Prepare sauces and fresh vegetables
6. Assemble burger with crispy chicken and toppings
7. Serve immediately while hot`;
  }
  
  if (item.category.includes("Kids")) {
    return `1. Use smaller portions suitable for children
2. Preheat grill to medium heat
3. Cook patties thoroughly (well-done for kids)
4. Toast bun lightly
5. Add mild cheese and simple toppings
6. Cut burger in half for easier eating
7. Serve with kid-friendly sides`;
  }
  
  return `1. Preheat grill or griddle to medium-high heat
2. Season meat patties with salt and pepper
3. Toast bun halves until golden brown
4. Cook patties using smash technique - press down firmly
5. Add cheese during last minute of cooking
6. Assemble burger with fresh toppings
7. Serve immediately while hot`;
}

async function createRecipes() {
  const baseUrl = 'http://localhost:5000';
  let successCount = 0;
  let errorCount = 0;
  
  console.log('Creating recipes for all menu items...');
  
  for (const item of menuItems) {
    try {
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
      
      const response = await fetch(`${baseUrl}/api/recipes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recipeData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const recipe = await response.json();
      console.log(`✓ Created recipe: ${recipe.name} (ID: ${recipe.id})`);
      successCount++;
      
    } catch (error) {
      console.error(`✗ Error creating recipe for ${item.name}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`\nSummary: ${successCount} recipes created successfully, ${errorCount} errors`);
}

createRecipes().catch(console.error);