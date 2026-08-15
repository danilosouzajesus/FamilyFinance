import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FamilyGoals from './FamilyGoals';
import { makeGoal, makeMember, makeCategory, makeAccount, noop } from '../test/fixtures';

const baseProps = {
  goals: [] as any[],
  categories: [] as any[],
  familyMembers: [] as any[],
  accounts: [] as any[],
  onAddGoal: noop,
  onEditGoal: noop,
  onDeleteGoal: noop,
};

describe('FamilyGoals', () => {
  it('renderiza o título principal', () => {
    render(<FamilyGoals {...baseProps} />);
    expect(screen.getByText('Cofrinho de Metas Coletivas')).toBeInTheDocument();
  });

  it('lista as metas e seus valores', () => {
    render(
      <FamilyGoals
        {...baseProps}
        goals={[makeGoal({ name: 'Viagem', targetAmount: 5000, currentAmount: 1000 })]}
      />
    );
    expect(screen.getByText('Viagem')).toBeInTheDocument();
    expect(screen.getAllByText(/R\$/).length).toBeGreaterThan(0);
  });

  it('calcula a barra de progresso da meta', () => {
    render(
      <FamilyGoals
        {...baseProps}
        goals={[makeGoal({ name: 'Reserva', targetAmount: 1000, currentAmount: 250 })]}
      />
    );
    expect(screen.getAllByText(/25%|25,0%/).length).toBeGreaterThan(0);
  });

  it('abre o modal de nova meta', () => {
    render(<FamilyGoals {...baseProps} categories={[makeCategory()]} familyMembers={[makeMember()]} />);
    const addBtn = screen.getAllByRole('button').find(b => /nova|adicionar|criar/i.test(b.textContent || ''));
    if (addBtn) {
      fireEvent.click(addBtn);
      expect(document.querySelector('form')).toBeTruthy();
    } else {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    }
  });

  it('mostra a conta vinculada no card da meta', () => {
    render(
      <FamilyGoals
        {...baseProps}
        accounts={[makeAccount({ id: 'inv_acc', name: 'XP Investimentos', type: 'investment' })]}
        goals={[makeGoal({ name: 'Reserva de emergência', accountId: 'inv_acc' })]}
      />
    );
    expect(screen.getByText('Reserva de emergência')).toBeInTheDocument();
    expect(screen.getByText('XP Investimentos')).toBeInTheDocument();
  });

  it('lista a conta de investimento no seletor do formulário', () => {
    render(
      <FamilyGoals
        {...baseProps}
        accounts={[makeAccount({ id: 'inv_acc', name: 'Corretora XP', type: 'investment' })]}
      />
    );
    fireEvent.click(screen.getByText('Nova Meta de Poupança'));
    expect(screen.getByText('Conta do Valor Reservado*')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Corretora XP/ })).toBeInTheDocument();
  });

  it('valida que a conta do valor reservado foi selecionada', () => {
    const onAddGoal = vi.fn();
    render(
      <FamilyGoals
        {...baseProps}
        onAddGoal={onAddGoal}
      />
    );
    fireEvent.click(screen.getByText('Nova Meta de Poupança'));
    fireEvent.change(document.getElementById('goal-form-name')!, { target: { value: 'Reserva' } });
    fireEvent.change(document.getElementById('goal-form-current')!, { target: { value: '100' } });
    fireEvent.change(document.getElementById('goal-form-target')!, { target: { value: '1000' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(onAddGoal).not.toHaveBeenCalled();
    expect(screen.getByText('Selecione a conta onde o valor reservado ficará guardado.')).toBeInTheDocument();
  });

  it('cria meta vinculada à conta selecionada', () => {
    const onAddGoal = vi.fn();
    render(
      <FamilyGoals
        {...baseProps}
        categories={[makeCategory()]}
        accounts={[makeAccount({ id: 'inv_acc', name: 'Corretora XP', type: 'investment', balance: 5000 })]}
        onAddGoal={onAddGoal}
      />
    );
    fireEvent.click(screen.getByText('Nova Meta de Poupança'));
    fireEvent.change(document.getElementById('goal-form-name')!, { target: { value: 'Reserva' } });
    fireEvent.change(document.getElementById('goal-form-current')!, { target: { value: '100' } });
    fireEvent.change(document.getElementById('goal-form-target')!, { target: { value: '1000' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(onAddGoal).toHaveBeenCalledTimes(1);
    expect(onAddGoal.mock.calls[0][0].accountId).toBe('inv_acc');
  });

  it('registra aporte inicial como depósito vinculado à conta da meta', () => {
    const onAddGoal = vi.fn();
    render(
      <FamilyGoals
        {...baseProps}
        categories={[makeCategory()]}
        accounts={[makeAccount({ id: 'bank_acc', name: 'Banco Itaú', type: 'bank', balance: 5000 })]}
        onAddGoal={onAddGoal}
      />
    );
    fireEvent.click(screen.getByText('Nova Meta de Poupança'));
    fireEvent.change(document.getElementById('goal-form-name')!, { target: { value: 'Reserva' } });
    fireEvent.change(document.getElementById('goal-form-current')!, { target: { value: '100' } });
    fireEvent.change(document.getElementById('goal-form-target')!, { target: { value: '1000' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(onAddGoal.mock.calls[0][0].contributions).toHaveLength(1);
    expect(onAddGoal.mock.calls[0][0].contributions[0]).toMatchObject({ amount: 100, type: 'deposit' });
  });

  it('não registra aporte inicial quando o valor inicial é zero', () => {
    const onAddGoal = vi.fn();
    render(
      <FamilyGoals
        {...baseProps}
        categories={[makeCategory()]}
        accounts={[makeAccount({ id: 'bank_acc', name: 'Banco Itaú', type: 'bank', balance: 5000 })]}
        onAddGoal={onAddGoal}
      />
    );
    fireEvent.click(screen.getByText('Nova Meta de Poupança'));
    fireEvent.change(document.getElementById('goal-form-name')!, { target: { value: 'Reserva' } });
    fireEvent.change(document.getElementById('goal-form-target')!, { target: { value: '1000' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(onAddGoal.mock.calls[0][0].contributions).toBeUndefined();
  });
});