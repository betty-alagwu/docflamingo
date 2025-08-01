'use client';

import { useState } from 'react';

import { DashboardNavbar } from './dashboard-navbar';
import { DashboardSidebar } from './dashboard-sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-black flex">
      <DashboardSidebar isCollapsed={isSidebarCollapsed} onToggleAction={toggleSidebar} />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardNavbar />
        <main className="flex-1 px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8 overflow-x-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
