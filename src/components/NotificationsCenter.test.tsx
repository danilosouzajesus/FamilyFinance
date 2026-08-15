import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationsCenter from './NotificationsCenter';
import { makeNotification, noop } from '../test/fixtures';

const baseProps = {
  notifications: [] as any[],
  unreadCount: 0,
  onMarkRead: noop,
  onMarkAllRead: noop,
  onClear: noop,
  onCheckAlerts: noop,
  onGenerateRecurring: noop,
};

describe('NotificationsCenter', () => {
  it('renderiza o botão de notificações', () => {
    render(<NotificationsCenter {...baseProps} />);
    expect(screen.getByRole('button', { name: /Central de Notificações/i })).toBeInTheDocument();
  });

  it('mostra o badge de não lidas', () => {
    render(<NotificationsCenter {...baseProps} unreadCount={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('abre o painel com as notificações ao clicar', () => {
    const notif = makeNotification();
    render(<NotificationsCenter {...baseProps} notifications={[notif]} unreadCount={1} />);
    fireEvent.click(screen.getByRole('button', { name: /Central de Notificações/i }));
    expect(screen.getByText('Central de Alertas')).toBeInTheDocument();
    expect(screen.getByText(notif.message)).toBeInTheDocument();
  });

  it('chama onMarkRead ao clicar em uma notificação', () => {
    const onMarkRead = vi.fn();
    const notif = makeNotification();
    render(<NotificationsCenter {...baseProps} notifications={[notif]} unreadCount={1} onMarkRead={onMarkRead} />);
    fireEvent.click(screen.getByRole('button', { name: /Central de Notificações/i }));
    fireEvent.click(screen.getByText(notif.message));
    expect(onMarkRead).toHaveBeenCalledWith(notif.id);
  });

  it('chama onMarkAllRead pelo botão de título', () => {
    const onMarkAllRead = vi.fn();
    render(<NotificationsCenter {...baseProps} notifications={[makeNotification()]} onMarkAllRead={onMarkAllRead} />);
    fireEvent.click(screen.getByRole('button', { name: /Central de Notificações/i }));
    fireEvent.click(screen.getByTitle('Marcar todas como lidas'));
    expect(onMarkAllRead).toHaveBeenCalled();
  });

  it('chama onCheckAlerts pelo botão Verificar Alertas', () => {
    const onCheckAlerts = vi.fn();
    render(<NotificationsCenter {...baseProps} onCheckAlerts={onCheckAlerts} />);
    fireEvent.click(screen.getByRole('button', { name: /Central de Notificações/i }));
    fireEvent.click(screen.getByText('Verificar Alertas'));
    expect(onCheckAlerts).toHaveBeenCalled();
  });
});