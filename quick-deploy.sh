#!/bin/bash
# Mobile Terminal - One-Line Cloudflare Deployment
# Usage: curl -sL https://your-server.com/install.sh | bash
# Or download and run: ./deploy.sh

set -e

# Use absolute paths for safety
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${HOME}/mobile-terminal"
SERVER_PORT=5151

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Step indicator
step() {
    echo -e "${BLUE}[${CYAN}$1${BLUE}]${NC} $2"
}

# Success message
success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Error message
error() {
    echo -e "${RED}✗${NC} $1"
}

# Banner
banner() {
    echo -e "${CYAN}"
    cat << 'EOF'
    ╔═══════════════════════════════════════════╗
    ║     Mobile Terminal - Cloudflare Setup    ║
    ║     One-line access from any browser     ║
    ╚═══════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Cleanup function for graceful shutdown
cleanup() {
    echo ""
    error "Shutting down..."
    # Kill processes if they exist and are running
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        kill "$SERVER_PID" 2>/dev/null || true
    fi
    if [ -n "$TUNNEL_PID" ] && kill -0 "$TUNNEL_PID" 2>/dev/null; then
        kill "$TUNNEL_PID" 2>/dev/null || true
    fi
    exit 0
}

# Main function
main() {
    banner

    # Check if in correct directory
    if [ ! -d "$PROJECT_DIR" ]; then
        error "Mobile Terminal not found at $PROJECT_DIR"
        echo "Please clone the repository first:"
        echo "  git clone https://github.com/unn-Known1/mobile-terminal.git ~/mobile-terminal"
        exit 1
    fi

    cd "$PROJECT_DIR"

    step "1" "Checking dependencies..."

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        step ">" "Installing npm dependencies..."
        npm install
    fi

    # Build if needed
    if [ ! -d "dist" ]; then
        step ">" "Building frontend..."
        npm run build
    fi

    success "Dependencies ready"

    step "2" "Installing Cloudflared..."

    # Install cloudflared
    CLOUDFLARED_DIR="$HOME/.cloudflared"
    CLOUDFLARED_BIN="$CLOUDFLARED_DIR/cloudflared"

    if [ ! -f "$CLOUDFLARED_BIN" ]; then
        mkdir -p "$CLOUDFLARED_DIR"

        # Verify directory is within HOME (safety check)
        case "$CLOUDFLARED_DIR" in
            "$HOME"*)
                ;;
            *)
                error "Cloudflared directory outside HOME. Aborting for safety."
                exit 1
                ;;
        esac

        # Detect architecture
        ARCH=$(uname -m)
        case $ARCH in
            x86_64)
                URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
                ;;
            aarch64|arm64)
                URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
                ;;
            *)
                URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
                ;;
        esac

        echo -e "${YELLOW}Downloading cloudflared for $ARCH...${NC}"

        # Download with retry logic and error handling
        if ! curl -fsSL --retry 3 --retry-delay 2 "$URL" -o "$CLOUDFLARED_BIN" 2>/dev/null; then
            error "Failed to download cloudflared"
            exit 1
        fi
        chmod +x "$CLOUDFLARED_BIN"
    fi

    success "Cloudflared ready"

    step "3" "Starting server..."

    # Kill any existing server with better process matching
    pkill -f "node.*server/server.js" 2>/dev/null || true
    sleep 1

    # Start server in background
    export NODE_ENV=production
    export PORT=$SERVER_PORT
    export HOST=0.0.0.0

    node server/server.js > /tmp/terminal-server.log 2>&1 &
    SERVER_PID=$!

    # Wait for server to start
    sleep 3

    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        error "Failed to start server"
        cat /tmp/terminal-server.log
        exit 1
    fi

    success "Server running on port $SERVER_PORT"

    # Set cleanup trap
    trap cleanup INT TERM

    step "4" "Creating Cloudflare tunnel..."

    # Start cloudflared tunnel
    $CLOUDFLARED_BIN tunnel --url "http://localhost:$SERVER_PORT" > /tmp/terminal-tunnel.log 2>&1 &
    TUNNEL_PID=$!

    # Wait for tunnel URL (can take up to 30 seconds)
    TUNNEL_URL=""
    TUNNEL_PIN=""

    echo -e "${YELLOW}Waiting for tunnel URL (this may take a few seconds)...${NC}"

    for i in {1..40}; do
        # Check if tunnel process is still running
        if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
            error "Tunnel process exited"
            cat /tmp/terminal-tunnel.log
            exit 1
        fi

        # Try to get URL from tunnel output
        TUNNEL_URL=$(grep -oE 'https://[a-zA-Z0-9]+\.trycloudflare\.com' /tmp/terminal-tunnel.log 2>/dev/null | head -1 || true)

        if [ -z "$TUNNEL_URL" ]; then
            # Also try via server API
            API_RESPONSE=$(curl -s http://localhost:$SERVER_PORT/api/tunnel/status 2>/dev/null || echo "{}")
            TUNNEL_URL=$(echo "$API_RESPONSE" | grep -oE '"url":"[^"]*"' | cut -d'"' -f4 || true)
            TUNNEL_PIN=$(echo "$API_RESPONSE" | grep -oE '"pin":"[^"]*"' | cut -d'"' -f4 || true)
        fi

        if [ -n "$TUNNEL_URL" ]; then
            break
        fi

        echo -ne "${YELLOW}\rWaiting... ($i/40)${NC}"
        sleep 1
    done

    echo ""

    if [ -z "$TUNNEL_URL" ]; then
        error "Failed to get tunnel URL"
        cat /tmp/terminal-tunnel.log
        exit 1
    fi

    success "Tunnel created!"

    # Display results
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║              Deployment Successful!                     ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${GREEN}URL:${NC} ${YELLOW}$TUNNEL_URL${NC}"
    echo -e "  ${GREEN}PIN:${NC} ${YELLOW}$TUNNEL_PIN${NC}"
    echo ""
    echo -e "${CYAN}─────────────────────────────────────────────────────────${NC}"
    echo ""
    echo -e "${GREEN}How to access:${NC}"
    echo "  1. Open the URL in your browser"
    echo "  2. Enter the PIN when prompted"
    echo "  3. Start using your terminal!"
    echo ""
    echo -e "${GREEN}Features:${NC}"
    echo "  ✓ Multi-tab terminal support"
    echo "  ✓ Run any command via browser"
    echo "  ✓ Real PTY emulation"
    echo "  ✓ Access from any device"
    echo ""
    echo -e "${CYAN}─────────────────────────────────────────────────────────${NC}"
    echo ""
    echo -e "${YELLOW}To stop the server:${NC}"
    echo "  kill $SERVER_PID $TUNNEL_PID"
    echo ""
    echo -e "${YELLOW}Logs available at:${NC}"
    echo "  /tmp/terminal-server.log"
    echo "  /tmp/terminal-tunnel.log"
    echo ""

    # Save PIDs for later cleanup
    echo "$SERVER_PID $TUNNEL_PID" > /tmp/mobile-terminal-pids

    success "Done!"

    # Keep running until interrupted
    wait
}

# Run main function
main "$@"
