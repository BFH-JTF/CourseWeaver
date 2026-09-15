export interface Location {
  id?: string
  name: string
  campus?: string
  building: string
  address?: string
  latitude?: number
  longitude?: number
}

export type LocationExport = Location[]