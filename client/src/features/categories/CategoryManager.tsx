import React, { useState, useMemo } from 'react';
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
  Film,
  ChevronDown,
  Check
} from 'lucide-react';
import { Category, Transaction, Subcategory, Tag as TagType, Budget } from '@ff/shared';

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
  subcategories?: Subcategory[];
  tags?: TagType[];
  transactions: Transaction[];
  budgets?: Budget[];
  onAddCategory: (cat: Category) => void;
  onEditCategory: (id: string, updated: Partial<Category>) => void;
  onDeleteCategory: (id: string, remapCategoryId?: string) => void;
  onAddSubcategory?: (sub: Subcategory) => void;
  onEditSubcategory?: (id: string, updated: Partial<Subcategory>) => void;
  onDeleteSubcategory?: (id: string) => void;
  onAddTag?: (tag: Omit<TagType, 'id'>) => void;
  onEditTag?: (id: string, updated: Partial<TagType>) => void;
  onDeleteTag?: (id: string) => void;
}

export default function CategoryManager({
  categories,
  subcategories = [],
  tags = [],
  transactions,
  budgets = [],
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onAddSubcategory,
  onEditSubcategory,
  onDeleteSubcategory,
  onAddTag,
  onEditTag,
  onDeleteTag
}: CategoryManagerProps) {
  // Local states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(false);

  // Subcategory inline edit/add states
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubName, setEditingSubName] = useState('');
  const [addingSubForCatId, setAddingSubForCatId] = useState<string | null>(null);
  const [inlineNewSubName, setInlineNewSubName] = useState('');

  // Apenas categorias pai (sem parentId) são exibidas no nível principal
  const mainCategories = useMemo(() => categories.filter(c => !c.parentId), [categories]);
  
  // Form values
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [icon, setIcon] = useState('HelpCircle');
  const [color, setColor] = useState('#6366F1');
  const [subcategoriesList, setSubcategoriesList] = useState<string[]>([]);
  const [newSub, setNewSub] = useState('');

  // Global tags management state
  const [isTagFormOpen, setIsTagFormOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366F1');
  const [newTag, setNewTag] = useState('');

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
    setSubcategoriesList([]);
    setNewSub('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setType(cat.type === 'income' ? 'income' : 'expense');
    setIcon(cat.icon);
    setColor(cat.color);
    setSubcategoriesList([...(cat.subcategories || [])]);
    setNewSub('');
    setIsFormOpen(true);
  };

  const handleAddSub = () => {
    if (newSub.trim() && !subcategoriesList.includes(newSub.trim())) {
      setSubcategoriesList([...subcategoriesList, newSub.trim()]);
      setNewSub('');
    }
  };

  const handleRemoveSub = (index: number) => {
    setSubcategoriesList(subcategoriesList.filter((_, i) => i !== index));
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
        subcategories: subcategoriesList
      });
    } else {
      const newCat: Category = {
        id: `cat_${Date.now()}`,
        name: name.trim(),
        type,
        icon,
        color,
        subcategories: subcategoriesList
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
      const alternatives = mainCategories.filter(c => c.id !== cat.id && c.type === cat.type);
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
    const targetCat = mainCategories.find(c => c.id === remapCatId);
    if (!targetCat) return;

    onDeleteCategory(deletingCat.id, targetCat.name);
    setDeletingCat(null);
  };

  const handleStartEditSub = (sub: Subcategory) => {
    setEditingSubId(sub.id);
    setEditingSubName(sub.name);
  };

  const handleSaveEditSub = (subId: string) => {
    if (!editingSubName.trim()) return;
    if (onEditSubcategory) {
      onEditSubcategory(subId, { name: editingSubName.trim() });
    }
    setEditingSubId(null);
    setEditingSubName('');
  };

  const handleCreateSubcategory = (catId: string) => {
    if (!inlineNewSubName.trim()) return;
    if (onAddSubcategory) {
      onAddSubcategory({
        id: `sub_${Date.now()}`,
        name: inlineNewSubName.trim(),
        categoryId: catId
      });
    }
    setInlineNewSubName('');
    setAddingSubForCatId(null);
  };

  const handleDeleteSub = (sub: Subcategory) => {
    if (onDeleteSubcategory && window.confirm(`Deseja excluir a subcategoria "${sub.name}"?`)) {
      onDeleteSubcategory(sub.id);
    }
  };

  // Tags handlers
  const handleOpenAddTag = () => {
    setEditingTag(null);
    setNewTagName('');
    setNewTagColor('#6366F1');
    setIsTagFormOpen(true);
  };

  const handleOpenEditTag = (tag: TagType) => {
    setEditingTag(tag);
    setNewTagName(tag.name);
    setNewTagColor(tag.color);
    setIsTagFormOpen(true);
  };

  const handleSaveTag = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    if (editingTag) {
      if (onEditTag) onEditTag(editingTag.id, { name: trimmed, color: newTagColor });
    } else if (onAddTag) {
      onAddTag({ name: trimmed, color: newTagColor });
    }
    setIsTagFormOpen(false);
  };

  const handleRemoveTag = (tag: TagType) => {
    if (onDeleteTag && window.confirm(`Tem certeza que deseja excluir a tag "#${tag.name}"?`)) {
      onDeleteTag(tag.id);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden" id="category-manager-container">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Categorias, Subcategorias & Tags</h1>
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
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Categorias Cadastradas ({mainCategories.length})</h3>
            </div>

            <div className="divide-y divide-slate-100">
              {mainCategories.map((cat) => {
                const IconComponent = ICON_MAP[cat.icon] || HelpCircle;
                const linkedCount = transactions.filter(t => t.category.toLowerCase() === cat.name.toLowerCase()).length;
                const catSubs = subcategories.filter(s => s.categoryId === cat.id);
                const isExpanded = expandedCatId === cat.id;

                return (
                  <div key={cat.id}>
                    <div className="p-5 flex items-center justify-between hover:bg-slate-50/40 transition-colors">
                      <button
                        onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}
                        className="flex items-center gap-4 text-left cursor-pointer"
                      >
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
                            {catSubs.length > 0 
                              ? `${catSubs.length} subcategoria(s) vinculada(s)` 
                              : 'Sem subcategorias vinculadas'}
                          </p>
                          <span className="text-[10px] text-slate-400 font-semibold mt-1 inline-block">
                            {linkedCount} transações associadas
                          </span>
                        </div>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}
                          className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                          title="Ver Subcategorias"
                        >
                          <Layers size={15} />
                        </button>
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

                    {isExpanded && (
                      <div className="px-5 pb-4 pl-16 space-y-2 bg-slate-50/40 border-t border-slate-100/60 pt-3">
                        <div className="flex items-center justify-between pb-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subcategorias vinculadas</span>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingSubForCatId(addingSubForCatId === cat.id ? null : cat.id);
                              setInlineNewSubName('');
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                          >
                            <Plus size={12} /> Adicionar Subcategoria
                          </button>
                        </div>

                        {addingSubForCatId === cat.id && (
                          <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg p-2 shadow-xs">
                            <input
                              type="text"
                              autoFocus
                              placeholder="Nome da subcategoria (ex: Supermercado)..."
                              value={inlineNewSubName}
                              onChange={(e) => setInlineNewSubName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCreateSubcategory(cat.id);
                                }
                              }}
                              className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleCreateSubcategory(cat.id)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-md cursor-pointer transition-colors"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddingSubForCatId(null)}
                              className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}

                        {catSubs.length === 0 && addingSubForCatId !== cat.id && (
                          <p className="text-[11px] text-slate-400 font-medium py-1">Nenhuma subcategoria vinculada a esta categoria.</p>
                        )}

                        {catSubs.map(sub => (
                          <div key={sub.id} className="flex items-center justify-between bg-white border border-slate-200/70 rounded-lg px-3 py-2 shadow-xs">
                            {editingSubId === sub.id ? (
                              <div className="flex items-center gap-2 flex-1 mr-2">
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingSubName}
                                  onChange={(e) => setEditingSubName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveEditSub(sub.id);
                                    }
                                  }}
                                  className="flex-1 px-2 py-0.5 text-xs border border-indigo-300 rounded focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditSub(sub.id)}
                                  className="p-1 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                                  title="Salvar"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSubId(null)}
                                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                                  title="Cancelar"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                  <Folder size={12} className="text-indigo-400" /> {sub.name}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleStartEditSub(sub)}
                                    className="p-1 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded transition-colors cursor-pointer"
                                    title="Editar Subcategoria"
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSub(sub)}
                                    className="p-1 hover:bg-slate-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                    title="Excluir Subcategoria"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Custom Tags Manager (Right 1 col) */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
            <button
              onClick={() => setShowTags(!showTags)}
              className="w-full flex items-center gap-2 pb-3 border-b border-slate-100 cursor-pointer"
            >
              <Tag size={16} className="text-indigo-600" />
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tags Personalizadas</h2>
              <span className={`ml-auto text-slate-300 transition-transform ${showTags ? 'rotate-180' : ''}`}>
                <ChevronDown size={14} />
              </span>
            </button>

            <button
              onClick={handleOpenAddTag}
              className="w-full px-3 py-2 border border-dashed border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus size={14} className="inline mr-1" /> Nova Tag
            </button>

            {showTags && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.length === 0 && (
                    <p className="text-[10px] text-slate-400 font-medium">Nenhuma tag cadastrada ainda.</p>
                  )}
                  {tags.map((tag) => (
                    <span 
                      key={tag.id} 
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold"
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                      #{tag.name}
                      <button 
                        onClick={() => handleRemoveTag(tag)}
                        className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
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
                  {subcategoriesList.map((sub, idx) => (
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
                  {subcategoriesList.length === 0 && (
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

      {/* Tag Add/Edit Form Modal */}
      {isTagFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl max-w-sm w-full p-6 space-y-4" id="tag-modal-container">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-display font-bold text-slate-900">
                {editingTag ? 'Editar Tag' : 'Nova Tag'}
              </h3>
              <button
                onClick={() => setIsTagFormOpen(false)}
                className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTag} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold uppercase">Nome da Tag</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">#</span>
                  <input
                    type="text"
                    required
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="viagem, reembolso, essencial"
                    className="w-full pl-7 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                    id="tag-form-name"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-400 font-bold uppercase">Cor de Identificação</label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewTagColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer relative flex items-center justify-center ${
                        newTagColor === c ? 'scale-110 ring-2 ring-indigo-300' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {newTagColor === c && <Smile size={10} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTagFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
                >
                  Salvar Tag
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
                {mainCategories
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
