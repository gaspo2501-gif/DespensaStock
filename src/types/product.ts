export type ProductSource = 'local' | 'external_api' | 'manual';
export type StockOperation = 'add' | 'subtract' | 'set';

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
  
  stockQuantity: number; // Total stock across all locations
  stockByLocation?: Record<string, number>; // Stock map per location ID (e.g. { aimogasta: 12, olascoaga: 5 })
  minStockAlert?: number;
  costPrice?: number;
  currentCost?: number;
  lastCost?: number;
  salePrice?: number;
  supplierId?: string;
  lastPurchaseDate?: string;
  lastSupplierId?: string;
  lastSupplierName?: string;
}

export type CreateProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'stockQuantity'> & {
  stockQuantity?: number;
  stockByLocation?: Record<string, number>;
};

export function getProductStock(product: Product, locationId?: string): number {
  if (!product) return 0;
  if (!locationId || locationId === 'all') {
    return getTotalStock(product);
  }

  if (product.stockByLocation && typeof product.stockByLocation[locationId] === 'number') {
    return product.stockByLocation[locationId];
  }

  // Backward compatibility fallback for legacy documents without stockByLocation:
  // Default legacy stock to 'aimogasta'
  if (locationId === 'aimogasta') {
    return product.stockQuantity ?? 0;
  }
  return 0;
}

export const getStockForLocation = getProductStock;

export function getTotalStock(product: Product): number {
  if (!product) return 0;
  if (product.stockByLocation && Object.keys(product.stockByLocation).length > 0) {
    return Object.values(product.stockByLocation).reduce((sum, qty) => sum + (typeof qty === 'number' && !isNaN(qty) ? qty : 0), 0);
  }
  return product.stockQuantity ?? 0;
}


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

export type NavigationTab = 'home' | 'scan' | 'search' | 'list' | 'sales' | 'customers' | 'stock' | 'expenses' | 'cash' | 'reports';

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
