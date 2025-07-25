import fs from 'fs';
import path from 'path';

const SUPPLIERS_FILE = path.join(process.cwd(), 'data', 'suppliers.json');

// Load suppliers (initialize if not exists)
let suppliers: any[] = [];
try {
  if (fs.existsSync(SUPPLIERS_FILE)) {
    suppliers = JSON.parse(fs.readFileSync(SUPPLIERS_FILE, 'utf8'));
  }
} catch (error) {
  console.error('Error loading suppliers:', error);
  suppliers = [];
}

export const supplierService = {
  getAll: () => suppliers,
  
  add: (supplierData: any) => {
    const newSupplier = {
      id: Math.max(...suppliers.map((s: any) => s.id), 0) + 1,
      ...supplierData,
      cost: parseFloat(supplierData.cost) || 0
    };
    
    suppliers.push(newSupplier);
    fs.writeFileSync(SUPPLIERS_FILE, JSON.stringify(suppliers, null, 2), 'utf8');
    
    return newSupplier;
  },
  
  update: (id: number, supplierData: any) => {
    const index = suppliers.findIndex((s: any) => s.id === id);
    
    if (index === -1) {
      return null;
    }
    
    suppliers[index] = {
      ...suppliers[index],
      ...supplierData,
      id: id,
      cost: parseFloat(supplierData.cost) || suppliers[index].cost
    };
    
    fs.writeFileSync(SUPPLIERS_FILE, JSON.stringify(suppliers, null, 2), 'utf8');
    
    return suppliers[index];
  },
  
  delete: (id: number) => {
    const index = suppliers.findIndex((s: any) => s.id === id);
    
    if (index === -1) {
      return null;
    }
    
    const deleted = suppliers.splice(index, 1)[0];
    fs.writeFileSync(SUPPLIERS_FILE, JSON.stringify(suppliers, null, 2), 'utf8');
    
    return deleted;
  }
};