/**
 * HTTP Server - Local server for receiving prompts from ClankerContext Chrome Extension
 */

import * as http from 'http';
import { InstanceRegistry } from '../registry/InstanceRegistry';
import { copilotIntegration } from '../copilot/CopilotIntegration';
import {
  HealthResponse,
  InstancesResponse,
  SendRequest,
  SendResponse,
} from '../types';

const MAX_PORT_ATTEMPTS = 100; // Try ports 41970-42069
const MAX_BODY_SIZE = 1024 * 1024; // 1MB limit to prevent memory exhaustion

// CORS: Only allow requests from browser extensions
// Block requests from web origins (https://, http:// except localhost)
const ALLOWED_ORIGIN_PREFIXES = [
  'chrome-extension://',  // Chrome + Chromium forks (Edge, Brave, Opera, etc.)
  'moz-extension://',     // Firefox
];

function isAllowedOrigin(origin: string | undefined): boolean {
  // No origin = request from extension service worker, curl, or same-origin (safe)
  if (!origin || origin === 'null') return true;

  // Allow browser extension origins
  if (ALLOWED_ORIGIN_PREFIXES.some(prefix => origin.startsWith(prefix))) {
    return true;
  }

  // Block web origins (anything with http:// or https:// that isn't an extension)
  return false;
}

export class HttpServer {
  private server: http.Server | null = null;
  private port: number;
  private registry: InstanceRegistry;
  private startTime: number = 0;

  constructor(registry: InstanceRegistry, port: number) {
    this.registry = registry;
    this.port = port;
  }

  /**
   * Parse JSON request body with size limit
   */
  private parseBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let body = '';
      let size = 0;
      req.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BODY_SIZE) {
          reject(new Error('Request body too large'));
          req.destroy();
          return;
        }
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * Send JSON response
   */
  private sendJson(res: http.ServerResponse, statusCode: number, data: unknown, origin?: string): void {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (origin) {
      headers['Access-Control-Allow-Origin'] = origin;
    }
    res.writeHead(statusCode, headers);
    res.end(JSON.stringify(data));
  }

  /**
   * Handle CORS preflight
   */
  private handleCors(res: http.ServerResponse, origin: string | undefined): void {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (origin) {
      headers['Access-Control-Allow-Origin'] = origin;
    }
    res.writeHead(204, headers);
    res.end();
  }

  /**
   * Handle GET /health
   */
  private handleHealth(res: http.ServerResponse, origin: string | undefined): void {
    const response: HealthResponse = {
      healthy: true,
      version: this.registry.getVersion(),
      copilotAvailable: copilotIntegration.isCopilotAvailable(),
      workspaceName: this.registry.getWorkspaceName(),
      workspacePath: this.registry.getWorkspacePath(),
      instanceId: this.registry.getId(),
      port: this.port,
      pid: this.registry.getPid(),
      uptime: this.startTime > 0 ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
    };
    this.sendJson(res, 200, response, origin);
  }

  /**
   * Handle GET /instances
   */
  private handleGetInstances(res: http.ServerResponse, origin: string | undefined): void {
    const instances = this.registry.getAllInstances();
    const response: InstancesResponse = { instances };
    this.sendJson(res, 200, response, origin);
  }

  /**
   * Handle POST /instance/{id}/send
   */
  private async handleSend(
    res: http.ServerResponse,
    instanceId: string,
    body: SendRequest,
    origin: string | undefined
  ): Promise<void> {
    // Check if this request is for this instance
    if (instanceId !== this.registry.getId()) {
      // Not for us - return 404
      const response: SendResponse = {
        success: false,
        error: 'Instance not found on this server',
      };
      this.sendJson(res, 404, response, origin);
      return;
    }

    // Validate content
    if (!body.content || typeof body.content !== 'string') {
      const response: SendResponse = {
        success: false,
        error: 'Missing or invalid content',
      };
      this.sendJson(res, 400, response, origin);
      return;
    }

    // Check if Copilot is available
    if (!copilotIntegration.isCopilotAvailable()) {
      const response: SendResponse = {
        success: false,
        error: 'GitHub Copilot Chat is not installed',
      };
      this.sendJson(res, 503, response, origin);
      return;
    }

    try {
      // Send to Copilot Chat
      await copilotIntegration.sendToCopilot(body.content);

      const response: SendResponse = { success: true };
      this.sendJson(res, 200, response, origin);
    } catch (err) {
      const response: SendResponse = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
      this.sendJson(res, 500, response, origin);
    }
  }

  /**
   * Request handler
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const { method, url, headers } = req;
    const origin = headers.origin;

    // Validate origin - only allow browser extensions
    if (!isAllowedOrigin(origin)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: invalid origin' }));
      return;
    }

    // Origin is validated - may be undefined for extension service worker requests
    const validOrigin = origin || undefined;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      this.handleCors(res, validOrigin);
      return;
    }

    // Parse URL
    const parsedUrl = new URL(url || '/', `http://localhost:${this.port}`);
    const pathname = parsedUrl.pathname;

    try {
      // Route: GET /health
      if (method === 'GET' && pathname === '/health') {
        this.handleHealth(res, validOrigin);
        return;
      }

      // Route: GET /instances
      if (method === 'GET' && pathname === '/instances') {
        this.handleGetInstances(res, validOrigin);
        return;
      }

      // Route: POST /instance/{id}/send
      const sendMatch = pathname.match(/^\/instance\/([^/]+)\/send$/);
      if (method === 'POST' && sendMatch) {
        const instanceId = sendMatch[1];
        const body = (await this.parseBody(req)) as SendRequest;
        await this.handleSend(res, instanceId, body, validOrigin);
        return;
      }

      // 404 for unknown routes
      this.sendJson(res, 404, { error: 'Not found' }, validOrigin);
    } catch (err) {
      console.error('Request handler error:', err);
      this.sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Internal server error',
      }, validOrigin);
    }
  }

  /**
   * Get the actual port the server is running on
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Start the HTTP server, trying multiple ports if needed
   */
  start(): Promise<number> {
    this.startTime = Date.now();
    return this.tryPort(this.port);
  }

  /**
   * Try to start the server on a specific port, incrementing if in use
   */
  private tryPort(port: number, maxAttempts: number = MAX_PORT_ATTEMPTS): Promise<number> {
    return new Promise((resolve, reject) => {
      if (maxAttempts <= 0) {
        reject(new Error('Could not find an available port'));
        return;
      }

      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch(err => {
          console.error('Unhandled request error:', err);
        });
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          // Port is in use - try the next port
          console.log(`Port ${port} is in use, trying ${port + 1}...`);
          this.server = null;
          this.tryPort(port + 1, maxAttempts - 1).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });

      // Bind to localhost only for security
      this.server.listen(port, '127.0.0.1', () => {
        this.port = port; // Update the port to the one we're actually using
        console.log(`ClankerContext server listening on http://127.0.0.1:${port}`);
        resolve(port);
      });
    });
  }

  /**
   * Stop the HTTP server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }
}
