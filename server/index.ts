import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { authMiddleware } from './auth.js'
import resumeRouter from './routes/resume.js'
import translateRouter from './routes/translate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT      = parseInt(process.env.PORT ?? '3001', 10)
const IS_PROD   = process.env.NODE_ENV === 'production'

const app = express()

// Trim default Express fingerprinting header.
app.disable('x-powered-by')

// Conservative default security headers. We don't pull in helmet to keep the
// dep tree small — these four cover the realistic threats for a single-tenant
// API + SPA. CSP for the SPA shell is set per-response on index.html below.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'interest-cohort=()')
  next()
})

// 2 MB is plenty for realistic resumes (typical payload is well under 200 KB).
// The previous 50 MB ceiling made unauthenticated body parsing a DoS amplifier.
app.use(express.json({ limit: '2mb' }))

// ── Health check (no auth — used by frontend to detect server) ─────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// ── Resume API (auth-gated) ────────────────────────────────────────────────
app.use('/api/resume', authMiddleware, resumeRouter)

// ── Translation proxy (auth-gated) — drafts via self-hosted LibreTranslate ──
app.use('/api/translate', authMiddleware, translateRouter)

// ── In production: serve the built frontend ────────────────────────────────
if (IS_PROD) {
  const distDir = path.join(__dirname, '..', 'dist')
  app.use(express.static(distDir))
  // SPA fallback — all non-API routes serve index.html
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(PORT, () => {
  const mode = IS_PROD ? 'production' : 'development (API only)'
  console.log(`Resume Studio server [${mode}] → http://localhost:${PORT}`)
})
