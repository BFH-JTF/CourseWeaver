export type ImportType =
  | 'rooms'
  | 'locations'
  | 'competencies'
  | 'modules'
  | 'learning_cycles'
  | 'study_programs'
  | 'proofs_of_knowledge'

export type FieldDataType = 'string' | 'number' | 'boolean' | 'enum'

export interface ImportFieldDefinition {
  key: string
  label: string
  required: boolean
  type: FieldDataType
  description?: string
  aliases: string[]
  options?: string[]
  defaultValue?: any
}

export interface ImportTypeConfig {
  type: ImportType
  label: string
  icon: string
  description: string
  entityName: string
  fields: ImportFieldDefinition[]
  /** Transform: zweiter Parameter = Programm-Auflöser (Freitext → StudyProgram.id), Kap. 12.4 */
  transform: (
    mappedRows: Record<string, any>[],
    ctx?: { resolveProgram?: (name: string) => string; resolveFramework?: (name: string) => Promise<string> | string }
  ) => any[]
}

export type ColumnMapping = Record<string, string | null> // entityFieldKey -> csvHeader (or null if unmapped)
