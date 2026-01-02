import { mockPayroll, mockStaff } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { DollarSign, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const statusConfig = {
  pending: { icon: Clock, label: 'Pending', className: 'text-warning bg-warning/10' },
  processed: { icon: AlertCircle, label: 'Processed', className: 'text-info bg-info/10' },
  paid: { icon: CheckCircle, label: 'Paid', className: 'text-success bg-success/10' },
};

export function PayrollSummary() {
  const payrollWithStaff = mockPayroll.slice(0, 5).map((record) => {
    const staff = mockStaff.find((s) => s.id === record.staffId);
    return { ...record, staff };
  });

  const totalPending = mockPayroll
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + p.netSalary, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-elegant">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-foreground">Payroll Summary</h3>
        <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-1.5">
          <DollarSign className="h-4 w-4 text-warning" />
          <span className="text-sm font-semibold text-warning">
            AED {totalPending.toLocaleString()} pending
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {payrollWithStaff.map((record, index) => {
          const config = statusConfig[record.status];
          const StatusIcon = config.icon;

          return (
            <div
              key={record.id}
              className="flex items-center justify-between rounded-lg bg-muted/50 p-4 transition-all duration-200 hover:bg-muted animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-sm font-semibold text-primary">
                    {record.staff?.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{record.staff?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {record.month} {record.year}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">
                    AED {record.netSalary.toLocaleString()}
                  </p>
                  {record.overtime > 0 && (
                    <p className="text-xs text-success">+{record.overtime} OT</p>
                  )}
                </div>
                <div
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
                    config.className
                  )}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {config.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
