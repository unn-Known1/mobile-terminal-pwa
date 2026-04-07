import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { createSession, deleteSession, getSession, listDirectory } from './pty-manager.js'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import archiver from 'archiver'
import multer from 'multer'
import cookieParser from 'cookie-parser'

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

function checkToken(req, res, next) {
  // Allow if no tunnel is active
  if (!tunnelActive) {
    return next()
  }
  
  // Allow API routes always (they handle their own auth via headers)
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
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

app.use(checkToken)
app.use(express.static(path.join(__dirname, '../dist')))

const io = new Server(server, { cors: { origin: '*' } })

// Directory listing API
app.get('/api/ls', (req, res) => {
  const homeDir = process.env.HOME || '/home/' + process.env.USER
  res.json(listDirectory(homeDir))
})

app.get('/api/ls/*', (req, res) => {
  const pathParam = req.params[0] || ''
  const targetPath = pathParam.startsWith('/') ? pathParam : '/' + pathParam
  const homeDir = process.env.HOME || '/home/' + process.env.USER
  const resolvedPath = targetPath === '/' || targetPath === '//' ? homeDir : targetPath
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
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function generateToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

app.post('/api/tunnel/start', async (req, res) => {
  if (tunnelProcess && tunnelUrl) {
    return res.json({ url: tunnelUrl, pin: tunnelPin, alreadyRunning: true })
  }
  tunnelActive = true
  tunnelPin = generatePin()
  const currentPort = server.address()?.port || PORT
  try {
    tunnelProcess = spawn(process.env.CLOUDFARED || path.join(process.env.HOME || '/home/' + process.env.USER, '.cloudflared', 'cloudflared'), ['tunnel', '--url', `http://localhost:${currentPort}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let url = null
    const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/

    const onData = (chunk) => {
      if (url || res.headersSent) return
      const text = chunk.toString()
      const match = text.match(urlPattern)
      if (match) {
        url = match[0]
        tunnelUrl = url
        res.json({ url, pin: tunnelPin })
      }
    }

    tunnelProcess.stdout.on('data', onData)
    tunnelProcess.stderr.on('data', onData)

    tunnelProcess.on('exit', () => { tunnelProcess = null })

    setTimeout(() => {
      if (!url && !res.headersSent) res.json({ error: 'Timeout waiting for tunnel URL' })
    }, 15000)
  } catch (err) {
    res.json({ error: err.message })
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
  res.json({ running: !!tunnelUrl, pin: tunnelPin, url: tunnelUrl })
})

app.post('/api/tunnel/verify', (req, res) => {
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

// File operations
function validatePath(filePath) {
  const homeDir = process.env.HOME || '/home/' + process.env.USER
  const resolved = path.resolve(filePath)
  const homeResolved = path.resolve(homeDir)
  if (!resolved.startsWith(homeResolved)) {
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
      if (stats.isDirectory()) {
        fs.renameSync(p, destPath)
      } else {
        fs.renameSync(p, destPath)
      }
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
const upload = multer({ dest: uploadDir })

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

  // Create a PTY session for a tab
  socket.on('create-tab', ({ sessionId, cwd }) => {
    const session = createSession(sessionId, socket, cwd)
    if (session) {
      socketSessions.add(sessionId)
      socket.emit('session-ready', { sessionId, cwd: session.cwd })
    }
  })

  // Route input to correct PTY session
  socket.on('data', ({ sessionId, data }) => {
    const session = getSession(sessionId)
    if (session?.pty) session.pty.write(data)
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
    for (const sid of socketSessions) deleteSession(sid)
    socketSessions.clear()
  })
})

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`)
})
