# Epic: Exports & Documents — User Stories

## HRW-EXP-1: CSV Streaming Utility
- Role: As a developer
- Goal: I can stream CSV for any list with headers and filters.
- Acceptance Criteria:
  - Given a list endpoint and filters, when I call its export route, then CSV is streamed with a correct filename and without temp files.
  - CSV cells starting with =,+,-,@ are escaped to prevent formula injection; Content-Type text/csv is set.
  - Large exports are rate limited to protect the service.
- DoD: Utility function; tested with employees list.
- Dependencies: Employees listing
- Priority: P2 | Estimate: TBD

## HRW-EXP-2: PDFKit Wrapper
- Role: As a developer
- Goal: I can generate PDFs for attendance summaries and payslips.
- Acceptance Criteria:
  - Given a summary/payslip, when I call PDF generation, then a valid PDF streams to client.
  - Memory-safe generation; filenames include context (resource, date/time).
- DoD: Wrapper with simple templates; memory-safe.
- Dependencies: Attendance, Payroll
- Priority: P2 | Estimate: TBD

## HRW-EXP-3: Secure Download Endpoints
- Role: As HR/Admin
- Goal: I can download files via authenticated endpoints.
- Acceptance Criteria:
  - Given a file id, when I GET its download route, then `Content-Disposition: attachment; filename="..."` is set and authorization enforced.
  - Access is audited (who/when/which file) and responses follow standard error shape.
- DoD: Endpoints respect RBAC and audit sensitive access.
- Dependencies: Auth & RBAC
- Priority: P1 | Estimate: TBD

## HRW-EXP-4: Upload Validation & Limits
- Role: As HR
- Goal: I can upload only allowed types/sizes for employee documents.
- Acceptance Criteria:
  - Given an invalid type/size, when I upload, then 400 with details and no data stored.
  - Allowed MIME types are enforced from env (ALLOWED_MIME); MAX_UPLOAD_MB enforced; original filename sanitized.
- DoD: Multer memory, type/size checks, DB insert on valid only.
- Dependencies: Employees documents
- Priority: P1 | Estimate: TBD
