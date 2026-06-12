# .NET Runner

🎯 Build, run and debug .NET Framework projects directly from VS Code's Explorer context menu.

.NET Runner reads a `.netrunner` JSON file placed in a project folder and
generates the full build + run pipeline: compile dependencies, build the main
project, set environment variables, launch IIS Express or an executable, and
optionally attach the Visual Studio 2022 debugger — all from a single
right-click.

## ✨ Context Menu Commands

Right-click any folder in the Explorer to see:

| Command | Description |
| --- | --- |
| **Run .NET** | Build and run with configured args |
| **Run .NET Without Args** | Build and run ignoring `run.args` |
| **Run .NET With Debugger** | Build, run and attach VS 2022 debugger |

If the folder has no `.netrunner` file, a warning is shown with nearby
folders that do.

## 📋 Requirements

- Windows
- Visual Studio 2022 (MSBuild + optional debugger attach)
- IIS Express (for web projects)

## ⚙️ Settings

The defaults match a standard VS 2022 Community installation:

| Setting | Default |
| --- | --- |
| `vsnetrunner.msbuildPath` | `C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe` |
| `vsnetrunner.iisExpressPath` | `C:\Program Files\IIS Express\iisexpress.exe` |
| `vsnetrunner.devenvPath` | `C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\devenv.exe` |

## 📄 `.netrunner` File

Place a `.netrunner` file in the project folder. All paths are relative to that folder.

### Schema

```jsonc
{
  "project": "MyProject.csproj",       // required — project file to build
  "build": {
    "configuration": "Debug",           // optional — default "Debug"
    "dependencies": [                   // optional — built before the main project
      { "project": "../lib/Lib.vbproj", "configuration": "Debug" }
    ]
  },
  "run": {
    "type": "iisexpress | exe | none",  // how to launch after build
    "iisConfig": "path/to/applicationhost.config",
    "site": "SiteName",                 // IIS Express site name
    "port": 1234,                       // kills process on this port before launch
    "exe": "bin/Debug/App.exe",         // path to executable
    "args": ["--flag", "value"],        // command-line arguments
    "env": { "KEY": "VALUE" }           // environment variables set before launch
  },
  "debug": {
    "type": "attach-vs | args | none",  // debugger strategy
    "args": ["/debug"]                  // args used instead of run.args in debug mode
  }
}
```

## 📚 Examples

### ASP.NET Web Project (IIS Express + debugger attach)

```json
{
  "project": "Secure.vbproj",
  "build": {
    "configuration": "Debug",
    "dependencies": [
      { "project": "../../library/Library.vbproj" }
    ]
  },
  "run": {
    "type": "iisexpress",
    "iisConfig": "../.vs/secure/config/applicationhost.config",
    "site": "Secure",
    "port": 6799,
    "env": { "SCI_DEBUGGER": "1" }
  },
  "debug": { "type": "attach-vs" }
}
```

### Console Executable (with debug args)

```json
{
  "project": "Hangfire Instance.csproj",
  "build": { "configuration": "Debug" },
  "run": {
    "type": "exe",
    "exe": "bin/Debug/net48/ServerProcess.exe",
    "args": ["/test"]
  },
  "debug": {
    "type": "args",
    "args": ["/test"]
  }
}
```

### Class Library (build only)

```json
{
  "project": "Library.vbproj",
  "build": { "configuration": "Debug" }
}
```

### Console App without dependencies

```json
{
  "project": "Simplifica Data Sync.csproj",
  "build": {
    "configuration": "Debug",
    "dependencies": [
      { "project": "../library/Library.vbproj" }
    ]
  },
  "run": {
    "type": "exe",
    "exe": "bin/Debug/net6.0/Simplifica Data Sync.exe"
  }
}
```

## 🔎 How It Works

1. Reads `.netrunner` from the right-clicked folder.
2. Generates a temporary `.cmd` script with MSBuild + launch commands.
3. Opens a VS Code terminal (`cmd.exe`) and runs the script.
4. If debug mode with `attach-vs`, spawns a PowerShell script that connects
   to Visual Studio 2022 via COM (`VisualStudio.DTE.17.0`) and attaches the
   debugger to the running IIS Express process.
5. Cleans up temporary files automatically.

## 📄 License

Distributed under the [MIT License](LICENSE).
