/**
 * Kap. 4 — Relationship-/Alignment-Katalog mit stabilen IDs
 * (analog solver/constraintCatalog.ts). Backend-Klassifikation und
 * Frontend-Matrix nutzen dieselbe Quelle — Farblogik wird nicht doppelt
 * gepflegt.
 */

export type ReviewPriority = 'high' | 'medium' | 'low' | 'none'

export interface CatalogEntry {
  id: string
  color: string
  reviewPriority: ReviewPriority
  description: string
}

/**
 * Stabile IDs — nie umbenennen, nur deprecaten.
 * OverlapAssessor liefert die relationshipId; UI färbt gemäss color.
 */
export const RELATIONSHIP_CATALOG = {
  DUPLICATE: {
    id: 'DUPLICATE',
    color: 'red',
    reviewPriority: 'high',
    description: 'Gleicher Inhalt, gleiches Niveau — vermutlich unnötige Redundanz',
  },
  SUBSTANTIAL_OVERLAP: {
    id: 'SUBSTANTIAL_OVERLAP',
    color: 'amber',
    reviewPriority: 'high',
    description: 'Starke inhaltliche Überschneidung — Abstimmung nötig',
  },
  PARTIAL_OVERLAP: {
    id: 'PARTIAL_OVERLAP',
    color: 'amber',
    reviewPriority: 'medium',
    description: 'Teilweise gemeinsame Inhalte — Überlappung prüfen',
  },
  PROGRESSION: {
    id: 'PROGRESSION',
    color: 'green',
    reviewPriority: 'low',
    description: 'Sinnvolle Vertiefung (Progression) statt Redundanz',
  },
  COMPLEMENTARY: {
    id: 'COMPLEMENTARY',
    color: 'green',
    reviewPriority: 'low',
    description: 'Komplementäre Perspektiven desselben Themenfelds',
  },
  SAME_TOPIC_DIFFERENT_FOCUS: {
    id: 'SAME_TOPIC_DIFFERENT_FOCUS',
    color: 'grey',
    reviewPriority: 'low',
    description: 'Gleiches Thema, bewusst andere Fokussierung',
  },
  NO_MEANINGFUL_OVERLAP: {
    id: 'NO_MEANINGFUL_OVERLAP',
    color: 'grey',
    reviewPriority: 'none',
    description: 'Keine inhaltlich relevante Überschneidung',
  },
} as const satisfies Record<string, CatalogEntry>

export type RelationshipId = keyof typeof RELATIONSHIP_CATALOG

/** Constructive-Alignment-Befunde (Kap. 5) */
export const ALIGNMENT_CATALOG = {
  ASSESSMENT_TOO_SHALLOW: {
    id: 'ASSESSMENT_TOO_SHALLOW',
    color: 'red',
    reviewPriority: 'high',
    description: 'Beanspruchtes I-R-M-Niveau höher als die Prüfungsform abdeckt',
  },
  ASSESSMENT_TOO_DEMANDING: {
    id: 'ASSESSMENT_TOO_DEMANDING',
    color: 'amber',
    reviewPriority: 'medium',
    description: 'Prüfungsform fordert über das beanspruchte Niveau hinaus',
  },
  NO_ASSESSMENT_PRESENT: {
    id: 'NO_ASSESSMENT_PRESENT',
    color: 'grey',
    reviewPriority: 'medium',
    description: 'LC ohne erkennbares Assessment — Alignment nicht prüfbar',
  },
} as const satisfies Record<string, CatalogEntry>

export type AlignmentIssueId = keyof typeof ALIGNMENT_CATALOG
