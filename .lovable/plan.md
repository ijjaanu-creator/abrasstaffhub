

## Holiday & Weekend Handling

### What You Want
- **Sunday** = weekend (holiday)
- **Festival days** (Eid, Onam, etc.) = holidays — admin can manage these
- If staff **comes** on a holiday → mark as **present** (no extra bonus)
- If staff **doesn't come** on a holiday → mark as **holiday** (no salary deduction)

### Changes Required

#### 1. New `holidays` Database Table
Create a table for admin-managed holidays (festivals, special days):
- `id`, `date`, `name`, `created_at`
- RLS: admins can manage, all authenticated users can view

#### 2. Update `mark_absent_for_date` Function
Modify the nightly cron function so that:
- If the date is a **Sunday** or exists in the `holidays` table → insert status `'holiday'` instead of `'absent'`
- If the date is a regular working day → keep inserting `'absent'` as before

#### 3. Backfill Historical Data
Run a one-time update to change existing `absent` records on Sundays and holiday dates to `holiday`.

#### 4. Holiday Management UI in Settings
Add a section in the Settings page for admins to:
- Add a holiday (date + name, e.g. "Eid al-Fitr", "Onam")
- View and delete existing holidays

#### 5. Update Salary Calculations
In `StaffDetailsDialog.tsx` (payment tab), the current logic deducts salary for absent days. Changes:
- **Holiday days** should NOT count as absent — no salary deduction
- **Present on holidays** should count as normal present — no extra bonus
- Update `absentDays` filter to exclude `'holiday'` status
- Currently uses hardcoded `workingDaysInMonth = 26` — update to dynamically calculate: total days in month minus Sundays minus holidays

#### 6. Update Status Config Across UI
Add `'holiday'` status to the status config objects in:
- `Attendance.tsx` — icon, label, styling
- `AttendanceOverview.tsx` — icon, label, styling
- `Reports.tsx` — include in analytics
- `MyAttendance.tsx` — display styling
- `StaffAttendanceHistory.tsx` — new tab/category

#### 7. MarkAttendance Page
No changes needed — staff can still check in on Sundays/holidays and get marked as `present`. The holiday logic only applies to the auto-absent system.

### Technical Details

**New table schema:**
```sql
CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Updated cron function logic (pseudocode):**
```sql
-- Check if _date is Sunday or in holidays table
IF (EXTRACT(DOW FROM _date) = 0) OR EXISTS (SELECT 1 FROM holidays WHERE date = _date) THEN
  INSERT ... status = 'holiday'
ELSE
  INSERT ... status = 'absent'
END IF;
```

**Salary calculation fix:**
```typescript
const holidayDays = attendanceRecords.filter(r => r.status === 'holiday').length;
const absentDays = attendanceRecords.filter(r => r.status === 'absent').length;
// Holidays don't get deducted; only true absences do
const absentDeduction = absentDays * dailyRate;
// Working days = total days - sundays - holidays (dynamic)
```

