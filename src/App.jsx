import { useState, useEffect, useRef, useCallback } from 'react'
import TabManager from './components/TabManager'
import FileExplorer from './components/FileExplorer'
import Terminal from './components/Terminal'
import SplitTerminal from './components/SplitTerminal'
import SettingsPanel, { THEMES } from './components/SettingsPanel'
import CodeEditor from './components/CodeEditor'
import NetworkStatus from './components/NetworkStatus'
import ErrorBoundary from './components/ErrorBoundary'
import { Settings, PanelLeftClose, PanelLeftOpen, Split, Clipboard, X } from 'lucide-react'
import { useSocket } from './hooks/useSocket'

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

function saveSession(tabs, activeTab, explorerOpen, currentPath) {
  try {
    localStorage.setItem('terminal-session', JSON.stringify({ tabs, activeTab, explorerOpen, currentPath }))
  } catch {}
}

function savePreferences(orientation) {
  try {
    const prefs = JSON.parse(localStorage.getItem('terminal-preferences') || '{}')
    prefs.orientation = orientation
    localStorage.setItem('terminal-preferences', JSON.stringify(prefs))
  } catch {}
}

async function sendNotification(title, body) {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification(title, { body })
  } else if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      new Notification(title, { body })
    }
  }
}

export default function App() {
  // Fix B16: Use lazy initializer to avoid running loadSession() on every render
  const [tabs, setTabs] = useState(() => loadSession().tabs)
  const [activeTab, setActiveTab] = useState(() => loadSession().activeTab)
  const [explorerOpen, setExplorerOpen] = useState(() => loadSession().explorerOpen)
  const [currentPath, setCurrentPath] = useState(() => loadSession().currentPath)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [splitMode, setSplitMode] = useState(false)
  const [splitOrientation, setSplitOrientation] = useState(() => {
    if (typeof window === 'undefined') return 'horizontal'
    try {
      const prefs = JSON.parse(localStorage.getItem('terminal-preferences') || '{}')
      return prefs.orientation || 'horizontal'
    } catch { return 'horizontal' }
  })
  const [fontSize, setFontSize] = useState(14)
  const [theme, setTheme] = useState('dark')
  const [tabStatuses, setTabStatuses] = useState({})
  const [editorFile, setEditorFile] = useState(null)
  const { connected, latency, reconnectCount } = useSocket('/')
  const sessionSaveTimeout = useRef(null)

  // Debounced session saving
  useEffect(() => {
    if (sessionSaveTimeout.current) clearTimeout(sessionSaveTimeout.current)
    sessionSaveTimeout.current = setTimeout(() => {
      saveSession(tabs, activeTab, explorerOpen, currentPath)
    }, 500)
    return () => {
      if (sessionSaveTimeout.current) clearTimeout(sessionSaveTimeout.current)
    }
  }, [tabs, activeTab, explorerOpen, currentPath])

  const updateTabStatus = useCallback((sessionId, status) => {
    setTabStatuses(prev => {
      const newStatus = { ...prev, [sessionId]: status }
      const tab = tabs.find(t => t.id === sessionId)
      if (tab && sessionId !== activeTab) {
        try {
          const notifSettings = JSON.parse(localStorage.getItem('terminal-notifications') || '{"longRunning":true,"idle":true,"background":true,"failed":true}')
          if (status === 'idle' && notifSettings.idle) {
            sendNotification('Tab Idle', `${tab.name} has been idle`)
          }
          if (status === 'notification' && notifSettings.background) {
            sendNotification('New Output', `${tab.name} has new output`)
          }
        } catch {}
      }
      return newStatus
    })
  }, [activeTab, tabs])

  // Handle cwd change from terminal to persist it
  const handleCwdChange = useCallback((sessionId, cwd) => {
    setTabs(prev => {
      const updated = prev.map(tab =>
        tab.id === sessionId ? { ...tab, cwd } : tab
      )
      // Immediately save to localStorage
      try {
        const session = {
          tabs: updated,
          activeTab,
          explorerOpen,
          currentPath
        }
        localStorage.setItem('terminal-session', JSON.stringify(session))
      } catch {}
      return updated
    })
  }, [activeTab, explorerOpen, currentPath])

  const handleNewTab = (cwd = null, name = null, color = null) => {
    const id = 'tab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
    const tabName = name || `Terminal ${tabs.length + 1}`
    setTabs(prev => [...prev, { id, name: tabName, cwd, color }])
    setActiveTab(id)
    if (cwd) setCurrentPath(cwd)
  }

  const handleCloseTab = (tabId) => {
    if (tabs.length === 1) return
    const newTabs = tabs.filter(t => t.id !== tabId)
    setTabs(newTabs)
    if (activeTab === tabId) setActiveTab(newTabs[newTabs.length - 1].id)
  }

  const handleRenameTab = (tabId, data) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...data } : t))
  }

  const handleOpenTerminal = (cwd) => {
    handleNewTab(cwd)
    setExplorerOpen(false)
  }

  return (
    <ErrorBoundary>
    <div className="app">
      <div className="top-bar">
        <div className="tabs-container">
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
        </div>
           <div className="actions">
            <NetworkStatus connected={connected} latency={latency} reconnectCount={reconnectCount} />
            <button
              className="icon-btn"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText()
                  if (text) {
                    const event = new CustomEvent('terminal-paste', { detail: { text }, bubbles: true })
                    window.dispatchEvent(event)
                  }
                } catch (err) {
                  console.error('Paste failed:', err)
                }
              }}
              title="Paste from clipboard"
            >
              <Clipboard size={18} />
            </button>
           {splitMode ? (
             <>
               <button
                 className="icon-btn"
                 onClick={() => {
                   const newOrientation = splitOrientation === 'horizontal' ? 'vertical' : 'horizontal'
                   setSplitOrientation(newOrientation)
                   savePreferences(newOrientation) // Low Fix #24: Persist orientation preference
                 }}
                 title={`${splitOrientation === 'horizontal' ? 'Columns' : 'Rows'} view (Ctrl+\\)`}
               >
                 <Split size={18} className={splitOrientation === 'horizontal' ? '' : 'rotate-90'} />
               </button>
               <button
                 className="icon-btn active"
                 onClick={() => setSplitMode(false)}
                 title="Exit split view"
               >
                 <X size={18} />
               </button>
             </>
           ) : (
             <button
               className="icon-btn"
               onClick={() => setSplitMode(true)}
               title="Split view"
             >
               <Split size={18} />
             </button>
           )}
           <button
             className="icon-btn"
             onClick={() => setExplorerOpen(v => !v)}
             title={explorerOpen ? 'Hide file explorer' : 'Show file explorer'}
           >
             {explorerOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
           </button>
           <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Settings">
             <Settings size={18} />
           </button>
         </div>
      </div>

      <div className="main-content">
        <FileExplorer
          isOpen={explorerOpen}
          currentPath={currentPath}
          terminalCwd={tabs.find(t => t.id === activeTab)?.cwd}
          onNavigate={setCurrentPath}
          onOpenTerminal={handleOpenTerminal}
          onOpenFile={setEditorFile}
        />
        <div className={`terminal-area ${explorerOpen ? 'with-explorer' : ''}`}>
          {splitMode ? (
            <SplitTerminal
              tabs={tabs}
              activeTab={activeTab}
              fontSize={fontSize}
              theme={THEMES[theme]}
              tabStatuses={tabStatuses}
              onStatusChange={updateTabStatus}
              orientation={splitOrientation}
              onOrientationChange={setSplitOrientation}
              onCwdChange={handleCwdChange}
            />
          ) : (
            tabs.filter(tab => tab.id === activeTab).map(tab => (
              <Terminal
                key={tab.id}
                sessionId={tab.id}
                cwd={tab.cwd}
                fontSize={fontSize}
                theme={THEMES[theme]}
                onStatusChange={updateTabStatus}
                onCwdChange={handleCwdChange}
              />
            ))
          )}
        </div>
      </div>

      <button
        className="explorer-toggle"
        onClick={() => setExplorerOpen(v => !v)}
        title={explorerOpen ? 'Hide file explorer' : 'Show file explorer'}
      >
        {explorerOpen ? <PanelLeftClose size={24} /> : <PanelLeftOpen size={24} />}
      </button>

       <SettingsPanel
         isOpen={settingsOpen}
         onClose={() => setSettingsOpen(false)}
         onFontSizeChange={setFontSize}
         onThemeChange={setTheme}
       />

       <CodeEditor filePath={editorFile} onClose={() => setEditorFile(null)} />
      </div>
    </ErrorBoundary>
  )
}
