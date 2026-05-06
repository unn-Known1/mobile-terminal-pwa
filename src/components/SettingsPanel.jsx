import { useState, useEffect, useRef } from 'react'
import { X, Copy, Minus, Plus, Keyboard, Command, ExternalLink, Check } from 'lucide-react'

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

// SSR-safe loadSettings
function loadSettings() {
  if (typeof window === 'undefined') {
    return { fontSize: 14, theme: 'dark' }
  }

  try {
    const s = JSON.parse(localStorage.getItem('terminal-settings') || '{}')
    return { fontSize: s.fontSize || 14, theme: s.theme || 'dark' }
  } catch {
    return { fontSize: 14, theme: 'dark' }
  }
}

// SSR-safe saveSettings
function saveSettings(s) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem('terminal-settings', JSON.stringify(s))
  } catch {}
}

// Safe JSON parse helper
const safeParse = (key, fallback) => {
  if (typeof window === 'undefined') return fallback

  try {
    const val = localStorage.getItem(key)
    return val ? JSON.parse(val) : fallback
  } catch {
    return fallback
  }
}

// Safe URL validator
const isSafeUrl = (url) => {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

// Normalize font size from import
const normalizeFontSize = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 14
  return Math.min(28, Math.max(10, n))
}

// Validate filename for shortcuts
const validateFilename = (name) => {
  if (!name?.trim()) return 'Name cannot be empty'
  if (name.includes('/')) return 'Name cannot contain /'
  if (name === '.' || name === '..') return 'Invalid name'
  return null
}

// API response parser
const parseApiResponse = async (res) => {
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data
}

