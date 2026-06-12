import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { runDotNet, runDotNetNoArgs, debugDotNet } from "./runner";

const CONFIG_FILE = ".netrunner";

type RunMode = "run" | "run-no-args" | "debug";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("vsnetrunner.run", (uri: vscode.Uri) =>
      handle(uri, "run")
    ),
    vscode.commands.registerCommand(
      "vsnetrunner.runNoArgs",
      (uri: vscode.Uri) => handle(uri, "run-no-args")
    ),
    vscode.commands.registerCommand("vsnetrunner.debug", (uri: vscode.Uri) =>
      handle(uri, "debug")
    )
  );
}

function findNearbyConfigs(folderPath: string): string[] {
  const results: string[] = [];
  // Check immediate subfolders
  try {
    for (const entry of fs.readdirSync(folderPath, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const candidate = path.join(folderPath, entry.name, CONFIG_FILE);
        if (fs.existsSync(candidate)) {
          results.push(path.join(path.basename(folderPath), entry.name));
        }
      }
    }
  } catch {
    /* ignorado */
  }
  // Check parent folder
  const parentPath = path.dirname(folderPath);
  const parentConfig = path.join(parentPath, CONFIG_FILE);
  if (fs.existsSync(parentConfig)) {
    results.push(path.basename(parentPath));
  }
  return results;
}

function handle(uri: vscode.Uri, mode: RunMode): void {
  if (!uri) {
    vscode.window.showErrorMessage(
      ".NET Runner: clique com botão direito em uma pasta no Explorer."
    );
    return;
  }

  const folderPath = uri.fsPath;
  const configPath = path.join(folderPath, CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    const nearby = findNearbyConfigs(folderPath);
    const folderName = path.basename(folderPath);
    let msg = `.NET Runner: nenhum arquivo ${CONFIG_FILE} encontrado em "${folderName}".`;
    if (nearby.length > 0) {
      msg += ` Encontrado em: ${nearby.join(", ")}.`;
    }
    vscode.window.showWarningMessage(msg);
    return;
  }

  switch (mode) {
    case "run":
      runDotNet(folderPath, configPath);
      break;
    case "run-no-args":
      runDotNetNoArgs(folderPath, configPath);
      break;
    case "debug":
      debugDotNet(folderPath, configPath);
      break;
  }
}

export function deactivate(): void {}
