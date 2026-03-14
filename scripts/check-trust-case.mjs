import { spawnSync } from "node:child_process";

const npmCli = process.env.npm_execpath;

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

const trustCasePath = "docs/trust-case/demo";

const testResult = run("npm", ["run", "test:trust-case"]);

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

if (statusResult.stdout.trim().length > 0) {
  const diffResult = run("git", ["diff", "--", trustCasePath], { captureOutput: true });
  const diffText = [diffResult.stdout, diffResult.stderr].filter(Boolean).join("\n");

  fail(
    "Trust-case specimen drift detected. Re-run the specimen generator and commit the updated artifacts under docs/trust-case/demo/.",
    ["Changed files:", statusResult.stdout.trim(), "", diffText].filter(Boolean).join("\n")
  );
}

console.log("Trust-case specimen matches the checked-in fixture.");