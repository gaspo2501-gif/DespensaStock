import { ExternalProductResult } from '../../types/product';

/**
 * Normalizes Open Food Facts category tags or strings into user-friendly Spanish category
 */
function normalizeCategory(categoriesStr?: string): string {
  if (!categoriesStr) return 'Almacén';
  const catLower = categoriesStr.toLowerCase();

  if (catLower.includes('beverage') || catLower.includes('bebida') || catLower.includes('water') || catLower.includes('juice') || catLower.includes('soda')) {
    return 'Bebidas';
  }
  if (catLower.includes('milk') || catLower.includes('lacteo') || catLower.includes('cheese') || catLower.includes('queso') || catLower.includes('yogurt')) {
    return 'Lácteos y Quesos';
  }
  if (catLower.includes('pasta') || catLower.includes('fideo') || catLower.includes('rice') || catLower.includes('arroz') || catLower.includes('legum')) {
    return 'Pastas y Legumbres';
  }
  if (catLower.includes('canned') || catLower.includes('enlatado') || catLower.includes('conserva') || catLower.includes('tuna')) {
    return 'Enlatados y Conservas';
  }
  if (catLower.includes('biscuit') || catLower.includes('gallet') || catLower.includes('bread') || catLower.includes('pan')) {
    return 'Panadería y Galletitas';
  }
  if (catLower.includes('snack') || catLower.includes('candy') || catLower.includes('chocolate') || catLower.includes('golosina')) {
    return 'Golosinas y Snacks';
  }
  if (catLower.includes('clean') || catLower.includes('limpieza') || catLower.includes('soap') || catLower.includes('detergent')) {
    return 'Limpieza del Hogar';
  }
  if (catLower.includes('hygiene') || catLower.includes('shampoo') || catLower.includes('perfum')) {
    return 'Perfumería e Higiene';
  }
  if (catLower.includes('frozen') || catLower.includes('congelado')) {
    return 'Congelados';
  }
  if (catLower.includes('pet') || catLower.includes('mascota')) {
    return 'Mascotas';
  }
  return 'Almacén';
}

/**
 * Service to fetch product details from external barcode API (Open Food Facts API)
 */
export async function getProductByBarcodeExternal(barcode: string): Promise<ExternalProductResult> {
  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) {
    return { found: false, error: 'Código de barras no válido' };
  }

  // 1. Try Argentina regional endpoint first, then World endpoint
  const endpoints = [
    `https://ar.openfoodfacts.org/api/v2/product/${cleanBarcode}.json`,
    `https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}.json`
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500); // 4.5s timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'DespensaStockApp/1.0 (https://despensastock.app)'
        }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 1 && data.product) {
          const p = data.product;
          
          const name = p.product_name_es || p.product_name || p.generic_name_es || p.generic_name;
          
          if (name) {
            const brand = p.brands || p.brand_owner || '';
            const category = normalizeCategory(p.categories || p.categories_old);
            const presentation = p.quantity || p.packaging_text_es || p.serving_size || '';
            const description = p.generic_name_es || p.generic_name || p.ingredients_text_es || '';
            const imageUrl = p.image_front_url || p.image_url || p.image_small_url || '';

            return {
              found: true,
              product: {
                barcode: cleanBarcode,
                name: name.trim(),
                brand: brand ? brand.split(',')[0].trim() : '',
                category,
                presentation: presentation.trim(),
                description: description.trim(),
                imageUrl,
                rawSource: 'Open Food Facts API'
              }
            };
          }
        }
      }
    } catch (err) {
      console.debug(`External API query attempt failed for ${url}:`, err);
    }
  }

  return {
    found: false,
    error: 'Producto no encontrado en bases externas. Puedes cargarlo manualmente.'
  };
}
