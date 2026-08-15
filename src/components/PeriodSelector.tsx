import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle2, Save } from 'lucide-react';
import { PeriodMode, PeriodPreference } from '../types';

interface PeriodSelectorProps {
  pref: PeriodPreference | null;
  onApply: (start: string, end: string) => void;
  onSaveDefault: (pref: PeriodPreference) => Promise<boolean>;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

const currentMonthStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
};

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const name = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
  return `${name[0].toUpperCase()}${name.slice(1)}/${y}`;
};

const formatDateBR = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
};

function computeRange(pref: PeriodPreference): { start: string; end: string } {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  if (pref.mode === 'day') {
    const day = pref.day || toISO(curYear, curMonth, now.getDate());
    return { start: day, end: day };
  }
  if (pref.mode === 'month') {
    const [y, m] = (pref.month || currentMonthStr()).split('-').map(Number);
    return { start: toISO(y, m, 1), end: toISO(y, m, daysInMonth(y, m)) };
  }
  if (pref.mode === 'year') {
    const y = pref.year || curYear;
    return { start: toISO(y, 1, 1), end: toISO(y, 12, 31) };
  }
  if (pref.mode === 'range') {
    const today = toISO(curYear, curMonth, now.getDate());
    return { start: pref.start || today, end: pref.end || today };
  }
  if (pref.mode === 'cycle') {
    const [y, m] = (pref.cycleMonth || currentMonthStr()).split('-').map(Number);
    const startDay = Math.min(pref.cycleStartDay || 15, daysInMonth(y, m));
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    const endDay = Math.min(pref.cycleEndDay || 15, daysInMonth(nextY, nextM));
    return { start: toISO(y, m, startDay), end: toISO(nextY, nextM, endDay) };
  }
  return { start: '', end: '' };
}

const modeLabels: Record<PeriodMode, string> = {
  day: 'Hoje',
  month: 'Mês',
  year: 'Ano',
  range: 'Personalizado',
  cycle: 'Cíclico',
};

