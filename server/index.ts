import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDatabase } from './db'
import { apiRouter } from './routes/api'
import { timetableRouter } from './routes/timetable'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const app = express()
const PORT = process.env.PORT || 3000

// Middlewares
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// REST API routes
app.use('/api/timetable', timetableRouter)
app.use('/api', apiRouter)

// Serve production static assets if available
const distPath = path.resolve(__dirname, '../dist')
app.use(express.static(distPath))

// SPA fallback middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next()
  }
  const indexPath = path.join(distPath, 'index.html')
  res.sendFile(indexPath, err => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>CourseWeaver API Server</title></head>
          <body style="font-family: sans-serif; padding: 2rem;">
            <h1>CourseWeaver Express API Server</h1>
            <p>API is running at <a href="/api/health">/api/health</a>.</p>
            <p>For frontend development, run <code>npm run dev</code> or <code>npm run dev:client</code>.</p>
          </body>
        </html>
      `)
    }
  })
})

export async function startServer(port = PORT) {
  await initDatabase()
  return new Promise(resolve => {
    const server = app.listen(port, () => {
      console.log(`[Server] Express API server listening on http://localhost:${port}`)
      resolve(server)
    })
  })
}

// If executed directly
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)
if (isMainModule) {
  startServer()
}
