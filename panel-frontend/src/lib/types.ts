export type AppStatus =
  | "running"
  | "error"
  | "deploying"
  | "pending"
  | "stopped";
export type AppType = "laravel" | "nextjs";

export interface App {
  slug: string;
  name: string;
  type: AppType;
  domain: string;
  port?: number;
  status: AppStatus;
  dbName?: string;
  sslEnabled?: boolean;
  lastDeploy?: string;
  branch?: string;
  repoUrl?: string;
}

export interface AppsResponse {
  apps: App[];
}

export interface AppResponse {
  app: App;
}

export interface DeployPayload {
  name: string;
  repoUrl: string;
  domain: string;
  type: AppType;
  branch: string;
  createDb: boolean;
}

export interface UiStatusResponse {
  status: "online" | "stopped" | "errored" | "missing";
}
