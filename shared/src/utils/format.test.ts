import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatMoney, currentMonthStr, monthLabelPt } from './format';

describe('formatMoney', () => {
  it('formata valores com 2 casas decimais e R$', () => {
    expect(formatMoney(1234.5)).toBe('R$ 1.234,50');
    expect(formatMoney(0)).toBe('R$ 0,00');
    expect(formatMoney(99.99)).toBe('R$ 99,99');
    expect(formatMoney(1000000)).toBe('R$ 1.000.000,00');
  });

  it('esconde o valor quando hide é true', () => {
    expect(formatMoney(1234.5, true)).toBe('R$ ***');
  });
});

describe('currentMonthStr', () => {
  afterEach(() => vi.useRealTimers());

  it('retorna o mês atual no formato YYYY-MM', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 15)); // 15/08/2026
    expect(currentMonthStr()).toBe('2026-08');
  });

  it('aplica offset de meses', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15)); // Jan/2026
    expect(currentMonthStr(1)).toBe('2026-02');
    expect(currentMonthStr(-1)).toBe('2025-12');
  });
});

describe('monthLabelPt', () => {
  it('converte YYYY-MM para nome do mês em português', () => {
    expect(monthLabelPt('2026-01')).toBe('Janeiro/2026');
    expect(monthLabelPt('2026-12')).toBe('Dezembro/2026');
  });

  it('retorna vazio para mês inválido', () => {
    expect(monthLabelPt('2026-13')).toBe('/2026');
  });
});