import type {
  BackgroundToContentMessage,
  ConnectionMutationResponse,
  ConnectionsResponse,
  ContentToBackgroundMessage,
  CustomAttributeMutationResponse,
  CustomAttributesResponse,
  ExportResponse,
  OpenCodeSessionsResponse,
  PopupToBackgroundMessage,
  SendToOpenCodeResponse,
  SendToVSCodeResponse,
  StateResponse,
  TestConnectionResponse,
  VSCodeInstancesResponse,
} from '@/shared/messages';
import type { Connection, CustomAttribute, Issue } from '@/shared/types';
import { isValidAttributeName, isValidSearchDirection } from '@/shared/utils';
import { storageManager } from './StorageManager';
import { sessionStateMachine } from './SessionStateMachine';
import { markdownExporter } from '@/exporter/MarkdownExporter';
import { cdpController } from './CDPController';
import { iconController } from './IconController';
import { openCodeClient } from './OpenCodeClient';
import { vsCodeClient } from './VSCodeClient';
import { initPromise } from './index';

// Track tabs where content script has been injected
const injectedTabs = new Set<number>();

/**
 * Clear injection tracking for a specific tab.
 * Called when switching sessions to a new tab.
 */
export function clearInjectionTracking(tabId: number): void {
  injectedTabs.delete(tabId);
}

// Clean up tracking when tabs are closed or navigated
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    injectedTabs.delete(tabId);
  }
});

/**
 * Inject content script into a tab if not already injected.
 */
async function injectContentScript(tabId: number): Promise<void> {
  if (injectedTabs.has(tabId)) {
    console.log('[MessageRouter] Content script already injected in tab:', tabId);
    return;
  }

  try {
    console.log('[MessageRouter] Injecting content script into tab:', tabId);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    injectedTabs.add(tabId);
    console.log('[MessageRouter] Content script injected successfully');
  } catch (e) {
    // Use warn - injection can fail on restricted pages, and the script
    // might already be there from a previous session
    console.warn('[MessageRouter] Content script injection failed:', e);
    // Still add to injectedTabs to avoid repeated failed attempts
    injectedTabs.add(tabId);
  }
}

/**
 * Download markdown content as a file.
 */
async function downloadMarkdown(content: string, filename: string): Promise<void> {
  const blob = new Blob([content], { type: 'text/markdown' });
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  let binaryString = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binaryString += String.fromCharCode(...chunk);
  }

  const base64 = btoa(binaryString);
  const dataUrl = `data:text/markdown;base64,${base64}`;

  await chrome.downloads.download({
    url: dataUrl,
    filename: filename.endsWith('.md') ? filename : `${filename}.md`,
    saveAs: false,
  });
}

/**
 * Handle messages from the popup.
 */
