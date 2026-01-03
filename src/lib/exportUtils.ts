// Export data to CSV
export function exportToCSV(data: Record<string, any>[], filename: string) {
  if (data.length === 0) {
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Format attendance data for export
export function formatAttendanceForExport(records: any[]) {
  return records.map(record => ({
    'Employee Name': record.staff_members?.name || 'Unknown',
    'Employee ID': record.staff_members?.employee_id || '',
    'Position': record.staff_members?.position || '',
    'Department': record.staff_members?.department || '',
    'Date': record.date,
    'Check In': record.check_in || '',
    'Check Out': record.check_out || '',
    'Work Hours': record.work_hours ? Number(record.work_hours).toFixed(1) : '0',
    'Overtime': record.overtime ? Number(record.overtime).toFixed(1) : '0',
    'Status': record.status,
    'Notes': record.notes || '',
  }));
}

// Format payroll data for export
export function formatPayrollForExport(records: any[]) {
  return records.map(record => ({
    'Employee Name': record.staff_members?.name || 'Unknown',
    'Employee ID': record.staff_members?.employee_id || '',
    'Position': record.staff_members?.position || '',
    'Period': `${record.month} ${record.year}`,
    'Base Salary (₹)': record.base_salary || 0,
    'Overtime (₹)': record.overtime || 0,
    'Deductions (₹)': record.deductions || 0,
    'Bonus (₹)': record.bonus || 0,
    'Net Salary (₹)': record.net_salary || 0,
    'Status': record.status,
    'Payment Date': record.payment_date || '',
  }));
}
