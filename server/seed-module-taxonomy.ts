/**
 * Beispiel-Daten-Seed für die CourseWeaver-Ansichten Modules + Taxonomy
 * (data-model-comparison-Schema), idempotent:
 *
 *  1. modules: legacy-Felder (title/credits/…) → code, name, creditPoints,
 *     contactHours, selfStudyHours, description, url
 *  2. competencies: frameworkId 'cf-standard', name aus title, Kategorie/Topic
 *     plausibel hergeleitet; bei < 12 Einträgen plausible Beispiele
 *  3. proofs_of_competency: bei < 12 Einträgen plausible Nachweise je Modul
 */
export {}

const API = process.env.SEED_API_URL ?? 'http://localhost:3200/api'

const PLAUSIBLE_COMPS: Array<{ name: string; category: string; topic: string; level: string }> = [
  { name: 'Analytisches & kritisches Denken', category: 'Professional', topic: 'Disciplinary', level: 'R' },
  { name: 'Datengetriebene Entscheidungsfindung', category: 'Digital', topic: 'Methodological', level: 'R' },
  { name: 'Leadership & Teamführung', category: 'Professional', topic: 'Personal', level: 'M' },
  { name: 'Sustainable Business Practice', category: 'Sustainable', topic: 'Disciplinary', level: 'R' },
  { name: 'Business Modelling & Strategy', category: 'Entrepreneurial', topic: 'Disciplinary', level: 'M' },
  { name: 'Kommunikation & Verhandlungsführung', category: 'Professional', topic: 'Personal', level: 'I' },
  { name: 'Entrepreneurial Thinking & Innovation', category: 'Entrepreneurial', topic: 'Personal', level: 'R' },
  { name: 'Ethik & Integrität im Management', category: 'Professional', topic: 'Personal', level: 'I' },
  { name: 'IT-Systems Thinking', category: 'Digital', topic: 'Disciplinary', level: 'I' },
  { name: 'Projektmanagement', category: 'Professional', topic: 'Methodological', level: 'R' },
  { name: 'Markt- und Kundenverständnis', category: 'Entrepreneurial', topic: 'Disciplinary', level: 'I' },
  { name: 'Lifelong Learning & Selbstführung', category: 'Professional', topic: 'Personal', level: 'M' },
]

function slug(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28)
}

function codeFor(m: any, i: number): string {
  if (typeof m.code === 'string' && m.code) return m.code
  const src = String(m.title ?? m.name ?? '')
  const initials = src.split(/[\s:]+/).filter(Boolean).slice(0, 3).map((w: string) => w[0]?.toUpperCase() ?? '').join('')
  let prefix = String(m.program_id ?? m.program ?? m.studyProgramIds?.[0] ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
  if (!prefix) prefix = initials || 'MOD'
  return `${prefix}-${String(101 + i).padStart(3, '0')}`
}

async function get<T>(table: string): Promise<T> {
  const res = await fetch(`${API}/${table}`)
  if (!res.ok) throw new Error(`GET ${table}: ${res.status}`)
  return (await res.json()) as T
}

async function put(table: string, row: any): Promise<void> {
  const id = row.id ?? row._id
  const res = await fetch(`${API}/${table}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`PUT ${table}/${id}: ${res.status} ${t.slice(0, 160)}`)
  }
}

async function main() {
  console.log(`[seed-examples] API: ${API}`)

  // ── 1) Modules: Legacy → normiertes Schema anreichern ──────
  const modules = await get<any[]>('modules') ?? []
  let mPatched = 0
  modules.forEach((m, i) => {
    const enrich = (!m.code || !m.name) as boolean
    if (!enrich) return
    const title = String(m.title ?? m.name ?? '')
    const credits = Number(m.credits ?? m.creditPoints ?? 3)
    m.code = codeFor(m, i)
    m.name = title || m.code
    m.creditPoints = credits
    m.contactHours = Number(m.contactHours ?? (credits === 6 ? 42 : 21)) || 42
    m.selfStudyHours = Number(m.selfStudyHours ?? Math.max(0, 30 * credits - (m.contactHours as number))) || 138
    m.description = m.description ?? `Modul '${title}' im Rahmen von ${String(m.program_id ?? 'Programm')}${m.semester ? ', Semester ' + m.semester : ''}.`
    m.url = m.url ?? `https://bfh.ch/curriculum/${slug(title) || i}`
    void put('modules', m)
    mPatched++
  })
  await Promise.all([]) // flush (ESM sequential writes are PUT'ed above)
  console.log(`[seed] modules: ${modules.length} (angereichert: ${mPatched})`)

  // ── 2) Competencies ─────────────────────────────────────────
  const competencies = await get<any[]>('competencies') ?? []
  let cChanged = 0
  await Promise.all((competencies ?? []).map(async (c) => {
    if (c.frameworkId) return
    c.frameworkId = 'cf-standard'
    c.name = c.name ?? c.title ?? 'Unnamed Competency'
    c.category = c.category ?? 'Professional'
    c.topic = c.topic ?? 'Disciplinary'
    c.level = c.level ?? 'I'
    c.order = c.order ?? 0
    await put('competencies', c)
    cChanged++
  }))
  const byName = new Set(competencies.map(c => String(c.name ?? c.title)))
  let order = competencies.length + mPatched
  for (const spec of PLAUSIBLE_COMPS) {
    if (competencies.length >= 12) break
    if (byName.has(spec.name)) continue
    order++ // Reihenfolge innerhalb des Rahmens (Kap. 15.1)
    const row = { id: `comp-${slug(spec.name)}`, frameworkId: 'cf-standard', order, name: spec.name, category: spec.category, topic: spec.topic, level: spec.level }
    await put('competencies', row)
    competencies.push(row)
    cChanged++
  }
  console.log(`[seed] competencies: ${competencies.length} (neu/angepasst: ${cChanged})`)

  // ── 3) Proofs of Competency ─────────────────────────────────
  const proofs = await get<any[]>('proofs_of_competency') ?? []
  let pAdded = 0
  if (proofs.length < 6) {
    for (const [i, m] of modules.entries()) {
      if (proofs.length >= 12) break
      const name = String(m.title ?? m.name ?? '')
      if (!name) continue
      const fmt: string[] = i % 2 === 0 ? ['written', 'freeText'] : ['oral', 'multipleChoice']
      const proof = {
        id: `pr-${slug(name)}-${i}`,
        name: `Leistungsnachweis: ${name}`,
        description: `Kompetenznachweis für Modul '${name}'.`,
        answerFormats: fmt,
        assignmentScope: i % 2 === 0 ? 'individual' : 'group',
        durationMinutes: fmt[0] === 'oral' ? 30 : 120,
        competencyIds: [],
      }
      await put('proofs_of_competency', proof)
      proofs.push(proof)
      pAdded++
    }
  }
  console.log(`[seed] proofs_of_competency: ${proofs.length} (neu: ${pAdded})`)
  console.log('[seed] fertig — Modules/Taxonomy-Ansichten haben plausible Beispieldaten.')
}

main().catch(err => {
  console.error('seed-module-taxonomy failed:', err.message)
  process.exit(1)
})
