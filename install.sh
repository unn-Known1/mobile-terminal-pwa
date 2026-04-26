#!/bin/bash
# Mobile Terminal - One-Command Installer
# Usage: curl -sL https://raw.githubusercontent.com/unn-Known1/mobile-terminal/master/install.sh | bash
# Or: curl -sL https://git.new/term | bash

set -e

# Use absolute paths for safety
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${INSTALL_DIR:-$HOME/mobile-terminal}"
PROJECT_URL="https://github.com/unn-Known1/mobile-terminal.git"
CLOUDFLARED_DIR="$HOME/.cloudflared"
CLOUDFLARED="$CLOUDFLARED_DIR/cloudflared"
SERVER_PORT=5173

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_banner() {
    cat << 'EOF'
    __ __.__  ___________        ___
    \ \/ /\  \/ /\_   ___ \_____ _____|  |__
     \   /  \  / /    \  \/\__  \\_  __ \  |  \
     /   \   \/  \     \__/ __ \ |  | \/   Y  \
    /___/\__/\__/\______\(____  /|__|  |___|  /
          \_/  \/          \/            \/

    Mobile Terminal - Access Your Server from Anywhere
EOF
}

check_node() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+ first."
        log_info "Visit: https://nodejs.org"
        exit 1
    fi
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version 18+ is required. Current: $(node -v)"
        exit 1
    fi
    log_success "Node.js $(node -v) detected"
}

install_cloudflared() {
    if [ -f "$CLOUDFLARED" ]; then
        log_success "cloudflared already installed"
        return
    fi

    log_info "Installing cloudflared..."
    mkdir -p "$CLOUDFLARED_DIR"

    # Verify CLOUDFLARED_DIR is within HOME (safety check)
    case "$CLOUDFLARED_DIR" in
        "$HOME"*)
            ;;
        *)
            log_error "Cloudflared directory outside HOME. Aborting for safety."
            exit 1
            ;;
    esac

    # Detect architecture
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64) FILE="cloudflared-linux-amd64" ;;
        aarch64|arm64) FILE="cloudflared-linux-arm64" ;;
        *) FILE="cloudflared-linux-amd64" ;;
    esac

    log_info "Downloading cloudflared for $ARCH..."

    # Download with retry logic and error handling
    if ! curl -fsSL --retry 3 --retry-delay 2 \
        "https://github.com/cloudflare/cloudflared/releases/latest/download/$FILE" \
        -o "$CLOUDFLARED" 2>/dev/null; then
        log_error "Failed to download cloudflared"
        exit 1
    fi

    chmod +x "$CLOUDFLARED"
    log_success "cloudflared installed"
}

clone_or_update() {
    if [ -d "$INSTALL_DIR" ]; then
        log_info "Project already exists at $INSTALL_DIR"
        cd "$INSTALL_DIR"
        if [ -d .git ]; then
            log_info "Updating existing repository..."
            git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || true
        fi
    else
        log_info "Cloning repository to $INSTALL_DIR..."
        git clone "$PROJECT_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi
}

install_deps() {
    log_info "Installing dependencies..."
    npm install 2>&1 | tail -5
    log_success "Dependencies installed"
}

build_frontend() {
    log_info "Building frontend..."
    npm run build 2>&1 | tail -5
    log_success "Frontend built"
}

# Cleanup function for graceful shutdown
cleanup() {
    log_info "Shutting down..."
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        kill "$SERVER_PID" 2>/dev/null || true
    fi
    exit 0
}

start_tunnel() {
    log_info "Starting Mobile Terminal with Cloudflare Tunnel..."
    log_info "=============================================="
    echo ""

    # Start the server in background
    PORT=$SERVER_PORT npm run server > /tmp/mobile-terminal.log 2>&1 &
    SERVER_PID=$!

    # Set cleanup trap
    trap cleanup INT TERM

    # Wait for server to start
    sleep 3

    # Verify server is running
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        log_error "Failed to start server"
        cat /tmp/mobile-terminal.log
        exit 1
    fi

    # Start cloudflare tunnel
    "$CLOUDFLARED" tunnel --url "http://localhost:$SERVER_PORT" 2>&1 | while IFS= read -r line; do
        if echo "$line" | grep -q "trycloudflare.com"; then
            echo ""
            log_success "=============================================="
            log_success " Your Mobile Terminal is ready!"
            log_success "=============================================="
            echo ""
            echo -e "${GREEN}$line${NC}"
            echo ""
            log_info "Open the URL above in any browser to access your terminal"
            log_info "Press Ctrl+C to stop the tunnel and server"
            echo ""
        fi
    done

    # Keep running until interrupted
    wait
}

main() {
    print_banner
    echo ""
    log_info "Starting installation..."
    echo ""

    check_node
    clone_or_update
    install_deps
    build_frontend
    install_cloudflared

    echo ""
    log_success "Installation complete! Starting tunnel..."
    echo ""

    start_tunnel
}

main "$@"
