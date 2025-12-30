import type {
  BackgroundToContentMessage,
  ContentToBackgroundMessage,
  ExportResponse,
  PopupToBackgroundMessage,
  StateResponse,
} from '@/shared/messages';
import type { Issue } from '@/shared/types';
import { storageManager } from './StorageManager';
import { sessionStateMachine } from './SessionStateMachine';
import { markdownExporter } from '@/exporter/MarkdownExporter';
import { cdpController } from './CDPController';

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
    console.error('[MessageRouter] Content script injection failed:', e);
    // Still add to injectedTabs to avoid repeated failed attempts
    // The script might already be there from a previous session
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
): Promise<StateResponse | ExportResponse | boolean> {
  switch (message.type) {
    case 'GET_STATE': {
      const session = sessionStateMachine.getSession();
      let issues: Issue[] = [];
      let errorCount = { network: 0, console: 0 };

      if (session) {
        issues = await storageManager.getIssues(session.sessionId);
        errorCount = await storageManager.getErrorCounts(session.sessionId);
      }

      // Get paused state
      const pausedResult = await chrome.storage.session.get('isPaused');
      const isPaused = pausedResult.isPaused === true;

      return {
        session,
        issues,
        errorCount,
        isPaused,
      } as StateResponse;
    }

    case 'START_LISTENING': {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id || !tab.url) {
        throw new Error('No active tab found');
      }

      // Start monitoring
      await sessionStateMachine.startMonitoring(tab.id);

      // Attach CDP for error capture
      await cdpController.attach(tab.id);

      // Ensure not paused
      await chrome.storage.session.set({ isPaused: false });

      return true;
    }

    case 'PAUSE_LISTENING': {
      // Detach CDP to stop monitoring
      if (cdpController.isAttached()) {
        await cdpController.detach();
      }

      // Store paused state
      await chrome.storage.session.set({ isPaused: true });

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

      if (!tab?.id) {
        throw new Error('No active tab found');
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

      // Tell content script to start element picker
      console.log('[MessageRouter] Sending START_ELEMENT_PICKER to tab:', session.tabId);
      try {
        const response = await chrome.tabs.sendMessage(session.tabId, {
          type: 'START_ELEMENT_PICKER',
          issueType: message.issueType,
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
      const session = sessionStateMachine.getSession();
      if (!session) {
        throw new Error('No active session');
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
      const session = sessionStateMachine.getSession();
      if (!session) {
        throw new Error('No active session');
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

    case 'CLEAR_SESSION': {
      // Detach CDP
      if (cdpController.isAttached()) {
        await cdpController.detach();
      }

      // Reset session
      await sessionStateMachine.forceReset(true);

      // Clear injection tracking
      injectedTabs.clear();

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
  _sender: chrome.runtime.MessageSender
): Promise<boolean> {
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

      // Open the extension popup to show the logged issue
      try {
        await chrome.action.openPopup();
      } catch (e) {
        // openPopup may fail if not supported or user gesture required
        console.log('[MessageRouter] Could not open popup:', e);
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

    let handlePromise: Promise<StateResponse | ExportResponse | boolean>;

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
        console.error('[MessageRouter] Error handling message:', error);
        sendResponse({ error: error.message });
      });

    // Return true to indicate async response
    return true;
  });
}
