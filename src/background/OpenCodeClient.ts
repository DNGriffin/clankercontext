/**
 * HTTP client for communicating with OpenCode server.
 * OpenCode is an agentic CLI coding tool with a local HTTP API.
 */

export interface OpenCodeHealthResponse {
  healthy: boolean;
  version: string;
}

export interface OpenCodeSessionInfo {
  id: string;
  projectID: string;
  directory: string;
  parentID?: string;
  title: string;
  version: string;
  time: {
    created: number;
    updated: number;
    compacting?: number;
    archived?: number;
  };
}

export interface OpenCodeSessionStatus {
  type: 'idle' | 'busy' | 'retry';
}

class OpenCodeClient {
  /**
   * Check if an OpenCode server is healthy and running.
   */
  async checkHealth(endpoint: string): Promise<OpenCodeHealthResponse> {
    const url = `${endpoint}/global/health`;
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
   * Get all active sessions from an OpenCode server.
   */
  async getSessions(endpoint: string): Promise<OpenCodeSessionInfo[]> {
    const url = `${endpoint}/session`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get sessions: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Send a text message to an OpenCode session.
   */
  async sendMessage(endpoint: string, sessionId: string, text: string): Promise<void> {
    const url = `${endpoint}/session/${sessionId}/message`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parts: [
          {
            type: 'text',
            text,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
    }

    // Response is streamed but we just need to confirm it was accepted
  }

  /**
   * Get the status of a specific session (idle, busy, or retry).
   * Returns idle if session not found in status map (OpenCode default behavior).
   */
  async getSessionStatus(endpoint: string, sessionId: string): Promise<OpenCodeSessionStatus> {
    const url = `${endpoint}/session/status`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get session status: ${response.status} ${response.statusText}`);
    }

    const statuses: Record<string, OpenCodeSessionStatus> = await response.json();

    // If session not in map, it defaults to idle (OpenCode behavior)
    return statuses[sessionId] ?? { type: 'idle' };
  }
}

// Export singleton instance
export const openCodeClient = new OpenCodeClient();
