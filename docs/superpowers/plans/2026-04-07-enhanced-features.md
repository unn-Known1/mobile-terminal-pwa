# Enhanced Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 new features: multi-select file operations, split terminal view, code editor, network status indicator, and command history sync

**Architecture:** Each feature is self-contained. Multi-select extends FileExplorer state. Split view adds terminal layout component. Code editor uses Monaco editor. Network status uses socket events. Command history syncs via localStorage.

**Tech Stack:** Monaco Editor for code editing, xterm.js for terminal, React state management

---

## Task 1: Multi-Select File Operations

**Files:**
- Modify: `src/components/FileExplorer.jsx:12-24`

- [ ] **Step 1: Add multi-select state**

In FileExplorer, after line 12 (`const [selectedItem, setSelectedItem] = useState(null)`), add:

```javascript
const [selectedItems, setSelectedItems] = useState([])
const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
```

- [ ] **Step 2: Add selection toggle function**

Add after line 34:

```javascript
const toggleSelection = (item, e) => {
  if (!isMultiSelectMode && (e.shiftKey || e.ctrlKey || e.metaKey)) {
    setIsMultiSelectMode(true)
  }
  setSelectedItems(prev => {
    const exists = prev.find(i => i.path === item.path)
    if (exists) return prev.filter(i => i.path !== item.path)
    return [...prev, item]
  })
}

const clearSelection = () => {
  setSelectedItems([])
  setIsMultiSelectMode(false)
}

const handleMultiDelete = async () => {
  if (!confirm(`Delete ${selectedItems.length} items?`)) return
  try {
    await fetch('/api/file/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: selectedItems.map(i => i.path) })
    })
    clearSelection()
    fetchDirectory(currentPath)
  } catch (err) { alert(err.message) }
}

const handleMultiDownload = async () => {
  try {
    const res = await fetch('/api/file/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: selectedItems.map(i => i.path) })
    })
    if (res.ok) {
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'download.zip'
      a.click()
      window.URL.revokeObjectURL(url)
    }
  } catch (err) { alert(err.message) }
}

const handleMultiCopy = () => {
  saveClipboard({ action: 'copy', paths: selectedItems.map(i => i.path), sourcePath: currentPath })
  clearSelection()
}

const handleMultiCut = () => {
  saveClipboard({ action: 'cut', paths: selectedItems.map(i => i.path), sourcePath: currentPath })
  clearSelection()
}
```

- [ ] **Step 3: Add bulk action buttons to header**

After line 237 (end of header buttons), add:

```jsx
{selectedItems.length > 0 && (
  <>
    <button className="icon-btn-sm" onClick={handleMultiDownload} title="Download selected">
      <Download size={14} />
    </button>
    <button className="icon-btn-sm" onClick={handleMultiCopy} title="Copy selected">
      <Copy size={14} />
    </button>
    <button className="icon-btn-sm" onClick={handleMultiCut} title="Cut selected">
      <Scissors size={14} />
    </button>
    <button className="icon-btn-sm" onClick={handleMultiDelete} title="Delete selected">
      <Trash2 size={14} />
    </button>
  </>
)}
```

- [ ] **Step 4: Update item click handler**

Replace line 262-265 with:

```javascript
onClick={(e) => { 
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    toggleSelection(item, e)
  } else if (item.isDirectory) {
    if (isMultiSelectMode) toggleSelection(item, e)
    else onNavigate(item.path)
  }
}}
onDoubleClick={() => {
  if (!isMultiSelectMode && !item.isDirectory) {
    // Open in editor
  }
}}
```

- [ ] **Step 5: Update item class for multi-select**

Replace line 261 className:

```javascript
className={`explorer-item ${item.isDirectory ? 'folder' : 'file'} ${selectedItems.some(i => i.path === item.path) ? 'multi-selected' : ''}`}
```

- [ ] **Step 6: Add CSS for multi-selected items**

Add to `src/index.css`:

