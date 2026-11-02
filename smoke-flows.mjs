// Smoke test alur — HANYA lewat HTTP, tanpa akses database langsung.
// Jalankan: node smoke-flows.mjs [baseUrl] [scannerToken]
//   scannerToken opsional; bila diisi, alur scan penuh ikut diuji.
const BASE = process.argv[2] || 'http://localhost:3001'
const TOKEN = process.argv[3] || ''

const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// 1. Route publik vs protected
for (const [route, expect] of [
  ['/login', 200],
  ['/student', 200],
  ['/student/', 308],
  ['/', 307],
  ['/rekap', 307],
  ['/pertemuan', 307],
  ['/mahasiswa', 307],
  ['/seating', 307],
  ['/semester', 307],
  ['/presensi/abc', 307],
]) {
  const res = await fetch(`${BASE}${route}`, { redirect: 'manual' })
  check(`route ${route} -> ${expect}`, res.status === expect, `status=${res.status}`)
}

// 2. Endpoint debug harus menolak akses anonim
for (const route of ['/api/debug', '/api/debug/rekap?student_name=a']) {
  const res = await fetch(`${BASE}${route}`, { redirect: 'manual' })
  check(`${route} menolak anonim`, res.status === 307 || res.status === 401 || res.status === 404, `status=${res.status}`)
}

// 3. /api/scan validasi input
{
  const res = await fetch(`${BASE}/api/scan`)
  check('GET /api/scan tanpa token -> 400', res.status === 400, `status=${res.status}`)
}
{
  const res = await fetch(`${BASE}/api/scan?token=tidak-ada-sama-sekali`)
  check('GET /api/scan token ngawur -> 404', res.status === 404, `status=${res.status}`)
}
{
  const res = await fetch(`${BASE}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'x'.repeat(200), no_regis: '123' }),
  })
  check('POST /api/scan token kepanjangan -> 400', res.status === 400, `status=${res.status}`)
}

// 4. /api/student
{
  const res = await fetch(`${BASE}/api/student`)
  check('GET /api/student tanpa query -> 400', res.status === 400, `status=${res.status}`)
}
{
  const res = await fetch(`${BASE}/api/student?query=ZZZ9999999`)
  check('GET /api/student nim ngawur -> 404', res.status === 404, `status=${res.status}`)
}

// 5. verify-pin
{
  const res = await fetch(`${BASE}/api/scan/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'tidak-ada', pin: '000000' }),
  })
  check('POST verify-pin token ngawur -> 404', res.status === 404, `status=${res.status}`)
}

// 6. Cron endpoint merespons (di dev tidak butuh secret)
{
  const res = await fetch(`${BASE}/api/cron/auto-close`)
  const d = await res.json().catch(() => ({}))
  check('/api/cron/auto-close merespons', res.status === 200, `status=${res.status} msg=${String(d.message).slice(0, 60)}`)
}

// 7. Alur scan penuh (hanya bila token diberikan)
if (TOKEN) {
  {
    const res = await fetch(`${BASE}/api/scan?token=${encodeURIComponent(TOKEN)}`)
    const d = await res.json().catch(() => ({}))
    check('GET /api/scan token valid -> 200', res.status === 200 && !!d.meeting,
      `status=${res.status} requires_pin=${d.requires_pin} recent=${d.recent?.length} counts=${JSON.stringify(d.counts)}`)
  }
  {
    const res = await fetch(`${BASE}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN, no_regis: 'ZZZ9999999' }),
    })
    const d = await res.json().catch(() => ({}))
    check('POST /api/scan nim ngawur', res.status === 403 || res.status === 404,
      `status=${res.status} error="${String(d.error).slice(0, 60)}"`)
  }
} else {
  console.log('SKIP  alur scan penuh (token tidak diberikan)')
}

const failed = results.filter((r) => !r.ok)
console.log(`\n=== ${results.length - failed.length}/${results.length} PASS ===`)
if (failed.length) {
  console.log('GAGAL:')
  failed.forEach((f) => console.log(' -', f.name, '|', f.detail))
  process.exitCode = 1
}
