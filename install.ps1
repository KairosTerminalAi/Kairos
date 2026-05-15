# ============================================================================
# KAIROS-AGENT Installer for Windows
# ============================================================================
# PowerShell installation script.
#
# Usage:
#   irm https://<your-host>/install.ps1 | iex
#
# Or download and run:
#   .\install.ps1 -SkipSetup
#
# ============================================================================

param(
    [switch]$SkipSetup,
    [string]$Branch = "main",
    [string]$InstallDir = "$env:USERPROFILE\kairos-agent",
    [string]$RepoUrl = "https://github.com/NousResearch/hermes-agent.git"
)

$ErrorActionPreference = "Stop"

# ============================================================================
# Helpers
# ============================================================================

function Write-Banner {
    Write-Host ""
    Write-Host "┌─────────────────────────────────────────────────────────┐" -ForegroundColor Cyan
    Write-Host "│                  KAIROS-AGENT Installer                 │" -ForegroundColor Cyan
    Write-Host "├─────────────────────────────────────────────────────────┤" -ForegroundColor Cyan
    Write-Host "│  Self-improving AI agent for your terminal.             │" -ForegroundColor Cyan
    Write-Host "└─────────────────────────────────────────────────────────┘" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Info  { Write-Host "→ $($args[0])" -ForegroundColor Cyan }
function Write-Success { Write-Host "✓ $($args[0])" -ForegroundColor Green }
function Write-Warn  { Write-Host "⚠ $($args[0])" -ForegroundColor Yellow }
function Write-Err   { Write-Host "✗ $($args[0])" -ForegroundColor Red }

function Test-Command($cmd) {
    try { Get-Command $cmd -ErrorAction Stop; return $true }
    catch { return $false }
}

# ============================================================================
# Main
# ============================================================================

Write-Banner

# --- Prerequisites ---
Write-Info "Checking prerequisites..."

if (-not (Test-Command node)) {
    Write-Err "Node.js is required. Download from https://nodejs.org/en/download/"
    exit 1
}
$nodeVer = node --version
Write-Success "Node.js $nodeVer"

if (-not (Test-Command npm)) {
    Write-Err "npm not found (should be bundled with Node.js)"
    exit 1
}
Write-Success "npm found"

if (-not (Test-Command git)) {
    Write-Err "Git is required. Download from https://git-scm.com/download/win"
    exit 1
}
Write-Success "git found"

if (Test-Command uv) {
    Write-Success "uv found — will use for fast Python setup"
} else {
    Write-Warn "uv not found — will use Python venv + pip instead"
    if (-not (Test-Command python3) -and -not (Test-Command python)) {
        Write-Err "Python 3.11+ is required if uv is not available."
        Write-Err "Install Python from https://python.org/downloads/ or install uv: irm https://astral.sh/uv/install.ps1 | iex"
        exit 1
    }
}

# --- Clone ---
if (Test-Path $InstallDir) {
    Write-Warn "Directory '$InstallDir' already exists. Using existing."
} else {
    Write-Info "Cloning repository (branch: $Branch)..."
    git clone --depth 1 --branch $Branch $RepoUrl $InstallDir
    Write-Success "Repository cloned to $InstallDir"
}

Set-Location $InstallDir

# --- npm install ---
Write-Info "Installing npm package..."
npm install
Write-Success "npm install complete"

# --- Python setup ---
Write-Info "Setting up Python environment..."
node bin/postinstall.js
Write-Success "Python environment ready"

# --- Verify ---
$venvPython = "$InstallDir\.venv\Scripts\python.exe"
if (Test-Path $venvPython) {
    try {
        $ver = & $venvPython -c "import hermes_cli; print(hermes_cli.__version__)"
        Write-Success "KAIROS-AGENT v$ver"
    } catch {}
}

# --- Setup wizard ---
if (-not $SkipSetup) {
    Write-Info "Launching setup wizard..."
    try { & $venvPython -m hermes_cli.main setup } catch {}
}

# --- PATH ---
$npmGlobalBin = npm config get prefix 2>$null
if ($npmGlobalBin) {
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$npmGlobalBin*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$npmGlobalBin", "User")
        Write-Success "Added npm global bin to user PATH"
    }
}

# --- Done ---
Write-Host ""
Write-Host "┌─────────────────────────────────────────────────────────┐" -ForegroundColor Green
Write-Host "│          KAIROS-AGENT installed successfully!           │" -ForegroundColor Green
Write-Host "├─────────────────────────────────────────────────────────┤" -ForegroundColor Green
Write-Host "│                                                         │" -ForegroundColor Green
Write-Host "│  Run in a NEW PowerShell window:                        │" -ForegroundColor Green
Write-Host "│    kairos                                                 │" -ForegroundColor Cyan
Write-Host "│    kairos setup                                           │" -ForegroundColor Cyan
Write-Host "│                                                         │" -ForegroundColor Green
Write-Host "└─────────────────────────────────────────────────────────┘" -ForegroundColor Green
Write-Host ""
