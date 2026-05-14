import { useState } from 'react';
import { useAuthStore } from '@/shared/stores/authStore';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { ToastContainer } from './Toast';
import AccountSelector from '@/features/auth/AccountSelector';
import RoleBadge from '@/features/auth/RoleBadge';

interface LayoutProps { children: React.ReactNode }

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAdmin, user } = useAuthStore();

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-surface-base">
      <div className="hidden md:block">
        <Sidebar open={false} onClose={() => {}} isAdmin={isAdmin()} />
      </div>

      <div className="md:hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} isAdmin={isAdmin()} />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2 p-2">
          <AccountSelector />
          <RoleBadge />
        </div>
        <Topbar onMenuToggle={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      <MobileNav />
      <ToastContainer />
    </div>
  );
}