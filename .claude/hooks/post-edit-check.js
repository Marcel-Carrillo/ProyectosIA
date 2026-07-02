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

// Resolves a package's CLI script via its own package.json "bin" field
// (not require.resolve(pkg/bin/x.js) directly, since packages like eslint
// restrict subpath access via "exports").
// binField comes from an installed devDependency's package.json, not from
// request/user input, but is still validated to stay inside the package
// directory so a malicious "bin" field can't resolve outside of it.
function resolveBin(pkgName, binName, cwd) {
  const pkgJsonPath = require.resolve(`${pkgName}/package.json`, { paths: [cwd] });
  const pkgDir = path.dirname(pkgJsonPath);
  const pkg = require(pkgJsonPath);
  const binField = typeof pkg.bin === "string" ? pkg.bin : pkg.bin[binName];
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const resolved = path.resolve(pkgDir, binField);
  if (resolved !== pkgDir && !resolved.startsWith(pkgDir + path.sep)) {
    throw new Error(`Refusing to run bin outside its package directory: ${resolved}`);
  }
  return resolved;
}

// Runs a resolved script via the current Node binary directly (no shell),
// so no argument ever passes through shell interpretation.
function run(scriptPath, args, cwd) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], { cwd, encoding: "utf8" });
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

try {
  const tscBin = resolveBin("typescript", "tsc", cwd);
  const tsc = run(tscBin, ["--noEmit", "-p", "tsconfig.json"], cwd);
  if (tsc.status !== 0) {
    failures.push(`[${subproject} typecheck]\n${tsc.output.trim()}`);
  }
} catch {
  // typescript not resolvable for this subproject; skip typecheck
}

if (subproject === "backend") {
  try {
    const eslintBin = resolveBin("eslint", "eslint", cwd);
    const eslint = run(eslintBin, [filePath], cwd);
    if (eslint.status !== 0) {
      failures.push(`[backend lint: ${filePath}]\n${eslint.output.trim()}`);
    }
  } catch {
    // eslint not resolvable; skip lint
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
