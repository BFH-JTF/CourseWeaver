/**
 * Beispiel-Daten für die neue "Modules"-Ansicht (Dozierenden-individualisiert):
 *   Pro Modul × Learning-Cycle (LC1–LC6) wird ein Row in `lc_contents`
 *   erzeugt (Learning Goals, Inhalt, Kompetenzen, Methoden):
 *   - learningGoals/mainContent kommen aus curriculum_modules (echte Excel-Daten)
 *   - competencies: Beispiel-mapping gegen die kompetency-Tabelle (Rotationslogik)
 *   - methods: tokenisiert aus `didactics`, mit Toolkit-Dropdown-Vorgaben
 */
export {}

const API = process.env.SEED_API_URL ?? 'http://localhost:3200/api'

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
  if (!res.ok) throw new Error(`PUT ${table}/${id}: ${res.status} ${await res.text()}`)
}

// Toolkit for the "Wiederkehrende Elemente"-Dropdown in der LC-Tabelle
const METHODS_TOOLKIT = [
  'Lecture (Input)', 'Case Study', 'Gruppenarbeit', 'Flip Teaching',
  'Diskussion / Debrief', 'Workshop', 'Selbststudium (Podcast/Lesetext)',
  'Selbsttest & Feedback', 'Peer Review', 'Online-Übung / Simulation',
  'Exkursion', 'Präsentation',
]

const COMPETENCY_POOL = (comps: any[]) => comps.map(c => String(c.id ?? c._id))

async function main() {
  console.log(`[seed-lc-contents] API: ${API}`)
  const [curriculumModules, comps, existing] = await Promise.all([
    get<any[]>('curriculum_modules'),
    get<any[]>('competencies'),
    get<any[]>('lc_contents'),
  ])
  console.log(`modules: ${curriculumModules.length} · competencies: ${comps.length} · existing lc_contents: ${existing.length}`)

  const competencyIds = COMPETENCY_POOL(comps ?? [])

  // Rotations-Vorlagen je LC (Wiederkehrende Elemente, methodisch):
  const methodTemplate = (lcNumber: number): string[] => {
    switch (lcNumber) {
      case 1: return ['Lecture (Input)', 'Selbststudium (Podcast/Lesetext)', 'Selbsttest & Feedback']
      case 2: return ['Case Study', 'Diskussion / Debrief']
      case 3: return ['Gruppenarbeit', 'Online-Übung / Simulation']
      case 4: return ['Workshop', 'Peer Review']
      case 5: return ['Gruppenarbeit', 'Diskussion / Debrief', 'Peer Review']
      default: return ['Präsentation', 'Exkursion']
    }
  }

  let written = 0
  for (const mod of curriculumModules) {
    const moduleId = String(mod.id ?? mod._id)
    const cycles = mod.learningCycles ?? []
    for (const [idx, lc] of cycles.entries()) {
      const lcNumber = Number(lc.number ?? lc.lcNumber ?? lc.sourceRow ?? idx + 1)
      const id = `content-${moduleId}-lc${lcNumber}`
      if (existing.some(e => e.id === id)) continue

      // plausible Kompetenzen-Sets je LC (tiers via LC-Nummer)
      const cg = _fields(id, lcNumber, competencyIds.length).map(i => competencyIds[i]).filter(Boolean)
      const compSet = cg.length ? cg : competencyIds.slice(0, 2)

      const row = {
        id,
        moduleId,
        lcNumber,
        lcTitle: String(lc.structuralElement ?? `Learning Cycle ${lcNumber}`),
        learningGoals: String(lc.learningGoals ?? ''),
        content: String(lc.mainContent ?? ''),
        assignment: String(lc.assignmentDescription ?? ''),
        methods: (String(lc.didactics ?? '').match(/[-•]\s*(.+)/g) ?? [])
          .map(line => line.replace(/^[-•]\s*/, '').trim())
          .map(tryMap)
          .filter(Boolean),
        competencies: compSet,
      }

      // fallback: falls didactics leer / unverständlich → Toolkit-Rotation
      if (row.methods.length === 0) row.methods = methodTemplate(lcNumber)

      const res = await fetch(`${API}/lc_contents/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      })
      if (!res.ok) throw new Error(`PUT lc_contents/${id}: ${res.status} ${await res.text()}`)
      written++
    }
  }

  console.log(`[seed-lc-contents] geschrieben: ${written}`)
  console.log('[seed-lc-contents] fertig.')
}

function tryMap(line: string): string {
  // Findet den nächstliegenden Toolkit-Begriff im Text
  const t = line.toLowerCase()
  const direct = METHODS_TOOLKIT.find(m => {
    const key = m.toLowerCase().split(' ')[0]
    return key.length > 3 && t.includes(key)
  })
  return direct ?? (line.length < 40 ? line : '')
}

function _fields(id: string, lcNumber: number, count: number): number[] {
  // Deterministische Generator-Zuordnung (2–3 Kompetenzen je LC, rotierend)
  const idxN = []
  for (let i = 0; i < Math.min(count, 3); i++) {
    idxN.push((lcNumber * 3 + i) % Math.max(1, count))
  }
  return [...new Set(idxN)]
}

main().catch(err => {
  console.error('seed-lc-contents failed:', err.message)
  process.exit(1)
})
