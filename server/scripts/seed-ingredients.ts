import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  console.log("Seeding ingredient_authority...");

  const ingredients = [
    {
      name: "Cheese Slice",
      purchaseUnitQty: 1000,
      purchaseUnitUom: "grams",
      portionUnitUom: "slice",
      notes: "Standard burger cheese slice"
    },
    {
      name: "Beef Patty",
      purchaseUnitQty: 5000,
      purchaseUnitUom: "grams",
      portionUnitUom: "grams",
      notes: "Ground beef for smash patties"
    },
    {
      name: "Burger Bun",
      purchaseUnitQty: 12,
      purchaseUnitUom: "unit",
      portionUnitUom: "unit",
      notes: "Standard burger bun"
    }
  ];

  for (const ingredient of ingredients) {
    await prisma.ingredientAuthority.upsert({
      where: { name: ingredient.name },
      update: {},
      create: ingredient
    });

    console.log(`✔ Seeded: ${ingredient.name}`);
  }

  console.log("Ingredient seeding complete.");
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
