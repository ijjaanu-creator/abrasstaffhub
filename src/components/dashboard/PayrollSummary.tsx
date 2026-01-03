import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { IndianRupee, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const statusConfig = {
  pending: { icon: Clock, label: 'Pending', className: 'text-warning bg-warning/10' },
  processed: { icon: AlertCircle, label: 'Processed', className: 'text-info bg-info/10' },
  paid: { icon: CheckCircle, label: 'Paid', className: 'text-success bg-success/10' },
};

export function PayrollSummary() {
  const { data: recentPayroll = [], isLoading } = useQuery({
    queryKey: ['recentPayroll'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_records')
        .select(`
          *,
          staff_members (id, name, position)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
  });

  const totalPending = recentPayroll
    .filter((p: any) => p.status === 'pending')
    .reduce((sum: number, p: any) => sum + Number(p.net_salary || 0), 0);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-elegant">
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-elegant">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-foreground">Recent Payroll</h3>
        <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-1.5">
          <IndianRupee className="h-4 w-4 text-warning" />
          <span className="text-sm font-semibold text-warning">
            ₹{totalPending.toLocaleString()} pending
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {recentPayroll.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No payroll records yet
          </div>
        ) : (
          recentPayroll.map((record: any, index: number) => {
            const config = statusConfig[record.status as keyof typeof statusConfig] || statusConfig.pending;
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
                      {record.staff_members?.name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{record.staff_members?.name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">{record.month} {record.year}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      ₹{Number(record.net_salary).toLocaleString()}
                    </p>
                    {Number(record.overtime) > 0 && (
                      <p className="text-xs text-success">+₹{Number(record.overtime).toLocaleString()} OT</p>
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
          })
        )}
      </div>
    </div>
  );
}
