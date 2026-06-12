import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { VsNetRunnerConfig } from "./vsnetrunner";
import { spawnAttachVS2022 } from "./attachVS";

function getMSBuildPath(): string {
  return (
    vscode.workspace
      .getConfiguration("vsnetrunner")
      .get<string>("msbuildPath") ||
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe"
  );
}

function getIISExpressPath(): string {
  return (
    vscode.workspace
      .getConfiguration("vsnetrunner")
      .get<string>("iisExpressPath") ||
    "C:\\Program Files\\IIS Express\\iisexpress.exe"
  );
}

function resolveWin(base: string, rel: string): string {
  return path.resolve(base, rel.replace(/\//g, "\\"));
}

function parseConfig(configPath: string): VsNetRunnerConfig {
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw) as VsNetRunnerConfig;
}

type RunMode = "run" | "run-no-args" | "debug";

function buildRunScript(
  folderPath: string,
  config: VsNetRunnerConfig,
  mode: RunMode
): string {
  const lines: string[] = ["@echo off"];
  const msbuild = getMSBuildPath();
  const cfg = config.build?.configuration ?? "Debug";

  // Build dependencies first
  for (const dep of config.build?.dependencies ?? []) {
    const depProject = resolveWin(folderPath, dep.project);
    const depCfg = dep.configuration ?? cfg;
    lines.push(
      `echo [dotnet-runner] Compilando dependencia: ${path.basename(dep.project)}...`
    );
    lines.push(
      `"${msbuild}" "${depProject}" /p:Configuration=${depCfg} /nologo /v:minimal`
    );
    lines.push(
      `if %ERRORLEVEL% neq 0 (echo [dotnet-runner] Erro: build falhou em ${path.basename(dep.project)} & exit /b 1)`
    );
  }

  // Build main project
  const mainProject = resolveWin(folderPath, config.project);
  lines.push(
    `echo [dotnet-runner] Compilando: ${path.basename(config.project)}...`
  );
  lines.push(
    `"${msbuild}" "${mainProject}" /p:Configuration=${cfg} /nologo /v:minimal`
  );
  lines.push(
    `if %ERRORLEVEL% neq 0 (echo [dotnet-runner] Erro: build falhou & exit /b 1)`
  );

  const run = config.run;
  if (!run || run.type === "none") {
    return lines.join("\r\n");
  }

  // Set env vars
  for (const [k, v] of Object.entries(run.env ?? {})) {
    lines.push(`set ${k}=${v}`);
  }

  // Debug with args override (exe type)
  if (mode === "debug" && config.debug?.type === "args") {
    const exePath = resolveWin(folderPath, run.exe ?? "");
    const debugArgs = (config.debug.args ?? []).join(" ");
    lines.push(`echo [dotnet-runner] Iniciando com args de debug...`);
    lines.push(`"${exePath}"${debugArgs ? " " + debugArgs : ""}`);
    return lines.join("\r\n");
  }

  if (run.type === "iisexpress") {
    // Kill process holding the port before starting
    if (run.port) {
      lines.push(
        `for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":${run.port} "') do taskkill /F /PID %%a >NUL 2>NUL`
      );
    }
    const iisExpress = getIISExpressPath();
    const iisConfig = resolveWin(folderPath, run.iisConfig ?? "");
    lines.push(`echo [dotnet-runner] Iniciando IIS Express...`);
    lines.push(`"${iisExpress}" /config:"${iisConfig}" /site:${run.site}`);
  } else if (run.type === "exe") {
    const exePath = resolveWin(folderPath, run.exe ?? "");
    const skipArgs = mode === "run-no-args";
    const args = skipArgs ? "" : (run.args ?? []).join(" ");
    lines.push(
      `echo [dotnet-runner] Iniciando executavel${skipArgs ? " (sem args)" : ""}...`
    );
    lines.push(`"${exePath}"${args ? " " + args : ""}`);
  }

  return lines.join("\r\n");
}

function getOrCreateTerminal(name: string): vscode.Terminal {
  const existing = vscode.window.terminals.find((t) => t.name === name);
  if (existing) {
    existing.dispose();
  }
  return vscode.window.createTerminal({ name, shellPath: "cmd.exe" });
}

function execute(folderPath: string, configPath: string, mode: RunMode): void {
  let config: VsNetRunnerConfig;
  try {
    config = parseConfig(configPath);
  } catch (e) {
    vscode.window.showErrorMessage(
      `.NET Runner: erro ao ler .netrunner — ${e}`
    );
    return;
  }

  const script = buildRunScript(folderPath, config, mode);
  const tmpFile = path.join(os.tmpdir(), `vsnet-run-${Date.now()}.cmd`);
  fs.writeFileSync(tmpFile, script, { encoding: "utf8" });

  const folderName = path.basename(folderPath);
  const suffix =
    mode === "debug" ? " [Debug]" : mode === "run-no-args" ? " [No Args]" : "";
  const terminalName = `Run .NET${suffix} — ${folderName}`;

  const terminal = getOrCreateTerminal(terminalName);
  terminal.show();
  terminal.sendText(`"${tmpFile}"`);

  // Clean up tmp script after 30s
  setTimeout(() => {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* ignorado */
    }
  }, 30000);

  // Attach VS 2022 debugger when running IIS Express with debug mode
  if (
    mode === "debug" &&
    config.debug?.type === "attach-vs" &&
    config.run?.type === "iisexpress"
  ) {
    const mainProject = resolveWin(folderPath, config.project);
    spawnAttachVS2022(mainProject);
  }
}

export function runDotNet(folderPath: string, configPath: string): void {
  execute(folderPath, configPath, "run");
}

export function runDotNetNoArgs(folderPath: string, configPath: string): void {
  execute(folderPath, configPath, "run-no-args");
}

export function debugDotNet(folderPath: string, configPath: string): void {
  execute(folderPath, configPath, "debug");
}
