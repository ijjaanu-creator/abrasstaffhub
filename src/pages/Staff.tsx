import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Plus,
  MoreVertical,
  Mail,
  Phone,
  Building2,
  Calendar,
  IndianRupee,
  Loader2,
  X,
  Clock,
  MapPin,
  Navigation,
  Cake,
  Home,
  Trash2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Staff() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    salary: '',
    employee_id: '',
    shift_start: '09:00',
    shift_end: '17:00',
    track_location: false,
    date_of_birth: '',
    address: '',
  });

  // Location dialog state
  const [selectedStaffForLocation, setSelectedStaffForLocation] = useState<any>(null);

  const { data: staffMembers = [], isLoading } = useQuery({
    queryKey: ['staff-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const addStaffMutation = useMutation({
    mutationFn: async (staffData: typeof formData) => {
      const { error } = await supabase.from('staff_members').insert({
        name: staffData.name,
        email: staffData.email || null,
        phone: staffData.phone,
        department: staffData.department,
        position: staffData.position,
        salary: parseFloat(staffData.salary) || 0,
        employee_id: staffData.employee_id,
        shift_start: staffData.shift_start,
        shift_end: staffData.shift_end,
        track_location: staffData.track_location,
        date_of_birth: staffData.date_of_birth || null,
        address: staffData.address || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
      toast({ title: 'Staff added successfully' });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: 'Error adding staff', description: error.message, variant: 'destructive' });
    },
  });

  const updateStaffMutation = useMutation({
    mutationFn: async ({ id, ...staffData }: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from('staff_members')
        .update({
          name: staffData.name,
          email: staffData.email || null,
          phone: staffData.phone,
          department: staffData.department,
          position: staffData.position,
          salary: parseFloat(staffData.salary) || 0,
          employee_id: staffData.employee_id,
          shift_start: staffData.shift_start,
          shift_end: staffData.shift_end,
          track_location: staffData.track_location,
          date_of_birth: staffData.date_of_birth || null,
          address: staffData.address || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
      toast({ title: 'Staff updated successfully' });
      setEditingStaff(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: 'Error updating staff', description: error.message, variant: 'destructive' });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('staff_members')
        .update({ status: status === 'active' ? 'inactive' : 'active' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
      toast({ title: 'Staff status updated' });
    },
  });

  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('staff_members')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
      toast({ title: 'Staff member removed successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error removing staff', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      department: '',
      position: '',
      salary: '',
      employee_id: '',
      shift_start: '09:00',
      shift_end: '17:00',
      track_location: false,
      date_of_birth: '',
      address: '',
    });
  };

  const handleEdit = (staff: any) => {
    setFormData({
      name: staff.name,
      email: staff.email || '',
      phone: staff.phone,
      department: staff.department,
      position: staff.position,
      salary: staff.salary.toString(),
      employee_id: staff.employee_id,
      shift_start: staff.shift_start?.slice(0, 5) || '09:00',
      shift_end: staff.shift_end?.slice(0, 5) || '17:00',
      track_location: staff.track_location || false,
      date_of_birth: staff.date_of_birth || '',
      address: staff.address || '',
    });
    setEditingStaff(staff);
  };

  // Fetch latest location for selected staff
  const { data: staffLocation } = useQuery({
    queryKey: ['staff-location', selectedStaffForLocation?.id],
    queryFn: async () => {
      if (!selectedStaffForLocation?.id) return null;
      const { data, error } = await supabase
        .from('executive_locations')
        .select('*')
        .eq('staff_id', selectedStaffForLocation.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStaffForLocation?.id,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStaff) {
      updateStaffMutation.mutate({ ...formData, id: editingStaff.id });
    } else {
      addStaffMutation.mutate(formData);
    }
  };

  const filteredStaff = staffMembers.filter(
    (staff: any) =>
      staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employee_id">Employee ID *</Label>
          <Input
            id="employee_id"
            name="employee_id"
            value={formData.employee_id}
            onChange={(e) => setFormData((prev) => ({ ...prev, employee_id: e.target.value }))}
            placeholder="EMP001"
            required
            autoComplete="off"
            autoCorrect="off"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            autoComplete="off"
            autoCorrect="off"
            inputMode="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            value={formData.phone}
            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="9852553399"
            required
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="department">Department *</Label>
          <Select
            value={formData.department}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, department: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept: any) => (
                <SelectItem key={dept.id} value={dept.name}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="position">Position *</Label>
          <Input
            id="position"
            name="position"
            value={formData.position}
            onChange={(e) => setFormData((prev) => ({ ...prev, position: e.target.value }))}
            required
            autoComplete="off"
            autoCorrect="off"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="salary">Monthly Salary (₹) *</Label>
        <Input
          id="salary"
          name="salary"
          type="number"
          inputMode="numeric"
          value={formData.salary}
          onChange={(e) => setFormData((prev) => ({ ...prev, salary: e.target.value }))}
          required
          autoComplete="off"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date_of_birth">Date of Birth</Label>
          <Input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            value={formData.date_of_birth}
            onChange={(e) => setFormData((prev) => ({ ...prev, date_of_birth: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            name="address"
            value={formData.address}
            onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="Enter address"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="shift_start">Shift Start Time *</Label>
          <Input
            id="shift_start"
            name="shift_start"
            type="time"
            value={formData.shift_start}
            onChange={(e) => setFormData((prev) => ({ ...prev, shift_start: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shift_end">Shift End Time *</Label>
          <Input
            id="shift_end"
            name="shift_end"
            type="time"
            value={formData.shift_end}
            onChange={(e) => setFormData((prev) => ({ ...prev, shift_end: e.target.value }))}
            required
          />
        </div>
      </div>

      {/* Location Tracking Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="track_location" className="text-base font-medium">Track Location</Label>
          <p className="text-sm text-muted-foreground">
            Enable live GPS tracking when this staff checks in
          </p>
        </div>
        <Switch
          id="track_location"
          checked={formData.track_location}
          onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, track_location: checked }))}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setIsAddDialogOpen(false);
            setEditingStaff(null);
            resetForm();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={addStaffMutation.isPending || updateStaffMutation.isPending}>
          {(addStaffMutation.isPending || updateStaffMutation.isPending) && (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          {editingStaff ? 'Update Staff' : 'Add Staff'}
        </Button>
      </div>
    </form>
  );

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
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">Staff Directory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your team members and their information
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="default" size="lg" className="w-full sm:w-auto">
              <Plus className="h-5 w-5 mr-2" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Staff Member</DialogTitle>
            </DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>

      {/* Search */}
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

      {/* Location Tracking Dialog */}
      <Dialog open={!!selectedStaffForLocation} onOpenChange={(open) => !open && setSelectedStaffForLocation(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" />
              Live Location - {selectedStaffForLocation?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {staffLocation ? (
              <>
                <div className="relative h-64 rounded-lg overflow-hidden border bg-muted">
                  <iframe
                    title="Staff location map"
                    className="absolute inset-0 h-full w-full border-0"
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${staffLocation.latitude},${staffLocation.longitude}&z=15&output=embed`}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Last updated: {new Date(staffLocation.recorded_at).toLocaleString()}
                  </span>
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${staffLocation.latitude},${staffLocation.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin className="h-4 w-4" />
                      Open in Maps
                    </a>
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MapPin className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No location data available yet.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Location will appear when staff checks in.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Staff Grid */}
      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredStaff.map((staff: any, index: number) => (
          <div
            key={staff.id}
            className={cn(
              "group relative rounded-xl border border-border bg-card p-4 lg:p-6 shadow-elegant transition-all duration-300 hover:shadow-lg hover:border-primary/20 animate-fade-in",
              staff.track_location && "cursor-pointer"
            )}
            style={{ animationDelay: `${(index + 2) * 50}ms` }}
            onClick={() => staff.track_location && setSelectedStaffForLocation(staff)}
          >
            {/* Status Badge & Tracking Badge */}
            <div className="absolute right-3 top-3 lg:right-4 lg:top-4 flex items-center gap-2">
              {staff.track_location && (
                <div className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  GPS
                </div>
              )}
              <div
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  staff.status === 'active'
                    ? 'bg-success/10 text-success'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {staff.status}
              </div>
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-10 top-2 lg:right-12 lg:top-3 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(staff)}>
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => toggleStatusMutation.mutate({ id: staff.id, status: staff.status })}
                  className={staff.status === 'active' ? 'text-destructive' : 'text-success'}
                >
                  {staff.status === 'active' ? 'Deactivate' : 'Activate'}
                </DropdownMenuItem>
                {staff.status === 'inactive' && (
                  <DropdownMenuItem 
                    onClick={() => {
                      if (confirm(`Are you sure you want to permanently remove ${staff.name}? This action cannot be undone.`)) {
                        deleteStaffMutation.mutate(staff.id);
                      }
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Permanently
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Avatar & Basic Info */}
            <div className="flex items-start gap-3 lg:gap-4 mb-4">
              <div className="flex h-12 w-12 lg:h-14 lg:w-14 items-center justify-center rounded-xl gradient-primary text-primary-foreground font-display text-lg lg:text-xl font-bold">
                {staff.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{staff.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{staff.position}</p>
                <p className="text-xs text-primary font-medium">{staff.employee_id}</p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2">
              {staff.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{staff.email}</span>
                </div>
              )}
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
                <span>Joined {new Date(staff.join_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span>Shift: {staff.shift_start?.slice(0, 5) || '09:00'} - {staff.shift_end?.slice(0, 5) || '17:00'}</span>
              </div>
            </div>

            {/* Salary */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IndianRupee className="h-4 w-4" />
                  <span>Monthly Salary</span>
                </div>
                <span className="font-semibold text-foreground">
                  ₹{staff.salary.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredStaff.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {staffMembers.length === 0
              ? 'No staff members yet. Add your first staff member to get started.'
              : 'No staff members found matching your search.'}
          </p>
        </div>
      )}
    </div>
  );
}
