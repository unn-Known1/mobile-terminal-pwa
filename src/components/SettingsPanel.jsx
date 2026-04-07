import { useState, useEffect } from 'react'
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

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('terminal-settings') || '{}')
    return { fontSize: s.fontSize || 14, theme: s.theme || 'dark' }
  } catch { return { fontSize: 14, theme: 'dark' } }
}

function saveSettings(s) {
  try { localStorage.setItem('terminal-settings', JSON.stringify(s)) } catch {}
}

export default function SettingsPanel({ isOpen, onClose, onFontSizeChange, onThemeChange }) {
  const initial = loadSettings()
  const [fontSize, setFontSize] = useState(initial.fontSize)
  const [theme, setTheme] = useState(initial.theme)
  const [tunnelStatus, setTunnelStatus] = useState('disconnected')
  const [tunnelUrl, setTunnelUrl] = useState('')
  const [tunnelPin, setTunnelPin] = useState('')
  const [copied, setCopied] = useState(false)

  // Check tunnel status on mount
  useEffect(() => {
    fetch('/api/tunnel/status').then(r => r.json()).then(data => {
      if (data.running && data.pin) {
        setTunnelUrl(data.url || '')
        setTunnelPin(data.pin)
        setTunnelStatus('connected')
      }
    }).catch(() => {})
    
    // Check for existing tunnel token
    const storedToken = sessionStorage.getItem('tunnel-token')
    if (storedToken) {
      fetch('/api/tunnel/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: storedToken })
      }).then(r => r.json()).then(data => {
        if (!data.valid) {
          sessionStorage.removeItem('tunnel-token')
        }
      }).catch(() => {})
    }
  }, [])

  // Apply saved settings on mount
  useEffect(() => {
    onFontSizeChange(initial.fontSize)
    onThemeChange(initial.theme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const changeFontSize = (s) => {
    setFontSize(s)
    onFontSizeChange(s)
    saveSettings({ fontSize: s, theme })
  }

  const changeTheme = (t) => {
    setTheme(t)
    onThemeChange(t)
    saveSettings({ fontSize, theme: t })
  }

  // Shortcuts state
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

  // Export/Import
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
          setShortcuts(data.shortcuts)
        }
        if (data.settings) {
          if (data.settings.fontSize) {
            setFontSize(data.settings.fontSize)
            onFontSizeChange(data.settings.fontSize)
          }
          if (data.settings.theme) {
            setTheme(data.settings.theme)
            onThemeChange(data.settings.theme)
          }
          saveSettings(data.settings)
        }
        alert('Settings imported successfully!')
      } catch (err) {
        alert('Failed to import: ' + err.message)
      }
    }
    input.click()
  }

  const handleStartTunnel = async () => {
    setTunnelStatus('starting')
    try {
      const res = await fetch('/api/tunnel/start', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        setTunnelUrl(data.url)
        setTunnelPin(data.pin)
        setTunnelStatus('connected')
      } else {
        setTunnelStatus('disconnected')
        alert(data.error || 'Failed to start tunnel')
      }
    } catch {
      setTunnelStatus('disconnected')
      alert('Could not connect to tunnel service')
    }
  }

  const handleStopTunnel = async () => {
    try { await fetch('/api/tunnel/stop', { method: 'POST' }) } catch {}
    setTunnelStatus('disconnected')
    setTunnelUrl('')
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(tunnelUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
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
            <label>Theme</label>
            <select value={theme} onChange={e => changeTheme(e.target.value)}>
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
            if (name && keys && command) addShortcut({ name, keys, command })
          }}>+ Add Shortcut</button>
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
                <input type="text" value={tunnelUrl} readOnly />
                <button className="copy-btn" onClick={handleCopyUrl} aria-label="Copy URL">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              {tunnelPin && (
                <div className="tunnel-pin">
                  <span className="pin-label">PIN:</span>
                  <span className="pin-value">{tunnelPin}</span>
                  <button className="copy-btn" onClick={() => {
                    navigator.clipboard.writeText(tunnelPin).then(() => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    })
                  }} aria-label="Copy PIN">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              )}
              <a href={tunnelUrl} target="_blank" rel="noopener noreferrer" className="tunnel-link">
                <ExternalLink size={13} /> Open in browser
              </a>
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
            <label>
              <input type="checkbox" onChange={() => {
                const s = JSON.parse(localStorage.getItem('terminal-notifications') || '{}')
                s.longRunning = !s.longRunning
                localStorage.setItem('terminal-notifications', JSON.stringify(s))
              }} defaultChecked /> Long-running commands done
            </label>
          </div>
          <div className="setting-item">
            <label>
              <input type="checkbox" onChange={() => {
                const s = JSON.parse(localStorage.getItem('terminal-notifications') || '{}')
                s.idle = !s.idle
                localStorage.setItem('terminal-notifications', JSON.stringify(s))
              }} defaultChecked /> Tab idle (60s no activity)
            </label>
          </div>
          <div className="setting-item">
            <label>
              <input type="checkbox" onChange={() => {
                const s = JSON.parse(localStorage.getItem('terminal-notifications') || '{}')
                s.background = !s.background
                localStorage.setItem('terminal-notifications', JSON.stringify(s))
              }} defaultChecked /> Background tab output
            </label>
          </div>
          <div className="setting-item">
            <label>
              <input type="checkbox" onChange={() => {
                const s = JSON.parse(localStorage.getItem('terminal-notifications') || '{}')
                s.failed = !s.failed
                localStorage.setItem('terminal-notifications', JSON.stringify(s))
              }} defaultChecked /> Command failed (non-zero exit)
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
