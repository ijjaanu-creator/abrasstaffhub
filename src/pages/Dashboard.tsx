import { useAuth } from '@/contexts/AuthContext';
import AdminDashboard from './AdminDashboard';
import StaffDashboard from './StaffDashboard';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { isAdmin, isLoading, userRole, isRoleLoading } = useAuth();

  // Wait for auth + role lookup to finish before rendering
  if (isLoading || isRoleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return isAdmin ? <AdminDashboard /> : <StaffDashboard />;
}
