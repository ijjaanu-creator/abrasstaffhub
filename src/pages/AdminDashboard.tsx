import { useAuth } from '@/contexts/AuthContext';
import { mockDashboardStats } from '@/data/mockData';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { AttendanceOverview } from '@/components/dashboard/AttendanceOverview';
import { PayrollSummary } from '@/components/dashboard/PayrollSummary';
import { Users, UserCheck, UserX, Clock, Wallet, DollarSign } from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();
  const stats = mockDashboardStats;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="font-display text-3xl font-bold text-foreground">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here's what's happening with your team today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatsCard
          title="Total Staff"
          value={stats.totalStaff}
          icon={Users}
          variant="primary"
          className="animate-fade-in"
        />
        <StatsCard
          title="Present Today"
          value={stats.presentToday}
          icon={UserCheck}
          variant="success"
          className="animate-fade-in delay-100"
        />
        <StatsCard
          title="Absent Today"
          value={stats.absentToday}
          icon={UserX}
          variant="danger"
          className="animate-fade-in delay-200"
        />
        <StatsCard
          title="Late Today"
          value={stats.lateToday}
          icon={Clock}
          variant="warning"
          className="animate-fade-in delay-300"
        />
        <StatsCard
          title="Pending Payroll"
          value={stats.pendingPayroll}
          icon={Wallet}
          className="animate-fade-in delay-400"
        />
        <StatsCard
          title="Total Payroll"
          value={`AED ${(stats.totalPayrollAmount / 1000).toFixed(1)}K`}
          icon={DollarSign}
          variant="primary"
          className="animate-fade-in delay-500"
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="animate-fade-in delay-200">
          <AttendanceOverview />
        </div>
        <div className="animate-fade-in delay-300">
          <PayrollSummary />
        </div>
      </div>
    </div>
  );
}
