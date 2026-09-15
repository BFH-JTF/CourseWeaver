import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseCsv, detectDelimiter } from '../csvParser'
import { autoMapColumns, IMPORT_CONFIGS } from '../csvSchemas'
import type { Competency } from '../../types/competency'
import type { Location } from '../../types/location'
import type { Room } from '../../types/room'
import type { ProofOfKnowledge } from '../../types/proofOfKnowledge'

console.log('--- Starting CSV Import Unit Tests ---')

// 1. Delimiter Detection
assert.strictEqual(detectDelimiter('name,building,campus'), ',')
assert.strictEqual(detectDelimiter('name;building;campus'), ';')
assert.strictEqual(detectDelimiter('name\tbuilding\tcampus'), '\t')
console.log('✓ Delimiter detection passed')

// 2. CSV Parser with quoted fields and newlines
const sampleCsv = `ID,Category,Topic,Description
1,Knowledge Area,"Ethics, Responsibility and Sustainability","Acting responsibly and ethically in business, covering social,
cultural, legal, economic, and environmental considerations."
2,Knowledge Area,Markets and Economies,"How markets for goods, services, and resources develop and function."`

const parsed = parseCsv(sampleCsv)
assert.strictEqual(parsed.headers.length, 4)
assert.strictEqual(parsed.headers[0], 'ID')
assert.strictEqual(parsed.headers[1], 'Category')
assert.strictEqual(parsed.headers[2], 'Topic')
assert.strictEqual(parsed.headers[3], 'Description')
assert.strictEqual(parsed.rows.length, 2)
assert.strictEqual(parsed.rows[0]!['Topic'], 'Ethics, Responsibility and Sustainability')
assert.ok(parsed.rows[0]!['Description']?.includes('cultural, legal'))
console.log('✓ CSV parser quotes and multiline handling passed')

// 3. Auto-Mapping for Competencies
const compConfig = IMPORT_CONFIGS.competencies
const compMapping = autoMapColumns(parsed.headers, compConfig.fields)
assert.strictEqual(compMapping.name, 'Topic') // matches alias 'topic'
assert.strictEqual(compMapping.category, 'Category')
assert.strictEqual(compMapping.description, 'Description')
assert.strictEqual(compMapping.level, null) // optional, not in CSV
console.log('✓ Competency auto-mapping passed')

// 4. Transform Competencies
const compMappedRows = parsed.rows.map(row => {
  const obj: Record<string, any> = {}
  for (const field of compConfig.fields) {
    const csvHeader = compMapping[field.key]
    if (csvHeader && row[csvHeader] !== undefined) {
      obj[field.key] = row[csvHeader]
    }
  }
  return obj
})
const competencies = compConfig.transform(compMappedRows) as Competency[]
assert.strictEqual(competencies.length, 2)
assert.strictEqual(competencies[0]!.name, 'Ethics, Responsibility and Sustainability')
assert.strictEqual(competencies[0]!.category, 'Knowledge Area')
console.log('✓ Competency transformation passed')

// 5. Test with actual docs/initial_topic_catalog.csv file
const catalogPath = resolve(process.cwd(), 'docs/initial_topic_catalog.csv')
const catalogContent = readFileSync(catalogPath, 'utf-8')
const catalogParsed = parseCsv(catalogContent)
assert.strictEqual(catalogParsed.rows.length, 25)

const catalogMapping = autoMapColumns(catalogParsed.headers, compConfig.fields)
assert.strictEqual(catalogMapping.name, 'Topic')
const catalogMappedRows = catalogParsed.rows.map(row => {
  const obj: Record<string, any> = {}
  for (const field of compConfig.fields) {
    const csvHeader = catalogMapping[field.key]
    if (csvHeader && row[csvHeader] !== undefined) {
      obj[field.key] = row[csvHeader]
    }
  }
  return obj
})
const catalogEntities = compConfig.transform(catalogMappedRows) as Competency[]
assert.strictEqual(catalogEntities.length, 25)
assert.strictEqual(catalogEntities[24]!.name, 'Self-Reflection')
console.log('✓ Real initial_topic_catalog.csv test passed (25 topics mapped)')

