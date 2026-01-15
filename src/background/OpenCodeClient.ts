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

export interface OpenCodeProjectInfo {
  id: string;
  worktree: string;  // The project directory path
  name?: string;
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
   * Get sessions from an OpenCode server.
   * @param endpoint - The OpenCode server endpoint
   * @param directory - Optional directory path to set the project context
   */
  async getSessions(endpoint: string, directory?: string): Promise<OpenCodeSessionInfo[]> {
    let url = `${endpoint}/session`;
    if (directory) {
      url = `${url}?directory=${encodeURIComponent(directory)}`;
    }
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
   * Get all sessions across all known projects.
   * Fetches projects first, then gets sessions for each project via /session?directory=.
   * Falls back to plain /session if /project fails or returns empty (for older OpenCode versions).
   */
  async getAllSessions(endpoint: string): Promise<{ sessions: OpenCodeSessionInfo[]; projects: OpenCodeProjectInfo[] }> {
    // Try to get all known projects (may fail on older OpenCode versions)
    let projects: OpenCodeProjectInfo[] = [];
    try {
      projects = await this.getProjects(endpoint);
    } catch {
      // /project endpoint not available, fall back to plain /session
    }

    // If no projects found, fall back to plain /session call
    if (projects.length === 0) {
      const sessions = await this.getSessions(endpoint);
      return { sessions, projects: [] };
    }

    // Fetch sessions from each project directory in parallel
    const sessionPromises = projects.map(async (project) => {
      try {
        return await this.getSessions(endpoint, project.worktree);
      } catch {
        // If fetching sessions for a specific project fails, return empty array
        return [];
      }
    });

    const sessionsPerProject = await Promise.all(sessionPromises);

    // Flatten and deduplicate sessions (in case same session appears in multiple queries)
    const sessionMap = new Map<string, OpenCodeSessionInfo>();
    for (const projectSessions of sessionsPerProject) {
      for (const session of projectSessions) {
        sessionMap.set(session.id, session);
      }
    }

    return {
      sessions: Array.from(sessionMap.values()),
      projects,
    };
  }

  /**
   * Send a text message to an OpenCode session.
   * @param endpoint - The OpenCode server endpoint
   * @param sessionId - The session ID to send the message to
   * @param text - The message text
   * @param directory - The project directory (required for Instance scoping)
   */
  async sendMessage(endpoint: string, sessionId: string, text: string, directory: string): Promise<void> {
    const url = `${endpoint}/session/${sessionId}/message`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-opencode-directory': directory,
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

  /**
   * Get all known projects from an OpenCode server.
   */
  async getProjects(endpoint: string): Promise<OpenCodeProjectInfo[]> {
    const url = `${endpoint}/project`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get projects: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

}

// Export singleton instance
export const openCodeClient = new OpenCodeClient();
