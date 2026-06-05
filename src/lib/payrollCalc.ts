// Salary calculation helpers: holidays + Sundays are paid; only absent days deducted.

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function getMonthIndex(month: string): number {
  return MONTH_NAMES.findIndex(m => m.toLowerCase() === String(month).toLowerCase());
}

export function getWorkingDaysInMonth(year: number, monthIndex: number, holidayDates: Set<string>): number {
  if (monthIndex < 0) return 1;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  let nonWorking = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, monthIndex, d);
    const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (date.getDay() === 0 || holidayDates.has(ds)) nonWorking++;
  }
  return Math.max(1, daysInMonth - nonWorking);
}

export function computeAbsenceDeduction(
  baseSalary: number,
  workingDays: number,
  absentDays: number,
): number {
  if (!baseSalary || !workingDays) return 0;
  return Math.round((baseSalary / workingDays) * absentDays);
}

export interface RecalcArgs {
  baseSalary: number;
  bonus: number;
  deductions: number; // already-stored manual deductions (may include absence for new records)
  storedNet: number;
  year: number;
  month: string;
  absentDays: number;
  holidayDates: Set<string>;
}

// Returns recalculated net = base + bonus - manualDeductions - absenceDeduction.
// Treats stored `deductions` as manual-only when storedNet doesn't already reflect absence.
export function recalcNetSalary(args: RecalcArgs): { net: number; absenceDeduction: number; workingDays: number } {
  const monthIndex = getMonthIndex(args.month);
  const workingDays = getWorkingDaysInMonth(args.year, monthIndex, args.holidayDates);
  const absenceDeduction = computeAbsenceDeduction(args.baseSalary, workingDays, args.absentDays);
  const expectedStoredNet = args.baseSalary + args.bonus - args.deductions;
  // If the stored record already accounts for absence (deductions includes it), use stored net.
  // Detect: stored net roughly matches base + bonus - storedDeductions (manual only path).
  const usesManualOnly = Math.abs(expectedStoredNet - args.storedNet) < 1;
  const net = usesManualOnly
    ? args.baseSalary + args.bonus - args.deductions - absenceDeduction
    : args.storedNet;
  return { net, absenceDeduction, workingDays };
}
