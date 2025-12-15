// PATCH L2.1 — LOYVERSE MENU CANONICAL IMPORT
// READ + CREATE ONLY, no deletes, no overwrites
// Import-only, Idempotent, Re-runnable, Audited

import { Router } from "express";
import { db } from "../lib/prisma";
import { 
  loyverseMenuImportService, 
  LoyverseItem, 
  LoyverseCategory, 
  LoyverseModifier,
  LoyverseMenuData 
} from "../services/loyverse";

const router = Router();

interface ImportReport {
  dryRun: boolean;
  startedAt: Date;
  finishedAt?: Date;
  categories: {
    found: number;
    created: number;
    skipped: number;
    details: Array<{ name: string; action: string; reason?: string }>;
  };
  items: {
    found: number;
    created: number;
    skipped: number;
    details: Array<{ name: string; action: string; reason?: string; loyverseId?: string }>;
  };
  modifiers: {
    groups: {
      found: number;
      created: number;
      skipped: number;
      details: Array<{ name: string; action: string; reason?: string }>;
    };
    options: {
      found: number;
      created: number;
      skipped: number;
    };
  };
  mappings: {
    created: number;
    updated: number;
  };
  conflicts: Array<{ type: string; name: string; reason: string }>;
  errors: Array<{ type: string; name: string; error: string }>;
}

