import React, { useState } from 'react';
import { 
  FolderPlus, 
  Trash2, 
  Edit3, 
  Plus, 
  X, 
  Tag, 
  Layers, 
  Folder, 
  Palette, 
  AlertTriangle,
  Smile,
  Briefcase,
  TrendingUp,
  Laptop,
  DollarSign,
  Home,
  Utensils,
  Car,
  HeartPulse,
  Compass,
  GraduationCap,
  Shirt,
  HelpCircle,
  Coffee,
  Gamepad,
  Film
} from 'lucide-react';
import { Category, Transaction } from '../types';

// Supported lucide icons map for easy rendering
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Briefcase,
  TrendingUp,
  Laptop,
  DollarSign,
  Home,
  Utensils,
  Car,
  HeartPulse,
  Compass,
  GraduationCap,
  Shirt,
  HelpCircle,
  Coffee,
  Gamepad,
  Film
};

interface CategoryManagerProps {
  categories: Category[];
  transactions: Transaction[];
  onAddCategory: (cat: Category) => void;
  onEditCategory: (id: string, updated: Partial<Category>) => void;
  onDeleteCategory: (id: string, remapCategoryId?: string) => void;
}

export default function CategoryManager({
  categories,
  transactions,
  onAddCategory,
  onEditCategory,
  onDeleteCategory
}: CategoryManagerProps) {
  // Local states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Form values
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [icon, setIcon] = useState('HelpCircle');
  const [color, setColor] = useState('#6366F1');
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [newSub, setNewSub] = useState('');

  // Global tags management state
  const [newTag, setNewTag] = useState('');
  // Seed initial tags
  const [tags, setTags] = useState<string[]>(['Essencial', 'Lazer', 'Fixo', 'Pedro', 'Carlos', 'Mariana', 'Extra', 'Shopping']);

  // Deletion Remapping Modal state
  const [deletingCat, setDeletingCat] = useState<Category | null>(null);
  const [remapCatId, setRemapCatId] = useState('');

  const colors = [
    '#EF4444', '#F59E0B', '#10B981', '#06B6D4', 
    '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', 
    '#14B8A6', '#84CC16', '#6B7280', '#0F172A'
  ];

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setType('expense');
    setIcon('HelpCircle');
    setColor('#6366F1');
    setSubcategories([]);
    setNewSub('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setType(cat.type);
    setIcon(cat.icon);
    setColor(cat.color);
    setSubcategories([...cat.subcategories]);
    setNewSub('');
    setIsFormOpen(true);
  };

  const handleAddSub = () => {
    if (newSub.trim() && !subcategories.includes(newSub.trim())) {
      setSubcategories([...subcategories, newSub.trim()]);
      setNewSub('');
    }
  };

  const handleRemoveSub = (index: number) => {
    setSubcategories(subcategories.filter((_, i) => i !== index));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingCategory) {
      onEditCategory(editingCategory.id, {
        name: name.trim(),
        type,
        icon,
        color,
        subcategories
      });
    } else {
      const newCat: Category = {
        id: `cat_${Date.now()}`,
        name: name.trim(),
        type,
        icon,
        color,
        subcategories
      };
      onAddCategory(newCat);
    }
    setIsFormOpen(false);
  };

  const handleOpenDelete = (cat: Category) => {
    // Check if there are transactions linked to this category name
    const hasTxs = transactions.some(t => t.category.toLowerCase() === cat.name.toLowerCase());
    if (hasTxs) {
      // Need remapping
      setDeletingCat(cat);
      // Select the first valid alternative category of the same type
      const alternatives = categories.filter(c => c.id !== cat.id && c.type === cat.type);
      setRemapCatId(alternatives[0]?.id || '');
    } else {
      // No transactions linked, direct delete
      if (window.confirm(`Tem certeza que deseja excluir a categoria "${cat.name}"?`)) {
        onDeleteCategory(cat.id);
      }
    }
  };

  const handleConfirmDeleteWithRemap = () => {
    if (!deletingCat || !remapCatId) return;
    const targetCat = categories.find(c => c.id === remapCatId);
    if (!targetCat) return;

    onDeleteCategory(deletingCat.id, targetCat.name);
    setDeletingCat(null);
  };

  // Tags handers
  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagName: string) => {
    setTags(tags.filter(t => t !== tagName));
  };

  return (
    <div className="space-y-6" id="category-manager-container">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Categorias & Tags</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">Configure suas categorias, subcategorias e etiquetas do sistema de forma avançada</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
          id="add-cat-btn"
        >
          <Plus size={16} /> Nova Categoria
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Categories List (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/15">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Categorias Cadastradas ({categories.length})</h3>
            </div>

            <div className="divide-y divide-slate-100">
              {categories.map((cat) => {
                const IconComponent = ICON_MAP[cat.icon] || HelpCircle;
                const linkedCount = transactions.filter(t => t.category.toLowerCase() === cat.name.toLowerCase()).length;

                return (
                  <div key={cat.id} className="p-5 flex items-center justify-between hover:bg-slate-50/40 transition-colors">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                        style={{ backgroundColor: cat.color }}
                      >
                        <IconComponent size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{cat.name}</h4>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide ${
                            cat.type === 'income' 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                              : 'bg-rose-50 text-rose-600 border border-rose-100'
                          }`}>
                            {cat.type === 'income' ? 'Receita' : 'Despesa'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {cat.subcategories.length > 0 
                            ? cat.subcategories.join(', ') 
                            : 'Sem subcategorias vinculadas'}
                        </p>
                        <span className="text-[10px] text-slate-400 font-semibold mt-1 inline-block">
                          {linkedCount} transações associadas
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(cat)}
                        className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 rounded-lg transition-colors cursor-pointer"
                        title="Editar Categoria"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(cat)}
                        className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg transition-colors cursor-pointer"
                        title="Excluir Categoria"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Custom Tags Manager (Right 1 col) */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Tag size={16} className="text-indigo-600" />
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Etiquetas / Tags Personalizadas</h2>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nova tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
                />
                <button
                  onClick={handleAddTag}
                  className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-2">
                {tags.map((tag) => (
                  <span 
                    key={tag} 
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold"
                  >
                    #{tag}
                    <button 
                      onClick={() => handleRemoveTag(tag)}
                      className="text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-tr from-indigo-50/30 to-violet-50/30 p-5 rounded-2xl border border-indigo-100/50 space-y-2">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wide">💡 Dica de Organização</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
              Vincule subcategorias precisas (como <b>Supermercado</b> e <b>Delivery</b> dentro de <b>Alimentação</b>) para dar maior granularidade à sua Inteligência Artificial e receber relatórios automatizados sem erros.
            </p>
          </div>
        </div>
      </div>

      {/* Form Slide-over/Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl max-w-md w-full p-6 space-y-4" id="cat-modal-container">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-display font-bold text-slate-900">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`py-2 text-center font-bold rounded-lg cursor-pointer ${
                    type === 'expense' 
                      ? 'bg-white text-rose-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Despesa
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`py-2 text-center font-bold rounded-lg cursor-pointer ${
                    type === 'income' 
                      ? 'bg-white text-emerald-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Receita
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Nome da Categoria</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Alimentação, Transporte"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs"
                />
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-2">Cor de Identificação</label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                        color === c ? 'scale-110 ring-2 ring-indigo-400' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Smile size={12} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Selector */}
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-2">Selecione o Ícone</label>
                <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-100 rounded-xl">
                  {Object.keys(ICON_MAP).map((iconKey) => {
                    const CurrentIcon = ICON_MAP[iconKey];
                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setIcon(iconKey)}
                        className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
                          icon === iconKey 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-100'
                        }`}
                      >
                        <CurrentIcon size={16} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subcategories builder */}
              <div className="space-y-2">
                <label className="block text-slate-400 font-bold uppercase">Subcategorias Vinculadas</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Adicionar subcategoria..."
                    value={newSub}
                    onChange={(e) => setNewSub(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSub(); } }}
                  />
                  <button
                    type="button"
                    onClick={handleAddSub}
                    className="px-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {subcategories.map((sub, idx) => (
                    <span 
                      key={idx} 
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-semibold"
                    >
                      {sub}
                      <button 
                        type="button"
                        onClick={() => handleRemoveSub(idx)}
                        className="text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <X size={8} />
                      </button>
                    </span>
                  ))}
                  {subcategories.length === 0 && (
                    <span className="text-[10px] text-slate-400 font-medium">Nenhuma subcategoria criada ainda.</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-colors cursor-pointer"
                >
                  Salvar Categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remap and Deletion Modal */}
      {deletingCat && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-500 border-b border-slate-100 pb-3">
              <AlertTriangle size={20} />
              <h3 className="text-base font-display font-extrabold tracking-tight">Vínculos de Transações Detectados</h3>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                A categoria <b>"{deletingCat.name}"</b> possui transações financeiras registradas no histórico. 
                Para não excluir o histórico financeiro da sua família, por favor remapeie estas transações para outra categoria de destino.
              </p>
              
              <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl text-[11px] text-rose-700 font-medium">
                Esta ação migrará automaticamente todas as transações da categoria "{deletingCat.name}" para a categoria selecionada abaixo, e em seguida removerá a categoria antiga.
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 font-bold uppercase">Categoria de Destino</label>
              <select
                value={remapCatId}
                onChange={(e) => setRemapCatId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
              >
                {categories
                  .filter(c => c.id !== deletingCat.id && c.type === deletingCat.type)
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.type === 'income' ? 'Receita' : 'Despesa'})</option>
                  ))
                }
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingCat(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteWithRemap}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-100/50 transition-colors cursor-pointer"
              >
                Remapear e Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
