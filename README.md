# Mobile Terminal PWA

A full-featured, production-grade terminal accessible from mobile browsers and desktop. Built with React, xterm.js, and node-pty for real PTY emulation. Installable as a PWA or use the Electron desktop app.

> **Status**: ✅ Production-ready with proper accessibility, autofill attributes, and form labels implemented.

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

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite |
| Terminal | xterm.js + xterm-addons (fit, search, web-links) |
| Backend | Express + Socket.io |
| PTY | node-pty |
| Editor | Monaco Editor |
| Desktop | Electron (optional) |
| PWA | Manifest + Service Worker |

---

## Prerequisites

- **Node.js** 18+ (recommended: 20 LTS)
- **npm** 9+ 
- **Git** (optional)
- For Electron builds: `make`, `gcc`, `python3`, `pkg-config` (Linux build tools)

---

## Quick Start (5 minutes)

### 1. Clone & Install

```bash
cd mobile_terminal_fixed
npm install
```

### 2. Install System Dependencies

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

---

### 3. Start Development Servers

```bash
# Start both backend + frontend
npm run dev

# Or separately:
# Terminal 1: npm run server   # Backend on localhost:3000
# Terminal 2: npm run client   # Frontend on localhost:5173
```

Open http://localhost:5173 in your browser.

---

## Access from Mobile

### Option A: Local Network

1. Find your computer's local IP:
   ```bash
   hostname -I | awk '{print $1}'
   # e.g., 192.168.1.42
   ```

2. On your phone, open `http://192.168.1.42:5173`

3. **Enable CORS for mobile** (optional but recommended):
   The server binds to `localhost` by default. Edit `server/server.js` near the top:
   ```js
   const SERVER_HOST = '0.0.0.0'  // Listen on all interfaces
   ```

### Option B: Tunnel to Internet (Cloudflare Tunnel)

**Built-in (recommended):**  
Open Settings → Tunnel section → Click "Start Tunnel". The app will automatically use the correct port (5173 for dev, 5151 for production) and display the public URL + PIN.

**CLI script:**  
```bash
chmod +x tunnel.sh  # First time only
./tunnel.sh
```
Defaults to port 5173 (development). For production, use:  
```bash
PORT=5151 ./tunnel.sh
```

Both methods generate a public URL (e.g., `https://random-123.trycloudflare.com`) protected by a 6-digit PIN. See detailed tunnel setup below.

---

## Production Deployment

### Build Frontend

```bash
npm run build
```

Output goes to `dist/` directory.

### Start Production Server

```bash
npm run server
```

The server will:
- Load built frontend from `dist/`
- Start Socket.io server
- Create PTY sessions dynamically
- Serve static files automatically

**Configure port:**
```bash
PORT=8080 npm run server
```

**Enable HTTPS** (for secure tunneling):
Set `SSL_CERT` and `SSL_KEY` environment variables pointing to your certificate files.

---

### Run as System Service (Linux)

Create systemd service at `/etc/systemd/system/mobile-terminal.service`:

```ini
[Unit]
Description=Mobile Terminal
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/mobile_terminal_fixed
Environment="PATH=/usr/bin:/bin"
ExecStart=/usr/bin/node /path/to/mobile_terminal_fixed/server/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mobile-terminal
sudo systemctl start mobile-terminal
```

---

## Electron Desktop App

Build standalone desktop executables:

```bash
# Install dependencies
npm install

# Build for current platform
npm run build


# Package as desktop app
npm run build:all  # Windows + Linux .deb
# or
npm run build:win   # Windows .exe
npm run build:linux # Linux .deb
npm run build:deb   # Linux .deb same as above
```

Outputs go to `release/` folder.

**Run unpackaged:**
```bash
npm run electron
```

---

## PWA Installation

### Mobile

- **Android (Chrome)**: Open site → Tap menu → "Add to Home screen"
- **iOS (Safari)**: Open site → Tap Share → "Add to Home Screen"

### Desktop

- Chrome/Edge: Install icon appears in address bar → Click to install

---

## Tunnel Setup (Cloudflare)

### Quick Start (In-App)

1. Start the development server (`npm run dev`) or production server (`npm run server`).
2. Open Settings → Tunnel → **Start Tunnel**.
3. The app detects environment and tunnels to the correct port automatically.
4. Copy the displayed URL and PIN.
5. Open the URL on your phone; enter PIN when prompted.

### Quick Start (CLI)

```bash
./tunnel.sh
```

The script:
- Installs `cloudflared` if missing (~40 MB download)
- Starts a tunnel to `localhost:5173` by default (development frontend)
- Generates a random public URL and 6-digit PIN
- Displays the URL; copy and open it on your phone

**Production usage:**  
If you are running the built Express server (`npm run server` after `npm run build`), tunnel to port 5151 instead:
```bash
PORT=5151 ./tunnel.sh
```

### Manual Tunnel (without script)

1. Install cloudflared:
   ```bash
   # macOS
   brew install cloudflare/cloudflare/cloudflared

   # Ubuntu/Debian
   sudo apt install cloudflared

   # Windows/WSL
   # Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
   ```

2. Authenticate (one-time):
   ```bash
   cloudflared tunnel login
   ```

3. Create a named tunnel:
   ```bash
   cloudflared tunnel create mobile-terminal
   ```

