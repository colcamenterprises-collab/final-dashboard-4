import { and, gte, inArray, lte } from "drizzle-orm";
import { db } from "../../db";
import {
  ingredients,
  loyverseReceipts,
  modifierEffectAuthority,
  modifierOptionAuthority,
  productRecipeAuthority,
  recipeIngredientAuthority,
  saleCanonicalAuthority,
} from "@shared/schema";
import { ModifierResolver, ModifierEffect } from "./modifierResolver";

type ReceiptRow = {
  receiptId: string;
  receiptDate: Date;
  items: unknown;
  rawData: unknown;
};

type ReceiptItem = {
  sku?: string | null;
  item_sku?: string | null;
  item_id?: string | null;
  name?: string;
  quantity?: number;
  qty?: number;
  modifiers?: unknown;
  modifier_options?: unknown;
};

type ModifierInput = {
  posModifierId?: string;
  posOptionId?: string;
};

const resolver = new ModifierResolver();

const ensureArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const normalizeSku = (item: ReceiptItem): string | null => {
  const sku = item.sku ?? item.item_sku ?? item.item_id;
  if (!sku) return null;
  return String(sku).trim();
};

const parseQty = (item: ReceiptItem): number => {
  const raw = item.quantity ?? item.qty ?? 1;
  const value = Number(raw);
  if (Number.isNaN(value) || value <= 0) return 0;
  return Math.floor(value);
};

const extractModifierInputs = (item: ReceiptItem): ModifierInput[] => {
  const modifiers = ensureArray(item.modifiers ?? item.modifier_options);
  return modifiers
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const posModifierId = record.modifier_id ?? record.pos_modifier_id;
      const posOptionId = record.option_id ?? record.modifier_option_id ?? record.pos_option_id;
      if (!posOptionId && !posModifierId) return null;
      return {
        posModifierId: posModifierId ? String(posModifierId) : undefined,
        posOptionId: posOptionId ? String(posOptionId) : undefined,
      };
    })
    .filter((entry): entry is ModifierInput => Boolean(entry));
};

const resolveReceiptItems = (receipt: ReceiptRow): ReceiptItem[] => {
  const items = ensureArray(receipt.items);
  if (items.length > 0) {
    return items as ReceiptItem[];
  }

  const raw = receipt.rawData as Record<string, unknown> | null;
  if (raw && Array.isArray(raw.line_items)) {
    return raw.line_items as ReceiptItem[];
  }

  if (raw && Array.isArray(raw.items)) {
    return raw.items as ReceiptItem[];
  }

  return [];
};

export type BuildCanonicalSalesParams = {
  receiptIds?: string[];
  from?: Date;
  to?: Date;
};

