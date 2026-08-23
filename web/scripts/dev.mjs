/**
 * Local web UX: spawn the **installed** `grok` binary if needed, then Vite.
 * The browser talks to same-origin `/ws`; Vite injects the serve secret.
 *
 * Extra args are forwarded to Vite (`npm run dev -- --host 127.0.0.1`).
 */
import { execFileSync, spawn } from "node:child_process";
import { homedir } from "node:os";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BIND = process.env.GROK_AGENT_BIND ?? "127.0.0.1:2419";
const SECRET = process.env.GROK_AGENT_SECRET ?? "slice0dev";
const colon = BIND.lastIndexOf(":");
const host = BIND.slice(0, colon);
const port = Number(BIND.slice(colon + 1));
const AGENT_CWD = process.env.GROK_AGENT_CWD ?? homedir();

function whichGrok() {
  try {
    return execFileSync("/usr/bin/which", ["grok"], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function grokLooksLikeRepoBuild(bin) {
  const n = resolve(bin);
  return n.includes("/target/debug/") || n.includes("/target/release/");
}

function resolveGrokBin() {
  const override = process.env.GROK_BIN?.trim();
  if (override) return override;
  const fromPath = whichGrok();
  if (fromPath && !grokLooksLikeRepoBuild(fromPath)) return fromPath;
  if (fromPath) {
    console.warn(
      `[grok-web] PATH grok is a cargo build (${fromPath}); prefer a packaged install`,
    );
    return fromPath;
  }
  return "grok";
}

const GROK = resolveGrokBin();

function portOpen() {
  return new Promise((resolveOpen) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolveOpen(true);
    });
    socket.on("error", () => resolveOpen(false));
    socket.setTimeout(800, () => {
      socket.destroy();
      resolveOpen(false);
    });
  });
}

async function waitPort(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await portOpen()) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`timed out waiting for grok agent on ${BIND}`);
}

function prefixLines(buf, label) {
  const text = buf.toString();
  for (const line of text.split(/\r?\n/)) {
    if (line.length) process.stderr.write(`[${label}] ${line}\n`);
  }
}

async function ensureAgent() {
  if (await portOpen()) {
    console.log(`[grok-web] reusing agent already listening on ${BIND}`);
    console.log(`[grok-web] wanted installed grok at ${GROK} (cwd ${AGENT_CWD})`);
    return null;
  }
  console.log(`[grok-web] starting installed grok: ${GROK}`);
  console.log(`[grok-web] agent cwd: ${AGENT_CWD} (not the git repo)`);
  const child = spawn(
    GROK,
    [
      "agent",
      "--always-approve",
      "--no-leader",
      "serve",
      "--bind",
      BIND,
      "--secret",
      SECRET,
    ],
    {
      cwd: AGENT_CWD,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    },
  );
  child.stdout?.on("data", (buf) => prefixLines(buf, "agent"));
  child.stderr?.on("data", (buf) => prefixLines(buf, "agent"));
  child.on("exit", (code, signal) => {
    if (code || signal) {
      console.error(`[grok-web] agent exited code=${code} signal=${signal}`);
    }
  });
  try {
    await waitPort(20_000);
  } catch (err) {
    child.kill("SIGTERM");
    throw err;
  }
  return child;
}

const agent = await ensureAgent();
const viteArgs = process.argv.slice(2);
const vite = spawn("npx", ["vite", ...viteArgs], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    GROK_AGENT_BIND: BIND,
    GROK_AGENT_SECRET: SECRET,
  },
});

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  vite.kill("SIGTERM");
  if (agent && agent.exitCode === null) agent.kill("SIGTERM");
  setTimeout(() => process.exit(code), 300);
}

vite.on("exit", (code) => {
  if (agent && agent.exitCode === null) agent.kill("SIGTERM");
  process.exit(code ?? 0);
});
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
