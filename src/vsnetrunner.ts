export interface BuildDependency {
  project: string;
  configuration?: string;
}

export interface RunConfig {
  type: "iisexpress" | "exe" | "none";
  // iisexpress
  iisConfig?: string;
  site?: string;
  port?: number;
  // exe
  exe?: string;
  args?: string[];
  // shared
  env?: Record<string, string>;
}

export interface DebugConfig {
  type: "attach-vs" | "args" | "none";
  args?: string[];
}

export interface VsNetRunnerConfig {
  project: string;
  build?: {
    configuration?: string;
    dependencies?: BuildDependency[];
  };
  run?: RunConfig;
  debug?: DebugConfig;
}
