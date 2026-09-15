import { Pool } from 'pg'

export interface EntityRecord {
  id: string
  [key: string]: any
}

// In-memory fallback storage in case PostgreSQL server is not currently reachable
const memoryStore: Map<string, Map<string, any>> = new Map()

function getMemoryTable(table: string): Map<string, any> {
  if (!memoryStore.has(table)) {
    memoryStore.set(table, new Map())
  }
  return memoryStore.get(table)!
}

let pool: Pool | null = null
let isConnected = false

export function getDbConfig() {
  const host = process.env.POSTGRES_HOST || 'localhost'
  const port = parseInt(process.env.POSTGRES_PORT || '5432', 10)
  const database = process.env.POSTGRES_DB || 'courseweaver'
  const user = process.env.POSTGRES_USER || 'courseweaver'
  const password = process.env.POSTGRES_PASSWORD || 'courseweaver'

  return {
    host,
    port,
    database,
    user,
    password,
    connectionTimeoutMillis: 3000,
  }
}

export async function initDatabase(): Promise<boolean> {
  try {
    const config = getDbConfig()
    pool = new Pool(config)

    // Verify connection
    const client = await pool.connect()
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS entity_store (
          table_name VARCHAR(100) NOT NULL,
          id VARCHAR(255) NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (table_name, id)
        );
        CREATE INDEX IF NOT EXISTS idx_entity_store_table ON entity_store(table_name);
      `)
      isConnected = true
      console.log(`[Database] Successfully connected to PostgreSQL at ${config.host}:${config.port}/${config.database}`)
      return true
    } finally {
      client.release()
    }
  } catch (err: any) {
    isConnected = false
    console.warn(`[Database] PostgreSQL connection failed (${err.message}). Using in-memory store fallback.`)
    return false
  }
}

export function isDbConnected(): boolean {
  return isConnected
}

export async function getAllEntities(tableName: string): Promise<any[]> {
  if (isConnected && pool) {
    try {
      const res = await pool.query(
        'SELECT id, data, created_at, updated_at FROM entity_store WHERE table_name = $1 ORDER BY created_at ASC',
        [tableName]
      )
      return res.rows.map(row => {
        const item = typeof row.data === 'object' && row.data !== null ? row.data : {}
        return {
          ...item,
          id: row.id,
          _id: row.id,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }
      })
    } catch (err) {
      console.error(`[Database] Error fetching from ${tableName}:`, err)
    }
  }

  // Fallback
  const table = getMemoryTable(tableName)
  return Array.from(table.values())
}

export async function getEntityById(tableName: string, id: string): Promise<any | null> {
  if (isConnected && pool) {
    try {
      const res = await pool.query(
        'SELECT id, data, created_at, updated_at FROM entity_store WHERE table_name = $1 AND id = $2',
        [tableName, id]
      )
      if (res.rows.length > 0) {
        const row = res.rows[0]
        const item = typeof row.data === 'object' && row.data !== null ? row.data : {}
        return {
          ...item,
          id: row.id,
          _id: row.id,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }
      }
      return null
    } catch (err) {
      console.error(`[Database] Error fetching ${tableName}/${id}:`, err)
    }
  }

  const table = getMemoryTable(tableName)
  return table.get(id) || null
}

export async function saveEntity(tableName: string, id: string, data: any): Promise<any> {
  const cleanData = { ...data, id, _id: id }
  const now = new Date().toISOString()

  if (isConnected && pool) {
    try {
      await pool.query(
        `INSERT INTO entity_store (table_name, id, data, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (table_name, id)
         DO UPDATE SET data = $3, updated_at = $4`,
        [tableName, id, JSON.stringify(cleanData), now]
      )
      return { ...cleanData, updated_at: now }
    } catch (err) {
      console.error(`[Database] Error saving to ${tableName}:`, err)
    }
  }

  const table = getMemoryTable(tableName)
  const record = {
    ...cleanData,
    created_at: table.get(id)?.created_at || now,
    updated_at: now,
  }
  table.set(id, record)
  return record
}

export async function deleteEntity(tableName: string, id: string): Promise<boolean> {
  if (isConnected && pool) {
    try {
      const res = await pool.query(
        'DELETE FROM entity_store WHERE table_name = $1 AND id = $2',
        [tableName, id]
      )
      return (res.rowCount ?? 0) > 0
    } catch (err) {
      console.error(`[Database] Error deleting from ${tableName}:`, err)
    }
  }

  const table = getMemoryTable(tableName)
  return table.delete(id)
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    isConnected = false
  }
}