4. Run the tunnel:
   - Development (Vite dev server on 5173):
     ```bash
     cloudflared tunnel --url http://localhost:5173
     ```
   - Production (Express on 5151):
     ```bash
     cloudflared tunnel --url http://localhost:5151
     ```

5. The console output will show your public `https://...` URL.

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| URL shows but not reachable | Tunnel target port not running | Ensure frontend server (5173 dev) or Express server (5151 prod) is running |
| `Timeout waiting for tunnel URL` | cloudflared not installed or blocked | Run `./tunnel.sh` to install; check firewall/antivirus |
| Connection refused | Wrong port | Set `PORT` env var correctly; use in-app Start Tunnel button for auto-detection |
| PIN not accepted | Wrong PIN or expired | In the app, check Settings → Tunnel for current PIN; restart tunnel to regenerate |

**Security:** Tunnel access is protected by a 6-digit PIN (default: `000000`). Change default PIN by editing `server/server.js` (line showing `const DEFAULT_PIN` or the hardcoded value in the verification logic). Consider setting a strong PIN in production.

---

## Project Structure

```
mobile_terminal_fixed/
├── server/
│   ├── server.js           # Express + Socket.io backend
│   └── pty-manager.js      # PTY session management (if exists)
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
│   ├── main.jsx
│   └── index.css
├── public/
│   ├── manifest.json       # PWA manifest
│   └── sw.js               # Service Worker
├── electron/
│   └── main.js             # Electron main process
├── index.html
├── vite.config.js
├── tunnel.sh               # Cloudflare Tunnel helper
├── uploads/                # Uploaded files stored here
└── dist/                   # Production build output
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5151` | Backend server port (Express). Use for production builds. |
| `FRONTEND_PORT` | `5173` | Development frontend port (Vite). Used by tunnel when `NODE_ENV !== 'production'`. |
| `TUNNEL_TARGET_PORT` | (none) | Explicitly override tunnel target port (overrides auto-detection). |
| `NODE_ENV` | `development` | Set to `production` to serve built frontend from Express. |
| `SSL_CERT` / `SSL_KEY` | (none) | Paths to SSL certificate and key for enabling HTTPS. |

---

## Configuration Files

- **`manifest.json`**: PWA manifest (name, icons, display mode)
- **`vite.config.js`**: Vite bundler configuration
- **`tunnel.sh`**: Cloudflare Tunnel automation
- **`build/`**: Electron build assets (icons)

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

---

## Security Notes

- **No authentication** by default - for personal/local use only
- **Tunnel URLs** grant access to anyone with the link + PIN
- **Persistence**: Data stored in browser localStorage (per browser)
- **Server** binds to localhost by default (edit `server.js` for network)
- **TLS**: Enable HTTPS with SSL_CERT/SSL_KEY env vars for external access

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Terminal not loading | Check both `npm run server` and `npm run client` are running |
| "Cannot find module 'node-pty'" | Run `npm install` (node-gyp toolchain may be required) |
| Commands not working | Verify your default shell (`echo $SHELL`); ensure bash/zsh/fish is installed |
| Resize issues | Rotate phone or trigger window resize event |
| PWA install prompt not showing | Use Chrome on Android or Safari on iOS; must be served over HTTPS (except localhost) |
| Import/Export not working | Check browser localStorage is enabled and not full |
| Cloudflare tunnel fails | Ensure `cloudflared` is in PATH; check `cloudflared tunnel status` |
| Build errors on Linux | Install build-essential, python3, pkg-config, and node-pty dependencies |

---

## Customization

### Add New Themes

Edit `src/components/SettingsPanel.jsx` → `THEMES` object:

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

### Change Default Font Size

Edit `src/components/Terminal.jsx:23` or change in Settings panel (saved to localStorage).

### Modify Mobile Keyboard Layout

Edit `src/components/MobileKeyboard.jsx` (not shown in this snippet) to add/remove keys.

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/file/read` | POST | Read file content (JSON body: `{path}`) |
| `/api/file/write` | POST | Write file content (JSON body: `{path, content}`) |
| `/api/tunnel/status` | GET | Tunnel running status |
| `/api/tunnel/verify` | POST | Verify PIN (body: `{pin}`) |
| `/api/tunnel/verify-token` | POST | Verify session token |

---

## Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch
3. Test on both desktop and mobile
4. Submit Pull Request with clear description

**Code style:** ESLint + Prettier (if configured), follow existing patterns.

---

## License

MIT - see LICENSE file for details.

---

## Acknowledgments

- [xterm.js](https://xtermjs.org) - Best-in-class terminal emulation
- [node-pty](https://github.com/microsoft/node-pty) - Native PTY bindings
- [Socket.io](https://socket.io) - Reliable WebSockets with fallbacks
- [React](https://react.dev) + [Vite](https://vitejs.dev) - Fast, modern tooling
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - VS Code's editor core
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) - Secure public exposure

---

## Roadmap

- [ ] Authentication layer (basic auth, JWT)
- [ ] Session persistence (save open tabs)
- [ ] Multi-user support (namespaces)
- [ ] SCP/SFTP file transfer
- [ ] Terminal recording/playback
- [ ] Plugin system
- [ ] Windows/macOS native builds (beyond Electron)
- [ ] Terminal themes marketplace

---

**Built with ❤️ for mobile DevOps, sysadmins, and developers who need terminal access on the go.**
