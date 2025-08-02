import { DashboardLayout } from '../components/dashboard-layout';
import { PullRequestTable } from '../components/pull-request-table';
import { StatCard } from '../components/stat-card';

// Sample data - in a real app, this would come from an API
const samplePullRequests = [
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
];

export default async function OverviewPage() {
  return (
    <DashboardLayout>
      <div className="text-white">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">Overview</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Opened"
            total={1}
            data={[0, 0, 0, 1, 0, 0, 0]}
            dateRange="Jul 28 - Aug 3"
            color="#5B82F3"
          />
          <StatCard
            title="Merged"
            total={0}
            data={[0, 0, 0, 0, 0, 0, 0]}
            dateRange="Jul 28 - Aug 3"
            color="#10B981"
          />
          <StatCard
            title="Code Changes"
            total={5}
            data={[0.2, 0, 0.4, 0.2, 0, 0.2, 0]}
            dateRange="Jul 28 - Aug 3"
            color="#8B5CF6"
          />
        </div>

        <PullRequestTable pullRequests={samplePullRequests} />
      </div>
    </DashboardLayout>
  );
}
