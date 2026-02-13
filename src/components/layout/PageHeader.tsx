/**
 * PageHeader Component - Shared header with suite switcher and logout
 * Story BL-010.2 - Cross-suite navigation for dao-suite
 */
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SuiteSwitcher } from '@hello-world-co-op/ui';
import { NotificationBell } from '@/components/NotificationBell';
import { LogOut } from 'lucide-react';
import { clearTokenBalance, clearTreasury, clearBurnPool, clearEscrow } from '@/stores';

export function PageHeader() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem('user_data');
    clearTokenBalance();
    clearTreasury();
    clearBurnPool();
    clearEscrow();
    navigate('/login');
  }

  return (
    <header className="h-16 border-b border-border bg-white flex items-center justify-between px-6">
      <h1 className="text-xl font-bold text-gray-800">Hello World DAO</h1>
      <div className="flex items-center gap-4">
        <NotificationBell />
        <SuiteSwitcher
          currentSuite="portal"
          suiteUrls={{
            founderyOs: import.meta.env.VITE_FOUNDERY_OS_URL,
            governance: import.meta.env.VITE_GOVERNANCE_SUITE_URL,
            otterCamp: import.meta.env.VITE_OTTER_CAMP_URL,
            admin: import.meta.env.VITE_ADMIN_SUITE_URL,
          }}
        />
        <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
