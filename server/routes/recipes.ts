import { Router } from 'express';
import { db, pool } from '../db';
import { sql } from 'drizzle-orm';
import { calculateRecipeWorkflow, decimalOrNull, recipeStatusFromBody } from '../services/recipes/workflow';

const router = Router();

async function refreshCostSources(ingredients: any[]): Promise<any[]> {
  const purchasingIds = [...new Set(ingredients.filter((row) => row?.sourceType === 'purchasing').map((row) => Number(row?.purchasingItemId)).filter((id) => Number.isInteger(id) && id > 0))];
  const recipeIds = [...new Set(ingredients.filter((row) => row?.sourceType === 'recipe').map((row) => Number(row?.recipeId)).filter((id) => Number.isInteger(id) && id > 0))];
  const catalogue = new Map<number, any>();
  const components = new Map<number, any>();
  if (purchasingIds.length) {
    const result = await pool!.query('SELECT id, item, purchase_cost_thb, purchase_quantity, base_unit FROM purchasing_items WHERE id = ANY($1::int[]) AND active = true', [purchasingIds]);
    result.rows.forEach((row: any) => catalogue.set(Number(row.id), row));
  }
  if (recipeIds.length) {
    const result = await pool!.query('SELECT id, name, cost_per_serving, is_active FROM recipes WHERE id = ANY($1::int[])', [recipeIds]);
    result.rows.forEach((row: any) => components.set(Number(row.id), row));
  }
  return ingredients.map((row) => {
    if (row?.sourceType === 'recipe') {
      const component = components.get(Number(row.recipeId));
      const cost = Number(component?.cost_per_serving);
      if (!component || !component.is_active || !Number.isFinite(cost) || cost < 0) return { ...row, purchaseCost: '', costingStatus: 'MISSING_COMPONENT_RECIPE_COST' };
      return { ...row, name: component.name, purchaseCost: String(cost), packageQuantity: '1', purchaseUnit: 'each', unitUsed: 'each', wastePercent: '', costingStatus: 'CURRENT_RECIPE_COST' };
    }
    const item = row?.sourceType === 'purchasing' && row?.purchasingItemId ? catalogue.get(Number(row.purchasingItemId)) : null;
    if (!item) return row;
    const cost = Number(item.purchase_cost_thb), quantity = Number(item.purchase_quantity);
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(quantity) || quantity <= 0 || !item.base_unit) return { ...row, costingStatus: 'MISSING_PURCHASING_PACK_DATA' };
    return { ...row, ingredientId: null, name: item.item, purchaseCost: String(cost), packageQuantity: String(quantity), purchaseUnit: item.base_unit, costingStatus: 'CURRENT_PURCHASING_PRICE' };
  });
}

async function assertNoRecipeCycle(recipeId: number, ingredients: any[]) {
  const direct = ingredients.filter((row) => row?.sourceType === 'recipe').map((row) => Number(row.recipeId)).filter(Number.isInteger);
  if (direct.includes(recipeId)) throw new Error('A recipe cannot contain itself as a component.');
  const seen = new Set<number>();
  const visit = async (id: number): Promise<boolean> => {
    if (id === recipeId) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    const result = await pool!.query('SELECT ingredients FROM recipes WHERE id=$1', [id]);
    const rows = Array.isArray(result.rows[0]?.ingredients) ? result.rows[0].ingredients : [];
    for (const row of rows) if (row?.sourceType === 'recipe' && await visit(Number(row.recipeId))) return true;
    return false;
  };
  for (const id of direct) if (await visit(id)) throw new Error('This component would create a circular recipe dependency.');
}

async function refreshDependentRecipeCosts(changedRecipeId: number, visited = new Set<number>()) {
  if (visited.has(changedRecipeId)) return;
  visited.add(changedRecipeId);
  const result = await pool!.query(`SELECT id, ingredients, yield_quantity, selling_price, suggested_price FROM recipes WHERE ingredients @> $1::jsonb`, [JSON.stringify([{ sourceType: 'recipe', recipeId: changedRecipeId }])]);
  for (const parent of result.rows) {
    const rows = await refreshCostSources(Array.isArray(parent.ingredients) ? parent.ingredients : []);
    const workflow = calculateRecipeWorkflow({ ingredients: rows, yieldQuantity: parent.yield_quantity, sellingPrice: parent.selling_price, suggestedPrice: parent.suggested_price });
    await pool!.query(`UPDATE recipes SET ingredients=$1::jsonb, total_cost=$2, cost_per_serving=$3, direct_margin_percent=$4, delivery_partner_margin_percent=$5, updated_at=NOW() WHERE id=$6`, [JSON.stringify(workflow.ingredients), workflow.totalCost, workflow.costPerServing, workflow.directMarginPercent, workflow.deliveryPartnerMarginPercent, parent.id]);
    await refreshDependentRecipeCosts(Number(parent.id), visited);
  }
}

