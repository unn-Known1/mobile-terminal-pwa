# Additional Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 8 features: directory bookmarks, file upload, session restore, command shortcuts, more terminal themes, export/import, tab status bubbles, desktop notifications

**Architecture:** All features are client-side except file upload API. Settings stored in localStorage. Session state auto-saved on changes.

**Tech Stack:** React, localStorage, browser Notifications API, Express multer for uploads

---

## Task 1: Session Restore

**Files:**
- Modify: `src/App.jsx` - load/save session state

- [ ] **Step 1: Add session state load on mount**

Modify App.jsx - replace initial state with loadSession function:

```javascript
function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem('terminal-session') || 'null')
    if (s && s.tabs && s.tabs.length > 0) {
      return s
    }
  } catch {}
  return {
    tabs: [{ id: 'tab-main', name: 'Terminal 1', cwd: null, color: null }],
    activeTab: 'tab-main',
    explorerOpen: true,
    currentPath: '/'
  }
}

export default function App() {
  const initial = loadSession()
  const [tabs, setTabs] = useState(initial.tabs)
  const [activeTab, setActiveTab] = useState(initial.activeTab)
  const [explorerOpen, setExplorerOpen] = useState(initial.explorerOpen)
  const [currentPath, setCurrentPath] = useState(initial.currentPath)
```

- [ ] **Step 2: Add session save on state changes**

Add useEffect to save session whenever state changes:

```javascript
useEffect(() => {
  const session = { tabs, activeTab, explorerOpen, currentPath }
  localStorage.setItem('terminal-session', JSON.stringify(session))
}, [tabs, activeTab, explorerOpen, currentPath])
```

- [ ] **Step 3: Clear session on logout (optional)**

Add clearSession function for settings panel:

```javascript
const clearSession = () => {
  localStorage.removeItem('terminal-session')
  setTabs([{ id: 'tab-main', name: 'Terminal 1', cwd: null, color: null }])
  setActiveTab('tab-main')
  setExplorerOpen(true)
  setCurrentPath('/')
}
```

- [ ] **Step 4: Verify build**

```bash
cd /home/ptelgm/Documents/mobile_terminal_fixed && npx vite build
```

---

## Task 2: Additional Terminal Themes

**Files:**
- Modify: `src/components/SettingsPanel.jsx` - add theme options
- Modify: `src/components/Terminal.jsx` - use dynamic theme building

- [ ] **Step 1: Update THEMES object in SettingsPanel**

Replace THEMES constant:

```javascript
const THEMES = {
  dark: { label: 'Dark', background: '#0F172A', foreground: '#F8FAFC', cursor: '#22C55E' },
  light: { label: 'Light', background: '#F8FAFC', foreground: '#0F172A', cursor: '#0F172A' },
  highContrast: { label: 'High Contrast', background: '#000000', foreground: '#22C55E', cursor: '#22C55E' },
  dracula: { label: 'Dracula', background: '#282A36', foreground: '#F8F8F2', cursor: '#FF79C6' },
  solarized: { label: 'Solarized Dark', background: '#002B36', foreground: '#839496', cursor: '#268BD2' },
  ocean: { label: 'Ocean', background: '#0A192F', foreground: '#CCD6F6', cursor: '#64FFDA' },
  midnight: { label: 'Midnight', background: '#1A1A2E', foreground: '#EAEAEA', cursor: '#E94560' },
  forest: { label: 'Forest', background: '#1E3A2F', foreground: '#E8F5E9', cursor: '#4ADE80' },
  monokai: { label: 'Monokai', background: '#272822', foreground: '#F8F8F2', cursor: '#F92672' },
  nord: { label: 'Nord', background: '#2E3440', foreground: '#ECEFF4', cursor: '#88C0D0' },
}
```

- [ ] **Step 2: Verify build**

```bash
cd /home/ptelgm/Documents/mobile_terminal_fixed && npx vite build
```

---

## Task 3: Directory Bookmarks

**Files:**
- Modify: `src/components/FileExplorer.jsx` - add bookmark functionality

- [ ] **Step 1: Add bookmark state and functions**

Add after existing state:

