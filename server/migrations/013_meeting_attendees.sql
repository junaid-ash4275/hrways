-- Meeting attendees table to support employees, internal users, and external contacts

DO $$
BEGIN
  IF to_regclass('public.meeting_attendees') IS NULL THEN
    EXECUTE $sql$
      CREATE TABLE meeting_attendees (
        meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        attendee_user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,
        attendee_employee_id UUID NULL REFERENCES employees(id) ON DELETE CASCADE,
        external_name TEXT NULL,
        external_email TEXT NULL,
        external_phone TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT meeting_attendee_oneof_chk CHECK (
          attendee_user_id IS NOT NULL OR attendee_employee_id IS NOT NULL OR external_email IS NOT NULL OR external_name IS NOT NULL OR external_phone IS NOT NULL
        )
      );
    $sql$;
  END IF;

  -- If table exists but lacks external/contact columns, add them
  IF to_regclass('public.meeting_attendees') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='meeting_attendees' AND column_name='external_email'
    ) THEN
      EXECUTE 'ALTER TABLE public.meeting_attendees ADD COLUMN external_email TEXT NULL';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='meeting_attendees' AND column_name='external_name'
    ) THEN
      EXECUTE 'ALTER TABLE public.meeting_attendees ADD COLUMN external_name TEXT NULL';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='meeting_attendees' AND column_name='external_phone'
    ) THEN
      EXECUTE 'ALTER TABLE public.meeting_attendees ADD COLUMN external_phone TEXT NULL';
    END IF;

    -- Drop legacy constraints and ensure relaxed one-of check exists
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      WHERE tc.table_schema='public' AND tc.table_name='meeting_attendees'
        AND tc.constraint_type='CHECK' AND tc.constraint_name='one_attendee'
    ) THEN
      EXECUTE 'ALTER TABLE public.meeting_attendees DROP CONSTRAINT one_attendee';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      WHERE tc.table_schema='public' AND tc.table_name='meeting_attendees'
        AND tc.constraint_type='CHECK' AND tc.constraint_name='meeting_attendee_oneof_chk'
    ) THEN
      EXECUTE 'ALTER TABLE public.meeting_attendees DROP CONSTRAINT meeting_attendee_oneof_chk';
    END IF;

    EXECUTE 'ALTER TABLE public.meeting_attendees ADD CONSTRAINT meeting_attendee_oneof_chk CHECK (
      attendee_user_id IS NOT NULL OR attendee_employee_id IS NOT NULL OR external_email IS NOT NULL OR external_name IS NOT NULL OR external_phone IS NOT NULL
    )';
  END IF;

  -- Indexes for uniqueness across attendee types
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='i' AND c.relname='ux_meet_att_user' AND n.nspname='public'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX ux_meet_att_user ON public.meeting_attendees(meeting_id, attendee_user_id) WHERE attendee_user_id IS NOT NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='i' AND c.relname='ux_meet_att_emp' AND n.nspname='public'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX ux_meet_att_emp ON public.meeting_attendees(meeting_id, attendee_employee_id) WHERE attendee_employee_id IS NOT NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='i' AND c.relname='ux_meet_att_ext' AND n.nspname='public'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX ux_meet_att_ext ON public.meeting_attendees(meeting_id, lower(external_email)) WHERE external_email IS NOT NULL';
  END IF;

  -- Helpful index for meeting lookups
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='i' AND c.relname='idx_meeting_attendees_meeting' AND n.nspname='public'
  ) THEN
    EXECUTE 'CREATE INDEX idx_meeting_attendees_meeting ON public.meeting_attendees(meeting_id)';
  END IF;
END$$;
