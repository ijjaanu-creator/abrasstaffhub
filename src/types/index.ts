export type UserRole = 'admin' | 'staff';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export interface StaffMember {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  joinDate: string;
  salary: number;
  avatar?: string;
  status: 'active' | 'inactive';
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: 'present' | 'absent' | 'late' | 'early_leave' | 'half_day';
  workHours?: number;
  overtime?: number;
  notes?: string;
}

export interface PayrollRecord {
  id: string;
  staffId: string;
  month: string;
  year: number;
  baseSalary: number;
  overtime: number;
  deductions: number;
  bonus: number;
  netSalary: number;
  status: 'pending' | 'processed' | 'paid';
  paymentDate?: string;
}

export interface DashboardStats {
  totalStaff: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  pendingPayroll: number;
  totalPayrollAmount: number;
}
