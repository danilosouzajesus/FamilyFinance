import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryManager from './CategoryManager';
import { makeCategory, makeSubcategory, makeTag, noop } from '@/test/fixtures';

const baseProps = {
  categories: [] as any[],
  subcategories: [] as any[],
  tags: [] as any[],
  transactions: [] as any[],
  budgets: [] as any[],
  onAddCategory: noop,
  onEditCategory: noop,
  onDeleteCategory: noop,
  onAddSubcategory: noop,
  onEditSubcategory: noop,
  onDeleteSubcategory: noop,
  onAddTag: noop,
  onEditTag: noop,
  onDeleteTag: noop,
};

describe('CategoryManager', () => {
  it('renderiza o título principal', () => {
    render(<CategoryManager {...baseProps} />);
    expect(screen.getByText('Categorias, Subcategorias & Tags')).toBeInTheDocument();
  });

  it('lista categorias, subcategorias e tags', () => {
    render(
      <CategoryManager
        {...baseProps}
        categories={[makeCategory()]}
        subcategories={[makeSubcategory()]}
        tags={[makeTag()]}
      />
    );
    expect(screen.getByText('Mercado')).toBeInTheDocument();
    // Expandir a categoria para ver as subcategorias
    fireEvent.click(screen.getByRole('button', { name: /Mercado/i }));
    expect(screen.getByText('Restaurante')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tags Personalizadas/i }));
    expect(screen.getByText('#essencial')).toBeInTheDocument();
  });

it('chama onAddTag ao criar uma tag', () => {
    const onAddTag = vi.fn();
    render(<CategoryManager {...baseProps} tags={[makeTag()]} onAddTag={onAddTag} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Nova Tag/i })[0]);
    fireEvent.change(screen.getByPlaceholderText(/viagem, reembolso/i), { target: { value: 'férias' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Tag/i }));
    expect(onAddTag).toHaveBeenCalled();
  });
});