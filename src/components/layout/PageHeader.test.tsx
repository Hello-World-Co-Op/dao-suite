import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { PageHeader } from './PageHeader';

// Mock @hello-world-co-op/ui
vi.mock('@hello-world-co-op/ui', () => ({
  SuiteSwitcher: ({ currentSuite }: { currentSuite: string }) => (
    <div data-testid="suite-switcher">SuiteSwitcher: {currentSuite}</div>
  ),
}));

// Mock NotificationBell
vi.mock('@/components/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">Notifications</div>,
}));

// Mock authCookieClient
vi.mock('@/services/authCookieClient', () => ({
  logout: vi.fn().mockResolvedValue(undefined),
}));

// Mock stores
vi.mock('@/stores', () => ({
  clearTokenBalance: vi.fn(),
  clearTreasury: vi.fn(),
  clearBurnPool: vi.fn(),
  clearEscrow: vi.fn(),
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('PageHeader', () => {
  it('renders title', () => {
    renderWithRouter(<PageHeader />);
    expect(screen.getByText('Hello World DAO')).toBeInTheDocument();
  });

  it('renders NotificationBell', () => {
    renderWithRouter(<PageHeader />);
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });

  it('renders SuiteSwitcher with currentSuite="portal"', () => {
    renderWithRouter(<PageHeader />);
    expect(screen.getByTestId('suite-switcher')).toHaveTextContent('portal');
  });

  it('renders logout button', () => {
    renderWithRouter(<PageHeader />);
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('clears stores and navigates to login on logout', async () => {
    const user = userEvent.setup();
    const { clearTokenBalance, clearTreasury, clearBurnPool, clearEscrow } = await import('@/stores');

    renderWithRouter(<PageHeader />);
    const logoutButton = screen.getByText('Logout');
    await user.click(logoutButton);

    expect(clearTokenBalance).toHaveBeenCalled();
    expect(clearTreasury).toHaveBeenCalled();
    expect(clearBurnPool).toHaveBeenCalled();
    expect(clearEscrow).toHaveBeenCalled();
  });
});
