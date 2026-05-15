#!/usr/bin/env node

const { spawn, execSync } = require("child_process");
const { existsSync } = require("fs");
const { resolve } = require("path");

const ROOT = resolve(__dirname, "..");
const isWin = process.platform === "win32";
const VENV_BIN = resolve(ROOT, ".venv", isWin ? "Scripts" : "bin");
const POSTINSTALL = resolve(__dirname, "postinstall.js");
const PYTHON = resolve(VENV_BIN, isWin ? "python.exe" : "python");

function findPython() {
  if (existsSync(PYTHON)) return PYTHON;
  const candidates = isWin
    ? ["python", "python3", "py"]
    : ["python3.11", "python3", "python"];
  for (const cmd of candidates) {
    try { execSync(`${cmd} --version`, { stdio: "ignore" }); return cmd; } catch {}
  }
  return null;
}

function venvReady(python) {
  if (!existsSync(VENV_BIN)) return false;
  try {
    execSync(`"${python}" -c "import hermes_cli" 2>&1`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function runPostinstall() {
  console.log("\x1b[33m\u26a0\x1b[0m Setting up Python environment (one-time setup)...");
  try {
    execSync(`node "${POSTINSTALL}"`, { cwd: ROOT, stdio: "inherit" });
  } catch {
    console.error("\x1b[31m\u2717\x1b[0m Python setup failed.");
    console.error("  Install manually: npm install -g kairos-agent --ignore-scripts && node " + POSTINSTALL);
    process.exit(1);
  }
}

function main() {
  let python = findPython();

  if (!python) {
    if (isWin) {
      console.log("\x1b[33m\u26a0\x1b[0m Python not found — installing via uv...");
      try {
        execSync('powershell -NoProfile -Command "irm https://astral.sh/uv/install.ps1 | iex"', { stdio: "inherit" });
        execSync("uv python install 3.11", { stdio: "inherit" });
      } catch {
        console.error("\x1b[31m\u2717\x1b[0m Failed to install Python.");
        console.error("  Install Python from https://python.org/downloads/ (check 'Add to PATH')");
        process.exit(1);
      }
      python = findPython();
      if (!python) {
        console.error("\x1b[31m\u2717\x1b[0m Python still not found. Restart your terminal and try again.");
        process.exit(1);
      }
    } else {
      console.error("\x1b[31m\u2717\x1b[0m Python 3.11+ not found.");
      console.error("  Install: https://python.org/downloads/");
      process.exit(1);
    }
  }

  if (!venvReady(python)) {
    runPostinstall();
  }

  const args = process.argv.slice(2);
  python = findPython(); // refresh in case postinstall changed it
  const proc = spawn(python, ["-m", "hermes_cli.main", ...args], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, KAIROS_AGENT: "1", NODE_OPTIONS: undefined },
  });

  proc.on("exit", (code) => process.exit(code ?? 1));
  proc.on("error", (err) => {
    console.error("\x1b[31m\u2717\x1b[0m Failed to launch Python:", err.message);
    process.exit(1);
  });
}

main();
