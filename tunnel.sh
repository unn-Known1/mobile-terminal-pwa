#!/bin/bash
# Mobile Terminal - Cloudflare Tunnel Launcher
# Usage: ./tunnel.sh
# Or: PORT=3000 ./tunnel.sh

set -e

# Use absolute paths for safety
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLOUDFLARED="$HOME/.cloudflared/cloudflared"
SERVER_PORT=${PORT:-5173}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${BLUE}[MobileTerminal]${NC} $1"; }
success() { echo -e "${GREEN}[READY]${NC} $1"; }

install_cloudflared() {
    log "Installing cloudflared..."
    mkdir -p "$HOME/.cloudflared"

    # Verify directory is within HOME (safety check)
    case "$HOME/.cloudflared" in
        "$HOME"*)
            ;;
        *)
            echo "Error: Cloudflared directory outside HOME. Aborting for safety."
            exit 1
            ;;
    esac

    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64) FILE="cloudflared-linux-amd64" ;;
        aarch64|arm64) FILE="cloudflared-linux-arm64" ;;
        *) FILE="cloudflared-linux-amd64" ;;
    esac

    log "Downloading cloudflared for $ARCH..."

    # Download with retry logic and error handling
    if ! curl -fsSL --retry 3 --retry-delay 2 \
        "https://github.com/cloudflare/cloudflared/releases/latest/download/$FILE" \
        -o "$CLOUDFLARED" 2>/dev/null; then
        log "Error: Failed to download cloudflared"
        exit 1
    fi
    chmod +x "$CLOUDFLARED"
    success "cloudflared installed"
}

# Change to script directory (safety)
cd "$SCRIPT_DIR"

# Check if cloudflared exists
if [ ! -f "$CLOUDFLARED" ]; then
    install_cloudflared
fi

# Check if dist folder exists (build needed)
if [ ! -d "dist" ]; then
    log "Frontend not built. Running npm run build..."
    npm run build
fi

log "Starting Mobile Terminal on port $SERVER_PORT..."
log "Starting server in background..."

# Start the production server
PORT=$SERVER_PORT npm run server > /tmp/mobile-terminal.log 2>&1 &
SERVER_PID=$!

# Verify server started
sleep 2
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    log "Error: Server failed to start"
    cat /tmp/mobile-terminal.log
    exit 1
fi

log "Creating Cloudflare Tunnel..."
log "=============================================="
echo ""

# Cleanup function for graceful shutdown
cleanup() {
    echo ""
    log "Shutting down..."
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        kill "$SERVER_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup INT TERM

# Start tunnel and capture URL
"$CLOUDFLARED" tunnel --url "http://localhost:$SERVER_PORT" 2>&1 | while IFS= read -r line; do
    if echo "$line" | grep -q "trycloudflare.com"; then
        echo ""
        success "=============================================="
        success " Your Mobile Terminal is ready!"
        success "=============================================="
        echo ""
        echo -e " ${GREEN}$line${NC}"
        echo ""
        success "Open the URL above in any browser"
        success "Press Ctrl+C to stop"
        echo ""
    fi
    echo "$line"
done

# Keep running until interrupted
wait
