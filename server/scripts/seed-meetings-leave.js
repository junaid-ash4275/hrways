#!/usr/bin/env node
import 'dotenv/config'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function iso(d) { return d.toISOString() }

async function pickEmployeeIds(limit = 10) {
  const { rows } = await pool.query(`SELECT id FROM employees WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT $1`, [limit])
  return rows.map(r => r.id)
}

async function getOrganizerId() {
  const r = await pool.query(`SELECT id FROM users WHERE role IN ('HR','ADMIN') ORDER BY role='HR' DESC LIMIT 1`)
  if (r.rows.length) return r.rows[0].id
  // Create a fallback HR if none
  const email = 'hr-calendar@hrways.local'
  const pass = 'ChangeMe123'
  // Minimal insert without bcrypt; assume login not needed for seed
  const { rows } = await pool.query(`INSERT INTO users(email, password_hash, role) VALUES ($1, $2, 'HR') RETURNING id`, [email, pass])
  return rows[0].id
}

async function seedMeetings() {
  const today = startOfDay(new Date())
  const items = [
    { title: 'Weekly Standup', start: addDays(today, 0), startH: 9, durH: 1, status: 'SCHEDULED' },
    { title: '1:1 Sync', start: addDays(today, 1), startH: 11, durH: 1, status: 'SCHEDULED' },
    { title: 'Finance Review', start: addDays(today, 2), startH: 15, durH: 2, status: 'DONE' },
    { title: 'Town Hall (Cancelled)', start: addDays(today, 3), startH: 13, durH: 1, status: 'CANCELLED' },
  ]
  const organizerId = await getOrganizerId()
  // Introspect meetings columns
  const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='meetings'`)
  const hasCreatedBy = cols.rows.some(r => r.column_name === 'created_by')
  const hasOrganizer = cols.rows.some(r => r.column_name === 'organizer_user_id')
  let inserted = 0
  for (const it of items) {
    const s = new Date(it.start); s.setHours(it.startH, 0, 0, 0)
    const e = new Date(s.getTime() + it.durH * 3600 * 1000)
    const fields = ['title','start_at','end_at','status']
    const values = [it.title, iso(s), iso(e), it.status]
    if (hasCreatedBy) { fields.push('created_by'); values.push(organizerId) }
    if (hasOrganizer) { fields.push('organizer_user_id'); values.push(organizerId) }
    const placeholders = fields.map((_, i) => `$${i+1}`).join(',')
    await pool.query(`INSERT INTO meetings (${fields.join(',')}) VALUES (${placeholders})`, values)
    inserted++
  }
  console.log(`Seeded meetings: ${inserted}`)
}

async function seedLeaves() {
  const ids = await pickEmployeeIds(5)
  if (ids.length === 0) { console.log('No employees to create leaves for.'); return }
  const today = startOfDay(new Date())
  const leaves = [
    { employee_id: ids[0], from: today, to: addDays(today, 1), status: 'APPROVED' },
    { employee_id: ids[1] || ids[0], from: addDays(today, 2), to: addDays(today, 3), status: 'PENDING' },
    { employee_id: ids[2] || ids[0], from: addDays(today, 7), to: addDays(today, 9), status: 'PENDING' },
  ]
  let inserted = 0
  const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='leave_requests'`)
  const hasType = cols.rows.some(r => r.column_name === 'type')
  for (const lv of leaves) {
    const fields = ['employee_id','date_from','date_to','status']
    const values = [lv.employee_id, iso(lv.from), iso(lv.to), lv.status]
    if (hasType) { fields.push('type'); values.push('ANNUAL') }
    const placeholders = fields.map((_, i) => `$${i+1}`).join(',')
    await pool.query(`INSERT INTO leave_requests (${fields.join(',')}) VALUES (${placeholders})`, values)
    inserted++
  }
  console.log(`Seeded leave requests: ${inserted}`)
}

async function main() {
  await seedMeetings()
  await seedLeaves()
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(async () => { await pool.end() })
