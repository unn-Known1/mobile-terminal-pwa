# File Explorer Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add file operations to sidebar file explorer: download (zip), copy, cut, paste, rename, create new file via sidebar buttons and context menu.

**Architecture:** Server adds file operation APIs with path validation. Frontend adds clipboard state (localStorage), context menu, modals, and sidebar action buttons.

**Tech Stack:** Express server, React components, archiver for zip, localStorage for clipboard

---

## Task 1: Server - Add File Operation APIs

**Files:**
- Modify: `server/server.js` - add file operation endpoints
- Modify: `package.json` - add archiver dependency

- [ ] **Step 1: Install archiver package**

```bash
cd /home/ptelgm/Documents/mobile_terminal_fixed && npm install archiver
```

- [ ] **Step 2: Add file API imports and helper functions**

Modify `server/server.js` - add after existing imports:

```javascript
import fs from 'fs'
import path from 'path'
import archiver from 'archiver'

// Helper: validate path is within home directory
function validatePath(filePath) {
  const homeDir = process.env.HOME || '/home/' + process.env.USER
  const resolved = path.resolve(filePath)
  const homeResolved = path.resolve(homeDir)
  if (!resolved.startsWith(homeResolved)) {
    return { error: 'Access denied: path outside home directory' }
  }
  return null
}

// Helper: get file/folder info
function getFileInfo(filePath) {
  try {
    const stats = fs.statSync(filePath)
    return { exists: true, isDirectory: stats.isDirectory(), size: stats.size, mtime: stats.mtime }
  } catch {
    return { exists: false }
  }
}
```

- [ ] **Step 3: Add /api/file/info endpoint**

Add after tunnel endpoints:

```javascript
app.get('/api/file/info', (req, res) => {
  const filePath = req.query.path
  if (!filePath) return res.json({ error: 'Missing path' })
  const validation = validatePath(filePath)
  if (validation) return res.json(validation)
  const info = getFileInfo(filePath)
  res.json(info)
})
```

- [ ] **Step 4: Add /api/file/create endpoint**

```javascript
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
```

- [ ] **Step 5: Add /api/file/rename endpoint**

```javascript
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
```

- [ ] **Step 6: Add /api/file/delete endpoint**

```javascript
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
```

- [ ] **Step 7: Add /api/file/copy endpoint**

```javascript
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
```

- [ ] **Step 8: Add /api/file/move endpoint (for paste after cut)**

```javascript
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
      const destStats = fs.existsSync(destPath) ? fs.statSync(destPath) : null
      if (destStats && destStats.isDirectory()) {
        return res.json({ error: 'Cannot overwrite directory with file' })
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
```

- [ ] **Step 9: Add /api/file/download endpoint**

```javascript
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
      // Single folder - create zip
      const archive = archiver('zip', { zlib: { level: 9 } })
      res.attachment(path.basename(singlePath) + '.zip')
      archive.pipe(res)
      archive.directory(singlePath, path.basename(singlePath))
      archive.finalize()
    } else {
      // Single file - direct download
      res.download(singlePath, path.basename(singlePath))
    }
  } else {
    // Multiple items - create zip
    const archive = archiver('zip', { zlib: { level: 9 } })
    const name = paths.length === 1 ? path.basename(paths[0]) : 'download'
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
```

- [ ] **Step 10: Verify server syntax**

```bash
cd /home/ptelgm/Documents/mobile_terminal_fixed && node -c server/server.js
```

---

## Task 2: Frontend - FileExplorer Updates

**Files:**
- Modify: `src/components/FileExplorer.jsx` - add clipboard state, context menu, modals, actions

- [ ] **Step 1: Add imports and state for clipboard/modal/context menu**

Add imports at top of FileExplorer.jsx:

```javascript
import { 
  Folder, File, ChevronLeft, Terminal, RefreshCw, Eye, EyeOff,
  Copy, Scissors, Clipboard, FilePlus, Download, Trash2, Edit3, X, Check
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
```

Add state variables after existing state:

```javascript
const [selectedItem, setSelectedItem] = useState(null)
const [clipboard, setClipboard] = useState(() => {
  try { return JSON.parse(localStorage.getItem('file-clipboard') || 'null') } 
  catch { return null }
})
const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, item: null })
const [modal, setModal] = useState({ type: null, item: null }) // 'rename' | 'create' | null
const [modalInput, setModalInput] = useState('')
```

- [ ] **Step 2: Add saveClipboard helper**

```javascript
const saveClipboard = (data) => {
  setClipboard(data)
  localStorage.setItem('file-clipboard', JSON.stringify(data))
}
```

- [ ] **Step 3: Add context menu handler**

Add after useEffect:

