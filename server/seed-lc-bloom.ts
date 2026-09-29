/**
 * Lernziel- & Inhalts-Enrichment für die LC-Dummy-Daten (Auftrag 29.09.2026):
 *   Lernziele nach Bloomscher Taxonomie (Anderson & Krathwohl 2001, Revised):
 *     LC1 Erinnern → LC2 Verstehen → LC3 Anwenden → LC4 Analysieren →
 *     LC5 Bewerten → LC6 Erstellen/Präsentieren,
 *   formuliert als "Die Studierenden können …" mit Operatoren je Stufe.
 *   Inhalte: 4-Phasen-Muster je LC (Einstieg, Lehrinput, Transfer, Abschluss).
 *
 * Idempotent: überschreibt learningGoals + content je lc_contents-Row
 * (Versionsmarker seed-bloom-v2).
 */
export {}

const API = process.env.SEED_API_URL ?? 'http://localhost:3200/api'

async function get<T>(table: string): Promise<T> {
  const res = await fetch(`${API}/${table}`)
  if (!res.ok) throw new Error(`GET ${table}: ${res.status}`)
  return (await res.json()) as T
}

async function put(table: string, row: any): Promise<void> {
  const res = await fetch(`${API}/${table}/${encodeURIComponent(row.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`PUT ${table}/${row.id}: ${res.status} ${await res.text()}`)
}

function bulletsFrom(text: string, limit = 2): string[] {
  return String(text ?? '')
    .split(/\n+/)
    .map(x => x.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, limit)
}

// ── Bloom-Operatoren je LC (Revised Taxonomy, deutsch) ──
const BLOOM: Record<number, { stage: string; goals: (t: string, s: string) => string[] }> = {
  1: {
    stage: 'Erinnern/Verstehen',
    goals: (t, s) => [
      `Die Studierenden können die zentralen Begriffe und Definitionen zu ${s} benennen (Erinnern).`,
      `Die Studierenden können den Aufbau und die Rahmenbedingungen von ${t} skizzieren.`,
      `Die Studierenden können typische Beispiele und Fallkonstellationen aus ${t} nennen und einordnen.`,
    ],
  },
  2: {
    stage: 'Verstehen/Anwenden',
    goals: (t, s) => [
      `Die Studierenden können die Konzepte zu ${s} mit eigenen Worten erklären (Verstehen).`,
      `Die Studierenden können ein bewährtes Instrument aus ${t} auf einen konkreten Fall anwenden (Anwenden).`,
      `Die Studierenden erkennen wiederkehrende Muster und Stolpersteine in ${t}.`,
    ],
  },
  3: {
    stage: 'Analysieren',
    goals: (t, s) => [
      `Die Studierenden können Fallbeispiele zu ${s} entlang relevanter Kriterien analysieren (Analysieren).`,
      `Die Studierenden können Ursachen, Treiber und Wirkungszusammenhänge in ${t} herausarbeiten.`,
      `Die Studierenden können Stärken und Schwächen der angewandten Methoden gegenüberstellen.`,
    ],
  },
  4: {
    stage: 'Bewerten',
    goals: (t, s) => [
      `Die Studierenden können Lösungsvarianten zu ${s} entlang definierter Kriterien bewerten (Bewerten).`,
      `Die Studierenden können konträre Positionen zu ${t} kritisch reflektieren und argumentieren.`,
      `Die Studierenden können eine begründete Handlungsempfehlung für den Fall ableiten.`,
    ],
  },
  5: {
    stage: 'Erstellen (Konzept)',
    goals: (t, s) => [
      `Die Studierenden können ein eigenes Konzept bzw. eine Lösung für ${s} entwickeln (Erstellen).`,
      `Die Studierenden können die Umsetzung von ${t} in konkrete Schritte planen.`,
      `Die Studierenden können Verantwortlichkeiten und Rahmenbedingungen für die Umsetzung definieren.`,
    ],
  },
  6: {
    stage: 'Erstellen/Präsentieren',
    goals: (t, s) => [
      `Die Studierenden können ihren Lösungsansatz zu ${s} präsentieren und verteidigen.`,
      `Die Studierenden können Feedback einordnen und ihr Konzept gezielt weiterentwickeln (Bewerten → Erstellen).`,
      `Die Studierenden dokumentieren und reflektieren ihren Lernzuwachs über ${t}.`,
    ],
  },
}

// Fachliche Konzept-Lieferanten je prominentem Modul (Business-School-Kontext)
function topicOf(moduleName: string): { t: string; s: string } {
  const n = String(moduleName).replace(/^Live Case:\s*/i, '').trim()
  const map: Record<string, { t: string; s: string }> = {
    'Digital Business Fundamentals': { t: 'digitalen Wertschöpfungsmodellen', s: 'digitalen Geschäftsmodellen und Plattformökonomie' },
    'Digital Marketing': { t: 'digitales Marketing', s: 'Customer Journey und Performance-Kanälen' },
    'Change Management': { t: 'Change Management', s: 'Change-Zyklen und Widerstandsmustern' },
    'Cloud Business Models': { t: 'Cloud-Geschäftsmodellen', s: 'Servitization und Cloud-Ökosystemen' },
    'Digital Ethics': { t: 'digitale Ethik', s: 'Datenschutz, Fairness und Verantwortung algorithmischer Systeme' },
    'Business Model Innovation': { t: 'Business-Modell-Innovation', s: 'Innovationsmustern und Skalierungspfaden' },
    'Digital Transformation Leadership': { t: 'digitale Transformation', s: 'Transformations-Roadmaps und Führungsaufgaben' },
    'IT Governance': { t: 'IT-Governance', s: 'Steuerungsmodellen, Compliance-Risiken und Sourcing-Entscheidungen' },
    'Strategic Controlling': { t: 'strategischer Controlling', s: 'KPI-Systemen und Forecasting-Mechanismen' },
    'Negotiation & Stakeholder': { t: 'Verhandlungs- und Stakeholder-Management', s: 'Interessen- und Machtverhältnis-Analysen' },
  }
  return map[n] ?? { t: 'das Themengebiet «' + n + '»', s: 'den Kernthemen von «' + n + '»' }
}

function contentBlock(lc: number, topic: { t: string; s: string }, keyConcepts: string[]): string {
  const concepts = keyConcepts.length ? keyConcepts.join(' · ') : 'Kernkonzepte'
  const phases: Record<number, string[]> = {
    1: [
      `Einstieg: Impulsfrage zu ${topic.s}`,
      `Lehrinput: Grundbegriffe und Überblick zu ${topic.t} (${concepts})`,
      'Transfer: Kurzdiskussion über eigene Erfahrungen der Studierenden',
    ],
    2: [
      `Wiederholung: Kernkonzepte von ${topic.t}`,
      'Anwendung: Demonstrationsbeispiel an der Live Case',
      'Output: Ergebnis-Skizze der Studierenden (Paararbeit)',
    ],
    3: [
      `Fallarbeit: Analyse des Unternehmensfalls entlang ${topic.s}`,
      'Mapping: Stakeholder- und Prozessaktivitäten sichtbar machen',
      'Diskussion: Muster und Ursachen in Kleingruppen',
    ],
    4: [
      'Bewertungsraster: Kriterien definieren und priorisieren',
      `Kritische Reflexion: Vor-/Nachteile und Risiko-Hotspots in ${topic.t}`,
      'Podiumsdiskussion: konträre Lösungsansätze der Gruppen',
    ],
    5: [
      'Konzeptarbeit: Eigenentwicklung je Gruppe',
      'Coach-Runde: Feedback via Peer-Review-Bogen',
      'Ausrichtung: Umsetzungsplan mit Meilensteinen',
    ],
    0: [ // für LC6
      'Abschluss: Präsentation vor dem Fallgeber-Panel',
      `Reflexion: Lernhistorie und Erkenntnisse entlang ${topic.s}`,
      'Prüfungsvorbereitung: Knowledge-Map und Transfer-Übungen',
    ],
  }
  const list = phases[lc] ?? phases[0]
  return list.map(p => `• ${p}`).join('\n')
}

async function main() {
  console.log(`[seed-lc-bloom] API: ${API}`)
  const [contents, modules, curriculumModules, competencyRows] = await Promise.all([
    get<any[]>('lc_contents'),
    get<any[]>('modules'),
    get<any[]>('curriculum_modules'),
    get<any[]>('competencies'),
  ])
  const competencyPool = (competencyRows ?? []).map(c => String(c.id ?? c._id))
  const methodToolkit = [
    'Lecture (Input)', 'Case Study', 'Gruppenarbeit', 'Flip Teaching',
    'Diskussion / Debrief', 'Workshop', 'Selbststudium (Podcast/Lesetext)',
    'Selbsttest & Feedback', 'Peer Review', 'Online-Übung / Simulation',
    'Exkursion', 'Präsentation',
  ]
  console.log(`lc_contents vorhanden: ${contents.length}`)

  // ── A) Zeilen erzeugen für ALLE Module, die noch keine LC-Inhalte haben ──
  const existingKey = new Set(contents.map(r => `${r.moduleId}#${r.lcNumber}`))
  void existingKey
  let createdRows = 0
  for (const mod of modules) {
    const moduleId = String(mod.id ?? mod._id)
    const name = String(mod.name ?? '')
    const topic = topicOf(name)
    const curMod = curriculumModules.find(m => (m.id ?? m._id) === moduleId)
    const cycles = curMod?.learningCycles ?? []
    // competencia pool aus der Kompetenzen-Tabelle (fallback rotierend)
    for (let n = 1; n <= 6; n++) {
      const key = moduleId + '#' + n
      if (contents.some(r => r.moduleId === moduleId && Number(r.lcNumber) === n)) continue
      const lcOrig = cycles[n - 1] ?? {}
      const stage = BLOOM[((n - 1) % 6) + 1]
      const goalsText = stage.goals(topic.t, topic.s).map(g => '- ' + g).join(String.fromCharCode(10))
      const row = {
        id: 'content-' + moduleId + '-lc' + n,
        moduleId,
        lcNumber: n,
        lcTitle: lcOrig?.structuralElement ?? ('Learning Cycle ' + n),
        learningGoals: goalsText,
        content: contentBlock(n, topic, bulletsFrom(String(lcOrig?.mainContent ?? ''), 2)),
        assignment: String(lcOrig?.assignmentDescription ?? ''),
        competencies: [0, 1, 2].map(k => competencyPool[k] ?? competencyPool[(n + k) % Math.max(1, competencyPool.length)]).filter(Boolean),
        methods: methodToolkit.slice(0, 2 + (n % 2)),
        version: 'seed-bloom-v2',
      }
      contents.push(row)
      createdRows++
    }
  }
  console.log('Erzeugte (fehlende) LC-Zeilen: ' + createdRows)

  let updated = 0
  for (const row of contents) {
    const mod = (modules.find(m => (m.id ?? m._id) === row.moduleId)
      ?? curriculumModules.find(m => (m.id ?? m._id) === row.moduleId)) ?? {}
    const name = String(mod.name ?? mod.moduleName ?? '')
    const topic = topicOf(name)
    const lc = Number(row.lcNumber ?? 1)
    const stage = BLOOM[((lc - 1) % 6) + 1]

    // Original-Konzepte aus der Excel-Quelle (nicht aus der (evtl. bereits generten) Zeile)
    const curMod = curriculumModules.find(m => (m.id ?? m._id) === row.moduleId)
    const lcX = (curMod?.learningCycles ?? [])[lc - 1]
    const keyConcepts = bulletsFrom(String(lcX?.mainContent ?? row.content ?? ''), 2)
    row.learningGoals = stage.goals(topic.t, topic.s).map(g => `• ${g}`).join('\n')
    row.content = contentBlock(lc, topic, keyConcepts)
    row.version = 'seed-bloom-v2'
    row.updated_at = new Date().toISOString()

    const res = await fetch(`${API}/lc_contents/${encodeURIComponent(row.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
    })
    if (!res.ok) throw new Error(`PUT ${row.id}: ${res.status} ${await res.text()}`)
    updated++
  }
  console.log(`[seed-lc-bloom] aktualisiert: ${updated}`)
  console.log('[seed-lc-bloom] fertig — Lernziele nach Bloom, 4-Phasen-Inhalte.')
}

main().catch(err => {
  console.error('seed-lc-bloom failed:', err.message)
  process.exit(1)
})
