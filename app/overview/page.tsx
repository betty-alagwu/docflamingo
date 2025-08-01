import { DashboardLayout } from '../components/dashboard-layout';

export default async function OverviewPage() {
  return (
    <DashboardLayout>
      <div className="text-white">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">Overview</h1>
        <p className="text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">
          Welcome to your AI code review dashboard. Manage your repositories and track review
          analytics.
        </p>

        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 sm:p-6 lg:p-8">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-3 sm:mb-4">Get Started</h2>
          <p className="text-gray-400 mb-4 sm:mb-6 text-sm sm:text-base">
            Connect your GitHub repositories to start receiving AI-powered code reviews.
          </p>
          <a
            className="inline-flex items-center px-3 sm:px-4 py-2 sm:py-2.5 bg-white text-black font-medium rounded-md hover:bg-gray-100 transition-colors duration-200 text-sm sm:text-base"
            href="https://github.com/apps/revlo-ai/installations/select_target"
          >
            Add repositories
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}
