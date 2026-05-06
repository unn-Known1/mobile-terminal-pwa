import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Folder, File, ChevronLeft, Terminal, RefreshCw, Eye, EyeOff,
  Copy, Scissors, Clipboard, FilePlus, Download, Trash2, Edit3, X, Check, Star, Upload, ChevronRight, Home
} from 'lucide-react'

// Simple path utility functions (avoid Node.js path in browser)
const getBasename = (p) => (p || '').split('/').filter(Boolean).pop() || ''

// Parse path into segments for clickable navigation (safe for null/undefined)
const getPathSegments = (path = '/') => {
  if (path === '/' || path === '') return [{ name: '/', path: '/' }]
  const parts = path.split('/').filter(Boolean)
  const segments = []
  let accumulated = ''
  for (let i = 0; i < parts.length; i++) {
    accumulated += '/' + parts[i]
    segments.push({ name: parts[i], path: accumulated })
  }
  return segments
}

// Safe filename split (handles hidden files like .env, archive.tar.gz)
const splitName = (name) => {
  const index = name.lastIndexOf('.')
  if (index <= 0) {
    return { base: name, ext: '' }
  }
  return {
    base: name.slice(0, index),
    ext: name.slice(index),
  }
}

// Validate filename (basic security check)
const validateFilename = (name) => {
  if (!name || !name.trim()) return 'Name cannot be empty'
  if (name.includes('/')) return 'Name cannot contain /'
  if (name === '.' || name === '..') return 'Invalid name'
  return null
}

// Parse API response helper
const parseApiResponse = async (res) => {
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data
}

