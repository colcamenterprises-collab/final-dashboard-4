import { db } from './db';
import { categories, vendors, vendorAliases } from '../shared/schema';

export async function seedExpenseData() {
  try {
    // Seed categories
    const categoryData = [
      { name: 'Food & Beverage', code: 'FNB' },
      { name: 'Utilities', code: 'UTIL' },
      { name: 'Rent', code: 'RENT' },
      { name: 'Fuel', code: 'FUEL' },
      { name: 'Bank Fees', code: 'BANK_FEES' },
      { name: 'Marketing', code: 'MARKETING' },
      { name: 'Repairs & Maintenance', code: 'REPAIRS' },
      { name: 'Office', code: 'OFFICE' },
      { name: 'Other', code: 'OTHER' }
    ];

    const insertedCategories = await db.insert(categories)
      .values(categoryData)
      .onConflictDoNothing()
      .returning();

    console.log(`Seeded ${insertedCategories.length} categories`);

    // Get category IDs for vendor defaults
    const allCategories = await db.select().from(categories);
    const fnbCategory = allCategories.find(c => c.code === 'FNB');
    const utilCategory = allCategories.find(c => c.code === 'UTIL');
    const fuelCategory = allCategories.find(c => c.code === 'FUEL');
    const bankCategory = allCategories.find(c => c.code === 'BANK_FEES');

    // Seed vendors with default categories
    const vendorData = [
      { displayName: 'Makro', defaultCategoryId: fnbCategory?.id },
      { displayName: 'Lotus', defaultCategoryId: fnbCategory?.id },
      { displayName: 'PTT', defaultCategoryId: fuelCategory?.id },
      { displayName: 'Bangchak', defaultCategoryId: fuelCategory?.id },
      { displayName: 'MEA', defaultCategoryId: utilCategory?.id },
      { displayName: 'PWA', defaultCategoryId: utilCategory?.id },
      { displayName: 'True', defaultCategoryId: utilCategory?.id },
      { displayName: 'AIS', defaultCategoryId: utilCategory?.id },
      { displayName: 'KBANK', defaultCategoryId: bankCategory?.id },
      { displayName: 'SCB', defaultCategoryId: bankCategory?.id },
    ];

    const insertedVendors = await db.insert(vendors)
      .values(vendorData.filter(v => v.defaultCategoryId))
      .onConflictDoNothing()
      .returning();

    console.log(`Seeded ${insertedVendors.length} vendors`);

    // Seed vendor aliases (Thai & English variants)
    const allVendors = await db.select().from(vendors);
    const aliasData = [
      // Makro aliases
      { vendorId: allVendors.find(v => v.displayName === 'Makro')?.id, aliasText: 'แม็คโคร' },
      { vendorId: allVendors.find(v => v.displayName === 'Makro')?.id, aliasText: 'makro' },
      { vendorId: allVendors.find(v => v.displayName === 'Makro')?.id, aliasText: 'ห้างแม็คโคร' },
      
      // Lotus aliases
      { vendorId: allVendors.find(v => v.displayName === 'Lotus')?.id, aliasText: 'โลตัส' },
      { vendorId: allVendors.find(v => v.displayName === 'Lotus')?.id, aliasText: 'lotus' },
      { vendorId: allVendors.find(v => v.displayName === 'Lotus')?.id, aliasText: 'tesco' },
      
      // PTT aliases
      { vendorId: allVendors.find(v => v.displayName === 'PTT')?.id, aliasText: 'ปตท' },
      { vendorId: allVendors.find(v => v.displayName === 'PTT')?.id, aliasText: 'PTT' },
      
      // Bangchak aliases
      { vendorId: allVendors.find(v => v.displayName === 'Bangchak')?.id, aliasText: 'บางจาก' },
      
      // MEA aliases
      { vendorId: allVendors.find(v => v.displayName === 'MEA')?.id, aliasText: 'การไฟฟ้านครหลวง' },
      { vendorId: allVendors.find(v => v.displayName === 'MEA')?.id, aliasText: 'MEA' },
      
      // PWA aliases
      { vendorId: allVendors.find(v => v.displayName === 'PWA')?.id, aliasText: 'การประปา' },
      { vendorId: allVendors.find(v => v.displayName === 'PWA')?.id, aliasText: 'PWA' },
      
      // True aliases
      { vendorId: allVendors.find(v => v.displayName === 'True')?.id, aliasText: 'ทรู' },
      { vendorId: allVendors.find(v => v.displayName === 'True')?.id, aliasText: 'True' },
      
      // AIS aliases
      { vendorId: allVendors.find(v => v.displayName === 'AIS')?.id, aliasText: 'เอไอเอส' },
      { vendorId: allVendors.find(v => v.displayName === 'AIS')?.id, aliasText: 'AIS' },
      { vendorId: allVendors.find(v => v.displayName === 'AIS')?.id, aliasText: 'ดีแทค' },
      
      // KBANK aliases
      { vendorId: allVendors.find(v => v.displayName === 'KBANK')?.id, aliasText: 'กสิกร' },
      { vendorId: allVendors.find(v => v.displayName === 'KBANK')?.id, aliasText: 'KBANK' },
      
      // SCB aliases
      { vendorId: allVendors.find(v => v.displayName === 'SCB')?.id, aliasText: 'ไทยพาณิชย์' },
      { vendorId: allVendors.find(v => v.displayName === 'SCB')?.id, aliasText: 'SCB' },
    ];

    const filteredAliases = aliasData.filter(a => a.vendorId !== undefined) as Array<{vendorId: number, aliasText: string}>;
    const insertedAliases = await db.insert(vendorAliases)
      .values(filteredAliases)
      .onConflictDoNothing()
      .returning();

    console.log(`Seeded ${insertedAliases.length} vendor aliases`);

    return {
      categories: insertedCategories,
      vendors: insertedVendors,
      aliases: insertedAliases
    };
  } catch (error) {
    console.error('Error seeding expense data:', error);
    throw error;
  }
}