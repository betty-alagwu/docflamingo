'use client';

import { UserButton } from '@clerk/nextjs';
import {
  ChartBarIcon,
  FolderIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  QuestionMarkCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleAction: () => void;
}

export function DashboardSidebar({ isCollapsed, onToggleAction }: SidebarProps) {
  const pathname = usePathname();

  const mainNavItems = [
    { name: 'Overview', href: '/overview', icon: HomeIcon },
    { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
    { name: 'Repositories', href: '/repositories', icon: FolderIcon },
    { name: 'Organization', href: '/organization', icon: Cog6ToothIcon },
  ];

  const bottomNavItems = [
    { name: 'Docs', href: '/docs', icon: DocumentTextIcon },
    { name: 'Support', href: '/support', icon: QuestionMarkCircleIcon },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <div
      className={`w-16 lg:${isCollapsed ? 'w-16' : 'w-64'} h-screen bg-neutral-800 border-r border-neutral-700 flex flex-col transition-all duration-300 ease-in-out`}
    >
      <div className="flex items-center justify-between p-[18px] border-b border-neutral-700">
        <div className="hidden lg:flex items-center space-x-2">
          {!isCollapsed && (
            <>
              <div className="w-6 h-6 bg-white rounded-sm"></div>
              <span className="text-white font-semibold text-lg">Revlo</span>
            </>
          )}
        </div>

        <button
          onClick={onToggleAction}
          className="hidden lg:block p-1.5 text-neutral-400 hover:text-white transition-colors duration-200 rounded-md hover:bg-neutral-700 ml-auto"
        >
          {isCollapsed ? (
            <ChevronRightIcon className="h-4 w-4" />
          ) : (
            <ChevronLeftIcon className="h-4 w-4" />
          )}
        </button>

        <div className="lg:hidden flex items-center justify-center w-full">
          <div className="w-6 h-6 bg-white rounded-sm"></div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`${
                isActive(item.href)
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
              } group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="ml-3 hidden lg:inline">{!isCollapsed ? item.name : ''}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-neutral-700 space-y-1">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className="text-neutral-400 hover:text-white hover:bg-neutral-700 group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200"
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="ml-3 hidden lg:inline">{!isCollapsed ? item.name : ''}</span>
            </Link>
          );
        })}

        <div className="flex items-center px-3 py-2">
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: 'size-5',
              },
            }}
          />

          <span className="ml-3 text-sm text-neutral-400 hidden lg:inline">
            {!isCollapsed ? 'Profile' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