```javascript
const [bookmarks, setBookmarks] = useState(() => {
  try { return JSON.parse(localStorage.getItem('terminal-bookmarks') || '[]') } 
  catch { return [] }
})

const isBookmarked = currentPath && bookmarks.some(b => b.path === currentPath)

const toggleBookmark = () => {
  const newBookmarks = isBookmarked
    ? bookmarks.filter(b => b.path !== currentPath)
    : [...bookmarks, { path: currentPath, name: currentPath.split('/').pop() || 'Root' }]
  setBookmarks(newBookmarks)
  localStorage.setItem('terminal-bookmarks', JSON.stringify(newBookmarks))
}

const navigateToBookmark = (path) => {
  onNavigate(path)
}
```

- [ ] **Step 2: Add bookmark button in header**

Add button after existing header buttons:

```javascript
<button className="icon-btn-sm" onClick={toggleBookmark} title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}>
  {isBookmarked ? <Star size={14} fill="currentColor" /> : <Star size={14} />}
</button>
```

- [ ] **Step 3: Add Star import**

Update import:

```javascript
import { 
  Folder, File, ChevronLeft, Terminal, RefreshCw, Eye, EyeOff,
  Copy, Scissors, Clipboard, FilePlus, Download, Trash2, Edit3, X, Check, Star
} from 'lucide-react'
```

- [ ] **Step 4: Add bookmark panel**

Add after explorer-content div, before context menu:

```javascript
{bookmarks.length > 0 && (
  <div className="bookmarks-section">
    <div className="bookmarks-header">Bookmarks</div>
    {bookmarks.map(b => (
      <div key={b.path} className="bookmark-item" onClick={() => navigateToBookmark(b.path)}>
        <Star size={12} /> <span>{b.name}</span>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 5: Add CSS for bookmarks**

Add to index.css:

```css
.bookmarks-section { padding: 8px; border-top: 1px solid var(--border); }
.bookmarks-header { font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px; }
.bookmark-item { display: flex; align-items: center; gap: 6px; padding: 6px 8px; cursor: pointer; border-radius: 4px; font-size: 12px; }
.bookmark-item:hover { background: var(--bg-tertiary); }
```

- [ ] **Step 6: Verify build**

```bash
cd /home/ptelgm/Documents/mobile_terminal_fixed && npx vite build
```

---

## Task 4: File Upload

**Files:**
- Modify: `server/server.js` - add upload endpoint
- Modify: `src/components/FileExplorer.jsx` - add upload UI

- [ ] **Step 1: Add multer for file uploads**

```bash
cd /home/ptelgm/Documents/mobile_terminal_fixed && npm install multer
```

- [ ] **Step 2: Add upload endpoint to server.js**

Add after file download endpoint:

```javascript
import multer from 'multer'

const upload = multer({ dest: path.join(__dirname, '../uploads') })

app.post('/api/file/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.json({ error: 'No file uploaded' })
  const destination = req.body.path || process.env.HOME || '/home/' + process.env.USER
  const destPath = path.join(destination, req.file.originalname)
  try {
    fs.renameSync(req.file.path, destPath)
    res.json({ ok: true, filename: req.file.originalname })
  } catch (err) {
    fs.unlinkSync(req.file.path)
    res.json({ error: err.message })
  }
})
```

- [ ] **Step 3: Create uploads directory**

```bash
mkdir -p /home/ptelgm/Documents/mobile_terminal_fixed/uploads
```

- [ ] **Step 4: Add upload handler in FileExplorer**

Add function:

```javascript
const handleUpload = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('path', currentPath)
    const res = await fetch('/api/file/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (data.error) alert(data.error)
    else fetchDirectory(currentPath)
  } catch (err) { alert(err.message) }
  e.target.value = ''
}
```

- [ ] **Step 5: Add upload button in header**

Add input for file upload and button:

```javascript
<input type="file" id="file-upload" style={{ display: 'none' }} onChange={handleUpload} />
<button className="icon-btn-sm" onClick={() => document.getElementById('file-upload').click()} title="Upload file">
  <Upload size={14} />
