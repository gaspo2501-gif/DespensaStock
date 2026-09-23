import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Product, getStockForLocation, getTotalStock } from '../../types/product';
import { PRODUCT_CATEGORIES } from '../../utils/categories';
import { productService } from '../../services/firebase/productService';
import { NumericInput } from '../common/NumericInput';
import { 
  Edit3, 
  X, 
  Barcode, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Package, 
  DollarSign, 
  Image as ImageIcon 
} from 'lucide-react';

interface ProductEditModalProps {
  product: Product;
  allProducts: Product[];
  onClose: () => void;
  onProductSaved: (updatedProduct: Product) => void;
}

export const ProductEditModal: React.FC<ProductEditModalProps> = ({
  product,
  allProducts,
  onClose,
  onProductSaved,
}) => {
  const [barcode, setBarcode] = useState(product.barcode || '');
  const [name, setName] = useState(product.name || '');
  const [brand, setBrand] = useState(product.brand || '');
  const [category, setCategory] = useState(product.category || 'Almacén');
  const [presentation, setPresentation] = useState(product.presentation || '');
  const [description, setDescription] = useState(product.description || '');
  const [imageUrl, setImageUrl] = useState(product.imageUrl || '');
  const [salePrice, setSalePrice] = useState<string>(
    product.salePrice !== undefined && product.salePrice !== null
      ? product.salePrice.toString()
      : ''
  );
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read-only stock info
  const stockAimogasta = getStockForLocation(product, 'aimogasta');
  const stockOlascoaga = getStockForLocation(product, 'olascoaga');
  const stockTotal = getTotalStock(product);

  // Lock background body scroll while modal is open and restore on unmount
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Detect if initial category is custom
  useEffect(() => {
    const isPredefined = PRODUCT_CATEGORIES.some((c) => c.name.toLowerCase() === (product.category || '').toLowerCase());
    if (product.category && !isPredefined) {
      setIsCustomCategory(true);
      setCustomCategory(product.category);
    }
  }, [product.category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanBarcode = barcode.trim();
    const cleanName = name.trim();

    if (!cleanBarcode) {
      setError('El código de barras no puede estar vacío');
      return;
    }

    if (!cleanName) {
      setError('El nombre del producto es obligatorio');
      return;
    }

    // Validate EAN uniqueness if changed
    const duplicate = allProducts.find(
      (p) => p.id !== product.id && p.barcode.trim().toLowerCase() === cleanBarcode.toLowerCase()
    );

    if (duplicate) {
      setError('Este código de barras ya está asignado a otro producto.');
      return;
    }

    const finalCategory = isCustomCategory && customCategory.trim()
      ? customCategory.trim()
      : category;

    const parsedPrice = salePrice && !isNaN(parseFloat(salePrice)) && parseFloat(salePrice) >= 0
      ? parseFloat(salePrice)
      : undefined;

    setLoading(true);

    try {
      // Update MASTER DATA only. Stock is NEVER altered from this form.
      const updated = await productService.updateProduct(product.id, {
        barcode: cleanBarcode,
        name: cleanName,
        brand: brand.trim(),
        category: finalCategory,
        presentation: presentation.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        salePrice: parsedPrice,
      });

      onProductSaved(updated);
      onClose();
    } catch (err: unknown) {
      console.error('Error al actualizar producto:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar los cambios del producto');
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh] animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Editar Producto</h2>
              <p className="text-xs text-slate-400">Modificación de datos maestros del catálogo</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            title="Cerrar sin guardar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Read-only Stock Banner — Explicitly conveys stock is managed via operations */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  Stock Actual (No editable desde aquí)
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Inalterable en este formulario</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 block">Aimogasta</span>
                  <span className="text-sm font-black font-mono text-emerald-700">{stockAimogasta} un.</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 block">Olascoaga</span>
                  <span className="text-sm font-black font-mono text-emerald-700">{stockOlascoaga} un.</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 block">Total</span>
                  <span className="text-sm font-black font-mono text-slate-800">{stockTotal} un.</span>
                </div>
              </div>
            </div>

            {/* Barcode / EAN Input (Editable with uniqueness check) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-emerald-600" />
                Código de Barras / EAN <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Ej: 7791234567890"
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Si modificás el código, el sistema verificará que no exista duplicado en el catálogo.
              </p>
            </div>

            {/* Product Name (MANDATORY) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nombre del Producto <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: 9 de Oro Clásicas"
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>

            {/* Brand & Presentation Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Marca
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Ej: Molino Cañuelas"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Presentación / Contenido
                </label>
                <input
                  type="text"
                  value={presentation}
                  onChange={(e) => setPresentation(e.target.value)}
                  placeholder="Ej: 200 g / 1.5 L"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Sale Price Input */}
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-1">
              <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                  Precio de Venta Habitual
                </span>
                <span className="text-[10px] text-blue-700 font-normal">$ ARS</span>
              </label>
              <NumericInput
                min="0"
                step="any"
                allowDecimal={true}
                placeholder="Ej: 1500"
                value={salePrice}
                onChangeRaw={(e) => setSalePrice(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-blue-300 rounded-xl text-slate-900 font-mono font-bold text-base focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-[10px] text-blue-700/80 pt-0.5">
                Modifica únicamente el precio de mostrador actual. No altera compras ni márgenes históricos.
              </p>
            </div>

            {/* Category Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Categoría
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomCategory(!isCustomCategory)}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  {isCustomCategory ? 'Elegir de lista' : '+ Otra categoría'}
                </button>
              </div>

              {isCustomCategory ? (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Escribe el nombre de la categoría"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm"
                />
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-50 border border-slate-200 rounded-2xl">
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setCategory(cat.name)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        category.toLowerCase() === cat.name.toLowerCase()
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Description / Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Descripción / Observaciones
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalles sobre el producto..."
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
              />
            </div>

            {/* Image URL (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-slate-400" />
                URL de Imagen <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://ejemplo.com/imagen.jpg"
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="p-4 bg-slate-50/90 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="py-2.5 px-4 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading || !name.trim() || !barcode.trim()}
              className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
