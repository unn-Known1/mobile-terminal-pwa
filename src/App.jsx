import { useState, useEffect } from 'react'
import TabManager from './components/TabManager'
import FileExplorer from './components/FileExplorer'
import Terminal from './components/Terminal'
import SplitTerminal from './components/SplitTerminal'
import SettingsPanel, { THEMES } from './components/SettingsPanel'
import CodeEditor from './components/CodeEditor'
import NetworkStatus from './components/NetworkStatus'
import { Settings, PanelLeftClose, PanelLeftOpen, Split } from 'lucide-react'
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

function sendNotification(title, body) {
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

export default function App() {
  const initial = loadSession()
  const [tabs, setTabs] = useState(initial.tabs)
  const [activeTab, setActiveTab] = useState(initial.activeTab)
  const [explorerOpen, setExplorerOpen] = useState(initial.explorerOpen)
  const [currentPath, setCurrentPath] = useState(initial.currentPath)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [splitMode, setSplitMode] = useState(false)
  const [fontSize, setFontSize] = useState(14)
  const [theme, setTheme] = useState('dark')
  const [tabStatuses, setTabStatuses] = useState({})
  const [editorFile, setEditorFile] = useState(null)
  const { connected, latency, reconnectCount } = useSocket('/')

  useEffect(() => {
    saveSession(tabs, activeTab, explorerOpen, currentPath)
  }, [tabs, activeTab, explorerOpen, currentPath])

  const updateTabStatus = (sessionId, status) => {
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
  }

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
             onClick={() => setSplitMode(v => !v)}
             title={splitMode ? 'Single terminal' : 'Split view'}
           >
             <Split size={18} />
           </button>
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
            />
          ) : (
            tabs.map(tab => (
              <div
                key={tab.id}
                style={{ display: tab.id === activeTab ? 'contents' : 'none' }}
              >
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
   )
}