</button>
```

- [ ] **Step 6: Add Upload import**

```javascript
import { 
  Folder, File, ChevronLeft, Terminal, RefreshCw, Eye, EyeOff,
  Copy, Scissors, Clipboard, FilePlus, Download, Trash2, Edit3, X, Check, Star, Upload
} from 'lucide-react'
```

- [ ] **Step 7: Add drag and drop**

Add to explorer-content:

```javascript
<div className="explorer-content" onDragOver={e => e.preventDefault()} onDrop={async (e) => {
  e.preventDefault()
  const file = e.dataTransfer.files?.[0]
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  formData.append('path', currentPath)
  try {
    await fetch('/api/file/upload', { method: 'POST', body: formData })
    fetchDirectory(currentPath)
  } catch {}
}}>
```

- [ ] **Step 8: Verify build and server**

```bash
cd /home/ptelgm/Documents/mobile_terminal_fixed && npx vite build && node -c server/server.js
```

---

## Task 5: Command Shortcuts

**Files:**
- Modify: `src/App.jsx` - add keyboard shortcut handling
- Modify: `src/components/SettingsPanel.jsx` - add shortcuts management UI

- [ ] **Step 1: Add shortcuts state in App.jsx**

Add after useState declarations:

```javascript
const [shortcuts, setShortcuts] = useState(() => {
  try { return JSON.parse(localStorage.getItem('terminal-shortcuts') || '[]') } 
  catch { return [] }
})
```

- [ ] **Step 2: Add keyboard listener for shortcuts**

Add useEffect after other useEffects:

```javascript
useEffect(() => {
  const handleKeyDown = (e) => {
    if (!e.ctrlKey && !e.metaKey) return
    const key = (e.ctrlKey ? 'Ctrl+' : '') + (e.shiftKey ? 'Shift+' : '') + e.key.toUpperCase()
    const match = shortcuts.find(s => s.keys === key)
    if (match) {
      e.preventDefault()
      // Emit command to active terminal via socket or callback
      // This requires passing a handler to Terminal component
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [shortcuts])
```

- [ ] **Step 3: Pass shortcut handler to Terminal**

In App.jsx, add to Terminal props:

```javascript
<Terminal
  sessionId={tab.id}
  cwd={tab.cwd}
  fontSize={fontSize}
  theme={THEMES[theme]}
  onCommand={(cmd) => {
    // This will be handled via socket emit in Terminal
  }}
/>
```

- [ ] **Step 4: Add shortcuts section in SettingsPanel**

Add in SettingsPanel.jsx after theme section:

```javascript
const [shortcuts, setShortcuts] = useState(() => {
  try { return JSON.parse(localStorage.getItem('terminal-shortcuts') || '[]') } 
  catch { return [] }
})

const addShortcut = (s) => {
  const newShortcuts = [...shortcuts, { ...s, id: Date.now().toString() }]
  setShortcuts(newShortcuts)
  localStorage.setItem('terminal-shortcuts', JSON.stringify(newShortcuts))
}

const deleteShortcut = (id) => {
  const newShortcuts = shortcuts.filter(s => s.id !== id)
  setShortcuts(newShortcuts)
  localStorage.setItem('terminal-shortcuts', JSON.stringify(newShortcuts))
}
```

Add UI in panel-section:

```javascript
<div className="panel-section">
  <h3>Command Shortcuts</h3>
  {shortcuts.map(s => (
    <div key={s.id} className="shortcut-item">
      <span className="shortcut-keys">{s.keys}</span>
      <span className="shortcut-name">{s.name}</span>
      <span className="shortcut-cmd">{s.command}</span>
      <button onClick={() => deleteShortcut(s.id)}><X size={12} /></button>
    </div>
  ))}
  <button className="add-shortcut-btn" onClick={() => {
    const name = prompt('Shortcut name:')
    const keys = prompt('Key combination (e.g., Ctrl+Shift+G):')
    const command = prompt('Command to run:')
    if (name && keys && command) addShortcut({ name, keys, command })
  }}>+ Add Shortcut</button>
</div>
```

- [ ] **Step 5: Add CSS for shortcuts**

Add to index.css:

```css
.shortcut-item { display: flex; align-items: center; gap: 8px; padding: 6px; background: var(--bg-tertiary); border-radius: 4px; margin-bottom: 4px; }
.shortcut-keys { background: var(--bg-primary); padding: 2px 6px; border-radius: 3px; font-size: 11px; font-family: monospace; }
.shortcut-name { flex: 1; font-size: 13px; }
.shortcut-cmd { color: var(--text-muted); font-size: 12px; font-family: monospace; }
.add-shortcut-btn { margin-top: 8px; padding: 6px 12px; background: var(--bg-tertiary); border: 1px dashed var(--border); border-radius: 4px; cursor: pointer; color: var(--text-secondary); }
.add-shortcut-btn:hover { border-color: var(--accent); color: var(--accent); }
```

- [ ] **Step 6: Verify build**

```bash
cd /home/ptelgm/Documents/mobile_terminal_fixed && npx vite build
```

---

## Task 6: Export/Import Settings

**Files:**
- Modify: `src/components/SettingsPanel.jsx` - add export/import functions

- [ ] **Step 1: Add export function**

```javascript
const handleExport = () => {
  const settings = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    bookmarks: JSON.parse(localStorage.getItem('terminal-bookmarks') || '[]'),
    shortcuts: JSON.parse(localStorage.getItem('terminal-shortcuts') || '[]'),
    settings: { fontSize, theme }
  }
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `terminal-settings-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Add import function**

```javascript
const handleImport = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.version) throw new Error('Invalid settings file')
      if (data.bookmarks) {
        localStorage.setItem('terminal-bookmarks', JSON.stringify(data.bookmarks))
      }
      if (data.shortcuts) {
        localStorage.setItem('terminal-shortcuts', JSON.stringify(data.shortcuts))
      }
      if (data.settings) {
        if (data.settings.fontSize) {
          setFontSize(data.settings.fontSize)
          localStorage.setItem('terminal-settings', JSON.stringify({ fontSize: data.settings.fontSize, theme }))
        }
        if (data.settings.theme) {
          setTheme(data.settings.theme)
        }
      }
      alert('Settings imported successfully!')
    } catch (err) {
      alert('Failed to import: ' + err.message)
    }
  }
  input.click()
}
```

- [ ] **Step 3: Add buttons in Settings panel**

Add after About section:

```javascript
<div className="panel-section">
  <h3>Backup</h3>
  <div className="backup-buttons">
    <button onClick={handleExport}>Export Settings</button>
    <button onClick={handleImport}>Import Settings</button>
  </div>
