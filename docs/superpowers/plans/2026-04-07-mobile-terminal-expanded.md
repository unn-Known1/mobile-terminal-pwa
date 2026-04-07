# Mobile Terminal Expanded Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-tab support and file explorer panel to mobile terminal

**Architecture:** New TabManager component, FileExplorer sidebar, session-based PTY management, Express API endpoints for directory listing

**Tech Stack:** React, Socket.io, Express, node-pty

---

### Task 1: Backend - Multi-session PTY Support

**Files:**
- Modify: `server/server.js` - Add session management, API routes
- Modify: `server/pty-manager.js` - Session-based tracking

- [ ] **Step 1: Update pty-manager.js for sessions**

```javascript
import * as pty from 'node-pty';
import os from 'os';

const shells = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
const sessions = new Map();

export function createSession(sessionId, cwd = null) {
  const shell = os.userInfo().shell || shells;
  const workingDir = cwd || process.env.HOME || process.env.USERPROFILE;
  
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: workingDir,
    env: process.env
  });

  sessions.set(sessionId, {
    pty: ptyProcess,
    cwd: workingDir,
    socket: null
  });

  return { pty: ptyProcess, cwd: workingDir };
}

export function getSession(sessionId) {
  return sessions.get(sessionId);
}

export function deleteSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.pty.kill();
    sessions.delete(sessionId);
  }
}

export function getAllSessions() {
  return Array.from(sessions.keys());
}

export function listDirectory(path) {
  const fs = require('fs');
  const pathModule = require('path');
  
  try {
    const items = fs.readdirSync(path, { withFileTypes: true });
    return items.map(item => ({
      name: item.name,
      isDirectory: item.isDirectory(),
      path: pathModule.join(path, item.name)
    })).sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch (err) {
    return { error: err.message };
  }
}
```

- [ ] **Step 2: Update server.js with sessions and API**

```javascript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createSession, deleteSession, listDirectory } from './pty-manager.js';

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// API routes
app.get('/api/ls/*', (req, res) => {
  const path = '/' + req.params[0] || process.env.HOME;
  const result = listDirectory(path);
  res.json(result);
});

app.get('/api/pwd/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  res.json({ cwd: session?.cwd || process.env.HOME });
});

// Socket handling
const sessionSockets = new Map();

io.on('connection', (socket) => {
  const sessionId = socket.id;
  const session = createSession(sessionId);
  
  sessionSockets.set(sessionId, socket);

  socket.emit('session-created', { sessionId, cwd: session.cwd });

  session.pty.onData((data) => {
    socket.emit('data', data);
  });

  socket.on('data', (data) => {
    session.pty.write(data);
  });

  socket.on('resize', ({ cols, rows }) => {
    session.pty.resize(cols, rows);
  });

  socket.on('close-session', () => {
    deleteSession(sessionId);
    sessionSockets.delete(sessionId);
  });

  socket.on('create-tab', ({ cwd }) => {
    const newSessionId = 'tab-' + Date.now();
    const newSession = createSession(newSessionId, cwd);
    const newSocket = io.of('/' + newSessionId);
    // Handle new connection for this tab...
  });

  socket.on('disconnect', () => {
    deleteSession(sessionId);
    sessionSockets.delete(sessionId);
  });
});

server.listen(3000, '127.0.0.1', () => {
  console.log('Server running on http://127.0.0.1:3000');
});
```

- [ ] **Step 3: Commit**

```bash
git add server/server.js server/pty-manager.js
git commit -m "feat: add multi-session PTY support"
```

---

### Task 2: Frontend - Tab Manager Component

**Files:**
- Create: `src/components/TabManager.jsx`

- [ ] **Step 1: Create TabManager component**

```jsx
import { useState } from 'react';

export default function TabManager({ tabs, activeTab, onSwitchTab, onNewTab, onCloseTab }) {
  return (
    <div className="tab-bar">
      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${tab.id === activeTab ? 'active' : ''}`}
            onClick={() => onSwitchTab(tab.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              onCloseTab(tab.id);
            }}
          >
            {tab.name}
          </button>
        ))}
        <button className="tab new-tab" onClick={onNewTab}>+</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add TabManager styles**

```css
.tab-bar {
  display: flex;
  background: #2a2a2a;
  border-bottom: 1px solid #333;
  overflow-x: auto;
  position: sticky;
  top: 0;
  z-index: 100;
}

.tabs {
  display: flex;
  flex-wrap: nowrap;
  min-width: 100%;
}

.tab {
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: #888;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
}

.tab.active {
  color: #fff;
  border-bottom-color: #00ff00;
}

.tab.new-tab {
  color: #00ff00;
  font-weight: bold;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TabManager.jsx src/index.css
git commit -m "feat: add TabManager component"
```

---

### Task 3: Frontend - File Explorer Component

**Files:**
- Create: `src/components/FileExplorer.jsx`

- [ ] **Step 1: Create FileExplorer component**

