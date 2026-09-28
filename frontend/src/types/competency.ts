/**
 * Kompetenz-Datenmodell (Kap. 15): Kompetenz-Rahmen als eigene, austauschbare
 * Entität — mehrere Sets können nebeneinander existieren (15.1), jede Kompetenz
 * ist via frameworkId eindeutig einem Rahmen zugeordnet.
 */
export type SkillLevel = 'Introduction' | 'Regular' | 'Master' | 'I' | 'R' | 'M'

export interface Competency {
  id?: string
  _id?: string
  /** NEU — Pflichtfeld: verhindert, dass Kompetenzen unterschiedlicher Rahmen in einer Tabelle vermischen (15.1) */
  frameworkId: string
  name: string
  /** Domäne z.B. Professional / Entrepreneurial / Sustainable / Digital */
  category?: string
  /** Dimension z.B. Disciplinary / Methodological / Personal / Social */
  topic?: string
  description?: string
  level?: SkillLevel | string
  /** Reihenfolge innerhalb des Rahmens für stabile Darstellung (15.1) */
  order?: number
}

export interface CompetencyFramework {
  id: string
  /** z.B. "BFH Master-Kompetenzrahmen 2026" */
  name: string
  /** bis zur Auth-Integration (Solver-Review #5) optional */
  ownerId?: string
  /** sichtbar für alle vs. nur für ownerId */
  isShared: boolean
  createdAt: string
}

export type CompetencyExport = Competency[]
