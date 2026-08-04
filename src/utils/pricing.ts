/**
 * Calculates the suggested sale price using the standard margin rule:
 * precioVenta = costo / 0.60
 * Rounded UP to the nearest multiple of $100 (Math.ceil(val / 100) * 100).
 * 
 * Examples:
 * - Cost $800 -> 800 / 0.60 = 1333.33 -> ceil(13.3333) * 100 = $1400
 * - Cost $850 -> 850 / 0.60 = 1416.67 -> ceil(14.1667) * 100 = $1500
 */
export function calculateSuggestedSalePrice(unitCost: number): number {
  if (isNaN(unitCost) || unitCost <= 0) return 0;
  const raw = unitCost / 0.60;
  return Math.ceil(raw / 100) * 100;
}
