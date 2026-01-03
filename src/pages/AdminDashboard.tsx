import { useAuth } from '@/contexts/AuthContext';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { AttendanceOverview } from '@/components/dashboard/AttendanceOverview';
import { PayrollSummary } from '@/components/dashboard/PayrollSummary';
import { FaceReregistrationRequests } from '@/components/dashboard/FaceReregistrationRequests';
import { Users, UserCheck, UserX, Clock, Wallet, IndianRupee } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function AdminDashboard() {
  const { user } = useAuth();
  
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Admin';

  // Fetch dashboard stats
  const { data: stats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const [staffResult, attendanceResult, payrollResult] = await Promise.all([
        supabase.from('staff_members').select('id', { count: 'exact' }),
        supabase.from('attendance_records').select('status').eq('date', today),
        supabase.from('payroll_records').select('status, net_salary'),
      ]);

      const totalStaff = staffResult.count || 0;
      const attendance = attendanceResult.data || [];
      const payroll = payrollResult.data || [];

      const presentToday = attendance.filter(a => a.status === 'present').length;
      const absentToday = attendance.filter(a => a.status === 'absent').length;
      const lateToday = attendance.filter(a => a.status === 'late').length;
      const pendingPayroll = payroll.filter(p => p.status === 'pending').length;
      const totalPayrollAmount = payroll.reduce((sum, p) => sum + Number(p.net_salary || 0), 0);

      return {
        totalStaff,
        presentToday,
        absentToday,
        lateToday,
        pendingPayroll,
        totalPayrollAmount,
      };
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="font-display text-3xl font-bold text-foreground">
          Welcome back, {displayName.split(' ')[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here's what's happening with your team today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatsCard
          title="Total Staff"
          value={stats?.totalStaff || 0}
          icon={Users}
          variant="primary"
          className="animate-fade-in"
        />
        <StatsCard
          title="Present Today"
          value={stats?.presentToday || 0}
          icon={UserCheck}
          variant="success"
          className="animate-fade-in delay-100"
        />
        <StatsCard
          title="Absent Today"
          value={stats?.absentToday || 0}
          icon={UserX}
          variant="danger"
          className="animate-fade-in delay-200"
        />
        <StatsCard
          title="Late Today"
          value={stats?.lateToday || 0}
          icon={Clock}
          variant="warning"
          className="animate-fade-in delay-300"
        />
        <StatsCard
          title="Pending Payroll"
          value={stats?.pendingPayroll || 0}
          icon={Wallet}
          className="animate-fade-in delay-400"
        />
        <StatsCard
          title="Total Payroll"
          value={`₹${((stats?.totalPayrollAmount || 0) / 1000).toFixed(1)}K`}
          icon={IndianRupee}
          variant="primary"
          className="animate-fade-in delay-500"
        />
      </div>

      {/* Face Re-registration Requests */}
      <div className="animate-fade-in delay-100">
        <FaceReregistrationRequests />
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
