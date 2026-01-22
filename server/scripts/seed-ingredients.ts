import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';

const prisma = new PrismaClient();

type IngredientRow = {
  name: string;
  category: string;
  supplier: string;
  purchase_quantity: number;
  purchase_unit: string;
  purchase_cost_thb: number;
  portion_quantity: number;
  portion_unit: string;
  conversion_factor: number | null;
  is_active: boolean;
};

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function seedIngredients() {
  const ingredients: IngredientRow[] = [];

  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const csvPath = path.resolve(dirname, '../../ingredient_master.csv');

  fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', (row) => {
      const name = row.name ?? row.Name ?? row.Ingredient ?? row.ingredient;
      if (!name) {
        return;
      }

      const category =
        row.category ?? row.Category ?? row.category_name ?? 'Uncategorised';
      const supplier = row.supplier ?? row.Supplier ?? row.vendor ?? '';
      const purchaseQuantity = parseNumber(
        row.purchase_quantity ?? row.Purchase_Qty ?? row.purchase_qty ?? row.Purchase_Quantity,
      );
      const purchaseUnit =
        row.purchase_unit ?? row.Purchase_Unit ?? row.purchase_unit ?? row.Purchase_Unit;
      const purchaseCostThb = parseNumber(
        row.purchase_cost_thb ?? row.Purchase_Cost ?? row.purchase_cost,
      );
      const portionUnitRaw =
        row.portion_unit ?? row.Portion_Unit ?? row.portion_unit ?? row.Portion_Unit;
      const portionQuantityRaw = parseNumber(
        row.portion_quantity ?? row.Portion_Quantity ?? row.portion_quantity,
      );
      const portionsPerPurchase = parseNumber(
        row.portions_per_purchase ?? row.Portions_Per_Purchase ?? row.portions_per_purchase,
      );
      const conversionFactor = parseNumber(
        row.conversion_factor ?? row.Conversion_Factor ?? row.conversion_factor,
      );

      if (!supplier || purchaseQuantity === null || !purchaseUnit || purchaseCostThb === null) {
        return;
      }

      const portionUnit = portionUnitRaw || purchaseUnit;
      const portionQuantity =
        portionQuantityRaw ??
        (portionsPerPurchase && portionsPerPurchase > 0
          ? purchaseQuantity / portionsPerPurchase
          : purchaseQuantity);

      ingredients.push({
        name,
        category,
        supplier,
        purchase_quantity: purchaseQuantity,
        purchase_unit: purchaseUnit,
        purchase_cost_thb: purchaseCostThb,
        portion_quantity: portionQuantity,
        portion_unit: portionUnit,
        conversion_factor: conversionFactor,
        is_active: true,
      });
    })
    .on('end', async () => {
      try {
        await prisma.$executeRaw`DELETE FROM ingredient_authority`;
        await prisma.$transaction(
          ingredients.map((ingredient) =>
            prisma.$executeRaw`
              INSERT INTO ingredient_authority (
                name,
                category,
                supplier,
                purchase_quantity,
                purchase_unit,
                purchase_cost_thb,
                portion_quantity,
                portion_unit,
                conversion_factor,
                is_active
              ) VALUES (
                ${ingredient.name},
                ${ingredient.category},
                ${ingredient.supplier},
                ${ingredient.purchase_quantity},
                ${ingredient.purchase_unit},
                ${ingredient.purchase_cost_thb},
                ${ingredient.portion_quantity},
                ${ingredient.portion_unit},
                ${ingredient.conversion_factor},
                ${ingredient.is_active}
              )
            `,
          ),
        );
        console.log(`Seeded ${ingredients.length} ingredients`);
      } catch (e) {
        console.error(e);
      } finally {
        await prisma.$disconnect();
      }
    });
}

seedIngredients();
