-- Reconcile/normalize employee_documents schema to match server expectations
-- Normal form:
-- id UUID PK DEFAULT gen_random_uuid()
-- employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE
-- filename TEXT NOT NULL
-- mime TEXT NOT NULL
-- size_bytes BIGINT NOT NULL
-- sha256 TEXT NOT NULL
-- content BYTEA NOT NULL
-- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

DO $$
BEGIN
  -- Create table if missing (fresh DBs)
  IF to_regclass('public.employee_documents') IS NULL THEN
    EXECUTE $emp$
      CREATE TABLE employee_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        mime TEXT NOT NULL,
        size_bytes BIGINT NOT NULL,
        sha256 TEXT NOT NULL,
        content BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    $emp$;
  END IF;

  -- If table exists, reconcile legacy columns/names/types
  IF to_regclass('public.employee_documents') IS NOT NULL THEN
    -- original_filename -> filename
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_documents' AND column_name='original_filename'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_documents' AND column_name='filename'
    ) THEN
      EXECUTE 'ALTER TABLE public.employee_documents RENAME COLUMN original_filename TO filename';
    END IF;

    -- size -> size_bytes
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_documents' AND column_name='size'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_documents' AND column_name='size_bytes'
    ) THEN
      EXECUTE 'ALTER TABLE public.employee_documents RENAME COLUMN size TO size_bytes';
    END IF;

    -- uploaded_at -> created_at
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_documents' AND column_name='uploaded_at'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_documents' AND column_name='created_at'
    ) THEN
      EXECUTE 'ALTER TABLE public.employee_documents RENAME COLUMN uploaded_at TO created_at';
    END IF;

    -- Ensure mandatory columns exist (add with defaults to satisfy NOT NULL, then drop default)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_documents' AND column_name='filename'
    ) THEN
      EXECUTE $emp$ALTER TABLE public.employee_documents ADD COLUMN filename TEXT NOT NULL DEFAULT 'file'$emp$;
      EXECUTE 'ALTER TABLE public.employee_documents ALTER COLUMN filename DROP DEFAULT';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_documents' AND column_name='mime'
    ) THEN
      EXECUTE $emp$ALTER TABLE public.employee_documents ADD COLUMN mime TEXT NOT NULL DEFAULT 'application/octet-stream'$emp$;
      EXECUTE 'ALTER TABLE public.employee_documents ALTER COLUMN mime DROP DEFAULT';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_documents' AND column_name='size_bytes'
    ) THEN
      EXECUTE $emp$ALTER TABLE public.employee_documents ADD COLUMN size_bytes BIGINT NOT NULL DEFAULT 0$emp$;
      EXECUTE 'ALTER TABLE public.employee_documents ALTER COLUMN size_bytes DROP DEFAULT';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_documents' AND column_name='sha256'
    ) THEN
      EXECUTE $emp$ALTER TABLE public.employee_documents ADD COLUMN sha256 TEXT NOT NULL DEFAULT ''$emp$;
      EXECUTE 'ALTER TABLE public.employee_documents ALTER COLUMN sha256 DROP DEFAULT';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_documents' AND column_name='content'
    ) THEN
      EXECUTE $emp$ALTER TABLE public.employee_documents ADD COLUMN content BYTEA NOT NULL DEFAULT E'\\x'$emp$;
      EXECUTE 'ALTER TABLE public.employee_documents ALTER COLUMN content DROP DEFAULT';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_documents' AND column_name='created_at'
    ) THEN
      EXECUTE $emp$ALTER TABLE public.employee_documents ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now()$emp$;
      -- keep default on created_at
    END IF;

    -- Ensure types are correct (safe upcasts)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_documents' AND column_name='size_bytes' AND data_type IN ('integer')
    ) THEN
      EXECUTE 'ALTER TABLE public.employee_documents ALTER COLUMN size_bytes TYPE BIGINT';
    END IF;

    -- Ensure index on employee_id
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relkind='i' AND c.relname='idx_employee_documents_employee' AND n.nspname='public'
    ) THEN
      EXECUTE 'CREATE INDEX idx_employee_documents_employee ON public.employee_documents(employee_id)';
    END IF;
  END IF;
END$$;