</div>
```

- [ ] **Step 4: Add CSS**

```css
.backup-buttons { display: flex; gap: 8px; }
.backup-buttons button { flex: 1; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; color: var(--text-primary); }
.backup-buttons button:hover { background: var(--bg-primary); }
```

- [ ] **Step 5: Verify build**

```bash
cd /home/ptelgm/Documents/mobile_terminal_fixed && npx vite build
```

---

## Task 7: Tab Status Bubbles

**Files:**
- Modify: `src/components/TabManager.jsx` - add status display
- Modify: `src/components/Terminal.jsx` - track and emit status
- Modify: `src/App.jsx` - manage tab statuses

- [ ] **Step 1: Add tab status state in App.jsx**

Add after other useState:

```javascript
const [tabStatuses, setTabStatuses] = useState({})
```

- [ ] **Step 2: Add status update function**

```javascript
const updateTabStatus = (sessionId, status) => {
  setTabStatuses(prev => ({ ...prev, [sessionId]: status }))
}
```

- [ ] **Step 3: Pass status handler to Terminal**

```javascript
<Terminal
  sessionId={tab.id}
  cwd={tab.cwd}
  fontSize={fontSize}
  theme={THEMES[theme]}
  onStatusChange={updateTabStatus}
/>
```

- [ ] **Step 4: Pass statuses to TabManager**

```javascript
<TabManager
  tabs={tabs}
  activeTab={activeTab}
  onSwitchTab={setActiveTab}
  onNewTab={() => handleNewTab()}
  onCloseTab={handleCloseTab}
  onRenameTab={handleRenameTab}
  connected={connected}
  tabStatuses={tabStatuses}
