import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';

import { ClerkLogo } from '../components/clerk-logo';
import { CodeSwitcher } from '../components/code-switcher';
import { NextLogo } from '../components/next-logo';
import { UserDetails } from '../components/user-details';

export default async function DashboardPage() {
  return (
    <>
      <main className="max-w-[75rem] w-full mx-auto">
        <div className="grid grid-cols-[1fr_20.5rem] gap-10 pb-10">
          <div>
            <header className="flex items-center justify-between w-full h-16 gap-4">
              <div className="flex gap-4">
                <ClerkLogo />
                <div aria-hidden className="w-px h-6 bg-[#C7C7C8]" />
                <NextLogo />
              </div>
              <div className="flex items-center gap-2">
                <OrganizationSwitcher
                  appearance={{
                    elements: {
                      organizationPreviewAvatarBox: 'size-6',
                    },
                  }}
                />
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: 'size-6',
                    },
                  }}
                />
              </div>
            </header>
            <UserDetails />
          </div>
          <div className="pt-[3.5rem]">
            <CodeSwitcher />
          </div>
        </div>
      </main>
      <a href="https://github.com/apps/docflamingo-app/installations/select_target">
        Add repositories
      </a>
    </>
  );
}