export default function PeriodSelector({ pref, onApply, onSaveDefault }: PeriodSelectorProps) {
  const [mode, setMode] = useState<PeriodMode>(pref?.mode || 'month');
  const [day, setDay] = useState(pref?.mode === 'day' ? pref.day || '' : new Date().toISOString().split('T')[0]);
  const [month, setMonth] = useState(pref?.month || currentMonthStr());
  const [year, setYear] = useState(pref?.year || new Date().getFullYear());
  const [start, setStart] = useState(pref?.start || '');
  const [end, setEnd] = useState(pref?.end || '');
  const [cycleStartDay, setCycleStartDay] = useState(pref?.cycleStartDay || 15);
  const [cycleEndDay, setCycleEndDay] = useState(pref?.cycleEndDay || 15);
  const [cycleMonth, setCycleMonth] = useState(pref?.cycleMonth || currentMonthStr());
  const [saving, setSaving] = useState(false);

  const applyPref = useCallback((p: PeriodPreference) => {
    const { start: s, end: e } = computeRange(p);
    if (s && e) onApply(s, e);
  }, [onApply]);

  // Aplica o período sempre que o modo/parâmetros mudam
  useEffect(() => {
    const current: PeriodPreference = { mode };
    if (mode === 'day') current.day = day || new Date().toISOString().split('T')[0];
    if (mode === 'month') current.month = month;
    if (mode === 'year') current.year = year;
    if (mode === 'range') {
      current.start = start;
      current.end = end;
    }
    if (mode === 'cycle') {
      current.cycleStartDay = cycleStartDay;
      current.cycleEndDay = cycleEndDay;
      current.cycleMonth = cycleMonth;
    }
    applyPref(current);
  }, [mode, day, month, year, start, end, cycleStartDay, cycleEndDay, cycleMonth, applyPref]);

  // Sincroniza com o padrão salvo (vindo do Supabase) quando ele muda por fora
  useEffect(() => {
    if (!pref) return;
    setMode(pref.mode);
    if (pref.mode === 'day' && pref.day) setDay(pref.day);
    if (pref.mode === 'month' && pref.month) setMonth(pref.month);
    if (pref.mode === 'year' && pref.year) setYear(pref.year);
    if (pref.mode === 'range' && pref.start && pref.end) {
      setStart(pref.start);
      setEnd(pref.end);
    }
    if (pref.mode === 'cycle') {
      if (pref.cycleStartDay) setCycleStartDay(pref.cycleStartDay);
      if (pref.cycleEndDay) setCycleEndDay(pref.cycleEndDay);
      if (pref.cycleMonth) setCycleMonth(pref.cycleMonth);
    }
  }, [pref]);

  const activeRange = computeRange({
    mode,
    day,
    month,
    year,
    start,
    end,
    cycleStartDay,
    cycleEndDay,
    cycleMonth,
  });

  const handleSaveDefault = async () => {
    setSaving(true);
    const toSave: PeriodPreference = { mode };
    if (mode === 'day') toSave.day = day || new Date().toISOString().split('T')[0];
    if (mode === 'year') toSave.year = year;
    if (mode === 'range') {
      toSave.start = start;
      toSave.end = end;
    }
    if (mode === 'cycle') {
      toSave.cycleStartDay = cycleStartDay;
      toSave.cycleEndDay = cycleEndDay;
    }
    await onSaveDefault(toSave);
    setSaving(false);
  };

  const stepMonth = (delta: number) => {
    setCycleMonth(prev => {
      const [y, m] = prev.split('-').map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    });
  };

  const inputCls = "w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors";

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-indigo-600" />
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Período</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
            {formatDateBR(activeRange.start)} → {formatDateBR(activeRange.end)}
          </span>
          {pref && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">
              <CheckCircle2 size={11} /> Padrão: {modeLabels[pref.mode]}
            </span>
          )}
        </div>
      </div>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(modeLabels) as PeriodMode[]).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
              mode === m
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
            data-testid={`period-mode-${m}`}
          >
            {modeLabels[m]}
          </button>
        ))}
      </div>

      {/* Mode-specific inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {mode === 'day' && (
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Data</label>
            <input type="date" value={day} onChange={e => setDay(e.target.value)} className={inputCls} data-testid="period-day-input" />
          </div>
        )}
        {mode === 'month' && (
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Mês</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className={inputCls} data-testid="period-month-input" />
          </div>
        )}
        {mode === 'year' && (
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Ano</label>
            <input
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className={inputCls}
              data-testid="period-year-input"
            />
          </div>
        )}
        {mode === 'range' && (
          <>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Início</label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)} className={inputCls} data-testid="period-range-start" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Fim</label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)} className={inputCls} data-testid="period-range-end" />
            </div>
          </>
        )}
        {mode === 'cycle' && (
          <>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Dia de início</label>
              <input
                type="number"
                min="1"
                max="31"
                value={cycleStartDay}
                onChange={e => setCycleStartDay(Number(e.target.value))}
                className={inputCls}
                data-testid="period-cycle-start-day"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Dia de fim</label>
              <input
                type="number"
                min="1"
                max="31"
                value={cycleEndDay}
                onChange={e => setCycleEndDay(Number(e.target.value))}
                className={inputCls}
                data-testid="period-cycle-end-day"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Mês de referência</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => stepMonth(-1)}
                  className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="flex-1 text-center text-xs font-bold text-slate-700 truncate" data-testid="period-cycle-month">
                  {monthLabel(cycleMonth)}
                </span>
                <button
                  type="button"
                  onClick={() => stepMonth(1)}
                  className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Próximo mês"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 font-medium">
          Período aplicado automaticamente. Defina como padrão para sempre abrir neste intervalo, começando pelo mês atual.
        </p>
        <button
          type="button"
          onClick={handleSaveDefault}
          disabled={saving}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg transition-all cursor-pointer disabled:opacity-60"
          data-testid="period-save-default"
        >
          <Save size={12} /> {saving ? 'Salvando...' : 'Definir como padrão'}
        </button>
      </div>
    </div>
  );
}