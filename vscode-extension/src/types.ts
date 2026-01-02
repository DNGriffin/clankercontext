/**
 * Type definitions for ClankerContext VSCode extension
 */

export interface HealthResponse {
  healthy: boolean;
  version: string;
  copilotAvailable: boolean;
  workspaceName: string;
  workspacePath: string;
  instanceId: string;
  port: number;
  pid: number;
  uptime: number;
}

export interface InstanceInfo {
  id: string;
  name: string;
  workspacePath: string;
  port: number;
  pid: number;
  lastHeartbeat: number;
}

export interface InstancesResponse {
  instances: InstanceInfo[];
}

export interface SendRequest {
  content: string;
}

export interface SendResponse {
  success: boolean;
  error?: string;
}

export interface RegistryData {
  instances: InstanceInfo[];
}