```css
.explorer-item.multi-selected {
  background: rgba(34, 197, 94, 0.2);
  border-left: 3px solid #22C55E;
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/FileExplorer.jsx src/index.css
git commit -m "feat: add multi-select file operations"
```

---

## Task 2: Split Terminal View

**Files:**
- Create: `src/components/SplitTerminal.jsx`
- Modify: `src/App.jsx:138-153`

- [ ] **Step 1: Create SplitTerminal component**

Create `src/components/SplitTerminal.jsx`:

```jsx
import { useState } from 'react'
import Terminal from './Terminal'
import { Split, X } from 'lucide-react'

const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']

export default function SplitTerminal({ tabs, activeTab, fontSize, theme, tabStatuses, onStatusChange, onCloseSplit }) {
  const [splits, setSplits] = useState([{ id: 'main', tabId: tabs[0]?.id }])
  const [orientation, setOrientation] = useState('horizontal')
  const [activeSplit, setActiveSplit] = useState('main')

  const addSplit = () => {
    const newId = 'split-' + Date.now()
    const availableTabs = tabs.filter(t => !splits.some(s => s.tabId === t.id))
    if (availableTabs.length === 0) return
    setSplits([...splits, { id: newId, tabId: availableTabs[0].id }])
  }

  const removeSplit = (splitId) => {
    if (splits.length === 1) return
    setSplits(splits.filter(s => s.id !== splitId))
  }

  const moveToSplit = (tabId, splitId) => {
    setSplits(splits.map(s => s.id === splitId ? { ...s, tabId } : s))
  }

  return (
    <div className={`split-container ${orientation}`}>
      <div className="split-toolbar">
        <button onClick={() => setOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')} title="Toggle orientation">
          <Split size={16} />
        </button>
        <button onClick={addSplit} title="Add split" disabled={tabs.length <= splits.length}>
          + Split
        </button>
      </div>
      <div className="split-panes">
        {splits.map(split => {
          const tab = tabs.find(t => t.id === split.tabId)
          return (
            <div key={split.id} className={`split-pane ${activeSplit === split.id ? 'active' : ''}`} onClick={() => setActiveSplit(split.id)}>
              {splits.length > 1 && (
                <div className="split-header">
                  <span>{tab?.name || 'Terminal'}</span>
                  <button className="close-split" onClick={() => removeSplit(split.id)}><X size={14} /></button>
                </div>
              )}
              <Terminal
                sessionId={tab?.id}
                cwd={tab?.cwd}
                fontSize={fontSize}
                theme={theme}
                onStatusChange={onStatusChange}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add SplitTerminal to App.jsx**

Replace lines 138-153 in App.jsx with:

```jsx
const [splits, setSplits] = useState([{ id: 'main' }])
const [splitMode, setSplitMode] = useState(false)

const handleToggleSplit = () => {
  if (!splitMode) {
    setSplits([{ id: 'main', tabId: activeTab }])
  }
  setSplitMode(v => !v)
}
```

Add button to top-bar actions (line 118-127 area):

```jsx
<button className="icon-btn" onClick={handleToggleSplit} title={splitMode ? 'Single terminal' : 'Split view'}>
  <Split size={18} />
</button>
```

Replace terminal area (lines 138-153):

```jsx
<div className={`terminal-area ${explorerOpen ? 'with-explorer' : ''}`}>
  {splitMode ? (
    <SplitTerminal
      tabs={tabs}
      activeTab={activeTab}
      fontSize={fontSize}
      theme={THEMES[theme]}
      tabStatuses={tabStatuses}
      onStatusChange={updateTabStatus}
    />
  ) : (
    tabs.map(tab => (
      <div key={tab.id} style={{ display: tab.id === activeTab ? 'contents' : 'none' }}>
        <Terminal
          sessionId={tab.id}
          cwd={tab.cwd}
          fontSize={fontSize}
          theme={THEMES[theme]}
          onStatusChange={updateTabStatus}
        />
      </div>
    ))
  )}
