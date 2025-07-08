// Script to create base recipes for all menu items sold in last shift
const recipes = [
  // BURGERS
  {
    name: "Single Smash Burger (ซิงเกิ้ล)",
    category: "BURGERS",
    description: "Classic single smash burger with beef patty, lettuce, tomato, onions, pickles, and special sauce",
    ingredients: [
      { name: "Burger Buns", quantity: 1, unit: "piece", notes: "Top and bottom bun" },
      { name: "Beef Patty", quantity: 1, unit: "piece", notes: "Fresh ground beef, smashed" },
      { name: "Lettuce", quantity: 1, unit: "leaf", notes: "Fresh iceberg lettuce" },
      { name: "Tomato", quantity: 2, unit: "slices", notes: "Fresh tomato slices" },
      { name: "White Onion", quantity: 2, unit: "slices", notes: "Fresh white onion" },
      { name: "Dill Pickles", quantity: 2, unit: "slices", notes: "Dill pickle slices" },
      { name: "Special Sauce", quantity: 1, unit: "tbsp", notes: "House special burger sauce" },
      { name: "Cheese", quantity: 1, unit: "slice", notes: "American cheese slice" }
    ],
    instructions: [
      "Prepare beef patty by forming into ball and smashing on hot griddle",
      "Season with salt and pepper while cooking",
      "Toast burger buns lightly",
      "Apply special sauce to bottom bun", 
      "Layer lettuce, tomato, onion, pickles",
      "Add cooked beef patty with cheese",
      "Top with remaining sauce and close with top bun"
    ],
    prepTime: 5,
    cookTime: 3,
    servings: 1
  },
  
  {
    name: "Ultimate Double (คู่)",
    category: "BURGERS", 
    description: "Double smash burger with two beef patties, double cheese, and premium toppings",
    ingredients: [
      { name: "Burger Buns", quantity: 1, unit: "piece", notes: "Top and bottom bun" },
      { name: "Beef Patty", quantity: 2, unit: "pieces", notes: "Fresh ground beef, smashed" },
      { name: "Lettuce", quantity: 2, unit: "leaves", notes: "Fresh iceberg lettuce" },
      { name: "Tomato", quantity: 3, unit: "slices", notes: "Fresh tomato slices" },
      { name: "White Onion", quantity: 3, unit: "slices", notes: "Fresh white onion" },
      { name: "Dill Pickles", quantity: 3, unit: "slices", notes: "Dill pickle slices" },
      { name: "Special Sauce", quantity: 2, unit: "tbsp", notes: "House special burger sauce" },
      { name: "Cheese", quantity: 2, unit: "slices", notes: "American cheese slices" }
    ],
    instructions: [
      "Prepare two beef patties by forming into balls and smashing on hot griddle",
      "Season with salt and pepper while cooking",
      "Toast burger buns lightly",
      "Apply special sauce to bottom bun",
      "Layer lettuce, tomato, onion, pickles", 
      "Add first cooked beef patty with cheese",
      "Add second beef patty with cheese",
      "Top with remaining sauce and close with top bun"
    ],
    prepTime: 6,
    cookTime: 4,
    servings: 1
  },

  {
    name: "Super Double Bacon and Cheese (ซูเปอร์ดับเบิ้ลเบคอน)",
    category: "BURGERS",
    description: "Premium double burger with bacon, double cheese, and gourmet toppings",
    ingredients: [
      { name: "Burger Buns", quantity: 1, unit: "piece", notes: "Top and bottom bun" },
      { name: "Beef Patty", quantity: 2, unit: "pieces", notes: "Fresh ground beef, smashed" },
      { name: "Bacon", quantity: 3, unit: "strips", notes: "Crispy bacon strips" },
      { name: "Lettuce", quantity: 2, unit: "leaves", notes: "Fresh iceberg lettuce" },
      { name: "Tomato", quantity: 3, unit: "slices", notes: "Fresh tomato slices" },
      { name: "White Onion", quantity: 3, unit: "slices", notes: "Fresh white onion" },
      { name: "Dill Pickles", quantity: 3, unit: "slices", notes: "Dill pickle slices" },
      { name: "Special Sauce", quantity: 2, unit: "tbsp", notes: "House special burger sauce" },
      { name: "Cheese", quantity: 2, unit: "slices", notes: "American cheese slices" }
    ],
    instructions: [
      "Cook bacon strips until crispy, set aside",
      "Prepare two beef patties by forming into balls and smashing on hot griddle",
      "Season with salt and pepper while cooking",
      "Toast burger buns lightly",
      "Apply special sauce to bottom bun",
      "Layer lettuce, tomato, onion, pickles",
      "Add first cooked beef patty with cheese",
      "Layer crispy bacon strips",
      "Add second beef patty with cheese",
      "Top with remaining sauce and close with top bun"
    ],
    prepTime: 8,
    cookTime: 6,
    servings: 1
  },

  {
    name: "Triple Smash Burger (สาม)",
    category: "BURGERS",
    description: "Ultimate triple patty burger with three beef patties and triple cheese",
    ingredients: [
      { name: "Burger Buns", quantity: 1, unit: "piece", notes: "Top and bottom bun" },
      { name: "Beef Patty", quantity: 3, unit: "pieces", notes: "Fresh ground beef, smashed" },
      { name: "Lettuce", quantity: 3, unit: "leaves", notes: "Fresh iceberg lettuce" },
      { name: "Tomato", quantity: 4, unit: "slices", notes: "Fresh tomato slices" },
      { name: "White Onion", quantity: 4, unit: "slices", notes: "Fresh white onion" },
      { name: "Dill Pickles", quantity: 4, unit: "slices", notes: "Dill pickle slices" },
      { name: "Special Sauce", quantity: 3, unit: "tbsp", notes: "House special burger sauce" },
      { name: "Cheese", quantity: 3, unit: "slices", notes: "American cheese slices" }
    ],
    instructions: [
      "Prepare three beef patties by forming into balls and smashing on hot griddle",
      "Season with salt and pepper while cooking",
      "Toast burger buns lightly",
      "Apply special sauce to bottom bun",
      "Layer lettuce, tomato, onion, pickles",
      "Add first cooked beef patty with cheese",
      "Add second beef patty with cheese", 
      "Add third beef patty with cheese",
      "Top with remaining sauce and close with top bun"
    ],
    prepTime: 10,
    cookTime: 6,
    servings: 1
  },

  // CHICKEN
  {
    name: "Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)",
    category: "CHICKEN",
    description: "Crispy fried chicken breast fillet with fresh vegetables and sauce",
    ingredients: [
      { name: "Burger Buns", quantity: 1, unit: "piece", notes: "Top and bottom bun" },
      { name: "Chicken Breast", quantity: 1, unit: "piece", notes: "Boneless chicken breast" },
      { name: "Flour", quantity: 0.5, unit: "cup", notes: "All-purpose flour for coating" },
      { name: "Lettuce", quantity: 2, unit: "leaves", notes: "Fresh iceberg lettuce" },
      { name: "Tomato", quantity: 2, unit: "slices", notes: "Fresh tomato slices" },
      { name: "Mayonnaise", quantity: 2, unit: "tbsp", notes: "Creamy mayonnaise" },
      { name: "Oil", quantity: 2, unit: "cups", notes: "Vegetable oil for frying" }
    ],
    instructions: [
      "Pound chicken breast to even thickness",
      "Season chicken with salt and pepper",
      "Coat chicken in seasoned flour",
      "Deep fry in hot oil until golden and cooked through",
      "Toast burger buns lightly",
      "Apply mayonnaise to both buns",
      "Layer lettuce and tomato on bottom bun",
      "Add crispy chicken fillet",
      "Close with top bun"
    ],
    prepTime: 10,
    cookTime: 8,
    servings: 1
  },

  {
    name: "🐔 Big Rooster Sriracha Chicken ไก่ศรีราชาตัวใหญ่",
    category: "CHICKEN",
    description: "Spicy sriracha glazed chicken burger with premium toppings",
    ingredients: [
      { name: "Burger Buns", quantity: 1, unit: "piece", notes: "Top and bottom bun" },
      { name: "Chicken Breast", quantity: 1, unit: "piece", notes: "Large boneless chicken breast" },
      { name: "Sriracha Sauce", quantity: 2, unit: "tbsp", notes: "Spicy sriracha glaze" },
      { name: "Flour", quantity: 0.5, unit: "cup", notes: "All-purpose flour for coating" },
      { name: "Lettuce", quantity: 2, unit: "leaves", notes: "Fresh iceberg lettuce" },
      { name: "Tomato", quantity: 2, unit: "slices", notes: "Fresh tomato slices" },
      { name: "Mayonnaise", quantity: 1, unit: "tbsp", notes: "Creamy mayonnaise" },
      { name: "Oil", quantity: 2, unit: "cups", notes: "Vegetable oil for frying" }
    ],
    instructions: [
      "Pound chicken breast to even thickness",
      "Season chicken with salt and pepper",
      "Coat chicken in seasoned flour",
      "Deep fry in hot oil until golden and cooked through",
      "Glaze hot chicken with sriracha sauce",
      "Toast burger buns lightly",
      "Apply mayonnaise to bottom bun",
      "Layer lettuce and tomato",
      "Add sriracha glazed chicken",
      "Close with top bun"
    ],
    prepTime: 12,
    cookTime: 10,
    servings: 1
  },

  {
    name: "🐔 El Smasho Grande Chicken Burger (แกรนด์ชิกเก้น)",
    category: "CHICKEN",
    description: "Premium large chicken burger with gourmet toppings and special sauce",
    ingredients: [
      { name: "Burger Buns", quantity: 1, unit: "piece", notes: "Large premium bun" },
      { name: "Chicken Breast", quantity: 1, unit: "piece", notes: "Extra large boneless chicken breast" },
      { name: "Flour", quantity: 0.75, unit: "cup", notes: "All-purpose flour for coating" },
      { name: "Lettuce", quantity: 3, unit: "leaves", notes: "Fresh iceberg lettuce" },
      { name: "Tomato", quantity: 3, unit: "slices", notes: "Fresh tomato slices" },
      { name: "Cheese", quantity: 1, unit: "slice", notes: "American cheese slice" },
      { name: "Special Sauce", quantity: 2, unit: "tbsp", notes: "House special sauce" },
      { name: "Oil", quantity: 2, unit: "cups", notes: "Vegetable oil for frying" }
    ],
    instructions: [
      "Pound large chicken breast to even thickness",
      "Season chicken generously with salt and pepper",
      "Coat chicken in seasoned flour",
      "Deep fry in hot oil until golden and cooked through",
      "Melt cheese on hot chicken",
      "Toast large burger buns",
      "Apply special sauce to both buns",
      "Layer lettuce and tomato on bottom bun",
      "Add cheese-topped chicken",
      "Close with top bun"
    ],
    prepTime: 15,
    cookTime: 12,
    servings: 1
  },

  {
    name: "Chicken Nuggets",
    category: "CHICKEN",
    description: "Crispy bite-sized chicken nuggets, perfect for sharing",
    ingredients: [
      { name: "Chicken Breast", quantity: 200, unit: "g", notes: "Boneless chicken breast, diced" },
      { name: "Flour", quantity: 1, unit: "cup", notes: "All-purpose flour for coating" },
      { name: "Breadcrumbs", quantity: 0.5, unit: "cup", notes: "Fine breadcrumbs" },
      { name: "Egg", quantity: 1, unit: "piece", notes: "Beaten egg for coating" },
      { name: "Oil", quantity: 2, unit: "cups", notes: "Vegetable oil for frying" }
    ],
    instructions: [
      "Cut chicken breast into bite-sized pieces",
      "Season chicken pieces with salt and pepper",
      "Set up breading station: flour, beaten egg, breadcrumbs",
      "Coat each piece in flour, then egg, then breadcrumbs",
      "Deep fry in hot oil until golden and cooked through",
      "Serve hot with dipping sauces"
    ],
    prepTime: 15,
    cookTime: 8,
    servings: 4
  },

  // SIDES
  {
    name: "French Fries",
    category: "SIDES",
    description: "Classic golden french fries, crispy outside and fluffy inside",
    ingredients: [
      { name: "Potatoes", quantity: 2, unit: "large", notes: "Russet potatoes, peeled" },
      { name: "Oil", quantity: 4, unit: "cups", notes: "Vegetable oil for frying" },
      { name: "Salt", quantity: 1, unit: "tsp", notes: "Fine salt for seasoning" }
    ],
    instructions: [
      "Cut potatoes into uniform fry-shaped strips",
      "Soak cut potatoes in cold water for 30 minutes",
      "Pat dry with paper towels",
      "Heat oil to 350°F (175°C)",
      "Fry potatoes in batches until golden brown",
      "Drain on paper towels",
      "Season with salt immediately while hot"
    ],
    prepTime: 35,
    cookTime: 8,
    servings: 2
  },

  {
    name: "Sweet Potato Fries",
    category: "SIDES",
    description: "Crispy sweet potato fries with natural sweetness",
    ingredients: [
      { name: "Sweet Potatoes", quantity: 2, unit: "large", notes: "Orange sweet potatoes, peeled" },
      { name: "Oil", quantity: 4, unit: "cups", notes: "Vegetable oil for frying" },
      { name: "Salt", quantity: 1, unit: "tsp", notes: "Fine salt for seasoning" }
    ],
    instructions: [
      "Cut sweet potatoes into uniform fry-shaped strips",
      "Pat dry with paper towels",
      "Heat oil to 350°F (175°C)",
      "Fry sweet potato strips in batches until golden brown",
      "Drain on paper towels",
      "Season with salt immediately while hot"
    ],
    prepTime: 15,
    cookTime: 6,
    servings: 2
  },

  {
    name: "Loaded Fries (Original)",
    category: "SIDES",
    description: "French fries loaded with cheese, bacon, and special toppings",
    ingredients: [
      { name: "French Fries", quantity: 1, unit: "portion", notes: "Cooked french fries" },
      { name: "Cheese", quantity: 2, unit: "slices", notes: "Melted cheese" },
      { name: "Bacon", quantity: 2, unit: "strips", notes: "Crispy bacon, chopped" },
      { name: "Green Onions", quantity: 1, unit: "tbsp", notes: "Chopped green onions" },
      { name: "Sour Cream", quantity: 2, unit: "tbsp", notes: "Cool sour cream" }
    ],
    instructions: [
      "Prepare hot french fries",
      "Melt cheese over hot fries",
      "Cook bacon until crispy, then chop",
      "Sprinkle chopped bacon over cheese-covered fries",
      "Garnish with chopped green onions",
      "Serve with sour cream on the side"
    ],
    prepTime: 5,
    cookTime: 3,
    servings: 1
  },

  {
    name: "Cheesy Bacon Fries",
    category: "SIDES",
    description: "French fries topped with melted cheese and crispy bacon bits",
    ingredients: [
      { name: "French Fries", quantity: 1, unit: "portion", notes: "Cooked french fries" },
      { name: "Cheese", quantity: 3, unit: "slices", notes: "Melted cheese" },
      { name: "Bacon", quantity: 3, unit: "strips", notes: "Crispy bacon, chopped" },
      { name: "Special Sauce", quantity: 1, unit: "tbsp", notes: "House special sauce" }
    ],
    instructions: [
      "Prepare hot french fries",
      "Cover fries generously with melted cheese",
      "Cook bacon until crispy, then chop",
      "Sprinkle chopped bacon over cheese-covered fries",
      "Drizzle with special sauce",
      "Serve immediately while hot"
    ],
    prepTime: 5,
    cookTime: 3,
    servings: 1
  },

  {
    name: "Onion Rings",
    category: "SIDES",
    description: "Crispy beer-battered onion rings with sweet onion center",
    ingredients: [
      { name: "White Onions", quantity: 2, unit: "large", notes: "Cut into thick rings" },
      { name: "Flour", quantity: 1, unit: "cup", notes: "All-purpose flour" },
      { name: "Beer", quantity: 0.5, unit: "cup", notes: "Light beer for batter" },
      { name: "Oil", quantity: 4, unit: "cups", notes: "Vegetable oil for frying" },
      { name: "Salt", quantity: 1, unit: "tsp", notes: "For seasoning" }
    ],
    instructions: [
      "Cut onions into thick rings, separate rings",
      "Make batter by mixing flour, beer, and salt",
      "Heat oil to 350°F (175°C)",
      "Dip onion rings in batter",
      "Fry until golden brown and crispy",
      "Drain on paper towels",
      "Serve hot with dipping sauce"
    ],
    prepTime: 20,
    cookTime: 10,
    servings: 3
  },

  {
    name: "Coleslaw with Bacon",
    category: "SIDES",
    description: "Creamy coleslaw salad with crispy bacon bits",
    ingredients: [
      { name: "White Cabbage", quantity: 2, unit: "cups", notes: "Finely shredded" },
      { name: "Purple Cabbage", quantity: 0.5, unit: "cup", notes: "Finely shredded" },
      { name: "Carrots", quantity: 1, unit: "medium", notes: "Julienned" },
      { name: "Mayonnaise", quantity: 3, unit: "tbsp", notes: "Creamy mayonnaise" },
      { name: "Bacon", quantity: 2, unit: "strips", notes: "Crispy bacon, chopped" }
    ],
    instructions: [
      "Shred white and purple cabbage finely",
      "Julienne carrots into thin strips",
      "Cook bacon until crispy, then chop",
      "Mix cabbage and carrots in large bowl",
      "Add mayonnaise and mix well",
      "Top with chopped bacon before serving",
      "Chill before serving if desired"
    ],
    prepTime: 15,
    cookTime: 5,
    servings: 4
  },

  // MEAL SETS
  {
    name: "Single Meal Set (Meal Deal)",
    category: "MEAL SETS",
    description: "Single burger, fries, and drink combo meal",
    ingredients: [
      { name: "Single Smash Burger", quantity: 1, unit: "piece", notes: "Complete burger" },
      { name: "French Fries", quantity: 1, unit: "portion", notes: "Medium portion" },
      { name: "Drink", quantity: 1, unit: "can", notes: "Choice of soft drink" }
    ],
    instructions: [
      "Prepare single smash burger according to recipe",
      "Prepare medium portion of french fries",
      "Serve burger and fries on plate",
      "Include customer's choice of drink",
      "Serve together as combo meal"
    ],
    prepTime: 8,
    cookTime: 6,
    servings: 1
  },

  {
    name: "Double Set (Meal Deal)",
    category: "MEAL SETS",
    description: "Double burger, fries, and drink combo meal",
    ingredients: [
      { name: "Ultimate Double Burger", quantity: 1, unit: "piece", notes: "Complete double burger" },
      { name: "French Fries", quantity: 1, unit: "portion", notes: "Medium portion" },
      { name: "Drink", quantity: 1, unit: "can", notes: "Choice of soft drink" }
    ],
    instructions: [
      "Prepare ultimate double burger according to recipe",
      "Prepare medium portion of french fries",
      "Serve burger and fries on plate",
      "Include customer's choice of drink",
      "Serve together as combo meal"
    ],
    prepTime: 10,
    cookTime: 8,
    servings: 1
  },

  {
    name: "Super Double Bacon & Cheese Set (Meal Deal)",
    category: "MEAL SETS", 
    description: "Super double bacon burger, fries, and drink combo meal",
    ingredients: [
      { name: "Super Double Bacon and Cheese Burger", quantity: 1, unit: "piece", notes: "Complete premium burger" },
      { name: "French Fries", quantity: 1, unit: "portion", notes: "Large portion" },
      { name: "Drink", quantity: 1, unit: "can", notes: "Choice of soft drink" }
    ],
    instructions: [
      "Prepare super double bacon and cheese burger according to recipe",
      "Prepare large portion of french fries",
      "Serve burger and fries on plate",
      "Include customer's choice of drink",
      "Serve together as premium combo meal"
    ],
    prepTime: 12,
    cookTime: 10,
    servings: 1
  },

  // BEVERAGES
  {
    name: "Coke Can",
    category: "BEVERAGES",
    description: "Classic Coca-Cola in can",
    ingredients: [
      { name: "Coca-Cola Can", quantity: 1, unit: "can", notes: "330ml can" }
    ],
    instructions: [
      "Serve chilled Coca-Cola can",
      "Provide glass with ice if requested"
    ],
    prepTime: 1,
    cookTime: 0,
    servings: 1
  },

  {
    name: "Sprite",
    category: "BEVERAGES",
    description: "Refreshing lemon-lime soda",
    ingredients: [
      { name: "Sprite Can", quantity: 1, unit: "can", notes: "330ml can" }
    ],
    instructions: [
      "Serve chilled Sprite can",
      "Provide glass with ice if requested"
    ],
    prepTime: 1,
    cookTime: 0,
    servings: 1
  },

  {
    name: "Schweppes Lime",
    category: "BEVERAGES", 
    description: "Schweppes lime flavored sparkling water",
    ingredients: [
      { name: "Schweppes Lime Can", quantity: 1, unit: "can", notes: "330ml can" }
    ],
    instructions: [
      "Serve chilled Schweppes Lime can",
      "Provide glass with ice if requested"
    ],
    prepTime: 1,
    cookTime: 0,
    servings: 1
  }
];

console.log(`Created ${recipes.length} base recipes for all menu items:`);
console.log("BURGERS:", recipes.filter(r => r.category === "BURGERS").length);
console.log("CHICKEN:", recipes.filter(r => r.category === "CHICKEN").length);  
console.log("SIDES:", recipes.filter(r => r.category === "SIDES").length);
console.log("MEAL SETS:", recipes.filter(r => r.category === "MEAL SETS").length);
console.log("BEVERAGES:", recipes.filter(r => r.category === "BEVERAGES").length);

module.exports = recipes;