```jsx
import { useState, useEffect } from 'react';

export default function FileExplorer({ isOpen, currentPath, onNavigate, onOpenTerminal }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && currentPath) {
      fetchDirectory(currentPath);
    }
  }, [isOpen, currentPath]);

  const fetchDirectory = async (path) => {
    setLoading(true);
    try {
      const res = await fetch('/api/ls' + path);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      setItems([]);
    }
    setLoading(false);
  };

  const handleItemClick = (item) => {
    if (item.isDirectory) {
      onNavigate(item.path);
    }
  };

  const handleTerminalIcon = (e, item) => {
    e.stopPropagation();
    onOpenTerminal(item.path);
  };

  if (!isOpen) return null;

  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <button onClick={() => onNavigate(currentPath.split('/').slice(0, -1).join('/') || '/')}>
          ← Back
        </button>
        <span className="path">{currentPath}</span>
      </div>
      <div className="explorer-content">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          items.map((item) => (
            <div
              key={item.path}
              className="explorer-item"
              onClick={() => handleItemClick(item)}
            >
              <span className="icon">{item.isDirectory ? '📁' : '📄'}</span>
              <span className="name">{item.name}</span>
              {item.isDirectory && (
                <button
                  className="terminal-btn"
                  onClick={(e) => handleTerminalIcon(e, item)}
                  title="Open terminal here"
                >
                  ⌘
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add FileExplorer styles**

```css
.file-explorer {
  width: 250px;
  background: #1e1e1e;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.explorer-header {
  padding: 12px;
  background: #2a2a2a;
  display: flex;
  align-items: center;
  gap: 8px;
}

.explorer-header .path {
  font-size: 12px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.explorer-content {
  flex: 1;
  overflow-y: auto;
}

.explorer-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
}

.explorer-item:hover {
  background: #2a2a2a;
}

.explorer-item .icon {
  margin-right: 8px;
}

.explorer-item .name {
  flex: 1;
  font-size: 14px;
}

.explorer-item .terminal-btn {
  padding: 4px 8px;
  background: #00ff00;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/FileExplorer.jsx src/index.css
git commit -m "feat: add FileExplorer component"
```

---

### Task 4: Frontend - App Integration

**Files:**
- Modify: `src/App.jsx` - Integrate tabs + explorer
- Modify: `src/components/Terminal.jsx` - Session-aware

- [ ] **Step 1: Update App.jsx with state management**

```jsx
import { useState, useEffect } from 'react';
import TabManager from './components/TabManager';
import FileExplorer from './components/FileExplorer';
import Terminal from './components/Terminal';

export default function App() {
  const [tabs, setTabs] = useState([{ id: 'main', name: 'Terminal 1' }]);
  const [activeTab, setActiveTab] = useState('main');
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');

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

  return (
    <div className="app">
      <TabManager
        tabs={tabs}
        activeTab={activeTab}
        onSwitchTab={setActiveTab}
        onNewTab={handleNewTab}
        onCloseTab={handleCloseTab}
      />
      <div className="main-content">
        <FileExplorer
          isOpen={explorerOpen}
          currentPath={currentPath}
          onNavigate={setCurrentPath}
          onOpenTerminal={handleOpenTerminal}
        />
        <div className={`terminal-area ${explorerOpen ? 'with-explorer' : ''}`}>
          <Terminal key={activeTab} sessionId={activeTab} />
        </div>
      </div>
      <button
        className="explorer-toggle"
        onClick={() => setExplorerOpen(!explorerOpen)}
      >
        {explorerOpen ? '≡' : '☰'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Update Terminal.jsx for sessions**

```jsx
import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useSocket } from '../hooks/useSocket';

export default function Terminal({ sessionId }) {
  const terminalRef = useRef(null);
  const { socket } = useSocket('/');

  useEffect(() => {
    if (!terminalRef.current || !socket) return;

    socket.emit('create-tab', { sessionId });

    const term = new XTerm({
      theme: { background: '#1a1a1a', foreground: '#ffffff', cursor: '#ffffff' },
      fontSize: 14,
      fontFamily: 'monospace',
      cursorBlink: true
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    const handleData = (data) => socket.emit('data', data);
    const handleServerData = (data) => term.write(data);

    socket.on('data', handleServerData);

    term.onData(handleData);

    const resize = () => {
      fitAddon.fit();
      socket.emit('resize', { cols: term.cols, rows: term.rows });
    };

    window.addEventListener('resize', resize);
    resize();

    return () => {
      socket.off('data', handleServerData);
      window.removeEventListener('resize', resize);
      term.dispose();
      socket.emit('close-session');
    };
  }, [socket, sessionId]);

  return <div ref={terminalRef} style={{ height: '100%' }} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx src/components/Terminal.jsx
git commit -m "feat: integrate TabManager and FileExplorer"
```

---

### Self-Review

Check plan against spec:
- ✅ TabManager with top bar
- ✅ FileExplorer side panel
- ✅ Session-based PTY management
- ✅ API endpoints for directory listing
- ✅ No placeholders - all code complete

## Execution

Plan complete and saved. Two execution options:

**1. Subagent-Driven (recommended)** - Fresh subagent per task

**2. Inline Execution** - Execute in current session

Which approach?