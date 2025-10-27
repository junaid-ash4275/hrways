-- Ensure unique constraints used by ON CONFLICT exist on legacy databases

DO $$
BEGIN
  -- payslips: unique (payroll_run_id, employee_id)
  IF to_regclass('public.payslips') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
        FROM pg_constraint
       WHERE conrelid = 'public.payslips'::regclass
         AND contype = 'u'
         AND conname = 'ux_payslips_unique_per_run_employee'
    ) THEN
      BEGIN
        EXECUTE 'ALTER TABLE public.payslips ADD CONSTRAINT ux_payslips_unique_per_run_employee UNIQUE (payroll_run_id, employee_id)';
      EXCEPTION WHEN duplicate_object THEN
        -- An equivalent unique index/constraint likely exists under a different name; ignore
      END;
    END IF;
  END IF;

  -- salary_profiles: unique (employee_id, effective_from)
  IF to_regclass('public.salary_profiles') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
        FROM pg_constraint
       WHERE conrelid = 'public.salary_profiles'::regclass
         AND contype = 'u'
         AND conname = 'ux_salary_profile_employee_effective'
    ) THEN
      BEGIN
        EXECUTE 'ALTER TABLE public.salary_profiles ADD CONSTRAINT ux_salary_profile_employee_effective UNIQUE (employee_id, effective_from)';
      EXCEPTION WHEN duplicate_object THEN
      END;
    END IF;
  END IF;
END$$;

