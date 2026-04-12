# Development Guide

This guide covers how to set up your development environment and contribute to Mobile Terminal.

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 18+ | 20 LTS recommended |
| npm | 9+ | Comes with Node.js |
| Git | Any | For version control |
| Build tools | - | See platform-specific below |

### System Dependencies

**macOS:**
```bash
xcode-select --install  # Command Line Tools
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

**Windows:**
Use WSL2 (Windows Subsystem for Linux) or install Visual Studio Build Tools with C++ workload.

## Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/unn-Known1/mobile-terminal.git
   cd mobile-terminal
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development servers:**
   ```bash
   npm run dev
   ```
   
   This starts:
   - Backend: http://localhost:3000
   - Frontend: http://localhost:5173

   Or run them separately:
   ```bash
   npm run server   # Terminal 1
   npm run client  # Terminal 2
   ```

## Project Structure

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
│   │   └── CodeEditor.jsx
│   ├── hooks/
│   │   └── useSocket.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── electron/
│   └── main.js
├── public/
│   ├── manifest.json
│   └── sw.js
└── package.json
```

## Development Workflow

### Creating a Feature

1. Create a new branch:
   ```bash
   git checkout -b feature/my-feature
   ```

2. Make your changes

3. Test on both desktop and mobile browsers

4. Commit and push:
   ```bash
   git add .
   git commit -m "feat: add my feature"
   git push -u origin feature/my-feature
   ```

5. Open a Pull Request

### Running Tests

Currently there are no automated tests. To manually test:

1. Test on desktop Chrome/Firefox/Safari
2. Test on mobile (use tunnel or local network)
3. Test PWA installation
4. Test Electron desktop app: `npm run electron`

### Building

```bash
# Build frontend
npm run build

# Start production server
npm run server

# Build Electron app
npm run build:linux   # Linux .deb
npm run build:win     # Windows .exe
npm run build:all    # All platforms
```

## Code Style

- Use functional components with hooks
- Follow existing naming conventions
- Add meaningful comments for complex logic
- Keep components focused and single-purpose

## Common Issues

| Issue | Solution |
|-------|----------|
| `Cannot find module 'node-pty'` | Run `npm install` - requires build toolchain |
| Terminal not loading | Check both server and client are running |
| Build errors on Linux | Install build dependencies listed above |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5151` | Production server port |
| `FRONTEND_PORT` | `5173` | Development frontend port |
| `NODE_ENV` | `development` | Set to `production` for prod |

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed contributing guidelines.

---

Questions? Open an issue at https://github.com/unn-Known1/mobile-terminal/issues