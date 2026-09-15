import type { ImportType, ImportTypeConfig, ImportFieldDefinition, ColumnMapping } from '@/types/csvImport'
import type { Room, RoomType, LayoutType } from '@/types/room'
import type { Location } from '@/types/location'
import type { Competency, SkillLevel } from '@/types/competency'
import type { Module, StudyProgram } from '@/stores/curriculum'

export function normalizeHeader(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function autoMapColumns(headers: string[], fields: ImportFieldDefinition[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const usedHeaders = new Set<string>()

  // 1. Pass 1: Try exact or alias matches
  for (const field of fields) {
    const fieldNorm = normalizeHeader(field.key)
    const labelNorm = normalizeHeader(field.label)
    const aliasesNorm = field.aliases.map(normalizeHeader)

    let matchedHeader: string | null = null

    // Exact header match first
    for (const h of headers) {
      if (usedHeaders.has(h)) continue
      const hNorm = normalizeHeader(h)
      if (hNorm === fieldNorm || hNorm === labelNorm || aliasesNorm.includes(hNorm)) {
        matchedHeader = h
        break
      }
    }

    if (matchedHeader) {
      mapping[field.key] = matchedHeader
      usedHeaders.add(matchedHeader)
    } else {
      mapping[field.key] = null
    }
  }

  return mapping
}

export const IMPORT_CONFIGS: Record<ImportType, ImportTypeConfig> = {
  rooms: {
    type: 'rooms',
    label: 'Rooms',
    icon: 'mdi-door-open',
    description: 'Classrooms, lecture halls, computer labs, and seminar rooms.',
    entityName: 'Room',
    fields: [
      {
        key: 'name',
        label: 'Room Name',
        required: true,
        type: 'string',
        description: 'Human-readable name (e.g., Science Building 204)',
        aliases: ['name', 'room_name', 'room name', 'classroom', 'room', 'title', 'raum', 'raumname'],
      },
      {
        key: 'room_number',
        label: 'Room Number',
        required: true,
        type: 'string',
        description: 'Official room number or designation (e.g., 204, B12)',
        aliases: ['room_number', 'room number', 'room_nr', 'room nr', 'roomno', 'room no', 'nr', 'number', 'raumnummer'],
      },
      {
        key: 'floor',
        label: 'Floor',
        required: true,
        type: 'string',
        description: 'Floor number or label (e.g., 2, 0, basement)',
        aliases: ['floor', 'level', 'etage', 'stockwerk', 'floor_number', 'floor number'],
      },
      {
        key: 'room_type',
        label: 'Room Type',
        required: true,
        type: 'enum',
        description: 'lecture_hall, classroom, computer_lab, laboratory, or other',
        options: ['lecture_hall', 'classroom', 'computer_lab', 'laboratory', 'other'],
        defaultValue: 'classroom',
        aliases: ['room_type', 'room type', 'type', 'raumtyp', 'category', 'kind'],
      },
      {
        key: 'capacity_seats',
        label: 'Seat Capacity',
        required: true,
        type: 'number',
        description: 'Maximum number of regular seats',
        aliases: ['capacity_seats', 'capacity seats', 'seats', 'capacity', 'max_seats', 'plaetze', 'sitzplaetze'],
      },
      {
        key: 'location_id',
        label: 'Location ID / Building Ref',
        required: false,
        type: 'string',
        description: 'Reference to Location entity or location ID',
        aliases: ['location_id', 'location id', 'location', 'standort', 'building_ref'],
      },
      {
        key: 'owner',
        label: 'Owner / Contact',
        required: false,
        type: 'string',
        description: 'Contact person or department responsible for the room',
        aliases: ['owner', 'contact', 'responsible', 'verantwortlicher'],
      },
      {
        key: 'capacity_accessible_seats',
        label: 'Accessible Seats',
        required: false,
        type: 'number',
        description: 'Number of wheelchair-accessible seats',
        aliases: ['capacity_accessible_seats', 'accessible_seats', 'accessible seats', 'rollstuhlplaetze'],
      },
      {
        key: 'capacity_desks',
        label: 'Desks Count',
        required: false,
        type: 'number',
        description: 'Number of desks or workstations',
        aliases: ['capacity_desks', 'desks', 'tische', 'workstations'],
      },
      {
        key: 'capacity_standing_capacity',
        label: 'Standing Capacity',
        required: false,
        type: 'number',
        description: 'Maximum number of additional standing occupants',
        aliases: ['capacity_standing_capacity', 'standing_capacity', 'standing capacity', 'stehplaetze'],
      },
      {
        key: 'layout_type',
        label: 'Layout Type',
        required: false,
        type: 'enum',
        description: 'rows, u_shape, boardroom, laboratory_benches, computer_workstations, other',
        options: ['rows', 'u_shape', 'boardroom', 'laboratory_benches', 'computer_workstations', 'other'],
        aliases: ['layout_type', 'layout type', 'layout', 'bestuhlung'],
      },
      {
        key: 'layout_movable_desks',
        label: 'Movable Desks',
        required: false,
        type: 'boolean',
        description: 'Whether desks can be rearranged (true/false)',
        aliases: ['layout_movable_desks', 'movable_desks', 'movable desks'],
      },
      {
        key: 'layout_movable_chairs',
        label: 'Movable Chairs',
        required: false,
        type: 'boolean',
        description: 'Whether chairs can be moved (true/false)',
        aliases: ['layout_movable_chairs', 'movable_chairs', 'movable chairs'],
      },
      {
        key: 'layout_group_work_possible',
        label: 'Group Work Possible',
        required: false,
        type: 'boolean',
        description: 'Whether room layout is suitable for group work',
        aliases: ['layout_group_work_possible', 'group_work_possible', 'group work'],
      },
      {
        key: 'layout_floor_area_m2',
        label: 'Floor Area (m²)',
        required: false,
        type: 'number',
        description: 'Total floor area in square meters',
        aliases: ['layout_floor_area_m2', 'floor_area_m2', 'floor area', 'area', 'flaeche', 'sqm'],
      },
      {
        key: 'equipment_whiteboards',
        label: 'Whiteboards Count',
        required: false,
        type: 'number',
        description: 'Number of whiteboard surfaces',
        aliases: ['equipment_whiteboards', 'whiteboards', 'whiteboard'],
      },
      {
        key: 'equipment_blackboard',
        label: 'Blackboard',
        required: false,
        type: 'boolean',
        description: 'Whether chalkboard is present',
        aliases: ['equipment_blackboard', 'blackboard', 'tafel'],
      },
      {
        key: 'equipment_flipchart',
        label: 'Flipchart',
        required: false,
        type: 'boolean',
        description: 'Whether flipchart is available',
        aliases: ['equipment_flipchart', 'flipchart'],
      },
      {
        key: 'equipment_smartboard',
        label: 'Smartboard',
        required: false,
        type: 'boolean',
        description: 'Whether interactive smartboard is installed',
        aliases: ['equipment_smartboard', 'smartboard'],
      },
      {
        key: 'equipment_projector',
        label: 'Projector (Beamer)',
        required: false,
        type: 'boolean',
        description: 'Whether a digital video projector is available',
        aliases: ['equipment_projector', 'projector', 'beamer'],
      },
      {
        key: 'equipment_projector_count',
        label: 'Projector Count',
        required: false,
        type: 'number',
        description: 'Number of installed projectors',
        aliases: ['equipment_projector_count', 'projector_count', 'projectors'],
      },
      {
        key: 'equipment_document_camera',
        label: 'Document Camera',
        required: false,
        type: 'boolean',
        description: 'Visualizer / document camera available',
        aliases: ['equipment_document_camera', 'document_camera', 'visualizer'],
      },
      {
        key: 'equipment_lectern',
        label: 'Lectern / Podium',
        required: false,
        type: 'boolean',
        description: 'Whether a speaker lectern is provided',
        aliases: ['equipment_lectern', 'lectern', 'podium', 'rednerpult'],
      },
      {
        key: 'equipment_speakers',
        label: 'Speakers (Audio)',
        required: false,
        type: 'boolean',
        description: 'Installed sound reinforcement speakers',
        aliases: ['equipment_speakers', 'speakers', 'sound_system', 'lautsprecher'],
      },
      {
        key: 'equipment_microphone',
        label: 'Microphone',
        required: false,
        type: 'boolean',
        description: 'Fixed or wireless microphone available',
        aliases: ['equipment_microphone', 'microphone', 'mic', 'mikrofon'],
      },
      {
        key: 'equipment_lecture_capture',
        label: 'Lecture Capture',
        required: false,
        type: 'boolean',
        description: 'Automated recording / streaming equipment installed',
        aliases: ['equipment_lecture_capture', 'lecture_capture', 'recording'],
      },
      {
        key: 'equipment_streaming_camera_available',
        label: 'Streaming Camera',
        required: false,
        type: 'boolean',
        description: 'Whether a streaming / webcam camera is available',
        aliases: ['equipment_streaming_camera_available', 'streaming_camera', 'camera', 'webcam'],
      },
      {
        key: 'equipment_video_conferencing_available',
        label: 'Video Conferencing',
        required: false,
        type: 'boolean',
        description: 'Integrated Zoom / Teams video conference system',
        aliases: ['equipment_video_conferencing_available', 'video_conferencing', 'videoconference', 'teams_room', 'zoom_room'],
      },
      {
        key: 'connectivity_wifi',
        label: 'WiFi Available',
        required: false,
        type: 'boolean',
        description: 'Wireless internet connectivity available',
        aliases: ['connectivity_wifi', 'wifi', 'wlan'],
      },
      {
        key: 'connectivity_wired_network',
        label: 'Wired Network (Ethernet)',
        required: false,
        type: 'boolean',
        description: 'Ethernet wall jacks available',
        aliases: ['connectivity_wired_network', 'wired_network', 'ethernet', 'lan'],
      },
      {
        key: 'connectivity_network_speed_mbps',
        label: 'Network Speed (Mbps)',
        required: false,
        type: 'number',
        description: 'Network bandwidth in Mbps',
        aliases: ['connectivity_network_speed_mbps', 'network_speed_mbps', 'network_speed', 'speed_mbps'],
      },
      {
        key: 'connectivity_power_outlets',
        label: 'Power Outlets Count',
        required: false,
        type: 'number',
        description: 'Number of accessible AC power sockets for students',
        aliases: ['connectivity_power_outlets', 'power_outlets', 'outlets', 'steckdosen'],
      },
      {
        key: 'accessibility_step_free_access',
        label: 'Step-Free Access',
        required: false,
        type: 'boolean',
        description: 'Wheelchair / step-free accessible entrance',
        aliases: ['accessibility_step_free_access', 'step_free_access', 'accessible', 'wheelchair', 'barrierefrei'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): Room[] => {
      return mappedRows.map(obj => {
        const floorVal = obj.floor ?? '0'
        const floorNum = Number(floorVal)
        const floor = isNaN(floorNum) ? String(floorVal) : floorNum

        let room_type: RoomType = 'classroom'
        const rt = (obj.room_type || '').toLowerCase().trim()
        if (['lecture_hall', 'classroom', 'computer_lab', 'laboratory', 'other'].includes(rt)) {
          room_type = rt as RoomType
        }

        const room: Room = {
          name: String(obj.name || ''),
          room_type,
          floor,
          room_number: String(obj.room_number || ''),
          capacity: {
            seats: Number(obj.capacity_seats) || 0,
          },
          accessibility: {
            step_free_access: parseBoolean(obj.accessibility_step_free_access),
          },
          availability: {},
        }

        if (obj.location_id) room.location_id = String(obj.location_id)
        if (obj.owner) room.owner = String(obj.owner)

        if (obj.capacity_accessible_seats !== undefined && obj.capacity_accessible_seats !== '') {
          room.capacity.accessible_seats = Number(obj.capacity_accessible_seats) || undefined
        }
        if (obj.capacity_desks !== undefined && obj.capacity_desks !== '') {
          room.capacity.desks = Number(obj.capacity_desks) || undefined
        }
        if (obj.capacity_standing_capacity !== undefined && obj.capacity_standing_capacity !== '') {
          room.capacity.standing_capacity = Number(obj.capacity_standing_capacity) || undefined
        }

        const layout: any = {}
        if (obj.layout_type) {
          const lt = String(obj.layout_type).toLowerCase().trim()
          if (['rows', 'u_shape', 'boardroom', 'laboratory_benches', 'computer_workstations', 'other'].includes(lt)) {
            layout.type = lt as LayoutType
          }
        }
        if (obj.layout_movable_desks !== undefined && obj.layout_movable_desks !== '') {
          layout.movable_desks = parseBoolean(obj.layout_movable_desks)
        }
        if (obj.layout_movable_chairs !== undefined && obj.layout_movable_chairs !== '') {
          layout.movable_chairs = parseBoolean(obj.layout_movable_chairs)
        }
        if (obj.layout_group_work_possible !== undefined && obj.layout_group_work_possible !== '') {
          layout.group_work_possible = parseBoolean(obj.layout_group_work_possible)
        }
        if (obj.layout_floor_area_m2 !== undefined && obj.layout_floor_area_m2 !== '') {
          layout.floor_area_m2 = Number(obj.layout_floor_area_m2) || undefined
        }
        if (Object.keys(layout).length > 0) room.layout = layout

        const equipment: any = {}
        if (obj.equipment_whiteboards !== undefined && obj.equipment_whiteboards !== '') {
          equipment.whiteboards = Number(obj.equipment_whiteboards) || 0
        }
        if (obj.equipment_blackboard !== undefined && obj.equipment_blackboard !== '') {
          equipment.blackboard = parseBoolean(obj.equipment_blackboard)
        }
        if (obj.equipment_flipchart !== undefined && obj.equipment_flipchart !== '') {
          equipment.flipchart = parseBoolean(obj.equipment_flipchart)
        }
        if (obj.equipment_smartboard !== undefined && obj.equipment_smartboard !== '') {
          equipment.smartboard = parseBoolean(obj.equipment_smartboard)
        }
        if (obj.equipment_projector !== undefined && obj.equipment_projector !== '') {
          equipment.projector = parseBoolean(obj.equipment_projector)
        }
        if (obj.equipment_projector_count !== undefined && obj.equipment_projector_count !== '') {
          equipment.projector_count = Number(obj.equipment_projector_count) || undefined
        }
        if (obj.equipment_document_camera !== undefined && obj.equipment_document_camera !== '') {
          equipment.document_camera = parseBoolean(obj.equipment_document_camera)
        }
        if (obj.equipment_lectern !== undefined && obj.equipment_lectern !== '') {
          equipment.lectern = parseBoolean(obj.equipment_lectern)
        }
        if (obj.equipment_speakers !== undefined && obj.equipment_speakers !== '') {
          equipment.speakers = parseBoolean(obj.equipment_speakers)
        }
        if (obj.equipment_microphone !== undefined && obj.equipment_microphone !== '') {
          equipment.microphone = parseBoolean(obj.equipment_microphone)
        }
        if (obj.equipment_lecture_capture !== undefined && obj.equipment_lecture_capture !== '') {
          equipment.lecture_capture = parseBoolean(obj.equipment_lecture_capture)
        }
        if (obj.equipment_streaming_camera_available !== undefined && obj.equipment_streaming_camera_available !== '') {
          equipment.streaming_camera = { available: parseBoolean(obj.equipment_streaming_camera_available) }
        }
        if (obj.equipment_video_conferencing_available !== undefined && obj.equipment_video_conferencing_available !== '') {
          equipment.video_conferencing = { available: parseBoolean(obj.equipment_video_conferencing_available) }
        }
        if (Object.keys(equipment).length > 0) room.equipment = equipment

        const connectivity: any = {}
        if (obj.connectivity_wifi !== undefined && obj.connectivity_wifi !== '') {
          connectivity.wifi = parseBoolean(obj.connectivity_wifi)
        }
        if (obj.connectivity_wired_network !== undefined && obj.connectivity_wired_network !== '') {
          connectivity.wired_network = parseBoolean(obj.connectivity_wired_network)
        }
        if (obj.connectivity_network_speed_mbps !== undefined && obj.connectivity_network_speed_mbps !== '') {
          connectivity.network_speed_mbps = Number(obj.connectivity_network_speed_mbps) || undefined
        }
        if (obj.connectivity_power_outlets !== undefined && obj.connectivity_power_outlets !== '') {
          connectivity.power_outlets = Number(obj.connectivity_power_outlets) || undefined
        }
        if (Object.keys(connectivity).length > 0) room.connectivity = connectivity

        return room
      })
    },
  },

  locations: {
    type: 'locations',
    label: 'Locations',
    icon: 'mdi-map-marker',
    description: 'Campuses, buildings, and geographic sites.',
    entityName: 'Location',
    fields: [
      {
        key: 'name',
        label: 'Location Name',
        required: true,
        type: 'string',
        description: 'Human-readable name (e.g., North Campus, Science Building)',
        aliases: ['name', 'location_name', 'location name', 'location', 'site', 'standort', 'bezeichnung'],
      },
      {
        key: 'building',
        label: 'Building',
        required: true,
        type: 'string',
        description: 'Building name or code (e.g., Science Building, Main Building)',
        aliases: ['building', 'building_name', 'building name', 'gebaeude', 'house', 'haus'],
      },
      {
        key: 'campus',
        label: 'Campus',
        required: false,
        type: 'string',
        description: 'Campus name or code (e.g., North Campus, Campus Bern)',
        aliases: ['campus', 'campus_name', 'areal', 'site_name'],
      },
      {
        key: 'address',
        label: 'Address',
        required: false,
        type: 'string',
        description: 'Postal or street address',
        aliases: ['address', 'street', 'strasse', 'adresse', 'postal_address'],
      },
      {
        key: 'latitude',
        label: 'Latitude',
        required: false,
        type: 'number',
        description: 'Geographic latitude in decimal degrees (e.g. 52.5201)',
        aliases: ['latitude', 'lat', 'breitengrad'],
      },
      {
        key: 'longitude',
        label: 'Longitude',
        required: false,
        type: 'number',
        description: 'Geographic longitude in decimal degrees (e.g. 13.4049)',
        aliases: ['longitude', 'lon', 'lng', 'laengengrad'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): Location[] => {
      return mappedRows.map(obj => {
        const loc: Location = {
          name: String(obj.name || ''),
          building: String(obj.building || ''),
        }
        if (obj.campus) loc.campus = String(obj.campus)
        if (obj.address) loc.address = String(obj.address)
        if (obj.latitude !== undefined && obj.latitude !== '') {
          loc.latitude = Number(obj.latitude) || undefined
        }
        if (obj.longitude !== undefined && obj.longitude !== '') {
          loc.longitude = Number(obj.longitude) || undefined
        }
        return loc
      })
    },
  },

  competencies: {
    type: 'competencies',
    label: 'Competencies',
    icon: 'mdi-school',
    description: 'Competencies, topics, and taxonomy learning objectives.',
    entityName: 'Competency',
    fields: [
      {
        key: 'name',
        label: 'Competency / Topic Name',
        required: true,
        type: 'string',
        description: 'Name of the competency or topic',
        aliases: ['name', 'topic', 'competency', 'title', 'kompetenz', 'thema', 'bezeichnung', 'knowledge_area'],
      },
      {
        key: 'category',
        label: 'Category',
        required: false,
        type: 'string',
        description: 'e.g. Knowledge Area, Subject-Specific Skill, Generic Skill',
        aliases: ['category', 'kategorie', 'area', 'group', 'type'],
      },
      {
        key: 'topic',
        label: 'Topic / Sub-theme',
        required: false,
        type: 'string',
        description: 'Specific topic under category',
        aliases: ['topic', 'subtopic', 'unterthema', 'subject'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Detailed description of the competency',
        aliases: ['description', 'beschreibung', 'details', 'definition', 'desc', 'learning_outcome'],
      },
      {
        key: 'level',
        label: 'Skill Level',
        required: false,
        type: 'enum',
        description: 'Introduction (I), Regular (R), Master (M)',
        options: ['Introduction', 'Regular', 'Master', 'I', 'R', 'M'],
        aliases: ['level', 'skill_level', 'niveau', 'stufe', 'kompetenzstufe'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): Competency[] => {
      return mappedRows.map(obj => {
        const name = String(obj.name || obj.topic || obj.category || 'Unnamed Competency')
        const comp: Competency = {
          name,
        }
        if (obj.category) comp.category = String(obj.category)
        if (obj.topic) comp.topic = String(obj.topic)
        if (obj.description) comp.description = String(obj.description)
        if (obj.level) comp.level = String(obj.level) as SkillLevel
        return comp
      })
    },
  },

  modules: {
    type: 'modules',
    label: 'Modules',
    icon: 'mdi-book-open-page-variant',
    description: 'Curriculum modules, codes, credits, and contact hours.',
    entityName: 'Module',
    fields: [
      {
        key: 'name',
        label: 'Module Name',
        required: true,
        type: 'string',
        description: 'Full name of the module',
        aliases: ['name', 'module_name', 'module name', 'modul', 'modulname', 'title'],
      },
      {
        key: 'code',
        label: 'Module Code',
        required: true,
        type: 'string',
        description: 'Unique module code (e.g. CS101)',
        aliases: ['code', 'module_code', 'module code', 'kuerzel', 'modulcode', 'id'],
      },
      {
        key: 'creditPoints',
        label: 'Credit Points (ECTS)',
        required: false,
        type: 'number',
        description: 'ECTS credits',
        aliases: ['creditpoints', 'credit_points', 'credits', 'ects', 'points'],
      },
      {
        key: 'contactHours',
        label: 'Contact Hours',
        required: false,
        type: 'number',
        description: 'Classroom teaching hours',
        aliases: ['contacthours', 'contact_hours', 'contact hours', 'kontaktzeit', 'praesenz'],
      },
      {
        key: 'selfStudyHours',
        label: 'Self-Study Hours',
        required: false,
        type: 'number',
        description: 'Independent study hours',
        aliases: ['selfstudyhours', 'self_study_hours', 'self study', 'selbststudium'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Module overview and syllabus',
        aliases: ['description', 'beschreibung', 'syllabus', 'details'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): Module[] => {
      return mappedRows.map(obj => {
        const mod: Module = {
          name: String(obj.name || ''),
          code: String(obj.code || ''),
        }
        if (obj.description) mod.description = String(obj.description)
        if (obj.creditPoints !== undefined && obj.creditPoints !== '') {
          mod.creditPoints = Number(obj.creditPoints) || undefined
        }
        if (obj.contactHours !== undefined && obj.contactHours !== '') {
          mod.contactHours = Number(obj.contactHours) || undefined
        }
        if (obj.selfStudyHours !== undefined && obj.selfStudyHours !== '') {
          mod.selfStudyHours = Number(obj.selfStudyHours) || undefined
        }
        return mod
      })
    },
  },

  study_programs: {
    type: 'study_programs',
    label: 'Study Programs',
    icon: 'mdi-school-outline',
    description: 'Degree study programs (BSc, MSc, MAS, etc.).',
    entityName: 'Study Program',
    fields: [
      {
        key: 'name',
        label: 'Program Name',
        required: true,
        type: 'string',
        description: 'Name of the degree program',
        aliases: ['name', 'program_name', 'program name', 'studiengang', 'study_program', 'title'],
      },
      {
        key: 'degreeType',
        label: 'Degree Type',
        required: false,
        type: 'string',
        description: 'e.g. BSc, MSc, Certificate',
        aliases: ['degreetype', 'degree_type', 'degree', 'abschluss', 'type'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Program description',
        aliases: ['description', 'beschreibung', 'details'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): StudyProgram[] => {
      return mappedRows.map(obj => {
        const sp: StudyProgram = {
          name: String(obj.name || ''),
        }
        if (obj.degreeType) sp.degreeType = String(obj.degreeType)
        if (obj.description) sp.description = String(obj.description)
        return sp
      })
    },
  },
}

function parseBoolean(val: any): boolean {
  if (typeof val === 'boolean') return val
  if (!val) return false
  const s = String(val).toLowerCase().trim()
  return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'ja' || s === 't'
}
