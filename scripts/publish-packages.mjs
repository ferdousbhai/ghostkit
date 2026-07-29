import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const packagesRoot = new URL("../packages/", import.meta.url);
const dryRun = process.argv.includes("--dry-run");

const packageDirectories = (
  await readdir(packagesRoot, {
    withFileTypes: true,
  })
)
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const directory of packageDirectories) {
  const packageDirectory = fileURLToPath(
    new URL(`${directory}/`, packagesRoot),
  );
  const manifest = JSON.parse(
    await readFile(
      new URL("package.json", new URL(`${directory}/`, packagesRoot)),
      "utf8",
    ),
  );
  const packageSpec = `${manifest.name}@${manifest.version}`;

  if (!dryRun && packageVersionExists(packageSpec)) {
    console.log(`Skipping ${packageSpec}; it is already published.`);
    continue;
  }

  const publishArguments = ["publish", "--access", "public"];
  if (dryRun) {
    publishArguments.push("--dry-run");
  }

  console.log(`${dryRun ? "Checking" : "Publishing"} ${packageSpec}...`);
  run("npm", publishArguments, packageDirectory);
}

function packageVersionExists(packageSpec) {
  const result = spawnSync("npm", ["view", packageSpec, "version", "--json"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });

  if (result.status === 0) {
    return true;
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (
    result.status === 1 &&
    (output.includes("E404") || output.includes("404 Not Found"))
  ) {
    return false;
  }

  throw new Error(`Could not inspect ${packageSpec}:\n${output.trim()}`);
}

function run(command, arguments_, cwd) {
  const result = spawnSync(command, arguments_, {
    cwd,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
