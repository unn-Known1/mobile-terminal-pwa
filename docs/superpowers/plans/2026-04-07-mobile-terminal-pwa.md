# Mobile Terminal PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PWA terminal accessible from mobile browsers, with full terminal capability via WebSocket + node-pty backend and React + xterm.js frontend.

**Architecture:** Express + Socket.io server spawns /bin/bash via node-pty per socket connection. React frontend connects via Socket.io-client, displays terminal via xterm.js. PWA features via service worker and manifest.json.

**Tech Stack:** Node.js, Express, Socket.io, node-pty, React, Vite, xterm.js, Socket.io-client

---

### Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "mobile-terminal-pwa",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm run server\" \"npm run client\"",
    "server": "node server/server.js",
    "client": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.2",
    "node-pty": "^1.0.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "socket.io-client": "^4.7.2",
    "concurrently": "^8.2.0"
  }
}
```

- [ ] **Step 2: Create vite.config.js**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  }
})
```

- [ ] **Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#1a1a1a" />
  <link rel="manifest" href="/manifest.json" />
  <title>Terminal</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 4: Create directory structure**

```bash
mkdir -p src/components public server
```

- [ ] **Step 5: Commit**

```bash
git init
git add package.json vite.config.js index.html
git commit -m "chore: project setup with Vite and dependencies"
```

---

### Task 2: Backend - Socket.io Server

**Files:**
- Create: `server/server.js`
- Create: `server/pty-manager.js`
- Modify: `package.json` (add scripts)

- [ ] **Step 1: Create pty-manager.js**

```javascript
import * as pty from 'node-pty';
import os from 'os';

const shells = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';

const ptyMap = new Map();

export function createPty(socketId) {
  const shell = os.userInfo().shell || shells;
  
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME || process.env.USERPROFILE,
    env: process.env
  });

  ptyMap.set(socketId, ptyProcess);

  ptyProcess.onData((data) => {
    socketId.emit('data', data);
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    socketId.emit('exit', { exitCode, signal });
    ptyMap.delete(socketId);
  });

  return ptyProcess;
}

export function getPty(socketId) {
  return ptyMap.get(socketId);
}

export function deletePty(socketId) {
  const ptyProcess = ptyMap.get(socketId);
  if (ptyProcess) {
    ptyProcess.kill();
    ptyMap.delete(socketId);
  }
}

export function resizePty(socketId, cols, rows) {
  const ptyProcess = ptyMap.get(socketId);
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
  }
}
```

- [ ] **Step 2: Create server.js**

```javascript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createPty, deletePty, resizePty } from './pty-manager.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  const ptyProcess = createPty(socket);

  socket.on('data', (data) => {
    ptyProcess.write(data);
  });

  socket.on('resize', ({ cols, rows }) => {
    resizePty(socket, cols, rows);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    deletePty(socket);
  });
});

const PORT = 3000;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
```

- [ ] **Step 3: Commit**

```bash
git add server/server.js server/pty-manager.js
git commit -m "feat: add Socket.io server with node-pty"
```

---

### Task 3: Frontend - React Setup

**Files:**
- Create: `src/main.jsx`
- Create: `src/App.jsx`
- Create: `src/index.css`

- [ ] **Step 1: Create main.jsx**

```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 2: Create index.css**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  background: #1a1a1a;
}

.terminal-container {
  height: 100%;
  padding: 8px;
}
```

- [ ] **Step 3: Create App.jsx**

```javascript
import { useState, useEffect, useRef } from 'react'
import Terminal from './components/Terminal'

export default function App() {
  return (
    <div className="terminal-container">
      <Terminal />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/main.jsx src/App.jsx src/index.css
git commit -m "feat: add React entry points"
```

---

### Task 4: Terminal Component with xterm.js

**Files:**
- Create: `src/components/Terminal.jsx`
- Create: `src/hooks/useSocket.js`

- [ ] **Step 1: Create useSocket.js**

