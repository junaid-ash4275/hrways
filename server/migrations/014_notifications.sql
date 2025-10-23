-- Basic in-app notifications table for internal users (ADMIN/HR)

DO $$
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    EXECUTE $sql$
      CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        related_employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
        metadata JSONB NULL,
        read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    $sql$;
  END IF;

  -- Helpful index for unread
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='i' AND c.relname='idx_notifications_user_read' AND n.nspname='public'
  ) THEN
    EXECUTE 'CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read)';
  END IF;
END$$;

