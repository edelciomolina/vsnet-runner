import * as cp from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

function getDevEnvPath(): string {
  return (
    vscode.workspace
      .getConfiguration("vsnetrunner")
      .get<string>("devenvPath") ||
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\Common7\\IDE\\devenv.exe"
  );
}

function buildAttachScript(devenvPath: string, projectPath: string): string {
  // Escape backslashes for embedding into PS1 string literals
  const devenvEscaped = devenvPath.replace(/\\/g, "\\\\");
  const projectEscaped = projectPath.replace(/\\/g, "\\\\");

  return `Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class VsNetWinAPI {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

$devenvExe   = "${devenvEscaped}"
$projectFile = "${projectEscaped}"

function Show-VSWindow {
  $vsProc = Get-Process -Name "devenv" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($vsProc -and $vsProc.MainWindowHandle -ne [IntPtr]::Zero) {
    [VsNetWinAPI]::ShowWindow($vsProc.MainWindowHandle, 9) | Out-Null
    [VsNetWinAPI]::SetForegroundWindow($vsProc.MainWindowHandle) | Out-Null
  }
}

Write-Host "[vsnet-runner] Aguardando IIS Express iniciar (6s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 6

$dte = $null
try {
  $dte = [System.Runtime.InteropServices.Marshal]::GetActiveObject("VisualStudio.DTE.17.0")
  Write-Host "[vsnet-runner] Visual Studio 2022 ja esta aberto." -ForegroundColor Green
  Show-VSWindow
} catch {
  Write-Host "[vsnet-runner] Abrindo Visual Studio 2022..." -ForegroundColor Yellow
  Start-Process $devenvExe -ArgumentList $projectFile
  Write-Host "[vsnet-runner] Aguardando VS carregar (25s)..." -ForegroundColor Yellow
  Start-Sleep -Seconds 25
}

$attempts = 0
while ($null -eq $dte -and $attempts -lt 8) {
  try {
    $dte = [System.Runtime.InteropServices.Marshal]::GetActiveObject("VisualStudio.DTE.17.0")
    Write-Host "[vsnet-runner] VS encontrado." -ForegroundColor Green
  } catch {
    Start-Sleep -Seconds 3
  }
  $attempts++
}

if ($null -eq $dte) {
  Write-Host "[vsnet-runner] VS nao respondeu. Faca attach manual: Ctrl+Alt+P > iisexpress" -ForegroundColor Yellow
  exit
}

Start-Sleep -Seconds 5
$attached = $false
$retries = 0

while (-not $attached -and $retries -lt 5) {
  foreach ($proc in $dte.Debugger.LocalProcesses) {
    if ($proc.Name -like "*iisexpress*") {
      try {
        $proc.Attach()
        Write-Host "[vsnet-runner] Debugger anexado! (PID: $($proc.ProcessID))" -ForegroundColor Green
        $dte.MainWindow.Activate()
        Show-VSWindow
        $attached = $true
        break
      } catch {
        Write-Host "[vsnet-runner] Falha no PID $($proc.ProcessID), tentando proximo..." -ForegroundColor Yellow
      }
    }
  }
  if (-not $attached) {
    $retries++
    Start-Sleep -Seconds 3
  }
}

if (-not $attached) {
  Write-Host "[vsnet-runner] Attach manual: VS 2022 > Ctrl+Alt+P > iisexpress" -ForegroundColor Cyan
}
`;
}

export function spawnAttachVS2022(projectPath: string): void {
  const devenv = getDevEnvPath();
  const psContent = buildAttachScript(devenv, projectPath);

  const tmpScript = path.join(os.tmpdir(), `vsnet-attach-${Date.now()}.ps1`);
  fs.writeFileSync(tmpScript, psContent, "utf8");

  cp.spawn("powershell", ["-ExecutionPolicy", "Bypass", "-File", tmpScript], {
    detached: true,
    stdio: "ignore",
    windowsHide: false
  }).unref();

  // Clean up PS1 after 120s (enough for the attach sequence to complete)
  setTimeout(() => {
    try {
      fs.unlinkSync(tmpScript);
    } catch {
      /* ignorado */
    }
  }, 120000);
}