// 6. Test Locations mapping & transformation
const locCsv = `Name,Campus,Building,Address,Latitude,Longitude
Main Building,North Campus,Building A,Street 1,52.5201,13.4049`
const locParsed = parseCsv(locCsv)
const locConfig = IMPORT_CONFIGS.locations
const locMapping = autoMapColumns(locParsed.headers, locConfig.fields)
assert.strictEqual(locMapping.name, 'Name')
assert.strictEqual(locMapping.campus, 'Campus')
assert.strictEqual(locMapping.building, 'Building')
assert.strictEqual(locMapping.latitude, 'Latitude')
assert.strictEqual(locMapping.longitude, 'Longitude')

const locMappedRows = locParsed.rows.map(row => {
  const obj: Record<string, any> = {}
  for (const field of locConfig.fields) {
    const csvHeader = locMapping[field.key]
    if (csvHeader && row[csvHeader] !== undefined) {
      obj[field.key] = row[csvHeader]
    }
  }
  return obj
})
const locations = locConfig.transform(locMappedRows) as Location[]
assert.strictEqual(locations.length, 1)
assert.strictEqual(locations[0]!.name, 'Main Building')
assert.strictEqual(locations[0]!.building, 'Building A')
assert.strictEqual(locations[0]!.campus, 'North Campus')
assert.strictEqual(locations[0]!.latitude, 52.5201)
assert.strictEqual(locations[0]!.longitude, 13.4049)
console.log('✓ Location mapping and transformation passed')

// 7. Test Rooms mapping & transformation
const roomCsv = `name,room_number,floor,room_type,capacity_seats,equipment_projector,accessibility_step_free_access
Lab 101,101,1,computer_lab,30,true,true`
const roomParsed = parseCsv(roomCsv)
const roomConfig = IMPORT_CONFIGS.rooms
const roomMapping = autoMapColumns(roomParsed.headers, roomConfig.fields)
assert.strictEqual(roomMapping.name, 'name')
assert.strictEqual(roomMapping.room_number, 'room_number')
assert.strictEqual(roomMapping.floor, 'floor')
assert.strictEqual(roomMapping.room_type, 'room_type')
assert.strictEqual(roomMapping.capacity_seats, 'capacity_seats')
assert.strictEqual(roomMapping.equipment_projector, 'equipment_projector')
assert.strictEqual(roomMapping.accessibility_step_free_access, 'accessibility_step_free_access')

const roomMappedRows = roomParsed.rows.map(row => {
  const obj: Record<string, any> = {}
  for (const field of roomConfig.fields) {
    const csvHeader = roomMapping[field.key]
    if (csvHeader && row[csvHeader] !== undefined) {
      obj[field.key] = row[csvHeader]
    }
  }
  return obj
})
const rooms = roomConfig.transform(roomMappedRows) as Room[]
assert.strictEqual(rooms.length, 1)
assert.strictEqual(rooms[0]!.name, 'Lab 101')
assert.strictEqual(rooms[0]!.room_number, '101')
assert.strictEqual(rooms[0]!.floor, 1)
assert.strictEqual(rooms[0]!.room_type, 'computer_lab')
assert.strictEqual(rooms[0]!.capacity.seats, 30)
assert.strictEqual(rooms[0]!.equipment?.projector, true)
assert.strictEqual(rooms[0]!.accessibility.step_free_access, true)
console.log('✓ Room mapping and transformation passed')

// 8. Test Headerless CSV parsing & manual mapping
const headerlessCsv = `Auditorium Maximum,AUD-100,0,lecture_hall,250
Lab Beta,B-201,2,computer_lab,40`

const headerlessParsed = parseCsv(headerlessCsv, { hasHeader: false })
assert.strictEqual(headerlessParsed.headers.length, 5)
assert.strictEqual(headerlessParsed.headers[0], 'Column 1')
assert.strictEqual(headerlessParsed.headers[1], 'Column 2')
assert.strictEqual(headerlessParsed.headers[2], 'Column 3')
assert.strictEqual(headerlessParsed.headers[3], 'Column 4')
assert.strictEqual(headerlessParsed.headers[4], 'Column 5')
assert.strictEqual(headerlessParsed.rows.length, 2)
assert.strictEqual(headerlessParsed.rows[0]!['Column 1'], 'Auditorium Maximum')
assert.strictEqual(headerlessParsed.rows[1]!['Column 1'], 'Lab Beta')

