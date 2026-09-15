import { ref } from 'vue'
import { useDocPouch } from '@/composables/useDocPouch'
import type { Location } from '@/types/location'

const DOC_TYPE = { type: 101, subType: 3 }

function emptyLocation(): Location {
  return {
    name: '',
    building: '',
  }
}

function parseCsvRow(headers: string[], row: string[]): Record<string, string> {
  const obj: Record<string, string> = {}
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i]
    if (key !== undefined) obj[key] = row[i]?.trim() ?? ''
  }
  return obj
}

function csvToLocation(obj: Record<string, string>): Location {
  const loc = emptyLocation()
  loc.name = obj.name ?? ''
  loc.campus = obj.campus || undefined
  loc.building = obj.building ?? ''
  loc.address = obj.address || undefined
  if (obj.latitude) loc.latitude = Number(obj.latitude) || undefined
  if (obj.longitude) loc.longitude = Number(obj.longitude) || undefined
  return loc
}

export function useLocations() {
  const { client } = useDocPouch()
  const locations = ref<Location[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchLocations() {
    if (!client.value) return
    loading.value = true
    error.value = null
    try {
      const docs = await client.value.fetchDocuments(DOC_TYPE as any)
      locations.value = docs.map(d => d.content?.structuredData ?? d.content ?? d) as Location[]
      locations.value.forEach((l, i) => {
        if (docs[i]?._id) l._id = docs[i]._id
      })
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function addLocation(location: Location) {
    if (!client.value) return
    error.value = null
    try {
      const doc = await client.value.createDocument({
        title: location.name,
        type: DOC_TYPE.type,
        subType: DOC_TYPE.subType,
        content: { structuredData: location },
        shareWithGroup: true,
        shareWithDepartment: true,
        public: false,
        owner: '',
      } as any)
      location._id = doc._id
      locations.value.push(location)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateLocation(location: Location) {
    if (!client.value || !location._id) return
    error.value = null
    try {
      await client.value.updateDocument(location._id, {
        title: location.name,
        type: DOC_TYPE.type,
        subType: DOC_TYPE.subType,
        content: { structuredData: location },
      } as any)
      const idx = locations.value.findIndex(l => l._id === location._id)
      if (idx !== -1) locations.value[idx] = location
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeLocation(id: string) {
    if (!client.value) return
    error.value = null
    try {
      await client.value.removeDocument(id)
      locations.value = locations.value.filter(l => l._id !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function importCsv(text: string) {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) throw new Error('CSV must contain a header row and at least one data row')

    const headers = (lines[0] ?? '').split(',').map(h => h.trim())
    const imported: Location[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i] ?? ''
      const values = line.split(',').map(v => v.trim())
      if (values.length !== headers.length) continue
      const obj = parseCsvRow(headers, values)
      const loc = csvToLocation(obj)
      await addLocation(loc)
      imported.push(loc)
    }

    return imported
  }

  return {
    locations,
    loading,
    error,
    fetchLocations,
    addLocation,
    updateLocation,
    removeLocation,
    importCsv,
    emptyLocation,
  }
}