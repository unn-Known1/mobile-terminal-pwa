import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { createSession, deleteSession, getSession, getAllSessions, listDirectory, recordSocketDisconnect, clearSocketDisconnect } from './pty-manager.js'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import archiver from 'archiver'
import multer from 'multer'
import cookieParser from 'cookie-parser'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 5151
const HOST = process.env.HOST || '0.0.0.0'

const app = express()
const server = createServer(app)
app.use(cookieParser())
app.use(express.json())

// PIN verification middleware - require valid token for all routes except API
const validTokens = new Set()
let tunnelPin = null
let tunnelUrl = null
let tunnelActive = false

// API auth middleware - check tunnel token for protected API routes
function apiAuth(req, res, next) {
  if (!tunnelActive) return next()

  const headerToken = req.headers['x-tunnel-token']
  const queryToken = req.query.token
  const cookieToken = req.cookies?.tunnel_token

  if (headerToken && validTokens.has(headerToken)) return next()
  if (queryToken && validTokens.has(queryToken)) return next()
  if (cookieToken && validTokens.has(cookieToken)) return next()

  // Allow tunnel management APIs without auth (they verify PIN)
  if (req.path.startsWith('/api/tunnel/verify')) return next()

  return res.status(401).json({ error: 'Authentication required' })
}

