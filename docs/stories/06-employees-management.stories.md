# Epic: Employees Management — User Stories

## HRW-EMP-1: Create Employee
- Role: As HR
- Goal: I can create an employee with unique code and email.
- Acceptance Criteria:
  - Given valid fields, when I POST /employees, then the employee is created.
  - Given duplicate email or code, when I POST, then I receive 409 conflict.
  - Email must be valid format; birth_date is optional but if provided must be a valid date.
  - Responses follow standard error shape.
- DoD: Endpoint + validation + DB constraints + tests.
- Dependencies: Auth, DB
- Priority: P1 | Estimate: TBD

## HRW-EMP-2: View Employees Table
      - Role: As HR
      - Goal: I can view all existing employees in a tabular list.
      - Acceptance Criteria:
          - Given existing employees, when I open Employees, then I see a table with columns: Code, Name, Email, Phone,
  Department, Title, Status, Join Date.
          - Given many employees, when the table renders, then it shows a reasonable default page size (e.g., 10–25) with next/
  prev controls.
          - Given default view, when no filters are applied, then results are sorted by created_at DESC or Name ASC (choose
  one consistently).
          - Empty state is shown when there are no employees.
      - DoD: Read-only table UI + GET endpoint to fetch all (basic pagination allowed but no advanced filters yet).
      - Dependencies: HRW-EMP-1
      - Priority: P1 | Estimate: TBD

## HRW-EMP-3: Update & Archive Employee
- Role: As HR
- Goal: I can update employee details and archive when needed.
- Acceptance Criteria:
  - Given an employee, when I PUT /employees/:id, then fields update.
  - Given archive action, when I PATCH /employees/:id/archive, then status reflects archived and lists exclude by default.
  - Lists exclude archived by default; an `includeArchived=true` filter includes them.
- DoD: Endpoints + status handling.
- Dependencies: HRW-EMP-1
- Priority: P1 | Estimate: TBD

## HRW-EMP-4: List/Search/Filter/Paginate
- Role: As HR/Admin
- Goal: I can find employees easily.
- Acceptance Criteria:
  - Given query params (q, department, status, page, pageSize), when I GET /employees, then results and total reflect filters.
  - Pagination response shape: { data, page, pageSize, total }.
  - Support `includeArchived` flag.
- DoD: Endpoint + pagination shape; indexes as needed.
- Dependencies: HRW-EMP-1
- Priority: P1 | Estimate: TBD

## HRW-EMP-5: Upload Employee Document (DB)
- Role: As HR
- Goal: I can upload a document stored in DB (bytea).
- Acceptance Criteria:
  - Given a file within allowed types/sizes, when I POST /employees/:id/documents (multipart), then metadata and content persist.
  - Allowed MIME types are enforced from env (ALLOWED_MIME); MAX_UPLOAD_MB enforced; original filename sanitized; sha256 may be stored.
  - Responses follow standard error shape.
- DoD: Multer memoryStorage, DB insert, validation.
- Dependencies: HRW-EMP-1
- Priority: P1 | Estimate: TBD

## HRW-EMP-6: List/Download/Delete Documents
- Role: As HR
- Goal: I can manage employee documents.
- Acceptance Criteria:
  - Given documents, when I GET list, then metadata returns.
  - Given a doc id, when I GET download, then Content-Disposition attachment returns original filename and data.
  - Given a doc id, when I DELETE, then it is removed.
  - Access is enforced by RBAC and downloads are audited (who/when).
  - Responses follow standard error shape.
- DoD: Endpoints, secure download, tests.
- Dependencies: HRW-EMP-4
- Priority: P1 | Estimate: TBD

## HRW-EMP-7: Export Employees CSV
- Role: As HR/Admin
- Goal: I can export current filtered results to CSV.
- Acceptance Criteria:
  - Given filters are applied, when I GET /employees/export.csv, then CSV streams with headers and respects filters.
  - CSV cells starting with =,+,-,@ are escaped to prevent formula injection.
  - Filename includes timestamp and filter context; Content-Type text/csv set.
- DoD: CSV stream utility, filename convention.
- Dependencies: HRW-EMP-3
- Priority: P2 | Estimate: TBD
