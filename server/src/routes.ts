import { Router } from 'express';
import { pingDb, pool } from './config/db';
import bcrypt from 'bcryptjs';
import { sign, verify } from 'jsonwebtoken';
import { env } from './config/env';
import { authGuard } from './middleware/authGuard';
import { randomUUID, randomInt, createHash } from 'crypto';
import multer from 'multer';
import { sendOtpEmail } from './config/email';

export const routes = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Number(env.MAX_UPLOAD_MB) * 1024 * 1024 } });

routes.get('/healthz', async (_req, res) => {
  const db = await pingDb();
  res.json({ ok: true, db });
});

  // HRW-DASH-1: KPI Cards
  routes.get('/dashboard/kpis', authGuard('HR'), async (_req, res, next) => {
    try {
    const weekStart = new Date();
    // Compute Monday 00:00 of current week in server time
    const day = weekStart.getDay(); // 0=Sun .. 6=Sat
    const diffToMonday = (day === 0 ? -6 : 1 - day); // if Sunday, go back 6 days
    weekStart.setHours(0,0,0,0);
    weekStart.setDate(weekStart.getDate() + diffToMonday);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);

    const qEmployees = pool.query(`SELECT COUNT(*)::int AS c FROM employees WHERE status = 'ACTIVE'`);
    const qLeaveToday = pool.query(
      `SELECT COUNT(*)::int AS c
         FROM leave_requests
        WHERE status = 'APPROVED'
          AND date_from <= CURRENT_DATE
          AND date_to >= CURRENT_DATE`
    );
    // Birthdays and anniversaries this month
    const qBirthdays = pool.query(
      `SELECT COUNT(*)::int AS c
         FROM employees
        WHERE EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)`
    );
    const qAnniv = pool.query(
      `SELECT COUNT(*)::int AS c
         FROM employees
        WHERE EXTRACT(MONTH FROM join_date) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND AGE(CURRENT_DATE, join_date) >= INTERVAL '1 year'`
    );
    const qMeetingsWeek = pool.query(
      `SELECT COUNT(*)::int AS c
         FROM meetings
        WHERE start_at >= $1 AND start_at < $2 AND status <> 'CANCELLED'`,
      [weekStart.toISOString(), weekEnd.toISOString()]
    );

    const [employees, leaveToday, birthdays, anniv, meetings] = await Promise.all([
      qEmployees, qLeaveToday, qBirthdays, qAnniv, qMeetingsWeek
    ]);

    res.json({
      employeesTotal: employees.rows?.[0]?.c || 0,
      onLeaveToday: leaveToday.rows?.[0]?.c || 0,
      birthdaysThisMonth: (birthdays.rows?.[0]?.c || 0) + (anniv.rows?.[0]?.c || 0),
      meetingsThisWeek: meetings.rows?.[0]?.c || 0,
    });
  } catch (e) { next(e) }
});

  // HRW-DASH-2: Recent Activity (aggregated)
  routes.get('/dashboard/activity', authGuard('HR'), async (req, res, next) => {
  try {
    const limitRaw = Number(req.query.limit || 10) || 10
    const limit = Math.max(1, Math.min(100, limitRaw))
    const { rows } = await pool.query(
      `SELECT * FROM (
         SELECT created_at AS at, 'EMPLOYEE' AS kind, id::text AS ref, name AS title, '/employees' AS link FROM employees
         UNION ALL
         SELECT created_at AS at, 'LEAVE' AS kind, id::text AS ref, NULL::text AS title, '/attendance' AS link FROM leave_requests
         UNION ALL
         SELECT created_at AS at, 'MEETING' AS kind, id::text AS ref, title AS title, ('/meetings?open=' || id::text) AS link FROM meetings
         UNION ALL
         SELECT created_at AS at, 'DOCUMENT' AS kind, id::text AS ref, filename AS title, '/employees' AS link FROM employee_documents
       ) t
       ORDER BY at DESC
       LIMIT $1`,
      [limit]
    )
    res.json({ data: rows })
  } catch (e) { next(e) }
})