function checkToken(req, res, next) {
  // Allow if no tunnel is active
  if (!tunnelActive) {
    return next()
  }

  // Allow Socket.IO always (auth handled via token in handshake)
  if (req.path === '/socket.io' || req.path.startsWith('/socket.io/')) {
    return next()
  }

  // Check for token in x-tunnel-token header (from sessionStorage)
  const headerToken = req.headers['x-tunnel-token']
  if (headerToken && validTokens.has(headerToken)) {
    return next()
  }

  // Check for token in query string (initial load with token)
  const queryToken = req.query.token
  if (queryToken && validTokens.has(queryToken)) {
    // Store token in a custom header that static middleware can use
    req.tunnelToken = queryToken
    return next()
  }

  // Check for token in cookie
  const cookieToken = req.cookies?.tunnel_token
  if (cookieToken && validTokens.has(cookieToken)) {
    return next()
  }

  // Serve PIN entry page
  return res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terminal - PIN Required</title>
  <style>
    body { margin: 0; background: #0F172A; color: #F8FAFC; font-family: system-ui, sans-serif; 
           display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .pin-box { text-align: center; padding: 40px; background: #1E293B; border-radius: 16px; 
               box-shadow: 0 4px 24px rgba(0,0,0,0.3); }
    h1 { margin: 0 0 20px; font-size: 24px; }
    input { padding: 12px 16px; font-size: 24px; text-align: center; letter-spacing: 8px; 
            width: 180px; border: 2px solid #475569; border-radius: 8px; background: #0F172A; 
            color: #F8FAFC; outline: none; }
    input:focus { border-color: #22C55E; }
    button { margin-top: 20px; padding: 12px 32px; font-size: 16px; background: #22C55E; 
             color: #0F172A; border: none; border-radius: 8px; cursor: pointer; }
    button:hover { background: #16A34A; }
    .error { color: #EF4444; margin-top: 12px; display: none; }
  </style>
</head>
<body>
  <div class="pin-box">
    <label for="pin">🔒 Enter PIN</label>
    <input type="text" id="pin" name="pin" maxlength="6" placeholder="000000" />
    <br/>
    <button onclick="verifyPin()">Enter</button>
    <div class="error" id="error">Invalid PIN</div>
  </div>
  <script>
    async function verifyPin() {
      const pin = document.getElementById('pin').value;
      const error = document.getElementById('error');
      error.style.display = 'none';
      try {
        const res = await fetch('/api/tunnel/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        const data = await res.json();
        if (data.valid) {
          sessionStorage.setItem('tunnel-token', data.token);
          window.location.href = '/?token=' + data.token;
        } else {
          error.style.display = 'block';
        }
      } catch {
        error.style.display = 'block';
      }
    }
    document.getElementById('pin').addEventListener('keyup', e => {
      if (e.key === 'Enter') verifyPin();
    });
  </script>
</body>
</html>
  `)
}

// Apply API auth middleware to all API routes
app.use('/api', apiAuth)

app.use(checkToken)
app.use(express.static(path.join(__dirname, '../dist')))

const io = new Server(server, { cors: { origin: '*' } })

// Critical Fix #1: Socket.IO Authentication Middleware
// Before allowing any socket connection, verify the tunnel token
io.use((socket, next) => {
  // If tunnel is not active, allow all connections (local mode)
  if (!tunnelActive) {
    return next()
  }

  // Check for token in handshake auth, headers, or query
  const authToken = socket.handshake.auth?.token
  const headerToken = socket.handshake.headers['x-tunnel-token']
  const queryToken = socket.handshake.query?.token
  const cookieToken = socket.handshake.headers?.cookie?.match(/tunnel_token=([^;]+)/)?.[1]

  // Validate token from any source
  const tokenToCheck = authToken || headerToken || queryToken || cookieToken
  if (tokenToCheck && validTokens.has(tokenToCheck)) {
    socket.tunnelToken = tokenToCheck
    return next()
  }

  // Token invalid or missing - reject connection
  console.log('[Socket Auth] Rejected connection: invalid or missing token')
  next(new Error('Authentication required'))
})

// Directory listing API
app.get('/api/ls', (req, res) => {
  const homeDir = process.env.HOME || '/home/' + process.env.USER
  res.json(listDirectory(homeDir))
})

app.get('/api/ls/*', (req, res) => {
  const homeDir = process.env.HOME || '/home/' + process.env.USER

  // Fix B04: Support both query param and path param
  // Client sends ?path=... but we also accept /api/ls/some/dir
  const queryPath = req.query.path
  const pathParam = req.params[0] || ''
  const pathInput = queryPath || pathParam

  // Build target path - disallow empty or absolute paths from param
  let targetPath
  if (!pathInput || pathInput.trim() === '') {
    targetPath = homeDir
  } else {
    // For query path, validate it's a relative path
    // For path param, join with homeDir
    if (queryPath) {
      // Query param - should be relative, prepend homeDir
      targetPath = path.join(homeDir, queryPath)
    } else {
      // Path param - already processed
      targetPath = path.join(homeDir, pathParam)
    }
  }

  // Security fix: Use realpathSync to resolve ALL symlinks (including symlinks
  // in intermediate directories) and ensure path stays within home directory
  let resolvedPath
  try {
    resolvedPath = fs.realpathSync(targetPath)
  } catch (err) {
    // If path doesn't exist, use the resolved path without realpath
    resolvedPath = path.resolve(targetPath)
  }

  const homeResolved = path.resolve(homeDir)
  // Final check: resolved path must be within home directory
  if (!resolvedPath.startsWith(homeResolved + path.sep) && resolvedPath !== homeResolved) {
    console.warn(`[SECURITY] Path traversal attempt blocked: ${pathInput} -> ${resolvedPath}`)
    return res.status(403).json({ error: 'Access denied: path outside home directory' })
  }

  res.json(listDirectory(resolvedPath))
})

// Current directory for a session
app.get('/api/pwd/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId)
  res.json({ cwd: session?.cwd || process.env.HOME })
})

// Tunnel management
let tunnelProcess = null

function generatePin() {
  // Generate a cryptographically secure 6-digit PIN
  const bytes = crypto.randomBytes(4)
  const num = bytes.readUInt32BE(0)
  return String(num % 900000 + 100000)
}

function generateToken() {
  // Generate a cryptographically secure token using crypto.randomBytes
  const buffer = crypto.randomBytes(24)
  return buffer.toString('base64url')
}

app.post('/api/tunnel/start', async (req, res) => {
  console.log('[TUNNEL] Start request received')
  if (tunnelProcess && tunnelUrl) {
    console.log('[TUNNEL] Already running with URL:', tunnelUrl)
    return res.json({ url: tunnelUrl, pin: tunnelPin, alreadyRunning: true })
  }
  tunnelActive = true
  tunnelPin = generatePin()
  console.log('[TUNNEL] Generated PIN:', tunnelPin)

  // Determine which port to expose via tunnel:
  // - Development mode: target Vite dev server (5173) which proxies API to Express
  // - Production mode: target Express server (5151) which serves built frontend
  const targetPort = process.env.TUNNEL_TARGET_PORT ||
    (process.env.NODE_ENV === 'production' ? (server.address()?.port || PORT) : 5173)

  // Fix B12: Correct env var name is CLOUDFLARED (not CLOUDFARED)
  const cloudflaredPath = process.env.CLOUDFLARED || path.join(process.env.HOME || '/home/' + process.env.USER, '.cloudflared', 'cloudflared')

  // Verify cloudflared binary exists and is executable
  // CWE-20: Validate executable status with specific error messages
  try {
    // Check file exists first
    fs.accessSync(cloudflaredPath, fs.constants.F_OK)
  } catch (e) {
    tunnelActive = false
    return res.json({
      error: `cloudflared binary not found at ${cloudflaredPath}. Run ./tunnel.sh to install.`
    })
  }

  try {
    // Check executable permission
    fs.accessSync(cloudflaredPath, fs.constants.X_OK)
  } catch (e) {
    tunnelActive = false
    return res.json({
      error: `cloudflared binary found but not executable. Check file permissions with: chmod +x ${cloudflaredPath}`
    })
  }

  try {
    tunnelProcess = spawn(cloudflaredPath, ['tunnel', '--url', `http://localhost:${targetPort}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let url = null
    let fullOutput = ''
    const outputLines = []
    const MAX_LINES = 1000 // prevent memory issues
    let urlSent = false // Track if URL was already sent to prevent race condition

    // Cleanup function to clear all timers and intervals
    const cleanup = () => {
      if (errorCheckInterval) clearInterval(errorCheckInterval)
      if (timeoutId) clearTimeout(timeoutId)
      // Clear any pending setTimeout for URL
      if (pendingTimeout) clearTimeout(pendingTimeout)
    }

    const logOutput = (chunk, stream) => {
      const text = chunk.toString()
      console.log(`[cloudflared ${stream}]:`, text.trim())
      // accumulate lines for error detection
      const lines = text.split('\n').filter(l => l.trim())
      lines.forEach(line => {
        if (outputLines.length < MAX_LINES) outputLines.push(line)
        fullOutput += line + '\n'
      })
    }

    // Simple URL extraction: find any trycloudflare.com URL
    const extractUrl = (text) => {
      const match = text.match(/https?:\/\/[a-zA-Z0-9][a-zA-Z0-9.-]*\.trycloudflare\.com\/?/i)
      return match ? match[0].replace(/\/$/, '') : null
    }

    // Pending timeout reference for cleanup
    let pendingTimeout = null

    // Send the URL response
    const sendUrlResponse = (foundUrl) => {
      if (urlSent || res.headersSent) return
      urlSent = true
      cleanup() // Clear all timers once URL is sent
      console.log('[TUNNEL] Sending response to client')
      tunnelUrl = foundUrl
      res.json({ url: foundUrl, pin: tunnelPin })
    }

    // On each data chunk, try to extract and send URL
    const maybeSendUrl = () => {
      if (urlSent || res.headersSent) return
      const foundUrl = extractUrl(fullOutput)
      if (foundUrl && !url) {
        console.log('[TUNNEL] URL found in output:', foundUrl)
        url = foundUrl
        // Clear any previous pending timeout before setting new one
        // Fix B05: prevent leaked setTimeout by clearing old timer first
        if (pendingTimeout) clearTimeout(pendingTimeout)
        // Wait 3 seconds for tunnel to establish before sending response
        pendingTimeout = setTimeout(() => {
          sendUrlResponse(foundUrl)
        }, 3000)
      }
    }

    const onData = (chunk) => {
      logOutput(chunk, 'stdout')
      maybeSendUrl()
    }

    const onErr = (chunk) => {
      logOutput(chunk, 'stderr')
      maybeSendUrl()
    }

    tunnelProcess.stdout.on('data', onData)
    tunnelProcess.stderr.on('data', onErr)

    // Error detection from stderr keywords – be less aggressive to avoid false positives
    const errorKeywords = ['unauthorized', 'denied', 'permission', 'cannot create', 'exited with code']
    let possibleErrorLogged = false
    const checkForError = () => {
      if (urlSent || res.headersSent) return
      // Only fail if we've seen "Your quick Tunnel has been created!" message (indicating we should have URL)
      const hasCreatedMsg = outputLines.some(l => /quick Tunnel has been created/i.test(l))
      if (!hasCreatedMsg) return // still in progress

      const combined = outputLines.join('\n').toLowerCase()
      const found = errorKeywords.find(kw => combined.includes(kw))
      if (found && outputLines.length > 0 && !possibleErrorLogged) {
        possibleErrorLogged = true
        // Likely an error after promising start – capture last few lines
        const recent = outputLines.slice(-3).join('\n').trim()
        console.log('Potential tunnel error after creation message:', recent)
        // Log error with structured data for debugging - helps identify silent failures
        console.warn(JSON.stringify({
          type: 'TUNNEL_ERROR_DETECTED',
          keyword: found,
          recentOutput: recent,
          timestamp: new Date().toISOString()
        }));
      }
    }
    // check for errors every 3 seconds
    const errorCheckInterval = setInterval(checkForError, 3000)

    tunnelProcess.on('exit', (code) => {
      console.log('Tunnel process exited with code:', code)
      cleanup() // Clear all timers on exit
      tunnelProcess = null
      // Clear tunnel state if this was the active tunnel
      if (tunnelActive) {
        tunnelActive = false
        tunnelUrl = null
        tunnelPin = null
        validTokens.clear()
      }
      if (!urlSent && !res.headersSent) {
        res.json({ error: 'Tunnel process exited unexpectedly (code ' + code + ')' })
      }
    })

    const parsedTimeout = parseInt(process.env.TUNNEL_TIMEOUT)
    // Fix B10: Use nullish coalescing instead of OR to allow TUNNEL_TIMEOUT=0
    const timeoutMs = Number.isFinite(parsedTimeout) ? parsedTimeout * 1000 : 90000
    const timeoutId = setTimeout(() => {
      if (!urlSent && !res.headersSent) {
        const lastLines = outputLines.slice(-10).join('\n')
        console.log('Tunnel start timeout. Full output captured:', outputLines.length, 'lines')
        cleanup() // Clear error check interval
        res.json({ 
          error: `Timeout waiting for tunnel URL after ${timeoutMs/1000}s. Target: http://localhost:${targetPort}`,
          debug: { targetPort, lines: outputLines.length, lastLines }
        })
      }
    }, timeoutMs)

    // Wrap res.json to cleanup timers when response is sent
    const originalJson = res.json.bind(res)
    res.json = (body) => {
      cleanup()
      return originalJson(body)
    }

  } catch (err) {
    console.error('Tunnel spawn error:', err)
    res.json({ error: `Failed to start tunnel: ${err.message}` })
  }
})

app.post('/api/tunnel/stop', (req, res) => {
  if (tunnelProcess) {
    tunnelProcess.kill()
    tunnelProcess = null
  }
  tunnelActive = false
  tunnelUrl = null
  tunnelPin = null
  validTokens.clear()
  res.json({ ok: true })
})

app.get('/api/tunnel/status', (req, res) => {
  const processInfo = tunnelProcess ? {
    pid: tunnelProcess.pid,
    exitCode: tunnelProcess.exitCode,
    connected: tunnelProcess.connected
  } : null
  res.json({ 
    running: !!tunnelUrl, 
    pin: tunnelPin, 
    url: tunnelUrl,
    tunnelActive,
    process: processInfo
  })
})

// High Fix #9: Rate limiting for PIN verification to prevent brute force attacks
const rateLimitMap = new Map()
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 60000 // 1 minute lockout after 5 failed attempts

function checkRateLimit(ip) {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record) {
    rateLimitMap.set(ip, { count: 1, firstAttempt: now })
    return { allowed: true }
  }

  // Check if lockout period has expired
  if (record.lockoutUntil && now < record.lockoutUntil) {
    return { allowed: false, waitTime: Math.ceil((record.lockoutUntil - now) / 1000) }
  }

  // Reset if lockout expired
  if (record.lockoutUntil && now >= record.lockoutUntil) {
    record.count = 0
    record.lockoutUntil = null
  }

  // Check if too many attempts in quick succession
  if (now - record.firstAttempt < 30000) { // 30 second window
    record.count++
    if (record.count > MAX_ATTEMPTS) {
      record.lockoutUntil = now + LOCKOUT_DURATION
      return { allowed: false, waitTime: LOCKOUT_DURATION / 1000 }
    }
  } else {
    // Reset if window expired
    record.count = 1
    record.firstAttempt = now
  }

  return { allowed: true }
}

app.post('/api/tunnel/verify', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown'

  // Check rate limit
  const rateCheck = checkRateLimit(clientIp)
  if (!rateCheck.allowed) {
    return res.json({ error: `Too many attempts. Please wait ${rateCheck.waitTime} seconds.` })
  }

  const { pin } = req.body
  if (!pin || pin !== tunnelPin) {
    return res.json({ error: 'Invalid PIN' })
  }
  const token = generateToken()
  validTokens.add(token)
  res.json({ url: tunnelUrl, valid: true, token })
})

 app.post('/api/tunnel/verify-token', (req, res) => {
   const { token } = req.body
   res.json({ valid: validTokens.has(token) })
 })

 // Health check
 app.get('/health', (req, res) => {
   res.json({
     status: 'ok',
     uptime: process.uptime(),
     clients: io.engine.clientsCount,
     tunnelActive,
     tunnelUrl: tunnelActive ? tunnelUrl : null
   })
 })

 // File operations
function validatePath(filePath) {
  const homeDir = process.env.HOME || '/home/' + process.env.USER
  const homeResolved = path.resolve(homeDir)

  // Security fix: Use realpathSync to resolve ALL symlinks (including symlinks
  // in intermediate directories) and prevent symlink traversal attacks
  let resolved
  try {
    resolved = fs.realpathSync(filePath)
  } catch (err) {
    // If file doesn't exist yet, resolve the parent directory and validate
    try {
      const parentDir = path.dirname(filePath)
      const resolvedParent = fs.realpathSync(parentDir)
      resolved = path.join(resolvedParent, path.basename(filePath))
    } catch {
      // Parent doesn't exist - resolve without realpath
      resolved = path.resolve(filePath)
    }
  }

  // Final check: resolved path must be within home directory
  // Use path.sep to ensure we match complete directory names
  if (!resolved.startsWith(homeResolved + path.sep) && resolved !== homeResolved) {
    return { error: 'Access denied: path outside home directory' }
  }
  return null
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry)
    const destPath = path.join(dest, entry)
    const stats = fs.statSync(srcPath)
    if (stats.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

app.get('/api/file/info', (req, res) => {
  const filePath = req.query.path
  if (!filePath) return res.json({ error: 'Missing path' })
  const validation = validatePath(filePath)
  if (validation) return res.json(validation)
  try {
    const stats = fs.statSync(filePath)
    res.json({ exists: true, isDirectory: stats.isDirectory(), size: stats.size, mtime: stats.mtime })
  } catch {
    res.json({ exists: false })
  }
})

// File read/write endpoints for code editor
app.get('/api/file/read', (req, res) => {
  const filePath = req.query.path
  if (!filePath) return res.json({ error: 'Missing path' })
  const validation = validatePath(filePath)
  if (validation) return res.json(validation)
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    res.json({ content })
  } catch (err) {
    res.json({ error: err.message })
  }
})

app.post('/api/file/write', (req, res) => {
  const { path: filePath, content } = req.body
  if (!filePath) return res.json({ error: 'Missing path' })
  const validation = validatePath(filePath)
  if (validation) return res.json(validation)
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    res.json({ ok: true })
  } catch (err) {
    res.json({ error: err.message })
  }
})

app.post('/api/file/create', (req, res) => {
  const { path: filePath } = req.body
  if (!filePath) return res.json({ error: 'Missing path' })
  const validation = validatePath(filePath)
  if (validation) return res.json(validation)
  try {
    fs.writeFileSync(filePath, '')
    res.json({ ok: true })
  } catch (err) {
    res.json({ error: err.message })
  }
})

app.post('/api/file/rename', (req, res) => {
  const { oldPath, newName } = req.body
  if (!oldPath || !newName) return res.json({ error: 'Missing parameters' })
  const validation = validatePath(oldPath)
  if (validation) return res.json(validation)
  try {
    const dir = path.dirname(oldPath)
    const newPath = path.join(dir, newName)
    // CWE-22: Validate the constructed newPath to prevent path traversal
    const newPathValidation = validatePath(newPath)
    if (newPathValidation) return res.json(newPathValidation)
    if (fs.existsSync(newPath)) return res.json({ error: 'File already exists' })
    fs.renameSync(oldPath, newPath)
    res.json({ ok: true })
  } catch (err) {
    res.json({ error: err.message })
  }
})

app.post('/api/file/delete', (req, res) => {
  const { paths } = req.body
  if (!paths || !Array.isArray(paths)) return res.json({ error: 'Missing paths' })
  for (const p of paths) {
    const validation = validatePath(p)
    if (validation) return res.json(validation)
  }
  try {
    for (const p of paths) {
      const stats = fs.statSync(p)
      if (stats.isDirectory()) {
        fs.rmSync(p, { recursive: true })
      } else {
        fs.unlinkSync(p)
      }
    }
    res.json({ ok: true })
  } catch (err) {
    res.json({ error: err.message })
  }
})

app.post('/api/file/copy', (req, res) => {
  const { paths, destination } = req.body
  if (!paths || !destination) return res.json({ error: 'Missing parameters' })
  const destValidation = validatePath(destination)
  if (destValidation) return res.json(destValidation)
  for (const p of paths) {
    const validation = validatePath(p)
    if (validation) return res.json(validation)
  }
  try {
    for (const p of paths) {
      const destPath = path.join(destination, path.basename(p))
      const stats = fs.statSync(p)
      if (stats.isDirectory()) {
        copyDirRecursive(p, destPath)
      } else {
        fs.copyFileSync(p, destPath)
      }
    }
    res.json({ ok: true })
  } catch (err) {
    res.json({ error: err.message })
  }
})

app.post('/api/file/move', (req, res) => {
  const { paths, destination } = req.body
  if (!paths || !destination) return res.json({ error: 'Missing parameters' })
  const destValidation = validatePath(destination)
  if (destValidation) return res.json(destValidation)
  for (const p of paths) {
    const validation = validatePath(p)
    if (validation) return res.json(validation)
  }
  try {
    for (const p of paths) {
      const destPath = path.join(destination, path.basename(p))
      if (fs.existsSync(destPath)) {
        const destStats = fs.statSync(destPath)
        if (destStats.isDirectory()) {
          return res.json({ error: 'Cannot overwrite directory with file' })
        }
      }
      const stats = fs.statSync(p)
      // Fix B09: Remove redundant if/else - both branches did the same thing
      // For cross-device moves, this may throw EXDEV but that's expected behavior
      fs.renameSync(p, destPath)
    }
    res.json({ ok: true })
  } catch (err) {
    res.json({ error: err.message })
  }
})

app.post('/api/file/download', (req, res) => {
  const { paths } = req.body
  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return res.json({ error: 'Missing paths' })
  }
  for (const p of paths) {
    const validation = validatePath(p)
    if (validation) return res.json(validation)
  }

  if (paths.length === 1) {
    const singlePath = paths[0]
    const stats = fs.statSync(singlePath)
    if (stats.isDirectory()) {
      const archive = archiver('zip', { zlib: { level: 9 } })
      res.attachment(path.basename(singlePath) + '.zip')
      archive.pipe(res)
      archive.directory(singlePath, path.basename(singlePath))
      archive.finalize()
    } else {
      res.download(singlePath, path.basename(singlePath))
    }
  } else {
    const archive = archiver('zip', { zlib: { level: 9 } })
    const name = 'download'
    res.attachment(name + '.zip')
    archive.pipe(res)
    for (const p of paths) {
      const baseName = path.basename(p)
      const stats = fs.statSync(p)
      if (stats.isDirectory()) {
        archive.directory(p, baseName)
      } else {
        archive.file(p, { name: baseName })
      }
    }
    archive.finalize()
  }
})

const uploadDir = path.join(__dirname, '../uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
// High Fix #10: Added file size limit of 100MB to prevent disk space exhaustion
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 100 * 1024 * 1024 }
})