async function performImport(dryRun: boolean = true): Promise<ImportReport> {
  const prisma = db();
  const report: ImportReport = {
    dryRun,
    startedAt: new Date(),
    categories: { found: 0, created: 0, skipped: 0, details: [] },
    items: { found: 0, created: 0, skipped: 0, details: [] },
    modifiers: {
      groups: { found: 0, created: 0, skipped: 0, details: [] },
      options: { found: 0, created: 0, skipped: 0 }
    },
    mappings: { created: 0, updated: 0 },
    conflicts: [],
    errors: []
  };

  try {
    console.log(`[LoyverseImport] Starting ${dryRun ? 'DRY RUN' : 'LIVE IMPORT'}...`);

    const menuData: LoyverseMenuData = await loyverseMenuImportService.fetchAllMenuData();
    
    report.categories.found = menuData.categories.length;
    report.items.found = menuData.items.length;
    report.modifiers.groups.found = menuData.modifiers.length;

    const categoryMap = new Map<string, string>();
    const modifierGroupMap = new Map<string, string>();

    for (const lvCategory of menuData.categories) {
      try {
        const existing = await prisma.menu_categories_v3.findFirst({
          where: { name: lvCategory.name }
        });

        if (existing) {
          report.categories.skipped++;
          report.categories.details.push({
            name: lvCategory.name,
            action: 'skipped',
            reason: 'Already exists by name'
          });
          categoryMap.set(lvCategory.id, existing.id);
        } else {
          if (!dryRun) {
            const created = await prisma.menu_categories_v3.create({
              data: {
                name: lvCategory.name,
                sortOrder: 0,
                visiblePOS: true,
                visibleOnline: true,
                visibleDelivery: true,
                visiblePartner: true,
                isActive: true
              }
            });
            categoryMap.set(lvCategory.id, created.id);
          }
          report.categories.created++;
          report.categories.details.push({
            name: lvCategory.name,
            action: dryRun ? 'would_create' : 'created'
          });
        }
      } catch (error: any) {
        report.errors.push({
          type: 'category',
          name: lvCategory.name,
          error: error.message
        });
      }
    }

    for (const lvModifier of menuData.modifiers) {
      try {
        const existingGroup = await prisma.menu_modifiers_group_v3.findFirst({
          where: { name: lvModifier.name }
        });

        if (existingGroup) {
          report.modifiers.groups.skipped++;
          report.modifiers.groups.details.push({
            name: lvModifier.name,
            action: 'skipped',
            reason: 'Already exists by name'
          });
          modifierGroupMap.set(lvModifier.id, existingGroup.id);
        } else {
          let groupId: string;
          
          if (!dryRun) {
            const createdGroup = await prisma.menu_modifiers_group_v3.create({
              data: {
                name: lvModifier.name,
                minSelect: 0,
                maxSelect: 10,
                sortOrder: 0,
                required: false,
                isActive: true
              }
            });
            groupId = createdGroup.id;
            modifierGroupMap.set(lvModifier.id, groupId);

            for (const option of lvModifier.options || []) {
              if (!option.deleted_at) {
                const existingMod = await prisma.menu_modifiers_v3.findFirst({
                  where: {
                    groupId: groupId,
                    name: option.option1_value
                  }
                });

                if (!existingMod) {
                  await prisma.menu_modifiers_v3.create({
                    data: {
                      groupId: groupId,
                      name: option.option1_value,
                      price: option.price || 0,
                      sortOrder: option.position || 0,
                      isActive: true
                    }
                  });
                  report.modifiers.options.created++;
                } else {
                  report.modifiers.options.skipped++;
                }
              }
            }
          } else {
            report.modifiers.options.found += (lvModifier.options || []).filter(o => !o.deleted_at).length;
          }
          
          report.modifiers.groups.created++;
          report.modifiers.groups.details.push({
            name: lvModifier.name,
            action: dryRun ? 'would_create' : 'created'
          });
        }
      } catch (error: any) {
        report.errors.push({
          type: 'modifier_group',
          name: lvModifier.name,
          error: error.message
        });
      }
    }

    for (const lvItem of menuData.items) {
      try {
        const existingByExternalId = await prisma.loyverse_map_v2.findFirst({
          where: { loyverseItemId: lvItem.id }
        });

        if (existingByExternalId) {
          report.items.skipped++;
          report.items.details.push({
            name: lvItem.item_name,
            loyverseId: lvItem.id,
            action: 'skipped',
            reason: 'Already mapped by externalId'
          });
          continue;
        }

        const existingByName = await prisma.menu_items_v3.findFirst({
          where: { name: lvItem.item_name }
        });

        if (existingByName) {
          report.items.skipped++;
          report.items.details.push({
            name: lvItem.item_name,
            loyverseId: lvItem.id,
            action: 'skipped',
            reason: 'Already exists by name (no externalId)'
          });
          report.conflicts.push({
            type: 'item',
            name: lvItem.item_name,
            reason: 'Item exists by name but has no Loyverse mapping. Manual review needed.'
          });
          continue;
        }

        let categoryId: string | null = null;
        if (lvItem.category_id) {
          categoryId = categoryMap.get(lvItem.category_id) || null;
          if (!categoryId && !dryRun) {
            const existingCat = await prisma.menu_categories_v3.findFirst({
              where: { name: 'Uncategorized' }
            });
            if (existingCat) {
              categoryId = existingCat.id;
            } else {
              const uncategorized = await prisma.menu_categories_v3.create({
                data: {
                  name: 'Uncategorized',
                  sortOrder: 999,
                  visiblePOS: true,
                  visibleOnline: true,
                  visibleDelivery: true,
                  visiblePartner: true,
                  isActive: true
                }
              });
              categoryId = uncategorized.id;
            }
          }
        }

        const defaultVariant = lvItem.variants?.[0];
        const basePrice = defaultVariant?.default_price || 0;

        if (!dryRun) {
          if (!categoryId) {
            const uncategorized = await prisma.menu_categories_v3.findFirst({
              where: { name: 'Uncategorized' }
            });
            if (uncategorized) {
              categoryId = uncategorized.id;
            } else {
              const newUncategorized = await prisma.menu_categories_v3.create({
                data: {
                  name: 'Uncategorized',
                  sortOrder: 999,
                  visiblePOS: true,
                  visibleOnline: true,
                  visibleDelivery: true,
                  visiblePartner: true,
                  isActive: true
                }
              });
              categoryId = newUncategorized.id;
            }
          }

          const createdItem = await prisma.menu_items_v3.create({
            data: {
              categoryId: categoryId!,
              name: lvItem.item_name,
              description: null,
              basePrice: basePrice,
              imageUrl: lvItem.image_url,
              posEnabled: true,
              onlineEnabled: true,
              partnerEnabled: true,
              kitchenStation: 'prep',
              sortOrder: 0,
              isActive: true
            }
          });

          await prisma.loyverse_map_v2.create({
            data: {
              menuItemId: createdItem.id,
              loyverseItemId: lvItem.id
            }
          });
          report.mappings.created++;

          if (lvItem.modifier_ids && lvItem.modifier_ids.length > 0) {
            for (const modId of lvItem.modifier_ids) {
              const internalGroupId = modifierGroupMap.get(modId);
              if (internalGroupId) {
                try {
                  await prisma.menu_items_v3.update({
                    where: { id: createdItem.id },
                    data: {
                      modifiers: {
                        connect: { id: internalGroupId }
                      }
                    }
                  });
                } catch (e) {
                }
              }
            }
          }
        }

        report.items.created++;
        report.items.details.push({
          name: lvItem.item_name,
          loyverseId: lvItem.id,
          action: dryRun ? 'would_create' : 'created'
        });

      } catch (error: any) {
        report.errors.push({
          type: 'item',
          name: lvItem.item_name,
          error: error.message
        });
      }
    }

    report.finishedAt = new Date();

    if (!dryRun) {
      try {
        await prisma.migration_reports_v1.create({
          data: {
            type: 'loyverse_menu_import',
            dryRun: false,
            status: report.errors.length > 0 ? 'completed_with_errors' : 'success',
            startedAt: report.startedAt,
            finishedAt: report.finishedAt,
            categoriesFound: report.categories.found,
            categoriesCreated: report.categories.created,
            categoriesSkipped: report.categories.skipped,
            itemsFound: report.items.found,
            itemsCreated: report.items.created,
            itemsSkipped: report.items.skipped,
            modifiersFound: report.modifiers.groups.found,
            modifiersCreated: report.modifiers.groups.created,
            modifiersSkipped: report.modifiers.groups.skipped,
            conflicts: report.conflicts,
            errors: report.errors,
            report: report as any
          }
        });
      } catch (e) {
        console.error('[LoyverseImport] Failed to save report:', e);
      }
    }

    console.log(`[LoyverseImport] ${dryRun ? 'DRY RUN' : 'IMPORT'} complete:`, {
      categories: `${report.categories.created} created, ${report.categories.skipped} skipped`,
      items: `${report.items.created} created, ${report.items.skipped} skipped`,
      modifierGroups: `${report.modifiers.groups.created} created, ${report.modifiers.groups.skipped} skipped`,
      errors: report.errors.length
    });

    return report;

  } catch (error: any) {
    console.error('[LoyverseImport] Fatal error:', error);
    report.errors.push({
      type: 'fatal',
      name: 'import',
      error: error.message
    });
    report.finishedAt = new Date();
    return report;
  }
}

