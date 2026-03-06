import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Clock,
  Wallet,
  FileText,
  Settings,
  LogOut,
  Fingerprint,
  User,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/BrandLogo';

const adminNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Staff', path: '/staff' },
  { icon: Clock, label: 'Attendance', path: '/attendance' },
  { icon: Wallet, label: 'Payroll', path: '/payroll' },
  { icon: FileText, label: 'Reports', path: '/reports' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

const staffNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Fingerprint, label: 'Mark Attendance', path: '/mark-attendance' },
  { icon: Clock, label: 'My Attendance', path: '/my-attendance' },
  { icon: Wallet, label: 'My Salary', path: '/my-salary' },
  { icon: User, label: 'Profile', path: '/profile' },
];

// Accountant in admin view sees admin pages except Settings
const accountantViewNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Staff', path: '/staff' },
  { icon: Clock, label: 'Attendance', path: '/attendance' },
  { icon: Wallet, label: 'Payroll', path: '/payroll' },
  { icon: FileText, label: 'Reports', path: '/reports' },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const location = useLocation();
  const { user, logout, isAdmin, userRole, isAccountant, adminViewMode, setAdminViewMode } = useAuth();

  const navItems = isAdmin 
    ? adminNavItems 
    : (isAccountant && adminViewMode) 
      ? accountantViewNavItems 
      : staffNavItems;
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

  const handleNavClick = () => {
    onNavigate?.();
  };

  const handleLogout = () => {
    logout();
    onNavigate?.();
  };

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
          <BrandLogo size={28} className="h-7 w-7" />
        </div>
        <div>
          <h1 className="font-display text-lg font-semibold text-foreground">Abras</h1>
          <p className="text-xs text-muted-foreground">Natural Spices</p>
        </div>
      </div>

      {/* Accountant Admin View Toggle */}
      {isAccountant && !isAdmin && (
        <div className="px-3 pt-3">
          <Button
            variant={adminViewMode ? 'default' : 'outline'}
            className="w-full justify-start gap-3 text-sm"
            onClick={() => setAdminViewMode(!adminViewMode)}
          >
            {adminViewMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {adminViewMode ? 'Exit Admin View' : 'Admin View'}
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="border-t border-border p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground capitalize">{userRole || 'User'}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Logout
        </Button>
      </div>
    </div>
  );
}
