#!/usr/bin/env node
// PostToolUse hook (Edit|Write|MultiEdit): typecheck + lint the touched TS file's
// subproject right after the edit, so self-introduced compile errors surface
// immediately instead of at the next build/test run.
const path = require("path");
const { spawnSync } = require("child_process");

function readStdin() {
  try {
    return require("fs").readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, shell: true, encoding: "utf8" });
  return { status: result.status ?? 1, output: (result.stdout || "") + (result.stderr || "") };
}

const raw = readStdin();
let payload;
try {
  payload = JSON.parse(raw || "{}");
} catch {
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path;
if (!filePath || !/\.tsx?$/.test(filePath)) {
  process.exit(0);
}

const repoRoot = path.resolve(__dirname, "..", "..");
const normalized = filePath.replace(/\\/g, "/");

let subproject = null;
if (normalized.includes("/backend/")) subproject = "backend";
else if (normalized.includes("/frontend/")) subproject = "frontend";
if (!subproject) process.exit(0);

const cwd = path.join(repoRoot, subproject);
const failures = [];

const tsc = run("npx", ["tsc", "--noEmit", "-p", "tsconfig.json"], cwd);
if (tsc.status !== 0) {
  failures.push(`[${subproject} typecheck]\n${tsc.output.trim()}`);
}

if (subproject === "backend") {
  const eslint = run("npx", ["eslint", JSON.stringify(filePath)], cwd);
  if (eslint.status !== 0) {
    failures.push(`[backend lint: ${filePath}]\n${eslint.output.trim()}`);
  }
}

if (failures.length > 0) {
  console.log(
    JSON.stringify({
      systemMessage: `Typecheck/lint issues in ${subproject} after editing ${filePath}`,
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: failures.join("\n\n"),
      },
    })
  );
}
process.exit(0);
