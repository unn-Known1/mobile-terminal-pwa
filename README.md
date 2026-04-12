# Mobile Terminal

<p align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub Stars](https://img.shields.io/github/stars/unn-Known1/mobile-terminal?style=social)](https://github.com/unn-Known1/mobile-terminal/stargazers)
[![Electron](https://img.shields.io/badge/Electron-4.0+-blueviolet)](https://www.electronjs.org)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)

</p>

A full-featured, production-grade terminal accessible from mobile browsers and desktop. Built with React, xterm.js, and node-pty for real PTY emulation. Installable as a PWA or use the Electron desktop app.

> **Status**: ✅ Production-ready with proper accessibility, autofill attributes, and form labels implemented.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Theme Customization](#theme-customization)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Full terminal emulation** via xterm.js with true PTY support
- **Real shell access** using node-pty (bash, zsh, fish, etc.)
- **Multi-session support** - each browser tab opens a new shell
- **PWA installable** - add to home screen for native app experience
- **Mobile-optimized UI** - responsive design with on-screen keyboard
- **File explorer** - browse, upload, download, rename files (desktop browsers only)
- **Tunnel integration** - access from anywhere via Cloudflare Tunnel
- **Settings sync** - export/import configuration via JSON
- **Command shortcuts** - customize keyboard shortcuts
- **Multiple themes** - 12+ beautiful color schemes
- **Code editor** - edit files with Monaco Editor
- **Notifications** - alerts for long-running commands, failed commands, etc.

---

## Quick Start

### Prerequisites

- **Node.js** 18+ (recommended: 20 LTS)
- **npm** 9+
- For Electron builds: `make`, `gcc`, `python3`, `pkg-config` (Linux build tools)

### Installation

```bash
git clone https://github.com/unn-Known1/mobile-terminal.git
cd mobile-terminal
npm install
```

### Start Development

```bash
# Start both backend + frontend
npm run dev

# Or separately:
# Terminal 1: npm run server   # Backend on localhost:3000
# Terminal 2: npm run client   # Frontend on localhost:5173
```

Open http://localhost:5173 in your browser.

### Access from Mobile

1. Find your computer's IP: `hostname -I | awk '{print $1}'`
2. On your phone, open `http://YOUR_IP:5173`
3. Or use the built-in tunnel: Settings → Tunnel → Start Tunnel

---

## Architecture

```
mobile-terminal/
├── server/
│   ├── server.js           # Express + Socket.io backend
│   └── pty-manager.js      # PTY session management
├── src/
│   ├── components/
│   │   ├── Terminal.jsx    # xterm.js wrapper
│   │   ├── SettingsPanel.jsx
│   │   ├── FileExplorer.jsx
│   │   ├── TabManager.jsx
│   │   └── CodeEditor.jsx  # Monaco editor
│   ├── hooks/
│   │   └── useSocket.js
│   ├── App.jsx
│   └── main.jsx
├── electron/
│   └── main.js             # Electron main process
├── public/
│   ├── manifest.json       # PWA manifest
│   └── sw.js               # Service Worker
└── index.html
```

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite |
| Terminal | xterm.js + xterm-addons |
| Backend | Express + Socket.io |
| PTY | node-pty |
| Editor | Monaco Editor |
| Desktop | Electron |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` / `Cmd+C` | Copy selected text / Cancel |
| `Ctrl+D` / `Cmd+D` | Send EOF / Exit |
| `Ctrl+L` / `Cmd+L` | Clear terminal |
| `Ctrl+Z` / `Cmd+Z` | Suspend process |
| `Ctrl+F` / `Cmd+F` | Search in terminal |
| `Tab` | Auto-complete |
| `↑ / ↓` | History navigation |

Mobile: On-screen keyboard toolbar with ESC, TAB, arrows, ^C, ^D, and symbol row.

See [KEYBOARD_SHORTCUTS.md](docs/KEYBOARD_SHORTCUTS.md) for the complete reference.

---

## Theme Customization

Add new themes by editing `src/components/SettingsPanel.jsx` → `THEMES` object:

```js
const THEMES = {
  myTheme: {
    label: 'My Theme',
    background: '#0a0a0a',
    foreground: '#e0e0e0',
    cursor: '#00ff00'
  }
}
```

---

## Development

See [DEVELOPMENT.md](docs/DEVELOPMENT.md) for the complete development guide.

### Install System Dependencies

**macOS:**
```bash
xcode-select --install
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y build-essential python3 pkg-config libx11-dev libxext-dev libxss-dev libglib2.0-dev libnss3-dev libasound2-dev
```

**Fedora:**
```bash
sudo dnf groupinstall "Development Tools"
sudo dnf install python3 pkg-config libX11-devel libXext-devel libXss-devel glib2-devel nss-devel alsa-lib-devel
```

### Build Commands

```bash
npm run dev          # Start development
npm run build        # Build frontend
npm run server       # Start production server
npm run electron     # Run Electron app
npm run build:linux  # Build Linux .deb
npm run build:win    # Build Windows .exe
```

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

- 🍴 Fork the repo
- 🌋 Create a feature branch
- ✅ Test on both desktop and mobile
- 📝 Submit a Pull Request

**Good first issues:**
- [Add dark theme option](https://github.com/unn-Known1/mobile-terminal/labels/good%20first%20issue)
- [Document custom key bindings](https://github.com/unn-Known1/mobile-terminal/labels/enhancement)

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for mobile DevOps, sysadmins, and developers who need terminal access on the go.**