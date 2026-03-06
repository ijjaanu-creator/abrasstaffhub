import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV, formatPayrollForExport } from '@/lib/exportUtils';
import { PaySalaryDialog } from '@/components/PaySalaryDialog';
import {
  Search,
  Download,
  IndianRupee,
  Clock,
  CheckCircle,
  AlertCircle,
  CreditCard,
  Loader2,
  Plus,
} from 'lucide-react';

const statusConfig: Record<string, { icon: any; label: string; className: string }> = {
  pending: { icon: Clock, label: 'Pending', className: 'text-warning bg-warning/10' },
  processed: { icon: AlertCircle, label: 'Processed', className: 'text-info bg-info/10' },
  paid: { icon: CheckCircle, label: 'Paid', className: 'text-success bg-success/10' },
};

export default function Payroll() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showPayDialog, setShowPayDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isAccountant, adminViewMode } = useAuth();
  const isReadOnly = !isAdmin && isAccountant && adminViewMode;

  const { data: payrollRecords = [], isLoading } = useQuery({
    queryKey: ['payroll-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_records')
        .select(`
          *,
          staff_members (
            id,
            name,
            position,
            employee_id
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, paymentDate }: { id: string; status: string; paymentDate?: string }) => {
      const updateData: any = { status };
      if (paymentDate) updateData.payment_date = paymentDate;
      
      const { error } = await supabase
        .from('payroll_records')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
      toast({ title: 'Payroll status updated' });
    },
  });

  const filteredPayroll = payrollRecords.filter(
    (record: any) =>
      record.staff_members?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.staff_members?.position?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalPayroll: payrollRecords.reduce((sum: number, p: any) => sum + (p.net_salary || 0), 0),
    pending: payrollRecords.filter((p: any) => p.status === 'pending').reduce((sum: number, p: any) => sum + (p.net_salary || 0), 0),
    processed: payrollRecords.filter((p: any) => p.status === 'processed').reduce((sum: number, p: any) => sum + (p.net_salary || 0), 0),
    paid: payrollRecords.filter((p: any) => p.status === 'paid').reduce((sum: number, p: any) => sum + (p.net_salary || 0), 0),
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">Payroll</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage salary payments and deductions
          </p>
        </div>
        <div className="flex gap-3">
          {!isReadOnly && (
            <Button
              variant="default"
              size="lg"
              className="flex-1 sm:flex-none"
              onClick={() => setShowPayDialog(true)}
            >
              <Plus className="h-5 w-5 mr-2" />
              <span className="hidden sm:inline">Pay Salary</span>
              <span className="sm:hidden">Pay</span>
            </Button>
          )}
          <Button 
            variant="outline" 
            size="lg" 
            className="flex-1 sm:flex-none"
            onClick={() => {
              if (filteredPayroll.length === 0) {
                toast({ title: 'No data to export', variant: 'destructive' });
                return;
              }
              const data = formatPayrollForExport(filteredPayroll);
              exportToCSV(data, 'payroll_report');
              toast({ title: 'Payroll report exported successfully!' });
            }}
          >
            <Download className="h-5 w-5 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 animate-fade-in delay-100">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 lg:p-4 shadow-elegant">
          <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-xl gradient-primary">
            <IndianRupee className="h-5 w-5 lg:h-6 lg:w-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-xs lg:text-sm text-muted-foreground">Total</p>
            <p className="text-lg lg:text-xl font-bold font-display text-foreground truncate">
              ₹{stats.totalPayroll.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 lg:p-4 shadow-elegant">
          <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-xl bg-warning/10">
            <Clock className="h-5 w-5 lg:h-6 lg:w-6 text-warning" />
          </div>
          <div className="min-w-0">
            <p className="text-xs lg:text-sm text-muted-foreground">Pending</p>
            <p className="text-lg lg:text-xl font-bold font-display text-foreground truncate">
              ₹{stats.pending.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 lg:p-4 shadow-elegant">
          <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-xl bg-info/10">
            <AlertCircle className="h-5 w-5 lg:h-6 lg:w-6 text-info" />
          </div>
          <div className="min-w-0">
            <p className="text-xs lg:text-sm text-muted-foreground">Processed</p>
            <p className="text-lg lg:text-xl font-bold font-display text-foreground truncate">
              ₹{stats.processed.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 lg:p-4 shadow-elegant">
          <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-xl bg-success/10">
            <CheckCircle className="h-5 w-5 lg:h-6 lg:w-6 text-success" />
          </div>
          <div className="min-w-0">
            <p className="text-xs lg:text-sm text-muted-foreground">Paid</p>
            <p className="text-lg lg:text-xl font-bold font-display text-foreground truncate">
              ₹{stats.paid.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4 animate-fade-in delay-200">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by name or position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
          />
        </div>
      </div>

      {/* Payroll List - Mobile Cards */}
      <div className="space-y-3 lg:hidden">
        {filteredPayroll.map((record: any) => {
          const config = statusConfig[record.status] || statusConfig.pending;
          const StatusIcon = config.icon;

          return (
            <div
              key={record.id}
              className="rounded-xl border border-border bg-card p-4 shadow-elegant"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-primary text-primary-foreground font-semibold">
                    {record.staff_members?.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{record.staff_members?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{record.month} {record.year}</p>
                  </div>
                </div>
                <div
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                    config.className
                  )}
                >
                  <StatusIcon className="h-3 w-3" />
                  {config.label}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                  <p className="text-muted-foreground text-xs">Base Salary</p>
                  <p className="font-medium">₹{record.base_salary?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">
                    {record.payment_mode === 'advance' ? 'Advance Paid' : 'Net Salary'}
                  </p>
                  <p className="font-medium text-primary">
                    ₹{(record.payment_mode === 'advance' ? record.advance_amount : record.net_salary)?.toLocaleString()}
                  </p>
                </div>
                {record.payment_mode === 'advance' && record.remaining_amount > 0 && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Remaining Balance</p>
                    <p className="font-medium text-warning">₹{record.remaining_amount?.toLocaleString()}</p>
                  </div>
                )}
              </div>

              {record.status === 'pending' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => updateStatusMutation.mutate({ id: record.id, status: 'processed' })}
                >
                  Process
                </Button>
              )}
              {record.status === 'processed' && (
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={() => updateStatusMutation.mutate({ 
                    id: record.id, 
                    status: 'paid',
                    paymentDate: new Date().toISOString().split('T')[0]
                  })}
                >
                  Mark as Paid
                </Button>
              )}
              {record.status === 'paid' && record.payment_date && (
                <p className="text-xs text-muted-foreground text-center">
                  Paid on {new Date(record.payment_date).toLocaleDateString()}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Payroll Table - Desktop */}
      <div className="hidden lg:block rounded-xl border border-border bg-card shadow-elegant overflow-hidden animate-fade-in delay-300">
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
              {filteredPayroll.map((record: any) => {
                const config = statusConfig[record.status] || statusConfig.pending;
                const StatusIcon = config.icon;

                return (
                  <tr
                    key={record.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-primary text-primary-foreground font-semibold">
                          {record.staff_members?.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{record.staff_members?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{record.staff_members?.position}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {record.month} {record.year}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-foreground">
                      ₹{record.base_salary?.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {record.overtime > 0 ? (
                        <span className="text-success">+₹{record.overtime?.toLocaleString()}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {record.deductions > 0 ? (
                        <span className="text-destructive">-₹{record.deductions?.toLocaleString()}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {record.bonus > 0 ? (
                        <span className="text-success">+₹{record.bonus?.toLocaleString()}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-foreground">
                      ₹{record.net_salary?.toLocaleString()}
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ id: record.id, status: 'processed' })}
                        >
                          Process
                        </Button>
                      )}
                      {record.status === 'processed' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ 
                            id: record.id, 
                            status: 'paid',
                            paymentDate: new Date().toISOString().split('T')[0]
                          })}
                        >
                          Pay
                        </Button>
                      )}
                      {record.status === 'paid' && (
                        <span className="text-xs text-muted-foreground">
                          Paid on {record.payment_date ? new Date(record.payment_date).toLocaleDateString() : '-'}
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

      {filteredPayroll.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No payroll records found.</p>
        </div>
      )}

      {/* Pay Salary Dialog */}
      <PaySalaryDialog open={showPayDialog} onOpenChange={setShowPayDialog} />
    </div>
  );
}