// HRW-MEET-3: List & Filter Meetings (date range + attendee) with optional pagination
routes.get('/meetings', authGuard('HR'), async (req, res, next) => {
  try {
    const fromRaw = (req.query.from || '').toString().trim()
    const toRaw = (req.query.to || '').toString().trim()
    let from = new Date()
    let to = new Date(from.getTime() + 30 * 24 * 3600 * 1000)
    if (fromRaw) { const d = new Date(fromRaw); if (!isNaN(d.getTime())) from = d }
    if (toRaw) { const d = new Date(toRaw); if (!isNaN(d.getTime())) to = d }

    const pageRaw = Number(req.query.page || '')
    const pageSizeRaw = Number(req.query.pageSize || '')
    const usePaging = Number.isFinite(pageRaw) && Number.isFinite(pageSizeRaw) && pageRaw > 0 && pageSizeRaw > 0
    const page = usePaging ? Math.max(1, Math.floor(pageRaw)) : 1
    const pageSize = usePaging ? Math.max(1, Math.min(200, Math.floor(pageSizeRaw))) : 0
    const offset = usePaging ? (page - 1) * pageSize : 0

    const sortRaw = (req.query.sort || 'start_at').toString().toLowerCase()
    const dirRaw = (req.query.dir || 'asc').toString().toLowerCase()
    const allowedSort: Record<string, string> = { start_at: 'm.start_at', title: 'm.title', created_at: 'm.created_at' }
    const sortCol = allowedSort[sortRaw] || 'm.start_at'
    const dir = dirRaw === 'desc' ? 'DESC' : 'ASC'

    const attendeeRaw = (req.query.attendee || '').toString().trim()
    const statusRaw = (req.query.status || '').toString().trim().toUpperCase()
    const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

    const where: string[] = []
    const params: any[] = []
    let pi = 1

    // Date range
    where.push(`m.start_at >= $${pi++}`); params.push(from.toISOString())
    where.push(`m.start_at < $${pi++}`); params.push(to.toISOString())

    // Status filter (optional)
    if (statusRaw) {
      if (["SCHEDULED","DONE","CANCELLED"].includes(statusRaw)) {
        where.push(`m.status = $${pi++}`); params.push(statusRaw)
      } else if (statusRaw === 'NOT_CANCELLED') {
        where.push(`m.status <> 'CANCELLED'`)
      }
    }

    // Attendee filter (optional): uuid filters users or employees; non-uuid filters external email
    let joinAtt = ''
    if (attendeeRaw) {
      joinAtt = 'JOIN meeting_attendees a ON a.meeting_id = m.id'
      if (uuidRe.test(attendeeRaw)) {
        where.push(`(a.attendee_user_id = $${pi} OR a.attendee_employee_id = $${pi})`); params.push(attendeeRaw)
        pi++
      } else {
        // Allow matching by external email OR external name (case-insensitive)
        where.push(`(LOWER(a.external_email) = LOWER($${pi}) OR LOWER(a.external_name) = LOWER($${pi}))`); params.push(attendeeRaw)
        pi++
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    // Count total distinct meetings
    const countSql = `SELECT COUNT(*)::int AS c FROM (SELECT m.id FROM meetings m ${joinAtt} ${whereSql} GROUP BY m.id) t`
    const total = (await pool.query(countSql, params)).rows[0]?.c || 0

    // List meetings
    const listSql = `SELECT m.id, m.title, m.start_at, m.end_at, m.status
                       FROM meetings m
                       ${joinAtt}
                       ${whereSql}
                       GROUP BY m.id
                       ORDER BY ${sortCol} ${dir}
                       ${usePaging ? `LIMIT $${pi} OFFSET $${pi + 1}` : ''}`
    const listParams = usePaging ? [...params, pageSize, offset] : params
    const rows = (await pool.query(listSql, listParams)).rows

    if (usePaging) {
      return res.json({ data: rows, page, pageSize, total })
    } else {
      return res.json({ data: rows, page: 1, pageSize: rows.length, total: rows.length })
    }
  } catch (e) { next(e) }
})

// Get meeting details with attendees
routes.get('/meetings/:id', authGuard('HR'), async (req, res, next) => {
  try {
    const id = (req.params.id || '').toString().trim();
    const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    if (!uuidRe.test(id)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid meeting id format' } });
    }
    const mt = await pool.query('SELECT id, title, start_at, end_at, status FROM meetings WHERE id = $1', [id]);
    if (mt.rowCount === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Meeting not found' } });
    const meeting = mt.rows[0];
    const rows = await pool.query(
      `SELECT a.attendee_user_id, a.attendee_employee_id, a.external_name, a.external_email, a.external_phone,
              u.email AS user_email, (u.profile ->> 'fullName') AS user_full_name,
              e.name AS employee_name, e.email AS employee_email
         FROM meeting_attendees a
         LEFT JOIN users u ON u.id = a.attendee_user_id
         LEFT JOIN employees e ON e.id = a.attendee_employee_id
        WHERE a.meeting_id = $1`, [id]);
    const users: any[] = [];
    const employees: any[] = [];
    const externals: any[] = [];
    for (const r of rows.rows) {
      if (r.attendee_user_id) {
        users.push({ id: r.attendee_user_id, email: r.user_email, fullName: r.user_full_name });
      } else if (r.attendee_employee_id) {
        employees.push({ id: r.attendee_employee_id, name: r.employee_name, email: r.employee_email });
      } else if (r.external_email || r.external_name || r.external_phone) {
        externals.push({ name: r.external_name, email: r.external_email, phone: r.external_phone });
      }
    }
    res.json({ ...meeting, attendees: { users, employees, externals } });
  } catch (e) { next(e) }
});

// HRW-MEET-1: Create Meeting with Attendees (employees, users, externals)
routes.post('/meetings', authGuard('HR'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const title = (body.title || '').toString().trim();
    const startRaw = (body.start_at || body.startAt || '').toString().trim();
    const endRaw = (body.end_at || body.endAt || '').toString().trim();
    const currentUserId = (req as any).user?.id as string | undefined;

    // Attendees can be provided as an array of unions or grouped
    const attendees = Array.isArray(body.attendees) ? body.attendees : [];
    const usersArr: string[] = Array.isArray(body.user_ids) ? body.user_ids : [];
    const employeesArr: string[] = Array.isArray(body.employee_ids) ? body.employee_ids : [];
    const externalsArr: any[] = Array.isArray(body.external_contacts) ? body.external_contacts : [];

    const errors: string[] = [];
    if (!title) errors.push('title is required');

    const start = new Date(startRaw);
    const end = new Date(endRaw);
    if (isNaN(start.getTime())) errors.push('start_at must be a valid ISO datetime');
    if (isNaN(end.getTime())) errors.push('end_at must be a valid ISO datetime');
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && !(start.getTime() < end.getTime())) {
      errors.push('start_at must be earlier than end_at');
    }

    // Normalize attendees into three sets
    const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const userIds = new Set<string>();
    const employeeIds = new Set<string>();
    const externals: { name?: string; email: string; phone?: string }[] = [];

    function addUserId(v: any) {
      const s = (v || '').toString().trim();
      if (!s) return; if (!uuidRe.test(s)) { errors.push(`user_id invalid: ${s}`); return; }
      userIds.add(s);
    }
    function addEmployeeId(v: any) {
      const s = (v || '').toString().trim();
      if (!s) return; if (!uuidRe.test(s)) { errors.push(`employee_id invalid: ${s}`); return; }
      employeeIds.add(s);
    }
    function addExternal(obj: any) {
      if (!obj) return;
      const name = (obj.name || obj.external_name || '').toString().trim();
      const emailRaw = (obj.email || obj.external_email || '').toString().trim();
      const phone = (obj.phone || obj.external_phone || '').toString().trim();
      // Allow external contact with name-only; email optional
      const hasAny = !!name || !!emailRaw || !!phone;
      if (!hasAny) { errors.push('external_contact requires at least a name'); return; }
      let email: string | undefined = undefined;
      if (emailRaw) {
        const normalized = emailRaw.toLowerCase();
        if (!emailRe.test(normalized)) { errors.push(`external_contact.email invalid: ${emailRaw}`); return; }
        email = normalized;
        // dedupe by normalized email if present
        if (externals.some(e => (e.email || '').toLowerCase() === email)) return;
      }
      externals.push({ name: name || undefined, email, phone: phone || undefined });
    }

    for (const a of attendees) {
      if (a && typeof a === 'object') {
        if (a.user_id || a.userId) addUserId(a.user_id || a.userId);
        else if (a.employee_id || a.employeeId) addEmployeeId(a.employee_id || a.employeeId);
        else if (a.external || a.external_email || a.email) addExternal(a.external || a);
        else errors.push('attendee item must contain user_id, employee_id, or external');
      }
    }
    for (const u of usersArr) addUserId(u);
    for (const e of employeesArr) addEmployeeId(e);
    for (const ex of externalsArr) addExternal(ex);

    if (userIds.size + employeeIds.size + externals.length < 1) {
      errors.push('at least one attendee is required');
    }

    if (errors.length) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid meeting data', details: errors } });
    }

    // Validate foreign refs exist
    // Wrap in transaction
    await client.query('BEGIN');

    if (userIds.size) {
      const ids = Array.from(userIds);
      const q = await client.query('SELECT id FROM users WHERE id = ANY($1::uuid[])', [ids]);
      const found = new Set(q.rows.map(r => r.id));
      const missing = ids.filter(id => !found.has(id));
      if (missing.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Unknown user_ids', details: missing } });
      }
    }
    if (employeeIds.size) {
      const ids = Array.from(employeeIds);
      const q = await client.query('SELECT id FROM employees WHERE id = ANY($1::uuid[])', [ids]);
      const found = new Set(q.rows.map(r => r.id));
      const missing = ids.filter(id => !found.has(id));
      if (missing.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Unknown employee_ids', details: missing } });
      }
    }

    // Determine available organizer/created_by columns
    const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='meetings'`);
    const hasCreatedBy = cols.rows.some((r: any) => r.column_name === 'created_by');
    const hasOrganizer = cols.rows.some((r: any) => r.column_name === 'organizer_user_id');

    // Insert meeting
    const fields: string[] = ['title', 'start_at', 'end_at', 'status'];
    const values: any[] = [title, start.toISOString(), end.toISOString(), 'SCHEDULED'];
    if (hasCreatedBy && currentUserId) { fields.push('created_by'); values.push(currentUserId); }
    if (hasOrganizer && currentUserId) { fields.push('organizer_user_id'); values.push(currentUserId); }
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(',');
    const ins = await client.query(
      `INSERT INTO meetings(${fields.join(',')}) VALUES (${placeholders}) RETURNING id, title, start_at, end_at, status`,
      values
    );
    const meeting = ins.rows[0];

    // Insert attendees, avoid duplicates (DB constraints will enforce, use DO NOTHING)
    const meetingId = meeting.id;
    for (const id of userIds) {
      await client.query(
        `INSERT INTO meeting_attendees(meeting_id, attendee_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [meetingId, id]
      );
    }
    for (const id of employeeIds) {
      await client.query(
        `INSERT INTO meeting_attendees(meeting_id, attendee_employee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [meetingId, id]
      );
    }
    for (const ex of externals) {
      await client.query(
        `INSERT INTO meeting_attendees(meeting_id, external_name, external_email, external_phone)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [meetingId, ex.name || null, ex.email, ex.phone || null]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({
      id: meeting.id,
      title: meeting.title,
      start_at: meeting.start_at,
      end_at: meeting.end_at,
      status: meeting.status,
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    next(e);
  } finally {
    client.release();
  }
});

// HRW-MEET-2: Update Meeting (title/time and optionally replace attendees)
routes.put('/meetings/:id', authGuard('HR'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = (req.params.id || '').toString().trim();
    const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    if (!uuidRe.test(id)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid meeting id format' } });
    }

    const body = req.body || {};
    const titleRaw = body.title;
    const startRaw = (body.start_at || body.startAt);
    const endRaw = (body.end_at || body.endAt);

    const errors: string[] = [];
    let title: string | undefined = undefined;
    let start: Date | undefined = undefined;
    let end: Date | undefined = undefined;
    if (titleRaw !== undefined) {
      title = (titleRaw || '').toString().trim();
      if (!title) errors.push('title cannot be empty');
    }
    if (startRaw !== undefined) {
      start = new Date((startRaw || '').toString().trim());
      if (isNaN(start.getTime())) errors.push('start_at must be a valid ISO datetime');
    }
    if (endRaw !== undefined) {
      end = new Date((endRaw || '').toString().trim());
      if (isNaN(end.getTime())) errors.push('end_at must be a valid ISO datetime');
    }
    if (start && end && !(start.getTime() < end.getTime())) {
      errors.push('start_at must be earlier than end_at');
    }

    // Detect attendee replacement intent
    const hasAttendeePayload = Array.isArray(body.attendees) || Array.isArray(body.user_ids) || Array.isArray(body.employee_ids) || Array.isArray(body.external_contacts);

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const userIds = new Set<string>();
    const employeeIds = new Set<string>();
    const externals: { name?: string; email?: string; phone?: string }[] = [];
    function addUserId(v: any) {
      const s = (v || '').toString().trim();
      if (!s) return; if (!uuidRe.test(s)) { errors.push(`user_id invalid: ${s}`); return; }
      userIds.add(s);
    }
    function addEmployeeId(v: any) {
      const s = (v || '').toString().trim();
      if (!s) return; if (!uuidRe.test(s)) { errors.push(`employee_id invalid: ${s}`); return; }
      employeeIds.add(s);
    }
    function addExternal(obj: any) {
      if (!obj) return;
      const name = (obj.name || obj.external_name || '').toString().trim();
      const emailRaw = (obj.email || obj.external_email || '').toString().trim();
      const phone = (obj.phone || obj.external_phone || '').toString().trim();
      const hasAny = !!name || !!emailRaw || !!phone;
      if (!hasAny) { errors.push('external_contact requires at least a name'); return; }
      let email: string | undefined = undefined;
      if (emailRaw) {
        const normalized = emailRaw.toLowerCase();
        if (!emailRe.test(normalized)) { errors.push(`external_contact.email invalid: ${emailRaw}`); return; }
        email = normalized;
        if (externals.some(e => (e.email || '').toLowerCase() === email)) return;
      }
      externals.push({ name: name || undefined, email, phone: phone || undefined });
    }
    if (Array.isArray(body.attendees)) {
      for (const a of body.attendees) {
        if (a && typeof a === 'object') {
          if (a.user_id || a.userId) addUserId(a.user_id || a.userId);
          else if (a.employee_id || a.employeeId) addEmployeeId(a.employee_id || a.employeeId);
          else if (a.external || a.external_email || a.email) addExternal(a.external || a);
          else errors.push('attendee item must contain user_id, employee_id, or external');
        }
      }
    }
    if (Array.isArray(body.user_ids)) for (const u of body.user_ids) addUserId(u);
    if (Array.isArray(body.employee_ids)) for (const e of body.employee_ids) addEmployeeId(e);
    if (Array.isArray(body.external_contacts)) for (const ex of body.external_contacts) addExternal(ex);

    if (errors.length) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid meeting data', details: errors } });
    }

    await client.query('BEGIN');
    // Ensure meeting exists
    const existing = await client.query('SELECT id, title, start_at, end_at, status FROM meetings WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Meeting not found' } });
    }

    // If replacing attendees, ensure at least one attendee provided
    if (hasAttendeePayload) {
      if (userIds.size + employeeIds.size + externals.length < 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid meeting data', details: ['at least one attendee is required'] } });
      }
    }

    // Validate foreign refs
    if (userIds.size) {
      const ids = Array.from(userIds);
      const q = await client.query('SELECT id FROM users WHERE id = ANY($1::uuid[])', [ids]);
      const found = new Set(q.rows.map(r => r.id));
      const missing = ids.filter(id => !found.has(id));
      if (missing.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Unknown user_ids', details: missing } }); }
    }
    if (employeeIds.size) {
      const ids = Array.from(employeeIds);
      const q = await client.query('SELECT id FROM employees WHERE id = ANY($1::uuid[])', [ids]);
      const found = new Set(q.rows.map(r => r.id));
      const missing = ids.filter(id => !found.has(id));
      if (missing.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Unknown employee_ids', details: missing } }); }
    }

    // Update meeting fields if provided
    if (title !== undefined || start !== undefined || end !== undefined) {
      const sets: string[] = [];
      const params: any[] = [];
      let pi = 1;
      if (title !== undefined) { sets.push(`title = $${pi++}`); params.push(title); }
      if (start !== undefined) { sets.push(`start_at = $${pi++}`); params.push(start!.toISOString()); }
      if (end !== undefined) { sets.push(`end_at = $${pi++}`); params.push(end!.toISOString()); }
      if (sets.length) {
        params.push(id);
        await client.query(`UPDATE meetings SET ${sets.join(', ')} WHERE id = $${pi}`, params);
      }
    }

    // Replace attendees if payload present
    if (hasAttendeePayload) {
      await client.query('DELETE FROM meeting_attendees WHERE meeting_id = $1', [id]);
      for (const uid of userIds) {
        await client.query(`INSERT INTO meeting_attendees(meeting_id, attendee_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, uid]);
      }
      for (const eid of employeeIds) {
        await client.query(`INSERT INTO meeting_attendees(meeting_id, attendee_employee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, eid]);
      }
      for (const ex of externals) {
        await client.query(`INSERT INTO meeting_attendees(meeting_id, external_name, external_email, external_phone) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [id, ex.name || null, ex.email || null, ex.phone || null]);
      }
    }

    // Notify internal user attendees of update (MVP+: safe to include; no-op if none)
    try {
      const att = await client.query(`SELECT attendee_user_id FROM meeting_attendees WHERE meeting_id = $1 AND attendee_user_id IS NOT NULL`, [id]);
      const mt = await client.query('SELECT title, start_at FROM meetings WHERE id = $1', [id]);
      const titleNow = mt.rows[0]?.title as string;
      const startAt = mt.rows[0]?.start_at;
      for (const row of att.rows) {
        await client.query(
          `INSERT INTO notifications(user_id, type, message, metadata)
             VALUES ($1, 'MEETING_UPDATED', $2, $3::jsonb)`,
          [row.attendee_user_id, `Meeting updated: ${titleNow}`, JSON.stringify({ meeting_id: id, title: titleNow, start_at: startAt })]
        );
      }
    } catch {}

    await client.query('COMMIT');
    const out = await pool.query('SELECT id, title, start_at, end_at, status FROM meetings WHERE id = $1', [id]);
    return res.json(out.rows[0]);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    next(e);
  } finally {
    client.release();
  }
});

// HRW-MEET-2 (cancel subset): Cancel a meeting -> set status = 'CANCELLED'
routes.delete('/meetings/:id', authGuard('HR'), async (req, res, next) => {
  try {
    const id = (req.params.id || '').toString().trim();
    const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    if (!uuidRe.test(id)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid meeting id format' } });
    }
    const upd = await pool.query(
      `UPDATE meetings SET status = 'CANCELLED' WHERE id = $1 AND status <> 'CANCELLED' RETURNING id, title, start_at, end_at, status`,
      [id]
    );
    if (upd.rowCount === 0) {
      // Check if meeting exists
      const exists = await pool.query('SELECT 1 FROM meetings WHERE id = $1', [id]);
      if (exists.rowCount === 0) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Meeting not found' } });
      }
      // Already cancelled, respond idempotently
      return res.status(200).json({ ok: true, id, status: 'CANCELLED' });
    }
    // Insert notifications for internal attendees (users only)
    try {
      const att = await pool.query(`SELECT attendee_user_id FROM meeting_attendees WHERE meeting_id = $1 AND attendee_user_id IS NOT NULL`, [id]);
      const title = upd.rows[0].title as string;
      const startAt = upd.rows[0].start_at as any;
      for (const row of att.rows) {
        const uid = row.attendee_user_id;
        await pool.query(
          `INSERT INTO notifications(user_id, type, message, metadata)
             VALUES ($1, 'MEETING_CANCELLED', $2, $3::jsonb)`,
          [uid, `Meeting cancelled: ${title}`, JSON.stringify({ meeting_id: id, title, start_at: startAt })]
        );
      }
    } catch {}
    res.json(upd.rows[0]);
  } catch (e) { next(e) }
});

// HRW-ATT-1: Record Attendance
routes.post('/attendance', authGuard('HR'), async (req, res, next) => {
  try {
    const b = req.body || {}
    let employeeId = (b.employee_id || '').toString().trim()
    const employeeCode = (b.employee_code || '').toString().trim()
    const dateFrom = ((b.date_from || b.work_date) || '').toString().trim()
    const dateTo = (b.date_to || '').toString().trim()
    const clockIn = (b.clock_in || '').toString().trim()
    const clockOut = (b.clock_out || '').toString().trim()
    const status = (b.status || 'ABSENT').toString().trim().toUpperCase()
    const includeWeekends = String(b.includeWeekends || '').toLowerCase() === 'true'

    const errors: string[] = []
    if (!employeeId && !employeeCode) errors.push('employee_id or employee_code is required')
    if (!dateFrom) errors.push('date_from (or work_date) is required')
    if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) errors.push('date_from must be YYYY-MM-DD')
    if (dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) errors.push('date_to must be YYYY-MM-DD')
    if (status && !['PRESENT','ABSENT','LEAVE','HALF_DAY'].includes(status)) errors.push('status must be one of PRESENT, ABSENT, LEAVE, HALF_DAY')
    if (clockIn && !/^\d{2}:\d{2}$/.test(clockIn)) errors.push('clock_in must be HH:MM')
    if (clockOut && !/^\d{2}:\d{2}$/.test(clockOut)) errors.push('clock_out must be HH:MM')
    if (errors.length) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid attendance data', details: errors } })

    // Resolve employee by code if needed
    if (!employeeId && employeeCode) {
      const e = await pool.query('SELECT id FROM employees WHERE employee_code = $1', [employeeCode])
      if (e.rows.length === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } })
      employeeId = e.rows[0].id as string
    }

    // Build timestamps (UTC for MVP)
    function toTs(date: string, hm: string) {
      try {
        // use organization timezone offset to build local timestamp
        const off = env.ORG_TZ_OFFSET || '+05:00'
        const s = `${date}T${hm}:00${off}`
        const d = new Date(s)
        if (isNaN(d.getTime())) return null
        return d.toISOString()
      } catch { return null }
    }
    // Determine range (inclusive)
    const from = new Date(`${dateFrom}T00:00:00Z`)
    const to = new Date(`${(dateTo || dateFrom)}T00:00:00Z`)
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid date range' } })
    }
    const days: string[] = []
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400000)) {
      const day = d.getUTCDay() // 0 Sun..6 Sat
      const isWeekend = (day === 0 || day === 6)
      if (!includeWeekends && isWeekend) continue
      days.push(d.toISOString().slice(0,10))
    }
    const ci = clockIn ? toTs(dateFrom, clockIn) : null
    const co = clockOut ? toTs(dateFrom, clockOut) : null
    await pool.query('BEGIN')
    try {
      for (const d of days) {
        await pool.query(
          `INSERT INTO attendance (employee_id, work_date, clock_in, clock_out, status)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (employee_id, work_date) DO UPDATE SET status = EXCLUDED.status, clock_in = EXCLUDED.clock_in, clock_out = EXCLUDED.clock_out`,
          [employeeId, d, ci, co, status]
        )
      }
      await pool.query('COMMIT')
    } catch (e) {
      await pool.query('ROLLBACK')
      throw e
    }
    return res.status(201).json({ ok: true, employee_id: employeeId, status, days })
  } catch (e) { next(e) }
})

// HRW-ATT-3: List & Filter Attendance
routes.get('/attendance', authGuard('HR'), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1) || 1)
    const pageSizeRaw = Number(req.query.pageSize || 10) || 10
    const pageSize = Math.max(1, Math.min(100, pageSizeRaw))
    const offset = (page - 1) * pageSize

    const employeeId = (req.query.employee_id || '').toString().trim()
    const employeeCode = (req.query.employee_code || '').toString().trim()
    const q = (req.query.q || '').toString().trim()
    const from = (req.query.from || '').toString().trim()
    const to = (req.query.to || '').toString().trim()
    const includeComputed = String(req.query.includeComputed || '').toLowerCase() === 'true'
    const includeWeekends = String(req.query.includeWeekends || '').toLowerCase() === 'true'

    // Resolve employees filter set first to avoid placeholder offset issues
    const empWhere: string[] = []
    const empParams: any[] = []
    if (employeeId) { empWhere.push(`id = $${empParams.length + 1}`); empParams.push(employeeId) }
    if (employeeCode) { empWhere.push(`employee_code = $${empParams.length + 1}`); empParams.push(employeeCode) }
    if (q) { empWhere.push(`(employee_code ILIKE $${empParams.length + 1} OR name ILIKE $${empParams.length + 1} OR email ILIKE $${empParams.length + 1})`); empParams.push(`%${q}%`) }
    const empRes = await pool.query(
      `SELECT id, employee_code, name FROM employees ${empWhere.length ? 'WHERE ' + empWhere.join(' AND ') : ''}`,
      empParams
    )
    const empIds: string[] = empRes.rows.map((r: any) => r.id)
    if (empIds.length === 0) return res.json({ data: [], page, pageSize, total: 0 })

    if (!includeComputed) {
      // Exceptions-only view
      const detail = String(req.query.detail || '').toLowerCase() === 'true'
      if (detail) {
        // Return raw exception rows (paginated) for selected employees
        const filters: string[] = [`a.employee_id = ANY($1::uuid[])`]
        const params: any[] = [empIds]
        let pi = 2
        if (from) { filters.push(`a.work_date >= $${pi++}`); params.push(from) }
        if (to) { filters.push(`a.work_date <= $${pi++}`); params.push(to) }
        const whereSql = `WHERE ${filters.join(' AND ')}`

        const totalRes = await pool.query(
          `SELECT COUNT(*)::int AS c FROM attendance a ${whereSql}`,
          params
        )
        const total = totalRes.rows?.[0]?.c || 0
        if (total === 0) return res.json({ data: [], page, pageSize, total: 0 })

        const listRes = await pool.query(
          `SELECT a.employee_id, e.employee_code, e.name,
                  a.work_date AS start_date,
                  a.work_date AS end_date,
                  1::int AS days,
                  a.status
             FROM attendance a
             JOIN employees e ON e.id = a.employee_id
             ${whereSql}
            ORDER BY a.work_date DESC, e.name ASC
            LIMIT $${pi} OFFSET $${pi + 1}`,
          [...params, pageSize, offset]
        )
        return res.json({ data: listRes.rows, page, pageSize, total })
      }

      // Aggregate one row per employee with date range and status summary
      const filters: string[] = [`a.employee_id = ANY($1::uuid[])`]
      const params: any[] = [empIds]
      let pi = 2
      if (from) { filters.push(`a.work_date >= $${pi++}`); params.push(from) }
      if (to) { filters.push(`a.work_date <= $${pi++}`); params.push(to) }
      const whereSql = `WHERE ${filters.join(' AND ')}`
      const totalRes = await pool.query(
        `SELECT COUNT(*)::int AS c FROM (
           SELECT a.employee_id FROM attendance a ${whereSql} GROUP BY a.employee_id
         ) x`,
        params
      )
      const total = totalRes.rows?.[0]?.c || 0
      if (total === 0) return res.json({ data: [], page, pageSize, total: 0 })
      const listRes = await pool.query(
        `WITH filtered AS (
           SELECT a.employee_id, a.work_date, a.status
             FROM attendance a
             ${whereSql}
         ), grouped AS (
           SELECT employee_id,
                  MIN(work_date) AS start_date,
                  MAX(work_date) AS end_date,
                  COUNT(*)::int AS days,
                  CASE WHEN COUNT(DISTINCT status) = 1 THEN MIN(status) ELSE 'MIXED' END AS status
             FROM filtered
            GROUP BY employee_id
         )
         SELECT g.employee_id, e.employee_code, e.name, g.start_date, g.end_date, g.days, g.status
           FROM grouped g
           JOIN employees e ON e.id = g.employee_id
          ORDER BY e.name ASC
          LIMIT $${pi} OFFSET $${pi + 1}`,
        [...params, pageSize, offset]
      )
      return res.json({ data: listRes.rows, page, pageSize, total })
    }

    // Computed view: require a from/to and at least one employee filter to avoid huge cross join
    if (!from || !to) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'from and to are required for computed view' } })
    }
    // Build day filter for weekends
    const weekendFilter = includeWeekends ? '' : 'AND EXTRACT(DOW FROM d.day) NOT IN (0,6)'
    // Total rows = number of selected employees * number of included days
    // Compute total via SQL
    const daysCountRes = await pool.query(
      `SELECT COUNT(*)::int AS c FROM generate_series($1::date, $2::date, interval '1 day') d(day)
        WHERE TRUE ${weekendFilter}`,
      [from, to]
    )
    const total = (daysCountRes.rows?.[0]?.c || 0) * empIds.length
    if (total === 0) return res.json({ data: [], page, pageSize, total: 0 })

    // List rows with computed status (attendance exceptions override, approved leaves imply LEAVE, else PRESENT)
    const list = await pool.query(
      `WITH days AS (
         SELECT day FROM generate_series($1::date, $2::date, interval '1 day') d(day)
         WHERE TRUE ${weekendFilter}
       ), emps AS (
         SELECT id, employee_code, name FROM employees WHERE id = ANY($3::uuid[])
       )
       SELECT e.id AS employee_id, e.employee_code, e.name, d.day AS work_date,
              COALESCE(a.status,
                CASE WHEN lr.id IS NOT NULL THEN 'LEAVE' ELSE 'PRESENT' END
              ) AS status
         FROM emps e
         CROSS JOIN days d
         LEFT JOIN attendance a ON a.employee_id = e.id AND a.work_date = d.day
         LEFT JOIN leave_requests lr ON lr.employee_id = e.id AND lr.status = 'APPROVED' AND lr.date_from <= d.day AND lr.date_to >= d.day
        ORDER BY d.day DESC, e.name ASC
        LIMIT $4 OFFSET $5`,
      [from, to, empIds, pageSize, offset]
    )
    return res.json({ data: list.rows, page, pageSize, total })
  } catch (e) { next(e) }
})

// HRW-AUTH-1: Login Endpoint & Flow
routes.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'email and password are required' } });
    }
    const { rows } = await pool.query('SELECT id, email, password_hash, role FROM users WHERE email = $1', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }
    const signCompat = sign as unknown as (p: any, s: any, o?: any) => string;
    const access = signCompat({ sub: user.id, role: user.role }, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL });
    const jti = randomUUID();
    const refresh = signCompat({ sub: user.id, jti }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_TTL });
    const ttlSec = ttlToSeconds(env.JWT_REFRESH_TTL);
    const exp = new Date(Date.now() + ttlSec * 1000);
    await pool.query('INSERT INTO refresh_tokens (jti, user_id, expires_at) VALUES ($1, $2, $3)', [jti, user.id, exp.toISOString()]);
    return res.json({ accessToken: access, refreshToken: refresh });
  } catch (e) {
    next(e);
  }
});

// HRW-EMP-7: Export Employees CSV
routes.get('/employees/export.csv', authGuard('HR'), async (req, res, next) => {
  try {
    // Reuse filters from list endpoint
    const q = (req.query.q || '').toString().trim();
    const status = (req.query.status || '').toString().trim().toUpperCase();
    const includeArchived = String(req.query.includeArchived || '').toLowerCase() === 'true';
    const department = (req.query.department || '').toString().trim();

    const where: string[] = [];
    const params: any[] = [];
    let pi = 1;
    if (q) {
      where.push(`(employee_code ILIKE $${pi} OR name ILIKE $${pi} OR email ILIKE $${pi} OR department ILIKE $${pi} OR title ILIKE $${pi})`);
      params.push(`%${q}%`); pi++;
    }
    if (status && ['ACTIVE','INACTIVE'].includes(status)) {
      where.push(`status = $${pi}`); params.push(status); pi++;
    }
    if (!status && !includeArchived) {
      where.push(`status = 'ACTIVE'`);
    }
    if (department) {
      where.push(`department ILIKE $${pi}`); params.push(`%${department}%`); pi++;
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Sorting (use name asc as a sensible default for CSV)
    const sortRaw = (req.query.sort || 'name').toString().toLowerCase();
    const dirRaw = (req.query.dir || 'asc').toString().toLowerCase();
    const allowedSort: Record<string,string> = { created_at: 'created_at', name: 'name', code: 'employee_code' };
    const sortCol = allowedSort[sortRaw] || 'name';
    const dir = dirRaw === 'desc' ? 'DESC' : 'ASC';

    const { rows } = await pool.query(
      `SELECT employee_code, name, email, phone, department, title, status, join_date, birth_date, created_at
         FROM employees
         ${whereSql}
        ORDER BY ${sortCol} ${dir}`,
      params
    );

    // CSV helpers
    function escapeFormula(s: string) {
      if (!s) return s;
      const c = s[0];
      return (c === '=' || c === '+' || c === '-' || c === '@') ? (`'` + s) : s;
    }
    function toCsvField(v: any): string {
      if (v === null || v === undefined) return '';
      let s = typeof v === 'string' ? v : (v instanceof Date ? v.toISOString() : String(v));
      // Normalize dates (YYYY-MM-DD) for date columns
      if (/^\d{4}-\d{2}-\d{2}T/.test(s)) s = s.slice(0, 10);
      s = escapeFormula(s);
      if (/[",\n\r]/.test(s)) {
        s = '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }

    // Filename with filter context
    function slug(v: string) { return v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40); }
    const ts = new Date();
    const stamp = `${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}_${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}${String(ts.getSeconds()).padStart(2,'0')}`;
    const parts: string[] = [];
    if (q) parts.push(`q_${slug(q)}`);
    if (department) parts.push(`dept_${slug(department)}`);
    if (status) parts.push(`status_${slug(status)}`);
    if (includeArchived) parts.push('archived');
    const fname = `employees_${stamp}${parts.length ? '_' + parts.join('_') : ''}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    // Optionally add BOM for Excel: res.write('\uFEFF');
    // Header row
    res.write(['Code','Name','Email','Phone','Department','Title','Status','Join Date','Birth Date','Created At'].map(toCsvField).join(',') + '\n');
    for (const r of rows) {
      const line = [
        r.employee_code,
        r.name,
        r.email,
        r.phone || '',
        r.department || '',
        r.title || '',
        r.status,
        r.join_date ? String(r.join_date).slice(0,10) : '',
        r.birth_date ? String(r.birth_date).slice(0,10) : '',
        r.created_at ? new Date(r.created_at).toISOString() : ''
      ].map(toCsvField).join(',');
      res.write(line + '\n');
    }
    res.end();
  } catch (e) { next(e) }
});

// HRW-ATT-4: Export Attendance CSV & PDF Summary
routes.get('/attendance/export.csv', authGuard('HR'), async (req, res, next) => {
  try {
    const employeeId = (req.query.employee_id || '').toString().trim();
    const employeeCode = (req.query.employee_code || '').toString().trim();
    const q = (req.query.q || '').toString().trim();
    const from = (req.query.from || '').toString().trim();
    const to = (req.query.to || '').toString().trim();
    const includeComputed = String(req.query.includeComputed || '').toLowerCase() === 'true';
    const includeWeekends = String(req.query.includeWeekends || '').toLowerCase() === 'true';

    // Resolve employee set
    const empWhere: string[] = [];
    const empParams: any[] = [];
    if (employeeId) { empWhere.push(`id = $${empParams.length + 1}`); empParams.push(employeeId); }
    if (employeeCode) { empWhere.push(`employee_code = $${empParams.length + 1}`); empParams.push(employeeCode); }
    if (q) { empWhere.push(`(employee_code ILIKE $${empParams.length + 1} OR name ILIKE $${empParams.length + 1} OR email ILIKE $${empParams.length + 1})`); empParams.push(`%${q}%`); }
    const empRes = await pool.query(
      `SELECT id, employee_code, name FROM employees ${empWhere.length ? 'WHERE ' + empWhere.join(' AND ') : ''} ORDER BY name ASC`,
      empParams
    );
    const emps = empRes.rows as { id: string, employee_code: string, name: string }[];
    const empIds = emps.map(r => r.id);
    if (empIds.length === 0) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="attendance_empty.csv"`);
      res.end('Employee Code,Name,Work Date,Status\n');
      return;
    }

    // CSV helpers
    function escapeFormula(s: string) {
      if (!s) return s;
      const c = s[0];
      return (c === '=' || c === '+' || c === '-' || c === '@') ? (`'` + s) : s;
    }
    function toCsvField(v: any): string {
      if (v === null || v === undefined) return '';
      let s = typeof v === 'string' ? v : (v instanceof Date ? v.toISOString() : String(v));
      if (/^\d{4}-\d{2}-\d{2}T/.test(s)) s = s.slice(0, 10);
      s = escapeFormula(s);
      if (/[",\n\r]/.test(s)) {
        s = '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }
    function slug(v: string) { return v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40); }
    const ts = new Date();
    const stamp = `${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}_${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}${String(ts.getSeconds()).padStart(2,'0')}`;
    const parts: string[] = [];
    if (from && to) parts.push(`${from}_to_${to}`);
    if (includeComputed) parts.push('computed');
    if (includeWeekends) parts.push('weekends');
    if (q) parts.push(`q_${slug(q)}`);
    const fname = `attendance_${stamp}${parts.length ? '_' + parts.join('_') : ''}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);

    // Header row
    res.write(['Employee Code','Name','Work Date','Status'].map(toCsvField).join(',') + '\n');

    if (!includeComputed) {
      // Exceptions-only export (no from/to required; export all filtered exceptions)
      const filters: string[] = [`a.employee_id = ANY($1::uuid[])`];
      const params: any[] = [empIds];
      let pi = 2;
      if (from) { filters.push(`a.work_date >= $${pi++}`); params.push(from); }
      if (to) { filters.push(`a.work_date <= $${pi++}`); params.push(to); }
      const whereSql = `WHERE ${filters.join(' AND ')}`;
      const { rows } = await pool.query(
        `SELECT a.employee_id, e.employee_code, e.name, a.work_date, a.status
           FROM attendance a
           JOIN employees e ON e.id = a.employee_id
           ${whereSql}
          ORDER BY a.work_date DESC, e.name ASC`,
        params
      );
      for (const r of rows) {
        const line = [r.employee_code, r.name, String(r.work_date).slice(0,10), r.status].map(toCsvField).join(',');
        res.write(line + '\n');
      }
      res.end();
      return;
    }

    // Computed view requires from/to
    if (!from || !to) {
      res.status(400);
      res.end('from and to are required when includeComputed=true');
      return;
    }
    const weekendFilter = includeWeekends ? '' : 'AND EXTRACT(DOW FROM d.day) NOT IN (0,6)';
    const { rows } = await pool.query(
      `WITH days AS (
         SELECT day FROM generate_series($1::date, $2::date, interval '1 day') d(day)
         WHERE TRUE ${weekendFilter}
       ), emps AS (
         SELECT id, employee_code, name FROM employees WHERE id = ANY($3::uuid[])
       )
       SELECT e.employee_code, e.name, d.day AS work_date,
              COALESCE(a.status, 'PRESENT') AS status
         FROM emps e
         CROSS JOIN days d
         LEFT JOIN attendance a ON a.employee_id = e.id AND a.work_date = d.day
        ORDER BY d.day DESC, e.name ASC`,
      [from, to, empIds]
    );
    for (const r of rows) {
      const line = [r.employee_code, r.name, String(r.work_date).slice(0,10), r.status].map(toCsvField).join(',');
      res.write(line + '\n');
    }
    res.end();
  } catch (e) { next(e) }
});

routes.get('/attendance/summary.pdf', authGuard('HR'), async (req, res, next) => {
  try {
    const employeeId = (req.query.employee_id || '').toString().trim();
    const employeeCode = (req.query.employee_code || '').toString().trim();
    const q = (req.query.q || '').toString().trim();
    const from = (req.query.from || '').toString().trim();
    const to = (req.query.to || '').toString().trim();
    const includeWeekends = String(req.query.includeWeekends || '').toLowerCase() === 'true';

    if (!from || !to) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'from and to are required' } });
    }

    // Resolve employees
    const empWhere: string[] = [];
    const empParams: any[] = [];
    if (employeeId) { empWhere.push(`id = $${empParams.length + 1}`); empParams.push(employeeId); }
    if (employeeCode) { empWhere.push(`employee_code = $${empParams.length + 1}`); empParams.push(employeeCode); }
    if (q) { empWhere.push(`(employee_code ILIKE $${empParams.length + 1} OR name ILIKE $${empParams.length + 1} OR email ILIKE $${empParams.length + 1})`); empParams.push(`%${q}%`); }
    const empRes = await pool.query(
      `SELECT id, employee_code, name FROM employees ${empWhere.length ? 'WHERE ' + empWhere.join(' AND ') : ''} ORDER BY name ASC`,
      empParams
    );
    const emps = empRes.rows as { id: string, employee_code: string, name: string }[];
    const empIds = emps.map(r => r.id);
    if (empIds.length === 0) {
      return res.status(400).json({ error: { code: 'NO_MATCH', message: 'No employees matched filters' } });
    }

    const weekendFilter = includeWeekends ? '' : 'AND EXTRACT(DOW FROM d.day) NOT IN (0,6)';
    // Aggregate counts by employee and status using exceptions-only model (default PRESENT when no exception)
    const agg = await pool.query(
      `WITH days AS (
         SELECT day FROM generate_series($1::date, $2::date, interval '1 day') d(day)
         WHERE TRUE ${weekendFilter}
       ), emps AS (
         SELECT id, employee_code, name FROM employees WHERE id = ANY($3::uuid[])
       ), joined AS (
         SELECT e.id AS employee_id, e.employee_code, e.name, d.day AS work_date,
                COALESCE(a.status, 'PRESENT') AS status
           FROM emps e
           CROSS JOIN days d
           LEFT JOIN attendance a ON a.employee_id = e.id AND a.work_date = d.day
       )
       SELECT employee_id, employee_code, name, status, COUNT(*)::int AS cnt
         FROM joined
        GROUP BY employee_id, employee_code, name, status
        ORDER BY name ASC, status ASC`,
      [from, to, empIds]
    );

    // Pivot results into per-employee totals
    type Row = { employee_id: string, employee_code: string, name: string, status: string, cnt: number };
    const map = new Map<string, { code: string, name: string, present: number, absent: number, leave: number, half: number, total: number }>();
    for (const r of (agg.rows as Row[])) {
      const key = r.employee_id;
      if (!map.has(key)) map.set(key, { code: r.employee_code, name: r.name, present: 0, absent: 0, leave: 0, half: 0, total: 0 });
      const m = map.get(key)!;
      if (r.status === 'PRESENT') m.present += r.cnt;
      else if (r.status === 'ABSENT') m.absent += r.cnt;
      else if (r.status === 'LEAVE') m.leave += r.cnt;
      else if (r.status === 'HALF_DAY') m.half += r.cnt;
      m.total += r.cnt;
    }

    // PDF
    const PDFDocument = require('pdfkit');
    const doc: any = new PDFDocument({ size: 'A4', margin: 40 });
    const ts = new Date();
    function applyOffset(date: Date, offset: string): Date {
      // offset format "+HH:MM" or "-HH:MM"
      const m = /([+-])(\d{2}):(\d{2})/.exec(offset || '+00:00');
      if (!m) return date;
      const sign = m[1] === '-' ? -1 : 1;
      const h = parseInt(m[2], 10) * sign;
      const mm = parseInt(m[3], 10) * sign;
      const ms = (h * 60 + mm) * 60 * 1000;
      return new Date(date.getTime() + ms);
    }
    function fmtDate(d: Date) {
      const x = applyOffset(d, (env as any).ORG_TZ_OFFSET || '+00:00');
      const y = x.getFullYear();
      const m = String(x.getMonth()+1).padStart(2, '0');
      const day = String(x.getDate()).padStart(2, '0');
      const hh = String(x.getHours()).padStart(2, '0');
      const mi = String(x.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day} ${hh}:${mi}`;
    }

    const fname = `attendance_summary_${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}_${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}${String(ts.getSeconds()).padStart(2,'0')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    doc.pipe(res);

    // Header
    doc.fontSize(16).text('Attendance Summary', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#555').text(`Period: ${from} to ${to}`);
    doc.text(`Org Timezone: UTC${(env as any).ORG_TZ_OFFSET || '+00:00'}`);
    doc.text(`Generated: ${fmtDate(ts)}`);
    doc.fillColor('black');
    doc.moveDown(0.5);

    // Table header
    const colX = 40; const colWidths = [160, 60, 60, 60, 70, 60];
    const headers = ['Employee', 'Present', 'Absent', 'Leave', 'Half-Day', 'Total'];
    let y = doc.y + 6;
    doc.fontSize(11).text(headers[0], colX, y, { width: colWidths[0] });
    for (let i = 1; i < headers.length; i++) {
      doc.text(headers[i], colX + colWidths.slice(0, i).reduce((a,b)=>a+b,0), y, { width: colWidths[i], align: 'right' });
    }
    y = y + 16;
    doc.moveTo(colX, y).lineTo(colX + colWidths.reduce((a,b)=>a+b,0), y).strokeColor('#999').stroke();
    doc.strokeColor('black');

    // Rows (with spacing)
    let totalPresent = 0, totalAbsent = 0, totalLeave = 0, totalHalf = 0, totalDays = 0;
    const rows = Array.from(map.values()).sort((a,b) => a.name.localeCompare(b.name));
    const rowHeight = 18;
    const tableWidth = colWidths.reduce((a,b)=>a+b,0);
    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      y += rowHeight;
      const name = `${r.name} (${r.code})`;
      // optional zebra background
      if (idx % 2 === 1) {
        doc.save().rect(colX, y - rowHeight + 3, tableWidth, rowHeight - 4).fill('#fafafa').restore();
      }
      doc.fontSize(10).fillColor('#000').text(name, colX + 2, y - rowHeight + 6, { width: colWidths[0] - 4 });
      doc.text(String(r.present), colX + colWidths[0], y - rowHeight + 6, { width: colWidths[1], align: 'right' });
      doc.text(String(r.absent), colX + colWidths[0] + colWidths[1], y - rowHeight + 6, { width: colWidths[2], align: 'right' });
      doc.text(String(r.leave), colX + colWidths[0] + colWidths[1] + colWidths[2], y - rowHeight + 6, { width: colWidths[3], align: 'right' });
      doc.text(String(r.half), colX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y - rowHeight + 6, { width: colWidths[4], align: 'right' });
      doc.text(String(r.total), colX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], y - rowHeight + 6, { width: colWidths[5], align: 'right' });

      totalPresent += r.present; totalAbsent += r.absent; totalLeave += r.leave; totalHalf += r.half; totalDays += r.total;

      // Row separator
      doc.moveTo(colX, y + 2).lineTo(colX + tableWidth, y + 2).strokeColor('#eee').stroke();

      if (y > doc.page.height - 80) { doc.addPage(); y = doc.y + 6; }
    }

    // Totals
    y += 12;
    doc.moveTo(colX, y).lineTo(colX + tableWidth, y).strokeColor('#999').stroke();
    y += 6;
    doc.fontSize(11).fillColor('#000').text('TOTAL', colX + 2, y, { width: colWidths[0] - 4 });
    doc.text(String(totalPresent), colX + colWidths[0], y, { width: colWidths[1], align: 'right' });
    doc.text(String(totalAbsent), colX + colWidths[0] + colWidths[1], y, { width: colWidths[2], align: 'right' });
    doc.text(String(totalLeave), colX + colWidths[0] + colWidths[1] + colWidths[2], y, { width: colWidths[3], align: 'right' });
    doc.text(String(totalHalf), colX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y, { width: colWidths[4], align: 'right' });
    doc.text(String(totalDays), colX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], y, { width: colWidths[5], align: 'right' });

    doc.end();
  } catch (e) { next(e) }
});

// HRW-EMP-3: Update employee (partial update)
routes.put('/employees/:id', authGuard('HR'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const b = req.body || {};
    const errors: string[] = [];
    const fields: string[] = [];
    const params: any[] = [];
    let pi = 1;

    function takeStr(key: string, max: number, pattern?: RegExp, msg?: string) {
      if (b[key] === undefined) return;
      const v = String(b[key]).trim();
      if (!v) { fields.push(`${key} = NULL`); return; }
      if (v.length > max) errors.push(`${key} too long (max ${max})`);
      if (pattern && !pattern.test(v)) errors.push(msg || `${key} invalid format`);
      fields.push(`${key} = $${pi}`); params.push(v); pi++;
    }

    function takeEnum(key: string, allowed: string[]) {
      if (b[key] === undefined) return;
      const v = String(b[key]).trim().toUpperCase();
      if (!allowed.includes(v)) errors.push(`${key} must be one of ${allowed.join(', ')}`);
      fields.push(`${key} = $${pi}`); params.push(v); pi++;
    }

    function takeDate(key: string) {
      if (b[key] === undefined) return;
      const v = String(b[key]).trim();
      if (!v) { fields.push(`${key} = NULL`); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) errors.push(`${key} must be YYYY-MM-DD`);
      fields.push(`${key} = $${pi}`); params.push(v); pi++;
    }

    takeStr('employee_code', 20, /^[A-Za-z0-9_\-]{3,20}$/, 'employee_code must be 3-20 chars [A-Za-z0-9_-]');
    takeStr('name', 120);
    takeStr('email', 160, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'email invalid');
    takeStr('phone', 30, /^[0-9+\-()\s]{6,}$/, 'phone must contain at least 6 valid characters (digits, space, +, -, ())');
    takeStr('department', 60);
    takeStr('title', 60);
    takeEnum('status', ['ACTIVE','INACTIVE']);
    takeDate('join_date');
    takeDate('birth_date');

    if (errors.length) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid employee data', details: errors } });
    if (fields.length === 0) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No changes provided' } });

    try {
      const r = await pool.query(
        `UPDATE employees SET ${fields.join(', ')}, updated_at = now() WHERE id = $${pi} RETURNING id, employee_code, name, email, phone, department, title, status, join_date, birth_date, created_at`,
        [...params, id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } });
      return res.json(r.rows[0]);
    } catch (e: any) {
      if (e?.code === '23505') {
        const msg = (e?.detail || '').includes('employee_code')
          ? 'employee_code already exists'
          : (e?.detail || '').includes('email')
          ? 'email already exists'
          : 'duplicate value';
        return res.status(409).json({ error: { code: 'CONFLICT', message: msg } });
      }
      throw e;
    }
  } catch (e) { next(e); }
});

// HRW-EMP-3: Archive (INACTIVE) and Activate (ACTIVE)
routes.patch('/employees/:id/archive', authGuard('HR'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const r = await pool.query(`UPDATE employees SET status = 'INACTIVE', updated_at = now() WHERE id = $1 RETURNING id, status`, [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } });
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

routes.patch('/employees/:id/activate', authGuard('HR'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const r = await pool.query(`UPDATE employees SET status = 'ACTIVE', updated_at = now() WHERE id = $1 RETURNING id, status`, [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } });
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

// HRW-EMP-5: Upload Employee Document (DB)
routes.post('/employees/:id/documents', authGuard('HR'), upload.single('file'), async (req, res, next) => {
  try {
    const employeeId = req.params.id
    const f = req.file
    if (!f) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'file is required' } })
    const allowed = (env.ALLOWED_MIME || '').split(',').map(s => s.trim()).filter(Boolean)
    if (allowed.length && !allowed.includes(f.mimetype)) {
      return res.status(415).json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: `MIME type not allowed: ${f.mimetype}` } })
    }
    // Sanitize filename: keep alnum, dash, underscore, dot
    const base = (f.originalname || 'file').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120)
    const sha = createHash('sha256').update(f.buffer).digest('hex')
    // Ensure employee exists (FK will error otherwise, but nicer message)
    const emp = await pool.query('SELECT id FROM employees WHERE id = $1', [employeeId])
    if (emp.rows.length === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } })
    const ins = await pool.query(
      `INSERT INTO employee_documents (employee_id, filename, mime, size_bytes, sha256, content)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, employee_id, filename, mime, size_bytes, sha256, created_at`,
      [employeeId, base, f.mimetype, f.size, sha, f.buffer]
    )
    res.status(201).json(ins.rows[0])
  } catch (e) { next(e) }
})

// HRW-EMP-6: List/Download/Delete Documents
routes.get('/employees/:id/documents', authGuard('HR'), async (req, res, next) => {
  try {
    const employeeId = req.params.id
    const { rows } = await pool.query(
      `SELECT id, filename, mime, size_bytes, sha256, created_at
         FROM employee_documents
        WHERE employee_id = $1
        ORDER BY created_at DESC`,
      [employeeId]
    )
    res.json({ data: rows })
  } catch (e) { next(e) }
})

routes.get('/employees/:id/documents/:docId/download', authGuard('HR'), async (req, res, next) => {
  try {
    const employeeId = req.params.id
    const docId = req.params.docId
    const { rows } = await pool.query(
      `SELECT id, employee_id, filename, mime, size_bytes, content
         FROM employee_documents
        WHERE id = $1 AND employee_id = $2`,
      [docId, employeeId]
    )
    if (rows.length === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } })
    const r = rows[0]
    const filename = String(r.filename || 'file')

    // Basic audit (best-effort; errors ignored)
    try {
      const user = (req as any).user as { id: string } | undefined
      const userId = user?.id || null
      const ip = (req.headers['x-forwarded-for'] as string) || req.ip
      const ua = (req.headers['user-agent'] as string) || ''
      await pool.query(
        `INSERT INTO document_download_audit (doc_id, employee_id, user_id, ip, user_agent)
         VALUES ($1,$2,$3,$4,$5)`,
        [docId, employeeId, userId, ip, ua]
      )
    } catch {}

    res.setHeader('Content-Type', r.mime)
    if (r.size_bytes) res.setHeader('Content-Length', String(r.size_bytes))
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.send(r.content)
  } catch (e) { next(e) }
})

routes.delete('/employees/:id/documents/:docId', authGuard('HR'), async (req, res, next) => {
  try {
    const employeeId = req.params.id
    const docId = req.params.docId
    const del = await pool.query('DELETE FROM employee_documents WHERE id = $1 AND employee_id = $2 RETURNING id', [docId, employeeId])
    if (del.rows.length === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } })
    res.status(204).end()
  } catch (e) { next(e) }
})

// HRW-RESET-1: Request password reset (OTP)
routes.post('/auth/request-reset', async (req, res, next) => {
  try {
    const email = (req.body?.email || '').toString().trim().toLowerCase()
    // Always 202 to avoid user enumeration
    res.status(202).json({ ok: true })
    if (!email) return
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    if (rows.length === 0) return
    const userId = rows[0].id as string
    // Generate 6-digit OTP
    const n = randomInt(0, 1000000)
    const otp = n.toString().padStart(6, '0')
    const hash = await bcrypt.hash(otp, 10)
    const exp = new Date(Date.now() + env.OTP_TTL_MIN * 60 * 1000)
    await pool.query(
      `INSERT INTO password_reset_requests (user_id, hashed_otp, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, hash, exp.toISOString()]
    )
    // Send the OTP email (or console log if SMTP not set)
    await sendOtpEmail(email, otp)
  } catch (e) {
    next(e)
  }
})

function ttlToSeconds(ttl: string): number {
  const m = /^([0-9]+)([smhd])$/.exec(ttl.trim());
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = m[2];
  switch (unit) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default: return 0;
  }
}

// HRW-AUTH-3: Refresh & Logout
routes.post('/auth/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'refreshToken is required' } });
    }
    let payload: any;
    try {
      payload = verify(refreshToken, env.JWT_REFRESH_SECRET) as any;
    } catch {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' } });
    }
    const jti = payload.jti as string | undefined;
    const userId = payload.sub as string | undefined;
    if (!jti || !userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Malformed refresh token' } });
    }
    const { rows } = await pool.query('SELECT revoked_at, expires_at FROM refresh_tokens WHERE jti = $1 AND user_id = $2', [jti, userId]);
    if (rows.length === 0) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Refresh token not recognized' } });
    }
    const row = rows[0];
    if (row.revoked_at || new Date(row.expires_at) < new Date()) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Refresh token is revoked or expired' } });
    }
    // Rotation: revoke old and issue new
    await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE jti = $1', [jti]);
    const newJti = randomUUID();
    // Load current role to embed in access token
    const userRow = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    const role = userRow.rows?.[0]?.role;
    const signCompat = sign as unknown as (p: any, s: any, o?: any) => string;
    const access = signCompat({ sub: userId, role }, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL });
    const refresh = signCompat({ sub: userId, jti: newJti }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_TTL });
    const ttlSec = ttlToSeconds(env.JWT_REFRESH_TTL);
    const exp = new Date(Date.now() + ttlSec * 1000);
    await pool.query('INSERT INTO refresh_tokens (jti, user_id, expires_at) VALUES ($1, $2, $3)', [newJti, userId, exp.toISOString()]);
    return res.json({ accessToken: access, refreshToken: refresh });
  } catch (e) {
    next(e);
  }
});

