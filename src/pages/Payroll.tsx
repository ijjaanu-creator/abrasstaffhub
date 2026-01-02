import { useState } from 'react';
import { mockPayroll, mockStaff } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Search,
  Download,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  CreditCard,
  Filter,
} from 'lucide-react';

const statusConfig = {
  pending: { icon: Clock, label: 'Pending', className: 'text-warning bg-warning/10' },
  processed: { icon: AlertCircle, label: 'Processed', className: 'text-info bg-info/10' },
  paid: { icon: CheckCircle, label: 'Paid', className: 'text-success bg-success/10' },
};

export default function Payroll() {
  const [searchQuery, setSearchQuery] = useState('');

  const payrollWithStaff = mockPayroll.map((record) => {
    const staff = mockStaff.find((s) => s.id === record.staffId);
    return { ...record, staff };
  });

  const filteredPayroll = payrollWithStaff.filter(
    (record) =>
      record.staff?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.staff?.position.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalPayroll: mockPayroll.reduce((sum, p) => sum + p.netSalary, 0),
    pending: mockPayroll.filter((p) => p.status === 'pending').reduce((sum, p) => sum + p.netSalary, 0),
    processed: mockPayroll.filter((p) => p.status === 'processed').reduce((sum, p) => sum + p.netSalary, 0),
    paid: mockPayroll.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.netSalary, 0),
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Payroll</h1>
          <p className="mt-1 text-muted-foreground">
            Manage salary payments and deductions
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="lg">
            <Download className="h-5 w-5 mr-2" />
            Export
          </Button>
          <Button variant="hero" size="lg">
            <CreditCard className="h-5 w-5 mr-2" />
            Process Payroll
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in delay-100">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-elegant">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
            <DollarSign className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Payroll</p>
            <p className="text-xl font-bold font-display text-foreground">
              AED {stats.totalPayroll.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-elegant">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
            <Clock className="h-6 w-6 text-warning" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-xl font-bold font-display text-foreground">
              AED {stats.pending.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-elegant">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10">
            <AlertCircle className="h-6 w-6 text-info" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Processed</p>
            <p className="text-xl font-bold font-display text-foreground">
              AED {stats.processed.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-elegant">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
            <CheckCircle className="h-6 w-6 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="text-xl font-bold font-display text-foreground">
              AED {stats.paid.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row animate-fade-in delay-200">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by name or position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
          />
        </div>
        <Button variant="outline" size="lg">
          <Filter className="h-5 w-5 mr-2" />
          Filters
        </Button>
      </div>

      {/* Payroll Table */}
      <div className="rounded-xl border border-border bg-card shadow-elegant overflow-hidden animate-fade-in delay-300">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Employee</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Period</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Base Salary</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Overtime</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Deductions</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Bonus</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Net Salary</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayroll.map((record) => {
                const config = statusConfig[record.status];
                const StatusIcon = config.icon;

                return (
                  <tr
                    key={record.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-primary text-primary-foreground font-semibold">
                          {record.staff?.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{record.staff?.name}</p>
                          <p className="text-xs text-muted-foreground">{record.staff?.position}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {record.month} {record.year}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-foreground">
                      AED {record.baseSalary.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {record.overtime > 0 ? (
                        <span className="text-success">+AED {record.overtime.toLocaleString()}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {record.deductions > 0 ? (
                        <span className="text-destructive">-AED {record.deductions.toLocaleString()}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {record.bonus > 0 ? (
                        <span className="text-success">+AED {record.bonus.toLocaleString()}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-foreground">
                      AED {record.netSalary.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
                          config.className
                        )}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {config.label}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {record.status === 'pending' && (
                        <Button variant="outline" size="sm">
                          Process
                        </Button>
                      )}
                      {record.status === 'processed' && (
                        <Button variant="success" size="sm">
                          Pay
                        </Button>
                      )}
                      {record.status === 'paid' && (
                        <span className="text-xs text-muted-foreground">
                          Paid on {record.paymentDate}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
