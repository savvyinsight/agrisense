import { useState } from 'react';
import { useAuthStore } from '@/shared/stores/authStore';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { ToastContainer } from './Toast';

interface LayoutProps { children: React.ReactNode }

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAdmin, user } = useAuthStore();

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-surface-base">
      {/* Desktop sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar open={false} onClose={() => {}} isAdmin={isAdmin()} />
      </div>

      {/* Mobile drawer sidebar */}
      <div className="md:hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} isAdmin={isAdmin()} />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <Topbar onMenuToggle={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}