routes.post('/auth/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'refreshToken is required' } });
    }
    let payload: any;
    try {
      payload = verify(refreshToken, env.JWT_REFRESH_SECRET) as any;
    } catch {
      // Logout should be idempotent; respond 200 even if invalid
      return res.json({ ok: true });
    }
    const jti = payload.jti as string | undefined;
    const userId = payload.sub as string | undefined;
    if (!jti || !userId) return res.json({ ok: true });
    await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE jti = $1 AND user_id = $2', [jti, userId]);
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// HRW-RESET-2: Verify OTP -> reset token
routes.post('/auth/verify-reset-otp', async (req, res, next) => {
  try {
    const email = (req.body?.email || '').toString().trim().toLowerCase()
    const otp = (req.body?.otp || '').toString().trim()
    if (!email || !otp) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'email and otp are required' } })
    }
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: { code: 'INVALID_OTP', message: 'Invalid code' } })
    }
    const userId = userRes.rows[0].id as string
    const reqRes = await pool.query(
      `SELECT * FROM password_reset_requests
       WHERE user_id = $1 AND used_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    )
    if (reqRes.rows.length === 0) {
      return res.status(400).json({ error: { code: 'INVALID_OTP', message: 'Invalid code' } })
    }
    const pr = reqRes.rows[0]
    const now = new Date()
    if (new Date(pr.expires_at) < now) {
      return res.status(401).json({ error: { code: 'OTP_EXPIRED', message: 'Code expired' } })
    }
    if (pr.attempts >= env.OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ error: { code: 'OTP_LOCKED', message: 'Too many attempts. Try again later.' } })
    }
    const ok = await bcrypt.compare(otp, pr.hashed_otp)
    if (!ok) {
      await pool.query('UPDATE password_reset_requests SET attempts = attempts + 1 WHERE id = $1', [pr.id])
      const attempts = pr.attempts + 1
      if (attempts >= env.OTP_MAX_ATTEMPTS) {
        return res.status(429).json({ error: { code: 'OTP_LOCKED', message: 'Too many attempts. Try again later.' } })
      }
      return res.status(401).json({ error: { code: 'INVALID_OTP', message: 'Invalid code' } })
    }
    // Mark request used and create reset token
    await pool.query('UPDATE password_reset_requests SET used_at = now() WHERE id = $1', [pr.id])
    const tokenId = randomUUID()
    const secret = randomUUID().replace(/-/g, '')
    const tokenHash = await bcrypt.hash(secret, 10)
    const ttlMs = env.RESET_TOKEN_TTL_MIN * 60 * 1000
    const exp = new Date(Date.now() + ttlMs)
    await pool.query(
      `INSERT INTO password_reset_tokens (id, user_id, request_id, hashed_token, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [tokenId, userId, pr.id, tokenHash, exp.toISOString()]
    )
    const resetToken = `${tokenId}.${secret}`
    return res.json({ resetToken, expiresAt: exp.toISOString() })
  } catch (e) {
    next(e)
  }
})