async function handlePopupMessage(
  message: PopupToBackgroundMessage,
  _sender: chrome.runtime.MessageSender
): Promise<StateResponse | ExportResponse | ConnectionsResponse | ConnectionMutationResponse | TestConnectionResponse | OpenCodeSessionsResponse | SendToOpenCodeResponse | VSCodeInstancesResponse | SendToVSCodeResponse | CustomAttributesResponse | CustomAttributeMutationResponse | boolean> {
  // Wait for initialization to complete (ensures session is rehydrated)
  // This prevents race conditions when service worker restarts
  await initPromise;

  switch (message.type) {
    case 'GET_STATE': {
      const session = sessionStateMachine.getSession();
      let issues: Issue[] = [];

      if (session) {
        issues = await storageManager.getIssues(session.sessionId);
      } else {
        // No active session - try to get issues from the most recent session
        // This preserves issues after extension reload
        const recentSession = await storageManager.getMostRecentSession();
        if (recentSession) {
          issues = await storageManager.getIssues(recentSession.sessionId);
        }
      }

      // Get paused state and auto-sending state
      const storageResult = await chrome.storage.session.get(['isPaused', 'autoSendingIssueId', 'autoSendingConnectionType', 'autoSendError']);
      const isPaused = storageResult.isPaused === true;
      const autoSendingIssueId = storageResult.autoSendingIssueId as string | undefined;
      const autoSendingConnectionType = storageResult.autoSendingConnectionType as 'opencode' | 'vscode' | undefined;
      const autoSendError = storageResult.autoSendError === true;

      return {
        session,
        issues,
        isPaused,
        autoSendingIssueId,
        autoSendingConnectionType,
        autoSendError,
      } as StateResponse;
    }

    case 'START_LISTENING': {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      console.log('[MessageRouter] START_LISTENING - tab:', tab?.id, 'url:', tab?.url);

      if (!tab?.id || !tab.url) {
        throw new Error('No active tab found');
      }

      // Check if this is a restricted page
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('devtools://')) {
        throw new Error('Cannot attach debugger to this page');
      }

      // Check if tab is still loading
      if (tab.status !== 'complete') {
        throw new Error('Page is still loading, please wait');
      }

      // Check if there's a previous session to resume (preserves issues after reload)
      const existingSession = await storageManager.getMostRecentSession();
      const resumedSession = Boolean(existingSession);
      if (existingSession) {
        if (existingSession.tabId !== tab.id) {
          await storageManager.clearErrors(existingSession.sessionId);
        }
        // Resume the existing session on the current tab
        await sessionStateMachine.resumeSession(existingSession, tab.id);
        console.log('[MessageRouter] Resumed existing session:', existingSession.sessionId);
      } else {
        // Start a new monitoring session
        await sessionStateMachine.startMonitoring(tab.id);
      }

      // Attach CDP for error capture - if this fails, clean up the session
      try {
        await cdpController.attach(tab.id);
      } catch (error) {
        // Clean up the session we just created or resumed
        await sessionStateMachine.forceReset(!resumedSession);
        await iconController.showSleepIcon();
        throw error;
      }

      // Ensure not paused
      await chrome.storage.session.set({ isPaused: false });

      // Show active icon
      await iconController.showActiveIcon();

      return true;
    }

    case 'PAUSE_LISTENING': {
      // Detach CDP to stop monitoring
      if (cdpController.isAttached()) {
        await cdpController.detach();
      }

      // Store paused state
      await chrome.storage.session.set({ isPaused: true });

      // Show sleep icon
      await iconController.showSleepIcon();

      return true;
    }

    case 'RESUME_LISTENING': {
      const session = sessionStateMachine.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Get current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      console.log('[MessageRouter] RESUME_LISTENING - tab:', tab?.id, 'url:', tab?.url);

      if (!tab?.id) {
        throw new Error('No active tab found');
      }

      // Check if this is a restricted page
      if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('devtools://')) {
        throw new Error('Cannot attach debugger to this page');
      }

      // If tab changed while paused, update session to current tab
      if (session.tabId !== tab.id) {
        await storageManager.clearErrors(session.sessionId);
        await sessionStateMachine.switchTab(tab.id);
        clearInjectionTracking(tab.id);
      }

      // Re-attach CDP to current tab
      if (!cdpController.isAttached()) {
        await cdpController.attach(tab.id);
      }

      // Clear paused state
      await chrome.storage.session.set({ isPaused: false });

      // Show active icon
      await iconController.showActiveIcon();

      return true;
    }

    case 'START_ISSUE': {
      let session = sessionStateMachine.getSession();

      // Start monitoring if not already
      if (!session) {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (!tab?.id || !tab.url) {
          throw new Error('No active tab found');
        }

        // Start monitoring
        session = await sessionStateMachine.startMonitoring(tab.id);

        // Attach CDP for error capture
        await cdpController.attach(tab.id);
      }

      // Inject content script
      await injectContentScript(session.tabId);

      // Delay to ensure script is initialized
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Start element selection
      await sessionStateMachine.startElementSelection(message.issueType);

      // Fetch custom attributes to pass to content script
      const customAttributes = await storageManager.getCustomAttributes();

      // Tell content script to start element picker
      console.log('[MessageRouter] Sending START_ELEMENT_PICKER to tab:', session.tabId);
      try {
        const response = await chrome.tabs.sendMessage(session.tabId, {
          type: 'START_ELEMENT_PICKER',
          issueType: message.issueType,
          customAttributes,
        } as BackgroundToContentMessage);
        console.log('[MessageRouter] START_ELEMENT_PICKER response:', response);
      } catch (e) {
        console.error('[MessageRouter] Failed to send START_ELEMENT_PICKER:', e);
        // If content script fails, reset element selection state
        await sessionStateMachine.finishElementSelection();
        throw new Error('Could not communicate with page. Try refreshing.');
      }

      // Store pending issue info for when element is selected
      // The issue will be created when ELEMENT_SELECTED is received
      // We need to store the user prompt and name somewhere temporarily
      // For now, we'll create the issue with this info when element is selected

      // Store in session storage temporarily
      await chrome.storage.session.set({
        pendingIssue: {
          userPrompt: message.userPrompt,
          issueType: message.issueType,
        },
      });

      return true;
    }

    case 'EXPORT_ISSUE': {
      // Use active session, or fall back to most recent session (for after reload)
      let session = sessionStateMachine.getSession();
      if (!session) {
        session = await storageManager.getMostRecentSession();
      }
      if (!session) {
        throw new Error('No session found');
      }

      const markdown = await markdownExporter.exportIssue(
        session.sessionId,
        message.issueId
      );

      if (message.format === 'clipboard') {
        return { success: true, markdown };
      } else {
        const issues = await storageManager.getIssues(session.sessionId);
        const issue = issues.find((i) => i.id === message.issueId);
        const filename = issue?.name || `issue-${message.issueId}`;
        await downloadMarkdown(markdown, filename);
        return { success: true };
      }
    }

    case 'EXPORT_ALL': {
      // Use active session, or fall back to most recent session (for after reload)
      let session = sessionStateMachine.getSession();
      if (!session) {
        session = await storageManager.getMostRecentSession();
      }
      if (!session) {
        throw new Error('No session found');
      }

      const issues = await storageManager.getIssues(session.sessionId);
      if (issues.length === 0) {
        throw new Error('No issues to export');
      }

      const markdowns = await Promise.all(
        issues.map((issue) =>
          markdownExporter.exportIssue(session.sessionId, issue.id)
        )
      );

      if (message.format === 'clipboard') {
        return {
          success: true,
          markdown: markdowns.join('\n\n---\n\n'),
        };
      } else {
        // Download each as a separate file
        for (let i = 0; i < issues.length; i++) {
          const filename = issues[i].name || `issue-${i + 1}`;
          await downloadMarkdown(markdowns[i], filename);
        }
        return { success: true };
      }
    }

    case 'DELETE_ISSUE': {
      await storageManager.deleteIssue(message.issueId);
      return true;
    }

    case 'MARK_ISSUE_EXPORTED': {
      await storageManager.markIssueExported(message.issueId);
      return true;
    }

    case 'CLEAR_SESSION': {
      // Detach CDP
      if (cdpController.isAttached()) {
        await cdpController.detach();
      }

      // Reset session
      await sessionStateMachine.forceReset(true);

      // Clear injection tracking
      injectedTabs.clear();

      // Show sleep icon (same as paused - not actively monitoring)
      await iconController.showSleepIcon();

      return true;
    }

    case 'GET_CONNECTIONS': {
      const connections = await storageManager.getConnections();
      return { connections } as ConnectionsResponse;
    }

    case 'ADD_CONNECTION': {
      const now = Date.now();
      const connection: Connection = {
        ...message.connection,
        id: `conn_${now}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now,
      };
      await storageManager.addConnection(connection);
      return { success: true, connection } as ConnectionMutationResponse;
    }

    case 'UPDATE_CONNECTION': {
      const updated: Connection = {
        ...message.connection,
        updatedAt: Date.now(),
      };
      await storageManager.updateConnection(updated);
      return { success: true } as ConnectionMutationResponse;
    }

    case 'DELETE_CONNECTION': {
      await storageManager.deleteConnection(message.connectionId);
      return { success: true } as ConnectionMutationResponse;
    }

    case 'TOGGLE_CONNECTION': {
      const connection = await storageManager.getConnectionById(message.connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }
      const toggled: Connection = {
        ...connection,
        enabled: message.enabled,
        updatedAt: Date.now(),
      };
      await storageManager.updateConnection(toggled);
      return { success: true } as ConnectionMutationResponse;
    }

    case 'SET_ACTIVE_CONNECTION': {
      // Get all connections and set the specified one as active, others as inactive
      const allConnections = await storageManager.getConnections();
      for (const conn of allConnections) {
        const updated: Connection = {
          ...conn,
          isActive: conn.id === message.connectionId,
          updatedAt: Date.now(),
        };
        await storageManager.updateConnection(updated);
      }
      return { success: true } as ConnectionMutationResponse;
    }

    case 'TEST_CONNECTION': {
      const connection = await storageManager.getConnectionById(message.connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }
      try {
        if (connection.type === 'opencode') {
          const health = await openCodeClient.checkHealth(connection.endpoint);
          return { success: health.healthy, version: health.version } as TestConnectionResponse;
        } else if (connection.type === 'vscode') {
          // For VSCode, use port scanning to find any available server
          const availableEndpoint = await vsCodeClient.findAvailableServer();
          if (!availableEndpoint) {
            return { success: false, error: 'No VSCode servers found' } as TestConnectionResponse;
          }
          const health = await vsCodeClient.checkHealth(availableEndpoint);
          return { success: health.healthy, version: health.version } as TestConnectionResponse;
        } else {
          throw new Error(`Unknown connection type: ${connection.type}`);
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed',
        } as TestConnectionResponse;
      }
    }

    case 'GET_OPENCODE_SESSIONS': {
      const connection = await storageManager.getConnectionById(message.connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }
      try {
        // Fetch all sessions across all projects
        const { sessions: sessionsRaw, projects } = await openCodeClient.getAllSessions(
          connection.endpoint
        );

        // Build project map for enrichment
        const projectMap = new Map(projects.map((p) => [p.id, p]));

        // Transform to our simplified OpenCodeSession interface with project info
        const sessions = sessionsRaw.map((s) => {
          const project = projectMap.get(s.projectID);
          return {
            id: s.id,
            title: s.title || 'Untitled Session',
            directory: s.directory,
            updatedAt: s.time.updated,
            projectId: s.projectID,
            projectPath: project?.worktree || s.directory,
          };
        });

        // Sort by most recently updated
        sessions.sort((a, b) => b.updatedAt - a.updatedAt);

        return { sessions } as OpenCodeSessionsResponse;
      } catch (error) {
        return {
          sessions: [],
          error: error instanceof Error ? error.message : 'Failed to get sessions',
        } as OpenCodeSessionsResponse;
      }
    }

    case 'SEND_TO_OPENCODE': {
      const connection = await storageManager.getConnectionById(message.connectionId);
      // Use active session, or fall back to most recent session (for after reload)
      let monitoringSession = sessionStateMachine.getSession();
      if (!monitoringSession) {
        monitoringSession = await storageManager.getMostRecentSession();
      }
      if (!connection) {
        throw new Error('Connection not found');
      }
      if (!monitoringSession) {
        throw new Error('No session found');
      }

      // Directory is required for OpenCode's Instance scoping
      if (!connection.selectedSessionDirectory) {
        return {
          success: false,
          error: 'Session directory not set. Please reselect the OpenCode session.',
        } as SendToOpenCodeResponse;
      }

      try {
        const markdown = await markdownExporter.exportIssue(
          monitoringSession.sessionId,
          message.issueId
        );
        await openCodeClient.sendMessage(
          connection.endpoint,
          message.sessionId,
          markdown,
          connection.selectedSessionDirectory
        );
        return { success: true } as SendToOpenCodeResponse;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send to OpenCode',
        } as SendToOpenCodeResponse;
      }
    }

    case 'GET_VSCODE_INSTANCES': {
      const connection = await storageManager.getConnectionById(message.connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }
      try {
        // Use discoverInstances to get only verified, live instances
        const instances = await vsCodeClient.discoverInstances(connection.endpoint);
        return { instances } as VSCodeInstancesResponse;
      } catch (error) {
        return {
          instances: [],
          error: error instanceof Error ? error.message : 'Failed to get instances',
        } as VSCodeInstancesResponse;
      }
    }

    case 'SEND_TO_VSCODE': {
      const connection = await storageManager.getConnectionById(message.connectionId);
      // Use active session, or fall back to most recent session (for after reload)
      let monitoringSession = sessionStateMachine.getSession();
      if (!monitoringSession) {
        monitoringSession = await storageManager.getMostRecentSession();
      }
      if (!connection) {
        throw new Error('Connection not found');
      }
      if (!monitoringSession) {
        throw new Error('No session found');
      }
      if (!connection.selectedInstancePort) {
        throw new Error('Instance port not set - please reselect the VSCode instance');
      }

      try {
        const markdown = await markdownExporter.exportIssue(
          monitoringSession.sessionId,
          message.issueId
        );
        await vsCodeClient.sendMessage(message.instanceId, connection.selectedInstancePort, markdown);
        return { success: true } as SendToVSCodeResponse;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send to VSCode',
        } as SendToVSCodeResponse;
      }
    }

    case 'GET_CUSTOM_ATTRIBUTES': {
      const customAttributes = await storageManager.getCustomAttributes();
      return { customAttributes } as CustomAttributesResponse;
    }

    case 'ADD_CUSTOM_ATTRIBUTE': {
      try {
        // Validate attribute name
        const attrName = message.attribute.name?.trim();
        if (!attrName) {
          return { success: false, error: 'Attribute name is required' } as CustomAttributeMutationResponse;
        }
        if (!isValidAttributeName(attrName)) {
          return {
            success: false,
            error: 'Invalid attribute name. Must start with a letter and contain only letters, numbers, hyphens, or underscores.',
          } as CustomAttributeMutationResponse;
        }

        // Validate search direction
        if (!isValidSearchDirection(message.attribute.searchDirection)) {
          return {
            success: false,
            error: 'Invalid search direction. Must be "parent", "descendant", or "both".',
          } as CustomAttributeMutationResponse;
        }

        // Check for duplicate name
        const existingAttributes = await storageManager.getCustomAttributes();
        const duplicate = existingAttributes.find(
          (a) => a.name.toLowerCase() === attrName.toLowerCase()
        );
        if (duplicate) {
          return {
            success: false,
            error: `Attribute "${attrName}" already exists.`,
          } as CustomAttributeMutationResponse;
        }

        const now = Date.now();
        const customAttribute: CustomAttribute = {
          name: attrName,
          searchDirection: message.attribute.searchDirection,
          id: `attr_${now}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: now,
          updatedAt: now,
        };
        await storageManager.addCustomAttribute(customAttribute);
        return { success: true, customAttribute } as CustomAttributeMutationResponse;
      } catch (error) {
        console.error('[MessageRouter] ADD_CUSTOM_ATTRIBUTE error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to add custom attribute',
        } as CustomAttributeMutationResponse;
      }
    }

    case 'UPDATE_CUSTOM_ATTRIBUTE': {
      try {
        // Validate attribute name
        const attrName = message.attribute.name?.trim();
        if (!attrName) {
          return { success: false, error: 'Attribute name is required' } as CustomAttributeMutationResponse;
        }
        if (!isValidAttributeName(attrName)) {
          return {
            success: false,
            error: 'Invalid attribute name. Must start with a letter and contain only letters, numbers, hyphens, or underscores.',
          } as CustomAttributeMutationResponse;
        }

        // Validate search direction
        if (!isValidSearchDirection(message.attribute.searchDirection)) {
          return {
            success: false,
            error: 'Invalid search direction. Must be "parent", "descendant", or "both".',
          } as CustomAttributeMutationResponse;
        }

        // Check for duplicate name (exclude current attribute)
        const existingAttributes = await storageManager.getCustomAttributes();
        const duplicate = existingAttributes.find(
          (a) => a.name.toLowerCase() === attrName.toLowerCase() && a.id !== message.attribute.id
        );
        if (duplicate) {
          return {
            success: false,
            error: `Attribute "${attrName}" already exists.`,
          } as CustomAttributeMutationResponse;
        }

        const updated: CustomAttribute = {
          id: message.attribute.id,
          name: attrName,
          searchDirection: message.attribute.searchDirection,
          createdAt: message.attribute.createdAt,
          updatedAt: Date.now(),
        };
        await storageManager.updateCustomAttribute(updated);
        return { success: true, customAttribute: updated } as CustomAttributeMutationResponse;
      } catch (error) {
        console.error('[MessageRouter] UPDATE_CUSTOM_ATTRIBUTE error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update custom attribute',
        } as CustomAttributeMutationResponse;
      }
    }

    case 'DELETE_CUSTOM_ATTRIBUTE': {
      try {
        if (!message.attributeId) {
          return { success: false, error: 'Attribute ID is required' } as CustomAttributeMutationResponse;
        }
        await storageManager.deleteCustomAttribute(message.attributeId);
        return { success: true } as CustomAttributeMutationResponse;
      } catch (error) {
        console.error('[MessageRouter] DELETE_CUSTOM_ATTRIBUTE error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete custom attribute',
        } as CustomAttributeMutationResponse;
      }
    }

    case 'QUICK_SELECT': {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id || !tab.url) {
        throw new Error('No active tab found');
      }

      // Check if this is a restricted page
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('devtools://')) {
        throw new Error('Cannot select elements on this page');
      }

      // Inject content script (no session required)
      await injectContentScript(tab.id);

      // Delay to ensure script is initialized
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Fetch custom attributes to pass to content script
      const customAttributes = await storageManager.getCustomAttributes();

      // Tell content script to start element picker in quick select mode
      console.log('[MessageRouter] Sending START_ELEMENT_PICKER (quickSelect) to tab:', tab.id);
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'START_ELEMENT_PICKER',
          issueType: 'enhancement', // Doesn't matter for quick select
          customAttributes,
          quickSelect: true,
        } as BackgroundToContentMessage);
      } catch (e) {
        console.error('[MessageRouter] Failed to send START_ELEMENT_PICKER:', e);
        throw new Error('Could not communicate with page. Try refreshing.');
      }

      return true;
    }

    default:
      throw new Error(`Unknown message type: ${(message as { type: string }).type}`);
  }
}

