-- Reconcile existing payroll tables with new columns and constraints

DO $$
BEGIN
  -- Ensure payroll_runs.created_by exists
  IF to_regclass('public.payroll_runs') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='payroll_runs' AND column_name='created_by'
    ) THEN
      EXECUTE 'ALTER TABLE public.payroll_runs ADD COLUMN created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL';
    END IF;
    -- Ensure status column exists and has expected CHECK
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='payroll_runs' AND column_name='status'
    ) THEN
      EXECUTE 'ALTER TABLE public.payroll_runs ADD COLUMN status TEXT NOT NULL DEFAULT ''PENDING''';
    END IF;
  END IF;
END$$;