export async function buildSaleCanonicalAuthority({ receiptIds, from, to }: BuildCanonicalSalesParams) {
  const whereConditions = [];
  if (receiptIds && receiptIds.length > 0) {
    whereConditions.push(inArray(loyverseReceipts.receiptId, receiptIds));
  }
  if (from) {
    whereConditions.push(gte(loyverseReceipts.receiptDate, from));
  }
  if (to) {
    whereConditions.push(lte(loyverseReceipts.receiptDate, to));
  }

  const receipts = await db
    .select({
      receiptId: loyverseReceipts.receiptId,
      receiptDate: loyverseReceipts.receiptDate,
      items: loyverseReceipts.items,
      rawData: loyverseReceipts.rawData,
    })
    .from(loyverseReceipts)
    .where(whereConditions.length ? and(...whereConditions) : undefined);

  if (receipts.length === 0) {
    return { inserted: 0, receiptsProcessed: 0 };
  }

  const receiptIdList = receipts.map((receipt) => receipt.receiptId);
  await db.delete(saleCanonicalAuthority).where(inArray(saleCanonicalAuthority.receiptId, receiptIdList));

  const productRecipes = await db.select().from(productRecipeAuthority);
  const recipeIngredients = await db.select().from(recipeIngredientAuthority);
  const modifierOptions = await db.select().from(modifierOptionAuthority);
  const modifierEffects = await db.select().from(modifierEffectAuthority);
  const ingredientCosts = await db
    .select({
      id: ingredients.id,
      unitCostPerBase: ingredients.unitCostPerBase,
    })
    .from(ingredients);

  const recipeBySku = new Map(productRecipes.map((recipe) => [recipe.productSku, recipe]));
  const ingredientsByRecipe = recipeIngredients.reduce((acc, ingredient) => {
    const list = acc.get(ingredient.recipeId) ?? [];
    list.push(ingredient);
    acc.set(ingredient.recipeId, list);
    return acc;
  }, new Map<number, typeof recipeIngredients>());

  const modifierByKey = new Map<string, typeof modifierOptions[number]>();
  const modifierByOptionId = new Map<string, number | null>();
  const modifierById = new Map<number, typeof modifierOptions[number]>();

  for (const option of modifierOptions) {
    modifierByKey.set(`${option.posModifierId}::${option.posOptionId}`, option);
    const existing = modifierByOptionId.get(option.posOptionId);
    modifierByOptionId.set(option.posOptionId, existing === undefined ? option.id : null);
    modifierById.set(option.id, option);
  }

  const effectsByOption = modifierEffects.reduce((acc, effect) => {
    const list = acc.get(effect.modifierOptionId) ?? [];
    list.push(effect);
    acc.set(effect.modifierOptionId, list);
    return acc;
  }, new Map<number, typeof modifierEffects>());

  const costByIngredient = new Map<number, number | null>(
    ingredientCosts.map((row) => [row.id, row.unitCostPerBase ? Number(row.unitCostPerBase) : null])
  );

  const rows: Array<typeof saleCanonicalAuthority.$inferInsert> = [];

  for (const receipt of receipts) {
    const items = resolveReceiptItems(receipt);

    for (const item of items) {
      const sku = normalizeSku(item);
      if (!sku) {
        continue;
      }

      const qty = parseQty(item);
      if (qty === 0) {
        continue;
      }

      const recipe = recipeBySku.get(sku);
      if (!recipe) {
        continue;
      }

      const baseIngredients = (ingredientsByRecipe.get(recipe.id) ?? []).map((ingredient) => ({
        ingredientId: ingredient.ingredientId,
        qty: Number(ingredient.qty),
        unit: ingredient.unit,
      }));

      const modifierInputs = extractModifierInputs(item);
      const modifierOptionIds = modifierInputs
        .map((modifier) => {
          if (modifier.posModifierId && modifier.posOptionId) {
            return modifierByKey.get(`${modifier.posModifierId}::${modifier.posOptionId}`)?.id;
          }

          if (modifier.posOptionId) {
            const resolved = modifierByOptionId.get(modifier.posOptionId);
            return resolved ?? undefined;
          }

          return undefined;
        })
        .filter((value): value is number => typeof value === "number")
        .sort((a, b) => a - b);

      const effects: ModifierEffect[] = modifierOptionIds.flatMap((optionId) => {
        const option = modifierById.get(optionId);
        const optionEffects = effectsByOption.get(optionId) ?? [];
        if (!option) return [];

        return optionEffects.map((effect) => ({
          ingredientId: effect.ingredientId,
          qtyDelta: Number(effect.qtyDelta),
          unit: effect.unit,
          type: option.type,
        }));
      });

      const resolution = resolver.resolve(baseIngredients, effects);

      let finalCost: number | null = 0;
      for (const ingredient of resolution.ingredients) {
        const unitCost = costByIngredient.get(ingredient.ingredientId);
        if (unitCost === null || unitCost === undefined) {
          finalCost = null;
          break;
        }

        if (finalCost !== null) {
          finalCost += ingredient.qty * unitCost;
        }
      }

      for (let i = 0; i < qty; i += 1) {
        rows.push({
          receiptId: receipt.receiptId,
          productSku: sku,
          modifierOptionIds,
          finalCost: finalCost === null ? null : finalCost.toFixed(4),
          createdAt: receipt.receiptDate,
        });
      }
    }
  }

  const chunkSize = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    await db.insert(saleCanonicalAuthority).values(chunk);
    inserted += chunk.length;
  }

  return { inserted, receiptsProcessed: receipts.length };
}
