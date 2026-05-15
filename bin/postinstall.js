#!/usr/bin/env node

const { execSync } = require("child_process");
const { existsSync } = require("fs");
const { resolve } = require("path");

const ROOT = resolve(__dirname, "..");
const VENV_DIR = resolve(ROOT, ".venv");
const isWin = process.platform === "win32";

function log(m)  { console.log("\x1b[36m\u2192\x1b[0m", m); }
function ok(m)   { console.log("\x1b[32m\u2713\x1b[0m", m); }
function warn(m) { console.log("\x1b[33m\u26a0\x1b[0m", m); }
function err(m)  { console.error("\x1b[31m\u2717\x1b[0m", m); }

function run(cmd, opts) {
  return execSync(cmd, { cwd: ROOT, stdio: "pipe", shell: isWin, ...opts });
}

function has(cmd) {
  try {
    execSync(isWin ? `where ${cmd}` : `which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function pythonBin() {
  const bin = isWin ? "Scripts" : "bin";
  const py = isWin ? "python.exe" : "python";
  return resolve(VENV_DIR, bin, py);
}

function findPython() {
  if (isWin) {
    // Try Python launcher first (pre-installed on modern Windows)
    try { execSync("py --version", { stdio: "ignore" }); return "py"; } catch {}
    try { execSync("python --version", { stdio: "ignore" }); return "python"; } catch {}
  } else {
    try { execSync("python3 --version", { stdio: "ignore" }); return "python3"; } catch {}
    try { execSync("python --version", { stdio: "ignore" }); return "python"; } catch {}
  }
  return null;
}

function installPythonMsg() {
  if (isWin) {
    err("Python 3.11+ not found.");
    err("  Install Python from https://python.org/downloads/ (check 'Add to PATH')");
    warn("  Or install uv (recommended):");
    warn("    powershell -c \"irm https://astral.sh/uv/install.ps1 | iex\"");
    warn("  Then reinstall: npm install -g kairos-agent");
  } else {
    err("Python 3.11+ not found.");
    err("  Install Python from https://python.org/downloads/");
    warn("  Or install uv (recommended):");
    warn("    curl -LsSf https://astral.sh/uv/install.sh | sh");
    warn("  Then reinstall: npm install -g kairos-agent");
  }
}

function setupPython() {
  if (existsSync(pythonBin())) {
    // Check if packages are actually installed
    try { run(`"${pythonBin()}" -c "import hermes_cli"`); ok("Python venv already exists"); return; } catch {}
    warn("Partial venv found — reinstalling...");
    try { const { rmSync } = require("fs"); rmSync(VENV_DIR, { recursive: true, force: true }); } catch {}
    try { const { rmSync } = require("fs"); rmSync(VENV_DIR + ".old", { recursive: true, force: true }); } catch {}
  }

  if (has("uv")) {
    log("Creating venv with uv...");
    run(`uv venv --python 3.11 "${VENV_DIR}"`);
    ok("venv created via uv");
    log("Installing Python dependencies with uv...");
    run("uv sync --extra all --locked", { timeout: 5 * 60 * 1000 });
    ok("Python dependencies installed via uv");
    return;
  }

  warn("uv not found — uv is strongly recommended (handles Python download too)");
  const python = findPython();
  if (!python) {
    installPythonMsg();
    process.exit(1);
  }
  log(`Creating venv with ${python}...`);
  run(`${python} -m venv "${VENV_DIR}"`);
  const pip = resolve(VENV_DIR, isWin ? "Scripts" : "bin", isWin ? "pip.exe" : "pip");
  ok("venv created");
  log("Installing Python dependencies with pip...");
  run(`"${pip}" install -e "${ROOT}"`, { timeout: 5 * 60 * 1000 });
  ok("Python dependencies installed");
}

function main() {
  console.log("");
  log("Setting up KAIROS-AGENT Python environment...");
  setupPython();
  ok("KAIROS-AGENT setup complete. Run \x1b[1mkairos\x1b[0m to start.");
  console.log("");
}

main();