// Map manually for headerless data
const headerlessMapping = {
  name: 'Column 1',
  room_number: 'Column 2',
  floor: 'Column 3',
  room_type: 'Column 4',
  capacity_seats: 'Column 5',
}
const headerlessMappedRows = headerlessParsed.rows.map(row => {
  const obj: Record<string, any> = {}
  for (const field of roomConfig.fields) {
    const csvCol = headerlessMapping[field.key as keyof typeof headerlessMapping]
    if (csvCol && row[csvCol] !== undefined) {
      obj[field.key] = row[csvCol]
    }
  }
  return obj
})
const headerlessRooms = roomConfig.transform(headerlessMappedRows) as Room[]
assert.strictEqual(headerlessRooms.length, 2)
assert.strictEqual(headerlessRooms[0]!.name, 'Auditorium Maximum')
assert.strictEqual(headerlessRooms[0]!.room_number, 'AUD-100')
assert.strictEqual(headerlessRooms[0]!.floor, 0)
assert.strictEqual(headerlessRooms[0]!.room_type, 'lecture_hall')
assert.strictEqual(headerlessRooms[0]!.capacity.seats, 250)
assert.strictEqual(headerlessRooms[1]!.name, 'Lab Beta')
assert.strictEqual(headerlessRooms[1]!.room_number, 'B-201')
assert.strictEqual(headerlessRooms[1]!.floor, 2)
assert.strictEqual(headerlessRooms[1]!.room_type, 'computer_lab')
assert.strictEqual(headerlessRooms[1]!.capacity.seats, 40)
console.log('✓ Headerless CSV parsing and mapping passed')

// 9. Test Proofs of Knowledge mapping & transformation
const proofCsv = `name,description,assessment_type,multiple_choice,free_text,assignment_type,duration_minutes
Midterm Exam,Covers modules 1 to 4,written,true,true,individual,90
Project Presentation,Group project pitch and demo,oral,false,false,group,30`

const proofParsed = parseCsv(proofCsv)
const proofConfig = IMPORT_CONFIGS.proofs_of_knowledge
const proofMapping = autoMapColumns(proofParsed.headers, proofConfig.fields)
assert.strictEqual(proofMapping.name, 'name')
assert.strictEqual(proofMapping.description, 'description')
assert.strictEqual(proofMapping.assessmentType, 'assessment_type')
assert.strictEqual(proofMapping.multipleChoice, 'multiple_choice')
assert.strictEqual(proofMapping.freeText, 'free_text')
assert.strictEqual(proofMapping.assignmentScope, 'assignment_type')
assert.strictEqual(proofMapping.durationMinutes, 'duration_minutes')

const proofMappedRows = proofParsed.rows.map(row => {
  const obj: Record<string, any> = {}
  for (const field of proofConfig.fields) {
    const csvHeader = proofMapping[field.key]
    if (csvHeader && row[csvHeader] !== undefined) {
      obj[field.key] = row[csvHeader]
    }
  }
  return obj
})
const proofs = proofConfig.transform(proofMappedRows) as ProofOfKnowledge[]
assert.strictEqual(proofs.length, 2)
assert.strictEqual(proofs[0]!.name, 'Midterm Exam')
assert.strictEqual(proofs[0]!.assessmentType, 'written')
assert.strictEqual(proofs[0]!.multipleChoice, true)
assert.strictEqual(proofs[0]!.freeText, true)
assert.strictEqual(proofs[0]!.assignmentScope, 'individual')
assert.strictEqual(proofs[0]!.durationMinutes, 90)

assert.strictEqual(proofs[1]!.name, 'Project Presentation')
assert.strictEqual(proofs[1]!.assessmentType, 'oral')
assert.strictEqual(proofs[1]!.multipleChoice, false)
assert.strictEqual(proofs[1]!.freeText, false)
assert.strictEqual(proofs[1]!.assignmentScope, 'group')
assert.strictEqual(proofs[1]!.durationMinutes, 30)
console.log('✓ Proof of Knowledge auto-mapping and transformation passed')

console.log('--- All CSV Import Unit Tests Passed Successfully ---')
