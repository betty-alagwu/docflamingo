import { DashboardLayout } from '@/app/components/dashboard-layout';

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <div className="text-white">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">Analytics</h1>
        <p className="text-gray-400 text-sm sm:text-base">
          Analytics dashboard showing AI code review metrics and insights.
        </p>
      </div>
    </DashboardLayout>
  );
}
