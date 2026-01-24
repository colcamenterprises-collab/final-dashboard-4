// 🔒 INGREDIENT AUTHORITY
// Management-editable governance layer
// Lives under Menu Management for access ONLY
// Units are free-text (dropdowns are assistive only)
// MUST NOT be referenced by recipe builder or ingredient add flow

import { Router } from 'express';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

const router = Router();

// GET /api/admin/ingredient-authority - List all ingredient authorities
router.get('/', async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT 
        ia.*,
        (SELECT COUNT(*) FROM ingredient_authority_versions WHERE ingredient_authority_id = ia.id) as version_count
      FROM ingredient_authority ia
      ORDER BY ia.name ASC
    `);
    res.json({ items: result.rows || result, count: (result.rows || result).length });
  } catch (error: any) {
    console.error('ingredient-authority.list error', error);
    res.status(500).json({ error: 'Failed to fetch ingredient authorities' });
  }
});

// GET /api/admin/ingredient-authority/review-queue - Legacy ingredients not yet approved
router.get('/review-queue', async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT 
        i.id,
        i.name,
        i.category,
        i.supplier_id,
        s.name as supplier_name,
        i.package_cost,
        i.package_qty,
        i.package_unit,
        i.portion_qty,
        i.portion_unit,
        CASE 
          WHEN ia.legacy_ingredient_id IS NOT NULL THEN 'approved'
          ELSE 'pending'
        END as approval_status
      FROM ingredients i
      LEFT JOIN suppliers s ON s.id = i.supplier_id
      LEFT JOIN ingredient_authority ia ON ia.legacy_ingredient_id = CAST(i.id AS TEXT)
      WHERE ia.id IS NULL
      ORDER BY i.name ASC
      LIMIT 200
    `);
    res.json({ items: result.rows || result, count: (result.rows || result).length });
  } catch (error: any) {
    console.error('ingredient-authority.review-queue error', error);
    res.status(500).json({ error: 'Failed to fetch review queue' });
  }
});

// POST /api/admin/ingredient-authority - Create new ingredient authority (approve)
router.post('/', async (req, res) => {
  try {
    const {
      legacyIngredientId,
      name,
      category,
      supplier,
      purchaseQuantity,
      purchaseUnit,
      purchaseCostThb,
      portionQuantity,
      portionUnit,
      conversionFactor,
      notes,
      createdBy
    } = req.body;

    if (!name || !category || !purchaseUnit || !portionUnit) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const insertResult = await db.execute(sql`
      INSERT INTO ingredient_authority (
        legacy_ingredient_id,
        name,
        category,
        supplier,
        purchase_quantity,
        purchase_unit,
        purchase_cost_thb,
        portion_quantity,
        portion_unit,
        conversion_factor,
        notes,
        created_by,
        is_active
      ) VALUES (
        ${legacyIngredientId || null},
        ${name},
        ${category},
        ${supplier || ''},
        ${purchaseQuantity || 1},
        ${purchaseUnit},
        ${purchaseCostThb || 0},
        ${portionQuantity || 1},
        ${portionUnit},
        ${conversionFactor || null},
        ${notes || null},
        ${createdBy || 'admin'},
        true
      )
      RETURNING *
    `);

    const newAuthority = (insertResult.rows || insertResult)[0];

    const snapshot = {
      name,
      category,
      supplier: supplier || '',
      purchaseQuantity: purchaseQuantity || 1,
      purchaseUnit,
      purchaseCostThb: purchaseCostThb || 0,
      portionQuantity: portionQuantity || 1,
      portionUnit,
      conversionFactor: conversionFactor || null,
      notes: notes || null,
      isActive: true
    };

    await db.execute(sql`
      INSERT INTO ingredient_authority_versions (
        ingredient_authority_id,
        version_number,
        snapshot_json,
        created_by
      ) VALUES (
        ${newAuthority.id},
        1,
        ${JSON.stringify(snapshot)}::jsonb,
        ${createdBy || 'admin'}
      )
    `);

    res.json({ success: true, data: newAuthority });
  } catch (error: any) {
    console.error('ingredient-authority.create error', error);
    res.status(500).json({ error: 'Failed to create ingredient authority' });
  }
});

