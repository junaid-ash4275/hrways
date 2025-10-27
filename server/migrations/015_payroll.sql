-- Payroll & Finance schema: salary profiles, payroll runs, payslips

DO $$
BEGIN
  -- salary_profiles: per-employee salary effective from a date
  IF to_regclass('public.salary_profiles') IS NULL THEN
    EXECUTE $sp$
      CREATE TABLE public.salary_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        base NUMERIC(12,2) NOT NULL CHECK (base >= 0),
        allowances NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (allowances >= 0),
        deductions NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
        effective_from DATE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT ux_salary_profile_employee_effective UNIQUE (employee_id, effective_from)
      );
    $sp$;
  END IF;

  -- Helpful indexes
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='i' AND c.relname='idx_salary_profiles_employee' AND n.nspname='public'
  ) THEN
    EXECUTE 'CREATE INDEX idx_salary_profiles_employee ON public.salary_profiles(employee_id, effective_from DESC)';
  END IF;

  -- payroll_runs: one per month
  IF to_regclass('public.payroll_runs') IS NULL THEN
    EXECUTE $pr$
      CREATE TABLE public.payroll_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_month DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','FAILED')),
        created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT ux_payroll_runs_month UNIQUE (run_month)
      );
    $pr$;
  END IF;

  -- payslips: generated per employee per run
  IF to_regclass('public.payslips') IS NULL THEN
    EXECUTE $ps$
      CREATE TABLE public.payslips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
        gross NUMERIC(12,2) NOT NULL,
        net NUMERIC(12,2) NOT NULL,
        breakdown JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT ux_payslips_unique_per_run_employee UNIQUE (payroll_run_id, employee_id)
      );
    $ps$;
  END IF;

  -- Helpful indexes
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='i' AND c.relname='idx_payslips_employee' AND n.nspname='public'
  ) THEN
    EXECUTE 'CREATE INDEX idx_payslips_employee ON public.payslips(employee_id)';
  END IF;
END$$;

