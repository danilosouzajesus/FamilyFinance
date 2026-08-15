import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  BellRing,
  CalendarClock,
  PieChart as PieIcon,
  Target,
  TrendingUp,
  Info,
  CheckCheck,
  Trash2,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationsCenterProps {
  notifications: AppNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClear: () => void;
  onCheckAlerts: () => void;
  onGenerateRecurring: () => void;
}

const typeMeta: Record<AppNotification['type'], { label: string; icon: React.ComponentType<any>; color: string; bg: string }> = {
  due_date: { label: 'Vencimento', icon: CalendarClock, color: 'text-amber-600', bg: 'bg-amber-50' },
  budget: { label: 'Orçamento', icon: PieIcon, color: 'text-rose-600', bg: 'bg-rose-50' },
  goal: { label: 'Meta', icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  average: { label: 'Média', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  system: { label: 'Sistema', icon: Info, color: 'text-sky-600', bg: 'bg-sky-50' },
};

export default function NotificationsCenter({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onClear,
  onCheckAlerts,
  onGenerateRecurring
}: NotificationsCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={panelRef} id="notifications-center-wrapper">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 bg-slate-50 border border-slate-200/80 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 text-slate-600 rounded-xl transition-colors cursor-pointer"
        id="notifications-trigger-btn"
        aria-label="Central de Notificações"
      >
        {unreadCount > 0 ? <BellRing size={14} className="text-amber-500" /> : <Bell size={14} />}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-4 bg-gradient-to-br from-indigo-50/80 via-slate-50 to-white border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-indigo-600" />
                <h4 className="text-sm font-extrabold text-slate-900">Central de Alertas</h4>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800">
                {unreadCount} não lidas
              </span>
            </div>

            {/* Quick actions */}
            <div className="flex items-center gap-1.5 mt-3">
              <button
                type="button"
                onClick={() => { onCheckAlerts(); }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                id="notif-check-alerts-btn"
              >
                <RefreshCw size={11} /> Verificar Alertas
              </button>
              <button
                type="button"
                onClick={() => { onGenerateRecurring(); }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                id="notif-generate-recurring-btn"
              >
                <RefreshCw size={11} /> Gerar Recorrências
              </button>
              <button
                type="button"
                onClick={onMarkAllRead}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                title="Marcar todas como lidas"
              >
                <CheckCheck size={13} />
              </button>
              <button
                type="button"
                onClick={onClear}
                className="p-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-lg transition-colors cursor-pointer"
                title="Limpar notificações"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[360px] overflow-y-auto p-2 space-y-1.5">
            {notifications.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="w-10 h-10 mx-auto rounded-full bg-slate-50 flex items-center justify-center mb-2">
                  <Bell size={16} className="text-slate-300" />
                </div>
                <p className="text-xs font-bold text-slate-500">Nenhum alerta</p>
                <p className="text-[10px] text-slate-400 font-medium mt-1">Clique em "Verificar Alertas" para analisar vencimentos, orçamentos e metas.</p>
              </div>
            ) : (
              notifications.map(n => {
                const meta = typeMeta[n.type];
                const Icon = meta.icon;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => onMarkRead(n.id)}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${n.read ? 'bg-white hover:bg-slate-50' : 'bg-indigo-50/60 hover:bg-indigo-50 border border-indigo-100'}`}
                  >
                    <span className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                      <Icon size={13} className={meta.color} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-[11px] font-extrabold text-slate-800 truncate">{n.title}</span>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />}
                      </span>
                      <span className="block text-[11px] text-slate-600 mt-0.5 leading-snug">{n.message}</span>
                      <span className="block text-[9px] text-slate-400 font-semibold mt-1">
                        {new Date(n.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-semibold text-center">
            Sistema de alertas inteligentes · FamilyFinance
          </div>
        </div>
      )}
    </div>
  );
}