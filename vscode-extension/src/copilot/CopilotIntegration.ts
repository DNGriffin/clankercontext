/**
 * Copilot Integration - Handles sending prompts to GitHub Copilot Chat
 */

import * as vscode from 'vscode';

const COPILOT_EXTENSION_ID = 'github.copilot-chat';

export class CopilotIntegration {
  /**
   * Check if GitHub Copilot Chat extension is installed and available
   */
  isCopilotAvailable(): boolean {
    const copilotExtension = vscode.extensions.getExtension(COPILOT_EXTENSION_ID);
    return copilotExtension !== undefined;
  }

  /**
   * Send content to Copilot Chat in Agent Mode
   * Opens a new chat with the provided content as the initial prompt
   */
  async sendToCopilot(content: string): Promise<void> {
    if (!this.isCopilotAvailable()) {
      throw new Error('GitHub Copilot Chat extension is not installed');
    }

    // Use the workbench.action.chat.open command with agent mode
    // This opens Copilot Chat with the content as the initial query
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      mode: 'agent',
      query: content,
    });
  }
}

// Export singleton instance
export const copilotIntegration = new CopilotIntegration();
