-- Attendance records per employee per date (MVP for HRW-ATT-1)
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  clock_in TIMESTAMPTZ NULL,
  clock_out TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'PRESENT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(work_date);
-- Ensure at most one record per employee per date
CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_emp_date ON attendance(employee_id, work_date);
