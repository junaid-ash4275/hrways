#!/usr/bin/env node
import 'dotenv/config'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function pad(n, w = 3) {
  return String(n).padStart(w, '0')
}

function dateToYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function randomDateBetween(from, to) {
  const start = from.getTime()
  const end = to.getTime()
  const x = start + Math.floor(Math.random() * (end - start + 1))
  return new Date(x)
}

async function main() {
  const depts = ['HR', 'IT', 'Finance', 'Sales', 'Operations']
  const titles = ['Analyst', 'Manager', 'Coordinator', 'Engineer', 'Specialist']

  const now = new Date()
  const twoYearsAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 730)
  const birthFrom = new Date('1980-01-01')
  const birthTo = new Date('1998-12-31')

  const total = 60
  let inserted = 0
  for (let i = 1; i <= total; i++) {
    const code = `SEED-${pad(i)}`
    const name = `Seed User ${i}`
    const email = `seed${i}@hrways.local`
    const phone = `+1 555 000 ${pad(i, 4)}`
    const department = depts[(i - 1) % depts.length]
    const title = titles[(i - 1) % titles.length]
    const status = i % 10 === 0 ? 'INACTIVE' : 'ACTIVE'
    const join_date = dateToYMD(randomDateBetween(twoYearsAgo, now))
    const birth_date = dateToYMD(randomDateBetween(birthFrom, birthTo))

    try {
      await pool.query(
        `INSERT INTO employees (employee_code, name, email, phone, department, title, status, join_date, birth_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (employee_code) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           department = EXCLUDED.department,
           title = EXCLUDED.title,
           status = EXCLUDED.status,
           join_date = EXCLUDED.join_date,
           birth_date = EXCLUDED.birth_date
        `,
        [code, name, email, phone, department, title, status, join_date, birth_date]
      )
      inserted++
    } catch (e) {
      // Ignore unique email conflicts if any; continue
      // eslint-disable-next-line no-console
      console.warn(`Skip ${code}: ${e.message}`)
    }
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded/updated ${inserted} employees.`)
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(async () => { await pool.end() })