app.post('/api/file/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.json({ error: 'No file uploaded' })
  const destination = req.body.path || process.env.HOME || '/home/' + process.env.USER
  const destPath = path.join(destination, req.file.originalname)
  const validation = validatePath(destPath)
  if (validation) {
    fs.unlinkSync(req.file.path)
    return res.json(validation)
  }
  try {
    fs.renameSync(req.file.path, destPath)
    res.json({ ok: true, filename: req.file.originalname })
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
    res.json({ error: err.message })
  }
})

// Socket.IO — each connection manages its own sessions
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)
  const socketSessions = new Set()

  // FIX: Reconnect to existing sessions that have no active socket
  // This allows sessions to survive disconnections and reconnections (e.g., tunnel)
  const existingSessions = getAllSessions()
  existingSessions.forEach(sessionId => {
    const existingSession = getSession(sessionId)
    // Check if session exists and PTY is still alive
    if (existingSession && existingSession.pty) {
      // Check if session has an exitCode (node-pty internal) safely
      let isExited = false
      try {
        isExited = existingSession.pty.exitCode !== null
      } catch {}

      if (!isExited) {
        // Reconnect if socket is null (disconnected but not killed yet)
        // or if it's the same socket ID
        if (!existingSession.socketId || existingSession.socketId === socket.id) {
          existingSession.socket = socket
          existingSession.socketId = socket.id
          // Clear disconnect time so reaper doesn't kill this session
          clearSocketDisconnect(sessionId)
          console.log(`Reconnected session ${sessionId} to socket ${socket.id}`)
          socketSessions.add(sessionId)
        } else {
          console.log(`Session ${sessionId} belongs to socket ${existingSession.socketId}, not claiming`)
        }
      }
    }
  })

   // Create a PTY session for a tab
   socket.on('create-tab', ({ sessionId, cwd }) => {
     // Check if session already exists
     const existingSession = getSession(sessionId)
     if (existingSession && existingSession.pty) {
       // Check if PTY is still alive
       let isExited = false
       try {
         isExited = existingSession.pty.exitCode !== null
       } catch {}

       if (!isExited) {
         // Reconnect to existing session
         existingSession.socket = socket
         existingSession.socketId = socket.id
         // Clear disconnect time so reaper doesn't kill this session
         clearSocketDisconnect(sessionId)
         socketSessions.add(sessionId)
         socket.emit('session-ready', { sessionId, cwd: existingSession.cwd })
         console.log(`Reconnected to existing session ${sessionId}`)
         return
       }
     }

     // Create new session
     const session = createSession(sessionId, socket, cwd)
     if (session) {
       socketSessions.add(sessionId)
       socket.emit('session-ready', { sessionId, cwd: session.cwd })
     }
   })

   // Ping handler for latency measurement
   socket.on('ping', (callback) => {
     callback()
   })

     // Route input to correct PTY session (with simple deduplication)
     socket.on('data', ({ sessionId, data, seq }) => {
       const session = getSession(sessionId)
       if (!session?.pty) return

       // If client sent a sequence number, use it for at‑least‑once deduplication
       if (typeof seq === 'number') {
         if (seq <= session.lastSeq) return // duplicate packet, ignore
         session.lastSeq = seq
       }

       // PTY write timeout wrapper to prevent indefinite hangs
       const PTY_WRITE_TIMEOUT_MS = 5000 // 5 seconds timeout
       let timeoutId = null

       try {
         // Write data with timeout protection
         session.pty.write(data)

         // Set up timeout to detect unresponsive PTY
         timeoutId = setTimeout(() => {
           console.warn(`PTY write timeout for session ${sessionId} - PTY may be unresponsive`)
           socket.emit('pty-timeout', { sessionId })
         }, PTY_WRITE_TIMEOUT_MS)

         // Clear timeout on successful write completion (node-pty doesn't have write callback,
         // but we clear on next data event or disconnect)
         session.pty.once('data', () => {
           if (timeoutId) {
             clearTimeout(timeoutId)
             timeoutId = null
           }
         })
       } catch (err) {
         if (timeoutId) clearTimeout(timeoutId)
         console.error('PTY write error for session', sessionId, err)
         // Do not close session automatically; write errors may be transient
       }
     })

  // Resize specific session
  socket.on('resize', ({ sessionId, cols, rows }) => {
    const session = getSession(sessionId)
    if (session?.pty) {
      try { session.pty.resize(Math.max(cols, 1), Math.max(rows, 1)) } catch {}
    }
  })

  // Close a specific tab's session
  socket.on('close-session', ({ sessionId }) => {
    deleteSession(sessionId)
    socketSessions.delete(sessionId)
  })

  // Cleanup all sessions on disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
    // FIX: Don't immediately kill PTY sessions on disconnect
    // Instead, record disconnect time and let the session reaper handle cleanup
    // This allows sessions to survive brief disconnections (like tunnel reconnections)
    for (const sid of socketSessions) {
      recordSocketDisconnect(sid)
    }
    // Clear the socket reference from sessions so the reaper knows they're disconnected
    // but DO NOT kill the PTY - it should stay alive for potential reconnection
    for (const sid of socketSessions) {
      const session = getSession(sid)
      if (session) {
        session.socket = null
        session.socketId = null
      }
    }
    socketSessions.clear()
  })
 })

 // Global error handler (must be after all routes)
 app.use((err, req, res, next) => {
   console.error('Unhandled error:', err)
   const status = err.status || err.statusCode || 500
   const isProduction = process.env.NODE_ENV === 'production'
   const message = isProduction
     ? 'Internal server error'
     : (err.message || 'Internal server error')
   if (!res.headersSent) {
     res.status(status).json({ error: message })
   } else {
     res.end()
   }
 })

 // Catch unhandled promise rejections (should not happen)
 process.on('unhandledRejection', (reason, p) => {
   console.error('Unhandled Rejection at promise', p, 'reason:', reason)
 })
 process.on('uncaughtException', (err) => {
   console.error('Uncaught Exception:', err)
   // Optionally exit process: process.exit(1)
 })

 // Critical Fix #6: Electron port fallback - write actual port to file for Electron to read
function writeServerPort(port) {
  try {
    const portFile = path.join(os.tmpdir(), 'mobile-terminal-port')
    fs.writeFileSync(portFile, String(port))
    console.log(`[Port] Server bound to port ${port}, port file: ${portFile}`)
  } catch (err) {
    console.warn('[Port] Could not write port file:', err.message)
  }
}

// Start server with automatic port fallback
const startServer = (port) => {
  server.listen(port, HOST, () => {
    console.log(`Server running on http://${HOST}:${port}`)
    // Write actual port to file for Electron
    writeServerPort(port)
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying ${port + 1}...`)
      startServer(port + 1)
    } else {
      console.error('Server error:', err)
    }
  })
}

startServer(PORT)
