import { useState } from 'react';
import { mockStaff } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Search,
  Plus,
  MoreVertical,
  Mail,
  Phone,
  Building2,
  Calendar,
  DollarSign,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Staff() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStaff = mockStaff.filter(
    (staff) =>
      staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Staff Directory</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your team members and their information
          </p>
        </div>
        <Button variant="hero" size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Add Staff
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-4 animate-fade-in delay-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by name, position, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
          />
        </div>
      </div>

      {/* Staff Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredStaff.map((staff, index) => (
          <div
            key={staff.id}
            className="group relative rounded-xl border border-border bg-card p-6 shadow-elegant transition-all duration-300 hover:shadow-lg hover:border-primary/20 animate-fade-in"
            style={{ animationDelay: `${(index + 2) * 50}ms` }}
          >
            {/* Status Badge */}
            <div
              className={cn(
                'absolute right-4 top-4 rounded-full px-2 py-0.5 text-xs font-medium',
                staff.status === 'active'
                  ? 'bg-success/10 text-success'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {staff.status}
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-12 top-3 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>View Profile</DropdownMenuItem>
                <DropdownMenuItem>Edit Details</DropdownMenuItem>
                <DropdownMenuItem>View Attendance</DropdownMenuItem>
                <DropdownMenuItem>View Payroll</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Avatar & Basic Info */}
            <div className="flex items-start gap-4 mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl gradient-primary text-primary-foreground font-display text-xl font-bold">
                {staff.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{staff.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{staff.position}</p>
                <p className="text-xs text-primary font-medium">{staff.employeeId}</p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{staff.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span>{staff.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4 flex-shrink-0" />
                <span>{staff.department}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span>Joined {new Date(staff.joinDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Salary */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span>Monthly Salary</span>
                </div>
                <span className="font-semibold text-foreground">
                  AED {staff.salary.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredStaff.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No staff members found matching your search.</p>
        </div>
      )}
    </div>
  );
}
