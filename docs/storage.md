# Storage & Downloads Design

## Summary
- Uploads (HR documents, attachments) are stored in PostgreSQL as `bytea`.
- Exports (CSV/PDF like reports and payslips) are generated and streamed to clients; not stored on server disk.
- The browser saves downloads to the user’s default Downloads folder (on Windows, the Downloads directory), controlled by the browser/OS settings.

## Rationale
- DB storage centralizes authorization and auditing, avoids filesystem complexity, and simplifies backups initially.
- Streaming exports avoids disk I/O and cleanup; supports immediate download UX.

## Data Model
- `employee_documents`
  - `id` (PK)
  - `employee_id` (FK)
  - `original_filename` text
  - `mime` text
  - `size` integer
  - `content` bytea
  - `sha256` text (optional, for dedupe/integrity)
  - `uploaded_at` timestamptz default now()

## Server Patterns
- Uploads: use `multer` with `memoryStorage()` so files arrive in memory and insert `req.file.buffer` into `bytea`.
- Downloads: fetch `content`, set `Content-Type`, and set `Content-Disposition: attachment; filename="..."` then stream the bytes.
- CSV: stream rows via `Readable`/`TextEncoder` without temp files.
- PDF: pipe PDFKit directly to `res`.

## Example Endpoints (sketch)
- Upload employee doc (HR/Admin only)
  - `POST /api/employees/:id/documents` (multipart)
  - Validates type/size, inserts metadata + `content` (bytea)
- Download employee doc
  - `GET /api/employees/:id/documents/:docId/download`
  - RBAC guard; returns `Content-Type` and `Content-Disposition` headers
- Export employees CSV
  - `GET /api/employees/export.csv`
  - Streams CSV (no storage)
- Export payslip PDF
  - `GET /api/payslips/:payslipId.pdf`
  - Generates via PDFKit and streams

## Client Download Behavior
- The server’s `Content-Disposition: attachment` prompts a download. Browsers save to the configured default location (Windows → Downloads). You cannot force a specific OS path from a web server.
- For programmatic downloads (React), use a blob URL and set `a.download = filename` to suggest the name.

## Constraints & Safety
- Max upload size (e.g., 10 MB) and allowed MIME types.
- Sanitize `original_filename`; store UUID-based identifiers server-side.
- Virus scanning is vNext.

## Migration Notes (raw SQL)
- Add `employee_documents` as described.
- Consider `CHECK (size <= 10*1024*1024)` for size limit.
- Index `employee_id`; optional index on `sha256` for dedupe.

## Future Option
- If DB size growth becomes a concern, introduce a `StorageAdapter` to switch to S3 transparently while keeping the same logical document keys.

