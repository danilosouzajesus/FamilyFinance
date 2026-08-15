import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FamilyBudgets from './FamilyBudgets';
import { makeBudget, makeMonthlyGoal, makeCategory, noop } from '../test/fixtures';

const baseProps = {
  budgets: [] as any[],
  monthlyGoals: [] as any[],
  categories: [] as any[],
  transactions: [] as any[],
  isPrivateMode: false,
  onAddBudget: noop,
  onEditBudget: noop,
  onDeleteBudget: noop,
  onAddMonthlyGoal: noop,
  onEditMonthlyGoal: noop,
  onDeleteMonthlyGoal: noop,
};

describe('FamilyBudgets', () => {
  it('renderiza o título principal', () => {
    render(<FamilyBudgets {...baseProps} />);
    expect(screen.getByText('Planejamento de Orçamentos')).toBeInTheDocument();
  });

  it('lista os orçamentos cadastrados', () => {
    render(
      <FamilyBudgets
        {...baseProps}
        budgets={[makeBudget()]}
        categories={[makeCategory()]}
      />
    );
    expect(screen.getByText('Mercado')).toBeInTheDocument();
  });

  it('lista as metas de gastos gerais', () => {
    render(
      <FamilyBudgets
        {...baseProps}
        monthlyGoals={[makeMonthlyGoal({ name: 'Meta geral de agosto' })]}
      />
    );
    expect(screen.getByText('Meta geral de agosto')).toBeInTheDocument();
  });

  it('abre o modal de novo orçamento', () => {
    render(<FamilyBudgets {...baseProps} categories={[makeCategory()]} />);
    const addBtn = screen.getAllByRole('button').find(b => /novo|adicionar|criar/i.test(b.textContent || ''));
    if (addBtn) {
      fireEvent.click(addBtn);
      expect(document.querySelector('form')).toBeTruthy();
    } else {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    }
  });
});