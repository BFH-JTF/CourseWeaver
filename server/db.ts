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
  // Review #9: kein hartkodiertes Default-Passwort mehr. Ohne gesetzte
  // Umgebungsvariable wird PostgreSQL bewusst NICHT benutzt (In-Memory mit
  // explizitem Warnhinweis) — still weitermachen mit 'courseweaver' wäre
  // ein erratbares Passwort im Quellcode.
  const password = process.env.POSTGRES_PASSWORD || ''

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
  if (!process.env.POSTGRES_PASSWORD) {
    console.warn(
      '[Database] POSTGRES_PASSWORD nicht gesetzt — PostgreSQL wird NICHT benutzt. ' +
        'In-Memory-Fallback aktiv (kein Persistieren über Server-Neustart!).',
    )
    return false
  }
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
    // Datenverlust-Schutz: Wenn PostgreSQL konfiguriert (POSTGRES_PASSWORD gesetzt)
    // aber nicht erreichbar ist, darf der Server nicht still im RAM weiterarbeiten —
    // importierte Daten waren sonst nach einem Neustart verloren (passiert so).
    // Nur mit ALLOW_INMEMORY_FALLBACK=true gilt die alte RAM-only-Strategie weiter.
    if (process.env.ALLOW_INMEMORY_FALLBACK === 'true') {
      console.warn(
        `[Database] PostgreSQL connection failed (${err.message}). ` +
          'In-Memory-Fallback erzwungen (ALLOW_INMEMORY_FALLBACK=true) — Daten gehen bei Neustart verloren!',
      )
      return false
    }
    throw new Error(
      `[Database] PostgreSQL nicht erreichbar: ${err.message}. ` +
        'Datenbank starten (docker compose up -d postgres) oder bewusst ' +
        'ALLOW_INMEMORY_FALLBACK=true setzen (RAM-only, Datenverlust bei Neustart!).',
    )
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
      // Review #4: Query-Fehler bei bestehender Verbindung NICHT swallowen —
      // weiterwerfen, so dass die Route mit 500 antwortet (kein leerer
      // In-Memory-Fallback beim aufrufer -> stiller Datenverlust).
      console.error(`[Database] Error fetching from ${tableName}:`, err)
      throw err
    }
  }

  // Fallback nur wenn NICHT verbunden (bewusster Degraded-Modus)
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
      throw err // Review #4: nicht still auf leeren Fallback wechseln
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
      throw err // Review #4: Fehler weiterwerfen -> Route antwortet 500, kein stiller Datenverlust
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
      throw err // Review #4
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

// ---------------------------------------------------------------------------
// Kap. 6 — pgvector: Learning-Cycle-Embeddings, SEPARAT vom generic entity_store.
// Vektor-Ähnlichkeitssuche braucht vector-Spaltentyp + ivfflat-Index — kein
// JSONB-Workaround. getAllEntities/saveEntity bleiben für die fachlichen
// Objekte (LearningCycle, OverlapAssessment, Review-Status) zuständig; die
// Vektorsuche läuft über die typisierten Funktionen hier unten.
// ---------------------------------------------------------------------------

/** Dimension muss zum Embedding-Modell passen (z.B. nomic-embed-text: 768) */
let vectorDimension = Number(process.env.EMBEDDING_DIMENSION ?? 1024)

export function setVectorDimension(dim: number): void {
  if (!Number.isFinite(dim) || dim <= 0) throw new Error('EMBEDDING_DIMENSION > 0 erforderlich')
  vectorDimension = Math.floor(dim)
}

