import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const npmCli = process.env.npm_execpath;
const ignoredFixtureFiles = new Set([
  "EXPECTED_OUTPUTS.template.json",
  "FIXTURE_SPEC.md",
  "README.md",
]);

function resolveCommand(command) {
  if (process.platform === "win32") {
    if (command === "git") {
      return "git.exe";
    }
  }

  return command;
}

function resolveArgs(command, args) {
  if (command === "npm") {
    if (!npmCli) {
      throw new Error("npm_execpath is not available in the current environment.");
    }

    return [npmCli, ...args];
  }

  return args;
}

function run(command, args, options = {}) {
  const executable = command === "npm" ? process.execPath : resolveCommand(command);
  const result = spawnSync(executable, resolveArgs(command, args), {
    stdio: options.captureOutput ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function fail(message, details) {
  console.error(message);

  if (details) {
    console.error(details.trimEnd());
  }

  process.exit(1);
}

function normalizeRelativePath(relativePath) {
  return relativePath.replaceAll("\\", "/");
}

function listFixtureFiles(rootDir, currentDir = rootDir) {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = normalizeRelativePath(path.relative(rootDir, absolutePath));

    if (ignoredFixtureFiles.has(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...listFixtureFiles(rootDir, absolutePath));
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

const trustCasePath = "docs/trust-case/demo";
const trustCaseAbsolutePath = path.join(process.cwd(), trustCasePath);
const outputDir = mkdtempSync(path.join(os.tmpdir(), "proofvault-trust-case-"));
const shouldRetainOutputDir = process.env.TRUST_CASE_RETAIN_OUTPUT_DIR === "1";

function writeArtifact(filePath, contents) {
  if (!filePath) {
    return;
  }

  writeFileSync(filePath, contents, "utf8");
}

function writeDiagnosticArtifacts({ actualFiles, generatedFiles }) {
  writeArtifact(process.env.TRUST_CASE_OUTPUT_DIR_PATH, `${outputDir}\n`);
  writeArtifact(
    process.env.TRUST_CASE_DEBUG_SUMMARY_PATH,
    [
      `cwd=${process.cwd()}`,
      `platform=${process.platform}`,
      `node=${process.version}`,
      `outputDir=${outputDir}`,
      "",
      "actualFiles:",
      ...actualFiles,
      "",
      "generatedFiles:",
      ...generatedFiles,
      "",
    ].join("\n")
  );
}

try {
  const testResult = run(
    "npm",
    ["run", "test:trust-case"],
    {
      env: {
        ...process.env,
        TRUST_CASE_OUTPUT_DIR: outputDir,
      },
    }
  );

  if (testResult.status !== 0) {
    process.exit(testResult.status ?? 1);
  }

  const statusResult = run(
    "git",
    ["status", "--porcelain", "--untracked-files=all", "--", trustCasePath],
    { captureOutput: true }
  );

  if (statusResult.status !== 0) {
    fail("Unable to inspect trust-case fixture status.", statusResult.stderr);
  }

  writeArtifact(process.env.TRUST_CASE_STATUS_PATH, statusResult.stdout);

  const actualFiles = listFixtureFiles(trustCaseAbsolutePath);
  const generatedFiles = listFixtureFiles(outputDir);
  writeDiagnosticArtifacts({ actualFiles, generatedFiles });
  const actualSet = new Set(actualFiles);
  const generatedSet = new Set(generatedFiles);
  const missingFiles = actualFiles.filter((relativePath) => !generatedSet.has(relativePath));
  const unexpectedFiles = generatedFiles.filter((relativePath) => !actualSet.has(relativePath));
  const diffChunks = [];

  if (missingFiles.length > 0) {
    diffChunks.push(["Missing generated files:", ...missingFiles].join("\n"));
  }

  if (unexpectedFiles.length > 0) {
    diffChunks.push(["Unexpected generated files:", ...unexpectedFiles].join("\n"));
  }

  for (const relativePath of actualFiles) {
    if (!generatedSet.has(relativePath)) {
      continue;
    }

    const compareResult = run(
      "git",
      [
        "diff",
        "--no-index",
        "--ignore-cr-at-eol",
        "--",
        path.join(trustCaseAbsolutePath, relativePath),
        path.join(outputDir, relativePath),
      ],
      { captureOutput: true }
    );

    if (compareResult.status > 1) {
      fail(`Unable to compare the pinned trust-case specimen file ${relativePath}.`, compareResult.stderr);
    }

    if (compareResult.status === 1) {
      diffChunks.push([compareResult.stdout, compareResult.stderr].filter(Boolean).join("\n"));
    }
  }

  const diffText = diffChunks.join("\n\n");
  writeArtifact(process.env.TRUST_CASE_DIFF_PATH, diffText);

  if (statusResult.stdout.trim().length > 0 || diffChunks.length > 0) {
    fail(
      "Trust-case specimen drift detected. Re-run the specimen generator and commit the updated artifacts under docs/trust-case/demo/.",
      [
        statusResult.stdout.trim().length > 0 ? ["Changed files:", statusResult.stdout.trim()].join("\n") : null,
        diffText.trim().length > 0 ? ["Generated drift:", diffText.trim()].join("\n\n") : null,
      ]
        .filter(Boolean)
        .join("\n\n")
    );
  }

  console.log("Trust-case specimen matches the checked-in fixture.");
} finally {
  if (!shouldRetainOutputDir) {
    rmSync(outputDir, { recursive: true, force: true });
  }
}