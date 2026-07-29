export type ProductSource = 'local' | 'external_api' | 'manual';

export interface Product {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  presentation: string;
  description: string;
  imageUrl?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  source: ProductSource;
  
  // Future modular extension hooks (V2+ readiness)
  stockQuantity?: number;
  minStockAlert?: number;
  costPrice?: number;
  salePrice?: number;
  supplierId?: string;
}

export type CreateProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

export interface ExternalProductResult {
  found: boolean;
  product?: {
    barcode: string;
    name: string;
    brand: string;
    category: string;
    presentation: string;
    description: string;
    imageUrl?: string;
    rawSource?: string;
  };
  error?: string;
}

export type NavigationTab = 'home' | 'scan' | 'search' | 'list';

// Extensibility interfaces for future versions (V2 Stock, V3 Sales, V4 Suppliers, V5 Metrics)
export interface StockMovement {
  id: string;
  productId: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  date: string;
  note?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPhone?: string;
  email?: string;
}