type ColumnSet = Set<string>;
async function getColumns(tableName: string): Promise<ColumnSet> { if (!pool) throw new Error('Database unavailable'); const result = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [tableName]); return new Set(result.rows.map((row: { column_name: string }) => row.column_name)); }
async function hasTable(tableName: string): Promise<boolean> { if (!pool) throw new Error('Database unavailable'); const result = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`, [tableName]); return result.rowCount > 0; }
async function getRecipeColumns(): Promise<ColumnSet> { return getColumns('recipes'); }

function recipeSelect(columns: ColumnSet) {
  const has = (name: string) => columns.has(name);
  const expr = (column: string, alias: string, fallback = 'NULL') => has(column) ? `${column} AS "${alias}"` : `${fallback} AS "${alias}"`;
  const priceExpr = has('selling_price') ? 'selling_price AS "sellingPrice"' : expr('menu_price_thb', 'sellingPrice');
  const suggestedExpr = has('suggested_price') ? 'suggested_price AS "suggestedPrice"' : expr('menu_price_thb', 'suggestedPrice');
  return ['id','name',expr('description','description'),expr('category','category'),expr('yield_quantity','yieldQuantity'),expr('yield_unit','yieldUnit'),expr('total_cost','totalCost'),expr('cost_per_serving','costPerServing'),expr('delivery_partner_margin_percent','deliveryPartnerMarginPercent'),expr('direct_margin_percent','directMarginPercent'),expr('cogs_percent','cogsPercent'),suggestedExpr,priceExpr,expr('waste_factor','wasteFactor'),expr('image_url','imageUrl'),expr('instructions','instructions'),expr('notes','notes'),expr('ingredients','ingredients',"'[]'::jsonb"),expr('is_active','isActive','true'),expr('version','version'),expr('parent_id','parentId'),expr('created_at','createdAt'),expr('updated_at','updatedAt')].join(', ');
}
function recipeOrder(columns: ColumnSet) { return columns.has('category') ? 'category NULLS LAST, name' : 'name'; }

async function enrichWithMenuLinks(rows: any[]): Promise<{ rows: any[]; blockers: Array<Record<string, string>> }> {
  if (!pool || !rows.length) return { rows, blockers: [] };
  try {
    const ids = rows.map((row) => Number(row.id)).filter(Number.isInteger); if (!ids.length) return { rows, blockers: [] };
    const links = await pool.query(`SELECT l.recipe_id, i.id AS menu_item_id, i.name_en AS menu_item_name, COALESCE(i.direct_price, i.price) AS menu_item_direct_price, COALESCE(i.grab_price, i.direct_price, i.price) AS menu_item_partner_price FROM ordering_menu_item_recipe_links l JOIN ordering_menu_items i ON i.id = l.menu_item_id WHERE l.recipe_id = ANY($1::int[]) ORDER BY i.name_en ASC, i.id ASC`, [ids]);
    const byRecipe = new Map<number, any[]>();
    for (const link of links.rows) { const recipeId = Number(link.recipe_id), recipeLinks = byRecipe.get(recipeId) || []; recipeLinks.push({ id:String(link.menu_item_id), name:link.menu_item_name, directPrice:link.menu_item_direct_price, partnerPrice:link.menu_item_partner_price }); byRecipe.set(recipeId, recipeLinks); }
    return { rows: rows.map((row) => { const linkedMenuItems = byRecipe.get(Number(row.id)) || [], primary = linkedMenuItems[0]; return primary ? { ...row, linkedMenuItems, linkedMenuItemId:primary.id, linkedMenuItemName:primary.name, linkedMenuItemDirectPrice:primary.directPrice, linkedMenuItemPartnerPrice:primary.partnerPrice } : { ...row, linkedMenuItems }; }), blockers: [] };
  } catch (error:any) { return { rows, blockers:[{ code:'MENU_RECIPE_LINKS_UNAVAILABLE', message:error?.message || 'The recipe-to-menu link status could not be read.', where:'ordering_menu_item_recipe_links' }] }; }
}

router.get('/', async (_req,res) => { try { if(!pool) throw new Error('Database unavailable'); const columns=await getRecipeColumns(); const result=await pool.query(`SELECT ${recipeSelect(columns)} FROM recipes ORDER BY ${recipeOrder(columns)}`); res.json(await enrichWithMenuLinks(result.rows)); } catch(e:any) { res.status(200).json({ rows:[], source:'recipes', blockers:[{ code:'RECIPES_UNAVAILABLE', message:e.message, where:'/api/recipes', canonical_source:'recipes', auto_build_attempted:false }] }); } });
router.get('/:id', async (req,res) => { try { if(!pool) throw new Error('Database unavailable'); const id=Number(req.params.id); if(!Number.isInteger(id)) return res.status(400).json({error:'Invalid id'}); const columns=await getRecipeColumns(); const result=await pool.query(`SELECT ${recipeSelect(columns)} FROM recipes WHERE id=$1 LIMIT 1`,[id]); if(!result.rows.length)return res.status(404).json({error:'Recipe not found'}); const enriched=await enrichWithMenuLinks(result.rows); res.json({...enriched.rows[0],linkBlockers:enriched.blockers}); } catch(e:any){res.status(500).json({error:e.message});} });

router.post('/', async (req,res) => {
  try {
    if(!pool) throw new Error('Database unavailable'); const columns=await getRecipeColumns();
    const {name,category,description,yieldQuantity,yieldUnit,imageUrl,sellingPrice,suggestedPrice,instructions,notes,isActive,status,recipeIngredients}=req.body;
    if(!name||!category)return res.status(400).json({error:'name and category are required'});
    const recipeStatus=recipeStatusFromBody({status,isActive}); const resolvedIngredients=await refreshCostSources(Array.isArray(recipeIngredients)?recipeIngredients:[]); const workflow=calculateRecipeWorkflow({ingredients:resolvedIngredients,yieldQuantity,sellingPrice,suggestedPrice});
    const insertColumns:string[]=[],values:unknown[]=[]; const add=(column:string,value:unknown)=>{if(!columns.has(column))return;insertColumns.push(column);values.push(value);};
    add('name',name);add('category',category);add('description',description??null);add('yield_quantity',String(yieldQuantity??1));add('yield_unit',yieldUnit??'servings');add('image_url',imageUrl??null);add('total_cost',workflow.totalCost);add('cost_per_serving',workflow.costPerServing);add('ingredients',JSON.stringify(workflow.ingredients));
    if(columns.has('selling_price'))add('selling_price',decimalOrNull(sellingPrice));else add('menu_price_thb',decimalOrNull(sellingPrice)); if(columns.has('suggested_price'))add('suggested_price',decimalOrNull(suggestedPrice));else if(!columns.has('selling_price'))add('menu_price_thb',decimalOrNull(suggestedPrice));
    add('delivery_partner_margin_percent',workflow.deliveryPartnerMarginPercent);add('direct_margin_percent',workflow.directMarginPercent);add('instructions',instructions??null);add('notes',notes??null);add('is_active',recipeStatus==='Approved');
    const placeholders=values.map((_,i)=>`$${i+1}`).join(', '); const result=await pool.query(`INSERT INTO recipes (${insertColumns.join(', ')}) VALUES (${placeholders}) RETURNING ${recipeSelect(columns)}`,values); res.json({...result.rows[0],costingBlockers:workflow.blockers});
  } catch(e:any){res.status(500).json({error:e.message});}
});

router.put('/:id', async (req,res) => {
  try {
    if(!pool)throw new Error('Database unavailable'); const id=Number(req.params.id);if(!Number.isInteger(id))return res.status(400).json({error:'Invalid id'});const columns=await getRecipeColumns(),b=req.body;const recipeStatus=recipeStatusFromBody(b); const raw=Array.isArray(b.recipeIngredients)?b.recipeIngredients:[]; await assertNoRecipeCycle(id,raw); const resolvedIngredients=await refreshCostSources(raw);const workflow=calculateRecipeWorkflow({ingredients:resolvedIngredients,yieldQuantity:b.yieldQuantity,sellingPrice:b.sellingPrice,suggestedPrice:b.suggestedPrice});
    const values:unknown[]=[],sets:string[]=[];const add=(column:string,value:unknown)=>{if(!columns.has(column)||value===undefined)return;values.push(value);sets.push(`${column} = COALESCE($${values.length}, ${column})`);};const set=(column:string,value:unknown)=>{if(!columns.has(column)||value===undefined)return;values.push(value);sets.push(`${column} = $${values.length}`);};
    add('name',b.name??null);add('description',b.description??null);add('category',b.category??null);add('yield_quantity',b.yieldQuantity??null);add('yield_unit',b.yieldUnit??null);add('image_url',b.imageUrl??null);set('total_cost',workflow.totalCost);set('cost_per_serving',workflow.costPerServing);set('ingredients',JSON.stringify(workflow.ingredients));
    if(columns.has('selling_price'))set('selling_price',decimalOrNull(b.sellingPrice));else set('menu_price_thb',decimalOrNull(b.sellingPrice));if(columns.has('suggested_price'))set('suggested_price',decimalOrNull(b.suggestedPrice));else if(!columns.has('selling_price'))set('menu_price_thb',decimalOrNull(b.suggestedPrice));set('delivery_partner_margin_percent',workflow.deliveryPartnerMarginPercent);set('direct_margin_percent',workflow.directMarginPercent);
    if(columns.has('is_active')){values.push(recipeStatus==='Approved');sets.push(`is_active = $${values.length}`);}add('instructions',b.instructions??null);add('notes',b.notes??null);if(columns.has('updated_at'))sets.push('updated_at = NOW()');values.push(id);
    const result=await pool.query(`UPDATE recipes SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING ${recipeSelect(columns)}`,values);if(!result.rows.length)return res.status(404).json({error:'Recipe not found'});await refreshDependentRecipeCosts(id);res.json({...result.rows[0],costingBlockers:workflow.blockers});
  }catch(e:any){res.status(500).json({error:e.message});}
});

router.delete('/:id', async (req,res) => {
  if(!pool)return res.status(503).json({error:'Database unavailable'});const id=Number(req.params.id);if(!Number.isInteger(id))return res.status(400).json({error:'Invalid id'});
  const usedBy=await pool.query(`SELECT id,name FROM recipes WHERE ingredients @> $1::jsonb LIMIT 10`,[JSON.stringify([{sourceType:'recipe',recipeId:id}])]); if(usedBy.rows.length)return res.status(409).json({error:'This recipe is used as a component. Remove it from composed recipes before deleting.',usedByRecipes:usedBy.rows});
  const client=await pool.connect();try{await client.query('BEGIN');const existing=await client.query('SELECT id,name FROM recipes WHERE id=$1 FOR UPDATE',[id]);if(!existing.rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'Recipe not found'});}const schema=await client.query(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('menu_item_recipes_v3','ordering_item_modifiers','recipe_lines')`);const columnsByTable=new Map<string,Set<string>>();for(const row of schema.rows){const columns=columnsByTable.get(row.table_name)||new Set<string>();columns.add(row.column_name);columnsByTable.set(row.table_name,columns);}const linkColumns=columnsByTable.get('menu_item_recipes_v3');if(linkColumns?.has('recipe_id')){const linked=await client.query('SELECT "itemId" FROM menu_item_recipes_v3 WHERE recipe_id=$1 LIMIT 10',[id]);if(linked.rows.length>0){await client.query('ROLLBACK');return res.status(409).json({error:'This recipe is linked to a Menu Item. Unlink it from Menu Items before deleting.',linkedMenuItemIds:linked.rows.map((row:any)=>row.itemId)});}}const modifierColumns=columnsByTable.get('ordering_item_modifiers');if(modifierColumns?.has('recipe_id'))await client.query('UPDATE ordering_item_modifiers SET recipe_id=NULL WHERE recipe_id=$1',[id]);const recipeLineColumns=columnsByTable.get('recipe_lines');if(recipeLineColumns?.has('recipe_id'))await client.query('DELETE FROM recipe_lines WHERE recipe_id=$1',[id]);await client.query('DELETE FROM recipes WHERE id=$1',[id]);await client.query('COMMIT');return res.json({ok:true,deleted:id});}catch(e:any){try{await client.query('ROLLBACK');}catch{}return res.status(500).json({error:e.message});}finally{client.release();}
});

export default router;