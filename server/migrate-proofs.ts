/**
 * Migration data-model-comparison.md §3.2 (Big Bang):
 *
 *   proofs_of_knowledge (booleans: assessmentType written/oral,
 *   multipleChoice, freeText) → proofs_of_competency (answerFormats[]).
 *   Gleichzeitiger Wechsel — alle Zeilen konvertieren, **dann die
 *   Quelletabelle leeren**. Kein Feature-Flag: die App liest danach nur
 *   noch proofs_of_competency.
 */
export {}
const API = process.env.SEED_API_URL ?? 'http://localhost:3200/api'

interface LegacyProof {
  _id?: string
  id: string
  name: string
  description?: string
  assessmentType?: 'written' | 'oral' | string
  multipleChoice?: boolean
  freeText?: boolean
  assignmentScope?: 'individual' | 'group' | string
  durationMinutes?: number
}
interface MergedProof {
  id: string
  name: string
  description?: string
  answerFormats?: string[]
  assignmentScope?: string
  durationMinutes?: number
  competencyIds?: string[]
}

function toAnswerFormats(p: LegacyProof): string[] {
  const out: string[] = []
  const type = String(p.assessmentType ?? 'written').toLowerCase()
  out.push(type.includes('oral') || type.includes('muend') ? 'oral' : 'written')
  if (p.multipleChoice) out.push('multipleChoice')
  if (p.freeText) out.push('freeText')
  return Array.from(new Set(out))
}

async function get<T>(table: string): Promise<T> {
  const res = await fetch(`${API}/${table}`)
  if (!res.ok) throw new Error(`GET ${table}: HTTP ${res.status}`)
  return res.json() as Promise<T>
}

async function put<T>(table: string, row: T): Promise<void> {
  const id = (row as any).id ?? (row as any)._id
  const res = await fetch(`${API}/${table}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`PUT ${table}/${id}: HTTP ${res.status} ${await res.text()}`)
}

async function main() {
  console.log(`[migrate-proofs] API: ${API}`)
  const [legacy, existing] = await Promise.all([
    get<LegacyProof[]>('proofs_of_knowledge'),
    get<(LegacyProof & { answerFormats?: string[] })[]>('proofs_of_competency'),
  ])
  console.log(`legacy proofs_of_knowledge=${legacy.length}, existing proofs_of_competency=${existing.length}`)

  const mergedById = new Map<string, LegacyProof & { answerFormats?: string[]; competencyIds?: string[] }>(existing.map(e => [e.id, e]))
  let converted = 0
  for (const p of legacy) {
    const id = p.id ?? (p as any)._id
    const prev = mergedById.get(id)
    const row = {
      ...(prev ?? {}),
      id,
      name: p.name,
      description: p.description ?? prev?.description,
      answerFormats: prev?.answerFormats?.length ? prev.answerFormats : toAnswerFormats(p),
      assignmentScope: p.assignmentScope ?? prev?.assignmentScope,
      durationMinutes: p.durationMinutes ?? prev?.durationMinutes,
      competencyIds: prev?.competencyIds ?? [],
    }
    await put('proofs_of_competency', row)
    converted++
  }

  // Big Bang: Quelletabelle leeren
  let deleted = 0
  for (const p of legacy) {
    const id = p.id ?? (p as any)._id
    const res = await fetch(`${API}/proofs_of_knowledge/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`DELETE proofs_of_knowledge/${id}: HTTP ${res.status}`)
    deleted++
  }

  console.log(`[migrate-proofs] converted=${converted} deleted_source_rows=${deleted}`)
  console.log('[migrate-proofs] fertig — ProofOfCompetency ist das einzige Modell (Big Bang).')
}

main().catch(err => {
  console.error('migrate-proofs failed:', err.message)
  process.exit(1)
})
