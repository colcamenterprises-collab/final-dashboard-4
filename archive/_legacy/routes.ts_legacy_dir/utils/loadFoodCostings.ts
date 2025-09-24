import fs from 'fs'
import path from 'path'
import csv from 'csv-parser'

const filePath = path.join(process.cwd(), 'data', 'Food Costings - Supplier - Portions - Prices v1.0 05.08.25.csv')

export interface FoodCostingItem {
  name: string
  supplier: string
  cost: number
  unit: string
  portions: number
  key: string
}

export async function loadFoodCostingItems(): Promise<FoodCostingItem[]> {
  const results: FoodCostingItem[] = []
  
  return new Promise((resolve, reject) => {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.warn(`Food costing CSV not found at: ${filePath}`)
      resolve([]) // Return empty array if file doesn't exist
      return
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Parse CSV data and create structured item
        const item: FoodCostingItem = {
          name: data.name || data.Name || data.item || data.Item || '',
          supplier: data.supplier || data.Supplier || '',
          cost: parseFloat(data.cost || data.Cost || data.price || data.Price || '0'),
          unit: data.unit || data.Unit || 'unit',
          portions: parseInt(data.portions || data.Portions || '1'),
          key: (data.name || data.Name || data.item || data.Item || '').toLowerCase().replace(/\s+/g, '_')
        }
        
        if (item.name) {
          results.push(item)
        }
      })
      .on('end', () => {
        console.log(`Loaded ${results.length} food costing items from CSV`)
        resolve(results)
      })
      .on('error', (error) => {
        console.error('Error reading food costing CSV:', error)
        reject(error)
      })
  })
}