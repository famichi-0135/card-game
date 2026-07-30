import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backendDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const persistenceDirectory = join(backendDirectory, ".wrangler", "e2e");
const e2eEnvironmentPath = join(persistenceDirectory, "e2e.env");
let stopping = false;

try {
  await rm(persistenceDirectory, { force: true, recursive: true });
  await mkdir(persistenceDirectory, { recursive: true });
  await writeFile(e2eEnvironmentPath, createE2eDevVars(), { flag: "wx" });
  await runWrangler([
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--persist-to",
    persistenceDirectory,
    "--config",
    "wrangler.e2e.jsonc",
    "--env",
    "e2e",
    "--env-file",
    e2eEnvironmentPath,
  ]);

  const worker = startWrangler([
    "dev",
    "--ip",
    "127.0.0.1",
    "--port",
    "8787",
    "--persist-to",
    persistenceDirectory,
    "--config",
    "wrangler.e2e.jsonc",
    "--env",
    "e2e",
    "--env-file",
    e2eEnvironmentPath,
  ]);

  const stop = async (exitCode) => {
    if (stopping) {
      return;
    }
    stopping = true;
    await stopWorker(worker);
    await cleanup();
    process.exit(exitCode);
  };

  process.once("SIGINT", () => void stop(0));
  process.once("SIGTERM", () => void stop(0));
  worker.once("exit", async (code) => {
    if (stopping) {
      return;
    }
    stopping = true;
    await cleanup();
    process.exit(code ?? 1);
  });
} catch (error) {
  await cleanup();
  throw error;
}

function createE2eDevVars() {
  return [
    `BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}`,
    "BETTER_AUTH_URL=http://127.0.0.1:4173",
    "BETTER_AUTH_TRUSTED_ORIGINS=http://127.0.0.1:4173",
    "GOOGLE_CLIENT_ID=local-e2e-google-client-id",
    "GOOGLE_CLIENT_SECRET=local-e2e-google-client-secret",
    "",
  ].join("\n");
}

function startWrangler(arguments_) {
  const isWindows = process.platform === "win32";
  return spawn(
    isWindows ? "cmd.exe" : "pnpm",
    [
      ...(isWindows ? ["/d", "/s", "/c", "pnpm"] : []),
      "exec",
      "wrangler",
      ...arguments_,
    ],
    {
      cwd: backendDirectory,
      stdio: "inherit",
    },
  );
}

async function runWrangler(arguments_) {
  const child = startWrangler(arguments_);
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) {
    throw new Error(
      `E2E用のWranglerコマンドが終了コード${exitCode}で失敗しました。`,
    );
  }
}

async function cleanup() {
  await rm(persistenceDirectory, { force: true, recursive: true });
}

async function stopWorker(worker) {
  if (worker.exitCode !== null || worker.pid === undefined) {
    return;
  }
  if (process.platform !== "win32") {
    worker.kill("SIGTERM");
    return;
  }

  const taskkill = spawn("taskkill", ["/pid", String(worker.pid), "/t", "/f"], {
    stdio: "ignore",
  });
  await new Promise((resolve) => taskkill.once("exit", resolve));
}
