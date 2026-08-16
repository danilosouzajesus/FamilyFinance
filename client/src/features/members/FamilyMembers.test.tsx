import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FamilyMembers from './FamilyMembers';
import { makeMember, makeTx, noop } from '@/test/fixtures';

const baseProps = {
  familyMembers: [] as any[],
  transactions: [] as any[],
  isPrivateMode: false,
  onAddMember: noop,
  onEditMember: noop,
  onDeleteMember: noop,
};

describe('FamilyMembers', () => {
  it('renderiza sem membros', () => {
    const { container } = render(<FamilyMembers {...baseProps} />);
    expect(container).not.toBeEmptyDOMElement();
  });

  it('lista os membros da família', () => {
    render(<FamilyMembers {...baseProps} familyMembers={[makeMember({ id: 'm1', name: 'Ana' }), makeMember({ id: 'm2', name: 'Carlos', role: 'father' })]} />);
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Carlos')).toBeInTheDocument();
  });

  it('abre o formulário ao clicar em adicionar membro', () => {
    render(<FamilyMembers {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Membro/i }));
    expect(screen.getByText('Novo Membro da Família')).toBeInTheDocument();
  });

  it('não quebra quando o membro tem transações vinculadas', () => {
    render(
      <FamilyMembers
        {...baseProps}
        familyMembers={[makeMember()]}
        transactions={[makeTx({ memberId: 'm1', amount: 250 })]}
      />
    );
    expect(screen.getByText('Ana')).toBeInTheDocument();
  });
});