// HRW-RESET-3: Reset password
routes.post('/auth/reset', async (req, res, next) => {
  try {
    const resetToken = (req.body?.resetToken || '').toString().trim()
    const newPassword = (req.body?.newPassword || '').toString()
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'resetToken and newPassword are required' } })
    }
    // Password policy: min 8, upper, lower, digit
    const policy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
    if (!policy.test(newPassword)) {
      return res.status(400).json({ error: { code: 'PASSWORD_WEAK', message: 'Password must be 8+ chars with upper, lower, digit' } })
    }
    const parts = resetToken.split('.')
    if (parts.length !== 2) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid reset token' } })
    }
    const [tokenId, secret] = parts
    const tRes = await pool.query('SELECT * FROM password_reset_tokens WHERE id = $1', [tokenId])
    if (tRes.rows.length === 0) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid reset token' } })
    }
    const t = tRes.rows[0]
    if (t.used_at || new Date(t.expires_at) < new Date()) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Token expired or used' } })
    }
    const ok = await bcrypt.compare(secret, t.hashed_token)
    if (!ok) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid reset token' } })
    }
    const hash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, t.user_id])
    await pool.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [tokenId])
    return res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})
// Example protected routes to validate HRW-AUTH-2
routes.get('/me', authGuard(), async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No user in context' } });
    const { rows } = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// Preferences (theme, locale, timezone)
routes.get('/me/preferences', authGuard(), async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const { rows } = await pool.query('SELECT preferences FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } });
    res.json(rows[0].preferences || {});
  } catch (e) {
    next(e);
  }
});

