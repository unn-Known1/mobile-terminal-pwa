#!/bin/bash
# Mobile Terminal Deployment Script
# One-command deployment with Cloudflare tunnel

set -e

# Use absolute paths for safety
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Mobile Terminal Deployment Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for dependencies
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}Error: $1 is required but not installed.${NC}"
        exit 1
    fi
}

check_command node
check_command npm

echo -e "${YELLOW}[1/5] Checking dependencies...${NC}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Build frontend if not already built
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}Building frontend...${NC}"
    npm run build
fi

echo -e "${GREEN}[2/5] Dependencies ready!${NC}"

# Install cloudflared if not present
CLOUDFLARED_PATH="$HOME/.cloudflared/cloudflared"
if [ ! -f "$CLOUDFLARED_PATH" ]; then
    echo -e "${YELLOW}[3/5] Installing cloudflared...${NC}"
    mkdir -p "$HOME/.cloudflared"

    # Verify directory is within HOME (safety check)
    case "$HOME/.cloudflared" in
        "$HOME"*)
            ;;
        *)
            echo -e "${RED}Error: Cloudflared directory outside HOME. Aborting for safety.${NC}"
            exit 1
            ;;
    esac

    # Detect architecture
    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
        CLOUDFLARE_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
    elif [ "$ARCH" = "aarch64" ]; then
        CLOUDFLARE_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
    else
        CLOUDFLARE_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
    fi

    echo -e "${YELLOW}Downloading cloudflared for $ARCH...${NC}"

    # Download with retry logic and error handling
    if ! curl -fsSL --retry 3 --retry-delay 2 "$CLOUDFLARE_URL" -o "$CLOUDFLARED_PATH" 2>/dev/null; then
        echo -e "${RED}Error: Failed to download cloudflared${NC}"
        exit 1
    fi
    chmod +x "$CLOUDFLARED_PATH"
    echo -e "${GREEN}cloudflared installed!${NC}"
else
    echo -e "${GREEN}[3/5] cloudflared already installed${NC}"
fi

export CLOUDFLARED="$CLOUDFLARED_PATH"

echo -e "${YELLOW}[4/5] Starting backend server...${NC}"

# Set environment variables
export NODE_ENV=production
export PORT=3000
export HOST=0.0.0.0

# Start the server in background
node server/server.js > /tmp/mobile-terminal.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Check if server started
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo -e "${RED}Error: Server failed to start${NC}"
    cat /tmp/mobile-terminal.log
    exit 1
fi

echo -e "${GREEN}Server started on port $PORT${NC}"

# Set cleanup trap
cleanup() {
    echo -e "${YELLOW}Shutting down...${NC}"
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        kill "$SERVER_PID" 2>/dev/null || true
    fi
    if [ -n "$TUNNEL_PID" ] && kill -0 "$TUNNEL_PID" 2>/dev/null; then
        kill "$TUNNEL_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup INT TERM

echo -e "${YELLOW}[5/5] Creating Cloudflare tunnel...${NC}"

# Start cloudflared tunnel
$CLOUDFLARED_PATH tunnel --url "http://localhost:$PORT" > /tmp/mobile-terminal-tunnel.log 2>&1 &
TUNNEL_PID=$!

# Wait for tunnel URL
TUNNEL_URL=""
PIN=""
sleep 8

# Parse tunnel URL from output
for i in {1..30}; do
    if curl -s http://localhost:$PORT/api/tunnel/status 2>/dev/null | grep -q "url"; then
        TUNNEL_URL=$(curl -s http://localhost:$PORT/api/tunnel/status 2>/dev/null | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
        PIN=$(curl -s http://localhost:$PORT/api/tunnel/status 2>/dev/null | grep -o '"pin":"[^"]*"' | cut -d'"' -f4)
        break
    fi
    sleep 1
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Deployment Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Your Mobile Terminal is now accessible at:${NC}"
echo ""
echo -e "  ${YELLOW}Tunnel URL:${NC} $TUNNEL_URL"
echo -e "  ${YELLOW}PIN:${NC} $PIN"
echo ""
echo -e "${YELLOW}To access from any browser:${NC}"
echo -e "  1. Open the URL above"
echo -e "  2. Enter the PIN when prompted"
echo -e "  3. Start using your terminal!"
echo ""
echo -e "${YELLOW}Multi-tab support:${NC}"
echo -e "  - Use the + button to add new tabs"
echo -e "  - Each tab opens a separate shell session"
echo -e "  - Ctrl+Shift+T or click + for new terminal"
echo ""
echo -e "${RED}To stop the server, run:${NC}"
echo -e "  kill $SERVER_PID $TUNNEL_PID"
echo ""

# Keep running until interrupted
wait
