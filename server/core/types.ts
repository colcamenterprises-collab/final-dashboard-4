export type Severity = 'info' | 'warning' | 'critical';
export type Category = 'POS' | 'Sales' | 'Stock' | 'Purchasing' | 'Forms' | 'System';

export interface CoreAlert {
  code: string;
  message: string;
  severity: Severity;
  category: Category;
  where: string;
}