/>
```

- [ ] **Step 5: Update TabManager to show status**

Add prop:

```javascript
export default function TabManager({ tabs, activeTab, onSwitchTab, onNewTab, onCloseTab, onRenameTab, connected, tabStatuses = {} }) {
```

Add status bubble after tab name:

```javascript
{!editingId && tab.id !== activeTab && tabStatuses[tab.id] && (
  <span className={`status-bubble ${tabStatuses[tab.id]}`} title={tabStatuses[tab.id]} />
)}
```

- [ ] **Step 6: Add status tracking in Terminal**

Add after socket listeners:

```javascript
const [lastActivity, setLastActivity] = useState(Date.now())
const [isRunning, setIsRunning] = useState(false)

useEffect(() => {
  if (!socket) return
  const onDataHandler = () => {
    setLastActivity(Date.now())
    onStatusChange?.(sessionId, 'notification')
  }
  const onExitHandler = () => {
    setIsRunning(false)
    onStatusChange?.(sessionId, 'idle')
  }
  socket.on('data', onDataHandler)
  socket.on('exit', onExitHandler)
  
  // Check idle status every 30s
  const idleCheck = setInterval(() => {
    if (Date.now() - lastActivity > 30000) {
      onStatusChange?.(sessionId, 'idle')
    }
  }, 30000)
  
  return () => {
    socket.off('data', onDataHandler)
    socket.off('exit', onExitHandler)
    clearInterval(idleCheck)
  }
}, [socket, sessionId, lastActivity])
```

- [ ] **Step 7: Add CSS for status bubbles**

```css
.status-bubble { width: 8px; height: 8px; border-radius: 50%; margin-left: 4px; flex-shrink: 0; }
.status-bubble.running { background: #22C55E; animation: pulse 1s infinite; }
.status-bubble.idle { background: #6B7280; }
.status-bubble.notification { background: #F97316; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
```

- [ ] **Step 8: Verify build**

```bash
cd /home/ptelgm/Documents/mobile_terminal_fixed && npx vite build
```

---

## Task 8: Desktop Notifications

**Files:**
- Modify: `src/App.jsx` - add notification triggers
- Modify: `src/components/SettingsPanel.jsx` - add notification settings

- [ ] **Step 1: Add notification settings in SettingsPanel**

Add state:

```javascript
const [notifSettings, setNotifSettings] = useState(() => {
  try { return JSON.parse(localStorage.getItem('terminal-notifications') || '{"longRunning":true,"idle":true,"background":true,"failed":true}') } 
  catch { return { longRunning: true, idle: true, background: true, failed: true } }
})

const updateNotifSettings = (key) => {
  const newSettings = { ...notifSettings, [key]: !notifSettings[key] }
  setNotifSettings(newSettings)
  localStorage.setItem('terminal-notifications', JSON.stringify(newSettings))
}
```

Add UI in panel-section:

```javascript
<div className="panel-section">
  <h3>Notifications</h3>
  <div className="setting-item">
    <label>
      <input type="checkbox" checked={notifSettings.longRunning} onChange={() => updateNotifSettings('longRunning')} />
      Long-running commands done
    </label>
  </div>
  <div className="setting-item">
    <label>
      <input type="checkbox" checked={notifSettings.idle} onChange={() => updateNotifSettings('idle')} />
      Tab idle (60s no activity)
    </label>
  </div>
  <div className="setting-item">
    <label>
      <input type="checkbox" checked={notifSettings.background} onChange={() => updateNotifSettings('background')} />
      Background tab output
    </label>
  </div>
  <div className="setting-item">
    <label>
      <input type="checkbox" checked={notifSettings.failed} onChange={() => updateNotifSettings('failed')} />
      Command failed (non-zero exit)
    </label>
  </div>
</div>
```

- [ ] **Step 2: Add notification helper in App.jsx**

```javascript
const sendNotification = (title, body) => {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification(title, { body })
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, { body })
      }
    })
  }
}
```

- [ ] **Step 3: Trigger notifications based on tab events**

In App.jsx, add effect to handle status changes:

```javascript
useEffect(() => {
  const notifSettings = JSON.parse(localStorage.getItem('terminal-notifications') || '{}')
  Object.entries(tabStatuses).forEach(([sessionId, status]) => {
    const tab = tabs.find(t => t.id === sessionId)
    if (!tab || sessionId === activeTab) return
    
    if (status === 'idle' && notifSettings.idle) {
      sendNotification('Tab Idle', `${tab.name} has been idle`)
    }
    if (status === 'notification' && notifSettings.background) {
      sendNotification('New Output', `${tab.name} has new output`)
    }
  })
}, [tabStatuses, activeTab])
```

- [ ] **Step 4: Add CSS for notification checkboxes**

```css
.setting-item label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; }
.setting-item input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--accent); }
```

- [ ] **Step 5: Verify build**

```bash
cd /home/ptelgm/Documents/mobile_terminal_fixed && npx vite build
```

---

## Final Verification

- [ ] Test all 8 features work correctly
- [ ] Run build to ensure no errors
- [ ] Verify server starts without errors