routes.put('/me/preferences', authGuard(), async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const prefs = req.body || {};
    if (prefs.theme && !['light', 'dark'].includes(prefs.theme)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'theme must be light or dark' } });
    }
    if (prefs.textScale !== undefined) {
      const n = Number(prefs.textScale)
      if (!Number.isFinite(n) || n < 90 || n > 120) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'textScale must be a number between 90 and 120' } })
      }
      prefs.textScale = Math.round(n)
    }
    if (prefs.language !== undefined) {
      const lang = String(prefs.language).trim()
      if (!/^[A-Za-z]{2,3}(-[A-Za-z]{2})?$/i.test(lang)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'language must be like en-US' } })
      }
      prefs.language = lang
    }
    if (prefs.timezone !== undefined) {
      const tz = String(prefs.timezone).trim()
      if (!tz) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'timezone is required when provided' } })
      }
      prefs.timezone = tz
    }

    const merged = await pool.query(
      `UPDATE users
         SET preferences = COALESCE(preferences, '{}'::jsonb) || $2::jsonb
       WHERE id = $1
       RETURNING preferences`,
      [userId, JSON.stringify(prefs)]
    );
    res.json(merged.rows[0].preferences || {});
  } catch (e) {
    next(e);
  }
});

// HRW-EMP-1: Create employee (ADMIN/HR)
routes.post('/employees', authGuard('HR'), async (req, res, next) => {
  try {
    const b = req.body || {};
    const errors: string[] = [];
    function reqStr(key: string, max: number) {
      const v = (b[key] ?? '').toString().trim();
      if (!v) errors.push(`${key} is required`);
      else if (v.length > max) errors.push(`${key} too long (max ${max})`);
      return v;
    }
    function optStr(key: string, max: number) {
      const v = b[key];
      if (v === undefined || v === null) return undefined;
      const s = (v ?? '').toString().trim();
      if (s.length > max) errors.push(`${key} too long (max ${max})`);
      return s;
    }
    const employee_code = reqStr('employee_code', 20);
    const name = reqStr('name', 120);
    const email = reqStr('email', 160).toLowerCase();
    const phone = optStr('phone', 30);
    const department = optStr('department', 60);
    const title = optStr('title', 60);
    let status = (b['status'] ?? 'ACTIVE').toString().toUpperCase();
    const joinDateStr = optStr('join_date', 20);
    const rawBirth = b['birth_date'] ?? b['birthday'];

    // Patterns
    if (employee_code && !/^[A-Za-z0-9_\-]{3,20}$/.test(employee_code)) {
      errors.push('employee_code must be 3-20 chars (letters, numbers, _ or -)');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('email is invalid');
    }
    if (phone && !/^[0-9+\-()\s]{6,}$/.test(phone)) {
      errors.push('phone must contain at least 6 valid characters (digits, space, +, -, ())');
    }
    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      errors.push('status must be ACTIVE or INACTIVE');
    }
    let join_date: string | null = null;
    let birth_date: string | null = null;
    if (joinDateStr) {
      const m = /^\d{4}-\d{2}-\d{2}$/.exec(joinDateStr);
      if (!m) errors.push('join_date must be YYYY-MM-DD');
      else join_date = joinDateStr;
    }
    if (rawBirth !== undefined && rawBirth !== null) {
      const s = String(rawBirth).trim();
      if (s) {
        const m2 = /^\d{4}-\d{2}-\d{2}$/.exec(s);
        if (!m2) errors.push('birth_date must be YYYY-MM-DD');
        else birth_date = s;
      }
    }

    if (errors.length) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid employee data', details: errors } });
    }

    try {
      const r = await pool.query(
        `INSERT INTO employees (employee_code, name, email, phone, department, title, status, join_date, birth_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, employee_code, name, email, phone, department, title, status, join_date, birth_date, created_at`,
        [employee_code, name, email, phone ?? null, department ?? null, title ?? null, status, join_date, birth_date]
      );
      return res.status(201).json(r.rows[0]);
    } catch (e: any) {
      if (e?.code === '23505') {
        // unique_violation
        const msg = (e?.detail || '').includes('employee_code')
          ? 'employee_code already exists'
          : (e?.detail || '').includes('email')
          ? 'email already exists'
          : 'duplicate value';
        return res.status(409).json({ error: { code: 'CONFLICT', message: msg } });
      }
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

// HRW-EMP-2: List employees (basic pagination)
routes.get('/employees', authGuard('HR'), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const pageSizeRaw = Number(req.query.pageSize || 10) || 10;
    const pageSize = Math.max(1, Math.min(100, pageSizeRaw));
    const offset = (page - 1) * pageSize;

    const q = (req.query.q || '').toString().trim();
    const status = (req.query.status || '').toString().trim().toUpperCase();
    const includeArchived = String(req.query.includeArchived || '').toLowerCase() === 'true';
    const department = (req.query.department || '').toString().trim();

    const where: string[] = [];
    const params: any[] = [];
    let pi = 1;
    if (q) {
      where.push(`(employee_code ILIKE $${pi} OR name ILIKE $${pi} OR email ILIKE $${pi} OR department ILIKE $${pi} OR title ILIKE $${pi})`);
      params.push(`%${q}%`); pi++;
    }
    if (status && ['ACTIVE','INACTIVE'].includes(status)) {
      where.push(`status = $${pi}`); params.push(status); pi++;
    }
    // If no explicit status filter and not including archived, default to ACTIVE only
    if (!status && !includeArchived) {
      where.push(`status = 'ACTIVE'`);
    }
    if (department) {
      where.push(`department ILIKE $${pi}`); params.push(`%${department}%`); pi++;
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await pool.query(`SELECT COUNT(*)::int AS c FROM employees ${whereSql}`, params);
    const total = countRes.rows[0]?.c || 0;

    // Sorting
    const sortRaw = (req.query.sort || 'created_at').toString().toLowerCase();
    const dirRaw = (req.query.dir || 'asc').toString().toLowerCase();
    const allowedSort: Record<string,string> = { created_at: 'created_at', name: 'name', code: 'employee_code' };
    const sortCol = allowedSort[sortRaw] || 'created_at';
    const dir = dirRaw === 'desc' ? 'DESC' : 'ASC';

    const listRes = await pool.query(
      `SELECT id, employee_code, name, email, phone, department, title, status, join_date, birth_date, created_at
         FROM employees
         ${whereSql}
        ORDER BY ${sortCol} ${dir}
        LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, pageSize, offset]
    );

    res.json({ data: listRes.rows, page, pageSize, total });
  } catch (e) {
    next(e);
  }
});

// HRW-SET-1: Profile view/update
// Allowed profile fields: fullName, phone, title (all optional strings)
routes.get('/me/profile', authGuard(), async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const { rows } = await pool.query('SELECT profile FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } });
    res.json(rows[0].profile || {});
  } catch (e) {
    next(e);
  }
});

routes.put('/me/profile', authGuard(), async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const body = req.body || {};
    const out: any = {};
    const errors: string[] = [];

    function takeStr(key: string, max: number, pattern?: RegExp, msg?: string) {
      if (body[key] === undefined) return;
      const v = String(body[key]).trim();
      if (!v) { out[key] = ''; return; }
      if (v.length > max) errors.push(`${key} too long (max ${max})`);
      if (pattern && !pattern.test(v)) errors.push(msg || `${key} invalid format`);
      out[key] = v;
    }

    takeStr('fullName', 100);
    // Phone: allow digits, spaces, +, -, parentheses
    takeStr('phone', 30, /^[0-9+\-()\s]{6,}$/,
      'phone must contain at least 6 valid characters (digits, space, +, -, ())');
    takeStr('title', 60);

    if (errors.length) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid profile data', details: errors } });
    }

    const merged = await pool.query(
      `UPDATE users
         SET profile = COALESCE(profile, '{}'::jsonb) || $2::jsonb
       WHERE id = $1
       RETURNING profile`,
      [userId, JSON.stringify(out)]
    );
    res.json(merged.rows[0].profile || {});
  } catch (e) {
    next(e);
  }
});


// HRW-DASH-3: Birthdays & Work Anniversaries (this month)
routes.get('/dashboard/celebrations', authGuard('HR'), async (_req, res, next) => {
  try {
    const birthdays = await pool.query(
      `SELECT id, name, email, birth_date,
              EXTRACT(DAY FROM birth_date)::int AS day
         FROM employees
        WHERE birth_date IS NOT NULL
          AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
        ORDER BY day ASC, name ASC`
    );
    const anniversaries = await pool.query(
      `SELECT id, name, email, join_date,
              EXTRACT(DAY FROM join_date)::int AS day,
              EXTRACT(YEAR FROM AGE(CURRENT_DATE, join_date))::int AS years
         FROM employees
        WHERE join_date IS NOT NULL
          AND EXTRACT(MONTH FROM join_date) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND AGE(CURRENT_DATE, join_date) >= INTERVAL '1 year'
        ORDER BY day ASC, name ASC`
    );
    res.json({ birthdays: birthdays.rows, anniversaries: anniversaries.rows });
  } catch (e) { next(e) }
});routes.get('/admin/ping', authGuard('ADMIN'), (_req, res) => {
  res.json({ ok: true, scope: 'ADMIN' });
});

// Settings: change password (authenticated)
routes.post('/me/change-password', authGuard(), async (req, res, next) => {
  try {
    const userId = (req as any).user?.id
    const { currentPassword, newPassword } = req.body || {}
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'currentPassword and newPassword are required' } })
    }
    const policy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
    if (!policy.test(newPassword)) {
      return res.status(400).json({ error: { code: 'PASSWORD_WEAK', message: 'Password must be 8+ chars with upper, lower, digit' } })
    }
    const row = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId])
    if (row.rows.length === 0) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } })
    }
    const ok = await bcrypt.compare(currentPassword, row.rows[0].password_hash)
    if (!ok) {
      return res.status(400).json({ error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } })
    }
    const hash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId])
    return res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})


