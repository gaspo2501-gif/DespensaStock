export interface CategoryOption {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const PRODUCT_CATEGORIES: CategoryOption[] = [
  { id: 'almacen', name: 'Almacén', icon: 'ShoppingBag', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'bebidas', name: 'Bebidas', icon: 'Wine', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'lacteos', name: 'Lácteos y Quesos', icon: 'Milk', color: 'bg-sky-100 text-sky-800 border-sky-200' },
  { id: 'fideos', name: 'Pastas y Legumbres', icon: 'Utensils', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { id: 'enlatados', name: 'Enlatados y Conservas', icon: 'Box', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { id: 'panaderia', name: 'Panadería y Galletitas', icon: 'Cookie', color: 'bg-amber-100 text-amber-900 border-amber-300' },
  { id: 'frescos', name: 'Frescos y Carnes', icon: 'Apple', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'congelados', name: 'Congelados', icon: 'Snowflake', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { id: 'limpieza', name: 'Limpieza del Hogar', icon: 'Sparkles', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'perfumaria', name: 'Perfumería e Higiene', icon: 'Heart', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  { id: 'golosinas', name: 'Golosinas y Snacks', icon: 'Candy', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  { id: 'mascotas', name: 'Mascotas', icon: 'Dog', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  { id: 'otros', name: 'Otros Productos', icon: 'Tag', color: 'bg-slate-100 text-slate-800 border-slate-200' },
];

export function getCategoryBadgeColor(categoryName: string): string {
  const norm = categoryName.toLowerCase();
  const match = PRODUCT_CATEGORIES.find(c => c.name.toLowerCase() === norm || c.id === norm);
  return match ? match.color : 'bg-slate-100 text-slate-700 border-slate-200';
}
