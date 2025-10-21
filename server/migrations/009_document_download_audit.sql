-- Audit table for employee document downloads
-- Tracks who downloaded which document and when, including basic client info

CREATE TABLE IF NOT EXISTS document_download_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES employee_documents(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  ip TEXT NULL,
  user_agent TEXT NULL,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_audit_doc ON document_download_audit(doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_audit_employee ON document_download_audit(employee_id);

