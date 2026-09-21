import type { AclInfo } from './curriculum'

export interface ClassEntity extends AclInfo {
  id?: string
  _id?: string
  name: string
  code?: string
  description?: string
  startingYear?: number
  /** @deprecated Use startingYear instead */
  year?: number
  semesterId?: string
  programIds?: string[]
  moduleIds?: string[]
  contact?: string
  url?: string
  /** @deprecated Use url instead */
  URL?: string
  size?: number
}

export type ClassExport = ClassEntity[]