export default function FileExplorer({ isOpen, currentPath = '/', terminalCwd = null, onNavigate, onOpenTerminal, onOpenFile }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showHidden, setShowHidden] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedItems, setSelectedItems] = useState([])
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [clipboard, setClipboard] = useState(() => {
    if (typeof window === 'undefined') return null
    try { return JSON.parse(localStorage.getItem('file-clipboard') || 'null') }
    catch { return null }
  })
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, item: null })
  const [modal, setModal] = useState({ type: null, item: null })
  const [modalInput, setModalInput] = useState('')
  const [bookmarks, setBookmarks] = useState(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('terminal-bookmarks') || '[]') }
    catch { return [] }
  })

  // Ref for file input to avoid global ID conflicts
  const fileInputRef = useRef(null)
  // Abort controller for race condition fix
  const abortControllerRef = useRef(null)

  const isBookmarked = currentPath && bookmarks.some(b => b.path === currentPath)

  // Clear selection when path changes
  useEffect(() => {
    setSelectedItem(null)
    setSelectedItems([])
    setIsMultiSelectMode(false)
  }, [currentPath])

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
    if (selectedItems.length === 0) return
    if (!confirm(`Delete ${selectedItems.length} items?`)) return
    try {
      const res = await fetch('/api/file/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: selectedItems.map(i => i.path) })
      })
      await parseApiResponse(res)
      clearSelection()
      fetchDirectory(currentPath)
    } catch (err) { alert(err.message) }
  }

  const handleMultiDownload = async () => {
    if (selectedItems.length === 0) return
    try {
      const res = await fetch('/api/file/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: selectedItems.map(i => i.path) })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'download.zip'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) { alert(err.message) }
  }

  const handleMultiCopy = () => {
    if (selectedItems.length === 0) return
    saveClipboard({ action: 'copy', paths: selectedItems.map(i => i.path), sourcePath: currentPath })
    clearSelection()
  }

  const handleMultiCut = () => {
    if (selectedItems.length === 0) return
    saveClipboard({ action: 'cut', paths: selectedItems.map(i => i.path), sourcePath: currentPath })
    clearSelection()
  }

  const handleMultiRename = () => {
    if (selectedItems.length === 0) return
    setModal({ type: 'multi-rename', items: selectedItems })
    setModalInput('')
  }

  useEffect(() => {
    if (isOpen && currentPath) {
      // Cancel previous request
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()
      fetchDirectory(currentPath, abortControllerRef.current.signal)
    }
  }, [isOpen, currentPath])

  useEffect(() => {
    const closeMenu = () => setContextMenu(prev => ({ ...prev, show: false }))
    document.addEventListener('click', closeMenu)
    return () => document.removeEventListener('click', closeMenu)
  }, [])

  const fetchDirectory = async (path, signal) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ls?path=${encodeURIComponent(path)}`, { signal })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('Failed to fetch directory:', err)
      setError(err.message)
      setItems([])
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }

  const saveClipboard = (data) => {
    setClipboard(data)
    if (data) {
      localStorage.setItem('file-clipboard', JSON.stringify(data))
    } else {
      localStorage.removeItem('file-clipboard')
    }
  }

  const goBack = () => {
    if (currentPath === '/') return
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    onNavigate(parts.length ? '/' + parts.join('/') : '/')
  }

  const navigateToRoot = () => {
    // Navigate to terminal's current working directory if available, otherwise root
    const targetPath = terminalCwd || '/'
    onNavigate(targetPath)
  }

  // Get path segments for clickable navigation
  const pathSegments = useMemo(() => getPathSegments(currentPath), [currentPath])

  const handleContextMenu = (e, item) => {
    e.preventDefault()
    setSelectedItem(item)
    setContextMenu({ show: true, x: e.clientX, y: e.clientY, item })
  }

  const handleCopy = (item = selectedItem) => {
    if (item) saveClipboard({ action: 'copy', paths: [item.path], sourcePath: currentPath })
  }

  const handleCut = (item = selectedItem) => {
    if (item) saveClipboard({ action: 'cut', paths: [item.path], sourcePath: currentPath })
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

  const handleRename = (item = selectedItem) => {
    if (item) {
      setModal({ type: 'rename', item })
      setModalInput(item.name)
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
      const res = await fetch('/api/file/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: [item.path] })
      })
      await parseApiResponse(res)
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = item.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      fetchDirectory(currentPath)
    } catch (err) { alert(err.message) }
    e.target.value = ''
  }

  const submitModal = async () => {
    // Validate filename for rename/create
    if (modal.type === 'rename' || modal.type === 'create') {
      const validationError = validateFilename(modalInput)
      if (validationError) {
        alert(validationError)
        return
      }
    }

    if (modal.type === 'rename' && modal.item) {
      try {
        const res = await fetch('/api/file/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath: modal.item.path, newName: modalInput })
        })
        await parseApiResponse(res)
        setModal({ type: null, item: null })
        setSelectedItem(null)
        fetchDirectory(currentPath)
      } catch (err) { alert(err.message) }
    } else if (modal.type === 'create') {
      try {
        const newPath = currentPath === '/' ? '/' + modalInput : currentPath + '/' + modalInput
        const res = await fetch('/api/file/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: newPath })
        })
        await parseApiResponse(res)
        setModal({ type: null, item: null })
        fetchDirectory(currentPath)
      } catch (err) { alert(err.message) }
    } else if (modal.type === 'multi-rename' && modal.items) {
      try {
        const renamePromises = modal.items.map((item, i) => {
          const { base, ext } = splitName(item.name)
          const newName = `${base}-${i + 1}${ext}`
          return fetch('/api/file/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPath: item.path, newName })
          })
        })
        for (const promise of renamePromises) {
          await parseApiResponse(promise)
        }
        setModal({ type: null, item: null })
        clearSelection()
        fetchDirectory(currentPath)
      } catch (err) { alert(err.message) }
    }
  }

  const visibleItems = useMemo(() => {
    return showHidden ? items : items.filter(i => !i.name.startsWith('.'))
  }, [items, showHidden])

  if (!isOpen) return null

  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <button className="back-btn" onClick={goBack} title="Go back" disabled={currentPath === '/'}>
          <ChevronLeft size={16} />
        </button>
        <button className="home-btn" onClick={navigateToRoot} title={terminalCwd ? `Go to terminal's directory (${terminalCwd})` : 'Go to root (/)'}>
          <Home size={16} />
        </button>
        <div className="clickable-path">
          {pathSegments.map((segment, index) => (
            <span key={segment.path} className="path-segment-wrapper">
              {index > 0 && <ChevronRight size={12} className="path-separator" />}
              <button
                className="path-segment"
                onClick={() => onNavigate(segment.path)}
                title={segment.path}
              >
                {segment.name}
              </button>
            </span>
          ))}
        </div>
        <div className="header-actions">
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
          <button className="icon-btn-sm" onClick={() => handleCopy()} disabled={!selectedItem} title="Copy">
            <Copy size={14} />
          </button>
          <button className="icon-btn-sm" onClick={() => handleCut()} disabled={!selectedItem} title="Cut">
            <Scissors size={14} />
          </button>
          <button className="icon-btn-sm" onClick={handlePaste} disabled={!clipboard} title="Paste">
            <Clipboard size={14} />
          </button>
          <button className="icon-btn-sm" onClick={() => handleRename()} disabled={!selectedItem} title="Rename">
            <Edit3 size={14} />
          </button>
          <button className="icon-btn-sm" onClick={toggleBookmark} title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}>
            {isBookmarked ? <Star size={14} fill="currentColor" /> : <Star size={14} />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Upload file"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
          <button className="icon-btn-sm" onClick={() => fileInputRef.current?.click()} title="Upload file">
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
      </div>
      <div className="explorer-content" onDragOver={e => e.preventDefault()} onDrop={async (e) => {
        e.preventDefault()
        const file = e.dataTransfer.files?.[0]
        if (!file) return
        const formData = new FormData()
        formData.append('file', file)
        formData.append('path', currentPath)
        try {
          const res = await fetch('/api/file/upload', { method: 'POST', body: formData })
          const data = await res.json().catch(() => ({}))
          if (!res.ok || data.error) {
            throw new Error(data.error || `HTTP ${res.status}`)
          }
          fetchDirectory(currentPath)
        } catch (err) { alert(err.message) }
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
                if (e.shiftKey || e.ctrlKey || e.metaKey || isMultiSelectMode) {
                  toggleSelection(item, e)
                } else {
                  setSelectedItem(item)
                }
              }}
              onDoubleClick={() => {
                if (item.isDirectory) {
                  onNavigate(item.path)
                } else {
                  onOpenFile?.(item.path)
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
          <button onClick={() => { setContextMenu(prev => ({ ...prev, show: false })); handleDownload(contextMenu.item) }}>
            <Download size={14} /> Download
          </button>
          <button onClick={() => { setContextMenu(prev => ({ ...prev, show: false })); handleCopy(contextMenu.item) }}>
            <Copy size={14} /> Copy
          </button>
          <button onClick={() => { setContextMenu(prev => ({ ...prev, show: false })); handleCut(contextMenu.item) }}>
            <Scissors size={14} /> Cut
          </button>
          <button onClick={() => { setContextMenu(prev => ({ ...prev, show: false })); handleRename(contextMenu.item) }}>
            <Edit3 size={14} /> Rename
          </button>
          <div className="context-divider" />
          <button className="danger" onClick={() => { setContextMenu(prev => ({ ...prev, show: false })); handleDelete(contextMenu.item) }}>
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
