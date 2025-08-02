'use client';

import { UserButton } from '@clerk/nextjs';
import { BellIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export function DashboardNavbar() {
  const [searchQuery, setSearchQuery] = useState('');
  const pathname = usePathname();

  const getNavigationItems = () => {
    if (pathname.startsWith('/repositories')) {
      return [{ name: 'Repositories', href: '/repositories', active: true }];
    } else if (pathname.startsWith('/analytics')) {
      return [{ name: 'Analytics', href: '/analytics', active: true }];
    } else if (pathname.startsWith('/settings')) {
      return [{ name: 'Organization Settings', href: '/settings', active: true }];
    } else {
      // Default dashboard navigation
      return [{ name: 'Overview', href: '/overview', active: pathname === '/overview' }];
    }
  };

  const navigationItems = getNavigationItems();

  return (
    <nav className="bg-black border-b border-neutral-700 min-w-full">
      <div className="px-3 sm:px-4 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center space-x-4 sm:space-x-6 lg:space-x-8">
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`${
                  item.active ? 'text-white' : 'text-neutral-400 hover:text-white'
                } text-xl sm:text-2xl lg:text-3xl font-bold transition-colors duration-200`}
              >
                {/* {item.name} */}
              </Link>
            ))}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4">
            <div className="relative">
              <div className="hidden md:block">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-4 w-4 text-neutral-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-neutral-800 border border-neutral-700 rounded-md pl-10 pr-4 py-2 text-sm text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent w-48 lg:w-64"
                />
              </div>

              <button className="md:hidden p-2 text-neutral-400 hover:text-white transition-colors duration-200">
                <MagnifyingGlassIcon className="h-5 w-5" />
              </button>
            </div>

            <button className="p-1.5 sm:p-2 text-neutral-400 hover:text-white transition-colors duration-200">
              <BellIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            <div className="ml-1 sm:ml-2">
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: 'size-5 sm:size-6',
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
