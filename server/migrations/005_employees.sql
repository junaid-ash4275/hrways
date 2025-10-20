-- Employees table for HRW-EMP-1: Create employee
-- Also reconcile legacy typos/columns if present (enployees/code -> employees/employee_code)

DO $$
BEGIN
  -- If a misspelled table 'enployees' exists and 'employees' does not, rename it
  IF to_regclass('public.enployees') IS NOT NULL AND to_regclass('public.employees') IS NULL THEN
    EXECUTE 'ALTER TABLE public.enployees RENAME TO employees';
  END IF;

  -- If the canonical table exists, ensure expected columns exist/are named correctly
  IF to_regclass('public.employees') IS NOT NULL THEN
    -- Rename 'code' -> 'employee_code' if present
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'code'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'employee_code'
    ) THEN
      EXECUTE 'ALTER TABLE public.employees RENAME COLUMN code TO employee_code';
    END IF;

    -- Add missing columns (safe no-ops if already present)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='id') THEN
      EXECUTE 'ALTER TABLE public.employees ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid()';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='employee_code') THEN
      EXECUTE 'ALTER TABLE public.employees ADD COLUMN employee_code TEXT NOT NULL';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='name') THEN
      EXECUTE 'ALTER TABLE public.employees ADD COLUMN name TEXT NOT NULL DEFAULT ''''';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='email') THEN
      EXECUTE 'ALTER TABLE public.employees ADD COLUMN email TEXT NOT NULL DEFAULT ''''';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='phone') THEN
      EXECUTE 'ALTER TABLE public.employees ADD COLUMN phone TEXT NULL';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='department') THEN
      EXECUTE 'ALTER TABLE public.employees ADD COLUMN department TEXT NULL';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='title') THEN
      EXECUTE 'ALTER TABLE public.employees ADD COLUMN title TEXT NULL';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='status') THEN
      EXECUTE 'ALTER TABLE public.employees ADD COLUMN status TEXT NOT NULL DEFAULT ''ACTIVE''';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='join_date') THEN
      EXECUTE 'ALTER TABLE public.employees ADD COLUMN join_date DATE NULL';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='created_at') THEN
      EXECUTE 'ALTER TABLE public.employees ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now()';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='updated_at') THEN
      EXECUTE 'ALTER TABLE public.employees ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now()';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='birth_date') THEN
      EXECUTE 'ALTER TABLE public.employees ADD COLUMN birth_date DATE NULL';
    END IF;

    -- Ensure reasonable constraints
    -- Unique on employee_code
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.employees'::regclass AND conname = 'employees_employee_code_key'
    ) THEN
      BEGIN
        EXECUTE 'ALTER TABLE public.employees ADD CONSTRAINT employees_employee_code_key UNIQUE (employee_code)';
      EXCEPTION WHEN duplicate_object THEN
        -- ignore
      END;
    END IF;
    -- Unique on email
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.employees'::regclass AND conname = 'employees_email_key'
    ) THEN
      BEGIN
        EXECUTE 'ALTER TABLE public.employees ADD CONSTRAINT employees_email_key UNIQUE (email)';
      EXCEPTION WHEN duplicate_object THEN
      END;
    END IF;
    -- Status check
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.employees'::regclass AND conname = 'employees_status_check'
    ) THEN
      BEGIN
        EXECUTE 'ALTER TABLE public.employees ADD CONSTRAINT employees_status_check CHECK (status IN (''ACTIVE'',''INACTIVE''))';
      EXCEPTION WHEN duplicate_object THEN
      END;
    END IF;
  END IF;
END$$;

-- Create the table if it doesn't exist (for fresh databases)
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NULL,
  department TEXT NULL,
  title TEXT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  join_date DATE NULL,
  birth_date DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