/**
 * Handle messages from content scripts.
 */
async function handleContentMessage(
  message: ContentToBackgroundMessage,
  sender: chrome.runtime.MessageSender
): Promise<boolean> {
  // Handle QUICK_SELECT_COMPLETE first - doesn't require a session
  if (message.type === 'QUICK_SELECT_COMPLETE') {
    console.log('[MessageRouter] QUICK_SELECT_COMPLETE received with', message.elements.length, 'elements');

    // Generate markdown using buildElementsMarkdown
    const markdown = markdownExporter.buildElementsMarkdown(message.elements);

    // Copy to clipboard via chrome.scripting.executeScript
    const tabId = sender.tab?.id;
    if (tabId) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (text: string) => {
            navigator.clipboard.writeText(text);
          },
          args: [markdown],
        });
        console.log('[MessageRouter] Quick select markdown copied to clipboard');
      } catch (e) {
        console.error('[MessageRouter] Failed to copy to clipboard:', e);
      }
    }

    return true;
  }

  const session = sessionStateMachine.getSession();
  if (!session) {
    console.warn('[MessageRouter] Received content message with no active session');
    return false;
  }

  switch (message.type) {
    case 'ELEMENT_SELECTED': {
      // Get pending issue info from session storage
      const result = await chrome.storage.session.get('pendingIssue');
      const pendingIssue = result.pendingIssue as {
        userPrompt: string;
        issueType: 'enhancement' | 'fix';
      } | undefined;

      if (!pendingIssue) {
        console.error('[MessageRouter] No pending issue info found');
        await sessionStateMachine.finishElementSelection();
        return false;
      }

      // Auto-generate name from prompt or use default
      const autoName = pendingIssue.userPrompt
        ? pendingIssue.userPrompt.slice(0, 40).replace(/[^a-zA-Z0-9\s-]/g, '').trim() ||
          (pendingIssue.issueType === 'enhancement' ? 'Enhancement' : 'Bug fix')
        : pendingIssue.issueType === 'enhancement' ? 'Enhancement' : 'Bug fix';

      // Create the issue with elements array
      const issue: Issue = {
        id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: pendingIssue.issueType,
        timestamp: Date.now(),
        name: autoName,
        userPrompt: pendingIssue.userPrompt,
        elements: message.elements,
        pageUrl: message.pageUrl,
      };

      await storageManager.addIssue(session.sessionId, issue);

      // Clear pending issue
      await chrome.storage.session.remove('pendingIssue');

      // Return to monitoring state
      await sessionStateMachine.finishElementSelection();

      // Check if we should auto-copy to clipboard
      try {
        const { autoCopyOnLog } = await chrome.storage.local.get('autoCopyOnLog');
        // Default to true if not set
        if (autoCopyOnLog !== false) {
          await chrome.storage.session.set({ autoCopyIssueId: issue.id });
        }
      } catch (e) {
        console.warn('[MessageRouter] Failed to check auto-copy setting:', e);
      }

      // Check if we should auto-send BEFORE opening popup
      // Only use the active connection - no fallback
      let shouldAutoSend = false;
      let autoSendConnection: Connection | undefined;
      let autoSendType: 'opencode' | 'vscode' | undefined;

      try {
        const connections = await storageManager.getConnections();

        // Find the active connection
        autoSendConnection = connections.find(
          (c) => c.isActive && c.enabled && c.autoSend !== false
        );

        if (autoSendConnection) {
          if (autoSendConnection.type === 'opencode' && autoSendConnection.selectedSessionId) {
            // Check if session is idle before sending
            const status = await openCodeClient.getSessionStatus(
              autoSendConnection.endpoint,
              autoSendConnection.selectedSessionId
            );
            shouldAutoSend = status.type === 'idle';
            autoSendType = 'opencode';

            if (!shouldAutoSend) {
              console.log('[MessageRouter] OpenCode session busy, skipping auto-send');
            }
          } else if (autoSendConnection.type === 'vscode' && autoSendConnection.selectedInstanceId) {
            // VSCode doesn't have a busy/idle status, so we just send directly
            shouldAutoSend = true;
            autoSendType = 'vscode';
          }
        }
      } catch (e) {
        console.warn('[MessageRouter] Failed to check auto-send eligibility:', e);
      }

      // Set auto-sending state BEFORE opening popup so it shows loading immediately
      if (shouldAutoSend && autoSendType) {
        await chrome.storage.session.set({
          autoSendingIssueId: issue.id,
          autoSendingConnectionType: autoSendType,
        });
      }

      // Open the extension popup
      try {
        await chrome.action.openPopup();
      } catch (e) {
        console.warn('[MessageRouter] Could not open popup:', e);
      }

      // Now do the actual auto-send
      if (shouldAutoSend && autoSendConnection) {
        try {
          const markdown = await markdownExporter.exportIssue(
            session.sessionId,
            issue.id
          );

          if (autoSendType === 'opencode' && autoSendConnection.selectedSessionId && autoSendConnection.selectedSessionDirectory) {
            await openCodeClient.sendMessage(
              autoSendConnection.endpoint,
              autoSendConnection.selectedSessionId,
              markdown,
              autoSendConnection.selectedSessionDirectory
            );
            console.log('[MessageRouter] Auto-sent issue to OpenCode');
          } else if (autoSendType === 'vscode' && autoSendConnection.selectedInstanceId && autoSendConnection.selectedInstancePort) {
            await vsCodeClient.sendMessage(
              autoSendConnection.selectedInstanceId,
              autoSendConnection.selectedInstancePort,
              markdown
            );
            console.log('[MessageRouter] Auto-sent issue to VSCode');
          }

          // Mark as exported
          await storageManager.markIssueExported(issue.id);
          // Clear auto-sending state on success
          await chrome.storage.session.remove(['autoSendingIssueId', 'autoSendingConnectionType']);
        } catch (e) {
          console.warn('[MessageRouter] Auto-send failed:', e);
          // Set error flag and clear sending state
          await chrome.storage.session.set({ autoSendError: true });
          await chrome.storage.session.remove(['autoSendingIssueId', 'autoSendingConnectionType']);
        }
      }

      return true;
    }

    case 'ELEMENT_PICKER_CANCELLED': {
      // Clear pending issue
      await chrome.storage.session.remove('pendingIssue');

      // Return to monitoring state
      await sessionStateMachine.finishElementSelection();

      return true;
    }

    default:
      throw new Error(`Unknown content message type: ${(message as { type: string }).type}`);
  }
}

/**
 * Initialize the message router.
 */
export function initMessageRouter(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Determine message source based on sender
    const isFromPopup = !sender.tab;
    const isFromContent = !!sender.tab;

    let handlePromise: Promise<StateResponse | ExportResponse | ConnectionsResponse | ConnectionMutationResponse | TestConnectionResponse | OpenCodeSessionsResponse | SendToOpenCodeResponse | VSCodeInstancesResponse | SendToVSCodeResponse | CustomAttributesResponse | CustomAttributeMutationResponse | boolean>;

    if (isFromPopup) {
      handlePromise = handlePopupMessage(
        message as PopupToBackgroundMessage,
        sender
      );
    } else if (isFromContent) {
      handlePromise = handleContentMessage(
        message as ContentToBackgroundMessage,
        sender
      );
    } else {
      sendResponse({ error: 'Unknown message source' });
      return false;
    }

    handlePromise
      .then((result) => sendResponse(result))
      .catch((error) => {
        // Use warn instead of error - most errors here are expected
        // (restricted pages, state guards, etc.) and are handled in the UI
        console.warn('[MessageRouter] Error handling message:', error);
        sendResponse({ error: error.message });
      });

    // Return true to indicate async response
    return true;
  });
}