</div>
```

- [ ] **Step 3: Add SplitTerminal CSS**

Add to `src/index.css`:

```css
.split-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.split-container.horizontal {
  flex-direction: row;
}

.split-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: #1E293B;
  border-bottom: 1px solid #334155;
}

.split-panes {
  display: flex;
  flex: 1;
  gap: 2px;
}

.split-container.horizontal .split-panes {
  flex-direction: row;
}

.split-container.vertical .split-panes {
  flex-direction: column;
}

.split-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #0F172A;
  border: 1px solid #334155;
  min-width: 200px;
  min-height: 100px;
}

.split-pane.active {
  border-color: #22C55E;
}

.split-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: #1E293B;
  font-size: 12px;
}

.close-split {
  background: none;
  border: none;
  color: #94A3B8;
  cursor: pointer;
  padding: 2px;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/SplitTerminal.jsx src/App.jsx src/index.css
git commit -m "feat: add split terminal view"
```

---

## Task 3: Integrated Code Editor

**Files:**
- Create: `src/components/CodeEditor.jsx`
- Modify: `src/App.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Install Monaco editor**

```bash
npm install @monaco-editor/react
```

- [ ] **Step 2: Create CodeEditor component**

Create `src/components/CodeEditor.jsx`:

```jsx
import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { X, Save, File } from 'lucide-react'

const LANG_MAP = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  json: 'json', yaml: 'yaml', yml: 'yaml', xml: 'xml',
  html: 'html', css: 'css', scss: 'scss', less: 'less',
  md: 'markdown', sh: 'shell', bash: 'shell', sql: 'sql',
  txt: 'plaintext'
}

export default function CodeEditor({ filePath, onClose }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modified, setModified] = useState(false)

  const ext = filePath?.split('.').pop()?.toLowerCase() || 'txt'
  const lang = LANG_MAP[ext] || 'plaintext'

  useEffect(() => {
    if (!filePath) return
    setLoading(true)
    fetch(`/api/file/read?path=${encodeURIComponent(filePath)}`)
      .then(res => res.json())
      .then(data => {
        setContent(data.content || '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [filePath])

  const handleSave = async () => {
    if (!filePath) return
    setSaving(true)
    try {
      await fetch('/api/file/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content })
      })
      setModified(false)
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [content])

  if (!filePath) return null

  return (
    <div className="code-editor-overlay">
      <div className="code-editor">
        <div className="editor-header">
          <div className="editor-title">
            <File size={16} />
            <span>{filePath.split('/').pop()}</span>
            {modified && <span className="modified">●</span>}
          </div>
          <div className="editor-actions">
            <button onClick={handleSave} disabled={saving || !modified} title="Save (Ctrl+S)">
              <Save size={16} /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={onClose} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="editor-body">
          {loading ? (
            <div className="editor-loading">Loading...</div>
          ) : (
            <Editor
              height="100%"
              language={lang}
              value={content}
              onChange={(val) => { setContent(val); setModified(true); }}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'Fira Code', monospace",
                lineNumbers: 'on',
                wordWrap: 'on',
                automaticLayout: true,
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add read file API to server**

Add to `server/server.js` after line 266:

```javascript
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
```

- [ ] **Step 4: Integrate editor in App.jsx**

Add state after line 52:

```jsx
const [editorFile, setEditorFile] = useState(null)
```

Add in top-bar actions:

```jsx
<button className="icon-btn" onClick={() => setEditorFile(null)} title="Close editor">
  <X size={18} />
</button>
```

Add after SettingsPanel:

```jsx
{editorFile && <CodeEditor filePath={editorFile} onClose={() => setEditorFile(null)} />}
```

- [ ] **Step 5: Add code editor CSS**

Add to `src/index.css`:

```css
.code-editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.code-editor {
  width: 90%;
  height: 90%;
  background: #1E1E1E;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #2D2D2D;
  border-bottom: 1px solid #3D3D3D;
}

.editor-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #E0E0E0;
  font-size: 14px;
}

