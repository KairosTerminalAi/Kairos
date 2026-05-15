#!/usr/bin/env node
/**
 * kairos.js — CLI wrapper for KAIROS-AGENT.
 *
 * Delegates to the Python backend.  Detects the project's virtual
 * environment and passes through all arguments transparently.
 *
 * Symlinked by npm into PATH so users can run `kairos` or `kairos-agent`.
 */

const { spawn } = require("child_process");
const { existsSync } = require("fs");
const { resolve } = require("path");

const ROOT = resolve(__dirname, "..");
const isWin = process.platform === "win32";
const VENV_BIN = resolve(ROOT, ".venv", isWin ? "Scripts" : "bin");
const PYTHON = resolve(VENV_BIN, isWin ? "python.exe" : "python");

function findPython() {
  if (existsSync(PYTHON)) return PYTHON;

  // Try system Python
  const candidates = isWin
    ? ["python", "python3", "py"]
    : ["python3.11", "python3", "python"];

  for (const cmd of candidates) {
    try {
      const { execSync } = require("child_process");
      execSync(`${cmd} --version`, { stdio: "ignore" });
      return cmd;
    } catch {
      continue;
    }
  }
  return null;
}

function main() {
  const python = findPython();
  if (!python) {
    console.error(
      "\x1b[31m\u2717\x1b[0m Python 3.11+ not found.\n" +
        "  Run \x1b[1mnpm run postinstall\x1b[0m to set up the Python environment,\n" +
        "  or install Python manually: https://python.org/downloads/"
    );
    process.exit(1);
  }

  // If the venv exists but Python packages aren't installed, suggest setup
  if (existsSync(VENV_BIN)) {
    try {
      const { execSync } = require("child_process");
      execSync(`"${python}" -c "import hermes_cli" 2>/dev/null`, { stdio: "ignore" });
    } catch {
      console.error(
        "\x1b[33m\u26a0\x1b[0m Python venv exists but packages are not installed.\n" +
          "  Run \x1b[1mnpm run postinstall\x1b[0m to install dependencies."
      );
      process.exit(1);
    }
  }

  const args = process.argv.slice(2);
  const proc = spawn(python, ["-m", "hermes_cli.main", ...args], {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      KAIROS_AGENT: "1",
      NODE_OPTIONS: undefined, // prevent Node flags from leaking into Python
    },
  });

  proc.on("exit", (code) => process.exit(code ?? 1));
  proc.on("error", (err) => {
    console.error("\x1b[31m\u2717\x1b[0m Failed to launch Python:", err.message);
    process.exit(1);
  });
}

main();
