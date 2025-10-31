# Epic: Employees Management (CRUD, Docs, Search/Filter, Export)

## Goal
Provide HR/Admin with reliable employee records management, document storage in DB, search/filter/pagination, and CSV export.

## In Scope
- Create/read/update/archive employee records (unique code and email)
- Upload/list/delete employee documents (DB bytea)
- Search/filter by name/email/department/status; pagination
- Export current list to CSV

## Out of Scope
- Bulk import (vNext), custom fields (vNext)

## Key Outcomes
- Accurate, searchable employee directory with attached documents

## User Stories
- As HR, I can create/update/archive employees with unique code/email
- As HR, I can upload CVs/contracts and download them later
- As HR, I can find employees by name/email/department and paginate results
- As HR/Admin, I can export current filtered list to CSV

## Acceptance Criteria
- Duplicate email or code returns 409
- Documents stored in DB (bytea) with metadata (filename, mime, size)
- CSV export reflects current filters and includes headers

## Dependencies
- Auth/RBAC; DB schema; uploads (multer memory)

## Non-Functional
- Input validation; size/type limits for documents; standard error shape

## Metrics
- Query performance p95 < 500ms at 10k rows (paginated)

## Risks
- DB growth from documents; monitor sizes; consider object storage adapter later

## Release Slices
- MVP: CRUD + docs + search/paginate + CSV
- vNext: bulk import, custom fields, expiry reminders

