/**
 * HTTP client for communicating with ClankerContext VSCode extension.
 * VSCode extension runs a local HTTP server to receive prompts and send them to Copilot Chat.
 */

import type { VSCodeInstance } from '@/shared/types';

export interface VSCodeHealthResponse {
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

export interface VSCodeInstancesResponse {
  instances: VSCodeInstance[];
}

// Port range to scan when looking for VSCode instances
const PORT_RANGE_START = 41970;
const PORT_RANGE_END = 41979; // Scan 10 ports

class VSCodeClient {
  /**
   * Check if a VSCode extension server is healthy and running.
   */
  async checkHealth(endpoint: string): Promise<VSCodeHealthResponse> {
    const url = `${endpoint}/health`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all registered VSCode instances from the extension server.
   * Note: This returns raw instances from the registry, which may include stale entries.
   * Use discoverInstances() for verified, live instances.
   */
  async getInstances(endpoint: string): Promise<VSCodeInstance[]> {
    const url = `${endpoint}/instances`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get instances: ${response.status} ${response.statusText}`);
    }

    const data: VSCodeInstancesResponse = await response.json();
    return data.instances;
  }

  /**
   * Find any available VSCode server by scanning ports.
   * Returns the first responding server's endpoint, or null if none found.
   */
  async findAvailableServer(): Promise<string | null> {
    // Scan ports in parallel for speed
    const portChecks = [];
    for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
      portChecks.push(
        this.checkHealthWithTimeout(`http://localhost:${port}`, 500)
          .then(() => port)
          .catch(() => null)
      );
    }

    const results = await Promise.all(portChecks);
    const availablePort = results.find(port => port !== null);

    if (availablePort) {
      return `http://localhost:${availablePort}`;
    }
    return null;
  }

  /**
   * Discover and verify live VSCode instances.
   * Fetches instances from registry, then verifies each one is actually running
   * by checking its health endpoint on its specific port.
   *
   * If the configured endpoint is down, scans ports to find any available server.
   */
  async discoverInstances(endpoint: string): Promise<VSCodeInstance[]> {
    let registeredInstances: VSCodeInstance[] = [];

    // Try configured endpoint first
    try {
      registeredInstances = await this.getInstances(endpoint);
    } catch {
      // Configured endpoint failed - scan for any available server
      console.log(`Configured endpoint ${endpoint} failed, scanning for available servers...`);
      const availableEndpoint = await this.findAvailableServer();

      if (availableEndpoint) {
        console.log(`Found available server at ${availableEndpoint}`);
        try {
          registeredInstances = await this.getInstances(availableEndpoint);
        } catch {
          // Even the discovered server failed to return instances
          console.log(`Failed to get instances from ${availableEndpoint}`);
        }
      } else {
        console.log('No VSCode servers found on any port');
      }
    }

    if (registeredInstances.length === 0) {
      return [];
    }

    // Verify each instance is actually alive by checking its health endpoint
    const verifiedInstances: VSCodeInstance[] = [];

    await Promise.all(
      registeredInstances.map(async (instance) => {
        try {
          const health = await this.checkHealthWithTimeout(
            `http://localhost:${instance.port}`,
            2000 // 2 second timeout
          );

          // Verify the health response matches this instance
          if (health.healthy && health.instanceId === instance.id) {
            verifiedInstances.push(instance);
          }
        } catch {
          // Instance is dead or not responding - skip it
          console.log(`VSCode instance ${instance.id} on port ${instance.port} is not responding`);
        }
      })
    );

    return verifiedInstances;
  }

  /**
   * Check health with a timeout
   */
  private async checkHealthWithTimeout(endpoint: string, timeoutMs: number): Promise<VSCodeHealthResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${endpoint}/health`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Send markdown content to a specific VSCode instance's Copilot Chat.
   * Uses the instance's port to construct the URL since each VSCode window runs on its own port.
   */
  async sendMessage(instanceId: string, instancePort: number, content: string): Promise<void> {
    const url = `http://localhost:${instancePort}/instance/${instanceId}/send`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as { error?: string }).error || `${response.status} ${response.statusText}`;
      throw new Error(`Failed to send message: ${errorMessage}`);
    }
  }
}

// Export singleton instance
export const vsCodeClient = new VSCodeClient();
