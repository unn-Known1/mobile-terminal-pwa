import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = !app.isPackaged

let mainWindow = null
let serverProcess = null

function log(msg) {
  const logPath = path.join(app.getPath('userData'), 'app.log')
  const timestamp = new Date().toISOString()
  const logLine = `[${timestamp}] ${msg}\n`
  fs.appendFileSync(logPath, logLine)
  console.log(msg)
}

function getServerPort() {
  const portFile = path.join(os.tmpdir(), 'mobile-terminal-port')
  try {
    if (fs.existsSync(portFile)) {
      const port = fs.readFileSync(portFile, 'utf8').trim()
      log(`[Port] Read server port from file: ${port}`)
      return port
    }
  } catch (err) {
    log(`[Port] Could not read port file: ${err.message}`)
  }
  return '5151' // Default fallback
}

function startServer() {
  const serverPath = path.join(__dirname, '../server/server.js')
  log(`Starting server from: ${serverPath}`)

  serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: { ...process.env, PORT: '5151' }
  })

  serverProcess.on('error', (err) => {
    log(`Server error: ${err.message}`)
  })

  serverProcess.on('exit', (code) => {
    log(`Server exited with code: ${code}`)
  })
}

function createWindow(port) {
  log('Creating main window')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    icon: path.join(__dirname, '../build/icon.png'),
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    log('Window shown')
  })

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `http://localhost:${port}`

  mainWindow.loadURL(startUrl)
  
  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  log(`Loading URL: ${startUrl}`)
}

function setAutoStart(enabled) {
  if (process.platform === 'linux') {
    const autostartDir = path.join(app.getPath('home'), '.config/autostart')
    const desktopFile = path.join(autostartDir, 'mobile-terminal.desktop')
    
    if (enabled) {
      const exePath = app.isPackaged ? process.execPath : 'node'
      const scriptPath = path.join(__dirname, '../server/server.js')
      const desktopEntry = `[Desktop Entry]
Type=Application
Name=Mobile Terminal
Exec=${exePath} ${app.isPackaged ? '' : scriptPath}
Icon=${path.join(__dirname, '../build/icon.png')}
X-GNOME-Autostart-enabled=true
`
      if (!fs.existsSync(autostartDir)) {
        fs.mkdirSync(autostartDir, { recursive: true })
      }
      fs.writeFileSync(desktopFile, desktopEntry)
      log('Auto-start enabled (Linux)')
    } else {
      if (fs.existsSync(desktopFile)) {
        fs.unlinkSync(desktopFile)
      }
      log('Auto-start disabled (Linux)')
    }
  } else if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: false,
      path: process.execPath
    })
    log(`Auto-start ${enabled ? 'enabled' : 'disabled'} (Windows)`)
  }
}

app.whenReady().then(() => {
  log('App ready, starting...')
  startServer()

  // Critical Fix #6: Wait for server to write port, then read and create window
  let attempts = 0
  const maxAttempts = 20
  const tryCreateWindow = () => {
    const port = getServerPort()
    if (port && port !== '5151') {
      // Server wrote its actual port, create window with that
      createWindow(port)
    } else if (attempts < maxAttempts) {
      attempts++
      setTimeout(tryCreateWindow, 250) // Wait 250ms and try again
    } else {
      // Fallback to default port after timeout
      log('[Port] Timeout waiting for server port, using default 5151')
      createWindow('5151')
    }
  }

  // Small delay to let server start and write port
  setTimeout(tryCreateWindow, 1000)

  // Medium Fix #16: Auto-start should be user-opt-in, not automatic
  // The original bug report says auto-start is enabled without user consent
  // This is now controlled by settings, not automatic

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow('5151')
    }
  })
})

app.on('window-all-closed', () => {
  log('All windows closed')
  if (serverProcess) {
    serverProcess.kill()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  log('App quitting')
  if (serverProcess) {
    serverProcess.kill()
  }
})