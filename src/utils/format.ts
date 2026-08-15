export const formatMoney = (value: number, hide = false): string => {
  if (hide) return 'R$ ***';
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const currentMonthStr = (offset = 0): string => {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

export const monthLabelPt = (monthStr: string): string => {
  const [y, m] = monthStr.split('-');
  const names = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const idx = parseInt(m) - 1;
  return `${names[idx] || ''}/${y}`;
};

export const getMonthOptions = (): Array<{value: string, label: string}> => {
  const months = [
    { value: '2026-01', label: 'Janeiro' },
    { value: '2026-02', label: 'Fevereiro' },
    { value: '2026-03', label: 'Março' },
    { value: '2026-04', label: 'Abril' },
    { value: '2026-05', label: 'Maio' },
    { value: '2026-06', label: 'Junho' },
    { value: '2026-07', label: 'Julho' },
    { value: '2026-08', label: 'Agosto' },
    { value: '2026-09', label: 'Setembro' },
    { value: '2026-10', label: 'Outubro' },
    { value: '2026-11', label: 'Novembro' },
    { value: '2026-12', label: 'Dezembro' },
  ];
  return months;
};

export const getMonthIndex = (monthStr: string): number => {
  const [, m] = monthStr.split('-');
  return parseInt(m) - 1;
};