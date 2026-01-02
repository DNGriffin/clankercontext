/**
 * ClankerContext for VSCode - Main Extension Entry Point
 *
 * This extension creates a local HTTP server that receives prompts from the
 * ClankerContext Chrome Extension and sends them to GitHub Copilot Chat.
 */

import * as vscode from 'vscode';
import { HttpServer } from './server/HttpServer';
import { InstanceRegistry } from './registry/InstanceRegistry';
import { copilotIntegration } from './copilot/CopilotIntegration';

let server: HttpServer | null = null;
let registry: InstanceRegistry | null = null;

/**
 * Get the current workspace name
 */
function getWorkspaceName(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].name;
  }
  return 'Untitled';
}

/**
 * Get the current workspace path
 */
function getWorkspacePath(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }
  // Use a unique identifier for untitled workspaces
  return `untitled-${process.pid}`;
}

/**
 * Start the ClankerContext server
 */
async function startServer(): Promise<void> {
  if (server && server.isRunning()) {
    vscode.window.showInformationMessage('ClankerContext server is already running');
    return;
  }

  const config = vscode.workspace.getConfiguration('clankercontext');
  const preferredPort = config.get<number>('port') || 41970;

  const workspacePath = getWorkspacePath();
  const workspaceName = getWorkspaceName();

  // Create registry (don't register yet - we need to know the actual port first)
  registry = new InstanceRegistry(workspacePath, workspaceName, preferredPort);

  // Create and start server - it will find an available port
  server = new HttpServer(registry, preferredPort);

  try {
    const actualPort = await server.start();

    // Update registry with actual port and register (async with file locking)
    registry.setPort(actualPort);
    await registry.register();

    vscode.window.showInformationMessage(
      `ClankerContext server started on port ${actualPort}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to start ClankerContext server: ${message}`);
  }
}

/**
 * Stop the ClankerContext server
 */
async function stopServer(): Promise<void> {
  if (registry) {
    await registry.unregister();
    registry = null;
  }

  if (server) {
    await server.stop();
    server = null;
    vscode.window.showInformationMessage('ClankerContext server stopped');
  }
}

/**
 * Show server status
 */
function showStatus(): void {
  const copilotAvailable = copilotIntegration.isCopilotAvailable();
  const serverRunning = server?.isRunning() || false;
  const actualPort = server?.getPort() || 'N/A';

  const statusLines = [
    `ClankerContext Status:`,
    `- Server: ${serverRunning ? 'Running' : 'Not running'}`,
    `- Port: ${actualPort}`,
    `- PID: ${registry?.getPid() || process.pid}`,
    `- Copilot: ${copilotAvailable ? 'Available' : 'Not installed'}`,
    `- Workspace: ${getWorkspaceName()}`,
    `- Instance ID: ${registry?.getId() || 'Not registered'}`,
  ];

  vscode.window.showInformationMessage(statusLines.join('\n'), { modal: true });
}

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Register commands
  const startCmd = vscode.commands.registerCommand('clankercontext.startServer', startServer);
  const stopCmd = vscode.commands.registerCommand('clankercontext.stopServer', stopServer);
  const statusCmd = vscode.commands.registerCommand('clankercontext.showStatus', showStatus);

  context.subscriptions.push(startCmd, stopCmd, statusCmd);

  // Auto-start if configured
  const config = vscode.workspace.getConfiguration('clankercontext');
  const autoStart = config.get<boolean>('autoStart');

  if (autoStart !== false) {
    // Small delay to let VSCode fully initialize
    setTimeout(() => {
      startServer().catch(() => {
        // Server start failure is already shown to user via showErrorMessage
      });
    }, 1000);
  }
}

/**
 * Extension deactivation
 */
export async function deactivate(): Promise<void> {
  await stopServer();
}
