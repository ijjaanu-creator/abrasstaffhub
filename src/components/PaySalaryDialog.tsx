import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, IndianRupee, Users, User } from 'lucide-react';
import { format } from 'date-fns';

interface PaySalaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function PaySalaryDialog({ open, onOpenChange }: PaySalaryDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentDate = new Date();
  
  const [paymentType, setPaymentType] = useState<'individual' | 'bulk'>('individual');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [month, setMonth] = useState(months[currentDate.getMonth()]);
  const [year, setYear] = useState(currentDate.getFullYear().toString());
  const [bonus, setBonus] = useState('0');
  const [deductions, setDeductions] = useState('0');
  const [markAsPaid, setMarkAsPaid] = useState(true);

  // Fetch active staff members
  const { data: staffMembers = [], isLoading: staffLoading } = useQuery({
    queryKey: ['active-staff-for-payment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('id, name, employee_id, position, salary')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const selectedStaff = staffMembers.find(s => s.id === selectedStaffId);

  const createPayrollMutation = useMutation({
    mutationFn: async () => {
      const staffToProcess = paymentType === 'bulk' 
        ? staffMembers 
        : staffMembers.filter(s => s.id === selectedStaffId);

      if (staffToProcess.length === 0) {
        throw new Error('No staff selected');
      }

      const bonusAmount = parseFloat(bonus) || 0;
      const deductionsAmount = parseFloat(deductions) || 0;
      const yearNum = parseInt(year);
      const status = markAsPaid ? 'paid' : 'pending';
      const paymentDate = markAsPaid ? format(new Date(), 'yyyy-MM-dd') : null;

      const records = staffToProcess.map(staff => ({
        staff_id: staff.id,
        month,
        year: yearNum,
        base_salary: staff.salary,
        bonus: bonusAmount,
        deductions: deductionsAmount,
        overtime: 0,
        net_salary: staff.salary + bonusAmount - deductionsAmount,
        status,
        payment_date: paymentDate,
      }));

      const { error } = await supabase
        .from('payroll_records')
        .insert(records);
      
      if (error) throw error;
      return records.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
      toast({ 
        title: 'Salary payment created!',
        description: `Created ${count} payroll record${count > 1 ? 's' : ''}.`
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Payment failed',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const resetForm = () => {
    setPaymentType('individual');
    setSelectedStaffId('');
    setMonth(months[currentDate.getMonth()]);
    setYear(currentDate.getFullYear().toString());
    setBonus('0');
    setDeductions('0');
    setMarkAsPaid(true);
  };

  const calculateNetSalary = () => {
    if (paymentType === 'bulk') {
      const total = staffMembers.reduce((sum, s) => {
        return sum + s.salary + (parseFloat(bonus) || 0) - (parseFloat(deductions) || 0);
      }, 0);
      return total;
    }
    if (!selectedStaff) return 0;
    return selectedStaff.salary + (parseFloat(bonus) || 0) - (parseFloat(deductions) || 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-primary" />
            Pay Salary
          </DialogTitle>
          <DialogDescription>
            Create a salary payment record for staff members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Payment Type */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={paymentType === 'individual' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setPaymentType('individual')}
            >
              <User className="h-4 w-4 mr-2" />
              Individual
            </Button>
            <Button
              type="button"
              variant={paymentType === 'bulk' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setPaymentType('bulk')}
            >
              <Users className="h-4 w-4 mr-2" />
              All Staff ({staffMembers.length})
            </Button>
          </div>

          {/* Staff Selection (for individual) */}
          {paymentType === 'individual' && (
            <div className="space-y-2">
              <Label>Select Staff Member</Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staffLoading ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">Loading...</div>
                  ) : (
                    staffMembers.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.name} - ₹{staff.salary.toLocaleString()}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedStaff && (
                <p className="text-xs text-muted-foreground">
                  {selectedStaff.position} • Base: ₹{selectedStaff.salary.toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Month & Year */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min="2020"
                max="2030"
              />
            </div>
          </div>

          {/* Bonus & Deductions */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Bonus (₹)</Label>
              <Input
                type="number"
                value={bonus}
                onChange={(e) => setBonus(e.target.value)}
                min="0"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Deductions (₹)</Label>
              <Input
                type="number"
                value={deductions}
                onChange={(e) => setDeductions(e.target.value)}
                min="0"
                placeholder="0"
              />
            </div>
          </div>

          {/* Mark as Paid */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="mark-paid"
              checked={markAsPaid}
              onCheckedChange={(checked) => setMarkAsPaid(checked === true)}
            />
            <Label htmlFor="mark-paid" className="text-sm font-normal cursor-pointer">
              Mark as paid immediately
            </Label>
          </div>

          {/* Summary */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {paymentType === 'bulk' ? 'Total Staff' : 'Base Salary'}
              </span>
              <span className="font-medium">
                {paymentType === 'bulk' 
                  ? `${staffMembers.length} members`
                  : selectedStaff ? `₹${selectedStaff.salary.toLocaleString()}` : '-'
                }
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Period</span>
              <span className="font-medium">{month} {year}</span>
            </div>
            <div className="border-t border-border my-2" />
            <div className="flex justify-between">
              <span className="font-medium">Net Amount</span>
              <span className="font-bold text-primary text-lg">
                ₹{calculateNetSalary().toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => createPayrollMutation.mutate()}
            disabled={createPayrollMutation.isPending || (paymentType === 'individual' && !selectedStaffId)}
          >
            {createPayrollMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <IndianRupee className="h-4 w-4 mr-2" />
            )}
            {markAsPaid ? 'Pay Now' : 'Create Record'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}