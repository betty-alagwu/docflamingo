import { DashboardLayout } from '@/app/components/dashboard-layout';

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="text-white">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">Organization</h1>
        <p className="text-gray-400 text-sm sm:text-base mb-8">
          Manage your organization settings and preferences.
        </p>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Settings</h2>
          <p className="text-gray-400">Organization settings will be available here.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
