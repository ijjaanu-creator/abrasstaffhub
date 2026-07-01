import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import abrasLogo from '@/assets/abras-logo.png';

interface Options {
  selectedMonth: string; // 'YYYY-MM'
}

async function loadImageAsDataURL(src: string): Promise<string> {
  const res = await fetch(src);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const fmtTime = (t?: string | null) => (t ? String(t).slice(0, 5) : '-');
const fmtINR = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export async function generateStaffReportPDF({ selectedMonth }: Options) {
  const [year, month] = selectedMonth.split('-').map(Number);
  const startDate = `${selectedMonth}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];
  const monthName = new Date(selectedMonth + '-01').toLocaleString('en-US', { month: 'long' });

  const [staffRes, attRes, payRes] = await Promise.all([
    supabase.from('staff_members').select('*').order('name'),
    supabase
      .from('attendance_records')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date'),
    supabase.from('payroll_records').select('*').eq('year', year).eq('month', monthName),
  ]);

  if (staffRes.error) throw staffRes.error;
  if (attRes.error) throw attRes.error;
  if (payRes.error) throw payRes.error;

  const staffList = staffRes.data || [];
  const attendance = attRes.data || [];
  const payroll = payRes.data || [];

  const logoData = await loadImageAsDataURL(abrasLogo).catch(() => '');

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  const drawHeader = (subtitle: string) => {
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', margin, 30, 48, 48);
      } catch {}
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(237, 34, 58);
    doc.text('Abras Natural Spices', margin + 60, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text('Staff Hub — Monthly Report', margin + 60, 66);
    doc.setFontSize(9);
    doc.text(subtitle, pageW - margin, 50, { align: 'right' });
    doc.setDrawColor(237, 34, 58);
    doc.setLineWidth(1);
    doc.line(margin, 90, pageW - margin, 90);
  };

  // Cover
  drawHeader(`Period: ${monthName} ${year}`);
  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Monthly Staff Report', margin, 140);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(
    `Generated on ${new Date().toLocaleString('en-IN')}`,
    margin,
    162,
  );
  doc.text(`Total staff included: ${staffList.length}`, margin, 180);

  for (const staff of staffList) {
    doc.addPage();
    drawHeader(`Period: ${monthName} ${year}`);

    const isResigned = staff.status && staff.status !== 'active';

    // Staff info block
    let y = 110;
    doc.setTextColor(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(staff.name || 'Unknown', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90);
    y += 16;
    doc.text(
      `${staff.employee_id || '-'}  •  ${staff.position || '-'}  •  ${staff.department || '-'}`,
      margin,
      y,
    );
    y += 14;
    doc.text(`Phone: ${staff.phone || '-'}    Email: ${staff.email || '-'}`, margin, y);
    y += 14;
    doc.text(`Joined: ${fmtDate(staff.join_date)}`, margin, y);
    if (isResigned) {
      y += 14;
      doc.setTextColor(200, 0, 0);
      doc.text(
        `Status: ${staff.status}   Resigned/Updated: ${fmtDate(staff.updated_at)}`,
        margin,
        y,
      );
      doc.setTextColor(90);
    } else {
      y += 14;
      doc.text(`Status: Active`, margin, y);
    }

    // Attendance table
    const staffAtt = attendance
      .filter((a: any) => a.staff_id === staff.id)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text('Attendance', margin, y);

    autoTable(doc, {
      startY: y + 6,
      head: [['Date', 'Check In', 'Check Out', 'Hours', 'OT', 'Status']],
      body:
        staffAtt.length > 0
          ? staffAtt.map((a: any) => [
              fmtDate(a.date),
              fmtTime(a.check_in),
              fmtTime(a.check_out),
              Number(a.work_hours || 0).toFixed(1),
              Number(a.overtime || 0).toFixed(1),
              (a.status || '').toString().toUpperCase(),
            ])
          : [['-', '-', '-', '-', '-', 'No records']],
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [237, 34, 58], textColor: 255 },
      alternateRowStyles: { fillColor: [250, 245, 246] },
      margin: { left: margin, right: margin },
    });

    // Attendance summary
    const summary = {
      present: staffAtt.filter((a: any) => a.status === 'present').length,
      absent: staffAtt.filter((a: any) => a.status === 'absent').length,
      late: staffAtt.filter((a: any) => a.status === 'late').length,
      holiday: staffAtt.filter((a: any) => a.status === 'holiday').length,
      hours: staffAtt.reduce((s: number, a: any) => s + Number(a.work_hours || 0), 0),
      ot: staffAtt.reduce((s: number, a: any) => s + Number(a.overtime || 0), 0),
    };

    let sy = (doc as any).lastAutoTable.finalY + 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(
      `Present: ${summary.present}   Absent: ${summary.absent}   Late: ${summary.late}   Holiday: ${summary.holiday}   Total Hours: ${summary.hours.toFixed(1)}   OT: ${summary.ot.toFixed(1)}h`,
      margin,
      sy,
    );

    // Payroll block
    const pay = payroll.find((p: any) => p.staff_id === staff.id);
    sy += 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text('Salary & Payment', margin, sy);

    const baseSalary = Number(staff.salary || 0);
    const netSalary = pay ? Number(pay.net_salary || 0) : baseSalary;
    const paidAmount =
      pay && (pay.status === 'paid' || pay.status === 'processed')
        ? netSalary - Number(pay.remaining_amount || 0)
        : Number(pay?.advance_amount || 0);
    const remaining = pay ? Number(pay.remaining_amount ?? Math.max(0, netSalary - paidAmount)) : netSalary;

    autoTable(doc, {
      startY: sy + 6,
      head: [['Item', 'Amount']],
      body: [
        ['Original Salary', fmtINR(baseSalary)],
        ['Bonus', fmtINR(Number(pay?.bonus || 0))],
        ['Overtime Pay', fmtINR(Number(pay?.overtime || 0))],
        ['Deductions', fmtINR(Number(pay?.deductions || 0))],
        ['Net Salary (Payable)', fmtINR(netSalary)],
        ['Advance Paid', fmtINR(Number(pay?.advance_amount || 0))],
        ['Amount Paid', fmtINR(paidAmount)],
        ['Remaining To Pay', fmtINR(remaining)],
        ['Payment Status', (pay?.status || 'not generated').toUpperCase()],
        ['Payment Date', fmtDate(pay?.payment_date)],
      ],
      styles: { fontSize: 10, cellPadding: 5 },
      headStyles: { fillColor: [237, 34, 58], textColor: 255 },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: margin, right: margin },
    });
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Abras Staff Hub  •  Page ${i} of ${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'center' },
    );
  }

  doc.save(`abras_staff_report_${selectedMonth}.pdf`);
}