```javascript
const handleContextMenu = (e, item) => {
  e.preventDefault()
  setContextMenu({ show: true, x: e.clientX, y: e.clientY, item })
}

// Close context menu on click outside
useEffect(() => {
  const closeMenu = () => setContextMenu(prev => ({ ...prev, show: false }))
  document.addEventListener('click', closeMenu)
  return () => document.removeEventListener('click', closeMenu)
}, [])
```

- [ ] **Step 4: Add operation handlers**

```javascript
const handleCopy = () => {
  if (selectedItem) saveClipboard({ action: 'copy', paths: [selectedItem.path], sourcePath: currentPath })
}

const handleCut = () => {
  if (selectedItem) saveClipboard({ action: 'cut', paths: [selectedItem.path], sourcePath: currentPath })
}

const handlePaste = async () => {
  if (!clipboard) return
  try {
    const endpoint = clipboard.action === 'copy' ? '/api/file/copy' : '/api/file/move'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: clipboard.paths, destination: currentPath })
    })
    const data = await res.json()
    if (data.error) {
      alert(data.error)
    } else if (clipboard.action === 'cut') {
      saveClipboard(null)
    }
    fetchDirectory(currentPath)
  } catch (err) { alert(err.message) }
}

const handleRename = () => {
  if (selectedItem) {
    setModal({ type: 'rename', item: selectedItem })
    setModalInput(selectedItem.name)
  }
}

const handleCreate = () => {
  setModal({ type: 'create', item: null })
  setModalInput('')
}

const handleDelete = async () => {
  if (!selectedItem) return
  if (!confirm(`Delete ${selectedItem.name}?`)) return
  try {
    await fetch('/api/file/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: [selectedItem.path] })
    })
    setSelectedItem(null)
    fetchDirectory(currentPath)
  } catch (err) { alert(err.message) }
}

const handleDownload = async (item) => {
  try {
    const res = await fetch('/api/file/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: [item.path] })
    })
    if (res.ok) {
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = item.name
      a.click()
      window.URL.revokeObjectURL(url)
    }
  } catch (err) { alert(err.message) }
}

const submitModal = async () => {
  if (modal.type === 'rename' && modal.item) {
    try {
      await fetch('/api/file/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath: modal.item.path, newName: modalInput })
      })
      setModal({ type: null, item: null })
      setSelectedItem(null)
      fetchDirectory(currentPath)
    } catch (err) { alert(err.message) }
  } else if (modal.type === 'create') {
    try {
      const newPath = currentPath === '/' ? '/' + modalInput : currentPath + '/' + modalInput
      await fetch('/api/file/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newPath })
      })
      setModal({ type: null, item: null })
      fetchDirectory(currentPath)
    } catch (err) { alert(err.message) }
  }
}
```

- [ ] **Step 5: Update header buttons**

Replace existing header section:

```javascript
<div className="explorer-header">
  <button className="back-btn" onClick={goBack} title="Go up" disabled={currentPath === '/'}>
    <ChevronLeft size={16} />
  </button>
  <span className="path" title={currentPath}>{currentPath}</span>
  <button className="icon-btn-sm" onClick={() => setShowHidden(v => !v)} title={showHidden ? 'Hide hidden files' : 'Show hidden files'}>
    {showHidden ? <EyeOff size={14} /> : <Eye size={14} />}
  </button>
  <button className="icon-btn-sm" onClick={() => fetchDirectory(currentPath)} title="Refresh">
    <RefreshCw size={14} className={loading ? 'spinning' : ''} />
  </button>
  <button className="icon-btn-sm" onClick={handleCreate} title="New file">
    <FilePlus size={14} />
  </button>
  <button className="icon-btn-sm" onClick={() => handleDownload({ path: currentPath, name: 'folder' })} title="Download folder">
    <Download size={14} />
  </button>
  <button className="icon-btn-sm" onClick={handleCopy} disabled={!selectedItem} title="Copy">
    <Copy size={14} />
  </button>
  <button className="icon-btn-sm" onClick={handleCut} disabled={!selectedItem} title="Cut">
    <Scissors size={14} />
  </button>
  <button className="icon-btn-sm" onClick={handlePaste} disabled={!clipboard} title="Paste">
    <Clipboard size={14} />
  </button>
  <button className="icon-btn-sm" onClick={handleRename} disabled={!selectedItem} title="Rename">
    <Edit3 size={14} />
  </button>
</div>
```

- [ ] **Step 6: Update item click to select**

Modify the click handler on explorer-item:

```javascript
<div
  className={`explorer-item ${item.isDirectory ? 'folder' : 'file'} ${selectedItem?.path === item.path ? 'selected' : ''}`}
  onClick={(e) => { 
    if (item.isDirectory) onNavigate(item.path)
    setSelectedItem(item)
  }}
  onContextMenu={(e) => handleContextMenu(e, item)}
>
```

