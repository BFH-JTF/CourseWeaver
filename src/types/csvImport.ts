export type ImportType =
  | 'rooms'
  | 'locations'
  | 'competencies'
  | 'modules'
  | 'study_programs'
  | 'proofs_of_knowledge'
  | 'departments'
  | 'programs'
  | 'degrees'
  | 'availability'
  | 'scheduling_rules'

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
  transform: (mappedRows: Record<string, any>[]) => any[]
}

export type ColumnMapping = Record<string, string | null> // entityFieldKey -> csvHeader (or null if unmapped)
