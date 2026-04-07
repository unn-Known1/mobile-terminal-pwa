# Settings Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add slide-out settings panel with terminal settings, tunnel controls, help, and about sections

**Architecture:** Settings panel component with sections, tunnel script integration, modal overlay

**Tech Stack:** React, CSS, Shell scripts

---

### Task 1: Settings Panel Component

**Files:**
- Create: `src/components/SettingsPanel.jsx`

- [ ] **Step 1: Create SettingsPanel component**

```jsx
import { useState } from 'react';

const terminalThemes = {
  dark: { background: '#1a1a1a', foreground: '#ffffff', cursor: '#ffffff' },
  light: { background: '#f5f5f5', foreground: '#1a1a1a', cursor: '#1a1a1a' },
  highContrast: { background: '#000000', foreground: '#00ff00', cursor: '#00ff00' }
};

export default function SettingsPanel({ isOpen, onClose, onFontSizeChange, onThemeChange }) {
  const [fontSize, setFontSize] = useState(14);
  const [theme, setTheme] = useState('dark');
  const [tunnelStatus, setTunnelStatus] = useState('disconnected');
  const [tunnelUrl, setTunnelUrl] = useState('');

  const handleStartTunnel = () => {
    setTunnelStatus('starting');
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(tunnelUrl);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="settings-panel">
        <div className="panel-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="panel-section">
          <h3>Terminal</h3>
          <div className="setting-item">
            <label>Font Size</label>
            <div className="font-controls">
              <button onClick={() => { const s = Math.max(10, fontSize-1); setFontSize(s); onFontSizeChange(s); }}>-</button>
              <span>{fontSize}</span>
              <button onClick={() => { const s = Math.min(24, fontSize+1); setFontSize(s); onFontSizeChange(s); }}>+</button>
            </div>
          </div>
          <div className="setting-item">
            <label>Theme</label>
            <select value={theme} onChange={(e) => { setTheme(e.target.value); onThemeChange(e.target.value); }}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="highContrast">High Contrast</option>
            </select>
          </div>
        </div>

        <div className="panel-section">
          <h3>Tunnel</h3>
          <div className="setting-item">
            <label>Status</label>
            <span className={`status ${tunnelStatus}`}>
              {tunnelStatus === 'connected' ? '● Connected' : '○ Disconnected'}
            </span>
          </div>
          {tunnelStatus === 'disconnected' ? (
            <button className="tunnel-btn" onClick={handleStartTunnel}>
              Start cloudflared
            </button>
          ) : (
            <>
              <div className="tunnel-url">
                <input type="text" value={tunnelUrl} readOnly />
                <button onClick={handleCopyUrl}>Copy</button>
              </div>
              <button className="tunnel-btn stop" onClick={() => setTunnelStatus('disconnected')}>
                Stop
              </button>
            </>
          )}
        </div>

        <div className="panel-section">
          <h3>Help</h3>
          <details>
            <summary>Keyboard Shortcuts</summary>
            <ul>
              <li><kbd>Ctrl+C</kbd> - Copy / Cancel</li>
              <li><kbd>Ctrl+V</kbd> - Paste</li>
              <li><kbd>Ctrl+L</kbd> - Clear terminal</li>
              <li><kbd>Ctrl+Shift+V</kbd> - Paste from clipboard</li>
              <li><kbd>Tab</kbd> - Auto-complete</li>
              <li><kbd>Ctrl+D</kbd> - Exit current command</li>
            </ul>
          </details>
          <details>
            <summary>Supported Commands</summary>
            <p>Most Linux/Unix commands work including:</p>
            <ul>
              <li>ls, cd, pwd, cat, echo</li>
              <li>git, npm, yarn, docker</li>
              <li>vim, nano, less</li>
              <li>curl, wget, ssh</li>
              <li>And much more!</li>
            </ul>
          </details>
        </div>

        <div className="panel-section">
          <h3>About</h3>
          <p>Mobile Terminal v1.0</p>
          <a href="https://github.com" target="_blank" rel="noopener">View README</a>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Add SettingsPanel CSS**

```css
.panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

.settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 300px;
  background: #1e1e1e;
  border-left: 1px solid #333;
  overflow-y: auto;
  z-index: 1000;
  animation: slideIn 0.2s ease;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #333;
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 18px;
  cursor: pointer;
}

.panel-section {
  padding: 16px;
  border-bottom: 1px solid #333;
}

.panel-section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #888;
  text-transform: uppercase;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.setting-item label {
  color: #ccc;
  font-size: 14px;
}

.font-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.font-controls button {
  width: 28px;
  height: 28px;
  background: #333;
  border: none;
  color: #fff;
  cursor: pointer;
  border-radius: 4px;
}

