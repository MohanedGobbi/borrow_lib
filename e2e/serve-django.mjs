// Starts the Django API for the "django" Playwright project on port 8100.
// A fresh SQLite file is migrated and seeded on every run, so the suite always starts from seed_demo.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const mailDir = path.join(root, "e2e", ".mail");

const python = [
  process.env.E2E_PYTHON,
  path.join(backend, ".venv", "Scripts", "python.exe"),
  path.join(backend, ".venv", "bin", "python"),
].find((candidate) => candidate && existsSync(candidate)) ?? "python";

const env = {
  ...process.env,
  DJANGO_SETTINGS_MODULE: "config.settings_e2e",
  DJANGO_DEBUG: "1",
  DB_NAME: "e2e.sqlite3",
  FRONTEND_URL: "http://localhost:4301",
  EMAIL_BACKEND: "django.core.mail.backends.filebased.EmailBackend",
  EMAIL_FILE_PATH: mailDir,
  PYTHONUNBUFFERED: "1",
};

rmSync(path.join(backend, "e2e.sqlite3"), { force: true });
rmSync(mailDir, { recursive: true, force: true });
mkdirSync(mailDir, { recursive: true });

for (const args of [["manage.py", "migrate", "--noinput"], ["manage.py", "seed_demo"]]) {
  const result = spawnSync(python, args, { cwd: backend, env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const server = spawn(python, ["manage.py", "runserver", "127.0.0.1:8100", "--noreload"], {
  cwd: backend, env, stdio: ["ignore", "inherit", "pipe"],
});

// runserver logs every request to stderr. Only show what helps when something goes wrong:
// server errors and anything that is not an ordinary request line or an expected 4xx warning.
const noise = [
  /^\[[^\]]+\] "[A-Z]+ \S+ HTTP\/[\d.]+" [234]\d\d /,
  /^(Unauthorized|Forbidden|Bad Request|Not Found|Conflict|Too Many Requests|Method Not Allowed): /,
  /InsecureKeyLengthWarning/,
  /^\s+(decoded|return) /,
];
let pending = "";
server.stderr.on("data", (chunk) => {
  const lines = (pending + chunk).split(/\r?\n/);
  pending = lines.pop() ?? "";
  for (const line of lines) if (!noise.some((pattern) => pattern.test(line))) console.error(line);
});
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"]) process.on(signal, () => server.kill());
process.on("exit", () => server.kill());
