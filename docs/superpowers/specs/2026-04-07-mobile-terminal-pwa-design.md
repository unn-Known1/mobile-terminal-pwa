# Mobile Terminal PWA - Design Specification

## Overview

A Progressive Web App that provides full terminal capability accessible from mobile browsers. Runs on Linux only, using Express + node-pty + Socket.io backend with React + xterm.js frontend.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Frontend (React)               │
│  ┌─────────┐  ┌──────────┐  ┌────────────────┐ │
│  │ xterm.js│◄─┤Terminal │◄─┤Socket.io-    │ │
│  └─────────┘  │Component│  │Client        │ │
│              └─────────┘  └────────┬───────┘ │
└─────────────────────────────────────┼─────────┘
                                      │ WebSocket
┌─────────────────────────────────────┼─────────┐
│                  Backend (Express)   │         │
│  ┌──────────────┐  ┌─────────┐  ┌──▼───────┐ │
│  │   Server    │◄─┤Socket.io│◄─┤ node-pty │ │
│  └──────────────┘  │Handler │  └─────────┘ │
│                    └─────────┘              │
└─────────────────────────────────────────────┘
                     │
              ┌──────▼──────┐
              │  /bin/bash  │
              │  (shell)    │
              └─────────────┘
```

## Components

### Backend
- `server.js` — Express + Socket.io server on port 3000
- `pty-manager.js` — Manages PTY process per socket connection

### Frontend
- `App.jsx` — Main component managing socket connection and tab sessions
- `Terminal.jsx` — xterm.js wrapper with resize handling
- `useSocket.js` — Custom hook for socket state management
- `sw.js` — Service worker for offline/cache support
- `manifest.json` — PWA manifest for home screen shortcut

## Data Flow

1. Browser connects to `ws://localhost:3000`
2. Server spawns `/bin/bash` via `node-pty`
3. Client → Server: keystrokes sent via socket, PTY writes to shell
4. Server → Client: PTY data emitted to socket, xterm.js displays
5. Window/tab close → socket disconnect → PTY process killed

## Multiple Sessions

Each browser tab creates its own independent PTY session. Closing a tab kills its associated shell process.

## PWA Features

- Service worker caches: index.html, bundle.js, xterm.css, xterm.js
- Manifest includes: icons (192x192, 512x512), theme_color, display: standalone
- Works offline after first load (terminal won't work offline, but UI loads)

## Error Handling

- Socket disconnect: log + kill associated PTY process
- PTY exit: emit "exit" event, show reconnect option
- Connection fail: show "trying to reconnect..." with exponential backoff

## Security

- Localhost-only access (127.0.0.1)
- No authentication required
- For personal use on trusted networks only