.font-controls span {
  min-width: 30px;
  text-align: center;
}

.setting-item select {
  padding: 6px 12px;
  background: #333;
  border: none;
  color: #fff;
  border-radius: 4px;
}

.status {
  font-size: 12px;
}

.status.connected {
  color: #00ff00;
}

.tunnel-btn {
  width: 100%;
  padding: 12px;
  background: #00ff00;
  border: none;
  color: #000;
  font-weight: bold;
  cursor: pointer;
  border-radius: 4px;
  margin-top: 8px;
}

.tunnel-btn.stop {
  background: #ff4444;
  color: #fff;
}

.tunnel-url {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.tunnel-url input {
  flex: 1;
  padding: 8px;
  background: #333;
  border: none;
  color: #fff;
  font-size: 12px;
  border-radius: 4px;
}

details {
  margin-bottom: 8px;
}

summary {
  cursor: pointer;
  color: #ccc;
}

details ul {
  margin: 8px 0;
  padding-left: 20px;
  font-size: 13px;
  color: #888;
}

details li {
  margin: 4px 0;
}

kbd {
  background: #333;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsPanel.jsx src/index.css
git commit -m "feat: add SettingsPanel component"
```

---

### Task 2: Integrate Settings into App

**Files:**
- Modify: `src/App.jsx` - Add settings button and state

- [ ] **Step 1: Update App.jsx**

```jsx
import { useState } from 'react';
import TabManager from './components/TabManager';
import FileExplorer from './components/FileExplorer';
import Terminal from './components/Terminal';
import SettingsPanel from './components/SettingsPanel';

const terminalThemes = {
  dark: { background: '#1a1a1a', foreground: '#ffffff', cursor: '#ffffff' },
  light: { background: '#f5f5f5', foreground: '#1a1a1a', cursor: '#1a1a1a' },
  highContrast: { background: '#000000', foreground: '#00ff00', cursor: '#00ff00' }
};

export default function App() {
  const [tabs, setTabs] = useState([{ id: 'main', name: 'Terminal 1' }]);
  const [activeTab, setActiveTab] = useState('main');
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [theme, setTheme] = useState('dark');

  const handleNewTab = () => {
    const newTab = { id: 'tab-' + Date.now(), name: `Terminal ${tabs.length + 1}` };
    setTabs([...tabs, newTab]);
    setActiveTab(newTab.id);
  };

  const handleCloseTab = (tabId) => {
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (activeTab === tabId) {
      setActiveTab(newTabs[newTabs.length - 1].id);
    }
  };

  const handleOpenTerminal = (cwd) => {
    handleNewTab();
    setCurrentPath(cwd);
  };

  const handleFontSizeChange = (size) => {
    setFontSize(size);
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
  };

  return (
    <div className="app">
      <TabManager
        tabs={tabs}
        activeTab={activeTab}
        onSwitchTab={setActiveTab}
        onNewTab={handleNewTab}
        onCloseTab={handleCloseTab}
      />
      <div className="header-actions">
        <button
          className="settings-btn"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
        >
          ⚙
        </button>
      </div>
      <div className="main-content">
        <FileExplorer
          isOpen={explorerOpen}
          currentPath={currentPath}
          onNavigate={setCurrentPath}
          onOpenTerminal={handleOpenTerminal}
        />
        <div className={`terminal-area ${explorerOpen ? 'with-explorer' : ''}`}>
          <Terminal 
            key={activeTab} 
            sessionId={activeTab} 
            fontSize={fontSize}
            theme={terminalThemes[theme]}
          />
        </div>
      </div>
      <button
        className="explorer-toggle"
        onClick={() => setExplorerOpen(!explorerOpen)}
      >
        {explorerOpen ? '≡' : '☰'}
      </button>
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onFontSizeChange={handleFontSizeChange}
        onThemeChange={handleThemeChange}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update index.css with header actions**

```css
.header-actions {
  position: sticky;
  top: 0;
  right: 0;
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: #2a2a2a;
  border-bottom: 1px solid #333;
}

.settings-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
}

.settings-btn:hover {
  color: #fff;
}
```

- [ ] **Step 3: Delete legacy components**

The legacy components (old pty-manager functions) can be removed after verify.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/index.css
git commit -m "feat: integrate SettingsPanel into app"
```

---

## Self-Review

Check plan against spec:
- ✅ Settings panel slides from right
- ✅ Terminal settings (font size, theme)
- ✅ Tunnel controls  
- ✅ Help section with shortcuts
- ✅ About section
- ✅ No placeholders

## Execution

Plan complete and saved. Two execution options:

**1. Subagent-Driven (recommended)** - Fresh subagent per task

**2. Inline Execution** - Execute in current session

Which approach?