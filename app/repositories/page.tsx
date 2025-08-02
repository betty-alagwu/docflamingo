import { DashboardLayout } from '@/app/components/dashboard-layout';

export default function RepositoriesPage() {
  return (
    <DashboardLayout>
      <div className="text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">Repositories</h1>
            <p className="text-neutral-400 text-sm sm:text-base">
              List of repositories accessible to CodeRabbit.
            </p>
          </div>
          <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md font-medium transition-colors duration-200">
            Add Repositories
          </button>
        </div>

        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-8 text-center">
          <h2 className="text-xl font-semibold mb-4">
            CodeRabbit currently doesn&lsquo;t have access to repositories for this organization.
          </h2>
          <p className="text-neutral-400 mb-6 max-w-md mx-auto">
            Install CodeRabbit on your GitHub organization and grant access to the repositories you
            want to work with.
          </p>
          <button className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-md font-medium transition-colors duration-200">
            Add Repositories
          </button>
          <p className="text-neutral-500 text-sm mt-4">
            Not seeing the right organization or account? You can switch by selecting a different
            one from the dropdown in the top-left corner.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
