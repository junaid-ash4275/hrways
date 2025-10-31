# Epic: Exports (CSV/PDF) & Documents (DB)

## Goal
Enable reliable CSV/PDF exports streamed to clients and HR document uploads stored in DB as bytea with metadata.

## In Scope
- CSV exports for employees, attendance, meetings, payroll
- PDF exports for attendance summaries and payslips
- Document uploads with in-memory handling and DB persistence
- Download endpoints with Content-Disposition attachment

## Out of Scope
- S3/object storage (vNext)

## Key Outcomes
- Users can download exports; HR can manage documents safely

## User Stories
- As HR/Admin, I can export lists to CSV filtered by my current view
- As HR, I can generate payslips and download as PDFs (single/bulk)
- As HR, I can upload/download/delete employee documents

## Acceptance Criteria
- Exports stream without temp files; browser download starts with proper filename
- Uploaded docs stored in DB with correct metadata; allowed types and size limits enforced

## Dependencies
- PDFKit helper, CSV stream utility; employees/attendance/meetings/payroll modules

## Non-Functional
- Streaming for large CSVs; memory-safe PDF generation

## Metrics
- Export completion time; upload/download success rate

## Risks
- Large DB size from stored documents; monitor and plan adapter for object storage later

## Release Slices
- MVP: CSV/PDF + DB-backed docs
- vNext: object storage integration