export default function SettingsPanel({ isOpen, onClose, onFontSizeChange, onThemeChange }) {
  // Use lazy state initialization (Issue #1 fix)
  const [fontSize, setFontSize] = useState(() => loadSettings().fontSize)
  const [theme, setTheme] = useState(() => loadSettings().theme)
  const [tunnelStatus, setTunnelStatus] = useState('disconnected')
  const [tunnelUrl, setTunnelUrl] = useState('')
  const [tunnelPin, setTunnelPin] = useState('')

  // Separate copied states for URL and PIN (Issue #7 fix)
  const [copiedField, setCopiedField] = useState(null)

  // Notification state with controlled inputs (Issue #9 fix)
  const [notifications, setNotifications] = useState(() => {
    if (typeof window === 'undefined') return {}
    try {
      return JSON.parse(localStorage.getItem('terminal-notifications') || '{}')
    } catch {
      return {}
    }
  })

  // Shortcuts state with SSR safety (Issue #12 fix for IDs)
  const [shortcuts, setShortcuts] = useState(() => safeParse('terminal-shortcuts', []))

  // Command history state with SSR safety
  const [commandHistory, setCommandHistory] = useState(() => safeParse('terminal-command-history', []))

  // Combined settings ref for effect (Issue #1, #10 fix)
  const settingsRef = useRef({ fontSize: loadSettings().fontSize, theme: loadSettings().theme })

  // Tunnel polling effect with proper dependencies (Issue #3 fix)
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/tunnel/status')
        const data = await res.json().catch(() => ({}))

        if (cancelled) return

        if (data.running && data.url) {
          setTunnelUrl(data.url)
          setTunnelPin(data.pin || '')
          setTunnelStatus('connected')
        } else {
          setTunnelStatus(prev => {
            if (prev === 'starting') return prev
            setTunnelUrl('')
            setTunnelPin('')
            return 'disconnected'
          })
        }
      } catch {
        if (!cancelled) {
          console.error('Failed to fetch tunnel status')
        }
      }
    }

    fetchStatus()
    const intervalId = setInterval(fetchStatus, 2000)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [isOpen]) // Only depends on isOpen, not tunnelStatus

  // Check for existing tunnel token (Issue #2 SSR safety)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const storedToken = sessionStorage.getItem('tunnel-token')
    if (!storedToken) return

    fetch('/api/tunnel/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: storedToken })
    })
      .then(r => r.json().catch(() => ({})))
      .then(data => {
        if (!data.valid) {
          sessionStorage.removeItem('tunnel-token')
        }
      })
      .catch(() => {})
  }, [])

  // Apply saved settings on mount (using refs to avoid stale closure)
  useEffect(() => {
    settingsRef.current = { fontSize, theme }
    onFontSizeChange?.(fontSize)
    onThemeChange?.(theme)
  }, [fontSize, theme, onFontSizeChange, onThemeChange])

  // Listen for command history updates from same tab (Issue #10 fix)
  useEffect(() => {
    const handleStorage = () => {
      setCommandHistory(safeParse('terminal-command-history', []))
    }

    const handleCustomEvent = () => {
      setCommandHistory(safeParse('terminal-command-history', []))
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('terminal-command-history-updated', handleCustomEvent)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('terminal-command-history-updated', handleCustomEvent)
    }
  }, [])

  const changeFontSize = (s) => {
    setFontSize(s)
    settingsRef.current.fontSize = s
    onFontSizeChange?.(s)
    saveSettings({ fontSize: s, theme })
  }

  const changeTheme = (t) => {
    setTheme(t)
    settingsRef.current.theme = t
    onThemeChange?.(t)
    saveSettings({ fontSize, theme: t })
  }

  const clearCommandHistory = () => {
    localStorage.removeItem('terminal-command-history')
    setCommandHistory([])
    // Notify other components (Issue #11 fix)
    window.dispatchEvent(new Event('terminal-command-history-updated'))
  }

  // Use crypto.randomUUID for IDs (Issue #12 fix)
  const addShortcut = (s) => {
    const id = crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
    const newShortcuts = [...shortcuts, { ...s, id }]
    setShortcuts(newShortcuts)
    localStorage.setItem('terminal-shortcuts', JSON.stringify(newShortcuts))
  }

  const deleteShortcut = (id) => {
    const newShortcuts = shortcuts.filter(s => s.id !== id)
    setShortcuts(newShortcuts)
    localStorage.setItem('terminal-shortcuts', JSON.stringify(newShortcuts))
  }

  // Export with safe JSON parsing (Issue #14 fix)
  const handleExport = () => {
    const settings = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      bookmarks: safeParse('terminal-bookmarks', []),
      shortcuts: safeParse('terminal-shortcuts', []),
      settings: { fontSize, theme }
    }
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `terminal-settings-${Date.now()}.json`
    // Append to DOM for better browser compatibility (Issue #15 fix)
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoke after a tick to ensure download completes
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'

    input.onchange = async (e) => {
      const file = e.target.files?.[0]
      if (!file) {
        input.remove()
        return
      }

      try {
        const text = await file.text()
        const data = JSON.parse(text)

        if (!data.version) throw new Error('Invalid settings file')

        // Validate and import bookmarks (Issue #19 fix)
        if (Array.isArray(data.bookmarks)) {
          localStorage.setItem('terminal-bookmarks', JSON.stringify(data.bookmarks))
        }

        // Validate and import shortcuts (Issue #19 fix)
        if (Array.isArray(data.shortcuts)) {
          localStorage.setItem('terminal-shortcuts', JSON.stringify(data.shortcuts))
          setShortcuts(data.shortcuts)
        }

        // Import settings with validation (Issue #17, #18, #20 fix)
        if (data.settings) {
          const importedFontSize = data.settings.fontSize
            ? normalizeFontSize(data.settings.fontSize)
            : fontSize

          const importedTheme = THEMES[data.settings.theme]
            ? data.settings.theme
            : theme

          setFontSize(importedFontSize)
          setTheme(importedTheme)
          settingsRef.current = { fontSize: importedFontSize, theme: importedTheme }

          onFontSizeChange?.(importedFontSize)
          onThemeChange?.(importedTheme)

          saveSettings({
            fontSize: importedFontSize,
            theme: importedTheme
          })
        }

        alert('Settings imported successfully!')
      } catch (err) {
        alert('Failed to import: ' + err.message)
      } finally {
        // Clean up input element (Issue #16 fix)
        input.remove()
      }
    }

    input.click()
  }

  // Start tunnel with res.ok check (Issue #4, #5 fix)
  const handleStartTunnel = async () => {
    setTunnelStatus('starting')

    try {
      const res = await fetch('/api/tunnel/start', { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.url) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      setTunnelUrl(data.url)
      setTunnelPin(data.pin || '')
      setTunnelStatus('connected')
    } catch (err) {
      setTunnelStatus('disconnected')
      alert(err.message || 'Could not connect to tunnel service')
    }
  }

  // Stop tunnel with res.ok check, clear PIN (Issue #6 fix)
  const handleStopTunnel = async () => {
    try {
      const res = await fetch('/api/tunnel/stop', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
    } catch (err) {
      console.error('Failed to stop tunnel:', err)
    }

    setTunnelStatus('disconnected')
    setTunnelUrl('')
    setTunnelPin('')
  }

  // Copy with error handling and empty URL check (Issue #8, #23 fix)
  const copyText = async (text, field) => {
    if (!text) return
    if (!navigator.clipboard) {
      alert('Clipboard API is not available')
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      alert('Failed to copy to clipboard')
    }
  }

  // Update notification with controlled state (Issue #9 fix)
  const updateNotification = (key, checked) => {
    if (typeof window === 'undefined') return

    const next = {
      longRunning: notifications.longRunning ?? true,
      idle: notifications.idle ?? true,
      background: notifications.background ?? true,
      failed: notifications.failed ?? true,
      [key]: checked,
    }

    setNotifications(next)
    localStorage.setItem('terminal-notifications', JSON.stringify(next))
  }

  // Normalize notification values
  const notificationSettings = {
    longRunning: notifications.longRunning ?? true,
    idle: notifications.idle ?? true,
    background: notifications.background ?? true,
    failed: notifications.failed ?? true,
  }

  if (!isOpen) return null

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="settings-panel">
        <div className="panel-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <div className="panel-section">
          <h3>Terminal</h3>
          <div className="setting-item">
            <label>Font Size</label>
            <div className="font-controls">
              <button onClick={() => changeFontSize(Math.max(10, fontSize - 1))} aria-label="Decrease">
                <Minus size={14} />
              </button>
              <span>{fontSize}px</span>
              <button onClick={() => changeFontSize(Math.min(28, fontSize + 1))} aria-label="Increase">
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className="setting-item">
            <label htmlFor="theme-select">Theme</label>
            <select id="theme-select" name="theme-select" value={theme} onChange={e => changeTheme(e.target.value)}>
              {Object.entries(THEMES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="panel-section">
          <h3>Command Shortcuts</h3>
          {shortcuts.map(s => (
            <div key={s.id} className="shortcut-item">
              <span className="shortcut-keys">{s.keys}</span>
              <span className="shortcut-name">{s.name}</span>
              <span className="shortcut-cmd">{s.command}</span>
              <button className="shortcut-delete" onClick={() => deleteShortcut(s.id)}>×</button>
            </div>
          ))}
          <button className="add-shortcut-btn" onClick={() => {
            const name = prompt('Shortcut name:')
            const keys = prompt('Key combination (e.g., Ctrl+Shift+G):')
            const command = prompt('Command to run:')
            // Trim and validate (Issue #13 fix)
            const trimmedName = name?.trim()
            const trimmedKeys = keys?.trim()
            const trimmedCommand = command?.trim()

            if (trimmedName && trimmedKeys && trimmedCommand) {
              addShortcut({ name: trimmedName, keys: trimmedKeys, command: trimmedCommand })
            }
          }}>+ Add Shortcut</button>
        </div>

        <div className="panel-section">
          <h3>Command History</h3>
          <div className="history-info">
            <p>{commandHistory.length} commands saved</p>
            <button onClick={clearCommandHistory} className="danger">Clear History</button>
          </div>
        </div>

        <div className="panel-section">
          <h3>Tunnel (cloudflared)</h3>
          <div className="setting-item">
            <label>Status</label>
            <span className={`status ${tunnelStatus}`}>
              {tunnelStatus === 'connected' ? 'Connected' : tunnelStatus === 'starting' ? 'Starting…' : 'Disconnected'}
            </span>
          </div>
          {tunnelStatus === 'disconnected' && (
            <button className="tunnel-btn" onClick={handleStartTunnel}>Start Tunnel</button>
          )}
          {tunnelStatus === 'starting' && (
            <button className="tunnel-btn" disabled>Starting…</button>
          )}
          {tunnelStatus === 'connected' && (
            <>
              <div className="tunnel-url">
                <input type="text" id="tunnel-url" name="tunnel-url" value={tunnelUrl} readOnly aria-label="Tunnel URL" />
                <button className="copy-btn" onClick={() => copyText(tunnelUrl, 'url')} aria-label="Copy URL">
                  {copiedField === 'url' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              {tunnelPin && (
                <div className="tunnel-pin">
                  <span className="pin-label">PIN:</span>
                  <span className="pin-value">{tunnelPin}</span>
                  <button className="copy-btn" onClick={() => copyText(tunnelPin, 'pin')} aria-label="Copy PIN">
                    {copiedField === 'pin' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              )}
              {/* Safe URL validation before rendering link (Issue #24 fix) */}
              {isSafeUrl(tunnelUrl) && (
                <a href={tunnelUrl} target="_blank" rel="noopener noreferrer" className="tunnel-link">
                  <ExternalLink size={13} /> Open in browser
                </a>
              )}
              <button className="tunnel-btn stop" onClick={handleStopTunnel}>Stop Tunnel</button>
            </>
          )}
        </div>

        <div className="panel-section">
          <h3>Help</h3>
          <details>
            <summary><Keyboard size={16} /> Keyboard Shortcuts</summary>
            <ul>
              <li><kbd>Ctrl+C</kbd> Copy / Cancel</li>
              <li><kbd>Ctrl+D</kbd> Send EOF / Exit</li>
              <li><kbd>Ctrl+L</kbd> Clear terminal</li>
              <li><kbd>Ctrl+Z</kbd> Suspend process</li>
              <li><kbd>Ctrl+F</kbd> Search in terminal</li>
              <li><kbd>Tab</kbd> Auto-complete</li>
              <li><kbd>↑ / ↓</kbd> History navigation</li>
            </ul>
          </details>
          <details>
            <summary><Command size={16} /> Mobile Keyboard Row</summary>
            <p>A keyboard toolbar appears below the terminal on mobile. Tap ESC, TAB, arrow keys, ^C, ^D and more. Tap the ↑ button to reveal a second row with symbols and more shortcuts.</p>
          </details>
        </div>

        <div className="panel-section">
          <h3>About</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Mobile Terminal v2.0</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Full PTY emulation via xterm.js + node-pty. Double-click a tab to rename it.</p>
        </div>

        <div className="panel-section">
          <h3>Notifications</h3>
          <div className="setting-item">
            <label htmlFor="notif-long-running">
              {/* Controlled checkbox state (Issue #9 fix) */}
              <input
                type="checkbox"
                id="notif-long-running"
                name="notif-long-running"
                checked={notificationSettings.longRunning}
                onChange={(e) => updateNotification('longRunning', e.target.checked)}
              /> Long-running commands done
            </label>
          </div>
          <div className="setting-item">
            <label htmlFor="notif-idle">
              <input
                type="checkbox"
                id="notif-idle"
                name="notif-idle"
                checked={notificationSettings.idle}
                onChange={(e) => updateNotification('idle', e.target.checked)}
              /> Tab idle (60s no activity)
            </label>
          </div>
          <div className="setting-item">
            <label htmlFor="notif-background">
              <input
                type="checkbox"
                id="notif-background"
                name="notif-background"
                checked={notificationSettings.background}
                onChange={(e) => updateNotification('background', e.target.checked)}
              /> Background tab output
            </label>
          </div>
          <div className="setting-item">
            <label htmlFor="notif-failed">
              <input
                type="checkbox"
                id="notif-failed"
                name="notif-failed"
                checked={notificationSettings.failed}
                onChange={(e) => updateNotification('failed', e.target.checked)}
              /> Command failed (non-zero exit)
            </label>
          </div>
        </div>

        <div className="panel-section">
          <h3>Backup</h3>
          <div className="backup-buttons">
            <button onClick={handleExport}>Export Settings</button>
            <button onClick={handleImport}>Import Settings</button>
          </div>
        </div>
      </div>
    </>
  )
}

export { THEMES }