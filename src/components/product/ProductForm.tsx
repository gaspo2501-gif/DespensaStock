import React, { useState } from 'react';
import { Product, CreateProductInput, ProductSource } from '../../types/product';
import { PRODUCT_CATEGORIES } from '../../utils/categories';
import { Save, Barcode, AlertCircle, CheckCircle2, ArrowLeft, Image as ImageIcon } from 'lucide-react';

interface ProductFormProps {
  initialBarcode?: string;
  initialData?: Partial<Product>;
  isEditing?: boolean;
  source?: ProductSource;
  onSubmit: (data: CreateProductInput) => Promise<void>;
  onCancel: () => void;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  initialBarcode = '',
  initialData,
  isEditing = false,
  source = 'manual',
  onSubmit,
  onCancel,
}) => {
  const [barcode, setBarcode] = useState(initialData?.barcode || initialBarcode || '');
  const [name, setName] = useState(initialData?.name || '');
  const [brand, setBrand] = useState(initialData?.brand || '');
  const [category, setCategory] = useState(initialData?.category || 'Almacén');
  const [presentation, setPresentation] = useState(initialData?.presentation || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
  const [stockQuantity, setStockQuantity] = useState<number>(initialData?.stockQuantity ?? 1);
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

    const finalCategory = isCustomCategory && customCategory.trim() 
      ? customCategory.trim() 
      : category;

    setLoading(true);

    try {
      await onSubmit({
        barcode: cleanBarcode,
        name: cleanName,
        brand: brand.trim(),
        category: finalCategory,
        presentation: presentation.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        source: isEditing ? (initialData?.source || 'manual') : source,
        stockQuantity: isNaN(stockQuantity) || stockQuantity < 0 ? 0 : stockQuantity,
      });

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar el producto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold">
              {isEditing ? 'Editar Producto' : 'Cargar Producto'}
            </h2>
            <p className="text-xs text-slate-400">
              {isEditing ? 'Modifica los datos del catálogo' : 'Ingresa la información para guardarlo en la base'}
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          {source === 'external_api' ? 'API Externa' : 'Manual'}
        </span>
      </div>

      {/* Form body */}
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-3 animate-shake">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>¡Producto guardado exitosamente en tu base de datos!</span>
          </div>
        )}

        {/* Read-only Barcode Box */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Barcode className="w-4 h-4 text-emerald-600" />
            Código de Barras <span className="text-slate-400 font-normal">(Único)</span>
          </label>
          <input
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            disabled={isEditing || !!initialBarcode}
            className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-base font-mono font-bold text-slate-900 focus:outline-none disabled:opacity-80"
            required
          />
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
            placeholder="Ej: Fideos Tallarines N°1"
            className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            required
          />
        </div>

        {/* Brand & Presentation Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Marca
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Ej: Matarazzo"
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
              placeholder="Ej: 500 g / 1.5 L / Botella"
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* Initial Stock Input Field */}
        <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl">
          <label className="block text-xs font-bold text-emerald-900 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>{isEditing ? 'Stock Actual (Unidades)' : 'Cantidad Inicial de Stock'}</span>
            <span className="text-[10px] text-emerald-700 font-normal">Conteo Físico</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(parseInt(e.target.value, 10) || 0)}
              className="w-full px-4 py-2.5 bg-white border border-emerald-300 rounded-xl text-slate-900 font-mono font-bold text-base focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>
          <p className="text-[11px] text-emerald-800 mt-1">
            Indica cuántas unidades existen actualmente en el inventario.
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
              placeholder="Escribe el nombre de la nueva categoría"
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm"
            />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {PRODUCT_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.name)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    category === cat.name
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Descripción / Observaciones
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notas adicionales o detalles sobre el producto..."
            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
          />
        </div>

        {/* Image URL Optional */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-slate-500" />
            URL de Imagen <span className="text-slate-400 font-normal">(Opcional)</span>
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://ejemplo.com/imagen.jpg"
            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        {/* Submit Actions */}
        <div className="pt-4 flex items-center gap-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="w-1/3 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-2/3 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Guardar Producto'}
          </button>
        </div>
      </form>
    </div>
  );
};