export async function initEmbeddingsTable(): Promise<void> {
  if (!(isConnected && pool)) {
    return // Degraded-Modus (In-Memory): Vektorsuche deaktiviert
  }
  await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS learning_cycle_embeddings (
      cycle_id VARCHAR(255) PRIMARY KEY,
      embedding vector(${vectorDimension}) NOT NULL,
      model_id VARCHAR(100) NOT NULL,
      text_hash VARCHAR(64),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  // text_hash nachträglich ergänzen (Bestandstabellen ohne Migration erweitern)
  await pool.query(`ALTER TABLE learning_cycle_embeddings ADD COLUMN IF NOT EXISTS text_hash VARCHAR(64)`)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_lc_embeddings_ivfflat
      ON learning_cycle_embeddings USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
  `).catch(() => {
    // ivfflat braucht lists im Verhältnis zur Datenmenge; ohne Index funktioniert die Suche (seq scan)
    console.warn('[Database] ivfflat-Index nicht angelegt — Vektorsuche läuft ohne Index')
  })
}

export interface CycleEmbeddingRef {
  cycleId: string
  similarity: number
}

function toPgVector(v: number[]): string {
  return `[${v.join(',')}]`
}

function parsePgVector(s: string): number[] {
  return s
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isFinite(n))
}

/** Embedding persistieren (idempotent), getrennt von saveEntity. */
export async function saveCycleEmbedding(
  cycleId: string,
  embedding: number[],
  modelId: string,
  textHash?: string,
): Promise<void> {
  if (!(isConnected && pool)) throw new Error('pgvector: keine PostgreSQL-Verbindung')
  await pool.query(
    `INSERT INTO learning_cycle_embeddings (cycle_id, embedding, model_id, text_hash)
     VALUES ($1, $2::vector, $3, $4)
     ON CONFLICT (cycle_id) DO UPDATE SET embedding = $2::vector, model_id = $3, text_hash = $4, created_at = NOW()`,
    [cycleId, toPgVector(embedding), modelId, textHash ?? null],
  )
}

/**
 * Kap. 2.1 Schritt 2 — Cache-Lesen: gecachte Embeddings für die gegebenen
 * LCs (nur passend zum Modell). Der text_hash macht sichtbar, ob der Text
 * seit dem Cachen geändert hat; die Entscheidung trifft der Aufrufer.
 */
export interface CachedCycleEmbedding {
  embedding: number[]
  textHash: string | null
}

export async function getCachedCycleEmbeddings(
  cycleIds: string[],
  modelId: string,
): Promise<Map<string, CachedCycleEmbedding>> {
  if (!(isConnected && pool)) throw new Error('pgvector: keine PostgreSQL-Verbindung')
  if (cycleIds.length === 0) return new Map()
  const res = await pool.query(
    `SELECT cycle_id, embedding, text_hash
     FROM learning_cycle_embeddings
     WHERE model_id = $1 AND cycle_id = ANY($2)`,
    [modelId, cycleIds],
  )
  const out = new Map<string, CachedCycleEmbedding>()
  for (const row of res.rows) {
    const embedding = parsePgVector(String(row.embedding))
    if (embedding.length === 0) continue
    out.set(String(row.cycle_id), { embedding, textHash: row.text_hash ? String(row.text_hash) : null })
  }
  return out
}

/**
 * Kap. 2 — findTopKSimilar: Typisierte Vektor-Ähnlichkeitssuche
 * (cosine), NICHT über die generische Entity-API.
 */
export async function findTopKSimilar(
  embedding: number[],
  topK: number,
  threshold: number,
  modelId?: string,
): Promise<CycleEmbeddingRef[]> {
  if (!(isConnected && pool)) throw new Error('pgvector: keine PostgreSQL-Verbindung')
  const res = await pool.query(
    `SELECT cycle_id, model_id, 1 - (embedding <=> $1::vector) AS similarity
     FROM learning_cycle_embeddings
     WHERE 1 - (embedding <=> $1::vector) >= $2
       AND ($4::varchar IS NULL OR model_id = $4::varchar)
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [toPgVector(embedding), threshold, topK, modelId ?? null],
  )
  return res.rows.map((row) => ({
    cycleId: String(row.cycle_id),
    similarity: Number(row.similarity),
  }))
}
