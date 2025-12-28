/**
 * ClankerContext Background Service Worker
 *
 * The main orchestrator for the extension. Manages:
 * - Session state machine
 * - CDP connection for console/network error capture
 * - Message routing between components
 * - Storage coordination
 */

import { storageManager } from './StorageManager';
import { sessionStateMachine } from './SessionStateMachine';
import { initMessageRouter, clearInjectionTracking } from './MessageRouter';
import { cdpController } from './CDPController';

/**
 * Initialize the background service worker.
 */
async function init(): Promise<void> {
  console.log('[ClankerContext] Initializing background service worker');

  // Initialize storage
  await storageManager.init();

  // Try to rehydrate session state from storage (for service worker restart)
  const rehydrated = await sessionStateMachine.rehydrate();
  if (rehydrated) {
    const session = sessionStateMachine.getSession();
    console.log('[ClankerContext] Session rehydrated, state:', session?.state);

    // Check if paused
    const pausedResult = await chrome.storage.session.get('isPaused');
    const isPaused = pausedResult.isPaused === true;

    // If we have an active session and not paused, try to re-attach CDP
    if (session && sessionStateMachine.isMonitoring() && !isPaused) {
      try {
        await cdpController.attach(session.tabId);
        console.log('[ClankerContext] CDP re-attached to tab:', session.tabId);
      } catch (e) {
        console.warn('[ClankerContext] Failed to re-attach CDP:', e);
        // Session is still valid, just without CDP monitoring
      }
    } else if (isPaused) {
      console.log('[ClankerContext] Session is paused, not attaching CDP');
    }
  }

  // Initialize message routing
  initMessageRouter();

  // Subscribe to session events for logging
  sessionStateMachine.subscribe((event) => {
    console.log('[SessionStateMachine] Event:', event.type, event.state);
  });

  console.log('[ClankerContext] Background service worker initialized');
}

// Initialize on service worker start
init().catch((error) => {
  console.error('[ClankerContext] Failed to initialize:', error);
});

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[ClankerContext] Extension installed:', details.reason);
});

// Handle tab switching - move session to new tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const session = sessionStateMachine.getSession();
  if (!session || !sessionStateMachine.isMonitoring()) {
    return;
  }

  // Skip if paused
  const pausedResult = await chrome.storage.session.get('isPaused');
  if (pausedResult.isPaused === true) {
    return;
  }

  // Skip if same tab
  if (session.tabId === activeInfo.tabId) {
    return;
  }

  console.log('[ClankerContext] Tab switched from', session.tabId, 'to', activeInfo.tabId);

  try {
    // Detach CDP from old tab
    if (cdpController.isAttached()) {
      await cdpController.detach();
    }

    // Clear old error logs (keep issues)
    await storageManager.clearErrors(session.sessionId);

    // Switch session to new tab
    await sessionStateMachine.switchTab(activeInfo.tabId);

    // Clear content script injection tracking for new tab
    clearInjectionTracking(activeInfo.tabId);

    // Attach CDP to new tab
    await cdpController.attach(activeInfo.tabId);

    console.log('[ClankerContext] Session switched to tab:', activeInfo.tabId);
  } catch (e) {
    console.warn('[ClankerContext] Failed to switch tab:', e);
  }
});

// Handle service worker activation
self.addEventListener('activate', () => {
  console.log('[ClankerContext] Service worker activated');
});
