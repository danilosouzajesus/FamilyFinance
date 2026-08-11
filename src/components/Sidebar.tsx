import React from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  PiggyBank, 
  Target, 
  Users, 
  BarChart3, 
  Sparkles, 
  Menu, 
  X,
  CreditCard,
  TrendingDown,
  TrendingUp,
  FolderTree,
  Zap,
  DollarSign,
  Building2,
  ShieldCheck
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  totalBalance: number;
}

export default function Sidebar({ 
  activeView, 
  setActiveView, 
  isCollapsed, 
  setIsCollapsed,
  totalBalance
}: SidebarProps) {
  const [isOpenMobile, setIsOpenMobile] = React.useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Painel Geral', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transações', icon: Receipt },
    { id: 'accounts-cards', label: 'Contas & Cartões', icon: CreditCard },
    { id: 'categories-tags', label: 'Categorias & Tags', icon: FolderTree },
    { id: 'bank-integration', label: 'Banco & Conciliação', icon: Building2 },
    { id: 'subscriptions', label: 'Assinaturas & Regras', icon: Zap },
    { id: 'investments-debts', label: 'Investimentos & Dívidas', icon: DollarSign },
    { id: 'budgets', label: 'Orçamentos', icon: PiggyBank },
    { id: 'goals', label: 'Metas Familiar', icon: Target },
    { id: 'family', label: 'Membros da Família', icon: Users },
    { id: 'reports', label: 'Relatórios Avançados', icon: BarChart3 },
    { id: 'settings-premium', label: 'Segurança & Premium', icon: ShieldCheck },
    { id: 'ai-advisor', label: 'Serenity AI Advisor', icon: Sparkles, highlight: true },
  ];

  return (
    <>
      {/* Mobile Menu Trigger */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button 
          onClick={() => setIsOpenMobile(!isOpenMobile)}
          className="p-2.5 bg-white shadow-md border border-slate-100 rounded-xl text-slate-700 hover:bg-slate-50 focus:outline-none transition-colors"
          aria-label="Toggle Menu"
          id="mobile-menu-toggle-btn"
        >
          {isOpenMobile ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Sidebar overlay */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/* Sidebar container */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-200/60 flex flex-col justify-between transition-all duration-300 ease-in-out
          ${isOpenMobile ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-20' : 'md:w-64'}
        `}
      >
        {/* Top Branding Header */}
        <div>
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200/50">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-100">
                <CreditCard size={20} />
              </div>
              {!isCollapsed && (
                <span className="font-display font-extrabold text-slate-900 text-lg tracking-tight whitespace-nowrap">
                  Family<span className="text-indigo-600">Finance</span>
                </span>
              )}
            </div>
            
            {/* Desktop Collapse Toggle */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              id="desktop-collapse-toggle-btn"
            >
              <Menu size={18} />
            </button>
          </div>

          {/* Quick Balance Preview */}
          {!isCollapsed && (
            <div className="p-4 mx-4 my-3 bg-slate-50 border border-slate-200/60 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Saldo Geral Estimado</span>
              <div className="flex items-center gap-2 mt-1">
                {totalBalance >= 0 ? (
                  <TrendingUp size={16} className="text-emerald-500" />
                ) : (
                  <TrendingDown size={16} className="text-rose-500" />
                )}
                <span className={`text-base font-extrabold tracking-tight ${totalBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                  R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* Menu items */}
          <nav className="px-3 py-2 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveView(item.id);
                    setIsOpenMobile(false);
                  }}
                  id={`sidebar-item-${item.id}`}
                  className={`
                    w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all duration-150 relative group cursor-pointer
                    ${isActive 
                      ? item.highlight 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                        : 'bg-indigo-50/70 text-indigo-700'
                      : item.highlight
                        ? 'text-indigo-600 bg-indigo-50/30 hover:bg-indigo-50/60 border border-dashed border-indigo-200'
                        : 'text-slate-500 hover:text-slate-950 hover:bg-slate-50'
                    }
                  `}
                >
                  <Icon size={18} className={isActive ? 'shrink-0' : 'shrink-0 text-slate-400 group-hover:text-slate-600'} />
                  
                  {(!isCollapsed || isOpenMobile) && (
                    <span className="truncate flex-1 text-left">{item.label}</span>
                  )}

                  {/* Tooltip on collapse */}
                  {isCollapsed && !isOpenMobile && (
                    <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-slate-950 text-white text-[11px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 shadow">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer branding / credits */}
        <div className="p-4 border-t border-slate-200/50 text-center text-[11px] text-slate-400 font-semibold">
          {(!isCollapsed || isOpenMobile) ? (
            <p className="font-medium">FamilyFinance &copy; 2026</p>
          ) : (
            <span className="font-extrabold text-indigo-600">FF</span>
          )}
        </div>
      </aside>
    </>
  );
}
