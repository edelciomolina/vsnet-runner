const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const requiredFiles = [
    "out/extension.js",
    "out/runner.js",
    "out/attachVS.js",
    "out/vsnetrunner.js",
    "readme.md",
    "CHANGELOG.md",
    "LICENSE",
    "icon.png"
];

for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(root, file))) {
        fail(`Required file is missing: ${file}`);
    }
}

for (const field of ["name", "displayName", "description", "version", "publisher", "repository", "license"]) {
    if (!manifest[field]) {
        fail(`Required package.json field is missing: ${field}`);
    }
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) {
    fail(`Invalid extension version: ${manifest.version}`);
}

const commands = manifest.contributes?.commands;
if (!Array.isArray(commands) || commands.length < 3) {
    fail("The extension must register at least 3 commands (run, runNoArgs, debug).");
}

const expectedCommands = ["vsnetrunner.run", "vsnetrunner.runNoArgs", "vsnetrunner.debug"];
for (const cmd of expectedCommands) {
    if (!commands.some(c => c.command === cmd)) {
        fail(`Missing required command: ${cmd}`);
    }
}

const menus = manifest.contributes?.menus?.["explorer/context"];
if (!Array.isArray(menus) || menus.length < 3) {
    fail("The extension must register at least 3 explorer/context menu items.");
}

console.log(`Validated ${manifest.publisher}.${manifest.name}@${manifest.version}`);

function fail(message) {
    console.error(message);
    process.exit(1);
}
