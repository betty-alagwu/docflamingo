'use client';

import { DashboardLayout } from '@/app/components/dashboard-layout';
import { PullRequestTable } from '@/app/components/pull-request-table';
import { Pagination } from '@/app/components/ui/pagination';
import { usePagination } from '@/app/hooks/use-pagination';

const allPullRequests = [
  {
    id: '1',
    title: 'Fix authentication bug',
    repository: 'docflamingo',
    status: 'merged' as const,
    author: 'john.doe',
    date: '2 days ago',
  },
  {
    id: '2',
    title: 'Update dashboard UI',
    repository: 'docflamingo',
    status: 'open' as const,
    author: 'jane.smith',
    date: '1 day ago',
  },
  {
    id: '3',
    title: 'Add new feature',
    repository: 'docflamingo',
    status: 'review' as const,
    author: 'mike.wilson',
    date: '3 hours ago',
  },
  {
    id: '4',
    title: 'Refactor API endpoints',
    repository: 'docflamingo',
    status: 'merged' as const,
    author: 'sarah.jones',
    date: '4 days ago',
  },
  {
    id: '5',
    title: 'Add unit tests',
    repository: 'docflamingo',
    status: 'open' as const,
    author: 'alex.brown',
    date: '5 hours ago',
  },
  {
    id: '6',
    title: 'Update documentation',
    repository: 'docflamingo',
    status: 'review' as const,
    author: 'emma.davis',
    date: '1 hour ago',
  },
  {
    id: '7',
    title: 'Optimize database queries',
    repository: 'docflamingo',
    status: 'closed' as const,
    author: 'tom.miller',
    date: '6 days ago',
  },
  {
    id: '8',
    title: 'Implement dark mode',
    repository: 'docflamingo',
    status: 'open' as const,
    author: 'lisa.garcia',
    date: '2 hours ago',
  },
  {
    id: '9',
    title: 'Add search functionality',
    repository: 'docflamingo',
    status: 'merged' as const,
    author: 'david.lee',
    date: '1 week ago',
  },
  {
    id: '10',
    title: 'Fix mobile responsiveness',
    repository: 'docflamingo',
    status: 'review' as const,
    author: 'maria.rodriguez',
    date: '30 minutes ago',
  },
  {
    id: '11',
    title: 'Add error handling',
    repository: 'docflamingo',
    status: 'open' as const,
    author: 'james.wilson',
    date: '2 weeks ago',
  },
  {
    id: '12',
    title: 'Update dependencies',
    repository: 'docflamingo',
    status: 'merged' as const,
    author: 'sarah.chen',
    date: '3 weeks ago',
  },
  {
    id: '13',
    title: 'Improve performance',
    repository: 'docflamingo',
    status: 'closed' as const,
    author: 'robert.taylor',
    date: '1 month ago',
  },
  {
    id: '14',
    title: 'Add logging system',
    repository: 'docflamingo',
    status: 'review' as const,
    author: 'anna.kim',
    date: '1 month ago',
  },
  {
    id: '15',
    title: 'Fix security vulnerability',
    repository: 'docflamingo',
    status: 'merged' as const,
    author: 'michael.brown',
    date: '5 weeks ago',
  },
  {
    id: '16',
    title: 'Add integration tests',
    repository: 'docflamingo',
    status: 'open' as const,
    author: 'jessica.davis',
    date: '6 weeks ago',
  },
  {
    id: '17',
    title: 'Refactor components',
    repository: 'docflamingo',
    status: 'review' as const,
    author: 'daniel.martinez',
    date: '2 months ago',
  },
  {
    id: '18',
    title: 'Update README',
    repository: 'docflamingo',
    status: 'merged' as const,
    author: 'emily.johnson',
    date: '2 months ago',
  },
  {
    id: '19',
    title: 'Add CI/CD pipeline',
    repository: 'docflamingo',
    status: 'closed' as const,
    author: 'chris.anderson',
    date: '3 months ago',
  },
  {
    id: '20',
    title: 'Implement caching',
    repository: 'docflamingo',
    status: 'open' as const,
    author: 'lisa.thompson',
    date: '3 months ago',
  },
  // Additional data to test pagination with 10+ pages
  ...Array.from({ length: 80 }, (_, i) => ({
    id: `${21 + i}`,
    title: `Feature request #${21 + i}`,
    repository: 'docflamingo',
    status: (['open', 'merged', 'review', 'closed'] as const)[i % 4],
    author: `developer${(i % 10) + 1}`,
    date: `${Math.floor(i / 7) + 1} ${i % 7 < 3 ? 'days' : 'weeks'} ago`,
  })),
];

export default function AnalyticsPage() {
  const { currentData, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } =
    usePagination({
      data: allPullRequests,
      itemsPerPage: 10,
      initialPage: 1,
    });

  return (
    <DashboardLayout>
      <div className="text-white">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">Analytics</h1>

        <div className="transition-all duration-300 ease-in-out">
          <PullRequestTable
            pullRequests={currentData}
            title="All Pull Requests"
            maxItems={0}
            showSeeMore={false}
          />
        </div>

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between">
            <div>
              <p className="text-neutral-400 text-sm">
                Showing {startIndex}-{endIndex} of {totalItems} pull requests
              </p>
            </div>

            <div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChangeAction={goToPage}
                showPageNumbers={true}
                maxVisiblePages={5}
              />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
