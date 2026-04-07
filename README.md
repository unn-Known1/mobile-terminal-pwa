# Mobile Terminal PWA

A full-featured terminal accessible from mobile browsers. Add to home screen for a native app experience.

## Features

- Full terminal emulation via xterm.js
- Real shell access via node-pty
- PWA support - add to home screen
- Multiple sessions (each browser tab = new shell)
- Mobile-optimized UI

## Quick Start

### 1. Start the server

```bash
# Terminal 1: Start backend
npm run server

# Terminal 2: Start frontend
npm run client
```

### 2. Access locally

Open http://localhost:5173 in your browser

### 3. Access from mobile

#### Option A: Local network
1. Find your computer's IP:
   ```bash
   hostname -I | awk '{print $1}'
   ```
2. Open `http://<YOUR-IP>:5173` on your phone

#### Option B: Tunnel to internet (cloudflared)

```bash
./tunnel.sh
```

This creates a temporary public URL. Open it on your phone to access your terminal from anywhere.

## Usage

- Type commands just like in a regular terminal
- Supports most terminal programs (vim, nano, git, etc.)
- Each browser tab opens a new shell session
- Close browser tab to end that session

## Security Notes

- Server binds to localhost only by default
- For network access, ensure your network is trusted
- Tunnel URL grants access to anyone with the link
- No authentication - for personal use only

## Troubleshooting

- **Terminal not loading**: Make sure both server and client are running
- **Commands not working**: Check shell is bash (`echo $SHELL`)
- **Resize issues**: Rotate your phone to trigger resize
- **PWA not prompt**: Use Chrome on Android, Safari on iOS

## Made with

- [xterm.js](https://xtermjs.org) - Terminal emulator
- [node-pty](https://github.com/microsoft/node-pty) - PTY management
- [Socket.io](https://socket.io) - Real-time communication
- [React](https://react.dev) - UI framework