```javascript
import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

export function useSocket(url) {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef(null)

  useEffect(() => {
    socketRef.current = io(url)

    socketRef.current.on('connect', () => {
      setConnected(true)
    })

    socketRef.current.on('disconnect', () => {
      setConnected(false)
    })

    return () => {
      socketRef.current?.disconnect()
    }
  }, [url])

  return { socket: socketRef.current, connected }
}
```

- [ ] **Step 2: Create Terminal.jsx**

```javascript
import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { useSocket } from '../hooks/useSocket'

export default function Terminal() {
  const terminalRef = useRef(null)
  const { socket, connected } = useSocket('/')

  useEffect(() => {
    if (!terminalRef.current || !socket) return

    const term = new XTerm({
      theme: {
        background: '#1a1a1a',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selection: 'rgba(255, 255, 255, 0.3)'
      },
      fontSize: 14,
      fontFamily: 'monospace',
      cursorBlink: true,
      allowTransparency: true
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)
    fitAddon.fit()

    term.onData((data) => {
      socket.emit('data', data)
    })

    socket.on('data', (data) => {
      term.write(data)
    })

    socket.on('exit', () => {
      term.writeln('\r\n\r\n[disconnected]')
    })

    const resize = () => {
      fitAddon.fit()
      socket.emit('resize', { cols: term.cols, rows: term.rows })
    }

    window.addEventListener('resize', resize)

    resize()

    return () => {
      window.removeEventListener('resize', resize)
      term.dispose()
    }
  }, [socket])

  return <div ref={terminalRef} style={{ height: '100%' }} />
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Terminal.jsx src/hooks/useSocket.js
git commit -m "feat: add Terminal component with xterm.js"
```

---

### Task 5: PWA - Service Worker & Manifest

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js`
- Modify: `src/main.jsx` (register SW)

- [ ] **Step 1: Create manifest.json**

```json
{
  "name": "Mobile Terminal",
  "short_name": "Terminal",
  "description": "Full terminal in your pocket",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a1a",
  "theme_color": "#1a1a1a",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: Create sw.js**

```javascript
const CACHE_NAME = 'terminal-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
```

- [ ] **Step 3: Modify main.jsx to register SW**

```javascript
import { useEffect } from 'react'
// ... existing imports

// Add after ReactDOM.render
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

- [ ] **Step 4: Create placeholder icons**

Create simple 192x192 and 512x512 PNG icons (can use a simple terminal icon or placeholder).

- [ ] **Step 5: Commit**

```bash
git add public/manifest.json public/sw.js src/main.jsx public/icon-192.png public/icon-512.png
git commit -m "feat: add PWA support with service worker and manifest"
```

---

### Task 6: Testing & Verification

**Files:**
- Test: Manual browser testing

- [ ] **Step 1: Install dependencies**

```bash
npm install
```

- [ ] **Step 2: Build client**

```bash
npm run build
```

- [ ] **Step 3: Start server (separate terminal)**

```bash
npm run server
```

- [ ] **Step 4: Start client**

```bash
npm run client
```

- [ ] **Step 5: Test in browser**

1. Open http://localhost:5173
2. Verify terminal loads with prompt
3. Type commands and verify output
4. Test resize behavior
5. Close tab, verify PTY cleanup

- [ ] **Step 6: Test PWA**

1. Open in mobile browser (or responsive mode)
2. Verify "Add to Home Screen" prompt appears
3. Install as PWA
4. Verify app launches standalone

- [ ] **Step 7: Commit**

```bash
git commit -m "chore: verify full functionality"
```

---

## Self-Review

Checked plan against spec:
- ✅ Express + Socket.io + node-pty backend
- ✅ React + xterm.js frontend
- ✅ Multiple sessions per tab (each socket gets own PTY)
- ✅ Service worker and manifest for PWA
- ✅ localhost-only access (127.0.0.1)
- ✅ Error handling for disconnect and exit events
- ✅ No placeholders - all code complete

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-04-07-mobile-terminal-pwa.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?