router.post("/loyverse/menu", async (req, res) => {
  try {
    const dryRun = req.query.dryRun === 'true';
    
    console.log(`[LoyverseImport] POST /api/admin/import/loyverse/menu (dryRun=${dryRun})`);

    const report = await performImport(dryRun);

    res.json({
      success: report.errors.length === 0,
      dryRun,
      summary: {
        categories: {
          found: report.categories.found,
          created: report.categories.created,
          skipped: report.categories.skipped
        },
        items: {
          found: report.items.found,
          created: report.items.created,
          skipped: report.items.skipped
        },
        modifiers: {
          groupsFound: report.modifiers.groups.found,
          groupsCreated: report.modifiers.groups.created,
          groupsSkipped: report.modifiers.groups.skipped,
          optionsCreated: report.modifiers.options.created
        },
        mappings: report.mappings,
        conflicts: report.conflicts.length,
        errors: report.errors.length
      },
      report
    });

  } catch (error: any) {
    console.error('[LoyverseImport] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/loyverse/menu/status", async (req, res) => {
  try {
    const prisma = db();
    
    const [itemCount, categoryCount, modifierGroupCount, mappingCount] = await Promise.all([
      prisma.menu_items_v3.count(),
      prisma.menu_categories_v3.count(),
      prisma.menu_modifiers_group_v3.count(),
      prisma.loyverse_map_v2.count({ where: { loyverseItemId: { not: null } } })
    ]);

    let recentReports: any[] = [];
    try {
      recentReports = await prisma.migration_reports_v1.findMany({
        where: { type: 'loyverse_menu_import' },
        orderBy: { startedAt: 'desc' },
        take: 5
      });
    } catch (e) {
    }

    res.json({
      current: {
        menuItems: itemCount,
        categories: categoryCount,
        modifierGroups: modifierGroupCount,
        loyverseMappings: mappingCount
      },
      recentImports: recentReports
    });

  } catch (error: any) {
    console.error('[LoyverseImport] Status error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
