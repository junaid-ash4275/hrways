-- Meetings & Leave schema (create or reconcile) for dashboard KPIs

DO $$
BEGIN
  -- leave_requests: ensure table exists
  IF to_regclass('public.leave_requests') IS NULL THEN
    EXECUTE $lr$
      CREATE TABLE leave_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        date_from DATE NOT NULL,
        date_to DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
        reason TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    $lr$;
  END IF;

  -- Ensure leave_requests.status exists
  IF to_regclass('public.leave_requests') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='leave_requests' AND column_name='status'
    ) THEN
      EXECUTE $lr$ALTER TABLE public.leave_requests ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING'$lr$;
    END IF;
    -- Basic indexes
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relkind='i' AND c.relname='idx_leave_employee' AND n.nspname='public'
    ) THEN
      EXECUTE 'CREATE INDEX idx_leave_employee ON public.leave_requests(employee_id)';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relkind='i' AND c.relname='idx_leave_status' AND n.nspname='public'
    ) THEN
      EXECUTE 'CREATE INDEX idx_leave_status ON public.leave_requests(status)';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relkind='i' AND c.relname='idx_leave_dates' AND n.nspname='public'
    ) THEN
      EXECUTE 'CREATE INDEX idx_leave_dates ON public.leave_requests(date_from, date_to)';
    END IF;
  END IF;

  -- meetings: ensure table exists
  IF to_regclass('public.meetings') IS NULL THEN
    EXECUTE $mt$
      CREATE TABLE meetings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        start_at TIMESTAMPTZ NOT NULL,
        end_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','CANCELLED','DONE')),
        created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    $mt$;
  END IF;

  -- Ensure meetings.status exists
  IF to_regclass('public.meetings') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='meetings' AND column_name='status'
    ) THEN
      EXECUTE $mt$ALTER TABLE public.meetings ADD COLUMN status TEXT NOT NULL DEFAULT 'SCHEDULED'$mt$;
    END IF;
    -- Index on time
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relkind='i' AND c.relname='idx_meetings_time' AND n.nspname='public'
    ) THEN
      EXECUTE 'CREATE INDEX idx_meetings_time ON public.meetings(start_at, end_at)';
    END IF;
  END IF;
END$$;