- [ ] **Step 7: Add context menu component**

Add before closing `</div>` of explorer-content:

```javascript
{contextMenu.show && (
  <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
    <button onClick={() => { setSelectedItem(contextMenu.item); setContextMenu({ ...contextMenu, show: false }); handleDownload(contextMenu.item) }}>
      <Download size={14} /> Download
    </button>
    <button onClick={() => { setSelectedItem(contextMenu.item); setContextMenu({ ...contextMenu, show: false }); handleCopy() }}>
      <Copy size={14} /> Copy
    </button>
    <button onClick={() => { setSelectedItem(contextMenu.item); setContextMenu({ ...contextMenu, show: false }); handleCut() }}>
      <Scissors size={14} /> Cut
    </button>
    <button onClick={() => { setSelectedItem(contextMenu.item); setContextMenu({ ...contextMenu, show: false }); handleRename() }}>
      <Edit3 size={14} /> Rename
    </button>
    <div className="context-divider" />
    <button className="danger" onClick={() => { setSelectedItem(contextMenu.item); setContextMenu({ ...contextMenu, show: false }); handleDelete() }}>
      <Trash2 size={14} /> Delete
    </button>
  </div>
)}
```

- [ ] **Step 8: Add modal component**

Add after context menu:

```javascript
{modal.type && (
  <div className="modal-overlay" onClick={() => setModal({ type: null, item: null })}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h3>{modal.type === 'rename' ? `Rename ${modal.item?.name}` : 'Create New File'}</h3>
        <button onClick={() => setModal({ type: null, item: null })}><X size={16} /></button>
      </div>
      <div className="modal-body">
        <input 
          type="text" 
          value={modalInput} 
          onChange={e => setModalInput(e.target.value)} 
          placeholder={modal.type === 'rename' ? 'New name' : 'Filename'}
          autoFocus
          onKeyDown={e => e.key === 'Enter' && submitModal()}
        />
      </div>
      <div className="modal-footer">
        <button onClick={() => setModal({ type: null, item: null })}>Cancel</button>
        <button className="primary" onClick={submitModal}>
          <Check size={14} /> {modal.type === 'rename' ? 'Rename' : 'Create'}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 9: Add CSS styles**

Add to `src/index.css`:

```css
/* File explorer actions */
.explorer-header { gap: 4px; flex-wrap: wrap; }
.explorer-header button:disabled { opacity: 0.4; cursor: not-allowed; }
.explorer-item.selected { background: var(--bg-tertiary); }

/* Context menu */
.context-menu {
  position: fixed; z-index: 1000;
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 8px; padding: 4px; min-width: 140px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.context-menu button {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 8px 12px; border: none;
  background: none; color: var(--text-primary); font-size: 13px;
  cursor: pointer; border-radius: 4px; text-align: left;
}
.context-menu button:hover { background: var(--bg-tertiary); }
.context-menu button.danger { color: #EF4444; }
.context-menu button.danger:hover { background: rgba(239,68,68,0.1); }
.context-menu .context-divider { height: 1px; background: var(--border); margin: 4px 0; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; z-index: 1001;
  background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
}
.modal {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 12px; width: 90%; max-width: 400px; overflow: hidden;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px; border-bottom: 1px solid var(--border);
}
.modal-header h3 { margin: 0; font-size: 16px; }
.modal-header button { background: none; border: none; color: var(--text-secondary); cursor: pointer; }
.modal-body { padding: 16px; }
.modal-body input {
  width: 100%; padding: 10px 12px; font-size: 14px;
  background: var(--bg-tertiary); border: 1px solid var(--border);
  border-radius: 6px; color: var(--text-primary); outline: none;
}
.modal-body input:focus { border-color: var(--accent); }
.modal-footer {
  display: flex; justify-content: flex-end; gap: 8px; padding: 16px; border-top: 1px solid var(--border);
}
.modal-footer button {
  padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; border: 1px solid var(--border);
  background: var(--bg-tertiary); color: var(--text-primary);
}
.modal-footer button.primary {
  background: var(--accent); color: var(--bg-primary); border-color: var(--accent);
}
```

- [ ] **Step 10: Build and verify**

```bash
cd /home/ptelgm/Documents/mobile_terminal_fixed && npx vite build
```

---

## Task 3: Final Verification

- [ ] **Step 1: Start server and test**

```bash
cd /home/ptelgm/Documents/mobile_terminal_fixed && npm run dev
```

- [ ] **Step 2: Test file operations**

- Open file explorer, click sidebar buttons to test copy/cut/paste/rename/create
- Right-click items to test context menu
- Test download for single file (should download directly)
- Test download for folder (should download as zip)

---

**Plan complete.** Using subagent-driven-development to execute task-by-task.