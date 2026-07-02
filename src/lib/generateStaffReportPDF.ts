import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import abrasLogo from '@/assets/abras-logo.png';
import { recalcNetSalary } from './payrollCalc';

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
// Use "Rs." instead of ₹ because jsPDF's built-in helvetica lacks the rupee glyph
// and renders it as a blank/box.
const fmtINR = (n: number) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;

function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}

function dayName(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

export async function generateStaffReportPDF({ selectedMonth }: Options) {
  const [year, month] = selectedMonth.split('-').map(Number);
  const startDate = `${selectedMonth}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];
  const monthName = new Date(selectedMonth + '-01').toLocaleString('en-US', { month: 'long' });
  const totalDays = daysInMonth(year, month);

  const [staffRes, attRes, payRes, holRes] = await Promise.all([
    supabase.from('staff_members').select('*').order('name'),
    supabase
      .from('attendance_records')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date'),
    supabase.from('payroll_records').select('*').eq('year', year).eq('month', monthName),
    supabase.from('holidays').select('*').gte('date', startDate).lte('date', endDate),
  ]);

  if (staffRes.error) throw staffRes.error;
  if (attRes.error) throw attRes.error;
  if (payRes.error) throw payRes.error;

  const staffList = staffRes.data || [];
  const attendance = attRes.data || [];
  const payroll = payRes.data || [];
  const holidays = (holRes.data || []) as any[];
  const holidayMap = new Map(holidays.map((h: any) => [h.date, h.name || 'Holiday']));

  const logoData = await loadImageAsDataURL(abrasLogo).catch(() => '');

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;

  const drawHeader = (subtitle: string) => {
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', margin, 24, 44, 44);
      } catch {}
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(237, 34, 58);
    doc.text('Abras Natural Spices', margin + 54, 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text('Staff Hub — Monthly Report', margin + 54, 58);
    doc.setFontSize(9);
    doc.text(subtitle, pageW - margin, 44, { align: 'right' });
    doc.setDrawColor(237, 34, 58);
    doc.setLineWidth(0.8);
    doc.line(margin, 78, pageW - margin, 78);
  };

  // Cover
  drawHeader(`Period: ${monthName} ${year}`);
  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Monthly Staff Report', margin, 130);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, margin, 152);
  doc.text(`Total staff included: ${staffList.length}`, margin, 170);

  for (const staff of staffList) {
    doc.addPage();
    drawHeader(`${staff.name || 'Unknown'} — ${monthName} ${year}`);

    const isResigned = staff.status && staff.status !== 'active';

    // Staff info block (wrapped)
    let y = 96;
    doc.setTextColor(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const nameLines = doc.splitTextToSize(staff.name || 'Unknown', contentW);
    doc.text(nameLines, margin, y);
    y += nameLines.length * 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90);
    const metaLine = `${staff.employee_id || '-'}  •  ${staff.position || '-'}  •  ${staff.department || '-'}`;
    const metaLines = doc.splitTextToSize(metaLine, contentW);
    doc.text(metaLines, margin, y);
    y += metaLines.length * 12 + 2;

    const contactLines = doc.splitTextToSize(
      `Phone: ${staff.phone || '-'}    Email: ${staff.email || '-'}`,
      contentW,
    );
    doc.text(contactLines, margin, y);
    y += contactLines.length * 12;

    doc.text(`Joined: ${fmtDate(staff.join_date)}`, margin, y);
    y += 12;
    if (isResigned) {
      doc.setTextColor(200, 0, 0);
      doc.text(
        `Status: ${staff.status}   Resigned/Updated: ${fmtDate(staff.updated_at)}`,
        margin,
        y,
      );
      doc.setTextColor(90);
    } else {
      doc.text('Status: Active', margin, y);
    }
    y += 16;

    // Build full-month attendance (every day)
    const staffAttMap = new Map<string, any>();
    attendance
      .filter((a: any) => a.staff_id === staff.id)
      .forEach((a: any) => staffAttMap.set(a.date, a));

    const rows: any[] = [];
    let presentC = 0, absentC = 0, lateC = 0, holidayC = 0, sundayC = 0;
    let totalHrs = 0, totalOt = 0;

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      const rec = staffAttMap.get(dateStr);
      const dow = new Date(dateStr + 'T00:00:00').getDay();
      const isSunday = dow === 0;
      const isHoliday = holidayMap.has(dateStr);

      let status = rec?.status || (isHoliday ? 'holiday' : isSunday ? 'sunday' : 'absent');
      const workHours = Number(rec?.work_hours || 0);
      const ot = Number(rec?.overtime || 0);
      totalHrs += workHours;
      totalOt += ot;

      if (status === 'present') presentC++;
      else if (status === 'absent') absentC++;
      else if (status === 'late') lateC++;
      else if (status === 'holiday') holidayC++;
      else if (status === 'sunday') sundayC++;

      rows.push([
        String(d).padStart(2, '0'),
        dayName(dateStr),
        fmtTime(rec?.check_in),
        fmtTime(rec?.check_out),
        workHours ? workHours.toFixed(1) : '-',
        ot ? ot.toFixed(1) : '-',
        status.toUpperCase(),
      ]);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text('Daily Attendance', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y + 4,
      head: [['Day', 'DoW', 'Check In', 'Check Out', 'Hours', 'OT', 'Status']],
      body: rows,
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [237, 34, 58], textColor: 255, fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 245, 246] },
      columnStyles: {
        0: { cellWidth: 32, halign: 'center' },
        1: { cellWidth: 36, halign: 'center' },
        2: { cellWidth: 60, halign: 'center' },
        3: { cellWidth: 60, halign: 'center' },
        4: { cellWidth: 45, halign: 'right' },
        5: { cellWidth: 40, halign: 'right' },
        6: { cellWidth: 'auto', halign: 'center' },
      },
      margin: { left: margin, right: margin, bottom: 90 },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const s = String(data.cell.raw || '').toLowerCase();
          if (s.includes('absent')) doc.setTextColor(200, 0, 0);
        }
      },
    });

    let sy = (doc as any).lastAutoTable.finalY + 12;

    const ensureSpace = (need: number) => {
      if (sy + need > pageH - 90) {
        doc.addPage();
        drawHeader(`${staff.name || ''} — ${monthName} ${year} (cont.)`);
        sy = 96;
      }
    };

    ensureSpace(40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60);
    const summary = `Present: ${presentC}   Absent: ${absentC}   Late: ${lateC}   Holiday: ${holidayC}   Sunday: ${sundayC}   Total Hours: ${totalHrs.toFixed(1)}   OT: ${totalOt.toFixed(1)}h`;
    const sumLines = doc.splitTextToSize(summary, contentW);
    doc.text(sumLines, margin, sy);
    sy += sumLines.length * 12 + 10;

    // Payroll block
    const pay = payroll.find((p: any) => p.staff_id === staff.id);
    const baseSalary = Number(staff.salary || 0);
    const netSalary = pay ? Number(pay.net_salary || 0) : baseSalary;
    const paidAmount =
      pay && (pay.status === 'paid' || pay.status === 'processed')
        ? netSalary - Number(pay.remaining_amount || 0)
        : Number(pay?.advance_amount || 0);
    const remaining = pay
      ? Number(pay.remaining_amount ?? Math.max(0, netSalary - paidAmount))
      : netSalary;

    ensureSpace(230);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text('Salary & Payment', margin, sy);

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
      styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [237, 34, 58], textColor: 255 },
      columnStyles: {
        0: { cellWidth: contentW * 0.55 },
        1: { cellWidth: contentW * 0.45, halign: 'right' },
      },
      margin: { left: margin, right: margin, bottom: 90 },
    });
  }

  // Footer: page numbers + signature lines on every page (except cover if desired — keep on cover too)
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = pageH - 60;

    // Signature blocks
    doc.setDrawColor(120);
    doc.setLineWidth(0.5);
    const sigW = (contentW - 40) / 2;
    doc.line(margin, footerY, margin + sigW, footerY);
    doc.line(pageW - margin - sigW, footerY, pageW - margin, footerY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text('Staff Signature', margin, footerY + 12);
    doc.text('Authorised Signatory', pageW - margin, footerY + 12, { align: 'right' });

    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Abras Staff Hub  •  Page ${i} of ${pageCount}`,
      pageW / 2,
      pageH - 20,
      { align: 'center' },
    );
  }

  doc.save(`abras_staff_report_${selectedMonth}.pdf`);
}
