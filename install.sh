#!/bin/bash
# ============================================================================
# KAIROS-AGENT Installer
# ============================================================================
# One-command installation for Linux, macOS.
#
# Usage:
#   curl -fsSL https://<your-host>/install.sh | bash
#
# Or with options:
#   curl -fsSL ... | bash -s -- --dir ~/kairos --branch main
#
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Defaults
INSTALL_DIR="${INSTALL_DIR:-$HOME/kairos-agent}"
BRANCH="main"
REPO_URL="${REPO_URL:-https://github.com/KairosTerminalAi/Kairos.git}"
RUN_SETUP=true

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --dir) INSTALL_DIR="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --repo) REPO_URL="$2"; shift 2 ;;
    --skip-setup) RUN_SETUP=false; shift ;;
    -h|--help)
      echo "KAIROS-AGENT Installer"
      echo ""
      echo "Usage: install.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --dir PATH     Installation directory (default: \$HOME/kairos-agent)"
      echo "  --branch NAME  Git branch to install (default: main)"
      echo "  --repo URL     Git repository URL"
      echo "  --skip-setup   Skip the interactive setup wizard"
      echo "  -h, --help     Show this help"
      exit 0
      ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
done

# Detect non-interactive
if [ -t 0 ]; then
  IS_INTERACTIVE=true
else
  IS_INTERACTIVE=false
fi

# ============================================================================
# Helpers
# ============================================================================

print_banner() {
  echo ""
  echo -e "${CYAN}${BOLD}"
  echo "┌─────────────────────────────────────────────────────────┐"
  echo "│                  KAIROS-AGENT Installer                 │"
  echo "├─────────────────────────────────────────────────────────┤"
  echo "│  Self-improving AI agent for your terminal.             │"
  echo "└─────────────────────────────────────────────────────────┘"
  echo -e "${NC}"
}

log()  { echo -e "${CYAN}→${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; }

need_cmd() {
  if ! command -v "$1" &>/dev/null; then
    err "'$1' is required but not installed."
    case "$1" in
      node|npm)
        echo "  Install Node.js: https://nodejs.org/en/download/"
        ;;
      git)
        echo "  Install git: https://git-scm.com/downloads"
        ;;
      python3)
        echo "  Install Python: https://python.org/downloads/"
        ;;
    esac
    exit 1
  fi
  ok "$1 found"
}

check_node_version() {
  local version
  version=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
  if [ "$version" -lt 20 ]; then
    err "Node.js >=20 required (found v$(node --version))"
    echo "  Upgrade: https://nodejs.org/en/download/"
    exit 1
  fi
  ok "Node.js $(node --version)"
}

# ============================================================================
# Main
# ============================================================================

print_banner

# --- Prerequisites ---
log "Checking prerequisites..."
need_cmd "node"
need_cmd "npm"
check_node_version
need_cmd "git"

if command -v uv &>/dev/null; then
  ok "uv found — will use for fast Python setup"
  USE_UV=true
else
  warn "uv not found (install for faster setup: curl -LsSf https://astral.sh/uv/install.sh | sh)"
  need_cmd "python3"
  USE_UV=false
fi

# --- Clone / Update ---
if [ -d "$INSTALL_DIR" ]; then
  if [ -d "$INSTALL_DIR/.git" ]; then
    log "Updating existing repository..."
    cd "$INSTALL_DIR"
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
    ok "Repository updated to latest $BRANCH"
  else
    warn "Directory '$INSTALL_DIR' exists but is not a git repo."
    if $IS_INTERACTIVE; then
      read -p "  Remove and re-clone? [y/N] " -n 1 -r
      echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
      fi
    fi
  fi
fi

if [ ! -d "$INSTALL_DIR" ]; then
  log "Cloning repository (branch: $BRANCH)..."
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  ok "Repository cloned to $INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# --- npm install ---
log "Installing npm package..."
npm install
ok "npm install complete"

# --- Python setup via postinstall ---
log "Setting up Python environment..."
node bin/postinstall.js
ok "Python environment ready"

# --- Check that the CLI works ---
log "Verifying installation..."
PYTHON_BIN="$INSTALL_DIR/.venv/bin/python"
if [ -f "$PYTHON_BIN" ]; then
  VERSION_OUTPUT=$("$PYTHON_BIN" -c "import hermes_cli; print(hermes_cli.__version__)" 2>/dev/null || true)
  if [ -n "$VERSION_OUTPUT" ]; then
    ok "KAIROS-AGENT v$VERSION_OUTPUT"
  fi
fi

# --- Setup wizard (interactive only) ---
if $RUN_SETUP && $IS_INTERACTIVE; then
  log "Launching setup wizard..."
  "$PYTHON_BIN" -m hermes_cli.main setup
fi

# --- PATH setup ---
SHELL_CONFIG=""
case "${SHELL##*/}" in
  zsh) SHELL_CONFIG="$HOME/.zshrc" ;;
  bash) SHELL_CONFIG="$HOME/.bashrc" ;;
  fish) SHELL_CONFIG="$HOME/.config/fish/config.fish" ;;
esac

NPM_GLOBAL=$(npm config get prefix 2>/dev/null)
if [ -n "$NPM_GLOBAL" ]; then
  NPM_BIN="$NPM_GLOBAL/bin"
  if [ -d "$NPM_BIN" ] && [[ ":$PATH:" != *":$NPM_BIN:"* ]]; then
    if [ -n "$SHELL_CONFIG" ]; then
      echo "" >> "$SHELL_CONFIG"
      echo "# KAIROS-AGENT" >> "$SHELL_CONFIG"
      echo "export PATH=\"\$PATH:$NPM_BIN\"" >> "$SHELL_CONFIG"
      ok "Added npm global bin to PATH in $SHELL_CONFIG"
    fi
  fi
fi

# --- Done ---
echo ""
echo -e "${GREEN}${BOLD}┌─────────────────────────────────────────────────────────┐${NC}"
echo -e "${GREEN}${BOLD}│          KAIROS-AGENT installed successfully!           │${NC}"
echo -e "${GREEN}${BOLD}├─────────────────────────────────────────────────────────┤${NC}"
echo -e "${GREEN}${BOLD}│${NC}                                                           ${GREEN}${BOLD}│${NC}"
echo -e "${GREEN}${BOLD}│${NC}  Run:  ${CYAN}kairos${NC}  or  ${CYAN}kairos setup${NC}                   ${GREEN}${BOLD}│${NC}"
echo -e "${GREEN}${BOLD}│${NC}                                                           ${GREEN}${BOLD}│${NC}"
echo -e "${GREEN}${BOLD}│${NC}  Help: ${CYAN}kairos --help${NC}                                ${GREEN}${BOLD}│${NC}"
echo -e "${GREEN}${BOLD}│${NC}                                                           ${GREEN}${BOLD}│${NC}"
echo -e "${GREEN}${BOLD}└─────────────────────────────────────────────────────────┘${NC}"
echo ""
