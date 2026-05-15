#!/usr/bin/env node
/**
 * postinstall.js — Sets up the Python environment after npm install.
 *
 * Runs automatically as `npm run postinstall` when the package is installed
 * globally or as a dependency.  Detects uv (preferred) or pip, creates a
 * virtual environment, and installs the Python package in editable mode.
 */

const { execSync } = require("child_process");
const { existsSync, mkdirSync } = require("fs");
const { resolve } = require("path");

const ROOT = resolve(__dirname, "..");
const VENV_DIR = resolve(ROOT, ".venv");
const REQUIRED_PYTHON = "3.11";

function log(msg) {
  console.log("\x1b[36m\u2192\x1b[0m", msg);
}
function ok(msg) {
  console.log("\x1b[32m\u2713\x1b[0m", msg);
}
function warn(msg) {
  console.log("\x1b[33m\u26a0\x1b[0m", msg);
}
function err(msg) {
  console.error("\x1b[31m\u2717\x1b[0m", msg);
}

function run(cmd, opts) {
  return execSync(cmd, { cwd: ROOT, stdio: "pipe", ...opts });
}

function has(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function pythonBin() {
  const bin = process.platform === "win32" ? "Scripts" : "bin";
  const py = process.platform === "win32" ? "python.exe" : "python";
  return resolve(VENV_DIR, bin, py);
}

function setupPython() {
  if (existsSync(pythonBin())) {
    ok("Python venv already exists");
    return;
  }

  // Prefer uv for speed; fall back to venv + pip
  if (has("uv")) {
    log("Creating venv with uv...");
    run(`uv venv --python ${REQUIRED_PYTHON} "${VENV_DIR}"`);
    ok("venv created via uv");
    log("Installing Python dependencies with uv...");
    run(`uv sync --extra all --locked`, { timeout: 5 * 60 * 1000 });
    ok("Python dependencies installed via uv");
  } else {
    log("uv not found — using pip. Install uv for faster setup: curl -LsSf https://astral.sh/uv/install.sh | sh");
    const python =
      process.platform === "win32"
        ? `python`
        : `python${REQUIRED_PYTHON}`;
    log(`Creating venv with ${python}...`);
    run(`${python} -m venv "${VENV_DIR}"`);
    const pip = resolve(
      VENV_DIR,
      process.platform === "win32" ? "Scripts" : "bin",
      process.platform === "win32" ? "pip.exe" : "pip"
    );
    ok("venv created via venv");
    log("Installing Python dependencies with pip...");
    run(`"${pip}" install -e "${ROOT}"`, { timeout: 5 * 60 * 1000 });
    ok("Python dependencies installed via pip");
  }
}

function installTUI() {
  const tuiDir = resolve(ROOT, "ui-tui");
  if (!existsSync(tuiDir)) {
    return;
  }
  if (existsSync(resolve(tuiDir, "node_modules"))) {
    return;
  }
  log("Installing TUI dependencies (ui-tui)...");
  run("npm install", { cwd: tuiDir, timeout: 3 * 60 * 1000 });
  ok("TUI dependencies installed");
}

function installBrowserTools() {
  if (!existsSync(resolve(ROOT, "node_modules", "@askjo/camofox-browser"))) {
    return;
  }
  log("Installing Playwright browsers...");
  try {
    run("npx playwright install chromium", { timeout: 3 * 60 * 1000 });
    ok("Playwright browsers installed");
  } catch (_) {
    warn("Playwright install skipped — run 'npx playwright install chromium' manually if needed");
  }
}

function main() {
  console.log("");
  log("Setting up KAIROS-AGENT Python environment...");
  setupPython();
  installTUI();
  installBrowserTools();
  ok("KAIROS-AGENT setup complete. Run \x1b[1mkairos\x1b[0m or \x1b[1mnpx kairos\x1b[0m to start.");
  console.log("");
}

main();
