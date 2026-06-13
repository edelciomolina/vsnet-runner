const { spawnSync } = require("child_process");
const { readFileSync } = require("fs");
const { createInterface } = require("readline");
const path = require("path");

const validRelease = /^(patch|minor|major|\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

function checkPrerequisites(spawn = spawnSync) {
    const vsceExe = vsceExecutable();
    const vsceWhoami = spawn(vsceExe, ["verify-pat", "edelciomolina"], {
        cwd: path.join(__dirname, ".."),
        encoding: "utf8",
        shell: process.platform === "win32"
    });
    if (vsceWhoami.status !== 0) {
        throw new Error(
            "Not logged in to vsce. Run:\n\n  npx vsce login edelciomolina\n\nThen retry npm run publish."
        );
    }
}

function ask(prompt) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(prompt, answer => { rl.close(); resolve(answer.trim()); }));
}

function bumpVersion(current, release) {
    if (/^\d+\.\d+\.\d+/.test(release)) {
        return release;
    }
    const [major, minor, patch] = current.split(".").map(Number);
    if (release === "major") return `${major + 1}.0.0`;
    if (release === "minor") return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
}

async function deploy(release = "minor", runCommand = run, askFn = ask) {
    if (!isValidRelease(release)) {
        throw new Error(`Invalid release "${release}". Use patch, minor, major or an explicit semver.`);
    }

    const root = path.join(__dirname, "..");

    checkPrerequisites();
    runCommand("npm", ["run", "check"]);

    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    const newVersion = bumpVersion(pkg.version, release);

    runCommand(vsceExecutable(), ["publish", release, "--no-git-tag-version"]);

    console.log("\n" + "=".repeat(60));
    console.log(`Published v${newVersion} successfully!`);
    console.log(`  VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=edelciomolina.vsnet-runner`);
    console.log("=".repeat(60));

    const doGit = await askFn(`\nCommit and push "chore(release): v${newVersion}"? [Y/n] `);
    if (doGit.toLowerCase() !== "n") {
        runCommand("git", ["add", "."]);
        runCommand("git", ["commit", "-m", `chore(release): v${newVersion}`]);
        runCommand("git", ["tag", `v${newVersion}`]);
        runCommand("git", ["push", "--follow-tags"]);
        console.log("\nGit commit, tag, and push completed.");
    } else {
        console.log("\nManual git steps:");
        console.log(`  git add .`);
        console.log(`  git commit -m "chore(release): v${newVersion}"`);
        console.log(`  git tag v${newVersion}`);
        console.log(`  git push --follow-tags`);
    }
}

function isValidRelease(release) {
    return validRelease.test(release);
}

function vsceExecutable(platform = process.platform) {
    return path.join(
        __dirname,
        "..",
        "node_modules",
        ".bin",
        platform === "win32" ? "vsce.cmd" : "vsce"
    );
}

function run(command, args, spawn = spawnSync, platform = process.platform) {
    const isVscePublish = args.includes("publish");
    const result = spawn(command, args, {
        cwd: path.join(__dirname, ".."),
        stdio: isVscePublish ? "pipe" : "inherit",
        encoding: isVscePublish ? "utf8" : undefined,
        shell: platform === "win32" && (command === "npm" || command.endsWith(".cmd"))
    });

    if (result.error) {
        throw result.error;
    }

    if (isVscePublish && result.status !== 0) {
        const output = (result.stdout || "") + (result.stderr || "");
        if (output.includes("display name is taken")) {
            throw new Error(
                `The display name is already taken on the VS Code Marketplace.\n` +
                `Change "displayName" in package.json to a unique name, then retry.\n\n` +
                `  Original error: ${output.trim()}`
            );
        }
        if (output.includes("Personal Access Token")) {
            throw new Error(
                `PAT expired or invalid. Run:\n\n  npx vsce login edelciomolina\n\nThen retry.`
            );
        }
        if (output.includes("ENOTFOUND") || output.includes("ETIMEDOUT")) {
            throw new Error(
                `Network error reaching the marketplace. Check your connection and retry.\n\n` +
                `  Original error: ${output.trim()}`
            );
        }
        process.stdout.write(output);
        throw new Error(`Command failed with exit code ${result.status || 1}: ${command}`);
    }

    if (isVscePublish && result.stdout) {
        process.stdout.write(result.stdout);
    }

    if (!isVscePublish && result.status !== 0) {
        throw new Error(`Command failed with exit code ${result.status || 1}: ${command}`);
    }
}

async function main(args = process.argv.slice(2), logger = console, deployAction = deploy) {
    try {
        await deployAction(args[0]);
        return 0;
    } catch (error) {
        logger.error(error.message);
        return 1;
    }
}

if (require.main === module) {
    main().then(code => { process.exitCode = code; });
}

module.exports = { deploy, bumpVersion, checkPrerequisites, isValidRelease, main, run, vsceExecutable, ask };