// PUT /api/admin/ingredient-authority/:id - Update (creates new version)
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const {
      name,
      category,
      supplier,
      purchaseQuantity,
      purchaseUnit,
      purchaseCostThb,
      portionQuantity,
      portionUnit,
      conversionFactor,
      isActive,
      notes,
      updatedBy
    } = req.body;

    const currentVersionResult = await db.execute(sql`
      SELECT COALESCE(MAX(version_number), 0) as max_version
      FROM ingredient_authority_versions
      WHERE ingredient_authority_id = ${id}
    `);
    const maxVersion = Number((currentVersionResult.rows || currentVersionResult)[0]?.max_version || 0);

    const updateResult = await db.execute(sql`
      UPDATE ingredient_authority SET
        name = COALESCE(${name}, name),
        category = COALESCE(${category}, category),
        supplier = COALESCE(${supplier}, supplier),
        purchase_quantity = COALESCE(${purchaseQuantity}, purchase_quantity),
        purchase_unit = COALESCE(${purchaseUnit}, purchase_unit),
        purchase_cost_thb = COALESCE(${purchaseCostThb}, purchase_cost_thb),
        portion_quantity = COALESCE(${portionQuantity}, portion_quantity),
        portion_unit = COALESCE(${portionUnit}, portion_unit),
        conversion_factor = COALESCE(${conversionFactor}, conversion_factor),
        is_active = COALESCE(${isActive}, is_active),
        notes = COALESCE(${notes}, notes),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `);

    const updatedAuthority = (updateResult.rows || updateResult)[0];
    if (!updatedAuthority) {
      return res.status(404).json({ error: 'Ingredient authority not found' });
    }

    const snapshot = {
      name: updatedAuthority.name,
      category: updatedAuthority.category,
      supplier: updatedAuthority.supplier,
      purchaseQuantity: updatedAuthority.purchase_quantity,
      purchaseUnit: updatedAuthority.purchase_unit,
      purchaseCostThb: updatedAuthority.purchase_cost_thb,
      portionQuantity: updatedAuthority.portion_quantity,
      portionUnit: updatedAuthority.portion_unit,
      conversionFactor: updatedAuthority.conversion_factor,
      isActive: updatedAuthority.is_active,
      notes: updatedAuthority.notes
    };

    await db.execute(sql`
      INSERT INTO ingredient_authority_versions (
        ingredient_authority_id,
        version_number,
        snapshot_json,
        created_by
      ) VALUES (
        ${id},
        ${maxVersion + 1},
        ${JSON.stringify(snapshot)}::jsonb,
        ${updatedBy || 'admin'}
      )
    `);

    res.json({ success: true, data: updatedAuthority, version: maxVersion + 1 });
  } catch (error: any) {
    console.error('ingredient-authority.update error', error);
    res.status(500).json({ error: 'Failed to update ingredient authority' });
  }
});

// GET /api/admin/ingredient-authority/:id/versions - Get version history
router.get('/:id/versions', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const result = await db.execute(sql`
      SELECT *
      FROM ingredient_authority_versions
      WHERE ingredient_authority_id = ${id}
      ORDER BY version_number DESC
    `);

    res.json({ items: result.rows || result });
  } catch (error: any) {
    console.error('ingredient-authority.versions error', error);
    res.status(500).json({ error: 'Failed to fetch version history' });
  }
});

// GET /api/admin/ingredient-authority/:id - Get single ingredient authority
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const result = await db.execute(sql`
      SELECT 
        ia.*,
        (SELECT COUNT(*) FROM ingredient_authority_versions WHERE ingredient_authority_id = ia.id) as version_count
      FROM ingredient_authority ia
      WHERE ia.id = ${id}
    `);

    const authority = (result.rows || result)[0];
    if (!authority) {
      return res.status(404).json({ error: 'Ingredient authority not found' });
    }

    res.json(authority);
  } catch (error: any) {
    console.error('ingredient-authority.get error', error);
    res.status(500).json({ error: 'Failed to fetch ingredient authority' });
  }
});

// PATCH /api/admin/ingredient-authority/:id/deactivate - Soft delete (set is_active = false)
// Hard deletes are FORBIDDEN
router.patch('/:id/deactivate', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const { deactivatedBy } = req.body;

    // Get current version number
    const currentVersionResult = await db.execute(sql`
      SELECT COALESCE(MAX(version_number), 0) as max_version
      FROM ingredient_authority_versions
      WHERE ingredient_authority_id = ${id}
    `);
    const maxVersion = Number((currentVersionResult.rows || currentVersionResult)[0]?.max_version || 0);

    // Soft delete: set is_active = false
    const updateResult = await db.execute(sql`
      UPDATE ingredient_authority SET
        is_active = false,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `);

    const updatedAuthority = (updateResult.rows || updateResult)[0];
    if (!updatedAuthority) {
      return res.status(404).json({ error: 'Ingredient authority not found' });
    }

    // Create version snapshot for audit trail
    const snapshot = {
      action: 'deactivated',
      name: updatedAuthority.name,
      isActive: false
    };

    await db.execute(sql`
      INSERT INTO ingredient_authority_versions (
        ingredient_authority_id,
        version_number,
        snapshot_json,
        created_by
      ) VALUES (
        ${id},
        ${maxVersion + 1},
        ${JSON.stringify(snapshot)}::jsonb,
        ${deactivatedBy || 'admin'}
      )
    `);

    res.json({ success: true, data: updatedAuthority, message: 'Ingredient deactivated' });
  } catch (error: any) {
    console.error('ingredient-authority.deactivate error', error);
    res.status(500).json({ error: 'Failed to deactivate ingredient authority' });
  }
});

export default router;
