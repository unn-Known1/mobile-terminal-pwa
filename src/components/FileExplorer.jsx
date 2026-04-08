import { useState, useEffect } from 'react'
import {
  Folder, File, ChevronLeft, Terminal, RefreshCw, Eye, EyeOff,
  Copy, Scissors, Clipboard, FilePlus, Download, Trash2, Edit3, X, Check, Star, Upload
} from 'lucide-react'

// Simple path utility functions (avoid Node.js path in browser)
const getBasename = (p) => p.split('/').filter(Boolean).pop() || ''

export default function FileExplorer({ isOpen, currentPath, onNavigate, onOpenTerminal, onOpenFile }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showHidden, setShowHidden] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedItems, setSelectedItems] = useState([])
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [clipboard, setClipboard] = useState(() => {
    try { return JSON.parse(localStorage.getItem('file-clipboard') || 'null') } 
    catch { return null }
  })
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, item: null })
  const [modal, setModal] = useState({ type: null, item: null })
  const [modalInput, setModalInput] = useState('')
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

  const handleMultiRename = () => {
    if (selectedItems.length === 0) return
    setModal({ type: 'multi-rename', items: selectedItems })
    setModalInput('')
  }

  useEffect(() => {
    if (isOpen && currentPath) fetchDirectory(currentPath)
  }, [isOpen, currentPath])

  useEffect(() => {
    const closeMenu = () => setContextMenu(prev => ({ ...prev, show: false }))
    document.addEventListener('click', closeMenu)
    return () => document.removeEventListener('click', closeMenu)
  }, [])

  const fetchDirectory = async (path) => {
    setLoading(true)
    setError(null)
    try {
      const cleanPath = path === '/' ? '' : path
      const res = await fetch('/api/ls' + cleanPath)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch directory:', err)
      setError(err.message)
      setItems([])
    }
    setLoading(false)
  }

  const saveClipboard = (data) => {
    setClipboard(data)
    localStorage.setItem('file-clipboard', JSON.stringify(data))
  }

  const goBack = () => {
    if (currentPath === '/') return
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    onNavigate(parts.length ? '/' + parts.join('/') : '/')
  }

  const handleContextMenu = (e, item) => {
    e.preventDefault()
    setContextMenu({ show: true, x: e.clientX, y: e.clientY, item })
  }

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

  const handleDelete = async (item = selectedItem) => {
    if (!item) return
    if (!confirm(`Delete ${item.name}?`)) return
    try {
      await fetch('/api/file/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: [item.path] })
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
    } else if (modal.type === 'multi-rename' && modal.items) {
      try {
        for (let i = 0; i < modal.items.length; i++) {
          const item = modal.items[i]
          const ext = item.name.includes('.') ? '.' + item.name.split('.').pop() : ''
          const base = ext ? item.name.replace(ext, '') : item.name
          const newName = `${base}-${i + 1}${ext}`
          await fetch('/api/file/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPath: item.path, newName })
          })
        }
        setModal({ type: null, item: null })
        clearSelection()
        fetchDirectory(currentPath)
      } catch (err) { alert(err.message) }
    }
  }

  const visibleItems = showHidden ? items : items.filter(i => !i.name.startsWith('.'))

  if (!isOpen) return null

  return (
    <div className="file-explorer">
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
        <button className="icon-btn-sm" onClick={() => handleDownload({ path: currentPath, name: getBasename(currentPath) || 'folder' })} title="Download folder">
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
        <button className="icon-btn-sm" onClick={toggleBookmark} title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}>
          {isBookmarked ? <Star size={14} fill="currentColor" /> : <Star size={14} />}
        </button>
        <input type="file" id="file-upload" name="file-upload" aria-label="Upload file" style={{ display: 'none' }} onChange={handleUpload} />
        <button className="icon-btn-sm" onClick={() => document.getElementById('file-upload').click()} title="Upload file">
          <Upload size={14} />
        </button>
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
            <button className="icon-btn-sm" onClick={handleMultiRename} title="Batch rename">
              <Edit3 size={14} />
            </button>
            <button className="icon-btn-sm" onClick={handleMultiDelete} title="Delete selected">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
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
        {error ? (
          <div className="explorer-error">{error}</div>
        ) : loading ? (
          <div className="loading">Loading…</div>
        ) : visibleItems.length === 0 ? (
          <div className="loading">Empty directory</div>
        ) : (
          visibleItems.map(item => (
            <div
              key={item.path}
              className={`explorer-item ${item.isDirectory ? 'folder' : 'file'} ${selectedItem?.path === item.path ? 'selected' : ''} ${selectedItems.some(i => i.path === item.path) ? 'multi-selected' : ''}`}
              onClick={(e) => { 
                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                  toggleSelection(item, e)
                } else if (item.isDirectory) {
                  if (isMultiSelectMode) toggleSelection(item, e)
                  else onNavigate(item.path)
                }
                setSelectedItem(item)
              }}
              onDoubleClick={(e) => {
                if (!item.isDirectory && onOpenFile) {
                  onOpenFile(item.path)
                }
              }}
              onContextMenu={(e) => handleContextMenu(e, item)}
            >
              <span className="icon">
                {item.isDirectory ? <Folder size={16} /> : <File size={16} />}
              </span>
              <span className="name">{item.name}</span>
              {item.isDirectory && (
                <button
                  className="terminal-btn"
                  onClick={e => { e.stopPropagation(); onOpenTerminal(item.path) }}
                  title="Open terminal here"
                >
                  <Terminal size={13} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

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
          <button className="danger" onClick={() => { setContextMenu({ ...contextMenu, show: false }); handleDelete(contextMenu.item) }}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}

      {modal.type === 'multi-rename' && (
        <div className="modal-overlay" onClick={() => setModal({ type: null, item: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Batch Rename ({modal.items?.length} files)</h3>
              <button onClick={() => setModal({ type: null, item: null })}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p>Rename as: <code>{'{name}-{index}'}</code></p>
              <p className="hint">Example: file-1.txt, file-2.txt</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setModal({ type: null, item: null })}>Cancel</button>
              <button className="primary" onClick={submitModal}>
                <Check size={14} /> Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {modal.type === 'rename' && (
        <div className="modal-overlay" onClick={() => setModal({ type: null, item: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Rename {modal.item?.name}</h3>
              <button onClick={() => setModal({ type: null, item: null })}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <label htmlFor="rename-input" className="sr-only">New name</label>
              <input 
                id="rename-input"
                name="rename-input"
                type="text" 
                value={modalInput} 
                onChange={e => setModalInput(e.target.value)} 
                placeholder="New name"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && submitModal()}
              />
            </div>
            <div className="modal-footer">
              <button onClick={() => setModal({ type: null, item: null })}>Cancel</button>
              <button className="primary" onClick={submitModal}>
                <Check size={14} /> Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {modal.type === 'create' && (
        <div className="modal-overlay" onClick={() => setModal({ type: null, item: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New File</h3>
              <button onClick={() => setModal({ type: null, item: null })}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <label htmlFor="create-filename" className="sr-only">Filename</label>
              <input 
                id="create-filename"
                name="create-filename"
                type="text" 
                value={modalInput} 
                onChange={e => setModalInput(e.target.value)} 
                placeholder="Filename"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && submitModal()}
              />
            </div>
            <div className="modal-footer">
              <button onClick={() => setModal({ type: null, item: null })}>Cancel</button>
              <button className="primary" onClick={submitModal}>
                <Check size={14} /> Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}