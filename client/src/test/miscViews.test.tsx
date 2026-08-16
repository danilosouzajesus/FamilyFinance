import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AIAdvisor from '@/features/ai-advisor/AIAdvisor';
import PremiumFeatures from '@/features/premium/PremiumFeatures';
import SecurityAndSettings from '@/features/settings/SecurityAndSettings';
import { emptyState, sampleState, noop } from '@/test/fixtures';

describe('AIAdvisor', () => {
  it('renderiza a mensagem de boas-vindas', () => {
    render(<AIAdvisor financialState={emptyState()} />);
    expect(screen.getAllByText(/Serenity AI/i).length).toBeGreaterThan(0);
  });

  it('renderiza com dados de exemplo sem quebrar', () => {
    const { container } = render(<AIAdvisor financialState={sampleState()} />);
    expect(container).not.toBeEmptyDOMElement();
  });
});

describe('PremiumFeatures', () => {
  it('renderiza o simulador sem dados', () => {
    const { container } = render(<PremiumFeatures financialState={emptyState()} />);
    expect(container).not.toBeEmptyDOMElement();
  });

  it('renderiza com dados de exemplo', () => {
    render(<PremiumFeatures financialState={sampleState()} />);
    expect(screen.getAllByText(/simulador|projeção|simula/i).length).toBeGreaterThan(0);
  });
});

describe('SecurityAndSettings', () => {
  it('renderiza as configurações de segurança', () => {
    render(<SecurityAndSettings financialState={emptyState()} isPrivateMode={false} setIsPrivateMode={noop} />);
    expect(screen.getByText('Segurança & Privacidade')).toBeInTheDocument();
  });

  it('chama setIsPrivateMode ao alternar o modo privado', () => {
    const setIsPrivateMode = vi.fn();
    render(<SecurityAndSettings financialState={emptyState()} isPrivateMode={false} setIsPrivateMode={setIsPrivateMode} />);
    fireEvent.click(screen.getByRole('button', { name: /privado|privacidade/i }));
    expect(setIsPrivateMode).toHaveBeenCalledWith(true);
  });
});