.editor-title .modified {
  color: #F59E0B;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.editor-actions button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #3D3D3D;
  border: none;
  border-radius: 4px;
  color: #E0E0E0;
  cursor: pointer;
}

.editor-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.editor-actions button:hover:not(:disabled) {
  background: #4D4D4D;
}

.editor-body {
  flex: 1;
  overflow: hidden;
}

.editor-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
}
```

- [ ] **Step 6: Add open editor to FileExplorer**

In FileExplorer, update the item click to open editor for non-folder items. Add to FileExplorer:

```javascript
const handleOpenEditor = () => {
  if (selectedItem && !selectedItem.isDirectory) {
    // Pass to parent via onNavigate callback or set directly
  }
}
```

Actually, modify FileExplorer to accept `onOpenFile` prop and call it on double-click. In FileExplorer.jsx add:

```javascript
export default function FileExplorer({ isOpen, currentPath, onNavigate, onOpenTerminal, onOpenFile }) {
```

And add double-click handler:

```javascript
onDoubleClick={() => {
  if (!item.isDirectory && onOpenFile) {
    onOpenFile(item.path)
  }
}}
```

Update App.jsx to pass `onOpenFile={setEditorFile}`.

- [ ] **Step 7: Commit**

```bash
git add src/components/CodeEditor.jsx src/App.jsx src/server/server.js src/index.css
git commit -m "feat: add integrated code editor"
```

---

## Task 4: Network Status Indicator

**Files:**
- Modify: `src/App.jsx`
- Create: `src/components/NetworkStatus.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Update useSocket hook**

Read `src/hooks/useSocket.js` to understand its structure, then modify to export latency and reconnect count.

- [ ] **Step 2: Create NetworkStatus component**

Create `src/components/NetworkStatus.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { Wifi, WifiOff, Signal, Zap } from 'lucide-react'

export default function NetworkStatus({ connected, latency, reconnectCount }) {
  const [status, setStatus] = useState('disconnected')

  useEffect(() => {
    if (!connected) {
      setStatus('disconnected')
    } else if (latency < 100) {
      setStatus('excellent')
    } else if (latency < 300) {
      setStatus('good')
    } else if (latency < 500) {
      setStatus('poor')
    } else {
      setStatus('very-poor')
    }
  }, [connected, latency])

  if (!connected) {
    return (
      <div className="network-status disconnected">
        <WifiOff size={14} />
        <span>Offline</span>
      </div>
    )
  }

  const getLatencyColor = () => {
    if (latency < 100) return '#22C55E'
    if (latency < 300) return '#EAB308'
    return '#EF4444'
  }

  return (
    <div className={`network-status ${status}`}>
      <Signal size={14} style={{ color: getLatencyColor() }} />
      <span className="latency">{latency}ms</span>
      {reconnectCount > 0 && (
        <span className="reconnect-badge" title={`Reconnected ${reconnectCount} times`}>
          <Zap size={12} /> {reconnectCount}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update useSocket to track latency**

Modify `src/hooks/useSocket.js`:

```javascript
import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

export function useSocket(path) {
  const [connected, setConnected] = useState(false)
  const [latency, setLatency] = useState(0)
  const [reconnectCount, setReconnectCount] = useState(0)
  const latencyIntervalRef = useRef(null)
  const socketRef = useRef(null)

  useEffect(() => {
    const socket = io(path, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    socket.on('connect', () => {
      setConnected(true)
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('reconnect', (attempt) => {
      setReconnectCount(attempt)
    })

    // Latency measurement
    latencyIntervalRef.current = setInterval(() => {
      const start = Date.now()
      socket.emit('ping', () => {
        setLatency(Date.now() - start)
      })
    }, 5000)

    socketRef.current = socket

    return () => {
      clearInterval(latencyIntervalRef.current)
      socket.disconnect()
    }
  }, [path])

  return { socket, connected, latency, reconnectCount }
}
```

- [ ] **Step 4: Add to App.jsx**

In App.jsx, destructure latency and reconnectCount from useSocket:

```jsx
const { connected, latency, reconnectCount } = useSocket('/')
```

Add to top-bar:

```jsx
<NetworkStatus connected={connected} latency={latency} reconnectCount={reconnectCount} />
```

- [ ] **Step 5: Add CSS**

Add to `src/index.css`:

```css
.network-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #94A3B8;
  padding: 4px 8px;
  border-radius: 4px;
  background: #1E293B;
}

.network-status.disconnected {
  color: #EF4444;
  background: rgba(239, 68, 68, 0.1);
}

.network-status .latency {
  font-family: monospace;
}

.network-status .reconnect-badge {
  display: flex;
  align-items: center;
  gap: 2px;
  color: #F59E0B;
  font-size: 10px;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/NetworkStatus.jsx src/hooks/useSocket.js src/App.jsx src/index.css
git commit -m "feat: add network status indicator"
```

---

## Task 5: Command History Sync

**Files:**
- Create: `src/hooks/useCommandHistory.js`
- Modify: `src/components/Terminal.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create useCommandHistory hook**

Create `src/hooks/useCommandHistory.js`:

```javascript
import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'terminal-command-history'
const MAX_HISTORY = 1000

export function useCommandHistory(sessionId) {
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [historyIndex, setHistoryIndex] = useState(-1)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  }, [history])

  const addToHistory = useCallback((command) => {
    if (!command.trim()) return
    setHistory(prev => {
      const filtered = prev.filter(c => c !== command)
      const updated = [command, ...filtered].slice(0, MAX_HISTORY)
      return updated
    })
    setHistoryIndex(-1)
  }, [])

  const getPrevious = useCallback(() => {
    if (historyIndex >= history.length - 1) return null
    const newIndex = historyIndex + 1
    setHistoryIndex(newIndex)
    return history[newIndex]
  }, [history, historyIndex])

  const getNext = useCallback(() => {
    if (historyIndex <= 0) return null
    const newIndex = historyIndex - 1
    setHistoryIndex(newIndex)
    return history[newIndex]
  }, [history, historyIndex])

  const clearHistory = useCallback(() => {
    setHistory([])
    setHistoryIndex(-1)
  }, [])

  return { history, addToHistory, getPrevious, getNext, clearHistory }
}

export function useAllCommandHistory() {
  const [allHistory, setAllHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch { return [] }
  })

  return allHistory
}
```

- [ ] **Step 2: Modify Terminal to use command history**

In Terminal.jsx, add after line 7 imports:

```javascript
import { useCommandHistory } from '../hooks/useCommandHistory'
```

Add after line 15:

```javascript
const { addToHistory, getPrevious, getNext } = useCommandHistory(sessionId)
```

Add command capture to key handler (around line 68):

```javascript
// Capture commands for history
let commandBuffer = ''
term.attachCustomKeyEventHandler(e => {
  if (e.type === 'keydown') {
    if (e.key === 'Enter') {
      if (commandBuffer.trim()) addToHistory(commandBuffer)
      commandBuffer = ''
    } else if (e.key === 'ArrowUp') {
      const prev = getPrevious()
      if (prev) {
        term.write('\r\x1b[K' + prev)
        return false
      }
    } else if (e.key === 'ArrowDown') {
      const next = getNext()
      if (next) {
        term.write('\r\x1b[K' + next)
        return false
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
      commandBuffer += e.key
    }
  }
  return true
})
```

- [ ] **Step 3: Add history panel to Settings**

In SettingsPanel.jsx, add section to show and clear command history.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCommandHistory.js src/components/Terminal.jsx
git commit -m "feat: add command history sync"
```

---

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/2026-04-07-enhanced-features.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?