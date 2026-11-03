import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { writeFile } from "node:fs/promises";
// The preview is a managed child, never a foreground command awaited to exit.
const probe = createServer();
await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = (probe.address() as { port: number }).port;
await new Promise<void>((resolve, reject) =>
  probe.close((e) => (e ? reject(e) : resolve())),
);
const base = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
);
let log = "";
server.stdout.on("data", (data) => {
  log += data;
});
server.stderr.on("data", (data) => {
  log += data;
});
let child: ChildProcess | undefined;
const cleanup = () => {
  child?.kill();
  server.kill();
};
process.once("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.once("SIGTERM", () => {
  cleanup();
  process.exit(143);
});
async function test(path: string, report: string) {
  let output = "";
  try {
    await new Promise<void>((resolve, reject) => {
      child = spawn(process.execPath, ["--import", "tsx", path], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        env: { ...process.env, PREVIEW_URL: base },
      });
      child.stdout!.on("data", (data) => {
        output += data;
        process.stdout.write(data);
      });
      child.stderr!.on("data", (data) => {
        output += data;
        process.stderr.write(data);
      });
      const timeout = setTimeout(() => {
        child?.kill();
        reject(Error(`${path} exceeded 90 seconds`));
      }, 90000);
      child.once("error", (e) => {
        clearTimeout(timeout);
        reject(e);
      });
      child.once("close", (code) => {
        clearTimeout(timeout);
        code === 0 ? resolve() : reject(Error(`${path} failed (${code})`));
      });
    });
  } finally {
    await writeFile(report, output);
  }
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error(`Preview exited: ${log}`);
    try {
      const r = await fetch(base, { signal: AbortSignal.timeout(300) });
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(100);
  }
  if (!ready) throw Error(`Preview did not start within deadline: ${log}`);
  console.log("Built preview started as managed background child.");
  await test("tests/browser.ts", "reports/gates-browser.txt");
  await test("tests/ui-browser.ts", "reports/gates-ui-browser.txt");
} finally {
  cleanup();
  console.log("Preview child stopped.");
}
