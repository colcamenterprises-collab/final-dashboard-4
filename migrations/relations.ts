import { relations } from "drizzle-orm/relations";
import { recipes, recipeIngredients, ingredients } from "./schema";

export const recipeIngredientsRelations = relations(recipeIngredients, ({one}) => ({
	recipe: one(recipes, {
		fields: [recipeIngredients.recipeId],
		references: [recipes.id]
	}),
	ingredient: one(ingredients, {
		fields: [recipeIngredients.ingredientId],
		references: [ingredients.id]
	}),
}));

export const recipesRelations = relations(recipes, ({many}) => ({
	recipeIngredients: many(recipeIngredients),
}));

export const ingredientsRelations = relations(ingredients, ({many}) => ({
	recipeIngredients: many(recipeIngredients),
}));