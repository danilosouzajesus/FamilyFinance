export type PeriodMode = 'day' | 'month' | 'year' | 'range' | 'cycle';

export interface PeriodPreference {
  mode: PeriodMode;
  // day: data exata (YYYY-MM-DD)
  day?: string;
  // month: mês de referência (YYYY-MM) — quando padrão, sempre o mês atual
  month?: string;
  // year: ano de referência (YYYY)
  year?: number;
  // range: período personalizado
  start?: string;
  end?: string;
  // cycle: período cíclico dia→dia (ex: 15 de um mês até 15 do seguinte)
  cycleStartDay?: number;
  cycleEndDay?: number;
  cycleMonth?: string; // mês de referência (YYYY-MM)
}