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

function createWindow() {
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
    : `http://localhost:5151`

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
  createWindow()

  setTimeout(() => {
    setAutoStart(true)
  }, 2000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
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