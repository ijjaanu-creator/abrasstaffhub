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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, IndianRupee, Users, User, Wallet, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface PaySalaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

type PaymentMode = 'full' | 'advance' | 'balance';

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
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('full');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [notes, setNotes] = useState('');

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

  // Fetch pending balance records for the selected staff (always fetch when staff selected)
  const { data: pendingBalanceRecords = [] } = useQuery({
    queryKey: ['pending-balance-records', selectedStaffId],
    queryFn: async () => {
      if (!selectedStaffId) return [];
      const { data, error } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('staff_id', selectedStaffId)
        .eq('payment_mode', 'advance')
        .gt('remaining_amount', 0);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!selectedStaffId,
  });

  const selectedStaff = staffMembers.find(s => s.id === selectedStaffId);
  const pendingBalance = pendingBalanceRecords.reduce((sum, r) => sum + Number(r.remaining_amount || 0), 0);

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
      const today = format(new Date(), 'yyyy-MM-dd');
      const paymentDate = paymentMode === 'full' ? (markAsPaid ? today : null) : today;
      const status = paymentMode === 'full' ? (markAsPaid ? 'paid' : 'pending') : 'pending';

      // Handle balance payment (pay remaining amount from previous advance)
      if (paymentMode === 'balance' && pendingBalanceRecords.length > 0) {
        const balanceAmt = parseFloat(balanceAmount) || pendingBalance;
        
        if (balanceAmt <= 0) {
          throw new Error('Enter a valid balance amount');
        }
        if (balanceAmt > pendingBalance) {
          throw new Error(`Amount cannot exceed pending balance of ₹${pendingBalance.toLocaleString()}`);
        }

        let remainingToAllocate = balanceAmt;
        const sortedRecords = [...pendingBalanceRecords].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        for (const record of sortedRecords) {
          if (remainingToAllocate <= 0) break;
          const currentRemaining = Number(record.remaining_amount || 0);
          if (currentRemaining <= 0) continue;

          const appliedAmount = Math.min(currentRemaining, remainingToAllocate);
          const newRemaining = currentRemaining - appliedAmount;

          const { error: updateError } = await supabase
            .from('payroll_records')
            .update({
              status: newRemaining === 0 ? 'paid' : 'pending',
              remaining_amount: newRemaining,
              payment_date: newRemaining === 0 ? paymentDate : record.payment_date,
            })
            .eq('id', record.id);

          if (updateError) throw updateError;

          const { error: advanceError } = await supabase
            .from('salary_advances')
            .insert({
              payroll_id: record.id,
              staff_id: record.staff_id,
              amount: appliedAmount,
              payment_date: paymentDate,
              payment_type: 'balance',
              notes: notes || `Balance payment for ${month} ${year}`,
            });

          if (advanceError) throw advanceError;
          remainingToAllocate -= appliedAmount;
        }
        return sortedRecords.length;
      }

      const records = staffToProcess.map(staff => {
        const netSalary = staff.salary + bonusAmount - deductionsAmount;
        const advanceAmt = paymentMode === 'advance' ? parseFloat(advanceAmount) || 0 : 0;
        const remainingAmt = paymentMode === 'advance' ? netSalary - advanceAmt : 0;

        return {
          staff_id: staff.id,
          month,
          year: yearNum,
          base_salary: staff.salary,
          bonus: bonusAmount,
          deductions: deductionsAmount,
          overtime: 0,
          net_salary: netSalary,
          status: paymentMode === 'advance' ? 'pending' : status,
          payment_date: paymentDate,
          payment_mode: paymentMode,
          advance_amount: advanceAmt,
          advance_date: paymentMode === 'advance' ? paymentDate : null,
          remaining_amount: remainingAmt,
        };
      });

      const { data: insertedRecords, error } = await supabase
        .from('payroll_records')
        .insert(records)
        .select();
      
      if (error) throw error;

      // Create salary advance records for tracking
      if (paymentMode === 'advance' && insertedRecords) {
        const advanceRecords = insertedRecords.map(record => ({
          payroll_id: record.id,
          staff_id: record.staff_id,
          amount: parseFloat(advanceAmount) || 0,
          payment_date: paymentDate,
          payment_type: 'advance' as const,
          notes: notes || `Advance payment for ${month} ${year}`,
        }));

        const { error: advanceError } = await supabase
          .from('salary_advances')
          .insert(advanceRecords);

        if (advanceError) throw advanceError;
      }

      return records.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
      queryClient.invalidateQueries({ queryKey: ['pending-balance-records'] });
      queryClient.invalidateQueries({ queryKey: ['recentPayroll'] });
      
      const message = paymentMode === 'advance' 
        ? `Advance of ₹${parseFloat(advanceAmount).toLocaleString()} paid. Balance pending.`
        : paymentMode === 'balance'
        ? `Balance payment of ₹${pendingBalance.toLocaleString()} completed.`
        : `Created ${count} payroll record${count > 1 ? 's' : ''}.`;
      
      toast({ 
        title: 'Salary payment created!',
        description: message
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
    setPaymentMode('full');
    setAdvanceAmount('');
    setNotes('');
  };

  const calculateNetSalary = () => {
    if (paymentMode === 'balance') {
      return pendingBalance;
    }
    if (paymentType === 'bulk') {
      const total = staffMembers.reduce((sum, s) => {
        return sum + s.salary + (parseFloat(bonus) || 0) - (parseFloat(deductions) || 0);
      }, 0);
      return total;
    }
    if (!selectedStaff) return 0;
    return selectedStaff.salary + (parseFloat(bonus) || 0) - (parseFloat(deductions) || 0);
  };

  const netSalary = calculateNetSalary();
  const advanceAmt = parseFloat(advanceAmount) || 0;
  const hasExistingPendingBalance = paymentType === 'individual' && pendingBalance > 0;
  const maxAdvanceAmount = netSalary;
  const remainingAmount = paymentMode === 'advance' ? netSalary - advanceAmt : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
              onClick={() => {
                setPaymentType('individual');
                setPaymentMode('full');
              }}
            >
              <User className="h-4 w-4 mr-2" />
              Individual
            </Button>
            <Button
              type="button"
              variant={paymentType === 'bulk' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => {
                setPaymentType('bulk');
                setPaymentMode('full');
              }}
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

          {/* Payment Mode Selection - Only for individual */}
          {paymentType === 'individual' && selectedStaffId && (
            <div className="space-y-3">
              <Label>Payment Mode</Label>
              <RadioGroup 
                value={paymentMode} 
                onValueChange={(v) => setPaymentMode(v as PaymentMode)}
                className="grid grid-cols-3 gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="full" id="full" />
                  <Label htmlFor="full" className="text-sm font-normal cursor-pointer">
                    Full Payment
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="advance" id="advance" />
                  <Label htmlFor="advance" className="text-sm font-normal cursor-pointer">
                    Advance
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="balance" id="balance" disabled={pendingBalance === 0} />
                  <Label 
                    htmlFor="balance" 
                    className={`text-sm font-normal cursor-pointer ${pendingBalance === 0 ? 'text-muted-foreground' : ''}`}
                  >
                    Pay Balance
                  </Label>
                </div>
              </RadioGroup>
              {pendingBalance > 0 && paymentMode !== 'balance' && (
                <p className="text-xs text-warning">
                  ₹{pendingBalance.toLocaleString()} pending balance from previous advance
                </p>
              )}
            </div>
          )}

          {/* Advance Amount Input */}
          {paymentMode === 'advance' && (
            <div className="space-y-2">
              <Label>Advance Amount (₹)</Label>
              <Input
                type="number"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                min="0"
                max={maxAdvanceAmount}
                placeholder={`Max: ₹${maxAdvanceAmount.toLocaleString()}`}
              />
              {advanceAmt > 0 && advanceAmt <= maxAdvanceAmount && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Wallet className="h-3 w-3" />
                  <span>Paying ₹{advanceAmt.toLocaleString()}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="text-warning">₹{remainingAmount.toLocaleString()} balance pending</span>
                </div>
              )}
            </div>
          )}

          {/* Notes for advance/balance */}
          {(paymentMode === 'advance' || paymentMode === 'balance') && (
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a note for this payment"
              />
            </div>
          )}

          {/* Bonus & Deductions - Hidden for balance payment */}
          {paymentMode !== 'balance' && (
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
          )}

          {/* Mark as Paid - Only for full payment */}
          {paymentMode === 'full' && (
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
          )}

          {/* Summary */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {paymentMode === 'balance' ? 'Pending Balance' : paymentType === 'bulk' ? 'Total Staff' : 'Base Salary'}
              </span>
              <span className="font-medium">
                {paymentMode === 'balance' 
                  ? `₹${pendingBalance.toLocaleString()}`
                  : paymentType === 'bulk' 
                    ? `${staffMembers.length} members`
                    : selectedStaff ? `₹${selectedStaff.salary.toLocaleString()}` : '-'
                }
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Period</span>
              <span className="font-medium">{month} {year}</span>
            </div>
            {paymentMode === 'advance' && advanceAmt > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Advance Now</span>
                  <span className="font-medium text-success">₹{advanceAmt.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Balance Later</span>
                  <span className="font-medium text-warning">₹{remainingAmount.toLocaleString()}</span>
                </div>
              </>
            )}
            <div className="border-t border-border my-2" />
            <div className="flex justify-between">
              <span className="font-medium">
                {paymentMode === 'advance' ? 'Paying Now' : paymentMode === 'balance' ? 'Balance Amount' : 'Net Amount'}
              </span>
              <span className="font-bold text-primary text-lg">
                ₹{(paymentMode === 'advance' ? advanceAmt : netSalary).toLocaleString()}
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
            disabled={
              createPayrollMutation.isPending || 
              (paymentType === 'individual' && !selectedStaffId) ||
              (paymentMode === 'advance' && (advanceAmt <= 0 || advanceAmt > maxAdvanceAmount)) ||
              (paymentMode === 'balance' && pendingBalance === 0)
            }
          >
            {createPayrollMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <IndianRupee className="h-4 w-4 mr-2" />
            )}
            {paymentMode === 'advance' 
              ? 'Pay Advance' 
              : paymentMode === 'balance' 
                ? 'Pay Balance' 
                : markAsPaid ? 'Pay Now' : 'Create Record'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
