# Mobile Terminal

<p align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub Stars](https://img.shields.io/github/stars/unn-Known1/mobile-terminal?style=social)](https://github.com/unn-Known1/mobile-terminal/stargazers)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)

</p>

A full-featured, production-grade terminal accessible from any browser. Built with React, xterm.js, and node-pty for real PTY emulation. Deploy in seconds with Cloudflare Tunnel.

---

## One-Command Deployment

Deploy your terminal with a single command and access it from anywhere:

```bash
curl -sL https://raw.githubusercontent.com/unn-Known1/mobile-terminal/main/install.sh | bash
```

**What happens:**
1. Installs cloudflared (if not present)
2. Clones the repository
3. Installs dependencies
4. Builds the frontend
5. Starts the server with Cloudflare Tunnel
6. Shows your live URL

**Alternative - Git Clone & Run:**
```bash
git clone https://github.com/unn-Known1/mobile-terminal.git
cd mobile-terminal
npm install
npm run build
./tunnel.sh
```

---

## Features

- Full terminal emulation via xterm.js with true PTY support
- Real shell access using node-pty (bash, zsh, fish, etc.)
- **Multi-tab terminal support** - multiple terminals in one browser
- **Cloudflare Tunnel** - access from anywhere, no port forwarding needed
- PWA installable - add to home screen for native app experience
- Mobile-optimized UI - responsive design with on-screen keyboard
- File explorer - browse, upload, download, rename files
- PIN-protected access (optional)
- Multiple themes - 12+ beautiful color schemes
- Code editor - edit files with Monaco Editor
- Works in any modern browser

---

## Quick Start

### Prerequisites

- **Node.js** 18+ (recommended: 20 LTS)
- **npm** 9+
- **Git**

### One-Command Install (Recommended)

```bash
curl -sL https://raw.githubusercontent.com/unn-Known1/mobile-terminal/main/install.sh | bash
```

### Manual Installation

```bash
git clone https://github.com/unn-Known1/mobile-terminal.git
cd mobile-terminal
npm install
npm run build
./tunnel.sh
```

### Development Mode

```bash
git clone https://github.com/unn-Known1/mobile-terminal.git
cd mobile-terminal
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Using Cloudflare Tunnel

```bash
# After installation, run:
./tunnel.sh

# Or with custom port:
PORT=3000 ./tunnel.sh
```

---

## Cloudflare Tunnel Setup

The project includes automatic Cloudflare Tunnel support. When you run `./tunnel.sh`:

1. cloudflared is automatically installed (if not present)
2. A secure tunnel is created to your local server
3. You receive a unique URL (e.g., `https://xxxx.trycloudflare.com`)
4. Access your terminal from any device with just that URL!

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      Cloudflare                              │
│                                                             │
│   ┌─────────────┐      ┌──────────────┐      ┌──────────┐  │
│   │   You       │ ───> │ trycloudflare│ ───> │ Your     │  │
│   │   Phone     │      │    .com      │      │ Server   │  │
│   └─────────────┘      └──────────────┘      └──────────┘  │
│                                                     │       │
│                                              ┌─────────────┐ │
│                                              │  Mobile     │ │
│                                              │  Terminal   │ │
│                                              └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

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
│   │   ├── SplitTerminal.jsx
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
├── install.sh              # One-command installer
├── tunnel.sh               # Cloudflare tunnel launcher
└── package.json
```

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite |
| Terminal | xterm.js |
| Backend | Express + Socket.io |
| PTY | node-pty |
| Editor | Monaco Editor |
| Tunnel | Cloudflare Tunnel |
| Desktop | Electron |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Copy selected text / Cancel |
| `Ctrl+D` | Send EOF / Exit |
| `Ctrl+L` | Clear terminal |
| `Ctrl+Z` | Suspend process |
| `Ctrl+F` | Search in terminal |
| `Tab` | Auto-complete |
| `↑ / ↓` | History navigation |

Mobile: On-screen keyboard toolbar with ESC, TAB, arrows, ^C, ^D, and symbol row.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5173` | Server port |
| `SHELL` | `/bin/bash` | Default shell |

### Custom Shell

```bash
SHELL=/bin/zsh ./tunnel.sh
```

---

## Security

- Access is restricted to your browser only via Cloudflare
- Optional PIN protection available in settings
- No data leaves your server (self-hosted)
- All communication is encrypted via HTTPS

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for mobile DevOps, sysadmins, and developers who need terminal access on the go.**
