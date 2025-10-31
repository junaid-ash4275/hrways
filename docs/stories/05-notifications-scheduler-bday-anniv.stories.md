# Epic: Scheduled Notifications (Birthdays & Anniversaries) — User Stories

## HRW-SCHED-1: Scheduler Bootstrap (Timezone-Aware)
- Role: As an operator
- Goal: The system runs a daily job in the organization timezone.
- Acceptance Criteria:
  - Given ORG_TZ and SCHEDULE_TIME in env, when the server starts, then the cron is scheduled at the local org time and is DST-safe.
  - A dry-run/manual trigger exists for dev/testing without waiting for schedule.
- DoD: node-cron setup, env parsing, logging.
- Dependencies: Notifications Core
- Priority: P1 | Estimate: TBD

## HRW-SCHED-2: Birthday Notifications
- Role: As HR/Admin
- Goal: I receive notifications on employees’ birthdays.
- Acceptance Criteria:
  - Given today matches employee.birth_date (MM-DD), when the job runs, then a BIRTHDAY notification is created (one per employee per day).
  - Leap-day policy is defined: employees born on Feb 29 are celebrated on Feb 28 (or configured alternative).
  - De-dup key is (employee_id, 'BIRTHDAY', event_date).
- DoD: Query + insert with de-dup; metadata optional.
- Dependencies: Employees table (birth_date)
- Priority: P1 | Estimate: TBD

## HRW-SCHED-3: Work Anniversary Notifications
- Role: As HR/Admin
- Goal: I receive notifications on work anniversaries with years.
- Acceptance Criteria:
  - Given today matches employee.join_date (MM-DD) and years >= 1, when the job runs, then a WORK_ANNIVERSARY notification is created with years in metadata.
  - De-dup key is (employee_id, 'WORK_ANNIVERSARY', event_date).
- DoD: Query + insert with de-dup.
- Dependencies: Employees table (join_date)
- Priority: P1 | Estimate: TBD

## HRW-SCHED-4: Manual Trigger for Testing
- Role: As a developer
- Goal: I can manually trigger the job for testing.
- Acceptance Criteria:
  - Given a CLI or dev-only endpoint, when invoked, then today’s notifications are generated (respecting de-dup).
- DoD: Script or dev route; guarded in non-prod.
- Dependencies: HRW-SCHED-2/3
- Priority: P2 | Estimate: TBD
